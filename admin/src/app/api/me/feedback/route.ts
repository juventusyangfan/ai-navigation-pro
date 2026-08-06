import { db } from "@/lib/db";
import { getMe } from "@/lib/me";
import { ok, fail, corsAuth } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsAuth() });
}

// GET /api/me/feedback -> 当前登录用户提交的反馈列表（含工具名、状态）
// 注意：Feedback 模型未定义 tool/user 关系字段（仅有 toolId/userId 标量），
// 故此处不使用 include，避免 Prisma 报 "Unknown field"；改为单独查关联表。
export async function GET(req: Request) {
  const me = await getMe(req);
  if (!me) return fail(401, "请先登录", { headers: corsAuth() });

  const items = await db.feedback.findMany({
    where: { userId: me.id },
    orderBy: { createdAt: "desc" },
  });

  const toolIds = Array.from(new Set(items.map((f) => f.toolId)));
  const tools = toolIds.length
    ? await db.tool.findMany({
        where: { id: { in: toolIds } },
        select: { id: true, name: true, slug: true },
      })
    : [];
  const toolMap = new Map(tools.map((t) => [t.id, t]));

  return ok(
    {
      items: items.map((f) => ({
        id: f.id,
        toolSlug: toolMap.get(f.toolId)?.slug ?? "",
        toolName: toolMap.get(f.toolId)?.name ?? "未知工具",
        type: f.type,
        text: f.text,
        status: f.status,
        ts: f.createdAt.getTime(),
      })),
    },
    { headers: corsAuth() },
  );
}

// POST /api/me/feedback  body: { slug, type, text }
//   type: "纠错" | "建议"；text 非空、≤2000 字。落库 Feedback 表（status=pending）。
export async function POST(req: Request) {
  const me = await getMe(req);
  if (!me) return fail(401, "请先登录后再提交反馈", { headers: corsAuth() });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return fail(400, "请求体格式错误", { headers: corsAuth() });
  }
  const slug = String(body?.slug ?? "").trim();
  const type = String(body?.type ?? "").trim();
  const text = String(body?.text ?? "").trim();

  if (!slug) return fail(400, "缺少 slug", { headers: corsAuth() });
  if (type !== "纠错" && type !== "建议") return fail(400, "反馈类型不合法", { headers: corsAuth() });
  if (!text) return fail(400, "反馈内容不能为空", { headers: corsAuth() });
  if (text.length > 2000) return fail(400, "反馈内容过长（≤2000 字）", { headers: corsAuth() });

  const tool = await db.tool.findFirst({ where: { OR: [{ id: slug }, { slug }] } });
  if (!tool) return fail(404, "工具不存在", { headers: corsAuth() });

  const created = await db.feedback.create({
    data: { userId: me.id, toolId: tool.id, type, text },
  });
  return ok({ id: created.id, status: created.status }, { headers: corsAuth() });
}
