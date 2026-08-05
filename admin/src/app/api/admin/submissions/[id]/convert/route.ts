import { db } from "@/lib/db";
import { requireAdmin, ok, fail } from "@/lib/http";
import { getSessionPayload } from "@/lib/auth";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

function slugify(name: string): string {
  const s = name
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9一-龥-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return s || "tool";
}

async function uniqueSlug(base: string): Promise<string> {
  const root = slugify(base);
  let slug = root;
  let n = 2;
  while (await db.tool.findUnique({ where: { slug } })) {
    slug = `${root}-${n++}`;
  }
  return slug;
}

interface InStep {
  goal?: string;
  action?: string;
  prompt?: string;
  outputSample?: string;
  pitfall?: string;
  tip?: string;
}
interface InPath {
  title?: string;
  summary?: string;
  estMinutes?: number;
  level?: string;
  forRole?: string;
  isLibraryPick?: boolean;
  steps?: InStep[];
}
interface InTool {
  name?: string;
  url?: string;
  logo?: string;
  tagline?: string;
  roles?: string[];
  scenes?: string[];
  subjects?: string[];
  pricing?: string;
  platform?: string;
  compliance?: string;
  pros?: string[];
  cons?: string[];
  alts?: string[];
}

export async function POST(req: Request, { params }: Ctx) {
  // 转工具即"通过投稿"，由 submissions 审核权限统一把关（reviewer/editor/admin 均可）。
  const guard = await requireAdmin("submissions", "review");
  if (guard.error) return guard.error;

  const { id } = await params;
  const sub = await db.submission.findUnique({ where: { id } });
  if (!sub) return fail(404, "投稿不存在");
  if (sub.status === "approved") return fail(409, "该投稿已处理");

  let payload: { tool?: InTool; paths?: InPath[] };
  try {
    payload = JSON.parse(sub.payload);
  } catch {
    return fail(400, "投稿数据损坏");
  }
  const tool = payload.tool;
  if (!tool || !tool.name) return fail(400, "投稿缺少工具信息");

  const body = (await req.json().catch(() => ({}))) as { slug?: string; color?: string; status?: string };
  const color = body.color || "#2f6bff";
  const status = body.status || "published";
  const slug = await uniqueSlug(body.slug?.trim() ? body.slug! : tool.name!);

  const session = await getSessionPayload();
  const reviewerId = session?.sub || guard.admin!.id;

  try {
    const result = await db.$transaction(async (tx) => {
      const scenes = Array.isArray(tool.scenes) ? tool.scenes : [];
      const subjects = Array.isArray(tool.subjects) ? tool.subjects : [];
      const created = await tx.tool.create({
        data: {
          slug,
          name: tool.name!,
          logo: tool.logo || String(tool.name).slice(0, 2),
          color,
          tagline: tool.tagline ?? "",
          url: tool.url ?? "",
          roles: JSON.stringify(Array.isArray(tool.roles) ? tool.roles : []),
          scenes: JSON.stringify(scenes),
          subjects: JSON.stringify(subjects),
          pricing: tool.pricing || "Free",
          platform: tool.platform ?? "",
          pros: JSON.stringify(Array.isArray(tool.pros) ? tool.pros : []),
          cons: JSON.stringify(Array.isArray(tool.cons) ? tool.cons : []),
          alts: JSON.stringify(Array.isArray(tool.alts) ? tool.alts : []),
          compliance: tool.compliance ?? "",
          status,
          rating: 0,
        },
      });

      const paths = Array.isArray(payload.paths) ? payload.paths : [];
      let order = 0;
      for (const p of paths) {
        if (!p || !p.title) continue;
        const sp = await tx.sopPath.create({
          data: {
            toolId: created.id,
            title: p.title,
            summary: p.summary ?? null,
            estMinutes: typeof p.estMinutes === "number" ? p.estMinutes : null,
            level: p.level ?? null,
            forRole: p.forRole ?? null,
            scene: scenes[0] ?? null,
            subj: subjects[0] ?? null,
            isLibraryPick: !!p.isLibraryPick,
            usageId: crypto.randomUUID(),
            order: order++,
          },
        });
        const steps = Array.isArray(p.steps) ? p.steps : [];
        for (let i = 0; i < steps.length; i++) {
          const s = steps[i];
          if (!s) continue;
          await tx.sopStep.create({
            data: {
              pathId: sp.id,
              stepOrder: i,
              goal: s.goal ? String(s.goal) : null,
              action: String(s.action ?? ""),
              prompt: String(s.prompt ?? ""),
              outputSample: String(s.outputSample ?? ""),
              mediaType: null,
              mediaUrl: null,
              mediaLabel: null,
              pitfall: s.pitfall ? String(s.pitfall) : null,
              tip: s.tip ? String(s.tip) : null,
              branch: null,
            },
          });
        }
      }

      await tx.submission.update({
        where: { id },
        data: { status: "approved", reviewerId, resultToolId: created.id },
      });

      return { toolId: created.id, slug: created.slug };
    });
    return ok(result, { status: 201 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "未知错误";
    return fail(500, "转工具失败：" + msg);
  }
}
