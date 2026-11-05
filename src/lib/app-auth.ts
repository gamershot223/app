/**
 * Auth helpers wrapping Supabase Auth. Replaces the platform /auth endpoints
 * so the app works both locally and when deployed.
 */
import { supabase, toAppUser, type AppUser } from './supabase';

export type { AppUser };

export type LogoutEverywhereResult =
  | { completed: true; residualSeconds?: number }
  | { completed: false };

export function suggestsSignup(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const msg = err.message.toLowerCase();
  return msg.includes('invalid login') || msg.includes('invalid credentials');
}

export async function authenticate(
  mode: 'signup' | 'login',
  email: string,
  password: string,
): Promise<AppUser> {
  if (mode === 'signup') {
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
    });
    if (error) throw new Error(translateAuthError(error.message));
    const user = toAppUser(data.session);
    if (!user) throw new Error('Регистрация не завершена. Попробуйте ещё раз.');
    return user;
  }

  const { data, error } = await supabase.auth.signInWithPassword({
    email: email.trim(),
    password,
  });
  if (error) throw new Error(translateAuthError(error.message));
  const user = toAppUser(data.session);
  if (!user) throw new Error('Не удалось войти. Попробуйте ещё раз.');
  return user;
}

function translateAuthError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes('invalid login') || m.includes('invalid credentials'))
    return 'Неверный email или пароль. Если аккаунта ещё нет, его можно создать с этими же данными.';
  if (m.includes('user already registered') || m.includes('already registered'))
    return 'Пользователь с такой почтой уже зарегистрирован. Войдите с этим паролем.';
  if (m.includes('password should be at least'))
    return 'Пароль должен быть не короче 8 символов.';
  if (m.includes('unable to validate email') || m.includes('email'))
    return 'Укажите корректную почту, например name@company.ru.';
  if (m.includes('rate limit') || m.includes('too many'))
    return 'Слишком много попыток подряд. Подождите минуту и попробуйте снова.';
  return 'Не удалось выполнить вход. Проверьте данные и попробуйте ещё раз.';
}

export async function fetchMe(): Promise<AppUser | null> {
  const { data } = await supabase.auth.getUser();
  if (!data.user) return null;
  return { id: data.user.id, email: data.user.email ?? '' };
}

export async function restoreSession(): Promise<{
  user: AppUser | null;
  message?: string;
}> {
  const { data, error } = await supabase.auth.getSession();
  if (error) return { user: null };
  const user = toAppUser(data.session);
  return user ? { user } : { user: null };
}

export async function logoutCurrentDevice(): Promise<boolean> {
  const { error } = await supabase.auth.signOut();
  return !error;
}

export async function logoutEverywhere(): Promise<LogoutEverywhereResult> {
  const { error } = await supabase.auth.signOut({ scope: 'global' });
  if (error) return { completed: false };
  return { completed: true };
}

export async function requestAccountEmail(
  kind: 'verify' | 'forgot',
  email: string,
): Promise<void> {
  if (kind === 'forgot') {
    await supabase.auth.resetPasswordForEmail(email.trim()).catch(() => undefined);
  } else {
    await supabase.auth.resend({ type: 'signup', email: email.trim() }).catch(() => undefined);
  }
}

export function clearSession(): void {
  void supabase.auth.signOut();
}

export function peekPendingOAuthError(): string {
  return '';
}

export function clearPendingOAuthError(): void {}

export function oauthHref(_provider: 'google' | 'yandex'): string {
  return '#';
}

export function onOAuthClick(
  event: { preventDefault: () => void },
  _provider: 'google' | 'yandex',
): void {
  event.preventDefault();
}

export async function authenticatedFetch(
  _url: string,
  _init?: RequestInit,
): Promise<Response | null> {
  return null;
}
