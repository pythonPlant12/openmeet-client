import basicSsl from '@vitejs/plugin-basic-ssl';
import vue from '@vitejs/plugin-vue';
import path from 'node:path';
import { URL, fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import vueDevTools from 'vite-plugin-vue-devtools';

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue(), vueDevTools(), basicSsl()],
  server: {
    host: true,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
});
