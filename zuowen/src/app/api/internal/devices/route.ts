// GET /api/internal/devices —— 设备额度列表（后台「设备额度」页用）
//
// 需要 x-cron-token，与其它内部接口同一把锁（见 lib/internal.ts）。
//
// 参数：
//   page / pageSize   分页，默认 1 / 20，上限 100
//   q                 识别码或备注关键词；识别码会自动去掉横杠、转大写
//   sync=1            先把「有测评记录但没有识别码」的历史设备补上码，再查询。
//                     抽成参数而非常驻，是为了让普通查询保持只读。
//
// 为什么不直接查 EssayReview 聚合、而要落到 Device 表：
// 后台要能「记住」老板设过的额度和备注，而 EssayReview 是按篇存的，
// 没有地方挂这种长期配置。Device 一行代表一台设备，正好是这个粒度。

import { NextRequest } from "next/server";
import { prisma } from "@/lib/store";
import { guarded, ok, fail } from "@/lib/http";
import { readInternalAuth, startOfDayCn } from "@/lib/internal";
import { ensureDevice, formatCode, modeOf, normalizeCode } from "@/lib/device";
import { dailyLimit, globalDailyCap, globalUsedToday } from "@/lib/quota";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;
const BACKFILL_MAX = 300; // 单次最多补这么多台，剩余的下次再补，避免一次请求卡住

function intParam(v: string | null, def: number, min: number, max: number): number {
  const n = Number.parseInt(v ?? "", 10);
  if (!Number.isFinite(n)) return def;
  return Math.min(Math.max(n, min), max);
}

/** 把历史存量设备补上识别码。Device 表是后加的，老数据没有码，后台就看不到它们。 */
async function backfill(): Promise<number> {
  const [rows, known] = await Promise.all([
    prisma.essayReview.groupBy({ by: ["anonId"] }),
    prisma.device.findMany({ select: { anonId: true } }),
  ]);
  const have = new Set(known.map((d) => d.anonId));
  const missing = rows
    .map((r) => r.anonId)
    .filter((a) => !have.has(a))
    .slice(0, BACKFILL_MAX);

  let done = 0;
  for (const anonId of missing) {
    try {
      await ensureDevice(anonId);
      done += 1;
    } catch {
      // 单台失败不阻断整批：下一个请求还会再试
    }
  }
  return done;
}

export async function GET(req: NextRequest) {
  return guarded("internal/devices", async () => {
    const auth = readInternalAuth(req);
    if (!auth.ok) return fail(401, auth.message);

    const sp = req.nextUrl.searchParams;
    const page = intParam(sp.get("page"), 1, 1, 100000);
    const pageSize = intParam(sp.get("pageSize"), DEFAULT_PAGE_SIZE, 1, MAX_PAGE_SIZE);
    const q = (sp.get("q") || "").trim();

    const synced = sp.get("sync") === "1" ? await backfill() : 0;

    const [devices, todayRows, allRows, globalUsed] = await Promise.all([
      prisma.device.findMany(),
      prisma.essayReview.groupBy({
        by: ["anonId"],
        where: { createdAt: { gte: startOfDayCn(0) } },
        _count: { _all: true },
      }),
      prisma.essayReview.groupBy({
        by: ["anonId"],
        _count: { _all: true },
        _max: { createdAt: true },
      }),
      globalUsedToday(),
    ]);

    const todayMap = new Map(todayRows.map((r) => [r.anonId, r._count._all]));
    const allMap = new Map(allRows.map((r) => [r.anonId, r]));

    const normQ = normalizeCode(q);
    const lowerQ = q.toLowerCase();

    const items = devices
      .map((d) => {
        const agg = allMap.get(d.anonId);
        return {
          code: d.code,
          display: formatCode(d.code),
          note: d.note,
          limitEnabled: d.limitEnabled,
          customLimit: d.customLimit,
          mode: modeOf(d),
          today: todayMap.get(d.anonId) ?? 0,
          total: agg?._count._all ?? 0,
          lastAt: agg?._max.createdAt ?? null,
          createdAt: d.createdAt,
          updatedAt: d.updatedAt,
        };
      })
      .filter((it) => {
        if (!q) return true;
        if (normQ && it.code.includes(normQ)) return true;
        return (it.note || "").toLowerCase().includes(lowerQ);
      })
      // 最近用过的排前面：老板一般是「家长刚测完说要加次数」，这条就在最上面
      .sort((a, b) => {
        const ta = a.lastAt ? new Date(a.lastAt).getTime() : 0;
        const tb = b.lastAt ? new Date(b.lastAt).getTime() : 0;
        if (tb !== ta) return tb - ta;
        return a.code.localeCompare(b.code);
      });

    const total = items.length;
    const start = (page - 1) * pageSize;

    return ok({
      ok: true,
      count: Math.min(pageSize, Math.max(0, total - start)),
      total,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
      synced,
      items: items.slice(start, start + pageSize),
      defaults: {
        dailyLimit: dailyLimit(),
        globalCap: globalDailyCap(),
        globalUsed,
      },
    });
  });
}
