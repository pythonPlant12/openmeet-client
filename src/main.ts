import { createApp } from 'vue';

import { reveal } from '@/directives/reveal';
import { i18n } from '@/i18n';
import { installScrollbarVisibility } from '@/lib/scrollbar-visibility';
import { installOverlayClickGuard } from '@/lib/swallow-next-click';

import App from './App.vue';
import './assets/index.css';
import { initializeTheme } from './composables/useTheme';
import router from './router';

// Firefox ignores -webkit-user-drag, so image drags are cancelled here for every browser.
document.addEventListener('dragstart', (event) => {
  if (event.target instanceof HTMLImageElement) event.preventDefault();
});

installScrollbarVisibility();
// A press outside an open menu or the meeting chat only closes it (see swallow-next-click.ts).
installOverlayClickGuard();

initializeTheme().then((theme) => {
  document.documentElement.lang = i18n.global.locale.value;
  document.title = i18n.global.t('meta.title', { appName: theme.branding.appName });

  const app = createApp(App);
  app.use(i18n);
  app.use(router);
  app.directive('reveal', reveal);
  app.mount('#app');
});
