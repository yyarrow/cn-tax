"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { MONTH_NAMES, getCity, sadMonthly } from "@/lib/tax";
import {
  PENSION_REGIONS,
  baseFromGross,
  baseFromNet,
  baseFromPensionDeduction,
  estimatePension,
  fmtAgeYM,
  pensionScenarios,
  regionForCity,
  type PastRecord,
  type PensionCategory,
  type RegionPension,
} from "@/lib/pension";
import { fmtMoney } from "@/lib/format";
import { SITE } from "@/lib/share";
import { DEFAULT_WAGE_GROWTH, MAX_RECORDS, buildPensionShareUrl, todayYM, usePension, type PensionMode } from "@/lib/pensionStore";
import { Button, Card, Details, Field, Hint, MonthSelect, NumberInput, Segmented, Select, Stat } from "./ui";
import { CityPicker } from "./CityPicker";
import { ExampleHint } from "./ExampleHint";
import { ScenarioChart, type ScenarioMode } from "./ScenarioChart";
import { ShareModal } from "./ShareModal";

const MODES: { value: PensionMode; label: string }[] = [
  { value: "gross", label: "按税前工资" },
  { value: "net", label: "税前 + 到手反推" },
  { value: "pension", label: "按工资条养老扣款" },
];

const CATEGORIES: { value: PensionCategory; label: ReactNode }[] = [
  { value: "male", label: "男" },
  { value: "female55", label: <>女 · 原 55 岁<span className="hidden min-[400px]:inline">退休</span></> },
  { value: "female50", label: <>女 · 原 50 岁<span className="hidden min-[400px]:inline">退休</span></> },
];

const BIRTH_YEARS = Array.from({ length: 2010 - 1950 + 1 }, (_, i) => 2010 - i);

function clamp(v: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, v));
}

/** 比例（小数）→ 输入框里的百分数，保留两位小数以内 */
function toPct(r: number): number {
  return Math.round(r * 10000) / 100;
}

function pctText(r: number): string {
  return `${toPct(r)}%`;
}

/** 月数 → "X 年 Y 个月" */
function fmtYM(months: number): string {
  const m = Math.max(0, Math.round(months));
  const y = Math.floor(m / 12);
  const r = m % 12;
  if (y === 0) return `${r} 个月`;
  return r ? `${y} 年 ${r} 个月` : `${y} 年`;
}

const fmtAge = fmtAgeYM;

function signed(n: number): string {
  if (Math.abs(n) < 0.5) return "—";
  return `${n > 0 ? "+" : "−"}${fmtMoney(Math.abs(n))}`;
}

function DangerNote({ children }: { children: ReactNode }) {
  return (
    <p className="flex items-start gap-2 px-1 text-xs leading-relaxed text-danger-text">
      <span className="mt-1.5 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-danger-text" aria-hidden="true" />
      <span>{children}</span>
    </p>
  );
}

function Fact({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="min-w-0 px-3 py-2.5">
      <div className="text-xs text-muted">{label}</div>
      <div className="mt-0.5 text-sm font-semibold tabular-nums text-ink">{value}</div>
    </div>
  );
}

function Row({ label, value, sub }: { label: ReactNode; value: ReactNode; sub?: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-2">
      <div className="min-w-0">
        <div className="text-sm text-ink">{label}</div>
        {sub && <div className="mt-0.5 text-xs text-muted">{sub}</div>}
      </div>
      <div className="shrink-0 text-sm font-semibold tabular-nums text-ink">{value}</div>
    </div>
  );
}

const CATEGORY_NAME: Record<PensionCategory, string> = { male: "男", female55: "女（原 55 岁退休）", female50: "女（原 50 岁退休）" };

export function PensionTool() {
  const { input, patch, patchRecord, addRecord, removeRecord, deductions, fromShare } = usePension();
  const [today] = useState(todayYM);
  const [scenarioMode, setScenarioMode] = useState<ScenarioMode>("flex");
  // city = 工作城市（现在缴社保的地方），receiveCity = 退休城市
  const city = getCity(input.cityId);
  const receiveCity = getCity(input.receiveCityId);
  const sad = sadMonthly(deductions);

  const receiveRegion = regionForCity(receiveCity.id, receiveCity.provinceId);
  const insuredRegion = regionForCity(city.id, city.provinceId);

  // ---- 当前缴费基数 ----
  const baseInfo = (() => {
    const fallback = baseFromGross(input.gross, city);
    if (input.mode === "gross") {
      return { raw: input.gross, ready: input.gross > 0, filled: input.gross > 0, failNote: "" };
    }
    if (input.mode === "pension") {
      const x = input.pensionDeduction ?? 0;
      return { raw: x > 0 ? baseFromPensionDeduction(x) : fallback, ready: x > 0, filled: x > 0, failNote: "" };
    }
    const net = input.net ?? 0;
    if (net <= 0 || input.gross <= 0) return { raw: fallback, ready: false, filled: false, failNote: "" };
    const r = baseFromNet({ gross: input.gross, net, month: input.netMonth, city, housingRate: input.housingRate, sadMonthly: sad });
    return { raw: r.base, ready: r.ok, filled: true, failNote: r.ok ? "" : r.note };
  })();

  const clampedBase = clamp(baseInfo.raw, city.socialMin, city.socialMax);
  const boundNote = baseInfo.raw > city.socialMax + 0.5 ? "已按上限" : baseInfo.raw < city.socialMin - 0.5 ? "已按下限" : "";
  const socialAvg = city.socialMax / 3;
  const grossBase = baseFromGross(input.gross, city);
  const lowBase = input.mode === "net" && baseInfo.ready && grossBase > 0 && clampedBase < grossBase * 0.8;

  // ---- 引擎 ----
  const wageGrowth = input.wageGrowth ?? receiveRegion?.growth ?? DEFAULT_WAGE_GROWTH;
  const salaryGrowth = input.salaryGrowth ?? wageGrowth;
  const regions = input.wageGrowth === undefined ? PENSION_REGIONS : PENSION_REGIONS.map((r) => ({ ...r, growth: input.wageGrowth }));
  const pastRecords: PastRecord[] = input.records.map((r) => {
    const c = getCity(r.cityId);
    const reg = regionForCity(c.id, c.provinceId);
    const hasLast = r.lastYear !== undefined && r.lastYear >= 1980 && r.lastMonth !== undefined;
    return {
      region: reg ? regions.find((x) => x.id === reg.id) : undefined,
      city: c,
      months: r.months,
      amount: r.amount,
      lastYM: hasLast ? { year: r.lastYear!, month: r.lastMonth! } : undefined,
    };
  });
  const engineInput = {
    birthYear: input.birthYear,
    birthMonth: input.birthMonth,
    category: input.category,
    city,
    currentBase: baseInfo.raw,
    today,
    records: pastRecords,
    deemedYears: input.deemedYears,
    stopAge: input.stopAge && input.stopAge > 0 ? clamp(input.stopAge, 18, 70) : undefined,
    wageGrowth,
    salaryGrowth,
    accountRate: input.accountRate,
    inflation: input.inflation,
    transitionCoef: input.transitionCoef,
    homeRegion: insuredRegion ? regions.find((r) => r.id === insuredRegion.id) : undefined,
  };
  const result = estimatePension(engineInput, regions);
  const scenarios = pensionScenarios(engineInput, regions, receiveRegion?.id);

  const rows = result.byRegion;
  const median: RegionPension | undefined = rows[Math.floor(rows.length / 2)];
  const refRow: RegionPension | undefined = rows.find((r) => r.region.id === receiveRegion?.id) ?? median;
  const fallbackRegion = !receiveRegion;
  const top = rows[0];
  const bottom = rows[rows.length - 1];

  const ret = result.retirement;
  const retireIdx = ret.year * 12 + (ret.month - 1);
  const todayIdx = today.year * 12 + (today.month - 1);
  const alreadyRetired = retireIdx <= todayIdx;
  const effectiveMonths = result.totalMonths + input.deemedYears * 12;
  const regionYears = Array.from(new Set(PENSION_REGIONS.map((r) => r.base.year))).sort();
  const yearText = regionYears.length > 1 ? `${regionYears[0]}–${regionYears[regionYears.length - 1]}` : `${regionYears[0] ?? ""}`;

  const receiveLabel = receiveRegion
    ? receiveRegion.name === receiveCity.name
      ? receiveCity.name
      : `${receiveCity.name}（按${receiveRegion.name}计发基数）`
    : receiveCity.name;

  // ---- 页面交互：结果可见性 / 分享 ----
  const inputsRef = useRef<HTMLDivElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);
  const [resultsVisible, setResultsVisible] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const el = resultsRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const obs = new IntersectionObserver(([entry]) => setResultsVisible(entry.isIntersecting), { threshold: 0.05 });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const now = new Date();
  const dateText = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const host = typeof window !== "undefined" ? window.location.host : new URL(SITE).host;

  const copyLink = async () => {
    const url = buildPensionShareUrl(input);
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

  const retireText = `${ret.year} 年 ${ret.month} 月`;

  /** 页头小字链接：滚到「领取地能自己选吗」并展开 */
  const openReceiveRules = () => {
    const box = document.getElementById("receive-rules");
    const el = box?.querySelector("details");
    if (el) el.open = true;
    box?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  /** 「哪年退休，每月领多少」的图 + 结论：页面和分享弹层用同一份 */
  const scenarioBody = (staticMode: boolean) => (
    <ScenarioChart
      key={scenarioMode}
      points={scenarioMode === "flex" ? scenarios.flex : scenarios.stop}
      mode={scenarioMode}
      statutoryAge={fmtAge(result.statutory.ageYears, result.statutory.ageMonths)}
      staticMode={staticMode}
    />
  );

  /** 头条 + 拆分 + 校验：页面和分享弹层用同一份 */
  const summaryBody = (
    <div className="space-y-4">
      <div className="rounded-xl bg-ink px-5 py-4 text-white">
        <div className="text-xs text-white/70">退休第一个月，每月实发约</div>
        <div className="mt-1 text-4xl font-semibold tabular-nums">{refRow ? fmtMoney(refRow.total) : "—"}</div>
        <div className="mt-2 space-y-1 text-xs leading-relaxed tabular-nums text-white/70">
          {refRow && (
            <p>
              购买力相当于今天的 {fmtMoney(refRow.totalToday)}（按每年物价涨 {pctText(input.inflation)} 换算）
              {refRow.replacement > 0 && ` · 约为退休前缴费基数的 ${Math.round(refRow.replacement * 100)}%`}
            </p>
          )}
          <p>
            {alreadyRetired ? "已到法定退休年龄" : `${retireText}起领`}，
            {fallbackRegion ? "暂无该地区计发基数，按全国平均估算" : `在 ${receiveLabel} 领`}
          </p>
        </div>
      </div>

      {refRow && (
        <div className="@container">
          <div
            className={`grid divide-y divide-line rounded-xl border border-line sm:divide-x sm:divide-y-0 ${refRow.transitional > 0 ? "sm:grid-cols-3" : "sm:grid-cols-2"}`}
          >
            <Stat label="基础养老金" value={fmtMoney(refRow.basic)} sub={`计发基数 ${fmtMoney(refRow.baseAtRetirement)}（退休时）`} />
            <Stat label="个人账户养老金" value={fmtMoney(refRow.personal)} sub={`余额 ÷ ${result.annuityMonths} 个月`} />
            {refRow.transitional > 0 && <Stat label="过渡性养老金" value={fmtMoney(refRow.transitional)} sub={`视同缴费 ${input.deemedYears} 年`} />}
          </div>
          <div className="mt-3 grid grid-cols-2 rounded-xl border border-line sm:grid-cols-4 sm:divide-x sm:divide-line">
            <Fact label="缴费年限" value={fmtYM(result.years * 12)} />
            <Fact label={refRow.index !== result.avgIndex ? "平均缴费指数（按退休城市折算）" : "平均缴费指数"} value={refRow.index.toFixed(2)} />
            <Fact label="退休时账户余额" value={fmtMoney(result.accountAtRetirement)} />
            <Fact label="计发月数" value={`${result.annuityMonths} 个月`} />
          </div>
        </div>
      )}

      {alreadyRetired && (
        <Hint>按出生年月，你已到法定退休年龄（{retireText}）。下面按「现在起不再缴费」估算，具体待遇以社保经办机构核定为准。</Hint>
      )}

      {!result.meetsMinimum ? (
        <div className="rounded-xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm leading-relaxed text-danger-text">
          <b className="font-semibold">缴费年限不够：</b>按现在的计划只缴 {fmtYM(effectiveMonths)}，{ret.year} 年退休最低要 {fmtYM(result.minMonths)}，差{" "}
          {fmtYM(result.shortfallMonths)}——不补足就领不了按月发放的基本养老金。可以延长缴费，或咨询当地能否补缴。
        </div>
      ) : (
        <p className="text-xs leading-relaxed text-muted">缴费年限满足 {ret.year} 年退休的最低要求（{fmtYM(result.minMonths)}）。</p>
      )}
    </div>
  );

  /** 地区对比表 */
  const tableBody = (
    <div>
      {top && bottom && top !== bottom && (
        <p className="mb-3 text-sm leading-relaxed text-ink">
          同样的缴费记录，在 <b className="font-semibold">{top.region.name}</b> 领比在 <b className="font-semibold">{bottom.region.name}</b> 每月多{" "}
          <b className="font-semibold tabular-nums">{fmtMoney(top.total - bottom.total)}</b>。
        </p>
      )}
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-line text-xs text-muted">
            <th className="py-2 pr-2 text-left font-medium">退休城市</th>
            <th className="hidden px-2 py-2 text-right font-medium sm:table-cell">退休时计发基数</th>
            <th className="px-2 py-2 text-right font-medium">每月合计</th>
            <th className="py-2 pl-2 text-right font-medium">差额<span className="hidden sm:inline">（相比{fallbackRegion ? "中位数" : "你的退休城市"}）</span></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {rows.map((r) => {
            const isRef = r.region.id === refRow?.region.id;
            const insured = r.region.id === insuredRegion?.id;
            const diff = refRow ? r.total - refRow.total : 0;
            return (
              <tr key={r.region.id} className={isRef ? "bg-accent/10" : ""}>
                <td className="py-2.5 pl-1 pr-2 align-top">
                  <div className="flex flex-wrap items-center gap-1">
                    <span className={isRef ? "font-semibold text-accent-text" : "text-ink"}>{r.region.name}</span>
                    {isRef && !fallbackRegion && <span className="whitespace-nowrap rounded bg-accent/15 px-1.5 py-0.5 text-[11px] text-accent-text">退休城市</span>}
                    {insured && <span className="whitespace-nowrap rounded bg-paper px-1.5 py-0.5 text-[11px] text-muted ring-1 ring-line">工作城市</span>}
                  </div>
                  <div className="mt-0.5 text-xs tabular-nums text-muted">
                    <span className="sm:hidden">计发基数 {fmtMoney(r.baseAtRetirement)} · </span>指数 {r.index.toFixed(2)}
                  </div>
                </td>
                <td className="hidden px-2 py-2.5 text-right align-top tabular-nums text-muted sm:table-cell">{fmtMoney(r.baseAtRetirement)}</td>
                <td className={`px-2 py-2.5 text-right align-top font-semibold tabular-nums ${isRef ? "text-accent-text" : "text-ink"}`}>{fmtMoney(r.total)}</td>
                <td
                  className={`py-2.5 pl-2 pr-1 text-right align-top tabular-nums ${isRef ? "text-muted" : diff > 0.5 ? "text-good-text" : diff < -0.5 ? "text-danger-text" : "text-muted"}`}
                >
                  {isRef && !fallbackRegion ? "—" : signed(diff)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="mt-2 text-xs text-muted sm:hidden">差额 = 相比{fallbackRegion ? "中位数" : "你的退休城市"}每月多（少）多少。</p>
      <p className="mt-3 text-xs leading-relaxed text-muted">
        假设：社平 / 计发基数年增长 {pctText(wageGrowth)}，本人工资年增长 {pctText(salaryGrowth)}，个人账户记账利率 {pctText(input.accountRate)}，通胀{" "}
        {pctText(input.inflation)}。计发基数取各省最新公布值（{yearText} 年度），退休时的值按增长率外推；过渡性养老金系数 {pctText(input.transitionCoef)}。估算仅供参考，以社保经办机构核定为准。
      </p>
    </div>
  );

  return (
    <div className={`app-root mx-auto max-w-6xl px-4 pt-4 sm:px-6 ${showBar ? "pb-24 lg:pb-10" : "pb-10"}`}>
      {fromShare && (
        <p className="mb-4 rounded-xl border border-accent/30 bg-accent/10 px-4 py-2.5 text-sm text-ink">已按分享的数字预填，改成你自己的即可。</p>
      )}

      {showShare && (
        <ShareModal
          title="养老金预估"
          subtitle={`${input.birthYear} 年 ${input.birthMonth} 月出生 · ${CATEGORY_NAME[input.category]} · ${city.name}工作 · ${receiveLabel}退休`}
          shareUrl={buildPensionShareUrl(input)}
          fileName={`养老金预估-${dateText}.png`}
          ctaLabel="算你自己的"
          onClose={() => setShowShare(false)}
        >
          <section className="report-section rounded-2xl border border-line bg-white p-5">{summaryBody}</section>
          <section className="report-section rounded-2xl border border-line bg-white p-5">
            <h2 className="text-base font-semibold text-ink">哪年退休，每月领多少</h2>
            <p className="mb-3 mt-0.5 text-xs text-muted">{scenarioMode === "flex" ? "法定退休年龄前后各 3 年，折合今天的钱" : "不同年龄停缴、按法定年龄退休，折合今天的钱"}</p>
            {scenarioBody(true)}
          </section>
          <section className="report-section rounded-2xl border border-line bg-white p-5">
            <h2 className="text-base font-semibold text-ink">换个地方退休，每月差多少</h2>
            <p className="mb-3 mt-0.5 text-xs text-muted">缴费记录不变，只换待遇领取地</p>
            {tableBody}
          </section>
        </ShareModal>
      )}

      <div className="mb-2 flex flex-wrap items-end justify-end gap-2">
        <Field label="工作城市">
          <CityPicker value={input.cityId} onChange={(id) => patch({ cityId: id })} className="w-36" ariaLabel="工作城市" />
        </Field>
        <Field label="退休城市">
          <CityPicker value={input.receiveCityId} onChange={(id) => patch({ receiveCityId: id })} className="w-36" ariaLabel="退休城市" />
        </Field>
        <Button variant="secondary" className="h-9" onClick={copyLink}>
          {copied ? "已复制" : "复制链接"}
        </Button>
        <Button variant="primary" className="h-9" onClick={() => setShowShare(true)}>
          分享报告
        </Button>
      </div>
      <p className="mb-5 text-right text-xs text-muted">
        {fallbackRegion && <span className="mr-2">暂无{receiveCity.name}的计发基数，结果按全国平均估算。</span>}
        <button type="button" className="text-accent-text hover:underline" onClick={openReceiveRules}>
          在哪领由户籍和缴费年限决定 ›
        </button>
      </p>

      <ExampleHint storageKeys={["cn-tax-pension-v1", "cn-tax-profile-v1"]} enabled={!fromShare} text="当前为示例数据。改成你的出生年月、工资，并按参保地填上社保 App 里查到的缴费月数和账户金额，结果才准。" />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        {/* 输入 */}
        <div className="min-w-0 space-y-3" ref={inputsRef}>
          <Card title="你" subtitle="决定几岁、哪年退休">
            <div className="grid grid-cols-2 gap-3">
              <Field label="出生年">
                <Select value={input.birthYear} onChange={(e) => patch({ birthYear: Number(e.target.value) })}>
                  {BIRTH_YEARS.map((y) => (
                    <option key={y} value={y}>
                      {y} 年
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="出生月">
                <MonthSelect value={input.birthMonth} onChange={(birthMonth) => patch({ birthMonth })} />
              </Field>
            </div>
            <div className="mt-3">
              <Segmented label="退休类别" value={input.category} options={CATEGORIES} onChange={(category) => patch({ category })} />
            </div>
            <div className="mt-2">
              <Hint>女职工按岗位：管理和技术岗一般原 55 岁，生产操作岗一般原 50 岁。</Hint>
            </div>
            <p className="mt-3 text-sm leading-relaxed text-ink">
              法定退休：<b className="font-semibold tabular-nums">{retireText}</b>，
              <span className="tabular-nums">{fmtAge(ret.ageYears, ret.ageMonths)}</span>
              <span className="text-muted">（{ret.delayMonths > 0 ? `延迟 ${ret.delayMonths} 个月` : "不延迟"}）</span>
            </p>
          </Card>

          <Card title="现在怎么缴" subtitle="用来推算你现在的缴费基数">
            <Segmented label="缴费基数的来源" value={input.mode} options={MODES} onChange={(mode) => patch({ mode })} />
            <p className="mt-2 text-xs text-muted">
              按{city.name}的基数上下限 {fmtMoney(city.socialMin)}–{fmtMoney(city.socialMax)}（工作城市在页面右上角改）
            </p>

            <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-2 xl:grid-cols-3">
              {input.mode !== "pension" && (
                <Field label="税前月薪">
                  <NumberInput value={input.gross} onChange={(gross) => patch({ gross })} prefix="¥" step={1000} />
                </Field>
              )}
              {input.mode === "net" && (
                <>
                  <Field label="某月到手" hint="工资卡实收，选普通月份">
                    <NumberInput value={input.net} placeholder="必填" prefix="¥" step={500} onChange={(net) => patch({ net })} />
                  </Field>
                  <Field label="到手是几月">
                    <MonthSelect value={input.netMonth} onChange={(netMonth) => patch({ netMonth })} />
                  </Field>
                  <Field label="公积金个人比例" hint={`${city.name} 常见 ${pctText(city.housingRateDefault)}，没交填 0`}>
                    <NumberInput value={toPct(input.housingRate)} onChange={(v) => patch({ housingRate: v / 100 })} max={20} suffix="%" step={1} />
                  </Field>
                </>
              )}
              {input.mode === "pension" && (
                <Field label="养老保险个人扣款" hint="工资条上「养老保险」那一项，÷ 8% 得基数">
                  <NumberInput
                    value={input.pensionDeduction}
                    placeholder="必填"
                    prefix="¥"
                    step={100}
                    onChange={(v) => patch({ pensionDeduction: v })}
                  />
                </Field>
              )}
            </div>

            <div className="mt-3 divide-y divide-line rounded-xl border border-line px-3">
              <Row
                label="当前缴费基数"
                value={
                  <>
                    {fmtMoney(clampedBase)}
                    {boundNote && <span className="ml-1.5 text-xs font-normal text-muted">{boundNote}</span>}
                  </>
                }
              />
              <Row label="当前缴费指数" sub={`基数 ÷ 当地社平（约 ${fmtMoney(socialAvg)}）`} value={result.currentIndex.toFixed(2)} />
            </div>
            <p className="mt-2 text-xs leading-relaxed text-muted">指数 1 = 按当地社平工资缴；公司按最低基数缴时指数约 0.6。</p>
            {!baseInfo.filled && (
              <p className="mt-2 text-xs leading-relaxed text-muted">
                {input.mode === "net" ? "还没填税前 / 到手，" : input.mode === "pension" ? "还没填养老扣款，" : "还没填税前月薪，"}先按税前工资估算。
              </p>
            )}
            {baseInfo.failNote && <div className="mt-2"><DangerNote>反推没成功：{baseInfo.failNote}。先按税前工资估算。</DangerNote></div>}
            {lowBase && (
              <div className="mt-2">
                <DangerNote>看起来公司是按较低基数给你缴的社保（反推基数 {fmtMoney(clampedBase)}，税前 {fmtMoney(input.gross)}），这会直接拉低养老金。</DangerNote>
              </div>
            )}
          </Card>

          <Card title="过去怎么缴" subtitle="每个交过社保的省 / 市各填一条，数字在社保 App 或支付宝、微信「社保查询」里能查到">
            <div className="space-y-3">
              {input.records.map((r, i) => {
                const res = result.records[i];
                const rc = getCity(r.cityId);
                const filled = r.months > 0 && r.amount > 0;
                return (
                  <div key={r.id} className="rounded-xl border border-line p-3">
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <span className="text-xs font-medium text-muted">参保地 {i + 1}</span>
                      {input.records.length > 1 && (
                        <Button variant="danger" className="h-7 px-2 text-xs" onClick={() => removeRecord(r.id)}>
                          删除
                        </Button>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <Field label="参保地" className="col-span-2">
                        <CityPicker value={r.cityId} onChange={(id) => patchRecord(r.id, { cityId: id })} ariaLabel={`参保地 ${i + 1}`} />
                      </Field>
                      <Field label="缴费月数">
                        <NumberInput value={r.months} onChange={(months) => patchRecord(r.id, { months })} suffix="月" max={720} step={12} ariaLabel={`参保地 ${i + 1} 缴费月数`} />
                      </Field>
                      <Field label="个人账户金额">
                        <NumberInput value={r.amount} onChange={(amount) => patchRecord(r.id, { amount })} prefix="¥" step={10000} ariaLabel={`参保地 ${i + 1} 个人账户金额`} />
                      </Field>
                      <Field label="最后缴费年月（可选，空 = 一直缴到现在）" className="col-span-2">
                        <div className="grid grid-cols-2 gap-2">
                          <NumberInput
                            value={r.lastYear}
                            placeholder="如 2024"
                            suffix="年"
                            min={1980}
                            max={2100}
                            step={1}
                            onChange={(v) => patchRecord(r.id, { lastYear: v > 0 ? v : undefined })}
                            ariaLabel={`参保地 ${i + 1} 最后缴费年`}
                          />
                          <Select
                            value={r.lastMonth ?? ""}
                            onChange={(e) => patchRecord(r.id, { lastMonth: e.target.value ? Number(e.target.value) : undefined })}
                            aria-label={`参保地 ${i + 1} 最后缴费月`}
                          >
                            <option value="">月</option>
                            {MONTH_NAMES.map((n, mi) => (
                              <option key={mi} value={mi + 1}>
                                {n}
                              </option>
                            ))}
                          </Select>
                        </div>
                      </Field>
                    </div>
                    <p className="mt-2 text-xs leading-relaxed tabular-nums text-muted">
                      {filled && res?.base !== undefined
                        ? `平均缴费基数约 ${fmtMoney(res.base)}，缴费指数约 ${res.index.toFixed(2)}（相对${rc.name}社平）`
                        : r.months > 0
                          ? `没填账户金额，缴费指数按现在的 ${result.currentIndex.toFixed(2)} 估算，账户余额按 0 算`
                          : "填上缴费月数和账户金额，这里会算出你当时的缴费基数和指数"}
                    </p>
                  </div>
                );
              })}
            </div>
            {input.records.length < MAX_RECORDS && (
              <div className="mt-3">
                <Button onClick={addRecord}>＋ 加一个参保地</Button>
              </div>
            )}
            <div className="mt-3">
              <Hint>
                缴费月数 ←「按月缴费月数」或「至本年末实际缴费月数」；个人账户金额 ←「至本年末账户累计储存额」，查不到就填「个人缴费（划入个人账户）总额」（不含利息，结果会略保守）；最后缴费年月 ←「最后参保年月」。已经办过转移合并到现在参保地的，只填现在那一条，不要重复填。
              </Hint>
            </div>
            <div className="mt-3 space-y-3">
              <Details summary="个人账户和统筹是什么？">
                <div className="space-y-2 text-sm leading-relaxed text-ink">
                  <p>
                    <b className="font-semibold">个人账户</b>：每月工资条上扣的养老保险 8% 全部记入个人账户，是你自己的钱，按记账利率计息，去世后余额可以继承；退休后按计发月数（60 岁 139 个月、63 岁 117 个月）分月发，发完了也照发，由统筹基金兜底。账户越多，这部分越多。
                  </p>
                  <p>
                    <b className="font-semibold">统筹（基础养老金）</b>：单位交的 16% 进统筹基金，不记在你名下。退休时按（领取地计发基数 + 本人指数化工资）÷ 2 × 缴费年限 × 1% 发放：缴得越久、缴费基数相对社平越高、领取地平均工资越高，就越多——不是人人一样。
                  </p>
                </div>
              </Details>
              <Details summary="视同缴费年限（1990 年代国企等有的才填）">
                <div className="grid grid-cols-2 gap-3">
                  <Field label="视同缴费年限" hint="个人账户建立前的工龄，没有就填 0">
                    <NumberInput value={input.deemedYears} onChange={(deemedYears) => patch({ deemedYears })} suffix="年" max={40} step={1} />
                  </Field>
                  <Field label="过渡系数" hint="各地不同，默认 1.2%">
                    <NumberInput value={toPct(input.transitionCoef)} onChange={(v) => patch({ transitionCoef: v / 100 })} max={5} suffix="%" step={0.1} />
                  </Field>
                </div>
              </Details>
            </div>
          </Card>

          <div className="rounded-2xl border border-line bg-white p-5 shadow-sm">
            <Details summary="假设（缴到几岁、工资增长、记账利率、通胀）">
              <div className="grid grid-cols-2 gap-3">
                <Field label="缴到多少岁" hint="留空 = 缴到法定退休">
                  <NumberInput value={input.stopAge} placeholder="缴到退休" suffix="岁" max={70} step={1} onChange={(v) => patch({ stopAge: v > 0 ? v : undefined })} />
                </Field>
                <Field label="社平工资年增长" hint="计发基数也按它外推；留空用默认">
                  <NumberInput
                    value={input.wageGrowth === undefined ? undefined : toPct(input.wageGrowth)}
                    placeholder={`默认 ${toPct(receiveRegion?.growth ?? DEFAULT_WAGE_GROWTH)}`}
                    suffix="%"
                    max={20}
                    step={0.5}
                    onChange={(v) => patch({ wageGrowth: v > 0 ? v / 100 : undefined })}
                  />
                </Field>
                <Field label="本人工资年增长" hint="留空 = 同社平，即缴费指数不变">
                  <NumberInput
                    value={input.salaryGrowth === undefined ? undefined : toPct(input.salaryGrowth)}
                    placeholder={`默认 ${toPct(wageGrowth)}`}
                    suffix="%"
                    max={20}
                    step={0.5}
                    onChange={(v) => patch({ salaryGrowth: v > 0 ? v / 100 : undefined })}
                  />
                </Field>
                <Field label="个人账户记账利率" hint="近年各地在 2%–3% 左右">
                  <NumberInput value={toPct(input.accountRate)} suffix="%" max={20} step={0.5} onChange={(v) => patch({ accountRate: v / 100 })} />
                </Field>
                <Field label="物价年涨幅（通胀）" hint="只用于换算「相当于今天的」，不影响实际发多少">
                  <NumberInput value={toPct(input.inflation)} suffix="%" max={20} step={0.5} onChange={(v) => patch({ inflation: v / 100 })} />
                </Field>
              </div>
            </Details>
          </div>
        </div>

        {/* 结果 */}
        <div className="min-w-0 space-y-4" id="results" ref={resultsRef}>
          <Card title="养老金预估" action={<span className="text-xs text-muted">生成于 {dateText}</span>}>
            {summaryBody}
            <div className="mt-3">
              <Details summary="养老金是怎么发的？「相当于今天的」是什么意思">
                <ul className="list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-ink">
                  <li>退休那个月，社保按当时的计发基数、你的缴费年限和指数、个人账户余额，算出第一个月发多少——上面的大数字就是这个，是真正打到卡上的钱。</li>
                  <li>之后每年国家统一上调一次基本养老金（近几年在 2%–3% 左右），这里没算退休后的上调，所以越往后实际领到的会比首月更多。</li>
                  <li>「相当于今天的」只是把 {ret.year} 年的钱按每年物价上涨 {pctText(input.inflation)} 换算成现在的购买力，方便和你现在的工资比，不影响实际发多少。物价假设可以在左边「假设」里改。</li>
                </ul>
              </Details>
            </div>
          </Card>

          <Card
            title="哪年退休，每月领多少"
            subtitle="同一份缴费记录，换个退休年龄或停缴年龄每月差多少。退休年份不同，所以统一换算成今天的钱来比"
            action={
              <Segmented
                label="情景类型"
                value={scenarioMode}
                options={[
                  { value: "flex" as ScenarioMode, label: "弹性退休" },
                  { value: "stop" as ScenarioMode, label: "提前停缴" },
                ]}
                onChange={setScenarioMode}
              />
            }
          >
            {scenarioBody(false)}
          </Card>

          <Card title="换个地方退休，每月差多少" subtitle="缴费记录不变，只换退休城市（按每月合计从高到低）">
            {tableBody}
            <div className="mt-4 space-y-3 border-t border-line pt-4">
              <Details summary="为什么不同地方差这么多">
                <ul className="list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-ink">
                  <li>
                    基础养老金 =（<b className="font-semibold">领取地</b>计发基数 + 本人指数化月平均缴费工资）÷ 2 × 缴费年限 × 1%。前一半完全看领取地的平均工资水平；个人账户养老金只看账户余额和计发月数，在哪领都一样。
                  </li>
                  <li>
                    在别处领时，按国办发〔2009〕66 号第七条，你各年度的缴费工资要按<b className="font-semibold">领取地</b>对应年度的平均工资重新折算指数：同样的工资，在平均工资低的地方折出的指数更高（这里封顶 3），在平均工资高的地方折出的指数更低。所以从高工资城市回低计发基数的地方领，少的主要是「计发基数」那一半；反过来去高计发基数的地方领，指数会被摊薄。
                  </li>
                  <li>计发基数每年随当地平均工资调整，所以越晚退休、地区间的差距越大（这里按假设的增长率外推）。</li>
                  <li>表里的折算用两地计发基数之比近似；各地经办对外地缴费年份的折算口径不完全一样，以领取地社保经办机构核定为准。</li>
                </ul>
              </Details>
              <div id="receive-rules" className="scroll-mt-24">
              <Details summary="领取地能自己选吗">
                <div className="space-y-2 text-sm leading-relaxed text-ink">
                  <p>按《城镇企业职工基本养老保险关系转移接续暂行办法》（国办发〔2009〕66 号），退休时在哪领取待遇，大致这样定：</p>
                  <ol className="list-decimal space-y-1.5 pl-5">
                    <li>养老保险关系在户籍所在地的，在户籍地领取；</li>
                    <li>不在户籍地、但在最后参保地累计缴费满 10 年的，在最后参保地领取；</li>
                    <li>不在户籍地、最后参保地不满 10 年的，转回上一个缴费满 10 年的参保地领取；</li>
                    <li>在各地累计缴费都不满 10 年的，转回户籍地领取。</li>
                  </ol>
                  <p className="text-muted">具体以当地社保经办机构为准。</p>
                </div>
              </Details>
              </div>
            </div>
          </Card>
          <p className="text-xs leading-relaxed text-muted">
            数据：计发基数为各省最新公布值（{yearText} 年度）。{city.name}工作 · {CATEGORY_NAME[input.category]} · {input.birthYear} 年 {input.birthMonth} 月出生 · 算你自己的：{host}
          </p>
        </div>
      </div>

      {showBar && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-white px-4 py-2.5 pb-[max(0.625rem,env(safe-area-inset-bottom))] lg:hidden">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="truncate text-xs text-muted">退休时每月实发约</div>
              <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                <span className="text-lg font-semibold tabular-nums text-ink">{refRow ? fmtMoney(refRow.total) : "—"}</span>
                <span className="text-xs tabular-nums text-muted">{alreadyRetired ? "已到退休年龄" : `${retireText}起领`}</span>
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
