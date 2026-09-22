import type { Metadata } from "next";
import { BonusClient } from "@/components/BonusClient";
import { Article, Hero, JsonLd, breadcrumbLd, faqLd } from "@/components/seo";
import { BonusArticle, faq } from "@/content/bonus";

export const metadata: Metadata = {
  title: "年终奖计算器：单独计税还是并入，陷阱区间一查就知道",
  description: "2026 年终奖个税计算器：自动对比单独计税与并入综合所得，标出 36000 / 144000 等陷阱区间，算出最省税的工资与年终奖拆分。",
  keywords: ["年终奖计算器", "年终奖个税", "年终奖单独计税", "年终奖并入综合所得", "年终奖 36000 陷阱", "年终奖陷阱区间", "年终奖税率表"],
  alternates: { canonical: "/bonus" },
  openGraph: { title: "年终奖计算器：单独计税还是并入，陷阱区间一查就知道", description: "2026 年终奖个税计算器：自动对比单独计税与并入综合所得，标出 36000 / 144000 等陷阱区间，算出最省税的工资与年终奖拆分。", images: [{ url: "/og.png", width: 1200, height: 630 }] },
};

export default function Page() {
  return (
    <>
      <JsonLd data={faqLd(faq)} />
      <JsonLd data={breadcrumbLd([{ name: "个税规划器", path: "/" }, { name: "年终奖计算器：单独计税还是并入，陷阱区间一查就知道", path: "/bonus" }])} />
      <Hero current="/bonus" title="年终奖计算器" subtitle="2026 年终奖个税计算器：自动对比单独计税与并入综合所得，标出 36000 / 144000 等陷阱区间，算出最省税的工资与年终奖拆分。" />
      <BonusClient />
      <Article title="年终奖个税怎么算：单独计税公式、陷阱区间与最优拆分" current="/bonus">
        <BonusArticle />
      </Article>
    </>
  );
}
