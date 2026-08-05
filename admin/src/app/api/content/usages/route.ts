import { db } from "@/lib/db";
import { ok, corsHeaders } from "@/lib/http";
import { usageToApi } from "@/lib/serialize";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const scene = searchParams.get("scene");
  const role = searchParams.get("role");
  const toolSlug = searchParams.get("tool");

  const picks = await db.sopPath.findMany({
    include: { steps: true, tool: true },
    orderBy: { order: "asc" },
  });
  let list = picks.map(usageToApi);
  if (scene) list = list.filter((u) => u.scene === scene);
  if (role) list = list.filter((u) => u.role === role);
  if (toolSlug) list = list.filter((u) => u.tool === toolSlug);

  return ok(list, { headers: corsHeaders() });
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders() });
}
