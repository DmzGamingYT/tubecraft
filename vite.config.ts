import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { ytProxyPlugin } from './server/ytProxy';

export default defineConfig({
  plugins: [react(), ytProxyPlugin()],
  server: {
    host: '127.0.0.1',
    port: 5183,
  },
});
