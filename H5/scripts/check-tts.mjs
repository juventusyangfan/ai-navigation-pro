// 服务端语音合成自检：直接调用 server/tts.mjs（不走 HTTP），逐条合成题库音频。
//
// 用途：部署前确认「腾讯云 TTS 是否已开通、密钥是否有效、音频是否合成得出」，
// 避免上线后才发现 /api/tts/audio 返回 503/502。
//
// 用法：
//   node scripts/check-tts.mjs                 # 全量（走缓存，重复执行几乎零成本）
//   node scripts/check-tts.mjs --only grade7   # 只跑某个年级
//   node scripts/check-tts.mjs --no-cache      # 忽略缓存，强制重新合成
//   node scripts/check-tts.mjs --limit 1       # 只跑前 N 条

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadDotEnv } from '../server/http-util.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')
loadDotEnv(path.join(root, 'server', '.env'))

const { papers } = await import('../src/data/paper.js')
const tts = await import('../server/tts.mjs')
const { MAX_TEXT_LENGTH } = tts.internals

const args = process.argv.slice(2)
const only = (() => {
  const i = args.indexOf('--only')
  return i >= 0 ? args[i + 1] : ''
})()
const limitArg = (() => {
  const i = args.indexOf('--limit')
  return i >= 0 ? Number(args[i + 1]) : 0
})()
const noCache = args.includes('--no-cache')

const health = await tts.health()
console.log('=== 服务端 TTS 配置 ===')
console.log(`enabled=${health.enabled} configured=${health.configured} sdk=${health.library}`)
console.log(`voices=${JSON.stringify(health.voices)} speed=${health.speed} sampleRate=${health.sampleRate}`)
console.log(`allowAnyText=${health.allowAnyText}（false = 仅允许题库文本，防配额盗刷）`)
console.log('')

if (!health.configured) {
  console.error('未配置密钥：请在 server/.env 设置 TTS_SECRET_ID / TTS_SECRET_KEY（或复用 SOE_*）')
  process.exit(1)
}
if (!health.library) {
  console.error('缺少依赖：npm i tencentcloud-sdk-nodejs-tts')
  process.exit(1)
}

// 收集题目
const jobs = []
for (const [gradeId, paper] of Object.entries(papers)) {
  if (only && only !== gradeId) continue
  for (const section of paper.sections) {
    for (const item of section.items) {
      if (!item.audioText) continue
      jobs.push({ key: `${gradeId}/${section.id}-${item.id}`, text: item.audioText })
    }
  }
}
const list = limitArg ? jobs.slice(0, limitArg) : jobs

console.log(`=== 待合成 ${list.length} 条（共 ${jobs.length} 条含 audioText） ===`)
let okCount = 0
let failCount = 0
let totalBytes = 0
let totalChars = 0
const failures = []

for (const job of list) {
  const text = tts.normalizeText(job.text)
  const chars = text.length
  totalChars += chars
  const overLimit = chars > MAX_TEXT_LENGTH
  try {
    const r = await tts.synthesize(text, { noCache })
    totalBytes += r.buffer.length
    okCount += 1
    const head = r.buffer.subarray(0, 4).toString('latin1').replace(/[^\x20-\x7e]/g, '.')
    console.log(
      `[ OK ] ${job.key.padEnd(24)} ${String(chars).padStart(4)} 字符 · ${r.segments} 段 · ` +
        `${(r.buffer.length / 1024).toFixed(1)} KB · ${r.cached ? '缓存命中' : '新合成'} · 头「${head}」` +
        (overLimit ? '  [!] 超出单次上限，已自动分段' : '')
    )
  } catch (e) {
    failCount += 1
    failures.push({ key: job.key, code: e.code || '', message: e.message })
    console.log(`[FAIL] ${job.key.padEnd(24)} ${e.code || ''} ${e.message}`)
  }
}

console.log('')
console.log('=== 汇总 ===')
console.log(`成功 ${okCount} 条 / 失败 ${failCount} 条`)
console.log(`文本合计 ${totalChars} 字符；音频合计 ${(totalBytes / 1024 / 1024).toFixed(2)} MB`)
if (failures.length) {
  console.log('失败明细：')
  for (const f of failures) console.log(`  - ${f.key}: [${f.code}] ${f.message}`)
}
console.log('')
console.log('提示：同一文本第二次执行会命中磁盘缓存（server/.cache/tts），不会重复计费。')

process.exit(failCount ? 1 : 0)
