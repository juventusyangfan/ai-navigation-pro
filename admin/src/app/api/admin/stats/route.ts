import { db } from "@/lib/db";
import { requireAdmin, ok } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function GET() {
  const guard = await requireAdmin("tools", "read");
  if (guard.error) return guard.error;
  const [tools, paths, picks, rating, feedbackPending, submissionsPending] = await Promise.all([
    db.tool.count(),
    db.sopPath.count(),
    db.sopPath.count({ where: { isLibraryPick: true } }),
    db.tool.aggregate({ _avg: { rating: true } }),
    db.feedback.count({ where: { status: "pending" } }),
    db.submission.count({ where: { status: "pending" } }),
  ]);
  return ok({
    tools,
    paths,
    picks,
    avgRating: rating._avg.rating ?? 0,
    feedbackPending,
    submissionsPending,
  });
}
