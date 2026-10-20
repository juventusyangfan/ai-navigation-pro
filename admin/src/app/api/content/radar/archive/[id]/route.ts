import { db } from "@/lib/db";
import { ok, corsHeaders } from "@/lib/http";
import { toPublicItem } from "@/lib/radar/serialize";
import { todayIso } from "@/lib/radar/gate";

export const dynamic = "force-dynamic";

/**
 * 公开只读 API：单期「往期」详情。
 *
 * ── 取数边界（这是本接口唯一需要防的事）──────────────────────────────────
 * 前端会把 id 放进 URL，所以 id 是**可被枚举猜测的**。因此查询条件必须由服务端
 * 自己锁死「这一期是否允许公开看」，不能只靠 `findUnique({ id })`：
 *
 *   publishedAt 非空    → 从未发布过的草稿一律取不到
 *   status ∈ {published, hidden}
 *                       → published 是当前期，hidden 是被新一期替下去的往期；
 *                         draft / rolled_back 一律 404，不给「回滚了但还能翻到」的口子
 *
 * 条目层再收一次：只返回 status = "published" 的条目。
 * 单条被人工下架（archived）或发布复查未通过的，绝不能从往期页“复活”。
 *
 * ── 空态语义 ──────────────────────────────────────────────────────────
 *   ok          该期有可展示条目
 *   empty       该期存在但条目全被归档（整批回滚后仍请求旧链接的场景）
 *   not-found   期次不存在 / 未公开 / id 非法
 *   error       技术故障（503，前端据此区分「没有」与「坏了」）
 */
type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const headers = { ...(await corsHeaders()), "Cache-Control": "no-store" };
  try {
    return await handleDetail(ctx, headers);
  } catch (e) {
    console.error("[radar:archive:detail] 往期详情未捕获异常：", e);
    return ok(
      {
        status: "error",
        generatedAt: new Date().toISOString(),
        edition: null,
        isCurrent: false,
        groups: { A: [], B: [], C: [] },
        notice: "该期内容暂时不可用，请稍后重试。",
        error: e instanceof Error ? e.message : String(e),
      },
      { status: 503, headers },
    );
  }
}

async function handleDetail({ params }: Ctx, headers: Record<string, string>) {
  const { id } = await params;
  // cuid 至少 20 位；明显不是 id 的直接 404，省一次数据库往返
  if (!id || id.length < 8 || id.length > 64) {
    return ok(
      {
        status: "not-found",
        generatedAt: new Date().toISOString(),
        edition: null,
        isCurrent: false,
        groups: { A: [], B: [], C: [] },
        notice: "该期内容不存在或已不再公开。",
      },
      { status: 404, headers },
    );
  }

  const today = todayIso();

  const edition = await db.radarEdition.findFirst({
    where: {
      id,
      publishedAt: { not: null },
      status: { in: ["published", "hidden"] },
    },
    include: {
      events: {
        where: { status: "published" },
        orderBy: [{ sortOrder: "asc" }],
      },
    },
  });

  if (!edition) {
    return ok(
      {
        status: "not-found",
        generatedAt: new Date().toISOString(),
        edition: null,
        isCurrent: false,
        groups: { A: [], B: [], C: [] },
        notice: "该期内容不存在或已不再公开。",
      },
      { status: 404, headers },
    );
  }

  // 是否当前期：取一次最新 published 期次比对。往期页据此给出「去首页看最新」的引导。
  const current = await db.radarEdition.findFirst({
    where: { status: "published" },
    orderBy: [{ publishedAt: "desc" }, { runDate: "desc" }],
    select: { id: true },
  });
  const isCurrent = current?.id === edition.id;

  const items = edition.events.map((e) => toPublicItem(e, today));
  const groups = {
    A: items.filter((i) => i.bucket === "A"),
    B: items.filter((i) => i.bucket === "B"),
    C: items.filter((i) => i.bucket === "C"),
  };

  return ok(
    {
      status: items.length ? "ok" : "empty",
      generatedAt: new Date().toISOString(),
      isCurrent,
      // 字段与 /api/content/radar 的 edition 保持一致，前台可复用同一套渲染
      edition: {
        id: edition.id,
        title: edition.title,
        runDate: edition.runDate,
        windowStart: edition.windowStart,
        windowEnd: edition.windowEnd,
        publishedAt: edition.publishedAt?.toISOString() ?? null,
        counts: { A: groups.A.length, B: groups.B.length, C: groups.C.length },
      },
      groups,
      notice: items.length ? null : "该期内容已全部撤下，暂无可查看的条目。",
    },
    { headers },
  );
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: await corsHeaders() });
}
