"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

// Admin侧边栏导航配置
const ADMIN_NAV = [
  { href: "/admin", label: "仪表盘", icon: "📊" },
  { href: "/admin/tools", label: "工具管理", icon: "🔧" },
  { href: "/admin/sops", label: "SOP编辑器", icon: "📝" },
  { href: "/admin/usages", label: "用法库", icon: "📘" },
  { href: "/admin/taxonomy", label: "分类法", icon: "🏷️" },
  { href: "/admin/ratings", label: "评价管理", icon: "⭐" },
  { href: "/admin/feedback", label: "反馈管理", icon: "💬" },
  { href: "/admin/notes", label: "笔记管理", icon: "📓" },
  { href: "/admin/submissions", label: "投稿审核", icon: "📥" },
  { href: "/admin/users", label: "用户管理", icon: "👤" },
  { href: "/admin/roles", label: "角色权限", icon: "🔐" },
  { href: "/admin/media", label: "媒体库", icon: "🖼️" },
  { href: "/admin/site", label: "站点配置", icon: "⚙️" },
  { href: "/admin/analytics", label: "数据看板", icon: "📈" },
];

// RBAC权限映射
const ROLE_PERMISSION_MAP: Record<string, string[]> = {
  super_admin: ["*"],
  editor: ["tools", "sops", "usages", "taxonomy", "media", "site"],
  reviewer: ["ratings", "feedback", "notes", "submissions"],
  school_admin: ["pushes"],
};

interface AdminUser {
  id: string;
  email: string;
  name: string;
  role: string;
}

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<AdminUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // 检查登录状态
  useEffect(() => {
    const checkAuth = async () => {
      // 登录页不需要检查
      if (pathname === "/admin/login") {
        setLoading(false);
        return;
      }

      try {
        const saved = localStorage.getItem("admin_user");
        if (saved) {
          const adminUser = JSON.parse(saved);
          setUser(adminUser);
        } else {
          router.push("/admin/login");
        }
      } catch {
        router.push("/admin/login");
      } finally {
        setLoading(false);
      }
    };

    checkAuth();
  }, [pathname, router]);

  // 检查权限
  const hasPermission = (module: string): boolean => {
    if (!user) return false;
    const permissions = ROLE_PERMISSION_MAP[user.role] || [];
    return permissions.includes("*") || permissions.includes(module);
  };

  // 登录页直接渲染子组件
  if (pathname === "/admin/login") {
    return <>{children}</>;
  }

  // 加载中
  if (loading) {
    return (
      <div className="admin-loading">
        <div className="spinner"></div>
        <span>加载中...</span>
      </div>
    );
  }

  // 未登录
  if (!user) {
    return null;
  }

  const handleLogout = () => {
    localStorage.removeItem("admin_user");
    router.push("/admin/login");
  };

  return (
    <div className={`admin-layout ${sidebarOpen ? "sidebar-open" : ""}`}>
      {/* 侧边栏 */}
      <aside className="admin-sidebar">
        <div className="sidebar-header">
          <Link href="/admin" className="sidebar-brand">
            <span className="logo">教</span>
            <span>后台管理</span>
          </Link>
        </div>

        <nav className="sidebar-nav">
          {ADMIN_NAV.map((item) => {
            const module = item.href.replace("/admin/", "") || "dashboard";
            if (!hasPermission(module) && user.role !== "super_admin") {
              return null;
            }

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`sidebar-link ${
                  pathname === item.href ? "active" : ""
                }`}
              >
                <span className="icon">{item.icon}</span>
                <span className="label">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="sidebar-footer">
          <Link href="/" className="back-link">
            ← 返回前台
          </Link>
        </div>
      </aside>

      {/* 主内容区 */}
      <div className="admin-main">
        {/* 顶部栏 */}
        <header className="admin-topbar">
          <button
            className="sidebar-toggle"
            onClick={() => setSidebarOpen(!sidebarOpen)}
          >
            ☰
          </button>

          <div className="topbar-title">{getPageTitle(pathname)}</div>

          <div className="topbar-right">
            <div className="user-info">
              <span className="user-name">{user.name}</span>
              <span className="user-role">{getRoleLabel(user.role)}</span>
            </div>
            <button className="logout-btn" onClick={handleLogout}>
              退出
            </button>
          </div>
        </header>

        {/* 内容区域 */}
        <main className="admin-content">{children}</main>
      </div>
    </div>
  );
}

// 获取页面标题
function getPageTitle(pathname: string): string {
  const nav = ADMIN_NAV.find((n) => n.href === pathname);
  return nav?.label || "后台管理";
}

// 获取角色标签
function getRoleLabel(role: string): string {
  const labels: Record<string, string> = {
    super_admin: "超级管理员",
    editor: "编辑",
    reviewer: "审核员",
    school_admin: "学校管理员",
  };
  return labels[role] || role;
}