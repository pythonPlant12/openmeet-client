import { createRouter, createWebHistory } from 'vue-router';

import LoginPage from '../components/LoginPage.vue';
import Dashboard from '../components/Dashboard.vue';

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'login',
      component: LoginPage,
    },
    {
      path: '/dashboard',
      name: 'dashboard',
      component: Dashboard,
    },
  ],
});

export default router;
