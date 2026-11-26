import {
  getRefreshExpiry,
  getRefreshToken,
  getToken,
  setRefreshToken,
  setToken,
  setTokenExpiries,
} from './tokens';

export { getRefreshToken, getToken, setRefreshToken, setToken } from './tokens';

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

/** Tokens returned by sign-in, sign-up and refresh. */
export interface SessionTokens {
  token: string;
  accessExpiresAt?: string;
  refreshToken?: string;
  refreshExpiresAt?: string;
}

export function storeTokens(session: SessionTokens): void {
  setToken(session.token);
  setRefreshToken(session.refreshToken ?? null);
  setTokenExpiries(session.accessExpiresAt, session.refreshExpiresAt);
}

export function clearTokens(): void {
  setToken(null);
  setRefreshToken(null);
  setTokenExpiries(null, null);
}

/** Lets the session and connectivity services observe requests without circular imports. */
export interface ApiHooks {
  /** A request reached the server. */
  onReachable?: () => void;
  /** A request failed at the network level (confirms being offline). */
  onUnreachable?: () => void;
  /** The refresh token was rejected or has expired; the tokens have been cleared. */
  onSessionExpired?: () => void;
}

const hooks: ApiHooks = {};

export function setApiHooks(next: ApiHooks): void {
  Object.assign(hooks, next);
}

// These never trigger a refresh-and-retry on 401.
const NO_REFRESH = ['/api/auth/signin', '/api/auth/signup', '/api/auth/refresh', '/api/auth/signout'];

async function send(method: string, path: string, body: unknown, token: string | null): Promise<Response> {
  const baseUrl = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';
  let res: Response;
  try {
    res = await fetch(`${baseUrl}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch (e) {
    hooks.onUnreachable?.();
    throw e;
  }
  hooks.onReachable?.();
  return res;
}

/** `refreshed`: new tokens stored; `rejected`: session over, tokens cleared; `offline`: try again later. */
export type RefreshResult = 'refreshed' | 'rejected' | 'offline';

let refreshing: Promise<RefreshResult> | null = null;

function expire(): RefreshResult {
  clearTokens();
  hooks.onSessionExpired?.();
  return 'rejected';
}

async function doRefresh(): Promise<RefreshResult> {
  const refreshToken = getRefreshToken();
  const expiresAt = getRefreshExpiry();
  if (!refreshToken || (expiresAt !== null && expiresAt <= Date.now())) return expire();
  let res: Response;
  try {
    res = await send('POST', '/api/auth/refresh', { refreshToken }, null);
  } catch {
    // Offline: keep the session and retry on reconnect instead of signing the user out.
    return 'offline';
  }
  if (res.ok) {
    storeTokens((await res.json()) as SessionTokens);
    return 'refreshed';
  }
  if (res.status === 400 || res.status === 401) return expire();
  return 'offline';
}

/** Exchanges the refresh token for new tokens. Concurrent callers share a single request. */
export function refreshSession(): Promise<RefreshResult> {
  if (!refreshing) refreshing = doRefresh().finally(() => { refreshing = null; });
  return refreshing;
}

/**
 * Calls the Node API, attaching the access token when signed in. A 401 triggers one refresh
 * (shared by concurrent requests) and one retry; if the refresh is rejected the session ends.
 */
export async function api<T>(method: string, path: string, body?: unknown): Promise<T> {
  const token = getToken();
  let res = await send(method, path, body, token);
  if (res.status === 401 && token && !NO_REFRESH.includes(path) && getRefreshToken()) {
    // Another request may already have refreshed; only refresh if our token is still current.
    const current = getToken();
    const result = current && current !== token ? 'refreshed' : await refreshSession();
    if (result === 'refreshed') res = await send(method, path, body, getToken());
  }
  const text = await res.text();
  const data = text ? JSON.parse(text) : undefined;
  if (!res.ok) throw new ApiError(res.status, data?.error ?? res.statusText);
  return data as T;
}
