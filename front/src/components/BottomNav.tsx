"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "@/lib/icons";

const tabs = [
  { href: "/", icon: "House", label: "首页" },
  { href: "/tools", icon: "Wrench", label: "工具" },
  { href: "/usages", icon: "BookOpen", label: "用法" },
  { href: "/literacy", icon: "GraduationCap", label: "通识" },
  { href: "/profile", icon: "User", label: "我的" },
];

export default function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-surface border-t border-border">
      <div className="flex justify-around items-center h-16 pb-safe">
        {tabs.map((tab) => {
          const active =
            pathname === tab.href ||
            (tab.href !== "/" && pathname.startsWith(tab.href));
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`flex flex-col items-center gap-0.5 px-3 py-2 min-w-[44px] min-h-[44px] justify-center transition ${
                active ? "text-primary" : "text-muted"
              }`}
            >
              <Icon name={tab.icon} size={22} />
              <span className="text-[11px] font-semibold">{tab.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
