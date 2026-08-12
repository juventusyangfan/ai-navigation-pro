import { db } from "@/lib/db";
import { corsAuth } from "@/lib/http";

export const dynamic = "force-dynamic";

// 匿名行为事件白名单：拒绝任意事件名，防垃圾写入
const EVENT_WHITELIST = new Set([
  "lit_module_view",
  "lit_module_empty_view",
  "lit_lesson_view",
  "lit_lesson_view_30s",
  "lit_official_click",
  "lit_sop_click",
  "lit_asset_copy",
  "lit_asset_download",
  "lit_fallback_click",
  "lit_usages_exit",
  "lit_useful_toggle",
]);

// 浏览类事件 30 分钟内按 (anonId, name, refId) 去重，避免刷新重复计数
const DEDUPE_VIEW = new Set(["lit_lesson_view", "lit_module_view"]);

interface IncomingEvent {
  name?: string;
  refType?: string;
  refId?: string;
  props?: Record<string, unknown>;
}

export async function POST(req: Request) {
  let body: { anonId?: string; events?: IncomingEvent[] };
  try {
    body = await req.json();
  } catch {
    return new Response(null, { status: 204, headers: corsAuth() });
  }

  const events = Array.isArray(body.events) ? body.events.slice(0, 20) : [];
  const anonId = typeof body.anonId === "string" ? body.anonId : null;
  const ua =
    (req.headers.get("user-agent") ?? "").slice(0, 120) || null;

  const now = Date.now();
  const rows: {
    name: string;
    refType: string;
    refId: string;
    anonId: string | null;
    userId: string | null;
    props: string;
    ua: string | null;
  }[] = [];

  for (const e of events) {
    if (!e || typeof e.name !== "string") continue;
    if (!EVENT_WHITELIST.has(e.name)) continue;
    if (typeof e.refType !== "string" || typeof e.refId !== "string") continue;

    // 浏览去重：30 分钟内已有同 (anonId, name, refId) 则跳过
    if (DEDUPE_VIEW.has(e.name) && anonId) {
      const recent = await db.eventLog.findFirst({
        where: {
          anonId,
          name: e.name,
          refId: e.refId,
          createdAt: { gte: new Date(now - 30 * 60 * 1000) },
        },
        select: { id: true },
      });
      if (recent) continue;
    }

    rows.push({
      name: e.name,
      refType: e.refType,
      refId: e.refId,
      anonId,
      userId: null,
      props: JSON.stringify(e.props ?? {}),
      ua,
    });
  }

  // 不进事务：埋点高频写，避免与内容编辑抢 SQLite 写锁
  if (rows.length > 0) {
    await db.eventLog.createMany({ data: rows });

    // 计数自增（updateMany 静默匹配 0 行，脏 refId 不 500）
    const lessonSlugs = new Set(
      rows.filter((r) => r.refType === "lesson").map((r) => r.refId),
    );
    for (const slug of lessonSlugs) {
      const inc: { viewCount?: { increment: number }; officialClicks?: { increment: number } } = {};
      let has = false;
      if (rows.some((r) => r.refId === slug && (r.name === "lit_lesson_view" || r.name === "lit_lesson_view_30s"))) {
        inc.viewCount = { increment: 1 };
        has = true;
      }
      if (rows.some((r) => r.refId === slug && r.name === "lit_official_click")) {
        inc.officialClicks = { increment: 1 };
        has = true;
      }
      if (has) await db.litLesson.updateMany({ where: { slug }, data: inc });
    }
  }

  // 恒定 204，不返回任何数据
  return new Response(null, { status: 204, headers: corsAuth() });
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsAuth() });
}
