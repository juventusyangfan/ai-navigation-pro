import type { MetadataRoute } from "next";
import { content } from "@/lib/content";

const BASE = process.env.NEXT_PUBLIC_SITE_ORIGIN ?? "https://eanavi.com";

// 站点地图：静态路由 + literacy 模块/课时（数据不可达时退化为仅静态 + 索引）。
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticRoutes = ["", "/literacy", "/usages", "/scenes", "/compliance", "/about"].map(
    (p) => ({
      url: `${BASE}${p}`,
      lastModified: new Date(),
    }),
  );

  let dynamic: MetadataRoute.Sitemap = [];
  try {
    const [modules, lessons] = await Promise.all([
      content.getLitModules(),
      content.getLitLessons(),
    ]);
    for (const m of modules) {
      dynamic.push({ url: `${BASE}/literacy/${m.slug}`, lastModified: new Date() });
    }
    for (const l of lessons) {
      dynamic.push({
        url: `${BASE}/literacy/${l.moduleSlug}/${l.slug}`,
        lastModified: new Date(),
      });
    }
  } catch {
    // 后台不可达：只提交静态路由 + literacy 索引，构建不崩
  }

  return [...staticRoutes, ...dynamic];
}
