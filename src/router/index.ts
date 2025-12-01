import { createRouter, createWebHistory } from 'vue-router';

import DashboardPage from '@/pages/DashboardPage.vue';
import LandingPage from '@/pages/LandingPage.vue';
import LoginPage from '@/pages/LoginPage.vue';
import MeetingPage from '@/pages/MeetingPage.vue';
import NotFoundPage from '@/pages/NotFoundPage.vue';
import RegisterPage from '@/pages/RegisterPage.vue';
import { cookieUtils } from '../utils';

const showLandingPage = import.meta.env.VITE_LANDING_PAGE !== 'false';

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'landing',
      component: showLandingPage ? LandingPage : LoginPage,
      meta: { requiresAuth: false },
    },
    {
      path: '/login',
      name: 'login',
      component: LoginPage,
      meta: { requiresAuth: false, isAuthPage: true },
    },
    {
      path: '/register',
      name: 'register',
      component: RegisterPage,
      meta: { requiresAuth: false, isAuthPage: true },
    },
    {
      path: '/dashboard',
      name: 'dashboard',
      component: DashboardPage,
      meta: { requiresAuth: true },
    },
    {
      path: '/room',
      name: 'room-index',
      component: NotFoundPage,
    },
    {
      path: '/room/:id',
      name: 'meeting',
      component: MeetingPage,
      meta: { requiresAuth: false },
    },
    {
      path: '/:pathMatch(.*)*',
      name: 'not-found',
      component: NotFoundPage,
    },
  ],
});

router.beforeEach((to, from, next) => {
  const token = cookieUtils.get('accessToken');
  const requiresAuth = to.matched.some((record) => record.meta.requiresAuth);
  const isAuthPage = to.matched.some((record) => record.meta.isAuthPage);

  // Redirect to dashboard if already logged in and trying to access auth pages
  if (isAuthPage && token) {
    return next('/dashboard');
  }

  // Redirect to login if trying to access protected route without token
  if (requiresAuth && !token) {
    return next('/login');
  }

  next();
});

export default router;
