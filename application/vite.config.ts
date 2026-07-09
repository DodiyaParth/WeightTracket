import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

// Gradual JS -> TS migration shim. Relative imports across this repo carry
// explicit .js/.jsx extensions, including in the (deliberately untouched) JS
// tests and their vi.mock() calls. On Vite 5 the built-in .js -> .ts fallback
// only fires when the *importer* is a TS file, so a .jsx test importing a
// renamed .tsx module — or a not-yet-converted .js file importing a converted
// .ts one — would fail to resolve. This maps such specifiers to their .ts/.tsx
// sibling for every importer, leaving genuine .js/.jsx files untouched.
function jsToTsExtensionShim() {
  return {
    name: 'js-to-ts-extension-shim',
    enforce: 'pre',
    resolveId(source, importer) {
      if (!importer || !/^\.\.?\//.test(source)) return null; // relative only
      const [clean, query] = source.split('?');
      const m = clean.match(/^(.*)\.(js|jsx)$/);
      if (!m) return null;
      const base = dirname(importer.split('?')[0]);
      if (existsSync(resolve(base, clean))) return null; // a real .js/.jsx wins
      const candidate = resolve(base, m[1] + (m[2] === 'jsx' ? '.tsx' : '.ts'));
      if (!existsSync(candidate)) return null;
      return query ? `${candidate}?${query}` : candidate;
    },
  };
}

// Production WeightTracker app. Deployed as a static bundle to GitHub Pages.
// `base: './'` keeps asset paths relative so it works under any /<repo>/ path
// (we use HashRouter, so there are no server-side route rewrites to worry about).
export default defineConfig({
  base: './',
  plugins: [jsToTsExtensionShim(), react()],
  server: { port: 5181 },
  build: { outDir: 'dist' },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test/setup.ts',
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
      include: ['src/**/*.{js,jsx,ts,tsx}'],
      exclude: [
        'src/test/**',
        'src/main.{jsx,tsx}',
        'scripts/**',
        // Not meaningfully unit-testable: Chart draws on a <canvas> via
        // Chart.js, and firestore is a thin Firebase I/O adapter whose logic
        // is mirrored (and unit-tested) by data/memory. Extension-agnostic so
        // the globs survive the gradual .js/.jsx -> .ts/.tsx migration.
        'src/components/Chart.{jsx,tsx}',
        'src/data/firestore.{js,ts}',
      ],
      thresholds: { statements: 90, branches: 90 },
    },
  },
});
