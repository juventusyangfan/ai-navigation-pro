import { db } from "@/lib/db";
import { requireAdmin, ok, fail } from "@/lib/http";
import { toApiEdition, toApiItem } from "@/lib/radar/serialize";
import { gateCodeLabel, recheckPublishable, todayIso } from "@/lib/radar/gate";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/** 期次详情：含条目明细（被拦截的也返回，作为门槛有效性的证据） */
export async function GET(_req: Request, { params }: Ctx) {
  const guard = await requireAdmin("radar", "read");
  if (guard.error) return guard.error;

  const { id } = await params;
  const edition = await db.radarEdition.findUnique({
    where: { id },
    include: { events: { orderBy: [{ sortOrder: "asc" }] } },
  });
  if (!edition) return fail(404, "期次不存在");

  const today = todayIso();
  return ok({
    edition: toApiEdition({ ...edition, events: edition.events }),
    items: edition.events.map((e) => toApiItem(e, today)),
  });
}

/**
 * 期次级动作。
 *  action: "publish"   → 对外发布（发布前按发布日复查门槛），并把其它已发布期次转为下线
 *  action: "hide"      → 整期下架（保留数据，前台不再展示）
 *  action: "rollback"  → 回滚该批次：条目全部归档，释放文件指纹以便重新导入
 *  action: "update"    → 改标题 / 备注
 */
export async function PATCH(req: Request, { params }: Ctx) {
  const { id } = await params;
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const action = String(b.action ?? "");

  // 回滚涉及批量归档，按 delete 级别鉴权
  const needed = action === "rollback" ? "delete" : "write";
  const guard = await requireAdmin("radar", needed);
  if (guard.error) return guard.error;

  const edition = await db.radarEdition.findUnique({
    where: { id },
    include: { events: true },
  });
  if (!edition) return fail(404, "期次不存在");

  const operator = guard.admin?.email ?? null;

  switch (action) {
    case "publish": {
      const today = todayIso();
      const drafts = edition.events.filter((e) => e.status === "draft");
      const publishable: typeof drafts = [];
      const rejected: { name: string; reason: string }[] = [];

      for (const e of drafts) {
        const codes = recheckPublishable(e, today);
        if (codes.length) {
          rejected.push({ name: e.name, reason: codes.map(gateCodeLabel).join("；") });
        } else {
          publishable.push(e);
        }
      }

      if (!publishable.length) {
        return fail(
          400,
          drafts.length
            ? `本期 ${drafts.length} 条待发布记录全部未通过复查：${rejected.map((r) => `${r.name}（${r.reason}）`).join("；")}`
            : "本期没有待发布的记录（可能已全部发布或已归档）。",
        );
      }

      // 复查失败的自动归档：它们已无发布价值，留在待发区只会反复干扰
      if (rejected.length) {
        await db.radarEvent.updateMany({
          where: { id: { in: drafts.filter((d) => !publishable.includes(d)).map((d) => d.id) } },
          data: {
            status: "archived",
            archiveReason: "发布时复查未通过（时效或信源）",
            archivedAt: new Date(),
            archivedBy: operator,
          },
        });
      }

      await db.radarEvent.updateMany({
        where: { id: { in: publishable.map((e) => e.id) } },
        data: { status: "published" },
      });

      // 全局只保留一个对外展示期次
      await db.radarEdition.updateMany({
        where: { status: "published", NOT: { id } },
        data: { status: "hidden", note: "已被新一期替代" },
      });

      const updated = await db.radarEdition.update({
        where: { id },
        data: { status: "published", publishedAt: new Date(), publishedBy: operator },
      });

      const fresh = await db.radarEdition.findUnique({
        where: { id },
        include: { events: { select: { bucket: true, status: true } } },
      });
      return ok({
        edition: toApiEdition(fresh ?? { ...updated, events: [] }),
        published: publishable.length,
        autoArchived: rejected,
      });
    }

    case "hide": {
      const updated = await db.radarEdition.update({
        where: { id },
        data: { status: "hidden", note: String(b.note ?? "").trim() || edition.note },
      });
      return ok(toApiEdition({ ...updated, events: edition.events }));
    }

    case "rollback": {
      const res = await db.radarEvent.updateMany({
        where: { editionId: id, status: { not: "archived" } },
        data: {
          status: "archived",
          archiveReason: `批次回滚：${String(b.note ?? "操作人主动撤销该次导入")}`,
          archivedAt: new Date(),
          archivedBy: operator,
        },
      });
      const updated = await db.radarEdition.update({
        where: { id },
        data: {
          status: "rolled_back",
          // 释放文件指纹，允许修正后重新导入同一份文件
          fileHash: null,
          note: String(b.note ?? "").trim() || "整批回滚",
        },
      });
      return ok({ rolledBack: res.count, edition: toApiEdition({ ...updated, events: [] }) });
    }

    case "update": {
      const updated = await db.radarEdition.update({
        where: { id },
        data: {
          title: typeof b.title === "string" && b.title.trim() ? b.title.trim() : edition.title,
          note: typeof b.note === "string" ? b.note.trim() : edition.note,
        },
      });
      return ok(toApiEdition({ ...updated, events: edition.events }));
    }

    default:
      return fail(400, `未知动作：${action || "(空)"}`);
  }
}
