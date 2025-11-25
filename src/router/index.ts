import { createRouter, createWebHistory } from 'vue-router';

import Dashboard from '../components/Dashboard.vue';
import LoginPage from '../components/LoginPage.vue';
import MeetingRoom from '../components/MeetingRoom.vue';
import { cookieUtils } from '../utils';

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'login',
      component: LoginPage,
      meta: { requiresAuth: false },
    },
    {
      path: '/dashboard',
      name: 'dashboard',
      component: Dashboard,
      meta: { requiresAuth: true },
    },
    {
      path: '/meet/:id',
      name: 'meeting',
      component: MeetingRoom,
      meta: { requiresAuth: true },
    },
  ],
});

router.beforeEach((to, from, next) => {
  const token = cookieUtils.get('authToken');
  const requiresAuth = to.matched.some((record) => record.meta.requiresAuth);

  if (to.path === '/' && token) {
    return next('/dashboard');
  }

  if (requiresAuth && !token) {
    return next('/');
  }

  next();
});

export default router;
