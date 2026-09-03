"use client";

import type { EquityGrant, EquityPlan } from "@/lib/tax";
import { newGrant } from "@/lib/store";
import { Button, Field, MonthSelect, NumberInput, Segmented, Select, TextInput } from "./ui";

export function EquityEditor({ plan, onChange }: { plan: EquityPlan; onChange: (p: EquityPlan) => void }) {
  const patchGrant = (id: string, p: Partial<EquityGrant>) => onChange({ ...plan, grants: plan.grants.map((g) => (g.id === id ? { ...g, ...p } : g)) });
  return (
    <div className="space-y-3">
      <Field label="公司类型">
        <Segmented
          value={plan.companyType}
          onChange={(companyType) => onChange({ ...plan, companyType })}
          options={[
            { value: "listed", label: "上市公司（单独计税）" },
            { value: "unlisted", label: "非上市（递延 20%）" },
          ]}
        />
      </Field>
      {plan.grants.map((g) => (
        <div key={g.id} className="rounded-xl border border-line p-3">
          <div className="mb-2 flex items-center gap-2">
            <TextInput value={g.name} onChange={(name) => patchGrant(g.id, { name })} placeholder="批次名称（可选）" className="max-w-[180px]" />
            <Button variant="danger" className="ml-auto h-7 px-2" onClick={() => onChange({ ...plan, grants: plan.grants.filter((x) => x.id !== g.id) })}>
              删除
            </Button>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            <Field label="类型">
              <Select value={g.kind} onChange={(e) => patchGrant(g.id, { kind: e.target.value as EquityGrant["kind"] })}>
                <option value="rsu">RSU / 限制性股票</option>
                <option value="option">期权</option>
              </Select>
            </Field>
            <Field label="数量">
              <NumberInput value={g.quantity} onChange={(quantity) => patchGrant(g.id, { quantity })} suffix="股" />
            </Field>
            {g.kind === "option" ? (
              <Field label="行权价">
                <NumberInput value={g.strikePrice} onChange={(strikePrice) => patchGrant(g.id, { strikePrice })} prefix="¥" step={0.1} />
              </Field>
            ) : (
              <div className="hidden sm:block" />
            )}
            <Field label={g.kind === "option" ? "行权时市价" : "归属时市价"}>
              <NumberInput value={g.fairValue} onChange={(fairValue) => patchGrant(g.id, { fairValue })} prefix="¥" step={0.1} />
            </Field>
            <Field label="月份">
              <MonthSelect value={g.month} onChange={(month) => patchGrant(g.id, { month })} />
            </Field>
          </div>
        </div>
      ))}
      <Button onClick={() => onChange({ ...plan, grants: [...plan.grants, newGrant()] })}>＋ 添加一批期权 / RSU</Button>
      <p className="text-[11px] text-muted">按人民币填写；美股请先按汇率换算。收入 = (市价 − 行权价) × 数量。</p>
    </div>
  );
}
