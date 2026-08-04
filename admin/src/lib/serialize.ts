// DB 行 → 前端 data.ts 形状的序列化器，保证 /api/content/* 与 front 的 content.ts 期望一致。
import type { Tool, SopPath, SopStep } from "@prisma/client";

const arr = (s: string): string[] => {
  try {
    const v = JSON.parse(s);
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
};

export function stepToApi(s: SopStep) {
  return {
    goal: s.goal ?? undefined,
    action: s.action,
    prompt: s.prompt,
    outputSample: s.outputSample,
    media: s.mediaType ? { type: s.mediaType, label: s.mediaLabel ?? "" } : undefined,
    pitfall: s.pitfall ?? undefined,
    tip: s.tip ?? undefined,
    branch: s.branch ? JSON.parse(s.branch) : undefined,
  };
}

export function pathToApi(p: SopPath & { steps: SopStep[] }) {
  return {
    title: p.title,
    summary: p.summary ?? undefined,
    estMinutes: p.estMinutes ?? undefined,
    level: p.level ?? undefined,
    forRole: p.forRole ?? undefined,
    usageId: p.usageId ?? undefined,
    steps: [...p.steps].sort((a, b) => a.stepOrder - b.stepOrder).map(stepToApi),
  };
}

export function toolToApi(t: Tool & { paths: (SopPath & { steps: SopStep[] })[] }) {
  return {
    slug: t.slug,
    name: t.name,
    logo: t.logo,
    color: t.color,
    tagline: t.tagline,
    url: t.url,
    roles: arr(t.roles),
    scenes: arr(t.scenes),
    subjects: arr(t.subjects),
    pricing: t.pricing,
    platform: t.platform,
    rating: t.rating,
    pros: arr(t.pros),
    cons: arr(t.cons),
    compliance: t.compliance,
    alts: arr(t.alts),
    paths: [...t.paths].sort((a, b) => a.order - b.order).map(pathToApi),
  };
}

/** 用法库条目（sop_paths 中 usageId 非空 的视图），供 /api/content/usages */
export function usageToApi(p: SopPath & { steps: SopStep[]; tool: Tool }) {
  return {
    id: p.usageId ?? p.id,
    title: p.title,
    scene: p.scene ?? arr(p.tool.scenes)[0] ?? "",
    role: p.forRole ?? "",
    subj: p.subj ?? arr(p.tool.subjects)[0] ?? "综合",
    tool: p.tool.slug,
    toolName: p.tool.name,
    pick: p.isLibraryPick,
    useful: p.usefulCount,
    collect: p.collectCount,
    steps: p.steps.length,
    summary: p.summary ?? "",
  };
}
