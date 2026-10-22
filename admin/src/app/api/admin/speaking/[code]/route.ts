import { requireAdmin, ok } from "@/lib/http";
import { guarded } from "@/lib/api-guard";
import {
  h5Configured,
  h5ConfigHint,
  h5Patch,
  normalizeCodeInput,
  normalizeDevice,
  type SpeakingMode,
  type SpeakingUpdateRaw,
} from "@/lib/h5/client";

export const dynamic = "force-dynamic";

const MODES: SpeakingMode[] = ["default", "custom", "unlimited"];

/**
 * PATCH /api/admin/speaking/[code] —— 改一台设备的每日测评次数
 *
 * 和「设备额度」（zuowen）一样，这是后台的写操作，所以：
 *   1. 要求 speaking:write；reviewer 只有 read。它直接控制成本，
 *      和审核职责无关，出错代价也不对等。
 *   2. 服务端按白名单挑字段，不把前端 body 原样转发。
 *   3. 记一行操作日志（谁、哪台设备、改成了什么）。
 *
 * 与 zuowen 的差异：H5 是三态 limitMode（default / custom / unlimited），
 * 不是 zuowen 的「开关 + 次数」。原因在 H5 那边：它的「不限次数」要显式标记，
 * 否则分不清「故意不限」和「忘了填数字」。
 */
export async function PATCH(req: Request, ctx: { params: Promise<{ code: string }> }) {
  return guarded("admin/speaking:update", async () => {
    const guard = await requireAdmin("speaking", "write");
    if (guard.error) return guard.error;

    if (!h5Configured()) {
      return ok({ error: "英语测评服务未配置", hint: h5ConfigHint() }, { status: 503 });
    }

    const { code } = await ctx.params;
    const normalized = normalizeCodeInput(code);
    if (normalized.length !== 6) {
      return ok({ error: "识别码应为 6 位（不含 0、1、O、I、L）" }, { status: 400 });
    }

    let raw: Record<string, unknown>;
    try {
      raw = (await req.json()) as Record<string, unknown>;
    } catch {
      return ok({ error: "请求格式不正确" }, { status: 400 });
    }

    const payload: { limitMode?: SpeakingMode; customLimit?: number | null; note?: string } = {};

    if (raw.limitMode !== undefined) {
      if (!MODES.includes(raw.limitMode as SpeakingMode)) {
        return ok({ error: "limitMode 只能是 default / custom / unlimited" }, { status: 400 });
      }
      payload.limitMode = raw.limitMode as SpeakingMode;
    }

    if (raw.customLimit === null || raw.customLimit === "") {
      payload.customLimit = null;
    } else if (typeof raw.customLimit === "number") {
      if (!Number.isInteger(raw.customLimit) || raw.customLimit < 1 || raw.customLimit > 200) {
        return ok({ error: "每日次数需为 1—200 的整数" }, { status: 400 });
      }
      payload.customLimit = raw.customLimit;
    } else if (raw.customLimit !== undefined) {
      return ok({ error: "customLimit 需为数字或 null" }, { status: 400 });
    }

    if (typeof raw.note === "string") payload.note = raw.note.slice(0, 40);

    // 语义护栏：custom 必须有有效次数，否则 H5 会静默回落成 default，
    // 后台看起来「保存成功」但次数没变 —— 这种静默失败最难解释。
    if (payload.limitMode === "custom" && !payload.customLimit) {
      return ok({ error: "选了「自定义次数」就必须填 1—200 的数字" }, { status: 400 });
    }

    if (Object.keys(payload).length === 0) {
      return ok({ error: "没有要修改的字段" }, { status: 400 });
    }

    const r = await h5Patch<SpeakingUpdateRaw>(`/api/internal/quota/devices/${normalized}`, payload);
    if (!r.ok) return ok({ error: r.error, hint: r.hint }, { status: r.status });

    const item = normalizeDevice(r.data.device);
    console.log(
      `[admin][speaking] ${guard.admin?.email ?? "?"} → ${item.code} ` +
        `limitMode=${payload.limitMode ?? "-"} customLimit=${payload.customLimit === undefined ? "-" : (payload.customLimit ?? "null")} ` +
        `note=${payload.note === undefined ? "-" : JSON.stringify(payload.note)}`,
    );

    return ok({ ok: true, item });
  });
}
