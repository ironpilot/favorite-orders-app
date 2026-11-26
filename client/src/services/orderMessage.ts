import { formatCustomization, type Order } from '@/services/restaurants';

export interface OrderMessageOptions {
  /** Notes are left out unless the user chooses to include them. */
  includeNotes?: boolean;
}

/**
 * Builds a plain, readable text message describing an order. Works only from the given
 * (possibly cached) data, never truncates, and contains no app link.
 */
export function buildOrderMessage(
  order: Pick<Order, 'title' | 'items' | 'notes'>,
  restaurantName: string,
  options: OrderMessageOptions = {},
): string {
  const lines: string[] = [];
  const restaurant = restaurantName.trim();
  const title = order.title?.trim();
  if (restaurant) lines.push(restaurant);
  if (title) lines.push(title);
  if (lines.length) lines.push('');
  for (const item of order.items) {
    lines.push(`${item.quantity}× ${item.name}`);
    for (const c of item.customizations) lines.push(`  - ${formatCustomization(c)}`);
  }
  const notes = order.notes?.trim();
  if (options.includeNotes && notes) lines.push('', `Notes: ${notes}`);
  return lines.join('\n');
}
