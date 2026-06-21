import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  // Rutas relativas: permite hostear en subcarpetas
  base: './',
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg'],
      manifest: {
        name: 'ARPG Roguelite',
        short_name: 'ARPG',
        description: 'Roguelite ARPG cyberpunk — overworld + dungeons',
        theme_color: '#1a1a2e',
        background_color: '#000000',
        display: 'fullscreen',
        orientation: 'portrait',
        start_url: '.',
        icons: [
          { src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,woff2}'],
      },
      // El service worker no se activa en dev para no interferir con HMR
      devOptions: { enabled: false },
    }),
  ],
})
