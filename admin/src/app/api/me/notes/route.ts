import { db } from "@/lib/db";
import { getMe } from "@/lib/me";
import { ok, fail, corsAuth } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsAuth() });
}

// GET /api/me/notes?refType&refId -> { content }（单条，供 NoteBox 挂载时回填）
// GET /api/me/notes            -> { items:[{refType,refId,content,ts}] }（全部，供个人中心）
export async function GET(req: Request) {
  const me = await getMe(req);
  if (!me) return fail(401, "请先登录", { headers: corsAuth() });

  const { searchParams } = new URL(req.url);
  const refType = searchParams.get("refType");
  const refId = searchParams.get("refId");

  if (refType && refId) {
    const n = await db.note.findUnique({
      where: { userId_refType_refId: { userId: me.id, refType, refId } },
    });
    return ok({ content: n?.content ?? "" }, { headers: corsAuth() });
  }

  const items = await db.note.findMany({
    where: { userId: me.id },
    orderBy: { updatedAt: "desc" },
  });
  return ok(
    {
      items: items.map((n) => ({
        refType: n.refType,
        refId: n.refId,
        content: n.content,
        ts: n.updatedAt.getTime(),
      })),
    },
    { headers: corsAuth() },
  );
}

// POST /api/me/notes  body: { refType, refId, content }
//   按 (userId, refType, refId) upsert——同一资源只保留最新一份笔记。
export async function POST(req: Request) {
  const me = await getMe(req);
  if (!me) return fail(401, "请先登录后再保存笔记", { headers: corsAuth() });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return fail(400, "请求体格式错误", { headers: corsAuth() });
  }
  const refType = String(body?.refType ?? "").trim();
  const refId = String(body?.refId ?? "").trim();
  const content = String(body?.content ?? "");

  if (!refType || !refId) return fail(400, "缺少 refType / refId", { headers: corsAuth() });

  await db.note.upsert({
    where: { userId_refType_refId: { userId: me.id, refType, refId } },
    create: { userId: me.id, refType, refId, content },
    update: { content },
  });
  return ok({ ok: true }, { headers: corsAuth() });
}
