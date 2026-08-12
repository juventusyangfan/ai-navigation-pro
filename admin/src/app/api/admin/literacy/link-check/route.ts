import { db } from "@/lib/db";
import { ok, fail, loadSessionAdmin } from "@/lib/http";
import { userCan } from "@/lib/rbac";
import { probeLink } from "@/lib/literacy/link-check";

export const dynamic = "force-dynamic";

// POST /api/admin/literacy/link-check  body: { ids?: string[] }
// 批量探活 officialUrl。两种授权：① 管理员会话（literacy:write）；② LINKCHECK_TOKEN（定时任务）。
export async function POST(req: Request) {
  const admin = await loadSessionAdmin();
  const sessionOk = !!admin && userCan(admin, "literacy", "write");

  const token = req.headers.get("x-linkcheck-token") ?? new URL(req.url).searchParams.get("token");
  const tokenOk = !!process.env.LINKCHECK_TOKEN && token === process.env.LINKCHECK_TOKEN;

  if (!sessionOk && !tokenOk) return fail(401, "未授权");

  const b = await req.json().catch(() => ({ ids: undefined }));
  const ids = Array.isArray(b.ids) ? b.ids : undefined;

  const where: Record<string, unknown> = { officialUrl: { not: null } };
  if (ids) where.id = { in: ids };

  const lessons = await db.litLesson.findMany({
    where,
    select: { id: true, officialUrl: true },
  });

  const results: { id: string; status: string }[] = [];
  for (const l of lessons) {
    if (!l.officialUrl) continue;
    const r = await probeLink(l.officialUrl);
    const failCount = r.status === "broken" ? 1 : 0; // 批量探活不累加历史，仅反映本次结果
    await db.litLesson.update({
      where: { id: l.id },
      data: {
        linkStatus: r.status,
        linkCheckedAt: new Date(),
        linkHttpCode: r.httpCode ?? null,
        linkFinalUrl: r.finalUrl ?? null,
        linkFailCount: failCount,
      },
    });
    results.push({ id: l.id, status: r.status });
  }

  return ok({ checked: results.length, results });
}
