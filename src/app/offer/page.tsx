import type { Metadata } from "next";
import { OfferClient } from "@/components/OfferClient";
import { Article, Hero, JsonLd, breadcrumbLd, faqLd } from "@/components/seo";
import { OfferArticle, faq } from "@/content/offer";

const TITLE = "Offer 税后对比计算器：两份 offer 到手差多少，怎么拆更省";
const DESCRIPTION =
  "填城市、月薪、年终奖、签字费、期权，并排算两三份 offer 的全年到手：差多少一目了然，还给出工资与年终奖怎么拆更省税。";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  keywords: ["offer 对比", "offer 税后", "税后年包", "跳槽 offer 比较", "年薪 到手 计算器", "签字费 个税", "期权 个税"],
  alternates: { canonical: "/offer" },
  openGraph: { title: TITLE, description: DESCRIPTION, images: [{ url: "/og.png", width: 1200, height: 630 }] },
};

export default function Page() {
  return (
    <>
      <JsonLd data={faqLd(faq)} />
      <JsonLd data={breadcrumbLd([{ name: "个税规划器", path: "/" }, { name: "Offer 对比", path: "/offer" }])} />
      <Hero title="Offer 税后对比" subtitle="两份 offer 并排算全年到手，看清差多少、怎么拆更省。" current="/offer" />
      <OfferClient />
      <Article title="Offer 怎么比：总包相同，到手可能差几万" current="/offer">
        <OfferArticle />
      </Article>
    </>
  );
}
