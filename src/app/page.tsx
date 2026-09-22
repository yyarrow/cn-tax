import { ClientApp } from "@/components/ClientApp";
import { Article, Hero, JsonLd, faqLd, webAppLd } from "@/components/seo";
import { RateTableArticle, faq } from "@/content/rate-table";

export default function Page() {
  return (
    <>
      <JsonLd data={webAppLd()} />
      <JsonLd data={faqLd(faq)} />
      <Hero current="/" title="个税规划器" subtitle="2026 个税计算器：填工作经历，算清全年个税、汇算退补、年终奖和期权怎么拿最省。免费，数据只存本地。" />
      <ClientApp />
      <Article title="2026 年个人所得税怎么算：税率表、累计预扣法与专项附加扣除" current="/">
        <RateTableArticle />
      </Article>
    </>
  );
}
