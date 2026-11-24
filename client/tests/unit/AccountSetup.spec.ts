import { flushPromises, mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it } from 'vitest';
import { vi } from 'vitest';
import { createMemoryHistory } from 'vue-router';

const state = vi.hoisted(() => ({
  token: null as string | null,
  verified: false,
  offline: false,
  calls: [] as [string, string, unknown][],
  verifyError: null as string | null,
  resendError: null as string | null,
  resetError: null as string | null,
}));

vi.mock('@/lib/api', () => {
  class ApiError extends Error {
    constructor(public status: number, message: string) {
      super(message);
    }
  }
  return {
    ApiError,
    getToken: () => state.token,
    setToken: (t: string | null) => {
      state.token = t;
    },
    api: async (method: string, path: string, body?: unknown) => {
      state.calls.push([method, path, body]);
      if (state.offline) throw new TypeError('Failed to fetch');
      const account = () => ({
        id: 'u1',
        email: 'me@example.com',
        emailVerified: state.verified,
        verificationExpiresAt: state.verified ? null : '2030-01-01T12:15:00.000Z',
      });
      if (path === '/api/auth/me') {
        if (!state.token) throw new ApiError(401, 'Not signed in');
        return account();
      }
      if (path === '/api/auth/signin') {
        state.token = 't';
        return { token: 't', user: account() };
      }
      if (path === '/api/auth/verify') {
        if (state.verifyError) throw new ApiError(400, state.verifyError);
        state.verified = true;
        return account();
      }
      if (path === '/api/auth/resend-verification') {
        if (state.resendError) throw new ApiError(429, state.resendError);
        return account();
      }
      if (path === '/api/auth/forgot-password') {
        return { message: 'If an account exists for this email, a reset link has been sent' };
      }
      if (path === '/api/auth/reset-password') {
        if (state.resetError) throw new ApiError(400, state.resetError);
        return undefined;
      }
      if (path === '/api/auth/signout') return undefined;
      if (path === '/api/restaurants') return [];
      return undefined;
    },
  };
});

import { buildRouter } from '@/router';
import LoginPage from '@/views/LoginPage.vue';
import VerifyEmailPage from '@/views/VerifyEmailPage.vue';
import ProfilePage from '@/views/ProfilePage.vue';
import ForgotPasswordPage from '@/views/ForgotPasswordPage.vue';
import ResetPasswordPage from '@/views/ResetPasswordPage.vue';

beforeEach(() => {
  state.token = null;
  state.verified = false;
  state.offline = false;
  state.calls = [];
  state.verifyError = null;
  state.resendError = null;
  state.resetError = null;
});

describe('email verification', () => {
  it('keeps an unverified user on the verification screen', async () => {
    state.token = 't';
    const router = buildRouter(createMemoryHistory());
    for (const path of ['/', '/tabs/restaurants', '/tabs/profile', '/login']) {
      await router.push(path);
      expect(router.currentRoute.value.path).toBe('/verify-email');
    }
  });

  it('sends a verified user away from the verification screen', async () => {
    state.token = 't';
    state.verified = true;
    const router = buildRouter(createMemoryHistory());
    await router.push('/verify-email');
    expect(router.currentRoute.value.path).toBe('/tabs/restaurants');
  });

  it('directs an unverified user to verification after sign-in', async () => {
    const router = buildRouter(createMemoryHistory());
    await router.push('/login');
    const wrapper = mount(LoginPage, { global: { plugins: [router] } });
    Object.assign(wrapper.vm as unknown as Record<string, string>, { email: 'me@example.com', password: 'secret123' });
    await wrapper.find('[data-testid="auth-form"]').trigger('submit');
    await flushPromises();
    expect(router.currentRoute.value.path).toBe('/verify-email');
  });

  it('shows the expiry, verifies a valid code and lands on the restaurant list', async () => {
    state.token = 't';
    const router = buildRouter(createMemoryHistory());
    await router.push('/verify-email');
    const wrapper = mount(VerifyEmailPage, { global: { plugins: [router] } });
    await flushPromises();
    expect(wrapper.find('[data-testid="verify-expiry"]').text()).toContain('15 minutes');
    Object.assign(wrapper.vm as unknown as Record<string, string>, { code: '123456' });
    await wrapper.find('[data-testid="verify-form"]').trigger('submit');
    await flushPromises();
    expect(state.calls).toContainEqual(['POST', '/api/auth/verify', { code: '123456' }]);
    expect(router.currentRoute.value.path).toBe('/tabs/restaurants');
  });

  it('shows the server message for an expired code and for resend limits', async () => {
    state.token = 't';
    state.verifyError = 'Verification code has expired; request a new one';
    state.resendError = 'Please wait a minute before requesting another code';
    const router = buildRouter(createMemoryHistory());
    await router.push('/verify-email');
    const wrapper = mount(VerifyEmailPage, { global: { plugins: [router] } });
    Object.assign(wrapper.vm as unknown as Record<string, string>, { code: '000000' });
    await wrapper.find('[data-testid="verify-form"]').trigger('submit');
    await flushPromises();
    expect(wrapper.find('[data-testid="verify-error"]').text()).toContain('expired');
    await wrapper.find('[data-testid="verify-resend"]').trigger('click');
    await flushPromises();
    expect(wrapper.find('[data-testid="verify-error"]').text()).toContain('wait a minute');
    expect(router.currentRoute.value.path).toBe('/verify-email');
  });
});

describe('sign out', () => {
  it('revokes the session, returns to sign-in and blocks protected routes', async () => {
    state.token = 't';
    state.verified = true;
    const router = buildRouter(createMemoryHistory());
    await router.push('/tabs/profile');
    const wrapper = mount(ProfilePage, { global: { plugins: [router] } });
    await wrapper.find('[data-testid="sign-out"]').trigger('click');
    await flushPromises();
    expect(state.calls).toContainEqual(['POST', '/api/auth/signout', undefined]);
    expect(state.token).toBeNull();
    expect(router.currentRoute.value.path).toBe('/login');
    await router.push('/tabs/restaurants');
    expect(router.currentRoute.value.path).toBe('/login');
  });

  it('clears the local session when offline', async () => {
    state.token = 't';
    state.verified = true;
    const router = buildRouter(createMemoryHistory());
    await router.push('/tabs/profile');
    const wrapper = mount(ProfilePage, { global: { plugins: [router] } });
    state.offline = true;
    await wrapper.find('[data-testid="sign-out"]').trigger('click');
    await flushPromises();
    expect(state.token).toBeNull();
    expect(router.currentRoute.value.path).toBe('/login');
  });
});

describe('forgot password', () => {
  it('shows the same neutral message after requesting a link', async () => {
    const router = buildRouter(createMemoryHistory());
    await router.push('/forgot-password');
    expect(router.currentRoute.value.path).toBe('/forgot-password');
    const wrapper = mount(ForgotPasswordPage, { global: { plugins: [router] } });
    Object.assign(wrapper.vm as unknown as Record<string, string>, { email: 'nobody@example.com' });
    await wrapper.find('[data-testid="forgot-form"]').trigger('submit');
    await flushPromises();
    expect(wrapper.find('[data-testid="forgot-message"]').text()).toContain('If an account exists');
  });

  it('sets a new password from the reset link', async () => {
    const router = buildRouter(createMemoryHistory());
    await router.push('/reset-password?token=abc');
    const wrapper = mount(ResetPasswordPage, { global: { plugins: [router] } });
    Object.assign(wrapper.vm as unknown as Record<string, string>, { password: 'newpass456' });
    await wrapper.find('[data-testid="reset-form"]').trigger('submit');
    await flushPromises();
    expect(state.calls).toContainEqual(['POST', '/api/auth/reset-password', { token: 'abc', password: 'newpass456' }]);
    expect(wrapper.find('[data-testid="reset-done"]').exists()).toBe(true);
  });

  it('shows an error for an expired or used link and a weak password', async () => {
    state.resetError = 'This reset link is invalid or has expired';
    const router = buildRouter(createMemoryHistory());
    await router.push('/reset-password?token=old');
    const wrapper = mount(ResetPasswordPage, { global: { plugins: [router] } });
    Object.assign(wrapper.vm as unknown as Record<string, string>, { password: 'weak' });
    await wrapper.find('[data-testid="reset-form"]').trigger('submit');
    await flushPromises();
    expect(wrapper.find('[data-testid="reset-error"]').text()).toContain('letters and numbers');
    Object.assign(wrapper.vm as unknown as Record<string, string>, { password: 'newpass456' });
    await wrapper.find('[data-testid="reset-form"]').trigger('submit');
    await flushPromises();
    expect(wrapper.find('[data-testid="reset-error"]').text()).toContain('expired');
  });
});
