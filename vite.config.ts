/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'La Bottega di Tata e Gegè',
        short_name: 'La Bottega',
        lang: 'it',
        display: 'standalone',
        start_url: '/',
        background_color: '#f6efe4',
        theme_color: '#b4631f',
        icons: [{ src: 'logo.png', sizes: 'any', type: 'image/png', purpose: 'any' }],
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
