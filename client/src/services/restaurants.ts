import { api } from '@/lib/api';
import { getCurrentUserId } from '@/services/auth';

export interface RestaurantSummary {
  id: string;
  name: string;
  orderCount: number;
  defaultItems: string[];
  /** Administrator-owned restaurants are read-only for users. */
  adminOwned?: boolean;
  updatedAt: string;
}

export interface Restaurant {
  id: string;
  name: string;
  adminOwned?: boolean;
  updatedAt: string;
}

/** Text limits, matching the server. */
export const LIMITS = { restaurantName: 100, title: 100, itemName: 100, ingredient: 60, notes: 1000 } as const;

export type CustomizationKind = 'remove' | 'add' | 'substitute';

export interface Customization {
  kind: CustomizationKind;
  ingredient: string;
  /** Only for substitutions: the ingredient being replaced. */
  insteadOf?: string;
}

export interface OrderItem {
  name: string;
  quantity: number;
  customizations: Customization[];
}

export interface Order {
  id: string;
  restaurantId: string;
  title: string;
  items: OrderItem[];
  notes: string | null;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

/** Either restaurantId (a picked existing restaurant) or restaurantName (typed; creates one if new). */
export interface NewOrder {
  restaurantId?: string;
  restaurantName?: string;
  title?: string;
  items: OrderItem[];
  notes?: string;
}

export function formatCustomization(c: Customization): string {
  if (c.kind === 'remove') return `No ${c.ingredient}`;
  if (c.kind === 'add') return `Add ${c.ingredient}`;
  return `${c.ingredient} instead of ${c.insteadOf ?? ''}`;
}

/** e.g. "2× Hamburger (No Lettuce, Add Onions)". */
export function formatItem(item: OrderItem): string {
  const qty = item.quantity > 1 ? `${item.quantity}× ` : '';
  const custom = item.customizations.length ? ` (${item.customizations.map(formatCustomization).join(', ')})` : '';
  return `${qty}${item.name}${custom}`;
}

/** Lists the signed-in user's own restaurants with a count of their own orders and the default order's items. */
export async function fetchMyRestaurants(): Promise<RestaurantSummary[]> {
  const userId = await getCurrentUserId();
  if (!userId) return [];

  const rows = await api<RestaurantSummary[]>('GET', '/api/restaurants');
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    orderCount: row.orderCount,
    defaultItems: row.defaultItems ?? [],
    ...(row.adminOwned !== undefined ? { adminOwned: row.adminOwned } : {}),
    updatedAt: row.updatedAt,
  }));
}

export function fetchRestaurant(id: string): Promise<Restaurant> {
  return api<Restaurant>('GET', `/api/restaurants/${encodeURIComponent(id)}`);
}

export function fetchRestaurantOrders(id: string): Promise<Order[]> {
  return api<Order[]>('GET', `/api/restaurants/${encodeURIComponent(id)}/orders`);
}

/** Suggests administrator-owned and the user's own restaurants matching the typed text. */
export async function suggestRestaurants(q: string): Promise<Restaurant[]> {
  return (await api<Restaurant[]>('GET', `/api/restaurant-suggestions?q=${encodeURIComponent(q)}`)) ?? [];
}

/** Suggests common toppings and ingredients the user used before. */
export async function suggestToppings(q: string): Promise<string[]> {
  return (await api<string[]>('GET', `/api/toppings?q=${encodeURIComponent(q)}`)) ?? [];
}

/** An order's name, or its items when it has no name. */
export function orderLabel(order: Pick<Order, 'title' | 'items'>): string {
  return order.title?.trim() || order.items.map((i) => i.name).join(', ') || 'Order';
}

export function fetchOrder(id: string): Promise<Order> {
  return api<Order>('GET', `/api/orders/${encodeURIComponent(id)}`);
}

/** Updates an order; the restaurant cannot be changed. */
export function updateOrder(id: string, changes: { title?: string; items?: OrderItem[]; notes?: string }): Promise<Order> {
  return api<Order>('PATCH', `/api/orders/${encodeURIComponent(id)}`, changes);
}

export function setDefaultOrder(id: string): Promise<Order> {
  return api<Order>('PATCH', `/api/orders/${encodeURIComponent(id)}`, { isDefault: true });
}

/** Removes an order; the server promotes a new default when needed. */
export async function deleteOrder(id: string): Promise<void> {
  await api<void>('DELETE', `/api/orders/${encodeURIComponent(id)}`);
}

/** Hook for the Share an Order feature; replaced when that feature is built. */
export const shareHandler: { share: (order: Order) => void | Promise<void> } = {
  share: () => undefined,
};

/** Saves an order; the restaurant is created if no restaurant with this exact name exists yet. */
export function saveOrder(order: NewOrder): Promise<Order> {
  return api<Order>('POST', '/api/orders', order);
}
