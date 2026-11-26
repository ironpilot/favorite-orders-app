import { readonly, ref } from 'vue';
import { getRefreshToken, getToken, refreshSession, setRefreshToken, setToken } from '@/lib/api';
import { getAccessExpiry, getRefreshExpiry, setTokenExpiries } from '@/lib/tokens';

/**
 * Central auth state. `offline` means signed in but without a connection: the app keeps
 * using cached data and re-validates the session when the connection returns.
 */
export type AuthState = 'unauthenticated' | 'authenticated' | 'offline';

const ACCOUNT_KEY = 'favorite-order.account';

const state = ref<AuthState>(getToken() ? 'authenticated' : 'unauthenticated');
const online = ref(typeof navigator === 'undefined' ? true : navigator.onLine !== false);

export const authState = readonly(state);
export const isOnline = readonly(online);

const expiredListeners = new Set<() => void>();

/** Called when the session ends on its own (both tokens expired or the refresh was rejected). */
export function onSessionExpired(listener: () => void): () => void {
  expiredListeners.add(listener);
  return () => expiredListeners.delete(listener);
}

function set(next: AuthState): AuthState {
  state.value = next;
  return next;
}

/** Last account seen online, used to keep the app usable offline. */
export function cachedAccount<T>(): T | null {
  try {
    const raw = localStorage.getItem(ACCOUNT_KEY);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export function rememberAccount(account: unknown): void {
  if (account) localStorage.setItem(ACCOUNT_KEY, JSON.stringify(account));
  else localStorage.removeItem(ACCOUNT_KEY);
}

/** Clears the stored tokens and cached account (sign-out, account deletion, expired session). */
export function clearSession(): void {
  setToken(null);
  setRefreshToken(null);
  setTokenExpiries(null, null);
  rememberAccount(null);
  set('unauthenticated');
}

/** The session has just been established (sign-in, sign-up). */
export function markAuthenticated(): void {
  set(online.value ? 'authenticated' : 'offline');
}

/** Ends the session after the server rejected the refresh token; notifies listeners (e.g. to show login). */
export function expireSession(): void {
  const wasSignedIn = state.value !== 'unauthenticated';
  clearSession();
  if (wasSignedIn) expiredListeners.forEach((l) => l());
}

/** Records the connection status. Going offline while signed in switches to `offline`. */
export function setOnline(value: boolean): void {
  online.value = value;
  if (!value && state.value === 'authenticated') set('offline');
}

/**
 * The expiry check run at startup, on reconnect and on resume:
 * a valid access token continues; an expired one is refreshed silently with a valid refresh token
 * (deferred while offline, without signing out); with both expired the session is cleared.
 */
export async function checkSession(): Promise<AuthState> {
  const now = Date.now();
  const token = getToken();
  const accessExpiry = getAccessExpiry();
  // A missing expiry (older stored session) is treated as valid; the server's 401 decides.
  const accessValid = !!token && (accessExpiry === null || accessExpiry > now);
  if (accessValid) return set(online.value ? 'authenticated' : 'offline');
  const refreshToken = getRefreshToken();
  const refreshExpiry = getRefreshExpiry();
  const refreshValid = !!refreshToken && (refreshExpiry === null || refreshExpiry > now);
  if (!refreshValid) {
    if (!token && !refreshToken) return set('unauthenticated');
    const wasSignedIn = state.value !== 'unauthenticated' && !!token;
    clearSession();
    if (wasSignedIn) expiredListeners.forEach((l) => l());
    return 'unauthenticated';
  }
  if (!online.value) return set('offline');
  const result = await refreshSession();
  if (result === 'refreshed') return set('authenticated');
  if (result === 'offline') return set('offline');
  // Rejected: the API layer already cleared the tokens and reported the expiry.
  clearSession();
  return 'unauthenticated';
}
