/**
 * WORKAI:PLATFORM-OWNED — отчёт о рантайм-ошибках, файл платформы WorkAI.
 * This file is managed by the WorkAI platform. Do not edit it directly.
 *
 * Зачем это код ПРОЕКТА, а не блок в nginx. Приём ошибок раньше держался на
 * `location = /_workai/errors` в конфиге приложения: работает, пока сайт живёт
 * на своём поде. Как только он уезжает в бакет (статик-хостинг), своего nginx
 * нет — POST на относительный путь уходит в бакет и ошибка теряется молча.
 * Библиотека внутри проекта едет вместе с проектом на любой хостинг.
 *
 * Что ловим и почему именно так (React 18.3):
 *  - `window.addEventListener('error')` — исключения, до которых не добрался
 *    ни один boundary;
 *  - `unhandledrejection` — упавшие промисы (главный источник в React-коде:
 *    boundary их не видит вовсе);
 *  - `console.error` — ошибки, ПОЙМАННЫЕ boundary. В production-сборке React
 *    их наружу не пробрасывает: «In production the errors will not bubble up,
 *    which means any ancestor error handler will only receive errors not
 *    explicitly caught by componentDidCatch» (React 18 docs, Component.md).
 *    То есть хук только на window пропустил бы ровно те падения, из-за
 *    которых посетитель видит фолбэк, — а это самые важные. Сам React и наш
 *    `ErrorBoundary.componentDidCatch` логируют такую ошибку в `console.error`
 *    с настоящим объектом Error, поэтому обёртка console — единственный
 *    приёмник, который видит их все и не требует правки компонентов.
 *
 * Чего НЕ делаем: не собираем значения полей форм, cookie, localStorage и
 * query-строку. В отчёт уходит сообщение, стек, цепочка `cause` и путь
 * страницы; платформа дополнительно чистит текст от ПДн (scrubPii).
 *
 * Агент: не удаляй вызов `installErrorReporting()` в `main.tsx`. Чтобы
 * отправить ошибку вручную (например, из catch), импортируй `reportError`.
 */

/**
 * Относительный путь — его проксирует nginx приложения на поде. На статик-
 * хостинге платформа заменяет ЭТУ СТРОКУ на абсолютный URL приёмника при
 * публикации (как у формы заявок W35), поэтому литерал должен остаться
 * одним куском: не собирай его из частей и не выноси в переменную окружения.
 */
const ENDPOINT = '/_workai/errors';

/**
 * Потолок отчётов в скользящем окне `REPORT_WINDOW_MS`, а НЕ на загрузку
 * страницы: вкладка превью живёт часами, пока владелец гоняет генерации, и
 * потолок «на загрузку» после двадцатого отчёта глушил бы её навсегда — в том
 * числе для ошибок, появившихся уже после этого двадцатого.
 */
const MAX_REPORTS = 20;
const REPORT_WINDOW_MS = 60 * 60_000;
/** Всплеск: не больше стольких отчётов за окно ниже. */
const BURST_LIMIT = 5;
const BURST_WINDOW_MS = 10_000;
/**
 * Сколько молчать про уже отправленную ошибку, прежде чем отправить её снова.
 *
 * Дедуп обязан быть временным, а не вечным. Платформа помечает ошибку,
 * замеченную во время активной генерации, полем `observedDuringRunId` и не
 * тратит на неё платный авто-фикс: чаще всего это «полуготовое дерево»
 * (компонент импортировал константу из ещё не дописанного файла). Пометка
 * снимается сама — но только когда ТА ЖЕ ошибка приедет ещё раз уже вне
 * генерации. С вечным дедупом второго отчёта не бывает: модуль перезагрузился
 * по HMR, ошибка воспроизвелась, а библиотека молчит, потому что ключ уже в
 * списке отправленных. Настоящий, невыдуманный баг так и остаётся невидимым
 * для авто-фикса до перезагрузки страницы.
 *
 * Пять минут — компромисс: не спам (сломанный рендер в цикле шлёт один отчёт,
 * а не тысячу) и не потеря (крон авто-фикса разбирает очередь раз в минуту и
 * не требует, чтобы повтор пришёл в какое-то конкретное окно).
 */
const DEDUP_TTL_MS = 5 * 60_000;

/** Глубина цепочки `cause` — дальше обычно уже не диагностика, а шум. */
const CAUSE_DEPTH_LIMIT = 5;
const MESSAGE_LIMIT = 1_000;
const STACK_LIMIT = 8_000;

export type ReportContext = {
  /** Откуда приехала ошибка — попадает в первую строку стека. */
  mechanism?:
    | 'onerror'
    | 'unhandledrejection'
    | 'error_boundary'
    | 'console'
    | 'manual';
  /** `info.componentStack` из `componentDidCatch`, если есть. */
  componentStack?: string;
};

let installed = false;
let burstStartedAt = 0;
let burstCount = 0;
/** Реентранс-замок: наш собственный код не должен попасть в свой же хук. */
let reporting = false;
/** Ключ дедупа → время последней отправки, а не «отправляли когда-нибудь». */
const seen = new Map<string, number>();
/** Времена отправок внутри `REPORT_WINDOW_MS`; протухшие вытесняются. */
const sentAt: number[] = [];
/**
 * Повторы, придержанные дедупом и ждущие отправки (ключ → таймер).
 *
 * Придержать — не то же самое, что выбросить. Ошибка могла воспроизвестись
 * ровно один раз после конца генерации (последний HMR доложил её и больше
 * рендер не падал). Если этот единственный повтор просто потерять, серверная
 * пометка `observedDuringRunId` не снимется никогда, и настоящий баг навсегда
 * останется невидимым для авто-фикса — то есть починка обернулась бы тем же
 * дефектом, что и вечный Set.
 */
const heldForRevalidation = new Map<string, ReturnType<typeof setTimeout>>();
/** Потолок отложенных: сломанный рендер не должен наплодить сотню таймеров. */
const MAX_HELD_REVALIDATIONS = 5;

function isError(value: unknown): value is Error {
  return value instanceof Error;
}

function safeString(value: unknown): string {
  try {
    if (typeof value === 'string') return value;
    return JSON.stringify(value) ?? String(value);
  } catch {
    return Object.prototype.toString.call(value);
  }
}

/**
 * Короткое сообщение для группировки на стороне платформы.
 * Брошенный `Response` (частый случай в коде работы с данными) в `String()`
 * превращается в бесполезное `[object Response]` — разворачиваем его сами.
 */
function messageOf(value: unknown): string {
  if (typeof Response !== 'undefined' && value instanceof Response) {
    return `Response ${value.status}${value.url ? ` at ${value.url}` : ''}`;
  }
  if (isError(value)) {
    return `${value.name}: ${value.message}`.replace(/^Error: /, '');
  }
  return safeString(value);
}

/**
 * Полное описание со стеком и цепочкой `cause`. Голое «Error» без стека
 * агенту, который потом чинит баг, не говорит ничего.
 */
function describe(value: unknown): string {
  const parts: string[] = [];
  let current: unknown = value;
  for (let depth = 0; depth < CAUSE_DEPTH_LIMIT && current != null; depth += 1) {
    if (!isError(current)) {
      parts.push(messageOf(current));
      break;
    }
    const prefix = depth === 0 ? '' : 'caused by: ';
    parts.push(
      `${prefix}${current.stack ?? `${current.name}: ${current.message}`}`,
    );
    current = (current as { cause?: unknown }).cause;
  }
  return parts.join('\n');
}

/**
 * Путь без query-строки и без #фрагмента: в query бывают ПДн, а во фрагменте
 * OAuth-возврат кладёт access/refresh-токены. Для диагностики нужен только путь.
 */
function routeOf(): string {
  try {
    return window.location.pathname;
  } catch {
    return '';
  }
}

/**
 * Лимиты. Дедуп по тексту — один сломанный рендер в цикле иначе отправил бы
 * тысячи одинаковых отчётов; всплеск ограничен окном, а не только общим
 * потолком, чтобы редкая ошибка на долгой сессии всё-таки доехала. Все три
 * лимита — скользящие: вкладку превью не перезагружают часами, и любой лимит
 * «на загрузку страницы» рано или поздно превращается в вечное молчание.
 */
type Verdict = 'ok' | 'dedup' | 'burst' | 'budget';

function allowed(key: string): Verdict {
  const now = Date.now();

  const lastSentAt = seen.get(key);
  if (lastSentAt !== undefined && now - lastSentAt < DEDUP_TTL_MS) return 'dedup';

  while (sentAt.length > 0 && now - sentAt[0] >= REPORT_WINDOW_MS) {
    sentAt.shift();
  }
  if (sentAt.length >= MAX_REPORTS) return 'budget';

  if (now - burstStartedAt > BURST_WINDOW_MS) {
    burstStartedAt = now;
    burstCount = 0;
  }
  if (burstCount >= BURST_LIMIT) return 'burst';

  // Чистка протухших ключей: без неё Map растёт всю жизнь вкладки. Удаление
  // во время перебора Map безопасно — итератор видит только живые записи.
  for (const [staleKey, sentAtMs] of seen) {
    if (now - sentAtMs >= DEDUP_TTL_MS) seen.delete(staleKey);
  }

  seen.set(key, now);
  sentAt.push(now);
  burstCount += 1;
  return 'ok';
}

/**
 * Придержать повтор до конца окна дедупа и отправить его тогда.
 *
 * Ждём ровно остаток TTL, а не фиксированную паузу: к моменту срабатывания
 * дедуп уже пропустит ключ. Планируем только по одному таймеру на ключ —
 * ошибка в цикле рендера иначе завела бы их тысячи.
 */
function holdForRevalidation(key: string, body: string): void {
  if (heldForRevalidation.has(key)) return;
  if (heldForRevalidation.size >= MAX_HELD_REVALIDATIONS) return;
  if (typeof setTimeout !== 'function') return;

  const lastSentAt = seen.get(key) ?? 0;
  const wait = Math.max(0, DEDUP_TTL_MS - (Date.now() - lastSentAt));
  const timer = setTimeout(() => {
    heldForRevalidation.delete(key);
    // Лимиты применяются заново: за это время мог кончиться часовой бюджет.
    if (allowed(key) === 'ok') post(body);
  }, wait);
  heldForRevalidation.set(key, timer);
}

/**
 * Отправка «как получится»: приёмник может лежать, домен — быть недоступен,
 * `sendBeacon` — вернуть false. Ни один из этих случаев не имеет права
 * уронить сайт или добавить своё необработанное отклонение промиса.
 *
 * `text/plain` намеренно: так кросс-доменный POST со статик-хостинга остаётся
 * простым запросом и не требует CORS-preflight (`sendBeacon` его не умеет).
 */
function post(body: string): void {
  try {
    if (
      typeof navigator !== 'undefined' &&
      typeof navigator.sendBeacon === 'function' &&
      navigator.sendBeacon(
        ENDPOINT,
        new Blob([body], { type: 'text/plain;charset=UTF-8' }),
      )
    ) {
      return;
    }
  } catch {
    // sendBeacon недоступен или отверг тело — пробуем fetch ниже.
  }
  try {
    void fetch(ENDPOINT, {
      method: 'POST',
      body,
      headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
      keepalive: true,
      // same-origin: в живом превью нужна кука `workai_preview_pt_*`
      // (W-51). На опубликованном статик-хостинге ENDPOINT переписывается
      // на абсолютный URL платформы — запрос кросс-доменный, куки туда
      // всё равно не уедут (в отличие от 'include').
      credentials: 'same-origin',
      mode: 'cors',
      // Ошибку сети гасим здесь: без catch упавший приёмник сам стал бы
      // unhandledrejection и вызвал бы новый отчёт — бесконечный цикл.
    }).catch(() => undefined);
  } catch {
    // Нет fetch (или его подменили) — отчёт просто теряем.
  }
}

/**
 * Отправить ошибку вручную. Безопасна к вызову откуда угодно: не бросает и
 * ничего не возвращает.
 */
export function reportError(error: unknown, context: ReportContext = {}): void {
  if (reporting) return;
  reporting = true;
  try {
    const message = messageOf(error).slice(0, MESSAGE_LIMIT).trim();
    if (!message) return;
    const details = describe(error);
    const head = [
      context.mechanism ? `[${context.mechanism}]` : null,
      details,
      context.componentStack ? `componentStack:${context.componentStack}` : null,
    ]
      .filter(Boolean)
      .join('\n');
    const body = JSON.stringify({
      source: 'frontend',
      message,
      stack: head.slice(0, STACK_LIMIT),
      url: routeOf(),
    });
    // Ключ дедупа — только текст, без механизма: в dev-сборке одна и та же
    // ошибка приходит и в boundary, и в window (React пробрасывает её наружу
    // только там), и отчёт ушёл бы дважды.
    const verdict = allowed(message);
    if (verdict === 'dedup') {
      // Не выбрасываем — придерживаем до конца окна: этот повтор может
      // оказаться единственным доказательством, что ошибка не транзиентная.
      holdForRevalidation(message, body);
      return;
    }
    if (verdict !== 'ok') return;
    post(body);
  } catch {
    // Отчёт об ошибке не имеет права стать ошибкой.
  } finally {
    reporting = false;
  }
}

/**
 * Подписывает все три приёмника. Вызывать один раз, до первого рендера.
 */
export function installErrorReporting(): void {
  if (installed || typeof window === 'undefined') return;
  installed = true;
  // Метка для инлайн-скрипта, который платформа встраивает в <head>
  // опубликованного приложения: увидев её, он уступает нам фронтовые ошибки и
  // не шлёт второй отчёт о том же падении.
  (window as unknown as { __WORKAI_ERR_LIB__?: number }).__WORKAI_ERR_LIB__ = 1;

  window.addEventListener('error', (event: ErrorEvent) => {
    // Событие загрузки ресурса (битая картинка, не подгрузившийся скрипт)
    // всплывает тем же типом, но без объекта Error и с элементом в target.
    // Это не падение приложения — в отчёт не идёт.
    if (event.target && event.target !== window) return;
    reportError(event.error ?? event.message, { mechanism: 'onerror' });
  });

  window.addEventListener('unhandledrejection', (event: PromiseRejectionEvent) => {
    reportError(event.reason, { mechanism: 'unhandledrejection' });
  });

  // Обёртка console.error — единственный способ увидеть ошибку, пойманную
  // ErrorBoundary: production-React её наружу не пробрасывает (см. шапку).
  // Оригинал вызывается всегда и первым аргументом — поведение консоли для
  // разработчика не меняется.
  const original = console.error.bind(console);
  console.error = (...args: unknown[]): void => {
    original(...args);
    const error = args.find(isError);
    if (!error) return;
    // `ErrorBoundary.componentDidCatch` логирует ровно
    // `console.error('[ErrorBoundary]', error, info.componentStack)` — по
    // маркеру отличаем падение рендера от произвольного лога приложения и
    // забираем стек компонентов. Если маркер когда-нибудь сменится, отчёт
    // всё равно уйдёт, просто с механизмом `console`.
    const boundary = args[0] === '[ErrorBoundary]';
    const componentStack = args[2];
    reportError(error, {
      mechanism: boundary ? 'error_boundary' : 'console',
      componentStack:
        boundary && typeof componentStack === 'string'
          ? componentStack
          : undefined,
    });
  };
}
