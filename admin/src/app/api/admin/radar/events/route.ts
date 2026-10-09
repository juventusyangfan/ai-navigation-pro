import { db } from "@/lib/db";
import { requireAdmin, ok, fail } from "@/lib/http";
import { toApiItem } from "@/lib/radar/serialize";
import { guarded } from "@/lib/radar/route-guard";
import { evaluateCandidate, todayIso, gateCodeLabel } from "@/lib/radar/gate";

export const dynamic = "force-dynamic";

/**
 * 条目列表 / 手工新增。
 *
 * 手工新增同样走服务端门槛校验——这是本方案最要紧的合规设计：
 * 后台允许人工录入，但**门槛不由录入者决定**。录入一条信源层级 4（培训机构自媒体）
 * 或对象不符的活动，会被直接判定为 blocked，无法进入发布态。
 */
export async function GET(req: Request) {
  return guarded("radar/events:list", () => handleList(req));
}

async function handleList(req: Request) {
  const guard = await requireAdmin("radar", "read");
  if (guard.error) return guard.error;

  const { searchParams } = new URL(req.url);
  const editionId = searchParams.get("editionId");
  const status = searchParams.get("status");
  const bucket = searchParams.get("bucket");
  const q = (searchParams.get("q") ?? "").trim();

  const rows = await db.radarEvent.findMany({
    where: {
      ...(editionId ? { editionId } : {}),
      ...(status ? { status } : {}),
      ...(bucket ? { bucket } : {}),
      ...(q ? { OR: [{ name: { contains: q } }, { organizer: { contains: q } }] } : {}),
    },
    orderBy: [{ sortOrder: "asc" }, { keyDate: "asc" }],
    take: 500,
  });

  const today = todayIso();
  return ok(rows.map((r) => toApiItem(r, today)));
}

export async function POST(req: Request) {
  return guarded("radar/events:create", () => handleCreate(req));
}

async function handleCreate(req: Request) {
  const guard = await requireAdmin("radar", "write");
  if (guard.error) return guard.error;

  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const editionId = String(b.editionId ?? "").trim();
  if (!editionId) return fail(400, "必须指定所属期次");

  const edition = await db.radarEdition.findUnique({ where: { id: editionId } });
  if (!edition) return fail(404, "期次不存在");

  const arr = (v: unknown): string[] => (Array.isArray(v) ? v.map((x) => String(x)) : []);

  const raw = {
    name: b.name,
    organizer: b.organizer,
    co_organizer: b.coOrganizer,
    audience_raw: b.audienceRaw,
    grades: arr(b.grades),
    roles: arr(b.roles),
    category: b.category,
    region: b.region,
    key_date: b.keyDate,
    key_date_type: b.keyDateType,
    time_range: b.timeRange,
    location: b.location,
    fee: b.fee,
    signup_method: b.signupMethod,
    source_url: b.sourceUrl,
    source_name: b.sourceName,
    source_tier: b.sourceTier,
    notes: b.notes,
  };

  const today = todayIso();
  const c = evaluateCandidate(raw, today);

  const count = await db.radarEvent.count({ where: { editionId } });
  const created = await db.radarEvent.create({
    data: {
      editionId,
      externalId: c.externalId,
      source: "manual",
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
      suggestedBucket: c.suggestedBucket,
      rScore: c.rScore,
      tScore: c.tScore,
      cScore: c.cScore,
      suggestedTotal: c.suggestedTotal,
      bucket: c.suggestedBucket,
      totalScore: c.suggestedTotal,
      gatePassed: c.gatePassed,
      gateCodes: JSON.stringify(c.gateCodes),
      complianceNote: c.complianceNote,
      status: c.gatePassed ? "draft" : "blocked",
      sortOrder: count,
    },
  });

  return ok(
    {
      item: toApiItem(created, today),
      gatePassed: c.gatePassed,
      gateReasons: c.gateCodes.map((code) => `${gateCodeLabel(code)}（${code}）`),
      warnings: c.warnings,
      hint: c.gatePassed
        ? "已入库为草稿，可在本期发布时一并上线。"
        : "未通过硬门槛，已作为 blocked 记录保留，无法发布。请核对地域、参赛对象、关键节点与信源层级。",
    },
    { status: 201 },
  );
}
