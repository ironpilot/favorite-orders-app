import { api } from '@/lib/api';

export interface PublicUser {
  id: string;
  email: string;
  phone: string | null;
  displayName: string;
}

export interface Friendship {
  id: string;
  status: 'pending' | 'accepted';
  /** outgoing: the signed-in user sent the request. */
  direction: 'outgoing' | 'incoming';
  user: PublicUser;
}

export function fetchFriendships(): Promise<Friendship[]> {
  return api<Friendship[]>('GET', '/api/friends');
}

/** Finds users by exact email or phone; names are never searched. */
export async function searchUsers(q: string): Promise<PublicUser[]> {
  if (!q.trim()) return [];
  return (await api<PublicUser[]>('GET', `/api/users?q=${encodeURIComponent(q.trim())}`)) ?? [];
}

export function sendFriendRequest(userId: string): Promise<{ id: string; status: 'pending' }> {
  return api('POST', '/api/friends', { userId });
}

export function acceptFriendRequest(id: string): Promise<{ id: string; status: 'accepted' }> {
  return api('POST', `/api/friends/${encodeURIComponent(id)}/accept`);
}

/** Declines (silently), cancels a pending request, or removes a friend. */
export async function removeFriendship(id: string): Promise<void> {
  await api<void>('DELETE', `/api/friends/${encodeURIComponent(id)}`);
}

export function userLabel(u: PublicUser): string {
  return u.displayName?.trim() || u.email;
}
