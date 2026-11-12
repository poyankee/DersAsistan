/// <reference types="vitest" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: './',
  // Uygulama içi güncelleme: her derlemenin numarası (GitHub Actions çalıştırma numarası)
  define: { __BUILD__: JSON.stringify(Number(process.env.GITHUB_RUN_NUMBER ?? 0)) },
  test: { environment: 'jsdom', globals: true },
})
