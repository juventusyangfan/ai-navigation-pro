import type { Metadata } from "next";
import { Nunito, DM_Sans, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import BottomNav from "@/components/BottomNav";

const nunito = Nunito({
  subsets: ["latin"],
  weight: ["700", "800", "900"],
  variable: "--font-heading",
  display: "swap",
});

const dmSans = DM_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-body",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["500", "700"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_ORIGIN ?? "https://eanavi.com"),
  title: "智用笔记 · 教育AI工具导航平台",
  description:
    "面向老师/学生/家长的教育AI工具导航 + 使用路径SOP平台，找得到、学得会、用得上",
  icons: {
    icon: "/favicon.ico",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="zh-CN"
      className={`${nunito.variable} ${dmSans.variable} ${jetbrainsMono.variable}`}
    >
      <body className="flex flex-col min-h-screen pb-16 md:pb-0">
        <a href="#main-content" className="skip-link">
          跳到主要内容
        </a>
        <Header />
        <div id="main-content" className="flex-1" tabIndex={-1}>
          {children}
        </div>
        <Footer />
        <BottomNav />
      </body>
    </html>
  );
}
