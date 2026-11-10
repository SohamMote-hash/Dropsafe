import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss() as ReturnType<typeof react>],
  server: {
    host: true,
    port: 5173,
    // Convenience for local API checks; the dashboard itself reads Firebase directly.
    proxy: { '/api': { target: 'http://localhost:8787', changeOrigin: true } },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx', 'server/**/*.test.js'],
  },
});
