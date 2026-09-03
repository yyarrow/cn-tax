"use client";

import { SAD_STANDARD, sadMonthly, annualOnlyDeductions, type SpecialDeductions } from "@/lib/tax";
import { fmtMoney } from "@/lib/format";
import { Field, NumberInput, Segmented, Select } from "./ui";

export function DeductionsEditor({ d, onChange }: { d: SpecialDeductions; onChange: (p: Partial<SpecialDeductions>) => void }) {
  const monthly = sadMonthly(d);
  const annual = annualOnlyDeductions(d);
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <Field label="住房" hint="租金 / 房贷利息二选一">
          <Select value={d.housing} onChange={(e) => onChange({ housing: e.target.value as SpecialDeductions["housing"] })}>
            <option value="none">未申报</option>
            <option value="rent">租房</option>
            <option value="loan">首套房贷利息（{SAD_STANDARD.housingLoan}/月）</option>
          </Select>
        </Field>
        {d.housing === "rent" ? (
          <Field label="租房城市">
            <Select value={d.rentTier} onChange={(e) => onChange({ rentTier: Number(e.target.value) as 1 | 2 | 3 })}>
              <option value={1}>直辖市/省会/计划单列市（{SAD_STANDARD.rentTier1}/月）</option>
              <option value={2}>户籍人口 &gt; 100 万（{SAD_STANDARD.rentTier2}/月）</option>
              <option value={3}>其他（{SAD_STANDARD.rentTier3}/月）</option>
            </Select>
          </Field>
        ) : (
          <div />
        )}
        <Field label="赡养老人" hint="父母年满 60 岁">
          <Select value={d.elderly} onChange={(e) => onChange({ elderly: e.target.value as SpecialDeductions["elderly"] })}>
            <option value="none">未申报</option>
            <option value="only">独生子女（{SAD_STANDARD.elderlyOnly}/月）</option>
            <option value="shared">非独生，分摊</option>
          </Select>
        </Field>
        {d.elderly === "shared" ? (
          <Field label="我分摊的金额" hint={`每月，不超过 ${SAD_STANDARD.elderlySharedMax}`}>
            <NumberInput value={d.elderlySharedAmount} onChange={(v) => onChange({ elderlySharedAmount: Math.min(SAD_STANDARD.elderlySharedMax, v) })} prefix="¥" />
          </Field>
        ) : (
          <div />
        )}
        <Field label="子女教育" hint={`每个 ${SAD_STANDARD.childEducation}/月`}>
          <NumberInput value={d.children} onChange={(children) => onChange({ children })} suffix="个" />
        </Field>
        <Field label="3 岁以下婴幼儿" hint={`每个 ${SAD_STANDARD.infant}/月`}>
          <NumberInput value={d.infants} onChange={(infants) => onChange({ infants })} suffix="个" />
        </Field>
        <Field label="继续教育" className="col-span-2">
          <Segmented
            value={d.continuingEducation}
            onChange={(continuingEducation) => onChange({ continuingEducation })}
            options={[
              { value: "none", label: "无" },
              { value: "degree", label: `在职学历（${SAD_STANDARD.continuingEducationDegree}/月）` },
              { value: "cert", label: `职业资格证（${SAD_STANDARD.continuingEducationCert}/年）` },
            ]}
          />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3 border-t border-line pt-4">
        <Field label="个人养老金" hint={`年缴，上限 ${SAD_STANDARD.personalPensionCap}`}>
          <NumberInput value={d.personalPension} onChange={(v) => onChange({ personalPension: Math.min(SAD_STANDARD.personalPensionCap, v) })} prefix="¥" step={1000} />
        </Field>
        <Field label="大病医疗自付" hint={`年度医保内自付，超 ${SAD_STANDARD.seriousIllnessThreshold} 的部分可扣`}>
          <NumberInput value={d.seriousIllnessPaid} onChange={(seriousIllnessPaid) => onChange({ seriousIllnessPaid })} prefix="¥" />
        </Field>
        <Field label="其他年度扣除" hint="税优健康险（2400）等" className="col-span-2">
          <NumberInput value={d.otherAnnual} onChange={(otherAnnual) => onChange({ otherAnnual })} prefix="¥" />
        </Field>
      </div>
      <p className="text-xs text-muted">
        合计：每月 <b className="text-ink">{fmtMoney(monthly)}</b>（单位预扣时可用），全年 <b className="text-ink">{fmtMoney(monthly * 12 + annual.total)}</b>
        {annual.total > 0 ? `（含只能在汇算时扣的 ${fmtMoney(annual.total)}）` : ""}
      </p>
    </div>
  );
}
