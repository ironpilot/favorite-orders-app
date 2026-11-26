import { flushPromises, mount } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createMemoryHistory } from 'vue-router';
import { api, getRefreshToken, getToken } from '@/lib/api';
import { getAccessExpiry, setTokenExpiries } from '@/lib/tokens';
import { authState, checkSession, setOnline } from '@/services/session';
import { revalidate, startConnectivity } from '@/services/connectivity';
import { buildRouter } from '@/router';
import OfflineBanner from '@/components/OfflineBanner.vue';
import LoginPage from '@/views/LoginPage.vue';

const HOUR = 3_600_000;
const iso = (offset: number) => new Date(Date.now() + offset).toISOString();
const account = { id: 'u1', email: 'me@example.com', displayName: 'Me', emailVerified: true };

let refreshCalls = 0;
let refreshStatus = 200;
let networkDown = false;
let validToken = 'access-1';
const json = (status: number, body?: unknown) =>
  new Response(body === undefined ? '' : JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

function store(token: string, accessOffset: number, refreshOffset: number) {
  localStorage.setItem('favorite-order.token', token);
  localStorage.setItem('favorite-order.refresh-token', 'refresh-1');
  setTokenExpiries(iso(accessOffset), iso(refreshOffset));
}

beforeEach(() => {
  localStorage.clear();
  refreshCalls = 0;
  refreshStatus = 200;
  networkDown = false;
  validToken = 'access-1';
  setOnline(true);
  vi.stubGlobal('fetch', vi.fn(async (url: string, init: RequestInit) => {
    if (networkDown) throw new TypeError('Failed to fetch');
    const path = new URL(url).pathname;
    const auth = (init.headers as Record<string, string>).Authorization;
    if (path === '/api/auth/refresh') {
      refreshCalls++;
      await new Promise((r) => setTimeout(r, 5));
      if (refreshStatus !== 200) return json(refreshStatus, { error: 'Session expired; please sign in again' });
      validToken = `access-${refreshCalls + 1}`;
      return json(200, {
        token: validToken, accessExpiresAt: iso(HOUR), refreshToken: `refresh-${refreshCalls + 1}`, refreshExpiresAt: iso(14 * 24 * HOUR), user: account,
      });
    }
    if (auth !== `Bearer ${validToken}`) return json(401, { error: 'Not signed in' });
    if (path === '/api/auth/me') return json(200, account);
    return json(200, []);
  }));
});

afterEach(() => vi.unstubAllGlobals());

describe('session restore and refresh', () => {
  it('restores a valid session on reload without refreshing', async () => {
    store('access-1', HOUR / 2, 14 * 24 * HOUR);
    const router = buildRouter(createMemoryHistory());
    await router.push('/tabs/restaurants');
    expect(router.currentRoute.value.path).toBe('/tabs/restaurants');
    expect(refreshCalls).toBe(0);
    expect(authState.value).toBe('authenticated');
  });

  it('refreshes silently when the access token has expired and stores the new tokens', async () => {
    store('access-old', -1000, 14 * 24 * HOUR);
    const router = buildRouter(createMemoryHistory());
    await router.push('/tabs/restaurants');
    expect(router.currentRoute.value.path).toBe('/tabs/restaurants');
    expect(refreshCalls).toBe(1);
    expect(getToken()).toBe('access-2');
    expect(getRefreshToken()).toBe('refresh-2');
    expect(getAccessExpiry()).toBeGreaterThan(Date.now());
  });

  it('shows login and clears the session when both tokens have expired', async () => {
    store('access-1', -1000, -1000);
    const router = buildRouter(createMemoryHistory());
    await router.push('/tabs/restaurants');
    expect(router.currentRoute.value.path).toBe('/login');
    expect(getToken()).toBeNull();
    expect(refreshCalls).toBe(0);
  });

  it('shows login when the refresh is rejected', async () => {
    store('access-old', -1000, 14 * 24 * HOUR);
    refreshStatus = 401;
    const router = buildRouter(createMemoryHistory());
    await router.push('/tabs/restaurants');
    expect(router.currentRoute.value.path).toBe('/login');
    expect(getRefreshToken()).toBeNull();
  });

  it('sends unauthenticated users to login from any route', async () => {
    const router = buildRouter(createMemoryHistory());
    for (const path of ['/', '/tabs/restaurants', '/tabs/shared', '/tabs/profile']) {
      await router.push(path);
      expect(router.currentRoute.value.path).toBe('/login');
    }
  });

  it('shares one refresh call between concurrent 401s and retries each request once', async () => {
    store('access-stale', HOUR, 14 * 24 * HOUR);
    const results = await Promise.all([
      api('GET', '/api/restaurants'), api('GET', '/api/shared'), api('GET', '/api/friends'),
    ]);
    expect(results).toEqual([[], [], []]);
    expect(refreshCalls).toBe(1);
    expect(getToken()).toBe('access-2');
  });
});

describe('connectivity, offline banner and re-validation', () => {
  it('shows the banner when offline and keeps the cached account usable', async () => {
    store('access-1', HOUR, 14 * 24 * HOUR);
    const router = buildRouter(createMemoryHistory());
    await startConnectivity(router);
    setOnline(true);
    await router.push('/tabs/restaurants');
    const banner = mount(OfflineBanner);
    expect(banner.find('[data-testid="offline-banner"]').exists()).toBe(false);
    networkDown = true;
    await expect(api('GET', '/api/restaurants')).rejects.toThrow();
    await flushPromises();
    expect(authState.value).toBe('offline');
    expect(banner.text()).toContain('Operating offline');
    await router.push('/tabs/profile');
    expect(router.currentRoute.value.path).toBe('/tabs/profile');
  });

  it('defers a refresh while offline without signing out, then refreshes on reconnect', async () => {
    store('access-old', -1000, 14 * 24 * HOUR);
    setOnline(false);
    expect(await checkSession()).toBe('offline');
    expect(refreshCalls).toBe(0);
    expect(getRefreshToken()).toBe('refresh-1');
    setOnline(true);
    const router = buildRouter(createMemoryHistory());
    await revalidate(router);
    expect(authState.value).toBe('authenticated');
    expect(refreshCalls).toBe(1);
  });

  it('keeps the session when a refresh fails because the network is down', async () => {
    store('access-old', -1000, 14 * 24 * HOUR);
    networkDown = true;
    expect(await checkSession()).toBe('offline');
    expect(getRefreshToken()).toBe('refresh-1');
  });

  it('hides the banner on reconnect with valid tokens', async () => {
    store('access-1', HOUR, 14 * 24 * HOUR);
    setOnline(false);
    expect(await checkSession()).toBe('offline');
    const router = buildRouter(createMemoryHistory());
    setOnline(true);
    await revalidate(router);
    expect(authState.value).toBe('authenticated');
  });

  it('shows login on reconnect when both tokens have expired', async () => {
    store('access-1', HOUR, 14 * 24 * HOUR);
    const router = buildRouter(createMemoryHistory());
    await router.push('/tabs/restaurants');
    setOnline(false);
    setTokenExpiries(iso(-1000), iso(-1000));
    setOnline(true);
    await revalidate(router);
    await flushPromises();
    expect(router.currentRoute.value.path).toBe('/login');
  });

  it('a failed request marks the app offline and a successful one brings it back', async () => {
    store('access-1', HOUR, 14 * 24 * HOUR);
    const router = buildRouter(createMemoryHistory());
    await startConnectivity(router);
    setOnline(true);
    await checkSession();
    expect(authState.value).toBe('authenticated');
    networkDown = true;
    await expect(api('GET', '/api/restaurants')).rejects.toThrow();
    expect(authState.value).toBe('offline');
    networkDown = false;
    await api('GET', '/api/restaurants');
    await flushPromises();
    expect(authState.value).toBe('authenticated');
  });

  it('shows login with a connection-needed message to an offline user with no session', async () => {
    setOnline(false);
    const router = buildRouter(createMemoryHistory());
    await router.push('/tabs/restaurants');
    expect(router.currentRoute.value.path).toBe('/login');
    const wrapper = mount(LoginPage, { global: { plugins: [router] } });
    expect(wrapper.find('[data-testid="auth-offline"]').text()).toContain('connection is needed');
    expect((wrapper.find('[data-testid="auth-submit"]').element as HTMLButtonElement).disabled).toBe(true);
  });
});
