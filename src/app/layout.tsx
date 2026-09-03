import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "个税规划器 · 算清今年到底交多少税",
  description: "输入工作经历和工资，自动算出全年个税、五险一金、汇算清缴退补税，并给出年终奖、期权和专项附加扣除的省税方案。",
};

export const viewport: Viewport = {
  themeColor: "#f6f5f2",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="zh-CN" className="h-full antialiased" style={{ ["--font-sans-stack" as string]: '-apple-system, BlinkMacSystemFont, "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Helvetica Neue", Arial, sans-serif' }}>
      <body className="min-h-full">{children}</body>
    </html>
  );
}
