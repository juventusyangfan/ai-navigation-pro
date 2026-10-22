// PATCH /api/internal/devices/[code] —— 改一台设备的额度（后台人工开放次数）
//
// 三种状态，对应老板嘴里的「开关」：
//   limitEnabled=true  + customLimit=null  → 按默认值（ZW_DAILY_LIMIT，通常 3 次）
//   limitEnabled=true  + customLimit=20    → 这台设备每天 20 次
//   limitEnabled=false                     → 完全不限次数（仍受全站每日总上限兜底）
//
// 注意：这里改的是**额度**，不是身份。家长换了手机或清了缓存，anonId 就变了，
// 新设备要重新按新码开通 —— 这是匿名方案绕不开的代价，没有更好的做法。

import { NextRequest } from "next/server";
import { prisma } from "@/lib/store";
import { guarded, ok, fail } from "@/lib/http";
import { readInternalAuth, startOfDayCn } from "@/lib/internal";
import { findDeviceByCode, formatCode, modeOf } from "@/lib/device";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_CUSTOM = 200;

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ code: string }> }) {
  return guarded("internal/devices:update", async () => {
    const auth = readInternalAuth(req);
    if (!auth.ok) return fail(401, auth.message);

    const { code } = await ctx.params;
    const dev = await findDeviceByCode(code);
    if (!dev) return fail(404, "没有找到这个识别码对应的设备（核对一下码里的字符：没有 0、1、O、I、L）");

    let body: Record<string, unknown>;
    try {
      body = (await req.json()) as Record<string, unknown>;
    } catch {
      return fail(400, "请求格式不正确");
    }

    const data: { limitEnabled?: boolean; customLimit?: number | null; note?: string | null } = {};

    if ("limitEnabled" in body) {
      if (typeof body.limitEnabled !== "boolean") return fail(400, "limitEnabled 必须是 true 或 false");
      data.limitEnabled = body.limitEnabled;
    }

    if ("customLimit" in body) {
      const v = body.customLimit;
      if (v === null || v === "") {
        data.customLimit = null; // 回到默认值
      } else {
        const n = Number(v);
        if (!Number.isInteger(n) || n < 1 || n > MAX_CUSTOM) {
          return fail(400, `每日次数需为 1—${MAX_CUSTOM} 的整数；留空表示用默认值`);
        }
        data.customLimit = n;
      }
    }

    if ("note" in body) {
      const v = body.note;
      if (v === null || v === "") data.note = null;
      else if (typeof v === "string") data.note = v.trim().slice(0, 40) || null;
      else return fail(400, "备注格式不正确");
    }

    if (Object.keys(data).length === 0) return fail(400, "没有要修改的字段");

    const updated = await prisma.device.update({ where: { anonId: dev.anonId }, data });

    const [today, total, last] = await Promise.all([
      prisma.essayReview.count({ where: { anonId: dev.anonId, createdAt: { gte: startOfDayCn(0) } } }),
      prisma.essayReview.count({ where: { anonId: dev.anonId } }),
      prisma.essayReview.aggregate({ where: { anonId: dev.anonId }, _max: { createdAt: true } }),
    ]);

    // 额度是人工改的，必须留痕：出事时能回答「谁在什么时候放开的」
    // （这里只有服务端日志；后台操作人由 admin 侧记录，见其路由注释）
    console.log(
      `[zuowen][device] ${updated.code} limitEnabled=${updated.limitEnabled} customLimit=${updated.customLimit ?? "-"} note=${updated.note ?? "-"}`,
    );

    return ok({
      ok: true,
      item: {
        code: updated.code,
        display: formatCode(updated.code),
        note: updated.note,
        limitEnabled: updated.limitEnabled,
        customLimit: updated.customLimit,
        mode: modeOf(updated),
        today,
        total,
        lastAt: last._max.createdAt ?? null,
        createdAt: updated.createdAt,
        updatedAt: updated.updatedAt,
      },
    });
  });
}
