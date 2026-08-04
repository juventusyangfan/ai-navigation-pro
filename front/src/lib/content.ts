// 取数缝（Content Seam）——全站统一取数入口
// ------------------------------------------------------------------
// 现在：StaticSource 读硬编码的 data.ts（SSG 构建期照常预渲染）。
// 将来：后台就绪后把 NEXT_PUBLIC_CONTENT_SOURCE 置为 "remote"，
//       自动切到 RemoteSource（调 /api/content/*），页面零重写。
//
// 约定：服务端页面通过 `await content.x()` 取数；客户端过滤 UI 暂直接
// 引用本模块 re-export 的同步常量（TOOLS/SCENES/USAGES…），待后台上线后
// 再改为服务端驱动的查询（Phase 2）。

export * from "@/lib/data";

import {
  TOOLS,
  TOOL_MAP,
  SCENES,
  SCENE_NAME,
  CATS,
  USAGES,
  getTool,
  getScene,
  getUsage,
  toolsByScene,
  usagesForScene,
  usagesForTool,
  type Tool,
  type Usage,
  type Scene,
  type Cat,
} from "@/lib/data";

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

const staticSource: ContentSource = {
  getTools: () => Promise.resolve(TOOLS),
  getTool: (slug) => Promise.resolve(getTool(slug) ?? null),
  getToolMap: () => Promise.resolve(TOOL_MAP),
  getScenes: () => Promise.resolve(SCENES),
  getScene: (key) => Promise.resolve(getScene(key) ?? null),
  getSceneName: () => Promise.resolve(SCENE_NAME),
  getCategories: () => Promise.resolve(CATS),
  getUsages: () => Promise.resolve(USAGES),
  getUsage: (id) => Promise.resolve(getUsage(id) ?? null),
  toolsByScene: (key) => Promise.resolve(toolsByScene(key)),
  usagesForScene: (key) => Promise.resolve(usagesForScene(key)),
  usagesForTool: (slug) => Promise.resolve(usagesForTool(slug)),
};

function apiUrl(path: string): string {
  // 同源（默认）直接拼 /api/content；后台独立部署时由 NEXT_PUBLIC_API_BASE 跨域指向
  // admin 的 /api/content/*（如 http://localhost:3001），前端 remote 模式才能命中。
  if (path.startsWith("http")) return path;
  const base = process.env.NEXT_PUBLIC_API_BASE ?? "";
  return `${base}/api/content${path}`;
}

// RemoteSource：后台就绪后的取数实现。接口契约见方案文档 2.8 节。
// 当前（Phase 1）后台未建，默认不启用；启用后需配套实现 /api/content/* 路由。
const remoteSource: ContentSource = {
  getTools: () => fetch(apiUrl("/tools")).then((r) => r.json()),
  getTool: async (slug) => {
    const r = await fetch(apiUrl(`/tools/${slug}`));
    return r.ok ? r.json() : null;
  },
  getToolMap: async () => {
    const list = await remoteSource.getTools();
    return Object.fromEntries(list.map((t) => [t.slug, t]));
  },
  getScenes: () => fetch(apiUrl("/scenes")).then((r) => r.json()),
  getScene: async (key) => {
    const list = await remoteSource.getScenes();
    return list.find((s) => s.key === key) ?? null;
  },
  getSceneName: async () => {
    const list = await remoteSource.getScenes();
    return Object.fromEntries(list.map((s) => [s.key, s.name]));
  },
  getCategories: () => fetch(apiUrl("/taxonomy/categories")).then((r) => r.json()),
  getUsages: () => fetch(apiUrl("/usages")).then((r) => r.json()),
  getUsage: async (id) => {
    const r = await fetch(apiUrl(`/usages/${id}`));
    return r.ok ? r.json() : null;
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

export const content: ContentSource =
  process.env.NEXT_PUBLIC_CONTENT_SOURCE === "remote" ? remoteSource : staticSource;
