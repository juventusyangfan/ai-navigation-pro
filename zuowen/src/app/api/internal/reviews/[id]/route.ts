// GET /api/internal/reviews/[id] —— 单篇详情（供后台详情页）
//
// 与列表同一套 token 鉴权。默认返回解密正文；`?text=0` 时不返回，
// 后台详情页先取元信息与报告、家长明确点「显示原文」时再单独取一次正文，
// 避免孩子的作文在日常生活中被无意间展开在屏幕上。
//
// id 用 cuid（不可枚举），但**不可枚举不是权限**：仍然必须过 token。

import { NextRequest } from "next/server";
import { prisma } from "@/lib/store";
import { decryptText } from "@/lib/crypto";
import { guarded, ok, fail } from "@/lib/http";
import { bandOf } from "@/lib/grade";
import { readInternalAuth } from "@/lib/internal";
import { DIM_LABEL, DIM_MAX, type DimKey } from "@/lib/rubric";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return guarded("internal/reviews:detail", async () => {
    const auth = readInternalAuth(req);
    if (!auth.ok) return fail(401, auth.message);

    const { id } = await ctx.params;
    if (!/^[a-z0-9]{10,40}$/i.test(id)) return fail(400, "id 格式不正确");

    const row = await prisma.essayReview.findUnique({ where: { id } });
    if (!row) return fail(404, "报告不存在");

    const report = safeParse(row.report);
    const band = bandOf(row.grade);
    const withText = req.nextUrl.searchParams.get("text") !== "0";

    return ok({
      ok: true,
      item: {
        id: row.id,
        createdAt: row.createdAt,
        grade: row.grade,
        gradeLabel: band.label,
        // 年级篇幅参考区间：审核时判断「字数偏少」是不是真问题，要看年级基准
        span: [band.minChars, band.maxChars],
        title: row.title,
        genre: row.genre,
        charCount: row.charCount,
        source: row.source,
        readable: row.readable,
        anonId: row.anonId,
        total: row.total,
        level: row.level,
        model: row.model,
        summary: typeof report?.summary === "string" ? report.summary : "",
        dims: dimsOf(report),
        dimMax: DIM_MAX,
        dimLabel: DIM_LABEL,
        report,
        ...(withText ? { text: decryptText(row.encText) } : {}),
      },
    });
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
