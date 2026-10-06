"use client";

import Link from "next/link";
import { ExampleHint } from "./ExampleHint";
import { useEffect, useMemo, useRef, useState } from "react";
import { CITY_PRESETS, compareOffers, getCity, sadMonthly } from "@/lib/tax";
import type { OfferInput, OfferResult } from "@/lib/tax";
import { fmtMoney, fmtPct } from "@/lib/format";
import { SITE, buildOfferShareUrl, buildShareUrl } from "@/lib/share";
import { MAX_OFFERS, offerLabel, useOffers, wasLoadedFromShare } from "@/lib/offerStore";
import { Button, Card, Details, Field, Hint, NumberInput, Select, TextInput } from "./ui";
import { ShareModal } from "./ShareModal";

/** 每份 offer 的标识色（与首页序列色一致） */
const COLORS = ["#2a78d6", "#eb6834", "#1baf7a"];
const LETTERS = ["A", "B", "C"];

const ROWS: { label: string; bold?: boolean; value: (r: OfferResult, o: OfferInput) => string }[] = [
  { label: "税前总包", value: (r) => fmtMoney(r.grossTotal) },
  { label: "五险一金（个人）", value: (r) => fmtMoney(r.totalSocial) },
  { label: "个税", value: (r) => fmtMoney(r.totalTax) },
  { label: "全年到手", bold: true, value: (r) => fmtMoney(r.netTotal) },
  { label: "月均到手", value: (r) => fmtMoney(r.netMonthly) },
  { label: "普通月到手", value: (r) => fmtMoney(r.netRegularMonth) },
  { label: "综合税负", value: (r) => fmtPct(r.effectiveRate) },
  { label: "边际税率", value: (r) => fmtPct(r.marginalRate, 0) },
  { label: "年终奖计税方式", value: (r, o) => (o.bonus > 0 ? (r.bonusSeparate ? "单独" : "并入") : "—") },
];

/** 差距归因：总包差得多就是总包高，总包差不多就是五险一金 + 个税少 */
function reasonFor(w: OfferResult, r: OfferResult, gap: number): string {
  const grossDiff = w.grossTotal - r.grossTotal;
  const costDiff = r.totalSocial + r.totalTax - (w.totalSocial + w.totalTax);
  if (Math.abs(grossDiff) < gap * 0.1 && costDiff > 1) return `五险一金和个税少 ${fmtMoney(costDiff)}（城市基数 / 拆分不同）`;
  if (grossDiff > 1) return `总包高 ${fmtMoney(grossDiff)}`;
  if (costDiff > 1) return `五险一金和个税少 ${fmtMoney(costDiff)}`;
  return "总包与税费综合更优";
}

function Dot({ color }: { color: string }) {
  return <span className="inline-block h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: color }} aria-hidden="true" />;
}

export function OfferCompare() {
  const { offers, patchOffer, addOffer, removeOffer, year, deductions } = useOffers();
  const comparison = useMemo(() => compareOffers(offers, year, deductions), [offers, year, deductions]);
  const sad = sadMonthly(deductions);

  const items = comparison.results.map((r, i) => ({
    r,
    o: offers[i],
    i,
    name: offerLabel(offers[i], i),
    color: COLORS[i % COLORS.length],
  }));
  const withIncome = items.filter((x) => x.o.monthlySalary > 0);
  const hasIncome = withIncome.length > 0;
  const winner = items.find((x) => x.r.id === comparison.bestId) ?? items[0];
  const ranked = [...withIncome].sort((a, b) => b.r.netTotal - a.r.netTotal);
  const runnerUp = ranked[1];
  const gap = runnerUp ? winner.r.netTotal - runnerUp.r.netTotal : 0;
  const tiedAtTop = withIncome.filter((x) => Math.abs(x.r.netTotal - winner.r.netTotal) <= 1).length > 1;
  const splits = items.flatMap(({ r, name }) => (r.split && r.split.saving > 1 ? [{ id: r.id, name, split: r.split }] : []));

  const inputsRef = useRef<HTMLDivElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);
  const [resultsVisible, setResultsVisible] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const el = resultsRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const obs = new IntersectionObserver(([entry]) => setResultsVisible(entry.isIntersecting), { threshold: 0.15 });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const today = new Date();
  const dateText = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  const host = typeof window !== "undefined" ? window.location.host : new URL(SITE).host;

  const copyLink = async () => {
    const url = buildOfferShareUrl(offers);
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      window.prompt("复制这个链接：", url);
    }
  };

  const scrollToResults = () => resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  const scrollToInputs = () => inputsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });

  const showBar = !showShare;

  /** 对比结果正文：页面和分享弹层用同一份（内部没有可点的操作按钮） */
  const resultsBody = (
    <div className="divide-y divide-line">
      {/* 1. 全年到手对比 */}
      <section className="pb-4">
        <div className={`grid grid-cols-1 divide-y divide-line overflow-hidden sm:divide-x sm:divide-y-0 rounded-xl border border-line ${items.length > 2 ? "sm:grid-cols-2 lg:grid-cols-3" : "sm:grid-cols-2"}`}>
          {items.map(({ r, name, color }) => {
            const isWinner = hasIncome && !tiedAtTop && r.id === comparison.bestId;
            const delta = comparison.deltas[r.id] ?? 0;
            return (
              <div key={r.id} className={`p-3 sm:p-4 ${isWinner ? "bg-good/5" : ""}`}>
                <div className="flex items-center gap-1.5 text-xs text-muted">
                  <Dot color={color} />
                  <span className="truncate">{name}</span>
                </div>
                <div className="mt-1 break-words text-2xl font-semibold sm:text-3xl tabular-nums text-ink">{hasIncome ? fmtMoney(r.netTotal) : "—"}</div>
                <div className="mt-1.5">
                  {!hasIncome ? (
                    <span className="text-xs text-muted">—</span>
                  ) : tiedAtTop && Math.abs(delta) <= 1 ? (
                    <span className="inline-flex items-center rounded-full bg-paper px-2 py-0.5 text-xs font-medium text-muted">并列最多</span>
                  ) : isWinner ? (
                    <span className="inline-flex items-center rounded-full bg-good/10 px-2 py-0.5 text-xs font-medium text-good-text">到手最多</span>
                  ) : (
                    <span className="text-xs tabular-nums text-danger-text">
                      比{winner.name}少 {fmtMoney(-delta)} / 年
                    </span>
                  )}
                </div>
                <div className="mt-1 text-xs tabular-nums text-muted">
                  {hasIncome ? `月均 ${fmtMoney(r.netMonthly)} · 综合税负 ${fmtPct(r.effectiveRate)}` : "月均 — · 综合税负 —"}
                </div>
              </div>
            );
          })}
        </div>
        <div className="mt-3">
          {!hasIncome ? (
            <Hint>填上至少一份 offer 的税前月薪，这里会显示哪份全年到手更多、差多少。</Hint>
          ) : runnerUp && gap > 1 ? (
            <Hint>
              {winner.name} 全年到手比 {runnerUp.name} 多 {fmtMoney(gap)}，主要因为{reasonFor(winner.r, runnerUp.r, gap)}。
            </Hint>
          ) : runnerUp ? (
            <Hint>{withIncome.length > 2 ? "到手最多的几份" : "两份"} offer 全年到手基本一样，可以看看公积金比例和年终奖拆分。</Hint>
          ) : null}
        </div>
      </section>

      {/* 2. 逐项对比 */}
      <section className="py-4">
        <h3 className="text-sm font-semibold text-ink">逐项对比</h3>
        <p className="mt-1 text-xs text-muted sm:hidden">左右滑动查看全部对比列</p>
        <div className="mt-1 overflow-x-auto">
          <table className="w-full min-w-[20rem] text-sm tabular-nums">
            <thead>
              <tr className="border-b border-line">
                <th scope="col" className="py-2 pr-3 text-left text-xs font-medium text-muted">
                  项目
                </th>
                {items.map(({ r, name, color }) => (
                  <th key={r.id} scope="col" className="py-2 pl-3 text-right text-xs font-medium text-muted">
                    <span className="inline-flex items-center gap-1.5">
                      <Dot color={color} />
                      <span className="truncate">{name}</span>
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {ROWS.map((row) => (
                <tr key={row.label}>
                  <th scope="row" className="py-2 pr-3 text-left text-xs font-medium text-muted">
                    {row.label}
                  </th>
                  {items.map(({ r, o }) => (
                    <td key={r.id} className={`py-2 pl-3 text-right ${row.bold ? "font-semibold text-ink" : "text-ink"}`}>
                      {hasIncome ? row.value(r, o) : "—"}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* 3. 拆分建议 */}
      <section className="py-4">
        <h3 className="text-sm font-semibold text-ink">拆分建议</h3>
        {!hasIncome ? (
          <p className="mt-2 text-sm leading-relaxed text-muted">填上月薪和年终奖，这里会给出总包不变时更省的工资 / 年终奖拆分。</p>
        ) : splits.length > 0 ? (
          <div className="mt-1 divide-y divide-line">
            {splits.map(({ id, name, split }) => (
              <p key={id} className="py-2 text-sm leading-relaxed text-ink">
                {name}：总包不变，年终奖调到 {fmtMoney(split.bestBonus)}、其余进工资，可再省 {fmtMoney(split.saving)} / 年（谈 offer 时可以提）。
              </p>
            ))}
          </div>
        ) : (
          <p className="mt-2 text-sm text-muted">各 offer 的工资 / 年终奖比例已是最省。</p>
        )}
      </section>

      <p className="pt-4 text-xs leading-relaxed text-muted">
        {year} 年口径 · 专项附加扣除每月 {fmtMoney(sad)} · 算你自己的：{host}
      </p>
    </div>
  );

  return (
    <div className={`app-root mx-auto max-w-6xl px-4 pt-4 sm:px-6 ${showBar ? "pb-24 lg:pb-10" : "pb-10"}`}>
      {wasLoadedFromShare() && (
        <p className="mb-4 rounded-xl border border-accent/30 bg-accent/10 px-4 py-2.5 text-sm text-ink">
          已按分享的 offer 预填，改成你自己的数字即可。
        </p>
      )}

      {showShare && (
        <ShareModal
          title="Offer 税后对比"
          subtitle={items.map(({ name }) => name).join(" vs ")}
          shareUrl={buildOfferShareUrl(offers)}
          fileName={`offer-对比-${dateText}.png`}
          ctaLabel="打开这份测算"
          onClose={() => setShowShare(false)}
        >
          <section className="report-section rounded-2xl border border-line bg-white p-5">{resultsBody}</section>
        </ShareModal>
      )}

      <div className="mb-5 flex flex-wrap items-center justify-end gap-2">
        <Button variant="secondary" className="h-9" onClick={copyLink}>
          {copied ? "已复制" : "复制链接"}
        </Button>
        <Button variant="primary" className="h-9" onClick={() => setShowShare(true)}>
          分享报告
        </Button>
      </div>

      <ExampleHint storageKeys={["cn-tax-offers-v1", "cn-tax-profile-v1"]} enabled={!wasLoadedFromShare()} />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        {/* 输入列 */}
        <div className="min-w-0 space-y-4" ref={inputsRef}>
          {items.map(({ o, i, color }) => {
            const city = getCity(o.cityId);
            const ratePct = Math.round((o.housingRate ?? city.housingRateDefault) * 1000) / 10;
            return (
              <div key={o.id} className="rounded-2xl border border-line bg-white p-4">
                <div className="flex items-center gap-2">
                  <Dot color={color} />
                  <TextInput
                    ariaLabel={`Offer ${LETTERS[i] ?? i + 1} 名称`}
                    value={o.name}
                    onChange={(name) => patchOffer(o.id, { name })}
                    placeholder={`Offer ${LETTERS[i] ?? i + 1}`}
                    className="flex-1"
                  />
                  {offers.length > 2 && (
                    <Button variant="ghost" className="h-9" onClick={() => removeOffer(o.id)}>
                      删除
                    </Button>
                  )}
                </div>
                <div className="mt-3 grid grid-cols-2 gap-3">
                  <Field label="城市">
                    <Select value={o.cityId} onChange={(e) => patchOffer(o.id, { cityId: e.target.value })}>
                      {CITY_PRESETS.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <Field label="税前月薪">
                    <NumberInput value={o.monthlySalary} onChange={(monthlySalary) => patchOffer(o.id, { monthlySalary })} prefix="¥" step={1000} />
                  </Field>
                  <Field label="年终奖" hint="按全年一次性奖金，自动选更省的计税方式">
                    <NumberInput value={o.bonus} onChange={(bonus) => patchOffer(o.id, { bonus })} prefix="¥" step={10000} />
                  </Field>
                  <Field label="签字费 / 入职奖金" hint="首月随工资计税">
                    <NumberInput value={o.signOn} onChange={(signOn) => patchOffer(o.id, { signOn })} prefix="¥" step={10000} />
                  </Field>
                  <Field label="期权 / RSU 年均归属" hint="按并入工资计税估算">
                    <NumberInput value={o.equityPerYear} onChange={(equityPerYear) => patchOffer(o.id, { equityPerYear })} prefix="¥" step={10000} />
                  </Field>
                </div>
                <div className="mt-3">
                  <Details summary="公积金比例">
                    <Field label="个人缴存比例" hint={`${city.name} 常见 ${(city.housingRateDefault * 100).toFixed(0)}%`}>
                      <NumberInput
                        value={ratePct}
                        onChange={(v) => patchOffer(o.id, { housingRate: Math.min(20, Math.max(0, v)) / 100 })}
                        max={20}
                        suffix="%"
                        step={1}
                        className="w-28"
                      />
                    </Field>
                  </Details>
                </div>
              </div>
            );
          })}

          {offers.length < MAX_OFFERS && (
            <Button variant="secondary" className="h-9" onClick={addOffer}>
              ＋ 再加一份 offer
            </Button>
          )}
          <p className="text-xs leading-relaxed text-muted">专项附加扣除沿用首页设置（每月 {fmtMoney(sad)}）。{" "}
            <Link href="/#deductions" className="text-accent-text underline underline-offset-2">修改扣除</Link></p>
        </div>

        {/* 结果列 */}
        <div className="min-w-0 space-y-4 lg:sticky lg:top-6 lg:self-start" id="results" ref={resultsRef}>
          <Card title="Offer 税后对比" action={<span className="text-xs text-muted">生成于 {dateText}</span>}>
            {resultsBody}
          </Card>

          <div className="flex flex-wrap items-center gap-1">
            {items.map(({ r, name }) => (
              <Button
                key={r.id}
                variant="ghost"
                className="h-9"
                onClick={() => {
                  window.location.href = buildShareUrl(r.profile);
                }}
              >
                看 {name} 的完整测算 →
              </Button>
            ))}
          </div>
        </div>
      </div>

      {showBar && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-white px-4 py-2.5 pb-[max(0.625rem,env(safe-area-inset-bottom))] lg:hidden">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="truncate text-xs text-muted">{tiedAtTop ? "最高全年到手（并列）" : `${winner.name} 全年到手`}</div>
              <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                <span className="text-lg font-semibold tabular-nums text-ink">{hasIncome ? fmtMoney(winner.r.netTotal) : "—"}</span>
                {runnerUp && gap > 1 && <span className="text-xs tabular-nums text-good-text">比另一份多 {fmtMoney(gap)}</span>}
              </div>
            </div>
            <Button variant="primary" className="h-9 shrink-0" onClick={resultsVisible ? scrollToInputs : scrollToResults}>
              {resultsVisible ? "改输入" : "看结果"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
