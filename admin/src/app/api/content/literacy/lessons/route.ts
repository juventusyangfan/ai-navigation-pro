import { db } from "@/lib/db";
import { ok, corsHeaders } from "@/lib/http";
import { litLessonToCard } from "@/lib/serialize";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const moduleSlug = searchParams.get("module");
  const source = searchParams.get("source");
  const stage = searchParams.get("stage");
  const link = searchParams.get("link");
  const limit = Math.min(
    Number(searchParams.get("limit") ?? 200) || 200,
    500,
  );

  const where: Record<string, unknown> = { status: "published" };
  if (source) where.source = source;
  if (stage) where.stage = stage;
  if (link) where.linkStatus = link;

  const lessons = await db.litLesson.findMany({
    where,
    orderBy: [{ moduleId: "asc" }, { order: "asc" }],
    include: { module: true, _count: { select: { sops: true } } },
    take: limit,
  });

  // 模块 slug 过滤在应用层做（module 是关联字段，避免复杂 where 嵌套）
  const filtered = moduleSlug
    ? lessons.filter((l) => l.module.slug === moduleSlug)
    : lessons;

  return ok(
    filtered.map((l) => litLessonToCard(l, l.module.slug, l.module.title)),
    { headers: corsHeaders() },
  );
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders() });
}
