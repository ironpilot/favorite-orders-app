const TOKEN_KEY = 'favorite-order.token';
const REFRESH_KEY = 'favorite-order.refresh-token';
const ACCESS_EXPIRY_KEY = 'favorite-order.token-expires-at';
const REFRESH_EXPIRY_KEY = 'favorite-order.refresh-token-expires-at';

function write(key: string, value: string | null): void {
  if (value) localStorage.setItem(key, value);
  else localStorage.removeItem(key);
}

function readTime(key: string): number | null {
  const value = Number(localStorage.getItem(key));
  return Number.isFinite(value) && value > 0 ? value : null;
}

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string | null): void {
  write(TOKEN_KEY, token);
}

export function getRefreshToken(): string | null {
  return localStorage.getItem(REFRESH_KEY);
}

export function setRefreshToken(token: string | null): void {
  write(REFRESH_KEY, token);
}

/** Access token expiry in ms, or null when unknown (sessions stored before expiries were kept). */
export const getAccessExpiry = (): number | null => readTime(ACCESS_EXPIRY_KEY);

/** Refresh token expiry in ms, or null when unknown. */
export const getRefreshExpiry = (): number | null => readTime(REFRESH_EXPIRY_KEY);

/** Stores the expiry times (ISO strings from the server); missing values are cleared. */
export function setTokenExpiries(accessExpiresAt?: string | null, refreshExpiresAt?: string | null): void {
  const ms = (iso?: string | null) => (iso && Number.isFinite(Date.parse(iso)) ? String(Date.parse(iso)) : null);
  write(ACCESS_EXPIRY_KEY, ms(accessExpiresAt));
  write(REFRESH_EXPIRY_KEY, ms(refreshExpiresAt));
}
