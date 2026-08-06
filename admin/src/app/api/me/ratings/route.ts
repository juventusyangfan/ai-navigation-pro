import { db } from "@/lib/db";
import { getMe } from "@/lib/me";
import { ok, fail, corsAuth } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsAuth() });
}

// GET /api/me/ratings?slug=xxx -> { on, score, average }
//   on:      当前用户是否已为该工具打分
//   score:   当前用户给出的分（未打分为 null）
//   average: 该工具所有打分者的平均分（即 Tool.rating 缓存值）
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const slug = searchParams.get("slug");
  if (!slug) return ok({ on: false, score: null, average: 0 }, { headers: corsAuth() });

  const tool = await db.tool.findFirst({ where: { OR: [{ id: slug }, { slug }] } });
  if (!tool) return fail(404, "工具不存在", { headers: corsAuth() });

  const me = await getMe(req);
  let score: number | null = null;
  if (me) {
    const mine = await db.rating.findUnique({
      where: { userId_toolId: { userId: me.id, toolId: tool.id } },
    });
    if (mine) score = mine.score;
  }
  return ok(
    { on: score != null, score, average: tool.rating },
    { headers: corsAuth() },
  );
}

// POST /api/me/ratings  body: { slug, score }
//   打分 / 改分（score ∈ 0.5~5，0.5 步进）/ 清除（score === 0）。
//   每次写入后按 Rating 表该工具的全部打分者重算平均分，写回 Tool.rating——
//   即「评分 = 所有打分者所打分后的平均分」。
export async function POST(req: Request) {
  const me = await getMe(req);
  if (!me) return fail(401, "请先登录后再评分", { headers: corsAuth() });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return fail(400, "请求体格式错误", { headers: corsAuth() });
  }
  const slug = String(body?.slug ?? "").trim();
  const score = Number(body?.score);
  if (!slug) return fail(400, "缺少 slug", { headers: corsAuth() });
  if (!Number.isFinite(score) || score < 0 || score > 5)
    return fail(400, "评分需在 0~5 之间", { headers: corsAuth() });

  const tool = await db.tool.findFirst({ where: { OR: [{ id: slug }, { slug }] } });
  if (!tool) return fail(404, "工具不存在", { headers: corsAuth() });
  const toolId = tool.id;

  const existing = await db.rating.findUnique({
    where: { userId_toolId: { userId: me.id, toolId } },
  });

  // score === 0 视为清除个人评分
  if (score === 0) {
    if (existing) await db.rating.delete({ where: { id: existing.id } });
  } else if (existing) {
    await db.rating.update({ where: { id: existing.id }, data: { score } });
  } else {
    await db.rating.create({ data: { userId: me.id, toolId, score } });
  }

  // 重算该工具的所有打分者平均分，写回 Tool.rating（单一真相源）
  const agg = await db.rating.aggregate({ _avg: { score: true }, where: { toolId } });
  const average = agg._avg.score ?? 0;
  await db.tool.update({ where: { id: toolId }, data: { rating: average } });

  return ok(
    { on: score !== 0, score: score !== 0 ? score : null, average },
    { headers: corsAuth() },
  );
}
