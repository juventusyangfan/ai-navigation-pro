import { db } from "@/lib/db";
import { ok, fail, loadSessionAdmin } from "@/lib/http";
import { userCan } from "@/lib/rbac";

export const dynamic = "force-dynamic";

// POST /api/admin/events/rollup  （定时任务用 CRON_TOKEN；后台手动用管理员会话）
// 把「今天 00:00 之前」的 EventLog 按 (day, name, refType, refId) 聚合进 EventDaily，
// 再清理已聚合原始事件，并对 EventDaily 做 30 天滚动清理。
export async function POST(req: Request) {
  const admin = await loadSessionAdmin();
  const sessionOk = !!admin && userCan(admin, "analytics", "read");

  const token = req.headers.get("x-cron-token") ?? new URL(req.url).searchParams.get("token");
  const tokenOk = !!process.env.CRON_TOKEN && token === process.env.CRON_TOKEN;

  if (!sessionOk && !tokenOk) return fail(401, "未授权");

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const recent = await db.eventLog.findMany({
    where: { createdAt: { lt: today } },
    orderBy: { createdAt: "asc" },
  });

  const agg = new Map<string, { count: number; uniques: Set<string> }>();
  for (const e of recent) {
    const day = e.createdAt.toISOString().slice(0, 10);
    const key = `${day}|${e.name}|${e.refType}|${e.refId}`;
    const cur = agg.get(key) ?? { count: 0, uniques: new Set<string>() };
    cur.count += 1;
    if (e.anonId) cur.uniques.add(e.anonId);
    agg.set(key, cur);
  }

  for (const [key, val] of agg) {
    const [day, name, refType, refId] = key.split("|");
    await db.eventDaily.upsert({
      where: { day_name_refType_refId: { day, name, refType, refId } },
      create: { day, name, refType, refId, count: val.count, uniques: val.uniques.size },
      update: { count: { increment: val.count }, uniques: { increment: val.uniques.size } },
    });
  }

  // 删除已聚合的原始事件（避免重复计数；看板只读 EventDaily）
  const deleted = await db.eventLog.deleteMany({ where: { createdAt: { lt: today } } });

  // EventDaily 滚动保留 30 天
  const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const deletedDaily = await db.eventDaily.deleteMany({
    where: { day: { lt: cutoff.toISOString().slice(0, 10) } },
  });

  return ok({
    aggregated: agg.size,
    deletedEvents: deleted.count,
    deletedDaily: deletedDaily.count,
  });
}
