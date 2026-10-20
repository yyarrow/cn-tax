import type { ReactNode } from "react";

/** 页面顶部示意图：养老金怎么交、存在哪、退休后怎么发（服务端渲染） */

function Step({ title, children, color }: { title: ReactNode; children: ReactNode; color: string }) {
  return (
    <div className="min-w-0 rounded-xl border border-transparent bg-white px-3 py-2.5" style={{ borderLeft: `4px solid ${color}` }}>
      <div className="text-sm font-semibold text-ink">{title}</div>
      <div className="mt-0.5 text-xs leading-relaxed text-muted">{children}</div>
    </div>
  );
}

function Arrow() {
  return (
    <div aria-hidden="true" className="flex items-center justify-center text-muted">
      →
    </div>
  );
}

function Flow({ color, pay, store, get }: { color: string; pay: [ReactNode, ReactNode]; store: [ReactNode, ReactNode]; get: [ReactNode, ReactNode] }) {
  return (
    <>
      {/* 手机：一路一张卡，标题串成一行，只留存在哪和怎么发的说明 */}
      <div className="rounded-xl border border-transparent bg-white px-3 py-2.5 sm:hidden" style={{ borderLeft: `4px solid ${color}` }}>
        <div className="text-sm font-semibold leading-relaxed text-ink">
          {pay[0]} <span className="font-normal text-muted">→</span> {store[0]} <span className="font-normal text-muted">→</span> {get[0]}
        </div>
        <div className="mt-1 space-y-0.5 text-xs leading-relaxed text-muted">
          <p>{store[1]}</p>
          <p>{get[0]} {get[1]}</p>
        </div>
      </div>
      <div className="hidden grid-cols-[minmax(0,1fr)_1.25rem_minmax(0,1fr)_1.25rem_minmax(0,1.5fr)] items-stretch gap-2 sm:grid">
        <Step title={pay[0]} color={color}>{pay[1]}</Step>
        <Arrow />
        <Step title={store[0]} color={color}>{store[1]}</Step>
        <Arrow />
        <Step title={get[0]} color={color}>{get[1]}</Step>
      </div>
    </>
  );
}

export function PensionExplainer() {
  return (
    <div className="mx-auto max-w-6xl px-4 pt-4 sm:px-6">
      <section aria-labelledby="pension-explainer" className="rounded-2xl border border-line bg-paper p-4 sm:p-5">
        <h2 id="pension-explainer" className="text-sm font-semibold text-ink">
          养老金一张图看懂：每月交的钱分两路，退休后也分两部分发
        </h2>
        <div className="mt-1 hidden grid-cols-[minmax(0,1fr)_1.25rem_minmax(0,1fr)_1.25rem_minmax(0,1.5fr)] gap-2 text-xs text-muted sm:grid">
          <span>每月交</span>
          <span />
          <span>存在哪</span>
          <span />
          <span>退休后每月发</span>
        </div>
        <div className="mt-3 space-y-2 sm:mt-1.5">
          <Flow
            color="var(--series-social)"
            pay={["你自己交 8%", "工资条上扣的「养老保险」"]}
            store={["个人账户", "记在你名下，每年计息，去世后余额可以继承"]}
            get={["个人账户养老金", "= 账户余额 ÷ 计发月数（60 岁 139 个月、63 岁 117 个月），发完了也照发"]}
          />
          <Flow
            color="var(--accent)"
            pay={["单位交 16%", "工资条上看不到，单位另外交"]}
            store={["统筹基金", "大家共用，不记在个人名下，所以 App 里查不到余额"]}
            get={["基础养老金", "= 退休城市平均工资（计发基数）×（1 + 缴费指数）÷ 2 × 缴费年限 × 1%"]}
          />
        </div>
        <p className="mt-3 text-xs leading-relaxed text-muted">
          两部分相加就是每月养老金。个人账户看你存了多少；基础养老金看缴了多少年、工资比当地平均高多少（缴费指数）、在哪个城市退休（计发基数）。1990 年代就参加工作、有「视同缴费年限」的人，还有一笔过渡性养老金。
        </p>
      </section>
    </div>
  );
}
