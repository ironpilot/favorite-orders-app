import { api } from '@/lib/api';
import { getCurrentUserId } from '@/services/auth';

export interface RestaurantSummary {
  id: string;
  name: string;
  orderCount: number;
  defaultItems: string[];
  updatedAt: string;
}

export interface Restaurant {
  id: string;
  name: string;
  updatedAt: string;
}

export interface Order {
  id: string;
  restaurantId: string;
  title: string;
  items: string[];
  customizations: string | null;
  notes: string | null;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface NewOrder {
  restaurantName: string;
  title?: string;
  items: string[];
  notes?: string;
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
    updatedAt: row.updatedAt,
  }));
}

export function fetchRestaurant(id: string): Promise<Restaurant> {
  return api<Restaurant>('GET', `/api/restaurants/${encodeURIComponent(id)}`);
}

export function fetchRestaurantOrders(id: string): Promise<Order[]> {
  return api<Order[]>('GET', `/api/restaurants/${encodeURIComponent(id)}/orders`);
}

/** Saves an order; the restaurant is created if no restaurant with this exact name exists yet. */
export function saveOrder(order: NewOrder): Promise<Order> {
  return api<Order>('POST', '/api/orders', order);
}
