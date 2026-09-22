"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CITY_PRESETS, computeAll, getCity, sadMonthly } from "@/lib/tax";
import type { Profile } from "@/lib/tax";
import { currentMonthFor, useProfile } from "@/lib/store";
import { fmtMoney } from "@/lib/format";
import { SITE, buildShareUrl } from "@/lib/share";
import { exportNodeAsPng, savePng } from "@/lib/exportImage";
import { Button, Card, Field, NumberInput, Select } from "./ui";
import { Timeline } from "./Timeline";
import { SegmentEditor } from "./SegmentEditor";
import { DeductionsEditor } from "./DeductionsEditor";
import { AdviceList } from "./AdviceList";

/** [1,2,7] → 「1–2 月、7 月」 */
function fmtMonths(months: number[]): string {
  const sorted = [...months].sort((a, b) => a - b);
  const parts: string[] = [];
  let i = 0;
  while (i < sorted.length) {
    let j = i;
    while (j + 1 < sorted.length && sorted[j + 1] === sorted[j] + 1) j++;
    parts.push(i === j ? `${sorted[i]} 月` : `${sorted[i]}–${sorted[j]} 月`);
    i = j + 1;
  }
  return parts.join("、");
}

/** 两段工作是否有共同月份（多处取薪） */
function overlaps(a: { startMonth: number; endMonth: number }, b: { startMonth: number; endMonth: number }): boolean {
  return a.startMonth <= b.endMonth && b.startMonth <= a.endMonth;
}

/** 退补来源：全部从输入和计算结果机械推导，不做猜测 */
function buildReasons(profile: Profile, result: ReturnType<typeof computeAll>): { id: string; text: string }[] {
  const out: { id: string; text: string }[] = [];
  const a = result.annual;
  const segs = [...profile.segments.filter((s) => s.monthlySalary > 0)].sort((x, y) => x.startMonth - y.startMonth);

  if (a.gapMonths.length > 0) {
    out.push({
      id: "gap",
      text: `有 ${a.gapMonths.length} 个月没有工资（${fmtMonths(a.gapMonths)}）：6 万减除和专项附加按全年算，预扣只按在职月份算。`,
    });
  }

  const anyOverlap = segs.some((s, i) => segs.slice(i + 1).some((t) => overlaps(s, t)));
  const sequential = segs.length >= 2 && !anyOverlap;
  if (sequential) {
    out.push({
      id: "jobswitch",
      text: `换过工作（${segs.length} 家单位）：每家从入职月重新累计，各用了一遍 3% 档，汇算合并后税率更高。`,
    });
  }
  if (anyOverlap) {
    out.push({
      id: "multi",
      text: "多处取薪：每家各减一次 5000/月，汇算只减一次。",
    });
  }

  if (result.bonus && result.bonus.saving > 1) {
    const better = result.bonus.recommended === "separate" ? "单独" : "并入";
    out.push({
      id: "bonus",
      text: `年终奖换成「${better}」计税可再省 ${fmtMoney(result.bonus.saving)}，汇算时在个税 App 里切换。`,
    });
  }

  if (sadMonthly(profile.deductions) === 0) {
    out.push({
      id: "sad",
      text: "还没填任何专项附加扣除：租房、赡养老人、子女教育等补报后通常再退几千元。",
    });
  }

  if (out.length === 0) out.push({ id: "none", text: "预扣和应纳基本一致，没有明显退补来源。" });
  return out;
}

const STEPS = [
  "3 月 1 日后打开「个人所得税」App。",
  "首页选「综合所得年度汇算」。",
  "用「使用已申报数据填写」，核对收入与扣除，补填专项附加，年终奖计税方式两种都试一下。",
  "提交：退税 1–2 周到卡，补税 6 月 30 日前缴。",
];

export function SettlementTool() {
  const { profile, ready, preview, keepPreview, discardPreview, patch, patchSegment, removeSegment, addSegment, patchDeductions, reset } = useProfile();
  const currentMonth = currentMonthFor(profile.year);
  const result = useMemo(() => computeAll(profile, currentMonth), [profile, currentMonth]);
  const city = getCity(profile.cityId);
  const hasIncome = profile.segments.some((s) => s.monthlySalary > 0);

  const a = result.annual;
  const isRefund = hasIncome && a.settlement < -0.5;
  const isPay = hasIncome && a.settlement > 0.5;
  const heroLabel = !hasIncome ? "预计退税 / 补税" : isRefund ? "预计退税" : isPay ? "预计补税" : "不退不补";
  const heroValue = !hasIncome ? "—" : isRefund ? `+${fmtMoney(-a.settlement)}` : isPay ? fmtMoney(a.settlement) : fmtMoney(0);
  const heroDot = isRefund ? "bg-good" : isPay ? "bg-danger" : "bg-white/40";

  const reasons = useMemo(() => buildReasons(profile, result), [profile, result]);
  const settlementAdvice = result.advice.filter((x) => x.kind === "settlement" || x.kind === "deduction");

  const exemptMeaning = !hasIncome
    ? "填上工作经历和月薪，这里会判断你能不能免办。"
    : a.settlementExempt
      ? "年收入不超 12 万或补税不超 400 元，可以不办、不用补。"
      : isRefund
        ? "退税要自己申请，不办就退不到账。"
        : isPay
          ? "不符合免申报条件，这笔补税必须自己申报缴清。"
          : "照常申报即可，金额为 0。";

  const exportRef = useRef<HTMLElement>(null);
  const inputsRef = useRef<HTMLDivElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);
  const [resultsVisible, setResultsVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!hasIncome) return;
    const el = resultsRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const obs = new IntersectionObserver(([entry]) => setResultsVisible(entry.isIntersecting), { threshold: 0.15 });
    obs.observe(el);
    return () => obs.disconnect();
  }, [hasIncome]);
  const scrollToResults = () => resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  const scrollToInputs = () => inputsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });

  const today = new Date();
  const dateText = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  const host = typeof window !== "undefined" ? window.location.host : new URL(SITE).host;
  const isMobile = typeof navigator !== "undefined" && /iPhone|iPad|Android|MicroMessenger/i.test(navigator.userAgent);
  const fileName = `汇算清缴-${profile.year}-${dateText}.png`;

  const exportPng = async () => {
    if (!exportRef.current || busy) return;
    setBusy(true);
    try {
      const png = await exportNodeAsPng(exportRef.current, { fileName, background: "#ffffff" });
      if (isMobile) setImageUrl(png);
      else savePng(png, fileName);
    } catch (err) {
      console.error(err);
      alert("导出图片失败，可以改用「复制链接」分享。");
    } finally {
      setBusy(false);
    }
  };

  const copyLink = async () => {
    const url = buildShareUrl(profile, "settlement");
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      window.prompt("复制这个链接：", url);
    }
  };

  const showBar = hasIncome && !imageUrl;

  return (
    <div className={`app-root mx-auto max-w-6xl px-4 pt-4 transition-opacity sm:px-6 ${showBar ? "pb-24 lg:pb-10" : "pb-10"} ${ready ? "opacity-100" : "opacity-0"}`}>
      {preview && (
        <div className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-accent/30 bg-accent/10 px-4 py-2.5 text-sm text-ink">
          <span className="flex-1">这是链接带来的数据，只是预览，不会覆盖你自己填过的内容。可以直接改着看。</span>
          <Button variant="primary" onClick={keepPreview} className="h-8">
            保留为我的数据
          </Button>
          <Button variant="secondary" onClick={discardPreview} className="h-8">
            回到我的数据
          </Button>
        </div>
      )}

      {imageUrl && (
        <div className="fixed inset-0 z-[60] flex flex-col items-center justify-center bg-ink/80 p-4" onClick={() => setImageUrl(null)}>
          <p className="mb-3 text-sm font-medium text-white">长按图片保存到相册</p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={imageUrl} alt={`${profile.year} 年汇算清缴预估`} className="max-h-[80vh] w-auto max-w-full rounded-lg shadow-lg" onClick={(e) => e.stopPropagation()} />
          <button type="button" className="mt-3 h-9 rounded-lg bg-white/90 px-4 text-sm text-ink" onClick={() => setImageUrl(null)}>
            关闭
          </button>
        </div>
      )}

      <div className="mb-5 flex flex-wrap items-start justify-end gap-2">
        <Field label="纳税年度">
          <NumberInput value={profile.year} onChange={(year) => patch({ year: Math.round(year) })} className="w-24" min={2019} />
        </Field>
        <Field label="工作城市">
          <Select value={profile.cityId} onChange={(e) => patch({ cityId: e.target.value })} className="w-32">
            {CITY_PRESETS.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </Field>
        <Button variant="ghost" onClick={() => confirm("清空所有输入，恢复默认？") && reset()} className="mt-5 h-9">
          重置
        </Button>
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        {/* 输入列 */}
        <div className="space-y-5" ref={inputsRef}>
          <Card title="今年的工作经历" subtitle="哪几个月有工资、换过几家，决定退还是补。" action={<Button onClick={addSegment}>＋ 加一段</Button>}>
            <Timeline segments={profile.segments} currentMonth={currentMonth} />
            <div className="mt-4 space-y-3">
              {profile.segments.map((s, i) => (
                <SegmentEditor
                  key={s.id}
                  seg={s}
                  index={i}
                  cityId={profile.cityId}
                  resolved={result.socials[s.id]}
                  onChange={(p) => patchSegment(s.id, p)}
                  onRemove={() => removeSegment(s.id)}
                  canRemove={profile.segments.length > 1}
                />
              ))}
            </div>
            {city.note && <p className="mt-3 text-xs text-muted">{city.note}</p>}
          </Card>

          <Card title="专项附加扣除" subtitle="没在单位申报过的，汇算时补报同样能退。">
            <DeductionsEditor d={profile.deductions} onChange={patchDeductions} />
          </Card>
        </div>

        {/* 结果列 */}
        <div className="space-y-4 lg:sticky lg:top-6 lg:self-start" id="results" ref={resultsRef}>
          <Card ref={exportRef} title={`${profile.year} 年汇算清缴预估`} action={<span className="text-xs text-muted">生成于 {dateText}</span>}>
            <div className="divide-y divide-line">
              {/* 1. 退补结论 */}
              <section className="space-y-3 pb-4">
                <div className="rounded-xl bg-ink px-5 py-4 text-white">
                  <div className="flex items-center gap-1.5 text-xs text-white/70">
                    <span className={`h-1.5 w-1.5 rounded-full ${heroDot}`} aria-hidden="true" />
                    {heroLabel}
                  </div>
                  <div className="mt-1 text-4xl font-semibold tabular-nums">{heroValue}</div>
                  <div className="mt-2 text-xs tabular-nums text-white/70">
                    {hasIncome ? `已预扣 ${fmtMoney(a.withheld)} · 全年应纳 ${fmtMoney(a.totalTax)}` : "已预扣 — · 全年应纳 —"}
                  </div>
                </div>

                <div className="grid grid-cols-2 divide-x divide-line rounded-xl border border-line">
                  <div className="px-3 py-2.5">
                    <div className="text-xs text-muted">办理时间</div>
                    <div className="mt-1 text-sm font-semibold tabular-nums text-ink">
                      {profile.year + 1} 年 3 月 1 日–6 月 30 日
                    </div>
                    <div className="mt-0.5 text-xs text-muted">个税 App 上自己办，不用去大厅。</div>
                  </div>
                  <div className="px-3 py-2.5">
                    <div className="text-xs text-muted">免申报</div>
                    <div className="mt-1 text-sm font-semibold text-ink">{!hasIncome ? "—" : a.settlementExempt ? "是" : "否"}</div>
                    <div className="mt-0.5 text-xs text-muted">{exemptMeaning}</div>
                  </div>
                </div>
              </section>

              {/* 2. 退补来源 */}
              <section className="py-4">
                <h3 className="text-sm font-semibold text-ink">为什么</h3>
                {hasIncome ? (
                  <ul className="mt-1 divide-y divide-line">
                    {reasons.map((r) => (
                      <li key={r.id} className="py-2 text-sm leading-relaxed text-ink">
                        {r.text}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-2 text-sm leading-relaxed text-muted">填上今年的工作经历和税前月薪，这里会列出退税或补税的来源。</p>
                )}
              </section>

              {/* 3. 办理步骤（与输入无关，始终完整显示） */}
              <section className="py-4">
                <h3 className="text-sm font-semibold text-ink">在个税 App 怎么办</h3>
                <ol className="mt-2 space-y-2">
                  {STEPS.map((s, i) => (
                    <li key={s} className="flex gap-2.5">
                      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-paper text-xs font-semibold text-muted">
                        {i + 1}
                      </span>
                      <span className="text-sm leading-relaxed text-ink">{s}</span>
                    </li>
                  ))}
                </ol>
              </section>

              {/* 4. 减税建议 */}
              <section className="py-4">
                <h3 className="text-sm font-semibold text-ink">减税建议</h3>
                {!hasIncome ? (
                  <p className="mt-2 text-sm leading-relaxed text-muted">填上工作经历和月薪，这里会按预计能退多少排出可补报的扣除。</p>
                ) : settlementAdvice.length > 0 ? (
                  <div className="mt-1">
                    <AdviceList items={settlementAdvice} />
                  </div>
                ) : (
                  <p className="mt-2 text-sm text-muted">专项附加都填满了，汇算这边没有可再省的。</p>
                )}
              </section>

              <p className="pt-4 text-xs leading-relaxed text-muted">
                {profile.year} 年口径 · 算你自己的：{host}
              </p>
            </div>
          </Card>

          {hasIncome && (
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="primary" className="h-9" onClick={exportPng}>
                {busy ? "生成中…" : "分享"}
              </Button>
              <Button variant="secondary" className="h-9" onClick={copyLink}>
                {copied ? "已复制" : "复制链接"}
              </Button>
              <Button
                variant="ghost"
                className="h-9"
                onClick={() => {
                  window.location.href = buildShareUrl(profile, "settlement");
                }}
              >
                看完整测算 →
              </Button>
            </div>
          )}
        </div>
      </div>

      {showBar && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-white px-4 py-2.5 pb-[max(0.625rem,env(safe-area-inset-bottom))] lg:hidden">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 text-xs text-muted">
                <span className={`h-1.5 w-1.5 rounded-full ${isRefund ? "bg-good" : isPay ? "bg-danger" : "bg-line"}`} aria-hidden="true" />
                {heroLabel}
              </div>
              <div className="text-lg font-semibold tabular-nums text-ink">{heroValue}</div>
            </div>
            <Button variant="primary" onClick={resultsVisible ? scrollToInputs : scrollToResults} className="h-9 shrink-0">
              {resultsVisible ? "改输入" : "看结果"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
