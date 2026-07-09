import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Production WeightTracker app. Deployed as a static bundle to GitHub Pages.
// `base: './'` keeps asset paths relative so it works under any /<repo>/ path
// (we use HashRouter, so there are no server-side route rewrites to worry about).
export default defineConfig({
  base: './',
  plugins: [react()],
  server: { port: 5181 },
  build: { outDir: 'dist' },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test/setup.js',
    css: false,
  },
});
