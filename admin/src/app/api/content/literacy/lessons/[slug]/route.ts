import { db } from "@/lib/db";
import { ok, fail, corsHeaders } from "@/lib/http";
import { litLessonToDetail } from "@/lib/serialize";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;

  // 先按 slug 取（不限状态），再按状态分流。
  const lesson = await db.litLesson.findFirst({
    where: { slug },
    include: {
      module: true,
      _count: { select: { sops: true } },
      sops: {
        orderBy: { order: "asc" },
        include: {
          sopPath: {
            include: { tool: true, _count: { select: { steps: true } } },
          },
        },
      },
    },
  });
  if (!lesson) return fail(404, "伴学课不存在");

  // L3 降级：整节报废（archived）时 301 到模块页，页面不 404（架构红线③：外链失效 ≠ 页面失效）。
  if (lesson.status === "archived") {
    return new Response(null, {
      status: 301,
      headers: { Location: `/literacy/${lesson.module.slug}` },
    });
  }
  // draft 等非发布态不对外暴露。
  if (lesson.status !== "published") return fail(404, "伴学课不存在");

  // 同模块内上下篇（仅已发布）
  const siblings = await db.litLesson.findMany({
    where: { moduleId: lesson.moduleId, status: "published" },
    orderBy: { order: "asc" },
    select: { slug: true, title: true, moduleId: true },
  });
  const idx = siblings.findIndex((s) => s.slug === lesson.slug);
  const prev =
    idx > 0
      ? {
          slug: siblings[idx - 1].slug,
          title: siblings[idx - 1].title,
          moduleSlug: lesson.module.slug,
        }
      : undefined;
  const next =
    idx >= 0 && idx < siblings.length - 1
      ? {
          slug: siblings[idx + 1].slug,
          title: siblings[idx + 1].title,
          moduleSlug: lesson.module.slug,
        }
      : undefined;

  return ok(
    litLessonToDetail(
      lesson as Parameters<typeof litLessonToDetail>[0],
      lesson.module.slug,
      lesson.module.title,
      { prev, next },
    ),
    { headers: corsHeaders() },
  );
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders() });
}
