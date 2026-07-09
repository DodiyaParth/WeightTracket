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
    // Force Firebase "unconfigured" during tests so nothing tries to reach a
    // real backend (application/.env.local carries live keys for dev). Tests
    // that need data mock the repo/hooks instead.
    env: {
      VITE_FIREBASE_API_KEY: '',
      VITE_FIREBASE_AUTH_DOMAIN: '',
      VITE_FIREBASE_PROJECT_ID: '',
      VITE_FIREBASE_STORAGE_BUCKET: '',
      VITE_FIREBASE_MESSAGING_SENDER_ID: '',
      VITE_FIREBASE_APP_ID: '',
      VITE_FIREBASE_MEASUREMENT_ID: '',
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      reportsDirectory: './coverage',
      // Measure the whole source tree, not just files a test happens to import.
      all: true,
      include: ['src/**/*.{js,jsx}'],
      exclude: [
        'src/test/**',
        'src/main.jsx',
        'scripts/**',
        // Not meaningfully unit-testable: Chart.jsx draws on a <canvas> via
        // Chart.js, and firestore.js is a thin Firebase I/O adapter whose logic
        // is mirrored (and unit-tested) by data/memory.js.
        'src/components/Chart.jsx',
        'src/data/firestore.js',
      ],
      thresholds: { statements: 90 },
    },
  },
});
