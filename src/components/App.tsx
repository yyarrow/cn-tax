"use client";

import { useMemo, useState } from "react";
import { CITY_PRESETS, computeAll, getCity } from "@/lib/tax";
import { currentMonthFor, useProfile } from "@/lib/store";
import { Button, Card, Field, Hint, NumberInput, Select } from "./ui";
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
  const { profile, ready, patch, patchSegment, removeSegment, addSegment, patchDeductions, reset } = useProfile();
  const currentMonth = currentMonthFor(profile.year);
  const result = useMemo(() => computeAll(profile, currentMonth), [profile, currentMonth]);
  const city = getCity(profile.cityId);
  const hasIncome = profile.segments.some((s) => s.monthlySalary > 0);
  const [showReport, setShowReport] = useState(false);

  return (
    <div className={`app-root mx-auto max-w-6xl px-4 pb-10 pt-4 transition-opacity sm:px-6 ${ready ? "opacity-100" : "opacity-0"}`}>
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

      <div className="grid gap-5 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        {/* 输入列 */}
        <div className="space-y-5">
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
            {city.note && <p className="mt-3 text-[11px] text-muted">{city.note}</p>}
          </Card>

          <Card title="2 · 专项附加扣除" subtitle="没申报的项目会进减税建议。">
            <DeductionsEditor d={profile.deductions} onChange={patchDeductions} />
          </Card>

          <Card title="3 · 期权 / RSU（可选）" subtitle="选计税方式，填今年已兑现金额。">
            <EquityEditor plan={profile.equity} onChange={(equity) => patch({ equity })} />
          </Card>
        </div>

        {/* 结果列 */}
        <div className="space-y-5 lg:sticky lg:top-6 lg:self-start">
          {!hasIncome ? (
            <Card>
              <Hint>先在左侧填一段工作和税前月薪。</Hint>
            </Card>
          ) : (
            <>
              <Card title={`${profile.year} 年全年测算`} subtitle={currentMonth > 0 && currentMonth < 12 ? `${currentMonth} 月前按实际，之后为预测。` : undefined}>
                <Summary a={result.annual} />
              </Card>

              <Card title="逐月明细" subtitle="每月到手、扣款，以及预扣税率何时跳档。">
                <MonthlyChart rows={result.rows} currentMonth={currentMonth} />
              </Card>

              {result.bonus && (
                <Card title="年终奖怎么算最省">
                  <BonusPanel b={result.bonus} mode={profile.bonusMode} onMode={(bonusMode) => patch({ bonusMode })} bonusSeparate={result.bonusSeparate} />
                </Card>
              )}

              {profile.equity.taxMode !== "unlisted" || result.equity.income > 0 ? (
                <Card title="期权 / RSU 兑现规划" subtitle="今年再兑现不同金额各要交多少税，橙点为跳档拐点。">
                  <EquityChart e={result.equity} plan={profile.equity} onChange={(equity) => patch({ equity })} />
                </Card>
              ) : null}

              <Card title="减税建议" subtitle="按预计节省排序，均为合规操作。">
                <AdviceList items={result.advice} />
              </Card>
            </>
          )}
        </div>
      </div>

    </div>
  );
}
