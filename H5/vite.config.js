import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// 最小构建配置：相对路径 base，便于放到任意子目录 / COS 静态托管 / Nginx 目录
export default defineConfig({
  base: './',
  plugins: [vue()],
  server: {
    host: true,
    port: 5173,
    // 本地开发把 /api 代理到密钥服务，避免跨域
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8787',
        changeOrigin: true
      }
    }
  },
  preview: {
    host: true,
    port: 4173
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: false
  }
})
