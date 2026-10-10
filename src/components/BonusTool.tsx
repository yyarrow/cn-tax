"use client";

import Link from "next/link";
import { ExampleHint } from "./ExampleHint";
import { useEffect, useMemo, useRef, useState } from "react";
import { bonusSeparateTax, bonusTrapZones, computeAll, getCity, round2, sadMonthly } from "@/lib/tax";
import { findTrap } from "@/lib/tax/bonus";
import { fmtMoney } from "@/lib/format";
import { SITE, buildShareUrl } from "@/lib/share";
import { bonusToProfile, buildBonusShareUrl, useBonusInput, wasBonusLoadedFromShare } from "@/lib/bonusStore";
import { Button, Card, Details, Field, Hint, NumberInput } from "./ui";
import { CityPicker } from "./CityPicker";
import { ShareModal } from "./ShareModal";

/** 陷阱区间表：区间下限的税额，以及刚过下限时最多少拿多少（多发 1 分钱的代价） */
function trapRows() {
  return bonusTrapZones().map((z) => ({
    ...z,
    tax: bonusSeparateTax(z.lower),
    maxLoss: round2(bonusSeparateTax(z.lower + 0.01) - bonusSeparateTax(z.lower) - 0.01),
  }));
}

export function BonusTool() {
  const { input, patch, year, deductions } = useBonusInput();
  const profile = useMemo(() => bonusToProfile(input, year, deductions), [input, year, deductions]);
  const result = useMemo(() => computeAll(profile, 12), [profile]);
  const rows = useMemo(() => trapRows(), []);
  const b = result.bonus;
  const sad = sadMonthly(deductions);
  const city = getCity(input.cityId);
  const ratePct = Math.round((input.housingRate ?? city.housingRateDefault) * 1000) / 10;

  const inputsRef = useRef<HTMLDivElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);
  const [resultsVisible, setResultsVisible] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [copied, setCopied] = useState(false);
  const [scriptCopied, setScriptCopied] = useState(false);
  /** 填齐了年终奖和月薪、且算出了结果，才有数字可显示；否则同样的版面用「—」占位 */
  const analysis = input.bonus > 0 && input.monthlySalary > 0 ? b : null;
  /** 只填了年终奖：单独计税不依赖月薪，可以先算；并入和拆分要等月薪 */
  const hasBonus = input.bonus > 0;
  const sepOnly = hasBonus && !analysis;
  const sepOnlyTax = sepOnly ? bonusSeparateTax(input.bonus) : 0;
  const sepOnlyNet = sepOnly ? round2(input.bonus - sepOnlyTax) : 0;

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

  // 到手：单独 = 奖金 − 奖金单独计税的税；并入 = 奖金 − 合并后因奖金多出来的税
  const sepNet = analysis ? round2(analysis.bonus - analysis.separate.bonusTax) : 0;
  const comNet = analysis ? round2(analysis.bonus - (analysis.combined.total - analysis.separate.comprehensiveTax)) : 0;
  const bestName = analysis?.recommended === "combined" ? "并入综合所得" : "单独计税";
  const bestNet = analysis?.recommended === "combined" ? comNet : sepNet;
  const nextLower = hasBonus ? rows.find((z) => z.lower > input.bonus)?.lower : undefined;

  const trap = analysis ? analysis.trap : hasBonus ? findTrap(input.bonus) : undefined;
  const split = analysis?.optimalSplit;
  const scriptText = analysis
    ? [
        split && split.saving > 1
          ? `总包不变的话，年终奖定为 ${fmtMoney(split.bestBonus)}、其余并进月薪，全年个税能少 ${fmtMoney(split.saving)}。`
          : `我的月薪和年终奖 ${fmtMoney(analysis.bonus)} 的拆分已经是最省的，不用调。`,
        trap
          ? `现在的 ${fmtMoney(analysis.bonus)} 落在「陷阱区间」${fmtMoney(trap.lower)}–${fmtMoney(trap.upper)}：发 ${fmtMoney(trap.lower)} 我到手反而多 ${fmtMoney(trap.extraTax)}，多出来的部分并进月薪就行。`
          : "",
        "这只是发放口径的调整，公司总成本不变；计税方式我在汇算清缴时自己选。",
      ]
        .filter(Boolean)
        .join("\n")
    : "";

  const copyText = async (text: string, done: (v: boolean) => void) => {
    try {
      await navigator.clipboard.writeText(text);
      done(true);
      setTimeout(() => done(false), 1500);
    } catch {
      window.prompt("复制这段文字：", text);
    }
  };

  const scrollToResults = () => resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  const scrollToInputs = () => inputsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });

  const showBar = !showShare;

  /** 测算结果正文：页面和分享弹层用同一份；staticMode 下不渲染可点的操作按钮 */
  const resultsBody = (staticMode = false) => (
    <div className="divide-y divide-line">
      {/* 1. 单独 vs 并入 */}
      <section className="pb-4">
        <div className="grid grid-cols-2 divide-x divide-line overflow-hidden rounded-xl border border-line">
          {(["separate", "combined"] as const).map((k) => {
            const isBest = analysis?.recommended === k;
            const net = k === "separate" ? sepNet : comNet;
            const total = k === "separate" ? analysis?.separate.total : analysis?.combined.total;
            return (
              <div key={k} className={`p-3 sm:p-4 ${isBest ? "bg-good/5" : ""}`}>
                <div className="text-xs text-muted">{k === "separate" ? "单独计税" : "并入综合所得"}</div>
                <div className="mt-1 text-3xl font-semibold tabular-nums text-ink">
                  {analysis ? fmtMoney(net) : sepOnly && k === "separate" ? fmtMoney(sepOnlyNet) : "—"}
                </div>
                <div className="mt-0.5 text-xs text-muted">奖金到手</div>
                <div className="mt-1.5">
                  {!analysis ? (
                    <span className="text-xs text-muted">{sepOnly ? (k === "separate" ? `奖金税 ${fmtMoney(sepOnlyTax)}` : "填月薪后可比较") : "—"}</span>
                  ) : isBest ? (
                    <span className="inline-flex items-center rounded-full bg-good px-2 py-0.5 text-xs font-medium text-white">推荐</span>
                  ) : analysis.saving > 1 ? (
                    <span className="text-xs tabular-nums text-danger-text">多交 {fmtMoney(analysis.saving)}</span>
                  ) : (
                    <span className="text-xs text-muted">两种差不多</span>
                  )}
                </div>
                <div className="mt-1 text-xs tabular-nums text-muted">全年个税 {total === undefined ? "—" : fmtMoney(total)}</div>
              </div>
            );
          })}
        </div>
        <div className="mt-3">
          <Hint>
            {!analysis
              ? sepOnly
                ? `单独计税不看月薪：奖金税 ${fmtMoney(sepOnlyTax)}，到手 ${fmtMoney(sepOnlyNet)}。填上月薪可比较并入是否更省。`
                : "填上年终奖，这里会显示单独计税的到手；再填月薪可比较并入。"
              : analysis.saving > 1
                ? `选「${bestName}」全年少交 ${fmtMoney(analysis.saving)}，汇算清缴时在个税 App 里可以自行切换。`
                : "两种计税方式差不多，汇算清缴时在个税 App 里可以自行切换。"}
          </Hint>
        </div>
      </section>

      {/* 2. 陷阱检查 */}
      <section className="py-4">
        <h3 className="text-sm font-semibold text-ink">陷阱检查</h3>
        {!hasBonus ? (
          <p className="mt-2 text-sm leading-relaxed text-muted">填上年终奖，这里会告诉你有没有落在「多发一点、到手反而变少」的陷阱区间。</p>
        ) : trap ? (
          <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-2">
            <span className="flex items-start gap-2 text-sm leading-relaxed text-ink">
              <span className="mt-1.5 inline-block h-2 w-2 shrink-0 rounded-full bg-danger" aria-hidden="true" />
              <span className="tabular-nums">
                {fmtMoney(input.bonus)} 落在陷阱区间 {fmtMoney(trap.lower)}–{fmtMoney(trap.upper)}：比正好发 {fmtMoney(trap.lower)} 反而少拿{" "}
                {fmtMoney(trap.extraTax)}。
              </span>
            </span>
            {!staticMode && (
              <Button variant="secondary" className="h-9" onClick={() => patch({ bonus: trap.lower })}>
                按 {fmtMoney(trap.lower)} 重算
              </Button>
            )}
          </div>
        ) : (
          <p className="mt-2 text-sm tabular-nums text-muted">
            不在陷阱区间。{nextLower ? `下一个跳档点 ${fmtMoney(nextLower)}。` : "已在最高档，没有下一个跳档点。"}
          </p>
        )}
      </section>

      {/* 3. 拆分建议 */}
      <section className="py-4">
        <h3 className="text-sm font-semibold text-ink">拆分建议</h3>
        {!analysis ? (
          <p className="mt-2 text-sm leading-relaxed text-muted">{sepOnly ? "填上月薪，这里会给出总包不变时最省的工资 / 年终奖拆分。" : "填上年终奖和月薪，这里会给出总包不变时最省的工资 / 年终奖拆分。"}</p>
        ) : (
          <p className="mt-2 text-sm leading-relaxed tabular-nums text-ink">
            {split && split.saving > 1
              ? `总现金 ${fmtMoney(split.totalCash)} 不变，年终奖调到 ${fmtMoney(split.bestBonus)}、其余进工资，可再省 ${fmtMoney(split.saving)}。`
              : "当前拆分已是最省。"}
          </p>
        )}
      </section>

      <p className="pt-4 text-xs leading-relaxed text-muted">
        {year} 年口径 · 专项附加扣除每月 {fmtMoney(sad)} · 算你自己的：{host}
      </p>
    </div>
  );

  /** 陷阱区间表：页面左栏和分享弹层用同一份 */
  const trapTable = (
    <table className="w-full text-sm tabular-nums">
      <thead>
        <tr className="border-b border-line">
          <th scope="col" className="py-2 pr-3 text-left text-xs font-medium text-muted">
            区间
          </th>
          <th scope="col" className="py-2 pl-3 text-right text-xs font-medium text-muted">
            边界税额
          </th>
          <th scope="col" className="py-2 pl-3 text-right text-xs font-medium text-muted">
            最多少拿
          </th>
        </tr>
      </thead>
      <tbody className="divide-y divide-line">
        {rows.map((z) => {
          const here = hasBonus && input.bonus > z.lower && input.bonus < z.upper;
          return (
            <tr key={z.lower} className={here ? "bg-danger/5" : ""}>
              <th scope="row" className={`py-2 pr-3 text-left text-xs text-ink ${here ? "font-medium" : "font-normal"}`}>
                {fmtMoney(z.lower)}–{fmtMoney(z.upper)}
              </th>
              <td className="py-2 pl-3 text-right text-ink">{fmtMoney(z.tax)}</td>
              <td className={`py-2 pl-3 text-right ${here ? "font-semibold text-danger-text" : "text-ink"}`}>{fmtMoney(z.maxLoss)}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );

  return (
    <div className={`app-root mx-auto max-w-6xl px-4 pt-4 sm:px-6 ${showBar ? "pb-24 lg:pb-10" : "pb-10"}`}>
      {wasBonusLoadedFromShare() && (
        <p className="mb-4 rounded-xl border border-accent/30 bg-accent/10 px-4 py-2.5 text-sm text-ink">
          已按分享的数字预填，改成你自己的即可。
        </p>
      )}

      {showShare && (
        <ShareModal
          title="年终奖测算"
          subtitle={`${city.name} · 月薪 ${fmtMoney(input.monthlySalary)} · 年终奖 ${fmtMoney(input.bonus)}`}
          shareUrl={buildBonusShareUrl(input)}
          fileName={`年终奖-${year}-${dateText}.png`}
          ctaLabel="打开这份测算"
          onClose={() => setShowShare(false)}
        >
          <section className="report-section rounded-2xl border border-line bg-white p-5">{resultsBody(true)}</section>
          <section className="report-section rounded-2xl border border-line bg-white p-5">
            <h2 className="text-base font-semibold text-ink">陷阱区间</h2>
            <p className="mt-0.5 text-xs text-muted">单独计税跨档时多发反而少拿；表中行随你的年终奖高亮</p>
            <div className="mt-4">{trapTable}</div>
          </section>
        </ShareModal>
      )}

      <div className="mb-5 flex flex-wrap items-center justify-end gap-2">
        <Button variant="secondary" className="h-9" onClick={() => copyText(buildBonusShareUrl(input), setCopied)}>
          {copied ? "已复制" : "复制链接"}
        </Button>
        <Button variant="primary" className="h-9" onClick={() => setShowShare(true)}>
          分享报告
        </Button>
        <Button
          variant="ghost"
          className="h-9"
          onClick={() => {
            window.location.href = buildShareUrl(profile);
          }}
        >
          看完整测算 →
        </Button>
      </div>

      <ExampleHint storageKeys={["cn-tax-bonus-v1", "cn-tax-profile-v1"]} enabled={!wasBonusLoadedFromShare()} />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        {/* 输入 */}
        <div className="min-w-0 space-y-3 lg:col-start-1 lg:row-start-1" ref={inputsRef}>
          <div className="rounded-2xl border border-line bg-white p-4">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <Field label="城市">
                <CityPicker value={input.cityId} onChange={(id) => patch({ cityId: id })} />
              </Field>
              <Field label="税前月薪">
                <NumberInput value={input.monthlySalary} onChange={(monthlySalary) => patch({ monthlySalary })} prefix="¥" step={1000} />
              </Field>
              <Field label="年终奖" hint="按全年一次性奖金计算">
                <NumberInput value={input.bonus} onChange={(bonus) => patch({ bonus })} prefix="¥" step={10000} />
              </Field>
            </div>
            <div className="mt-3">
              <Details summary="工资月数与缴费设置">
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  <Field label="公积金比例" hint={`${city.name} 常见 ${(city.housingRateDefault * 100).toFixed(0)}%`}>
                    <NumberInput
                      value={ratePct}
                      onChange={(v) => patch({ housingRate: Math.min(20, Math.max(0, v)) / 100 })}
                      max={20}
                      suffix="%"
                      step={1}
                    />
                  </Field>
                  <Field label="已发月数" hint="今年在本公司的工资月数">
                    <NumberInput
                      value={input.paidMonths}
                      onChange={(v) => patch({ paidMonths: Math.min(12, Math.max(1, Math.round(v))) })}
                      min={1}
                      max={12}
                      suffix="月"
                      step={1}
                    />
                  </Field>
                </div>
              </Details>
            </div>
          </div>
          <p className="text-xs leading-relaxed text-muted">
            {year} 年口径 · 专项附加扣除沿用首页设置（每月 {fmtMoney(sad)}）。{" "}
            <Link href="/#deductions" className="text-accent-text underline underline-offset-2">修改扣除</Link>
          </p>
        </div>

        {/* 结果 */}
        <div
          className="min-w-0 space-y-4 lg:col-start-2 lg:row-start-1 lg:row-span-2 lg:sticky lg:top-6 lg:self-start"
          id="results"
          ref={resultsRef}
        >
          <Card title="年终奖测算" action={<span className="text-xs text-muted">生成于 {dateText}</span>}>
            {resultsBody()}
          </Card>
        </div>

        {/* 参考：与输入无关，始终完整显示 */}
        <div className="min-w-0 space-y-4 lg:col-start-1 lg:row-start-2">
          <Card title="陷阱区间" subtitle="单独计税跨档时多发反而少拿；表中行随你的年终奖高亮">
            {trapTable}
          </Card>

          <Card title="怎么和 HR 说">
            {!analysis ? (
              <p className="text-sm leading-relaxed text-muted">填上年终奖和月薪，这里会生成一段可以直接发给 HR 的话术。</p>
            ) : (
              <div className="min-w-0 space-y-2">
                {scriptText.split("\n").map((line) => (
                  <p key={line} className="text-sm leading-relaxed tabular-nums text-ink">
                    {line}
                  </p>
                ))}
                <Button variant="secondary" className="h-9" onClick={() => copyText(scriptText, setScriptCopied)}>
                  {scriptCopied ? "已复制" : "复制话术"}
                </Button>
              </div>
            )}
          </Card>
        </div>
      </div>

      {showBar && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-white px-4 py-2.5 pb-[max(0.625rem,env(safe-area-inset-bottom))] lg:hidden">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="truncate text-xs text-muted">{analysis ? `推荐：${bestName}` : "单独计税到手"}</div>
              <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                <span className="text-lg font-semibold tabular-nums text-ink">
                  {analysis ? fmtMoney(bestNet) : sepOnly ? fmtMoney(sepOnlyNet) : "—"}
                </span>
                {analysis && analysis.saving > 1 && <span className="text-xs tabular-nums text-good-text">少交 {fmtMoney(analysis.saving)}</span>}
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
