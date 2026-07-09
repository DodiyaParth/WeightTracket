import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// UI prototype only. Source lives in this /design directory. The production app
// is a separate, self-contained project in ../application.
export default defineConfig({
  base: './',
  plugins: [react()],
  server: { open: true, port: 5180 },
  build: { outDir: 'dist' },
});
