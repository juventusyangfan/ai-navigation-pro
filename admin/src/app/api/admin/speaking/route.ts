import { requireAdmin, ok } from "@/lib/http";
import { guarded } from "@/lib/api-guard";
import {
  h5Configured,
  h5ConfigHint,
  h5Get,
  normalizeDevice,
  type SpeakingListRaw,
} from "@/lib/h5/client";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 20;

/**
 * GET /api/admin/speaking —— 英语听说测评的设备额度列表
 *
 * 数据在 H5 后端的 server/.data/quota.json（次数扣减发生在它的 /api/quota/start 里），
 * admin 只做转发与权限校验，**不落副本** —— 一旦后台自己存一份，
 * 就会出现「后台显示已放开、家长仍被拦」这种最难查的对不上。
 *
 * 与 zuowen 的「设备额度」是两套独立数据：同一个家长可能两个工具都用，
 * 但两个应用各发各的 Cookie、各记各的账，不互通（也不该互通，见 README）。
 */
export async function GET(req: Request) {
  return guarded("admin/speaking:list", async () => {
    const guard = await requireAdmin("speaking", "read");
    if (guard.error) return guard.error;

    const sp = new URL(req.url).searchParams;

    if (!h5Configured()) {
      return ok({
        configured: false,
        items: [],
        total: 0,
        page: 1,
        pageSize: PAGE_SIZE,
        totalPages: 1,
        defaults: null,
        today: null,
        hint: h5ConfigHint(),
      });
    }

    const page = Math.max(1, Number.parseInt(sp.get("page") || "1", 10) || 1);
    const q = (sp.get("q") || "").trim();

    const r = await h5Get<SpeakingListRaw>("/api/internal/quota/devices", {
      page,
      pageSize: PAGE_SIZE,
      q: q || undefined,
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
          defaults: null,
          today: null,
        },
        { status: r.status },
      );
    }

    const d = r.data;
    return ok({
      configured: true,
      total: d.total,
      page: d.page,
      pageSize: d.pageSize,
      totalPages: Math.max(1, Math.ceil(d.total / (d.pageSize || PAGE_SIZE))),
      items: (d.items || []).map(normalizeDevice),
      defaults: d.defaults,
      today: d.today,
    });
  });
}
