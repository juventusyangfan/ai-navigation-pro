import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { readFileSync } from 'node:fs'

// 最小构建配置：相对路径 base，便于放到任意子目录 / COS 静态托管 / Nginx 目录
export default defineConfig({
  base: './',
  plugins: [vue()],
  server: {
    host: true,
    port: 5173,
    // 本地开发用自签名证书（certs/ 下 RSA-2048/SHA-256，含 localhost 与局域网 IP 的 SAN）。
    // 注意：Vite 内置 https:true 生成的证书在 Node 24 / OpenSSL 3.x 下会触发
    // ERR_SSL_VERSION_OR_CIPHER_MISMATCH，故此处显式引用本地证书文件。
    https: {
      key: readFileSync(new URL('./certs/key.pem', import.meta.url)),
      cert: readFileSync(new URL('./certs/cert.pem', import.meta.url))
    },
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
