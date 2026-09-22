"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CITY_PRESETS, bonusSeparateTax, bonusTrapZones, computeAll, getCity, round2, sadMonthly } from "@/lib/tax";
import { fmtMoney } from "@/lib/format";
import { SITE, buildShareUrl } from "@/lib/share";
import { bonusToProfile, buildBonusShareUrl, useBonusInput, wasBonusLoadedFromShare } from "@/lib/bonusStore";
import { exportNodeAsPng, savePng } from "@/lib/exportImage";
import { Button, Details, Field, Hint, NumberInput, Select } from "./ui";

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

  const exportRef = useRef<HTMLDivElement>(null);
  const inputsRef = useRef<HTMLDivElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);
  const [resultsVisible, setResultsVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [scriptCopied, setScriptCopied] = useState(false);
  const hasBonus = b !== null;

  useEffect(() => {
    if (!hasBonus) return;
    const el = resultsRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const obs = new IntersectionObserver(([entry]) => setResultsVisible(entry.isIntersecting), { threshold: 0.15 });
    obs.observe(el);
    return () => obs.disconnect();
  }, [hasBonus]);

  const today = new Date();
  const dateText = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  const host = typeof window !== "undefined" ? window.location.host : new URL(SITE).host;
  const isMobile = typeof navigator !== "undefined" && /iPhone|iPad|Android|MicroMessenger/i.test(navigator.userAgent);

  // 到手：单独 = 奖金 − 奖金单独计税的税；并入 = 奖金 − 合并后因奖金多出来的税
  const sepNet = b ? round2(b.bonus - b.separate.bonusTax) : 0;
  const comNet = b ? round2(b.bonus - (b.combined.total - b.separate.comprehensiveTax)) : 0;
  const bestName = b?.recommended === "combined" ? "并入综合所得" : "单独计税";
  const bestNet = b?.recommended === "combined" ? comNet : sepNet;
  const nextLower = b ? rows.find((z) => z.lower > b.bonus)?.lower : undefined;

  const trap = b?.trap;
  const split = b?.optimalSplit;
  const scriptText = b
    ? [
        split && split.saving > 1
          ? `总包不变的话，年终奖定为 ${fmtMoney(split.bestBonus)}、其余并进月薪，全年个税能少 ${fmtMoney(split.saving)}。`
          : `我的月薪和年终奖 ${fmtMoney(b.bonus)} 的拆分已经是最省的，不用调。`,
        b.trap
          ? `现在的 ${fmtMoney(b.bonus)} 落在「陷阱区间」${fmtMoney(b.trap.lower)}–${fmtMoney(b.trap.upper)}：发 ${fmtMoney(b.trap.lower)} 我到手反而多 ${fmtMoney(b.trap.extraTax)}，多出来的部分并进月薪就行。`
          : "",
        "这只是发放口径的调整，公司总成本不变；计税方式我在汇算清缴时自己选。",
      ]
        .filter(Boolean)
        .join("\n")
    : "";

  const exportPng = async () => {
    if (!exportRef.current || busy) return;
    setBusy(true);
    try {
      const png = await exportNodeAsPng(exportRef.current, { fileName: `年终奖测算-${dateText}.png`, background: "#f6f5f2" });
      if (isMobile) setImageUrl(png);
      else savePng(png, `年终奖测算-${dateText}.png`);
    } catch (err) {
      console.error(err);
      alert("导出图片失败，可以改用「复制链接」分享。");
    } finally {
      setBusy(false);
    }
  };

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

  return (
    <div className={`mx-auto max-w-6xl px-4 pt-4 sm:px-6 ${hasBonus ? "pb-24 lg:pb-10" : "pb-10"}`}>
      {wasBonusLoadedFromShare() && (
        <p className="mb-4 rounded-xl border border-accent/30 bg-accent/10 px-4 py-2.5 text-sm text-ink">
          已按分享的数字预填，改成你自己的即可。
        </p>
      )}

      {imageUrl && (
        <div className="fixed inset-0 z-[60] flex flex-col items-center justify-center bg-ink/80 p-4" onClick={() => setImageUrl(null)}>
          <p className="mb-3 text-sm font-medium text-white">长按图片保存到相册</p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={imageUrl} alt="年终奖测算" className="max-h-[80vh] w-auto max-w-full rounded-lg shadow-lg" onClick={(e) => e.stopPropagation()} />
          <button type="button" className="mt-3 h-9 rounded-lg bg-white/90 px-4 text-sm text-ink" onClick={() => setImageUrl(null)}>
            关闭
          </button>
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        {/* 输入 */}
        <div className="space-y-3" ref={inputsRef}>
          <div className="rounded-2xl border border-line bg-white p-4">
            <div className="grid grid-cols-2 gap-3">
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
              <Field label="年终奖" hint="按全年一次性奖金计算">
                <NumberInput value={input.bonus} onChange={(bonus) => patch({ bonus })} prefix="¥" step={10000} />
              </Field>
            </div>
            <div className="mt-3">
              <Details summary="更多">
                <div className="grid grid-cols-2 gap-3">
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
            {year} 年口径 · 专项附加扣除沿用首页设置（每月 {fmtMoney(sad)}）。
          </p>
        </div>

        {/* 结果 */}
        <div className="space-y-4 lg:sticky lg:top-6 lg:self-start" id="results" ref={resultsRef}>
          {!b ? (
            <Hint>{input.bonus > 0 ? "先填税前月薪，才能算出并入综合所得后的税。" : "先填年终奖金额，看单独计税还是并入更省。"}</Hint>
          ) : (
            <>
              <div ref={exportRef} className="space-y-3 rounded-2xl bg-paper p-4">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="text-sm font-semibold text-ink">年终奖测算</span>
                  <span className="text-xs text-muted">生成于 {dateText}</span>
                </div>

                {/* 1. 单独 vs 并入 */}
                <div className="grid grid-cols-2 divide-x divide-line overflow-hidden rounded-2xl border border-line bg-white">
                  {(["separate", "combined"] as const).map((k) => {
                    const isBest = b.recommended === k;
                    const net = k === "separate" ? sepNet : comNet;
                    const total = k === "separate" ? b.separate.total : b.combined.total;
                    return (
                      <div key={k} className={`p-3 sm:p-4 ${isBest ? "bg-good/5" : ""}`}>
                        <div className="text-xs text-muted">{k === "separate" ? "单独计税" : "并入综合所得"}</div>
                        <div className="mt-1 text-3xl font-semibold tabular-nums text-ink">{fmtMoney(net)}</div>
                        <div className="mt-0.5 text-xs text-muted">奖金到手</div>
                        <div className="mt-1.5">
                          {isBest ? (
                            <span className="inline-flex items-center rounded-full bg-good px-2 py-0.5 text-xs font-medium text-white">推荐</span>
                          ) : b.saving > 1 ? (
                            <span className="text-xs tabular-nums text-danger-text">多交 {fmtMoney(b.saving)}</span>
                          ) : (
                            <span className="text-xs text-muted">两种差不多</span>
                          )}
                        </div>
                        <div className="mt-1 text-xs tabular-nums text-muted">全年个税 {fmtMoney(total)}</div>
                      </div>
                    );
                  })}
                </div>

                <Hint>
                  {b.saving > 1
                    ? `选「${bestName}」全年少交 ${fmtMoney(b.saving)}，汇算清缴时在个税 App 里可以自行切换。`
                    : "两种计税方式差不多，汇算清缴时在个税 App 里可以自行切换。"}
                </Hint>

                <div className="divide-y divide-line rounded-2xl border border-line bg-white">
                  {/* 2. 陷阱检查 */}
                  <div className="p-4">
                    <h3 className="text-sm font-semibold text-ink">陷阱检查</h3>
                    {trap ? (
                      <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-2">
                        <span className="flex items-start gap-2 text-sm leading-relaxed text-ink">
                          <span className="mt-1.5 inline-block h-2 w-2 shrink-0 rounded-full bg-danger" aria-hidden="true" />
                          <span className="tabular-nums">
                            {fmtMoney(b.bonus)} 落在陷阱区间 {fmtMoney(trap.lower)}–{fmtMoney(trap.upper)}：比正好发 {fmtMoney(trap.lower)} 反而少拿{" "}
                            {fmtMoney(trap.extraTax)}。
                          </span>
                        </span>
                        <Button variant="secondary" className="h-9" onClick={() => patch({ bonus: trap.lower })}>
                          按 {fmtMoney(trap.lower)} 重算
                        </Button>
                      </div>
                    ) : (
                      <p className="mt-2 text-sm tabular-nums text-muted">
                        不在陷阱区间。{nextLower ? `下一个跳档点 ${fmtMoney(nextLower)}。` : "已在最高档，没有下一个跳档点。"}
                      </p>
                    )}
                  </div>

                  {/* 3. 拆分建议 */}
                  <div className="p-4">
                    <h3 className="text-sm font-semibold text-ink">拆分建议</h3>
                    <p className="mt-2 text-sm leading-relaxed tabular-nums text-ink">
                      {split && split.saving > 1
                        ? `总现金 ${fmtMoney(split.totalCash)} 不变，年终奖调到 ${fmtMoney(split.bestBonus)}、其余进工资，可再省 ${fmtMoney(split.saving)}。`
                        : "当前拆分已是最省。"}
                    </p>
                  </div>

                  {/* 4. 陷阱区间表 */}
                  <div className="p-4">
                    <h3 className="text-sm font-semibold text-ink">陷阱区间</h3>
                    <div className="mt-2 overflow-x-auto">
                      <table className="w-full min-w-[18rem] text-sm tabular-nums">
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
                            const here = b.bonus > z.lower && b.bonus < z.upper;
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
                    </div>
                  </div>

                  {/* 5. 谈判话术 */}
                  <div className="p-4">
                    <Details summary="怎么和 HR 说">
                      <div className="space-y-2">
                        {scriptText.split("\n").map((line) => (
                          <p key={line} className="text-sm leading-relaxed tabular-nums text-ink">
                            {line}
                          </p>
                        ))}
                        <Button variant="secondary" className="h-9" onClick={() => copyText(scriptText, setScriptCopied)}>
                          {scriptCopied ? "已复制" : "复制话术"}
                        </Button>
                      </div>
                    </Details>
                  </div>
                </div>

                <p className="text-xs leading-relaxed text-muted">
                  {year} 年口径 · 专项附加扣除每月 {fmtMoney(sad)} · 算你自己的：{host}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Button variant="primary" className="h-9" onClick={exportPng}>
                  {busy ? "生成中…" : "分享"}
                </Button>
                <Button variant="secondary" className="h-9" onClick={() => copyText(buildBonusShareUrl(input), setCopied)}>
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
            </>
          )}
        </div>
      </div>

      {b && !imageUrl && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-white px-4 py-2.5 pb-[max(0.625rem,env(safe-area-inset-bottom))] lg:hidden">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="truncate text-xs text-muted">推荐：{bestName}</div>
              <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                <span className="text-lg font-semibold tabular-nums text-ink">{fmtMoney(bestNet)}</span>
                {b.saving > 1 && <span className="text-xs tabular-nums text-good-text">少交 {fmtMoney(b.saving)}</span>}
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
