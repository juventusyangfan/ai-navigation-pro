import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "智用笔记 · 后台管理",
  description: "工具库 + SOP 库内容中台",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
