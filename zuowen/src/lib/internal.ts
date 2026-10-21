// 内部接口（服务端到服务端）的公共约定
//
// 这一层只为「后台/运维拉数据」服务，不面向浏览器：
// 返回体里可能带解密后的孩子作文正文，一旦被公网直接打开就是一次数据泄露。
// 所以两道锁缺一不可：
//   1. ZW_CRON_TOKEN 未配置 → 接口整体关闭（fail-closed），不是「无密码放行」；
//   2. 请求头必须带 x-cron-token 且与配置值一致。
//
// token 比对用恒定时间实现：`!==` 会按首个不同字符提前返回，
// 理论上可被逐字节试探出长度与前缀。虽然内网调用风险低，但成本只有几行代码。

import type { NextRequest } from "next/server";

/** 配置的内部凭证；空串表示接口未启用。 */
export function internalToken(): string {
  return (process.env.ZW_CRON_TOKEN || "").trim();
}

/** 恒定时间字符串比较（长度不同直接判否，长度本身不是秘密）。 */
export function tokenMatches(got: string, expect: string): boolean {
  if (!expect || got.length !== expect.length) return false;
  let diff = 0;
  for (let i = 0; i < expect.length; i += 1) {
    diff |= got.charCodeAt(i) ^ expect.charCodeAt(i);
  }
  return diff === 0;
}

export type InternalAuth = { ok: true } | { ok: false; message: string };

export function readInternalAuth(req: NextRequest): InternalAuth {
  const expect = internalToken();
  if (!expect) {
    return { ok: false, message: "内部接口未启用（服务端未配置 ZW_CRON_TOKEN）" };
  }
  const got = (req.headers.get("x-cron-token") || "").trim();
  if (!tokenMatches(got, expect)) {
    return { ok: false, message: "无权访问" };
  }
  return { ok: true };
}

/* ------------------------------------------------------------------ *
 * 时间：一律按北京时间切日
 *
 * 服务器时区并不一定是 Asia/Shanghai（容器里通常是 UTC）。直接 new Date().setHours(0,0,0,0)
 * 会把「今日」算成 UTC 的今天，早上 8 点前的数据全落到前一天，看板上的数字天天对不上。
 * 这里显式按 UTC+8 取自然日边界，不依赖部署环境。
 * ------------------------------------------------------------------ */

const CN_OFFSET = 8 * 60 * 60 * 1000;

/** 北京时间「N 天前」的零点，返回 UTC Date。daysAgo=0 即今天 00:00（北京）。 */
export function startOfDayCn(daysAgo = 0): Date {
  const cn = new Date(Date.now() + CN_OFFSET);
  cn.setUTCHours(0, 0, 0, 0);
  cn.setUTCDate(cn.getUTCDate() - daysAgo);
  return new Date(cn.getTime() - CN_OFFSET);
}

/** 把 "YYYY-MM-DD" 解析为北京时间零点；非法输入返回 null。 */
export function parseDayCn(raw: string | null): Date | null {
  if (!raw) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw.trim());
  if (!m) return null;
  const d = new Date(`${m[1]}-${m[2]}-${m[3]}T00:00:00+08:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}
