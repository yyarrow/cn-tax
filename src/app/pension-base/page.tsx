import type { Metadata } from "next";
import { Article, Hero, JsonLd, breadcrumbLd, faqLd } from "@/components/seo";
import { PensionBaseArticle, faq } from "@/content/pension-base";

const TITLE = "2026 各省养老金计发基数一览表：北京上海广东等 31 省最新标准";
const DESCRIPTION = "各省养老金计发基数一览表：北京、上海、广东等 31 省及部分城市最新标准，按数值排序，看同样缴费换个地方差多少。";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  keywords: [
    "养老金计发基数 2025",
    "养老金计发基数 2026",
    "各省计发基数一览表",
    "北京养老金计发基数",
    "上海养老金计发基数",
    "广东养老金计发基数",
    "养老金计发基数是什么",
    "各省养老金计发基数",
  ],
  alternates: { canonical: "/pension-base" },
  openGraph: { title: TITLE, description: DESCRIPTION, images: [{ url: "/og.png", width: 1200, height: 630 }] },
  twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION, images: ["/og.png"] },
};

export default function Page() {
  return (
    <>
      <JsonLd data={faqLd(faq)} />
      <JsonLd data={breadcrumbLd([{ name: "个税规划器", path: "/" }, { name: TITLE, path: "/pension-base" }])} />
      <Hero current="/pension-base" title="各省养老金计发基数一览" subtitle={DESCRIPTION} />
      <Article title="2026 各省养老金计发基数：哪里最高、差多少、怎么影响养老金" current="/pension-base">
        <PensionBaseArticle />
      </Article>
    </>
  );
}
