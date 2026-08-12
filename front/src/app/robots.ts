import type { MetadataRoute } from "next";

const BASE = process.env.NEXT_PUBLIC_SITE_ORIGIN ?? "https://eanavi.com";

// 爬虫规则：公开内容全放开，后台与 API 全部封禁。
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/api/", "/admin/"],
    },
    sitemap: `${BASE}/sitemap.xml`,
    host: BASE,
  };
}
