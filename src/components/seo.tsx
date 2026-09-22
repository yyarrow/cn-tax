import Link from "next/link";
import type { ReactNode } from "react";
import { SITE_NAME, SITE_URL } from "@/app/layout";

const SITE_NAV = [
  { href: "/", label: "个税计算器" },
  { href: "/bonus", label: "年终奖" },
  { href: "/offer", label: "Offer 对比" },
  { href: "/settlement", label: "汇算退税" },
  { href: "/social-insurance", label: "税后工资" },
];

/** 全站导航：移动端横向滚动，当前项用强调色下划线标出 */
function SiteNav({ current }: { current?: string }) {
  return (
    <nav
      aria-label="站点导航"
      className="no-scrollbar -mx-4 mt-4 overflow-x-auto whitespace-nowrap border-b border-line px-4 text-sm sm:mx-0 sm:px-0"
    >
      {SITE_NAV.map((n) => {
        const active = n.href === current;
        return (
          <Link
            key={n.href}
            href={n.href}
            aria-current={active ? "page" : undefined}
            className={`mr-6 inline-block border-b-2 py-2 last:mr-0 ${active ? "border-accent font-semibold text-ink" : "border-transparent text-muted hover:text-ink"}`}
          >
            {n.label}
          </Link>
        );
      })}
    </nav>
  );
}

/** 服务端渲染的页头：H1 + 描述，保证爬虫拿到主体关键词 */
export function Hero({ title, subtitle, current }: { title: string; subtitle: string; current?: string }) {
  return (
    <div className="mx-auto max-w-6xl px-4 pt-6 sm:px-6">
      <div className="flex items-center gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.png" alt={SITE_NAME} width={40} height={40} className="h-10 w-10 rounded-xl" />
        <div>
          <h1 className="text-[1.75rem] font-semibold tracking-[-0.01em] text-ink">{title}</h1>
          <p className="mt-0.5 text-sm text-muted">{subtitle}</p>
        </div>
      </div>
      <SiteNav current={current} />
      <div className="mt-2 flex gap-1" aria-hidden="true">
        {Array.from({ length: 12 }).map((_, i) => (
          <span key={i} className="h-1.5 flex-1 rounded-full bg-accent" style={{ opacity: 0.15 + (i * (1 - 0.15)) / 11 }} />
        ))}
      </div>
    </div>
  );
}

export function JsonLd({ data }: { data: object }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }} />;
}

export function webAppLd() {
  return {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: SITE_NAME,
    url: SITE_URL,
    applicationCategory: "FinanceApplication",
    operatingSystem: "Any",
    inLanguage: "zh-CN",
    offers: { "@type": "Offer", price: "0", priceCurrency: "CNY" },
    description: "2026 年个人所得税计算器：全年个税、汇算清缴退税、年终奖单独计税对比、期权 / RSU 兑现规划。",
  };
}

export function faqLd(faq: { q: string; a: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faq.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
  };
}

export function breadcrumbLd(items: { name: string; path: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((it, i) => ({ "@type": "ListItem", position: i + 1, name: it.name, item: `${SITE_URL}${it.path}` })),
  };
}

const NAV = [
  { href: "/", label: "个税计算器" },
  { href: "/bonus", label: "年终奖计算器" },
  { href: "/offer", label: "Offer 对比" },
  { href: "/settlement", label: "汇算清缴退税" },
  { href: "/social-insurance", label: "税后工资 / 五险一金" },
];

export function Article({ title, children, current }: { title: string; children: ReactNode; current: string }) {
  return (
    <div className="mx-auto max-w-6xl px-4 pb-28 sm:px-6 lg:pb-16">
      <nav aria-label="相关工具" className="mb-6 flex flex-wrap gap-2 text-xs">
        {NAV.map((n) => (
          <Link key={n.href} href={n.href} className={`rounded-full border px-3 py-1 ${n.href === current ? "border-accent-text bg-accent/10 text-accent-text" : "border-line text-muted hover:text-ink"}`}>
            {n.label}
          </Link>
        ))}
      </nav>
      <article className="article rounded-2xl border border-line bg-white p-6 sm:p-8">
        <h2 className="!mt-0 text-xl font-semibold text-ink">{title}</h2>
        {children}
      </article>
      <footer className="mt-8 space-y-1 text-xs leading-relaxed text-muted">
        <p>口径：累计预扣法预扣，汇算按全年 6 万减除 + 全年专项附加；年终奖、上市公司股权激励单独计税政策至 2027 年底。社保 / 公积金基数为各城市 2026 年度参考值（更新于 2026-09）。仅供测算，不构成税务建议。</p>
        <p>
          数据只存在你的浏览器里，不上传。有算错或城市数据过期？
          <a href="https://github.com/yyarrow/cn-tax/issues" className="text-accent-text hover:underline" target="_blank" rel="noreferrer">
            提个反馈
          </a>
          。
        </p>
      </footer>
    </div>
  );
}
