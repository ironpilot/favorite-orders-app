import { flushPromises, mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createMemoryHistory } from 'vue-router';

type TestOrder = {
  id: string;
  restaurantId: string;
  title: string;
  items: { name: string; quantity: number; customizations: { kind: string; ingredient: string; insteadOf?: string }[] }[];
  notes: string | null;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
};

const state = vi.hoisted(() => ({
  orders: [] as TestOrder[],
  calls: [] as [string, string, unknown?][],
  failOrders: false,
}));

vi.mock('@/lib/api', () => {
  class ApiError extends Error {
    constructor(public status: number, message: string) {
      super(message);
    }
  }
  return {
    ApiError,
    getToken: () => 'token',
    setToken: () => undefined,
    api: async (method: string, path: string, body?: unknown) => {
      state.calls.push([method, path, body]);
      if (path === '/api/auth/me') return { id: 'user-1' };
      const r = path.match(/^\/api\/restaurants\/([^/]+)(\/orders)?$/);
      if (r) {
        if (r[2]) {
          if (state.failOrders) throw new ApiError(500, 'Network down');
          return state.orders.map((o) => ({ ...o }));
        }
        return { id: r[1], name: 'Taco Spot', updatedAt: '' };
      }
      const m = path.match(/^\/api\/orders\/([^/]+)$/);
      if (m) {
        const idx = state.orders.findIndex((o) => o.id === m[1]);
        if (idx < 0) throw new ApiError(404, 'Order not found');
        if (method === 'GET') return { ...state.orders[idx] };
        if (method === 'DELETE') {
          const [removed] = state.orders.splice(idx, 1);
          if (removed.isDefault && state.orders.length) {
            const next = [...state.orders].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
            next.isDefault = true;
          }
          return undefined;
        }
        if (method === 'PATCH') {
          const b = body as Partial<TestOrder>;
          if (b.isDefault) state.orders.forEach((o) => { o.isDefault = false; });
          Object.assign(state.orders[idx], b, { updatedAt: '2030-01-01' });
          return { ...state.orders[idx] };
        }
      }
      return undefined;
    },
  };
});

import RestaurantOrdersPage from '@/views/RestaurantOrdersPage.vue';
import OrderDetailPage from '@/views/OrderDetailPage.vue';
import AddOrderPage from '@/views/AddOrderPage.vue';
import { buildRouter } from '@/router';
import { updateOrder } from '@/services/restaurants';

function order(id: string, extra: Partial<TestOrder> = {}): TestOrder {
  return {
    id,
    restaurantId: 'r1',
    title: '',
    items: [{ name: `Item ${id}`, quantity: 1, customizations: [] }],
    notes: null,
    isDefault: false,
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01',
    ...extra,
  };
}

beforeEach(() => {
  state.orders = [];
  state.calls = [];
  state.failOrders = false;
});

async function mountOrders() {
  const router = buildRouter(createMemoryHistory());
  await router.push('/tabs/restaurants/r1');
  const wrapper = mount(RestaurantOrdersPage, { props: { id: 'r1' }, global: { plugins: [router] } });
  await flushPromises();
  const vm = wrapper.vm as unknown as {
    load: () => Promise<boolean>;
    onRefresh: (e: CustomEvent) => Promise<void>;
  };
  return { router, wrapper, vm };
}

describe('RestaurantOrdersPage', () => {
  it('shows all orders, identifying unnamed ones by their items', async () => {
    state.orders = [
      order('o1', { title: 'Game night', isDefault: true }),
      order('o2', { items: [{ name: 'Burrito', quantity: 1, customizations: [] }, { name: 'Soda', quantity: 1, customizations: [] }] }),
    ];
    const { wrapper } = await mountOrders();
    expect(wrapper.findAll('[data-testid="order-item"]')).toHaveLength(2);
    expect(wrapper.findAll('[data-testid="order-label"]').map((l) => l.text())).toEqual(['Game night', 'Burrito, Soda']);
  });

  it('marks another order as the default so only that one is the default', async () => {
    state.orders = [order('o1', { isDefault: true }), order('o2')];
    const { wrapper } = await mountOrders();
    await wrapper.find('[data-testid="make-default"]').trigger('click');
    await flushPromises();
    expect(state.calls).toContainEqual(['PATCH', '/api/orders/o2', { isDefault: true }]);
    expect(state.orders.filter((o) => o.isDefault).map((o) => o.id)).toEqual(['o2']);
    expect(wrapper.findAll('[data-testid="default-badge"]')).toHaveLength(1);
  });

  it('does not break when orders exist but none is the default', async () => {
    state.orders = [order('o1'), order('o2')];
    const { wrapper } = await mountOrders();
    expect(wrapper.find('[data-testid="no-default"]').exists()).toBe(true);
    expect(wrapper.findAll('[data-testid="order-item"]')).toHaveLength(2);
  });

  it('opens the order detail when an order is tapped', async () => {
    state.orders = [order('o1', { isDefault: true })];
    const { wrapper, router } = await mountOrders();
    await wrapper.find('[data-testid="order-item"]').trigger('click');
    await flushPromises();
    expect(router.currentRoute.value.path).toBe('/tabs/restaurants/r1/orders/o1');
  });

  it('reloads on each entry and shows changes made elsewhere', async () => {
    state.orders = [order('o1', { isDefault: true }), order('o2')];
    const { wrapper, vm } = await mountOrders();
    const loadsBefore = state.calls.filter(([, p]) => p === '/api/restaurants/r1/orders').length;
    state.orders.splice(1, 1);
    state.orders[0].title = 'Edited';
    await vm.load();
    await flushPromises();
    expect(state.calls.filter(([, p]) => p === '/api/restaurants/r1/orders').length).toBe(loadsBefore + 1);
    expect(wrapper.findAll('[data-testid="order-label"]').map((l) => l.text())).toEqual(['Edited']);
  });

  it('keeps the previous orders and shows an error when a refresh fails', async () => {
    state.orders = [order('o1', { isDefault: true })];
    const { wrapper, vm } = await mountOrders();
    state.failOrders = true;
    await vm.load();
    await flushPromises();
    expect(wrapper.findAll('[data-testid="order-item"]')).toHaveLength(1);
    expect(wrapper.find('[data-testid="load-error"]').text()).toContain('Could not refresh orders');
  });

  it('reloads on pull-to-refresh and ends the refresher, also on failure', async () => {
    state.orders = [order('o1', { isDefault: true })];
    const { wrapper, vm } = await mountOrders();
    expect(wrapper.find('[data-testid="orders-refresher"]').exists()).toBe(true);
    state.orders.push(order('o2'));
    const complete = vi.fn();
    await vm.onRefresh({ target: { complete } } as unknown as CustomEvent);
    await flushPromises();
    expect(complete).toHaveBeenCalledTimes(1);
    expect(wrapper.findAll('[data-testid="order-item"]')).toHaveLength(2);

    state.failOrders = true;
    await vm.onRefresh({ target: { complete } } as unknown as CustomEvent);
    await flushPromises();
    expect(complete).toHaveBeenCalledTimes(2);
    expect(wrapper.findAll('[data-testid="order-item"]')).toHaveLength(2);
    expect(wrapper.find('[data-testid="load-error"]').exists()).toBe(true);
  });
});

async function mountDetail(id = 'o1') {
  const router = buildRouter(createMemoryHistory());
  await router.push(`/tabs/restaurants/r1/orders/${id}`);
  const wrapper = mount(OrderDetailPage, { props: { id: 'r1', orderId: id }, global: { plugins: [router] } });
  await flushPromises();
  return { router, wrapper };
}

describe('OrderDetailPage', () => {
  it('shows items, quantities, customizations, name and notes', async () => {
    state.orders = [order('o1', {
      title: 'Game night',
      notes: 'Extra napkins',
      isDefault: true,
      items: [{
        name: 'Hamburger',
        quantity: 2,
        customizations: [
          { kind: 'remove', ingredient: 'Lettuce' },
          { kind: 'add', ingredient: 'Onions' },
          { kind: 'substitute', ingredient: 'Mayonnaise', insteadOf: 'Ketchup' },
        ],
      }],
    })];
    const { wrapper } = await mountDetail();
    expect(wrapper.find('[data-testid="detail-name"]').text()).toBe('Game night');
    expect(wrapper.find('[data-testid="detail-item"]').text()).toContain('Hamburger');
    expect(wrapper.find('[data-testid="detail-quantity"]').text()).toBe('2×');
    expect(wrapper.findAll('[data-testid="detail-customization"]').map((c) => c.text()))
      .toEqual(['No Lettuce', 'Add Onions', 'Mayonnaise instead of Ketchup']);
    expect(wrapper.find('[data-testid="detail-notes"]').text()).toBe('Extra napkins');
    expect(wrapper.find('[data-testid="detail-default-badge"]').exists()).toBe(true);
  });

  it('shows a saved edit right away, without a manual refresh', async () => {
    state.orders = [order('o1', { title: 'Old name' })];
    const { wrapper } = await mountDetail();
    const gets = () => state.calls.filter(([m, p]) => m === 'GET' && p === '/api/orders/o1').length;
    const before = gets();
    await updateOrder('o1', { title: 'New name', items: [{ name: 'Burrito', quantity: 3, customizations: [] }] });
    await flushPromises();
    expect(gets()).toBe(before);
    expect(wrapper.find('[data-testid="detail-name"]').text()).toBe('New name');
    expect(wrapper.find('[data-testid="detail-item"]').text()).toContain('Burrito');
  });

  it('ignores saved edits to other orders', async () => {
    state.orders = [order('o1', { title: 'Mine' }), order('o2', { title: 'Other' })];
    const { wrapper } = await mountDetail('o1');
    await updateOrder('o2', { title: 'Changed' });
    await flushPromises();
    expect(wrapper.find('[data-testid="detail-name"]').text()).toBe('Mine');
  });

  it('identifies an unnamed order by its items', async () => {
    state.orders = [order('o1', { items: [{ name: 'Pho', quantity: 1, customizations: [] }] })];
    const { wrapper } = await mountDetail();
    expect(wrapper.find('[data-testid="order-title"]').text()).toBe('Pho');
    expect(wrapper.find('[data-testid="detail-name"]').exists()).toBe(false);
  });

  it('has a share action that opens the friend picker', async () => {
    state.orders = [order('o1')];
    const { wrapper } = await mountDetail();
    await wrapper.find('[data-testid="share-order"]').trigger('click');
    await flushPromises();
    expect(wrapper.find('[data-testid="friend-picker"]').exists()).toBe(true);
  });

  it('makes the order the default', async () => {
    state.orders = [order('o1', { isDefault: true }), order('o2')];
    const { wrapper } = await mountDetail('o2');
    await wrapper.find('[data-testid="make-default"]').trigger('click');
    await flushPromises();
    expect(state.orders.filter((o) => o.isDefault).map((o) => o.id)).toEqual(['o2']);
    expect(wrapper.find('[data-testid="make-default"]').exists()).toBe(false);
  });

  it('removes the default after confirmation and promotes the most recently updated order', async () => {
    state.orders = [
      order('o1', { isDefault: true }),
      order('o2', { updatedAt: '2026-03-01' }),
      order('o3', { updatedAt: '2026-02-01' }),
    ];
    const { wrapper, router } = await mountDetail('o1');
    await wrapper.find('[data-testid="delete-order"]').trigger('click');
    expect(state.calls.some(([m]) => m === 'DELETE')).toBe(false);
    expect((wrapper.vm as any).confirmingDelete).toBe(true);
    (wrapper.vm as any).deleteAlertButtons.find((b: any) => b.role === 'destructive').handler();
    await flushPromises();
    expect(state.calls).toContainEqual(['DELETE', '/api/orders/o1', undefined]);
    expect(state.orders.find((o) => o.isDefault)?.id).toBe('o2');
    expect(router.currentRoute.value.path).toBe('/tabs/restaurants/r1');
  });

  it('removing the last order returns to the restaurant, which stays as an empty entry', async () => {
    state.orders = [order('o1', { isDefault: true })];
    const { wrapper, router } = await mountDetail('o1');
    await wrapper.find('[data-testid="delete-order"]').trigger('click');
    expect((wrapper.vm as any).confirmingDelete).toBe(true);
    (wrapper.vm as any).deleteAlertButtons.find((b: any) => b.role === 'destructive').handler();
    await flushPromises();
    expect(router.currentRoute.value.path).toBe('/tabs/restaurants/r1');
    expect(state.calls.some(([m, p]) => m === 'DELETE' && p.startsWith('/api/restaurants'))).toBe(false);
    const page = await mountOrders();
    expect(page.wrapper.find('[data-testid="no-orders"]').exists()).toBe(true);
  });
});

describe('Editing an order', () => {
  async function mountEdit() {
    const router = buildRouter(createMemoryHistory());
    await router.push('/tabs/restaurants/r1/orders/o1/edit');
    const wrapper = mount(AddOrderPage, { global: { plugins: [router] } });
    await flushPromises();
    const vm = wrapper.vm as unknown as {
      editingId: string | null;
      restaurantName: string;
      title: string;
      notes: string;
      items: { name: string; quantity: number; customizations: { kind: string; ingredient: string; insteadOf: string }[] }[];
      submit: () => Promise<void>;
    };
    return { router, wrapper, vm };
  }

  it('loads the order and saves edited name, items, quantities, customizations and notes', async () => {
    state.orders = [
      order('o1', { title: 'Old', notes: 'n', items: [{ name: 'Taco', quantity: 1, customizations: [] }], isDefault: true }),
      order('o2'),
    ];
    const other = { ...state.orders[1] };
    const { vm, wrapper, router } = await mountEdit();
    expect(wrapper.find('[data-testid="form-title"]').text()).toBe('Edit order');
    expect(vm.restaurantName).toBe('Taco Spot');
    expect(vm.title).toBe('Old');
    expect(vm.items.map((i) => i.name)).toEqual(['Taco']);

    vm.title = 'New';
    vm.notes = 'Extra salsa';
    vm.items[0].quantity = 3;
    await wrapper.find('[data-testid="add-remove"]').trigger('click');
    vm.items[0].customizations[0].ingredient = 'Onions';
    await vm.submit();
    await flushPromises();

    expect(state.calls).toContainEqual(['PATCH', '/api/orders/o1', {
      title: 'New',
      notes: 'Extra salsa',
      items: [{ name: 'Taco', quantity: 3, customizations: [{ kind: 'remove', ingredient: 'Onions' }] }],
    }]);
    const body = state.calls.find(([m]) => m === 'PATCH')?.[2] as Record<string, unknown>;
    expect(body).not.toHaveProperty('restaurantId');
    expect(body).not.toHaveProperty('restaurantName');
    expect(state.orders[0].updatedAt).toBe('2030-01-01');
    expect(state.orders[1]).toEqual(other);
    expect(router.currentRoute.value.path).toBe('/tabs/restaurants/r1/orders/o1');
  });

  it('does not let the restaurant be changed', async () => {
    state.orders = [order('o1', { isDefault: true })];
    const { wrapper } = await mountEdit();
    const el = wrapper.find('[data-testid="restaurant-input"]').element as HTMLElement & { disabled?: boolean; readonly?: boolean };
    expect(el.disabled ?? el.hasAttribute('disabled')).toBe(true);
    expect(el.readonly ?? el.hasAttribute('readonly')).toBe(true);
    expect(wrapper.find('[data-testid="restaurant-locked"]').exists()).toBe(true);
  });

  it('blocks saving an edit with no items', async () => {
    state.orders = [order('o1', { isDefault: true })];
    const { vm, wrapper } = await mountEdit();
    vm.items.splice(0, vm.items.length);
    await vm.submit();
    await flushPromises();
    expect(wrapper.find('[data-testid="save-error"]').text()).toBe('Add at least one item.');
    expect(state.calls.some(([m]) => m === 'PATCH')).toBe(false);
  });
});
