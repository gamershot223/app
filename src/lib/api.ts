/**
 * Base-relative URL for PostgREST via preview/prod proxy.
 * Never use root-absolute `/api/…` — Vite base is the preview-proxy prefix.
 */
export function apiUrl(path: string): string {
  const base = import.meta.env.BASE_URL || '/';
  const normalizedBase = base.endsWith('/') ? base : `${base}/`;
  const rest = path.replace(/^\//, '');
  return `${normalizedBase}api/${rest}`;
}

/** W20: platform end-user auth (same origin as static + /api). */
export function authUrl(path: string): string {
  const base = import.meta.env.BASE_URL || '/';
  const normalizedBase = base.endsWith('/') ? base : `${base}/`;
  const rest = path.replace(/^\//, '');
  return `${normalizedBase}auth/${rest}`;
}

const TOKEN_KEY = 'workai_app_access_token';

export function getAccessToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setAccessToken(token: string | null): void {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    // ignore
  }
}

/** PostgREST fetch with optional Bearer from localStorage. */
export async function authFetch(
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  const headers = new Headers(init.headers);
  const token = getAccessToken();
  if (token) headers.set('Authorization', `Bearer ${token}`);
  if (!headers.has('Content-Type') && init.body) {
    headers.set('Content-Type', 'application/json');
  }
  return fetch(apiUrl(path), { ...init, headers });
}
