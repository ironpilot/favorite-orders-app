import type { Router } from 'vue-router';
import { Network } from '@capacitor/network';
import { App } from '@capacitor/app';
import { setApiHooks } from '@/lib/api';
import { authState, checkSession, expireSession, isOnline, onSessionExpired, setOnline } from '@/services/session';

// Routes a signed-out user may stay on.
const SIGNED_OUT_OK = (router: Router) => router.currentRoute.value.matched
  .some((r) => r.meta.public || r.meta.guestOnly);

async function showLogin(router: Router): Promise<void> {
  if (!SIGNED_OUT_OK(router)) await router.replace('/login');
}

/**
 * Re-validates the session the same way as startup: refresh if needed, show login if both tokens
 * have expired, otherwise carry on (which hides the offline banner when back online).
 */
export async function revalidate(router: Router): Promise<void> {
  const before = authState.value;
  const after = await checkSession();
  if (after === 'unauthenticated' && before !== 'unauthenticated') await showLogin(router);
}

async function applyStatus(router: Router, connected: boolean): Promise<void> {
  const wasOnline = isOnline.value;
  setOnline(connected);
  if (connected && !wasOnline) await revalidate(router);
}

/**
 * Tracks connectivity with @capacitor/network (navigator.onLine and online/offline events on the web),
 * confirmed by requests: a network-level failure marks the app offline, a response marks it online.
 * Reconnect and app resume run the session expiry check.
 */
export async function startConnectivity(router: Router): Promise<void> {
  setApiHooks({
    onUnreachable: () => setOnline(false),
    onReachable: () => {
      if (!isOnline.value) void applyStatus(router, true);
    },
    onSessionExpired: () => expireSession(),
  });
  onSessionExpired(() => void showLogin(router));

  try {
    const status = await Network.getStatus();
    await applyStatus(router, status.connected);
    await Network.addListener('networkStatusChange', (s) => void applyStatus(router, s.connected));
  } catch {
    // Plugin unavailable: rely on request failures only.
  }

  try {
    await App.addListener('appStateChange', ({ isActive }) => {
      if (isActive) void revalidate(router);
    });
  } catch {
    // Not supported on this platform.
  }
}
