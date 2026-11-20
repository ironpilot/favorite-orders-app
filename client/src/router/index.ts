import { createRouter, createWebHistory } from '@ionic/vue-router';
import type { RouteRecordRaw, Router, RouterHistory } from 'vue-router';
import TabsPage from '@/views/TabsPage.vue';
import { getCurrentUserId } from '@/services/auth';

export const routes: RouteRecordRaw[] = [
  { path: '/', redirect: '/tabs/restaurants' },
  { path: '/login', component: () => import('@/views/LoginPage.vue'), meta: { guestOnly: true } },
  {
    path: '/tabs/',
    component: TabsPage,
    meta: { requiresAuth: true },
    children: [
      { path: '', redirect: '/tabs/restaurants' },
      { path: 'restaurants', component: () => import('@/views/RestaurantListPage.vue') },
      { path: 'restaurants/new-order', component: () => import('@/views/AddOrderPage.vue') },
      { path: 'restaurants/:id', component: () => import('@/views/RestaurantOrdersPage.vue'), props: true },
      { path: 'shared', component: () => import('@/views/SharedOrdersPage.vue') },
      { path: 'profile', component: () => import('@/views/ProfilePage.vue') },
    ],
  },
];

export function buildRouter(history: RouterHistory = createWebHistory(import.meta.env.BASE_URL)): Router {
  const router = createRouter({ history, routes });

  router.beforeEach(async (to) => {
    const requiresAuth = to.matched.some((r) => r.meta.requiresAuth);
    const guestOnly = to.matched.some((r) => r.meta.guestOnly);
    if (!requiresAuth && !guestOnly) return true;

    const userId = await getCurrentUserId();
    if (requiresAuth && !userId) return '/login';
    if (guestOnly && userId) return '/tabs/restaurants';
    return true;
  });

  return router;
}

const router = buildRouter();

export default router;
