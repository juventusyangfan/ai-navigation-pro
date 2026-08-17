// 取数缝（Content Seam）——全站统一取数入口
// ------------------------------------------------------------------
// 全站数据通过 admin 后台 /api/content/* 获取。
// NEXT_PUBLIC_API_BASE 指向 admin 源站地址。

/* ================================================================
   Type Definitions
   ================================================================ */

export type Role = "老师" | "学生" | "家长" | "学校管理员";
export type Pricing = "Free" | "Freemium" | "Paid" | "Enterprise";
export type Level = "入门" | "进阶" | "熟练";

export interface Cat {
  icon: string;
  phase: string;
  desc: string;
}

export interface Scene {
  key: string;
  name: string;
  cat: string;
  icon: string;
  roles: Role[];
}

export interface Step {
  goal?: string;
  action: string;
  prompt: string;
  outputSample: string;
  media?: { type: "image" | "video" | "file"; label: string };
  pitfall?: string;
  tip?: string;
  branch?: { when: string; then: string }[];
}

export interface Path {
  title: string;
  summary?: string;
  estMinutes?: number;
  level?: Level;
  forRole?: Role;
  usageId?: string;
  steps: Step[];
}

export interface Tool {
  slug: string;
  name: string;
  logo: string;
  color: string;
  tagline: string;
  url: string;
  roles: Role[];
  scenes: string[];
  subjects: string[];
  pricing: Pricing;
  platform: string;
  rating: number;
  useful: number;
  favCount: number;
  createdAt?: string;
  pros: string[];
  cons: string[];
  compliance: string;
  alts: string[];
  paths: Path[];
}

export interface Usage {
  id: string;
  title: string;
  scene: string;
  role: Role;
  subj: string;
  tool: string;
  toolName?: string;
  pick: boolean;
  useful: number;
  collect: number;
  steps: number;
  summary: string;
}

/* ================================================================
   AI 通识课桥接（literacy）类型
   ================================================================ */
export type LitSource = "official" | "original" | "ugc";
export type LitLinkStatus = "unchecked" | "ok" | "warn" | "broken";

export interface LitSopRef {
  id: string; // = 站内 SOP 公开 id（usageId || sopPathId），前端拼 /usages/{id}
  sopPathId: string; // SOP 路径真外键（后台用，前台一般忽略）
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
}

export interface LitModuleDetail extends LitModuleCard {
  desc: string;
  goal?: string;
  keywords: string[];
  lessons: LitLessonCard[];
}

export interface LitLessonDetail extends LitLessonCard {
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
}

export interface LitIndex {
  modules: LitModuleCard[];
  lessons: LitLessonCard[]; // 全量已发布课时摘要
}

export interface LitLessonQuery {
  module?: string;
  source?: LitSource;
  stage?: string;
  limit?: number;
}

/* ================================================================
   Utility Functions
   ================================================================ */

export function roleClass(r: Role): "teacher" | "student" | "parent" | "admin" {
  return r === "老师"
    ? "teacher"
    : r === "学生"
      ? "student"
      : r === "家长"
        ? "parent"
        : "admin";
}

export function pricingLabel(p: Pricing): string {
  return p === "Free"
    ? "免费"
    : p === "Freemium"
      ? "免费+增值"
      : p === "Paid"
        ? "付费"
        : "企业版";
}

/* ================================================================
   Content Source
   ================================================================ */

export interface ContentSource {
  getTools(): Promise<Tool[]>;
  getTool(slug: string): Promise<Tool | null>;
  getToolMap(): Promise<Record<string, Tool>>;
  getScenes(): Promise<Scene[]>;
  getScene(key: string): Promise<Scene | null>;
  getSceneName(): Promise<Record<string, string>>;
  getCategories(): Promise<Record<string, Cat>>;
  getUsages(): Promise<Usage[]>;
  getUsage(id: string): Promise<Usage | null>;
  toolsByScene(key: string): Promise<Tool[]>;
  usagesForScene(key: string): Promise<Usage[]>;
  usagesForTool(slug: string): Promise<Usage[]>;

  // —— AI 通识课桥接 ——
  getLiteracyIndex(): Promise<LitIndex>;
  getLitModules(): Promise<LitModuleCard[]>;
  getLitModule(slug: string): Promise<LitModuleDetail | null>;
  getLitLessons(q?: LitLessonQuery): Promise<LitLessonCard[]>;
  getLitLesson(slug: string): Promise<LitLessonDetail | null>;
}

function apiUrl(path: string): string {
  if (path.startsWith("http")) return path;
  // 服务端渲染(SSR)时优先走内网地址(INTERNAL_API_BASE)，避免依赖公网 DNS / 回环；
  // 浏览器端该变量不存在，自动回落到公网域名 NEXT_PUBLIC_API_BASE。
  const base = process.env.INTERNAL_API_BASE ?? process.env.NEXT_PUBLIC_API_BASE ?? "";
  return `${base}/api/content${path}`;
}

// 安全 fetch：build 时 admin API 可能不可达，失败返回 null 而非抛错
async function safeFetch<T>(url: string, fallback: T): Promise<T> {
  try {
    const r = await fetch(url, { cache: "no-cache" });
    if (!r.ok) return fallback;
    return (await r.json()) as T;
  } catch {
    return fallback;
  }
}

const remoteSource: ContentSource = {
  getTools: () => safeFetch<Tool[]>(apiUrl("/tools"), []),
  getTool: async (slug) => {
    const r = await safeFetch<Tool | null>(apiUrl(`/tools/${slug}`), null);
    return r;
  },
  getToolMap: async () => {
    const list = await remoteSource.getTools();
    return Object.fromEntries(list.map((t) => [t.slug, t]));
  },
  getScenes: () => safeFetch<Scene[]>(apiUrl("/scenes"), []),
  getScene: async (key) => {
    const list = await remoteSource.getScenes();
    return list.find((s) => s.key === key) ?? null;
  },
  getSceneName: async () => {
    const list = await remoteSource.getScenes();
    return Object.fromEntries(list.map((s) => [s.key, s.name]));
  },
  getCategories: () =>
    safeFetch<Record<string, Cat>>(apiUrl("/taxonomy/categories"), {}),
  getUsages: () => safeFetch<Usage[]>(apiUrl("/usages"), []),
  getUsage: async (id) => {
    return safeFetch<Usage | null>(apiUrl(`/usages/${id}`), null);
  },
  toolsByScene: async (key) => {
    const list = await remoteSource.getTools();
    return list.filter((t) => t.scenes.includes(key));
  },
  usagesForScene: async (key) => {
    const list = await remoteSource.getUsages();
    return list.filter((u) => u.scene === key);
  },
  usagesForTool: async (slug) => {
    const list = await remoteSource.getUsages();
    return list.filter((u) => u.tool === slug);
  },

  // —— AI 通识课桥接 ——
  getLiteracyIndex: () =>
    safeFetch<LitIndex>(apiUrl("/literacy/index"), { modules: [], lessons: [] }),
  getLitModules: () =>
    safeFetch<LitModuleCard[]>(apiUrl("/literacy/modules"), []),
  getLitModule: (slug: string) =>
    safeFetch<LitModuleDetail | null>(apiUrl(`/literacy/modules/${slug}`), null),
  getLitLessons: (q: LitLessonQuery = {}) => {
    const qs = new URLSearchParams();
    if (q.module) qs.set("module", q.module);
    if (q.source) qs.set("source", q.source);
    if (q.stage) qs.set("stage", q.stage);
    if (q.limit) qs.set("limit", String(q.limit));
    const suffix = qs.toString() ? `?${qs}` : "";
    return safeFetch<LitLessonCard[]>(apiUrl(`/literacy/lessons${suffix}`), []);
  },
  getLitLesson: (slug: string) =>
    safeFetch<LitLessonDetail | null>(apiUrl(`/literacy/lessons/${slug}`), null),
};

export const content: ContentSource = remoteSource;
