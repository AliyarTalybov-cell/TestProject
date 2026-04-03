import { fileURLToPath, URL } from 'node:url'
import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'

const frontendRoot = fileURLToPath(new URL('.', import.meta.url))

export default defineConfig(({ mode }) => {
  // Всегда читаем .env из папки frontend (рядом с этим конфигом), а не из cwd процесса.
  const env = loadEnv(mode, frontendRoot, '')

  return {
    root: frontendRoot,
    envDir: frontendRoot,
    plugins: [vue()],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
    server: {
      proxy: {
        '/api/weather': {
          target: 'https://api.weather.yandex.ru',
          changeOrigin: true,
          headers: {
            'X-Yandex-Weather-Key': env.VITE_YANDEX_WEATHER_KEY || ''
          },
          rewrite: (path) => path.replace(/^\/api\/weather/, '/graphql/query'),
        },
      },
    },
  }
})
