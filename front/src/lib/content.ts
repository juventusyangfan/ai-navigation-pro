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
}

function apiUrl(path: string): string {
  if (path.startsWith("http")) return path;
  const base = process.env.NEXT_PUBLIC_API_BASE ?? "";
  return `${base}/api/content${path}`;
}

// 安全 fetch：build 时 admin API 可能不可达，失败返回 null 而非抛错
async function safeFetch<T>(url: string, fallback: T): Promise<T> {
  try {
    const r = await fetch(url, { cache: "no-store" });
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
};

export const content: ContentSource = remoteSource;
