import vue from '@vitejs/plugin-vue';
import fs from 'node:fs';
import path from 'node:path';
import { defineConfig } from 'vite';
import vueDevTools from 'vite-plugin-vue-devtools';

const certPath = '../certs/localhost+3.pem';
const keyPath = '../certs/localhost+3-key.pem';
const certsExist = fs.existsSync(certPath) && fs.existsSync(keyPath);

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue(), vueDevTools()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    // HTTPS only in development with local certs (not needed for production build)
    // ...(certsExist && {
    //   https: {
    //     key: fs.readFileSync(keyPath),
    //     cert: fs.readFileSync(certPath),
    //   },
    // }),
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
});
