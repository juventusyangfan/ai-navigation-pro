import { db } from "@/lib/db";
import { requireAdmin, ok, fail } from "@/lib/http";
import { getSessionPayload } from "@/lib/auth";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

const VALID = ["pending", "approved", "rejected"];

export async function GET(_req: Request, { params }: Ctx) {
  const guard = await requireAdmin("submissions", "read");
  if (guard.error) return guard.error;
  const { id } = await params;
  const sub = await db.submission.findUnique({
    where: { id },
    include: { user: { select: { id: true, name: true, email: true } } },
  });
  if (!sub) return fail(404, "投稿不存在");
  return ok(sub);
}

export async function PUT(req: Request, { params }: Ctx) {
  const guard = await requireAdmin("submissions", "review");
  if (guard.error) return guard.error;
  const { id } = await params;
  const b = (await req.json().catch(() => ({}))) as { status?: string };
  if (!b.status || !VALID.includes(b.status)) return fail(400, "非法状态");

  const sub = await db.submission.findUnique({ where: { id } });
  if (!sub) return fail(404, "投稿不存在");

  const session = await getSessionPayload();
  const updated = await db.submission.update({
    where: { id },
    data: { status: b.status, reviewerId: session?.sub || guard.admin!.id },
  });
  return ok({ ok: true, status: updated.status });
}
