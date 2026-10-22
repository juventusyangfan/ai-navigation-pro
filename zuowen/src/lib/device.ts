// 设备识别码与每日额度
//
// 为什么要有这一层：家长加企微之后，老板要人工给他多放几次。
// 但服务端只知道 Cookie 里的 anonId（32 位十六进制），家长念不出来、老板搜不了，
// 于是给每台设备配一个 6 位识别码：
//   家长端页脚显示「本机识别码 7K3-M9P」→ 家长念给老师 → 老板后台按码搜到 → 改额度。
//
// 识别码只是「给人看的标签」，权限始终绑在 anonId 上：
// 别人知道某个码也拿不到任何东西（前端不暴露 code→anonId 的映射）。
//
// 字符集去掉了 0 O 1 I L —— 电话或语音里这几个最容易听错，念错一位就搜不到。

import crypto from "node:crypto";
import type { Device } from "@prisma/client";
import { prisma } from "./store";

export const CODE_LEN = 6;
const ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ"; // 31 个字符

/** 随机生成一个识别码（无模偏置：randomInt 是拒绝采样实现）。 */
function newCode(len = CODE_LEN): string {
  let s = "";
  for (let i = 0; i < len; i += 1) s += ALPHABET[crypto.randomInt(0, ALPHABET.length)];
  return s;
}

/** 把用户输入归一化：大写、去掉横杠/空格等一切非字符集内容。 */
export function normalizeCode(raw: string): string {
  return (raw || "")
    .toUpperCase()
    .split("")
    .filter((c) => ALPHABET.includes(c))
    .join("");
}

/** 展示用格式：ABC-DEF，念的时候按两段更好读。 */
export function formatCode(code: string): string {
  const c = normalizeCode(code);
  if (c.length !== CODE_LEN) return c;
  return `${c.slice(0, 3)}-${c.slice(3)}`;
}

/**
 * 取（必要时创建）某台设备的记录。
 *
 * 并发下两个请求可能同时为同一个 anonId 建行：唯一约束会让其中一个失败，
 * 失败后回读即可，不需要事务。code 冲突（概率约 1/8.9 亿）则换一个重试。
 */
export async function ensureDevice(anonId: string): Promise<Device> {
  const hit = await prisma.device.findUnique({ where: { anonId } });
  if (hit) return hit;

  for (let i = 0; i < 20; i += 1) {
    try {
      return await prisma.device.create({ data: { anonId, code: newCode() } });
    } catch {
      const again = await prisma.device.findUnique({ where: { anonId } });
      if (again) return again;
      // 否则是 code 撞了，换一个再试
    }
  }
  throw new Error("识别码分配失败，请重试");
}

export function findDeviceByCode(code: string): Promise<Device | null> {
  const c = normalizeCode(code);
  if (c.length !== CODE_LEN) return Promise.resolve(null);
  return prisma.device.findUnique({ where: { code: c } });
}

/* ------------------------------------------------------------------ *
 * 额度计算
 * ------------------------------------------------------------------ */

export type QuotaMode = "default" | "custom" | "unlimited";

export type QuotaPlan = {
  /** false = 不限制次数（后台给这台设备开了口子） */
  limited: boolean;
  /** limited 为 true 时的每日上限；null 表示不限 */
  limit: number | null;
  used: number;
  mode: QuotaMode;
  /** 后台给这台设备写的备注，用于日志与后台展示 */
  note: string | null;
};

/**
 * 决定这台设备今天的额度。
 *
 * 优先级：后台设置 > 环境变量默认值。
 * 注意「不限额」只解除**个人**上限，全站每日总上限（成本硬顶）仍然生效 ——
 * 那一道是防止被批量刷爆账单，开放几个家长不该把它整个绕过。
 */
export async function planFor(
  anonId: string,
  used: number,
  defaultLimit: number,
): Promise<QuotaPlan> {
  const dev = await prisma.device.findUnique({ where: { anonId } });
  if (dev && !dev.limitEnabled) {
    return { limited: false, limit: null, used, mode: "unlimited", note: dev.note };
  }
  const custom = dev?.customLimit && dev.customLimit > 0 ? dev.customLimit : null;
  return {
    limited: true,
    limit: custom ?? defaultLimit,
    used,
    mode: custom ? "custom" : "default",
    note: dev?.note ?? null,
  };
}

/** 被拦住时给家长看的一句话。要有出路，不能只报错。 */
export function overLimitMessage(plan: QuotaPlan): string {
  const cap = plan.limit ?? 0;
  if (plan.used >= cap) {
    return `今天这台设备已经测过 ${plan.used} 次（每天 ${cap} 次），明天再来看看孩子的进步吧。想多练几篇，可以点下面的二维码加老师。`;
  }
  return "今天的次数已经用完了，明天再来吧。";
}

/** 后台表格里展示的额度模式。 */
export function modeOf(d: { limitEnabled: boolean; customLimit: number | null }): QuotaMode {
  if (!d.limitEnabled) return "unlimited";
  return d.customLimit && d.customLimit > 0 ? "custom" : "default";
}
