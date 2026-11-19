import { api, ApiError, getToken, setToken } from '@/lib/api';

interface SessionResponse {
  token: string;
  user: { id: string };
}

export async function getCurrentUserId(): Promise<string | null> {
  if (!getToken()) return null;
  try {
    const user = await api<{ id: string }>('GET', '/api/auth/me');
    return user.id;
  } catch (e) {
    if (e instanceof ApiError && e.status === 401) setToken(null);
    return null;
  }
}

export async function signIn(email: string, password: string): Promise<void> {
  const session = await api<SessionResponse>('POST', '/api/auth/signin', { email, password });
  setToken(session.token);
}

export async function signUp(email: string, password: string, displayName: string): Promise<void> {
  const session = await api<SessionResponse>('POST', '/api/auth/signup', { email, password, displayName });
  setToken(session.token);
}

export async function signOut(): Promise<void> {
  try {
    await api('POST', '/api/auth/signout');
  } finally {
    setToken(null);
  }
}
