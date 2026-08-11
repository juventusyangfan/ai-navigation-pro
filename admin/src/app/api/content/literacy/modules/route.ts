import { db } from "@/lib/db";
import { ok, corsHeaders } from "@/lib/http";
import { litModuleToCard } from "@/lib/serialize";

export const dynamic = "force-dynamic";

export async function GET() {
  const modules = await db.litModule.findMany({
    where: { status: "published" },
    orderBy: { order: "asc" },
    include: { _count: { select: { lessons: true } } },
  });
  return ok(modules.map(litModuleToCard), { headers: corsHeaders() });
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders() });
}
