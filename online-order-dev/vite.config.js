import { resolve } from 'path'
import { defineConfig } from 'vite'

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'main.html'),
        period: resolve(__dirname, 'period-orders.html'),
        monthly: resolve(__dirname, 'monthly-orders.html'),
      },
    },
  },
})