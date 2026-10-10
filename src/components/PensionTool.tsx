"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { getCity, sadMonthly } from "@/lib/tax";
import {
  PENSION_REGIONS,
  baseFromGross,
  baseFromNet,
  baseFromPensionDeduction,
  estimatePension,
  regionForCity,
  type PensionCategory,
  type RegionPension,
} from "@/lib/pension";
import { fmtMoney } from "@/lib/format";
import { SITE } from "@/lib/share";
import { DEFAULT_WAGE_GROWTH, buildPensionShareUrl, todayYM, usePension, type PensionMode } from "@/lib/pensionStore";
import { Button, Card, Details, Field, Hint, MonthSelect, NumberInput, Segmented, Select, Stat } from "./ui";
import { CityPicker } from "./CityPicker";
import { ExampleHint } from "./ExampleHint";
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

function fmtAge(years: number, months: number): string {
  return months ? `${years} 岁 ${months} 个月` : `${years} 岁`;
}

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
  const { input, patch, deductions, fromShare } = usePension();
  const [today] = useState(todayYM);
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
  const result = estimatePension(
    {
      birthYear: input.birthYear,
      birthMonth: input.birthMonth,
      category: input.category,
      city,
      currentBase: baseInfo.raw,
      today,
      balance: input.balance,
      paidMonths: input.paidYears * 12 + input.paidMonthsExtra,
      pastIndex: input.pastIndex && input.pastIndex > 0 ? clamp(input.pastIndex, 0.3, 3) : undefined,
      deemedYears: input.deemedYears,
      stopAge: input.stopAge && input.stopAge > 0 ? clamp(input.stopAge, 18, 70) : undefined,
      wageGrowth,
      salaryGrowth,
      accountRate: input.accountRate,
      inflation: input.inflation,
      transitionCoef: input.transitionCoef,
      homeRegion: insuredRegion ? regions.find((r) => r.id === insuredRegion.id) : undefined,
    },
    regions,
  );

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

  /** 头条 + 拆分 + 校验：页面和分享弹层用同一份 */
  const summaryBody = (
    <div className="space-y-4">
      <div className="rounded-xl bg-ink px-5 py-4 text-white">
        <div className="text-xs text-white/70">每月养老金，折合今天的钱约</div>
        <div className="mt-1 text-4xl font-semibold tabular-nums">{refRow ? fmtMoney(refRow.totalToday) : "—"}</div>
        <div className="mt-2 space-y-1 text-xs leading-relaxed tabular-nums text-white/70">
          {refRow && (
            <p>
              退休时实发约 {fmtMoney(refRow.total)}（按年通胀 {pctText(input.inflation)} 折回今天）
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
            <Fact label={refRow.index !== result.avgIndex ? "平均缴费指数（按领取地折算）" : "平均缴费指数"} value={refRow.index.toFixed(2)} />
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
            <th className="py-2 pr-2 text-left font-medium">领取地</th>
            <th className="hidden px-2 py-2 text-right font-medium sm:table-cell">退休时计发基数</th>
            <th className="px-2 py-2 text-right font-medium">每月合计</th>
            <th className="py-2 pl-2 text-right font-medium">差额<span className="hidden sm:inline">（相比{fallbackRegion ? "中位数" : "你的领取地"}）</span></th>
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
                    {isRef && !fallbackRegion && <span className="whitespace-nowrap rounded bg-accent/15 px-1.5 py-0.5 text-[11px] text-accent-text">领取地</span>}
                    {insured && <span className="whitespace-nowrap rounded bg-paper px-1.5 py-0.5 text-[11px] text-muted ring-1 ring-line">参保地</span>}
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
      <p className="mt-2 text-xs text-muted sm:hidden">差额 = 相比{fallbackRegion ? "中位数" : "你的领取地"}每月多（少）多少。</p>
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
          subtitle={`${input.birthYear} 年 ${input.birthMonth} 月出生 · ${CATEGORY_NAME[input.category]} · ${city.name}参保 · ${receiveLabel}领取`}
          shareUrl={buildPensionShareUrl(input)}
          fileName={`养老金预估-${dateText}.png`}
          ctaLabel="算你自己的"
          onClose={() => setShowShare(false)}
        >
          <section className="report-section rounded-2xl border border-line bg-white p-5">{summaryBody}</section>
          <section className="report-section rounded-2xl border border-line bg-white p-5">
            <h2 className="text-base font-semibold text-ink">换个地方退休，每月差多少</h2>
            <p className="mb-3 mt-0.5 text-xs text-muted">缴费记录不变，只换待遇领取地</p>
            {tableBody}
          </section>
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

      <ExampleHint storageKeys={["cn-tax-pension-v1", "cn-tax-profile-v1"]} enabled={!fromShare} text="当前为示例数据。改成你的出生年月、工资，并填上社保 App 里查到的账户余额和缴费年限，结果才准。" />

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

            <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-2 xl:grid-cols-3">
              <Field label="参保城市" className="col-span-2 sm:col-span-1 lg:col-span-2 xl:col-span-1">
                <CityPicker value={input.cityId} onChange={(id) => patch({ cityId: id })} ariaLabel="参保城市" />
              </Field>
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
                sub={`${city.name}社保基数 ${fmtMoney(city.socialMin)}–${fmtMoney(city.socialMax)}`}
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

          <Card title="打算在哪领养老金" subtitle="决定用哪里的计发基数" className="border-accent/40">
            <Field label="领取地" hint="一般是户籍地或最后连续缴满 10 年的地方，见右侧说明">
              <CityPicker value={input.receiveCityId} onChange={(id) => patch({ receiveCityId: id })} ariaLabel="领取地" />
            </Field>
            {fallbackRegion && <p className="mt-2 text-xs leading-relaxed text-muted">暂无该地区计发基数，结果按全国平均估算。</p>}
          </Card>

          <Card title="已经缴了多少" subtitle="在 电子社保卡 / 掌上 12333 / 当地社保 App 的「个人权益记录」里能查到">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-2 xl:grid-cols-3">
              <Field label="个人账户累计储存额" className="col-span-2 sm:col-span-1 lg:col-span-2 xl:col-span-1">
                <NumberInput value={input.balance} onChange={(balance) => patch({ balance })} prefix="¥" step={10000} />
              </Field>
              <Field label="累计缴费年限" className="col-span-2 sm:col-span-1 lg:col-span-2 xl:col-span-1">
                <div className="grid grid-cols-2 gap-2">
                  <NumberInput value={input.paidYears} onChange={(paidYears) => patch({ paidYears })} suffix="年" max={60} step={1} ariaLabel="累计缴费年数" />
                  <NumberInput value={input.paidMonthsExtra} onChange={(paidMonthsExtra) => patch({ paidMonthsExtra })} suffix="月" max={11} step={1} ariaLabel="累计缴费月数" />
                </div>
              </Field>
              <Field label="过去平均缴费指数" hint="查不到就留空" className="col-span-2 sm:col-span-1 lg:col-span-2 xl:col-span-1">
                <NumberInput
                  value={input.pastIndex}
                  placeholder={`默认 = 现在的 ${result.currentIndex.toFixed(2)}`}
                  step={0.1}
                  onChange={(v) => patch({ pastIndex: v > 0 ? v : undefined })}
                />
              </Field>
            </div>
            <div className="mt-3">
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
                <Field label="通胀" hint="只用于「折合今天的钱」">
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
          </Card>

          <Card title="换个地方退休，每月差多少" subtitle="缴费记录不变，只换待遇领取地（按每月合计从高到低）">
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
          </Card>
          <p className="text-xs leading-relaxed text-muted">
            数据：计发基数为各省最新公布值（{yearText} 年度）。{city.name}参保 · {CATEGORY_NAME[input.category]} · {input.birthYear} 年 {input.birthMonth} 月出生 · 算你自己的：{host}
          </p>
        </div>
      </div>

      {showBar && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-white px-4 py-2.5 pb-[max(0.625rem,env(safe-area-inset-bottom))] lg:hidden">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="truncate text-xs text-muted">每月养老金（折合今天）</div>
              <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                <span className="text-lg font-semibold tabular-nums text-ink">{refRow ? fmtMoney(refRow.totalToday) : "—"}</span>
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
