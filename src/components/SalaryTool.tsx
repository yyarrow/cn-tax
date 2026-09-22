"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { CITY_PRESETS, MONTH_NAMES, computeAll, getCity, sadMonthly } from "@/lib/tax";
import { fmtMoney } from "@/lib/format";
import { SITE, buildShareUrl } from "@/lib/share";
import { SALARY_SEGMENT_ID, buildSalaryShareUrl, salaryProfile, useSalary, type SalaryMode } from "@/lib/salaryStore";
import { exportNodeAsPng, savePng } from "@/lib/exportImage";
import { Button, Card, Details, Field, Hint, MonthSelect, NumberInput, Segmented, Select } from "./ui";

const MODES: { value: SalaryMode; label: string }[] = [
  { value: "net", label: "算到手" },
  { value: "infer", label: "反推五险一金" },
];

/** 比例文案：8% / 0.2% / 12%，不带多余的 0 */
function ratePct(r: number): string {
  return `${+(r * 100).toFixed(2)}%`;
}

/** 到手金额换成万元，格子里只放数字 */
function toWan(v: number): string {
  return (v / 10000).toFixed(1);
}

function DangerNote({ children }: { children: ReactNode }) {
  return (
    <p className="flex items-start gap-2 px-1 text-xs leading-relaxed text-danger-text">
      <span className="mt-1.5 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-danger-text" aria-hidden="true" />
      <span>{children}</span>
    </p>
  );
}

function BreakRow({ label, sub, value, bold = false }: { label: ReactNode; sub?: ReactNode; value: ReactNode; bold?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-2.5">
      <div className="min-w-0">
        <div className={bold ? "text-sm font-semibold text-ink" : "text-sm text-ink"}>{label}</div>
        {sub && <div className="mt-0.5 text-xs tabular-nums text-muted">{sub}</div>}
      </div>
      <div className={bold ? "shrink-0 text-base font-semibold tabular-nums text-ink" : "shrink-0 text-sm tabular-nums text-ink"}>{value}</div>
    </div>
  );
}

export function SalaryTool() {
  const { input, patch, year, deductions, fromShare } = useSalary();
  const city = getCity(input.cityId);
  const sad = sadMonthly(deductions);

  const profile = useMemo(() => salaryProfile(input, year, deductions), [input, year, deductions]);
  const result = useMemo(() => computeAll(profile, 12), [profile]);
  const row = result.rows[input.month - 1];
  const resolved = result.socials[SALARY_SEGMENT_ID];
  const breakdown = resolved?.breakdown;
  const inferring = input.mode === "infer";
  const ready = input.monthlySalary > 0 && (!inferring || (input.netAmount ?? 0) > 0);

  const exportRef = useRef<HTMLElement>(null);
  const inputsRef = useRef<HTMLDivElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);
  const [resultsVisible, setResultsVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!ready) return;
    const el = resultsRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const obs = new IntersectionObserver(([entry]) => setResultsVisible(entry.isIntersecting), { threshold: 0.15 });
    obs.observe(el);
    return () => obs.disconnect();
  }, [ready]);

  const today = new Date();
  const dateText = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  const host = typeof window !== "undefined" ? window.location.host : new URL(SITE).host;
  const isMobile = typeof navigator !== "undefined" && /iPhone|iPad|Android|MicroMessenger/i.test(navigator.userAgent);
  const monthName = MONTH_NAMES[input.month - 1];

  const exportPng = async () => {
    if (!exportRef.current || busy) return;
    setBusy(true);
    try {
      const file = `税后工资-${monthName}-${dateText}.png`;
      const png = await exportNodeAsPng(exportRef.current, { fileName: file, background: "#ffffff" });
      if (isMobile) setImageUrl(png);
      else savePng(png, file);
    } catch (err) {
      console.error(err);
      alert("导出图片失败，可以改用「复制链接」分享。");
    } finally {
      setBusy(false);
    }
  };

  const copyLink = async () => {
    const url = buildSalaryShareUrl(input);
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

  const housingPct = Math.round(input.housingRate * 1000) / 10;

  return (
    <div className={`mx-auto max-w-6xl px-4 pt-4 sm:px-6 ${ready ? "pb-24 lg:pb-10" : "pb-10"}`}>
      {fromShare && (
        <p className="mb-4 rounded-xl border border-accent/30 bg-accent/10 px-4 py-2.5 text-sm text-ink">
          已按分享的数字预填，改成你自己的即可。
        </p>
      )}

      {imageUrl && (
        <div className="fixed inset-0 z-[60] flex flex-col items-center justify-center bg-ink/80 p-4" onClick={() => setImageUrl(null)}>
          <p className="mb-3 text-sm font-medium text-white">长按图片保存到相册</p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={imageUrl} alt="税后工资拆分" className="max-h-[80vh] w-auto max-w-full rounded-lg shadow-lg" onClick={(e) => e.stopPropagation()} />
          <button type="button" className="mt-3 h-9 rounded-lg bg-white/90 px-4 text-sm text-ink" onClick={() => setImageUrl(null)}>
            关闭
          </button>
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        {/* 输入 */}
        <div className="space-y-3" ref={inputsRef}>
          <div className="rounded-2xl border border-line bg-white p-4">
            <Segmented value={input.mode} options={MODES} onChange={(mode) => patch({ mode })} />

            <div className="mt-3 grid grid-cols-2 gap-3">
              <Field label="城市">
                <Select value={input.cityId} onChange={(e) => patch({ cityId: e.target.value })}>
                  {CITY_PRESETS.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="税前月薪">
                <NumberInput value={input.monthlySalary} onChange={(monthlySalary) => patch({ monthlySalary })} prefix="¥" step={1000} />
              </Field>
              <Field label="月份" hint="个税按累计预扣，同一月薪每个月扣税不同" className="col-span-2">
                <MonthSelect value={input.month} min={input.startMonth} onChange={(month) => patch({ month })} />
              </Field>

              {inferring && (
                <>
                  <Field label="税后到手" hint="这个月工资卡实收">
                    <NumberInput value={input.netAmount} placeholder="必填" prefix="¥" step={500} onChange={(netAmount) => patch({ netAmount })} />
                  </Field>
                  <Field label="工资条个税" hint="填了就直接相减，不用猜">
                    <NumberInput value={input.netTax} placeholder="可选" prefix="¥" step={100} onChange={(netTax) => patch({ netTax })} />
                  </Field>
                </>
              )}
            </div>

            <div className="mt-3">
              <Details summary="更多">
                <div className="grid grid-cols-2 gap-3">
                  <Field label="公积金比例" hint={`${city.name} 常见 ${(city.housingRateDefault * 100).toFixed(0)}%`}>
                    <NumberInput value={housingPct} onChange={(v) => patch({ housingRate: Math.min(20, Math.max(0, v)) / 100 })} max={20} suffix="%" step={1} />
                  </Field>
                  <Field label="入职月份" hint="今年在本公司从哪个月开始">
                    <MonthSelect value={input.startMonth} onChange={(startMonth) => patch({ startMonth })} />
                  </Field>
                </div>
              </Details>
            </div>
          </div>

          <p className="text-xs leading-relaxed text-muted">
            {year} 年口径 · 专项附加扣除沿用首页设置（每月 {fmtMoney(sad)}）。
          </p>
        </div>

        {/* 结果 */}
        <div className="space-y-4 lg:sticky lg:top-6 lg:self-start" id="results" ref={resultsRef}>
          <Card
            ref={exportRef}
            title={`税后工资 · ${year} 年 ${input.month} 月`}
            action={<span className="text-xs text-muted">生成于 {dateText}</span>}
          >
            <div className="divide-y divide-line">
              {/* 1. 到手 */}
              <section className="pb-4">
                <div className="rounded-xl bg-ink px-5 py-4 text-white">
                  <div className="text-xs text-white/70">{monthName}到手</div>
                  <div className="mt-1 text-4xl font-semibold tabular-nums">{ready ? fmtMoney(row.net) : "—"}</div>
                  <div className="mt-2 text-xs leading-relaxed tabular-nums text-white/70">
                    {ready
                      ? `税前 ${fmtMoney(row.gross)} → 五险一金 −${fmtMoney(row.social)} → 个税 −${fmtMoney(row.tax + row.bonusTax)}`
                      : "税前 — → 五险一金 — → 个税 —"}
                  </div>
                </div>
                {!ready && (
                  <p className="mt-3 text-sm leading-relaxed text-muted">
                    {inferring ? "填上税前月薪和这个月的税后到手，这里会反推出你的五险一金和个税。" : "填上税前月薪，这里会显示这个月的到手和每一项扣款。"}
                  </p>
                )}
              </section>

              {/* 2. 拆分 */}
              <section className="py-4">
                <h3 className="text-sm font-semibold text-ink">这个月怎么扣的</h3>
                <div className="mt-1 divide-y divide-line">
                  {breakdown && ready ? (
                    <>
                      <BreakRow label="养老" sub={`${ratePct(city.pensionRate)} × 基数 ${fmtMoney(breakdown.socialBase)}`} value={`−${fmtMoney(breakdown.pension)}`} />
                      <BreakRow
                        label="医疗"
                        sub={`${ratePct(city.medicalRate)} × 基数 ${fmtMoney(breakdown.socialBase)}${city.medicalFixed ? ` ＋ ${fmtMoney(city.medicalFixed)}` : ""}`}
                        value={`−${fmtMoney(breakdown.medical)}`}
                      />
                      <BreakRow label="失业" sub={`${ratePct(city.unemploymentRate)} × 基数 ${fmtMoney(breakdown.socialBase)}`} value={`−${fmtMoney(breakdown.unemployment)}`} />
                      <BreakRow
                        label={breakdown.supplementaryHousing > 0 ? "公积金（含补充）" : "公积金"}
                        sub={`${ratePct(input.housingRate)} × 基数 ${fmtMoney(breakdown.housingBase)}`}
                        value={`−${fmtMoney(breakdown.housing + breakdown.supplementaryHousing)}`}
                      />
                    </>
                  ) : !ready ? (
                    <>
                      <BreakRow label="养老" sub={`${ratePct(city.pensionRate)} × 基数 —`} value="—" />
                      <BreakRow label="医疗" sub={`${ratePct(city.medicalRate)} × 基数 —`} value="—" />
                      <BreakRow label="失业" sub={`${ratePct(city.unemploymentRate)} × 基数 —`} value="—" />
                      <BreakRow label="公积金" sub={`${ratePct(input.housingRate)} × 基数 —`} value="—" />
                    </>
                  ) : (
                    <BreakRow label="五险一金合计" sub={resolved?.note || "由到手反推"} value={`−${fmtMoney(row.social)}`} />
                  )}
                  <BreakRow label="个税" sub={ready ? `当月预扣率 ${Math.round(row.rate * 100)}%` : "当月预扣率 —"} value={ready ? `−${fmtMoney(row.tax + row.bonusTax)}` : "—"} />
                  <BreakRow label="到手" value={ready ? fmtMoney(row.net) : "—"} bold />
                </div>
                {ready && !breakdown && resolved?.sample && (
                  <p className="mt-2 text-xs leading-relaxed tabular-nums text-muted">
                    {MONTH_NAMES[resolved.sample.month - 1]}：税前 {fmtMoney(resolved.sample.gross)} − 五险一金{" "}
                    <b className="font-semibold text-ink">{fmtMoney(resolved.sample.social)}</b> − 个税{" "}
                    <b className="font-semibold text-ink">{fmtMoney(resolved.sample.tax)}</b> = 到手 {fmtMoney(resolved.sample.net)}
                  </p>
                )}
              </section>

              {/* 3. 全年一览 */}
              <section className="py-4">
                <h3 className="text-sm font-semibold text-ink">全年一览</h3>
                <div className="pb-2 pt-1 text-xs text-muted">上排到手（万元）、下排预扣率（%）</div>
                <div className="grid grid-cols-12 gap-1">
                  {result.rows.map((r) => {
                    const on = r.month === input.month;
                    const blank = !ready || r.isGap;
                    return (
                      <button
                        key={r.month}
                        type="button"
                        onClick={() => patch({ month: r.month })}
                        disabled={r.isGap}
                        title={
                          blank
                            ? r.isGap
                              ? `${MONTH_NAMES[r.month - 1]}：未入职`
                              : MONTH_NAMES[r.month - 1]
                            : `${MONTH_NAMES[r.month - 1]}：到手 ${fmtMoney(r.net)} · 预扣率 ${Math.round(r.rate * 100)}%`
                        }
                        className={`flex flex-col items-center gap-0.5 rounded-md border px-0 py-1 leading-tight tracking-tight transition ${
                          on ? "border-accent/50 bg-accent/10" : "border-transparent bg-paper hover:border-line"
                        } ${r.isGap ? "opacity-50" : ""}`}
                      >
                        <span className={`text-xs tabular-nums ${on ? "text-accent-text" : "text-muted"}`}>{r.month}</span>
                        <span className={`text-xs font-semibold tabular-nums ${on ? "text-accent-text" : "text-ink"}`}>
                          {blank ? "—" : toWan(r.net)}
                          {!blank && <span className="hidden font-normal sm:inline">万</span>}
                        </span>
                        <span className="text-xs tabular-nums text-muted">{blank ? "—" : Math.round(r.rate * 100)}</span>
                      </button>
                    );
                  })}
                </div>
                <p className="mt-2 text-xs leading-relaxed tabular-nums text-muted">
                  {ready
                    ? `全年到手 ${fmtMoney(result.annual.netTotal)} · 五险一金 ${fmtMoney(result.annual.totalSocial)} · 个税 ${fmtMoney(result.annual.totalTax)}`
                    : "全年到手 — · 五险一金 — · 个税 —"}
                </p>
              </section>

              {/* 4. 反推口径 */}
              {inferring && (
                <section className="space-y-2 py-4">
                  {ready ? (
                    <>
                      <Hint>
                        反推口径：五险一金 = 税前 {fmtMoney(row.gross)} − 到手 {fmtMoney(input.netAmount ?? 0)} − 当月个税 {fmtMoney(row.tax + row.bonusTax)}。
                        {input.netTax === undefined && "没填工资条个税时，个税按累计预扣法解出来，请用一个没有奖金、补贴的普通月份。"}
                        {resolved?.inferredHousingRate !== undefined && `反推出的公积金比例约 ${(resolved.inferredHousingRate * 100).toFixed(0)}%。`}
                      </Hint>
                      {resolved?.source === "inferFailed" && (
                        <DangerNote>
                          反推没成功{resolved.note ? `：${resolved.note}` : ""}。上面先按{city.name}参考值估算。
                        </DangerNote>
                      )}
                      {resolved?.warning && <DangerNote>{resolved.warning}</DangerNote>}
                    </>
                  ) : (
                    <p className="text-sm leading-relaxed text-muted">填上税前月薪和这个月的税后到手，这里会写清反推用的口径。</p>
                  )}
                </section>
              )}

              <p className="pt-4 text-xs leading-relaxed text-muted">
                {city.name} {year} 年参考基数 · 专项附加扣除每月 {fmtMoney(sad)} · 算你自己的：{host}
              </p>
            </div>
          </Card>

          {ready && (
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
                  window.location.href = buildShareUrl(profile);
                }}
              >
                看完整测算 →
              </Button>
            </div>
          )}
        </div>
      </div>

      {ready && !imageUrl && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-white px-4 py-2.5 pb-[max(0.625rem,env(safe-area-inset-bottom))] lg:hidden">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="truncate text-xs text-muted">{monthName}到手</div>
              <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                <span className="text-lg font-semibold tabular-nums text-ink">{fmtMoney(row.net)}</span>
                <span className="text-xs tabular-nums text-muted">五险一金 {fmtMoney(row.social)}</span>
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
