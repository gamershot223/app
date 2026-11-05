/**
 * Базовая авторизация конечного пользователя через платформенный `/auth/`.
 * Токены живут только в origin этого опубликованного приложения; URL всегда
 * строятся base-relative, поэтому работают и в preview с префиксом пути.
 */
import { authUrl } from './api';
import { userSafeError } from './api-error';

// Preview живут на общем origin, но с разными Vite base. Ключи обязаны быть
// разделены по base, иначе одна preview-папка подхватит чужую app-сессию.
const PREVIEW_BASE =
  (import.meta.env.BASE_URL || '/').replace(/\/+$/, '') || '/';
const STORAGE_SCOPE = encodeURIComponent(PREVIEW_BASE);
const ACCESS_TOKEN_KEY = `workai_app:${STORAGE_SCOPE}:access_token`;
const REFRESH_TOKEN_KEY = `workai_app:${STORAGE_SCOPE}:refresh_token`;
const REFRESH_LOCK_NAME = `workai-app-auth-refresh:${STORAGE_SCOPE}`;
const REFRESH_CHANNEL_NAME = `workai-app-auth:${STORAGE_SCOPE}`;
const TAB_ID =
  typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random()}`;

export type AppUser = { id: string; email: string; email_verified?: boolean };
export type LogoutEverywhereResult =
  { completed: true; residualSeconds?: number } | { completed: false };
type SessionResponse = {
  access_token?: unknown;
  refresh_token?: unknown;
  user?: unknown;
};
type Session = { accessToken: string; refreshToken: string };
type RefreshResult =
  'refreshed' | 'definitive-auth-failure' | 'transient-failure' | 'missing';
type CurrentUserResult =
  | { kind: 'user'; user: AppUser }
  | { kind: 'definitive-auth-failure' }
  | { kind: 'transient-failure' };

// Один refresh-token одноразовый. Все 401 в одной вкладке должны ждать один
// обмен: второй запрос тем же token'ом иначе выглядит как его кража.
let refreshInFlight: Promise<RefreshResult> | null = null;
let refreshChannel: BroadcastChannel | null | undefined;
const peerRefreshOwners = new Map<string, string>();

function authChannel(): BroadcastChannel | null {
  if (refreshChannel !== undefined) return refreshChannel;
  if (typeof BroadcastChannel === 'undefined') {
    refreshChannel = null;
    return refreshChannel;
  }
  refreshChannel = new BroadcastChannel(REFRESH_CHANNEL_NAME);
  refreshChannel.onmessage = (event: MessageEvent<unknown>) => {
    const data = event.data;
    if (!data || typeof data !== 'object') return;
    const message = data as {
      type?: unknown;
      token?: unknown;
      owner?: unknown;
    };
    if (
      message.type !== 'refresh-start' ||
      typeof message.token !== 'string' ||
      typeof message.owner !== 'string'
    ) {
      return;
    }
    const known = peerRefreshOwners.get(message.token);
    if (!known || message.owner < known)
      peerRefreshOwners.set(message.token, message.owner);
  };
  return refreshChannel;
}

function announce(message: Record<string, string>): void {
  try {
    authChannel()?.postMessage(message);
  } catch {
    // BroadcastChannel — enhancement для старых браузеров, не prerequisite auth.
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function get(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function set(key: string, value: string | null): void {
  try {
    if (value) localStorage.setItem(key, value);
    else localStorage.removeItem(key);
  } catch {
    // Private mode/storage policy must not break the public page.
  }
}

function sessionFrom(value: SessionResponse): Session | null {
  const accessToken =
    typeof value.access_token === 'string' ? value.access_token : '';
  const refreshToken =
    typeof value.refresh_token === 'string' ? value.refresh_token : '';
  return accessToken && refreshToken ? { accessToken, refreshToken } : null;
}

function saveSession(session: Session): void {
  set(ACCESS_TOKEN_KEY, session.accessToken);
  // Refresh token rotates on every /auth/refresh response: overwrite it too.
  set(REFRESH_TOKEN_KEY, session.refreshToken);
  announce({ type: 'session-advanced' });
}

export function clearSession(): void {
  set(ACCESS_TOKEN_KEY, null);
  set(REFRESH_TOKEN_KEY, null);
  announce({ type: 'session-cleared' });
}

function storedAccessToken(): string | null {
  return get(ACCESS_TOKEN_KEY);
}

function storedRefreshToken(): string | null {
  return get(REFRESH_TOKEN_KEY);
}

/** Другая вкладка уже успела заменить одноразовый refresh-token. */
function peerAdvance(refreshToken: string): RefreshResult | null {
  const current = storedRefreshToken();
  if (current === refreshToken) return null;
  return current ? 'refreshed' : 'missing';
}

async function responseJson(response: Response): Promise<SessionResponse> {
  try {
    return (await response.json()) as SessionResponse;
  } catch {
    return {};
  }
}

function userFrom(value: unknown): AppUser | null {
  if (!value || typeof value !== 'object') return null;
  const user = value as Record<string, unknown>;
  return typeof user.id === 'string' && typeof user.email === 'string'
    ? {
        id: user.id,
        email: user.email,
        email_verified: user.email_verified === true,
      }
    : null;
}

const SIGNUP_HINT = '__workaiSignupHint';

/**
 * Ошибка входа, после которой форма предлагает кнопку «Зарегистрироваться»
 * (платформа отвечает 401 одинаково на неверный пароль и на отсутствие
 * аккаунта, поэтому причину не называем).
 */
export function suggestsSignup(err: unknown): boolean {
  return (
    err instanceof Error &&
    (err as unknown as Record<string, unknown>)[SIGNUP_HINT] === true
  );
}

export async function authenticate(
  mode: 'signup' | 'login',
  email: string,
  password: string,
): Promise<AppUser> {
  const response = await fetch(authUrl(mode), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: email.trim(), password, refresh: true }),
  });
  const payload = await responseJson(response);
  const session = sessionFrom(payload);
  const user = userFrom(payload.user);
  if (!response.ok || !session || !user) {
    // Платформа отвечает 401 одинаково на неверный пароль и на отсутствие
    // аккаунта (иначе форма проверяет, какие адреса зарегистрированы), поэтому
    // подсказку про регистрацию даём на любой 401 входа, не называя причину.
    if (mode === 'login' && response.status === 401) {
      // Кнопку «Зарегистрироваться» рисует сама форма рядом с этим текстом
      // (см. suggestsSignup): текст ссылается на действие, которое там есть.
      const err = userSafeError(
        'Неверный email или пароль. Если аккаунта ещё нет, его можно создать с этими же данными.',
      );
      (err as unknown as Record<string, unknown>)[SIGNUP_HINT] = true;
      throw err;
    }
    throw userSafeError(
      'Не удалось выполнить вход. Проверьте данные и попробуйте ещё раз.',
    );
  }
  saveSession(session);
  return user;
}

async function refreshWithToken(refreshToken: string): Promise<RefreshResult> {
  const before = peerAdvance(refreshToken);
  if (before) return before;
  try {
    const response = await fetch(authUrl('refresh'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });
    const session = sessionFrom(await responseJson(response));
    const advanced = peerAdvance(refreshToken);
    if (advanced) return advanced;
    if (response.ok && session) {
      // Не перетирать новую сессию результатом старого запроса refresh.
      if (storedRefreshToken() === refreshToken) saveSession(session);
      return 'refreshed';
    }
    if (response.status === 401 || response.status === 403) {
      // Чистим только именно ту пару, которую подтвердил сервер как мёртвую.
      if (storedRefreshToken() === refreshToken) clearSession();
      return 'definitive-auth-failure';
    }
    // 5xx и некорректное тело не доказывают, что сохранённый refresh-token
    // недействителен: оставляем его для следующей попытки.
    return 'transient-failure';
  } catch {
    return 'transient-failure';
  }
}

async function refreshWithBroadcastFallback(
  refreshToken: string,
): Promise<RefreshResult> {
  announce({ type: 'refresh-start', token: refreshToken, owner: TAB_ID });
  // Даём соседней вкладке объявить лидера. Если сообщения пересеклись поздно,
  // single-use сервер всё равно безопасен: проигравший увидит новый токен в
  // localStorage через peerAdvance() и повторит исходный запрос уже с ним.
  await sleep(20);
  const owner = peerRefreshOwners.get(refreshToken);
  if (owner && owner < TAB_ID) {
    await sleep(250);
    const advanced = peerAdvance(refreshToken);
    if (advanced) return advanced;
  }
  return refreshWithToken(refreshToken);
}

async function refreshAcrossTabs(refreshToken: string): Promise<RefreshResult> {
  const locks = typeof navigator === 'undefined' ? undefined : navigator.locks;
  if (locks?.request) {
    return locks.request(REFRESH_LOCK_NAME, { mode: 'exclusive' }, async () => {
      const advanced = peerAdvance(refreshToken);
      return advanced ?? refreshWithToken(refreshToken);
    });
  }
  return refreshWithBroadcastFallback(refreshToken);
}

/** Обновляет и access, и одноразовый refresh token, один раз на вкладку. */
export function refreshSession(): Promise<RefreshResult> {
  if (refreshInFlight) return refreshInFlight;
  const refreshToken = storedRefreshToken();
  if (!refreshToken) return Promise.resolve('missing');
  const pending = refreshAcrossTabs(refreshToken);
  refreshInFlight = pending;
  void pending.finally(() => {
    if (refreshInFlight === pending) refreshInFlight = null;
  });
  return pending;
}

async function authenticatedRequest(
  url: string,
  init: RequestInit = {},
): Promise<{ response: Response | null; refresh?: RefreshResult }> {
  const request = () => {
    const accessToken = storedAccessToken();
    if (!accessToken) return Promise.resolve(null);
    const headers = new Headers(init.headers);
    headers.set('Authorization', `Bearer ${accessToken}`);
    if (init.body && !headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json');
    }
    return fetch(url, { ...init, headers });
  };
  const first = await request();
  if (!first || first.status !== 401) return { response: first };
  const refresh = await refreshSession();
  if (refresh !== 'refreshed') return { response: first, refresh };
  return { response: await request(), refresh };
}

/** Повторяет защищённый запрос один раз после безопасной ротации refresh-token. */
export async function authenticatedFetch(
  url: string,
  init: RequestInit = {},
): Promise<Response | null> {
  return (await authenticatedRequest(url, init)).response;
}

async function currentUser(): Promise<CurrentUserResult> {
  try {
    const result = await authenticatedRequest(authUrl('me'));
    const { response } = result;
    if (result.refresh === 'transient-failure')
      return { kind: 'transient-failure' };
    if (!response) return { kind: 'definitive-auth-failure' };
    if (response.status === 401 || response.status === 403) {
      return { kind: 'definitive-auth-failure' };
    }
    if (!response.ok) return { kind: 'transient-failure' };
    const user = userFrom(await response.json());
    return user ? { kind: 'user', user } : { kind: 'transient-failure' };
  } catch {
    return { kind: 'transient-failure' };
  }
}

export async function fetchMe(): Promise<AppUser | null> {
  const result = await currentUser();
  return result.kind === 'user' ? result.user : null;
}

export async function requestAccountEmail(
  kind: 'verify' | 'forgot',
  email: string,
): Promise<void> {
  // Both endpoints intentionally answer identically for unknown addresses.
  await fetch(
    authUrl(kind === 'verify' ? 'verify/request' : 'password/forgot'),
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email.trim() }),
    },
  ).catch(() => undefined);
}

export function oauthHref(provider: 'google' | 'yandex'): string {
  return `${authUrl(`oauth/${provider}/start`)}?refresh=1`;
}

const OAUTH_DONE_CHANNEL_NAME = `workai-app-oauth-done:${STORAGE_SCOPE}`;
const OAUTH_DONE_MESSAGE = 'workai-app-oauth-done';
/** Метка «эту вкладку открыл кадр превью»: sessionStorage копируется в popup при window.open. */
const OAUTH_POPUP_MARKER_KEY = `workai_app:${STORAGE_SCOPE}:oauth_popup`;
/** Ошибка входа, пережившая перезагрузку кадра; показывается формой входа один раз. */
const OAUTH_ERROR_KEY = `workai_app:${STORAGE_SCOPE}:oauth_error`;
const OAUTH_FAILED_MESSAGE =
  'Вход через внешний сервис не завершён. Попробуйте другой способ.';
/** Закрытый набор текстов, которые кадр согласен показать из канала. */
const OAUTH_KNOWN_MESSAGES: readonly string[] = [OAUTH_FAILED_MESSAGE];
let oauthDoneListening = false;

function isEmbedded(): boolean {
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
}

function sessionGet(key: string): string | null {
  try {
    return sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

function sessionSet(key: string, value: string | null): void {
  try {
    if (value) sessionStorage.setItem(key, value);
    else sessionStorage.removeItem(key);
  } catch {
    // Private mode/storage policy must not break the public page.
  }
}

/** Текст ошибки OAuth, оставленный до перезагрузки кадра (не удаляет его). */
export function peekPendingOAuthError(): string {
  return sessionGet(OAUTH_ERROR_KEY) ?? '';
}

export function clearPendingOAuthError(): void {
  sessionSet(OAUTH_ERROR_KEY, null);
}

/**
 * Это окно открыл кадр превью для входа (а не обычная вкладка с
 * `#oauth_via=preview`)? Да, если у него есть same-origin `window.opener`
 * либо метка в sessionStorage: провайдер мог оборвать `opener` (COOP), метка
 * скопирована из кадра при `window.open`.
 */
function isOAuthPopupWindow(): boolean {
  if (isEmbedded()) return false;
  try {
    const opener = window.opener as Window | null;
    if (
      opener &&
      opener !== window &&
      opener.location.origin === window.location.origin
    ) {
      return true;
    }
  } catch {
    // Cross-origin opener: читать его location нельзя — это не наш кадр.
  }
  return sessionGet(OAUTH_POPUP_MARKER_KEY) === '1';
}

/**
 * Дешёвая проверка перед входом: кука превью жива? Без неё общий прокси
 * отвечает сухим 404/401, и окно входа показало бы пустую страницу. Сетевой
 * сбой не считаем устареванием — пусть вход пробуется.
 */
async function previewIsStale(): Promise<boolean> {
  try {
    const response = await fetch(
      PREVIEW_BASE === '/' ? '/' : `${PREVIEW_BASE}/`,
      { method: 'HEAD', cache: 'no-store', credentials: 'same-origin' },
    );
    return response.status === 401 || response.status === 404;
  } catch {
    return false;
  }
}

function listenForOAuthDone(): void {
  if (oauthDoneListening) return;
  oauthDoneListening = true;
  const done = (data: { type?: unknown; message?: unknown } | null) => {
    if (data?.type !== OAUTH_DONE_MESSAGE) return;
    // Ошибку переносим через reload только из закрытого набора своих
    // констант; любая другая строка из канала заменяется на общий текст и в
    // DOM не попадает.
    if (typeof data.message === 'string' && data.message) {
      sessionSet(
        OAUTH_ERROR_KEY,
        OAUTH_KNOWN_MESSAGES.includes(data.message)
          ? data.message
          : OAUTH_FAILED_MESSAGE,
      );
    }
    window.location.reload();
  };
  // BroadcastChannel переживает разрыв window.opener из-за COOP провайдера.
  if (typeof BroadcastChannel !== 'undefined') {
    new BroadcastChannel(OAUTH_DONE_CHANNEL_NAME).onmessage = (e) =>
      done(e.data as { type?: unknown; message?: unknown } | null);
  }
  window.addEventListener('message', (e) => {
    if (e.origin === window.location.origin)
      done(e.data as { type?: unknown; message?: unknown } | null);
  });
}

/**
 * Клик по ссылке «Войти через Google/Яндекс». Вне кадра — обычный переход по
 * href, как у опубликованного сайта. В кадре (превью в редакторе) провайдеры
 * запрещают iframe, а `top`-навигация из кадра закрыта sandbox'ом, поэтому
 * вход идёт в popup; окно по завершении сообщает кадру, и тот перечитывает
 * сессию (оба документа на одном origin, localStorage общий).
 *
 * Окно открывается сразу, в обработчике клика (Safari не даёт открыть его
 * после await), а проверка «превью не устарело» идёт, пока оно пустое; при
 * устаревшем превью окно закрывается и вход не начинается.
 */
export function onOAuthClick(
  event: { preventDefault: () => void },
  provider: 'google' | 'yandex',
): void {
  if (!isEmbedded()) return;
  event.preventDefault();
  listenForOAuthDone();
  // sessionStorage копируется в новое окно в момент window.open.
  sessionSet(OAUTH_POPUP_MARKER_KEY, '1');
  const popup = window.open(
    '',
    'workai-oauth',
    'popup=yes,width=520,height=720',
  );
  sessionSet(OAUTH_POPUP_MARKER_KEY, null);
  if (!popup) {
    window.alert(
      'Браузер заблокировал окно входа. Разрешите всплывающие окна для этой страницы и повторите.',
    );
    return;
  }
  void previewIsStale().then((stale) => {
    if (stale) {
      popup.close();
      window.alert('Превью устарело. Обновите его и повторите вход.');
      return;
    }
    popup.location.href = oauthHref(provider);
  });
}

/**
 * Окно OAuth (возврат с `oauth_via=preview`) сообщает кадру-родителю, что вход
 * завершён. `message` — только готовый пользовательский текст ошибки, без
 * токенов и деталей провайдера.
 */
function notifyOAuthDone(message?: string): void {
  const payload = message
    ? { type: OAUTH_DONE_MESSAGE, message }
    : { type: OAUTH_DONE_MESSAGE };
  if (typeof BroadcastChannel !== 'undefined') {
    const channel = new BroadcastChannel(OAUTH_DONE_CHANNEL_NAME);
    channel.postMessage(payload);
    channel.close();
  }
  // Только на свой origin: чужому окну сообщение не уходит.
  window.opener?.postMessage(payload, window.location.origin);
}

export async function restoreSession(): Promise<{
  user: AppUser | null;
  message?: string;
}> {
  const fragment = new URLSearchParams(window.location.hash.replace(/^#/, ''));
  if (fragment.size) {
    // OAuth returns tokens only in #fragment. Remove them before any later navigation.
    window.history.replaceState(
      null,
      '',
      `${window.location.pathname}${window.location.search}`,
    );
    // Возврат из OAuth-окна превью: кадр уведомляем всегда (COOP провайдера
    // мог оборвать opener и потерять метку), а закрываем окно и чистим метку
    // только если его открыл кадр: обычная вкладка не должна закрываться.
    const viaPreview =
      fragment.get('oauth_via') === 'preview' && !isEmbedded();
    const popup = viaPreview && isOAuthPopupWindow();
    if (fragment.get('oauth_error')) {
      if (viaPreview) notifyOAuthDone(OAUTH_FAILED_MESSAGE);
      if (popup) {
        sessionSet(OAUTH_POPUP_MARKER_KEY, null);
        window.close();
      }
      return { user: null, message: OAUTH_FAILED_MESSAGE };
    }
    const session = sessionFrom({
      access_token: fragment.get('access_token'),
      refresh_token: fragment.get('refresh_token'),
    });
    if (!session)
      return { user: null, message: 'Не удалось безопасно завершить вход.' };
    saveSession(session);
    if (viaPreview) notifyOAuthDone();
    if (popup) {
      sessionSet(OAUTH_POPUP_MARKER_KEY, null);
      window.close();
    }
  }
  if (!storedAccessToken()) return { user: null };
  const result = await currentUser();
  if (result.kind === 'user') return { user: result.user };
  if (result.kind === 'definitive-auth-failure') clearSession();
  return result.kind === 'transient-failure'
    ? {
        user: null,
        message: 'Не удалось проверить сессию. Попробуйте ещё раз.',
      }
    : { user: null };
}

export async function logoutCurrentDevice(): Promise<boolean> {
  const refreshToken = get(REFRESH_TOKEN_KEY);
  clearSession();
  if (!refreshToken) return true;
  try {
    return (
      await fetch(authUrl('logout'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: refreshToken }),
      })
    ).ok;
  } catch {
    return false;
  }
}

export async function logoutEverywhere(): Promise<LogoutEverywhereResult> {
  const requestLogout = () => {
    const accessToken = storedAccessToken();
    return accessToken
      ? fetch(authUrl('logout-all'), {
          method: 'POST',
          headers: { Authorization: `Bearer ${accessToken}` },
        })
      : Promise.resolve(null);
  };
  try {
    let response = await requestLogout();
    // Access мог истечь, но refresh ещё жив: сначала обновляем его, потом
    // повторяем logout-all, иначе удалим localStorage и оставим сессии живыми.
    if (!response || response.status === 401) {
      if ((await refreshSession()) !== 'refreshed') return { completed: false };
      response = await requestLogout();
    }
    if (!response?.ok) return { completed: false };
    const body = (await responseJson(response)) as SessionResponse & {
      residual_seconds?: unknown;
    };
    const result =
      typeof body.residual_seconds === 'number'
        ? { completed: true as const, residualSeconds: body.residual_seconds }
        : { completed: true as const };
    // При transient отказе выше local credentials остаются: пользователь может
    // повторить logout-all, а remote refresh-сессии не оказываются забытыми.
    clearSession();
    return result;
  } catch {
    return { completed: false };
  }
}
