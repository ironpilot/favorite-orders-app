import { api, ApiError, getToken, setToken } from '@/lib/api';

export interface Account {
  id: string;
  email?: string;
  displayName?: string;
  /** Missing on older responses; only an explicit `false` means verification is pending. */
  emailVerified?: boolean;
  verificationExpiresAt?: string | null;
}

interface SessionResponse {
  token: string;
  user: Account;
}

export const isVerified = (account: Account | null): boolean => !!account && account.emailVerified !== false;

export async function getCurrentAccount(): Promise<Account | null> {
  if (!getToken()) return null;
  try {
    return await api<Account>('GET', '/api/auth/me');
  } catch (e) {
    if (e instanceof ApiError && e.status === 401) setToken(null);
    return null;
  }
}

/** Returns the signed-in user's id only once their email is verified. */
export async function getCurrentUserId(): Promise<string | null> {
  const account = await getCurrentAccount();
  return isVerified(account) ? account!.id : null;
}

export async function signIn(email: string, password: string): Promise<Account> {
  const session = await api<SessionResponse>('POST', '/api/auth/signin', { email, password });
  setToken(session.token);
  return session.user;
}

export async function signUp(email: string, password: string, displayName: string, phone: string): Promise<Account> {
  const session = await api<SessionResponse>('POST', '/api/auth/signup', { email, password, displayName, phone });
  setToken(session.token);
  return session.user;
}

export function verifyEmail(code: string): Promise<Account> {
  return api<Account>('POST', '/api/auth/verify', { code });
}

export function resendVerification(): Promise<Account> {
  return api<Account>('POST', '/api/auth/resend-verification');
}

export async function requestPasswordReset(email: string): Promise<string> {
  const res = await api<{ message: string }>('POST', '/api/auth/forgot-password', { email });
  return res.message;
}

export async function resetPassword(token: string, password: string): Promise<void> {
  await api('POST', '/api/auth/reset-password', { token, password });
}

/** Clears the local session; the server revokes the token when reachable (offline sign-out still succeeds). */
export async function signOut(): Promise<void> {
  try {
    if (getToken()) await api('POST', '/api/auth/signout');
  } catch {
    // Offline or already revoked: the local token is cleared regardless.
  } finally {
    setToken(null);
  }
}
