import { db } from "@/lib/db";
import { getMe } from "@/lib/me";
import { ok, fail, corsAuth } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsAuth() });
}

// 解析收藏目标：tool 按 id 或 slug；path 按 id 或 usageId。返回真实 DB id 与当前计数。
async function resolveRef(
  refType: string,
  refId: string,
): Promise<{ id: string; count: number } | null> {
  if (refType === "tool") {
    const tool = await db.tool.findFirst({
      where: { OR: [{ id: refId }, { slug: refId }] },
    });
    return tool ? { id: tool.id, count: tool.favCount } : null;
  }
  if (refType === "lesson") {
    const lesson = await db.litLesson.findFirst({
      where: { OR: [{ id: refId }, { slug: refId }] },
    });
    return lesson ? { id: lesson.id, count: lesson.collectCount } : null;
  }
  if (refType === "path") {
    const path = await db.sopPath.findFirst({
      where: { OR: [{ id: refId }, { usageId: refId }] },
    });
    return path ? { id: path.id, count: path.collectCount } : null;
  }
  return null;
}

// GET /api/me/favorites?refType=tool|path&refId=xxx -> { on, count }
// GET /api/me/favorites?slug=xxx                   -> 兼容旧调用：视为 tool 收藏 { on, count }
// GET /api/me/favorites                            -> { slugs: string[] }（当前用户收藏的工具 slug）
export async function GET(req: Request) {
  const me = await getMe(req);
  const { searchParams } = new URL(req.url);

  const slug = searchParams.get("slug");
  const refType = searchParams.get("refType");
  const refId = searchParams.get("refId");

  if (slug) {
    const target = await resolveRef("tool", slug);
    if (!target) return ok({ on: false, count: 0 }, { headers: corsAuth() });
    const on = me
      ? !!(await db.favorite.findUnique({
          where: {
            userId_refType_refId: { userId: me.id, refType: "tool", refId: slug },
          },
        }))
      : false;
    return ok({ on, count: target.count }, { headers: corsAuth() });
  }

  if (refType && refId) {
    const target = await resolveRef(refType, refId);
    if (!target) return ok({ on: false, count: 0 }, { headers: corsAuth() });
    const on = me
      ? !!(await db.favorite.findUnique({
          where: {
            userId_refType_refId: { userId: me.id, refType, refId },
          },
        }))
      : false;
    return ok({ on, count: target.count }, { headers: corsAuth() });
  }

  // 无参数：返回收藏的工具 slug 和用法 path id 列表（个人中心「我的收藏」）
  const toolSlugs = me
    ? (
        await db.favorite.findMany({
          where: { userId: me.id, refType: "tool" },
        })
      ).map((f) => f.refId)
    : [];
  const pathIds = me
    ? (
        await db.favorite.findMany({
          where: { userId: me.id, refType: "path" },
        })
      ).map((f) => f.refId)
    : [];
  return ok({ slugs: toolSlugs, pathIds }, { headers: corsAuth() });
}

// POST /api/me/favorites  body: { refType: "tool"|"path", refId } -> 切换收藏，返回 { on, count }
export async function POST(req: Request) {
  const me = await getMe(req);
  if (!me) return fail(401, "请先登录后再收藏", { headers: corsAuth() });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return fail(400, "请求体格式错误", { headers: corsAuth() });
  }
  const refType = String(body?.refType ?? "");
  const refId = String(body?.refId ?? "").trim();
  if (refType !== "tool" && refType !== "path" && refType !== "lesson")
    return fail(400, "refType 必须为 tool / path / lesson", { headers: corsAuth() });
  if (!refId) return fail(400, "缺少 refId", { headers: corsAuth() });

  const target = await resolveRef(refType, refId);
  if (!target) return fail(404, "目标不存在", { headers: corsAuth() });

  const existing = await db.favorite.findUnique({
    where: { userId_refType_refId: { userId: me.id, refType, refId } },
  });

  if (existing) {
    await db.$transaction([
      db.favorite.delete({ where: { id: existing.id } }),
      refType === "tool"
        ? db.tool.update({
            where: { id: target.id },
            data: { favCount: { decrement: 1 } },
          })
        : db.sopPath.update({
            where: { id: target.id },
            data: { collectCount: { decrement: 1 } },
          }),
    ]);
    return ok(
      { on: false, count: Math.max(0, target.count - 1) },
      { headers: corsAuth() },
    );
  }

  await db.$transaction([
    db.favorite.create({ data: { userId: me.id, refType, refId } }),
    refType === "tool"
      ? db.tool.update({
          where: { id: target.id },
          data: { favCount: { increment: 1 } },
        })
      : db.sopPath.update({
          where: { id: target.id },
          data: { collectCount: { increment: 1 } },
        }),
  ]);
  return ok(
    { on: true, count: target.count + 1 },
    { headers: corsAuth() },
  );
}
