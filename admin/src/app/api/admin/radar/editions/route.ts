import { db } from "@/lib/db";
import { requireAdmin, ok, fail } from "@/lib/http";
import { editionTitle } from "@/lib/radar/parse";
import { toApiEdition } from "@/lib/radar/serialize";
import { guarded } from "@/lib/radar/route-guard";
import { todayIso } from "@/lib/radar/gate";

export const dynamic = "force-dynamic";

/**
 * 期次（= 导入批次）列表与新建。
 * 「上传历史」页读这个接口；每条批次都能整批回滚。
 */
export async function GET() {
  return guarded("radar/editions:list", () => handleList());
}

async function handleList() {
  const guard = await requireAdmin("radar", "read");
  if (guard.error) return guard.error;

  const editions = await db.radarEdition.findMany({
    orderBy: [{ runDate: "desc" }, { createdAt: "desc" }],
    include: { events: { select: { bucket: true, status: true } } },
  });
  return ok(editions.map(toApiEdition));
}

/** 手工新建一个空白期次：纯手工录入场景（本周技能未产出时也能开工） */
export async function POST(req: Request) {
  return guarded("radar/editions:create", () => handleCreate(req));
}

async function handleCreate(req: Request) {
  const guard = await requireAdmin("radar", "write");
  if (guard.error) return guard.error;

  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const runDate = String(b.runDate ?? "").match(/^\d{4}-\d{2}-\d{2}$/) ? String(b.runDate) : todayIso();
  const windowStart = typeof b.windowStart === "string" && /^\d{4}-\d{2}-\d{2}$/.test(b.windowStart) ? b.windowStart : null;
  const windowEnd = typeof b.windowEnd === "string" && /^\d{4}-\d{2}-\d{2}$/.test(b.windowEnd) ? b.windowEnd : null;

  const dup = await db.radarEdition.findFirst({ where: { runDate, fileName: null } });
  if (dup) return fail(409, `已存在 ${runDate} 的手工期次，请直接在「上传历史」中编辑。`);

  const edition = await db.radarEdition.create({
    data: {
      runDate,
      windowStart: windowStart ?? runDate,
      windowEnd: windowEnd ?? runDate,
      title: editionTitle(runDate, windowStart, windowEnd),
      status: "draft",
      createdBy: guard.admin?.email ?? null,
    },
  });
  return ok(toApiEdition({ ...edition, events: [] }), { status: 201 });
}
