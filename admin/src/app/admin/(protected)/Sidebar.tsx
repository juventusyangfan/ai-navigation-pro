"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

const NAV: { group: string; items: { href: string; label: string }[] }[] = [
  {
    group: "内容",
    items: [
      { href: "/admin", label: "仪表盘" },
      { href: "/admin/tools", label: "工具管理" },
      { href: "/admin/collect", label: "采集中心" },
      { href: "/admin/submissions", label: "投稿审核" },
      { href: "/admin/sops", label: "SOP 编辑器" },
      { href: "/admin/usages", label: "用法库" },
      { href: "/admin/taxonomy", label: "分类法" },
    ],
  },
  {
    group: "用户",
    items: [
      { href: "/admin/members", label: "注册用户" },
      { href: "/admin/users", label: "管理员与角色" },
      { href: "/admin/feedback", label: "反馈管理" },
      { href: "/admin/analytics", label: "数据看板" },
    ],
  },
];

export default function Sidebar({ name, role }: { name: string; role: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const isActive = (href: string) =>
    href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/admin/login");
    router.refresh();
  }

  return (
    <aside className="sidebar">
      <div className="brand">
        教AI导航 · 后台
        <small>内容中台 Content CMS</small>
      </div>
      {NAV.map((g) => (
        <div key={g.group}>
          <div className="nav-group">{g.group}</div>
          {g.items.map((it) => (
            <Link
              key={it.href}
              href={it.href}
              className={`nav-link${isActive(it.href) ? " active" : ""}`}
            >
              {it.label}
            </Link>
          ))}
        </div>
      ))}
      <div className="me">
        <div>
          <b>{name}</b>
        </div>
        <div>角色：{role}</div>
        <div className="logout" onClick={logout}>
          退出登录
        </div>
      </div>
    </aside>
  );
}
