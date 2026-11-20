import { defineConfig } from 'vite';
import { readFileSync } from 'node:fs';

const manifest = JSON.parse(readFileSync(new URL('./manifest.json', import.meta.url), 'utf8'));

export default defineConfig({
  base: './',
  build: {
    rollupOptions: {
      // Three.js in its own file: it does not change between our versions, so the browser keeps it in cache
      output: { manualChunks: { three: ['three'] } },
    },
    chunkSizeWarningLimit: 800,
  },
  define: { __APP_VERSION__: JSON.stringify(manifest.version) },
});
