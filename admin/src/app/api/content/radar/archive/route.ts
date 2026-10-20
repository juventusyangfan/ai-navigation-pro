import { db } from "@/lib/db";
import { ok, corsHeaders } from "@/lib/http";

export const dynamic = "force-dynamic";

/**
 * 公开只读 API：往期期次列表。
 *
 * ── 「往期」在这套数据模型里到底是什么 ────────────────────────────────────
 * 发布新一期时，旧期次会被置为 `hidden`，note 写成「已被新一期替代」
 * （见 src/app/api/admin/radar/editions/[id]/route.ts 的 publish 分支）。
 * 所以往期 = 曾经正式对外展示过、如今已被新一期顶下去的期次。
 *
 * 判定刻意**不依赖 note 字符串**（那是人工可改的展示字段，拿来做业务判据迟早出错），
 * 而是用时间序：
 *   候选 = publishedAt 非空 且 status ∈ {published, hidden}
 *   排序后最新的一期排除（它要么正在首页展示，要么被人工整期下线 —— 两者都不该进往期）
 *   其余按发布时间倒序即为往期
 *
 * 人工 `hide` 的期次若恰好是最新一期，会被这条规则自然排除：整期下架通常正是因为
 * 内容要撤，让它出现在往期列表里等于绕过了下架意图。
 *
 * ── 空态语义 ──────────────────────────────────────────────────────────
 *   ok     有往期可看
 *   empty  还没有往期（第一期刚上线，或历史期次内容全被归档）
 *   error  技术故障（由外层 catch 返回 503，前端据此区分「没有」与「坏了」）
 */

/** 一次最多吐出多少期。周更一年 52 期，60 期足够覆盖一年以上，超出给 hasMore。 */
const MAX_EDITIONS = 60;

/** 每期卡片上露出的代表活动条数 */
const HIGHLIGHTS_PER_EDITION = 2;

type EditionRow = {
  id: string;
  runDate: string;
  windowStart: string;
  windowEnd: string;
  title: string;
  publishedAt: Date | null;
  events: {
    name: string;
    bucket: string;
    whitelistStatus: string;
    whitelistSeq: number | null;
  }[];
};

export async function GET() {
  // CORS 头必须在 try 之外先算好：出错时也要带上，否则前台读不到错误信息
  const headers = { ...(await corsHeaders()), "Cache-Control": "no-store" };
  try {
    const { editions, hasMore } = await handleList();
    return ok(
      {
        status: editions.length ? "ok" : "empty",
        generatedAt: new Date().toISOString(),
        total: editions.length,
        hasMore,
        editions,
      },
      { headers },
    );
  } catch (e) {
    console.error("[radar:archive] 往期列表未捕获异常：", e);
    return ok(
      {
        status: "error",
        generatedAt: new Date().toISOString(),
        total: 0,
        hasMore: false,
        editions: [],
        notice: "往期数据暂时不可用，请稍后重试。",
        error: e instanceof Error ? e.message : String(e),
      },
      { status: 503, headers },
    );
  }
}

async function handleList() {
  // 多取一条用于判断是否还有更多，避免额外的 count 查询
  const rows = (await db.radarEdition.findMany({
    where: { publishedAt: { not: null }, status: { in: ["published", "hidden"] } },
    orderBy: [{ publishedAt: "desc" }, { runDate: "desc" }],
    take: MAX_EDITIONS + 1,
    include: {
      events: {
        // 只算真正对外可见的条目：draft/blocked/archived 都不该影响往期的计数
        where: { status: "published" },
        orderBy: [{ sortOrder: "asc" }],
        select: { name: true, bucket: true, whitelistStatus: true, whitelistSeq: true },
      },
    },
  })) as EditionRow[];

  // 没有任何可见条目的期次不进列表：点进去只会是空页，比不显示更糟
  const visible = rows.filter((r) => r.events.length > 0);
  const hasMore = visible.length > MAX_EDITIONS;
  const capped = hasMore ? visible.slice(0, MAX_EDITIONS) : visible;

  // 排除最新一期（= 首页正在展示的那期，或被人为整期下线的那期）
  const [, ...history] = capped;

  return {
    hasMore,
    editions: history.map((ed) => ({
      id: ed.id,
      title: ed.title,
      runDate: ed.runDate,
      windowStart: ed.windowStart,
      windowEnd: ed.windowEnd,
      publishedAt: ed.publishedAt?.toISOString() ?? null,
      counts: {
        A: ed.events.filter((x) => x.bucket === "A").length,
        B: ed.events.filter((x) => x.bucket === "B").length,
        C: ed.events.filter((x) => x.bucket === "C").length,
      },
      items: ed.events.length,
      // 代表活动：优先级 A → B → C，让用户一眼判断这期有没有值得看的
      highlights: pickHighlights(ed.events),
    })),
  };
}

function pickHighlights(events: EditionRow["events"]) {
  const order = ["A", "B", "C"];
  const sorted = [...events].sort((a, b) => order.indexOf(a.bucket) - order.indexOf(b.bucket));
  return sorted.slice(0, HIGHLIGHTS_PER_EDITION).map((e) => ({
    name: e.name,
    bucket: e.bucket,
    whitelistStatus: e.whitelistStatus,
    matchedSeq: e.whitelistSeq,
  }));
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: await corsHeaders() });
}
