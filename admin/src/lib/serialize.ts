// DB 行 → 前端 content.ts 形状的序列化器，保证 /api/content/* 与 front 的 content.ts 期望一致。
import type {
  Tool,
  SopPath,
  SopStep,
  LitModule,
  LitLesson,
  LitLessonSop,
} from "@prisma/client";

const arr = (s: string): string[] => {
  try {
    const v = JSON.parse(s);
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
};

const obj = <T>(s: string): T => {
  try {
    const v = JSON.parse(s);
    return v as T;
  } catch {
    return {} as T;
  }
};

export type LitSource = "official" | "original" | "ugc";
export type LitLinkStatus = "unchecked" | "ok" | "warn" | "broken";


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
    id: p.id,
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
    useful: t.useful,
    favCount: t.favCount,
    createdAt: t.createdAt,
    pros: arr(t.pros),
    cons: arr(t.cons),
    compliance: t.compliance,
    alts: arr(t.alts),
    paths: [...t.paths].sort((a, b) => a.order - b.order).map(pathToApi),
  };
}

/** 用法库条目（所有 sop_paths），供 /api/content/usages */
export function usageToApi(p: SopPath & { steps: SopStep[]; tool: Tool }) {
  return {
    id: p.usageId || p.id,
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

/* ===================== AI 通识课桥接（literacy） ===================== */

export interface LitSopRef {
  id: string; // = SopPath.usageId || SopPath.id（对外链接）
  sopPathId: string; // SOP 路径真外键，后台编辑/关联用
  title: string;
  toolSlug: string;
  toolName: string;
  estMinutes?: number;
  level?: string;
  steps: number;
  reason?: string;
}

export interface LitModuleCard {
  id: string;
  slug: string;
  num: string;
  title: string;
  summary: string;
  icon: string;
  toolSlugs: string[];
  lessonCount: number;
  order: number;
  status: string;
}

export interface LitLessonCard {
  id: string;
  slug: string;
  moduleSlug: string;
  moduleTitle: string;
  title: string;
  hook: string;
  source: LitSource;
  stage?: string;
  durationMin?: number;
  linkStatus: LitLinkStatus;
  sopCount: number;
  order: number;
  status: string;
}

type LitModuleWithCount = LitModule & { _count?: { lessons: number } };
type LitLessonWithCounts = LitLesson & {
  _count?: { sops: number };
  sops?: (LitLessonSop & { sopPath: SopPath & { tool: Tool; _count: { steps: number } } })[];
};
type LitNavItem = { slug: string; title: string; moduleSlug: string } | undefined;

export function litModuleToCard(
  m: LitModuleWithCount,
): LitModuleCard {
  return {
    id: m.id,
    slug: m.slug,
    num: m.num,
    title: m.title,
    summary: m.summary,
    icon: m.icon,
    toolSlugs: arr(m.toolSlugs),
    lessonCount: m._count?.lessons ?? 0,
    order: m.order,
    status: m.status,
  };
}

export function litModuleToDetail(
  m: LitModuleWithCount & { lessons?: LitLessonWithCounts[] },
): LitModuleCard & {
  desc: string;
  goal?: string;
  keywords: string[];
  lessons: LitLessonCard[];
} {
  return {
    ...litModuleToCard(m),
    desc: m.desc,
    goal: m.goal ?? undefined,
    keywords: arr(m.keywords),
    lessons: (m.lessons ?? []).map((l) =>
      litLessonToCard(l, m.slug, m.title),
    ),
  };
}

export function litLessonToCard(
  l: LitLessonWithCounts,
  moduleSlug: string,
  moduleTitle: string,
): LitLessonCard {
  return {
    id: l.id,
    slug: l.slug,
    moduleSlug,
    moduleTitle,
    title: l.title,
    hook: l.hook,
    source: l.source as LitSource,
    stage: l.stage ?? undefined,
    durationMin: l.durationMin ?? undefined,
    linkStatus: l.linkStatus as LitLinkStatus,
    sopCount: l._count?.sops ?? 0,
    order: l.order,
    status: l.status,
  };
}

export function sopRefToApi(
  r: LitLessonSop & { sopPath: SopPath & { tool: Tool; _count: { steps: number } } },
): LitSopRef {
  return {
    id: r.sopPath.usageId || r.sopPath.id, // 与 usageToApi 同一表达式，ADR-001
    sopPathId: r.sopPath.id, // 真外键，后台关联/编辑用
    title: r.sopPath.title,
    toolSlug: r.sopPath.tool.slug,
    toolName: r.sopPath.tool.name,
    estMinutes: r.sopPath.estMinutes ?? undefined,
    level: r.sopPath.level ?? undefined,
    steps: r.sopPath._count.steps,
    reason: r.reason ?? undefined,
  };
}

export function litLessonToDetail(
  l: LitLessonWithCounts,
  moduleSlug: string,
  moduleTitle: string,
  nav?: { prev?: LitNavItem; next?: LitNavItem },
): LitLessonCard & {
  officialUrl?: string;
  officialProvider?: string;
  officialColumn?: string;
  fallbackUrl?: string;
  archiveNote?: string;
  guideIntro: string;
  watchPoints: string[];
  afterAction: string;
  editorNote?: string;
  faq: { q: string; a: string }[];
  keywords: string[];
  sops: LitSopRef[];
  prev?: { slug: string; title: string; moduleSlug: string };
  next?: { slug: string; title: string; moduleSlug: string };
  viewCount: number;
  usefulCount: number;
  collectCount: number;
  publishedAt?: string;
  updatedAt: string;
} {
  return {
    ...litLessonToCard(l, moduleSlug, moduleTitle),
    officialUrl: l.officialUrl ?? undefined,
    officialProvider: l.officialProvider ?? undefined,
    officialColumn: l.officialColumn ?? undefined,
    fallbackUrl: l.fallbackUrl ?? undefined,
    archiveNote: l.archiveNote ?? undefined,
    guideIntro: l.guideIntro,
    watchPoints: arr(l.watchPoints),
    afterAction: l.afterAction,
    editorNote: l.editorNote ?? undefined,
    faq: obj<{ q: string; a: string }[]>(l.faq),
    keywords: arr(l.keywords),
    sops: (l.sops ?? []).map(sopRefToApi),
    prev: nav?.prev,
    next: nav?.next,
    viewCount: l.viewCount,
    usefulCount: l.usefulCount,
    collectCount: l.collectCount,
    publishedAt: l.publishedAt?.toISOString(),
    updatedAt: l.updatedAt.toISOString(),
  };
}
