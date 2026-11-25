import { flushPromises, mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createMemoryHistory } from 'vue-router';

type User = { id: string; email: string; phone: string | null; displayName: string };

const state = vi.hoisted(() => ({
  friendships: [] as { id: string; status: string; direction: string; user: User }[],
  shares: [] as { id: string; sharedAt: string; user: User }[],
  shared: [] as unknown[],
  calls: [] as [string, string, unknown?][],
  failShared: false,
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
      if (path === '/api/auth/me') return { id: 'me', emailVerified: true };
      if (method === 'GET' && path === '/api/friends') return state.friendships.map((f) => ({ ...f }));
      if (method === 'GET' && path === '/api/shared') {
        if (state.failShared) throw new ApiError(500, 'Server down');
        return [...state.shared];
      }
      if (path === '/api/orders/o1/shares') {
        if (method === 'GET') return [...state.shares];
        for (const id of (body as { userIds: string[] }).userIds) {
          const f = state.friendships.find((x) => x.user.id === id)!;
          state.shares.push({ id: `s-${id}`, sharedAt: '', user: f.user });
        }
        return [];
      }
      const del = path.match(/^\/api\/shares\/([^/]+)$/);
      if (method === 'DELETE' && del) {
        state.shares = state.shares.filter((s) => s.id !== del[1]);
        return undefined;
      }
      if (method === 'GET' && path === '/api/orders/o1') {
        return { id: 'o1', restaurantId: 'r1', title: 'Lunch', items: [{ name: 'Taco', quantity: 1, customizations: [] }], notes: null, isDefault: true, createdAt: '', updatedAt: '' };
      }
      if (method === 'POST' && path.startsWith('/api/shared/')) return { id: 'copy', restaurantId: 'r9' };
      return undefined;
    },
  };
});

import OrderDetailPage from '@/views/OrderDetailPage.vue';
import SharedOrdersPage from '@/views/SharedOrdersPage.vue';
import SharedOrderDetailPage from '@/views/SharedOrderDetailPage.vue';
import { buildRouter } from '@/router';

const bob: User = { id: 'u-bob', email: 'bob@example.com', phone: null, displayName: 'Bob' };
const cat: User = { id: 'u-cat', email: 'cat@example.com', phone: null, displayName: 'Cat' };
const pending: User = { id: 'u-pen', email: 'pen@example.com', phone: null, displayName: 'Pen' };

const sharedOrder = (shareId: string, restaurantName: string, by: User, title: string) => ({
  shareId,
  sharedAt: '',
  restaurantName,
  sharedBy: by,
  order: { id: `o-${shareId}`, restaurantId: 'rx', title, items: [{ name: 'Item', quantity: 2, customizations: [] }], notes: 'Note', isDefault: false, createdAt: '', updatedAt: '' },
});

type Wrapper = ReturnType<typeof mount>;
const texts = (w: Wrapper, id: string) => w.findAll(`[data-testid="${id}"]`).map((n) => n.text());

async function mountWithRouter(component: object, path: string, props: Record<string, string> = {}) {
  const router = buildRouter(createMemoryHistory());
  await router.push(path);
  const wrapper = mount(component, { props, global: { plugins: [router] } });
  await flushPromises();
  return wrapper;
}

beforeEach(() => {
  state.friendships = [
    { id: 'f1', status: 'accepted', direction: 'outgoing', user: bob },
    { id: 'f2', status: 'accepted', direction: 'incoming', user: cat },
    { id: 'f3', status: 'pending', direction: 'outgoing', user: pending },
  ];
  state.shares = [];
  state.shared = [];
  state.calls = [];
  state.failShared = false;
  Object.defineProperty(navigator, 'onLine', { configurable: true, value: true });
});

describe('sharing an order', () => {
  const openPicker = async () => {
    const wrapper = await mountWithRouter(OrderDetailPage, '/tabs/restaurants/r1/orders/o1', { id: 'r1', orderId: 'o1' });
    await wrapper.find('[data-testid="share-order"]').trigger('click');
    await flushPromises();
    return wrapper;
  };

  it('lists only accepted friends and shares with several at once', async () => {
    const wrapper = await openPicker();
    expect(texts(wrapper, 'picker-friend')).toEqual(['Bob', 'Cat']);
    const vm = wrapper.vm as unknown as { toggle: (id: string) => void; confirmShare: () => Promise<void> };
    vm.toggle('u-bob');
    vm.toggle('u-cat');
    await vm.confirmShare();
    await flushPromises();
    expect(state.calls).toContainEqual(['POST', '/api/orders/o1/shares', { userIds: ['u-bob', 'u-cat'] }]);
    const sharedWith = texts(wrapper, 'shared-with-item');
    expect(sharedWith).toHaveLength(2);
    expect(sharedWith[0]).toContain('Bob');
    expect(sharedWith[1]).toContain('Cat');
    expect((wrapper.vm as unknown as { picking: boolean }).picking).toBe(false);
    const toast = (wrapper.vm as unknown as { toast: { open: boolean; message: string; color: string } }).toast;
    expect(toast).toMatchObject({ open: true, message: 'Shared with 2 Friends', color: 'success' });
    expect(wrapper.find('[data-testid="share-toast"]').exists()).toBe(true);
  });

  it('shows a single modal header after cancelling and reopening', async () => {
    const wrapper = await openPicker();
    await wrapper.find('[data-testid="cancel-share"]').trigger('click');
    await flushPromises();
    expect((wrapper.vm as unknown as { picking: boolean }).picking).toBe(false);
    await wrapper.find('[data-testid="share-order"]').trigger('click');
    await flushPromises();
    const modal = wrapper.find('[data-testid="share-modal"]');
    expect(modal.findAll('ion-header')).toHaveLength(1);
    expect(modal.findAll('ion-title')).toHaveLength(1);
    expect(modal.findAll('[data-testid="friend-picker"]')).toHaveLength(1);
  });

  it('marks already-shared friends and does not let them be selected again', async () => {
    state.shares = [{ id: 's-u-bob', sharedAt: '', user: bob }];
    const wrapper = await openPicker();
    expect(texts(wrapper, 'picker-already-shared')).toEqual(['Shared']);
    const vm = wrapper.vm as unknown as { toggle: (id: string) => void; selected: string[] };
    vm.toggle('u-bob');
    expect(vm.selected).toEqual([]);
  });

  it('blocks sharing with a message while offline', async () => {
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: false });
    const wrapper = await openPicker();
    expect((wrapper.vm as unknown as { picking: boolean }).picking).toBe(false);
    const toast = (wrapper.vm as unknown as { toast: { open: boolean; message: string; color: string } }).toast;
    expect(toast.open).toBe(true);
    expect(toast.color).toBe('warning');
    expect(toast.message).toContain('connection');
    expect(state.calls.some(([m, p]) => m === 'POST' && p.includes('/shares'))).toBe(false);
  });

  it('shows who the order is shared with and unshares from a friend', async () => {
    state.shares = [{ id: 's-u-bob', sharedAt: '', user: bob }, { id: 's-u-cat', sharedAt: '', user: cat }];
    const wrapper = await mountWithRouter(OrderDetailPage, '/tabs/restaurants/r1/orders/o1', { id: 'r1', orderId: 'o1' });
    expect(texts(wrapper, 'shared-with-item')).toHaveLength(2);
    expect((wrapper.vm as unknown as { sharedOpen: boolean }).sharedOpen).toBe(false);
    expect(wrapper.find('[data-testid="shared-with-header"]').text()).toContain('Shared with');
    expect(wrapper.find('[data-testid="shared-count"]').text()).toBe('2');
    await wrapper.find('[data-testid="unshare"]').trigger('click');
    await flushPromises();
    expect(state.calls).toContainEqual(['DELETE', '/api/shares/s-u-bob', undefined]);
    expect(texts(wrapper, 'shared-with-item')).toHaveLength(1);
    expect(texts(wrapper, 'shared-with-item')[0]).toContain('Cat');
    expect(wrapper.find('[data-testid="shared-count"]').text()).toBe('1');
    const toast = (wrapper.vm as unknown as { toast: { open: boolean; message: string; color: string } }).toast;
    expect(toast).toMatchObject({ open: true, color: 'success' });
    expect(toast.message).toContain('Bob');
  });
});

describe('Shared tab', () => {
  it('groups shared orders by restaurant or by person', async () => {
    state.shared = [
      sharedOrder('s1', 'Taco Spot', bob, 'Bob tacos'),
      sharedOrder('s2', 'Pizza Place', bob, 'Bob pizza'),
      sharedOrder('s3', 'Taco Spot', cat, 'Cat tacos'),
    ];
    const wrapper = await mountWithRouter(SharedOrdersPage, '/tabs/shared');
    expect(texts(wrapper, 'shared-group-label')).toEqual(['Pizza Place', 'Taco Spot']);
    (wrapper.vm as unknown as { grouping: string }).grouping = 'person';
    await flushPromises();
    expect(texts(wrapper, 'shared-group-label')).toEqual(['Bob', 'Cat']);
    expect(texts(wrapper, 'shared-item')).toHaveLength(3);
  });

  it('shows an empty state when nothing is shared', async () => {
    const wrapper = await mountWithRouter(SharedOrdersPage, '/tabs/shared');
    expect(wrapper.find('[data-testid="no-shared"]').exists()).toBe(true);
  });

  it('pull-to-refresh reloads, and a failed or offline refresh keeps the list', async () => {
    const wrapper = await mountWithRouter(SharedOrdersPage, '/tabs/shared');
    state.shared = [sharedOrder('s1', 'Taco Spot', bob, 'Bob tacos')];
    const complete = vi.fn();
    await (wrapper.vm as unknown as { onRefresh: (e: unknown) => Promise<void> }).onRefresh({ target: { complete } });
    await flushPromises();
    expect(complete).toHaveBeenCalled();
    expect(texts(wrapper, 'shared-item')).toHaveLength(1);

    const load = (wrapper.vm as unknown as { load: () => Promise<void> }).load;
    state.failShared = true;
    await load();
    await flushPromises();
    expect(texts(wrapper, 'shared-item')).toHaveLength(1);
    expect(wrapper.find('[data-testid="refresh-message"]').text()).toContain('Server down');
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: false });
    await load();
    await flushPromises();
    expect(texts(wrapper, 'shared-item')).toHaveLength(1);
    expect(wrapper.find('[data-testid="refresh-message"]').text()).toContain('offline');
  });

  it('reloads on entry so owner edits and deletions show up', async () => {
    state.shared = [sharedOrder('s1', 'Taco Spot', bob, 'Old')];
    const wrapper = await mountWithRouter(SharedOrdersPage, '/tabs/shared');
    expect(texts(wrapper, 'shared-item')[0]).toContain('Old');
    state.shared = [sharedOrder('s1', 'Taco Spot', bob, 'New')];
    await (wrapper.vm as unknown as { load: () => Promise<void> }).load();
    await flushPromises();
    expect(texts(wrapper, 'shared-item')[0]).toContain('New');
    state.shared = [];
    await (wrapper.vm as unknown as { load: () => Promise<void> }).load();
    await flushPromises();
    expect(texts(wrapper, 'shared-item')).toHaveLength(0);
  });
});

describe('shared order detail', () => {
  it('is read-only and can be saved to my orders', async () => {
    state.shared = [sharedOrder('s1', 'Taco Spot', bob, 'Bob tacos')];
    const wrapper = await mountWithRouter(SharedOrderDetailPage, '/tabs/shared/s1', { shareId: 's1' });
    expect(wrapper.find('[data-testid="detail-name"]').text()).toBe('Bob tacos');
    expect(wrapper.find('[data-testid="detail-quantity"]').text()).toBe('2×');
    expect(wrapper.find('[data-testid="shared-meta"]').text()).toContain('Bob');
    for (const id of ['edit-order', 'delete-order', 'make-default', 'share-order']) {
      expect(wrapper.find(`[data-testid="${id}"]`).exists()).toBe(false);
    }
    await wrapper.find('[data-testid="save-copy"]').trigger('click');
    await flushPromises();
    expect(state.calls).toContainEqual(['POST', '/api/shared/s1/save', undefined]);
    const toast = (wrapper.vm as unknown as { toast: { open: boolean; message: string; color: string } }).toast;
    expect(toast).toMatchObject({ open: true, color: 'success' });
    expect(toast.message).toContain('Taco Spot');
  });

  it('tells the user when the order is no longer shared', async () => {
    const wrapper = await mountWithRouter(SharedOrderDetailPage, '/tabs/shared/gone', { shareId: 'gone' });
    expect(wrapper.find('[data-testid="shared-error"]').text()).toContain('no longer shared');
  });
});
