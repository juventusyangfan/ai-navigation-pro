import { db } from "@/lib/db";
import { requireAdmin, ok, fail } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const guard = await requireAdmin("submissions", "read");
  if (guard.error) return guard.error;

  const url = new URL(req.url);
  const status = url.searchParams.get("status");
  const where = status && status !== "all" ? { status } : {};

  const subs = await db.submission.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: { user: { select: { id: true, name: true, email: true } } },
  });

  return ok(
    subs.map((s) => {
      let payload: { tool?: Record<string, unknown>; paths?: unknown[]; submitter?: { name?: string } } = {};
      try {
        payload = JSON.parse(s.payload);
      } catch {
        payload = {};
      }
      const tool = (payload.tool ?? {}) as Record<string, unknown>;
      const paths = Array.isArray(payload.paths) ? payload.paths : [];
      return {
        id: s.id,
        type: s.type,
        status: s.status,
        createdAt: s.createdAt,
        toolName: (tool.name as string) || "(未命名工具)",
        toolUrl: (tool.url as string) || "",
        toolLogo: (tool.logo as string) || "",
        pathCount: paths.length,
        submitterName: payload.submitter?.name || s.user?.name || "匿名",
        resultToolId: s.resultToolId,
      };
    }),
  );
}
