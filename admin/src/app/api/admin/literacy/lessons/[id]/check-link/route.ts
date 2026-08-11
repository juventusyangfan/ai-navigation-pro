import { db } from "@/lib/db";
import { requireAdmin, ok, fail } from "@/lib/http";
import { probeLink } from "@/lib/literacy/link-check";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

// POST /api/admin/literacy/lessons/[id]/check-link
// 探活该课时 officialUrl，写回 linkStatus / linkCheckedAt / linkHttpCode / linkFinalUrl / linkFailCount。
export async function POST(_req: Request, { params }: Ctx) {
  const guard = await requireAdmin("literacy", "write");
  if (guard.error) return guard.error;
  const { id } = await params;
  const lesson = await db.litLesson.findUnique({ where: { id } });
  if (!lesson) return fail(404, "课时不存在");
  if (!lesson.officialUrl) return fail(400, "该课时无 officialUrl，无法探活");

  const result = await probeLink(lesson.officialUrl);
  const failCount = result.status === "broken" ? lesson.linkFailCount + 1 : 0;

  await db.litLesson.update({
    where: { id },
    data: {
      linkStatus: result.status,
      linkCheckedAt: new Date(),
      linkHttpCode: result.httpCode ?? null,
      linkFinalUrl: result.finalUrl ?? null,
      linkFailCount: failCount,
    },
  });

  return ok({
    status: result.status,
    httpCode: result.httpCode ?? null,
    finalUrl: result.finalUrl ?? null,
  });
}
