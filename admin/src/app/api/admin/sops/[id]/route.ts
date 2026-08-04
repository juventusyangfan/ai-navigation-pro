import { db } from "@/lib/db";
import { requireAdmin, ok, fail } from "@/lib/http";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  const guard = await requireAdmin("sops", "read");
  if (guard.error) return guard.error;
  const { id } = await params;
  const path = await db.sopPath.findUnique({
    where: { id },
    include: { tool: { select: { id: true, name: true, slug: true, color: true } }, steps: { orderBy: { stepOrder: "asc" } } },
  });
  if (!path) return fail(404, "SOP 路径不存在");
  return ok(path);
}

export async function PUT(req: Request, { params }: Ctx) {
  const guard = await requireAdmin("sops", "write");
  if (guard.error) return guard.error;
  const { id } = await params;
  const b = await req.json();
  const path = await db.sopPath.findUnique({ where: { id } });
  if (!path) return fail(404, "SOP 路径不存在");

  const steps = Array.isArray(b.steps) ? b.steps : [];
  await db.$transaction(async (tx) => {
    await tx.sopStep.deleteMany({ where: { pathId: id } });
    for (let i = 0; i < steps.length; i++) {
      const s = steps[i] as Record<string, unknown>;
      await tx.sopStep.create({
        data: {
          pathId: id,
          stepOrder: i,
          goal: s.goal ? String(s.goal) : null,
          action: String(s.action ?? ""),
          prompt: String(s.prompt ?? ""),
          outputSample: String(s.outputSample ?? ""),
          mediaType: s.mediaType ? String(s.mediaType) : null,
          mediaUrl: null,
          mediaLabel: s.mediaLabel ? String(s.mediaLabel) : null,
          pitfall: s.pitfall ? String(s.pitfall) : null,
          tip: s.tip ? String(s.tip) : null,
          branch: s.branch ? JSON.stringify(s.branch) : null,
        },
      });
    }
    await tx.sopPath.update({
      where: { id },
      data: {
        title: b.title ?? path.title,
        summary: b.summary ?? path.summary,
        estMinutes: b.estMinutes ?? path.estMinutes,
        level: b.level ?? path.level,
        forRole: b.forRole ?? path.forRole,
        isLibraryPick: b.isLibraryPick ?? path.isLibraryPick,
        usefulCount: b.usefulCount ?? path.usefulCount,
        collectCount: b.collectCount ?? path.collectCount,
        usageId: b.usageId ?? path.usageId,
      },
    });
  });
  const updated = await db.sopPath.findUnique({
    where: { id },
    include: { steps: { orderBy: { stepOrder: "asc" } } },
  });
  return ok(updated);
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const guard = await requireAdmin("sops", "delete");
  if (guard.error) return guard.error;
  const { id } = await params;
  const path = await db.sopPath.findUnique({ where: { id } });
  if (!path) return fail(404, "SOP 路径不存在");
  await db.sopPath.delete({ where: { id } });
  return ok({ ok: true });
}
