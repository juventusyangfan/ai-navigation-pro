import { db } from "@/lib/db";
import { requireAdmin, ok, fail } from "@/lib/http";
import { validateLitLesson } from "@/lib/literacy/validate";
import { litLessonToDetail, litLessonToCard } from "@/lib/serialize";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  const guard = await requireAdmin("literacy", "read");
  if (guard.error) return guard.error;
  const { id } = await params;
  const lesson = await db.litLesson.findUnique({
    where: { id },
    include: {
      module: true,
      _count: { select: { sops: true } },
      sops: {
        orderBy: { order: "asc" },
        include: { sopPath: { include: { tool: true, _count: { select: { steps: true } } } } },
      },
    },
  });
  if (!lesson) return fail(404, "课时不存在");
  return ok(litLessonToDetail(lesson as never, lesson.module.slug, lesson.module.title));
}

export async function PATCH(req: Request, { params }: Ctx) {
  const guard = await requireAdmin("literacy", "write");
  if (guard.error) return guard.error;

  try {
    const { id } = await params;
    const existing = await db.litLesson.findUnique({ where: { id }, include: { module: true } });
    if (!existing) return fail(404, "课时不存在");

    const b = await req.json().catch(() => {
      throw new Error("请求体格式错误");
    });

    let moduleId = existing.moduleId;
    if (b.moduleSlug && b.moduleSlug !== existing.module.slug) {
      const m = await db.litModule.findUnique({ where: { slug: b.moduleSlug } });
      if (!m) return fail(404, "目标模块不存在");
      moduleId = m.id;
    }

    const merged: Record<string, unknown> = {
      slug: b.slug ?? existing.slug,
      title: b.title ?? existing.title,
      order: typeof b.order === "number" ? b.order : existing.order,
      source: b.source ?? existing.source,
      officialUrl: b.officialUrl !== undefined ? b.officialUrl : existing.officialUrl,
      officialProvider:
        b.officialProvider !== undefined ? b.officialProvider : existing.officialProvider,
      officialCourseId:
        b.officialCourseId !== undefined ? b.officialCourseId : existing.officialCourseId,
      officialColumn: b.officialColumn !== undefined ? b.officialColumn : existing.officialColumn,
      stage: b.stage !== undefined ? b.stage : existing.stage,
      durationMin: b.durationMin !== undefined ? b.durationMin : existing.durationMin,
      hook: b.hook ?? existing.hook,
      guideIntro: b.guideIntro ?? existing.guideIntro,
      watchPoints: b.watchPoints ?? JSON.parse(existing.watchPoints),
      afterAction: b.afterAction ?? existing.afterAction,
      editorNote: b.editorNote !== undefined ? b.editorNote : existing.editorNote,
      faq: b.faq ?? JSON.parse(existing.faq),
      keywords: b.keywords ?? JSON.parse(existing.keywords),
      linkStatus: b.linkStatus ?? existing.linkStatus,
      fallbackUrl: b.fallbackUrl !== undefined ? b.fallbackUrl : existing.fallbackUrl,
      archiveNote: b.archiveNote !== undefined ? b.archiveNote : existing.archiveNote,
      status: b.status ?? existing.status,
      moduleId,
    };
    const v = validateLitLesson(merged);
    if (!v.ok) return fail(422, v.error ?? "校验失败");

    if (b.slug && b.slug !== existing.slug) {
      const dup = await db.litLesson.findUnique({ where: { slug: b.slug } });
      if (dup) return fail(409, "slug 已存在");
    }

    const lesson = await db.litLesson.update({
      where: { id },
      data: {
        moduleId,
        slug: String(merged.slug),
        title: String(merged.title),
        order: Number(merged.order),
        source: String(merged.source),
        officialUrl: (merged.officialUrl as string | null) ?? null,
        officialProvider: (merged.officialProvider as string | null) ?? null,
        officialCourseId: (merged.officialCourseId as string | null) ?? null,
        officialColumn: (merged.officialColumn as string | null) ?? null,
        stage: (merged.stage as string | null) ?? null,
        durationMin: (merged.durationMin as number | null) ?? null,
        hook: String(merged.hook),
        guideIntro: String(merged.guideIntro),
        watchPoints: JSON.stringify(merged.watchPoints),
        afterAction: String(merged.afterAction),
        editorNote: (merged.editorNote as string | null) ?? null,
        faq: JSON.stringify(merged.faq),
        keywords: JSON.stringify(merged.keywords),
        linkStatus: String(merged.linkStatus),
        fallbackUrl: (merged.fallbackUrl as string | null) ?? null,
        archiveNote: (merged.archiveNote as string | null) ?? null,
        status: String(merged.status),
      },
      include: { module: true },
    });
    return ok(litLessonToCard(lesson, lesson.module.slug, lesson.module.title));
  } catch (e) {
    const msg = e instanceof Error ? e.message : "更新课时失败";
    return fail(500, msg);
  }
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const guard = await requireAdmin("literacy", "delete");
  if (guard.error) return guard.error;
  const { id } = await params;
  const lesson = await db.litLesson.findUnique({ where: { id } });
  if (!lesson) return fail(404, "课时不存在");
  await db.litLesson.delete({ where: { id } });
  return ok({ ok: true });
}
