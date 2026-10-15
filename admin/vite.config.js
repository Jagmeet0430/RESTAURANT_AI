import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_')
  return {
    base: process.env.VITE_BASE_PATH || (command === 'build' ? '/admin/' : '/'),
    plugins: [react()],
    server: {
      host: true,
      proxy: command === 'serve' ? {
        '/api': {
          target: new URL(env.VITE_API_URL || 'http://localhost:5001/api').origin,
          changeOrigin: true,
        },
      } : undefined,
      watch: {
        usePolling: true,
        interval: 1000,
      },
    },
  }
})
