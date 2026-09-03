"use client";

import { useMemo } from "react";
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

export function App() {
  const { profile, ready, patch, patchSegment, removeSegment, addSegment, patchDeductions, reset } = useProfile();
  const currentMonth = currentMonthFor(profile.year);
  const result = useMemo(() => computeAll(profile, currentMonth), [profile, currentMonth]);
  const city = getCity(profile.cityId);
  const hasIncome = profile.segments.some((s) => s.monthlySalary > 0);

  return (
    <div className={`mx-auto max-w-6xl px-4 pb-16 pt-6 transition-opacity sm:px-6 ${ready ? "opacity-100" : "opacity-0"}`}>
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink">个税规划器</h1>
          <p className="mt-1 text-sm text-muted">填工作经历和工资，算清今年到底交多少税、汇算退不退、年终奖和期权怎么拿最省。数据只存在你的浏览器里。</p>
        </div>
        <div className="flex items-end gap-2">
          <Field label="纳税年度">
            <NumberInput value={profile.year} onChange={(year) => patch({ year: Math.round(year) })} className="w-24" min={2019} />
          </Field>
          <Field label="工作城市" hint="决定社保/公积金参考基数">
            <Select value={profile.cityId} onChange={(e) => patch({ cityId: e.target.value })} className="w-32">
              {CITY_PRESETS.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </Field>
          <Button variant="ghost" onClick={() => confirm("清空所有输入，恢复默认？") && reset()} className="mb-4">
            重置
          </Button>
        </div>
      </header>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        {/* 输入列 */}
        <div className="space-y-5">
          <Card title="1 · 工作经历" subtitle="按时间段填税前月薪；没覆盖到的月份就是空档。换过工作就加一段。" action={<Button onClick={addSegment}>＋ 加一段</Button>}>
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

          <Card title="2 · 专项附加扣除" subtitle="按全年申报情况填，没申报的项目会出现在减税建议里。">
            <DeductionsEditor d={profile.deductions} onChange={patchDeductions} />
          </Card>

          <Card title="3 · 期权 / RSU（可选）" subtitle="先选计税方式，再填今年已兑现的金额。">
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
              <Card title={`${profile.year} 年全年测算`} subtitle={currentMonth > 0 && currentMonth < 12 ? `${currentMonth} 月及之前按实际，之后按当前设置预测。` : undefined}>
                <Summary a={result.annual} />
              </Card>

              <Card title="逐月明细" subtitle="每个月工资到手多少、被扣多少，以及预扣税率什么时候跳档。">
                <MonthlyChart rows={result.rows} currentMonth={currentMonth} />
              </Card>

              {result.bonus && (
                <Card title="年终奖怎么算最省">
                  <BonusPanel b={result.bonus} mode={profile.bonusMode} onMode={(bonusMode) => patch({ bonusMode })} bonusSeparate={result.bonusSeparate} />
                </Card>
              )}

              {profile.equity.taxMode !== "unlisted" || result.equity.income > 0 ? (
                <Card title="期权 / RSU 兑现规划" subtitle="在现有收入基础上，今年再兑现不同金额各要交多少税；橙点是税率跳档的拐点（甜点值）。">
                  <EquityChart e={result.equity} plan={profile.equity} onChange={(equity) => patch({ equity })} />
                </Card>
              ) : null}

              <Card title="减税建议" subtitle="按预计节省金额排序，都是合法合规的常规操作。">
                <AdviceList items={result.advice} />
              </Card>
            </>
          )}
        </div>
      </div>

      <footer className="mt-10 space-y-1 text-[11px] leading-relaxed text-muted">
        <p>口径：综合所得 7 级超额累进税率；预扣预缴按累计预扣法（减除费用 5000 元/月 × 本单位任职月数）；汇算清缴按全年 6 万元减除 + 全年专项附加扣除。年终奖单独计税、上市公司股权激励单独计税政策均执行至 2027-12-31。</p>
        <p>社保、公积金基数上下限按各城市 2026 年度公布值取参考，每年 7 月前后调整；实际以工资条为准。本工具仅供测算参考，不构成税务建议。</p>
      </footer>
    </div>
  );
}
