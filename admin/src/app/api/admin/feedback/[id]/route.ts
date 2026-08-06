import { db } from "@/lib/db";
import { requireAdmin, ok, fail } from "@/lib/http";

export const dynamic = "force-dynamic";

const VALID = ["pending", "approved", "rejected"];

// PUT /api/admin/feedback/[id]  body: { status }
//   reviewer 角色可审核（feedback:review）。采纳=approved，忽略=rejected。
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireAdmin("feedback", "review");
  if (guard.error) return guard.error;

  const { id } = await params;
  const b = (await req.json().catch(() => ({}))) as { status?: string };
  if (!b.status || !VALID.includes(b.status)) return fail(400, "非法状态");

  const fb = await db.feedback.findUnique({ where: { id } });
  if (!fb) return fail(404, "反馈不存在");

  const updated = await db.feedback.update({ where: { id }, data: { status: b.status } });
  return ok({ ok: true, status: updated.status });
}
