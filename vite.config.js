import { defineConfig } from 'vite';

export default defineConfig({
  server: { port: 5173, host: true },
  // Los assets se sirven desde /assets y se copian tal cual al build.
  publicDir: 'assets',
  build: { outDir: 'dist', target: 'es2022', chunkSizeWarningLimit: 1500 }
});
