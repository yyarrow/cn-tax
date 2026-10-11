import type { Metadata } from "next";
import { RetirementAgeTool } from "@/components/RetirementAgeTool";
import { Article, Hero, JsonLd, breadcrumbLd, faqLd, webAppLd } from "@/components/seo";
import { RetirementAgeArticle, faq } from "@/content/retirement-age";

const TITLE = "延迟退休年龄计算器：输入出生年月，查自己几岁退休（2025 新规）";
const DESCRIPTION = "延迟退休年龄计算器：输入出生年月，查法定退休年月、弹性提前最早和延迟最晚，附男女职工延迟退休年龄对照表。";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  keywords: [
    "延迟退休年龄计算器",
    "延迟退休年龄对照表",
    "1975年出生男几岁退休",
    "女职工退休年龄",
    "弹性退休",
    "最低缴费年限 20 年",
    "延迟退休计算",
    "1980年出生几岁退休",
    "1990年出生几岁退休",
    "弹性提前退休",
  ],
  alternates: { canonical: "/retirement-age" },
  openGraph: { title: TITLE, description: DESCRIPTION, images: [{ url: "/og.png", width: 1200, height: 630 }] },
  twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION, images: ["/og.png"] },
};

export default function Page() {
  return (
    <>
      <JsonLd data={webAppLd({ name: "延迟退休年龄计算器", path: "/retirement-age", description: DESCRIPTION })} />
      <JsonLd data={faqLd(faq)} />
      <JsonLd data={breadcrumbLd([{ name: "个税规划器", path: "/" }, { name: TITLE, path: "/retirement-age" }])} />
      <Hero current="/retirement-age" title="延迟退休年龄计算器" subtitle={DESCRIPTION} />
      <RetirementAgeTool />
      <Article title="延迟退休年龄对照表：男 / 女职工几岁几月退休、能弹性提前多久" current="/retirement-age">
        <RetirementAgeArticle />
      </Article>
    </>
  );
}
