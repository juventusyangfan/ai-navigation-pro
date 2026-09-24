// 生成自签 HTTPS 证书到 certs/ —— 手机真机测录音必须走 HTTPS，
// 因为浏览器在非安全上下文（http + 非 localhost）会禁用 getUserMedia。
//
// 用法：npm run cert
// 输出：ASCII only（Windows GBK 控制台吃中文，会乱码）
import { execFileSync } from 'node:child_process'
import { mkdirSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const certDir = path.join(root, 'certs')
const keyPath = path.join(certDir, 'key.pem')
const certPath = path.join(certDir, 'cert.pem')

const candidates = [
  process.env.OPENSSL_PATH,
  'C:\\Users\\54792\\.workbuddy\\binaries\\PortableGit\\versions\\1.2.0\\usr\\bin\\openssl.exe',
  'C:\\Program Files\\Git\\usr\\bin\\openssl.exe',
  'C:\\Program Files\\Git\\mingw64\\bin\\openssl.exe',
  'C:\\Program Files (x86)\\Git\\usr\\bin\\openssl.exe',
  'openssl'
].filter(Boolean)

let openssl = null
for (const c of candidates) {
  try {
    execFileSync(c, ['version'], { stdio: 'ignore' })
    openssl = c
    break
  } catch {
    /* try next */
  }
}

if (!openssl) {
  console.error('[cert] openssl not found.')
  console.error('[cert] Install one of these, then re-run:  npm run cert')
  console.error('[cert]   1) winget install -e --id=GnuWin32.OpenSSL')
  console.error('[cert]   2) choco install openssl')
  console.error('[cert]   3) choco install mkcert  (then: mkcert -install && mkcert localhost <LAN-IP>)')
  process.exit(1)
}

function lanIps() {
  const out = []
  for (const list of Object.values(os.networkInterfaces())) {
    for (const i of list || []) {
      if (i.family === 'IPv4' && !i.internal) out.push(i.address)
    }
  }
  return out
}

const ips = lanIps()
const san = ['DNS:localhost', 'IP:127.0.0.1', ...ips.map((ip) => `IP:${ip}`)].join(',')

mkdirSync(certDir, { recursive: true })

console.log('[cert] openssl: ' + openssl)
console.log('[cert] SAN: ' + san)

try {
  execFileSync(
    openssl,
    [
      'req', '-x509', '-newkey', 'rsa:2048', '-nodes',
      '-keyout', keyPath,
      '-out', certPath,
      '-days', '365',
      '-subj', '/CN=localhost',
      '-addext', 'subjectAltName=' + san
    ],
    { stdio: 'inherit' }
  )
} catch (e) {
  console.error('[cert] openssl failed: ' + (e && e.message))
  console.error('[cert] If "-addext" is unsupported, upgrade OpenSSL to 1.1.1+.')
  process.exit(1)
}

console.log('')
console.log('[cert] OK -> certs/key.pem, certs/cert.pem')
console.log('[cert] Next:  npm run dev')
console.log('[cert] Desktop : https://localhost:5173/#/readaloud')
for (const ip of ips) {
  console.log(`[cert] Phone   : https://${ip}:5173/#/readaloud`)
}
console.log('[cert] NOTE: self-signed -> browser will warn, click Advanced/Proceed.')
console.log('[cert] iOS Safari may refuse getUserMedia on self-signed certs; Chrome/Android is fine.')
