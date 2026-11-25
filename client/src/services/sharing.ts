import { api } from '@/lib/api';
import type { PublicUser } from '@/services/friends';
import type { Order } from '@/services/restaurants';

/** An order shared with the signed-in user; always the owner's latest version. */
export interface SharedOrder {
  shareId: string;
  sharedAt: string;
  restaurantName: string;
  sharedBy: PublicUser;
  order: Order;
}

/** A friend the owner shared an order with. */
export interface OrderShare {
  id: string;
  sharedAt: string;
  /** True when the access came from opening a share link. */
  viaLink?: boolean;
  user: PublicUser;
}

export const OFFLINE_SHARE_MESSAGE = 'You are offline. A connection is needed to share an order.';

export const isOffline = () => typeof navigator !== 'undefined' && !navigator.onLine;

export async function fetchSharedOrders(): Promise<SharedOrder[]> {
  return (await api<SharedOrder[]>('GET', '/api/shared')) ?? [];
}

export async function fetchOrderShares(orderId: string): Promise<OrderShare[]> {
  return (await api<OrderShare[]>('GET', `/api/orders/${encodeURIComponent(orderId)}/shares`)) ?? [];
}

/** Shares an order with one or more accepted friends; sharing needs a connection. */
export async function shareOrder(orderId: string, userIds: string[]): Promise<void> {
  if (isOffline()) throw new Error(OFFLINE_SHARE_MESSAGE);
  await api('POST', `/api/orders/${encodeURIComponent(orderId)}/shares`, { userIds });
}

/** Removes the order from that friend's Shared tab. */
export async function unshareOrder(shareId: string): Promise<void> {
  await api<void>('DELETE', `/api/shares/${encodeURIComponent(shareId)}`);
}

/** Saves an independent copy under a restaurant matched by name, or a new one. */
export function saveSharedOrder(shareId: string): Promise<Order> {
  return api<Order>('POST', `/api/shared/${encodeURIComponent(shareId)}/save`);
}

/** Someone who opened a share link; revoked openers lost access. */
export interface LinkOpener {
  openedAt: string;
  revoked: boolean;
  user: PublicUser;
}

/** A reusable share link; token and url are only returned when the link is created. */
export interface ShareLink {
  id: string;
  orderId: string;
  expiresAt: string | null;
  disabled: boolean;
  active: boolean;
  createdAt: string;
  openers: LinkOpener[];
  token?: string;
  url?: string;
}

/** Result of opening a link: the order is in the Shared tab under shareId (unless it is the user's own). */
export interface OpenedLink {
  own: boolean;
  shareId?: string;
  orderId: string;
  owner: PublicUser;
  friendPrompt: boolean;
}

export const LINK_INVALID_MESSAGE = 'This link is no longer valid';
export const LINK_EXPIRY_OPTIONS: { label: string; hours: number | null }[] = [
  { label: '1 day', hours: 24 },
  { label: '7 days', hours: 24 * 7 },
  { label: '30 days', hours: 24 * 30 },
  { label: 'No expiry', hours: null },
];

export async function fetchShareLinks(orderId: string): Promise<ShareLink[]> {
  return (await api<ShareLink[]>('GET', `/api/orders/${encodeURIComponent(orderId)}/links`)) ?? [];
}

/** Creates a reusable link; expiresInHours null means it never expires. Needs a connection. */
export async function createShareLink(orderId: string, expiresInHours: number | null): Promise<ShareLink> {
  if (isOffline()) throw new Error(OFFLINE_SHARE_MESSAGE);
  return api<ShareLink>('POST', `/api/orders/${encodeURIComponent(orderId)}/links`, { expiresInHours });
}

/** Disables a link and removes the access everyone gained through it. */
export function disableShareLink(linkId: string): Promise<ShareLink> {
  return api<ShareLink>('DELETE', `/api/share-links/${encodeURIComponent(linkId)}`);
}

/** Removes one opener's access, friend or not. */
export function removeLinkOpener(linkId: string, userId: string): Promise<ShareLink> {
  return api<ShareLink>('DELETE', `/api/share-links/${encodeURIComponent(linkId)}/openers/${encodeURIComponent(userId)}`);
}

export function openShareLink(token: string): Promise<OpenedLink> {
  return api<OpenedLink>('POST', `/api/links/${encodeURIComponent(token)}/open`);
}

// A link opened while signed out is remembered until sign-in or sign-up finishes, then resumed.
const PENDING_LINK_KEY = 'pendingShareLink';

export function rememberPendingLink(token: string): void {
  try {
    localStorage.setItem(PENDING_LINK_KEY, token);
  } catch {
    // Storage may be unavailable; the user can open the link again.
  }
}

export function takePendingLink(): string | null {
  try {
    const token = localStorage.getItem(PENDING_LINK_KEY);
    if (token) localStorage.removeItem(PENDING_LINK_KEY);
    return token;
  } catch {
    return null;
  }
}

export type SharedGrouping = 'restaurant' | 'person';

/** Groups shared orders by restaurant name or by the friend who shared them, sorted by label. */
export function groupSharedOrders(list: SharedOrder[], by: SharedGrouping): { key: string; label: string; orders: SharedOrder[] }[] {
  const groups = new Map<string, { key: string; label: string; orders: SharedOrder[] }>();
  for (const s of list) {
    const key = by === 'restaurant' ? s.restaurantName : s.sharedBy.id;
    const label = by === 'restaurant' ? s.restaurantName : (s.sharedBy.displayName?.trim() || s.sharedBy.email);
    if (!groups.has(key)) groups.set(key, { key, label, orders: [] });
    groups.get(key)!.orders.push(s);
  }
  return [...groups.values()].sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: 'base' }));
}
