import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// UI prototype only. Source lives in /design. Production app is built separately.
export default defineConfig({
  base: './',
  plugins: [react()],
  server: { open: true, port: 5180 },
  build: { outDir: 'dist-design' },
});
