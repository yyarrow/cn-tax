import Link from "next/link";
import { Fragment, type ReactNode } from "react";
import { SITE_NAME, SITE_URL } from "@/lib/site";
import { FeedbackButton } from "./FeedbackButton";

/** 分三组：两个主计算器 / 专题工具 / Offer 对比；桌面端组之间有细分隔线 */
const SITE_NAV = [
  { href: "/", label: "个税计算器", group: 0 },
  { href: "/pension", label: "养老金", group: 0 },
  { href: "/bonus", label: "年终奖", group: 1 },
  { href: "/settlement", label: "汇算退税", group: 1 },
  { href: "/social-insurance", label: "税后工资", group: 1 },
  { href: "/offer", label: "Offer 对比", group: 2 },
];

/** 全站导航：移动端换行展示全部入口，当前项用强调色下划线标出 */
function SiteNav({ current }: { current?: string }) {
  return (
    <nav
      aria-label="站点导航"
      className="mt-4 grid grid-cols-3 border-b border-line text-sm sm:block"
    >
      {SITE_NAV.map((n, i) => {
        const active = n.href === current;
        const newGroup = i > 0 && SITE_NAV[i - 1].group !== n.group;
        return (
          <Fragment key={n.href}>
          {newGroup && <span aria-hidden="true" className="mr-6 hidden h-3.5 w-px translate-y-0.5 bg-line align-middle sm:inline-block" />}
          <Link
            href={n.href}
            aria-current={active ? "page" : undefined}
            className={`inline-flex min-h-11 items-center justify-center border-b-2 py-2 transition-colors duration-(--dur-fast) active:bg-ink/5 sm:mr-6 sm:inline-block sm:min-h-0 sm:last:mr-0 ${active ? "border-accent font-semibold text-ink" : "border-transparent text-muted hover:text-ink"}`}
          >
            {n.label}
          </Link>
          </Fragment>
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
        <div className="min-w-0 flex-1">
          <h1 className="text-balance text-2xl font-semibold tracking-[-0.01em] text-ink sm:text-[1.75rem]">{title}</h1>
          <p className="mt-0.5 text-sm text-muted">{subtitle}</p>
        </div>
        <FeedbackButton />
      </div>
      <SiteNav current={current} />
    </div>
  );
}

export function JsonLd({ data }: { data: object }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }} />;
}

export function webAppLd(opts?: { name?: string; path?: string; description?: string }) {
  return {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: opts?.name ?? SITE_NAME,
    url: `${SITE_URL}${opts?.path ?? ""}`,
    applicationCategory: "FinanceApplication",
    operatingSystem: "Any",
    inLanguage: "zh-CN",
    offers: { "@type": "Offer", price: "0", priceCurrency: "CNY" },
    description: opts?.description ?? "2026 年个人所得税计算器：全年个税、汇算清缴退税、年终奖单独计税对比、期权 / RSU 兑现规划。",
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

const RELATED: { href: string; label: string; desc: string }[] = [
  { href: "/", label: "个税计算器", desc: "按工作经历算全年个税、逐月预扣和汇算退补" },
  { href: "/bonus", label: "年终奖计算器", desc: "单独计税还是并入、陷阱区间、最优拆分" },
  { href: "/settlement", label: "汇算清缴退税计算器", desc: "今年能退多少、为什么、在个税 App 怎么办" },
  { href: "/social-insurance", label: "税后工资计算器", desc: "月薪到手拆分，或从到手反推五险一金" },
  { href: "/pension", label: "养老金计算器", desc: "延迟退休后每月能领多少，换个城市退休差多少" },
  { href: "/retirement-age", label: "延迟退休年龄计算器", desc: "输入出生年月，查几岁几月退休、能弹性提前多久，附完整对照表" },
  { href: "/pension-base", label: "各省养老金计发基数", desc: "31 省及部分城市的最新计发基数一览，看同样缴费换个地方差多少" },
  { href: "/offer", label: "Offer 税后对比", desc: "两三份 offer 并排算全年到手和差额" },
];

/** 文章末尾的相关工具（内链 + 描述性锚文本） */
function RelatedTools({ current }: { current?: string }) {
  const items = RELATED.filter((r) => r.href !== current);
  return (
    <nav aria-label="相关工具" className="mt-8 rounded-2xl border border-line bg-white p-5">
      <h2 className="text-sm font-semibold text-ink">相关工具</h2>
      <ul className="mt-3 grid gap-x-6 gap-y-2 sm:grid-cols-2">
        {items.map((r) => (
          <li key={r.href} className="text-sm leading-relaxed">
            <Link href={r.href} className="font-medium text-accent-text hover:underline">
              {r.label}
            </Link>
            <span className="text-muted">：{r.desc}</span>
          </li>
        ))}
      </ul>
    </nav>
  );
}

export function Article({ title, children, current }: { title: string; children: ReactNode; current?: string }) {
  return (
    <div className="mx-auto max-w-6xl px-4 pb-28 pt-2 sm:px-6 lg:pb-16">
      <article className="article rounded-2xl border border-line bg-white p-6 sm:p-8">
        <h2 className="!mt-0 text-xl font-semibold text-ink">{title}</h2>
        {children}
      </article>
      <RelatedTools current={current} />
      <footer className="mt-8 space-y-1 text-xs leading-relaxed text-muted">
        <p>口径：累计预扣法预扣，汇算按全年 6 万减除 + 全年专项附加；年终奖、上市公司股权激励单独计税政策至 2027 年底。社保 / 公积金基数为各城市 2026 年度参考值（更新于 2026-09）。仅供测算，不构成税务建议。</p>
        {/* 不能用 <p>：反馈按钮里带 <dialog>，放进 <p> 会被解析器截断，造成水合错误 */}
        <div>
          数据只存在你的浏览器里，不上传。有算错或城市数据过期？
          <FeedbackButton variant="link" label="意见反馈" />
          ，或到{" "}
          <a href="https://github.com/yyarrow/cn-tax/issues" className="text-accent-text hover:underline" target="_blank" rel="noreferrer">
            GitHub
          </a>{" "}
          提 issue。
        </div>
      </footer>
    </div>
  );
}
