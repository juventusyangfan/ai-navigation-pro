import { db } from "@/lib/db";
import { requireAdmin, ok, fail } from "@/lib/http";
import { validateLitLesson } from "@/lib/literacy/validate";
import { litLessonToCard } from "@/lib/serialize";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const guard = await requireAdmin("literacy", "read");
  if (guard.error) return guard.error;
  const { searchParams } = new URL(req.url);
  const moduleId = searchParams.get("moduleId");
  const source = searchParams.get("source");

  const where: Record<string, unknown> = {};
  if (moduleId) where.moduleId = moduleId;
  if (source) where.source = source;

  const lessons = await db.litLesson.findMany({
    where,
    orderBy: [{ moduleId: "asc" }, { order: "asc" }],
    include: { module: true, _count: { select: { sops: true } } },
  });
  return ok(
    lessons.map((l) => litLessonToCard(l, l.module.slug, l.module.title)),
  );
}

export async function POST(req: Request) {
  const guard = await requireAdmin("literacy", "write");
  if (guard.error) return guard.error;

  try {
    const b = await req.json().catch(() => {
      throw new Error("请求体格式错误");
    });

    // moduleSlug -> moduleId
    let moduleId = b.moduleId;
    if (!moduleId && b.moduleSlug) {
      const m = await db.litModule.findUnique({ where: { slug: b.moduleSlug } });
      if (!m) return fail(404, "模块不存在");
      moduleId = m.id;
    }
    if (!moduleId) return fail(400, "moduleId 或 moduleSlug 必填");

    const v = validateLitLesson({ ...b, moduleId });
    if (!v.ok) return fail(422, v.error ?? "校验失败");

    const exist = await db.litLesson.findUnique({ where: { slug: b.slug } });
    if (exist) return fail(409, "slug 已存在");

    const order =
      typeof b.order === "number"
        ? b.order
        : await db.litLesson.count({ where: { moduleId } });

    const lesson = await db.litLesson.create({
      data: {
        moduleId,
        slug: b.slug,
        title: b.title,
        order,
        source: b.source ?? "official",
        officialUrl: b.officialUrl ?? null,
        officialProvider: b.officialProvider ?? "国家中小学智慧教育平台",
        officialCourseId: b.officialCourseId ?? null,
        officialColumn: b.officialColumn ?? "学AI",
        stage: b.stage ?? null,
        durationMin: b.durationMin ?? null,
        hook: b.hook,
        guideIntro: b.guideIntro,
        watchPoints: JSON.stringify(b.watchPoints ?? []),
        afterAction: b.afterAction,
        editorNote: b.editorNote ?? null,
        faq: JSON.stringify(b.faq ?? []),
        keywords: JSON.stringify(b.keywords ?? []),
        linkStatus: b.linkStatus ?? "unchecked",
        fallbackUrl: b.fallbackUrl ?? null,
        archiveNote: b.archiveNote ?? null,
        status: b.status ?? "draft",
      },
    });
    const mod = await db.litModule.findUnique({ where: { id: moduleId } });
    if (!mod) return fail(500, "模块数据异常，请联系管理员");
    return ok(litLessonToCard(lesson, mod.slug, mod.title), { status: 201 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "创建课时失败";
    return fail(500, msg);
  }
}
