import { db } from "@/lib/db";
import { requireAdmin, ok, fail } from "@/lib/http";
import { validateLitModule } from "@/lib/literacy/validate";
import { litModuleToDetail, litModuleToCard } from "@/lib/serialize";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  const guard = await requireAdmin("literacy", "read");
  if (guard.error) return guard.error;
  const { id } = await params;
  const m = await db.litModule.findUnique({
    where: { id },
    include: { lessons: { orderBy: { order: "asc" } } },
  });
  if (!m) return fail(404, "模块不存在");
  return ok(litModuleToDetail(m));
}

export async function PATCH(req: Request, { params }: Ctx) {
  const guard = await requireAdmin("literacy", "write");
  if (guard.error) return guard.error;
  const { id } = await params;
  const existing = await db.litModule.findUnique({ where: { id } });
  if (!existing) return fail(404, "模块不存在");

  const b = await req.json();
  const merged: Record<string, unknown> = {
    slug: b.slug ?? existing.slug,
    num: b.num ?? existing.num,
    title: b.title ?? existing.title,
    summary: b.summary ?? existing.summary,
    desc: b.desc ?? existing.desc,
    icon: b.icon ?? existing.icon,
    goal: b.goal !== undefined ? b.goal : existing.goal,
    toolSlugs: b.toolSlugs ?? JSON.parse(existing.toolSlugs),
    keywords: b.keywords ?? JSON.parse(existing.keywords),
    status: b.status ?? existing.status,
    order: typeof b.order === "number" ? b.order : existing.order,
  };
  const v = validateLitModule(merged);
  if (!v.ok) return fail(422, v.error ?? "校验失败");

  if (b.slug && b.slug !== existing.slug) {
    const dup = await db.litModule.findUnique({ where: { slug: b.slug } });
    if (dup) return fail(409, "slug 已存在");
  }

  const m = await db.litModule.update({
    where: { id },
    data: {
      slug: String(merged.slug),
      num: String(merged.num),
      title: String(merged.title),
      summary: String(merged.summary),
      desc: String(merged.desc),
      icon: String(merged.icon),
      goal: (merged.goal as string | null) ?? null,
      toolSlugs: JSON.stringify(merged.toolSlugs),
      keywords: JSON.stringify(merged.keywords),
      status: String(merged.status),
      order: Number(merged.order),
    },
  });
  return ok(litModuleToCard(m));
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const guard = await requireAdmin("literacy", "delete");
  if (guard.error) return guard.error;
  const { id } = await params;
  const m = await db.litModule.findUnique({ where: { id } });
  if (!m) return fail(404, "模块不存在");
  const c = await db.litLesson.count({ where: { moduleId: id } });
  if (c > 0) return fail(409, `该模块下还有 ${c} 节课，请先迁移或删除课时`);
  await db.litModule.delete({ where: { id } });
  return ok({ ok: true });
}
