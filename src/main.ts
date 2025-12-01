import { createApp } from 'vue';

import App from './App.vue';
import './assets/index.css';
import { initializeTheme } from './composables/useTheme';
import router from './router';

initializeTheme().then(() => {
  const app = createApp(App);
  app.use(router);
  app.mount('#app');
});
