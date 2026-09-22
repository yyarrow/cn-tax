import type { Metadata } from "next";
import { SalaryClient } from "@/components/SalaryClient";
import { Article, Hero, JsonLd, breadcrumbLd, faqLd } from "@/components/seo";
import { SocialInsuranceArticle, faq } from "@/content/social-insurance";

export const metadata: Metadata = {
  title: "税后工资计算器：从到手工资反推五险一金",
  description: "税后工资与五险一金计算器：填税前月薪和某月到手，反推五险一金个人缴纳额，支持北京、上海、深圳、广州、杭州、成都 2026 年基数上限。",
  keywords: ["税后工资计算器", "五险一金计算器", "五险一金个人缴纳比例", "社保基数上限 2026", "公积金比例 12%", "到手工资反推", "税前税后工资"],
  alternates: { canonical: "/social-insurance" },
  openGraph: { title: "税后工资计算器：从到手工资反推五险一金", description: "税后工资与五险一金计算器：填税前月薪和某月到手，反推五险一金个人缴纳额，支持北京、上海、深圳、广州、杭州、成都 2026 年基数上限。", images: [{ url: "/og.png", width: 1200, height: 630 }] },
};

export default function Page() {
  return (
    <>
      <JsonLd data={faqLd(faq)} />
      <JsonLd data={breadcrumbLd([{ name: "个税规划器", path: "/" }, { name: "税后工资计算器：从到手工资反推五险一金", path: "/social-insurance" }])} />
      <Hero current="/social-insurance" title="税后工资计算器" subtitle="税后工资与五险一金计算器：填税前月薪和某月到手，反推五险一金个人缴纳额，支持北京、上海、深圳、广州、杭州、成都 2026 年基数上限。" />
      <SalaryClient />
      <Article title="五险一金个人缴纳比例、社保基数上限与到手工资反推" current="/social-insurance">
        <SocialInsuranceArticle />
      </Article>
    </>
  );
}
