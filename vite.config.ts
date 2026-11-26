/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv, type Plugin } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'
import { controllaConfigFirebase } from './src/lib/configFirebase.ts'

// Solo in build: ferma tutto prima di produrre un sito che resterebbe bianco.
const richiediConfigFirebase: Plugin = {
  name: 'richiedi-config-firebase',
  apply: 'build',
  configResolved({ mode, envDir, root }) {
    controllaConfigFirebase(loadEnv(mode, envDir || root))
  },
}

export default defineConfig({
  plugins: [
    richiediConfigFirebase,
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      workbox: { navigateFallbackDenylist: [/^\/__\//] },
      manifest: {
        name: 'La Bottega di Tata e Gegè',
        short_name: 'La Bottega',
        lang: 'it',
        display: 'standalone',
        start_url: '/',
        background_color: '#f6efe4',
        theme_color: '#b4631f',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test-setup.ts',
    exclude: ['node_modules', 'dist', 'tests-rules/**'],
  },
})
