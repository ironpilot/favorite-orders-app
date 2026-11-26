import { api, ApiError, getRefreshToken, getToken, setRefreshToken, setToken } from '@/lib/api';
import { setTokenExpiries } from '@/lib/tokens';
import { cachedAccount, clearSession, isOnline, markAuthenticated, rememberAccount } from '@/services/session';

/** Shown when an action needs the server but the device is offline. */
export const CONNECTION_NEEDED_MESSAGE = 'A connection is needed for this. Connect to the internet and try again.';

export interface Account {
  id: string;
  email?: string;
  phone?: string | null;
  displayName?: string;
  /** New email awaiting confirmation; the current email stays active until then. */
  pendingEmail?: string | null;
  pendingEmailExpiresAt?: string | null;
  /** Missing on older responses; only an explicit `false` means verification is pending. */
  emailVerified?: boolean;
  verificationExpiresAt?: string | null;
}

interface SessionResponse {
  token: string;
  accessExpiresAt?: string;
  refreshToken?: string;
  refreshExpiresAt?: string;
  user: Account;
}

function storeSession(session: SessionResponse): Account {
  setToken(session.token);
  setRefreshToken(session.refreshToken ?? null);
  setTokenExpiries(session.accessExpiresAt, session.refreshExpiresAt);
  rememberAccount(session.user);
  markAuthenticated();
  return session.user;
}

function requireConnection(): void {
  if (!isOnline.value) throw new Error(CONNECTION_NEEDED_MESSAGE);
}

export interface ProfileChanges {
  displayName?: string;
  email?: string;
  phone?: string;
  currentPassword?: string;
  password?: string;
}

export const isVerified = (account: Account | null): boolean => !!account && account.emailVerified !== false;

export async function getCurrentAccount(): Promise<Account | null> {
  if (!getToken()) return null;
  try {
    const account = await api<Account>('GET', '/api/auth/me');
    rememberAccount(account);
    return account;
  } catch (e) {
    if (e instanceof ApiError) {
      if (e.status === 401) clearSession();
      return null;
    }
    // Offline: keep using the last known account with cached data.
    return cachedAccount<Account>();
  }
}

/** Returns the signed-in user's id only once their email is verified. */
export async function getCurrentUserId(): Promise<string | null> {
  const account = await getCurrentAccount();
  return isVerified(account) ? account!.id : null;
}

export async function signIn(email: string, password: string): Promise<Account> {
  requireConnection();
  return storeSession(await api<SessionResponse>('POST', '/api/auth/signin', { email, password }));
}

export async function signUp(email: string, password: string, displayName: string, phone: string): Promise<Account> {
  requireConnection();
  return storeSession(await api<SessionResponse>('POST', '/api/auth/signup', { email, password, displayName, phone }));
}

export function verifyEmail(code: string): Promise<Account> {
  return api<Account>('POST', '/api/auth/verify', { code });
}

export function resendVerification(): Promise<Account> {
  return api<Account>('POST', '/api/auth/resend-verification');
}

export function updateProfile(changes: ProfileChanges): Promise<Account> {
  return api<Account>('PATCH', '/api/auth/me', changes);
}

export function verifyEmailChange(code: string): Promise<Account> {
  return api<Account>('POST', '/api/auth/email-change/verify', { code });
}

export function resendEmailChange(): Promise<Account> {
  return api<Account>('POST', '/api/auth/email-change/resend');
}

export function cancelEmailChange(): Promise<Account> {
  return api<Account>('DELETE', '/api/auth/email-change');
}

export async function requestPasswordReset(email: string): Promise<string> {
  const res = await api<{ message: string }>('POST', '/api/auth/forgot-password', { email });
  return res.message;
}

export async function resetPassword(token: string, password: string): Promise<void> {
  await api('POST', '/api/auth/reset-password', { token, password });
}

/** Deletes the account and all its data after confirmation with the password, then clears the local session. */
export async function deleteAccount(password: string): Promise<void> {
  requireConnection();
  await api('DELETE', '/api/auth/me', { confirm: true, password });
  clearSession();
}

/** Clears the local session; the server revokes the token when reachable (offline sign-out still succeeds). */
export async function signOut(): Promise<void> {
  try {
    if (getToken() || getRefreshToken()) {
      await api('POST', '/api/auth/signout', { refreshToken: getRefreshToken() ?? undefined });
    }
  } catch {
    // Offline or already revoked: the local token is cleared regardless.
  } finally {
    clearSession();
  }
}
