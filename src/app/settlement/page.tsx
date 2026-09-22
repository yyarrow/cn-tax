import type { Metadata } from "next";
import { ClientApp } from "@/components/ClientApp";
import { Article, Hero, JsonLd, breadcrumbLd, faqLd } from "@/components/seo";
import { SettlementArticle, faq } from "@/content/settlement";

export const metadata: Metadata = {
  title: "汇算清缴退税计算器：今年能退多少税，换工作要不要补",
  description: "个税年度汇算计算器：按工作经历和空档月份算出汇算清缴退税或补税金额，说明换工作、中间没工作、专项附加没申报时的退补规则。",
  keywords: ["汇算清缴退税", "个税退税", "年度汇算", "个税退税怎么算", "换工作补税", "汇算清缴时间", "个税 App 退税"],
  alternates: { canonical: "/settlement" },
  openGraph: { title: "汇算清缴退税计算器：今年能退多少税，换工作要不要补", description: "个税年度汇算计算器：按工作经历和空档月份算出汇算清缴退税或补税金额，说明换工作、中间没工作、专项附加没申报时的退补规则。", images: [{ url: "/og.png", width: 1200, height: 630 }] },
};

export default function Page() {
  return (
    <>
      <JsonLd data={faqLd(faq)} />
      <JsonLd data={breadcrumbLd([{ name: "个税规划器", path: "/" }, { name: "汇算清缴退税计算器：今年能退多少税，换工作要不要补", path: "/settlement" }])} />
      <Hero current="/settlement" title="汇算清缴退税计算器" subtitle="个税年度汇算计算器：按工作经历和空档月份算出汇算清缴退税或补税金额，说明换工作、中间没工作、专项附加没申报时的退补规则。" />
      <ClientApp />
      <Article title="汇算清缴退税怎么算：谁能退、退多少、什么时候办" current="/settlement">
        <SettlementArticle />
      </Article>
    </>
  );
}
