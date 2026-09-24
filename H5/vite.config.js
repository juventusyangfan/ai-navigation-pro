import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { existsSync, readFileSync } from 'node:fs'

// 最小构建配置：相对路径 base，便于放到任意子目录 / COS 静态托管 / Nginx 目录
//
// HTTPS：手机真机测录音必须走 HTTPS（浏览器在非安全上下文禁用 getUserMedia）。
// 证书用 `npm run cert` 生成到 certs/；**证书不存在时自动降级为 http**，
// 保证 npm run dev 一定能起来，不会因为缺证书直接崩。
const keyPath = new URL('./certs/key.pem', import.meta.url)
const certPath = new URL('./certs/cert.pem', import.meta.url)
const hasCert = existsSync(keyPath) && existsSync(certPath)

if (!hasCert) {
  // 纯 ASCII：Windows 控制台默认 GBK，中文会变乱码（本项目统一约定）
  console.log(
    '[vite] certs/key.pem not found -> starting with HTTP. ' +
      'Run `npm run cert` to enable HTTPS (required for mic on real devices).'
  )
}

export default defineConfig({
  base: './',
  plugins: [vue()],
  server: {
    host: true,
    port: 5173,
    // 注意：不用 Vite 内置 https:true —— 它生成的证书在 Node 24 / OpenSSL 3.x 下
    // 会触发 ERR_SSL_VERSION_OR_CIPHER_MISMATCH，故显式引用本地证书文件。
    https: hasCert
      ? {
          key: readFileSync(keyPath),
          cert: readFileSync(certPath)
        }
      : undefined,
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
