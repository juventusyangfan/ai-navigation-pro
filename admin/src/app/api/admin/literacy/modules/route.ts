import { db } from "@/lib/db";
import { requireAdmin, ok, fail } from "@/lib/http";
import { validateLitModule } from "@/lib/literacy/validate";
import { litModuleToCard } from "@/lib/serialize";

export const dynamic = "force-dynamic";

export async function GET() {
  const guard = await requireAdmin("literacy", "read");
  if (guard.error) return guard.error;
  const modules = await db.litModule.findMany({
    orderBy: { order: "asc" },
    include: { _count: { select: { lessons: true } } },
  });
  return ok(modules.map(litModuleToCard));
}

export async function POST(req: Request) {
  const guard = await requireAdmin("literacy", "write");
  if (guard.error) return guard.error;
  const b = await req.json();
  const v = validateLitModule(b);
  if (!v.ok) return fail(422, v.error ?? "校验失败");

  const exist = await db.litModule.findUnique({ where: { slug: b.slug } });
  if (exist) return fail(409, "slug 已存在");

  const maxOrder = await db.litModule.count();
  const m = await db.litModule.create({
    data: {
      slug: b.slug,
      num: b.num,
      title: b.title,
      summary: b.summary,
      desc: b.desc,
      icon: b.icon ?? "BookOpen",
      goal: b.goal ?? null,
      toolSlugs: JSON.stringify(b.toolSlugs ?? []),
      keywords: JSON.stringify(b.keywords ?? []),
      status: b.status ?? "draft",
      order: typeof b.order === "number" ? b.order : maxOrder,
    },
  });
  return ok(litModuleToCard(m), { status: 201 });
}
