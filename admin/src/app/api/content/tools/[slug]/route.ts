import { db } from "@/lib/db";
import { ok, fail, corsHeaders } from "@/lib/http";
import { toolToApi } from "@/lib/serialize";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const tool = await db.tool.findUnique({
    where: { slug },
    include: { paths: { include: { steps: true }, orderBy: { order: "asc" } } },
  });
  if (!tool || tool.status !== "published") return fail(404, "工具不存在");
  return ok(toolToApi(tool), { headers: corsHeaders() });
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders() });
}
