import { flushPromises, mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createMemoryHistory } from 'vue-router';

const state = vi.hoisted(() => ({
  userId: null as string | null,
  rows: [] as unknown[],
  calls: [] as [string, string][],
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
      if (path === '/api/restaurants') return state.rows;
      return undefined;
    },
  };
});

import RestaurantListPage from '@/views/RestaurantListPage.vue';
import LoginPage from '@/views/LoginPage.vue';
import { buildRouter, routes } from '@/router';
import { fetchMyRestaurants } from '@/services/restaurants';

beforeEach(() => {
  state.userId = null;
  state.rows = [];
  state.calls = [];
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
    await wrapper.find('form').trigger('submit');
    await flushPromises();
    expect(state.signUp).toHaveBeenCalled();
    expect(router.currentRoute.value.path).toBe('/tabs/restaurants');
  });
});

describe('fetchMyRestaurants', () => {
  it('loads the current user\'s restaurants from the API', async () => {
    state.userId = 'user-1';
    state.rows = [{ id: 'r1', name: 'Taco Spot', updatedAt: '2026-01-01', orderCount: 2, defaultItems: [] }];
    const result = await fetchMyRestaurants();
    expect(state.calls).toContainEqual(['GET', '/api/restaurants']);
    expect(result).toEqual([{ id: 'r1', name: 'Taco Spot', orderCount: 2, updatedAt: '2026-01-01' }]);
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

  it('shows the empty state when the user has no restaurants', async () => {
    state.userId = 'user-1';
    const wrapper = mount(RestaurantListPage);
    await flushPromises();
    expect(wrapper.find('[data-testid="empty-state"]').exists()).toBe(true);
  });
});
