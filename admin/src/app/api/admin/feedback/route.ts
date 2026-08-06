import { db } from "@/lib/db";
import { requireAdmin, ok, fail } from "@/lib/http";

export const dynamic = "force-dynamic";

// GET /api/admin/feedback?status=pending|approved|rejected|all
//   reviewer 角色可读（feedback:read）。
// 注意：Feedback 模型未定义 tool/user 关系字段（仅有 toolId/userId 标量），
// 故此处不使用 include，避免 Prisma 报 "Unknown field"；改为单独查关联表。
export async function GET(req: Request) {
  const guard = await requireAdmin("feedback", "read");
  if (guard.error) return guard.error;

  const status = new URL(req.url).searchParams.get("status");
  const where = status && status !== "all" ? { status } : {};

  const items = await db.feedback.findMany({
    where,
    orderBy: { createdAt: "desc" },
  });

  const toolIds = Array.from(new Set(items.map((f) => f.toolId)));
  const userIds = Array.from(new Set(items.map((f) => f.userId)));
  const tools = toolIds.length
    ? await db.tool.findMany({
        where: { id: { in: toolIds } },
        select: { id: true, name: true, slug: true },
      })
    : [];
  const users = userIds.length
    ? await db.user.findMany({
        where: { id: { in: userIds } },
        select: { id: true, name: true },
      })
    : [];
  const toolMap = new Map(tools.map((t) => [t.id, t]));
  const userMap = new Map(users.map((u) => [u.id, u]));

  return ok(
    items.map((f) => ({
      id: f.id,
      type: f.type,
      text: f.text,
      status: f.status,
      createdAt: f.createdAt,
      toolName: toolMap.get(f.toolId)?.name ?? "未知工具",
      toolSlug: toolMap.get(f.toolId)?.slug ?? "",
      userName: userMap.get(f.userId)?.name ?? "未知用户",
    })),
  );
}
