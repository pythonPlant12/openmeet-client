import { createApp } from 'vue';

import { reveal } from '@/directives/reveal';
import { i18n } from '@/i18n';

import App from './App.vue';
import './assets/index.css';
import { initializeTheme } from './composables/useTheme';
import router from './router';

initializeTheme().then((theme) => {
  document.documentElement.lang = i18n.global.locale.value;
  document.title = i18n.global.t('meta.title', { appName: theme.branding.appName });

  const app = createApp(App);
  app.use(i18n);
  app.use(router);
  app.directive('reveal', reveal);
  app.mount('#app');
});
