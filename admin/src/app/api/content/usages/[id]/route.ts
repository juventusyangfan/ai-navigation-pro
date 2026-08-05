import { db } from "@/lib/db";
import { ok, fail, corsHeaders } from "@/lib/http";
import { usageToApi } from "@/lib/serialize";

export const dynamic = "force-dynamic";

// 单个用法库条目（sop_paths 中 isLibraryPick 的视图），供前端 content.getUsage(id)
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const path = await db.sopPath.findFirst({
    where: { OR: [{ usageId: id }, { id }] },
    include: { steps: true, tool: true },
  });
  if (!path) return fail(404, "用法不存在");
  return ok(usageToApi(path), { headers: corsHeaders() });
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders() });
}
