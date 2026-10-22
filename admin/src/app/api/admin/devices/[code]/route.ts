import { requireAdmin, ok } from "@/lib/http";
import { guarded } from "@/lib/api-guard";
import {
  zuowenConfigured,
  zuowenConfigHint,
  zuowenPatch,
  type DeviceUpdatePayload,
} from "@/lib/zuowen/client";

export const dynamic = "force-dynamic";

/**
 * PATCH /api/admin/devices/[code] —— 改一台设备的每日额度
 *
 * 这是后台唯一的**写操作**（其余看板都是只读）。所以做了三件额外的事：
 *   1. 权限要求 devices:write，只有 editor 及以上有；reviewer 只能看。
 *   2. 服务端按白名单挑字段转发，不把前端 body 原样丢给 zuowen ——
 *      避免哪天 zuowen 加了新字段，后台变成一个未经过滤的万能写入口。
 *   3. 记一行操作日志（谁、哪台设备、改了什么），事后能回答「这家的次数是谁放的」。
 *
 * 仍然守住的底线：不删除数据、不改作文内容、不碰 zuowen 的库。
 */
export async function PATCH(req: Request, ctx: { params: Promise<{ code: string }> }) {
  return guarded("admin/devices:update", async () => {
    const guard = await requireAdmin("devices", "write");
    if (guard.error) return guard.error;

    if (!zuowenConfigured()) {
      return ok({ error: "作文测评服务未配置", hint: zuowenConfigHint() }, { status: 503 });
    }

    const { code } = await ctx.params;
    const normalized = (code || "").replace(/[^A-Za-z0-9]/g, "").toUpperCase();
    if (normalized.length !== 6) {
      return ok({ error: "识别码应为 6 位（不含 0、1、O、I、L）" }, { status: 400 });
    }

    let raw: Record<string, unknown>;
    try {
      raw = (await req.json()) as Record<string, unknown>;
    } catch {
      return ok({ error: "请求格式不正确" }, { status: 400 });
    }

    const payload: { limitEnabled?: boolean; customLimit?: number | null; note?: string | null } = {};
    if (typeof raw.limitEnabled === "boolean") payload.limitEnabled = raw.limitEnabled;
    if (raw.customLimit === null || typeof raw.customLimit === "number") {
      payload.customLimit = raw.customLimit as number | null;
    }
    if (typeof raw.note === "string") payload.note = raw.note;

    if (Object.keys(payload).length === 0) {
      return ok({ error: "没有要修改的字段" }, { status: 400 });
    }

    const r = await zuowenPatch<DeviceUpdatePayload>(`/api/internal/devices/${normalized}`, payload);
    if (!r.ok) return ok({ error: r.error, hint: r.hint }, { status: r.status });

    console.log(
      `[admin][devices] ${guard.admin?.email ?? "?"} → ${r.data.item.display} ` +
        `limitEnabled=${payload.limitEnabled ?? "-"} customLimit=${payload.customLimit === undefined ? "-" : (payload.customLimit ?? "默认")}`,
    );

    return ok({ ...r.data });
  });
}
