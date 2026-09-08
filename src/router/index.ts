import { createRouter, createWebHistory } from 'vue-router';

import AccountPage from '@/pages/AccountPage.vue';
import DashboardPage from '@/pages/DashboardPage.vue';
import FreedomPage from '@/pages/FreedomPage.vue';
import IdeaPage from '@/pages/IdeaPage.vue';
import LoginPage from '@/pages/LoginPage.vue';
import MeetingPage from '@/pages/MeetingPage.vue';
import NotFoundPage from '@/pages/NotFoundPage.vue';
import RegisterPage from '@/pages/RegisterPage.vue';
import TechnologiesPage from '@/pages/TechnologiesPage.vue';

import { cookieUtils, jwtUtils } from '../utils';

const showLandingPage = import.meta.env.VITE_LANDING_PAGE === 'true';
const landingComponent = showLandingPage ? () => import('@/pages/LandingPage.vue') : LoginPage;
// const showLandingPage = false;

const marketingHashRoutes: Record<string, string> = {
  '#technologies': '/technologies',
  '#idea': '/idea',
  '#freedom': '/freedom',
};

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  scrollBehavior(to, _from, savedPosition) {
    const position = savedPosition ?? (to.hash ? { el: to.hash, behavior: 'smooth' as const } : { top: 0 });
    return new Promise((resolve) => setTimeout(() => resolve(position), 200));
  },
  routes: [
    {
      path: '/',
      name: 'landing',
      component: landingComponent,
      meta: { requiresAuth: false, showMarketingNav: showLandingPage, isAuthPage: !showLandingPage },
    },
    {
      path: '/login',
      name: 'login',
      component: LoginPage,
      meta: { requiresAuth: false, isAuthPage: true, showMarketingNav: true },
    },
    {
      path: '/technologies',
      name: 'technologies',
      component: TechnologiesPage,
      meta: { requiresAuth: false, showMarketingNav: true },
    },
    {
      path: '/idea',
      name: 'idea',
      component: IdeaPage,
      meta: { requiresAuth: false, showMarketingNav: true },
    },
    {
      path: '/freedom',
      name: 'freedom',
      component: FreedomPage,
      meta: { requiresAuth: false, showMarketingNav: true },
    },
    {
      path: '/register',
      name: 'register',
      component: RegisterPage,
      meta: { requiresAuth: false, isAuthPage: true, showMarketingNav: true },
    },
    {
      path: '/dashboard',
      name: 'dashboard',
      component: DashboardPage,
      meta: { requiresAuth: true },
    },
    {
      path: '/account',
      name: 'account',
      component: AccountPage,
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
  const conversation = to.query.conversation;
  const isConversationCall =
    to.name === 'meeting' && typeof conversation === 'string' && conversation.trim().length > 0;
  const isAuthPage = to.matched.some((record) => record.meta.isAuthPage);

  const hasValidAccessToken = accessToken && jwtUtils.isValid(accessToken);
  // Refresh token is UUID, not JWT - can only check existence, backend validates it
  const hasRefreshToken = !!refreshToken;
  // Allow if valid access token OR has refresh token (API client will refresh)
  const canAuthenticate = hasValidAccessToken || hasRefreshToken;

  if (to.name === 'landing' && canAuthenticate) {
    return next('/dashboard');
  }

  const marketingRoute = to.path === '/' ? marketingHashRoutes[to.hash] : undefined;
  if (marketingRoute) return next(marketingRoute);

  // Redirect to dashboard if can authenticate and trying to access auth pages
  if (isAuthPage && canAuthenticate) {
    return next('/dashboard');
  }

  // Redirect to login if trying to access protected route without valid tokens
  if ((requiresAuth || isConversationCall) && !canAuthenticate) {
    cookieUtils.remove('accessToken');
    cookieUtils.remove('refreshToken');
    return next('/login');
  }

  next();
});

export default router;
