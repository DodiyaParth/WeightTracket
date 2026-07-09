import '@testing-library/jest-dom';
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

// Unmount anything rendered between tests (defensive even with globals on).
afterEach(() => {
  cleanup();
});

// jsdom doesn't implement these. Several parts of the app touch them
// (responsive checks in pages/AddWeight.jsx, chart sizing in components/Chart.jsx),
// so stub them once here to keep component tests from crashing.
if (typeof window !== 'undefined' && !window.matchMedia) {
  window.matchMedia = (query) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener() {},
    removeEventListener() {},
    addListener() {},
    removeListener() {},
    dispatchEvent() {
      return false;
    },
  });
}

if (typeof globalThis !== 'undefined' && !globalThis.ResizeObserver) {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}
