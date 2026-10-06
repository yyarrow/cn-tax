"use client";

import { ExampleHint } from "./ExampleHint";
import { useEffect, useMemo, useRef, useState } from "react";
import { CITY_PRESETS, computeAll, getCity } from "@/lib/tax";
import { currentMonthFor, useProfile } from "@/lib/store";
import { fmtMoney } from "@/lib/format";
import { Button, Card, Field, Hint, NumberInput, Select, Details } from "./ui";
import { Timeline } from "./Timeline";
import { SegmentEditor } from "./SegmentEditor";
import { DeductionsEditor } from "./DeductionsEditor";
import { EquityEditor } from "./EquityEditor";
import { Summary } from "./Summary";
import { MonthlyChart } from "./MonthlyChart";
import { BonusPanel } from "./BonusPanel";
import { EquityChart } from "./EquityChart";
import { AdviceList } from "./AdviceList";
import { Report } from "./Report";

export function App() {
  const { profile, ready, preview, keepPreview, discardPreview, patch, patchSegment, removeSegment, addSegment, patchDeductions, reset } = useProfile();
  const currentMonth = currentMonthFor(profile.year);
  const result = useMemo(() => computeAll(profile, currentMonth), [profile, currentMonth]);
  const city = getCity(profile.cityId);
  const hasIncome = profile.segments.some((s) => s.monthlySalary > 0);
  const [showReport, setShowReport] = useState(false);
  const [equityExpanded, setEquityExpanded] = useState(false);
  const hasEquityActivity = profile.equity.events.length > 0 || (profile.equity.plannedExtra ?? 0) > 0;
  const showEquityCard = profile.equity.taxMode !== "unlisted" || result.equity.income > 0;

  const inputsRef = useRef<HTMLDivElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);
  const [resultsVisible, setResultsVisible] = useState(false);
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

  const settlement = result.annual.settlement;
  const settlementDot = settlement < -0.5 ? "bg-good" : settlement > 0.5 ? "bg-danger" : "bg-line";
  const settlementText = settlement < -0.5 ? `退税 +${fmtMoney(-settlement)}` : settlement > 0.5 ? `补税 ${fmtMoney(settlement)}` : "无退补";
  const showBar = hasIncome && !showReport;

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
      {showReport && hasIncome && <Report profile={profile} result={result} currentMonth={currentMonth} onClose={() => setShowReport(false)} />}
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
        <Button variant="primary" onClick={() => setShowReport(true)} className="mt-5 h-9">
          分享报告
        </Button>
        <Button variant="ghost" onClick={() => confirm("清空所有输入，恢复默认？") && reset()} className="mt-5 h-9">
          重置
        </Button>
      </div>

      <ExampleHint storageKeys={["cn-tax-profile-v1"]} enabled={!preview} />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        {/* 输入列 */}
        <div className="min-w-0 space-y-5" ref={inputsRef}>
          <Card title="1 · 工作经历" subtitle="按段填税前月薪，没覆盖的月份即空档。" action={<Button onClick={addSegment}>＋ 加一段</Button>}>
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

          <Card id="deductions" className="scroll-mt-6" title="2 · 专项附加扣除" subtitle="填写符合条件的扣除项目。">
            <DeductionsEditor d={profile.deductions} onChange={patchDeductions} />
          </Card>

          <Card title="3 · 期权 / RSU（可选）" subtitle="选计税方式，填今年已兑现金额。">
            <Details summary="填写股权激励收入" open={hasEquityActivity}>
              <EquityEditor plan={profile.equity} onChange={(equity) => patch({ equity })} />
            </Details>
          </Card>
        </div>

        {/* 结果列 */}
        <div className="min-w-0 space-y-5 lg:sticky lg:top-6 lg:self-start" id="results" ref={resultsRef}>
          <>
              <Card title={`${profile.year} 年全年测算`} subtitle={currentMonth > 0 && currentMonth < 12 ? `按已填收入估算，${currentMonth + 1}–12 月为预测。` : undefined}>
                {!hasIncome && <Hint>先在左侧填一段工作和税前月薪，下面的数字会实时更新。</Hint>}
                <div className={hasIncome ? "" : "mt-3"}>
                  <Summary a={result.annual} />
                </div>
              </Card>

              <Card title="逐月明细" subtitle="每月到手、扣款，以及预扣税率何时跳档。">
                <MonthlyChart rows={result.rows} currentMonth={currentMonth} />
              </Card>

              {result.bonus && (
                <Card title="年终奖怎么算最省">
                  <BonusPanel b={result.bonus} mode={profile.bonusMode} onMode={(bonusMode) => patch({ bonusMode })} bonusSeparate={result.bonusSeparate} />
                </Card>
              )}

              {showEquityCard ? (
                hasEquityActivity || equityExpanded ? (
                  <Card
                    title="期权 / RSU 兑现规划"
                    subtitle="今年再兑现不同金额各要交多少税，橙点为跳档拐点。"
                    action={
                      !hasEquityActivity ? (
                        <Button variant="ghost" onClick={() => setEquityExpanded(false)}>
                          收起
                        </Button>
                      ) : undefined
                    }
                  >
                    <EquityChart e={result.equity} plan={profile.equity} onChange={(equity) => patch({ equity })} />
                  </Card>
                ) : (
                  <Card>
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-sm font-medium text-ink">期权 / RSU 兑现规划</span>
                      <Button variant="ghost" onClick={() => setEquityExpanded(true)}>
                        展开
                      </Button>
                    </div>
                  </Card>
                )
              ) : null}

              <Card title="减税建议" subtitle="按预计节省排序，均为合规操作。">
                <AdviceList items={result.advice} />
              </Card>
          </>
        </div>
      </div>

      {showBar && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-white px-4 py-2.5 pb-[max(0.625rem,env(safe-area-inset-bottom))] lg:hidden">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="text-xs text-muted">全年到手</div>
              <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                <span className="text-lg font-semibold tabular-nums text-ink">{fmtMoney(result.annual.netTotal)}</span>
                <span className="inline-flex items-center gap-1 text-xs text-muted">
                  <span className={`h-1.5 w-1.5 rounded-full ${settlementDot}`} />
                  {settlementText}
                </span>
              </div>
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
