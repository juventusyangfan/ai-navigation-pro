import { db } from "@/lib/db";
import { requireAdmin, ok, fail } from "@/lib/http";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

// PUT /api/admin/literacy/lessons/[id]/sops  body: { sops: [{ sopPathId, reason? }] }
// 全量替换该课时的 SOP 关联（多对多）。无效 sopPathId 跳过。
export async function PUT(req: Request, { params }: Ctx) {
  const guard = await requireAdmin("literacy", "write");
  if (guard.error) return guard.error;
  const { id } = await params;
  const lesson = await db.litLesson.findUnique({ where: { id } });
  if (!lesson) return fail(404, "课时不存在");

  const b = await req.json().catch(() => ({ sops: [] }));
  const items = Array.isArray(b.sops) ? b.sops : [];

  await db.$transaction(async (tx) => {
    await tx.litLessonSop.deleteMany({ where: { lessonId: id } });
    for (let i = 0; i < items.length; i++) {
      const s = items[i] as { sopPathId?: string; reason?: string };
      if (!s?.sopPathId) continue;
      const sop = await tx.sopPath.findUnique({ where: { id: s.sopPathId } });
      if (!sop) continue;
      await tx.litLessonSop.create({
        data: {
          lessonId: id,
          sopPathId: s.sopPathId,
          order: i,
          reason: s.reason ?? null,
        },
      });
    }
  });

  return ok({ ok: true });
}
