/**
 * WORKAI:PLATFORM-OWNED — подписка на изменения, файл платформы WorkAI.
 * This file is managed by the WorkAI platform. Do not edit it directly.
 *
 * W-341: живые обновления для опубликованных приложений.
 *
 * ЭТО ПОЛЛИНГ, А НЕ PUSH — и не по лени, а потому что push на этой
 * инфраструктуре сегодня некуда воткнуть:
 *  • тенантский Postgres работает через Odyssey в transaction pooling, где
 *    LISTEN/NOTIFY несовместим с prepared statements (сам PostgREST у нас
 *    поднят с PGRST_DB_CHANNEL_ENABLED=false), а роль тенанта имеет
 *    CONNECTION LIMIT 5 при пуле PostgREST в 3 — свободных соединений два;
 *  • PostgREST не умеет push к браузеру вовсе;
 *  • ingress опубликованных приложений идёт с дефолтным
 *    proxy-read-timeout 60s и limit-connections 20 на IP — SSE рвался бы
 *    каждую минуту и занимал бы слот соединения постоянно.
 *
 * Поэтому подписка оформлена как платформенный API: когда push станет
 * возможен, транспорт поменяется ВНУТРИ этого файла, а код приложений
 * останется прежним. Никогда не пишите в приложении голый
 * `setInterval(fetch, …)` — он не умеет ни backoff, ни паузу в фоновой
 * вкладке, ни отмену, и превращается в фоновый шум по всей платформе.
 *
 * Как это дёшево: запрос идёт с фильтром `<курсор> > последнего виденного` по
 * индексу, поэтому «изменений нет» — это пустой массив, а не выборка таблицы.
 * ОБЯЗАТЕЛЬНО заведите индекс на колонку курсора в миграции.
 *
 * ЧТО ПОДПИСКА ВИДИТ. Строго то, у чего курсор стал БОЛЬШЕ последнего
 * виденного. Для `id bigserial` и `created_at` это значит «новые строки»:
 * правка существующей строки их курсор не меняет, и такая правка не придёт
 * НИКОГДА. Если экран должен показывать изменения (статус заказа, счётчик в
 * строке, отметка «прочитано»), курсором обязан быть `updated_at`, который
 * двигается на КАЖДОМ UPDATE — колонка с `DEFAULT now()` этого сама не делает,
 * нужен BEFORE UPDATE-триггер. Тогда изменённая строка приедет повторно, и
 * приложение обязано склеить её с уже показанной по первичному ключу, а не
 * дописать второй раз.
 *
 * Требование к курсору: колонка должна МОНОТОННО РАСТИ и не повторяться.
 * `id bigserial` — идеальный курсор. `created_at timestamptz DEFAULT now()`
 * (значение по умолчанию) годится тоже, но у строк, вставленных ОДНОЙ
 * транзакцией, `now()` совпадает до микросекунды — на границе `limit` такая
 * строка может быть не увидена. Если пишете пачками, курсором берите id.
 */

import { useEffect, useRef, useState } from 'react';
import { apiUrl } from './api';

/** Нижняя граница интервала опроса — сразу после изменения. */
const DEFAULT_MIN_INTERVAL_MS = 2_000;
/** Верхняя граница — до неё доходит backoff, когда ничего не меняется. */
const DEFAULT_MAX_INTERVAL_MS = 30_000;
/** Сколько строк максимум забираем за один опрос. */
const DEFAULT_LIMIT = 100;

export interface LiveSubscribeOptions<T> {
  /** Имя таблицы или view в PostgREST — без базового пути и без `?`. */
  table: string;
  /**
   * Постоянная часть запроса в синтаксисе PostgREST: `select`, фильтры.
   * Например `select=id,text,author&room_id=eq.42`. Без `order` и `limit` —
   * их ставит сам хелпер, иначе курсор перестанет работать.
   */
  query?: string;
  /** Колонка курсора. По умолчанию `created_at`; см. требование выше. */
  cursorColumn?: string;
  limit?: number;
  minIntervalMs?: number;
  maxIntervalMs?: number;
  /**
   * `'load'` (по умолчанию) — первым опросом отдать последние `limit` строк,
   * чтобы экран сразу был заполнен. `'skip'` — начать с текущего конца
   * таблицы и отдавать только то, что появилось ПОСЛЕ подписки.
   */
  initial?: 'load' | 'skip';
  /**
   * Строки в порядке возрастания курсора. Пустых вызовов не бывает.
   * При курсоре `updated_at` сюда придёт и уже показанная строка — склеивайте
   * по первичному ключу, иначе она задвоится на экране.
   */
  onRows: (rows: T[]) => void;
  /** Сетевые ошибки и не-2xx. Опрос при этом не прекращается, а замедляется. */
  onError?: (error: unknown) => void;
  /** Внешняя отмена — подписка снимется вместе с ней. */
  signal?: AbortSignal;
  /**
   * Своя обёртка над fetch — например `authFetch`, если таблица закрыта
   * app-auth. Получает готовый PostgREST-путь, как его понимает `apiUrl`.
   */
  fetcher?: (path: string, init?: RequestInit) => Promise<Response>;
}

function defaultFetcher(path: string, init?: RequestInit): Promise<Response> {
  return fetch(apiUrl(path), init);
}

/** В SSR/тестах `document` может отсутствовать — тогда вкладка не «скрыта». */
function isHidden(): boolean {
  return (
    typeof document !== 'undefined' && document.visibilityState === 'hidden'
  );
}

/**
 * Подписка на новые строки таблицы. Возвращает функцию отписки —
 * вызывайте её в cleanup эффекта.
 */
export function subscribe<T = Record<string, unknown>>(
  options: LiveSubscribeOptions<T>,
): () => void {
  const {
    table,
    query = '',
    cursorColumn = 'created_at',
    limit = DEFAULT_LIMIT,
    minIntervalMs = DEFAULT_MIN_INTERVAL_MS,
    maxIntervalMs = DEFAULT_MAX_INTERVAL_MS,
    initial = 'load',
    onRows,
    onError,
    signal,
    fetcher = defaultFetcher,
  } = options;

  let cursor: string | null = null;
  let interval = minIntervalMs;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let inFlight: AbortController | null = null;
  let stopped = false;
  /** Первый опрос идёт «с конца» — дальше только приращение по курсору. */
  let priming = true;

  const clearTimer = (): void => {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
  };

  /**
   * Курсор обязан приехать в ответе — иначе подписка «работает», но стоит на
   * месте. `select=id,text` без колонки курсора PostgREST вернёт без неё,
   * `cursor` не сдвинется, и КАЖДЫЙ следующий опрос отдаст те же строки
   * заново. Поэтому колонку курсора дописываем в select сами.
   */
  const ensureCursorInSelect = (rawQuery: string): string => {
    const match = /(^|&)select=([^&]*)/.exec(rawQuery);
    if (!match) return rawQuery;
    const fields = match[2].split(',').map((field) => field.trim());
    // `select=*` уже включает всё; точное совпадение имени — тоже.
    if (fields.some((field) => field === '*' || field === cursorColumn)) {
      return rawQuery;
    }
    const patched = match[2] ? `${match[2]},${cursorColumn}` : cursorColumn;
    const start = match.index + match[1].length;
    return `${rawQuery.slice(0, start)}select=${patched}${rawQuery.slice(match.index + match[0].length)}`;
  };

  const buildPath = (): string => {
    const params: string[] = [];
    const trimmedQuery = ensureCursorInSelect(query.replace(/^[?&]+/, ''));
    if (trimmedQuery) params.push(trimmedQuery);

    if (priming) {
      // Последние строки, а не первые: `asc` на большой таблице вернул бы
      // самую древнюю страницу и экран заполнился бы мусором.
      params.push(`order=${cursorColumn}.desc`);
      params.push(`limit=${initial === 'skip' ? 1 : limit}`);
    } else {
      if (cursor !== null) {
        params.push(`${cursorColumn}=gt.${encodeURIComponent(cursor)}`);
      }
      params.push(`order=${cursorColumn}.asc`);
      params.push(`limit=${limit}`);
    }

    return `${table}?${params.join('&')}`;
  };

  const advanceCursor = (rows: T[]): void => {
    const last = rows[rows.length - 1] as Record<string, unknown> | undefined;
    const next = last?.[cursorColumn];
    if (typeof next === 'string' || typeof next === 'number') {
      cursor = String(next);
    }
  };

  const schedule = (): void => {
    clearTimer();
    // Фоновая вкладка не опрашивает вообще: возобновимся по visibilitychange.
    if (stopped || isHidden()) return;
    timer = setTimeout(() => {
      void tick();
    }, interval);
  };

  const tick = async (): Promise<void> => {
    if (stopped || isHidden()) return;
    clearTimer();

    const controller = new AbortController();
    inFlight = controller;
    try {
      const wasPriming = priming;
      const res = await fetcher(buildPath(), { signal: controller.signal });
      if (stopped || controller.signal.aborted) return;
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

      const payload: unknown = await res.json();
      const rows: T[] = Array.isArray(payload) ? (payload as T[]) : [];
      priming = false;

      if (rows.length === 0) {
        // Тишина — опрашиваем всё реже, вплоть до maxIntervalMs.
        interval = Math.min(interval * 2, maxIntervalMs);
        return;
      }

      if (wasPriming) {
        // Первый ответ пришёл в desc — приложению отдаём в хронологии.
        rows.reverse();
        advanceCursor(rows);
        interval = minIntervalMs;
        if (initial === 'load') onRows(rows);
        return;
      }

      advanceCursor(rows);
      // Поток живой — возвращаемся к частому опросу.
      interval = minIntervalMs;
      onRows(rows);
    } catch (error) {
      if (stopped || controller.signal.aborted) return;
      interval = Math.min(interval * 2, maxIntervalMs);
      onError?.(error);
    } finally {
      if (inFlight === controller) inFlight = null;
      schedule();
    }
  };

  const onVisibilityChange = (): void => {
    if (stopped) return;
    if (isHidden()) {
      clearTimer();
      inFlight?.abort();
      return;
    }
    // Вернулись во вкладку — данные нужны немедленно и без накопленного backoff.
    interval = minIntervalMs;
    void tick();
  };

  const stop = (): void => {
    if (stopped) return;
    stopped = true;
    clearTimer();
    inFlight?.abort();
    inFlight = null;
    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', onVisibilityChange);
    }
    signal?.removeEventListener('abort', stop);
  };

  if (signal?.aborted) return () => undefined;
  signal?.addEventListener('abort', stop);
  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', onVisibilityChange);
  }

  void tick();

  return stop;
}

/**
 * React-обёртка над `subscribe`: копит строки в состоянии.
 *
 * `options` читается только при первом рендере и при смене `deps` — так
 * подписка не пересоздаётся на каждый рендер из-за нового объекта опций.
 */
export function useLiveRows<T = Record<string, unknown>>(
  options: Omit<LiveSubscribeOptions<T>, 'onRows'> & {
    onRows?: (rows: T[]) => void;
  },
  deps: unknown[] = [],
): { rows: T[]; error: unknown | null } {
  const [rows, setRows] = useState<T[]>([]);
  const [error, setError] = useState<unknown | null>(null);
  const optionsRef = useRef(options);
  optionsRef.current = options;

  useEffect(() => {
    setRows([]);
    setError(null);
    const unsubscribe = subscribe<T>({
      ...optionsRef.current,
      onRows: (incoming) => {
        setRows((prev) => [...prev, ...incoming]);
        optionsRef.current.onRows?.(incoming);
      },
      onError: (err) => {
        setError(err);
        optionsRef.current.onError?.(err);
      },
    });
    return unsubscribe;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { rows, error };
}
