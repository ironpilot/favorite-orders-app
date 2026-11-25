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
