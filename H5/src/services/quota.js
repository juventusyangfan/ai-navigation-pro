// 测评次数与家长机识别码（前端只做展示与「开始前领票」，计数一律在服务端）
//
// 为什么不在前端扣次数：localStorage 清一下就重来，无痕窗口天然绕过，
// 学校机房统一装浏览器更是一台机器顶一个班。服务端记账是唯一有效的位置。
//
// 前端只有两件事：
//   1) 显示「今天还能测几次」和本机识别码（GET /api/quota）
//   2) 点「开始测评」时领一张票（POST /api/quota/start）——这一步才扣次数
//
// 一个刻意设计：领票失败（网络异常 / 服务端还没升级 / 额度服务自己挂了）时**放行**。
// 丢掉一个家长的次数，好过让所有人卡在「开始测评」点不动。

const BASE = import.meta.env.VITE_API_BASE || ''

/** 读响应：先取文本再解析。空 body 直接当空对象，不让 JSON.parse 抛在业务里。 */
async function readJson(res) {
  const text = await res.text().catch(() => '')
  if (!text) return {}
  try {
    return JSON.parse(text)
  } catch (e) {
    return { message: text.slice(0, 200) }
  }
}

/**
 * 取本机额度状态。
 * @returns {Promise<null | {code:string, used:number, limit:number|null, remaining:number|null,
 *   unlimited:boolean, totalUsed:number, totalCap:number, totalRemaining:number, limitMode:string, note:string}>}
 *   返回 null 表示拿不到（服务端未启用 / 网络异常），页面应隐藏次数信息而不是报错。
 */
export async function fetchQuota() {
  try {
    const res = await fetch(`${BASE}/api/quota`, {
      cache: 'no-store',
      credentials: 'same-origin'
    })
    const data = await readJson(res)
    if (!res.ok || !data || data.ok === false) return null
    return data
  } catch (e) {
    return null
  }
}

/**
 * 领票：扣减一次。必须在「开始测评」时调用，不要放在页面加载时——
 * 打开页面就扣次数，家长只是看看也会被算掉一次。
 *
 * 返回：
 *   { ok: true, ticket, remaining, used, unlimited, limit }
 *   { ok: false, error: 'DEVICE_LIMIT' | 'GLOBAL_CAP', message }
 *   { ok: true, degraded: true }  ← 服务端不可用时放行
 */
export async function startSession() {
  try {
    const res = await fetch(`${BASE}/api/quota/start`, {
      method: 'POST',
      cache: 'no-store',
      credentials: 'same-origin'
    })
    const data = await readJson(res)

    if (res.ok && data.ok) return { ok: true, ...data }

    // 429 = 本机次数用完；503 = 全站名额用完。这两种要明确告诉家长。
    if (res.status === 429 || res.status === 503) {
      return {
        ok: false,
        error: data.error || (res.status === 429 ? 'DEVICE_LIMIT' : 'GLOBAL_CAP'),
        message: data.message || '今天的次数已经用完啦，明天再来吧。',
        ...data
      }
    }

    // 其它状态（404 说明服务端还是旧版本、500 是服务端异常）：放行
    return { ok: true, degraded: true, message: data.message || '' }
  } catch (e) {
    return { ok: true, degraded: true, message: '' }
  }
}

/** 把 6 位识别码排成 ABC-DEF（服务端已格式化，这里只处理本地兜底）。 */
export function formatCode(raw) {
  const c = String(raw || '').toUpperCase().replace(/[^0-9A-Z]/g, '')
  return c.length === 6 ? `${c.slice(0, 3)}-${c.slice(3)}` : c
}
