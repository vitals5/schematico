import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  worker: { format: 'es' },
  server: {
    host: '0.0.0.0',
    port: 5173,
  },
});
