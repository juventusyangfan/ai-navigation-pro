import { requireAdmin, ok } from "@/lib/http";
import { guarded } from "@/lib/api-guard";
import {
  zuowenConfigured,
  zuowenConfigHint,
  zuowenGet,
  zuowenPublicBase,
  type EssayDetailPayload,
} from "@/lib/zuowen/client";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/essays/[id] —— 单篇详情
 *
 * `?text=1` 时才向 zuowen 取解密正文；默认不取。
 * 这不是性能考虑，是隐私考虑：孩子的作文不该在打开详情页的瞬间就铺在屏幕上，
 * 需要看原文时由人点一次。
 */
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return guarded("admin/essays:detail", async () => {
    const guard = await requireAdmin("essays", "read");
    if (guard.error) return guard.error;

    if (!zuowenConfigured()) {
      return ok({ error: "作文测评服务未配置", hint: zuowenConfigHint() }, { status: 503 });
    }

    const { id } = await ctx.params;
    if (!/^[a-z0-9]{10,40}$/i.test(id)) return ok({ error: "id 格式不正确" }, { status: 400 });

    const withText = new URL(req.url).searchParams.get("text") === "1";

    const r = await zuowenGet<EssayDetailPayload>(`/api/internal/reviews/${id}`, {
      text: withText ? "1" : "0",
    });
    if (!r.ok) return ok({ error: r.error, hint: r.hint }, { status: r.status });

    return ok({
      ...r.data,
      // 家长手里的报告页地址。由服务端拼，前端不硬编码域名：
      // 换域名只改 ZUOWEN_PUBLIC_BASE，不用重新构建页面。
      publicUrl: `${zuowenPublicBase()}/r/${id}`,
    });
  });
}
