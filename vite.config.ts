import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { invitationDeleteMiddleware } from './server/invitation-delete.mjs';
import { walletMiddleware } from './server/wallet.mjs';
import { invitationEmailMiddleware } from './server/invitation-email.mjs';

export default defineConfig({
  plugins: [{ name: 'invitation-email', configureServer(server) { server.middlewares.use(invitationEmailMiddleware()); server.middlewares.use(walletMiddleware()); server.middlewares.use(invitationDeleteMiddleware()); }, configurePreviewServer(server) { server.middlewares.use(invitationEmailMiddleware()); server.middlewares.use(walletMiddleware()); server.middlewares.use(invitationDeleteMiddleware()); } }, react(), VitePWA({
    registerType: 'autoUpdate',
    includeAssets: ['icon.svg', 'apple-touch-icon.png', 'sonic-hero.webp'],
    manifest: {
      id: '/', name: 'Santiago · Nivel 7', short_name: 'Santiago 7',
      description: 'La invitación y los recuerdos del cumpleaños de Santiago.',
      lang: 'es', start_url: '/', scope: '/', display: 'standalone',
      background_color: '#f6f8ff', theme_color: '#0849db',
      icons: [
        { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
        { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
        { src: '/icon-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
      ],
    },
    workbox: {
      importScripts: ['/push-worker.js'],
      globPatterns: ['**/*.{js,css,html,woff2,png,svg,webp}'],
      globIgnores: ['**/sonic-hero.png', '**/characters/**', '**/wallet-*.png'],
      navigateFallback: '/index.html',
      // No caching of Supabase requests, private photos or authenticated data.
      runtimeCaching: [{
        urlPattern: ({ url, sameOrigin }) => sameOrigin && /^\/characters\/[a-z-]+-(240|480)\.webp$/.test(url.pathname),
        handler: 'CacheFirst',
        options: { cacheName: 'santiago-characters-v2', expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 30 }, cacheableResponse: { statuses: [200] } },
      }],
    },
  })],
});
