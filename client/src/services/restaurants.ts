import { api } from '@/lib/api';
import { getCurrentUserId } from '@/services/auth';

export interface RestaurantSummary {
  id: string;
  name: string;
  orderCount: number;
  updatedAt: string;
}

interface RestaurantRow extends RestaurantSummary {
  defaultItems: string[];
}

/** Lists the signed-in user's own restaurants with a count of their own orders. */
export async function fetchMyRestaurants(): Promise<RestaurantSummary[]> {
  const userId = await getCurrentUserId();
  if (!userId) return [];

  const rows = await api<RestaurantRow[]>('GET', '/api/restaurants');
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    orderCount: row.orderCount,
    updatedAt: row.updatedAt,
  }));
}
