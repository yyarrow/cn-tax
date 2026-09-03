"use client";

import { MONTH_NAMES, getCity, type ResolvedSocial, type Segment, type SocialConfig } from "@/lib/tax";
import { salaryFor } from "@/lib/tax/withholding";
import { fmtMoney } from "@/lib/format";
import { Button, Details, Field, MonthSelect, NumberInput, TextInput } from "./ui";
import { segmentColor } from "./Timeline";

export function SegmentEditor({
  seg,
  index,
  cityId,
  resolved,
  onChange,
  onRemove,
  canRemove,
}: {
  seg: Segment;
  index: number;
  cityId: string;
  resolved?: ResolvedSocial;
  onChange: (p: Partial<Segment>) => void;
  onRemove: () => void;
  canRemove: boolean;
}) {
  const city = getCity(cityId);
  const social = seg.social;
  const patchSocial = (p: Partial<SocialConfig>) => onChange({ social: { ...social, ...p } });
  const months = seg.endMonth - seg.startMonth + 1;
  const hasSample = !!seg.netSample;
  const monthsInSegment = Array.from({ length: months }, (_, i) => seg.startMonth + i);
  const overrideCount = monthsInSegment.filter((m) => seg.monthOverrides?.[m] !== undefined || seg.socialOverrides?.[m] !== undefined).length;
  const negativeMonths = monthsInSegment.filter((m) => salaryFor(seg, m) - (seg.socialOverrides?.[m] ?? resolved?.monthly ?? 0) < 0);

  const sourceLabel = {
    preset: `按${city.name}参考值估算（公积金 ${((social.housingRate ?? city.housingRateDefault) * 100).toFixed(0)}%）`,
    inferred: "",
    manual: "手动设置",
    inferFailed: "反推失败，改用参考值估算",
  }[resolved?.source ?? "preset"];

  return (
    <div className="rounded-xl border border-line bg-white p-4">
      <div className="mb-3 flex items-center gap-2">
        <i className="h-3 w-3 shrink-0 rounded-sm" style={{ background: segmentColor(index) }} />
        <TextInput value={seg.name} onChange={(name) => onChange({ name })} placeholder={`公司 / 工作 ${index + 1}`} className="max-w-[200px]" />
        <span className="ml-auto whitespace-nowrap text-xs text-muted">{months} 个月</span>
        {canRemove && (
          <Button variant="danger" onClick={onRemove} className="h-7 px-2">
            删除
          </Button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Field label="开始">
          <MonthSelect value={seg.startMonth} onChange={(m) => onChange({ startMonth: m, endMonth: Math.max(m, seg.endMonth) })} />
        </Field>
        <Field label="结束">
          <MonthSelect value={seg.endMonth} min={seg.startMonth} onChange={(m) => onChange({ endMonth: m })} />
        </Field>
        <Field label="税前月薪" className="col-span-2">
          <NumberInput value={seg.monthlySalary} onChange={(monthlySalary) => onChange({ monthlySalary })} prefix="¥" step={1000} />
        </Field>
      </div>

      <div className="mt-2">
        <Details summary={overrideCount > 0 ? `个别月份工资不同（已改 ${overrideCount} 个月）` : "个别月份工资不同？（试用期 / 请假 / 月中入职）"} open={overrideCount > 0}>
          <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
            {monthsInSegment.map((m) => {
              const hasOverride = seg.monthOverrides?.[m] !== undefined || seg.socialOverrides?.[m] !== undefined;
              const socialNormal = resolved?.monthly ?? 0;
              const socialThis = seg.socialOverrides?.[m] ?? socialNormal;
              const negative = hasOverride && salaryFor(seg, m) - socialThis < 0;
              return (
                <div key={m} className="flex flex-col gap-1">
                  <span className="text-xs font-medium text-muted">{MONTH_NAMES[m - 1]}</span>
                  <NumberInput
                    dense
                    value={seg.monthOverrides?.[m]}
                    placeholder={String(seg.monthlySalary)}
                    step={1000}
                    onChange={(v) => {
                      const next = { ...(seg.monthOverrides ?? {}) };
                      if (v > 0 && Math.abs(v - seg.monthlySalary) > 0.5) next[m] = v;
                      else delete next[m];
                      onChange({ monthOverrides: next });
                    }}
                  />
                  {hasOverride && (
                    <>
                      <span className="text-[10px] text-muted">当月五险一金</span>
                      <NumberInput
                        dense
                        value={seg.socialOverrides?.[m]}
                        placeholder={String(Math.round(socialNormal))}
                        step={100}
                        className={negative ? "rounded-lg ring-2 ring-danger/50" : ""}
                        onChange={(v) => {
                          const next = { ...(seg.socialOverrides ?? {}) };
                          if (v >= 0 && Math.abs(v - socialNormal) > 0.5) next[m] = v;
                          else delete next[m];
                          onChange({ socialOverrides: next });
                        }}
                      />
                    </>
                  )}
                </div>
              );
            })}
          </div>
          <p className="mt-2 text-[11px] text-muted">工资留空 = 按正常月薪；五险一金留空 = 按整月扣（社保按月缴，公司通常整月扣）。</p>
          {negativeMonths.length > 0 && (
            <p className="mt-1 text-[11px] text-danger">
              {negativeMonths.map((m) => MONTH_NAMES[m - 1]).join("、")}工资低于整月五险一金，到手为负。如果公司那个月少扣或没扣，请在「当月五险一金」里填实际数。
            </p>
          )}
        </Details>
      </div>

      <div className="mt-3 rounded-lg bg-paper p-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <span className="text-xs text-muted">五险一金个人部分</span>
          <span className="text-sm font-semibold tabular-nums text-ink">{resolved ? `${fmtMoney(resolved.monthly)} / 月` : "—"}</span>
        </div>
        <p className="mt-1 text-[11px] text-muted">
          {[sourceLabel, resolved?.note].filter(Boolean).join("。")}
        </p>
        {resolved?.sample && (
          <p className="mt-1 text-[11px] tabular-nums text-muted">
            {MONTH_NAMES[resolved.sample.month - 1]}：税前 {fmtMoney(resolved.sample.gross)} − 五险一金 <b className="text-ink">{fmtMoney(resolved.sample.social)}</b> − 个税 <b className="text-ink">{fmtMoney(resolved.sample.tax)}</b> = 到手 {fmtMoney(resolved.sample.net)}
          </p>
        )}
        {resolved?.warning && <p className="mt-1 text-[11px] text-danger">{resolved.warning}</p>}
        {resolved?.breakdown && social.mode !== "infer" && (
          <p className="mt-1 text-[11px] text-muted/80">
            养老 {fmtMoney(resolved.breakdown.pension)} · 医疗 {fmtMoney(resolved.breakdown.medical)} · 失业 {fmtMoney(resolved.breakdown.unemployment)} · 公积金 {fmtMoney(resolved.breakdown.housing + resolved.breakdown.supplementaryHousing)}
            {resolved.breakdown.extra ? ` · 其他 ${fmtMoney(resolved.breakdown.extra)}` : ""}
          </p>
        )}

        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-[1.2fr_0.8fr_1fr_auto]">
          <Field label="某个月到手（可选）" hint="用来反推五险一金，选普通月份">
            <NumberInput
              value={seg.netSample?.amount}
              placeholder="税后到手"
              prefix="¥"
              onChange={(amount) =>
                onChange({
                  netSample: { month: seg.netSample?.month ?? Math.min(seg.endMonth, Math.max(seg.startMonth, seg.startMonth + 1)), amount },
                  social: { ...social, mode: amount > 0 ? "infer" : "auto" },
                })
              }
            />
          </Field>
          <Field label="哪个月">
            <MonthSelect
              value={seg.netSample?.month ?? seg.startMonth}
              min={seg.startMonth}
              max={seg.endMonth}
              onChange={(month) => onChange({ netSample: { month, amount: seg.netSample?.amount ?? 0 } })}
            />
          </Field>
          <Field label="工资条上的个税" hint="填了就不用猜，直接相减">
            <NumberInput
              value={seg.netSample?.tax}
              placeholder="可选"
              prefix="¥"
              disabled={!hasSample}
              onChange={(tax) => seg.netSample && onChange({ netSample: { ...seg.netSample, tax: tax > 0 ? tax : tax === 0 ? 0 : undefined } })}
            />
          </Field>
          {hasSample && (
            <div className="flex items-end">
              <Button variant="ghost" onClick={() => onChange({ netSample: undefined, social: { ...social, mode: "auto" } })} className="h-9">
                清除
              </Button>
            </div>
          )}
        </div>

        <div className="mt-3">
          <Details summary={social.mode === "manual" ? "高级设置（手动）" : "高级设置：手动填社保 / 公积金"}>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <Field label="模式" className="col-span-2 sm:col-span-3">
                <div className="flex flex-wrap gap-2 text-xs">
                  {(["auto", "infer", "manual"] as const).map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => patchSocial({ mode: m })}
                      disabled={m === "infer" && !hasSample}
                      className={`rounded-md border px-2 py-1 ${social.mode === m ? "border-accent bg-accent/10 text-accent" : "border-line text-muted"} disabled:opacity-40`}
                    >
                      {m === "auto" ? "按城市参考值" : m === "infer" ? "由到手反推" : "手动填写"}
                    </button>
                  ))}
                </div>
              </Field>
              <Field label="五险一金合计（直接填）" hint="工资条上的个人缴纳合计，填了以下明细不再参与计算" className="col-span-2 sm:col-span-3">
                <NumberInput
                  value={social.totalMonthly}
                  placeholder="元 / 月"
                  prefix="¥"
                  step={100}
                  onChange={(v) => patchSocial(v > 0 ? { totalMonthly: v, mode: "manual" } : { totalMonthly: undefined })}
                />
              </Field>
              <Field label="社保基数" hint={`${city.name}参考 ${city.socialMin}–${city.socialMax}`}>
                <NumberInput value={social.socialBase} placeholder="=月薪(封顶)" onChange={(v) => patchSocial({ socialBase: v || undefined, mode: "manual" })} />
              </Field>
              <Field label="公积金基数" hint={`参考上限 ${city.housingMax}`}>
                <NumberInput value={social.housingBase} placeholder="=月薪(封顶)" onChange={(v) => patchSocial({ housingBase: v || undefined, mode: "manual" })} />
              </Field>
              <Field label="公积金比例">
                <NumberInput value={Math.round((social.housingRate ?? city.housingRateDefault) * 100)} suffix="%" onChange={(v) => patchSocial({ housingRate: v / 100 })} />
              </Field>
              <Field label="补充公积金">
                <NumberInput value={Math.round((social.supplementaryHousingRate ?? 0) * 100)} suffix="%" onChange={(v) => patchSocial({ supplementaryHousingRate: v / 100 })} />
              </Field>
              <Field label="养老 / 医疗 / 失业" hint="个人比例，%">
                <div className="flex gap-1">
                  <NumberInput value={+(((social.pensionRate ?? city.pensionRate) * 100).toFixed(2))} step={0.5} onChange={(v) => patchSocial({ pensionRate: v / 100 })} />
                  <NumberInput value={+(((social.medicalRate ?? city.medicalRate) * 100).toFixed(2))} step={0.5} onChange={(v) => patchSocial({ medicalRate: v / 100 })} />
                  <NumberInput value={+(((social.unemploymentRate ?? city.unemploymentRate) * 100).toFixed(2))} step={0.1} onChange={(v) => patchSocial({ unemploymentRate: v / 100 })} />
                </div>
              </Field>
              <Field label="其他税前扣除" hint="企业年金个人部分等，元/月">
                <NumberInput value={social.extraMonthly} placeholder="0" onChange={(v) => patchSocial({ extraMonthly: v })} />
              </Field>
            </div>
          </Details>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3">
        <Field label="年终奖（可选）">
          <NumberInput value={seg.bonus} placeholder="0" prefix="¥" step={5000} onChange={(bonus) => onChange({ bonus, bonusMonth: seg.bonusMonth ?? seg.endMonth })} />
        </Field>
        <Field label="发放月份">
          <MonthSelect value={Math.min(seg.endMonth, Math.max(seg.startMonth, seg.bonusMonth ?? seg.endMonth))} min={seg.startMonth} max={seg.endMonth} onChange={(bonusMonth) => onChange({ bonusMonth })} />
        </Field>
      </div>
      <label className="mt-3 flex items-center gap-2 text-xs text-muted">
        <input type="checkbox" checked={!!seg.firstJobOfYear} onChange={(e) => onChange({ firstJobOfYear: e.target.checked })} className="accent-accent" />
        这是我今年的第一份工作（应届生 / 之前几个月没有工资收入），减除费用从 1 月起累计
      </label>
    </div>
  );
}
