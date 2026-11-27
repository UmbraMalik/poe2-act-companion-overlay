import { resolve } from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react(), {
    name: 'production-content-security-policy',
    apply: 'build',
    transformIndexHtml: {
      order: 'pre',
      handler(html) {
        return html
          .replace("script-src 'self' 'unsafe-inline'", "script-src 'self'")
          .replace("connect-src 'self' http://127.0.0.1:5173 ws://127.0.0.1:5173", "connect-src 'self'");
      }
    }
  }],
  base: './',
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: {
        overlay: resolve(__dirname, 'overlay.html'),
        settings: resolve(__dirname, 'settings.html'),
        companion: resolve(__dirname, 'companion.html'),
        info: resolve(__dirname, 'info.html'),
        community: resolve(__dirname, 'community.html'),
        support: resolve(__dirname, 'support.html'),
        report: resolve(__dirname, 'report.html'),
        'close-confirm': resolve(__dirname, 'close-confirm.html'),
        update: resolve(__dirname, 'update.html')
      }
    }
  }
});
