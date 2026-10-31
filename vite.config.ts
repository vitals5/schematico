import { defineConfig } from 'vite';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';

let revision=process.env.GITHUB_SHA??'unknown';
try{if(revision==='unknown')revision=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();}catch{}
export default defineConfig({
  define:{__BUILD_REVISION__:JSON.stringify(revision),__BUILD_TIME__:JSON.stringify(new Date().toISOString())},
  base: './',
  worker: { format: 'es' },
  server: {
    host: '0.0.0.0',
    port: 5173,
  },
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        landing: resolve(__dirname, 'landing.html'),
      },
    },
  },
});
