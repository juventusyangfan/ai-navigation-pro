import { db } from "@/lib/db";
import { ok, corsHeaders } from "@/lib/http";
import { litModuleToCard, litLessonToCard } from "@/lib/serialize";

export const dynamic = "force-dynamic";

// 聚合端点：模块 + 全量已发布课时摘要。首页与三处 generateStaticParams 共用。
export async function GET() {
  const [modules, lessons] = await Promise.all([
    db.litModule.findMany({
      where: { status: "published" },
      orderBy: { order: "asc" },
      include: { _count: { select: { lessons: true } } },
    }),
    db.litLesson.findMany({
      where: { status: "published" },
      orderBy: [{ moduleId: "asc" }, { order: "asc" }],
      include: { module: true, _count: { select: { sops: true } } },
    }),
  ]);

  return ok(
    {
      modules: modules.map(litModuleToCard),
      lessons: lessons.map((l) =>
        litLessonToCard(l, l.module.slug, l.module.title),
      ),
    },
    { headers: corsHeaders() },
  );
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders() });
}
