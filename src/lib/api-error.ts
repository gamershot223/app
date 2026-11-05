/**
 * WORKAI:PLATFORM-OWNED — разбор ошибок data-API, файл платформы WorkAI.
 * This file is managed by the WorkAI platform. Do not edit it directly.
 *
 * Что показывать человеку, когда запрос к data-API вернул не-2xx.
 *
 * ЧТО СЛУЧИЛОСЬ (прод, оформление заказа). Клиент шаблона делал так:
 *
 *     if (!res.ok) throw new Error((await res.text()).slice(0, 200));
 *
 * а страница печатала `err.message` покупателю. Пока превью перезапускалось,
 * прокси отдавал на `fetch` служебный JSON — и в форме заказа оказался текст
 *
 *     {"error":"preview_restarting","message":"Preview is temporarily
 *      unrouted — retry shortly (ingress default-backend (HTTP 404))"}
 *
 * Прокси при этом вёл себя ровно как задумано: заглушку-HTML он отдаёт только
 * навигации и кадру кабинета, а ассетам и `fetch` — JSON, иначе разметка
 * приехала бы вместо стилей и сломала Vite/HMR (см. шапку
 * `builder-web-preview-waking.page.ts`, решение владельца 09.08.2026). Дырой
 * был клиент: он печатал СЫРОЕ тело любого не-2xx ответа. «ingress» и
 * «default-backend» — внутренности платформы, посетителю магазина их видеть
 * нельзя ни при каком дизайне.
 *
 * ПРАВИЛО. Наружу уходит только текст, который мы сами построили. Тело ответа
 * показывается лишь тогда, когда доказано, что это ошибка ДАННЫХ проекта —
 * то есть PostgREST/PostgreSQL-конверт `{code, message, details, hint}`
 * (docs.postgrest.org, References → Errors). Всё остальное — HTML от nginx,
 * пустое тело, служебный конверт платформы, неизвестный JSON — сводится к
 * одному дружелюбному фолбэку.
 *
 * Различать по HTTP-статусу нельзя: 503 отдаёт и перезапускающееся превью, и
 * сам PostgREST на классе ошибок `08*` (обрыв соединения с БД). Признак —
 * форма тела, а не статус.
 *
 * Файл лежит побайтовой копией в каждом шаблоне, который пишет в data-API
 * (shop, booking, crm, webapp); совпадение стережёт
 * `builder-web-template-api-error-text.spec.ts`. Правится одним движением во
 * всех копиях.
 */

/** Показываем, когда честного и безопасного текста нет. */
export const GENERIC_API_ERROR =
  'Не удалось отправить данные. Попробуйте ещё раз через минуту.';

/**
 * Служебные коды платформы из конверта `{"error": "...", "message": "..."}`
 * (`builder-web-preview-proxy-forward.service.ts`). Это НЕ ошибка проекта:
 * человеку тут показывать нечего, кроме «попробуйте ещё раз».
 *
 * Проверяем именно snake_case-код сервиса, а не сам факт поля `error`: у
 * ошибок платформенного `/auth` конверт Nest — `{statusCode, error: "Bad
 * Request", message}`, и его человеческий `message` показывать как раз стоит.
 */
const PLATFORM_ERROR_CODE = /^(preview|proxy|app|runner|publish)_[a-z0-9_]+$/;

/**
 * Слова инфраструктуры. Последний рубеж: даже если такой текст пролез в поле
 * `message` разрешённого конверта, наружу он не уйдёт.
 */
const INFRA_WORDS =
  /ingress|default-backend|upstream|nginx|kubernetes|kube-|namespace|cluster|traefik|envoy|gateway timeout|econnrefused|enotfound|127\.0\.0\.1|localhost|\.svc\b|\bpod\b|\bvite\b|\bhmr\b/i;

/** Максимум, который вообще имеет смысл читать глазами. */
const MAX_LEN = 160;

type ApiErrorBody = {
  code?: unknown;
  message?: unknown;
  details?: unknown;
  hint?: unknown;
  error?: unknown;
};

/**
 * Русские тексты для кодов, которые посетитель встречает по-настоящему часто.
 * Ключи — SQLSTATE PostgreSQL; PostgREST кладёт его в поле `code` как есть и
 * отображает на HTTP-статус (23505 → 409, 08* → 503 и т.д.).
 */
const BY_CODE: Record<string, string> = {
  '23502': 'Заполнены не все обязательные поля.',
  '23503': 'Не найдена связанная запись — обновите страницу и попробуйте снова.',
  '23505': 'Такая запись уже есть.',
  '23514': 'Данные не прошли проверку — исправьте поля и попробуйте ещё раз.',
  '22001': 'Слишком длинное значение в одном из полей.',
  '22007': 'Неверный формат даты.',
  '22P02': 'Неверный формат одного из полей.',
  '42501': 'Сервер отклонил запись: недостаточно прав.',
};

/** Одна строка, без управляющих символов, обрезанная по длине. */
function tidy(text: string): string {
  const oneLine = text
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f\u007f]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return oneLine.length > MAX_LEN ? `${oneLine.slice(0, MAX_LEN - 1)}…` : oneLine;
}

/**
 * Фолбэк, уточнённый статусом. Сам статус человеку не показываем: 429 —
 * единственный случай, когда совет отличается от «попробуйте ещё раз», потому
 * что помогает именно пауза.
 */
function fallbackFor(status: number, fallback: string): string {
  return status === 429
    ? 'Слишком много попыток подряд. Подождите минуту и попробуйте снова.'
    : fallback;
}

/**
 * Первое непустое строковое поле. Массив — не экзотика: у ошибок валидации
 * Nest (`class-validator`) поле `message` приходит списком строк.
 */
function firstString(...values: unknown[]): string {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value;
    if (Array.isArray(value)) {
      const joined = value.filter((v): v is string => typeof v === 'string').join('. ');
      if (joined.trim()) return joined;
    }
  }
  return '';
}

function parseJsonObject(body: string): ApiErrorBody | null {
  if (!body.trim().startsWith('{')) return null;
  try {
    const parsed: unknown = JSON.parse(body);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as ApiErrorBody)
      : null;
  } catch {
    return null;
  }
}

/**
 * Разбор тела не-2xx ответа. Чистая функция — её и проверяют тесты.
 *
 * `code` возвращаем отдельно: человеку он не показывается, но нужен вызывающей
 * стороне и уезжает в консоль. `safe: false` означает «текст ответа наружу не
 * пошёл» — на это опираются тесты.
 */
export function describeApiFailure(
  body: string,
  status: number,
  fallback: string = GENERIC_API_ERROR,
): { message: string; code: string | null; safe: boolean } {
  const generic = fallbackFor(status, fallback);
  const parsed = parseJsonObject(body ?? '');
  // Не JSON — значит это HTML заглушки, текст nginx или пустота. Показывать
  // нечего: статус человеку тоже ничего не объясняет.
  if (!parsed) return { message: generic, code: null, safe: false };

  const code = typeof parsed.code === 'string' ? parsed.code : null;
  const platformCode = typeof parsed.error === 'string' ? parsed.error : null;
  if (!code && platformCode && PLATFORM_ERROR_CODE.test(platformCode)) {
    return { message: generic, code: platformCode, safe: false };
  }

  const raw = firstString(parsed.message, parsed.details, parsed.hint);
  const text = tidy(raw);
  if (!text || INFRA_WORDS.test(text)) {
    return { message: generic, code, safe: false };
  }

  if (code) {
    const known = BY_CODE[code];
    if (known) return { message: known, code, safe: true };
    // Ошибки самого PostgREST (префикс PGRST) — это ошибка настройки API:
    // «schema cache», «column not found». Посетитель с ней ничего не сделает,
    // а текст английский и технический. Исключение — просроченный токен.
    if (code.startsWith('PGRST')) {
      return code === 'PGRST301'
        ? { message: 'Сессия истекла — войдите заново.', code, safe: true }
        : { message: generic, code, safe: false };
    }
    // Класс 08 — обрыв связи с БД, ровно тот же 503, что и у спящего превью.
    if (code.startsWith('08')) return { message: generic, code, safe: false };
    // P0001 — RAISE из функции самого проекта: текст написал автор проекта,
    // он и адресован человеку. Остальные коды показываем с русской рамкой,
    // чтобы английская строка PostgreSQL не выглядела поломкой сайта.
    return {
      message: code === 'P0001' ? text : `Сервер отклонил данные: ${text}`,
      code,
      safe: true,
    };
  }

  // Конверт без `code` — это наш же платформенный API (`/auth`, `/_workai/*`)
  // с человеческим `message`. Показываем как есть.
  return { message: text, code: null, safe: true };
}

const USER_SAFE = '__workaiUserSafe';

/** Ошибка, чей `message` уже готов к показу человеку. */
export function userSafeError(message: string): Error {
  const err = new Error(message);
  (err as unknown as Record<string, unknown>)[USER_SAFE] = true;
  return err;
}

/**
 * Текст для экрана. Всё, что не помечено как готовое к показу (сетевой сбой
 * `fetch`, баг в коде, чужой Error), сводится к фолбэку: сообщения браузера
 * вроде «Failed to fetch» человеку не адресованы.
 *
 * `fetch` отклоняет промис только на сетевом сбое; любой полученный HTTP-ответ,
 * включая 404 и 503, — это успешный промис с `res.ok === false`.
 */
export function userErrorText(
  err: unknown,
  fallback: string = GENERIC_API_ERROR,
): string {
  return err instanceof Error &&
    (err as unknown as Record<string, unknown>)[USER_SAFE] === true
    ? err.message
    : fallback;
}

/**
 * Готовая ошибка по неуспешному ответу: тело читается один раз, сырой текст
 * уходит в консоль (её подхватывает `error-reporting.ts` и доносит до автора
 * проекта), человеку достаётся только разобранный текст.
 */
export async function apiFailure(
  res: Response,
  fallback: string = GENERIC_API_ERROR,
): Promise<Error> {
  const body = await res.text().catch(() => '');
  const { message, code, safe } = describeApiFailure(body, res.status, fallback);
  const detail = {
    status: res.status,
    url: res.url,
    code,
    body: body.slice(0, 500),
  };
  if (safe) {
    // Разобранная ошибка данных (не заполнено поле, дубль, отказ RLS) — штатная
    // жизнь формы, а не падение проекта: только в консоль разработчика.
    console.warn('[workai] api request rejected', detail);
  } else {
    // Разобрать не удалось — аномалия, и о ней автор проекта должен узнать.
    // Приёмник `error-reporting.ts` берёт из аргументов console.error ИМЕННО
    // объект Error (`args.find(isError)`) и шлёт его message/stack: строка и
    // обычный объект до `/_workai/errors` не доедут, поэтому детали ответа
    // кладём в сам Error, а не только в лог.
    const diagnostic = new Error(
      `api ${res.status} ${res.url || ''} code=${code ?? '-'} body=${body.slice(0, 500)}`,
    );
    console.error('[workai] api request failed', detail, diagnostic);
  }
  return userSafeError(message);
}
