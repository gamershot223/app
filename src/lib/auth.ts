/**
 * W20 auth-хелперы поверх платформенного /auth (см. lib/api.ts).
 * Не компонент — живёт вне components/ (react-refresh: файлы компонентов
 * экспортируют только компоненты).
 */
import { apiUrl } from './api';
import {
  authenticate,
  authenticatedFetch,
  fetchMe as fetchPlatformMe,
  requestAccountEmail,
} from './app-auth';
import { apiFailure } from './api-error';

export type AuthUser = {
  id: string;
  email: string;
  /** W21: подтверждён ли адрес. Приложение решает само, что с этим делать. */
  email_verified?: boolean;
};
export type NoteRow = { id: number; body: string; created_at: string };

/** signup/login одним хелпером — раньше логика дублировалась в двух кнопках. */
export async function authRequest(
  mode: 'signup' | 'login',
  email: string,
  password: string,
): Promise<AuthUser> {
  return authenticate(mode, email, password);
}

export async function fetchMe(_token: string): Promise<AuthUser | null> {
  return fetchPlatformMe();
}

/**
 * W21: письмо со ссылкой — на подтверждение почты или на сброс пароля.
 *
 * Ответ всегда пустой и всегда успешный, даже если такого адреса нет: иначе
 * форма «забыли пароль» превращается в проверялку зарегистрированных почт.
 * Показывать пользователю нужно один и тот же текст «письмо отправлено».
 *
 * Дальше человек уходит по ссылке из письма — форму нового пароля и экран
 * подтверждения платформа отдаёт сама, дописывать их в приложение не нужно.
 */
export async function requestAuthEmail(
  kind: 'verify' | 'forgot',
  email: string,
): Promise<void> {
  await requestAccountEmail(kind, email);
}

export async function fetchNotes(): Promise<NoteRow[]> {
  const res = await authenticatedFetch(apiUrl('notes?order=created_at.desc'));
  // Сырое тело наружу не отдаём: под не-2xx может лежать служебный JSON
  // платформы, а не ошибка данных проекта (см. `api-error.ts`).
  if (!res || !res.ok) {
    throw res
      ? await apiFailure(
          res,
          'Не удалось загрузить записи. Попробуйте ещё раз.',
        )
      : new Error('Сессия истекла. Войдите снова.');
  }
  return (await res.json()) as NoteRow[];
}

export async function createNote(userId: string, body: string): Promise<void> {
  const res = await authenticatedFetch(apiUrl('notes'), {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({ user_id: userId, body }),
  });
  if (!res || !res.ok) {
    throw res
      ? await apiFailure(
          res,
          'Не удалось сохранить запись. Попробуйте ещё раз.',
        )
      : new Error('Сессия истекла. Войдите снова.');
  }
}
