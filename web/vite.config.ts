import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'کارنما',
        short_name: 'کارنما',
        description: 'مدیریت وظایف و پروژه‌های شخصی',
        lang: 'fa',
        dir: 'rtl',
        theme_color: '#4f46e5',
        background_color: '#ffffff',
        display: 'standalone',
        start_url: '/',
        icons: [{ src: 'favicon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any maskable' }],
      },
      workbox: { globPatterns: ['**/*.{js,css,html,svg,woff2}'] },
    }),
  ],
  server: { proxy: { '/api': 'http://localhost:4000' } },
})
