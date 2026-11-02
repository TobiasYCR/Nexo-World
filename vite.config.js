import { defineConfig } from 'vite';

// El juego llama a /api; en desarrollo Vite lo reenvía al servidor de puntuaciones (npm run server).
const API_PROXY = { '/api': { target: `http://127.0.0.1:${process.env.API_PORT ?? 3001}` } };

export default defineConfig({
  server: { port: 5173, host: true, proxy: API_PROXY },
  preview: { proxy: API_PROXY },
  // Los assets se sirven desde /assets y se copian tal cual al build.
  publicDir: 'assets',
  build: { outDir: 'dist', target: 'es2022', chunkSizeWarningLimit: 1500 }
});
