import { db } from "@/lib/db";
import { requireAdmin, ok, fail } from "@/lib/http";
import { editionTitle, parseCandidatePayload } from "@/lib/radar/parse";
import { guarded } from "@/lib/radar/route-guard";
import { applyPromotion, evaluateCandidate, todayIso, type EvaluatedCandidate } from "@/lib/radar/gate";
import { toDbData } from "@/lib/radar/serialize";
import {
  BUCKET_LABEL,
  CATEGORY_LABEL,
  GRADE_LABEL,
  KEYDATE_LABEL,
  REGION_LABEL,
  ROLE_LABEL,
} from "@/lib/radar/contract";

export const dynamic = "force-dynamic";

/**
 * 雷达导入 API（两步式，照抄采集中心的「预览 → 勾选入库」范式）
 *
 *  action: "preview" → 解析 + 门槛校验 + 打分，返回候选预览，**不入库**
 *  action: "commit"  → 重新解析（服务端是唯一权威，绝不信任前端回传的字段值），
 *                      只入库 selected 中的 externalId，一律落 draft / blocked
 *
 * 鉴权：均要求 radar:write。reviewer 只有 radar:read，无法导入或发布——
 * 避免「既当运动员又当裁判」。
 */
export async function POST(req: Request) {
  // 必须走 guarded：本处理器会碰数据库，任何未捕获异常在生产环境都会变成
  // 「500 + 空 body」，前端只能看到「Unexpected end of JSON input」（详见 route-guard.ts）
  return guarded("radar/import", () => handleImport(req));
}

async function handleImport(req: Request) {
  const guard = await requireAdmin("radar", "write");
  if (guard.error) return guard.error;

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const action = body.action === "commit" ? "commit" : "preview";
  const text = String(body.text ?? "");
  const fileName = String(body.fileName ?? "").trim() || null;

  const parsed = parseCandidatePayload(text, fileName ?? "");
  if (!parsed.ok) return fail(400, parsed.error);
  const p = parsed.data;

  // —— 服务端权威评估：门槛 + 打分 + 保底 ——
  const today = todayIso();
  const evaluated = p.candidates.map((c) => evaluateCandidate(c, today));
  applyPromotion(evaluated);

  const accepted = evaluated.filter((c) => c.gatePassed);
  const blockedRows = evaluated.filter((c) => !c.gatePassed);

  const rows = evaluated.map((c) => toPreviewRow(c));

  if (action === "preview") {
    const dup = p.fileHash ? await db.radarEdition.findUnique({ where: { fileHash: p.fileHash } }) : null;
    return ok({
      phase: "preview",
      version: { schemaVersion: p.schemaVersion, warning: p.versionWarning },
      window: {
        runDate: p.runDate ?? today,
        start: p.windowStart,
        end: p.windowEnd,
        title: editionTitle(p.runDate ?? today, p.windowStart, p.windowEnd),
      },
      fileHash: p.fileHash,
      fileName,
      duplicate: dup ? { editionId: dup.id, title: dup.title, createdAt: dup.createdAt.toISOString() } : null,
      counts: {
        total: evaluated.length,
        accepted: accepted.length,
        blocked: blockedRows.length,
        A: accepted.filter((c) => c.suggestedBucket === "A").length,
        B: accepted.filter((c) => c.suggestedBucket === "B").length,
        C: accepted.filter((c) => c.suggestedBucket === "C").length,
        promoted: accepted.filter((c) => c.promoted).length,
      },
      items: rows,
      // 技能侧已被剔除的条目：仅展示，说明上游门槛拦了什么
      upstreamRejected: p.rejected.map((r) => ({
        name: String((r as Record<string, unknown>)?.name ?? "（无名称）"),
        organizer: String((r as Record<string, unknown>)?.organizer ?? ""),
        reason: String((r as Record<string, unknown>)?.exclude_reason ?? (r as Record<string, unknown>)?.gate_code ?? ""),
      })),
    });
  }

  /* ------------------------------- commit ------------------------------- */

  if (p.fileHash) {
    const dup = await db.radarEdition.findUnique({ where: { fileHash: p.fileHash } });
    if (dup) {
      return fail(
        409,
        `同一文件已导入过（${dup.title}，${dup.createdAt.toISOString().slice(0, 10)}）。如需重导，请先在「上传历史」中回滚该批次。`,
      );
    }
  }

  const selected = new Set(
    Array.isArray(body.selected) ? (body.selected as unknown[]).map((s) => String(s)) : [],
  );
  // 前端未传 selected 时视为全选通过项（便于脚本直接调用）
  const chosen = selected.size
    ? accepted.filter((c) => selected.has(c.externalId))
    : accepted;

  if (!chosen.length) {
    return fail(400, "没有可入库的条目：请至少勾选一条通过门槛的记录。");
  }

  const runDate = p.runDate ?? today;

  try {
    const edition = await db.radarEdition.create({
      data: {
        runDate,
        windowStart: p.windowStart ?? runDate,
        windowEnd: p.windowEnd ?? runDate,
        title: editionTitle(runDate, p.windowStart, p.windowEnd),
        fileName,
        fileHash: p.fileHash,
        schemaVersion: p.schemaVersion,
        rawMeta: JSON.stringify(p.meta ?? {}),
        totalCount: evaluated.length,
        acceptedCount: accepted.length,
        blockedCount: blockedRows.length,
        status: "draft",
        createdBy: guard.admin?.email ?? null,
      },
    });

    let created = 0;
    let updated = 0;
    // 被拦截的条目一并入库（status=blocked），供「门槛到底拦了什么」回溯
    const allRows = [...chosen, ...blockedRows];

    for (let i = 0; i < allRows.length; i++) {
      const c = allRows[i];
      const data = toDbData(c, edition.id, i);
      const existing = c.gatePassed
        ? await db.radarEvent.findFirst({ where: { editionId: edition.id, externalId: c.externalId } })
        : null;
      if (existing) {
        await db.radarEvent.update({ where: { id: existing.id }, data });
        updated++;
      } else {
        await db.radarEvent.create({ data });
        created++;
      }
    }

    return ok({
      phase: "commit",
      editionId: edition.id,
      title: edition.title,
      counts: {
        total: evaluated.length,
        accepted: accepted.length,
        blocked: blockedRows.length,
        created,
        updated,
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "入库失败";
    return fail(500, msg);
  }
}

/** 预览行：给后台页面直接渲染用，字段名与前台 API 保持同一口径 */
function toPreviewRow(c: EvaluatedCandidate) {
  return {
    externalId: c.externalId,
    name: c.name,
    organizer: c.organizer,
    coOrganizer: c.coOrganizer,
    audienceRaw: c.audienceRaw,
    grades: c.grades,
    roles: c.roles,
    gradeLabel: c.grades.map((g) => GRADE_LABEL[g] ?? g).join("、"),
    roleLabel: c.roles.map((r) => ROLE_LABEL[r] ?? r).join("、"),
    category: c.category,
    categoryLabel: CATEGORY_LABEL[c.category] ?? c.category,
    region: c.region,
    regionLabel: REGION_LABEL[c.region] ?? c.region,
    keyDate: c.keyDate,
    keyDateType: c.keyDateType,
    keyDateTypeLabel: KEYDATE_LABEL[c.keyDateType] ?? c.keyDateType,
    location: c.location,
    fee: c.fee,
    signupMethod: c.signupMethod,
    sourceName: c.sourceName,
    sourceUrl: c.sourceUrl,
    sourceTier: c.sourceTier,
    notes: c.notes,
    siblings: c.siblings,
    rScore: c.rScore,
    tScore: c.tScore,
    cScore: c.cScore,
    suggestedTotal: c.suggestedTotal,
    suggestedBucket: c.suggestedBucket,
    bucketLabel: BUCKET_LABEL[c.suggestedBucket] ?? c.suggestedBucket,
    promoted: c.promoted,
    gatePassed: c.gatePassed,
    gateCodes: c.gateCodes,
    warnings: c.warnings,
    complianceNote: c.complianceNote,
  };
}
