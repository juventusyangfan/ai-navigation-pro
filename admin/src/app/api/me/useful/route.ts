import { db } from "@/lib/db";
import { getMe } from "@/lib/me";
import { ok, fail, corsAuth } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsAuth() });
}

// GET /api/me/useful?refType=tool|path&refId=xxx -> { on: boolean }
export async function GET(req: Request) {
  const me = await getMe(req);
  const { searchParams } = new URL(req.url);
  const refType = searchParams.get("refType");
  const refId = searchParams.get("refId");
  if (!refType || !refId) return ok({ on: false }, { headers: corsAuth() });

  const on = me
    ? !!(await db.useful.findUnique({
        where: {
          userId_refType_refId: { userId: me.id, refType, refId },
        },
      }))
    : false;
  return ok({ on }, { headers: corsAuth() });
}

// POST /api/me/useful  body: { refType: "tool"|"path", refId }  -> 切换「有用」，返回 { on, count }
export async function POST(req: Request) {
  const me = await getMe(req);
  if (!me) return fail(401, "请先登录后再标记", { headers: corsAuth() });

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

  // 解析目标资源，取到当前计数
  let currentCount = 0;
  let resourceId = refId; // 确保 update 用真正的 DB id
  if (refType === "tool") {
    const tool = await db.tool.findFirst({
      where: { OR: [{ id: refId }, { slug: refId }] },
    });
    if (!tool) return fail(404, "工具不存在", { headers: corsAuth() });
    currentCount = tool.useful;
    resourceId = tool.id;
  } else if (refType === "lesson") {
    const lesson = await db.litLesson.findFirst({
      where: { OR: [{ id: refId }, { slug: refId }] },
    });
    if (!lesson) return fail(404, "伴学课不存在", { headers: corsAuth() });
    currentCount = lesson.usefulCount;
    resourceId = lesson.id;
  } else {
    const path = await db.sopPath.findFirst({
      where: { OR: [{ id: refId }, { usageId: refId }] },
    });
    if (!path) return fail(404, "用法不存在", { headers: corsAuth() });
    currentCount = path.usefulCount;
    resourceId = path.id;
  }

  const existing = await db.useful.findUnique({
    where: { userId_refType_refId: { userId: me.id, refType, refId } },
  });

  if (existing) {
    await db.$transaction([
      db.useful.delete({ where: { id: existing.id } }),
      refType === "tool"
        ? db.tool.update({ where: { id: resourceId }, data: { useful: { decrement: 1 } } })
        : db.sopPath.update({ where: { id: resourceId }, data: { usefulCount: { decrement: 1 } } }),
    ]);
    return ok(
      { on: false, count: Math.max(0, currentCount - 1) },
      { headers: corsAuth() },
    );
  }

  await db.$transaction([
    db.useful.create({ data: { userId: me.id, refType, refId } }),
    refType === "tool"
      ? db.tool.update({ where: { id: resourceId }, data: { useful: { increment: 1 } } })
      : db.sopPath.update({ where: { id: resourceId }, data: { usefulCount: { increment: 1 } } }),
  ]);
  return ok(
    { on: true, count: currentCount + 1 },
    { headers: corsAuth() },
  );
}
