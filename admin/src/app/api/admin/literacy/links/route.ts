import { db } from "@/lib/db";
import { requireAdmin, ok, fail } from "@/lib/http";

export const dynamic = "force-dynamic";

// GET /api/admin/literacy/links?status=broken|warn|ok|unchecked
// 外链健康列表：课时 + 当前 linkStatus + 探活元信息，供后台「外链健康」页。
export async function GET(req: Request) {
  const guard = await requireAdmin("literacy", "read");
  if (guard.error) return guard.error;
  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");

  const where: Record<string, unknown> = {};
  if (status) where.linkStatus = status;

  const lessons = await db.litLesson.findMany({
    where,
    orderBy: [{ linkStatus: "asc" }, { updatedAt: "desc" }],
    include: { module: { select: { slug: true, title: true } } },
    take: 500,
  });

  return ok(
    lessons.map((l) => ({
      id: l.id,
      slug: l.slug,
      title: l.title,
      moduleTitle: l.module.title,
      moduleSlug: l.module.slug,
      source: l.source,
      officialUrl: l.officialUrl,
      fallbackUrl: l.fallbackUrl,
      linkStatus: l.linkStatus,
      linkCheckedAt: l.linkCheckedAt,
      linkHttpCode: l.linkHttpCode,
      linkFinalUrl: l.linkFinalUrl,
      linkFailCount: l.linkFailCount,
    })),
  );
}
