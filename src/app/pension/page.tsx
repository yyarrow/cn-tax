import type { Metadata } from "next";
import { PensionClient } from "@/components/PensionClient";
import { Article, Hero, JsonLd, breadcrumbLd, faqLd } from "@/components/seo";
import { PensionArticle, faq } from "@/content/pension";

const TITLE = "养老金计算器：延迟退休后每月能领多少，换个城市差多少";
const DESCRIPTION = "养老金计算器：填出生年月和缴费情况，估算延迟退休后每月能领多少，并对比换个城市领取差多少。";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  keywords: ["养老金计算器", "退休金计算器", "延迟退休年龄计算", "养老金计发基数", "个人账户养老金", "异地退休养老金"],
  alternates: { canonical: "/pension" },
  openGraph: { title: TITLE, description: DESCRIPTION, images: [{ url: "/og.png", width: 1200, height: 630 }] },
};

export default function Page() {
  return (
    <>
      <JsonLd data={faqLd(faq)} />
      <JsonLd data={breadcrumbLd([{ name: "个税规划器", path: "/" }, { name: TITLE, path: "/pension" }])} />
      <Hero current="/pension" title="养老金计算器" subtitle={DESCRIPTION} />
      <PensionClient />
      <Article title="养老金怎么算、延迟退休几岁、换个城市退休差多少" current="/pension">
        <PensionArticle />
      </Article>
    </>
  );
}
