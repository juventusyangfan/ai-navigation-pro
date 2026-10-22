// 匿名身份与每日限额
//
// 不登录，但要知道「是不是同一个设备」，否则一个家长可以无限次调用模型，
// 账单会失控。这里的 anonId 是浏览器 Cookie 里的随机串，与真实身份无关，
// 清缓存或换设备就会换一个新的——这个精度对限额够用，也不需要向家长要任何信息。
//
// 2026-10-22 补充：anonId 现在还会在 Device 表里换成一个 6 位识别码，
// 供老板在后台按码人工放开额度（见 lib/device.ts）。anonId 本身的语义没变。

import { cookies } from "next/headers";
import { prisma } from "./store";
import { startOfDayCn } from "./internal";

export const ANON_COOKIE = "zw_uid";
const ANON_MAX_AGE = 60 * 60 * 24 * 180; // 半年

export function dailyLimit(): number {
  const n = Number(process.env.ZW_DAILY_LIMIT || 3);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 3;
}

/** 读取匿名 ID；不存在时不在这里写 Cookie（由 Route Handler 用 Set-Cookie 下发）。 */
export async function readAnonId(): Promise<string | null> {
  const jar = await cookies();
  const v = jar.get(ANON_COOKIE)?.value;
  return v && /^[a-z0-9]{16,64}$/i.test(v) ? v : null;
}

export function newAnonId(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export function anonCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: ANON_MAX_AGE,
  };
}

/** 拼一条 Set-Cookie 头（Route Handler 里用 headers.append 下发）。 */
export function anonCookieHeader(anonId: string): string {
  const opts = anonCookieOptions();
  const parts = [
    `${ANON_COOKIE}=${anonId}`,
    `Path=${opts.path}`,
    `Max-Age=${opts.maxAge}`,
    "SameSite=Lax",
  ];
  if (opts.httpOnly) parts.push("HttpOnly");
  if (opts.secure) parts.push("Secure");
  return parts.join("; ");
}

/**
 * 今天已用次数（按**北京时间**自然日）。
 *
 * 不能直接用 new Date().setHours(0,0,0,0)：服务器时区不一定是 Asia/Shanghai
 * （云镜像默认常为 UTC），那样「今天」会从北京时间 08:00 起算 ——
 * 早上 7 点测过的人到 8 点又满额，家长会觉得莫名其妙。
 */
export async function usedToday(anonId: string): Promise<number> {
  return prisma.essayReview.count({
    where: { anonId, createdAt: { gte: startOfDayCn(0) } },
  });
}

/** 全局每日熔断：防止有人批量换 Cookie 刷，兜一层总预算。 */
export async function globalUsedToday(): Promise<number> {
  return prisma.essayReview.count({ where: { createdAt: { gte: startOfDayCn(0) } } });
}

export function globalDailyCap(): number {
  const n = Number(process.env.ZW_GLOBAL_DAILY_CAP || 300);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 300;
}
