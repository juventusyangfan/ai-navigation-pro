"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Icon } from "@/lib/icons";

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

  return (
    <header className="header-site">
      <div className="wrap nav">
        <Link href="/" className="brand">
          <span className="logo">教</span>
          <span>
            教AI导航<span className="brand-logo-sub">·</span>
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
          <Link href="/login" className="btn btn-sm btn-primary">
            登录
          </Link>
        </div>
      </div>
    </header>
  );
}
