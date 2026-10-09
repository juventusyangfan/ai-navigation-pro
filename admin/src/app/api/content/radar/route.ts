import { db } from "@/lib/db";
import { ok, corsHeaders } from "@/lib/http";
import { toPublicItem } from "@/lib/radar/serialize";
import { todayIso } from "@/lib/radar/gate";

export const dynamic = "force-dynamic";

/**
 * 公开只读 API：前台「赛事雷达」H5 的唯一数据源。
 *
 * 空态语义是本接口最要紧的部分——「没活动」有四种完全不同的成因，
 * 前台必须能区分，否则会把故障伪装成正常：
 *
 *   ok         当前期次已发布且有条目
 *   empty      当前期次已发布但本期无条目；若历史有内容，回退展示并标注真实期次
 *   no-edition 从未发布过任何期次（功能尚未开张）
 *   offline    曾发布过但当前无在线期次（人工下线/维护）
 *   （技术故障不在此列：由前台在 fetch 失败时自行呈现「加载失败，请重试」）
 */
export async function GET() {
  // CORS 头必须在 try 之外先算好：出错时也要带上，否则前台连错误信息都读不到
  // （跨域下浏览器只会报 Failed to fetch，看不出是服务端故障）。
  const headers = { ...(await corsHeaders()), "Cache-Control": "no-store" };
  try {
    return await handlePublic(headers);
  } catch (e) {
    console.error("[radar:content] 公开接口未捕获异常：", e);
    // 这里**必须**返回带 JSON body 的错误，不能用空 body：
    // 前台的雷达页据此区分「技术故障」与「本期暂无活动」——二者混淆会把故障
    // 永久伪装成正常，是设计上明确要避免的（见本文件顶部空态语义说明）。
    return ok(
      {
        status: "error",
        generatedAt: new Date().toISOString(),
        edition: null,
        isFallback: false,
        groups: { A: [], B: [], C: [] },
        notice: "数据服务暂时不可用，请稍后重试。",
        error: e instanceof Error ? e.message : String(e),
      },
      { status: 503, headers },
    );
  }
}

async function handlePublic(headers: Record<string, string>) {
  const today = todayIso();

  const select = { orderBy: [{ sortOrder: "asc" as const }], where: { status: "published" } };

  // 1) 当前对外期次
  const current = await db.radarEdition.findFirst({
    where: { status: "published" },
    orderBy: [{ publishedAt: "desc" }, { runDate: "desc" }],
    include: { events: select },
  });

  // 2) 无当前期次：区分「从未开张」与「已下线」
  if (!current) {
    const everPublished = await db.radarEdition.count({
      where: { status: { in: ["published", "hidden"] } },
    });
    return ok(
      {
        status: everPublished ? "offline" : "no-edition",
        generatedAt: new Date().toISOString(),
        edition: null,
        isFallback: false,
        groups: { A: [], B: [], C: [] },
        notice: everPublished
          ? "本栏目暂时维护中，请稍后再来查看。"
          : "「赛事雷达」正在筹备中，上线后将在此汇总武汉本地面向小学、初中、高中学生与教师的赛事活动。",
      },
      { headers },
    );
  }

  const shape = (ed: typeof current, fallback: boolean) => {
    const items = ed.events.map((e) => toPublicItem(e, today));
    const groups = {
      A: items.filter((i) => i.bucket === "A"),
      B: items.filter((i) => i.bucket === "B"),
      C: items.filter((i) => i.bucket === "C"),
    };
    return { ed, items, groups, fallback };
  };

  let view = shape(current, false);

  // 3) 当前期次为空：回退到最近一期有内容的期次，并如实标注期次日期
  if (view.items.length === 0) {
    const prior = await db.radarEdition.findFirst({
      where: {
        status: { in: ["published", "hidden"] },
        NOT: { id: current.id },
        events: { some: { status: "published" } },
      },
      orderBy: [{ publishedAt: "desc" }, { runDate: "desc" }],
      include: { events: select },
    });
    if (prior) view = shape(prior, true);
  }

  const { ed, groups } = view;
  return ok(
    {
      status: view.items.length ? "ok" : "empty",
      generatedAt: new Date().toISOString(),
      isFallback: view.fallback,
      edition: {
        id: ed.id,
        title: ed.title,
        runDate: ed.runDate,
        windowStart: ed.windowStart,
        windowEnd: ed.windowEnd,
        publishedAt: ed.publishedAt?.toISOString() ?? null,
        counts: { A: groups.A.length, B: groups.B.length, C: groups.C.length },
      },
      groups,
      notice: view.items.length
        ? view.fallback
          ? `本期暂未更新，以下为 ${ed.windowStart} 至 ${ed.windowEnd} 期发布的内容。`
          : null
        : "本期暂无符合条件的新增赛事活动，敬请关注下期更新。",
    },
    { headers },
  );
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: await corsHeaders() });
}
