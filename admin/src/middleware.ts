import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { verifySession } from "@/lib/jwt";

// 仅保护后台页面 /admin/* 与管理 API /api/admin/*。
// 公开 API（/api/auth、/api/content、/api/me）与静态资源不在 matcher 内，天然放行。
export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // 登录页本身始终可访问（已登录也可访问，会重定向到后台）
  if (pathname === "/admin/login") {
    const token = req.cookies.get("ea_admin_session")?.value;
    const session = token ? await verifySession(token) : null;
    if (session) return NextResponse.redirect(new URL("/admin", req.url));
    return NextResponse.next();
  }

  const token = req.cookies.get("ea_admin_session")?.value;
  const session = token ? await verifySession(token) : null;
  if (!session) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "未登录" }, { status: 401 });
    }
    const url = req.nextUrl.clone();
    url.pathname = "/admin/login";
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*"],
};
