"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Icon } from "@/lib/icons";
import { getSession, clearSession, type SessionUser } from "@/lib/auth";

const navLinks = [
  { href: "/", label: "首页" },
  { href: "/scenes", label: "全部场景" },
  { href: "/tools", label: "全部工具" },
  { href: "/usages", label: "用法库" },
  { href: "/literacy", label: "AI通识课" },
  { href: "/submit", label: "投稿" },
];

export default function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const [session, setSession] = useState<SessionUser | null>(null);

  useEffect(() => {
    setSession(getSession());
    const sync = () => setSession(getSession());
    window.addEventListener("ea:auth-change", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("ea:auth-change", sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const handleLogout = () => {
    clearSession();
    router.push("/");
  };

  return (
    <header className="header-site">
      <div className="wrap nav">
        <Link href="/" className="brand">
          <span className="logo">智</span>
          <span>
            智用笔记<span className="brand-logo-sub">·</span>
          </span>
        </Link>
        <nav className="nav-links">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={pathname === link.href ? "active" : ""}
            >
              {link.label}
            </Link>
          ))}
        </nav>
        <div className="nav-right">
          <form
            className="searchbar"
            onSubmit={(e) => {
              e.preventDefault();
              const v = (e.currentTarget.elements.namedItem("q") as HTMLInputElement).value.trim();
              if (v) router.push(`/search?q=${encodeURIComponent(v)}`);
            }}
          >
            <Icon name="MagnifyingGlass" size={16} className="text-muted" />
            <input name="q" type="text" placeholder="搜工具 / 场景 / 用法…" />
          </form>
          {session ? (
            <>
              <Link href="/profile" className="user-center" title="个人中心">
                <span className="uc-avatar">{(session.name || "U")[0]}</span>
                <span className="uc-name">{session.name}</span>
              </Link>
              <button type="button" className="btn btn-sm btn-ghost" onClick={handleLogout}>
                <Icon name="SignOut" size={16} />
                <span>退出</span>
              </button>
            </>
          ) : (
            <>
              <Link href="/register" className="btn btn-sm btn-ghost">
                注册
              </Link>
              <Link href="/login" className="btn btn-sm btn-primary">
                登录
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
