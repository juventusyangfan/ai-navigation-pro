// 匿名身份与每日限额
//
// 不登录，但要知道「是不是同一个设备」，否则一个家长可以无限次调用模型，
// 账单会失控。这里的 anonId 是浏览器 Cookie 里的随机串，与真实身份无关，
// 清缓存或换设备就会换一个新的——这个精度对限额够用，也不需要向家长要任何信息。

import { cookies } from "next/headers";
import { prisma } from "./store";

export const ANON_COOKIE = "zw_uid";
const ANON_MAX_AGE = 60 * 60 * 24 * 180; // 半年

export function dailyLimit(): number {
  const n = Number(process.env.ZW_DAILY_LIMIT || 3);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 3;
}

/** 读取匿名 ID；不存在时不在这里写 Cookie（Route Handler 里由调用方 set）。 */
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

/** 今天已用次数（按本地时区自然日，北京时间）。 */
export async function usedToday(anonId: string): Promise<number> {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  return prisma.essayReview.count({
    where: { anonId, createdAt: { gte: start } },
  });
}

/** 全局每日熔断：防止有人批量换 Cookie 刷，兜一层总预算。 */
export async function globalUsedToday(): Promise<number> {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  return prisma.essayReview.count({ where: { createdAt: { gte: start } } });
}

export function globalDailyCap(): number {
  const n = Number(process.env.ZW_GLOBAL_DAILY_CAP || 300);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 300;
}
