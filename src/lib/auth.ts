import {
  authenticate,
  fetchMe as fetchPlatformMe,
  requestAccountEmail,
  type AppUser as AuthUser,
} from './app-auth';

export type { AuthUser };

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

export async function requestAuthEmail(
  kind: 'verify' | 'forgot',
  email: string,
): Promise<void> {
  await requestAccountEmail(kind, email);
}
