// GET /api/internal/reviews —— 内部查看（供后台或运维拉数据）
//
// 需要 x-cron-token 请求头，且必须在 .env 里配置 ZW_CRON_TOKEN；
// 未配置时一律 401（默认关闭），避免上线后忘了关变成公开接口。
//
// 返回解密后的正文，属于敏感数据：
// 只走服务端到服务端，不要在浏览器地址栏里直接打开（token 会留在历史记录里）。
//
// ── 参数（2026-10-21 为后台列表扩展，全部可选） ────────────────────────────
//   page / pageSize    分页，默认 1 / 20，pageSize 上限 100
//   limit              旧参数，等价于 pageSize（上限沿用 200，兼容早期 `?limit=50`）
//   grade              1—6
//   source             text | image
//   level              优秀 | 良好 | 合格 | 待提升
//   q                  标题关键词（正文是密文，无法全文检索，只能搜标题）
//   min / max          总分区间
//   days               最近 N 天（按北京时间切日，days=1 即今天）
//   withText           1=带解密正文。默认 0；但**只传 limit 不传 withText 时按 1 处理**，
//                      保持扩展前「拉出来就能看到正文」的用法不变。
//   stats              1=附带统计聚合（后台看板用），默认 0
//
// 兼容性红线：老调用方拿到的 `ok` / `count` / `items[].text` 三者语义保持不变。

import { NextRequest } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/store";
import { decryptText } from "@/lib/crypto";
import { guarded, ok, fail } from "@/lib/http";
import { bandOf, GRADE_BANDS } from "@/lib/grade";
import { readInternalAuth, startOfDayCn } from "@/lib/internal";
import { DIM_LABEL, DIM_MAX, LEVELS, type DimKey } from "@/lib/rubric";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;
const MAX_LIMIT = 200; // 旧参数的原有上限

function intParam(v: string | null, def: number, min: number, max: number): number {
  const n = Number.parseInt(v ?? "", 10);
  if (!Number.isFinite(n)) return def;
  return Math.min(Math.max(n, min), max);
}

export async function GET(req: NextRequest) {
  return guarded("internal/reviews", async () => {
    const auth = readInternalAuth(req);
    if (!auth.ok) return fail(401, auth.message);

    const sp = req.nextUrl.searchParams;

    const limitRaw = sp.get("limit");
    const page = intParam(sp.get("page"), 1, 1, 100000);
    const pageSize = limitRaw
      ? intParam(limitRaw, DEFAULT_PAGE_SIZE, 1, MAX_LIMIT)
      : intParam(sp.get("pageSize"), DEFAULT_PAGE_SIZE, 1, MAX_PAGE_SIZE);

    const withTextRaw = sp.get("withText");
    // 只传 limit 的老调用 → 默认带正文；新调用（page/pageSize）→ 默认不带，按需再取
    const withText = withTextRaw === null ? Boolean(limitRaw) : withTextRaw === "1";
    const withStats = sp.get("stats") === "1";

    const where: Prisma.EssayReviewWhereInput = {};

    const grade = intParam(sp.get("grade"), 0, 0, 6);
    if (grade >= 1 && grade <= 6) where.grade = grade;

    const source = (sp.get("source") || "").trim();
    if (source === "text" || source === "image") where.source = source;

    const level = (sp.get("level") || "").trim();
    if ((LEVELS as readonly string[]).includes(level)) where.level = level;

    const q = (sp.get("q") || "").trim();
    if (q) where.title = { contains: q };

    const min = sp.get("min");
    const max = sp.get("max");
    const scoreFilter: Prisma.IntFilter = {};
    if (min !== null && min !== "" && Number.isFinite(Number(min))) scoreFilter.gte = Math.round(Number(min));
    if (max !== null && max !== "" && Number.isFinite(Number(max))) scoreFilter.lte = Math.round(Number(max));
    if (Object.keys(scoreFilter).length > 0) where.total = scoreFilter;

    const days = intParam(sp.get("days"), 0, 0, 3650);
    if (days > 0) where.createdAt = { gte: startOfDayCn(days - 1) };

    const [rows, total] = await Promise.all([
      prisma.essayReview.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.essayReview.count({ where }),
    ]);

    const items = rows.map((r) => {
      const report = safeParse(r.report);
      const base = {
        id: r.id,
        createdAt: r.createdAt,
        grade: r.grade,
        gradeLabel: bandOf(r.grade).label,
        title: r.title,
        genre: r.genre,
        charCount: r.charCount,
        source: r.source,
        total: r.total,
        level: r.level,
        model: r.model,
        // 列表页要展示的摘要与分项，直接从报告 JSON 取，省掉逐条进详情
        summary: typeof report?.summary === "string" ? report.summary : "",
        dims: dimsOf(report),
      };
      return withText ? { ...base, text: decryptText(r.encText), report } : base;
    });

    const payload: Record<string, unknown> = {
      ok: true,
      count: items.length, // 兼容旧字段：本次返回条数
      total,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
      items,
    };

    if (withStats) payload.stats = await stats();
    return ok(payload);
  });
}

function safeParse(s: string): any {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}

function dimsOf(report: any): Record<DimKey, number> {
  const out = {} as Record<DimKey, number>;
  for (const k of Object.keys(DIM_MAX) as DimKey[]) {
    const v = Number(report?.dims?.[k]);
    out[k] = Number.isFinite(v) ? v : 0;
  }
  return out;
}

/**
 * 看板统计。刻意基于**全量**数据而不是当前筛选结果：
 * 顶部卡片回答的是「这个工具整体跑得怎么样」，跟着筛选条跳动会被误读成筛选统计。
 */
async function stats() {
  const [total, today, last7, agg, byGrade, byLevel, bySource] = await Promise.all([
    prisma.essayReview.count(),
    prisma.essayReview.count({ where: { createdAt: { gte: startOfDayCn(0) } } }),
    prisma.essayReview.count({ where: { createdAt: { gte: startOfDayCn(6) } } }),
    prisma.essayReview.aggregate({ _avg: { total: true } }),
    prisma.essayReview.groupBy({ by: ["grade"], _count: { _all: true }, _avg: { total: true } }),
    prisma.essayReview.groupBy({ by: ["level"], _count: { _all: true } }),
    prisma.essayReview.groupBy({ by: ["source"], _count: { _all: true } }),
  ]);

  return {
    total,
    today,
    last7,
    avgScore: agg._avg.total === null ? null : round1(agg._avg.total),
    // 按年级补齐 1—6、按等级补齐四档、按来源补齐两类：
    // 前端画分布时不需要再判断缺项，顺序也固定。
    byGrade: GRADE_BANDS.map((b) => {
      const hit = byGrade.find((g) => g.grade === b.grade);
      return {
        grade: b.grade,
        label: b.label,
        count: hit?._count._all ?? 0,
        avg: hit?._avg.total === null || hit?._avg.total === undefined ? null : round1(hit._avg.total),
      };
    }),
    byLevel: LEVELS.map((lv) => ({
      level: lv,
      count: byLevel.find((x) => x.level === lv)?._count._all ?? 0,
    })),
    bySource: ["text", "image"].map((s) => ({
      source: s,
      count: bySource.find((x) => x.source === s)?._count._all ?? 0,
    })),
    dimLabel: DIM_LABEL,
  };
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
