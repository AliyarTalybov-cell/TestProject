import { fileURLToPath, URL } from 'node:url'

import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    proxy: {
      '/yandex-api-v2': {
        target: 'https://api.weather.yandex.ru',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/yandex-api-v2/, '/graphql/query'),
      },
    },
  },
})

