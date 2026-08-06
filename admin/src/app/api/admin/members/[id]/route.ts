import { db } from "@/lib/db";
import { requireAdmin, ok, fail } from "@/lib/http";

export const dynamic = "force-dynamic";

const ROLES = ["teacher", "student", "parent", "school_admin"];
const STATUSES = ["active", "disabled"];

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireAdmin("users", "read");
  if (guard.error) return guard.error;

  const { id } = await params;
  const user = await db.user.findUnique({
    where: { id },
    include: {
      submissions: { orderBy: { createdAt: "desc" }, take: 10 },
    },
  });
  if (!user) return fail(404, "用户不存在");

  return ok({
    user: {
      id: user.id,
      name: user.name,
      phone: user.phone,
      role: user.role,
      status: user.status,
      createdAt: user.createdAt,
      submissions: user.submissions.map((s) => ({
        id: s.id,
        type: s.type,
        status: s.status,
        createdAt: s.createdAt,
      })),
    },
  });
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireAdmin("users", "write");
  if (guard.error) return guard.error;

  const { id } = await params;
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const user = await db.user.findUnique({ where: { id } });
  if (!user) return fail(404, "用户不存在");

  const data: Record<string, unknown> = {};
  if (typeof body.name === "string" && body.name.trim()) data.name = body.name.trim();
  if (typeof body.role === "string" && ROLES.includes(body.role)) data.role = body.role;
  if (typeof body.status === "string" && STATUSES.includes(body.status))
    data.status = body.status;

  const updated = await db.user.update({ where: { id }, data });
  return ok({
    ok: true,
    user: {
      id: updated.id,
      name: updated.name,
      phone: updated.phone,
      role: updated.role,
      status: updated.status,
    },
  });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireAdmin("users", "delete");
  if (guard.error) return guard.error;

  const { id } = await params;
  const user = await db.user.findUnique({ where: { id } });
  if (!user) return fail(404, "用户不存在");

  // 关联数据一并清理（Prisma 必填关系默认 Restrict，需显式删除）
  await db.$transaction([
    db.rating.deleteMany({ where: { userId: id } }),
    db.favorite.deleteMany({ where: { userId: id } }),
    db.note.deleteMany({ where: { userId: id } }),
    db.feedback.deleteMany({ where: { userId: id } }),
    db.submission.deleteMany({ where: { userId: id } }),
    db.user.delete({ where: { id } }),
  ]);

  return ok({ ok: true });
}
