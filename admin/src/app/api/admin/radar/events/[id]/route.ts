import { db } from "@/lib/db";
import { requireAdmin, ok, fail } from "@/lib/http";
import { toApiItem } from "@/lib/radar/serialize";
import { guarded } from "@/lib/radar/route-guard";
import type { RadarEvent } from "@prisma/client";
import { evaluateCandidate, gateCodeLabel, recheckPublishable, todayIso } from "@/lib/radar/gate";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

const parse = <T>(s: string, fallback: T): T => {
  try {
    const v = JSON.parse(s);
    return (v ?? fallback) as T;
  } catch {
    return fallback;
  }
};

/** Prisma 行 → 门槛评估输入（snake_case），编辑后需重跑门槛 */
function rowToRaw(e: RadarEvent): Record<string, unknown> {
  return {
    name: e.name,
    organizer: e.organizer,
    co_organizer: e.coOrganizer,
    audience_raw: e.audienceRaw,
    grades: parse<string[]>(e.grades, []),
    roles: parse<string[]>(e.roles, []),
    category: e.category,
    region: e.region,
    key_date: e.keyDate,
    key_date_type: e.keyDateType,
    time_range: e.timeRange,
    location: e.location,
    fee: e.fee,
    signup_method: e.signupMethod,
    source_url: e.sourceUrl,
    source_name: e.sourceName,
    source_tier: e.sourceTier,
    notes: e.notes,
    siblings: parse<unknown[]>(e.siblings, []),
  };
}

export async function GET(_req: Request, ctx: Ctx) {
  return guarded("radar/event:get", () => handleGet(ctx));
}

async function handleGet({ params }: Ctx) {
  const guard = await requireAdmin("radar", "read");
  if (guard.error) return guard.error;
  const { id } = await params;
  const e = await db.radarEvent.findUnique({ where: { id } });
  if (!e) return fail(404, "条目不存在");
  return ok(toApiItem(e, todayIso()));
}

/**
 * 单条动作。
 *  action: "update"  → 编辑字段，**编辑后重跑门槛**（改了信源或日期都可能触发/解除拦截）
 *  action: "setBucket" → 人工覆盖档位（打 scoreOverridden 标记，与建议值区分）
 *  action: "publish" → 单条发布（要求所属期次已发布，避免前台读不到）
 *  action: "archive" → 下架（软删除，必填原因）
 *  action: "restore" → 从下架恢复
 */
export async function PATCH(req: Request, ctx: Ctx) {
  return guarded("radar/event:patch", () => handlePatch(req, ctx));
}

async function handlePatch(req: Request, { params }: Ctx) {
  const { id } = await params;
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const action = String(b.action ?? "update");

  const guard = await requireAdmin("radar", action === "archive" ? "delete" : "write");
  if (guard.error) return guard.error;

  const e = await db.radarEvent.findUnique({ where: { id } });
  if (!e) return fail(404, "条目不存在");
  const today = todayIso();
  const operator = guard.admin?.email ?? null;

  if (action === "archive") {
    const reason = String(b.reason ?? "").trim();
    if (!reason) return fail(400, "下架必须填写原因（合规留痕要求）");
    const updated = await db.radarEvent.update({
      where: { id },
      data: { status: "archived", archiveReason: reason, archivedAt: new Date(), archivedBy: operator },
    });
    return ok(toApiItem(updated, today));
  }

  if (action === "restore") {
    const codes = recheckPublishable(e, today);
    const updated = await db.radarEvent.update({
      where: { id },
      data: {
        status: codes.length ? "blocked" : "draft",
        gatePassed: codes.length === 0,
        gateCodes: JSON.stringify(codes),
        archiveReason: null,
        archivedAt: null,
        archivedBy: null,
      },
    });
    return ok(toApiItem(updated, today));
  }

  if (action === "publish") {
    if (!e.gatePassed) return fail(400, "该条目未通过硬门槛，不能发布。");
    if (e.editionId) {
      const edition = await db.radarEdition.findUnique({ where: { id: e.editionId } });
      if (!edition || edition.status !== "published") {
        return fail(400, "所属期次尚未发布。请先发布整期，再单独调整条目。");
      }
    }
    const codes = recheckPublishable(e, today);
    if (codes.length) {
      return fail(400, `发布前复查未通过：${codes.map((c) => `${gateCodeLabel(c)}（${c}）`).join("；")}`);
    }
    const updated = await db.radarEvent.update({ where: { id }, data: { status: "published" } });
    return ok(toApiItem(updated, today));
  }

  if (action === "setBucket") {
    const bucket = String(b.bucket ?? "").toUpperCase();
    if (!["A", "B", "C"].includes(bucket)) return fail(400, "档位只能是 A / B / C");
    const updated = await db.radarEvent.update({
      where: { id },
      data: { bucket, totalScore: bucket === e.suggestedBucket ? e.suggestedTotal : e.totalScore, scoreOverridden: true },
    });
    return ok(toApiItem(updated, today));
  }

  // update：编辑字段并重跑门槛
  const raw = rowToRaw(e);
  const map: [string, string][] = [
    ["name", "name"],
    ["organizer", "organizer"],
    ["coOrganizer", "co_organizer"],
    ["audienceRaw", "audience_raw"],
    ["category", "category"],
    ["region", "region"],
    ["keyDate", "key_date"],
    ["keyDateType", "key_date_type"],
    ["timeRange", "time_range"],
    ["location", "location"],
    ["fee", "fee"],
    ["signupMethod", "signup_method"],
    ["sourceUrl", "source_url"],
    ["sourceName", "source_name"],
    ["notes", "notes"],
  ];
  for (const [from, to] of map) {
    if (from in b) raw[to] = b[from];
  }
  if ("grades" in b) raw.grades = Array.isArray(b.grades) ? b.grades.map(String) : [];
  if ("roles" in b) raw.roles = Array.isArray(b.roles) ? b.roles.map(String) : [];
  if ("sourceTier" in b) raw.source_tier = Number(b.sourceTier);
  if ("siblings" in b) raw.siblings = Array.isArray(b.siblings) ? b.siblings : [];

  const c = evaluateCandidate(raw, today);
  // 编辑不得把已发布条目悄悄退回草稿：只有门槛被打破时才降级
  let status = e.status;
  if (!c.gatePassed) status = "blocked";
  else if (e.status === "blocked") status = "draft";

  const updated = await db.radarEvent.update({
    where: { id },
    data: {
      name: c.name,
      organizer: c.organizer,
      coOrganizer: c.coOrganizer,
      audienceRaw: c.audienceRaw,
      grades: JSON.stringify(c.grades),
      roles: JSON.stringify(c.roles),
      category: c.category,
      region: c.region,
      keyDate: c.keyDate,
      keyDateType: c.keyDateType,
      timeRange: c.timeRange,
      location: c.location,
      fee: c.fee,
      signupMethod: c.signupMethod,
      sourceUrl: c.sourceUrl,
      sourceName: c.sourceName,
      sourceTier: c.sourceTier,
      notes: c.notes,
      siblings: JSON.stringify(c.siblings),
      rScore: c.rScore,
      tScore: c.tScore,
      cScore: c.cScore,
      suggestedTotal: c.suggestedTotal,
      suggestedBucket: c.suggestedBucket,
      // 未人工改档时跟随建议值，改了就以人工为准
      bucket: e.scoreOverridden ? e.bucket : c.suggestedBucket,
      totalScore: e.scoreOverridden ? e.totalScore : c.suggestedTotal,
      gatePassed: c.gatePassed,
      gateCodes: JSON.stringify(c.gateCodes),
      complianceNote: c.complianceNote,
      status,
    },
  });

  return ok({
    item: toApiItem(updated, today),
    gatePassed: c.gatePassed,
    gateReasons: c.gateCodes.map((code) => `${gateCodeLabel(code)}（${code}）`),
    warnings: c.warnings,
    statusChanged: status !== e.status ? `${e.status} → ${status}` : null,
  });
}

/** 不做物理删除：审计轨迹是合规证据，只能下架 */
export async function DELETE() {
  return fail(405, "条目不支持物理删除，请使用「下架」并填写原因（保留审计轨迹）。");
}
