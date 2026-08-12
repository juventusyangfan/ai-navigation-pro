import { db } from "@/lib/db";
import { ok, fail, corsHeaders } from "@/lib/http";
import { litModuleToDetail } from "@/lib/serialize";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const m = await db.litModule.findFirst({
    where: { slug, status: "published" },
    include: {
      _count: { select: { lessons: true } },
      lessons: {
        where: { status: "published" },
        orderBy: { order: "asc" },
        include: { module: true, _count: { select: { sops: true } } },
      },
    },
  });
  if (!m) return fail(404, "模块不存在");
  return ok(
    litModuleToDetail(m as Parameters<typeof litModuleToDetail>[0]),
    { headers: corsHeaders() },
  );
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders() });
}
