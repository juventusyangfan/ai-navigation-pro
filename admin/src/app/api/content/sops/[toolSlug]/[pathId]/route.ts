import { db } from "@/lib/db";
import { ok, fail, corsHeaders } from "@/lib/http";
import { pathToApi } from "@/lib/serialize";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ toolSlug: string; pathId: string }> },
) {
  const { toolSlug, pathId } = await params;
  const tool = await db.tool.findUnique({
    where: { slug: toolSlug },
    include: { paths: { include: { steps: true }, orderBy: { order: "asc" } } },
  });
  if (!tool) return fail(404, "工具不存在");
  const path = tool.paths.find((p) => p.id === pathId || p.usageId === pathId);
  if (!path) return fail(404, "SOP 路径不存在");
  return ok(pathToApi(path), { headers: corsHeaders() });
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders() });
}
