import { requireAdmin, ok } from "@/lib/http";
import { guarded } from "@/lib/api-guard";
import {
  zuowenConfigured,
  zuowenConfigHint,
  zuowenGet,
  type EssayListPayload,
} from "@/lib/zuowen/client";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 20;

/**
 * GET /api/admin/essays —— 作文测评提交列表
 *
 * 数据不在 admin 库里：admin 只是「看板」，真正的数据与解密密钥都在 zuowen。
 * 所以这里做的是转发 + 统一错误语义，不做任何业务计算。
 *
 * 未配置时返回 200 + `configured:false`，而不是 500：
 * 页面要能正常打开并显示「去哪配」，而不是弹一句无用的「加载失败」。
 */
export async function GET(req: Request) {
  return guarded("admin/essays:list", async () => {
    const guard = await requireAdmin("essays", "read");
    if (guard.error) return guard.error;

    const sp = new URL(req.url).searchParams;

    if (!zuowenConfigured()) {
      return ok({
        configured: false,
        items: [],
        total: 0,
        page: 1,
        pageSize: PAGE_SIZE,
        totalPages: 1,
        stats: null,
        hint: zuowenConfigHint(),
      });
    }

    const page = Math.max(1, Number.parseInt(sp.get("page") || "1", 10) || 1);

    const r = await zuowenGet<EssayListPayload>("/api/internal/reviews", {
      page,
      pageSize: PAGE_SIZE,
      stats: 1,
      grade: sp.get("grade") || undefined,
      source: sp.get("source") || undefined,
      level: sp.get("level") || undefined,
      q: (sp.get("q") || "").trim() || undefined,
      min: sp.get("min") || undefined,
      max: sp.get("max") || undefined,
      days: sp.get("days") || undefined,
    });

    if (!r.ok) {
      return ok(
        {
          error: r.error,
          hint: r.hint,
          configured: true,
          items: [],
          total: 0,
          page,
          pageSize: PAGE_SIZE,
          totalPages: 1,
          stats: null,
        },
        { status: r.status },
      );
    }

    return ok({ configured: true, ...r.data });
  });
}
