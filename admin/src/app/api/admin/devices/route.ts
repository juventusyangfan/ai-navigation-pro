import { requireAdmin, ok } from "@/lib/http";
import { guarded } from "@/lib/api-guard";
import {
  zuowenConfigured,
  zuowenConfigHint,
  zuowenGet,
  type DeviceListPayload,
} from "@/lib/zuowen/client";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 20;

/**
 * GET /api/admin/devices —— 设备额度列表
 *
 * 数据同样在 zuowen 那边（额度判断发生在它的 /api/evaluate 里），
 * admin 只做转发与权限校验，不落一份副本 —— 否则两边会有「后台显示已放开、
 * 实际仍被拦」这种对不上的情况。
 *
 * 首次进入（无搜索词、第 1 页）时带 `sync=1`：把历史上已提交过但还没有识别码的
 * 设备补上码，否则老板看不到那些家长的设备。
 */
export async function GET(req: Request) {
  return guarded("admin/devices:list", async () => {
    const guard = await requireAdmin("devices", "read");
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
        synced: 0,
        defaults: null,
        hint: zuowenConfigHint(),
      });
    }

    const page = Math.max(1, Number.parseInt(sp.get("page") || "1", 10) || 1);
    const q = (sp.get("q") || "").trim();

    const r = await zuowenGet<DeviceListPayload>("/api/internal/devices", {
      page,
      pageSize: PAGE_SIZE,
      q: q || undefined,
      sync: !q && page === 1 ? "1" : undefined,
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
          synced: 0,
          defaults: null,
        },
        { status: r.status },
      );
    }

    return ok({ configured: true, ...r.data });
  });
}
