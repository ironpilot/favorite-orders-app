import { flushPromises, mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createMemoryHistory } from 'vue-router';

type User = { id: string; email: string; phone: string | null; displayName: string };

const state = vi.hoisted(() => ({
  account: { id: 'me', emailVerified: true } as { id: string; emailVerified: boolean } | null,
  links: [] as unknown[],
  calls: [] as [string, string, unknown?][],
  openResult: null as unknown,
  openStatus: 200,
}));

vi.mock('@/lib/api', () => {
  class ApiError extends Error {
    constructor(public status: number, message: string) {
      super(message);
    }
  }
  return {
    ApiError,
    getToken: () => (state.account ? 'token' : null),
    setToken: () => undefined,
    getRefreshToken: () => null,
    setRefreshToken: () => undefined,
    api: async (method: string, path: string, body?: unknown) => {
      state.calls.push([method, path, body]);
      if (path === '/api/auth/me') {
        if (!state.account) throw new ApiError(401, 'Not signed in');
        return state.account;
      }
      if (method === 'GET' && path === '/api/orders/o1') {
        return { id: 'o1', restaurantId: 'r1', title: 'Lunch', items: [{ name: 'Taco', quantity: 1, customizations: [] }], notes: null, isDefault: true, createdAt: '', updatedAt: '' };
      }
      if (path === '/api/orders/o1/links') {
        if (method === 'GET') return [...state.links];
        const hours = (body as { expiresInHours: number | null }).expiresInHours;
        const link = { id: 'l1', orderId: 'o1', expiresAt: hours ? new Date(Date.now() + hours * 3_600_000).toISOString() : null, disabled: false, active: true, createdAt: '', openers: [], url: 'http://app/link/tok' };
        state.links.push(link);
        return link;
      }
      if (method === 'POST' && path.startsWith('/api/links/')) {
        if (state.openStatus !== 200) throw new ApiError(state.openStatus, 'This link is no longer valid');
        return state.openResult;
      }
      if (method === 'GET' && path === '/api/friends') return [];
      if (method === 'GET' && path === '/api/shared') return [];
      return undefined;
    },
  };
});

vi.mock('@/services/auth', async (orig) => {
  const actual = await orig<typeof import('@/services/auth')>();
  return {
    ...actual,
    getCurrentAccount: async () => state.account,
    isVerified: (a: { emailVerified: boolean }) => a.emailVerified,
  };
});

import OrderDetailPage from '@/views/OrderDetailPage.vue';
import OpenLinkPage from '@/views/OpenLinkPage.vue';
import { buildRouter } from '@/router';

const owner: User = { id: 'u-own', email: 'own@example.com', phone: null, displayName: 'Olive' };

beforeEach(() => {
  state.account = { id: 'me', emailVerified: true };
  state.links = [];
  state.calls = [];
  state.openStatus = 200;
  state.openResult = { own: false, shareId: 's9', orderId: 'o9', owner, friendPrompt: true };
  localStorage.clear();
  Object.defineProperty(navigator, 'onLine', { configurable: true, value: true });
});

async function mountAt(component: object, path: string, props: Record<string, string> = {}) {
  const router = buildRouter(createMemoryHistory());
  await router.push(path);
  const wrapper = mount(component, { props, global: { plugins: [router] } });
  await flushPromises();
  return { wrapper, router };
}

describe('creating share links', () => {
  it('creates a link with a chosen expiry or none from the share modal', async () => {
    const { wrapper } = await mountAt(OrderDetailPage, '/tabs/restaurants/r1/orders/o1', { id: 'r1', orderId: 'o1' });
    await wrapper.find('[data-testid="share-order"]').trigger('click');
    await flushPromises();
    const vm = wrapper.vm as unknown as { linkExpiry: string; createLink: () => Promise<void>; newLinkUrl: string };
    vm.linkExpiry = '1 day';
    await vm.createLink();
    vm.linkExpiry = 'No expiry';
    await vm.createLink();
    await flushPromises();
    const posts = state.calls.filter(([m, p]) => m === 'POST' && p === '/api/orders/o1/links').map(([, , b]) => b);
    expect(posts).toEqual([{ expiresInHours: 24 }, { expiresInHours: null }]);
    expect(vm.newLinkUrl).toBe('http://app/link/tok');
    expect(wrapper.findAll('[data-testid="share-link"]')).toHaveLength(2);
  });
});

describe('opening share links', () => {
  it('asks a signed-out user to sign in, then resumes the link', async () => {
    state.account = null;
    const router = buildRouter(createMemoryHistory());
    await router.push('/link/tok');
    expect(router.currentRoute.value.path).toBe('/login');
    state.account = { id: 'me', emailVerified: true };
    await router.push('/tabs/restaurants');
    expect(router.currentRoute.value.path).toBe('/link/tok');
  });

  it('shows the friend prompt to a non-friend and sends a request on accept', async () => {
    const { wrapper, router } = await mountAt(OpenLinkPage, '/link/tok', { token: 'tok' });
    const vm = wrapper.vm as unknown as { prompting: boolean; acceptPrompt: () => Promise<void> };
    expect(vm.prompting).toBe(true);
    await vm.acceptPrompt();
    await flushPromises();
    expect(state.calls).toContainEqual(['POST', '/api/friends', { userId: 'u-own' }]);
    expect(router.currentRoute.value.path).toBe('/tabs/shared/s9');
  });

  it('skipping the prompt keeps the order and sends no request', async () => {
    const { wrapper, router } = await mountAt(OpenLinkPage, '/link/tok', { token: 'tok' });
    const vm = wrapper.vm as unknown as { promptButtons: { handler: () => void }[] };
    vm.promptButtons[0].handler();
    await flushPromises();
    expect(state.calls.some(([m, p]) => m === 'POST' && p === '/api/friends')).toBe(false);
    expect(router.currentRoute.value.path).toBe('/tabs/shared/s9');
  });

  it('does not prompt existing friends', async () => {
    state.openResult = { own: false, shareId: 's9', orderId: 'o9', owner, friendPrompt: false };
    const { wrapper, router } = await mountAt(OpenLinkPage, '/link/tok', { token: 'tok' });
    expect((wrapper.vm as unknown as { prompting: boolean }).prompting).toBe(false);
    expect(router.currentRoute.value.path).toBe('/tabs/shared/s9');
  });

  it('shows a no-longer-valid message for expired or disabled links', async () => {
    state.openStatus = 410;
    const { wrapper } = await mountAt(OpenLinkPage, '/link/tok', { token: 'tok' });
    expect(wrapper.find('[data-testid="link-error"]').text()).toContain('This link is no longer valid');
  });
});
