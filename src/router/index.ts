import { createRouter, createWebHistory } from 'vue-router';

import DashboardPage from '@/pages/DashboardPage.vue';
import LandingPage from '@/pages/LandingPage.vue';
import LoginPage from '@/pages/LoginPage.vue';
import MeetingPage from '@/pages/MeetingPage.vue';
import NotFoundPage from '@/pages/NotFoundPage.vue';
import RegisterPage from '@/pages/RegisterPage.vue';
import { cookieUtils, jwtUtils } from '../utils';

const showLandingPage = import.meta.env.VITE_LANDING_PAGE === 'true';
// const showLandingPage = false;

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
  const accessToken = cookieUtils.get('accessToken');
  const refreshToken = cookieUtils.get('refreshToken');
  const requiresAuth = to.matched.some((record) => record.meta.requiresAuth);
  const isAuthPage = to.matched.some((record) => record.meta.isAuthPage);

  const hasValidAccessToken = accessToken && jwtUtils.isValid(accessToken);
  // Refresh token is UUID, not JWT - can only check existence, backend validates it
  const hasRefreshToken = !!refreshToken;
  // Allow if valid access token OR has refresh token (API client will refresh)
  const canAuthenticate = hasValidAccessToken || hasRefreshToken;

  // Redirect to dashboard if can authenticate and trying to access auth pages
  if (isAuthPage && canAuthenticate) {
    return next('/dashboard');
  }

  // Redirect to login if trying to access protected route without valid tokens
  if (requiresAuth && !canAuthenticate) {
    cookieUtils.remove('accessToken');
    cookieUtils.remove('refreshToken');
    return next('/login');
  }

  next();
});

export default router;
