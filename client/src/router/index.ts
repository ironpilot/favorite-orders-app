import { createRouter, createWebHistory } from '@ionic/vue-router';
import type { RouteRecordRaw, Router, RouterHistory } from 'vue-router';
import TabsPage from '@/views/TabsPage.vue';
import { getCurrentAccount, isVerified } from '@/services/auth';
import { checkSession } from '@/services/session';
import { rememberPendingLink, takePendingLink } from '@/services/sharing';

export const routes: RouteRecordRaw[] = [
  { path: '/', redirect: '/tabs/restaurants' },
  { path: '/login', component: () => import('@/views/LoginPage.vue'), meta: { guestOnly: true } },
  { path: '/verify-email', component: () => import('@/views/VerifyEmailPage.vue'), meta: { verification: true } },
  { path: '/forgot-password', component: () => import('@/views/ForgotPasswordPage.vue'), meta: { public: true } },
  { path: '/reset-password', component: () => import('@/views/ResetPasswordPage.vue'), meta: { public: true } },
  // Share links; a signed-out opener signs in or signs up first and the link then resumes.
  { path: '/link/:token', component: () => import('@/views/OpenLinkPage.vue'), props: true, meta: { shareLink: true } },
  {
    path: '/tabs/',
    component: TabsPage,
    meta: { requiresAuth: true },
    children: [
      { path: '', redirect: '/tabs/restaurants' },
      { path: 'restaurants', component: () => import('@/views/RestaurantListPage.vue') },
      { path: 'restaurants/new-order', component: () => import('@/views/AddOrderPage.vue') },
      { path: 'restaurants/:id', component: () => import('@/views/RestaurantOrdersPage.vue'), props: true },
      { path: 'restaurants/:id/orders/:orderId', component: () => import('@/views/OrderDetailPage.vue'), props: true },
      { path: 'restaurants/:id/orders/:orderId/edit', component: () => import('@/views/AddOrderPage.vue') },
      { path: 'shared', component: () => import('@/views/SharedOrdersPage.vue') },
      { path: 'shared/:shareId', component: () => import('@/views/SharedOrderDetailPage.vue'), props: true },
      { path: 'profile', component: () => import('@/views/ProfilePage.vue') },
      { path: 'friends', component: () => import('@/views/FriendsPage.vue') },
    ],
  },
  // Unknown paths go to the app root, which the guard sends to sign-in when signed out.
  { path: '/:pathMatch(.*)*', redirect: '/' },
];

export function buildRouter(history: RouterHistory = createWebHistory(import.meta.env.BASE_URL)): Router {
  const router = createRouter({ history, routes });

  // Every page needs a verified account except sign-in / sign-up and the password reset screens.
  // Signed-in users who have not verified their email can only reach the verification screen.
  router.beforeEach(async (to) => {
    if (to.matched.some((r) => r.meta.public)) return true;
    const guestOnly = to.matched.some((r) => r.meta.guestOnly);
    const verification = to.matched.some((r) => r.meta.verification);
    // The startup expiry check: a stored session is restored (refreshed silently if needed) before any
    // route renders; with both tokens expired the session is cleared and login is shown.
    const session = await checkSession();
    const account = session === 'unauthenticated' ? null : await getCurrentAccount();
    const shareLink = to.matched.some((r) => r.meta.shareLink);
    if (!account) {
      if (shareLink) rememberPendingLink(String(to.params.token));
      return guestOnly ? true : '/login';
    }
    if (!isVerified(account)) {
      if (shareLink) rememberPendingLink(String(to.params.token));
      return verification ? true : '/verify-email';
    }
    if (!shareLink) {
      const pending = takePendingLink();
      if (pending) return `/link/${encodeURIComponent(pending)}`;
    }
    if (guestOnly || verification) return '/tabs/restaurants';
    return true;
  });

  return router;
}

const router = buildRouter();

export default router;
