import type { Metadata, Viewport } from "next";
import Script from "next/script";
import type { ReactNode } from "react";
import "./globals.css";

export const SITE_URL = "https://tax.warmbeing.com";
export const SITE_NAME = "个税规划器";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "个税规划器 · 2026 个税计算器，算清全年个税、汇算退税、年终奖和期权怎么拿最省",
    template: "%s · 个税规划器",
  },
  description:
    "免费的 2026 年个人所得税计算器：填工作经历和月薪，自动反推五险一金，逐月看预扣税率跳档，算出汇算清缴退税或补税，对比年终奖单独计税 vs 并入，期权 / RSU 兑现拐点一图看清。数据只存本地，不上传。",
  keywords: [
    "个税计算器",
    "2026 个税计算器",
    "个人所得税计算器",
    "税后工资计算器",
    "年终奖计算器",
    "年终奖个税",
    "汇算清缴退税",
    "个税退税计算",
    "五险一金计算",
    "累计预扣法",
    "专项附加扣除",
    "期权行权个税",
    "RSU 个税",
  ],
  applicationName: SITE_NAME,
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    locale: "zh_CN",
    siteName: SITE_NAME,
    title: "个税规划器 · 2026 个税计算器",
    description: "填工作经历和月薪，算清全年个税、汇算退补、年终奖和期权怎么拿最省。免费，数据不上传。",
    images: [{ url: "/og.png", width: 1200, height: 630, alt: "个税规划器" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "个税规划器 · 2026 个税计算器",
    description: "填工作经历和月薪，算清全年个税、汇算退补、年终奖和期权怎么拿最省。",
    images: ["/og.png"],
  },
  robots: { index: true, follow: true, googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1 } },
  icons: { icon: "/icon.svg", apple: "/logo.png" },
  other: { "baidu-site-verification": process.env.NEXT_PUBLIC_BAIDU_SITE_VERIFICATION ?? "" },
};

export const viewport: Viewport = {
  themeColor: "#f6f5f2",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  const tongji = process.env.NEXT_PUBLIC_BAIDU_TONGJI_ID;
  return (
    <html lang="zh-CN" className="h-full antialiased" style={{ ["--font-sans-stack" as string]: '-apple-system, BlinkMacSystemFont, "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Helvetica Neue", Arial, sans-serif' }}>
      <body className="min-h-full">
        {children}
        {tongji && <Script id="baidu-tongji" src={`https://hm.baidu.com/hm.js?${tongji}`} strategy="afterInteractive" />}
      </body>
    </html>
  );
}
