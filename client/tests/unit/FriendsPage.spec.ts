import { flushPromises, mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  friendships: [] as { id: string; status: string; direction: string; user: { id: string; email: string; phone: string | null; displayName: string } }[],
  users: [] as { id: string; email: string; phone: string | null; displayName: string }[],
  calls: [] as [string, string, unknown?][],
  failFriends: false,
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
      if (method === 'GET' && path === '/api/friends') {
        if (state.failFriends) throw new ApiError(500, 'Server down');
        return state.friendships.map((f) => ({ ...f }));
      }
      if (method === 'GET' && path.startsWith('/api/users')) {
        const q = decodeURIComponent(path.split('q=')[1] ?? '').toLowerCase();
        return state.users.filter((u) => u.email.toLowerCase() === q || u.phone === q);
      }
      if (method === 'POST' && path === '/api/friends') {
        const u = state.users.find((x) => x.id === (body as { userId: string }).userId)!;
        state.friendships.push({ id: 'f-new', status: 'pending', direction: 'outgoing', user: u });
        return { id: 'f-new', status: 'pending' };
      }
      const accept = path.match(/^\/api\/friends\/([^/]+)\/accept$/);
      if (accept) {
        state.friendships.find((f) => f.id === accept[1])!.status = 'accepted';
        return { id: accept[1], status: 'accepted' };
      }
      const del = path.match(/^\/api\/friends\/([^/]+)$/);
      if (method === 'DELETE' && del) {
        state.friendships = state.friendships.filter((f) => f.id !== del[1]);
        return undefined;
      }
      return undefined;
    },
  };
});

import FriendsPage from '@/views/FriendsPage.vue';
import { routes } from '@/router';

const carol = { id: 'u-carol', email: 'carol@example.com', phone: '+1555', displayName: 'Carol' };
const dave = { id: 'u-dave', email: 'dave@example.com', phone: null, displayName: 'Dave' };

async function mountPage() {
  const wrapper = mount(FriendsPage);
  await flushPromises();
  return wrapper;
}

async function search(wrapper: Awaited<ReturnType<typeof mountPage>>, q: string) {
  (wrapper.vm as unknown as { query: string }).query = q;
  await (wrapper.vm as unknown as { runSearch: () => Promise<void> }).runSearch();
  await flushPromises();
}

const texts = (w: Awaited<ReturnType<typeof mountPage>>, id: string) => w.findAll(`[data-testid="${id}"]`).map((n) => n.text());

beforeEach(() => {
  state.friendships = [];
  state.users = [carol, dave];
  state.calls = [];
  state.failFriends = false;
  Object.defineProperty(navigator, 'onLine', { configurable: true, value: true });
});

describe('FriendsPage', () => {
  it('is a primary tab', () => {
    const tabs = routes.find((r) => r.path === '/tabs/');
    expect(tabs?.children?.some((c) => c.path === 'friends')).toBe(true);
  });

  it('finds a user by exact email or phone but not by name', async () => {
    const wrapper = await mountPage();
    await search(wrapper, 'carol@example.com');
    expect(texts(wrapper, 'search-result')[0]).toContain('Carol');
    await search(wrapper, '+1555');
    expect(texts(wrapper, 'search-result')).toHaveLength(1);
    await search(wrapper, 'Carol');
    expect(texts(wrapper, 'search-result')).toHaveLength(0);
    expect(wrapper.find('[data-testid="no-results"]').exists()).toBe(true);
  });

  it('sends a request and shows it as sent', async () => {
    const wrapper = await mountPage();
    await search(wrapper, 'carol@example.com');
    await wrapper.find('[data-testid="send-request"]').trigger('click');
    await flushPromises();
    expect(state.calls).toContainEqual(['POST', '/api/friends', { userId: 'u-carol' }]);
    expect(texts(wrapper, 'sent-item')[0]).toContain('Carol');
    expect(texts(wrapper, 'search-status')).toEqual(['Request sent']);
  });

  it('shows received requests and accepting makes them a friend', async () => {
    state.friendships = [{ id: 'f1', status: 'pending', direction: 'incoming', user: dave }];
    const wrapper = await mountPage();
    expect(texts(wrapper, 'received-item')[0]).toContain('Dave');
    await wrapper.find('[data-testid="accept"]').trigger('click');
    await flushPromises();
    expect(texts(wrapper, 'received-item')).toHaveLength(0);
    expect(texts(wrapper, 'friend-item')[0]).toContain('Dave');
  });

  it('declines silently, cancels sent requests, and removes friends', async () => {
    state.friendships = [
      { id: 'f1', status: 'pending', direction: 'incoming', user: dave },
      { id: 'f2', status: 'pending', direction: 'outgoing', user: carol },
      { id: 'f3', status: 'accepted', direction: 'outgoing', user: { ...dave, id: 'u-eve', displayName: 'Eve' } },
    ];
    const wrapper = await mountPage();
    await wrapper.find('[data-testid="decline"]').trigger('click');
    await flushPromises();
    await wrapper.find('[data-testid="cancel"]').trigger('click');
    await flushPromises();
    await wrapper.find('[data-testid="remove-friend"]').trigger('click');
    await flushPromises();
    expect(state.calls.filter(([m]) => m === 'DELETE').map(([, p]) => p)).toEqual(['/api/friends/f1', '/api/friends/f2', '/api/friends/f3']);
    expect(wrapper.find('[data-testid="no-friends"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="action-message"]').exists()).toBe(false);
  });

  it('pull-to-refresh reloads the list', async () => {
    const wrapper = await mountPage();
    state.friendships = [{ id: 'f1', status: 'accepted', direction: 'incoming', user: dave }];
    const complete = vi.fn();
    await (wrapper.vm as unknown as { onRefresh: (e: unknown) => Promise<void> }).onRefresh({ target: { complete } });
    await flushPromises();
    expect(complete).toHaveBeenCalled();
    expect(texts(wrapper, 'friend-item')[0]).toContain('Dave');
  });

  it('keeps the list and shows a message when a refresh fails or is offline', async () => {
    state.friendships = [{ id: 'f1', status: 'accepted', direction: 'incoming', user: dave }];
    const wrapper = await mountPage();
    const load = (wrapper.vm as unknown as { load: () => Promise<void> }).load;
    state.failFriends = true;
    await load();
    await flushPromises();
    expect(texts(wrapper, 'friend-item')).toHaveLength(1);
    expect(wrapper.find('[data-testid="refresh-message"]').text()).toContain('Server down');
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: false });
    await load();
    await flushPromises();
    expect(texts(wrapper, 'friend-item')).toHaveLength(1);
    expect(wrapper.find('[data-testid="refresh-message"]').text()).toContain('offline');
  });
});
