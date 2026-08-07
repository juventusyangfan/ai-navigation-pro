import { db } from "@/lib/db";
import { requireAdmin, ok, fail } from "@/lib/http";
import { runCollect } from "@/lib/collect/agent";
import { isValidSlug, normalizeHost, normalizeName } from "@/lib/collect/contract";

export const dynamic = "force-dynamic";

/**
 * 采集中心 API。
 *  - action: "discover"  → 跑 LLM 采集，返回候选预览（不入库，需人工确认）
 *  - action: "confirm"   → 把勾选的候选以 draft 入库（跳过已存在的 slug，避免覆盖 curated）
 * 鉴权复用现有 RBAC：discover 需 tools:read，confirm 需 tools:write。
 */
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const action = body.action === "confirm" ? "confirm" : "discover";

  if (action === "discover") {
    const guard = await requireAdmin("tools", "read");
    if (guard.error) return guard.error;
    try {
      const proposals = await runCollect({
        query: String(body.query || ""),
        count: Number(body.count || 10),
        sceneFilter: body.sceneFilter ? String(body.sceneFilter) : undefined,
      });

      // 三重去重：slug / 主机名 / 归一化名称，避免同一工具换 slug 重复入库
      const existing = await db.tool.findMany({ select: { slug: true, url: true, name: true } });
      const bySlug = new Set(existing.map((e) => e.slug).filter(Boolean));
      const byHost = new Set(existing.map((e) => normalizeHost(e.url)).filter(Boolean));
      const byName = new Set(existing.map((e) => normalizeName(e.name)).filter(Boolean));
      const filtered = proposals.filter((p) => {
        const slug = (p.slug || "").toLowerCase().trim();
        const host = normalizeHost(p.url);
        const nm = normalizeName(p.name);
        return !(bySlug.has(slug) || (host && byHost.has(host)) || (nm && byName.has(nm)));
      });

      return ok({ proposals: filtered, excluded: proposals.length - filtered.length });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "采集失败";
      return fail(502, msg);
    }
  }

  // confirm
  const guard = await requireAdmin("tools", "write");
  if (guard.error) return guard.error;

  const list = Array.isArray(body.proposals) ? body.proposals : [];
  let upserted = 0;
  const rejected: string[] = [];
  const created: { slug: string; toolId: string; pathIds: string[] }[] = [];

  try {
    // 预载已存在索引，做 slug / 主机名 / 名称 三重去重（防同工具换 slug 入库）
  const existing = await db.tool.findMany({ select: { slug: true, url: true, name: true } });
  const bySlug = new Set(existing.map((e) => e.slug).filter(Boolean));
  const byHost = new Set(existing.map((e) => normalizeHost(e.url)).filter(Boolean));
  const byName = new Set(existing.map((e) => normalizeName(e.name)).filter(Boolean));

  for (const p of list) {
    const slug = String(p?.slug || "").toLowerCase().trim();
    const name = String(p?.name || "").trim();
    const url = String(p?.url || "").trim();
    const scenes = Array.isArray(p?.scenes) ? (p.scenes as string[]) : [];
    const subjects = Array.isArray(p?.subjects) ? (p.subjects as string[]) : ["综合"];

    if (!isValidSlug(slug) || !name || !url || scenes.length === 0) {
      rejected.push(slug || name || "?（字段不完整）");
      continue;
    }

    const host = normalizeHost(url);
    const nm = normalizeName(name);
    if (bySlug.has(slug)) {
      rejected.push(`${slug}（slug 已存在，跳过）`);
      continue;
    }
    if (host && byHost.has(host)) {
      rejected.push(`${slug}（同主机 ${host} 已存在，疑似重复，跳过）`);
      continue;
    }
    if (nm && byName.has(nm)) {
      rejected.push(`${slug}（同名「${name}」已存在，跳过）`);
      continue;
    }

    const tool = await db.tool.create({
      data: {
        slug,
        name,
        logo: String(p?.logo || "").trim(), // 存 logo URL（采集时已抓 favicon / og:image）
        color: String(p?.color || "#2f6bff"),
        tagline: String(p?.tagline || ""),
        url,
        roles: JSON.stringify(p?.roles ?? []),
        scenes: JSON.stringify(scenes),
        subjects: JSON.stringify(subjects),
        pricing: String(p?.pricing || "Freemium"),
        platform: String(p?.platform || ""),
        pros: JSON.stringify(p?.pros ?? []),
        cons: JSON.stringify(p?.cons ?? []),
        alts: JSON.stringify(p?.alts ?? []),
        compliance: String(p?.compliance || ""),
        rating: 0,
        status: "draft",
      },
    });

    // 创建 LLM 生成的 SOP 使用路径（含 pitfall / tip / branch / media 全字段）
    const pathIds: string[] = [];
    const rawPaths = Array.isArray(p?.paths) ? (p.paths as Record<string, unknown>[]) : [];
    for (let pi = 0; pi < rawPaths.length; pi++) {
      const pp = rawPaths[pi];
      const pathTitle = String(pp?.title || "").trim();
      if (!pathTitle) continue;
      const path = await db.sopPath.create({
        data: {
          toolId: tool.id,
          title: pathTitle,
          summary: String(pp?.summary ?? "").trim() || null,
          estMinutes: Number(pp?.estMinutes) || null,
          level: String(pp?.level ?? "").trim() || null,
          forRole: String(pp?.forRole ?? "").trim() || null,
          scene: scenes[0] ?? null,
          subj: subjects[0] ?? null,
          isLibraryPick: false,
          usageId: crypto.randomUUID(),
          order: pi,
        },
      });
      pathIds.push(path.id);

      const rawSteps = Array.isArray(pp?.steps) ? (pp.steps as Record<string, unknown>[]) : [];
      for (let si = 0; si < rawSteps.length; si++) {
        const rs = rawSteps[si];
        const action = String(rs?.action || "").trim();
        const prompt = String(rs?.prompt || "").trim();
        if (!action && !prompt) continue;

        // media：拆为 mediaType / mediaUrl / mediaLabel
        let mediaType: string | null = null;
        let mediaUrl: string | null = null;
        let mediaLabel: string | null = null;
        const m = rs?.media;
        if (m && typeof m === "object") {
          const mo = m as Record<string, unknown>;
          const mt = String(mo.type ?? "").trim();
          const ml = String(mo.label ?? "").trim();
          if ((mt === "image" || mt === "video" || mt === "file") && ml) {
            mediaType = mt;
            mediaUrl = String(mo.url ?? "").trim() || null;
            mediaLabel = ml;
          }
        }

        // branch：JSON 字符串 {when,then}[]
        let branchJson: string | null = null;
        if (Array.isArray(rs?.branch)) {
          const arr = (rs.branch as Record<string, unknown>[])
            .map((b) => ({ when: String(b.when ?? "").trim(), then: String(b.then ?? "").trim() }))
            .filter((b) => b.when && b.then);
          if (arr.length) branchJson = JSON.stringify(arr);
        }

        await db.sopStep.create({
          data: {
            pathId: path.id,
            stepOrder: si,
            goal: String(rs?.goal ?? "").trim() || null,
            action: action || "按提示词操作",
            prompt,
            outputSample: String(rs?.outputSample ?? "").trim(),
            mediaType,
            mediaUrl,
            mediaLabel,
            pitfall: String(rs?.pitfall ?? "").trim() || null,
            tip: String(rs?.tip ?? "").trim() || null,
            branch: branchJson,
          },
        });
      }
    }

    created.push({ slug: tool.slug, toolId: tool.id, pathIds });
    upserted++;
  }

  return ok({ upserted, rejected, created });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "入库失败";
    return fail(500, msg);
  }
}
