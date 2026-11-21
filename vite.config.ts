import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { APP_DESCRIPTION, APP_NAME, APP_TITLE } from './src/config.ts'

const appBranding = {
  name: 'ezmygo-html-branding',
  transformIndexHtml(html: string) {
    return html
      .replace(/%APP_TITLE%/g, APP_TITLE)
      .replace(/%APP_DESCRIPTION%/g, APP_DESCRIPTION)
  },
}

export default defineConfig({
  server: {
    // Allow requests coming from your remote server's domain or IP
    allowedHosts: ['devel-2.uat.phaidelta.com'], 
  },
  plugins: [
    react(),
    appBranding,
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['pwa-icon.svg'],
      manifest: {
        name: `${APP_NAME} - Travel Planner`,
        short_name: APP_NAME,
        description: APP_DESCRIPTION,
        theme_color: '#f9f8f5',
        background_color: '#f9f8f5',
        display: 'standalone',
        start_url: '/',
        icons: [{ src: '/pwa-icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any maskable' }],
      },
      workbox: { navigateFallback: '/index.html', globPatterns: ['**/*.{js,css,html,svg,png,woff2}'] },
    }),
  ],
})
