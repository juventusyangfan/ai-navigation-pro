import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "写作水平测评 · 树蕙伴学",
  description:
    "上传或粘贴孩子的作文，几分钟拿到一份具体的写作点评：四个维度的分数、写得好的地方，以及今晚就能动手改的两三处。",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
  themeColor: "#dd6034",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
