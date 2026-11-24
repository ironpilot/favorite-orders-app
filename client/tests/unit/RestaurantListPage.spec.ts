import { flushPromises, mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createMemoryHistory } from 'vue-router';

const state = vi.hoisted(() => ({
  userId: null as string | null,
  rows: [] as unknown[],
  calls: [] as [string, string][],
  bodies: [] as unknown[],
  orders: [] as unknown[],
  suggestions: [] as unknown[],
  toppings: [] as string[],
  failToppings: false,
  failRestaurants: false,
  signUp: vi.fn(),
  signIn: vi.fn(),
}));

vi.mock('@/lib/api', () => {
  class ApiError extends Error {
    constructor(public status: number, message: string) {
      super(message);
    }
  }
  let token: string | null = null;
  return {
    ApiError,
    getToken: () => (state.userId ? 'token' : token),
    setToken: (t: string | null) => {
      token = t;
    },
    api: async (method: string, path: string, body?: unknown) => {
      state.calls.push([method, path]);
      if (path === '/api/auth/me') {
        if (!state.userId) throw new ApiError(401, 'Not signed in');
        return { id: state.userId };
      }
      if (path === '/api/auth/signin') {
        state.signIn(body);
        state.userId = 'user-1';
        return { token: 't', user: { id: state.userId } };
      }
      if (path === '/api/auth/signup') {
        state.signUp(body);
        state.userId = 'new-user';
        return { token: 't', user: { id: state.userId } };
      }
      if (path === '/api/restaurants') {
        if (state.failRestaurants) throw new ApiError(500, 'Server down');
        return state.rows;
      }
      if (path.startsWith('/api/restaurant-suggestions')) return state.suggestions;
      if (path.startsWith('/api/toppings')) {
        if (state.failToppings) throw new ApiError(500, 'Server down');
        return state.toppings;
      }
      if (method === 'POST' && path === '/api/orders') {
        state.bodies.push(body);
        return { id: 'o-new', restaurantId: 'r-new', items: [], isDefault: true };
      }
      const m = path.match(/^\/api\/restaurants\/([^/]+)(\/orders)?$/);
      if (m) return m[2] ? state.orders : { id: m[1], name: 'Taco Spot', updatedAt: '' };
      return undefined;
    },
  };
});

import RestaurantListPage from '@/views/RestaurantListPage.vue';
import LoginPage from '@/views/LoginPage.vue';
import { buildRouter, routes } from '@/router';
import { fetchMyRestaurants } from '@/services/restaurants';
import RestaurantOrdersPage from '@/views/RestaurantOrdersPage.vue';
import AddOrderPage from '@/views/AddOrderPage.vue';

beforeEach(() => {
  state.userId = null;
  state.rows = [];
  state.calls = [];
  state.bodies = [];
  state.orders = [];
  state.suggestions = [];
  state.toppings = [];
  state.failToppings = false;
  state.failRestaurants = false;
  Object.defineProperty(navigator, 'onLine', { configurable: true, value: true });
  state.signIn.mockClear();
  state.signUp.mockClear();
});

describe('router', () => {
  it('lands a signed-in user on the restaurant list on app open', async () => {
    state.userId = 'user-1';
    const router = buildRouter(createMemoryHistory());
    await router.push('/');
    expect(router.currentRoute.value.path).toBe('/tabs/restaurants');
  });

  it('sends a signed-out user to the login screen', async () => {
    const router = buildRouter(createMemoryHistory());
    await router.push('/');
    expect(router.currentRoute.value.path).toBe('/login');
  });

  it.each([
    '/tabs/restaurants',
    '/tabs/restaurants/new-order',
    '/tabs/restaurants/r1',
    '/tabs/restaurants/r1/orders/o1',
    '/tabs/shared',
    '/tabs/profile',
    '/tabs/friends',
    '/some/unknown/page',
  ])('blocks %s without an account and sends the user to sign-in', async (path) => {
    const router = buildRouter(createMemoryHistory());
    await router.push(path);
    expect(router.currentRoute.value.path).toBe('/login');
  });

  it('lets a signed-in user open app pages and keeps them off the login screen', async () => {
    state.userId = 'user-1';
    const router = buildRouter(createMemoryHistory());
    await router.push('/tabs/friends');
    expect(router.currentRoute.value.path).toBe('/tabs/friends');
    await router.push('/login');
    expect(router.currentRoute.value.path).toBe('/tabs/restaurants');
  });

  it('makes the list reachable through the bottom tabs', () => {
    const tabs = routes.find((r) => r.path === '/tabs/');
    expect(tabs?.children?.some((c) => c.path === 'restaurants')).toBe(true);
  });
});

describe('LoginPage', () => {
  it('lands a new user on the restaurant list after sign-up', async () => {
    const router = buildRouter(createMemoryHistory());
    await router.push('/login');
    const wrapper = mount(LoginPage, { global: { plugins: [router] } });
    await wrapper.find('[data-testid="auth-toggle"]').trigger('click');
    Object.assign(wrapper.vm as unknown as Record<string, string>, {
      displayName: 'New', email: 'new@example.com', phone: '+1 555 000 1234', password: 'secret123',
    });
    await wrapper.find('form').trigger('submit');
    await flushPromises();
    expect(state.signUp).toHaveBeenCalledWith(expect.objectContaining({ phone: '+1 555 000 1234' }));
    expect(router.currentRoute.value.path).toBe('/tabs/restaurants');
  });

  it('rejects a weak password before contacting the server', async () => {
    const router = buildRouter(createMemoryHistory());
    await router.push('/login');
    const wrapper = mount(LoginPage, { global: { plugins: [router] } });
    await wrapper.find('[data-testid="auth-toggle"]').trigger('click');
    Object.assign(wrapper.vm as unknown as Record<string, string>, {
      displayName: 'New', email: 'new@example.com', phone: '+15550001234', password: 'password',
    });
    await wrapper.find('form').trigger('submit');
    await flushPromises();
    expect(state.signUp).not.toHaveBeenCalled();
    expect(wrapper.find('[data-testid="auth-error"]').text()).toContain('letters and numbers');
  });
});

describe('fetchMyRestaurants', () => {
  it('loads the current user\'s restaurants from the API', async () => {
    state.userId = 'user-1';
    state.rows = [{ id: 'r1', name: 'Taco Spot', updatedAt: '2026-01-01', orderCount: 2, defaultItems: [] }];
    const result = await fetchMyRestaurants();
    expect(state.calls).toContainEqual(['GET', '/api/restaurants']);
    expect(result).toEqual([{ id: 'r1', name: 'Taco Spot', orderCount: 2, defaultItems: [], updatedAt: '2026-01-01' }]);
  });

  it('returns nothing when signed out', async () => {
    expect(await fetchMyRestaurants()).toEqual([]);
    expect(state.calls).not.toContainEqual(['GET', '/api/restaurants']);
  });
});

describe('RestaurantListPage', () => {
  it('shows each restaurant name and order count', async () => {
    state.userId = 'user-1';
    state.rows = [
      { id: 'r1', name: 'Taco Spot', updatedAt: '2026-01-02', orderCount: 2, defaultItems: [] },
      { id: 'r2', name: 'Pho House', updatedAt: '2026-01-01', orderCount: 1, defaultItems: [] },
    ];
    const wrapper = mount(RestaurantListPage);
    await flushPromises();
    const names = wrapper.findAll('[data-testid="restaurant-name"]').map((n) => n.text());
    const counts = wrapper.findAll('[data-testid="order-count"]').map((n) => n.text());
    expect(names).toEqual(['Taco Spot', 'Pho House']);
    expect(counts).toEqual(['2 orders', '1 order']);
  });

  it('shows the default order items as the preview', async () => {
    state.userId = 'user-1';
    state.rows = [{ id: 'r1', name: 'Taco Spot', updatedAt: '', orderCount: 2, defaultItems: ['Al pastor', 'Horchata'] }];
    const wrapper = mount(RestaurantListPage);
    await flushPromises();
    expect(wrapper.find('[data-testid="key-items"]').text()).toBe('Al pastor, Horchata');
  });

  it('shows a fallback for restaurants with orders but no default, and with no orders', async () => {
    state.userId = 'user-1';
    state.rows = [
      { id: 'r1', name: 'Taco Spot', updatedAt: '', orderCount: 2, defaultItems: [] },
      { id: 'r2', name: 'Pho House', updatedAt: '', orderCount: 0, defaultItems: [] },
    ];
    const wrapper = mount(RestaurantListPage);
    await flushPromises();
    const fallbacks = wrapper.findAll('[data-testid="preview-fallback"]').map((n) => n.text());
    expect(fallbacks).toEqual(['No default order set', 'No orders yet. Tap to add one.']);
    expect(wrapper.find('[data-testid="key-items"]').exists()).toBe(false);
  });

  it('opens a restaurant\'s orders when selected', async () => {
    state.userId = 'user-1';
    state.rows = [{ id: 'r1', name: 'Taco Spot', updatedAt: '', orderCount: 1, defaultItems: ['Taco'] }];
    const router = buildRouter(createMemoryHistory());
    await router.push('/tabs/restaurants');
    const wrapper = mount(RestaurantListPage, { global: { plugins: [router] } });
    await flushPromises();
    await wrapper.find('[data-testid="restaurant-item"]').trigger('click');
    await flushPromises();
    expect(router.currentRoute.value.path).toBe('/tabs/restaurants/r1');
  });

  it('has a prominent add-order action that starts the add-order flow', async () => {
    state.userId = 'user-1';
    const router = buildRouter(createMemoryHistory());
    await router.push('/tabs/restaurants');
    const wrapper = mount(RestaurantListPage, { global: { plugins: [router] } });
    await flushPromises();
    await wrapper.find('[data-testid="add-order"]').trigger('click');
    await flushPromises();
    expect(router.currentRoute.value.path).toBe('/tabs/restaurants/new-order');
  });

  it('shows the empty state when the user has no restaurants', async () => {
    state.userId = 'user-1';
    const wrapper = mount(RestaurantListPage);
    await flushPromises();
    expect(wrapper.find('[data-testid="empty-state"]').exists()).toBe(true);
  });

  it('leads from the first-order prompt into the add-order flow', async () => {
    state.userId = 'user-1';
    const router = buildRouter(createMemoryHistory());
    await router.push('/tabs/restaurants');
    const wrapper = mount(RestaurantListPage, { global: { plugins: [router] } });
    await flushPromises();
    await wrapper.find('[data-testid="empty-add-order"]').trigger('click');
    await flushPromises();
    expect(router.currentRoute.value.path).toBe('/tabs/restaurants/new-order');
  });

  it('shows the name and an add-order prompt for a restaurant with no orders', async () => {
    state.userId = 'user-1';
    state.rows = [{ id: 'r9', name: 'Empty Diner', updatedAt: '', orderCount: 0, defaultItems: [] }];
    const router = buildRouter(createMemoryHistory());
    await router.push('/tabs/restaurants');
    const wrapper = mount(RestaurantListPage, { global: { plugins: [router] } });
    await flushPromises();
    expect(wrapper.find('[data-testid="restaurant-name"]').text()).toBe('Empty Diner');
    await wrapper.find('[data-testid="empty-entry-add-order"]').trigger('click');
    await flushPromises();
    expect(router.currentRoute.value.path).toBe('/tabs/restaurants/new-order');
    expect(router.currentRoute.value.query.restaurantId).toBe('r9');
  });

  it('wraps and clamps a very long restaurant name without losing it', async () => {
    state.userId = 'user-1';
    const long = 'Very Long Restaurant Name '.repeat(8).trim();
    state.rows = [{ id: 'r1', name: long, updatedAt: '', orderCount: 1, defaultItems: ['Taco'] }];
    const wrapper = mount(RestaurantListPage);
    await flushPromises();
    const name = wrapper.find('[data-testid="restaurant-name"]');
    expect(name.text()).toBe(long);
    expect(name.attributes('title')).toBe(long);
    expect(name.classes()).toContain('restaurant-name');
    expect(wrapper.find('[data-testid="restaurant-item"] ion-label').classes()).toContain('ion-text-wrap');
  });
});

describe('RestaurantListPage search and sort', () => {
  type Vm = { search: string; sort: string; load: () => Promise<void>; onRefresh: (e: unknown) => Promise<void> };
  const rows = () => [
    { id: 'r1', name: 'Taco Spot', updatedAt: '2026-01-02', orderCount: 1, defaultItems: ['Taco'], itemNames: ['Taco'] },
    { id: 'r2', name: 'burger barn', updatedAt: '2026-01-03', orderCount: 1, defaultItems: [], itemNames: ['Cheeseburger'] },
    { id: 'r3', name: 'Burger Barn', updatedAt: '2026-01-01', orderCount: 1, defaultItems: ['Fries'], itemNames: ['Fries'] },
  ];
  async function mountList() {
    state.userId = 'user-1';
    state.rows = rows();
    const wrapper = mount(RestaurantListPage);
    await flushPromises();
    const names = () => wrapper.findAll('[data-testid="restaurant-name"]').map((n) => n.text());
    return { wrapper, vm: wrapper.vm as unknown as Vm, names };
  }

  it('defaults to most recently updated first, keeping different spellings separate', async () => {
    const { names } = await mountList();
    expect(names()).toEqual(['burger barn', 'Taco Spot', 'Burger Barn']);
  });

  it('sorts A-Z', async () => {
    const { vm, names, wrapper } = await mountList();
    vm.sort = 'name';
    await wrapper.vm.$nextTick();
    expect(names().map((n) => n.toLowerCase())).toEqual(['burger barn', 'burger barn', 'taco spot']);
  });

  it('filters by restaurant name and by item name, and clearing restores the list', async () => {
    const { vm, names, wrapper } = await mountList();
    vm.search = 'taco s';
    await wrapper.vm.$nextTick();
    expect(names()).toEqual(['Taco Spot']);
    vm.search = 'BURGER';
    await wrapper.vm.$nextTick();
    expect(names()).toEqual(['burger barn', 'Burger Barn']);
    vm.search = 'cheese';
    await wrapper.vm.$nextTick();
    expect(names()).toEqual(['burger barn']);
    vm.search = '';
    await wrapper.vm.$nextTick();
    expect(names()).toHaveLength(3);
  });

  it('shows a no-matches state', async () => {
    const { vm, wrapper } = await mountList();
    vm.search = 'sushi';
    await wrapper.vm.$nextTick();
    expect(wrapper.find('[data-testid="no-matches"]').exists()).toBe(true);
  });

  it('moves a restaurant to the top after its order changes', async () => {
    const { vm, names } = await mountList();
    state.rows = rows().map((r) => (r.id === 'r3' ? { ...r, updatedAt: '2026-02-01' } : r));
    await vm.load();
    await flushPromises();
    expect(names()[0]).toBe('Burger Barn');
  });
});

describe('RestaurantListPage refresh', () => {
  type Vm = { search: string; sort: string; load: () => Promise<void>; onRefresh: (e: unknown) => Promise<void> };
  async function mountList() {
    state.userId = 'user-1';
    state.rows = [{ id: 'r1', name: 'Taco Spot', updatedAt: '2026-01-02', orderCount: 1, defaultItems: ['Taco'] }];
    const wrapper = mount(RestaurantListPage);
    await flushPromises();
    return { wrapper, vm: wrapper.vm as unknown as Vm };
  }
  const listCalls = () => state.calls.filter((c) => c[1] === '/api/restaurants').length;

  it('reloads on entry and on every re-entry, showing changes', async () => {
    const { wrapper, vm } = await mountList();
    expect(listCalls()).toBe(1);
    state.rows = [...state.rows, { id: 'r2', name: 'Pho House', updatedAt: '2026-01-05', orderCount: 1, defaultItems: [] }];
    await vm.load(); // what ionViewWillEnter runs on back navigation or tab switch
    await flushPromises();
    expect(listCalls()).toBe(2);
    expect(wrapper.findAll('[data-testid="restaurant-name"]').map((n) => n.text())).toEqual(['Pho House', 'Taco Spot']);
  });

  it('pull to refresh reloads and completes the refresher', async () => {
    const { vm } = await mountList();
    const complete = vi.fn();
    await vm.onRefresh({ target: { complete } });
    expect(listCalls()).toBe(2);
    expect(complete).toHaveBeenCalled();
  });

  it('keeps the search text and sort choice across a refresh', async () => {
    const { vm } = await mountList();
    vm.search = 'taco';
    vm.sort = 'name';
    await vm.load();
    expect(vm.search).toBe('taco');
    expect(vm.sort).toBe('name');
  });

  it('keeps the previous list and shows an error when a refresh fails', async () => {
    const { wrapper, vm } = await mountList();
    state.failRestaurants = true;
    const complete = vi.fn();
    await vm.onRefresh({ target: { complete } });
    await flushPromises();
    expect(complete).toHaveBeenCalled();
    expect(wrapper.find('[data-testid="restaurant-name"]').text()).toBe('Taco Spot');
    expect(wrapper.find('[data-testid="refresh-message"]').text()).toContain('Server down');
  });

  it('keeps the list and shows a connection-needed message when offline', async () => {
    const { wrapper, vm } = await mountList();
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: false });
    const complete = vi.fn();
    await vm.onRefresh({ target: { complete } });
    await flushPromises();
    expect(complete).toHaveBeenCalled();
    expect(listCalls()).toBe(1);
    expect(wrapper.find('[data-testid="restaurant-name"]').text()).toBe('Taco Spot');
    expect(wrapper.find('[data-testid="refresh-message"]').text()).toContain('connection is needed');
  });
});

describe('RestaurantOrdersPage', () => {
  it('lists the orders saved at the restaurant', async () => {
    state.userId = 'user-1';
    state.orders = [{
      id: 'o1',
      title: 'Usual',
      items: [
        { name: 'Taco', quantity: 2, customizations: [{ kind: 'remove', ingredient: 'Onions' }] },
        { name: 'Soda', quantity: 1, customizations: [] },
      ],
      notes: null,
      isDefault: true,
    }];
    const wrapper = mount(RestaurantOrdersPage, { props: { id: 'r1' } });
    await flushPromises();
    expect(state.calls).toContainEqual(['GET', '/api/restaurants/r1/orders']);
    expect(wrapper.find('[data-testid="restaurant-title"]').text()).toBe('Taco Spot');
    expect(wrapper.find('[data-testid="order-items"]').text()).toBe('2× Taco (No Onions), Soda');
    expect(wrapper.find('[data-testid="default-badge"]').exists()).toBe(true);
  });
});

describe('AddOrderPage', () => {
  async function mountForm() {
    state.userId = 'user-1';
    const router = buildRouter(createMemoryHistory());
    await router.push('/tabs/restaurants/new-order');
    const wrapper = mount(AddOrderPage, { global: { plugins: [router] } });
    return { router, vm: wrapper.vm as unknown as {
      restaurantName: string;
      title: string;
      notes: string;
      items: { name: string; quantity: number; customizations: { kind: string; ingredient: string; insteadOf: string }[] }[];
      submit: () => Promise<void>;
    }, wrapper };
  }

  it('opens the form from the add-order action', async () => {
    const { wrapper } = await mountForm();
    expect(wrapper.find('[data-testid="add-order-form"]').exists()).toBe(true);
    expect(wrapper.findAll('[data-testid="order-item-row"]')).toHaveLength(1);
  });

  it('adds, edits and removes items, with quantity starting at 1', async () => {
    const { vm, wrapper } = await mountForm();
    await wrapper.find('[data-testid="add-item"]').trigger('click');
    expect(wrapper.findAll('[data-testid="item-quantity"]').map((q) => q.text())).toEqual(['1', '1']);
    await wrapper.findAll('[data-testid="quantity-increase"]')[1].trigger('click');
    await wrapper.findAll('[data-testid="quantity-increase"]')[1].trigger('click');
    expect(vm.items[1].quantity).toBe(3);
    await wrapper.findAll('[data-testid="quantity-decrease"]')[0].trigger('click');
    expect(vm.items[0].quantity).toBe(1);
    vm.items[0].name = 'Burger';
    vm.items[1].name = 'Fries';
    vm.items[0].name = 'Cheeseburger';
    await wrapper.findAll('[data-testid="remove-item"]')[0].trigger('click');
    expect(vm.items.map((i) => i.name)).toEqual(['Fries']);
  });

  it('saves items with mixed customizations, name and notes, then opens the restaurant', async () => {
    const { router, vm, wrapper } = await mountForm();
    vm.restaurantName = '  New Place ';
    vm.title = ' Game night ';
    vm.notes = ' Extra napkins ';
    vm.items[0].name = ' Hamburger ';
    for (const kind of ['remove', 'add', 'substitute']) {
      await wrapper.find(`[data-testid="add-${kind}"]`).trigger('click');
    }
    const [r, a, s] = vm.items[0].customizations;
    r.ingredient = 'Lettuce';
    a.ingredient = 'Onions';
    s.ingredient = 'Mayonnaise';
    s.insteadOf = 'Ketchup';
    await wrapper.find('[data-testid="add-item"]').trigger('click');
    vm.items[1].name = 'Fries';
    await wrapper.find('[data-testid="add-item"]').trigger('click');
    await vm.submit();
    await flushPromises();
    expect(state.bodies).toEqual([{
      restaurantName: 'New Place',
      title: 'Game night',
      notes: 'Extra napkins',
      items: [
        {
          name: 'Hamburger',
          quantity: 1,
          customizations: [
            { kind: 'remove', ingredient: 'Lettuce' },
            { kind: 'add', ingredient: 'Onions' },
            { kind: 'substitute', ingredient: 'Mayonnaise', insteadOf: 'Ketchup' },
          ],
        },
        { name: 'Fries', quantity: 1, customizations: [] },
      ],
    }]);
    expect(router.currentRoute.value.path).toBe('/tabs/restaurants/r-new');
  });

  it('blocks saving without items with a clear message', async () => {
    const { vm, wrapper } = await mountForm();
    vm.restaurantName = 'Place';
    await vm.submit();
    await flushPromises();
    expect(wrapper.find('[data-testid="save-error"]').text()).toBe('Add at least one item.');
    await wrapper.find('[data-testid="remove-item"]').trigger('click');
    await vm.submit();
    await flushPromises();
    expect(wrapper.find('[data-testid="save-error"]').text()).toBe('Add at least one item.');
    expect(state.bodies).toEqual([]);
  });

  it('requires a restaurant name and a complete substitution', async () => {
    const { vm, wrapper } = await mountForm();
    vm.items[0].name = 'Burger';
    await vm.submit();
    await flushPromises();
    expect(wrapper.find('[data-testid="save-error"]').text()).toBe('Enter a restaurant name.');
    vm.restaurantName = 'Place';
    await wrapper.find('[data-testid="add-substitute"]').trigger('click');
    vm.items[0].customizations[0].ingredient = 'Mayo';
    await vm.submit();
    await flushPromises();
    expect(wrapper.find('[data-testid="save-error"]').text()).toBe('Complete both parts of each substitution.');
    expect(state.bodies).toEqual([]);
  });

  it('suggests restaurants as the user types and saves at a picked one', async () => {
    const { vm, wrapper } = await mountForm();
    state.suggestions = [
      { id: 'admin-1', name: 'Burger Co', adminOwned: true, updatedAt: '' },
      { id: 'mine-1', name: 'Burger Shack', adminOwned: false, updatedAt: '' },
    ];
    vm.restaurantName = 'Burg';
    await flushPromises();
    const options = wrapper.findAll('[data-testid="restaurant-suggestion"]');
    expect(options.map((o) => o.text())).toEqual(['Burger Co Listed', 'Burger Shack']);
    await options[0].trigger('click');
    await flushPromises();
    expect(vm.restaurantName).toBe('Burger Co');
    expect(wrapper.find('[data-testid="restaurant-picked"]').exists()).toBe(true);
    vm.items[0].name = 'Burger';
    await vm.submit();
    await flushPromises();
    expect(state.bodies).toEqual([{ restaurantId: 'admin-1', items: [{ name: 'Burger', quantity: 1, customizations: [] }] }]);
  });

  it('creates a new restaurant when a name is typed without picking a suggestion', async () => {
    const { vm, wrapper } = await mountForm();
    state.suggestions = [{ id: 'admin-1', name: 'Burger Co', adminOwned: true, updatedAt: '' }];
    vm.restaurantName = 'Burger Corner';
    await flushPromises();
    expect(wrapper.find('[data-testid="restaurant-new"]').exists()).toBe(true);
    vm.items[0].name = 'Burger';
    await vm.submit();
    await flushPromises();
    expect(state.bodies).toEqual([{ restaurantName: 'Burger Corner', items: [{ name: 'Burger', quantity: 1, customizations: [] }] }]);
  });

  it('preselects the restaurant when opened from it', async () => {
    state.userId = 'user-1';
    const router = buildRouter(createMemoryHistory());
    await router.push('/tabs/restaurants/new-order?restaurantId=r1');
    const wrapper = mount(AddOrderPage, { global: { plugins: [router] } });
    await flushPromises();
    const vm = wrapper.vm as unknown as { restaurantName: string; selectedRestaurant: { id: string } | null };
    expect(vm.restaurantName).toBe('Taco Spot');
    expect(vm.selectedRestaurant?.id).toBe('r1');
  });

  it('auto-fills customizations from common toppings', async () => {
    const { vm, wrapper } = await mountForm();
    state.toppings = ['Onions', 'Onion Rings'];
    await wrapper.find('[data-testid="add-add"]').trigger('click');
    const ext = wrapper.vm as unknown as { loadToppings: (c: unknown, f: string) => Promise<void> };
    await ext.loadToppings(vm.items[0].customizations[0], 'ingredient');
    await flushPromises();
    const chips = wrapper.findAll('[data-testid="topping-suggestion"]');
    expect(chips.map((c) => c.text())).toEqual(['Onions', 'Onion Rings']);
    await chips[0].trigger('click');
    expect(vm.items[0].customizations[0].ingredient).toBe('Onions');
    expect(wrapper.find('[data-testid="topping-suggestions"]').exists()).toBe(false);
  });

  type ToppingVm = { loadToppings: (c: unknown, f: string) => Promise<void> };

  it('filters topping suggestions as the user types in remove, add and substitute fields', async () => {
    const { vm, wrapper } = await mountForm();
    state.toppings = ['Lettuce'];
    const ext = wrapper.vm as unknown as ToppingVm;
    for (const [i, kind] of ['remove', 'add', 'substitute'].entries()) {
      await wrapper.find(`[data-testid="add-${kind}"]`).trigger('click');
      const c = vm.items[0].customizations[i];
      c.ingredient = 'let';
      state.calls = [];
      await ext.loadToppings(c, 'ingredient');
      await flushPromises();
      expect(state.calls).toContainEqual(['GET', '/api/toppings?q=let']);
      const chips = wrapper.findAll('[data-testid="topping-suggestion"]');
      expect(chips.map((x) => x.text())).toEqual(['Lettuce']);
      await chips[0].trigger('click');
      expect(c.ingredient).toBe('Lettuce');
    }
  });

  it('offers suggestions for both parts of a substitution', async () => {
    const { vm, wrapper } = await mountForm();
    const ext = wrapper.vm as unknown as ToppingVm;
    await wrapper.find('[data-testid="add-substitute"]').trigger('click');
    const c = vm.items[0].customizations[0];
    state.toppings = ['Mayonnaise'];
    await ext.loadToppings(c, 'ingredient');
    await flushPromises();
    await wrapper.find('[data-testid="topping-suggestion"]').trigger('click');
    state.toppings = ['Ketchup'];
    c.insteadOf = 'ket';
    await ext.loadToppings(c, 'insteadOf');
    await flushPromises();
    expect(state.calls).toContainEqual(['GET', '/api/toppings?q=ket']);
    await wrapper.find('[data-testid="topping-suggestion"]').trigger('click');
    expect([c.ingredient, c.insteadOf]).toEqual(['Mayonnaise', 'Ketchup']);
  });

  it('saves a topping that is not in the list as typed', async () => {
    const { vm, wrapper } = await mountForm();
    state.toppings = ['Lettuce'];
    vm.restaurantName = 'Place';
    vm.items[0].name = 'Burger';
    await wrapper.find('[data-testid="add-remove"]').trigger('click');
    const c = vm.items[0].customizations[0];
    c.ingredient = 'Mystery Sprinkles';
    await (wrapper.vm as unknown as ToppingVm).loadToppings(c, 'ingredient');
    await flushPromises();
    await vm.submit();
    await flushPromises();
    expect(state.bodies).toEqual([{
      restaurantName: 'Place',
      items: [{ name: 'Burger', quantity: 1, customizations: [{ kind: 'remove', ingredient: 'Mystery Sprinkles' }] }],
    }]);
  });

  for (const [label, setup] of [
    ['empty', () => { state.toppings = []; }],
    ['failing', () => { state.failToppings = true; }],
  ] as const) {
    it(`keeps the form working when the toppings list is ${label}`, async () => {
      const { vm, wrapper } = await mountForm();
      setup();
      vm.restaurantName = 'Place';
      vm.items[0].name = 'Burger';
      await wrapper.find('[data-testid="add-add"]').trigger('click');
      const c = vm.items[0].customizations[0];
      c.ingredient = 'Onions';
      await (wrapper.vm as unknown as ToppingVm).loadToppings(c, 'ingredient');
      await flushPromises();
      expect(wrapper.find('[data-testid="topping-suggestions"]').exists()).toBe(false);
      await vm.submit();
      await flushPromises();
      expect(state.bodies).toHaveLength(1);
    });
  }

  it('has no "Add a restaurant" button on the list or the form', async () => {
    const list = mount(RestaurantListPage);
    await flushPromises();
    const { wrapper } = await mountForm();
    for (const html of [list.html(), wrapper.html()]) {
      expect(html).not.toMatch(/add (a )?restaurant/i);
    }
  });

  it('limits the length of long text fields', async () => {
    const { wrapper } = await mountForm();
    for (const id of ['restaurant-input', 'title-input', 'item-name-input', 'notes-input']) {
      const el = wrapper.find(`[data-testid="${id}"]`).element as HTMLElement & { maxlength?: number };
      expect(Number(el.maxlength ?? el.getAttribute('maxlength'))).toBeGreaterThan(0);
    }
  });
});
