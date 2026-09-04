"use client";

import type { EquityEvent, EquityPlan } from "@/lib/tax";
import { newEvent } from "@/lib/store";
import { Button, Field, MonthSelect, NumberInput, Select, TextInput } from "./ui";

const MODE_HINT: Record<EquityPlan["taxMode"], string> = {
  combined: "回购 / 现金结算随工资代扣，和工资共用年度税率表。",
  listed: "不并入工资，全年合并后单独按年度税率表计税（至 2027 年底）。",
  unlisted: "已备案：行权不交，转让时按 20%。",
};

export function EquityEditor({ plan, onChange }: { plan: EquityPlan; onChange: (p: EquityPlan) => void }) {
  const patchEvent = (id: string, p: Partial<EquityEvent>) => onChange({ ...plan, events: plan.events.map((e) => (e.id === id ? { ...e, ...p } : e)) });
  return (
    <div className="space-y-3">
      <Field label="怎么计税" hint={MODE_HINT[plan.taxMode]}>
        <Select value={plan.taxMode} onChange={(e) => onChange({ ...plan, taxMode: e.target.value as EquityPlan["taxMode"] })}>
          <option value="combined">并入工资计税（回购 / 现金结算 / 未备案）</option>
          <option value="listed">上市公司股权激励，单独计税</option>
          <option value="unlisted">非上市已备案，递延 20%</option>
        </Select>
      </Field>
      {plan.events.length > 0 && <div className="text-xs font-medium text-muted">今年已兑现 / 已确定的</div>}
      {plan.events.map((e) => (
        <div key={e.id} className="grid grid-cols-[1fr_1fr_auto] items-end gap-2 sm:grid-cols-[1.2fr_1fr_1fr_auto]">
          <Field label="名称" className="col-span-3 sm:col-span-1">
            <TextInput value={e.name} onChange={(name) => patchEvent(e.id, { name })} placeholder="如：Q4 回购" />
          </Field>
          <Field label="税前到账">
            <NumberInput value={e.amount} onChange={(amount) => patchEvent(e.id, { amount })} prefix="¥" step={10000} />
          </Field>
          <Field label="月份">
            <MonthSelect value={e.month} onChange={(month) => patchEvent(e.id, { month })} />
          </Field>
          <Button variant="danger" className="h-9 px-2" onClick={() => onChange({ ...plan, events: plan.events.filter((x) => x.id !== e.id) })}>
            删除
          </Button>
        </div>
      ))}
      <Button onClick={() => onChange({ ...plan, events: [...plan.events, newEvent()] })}>＋ 添加一笔兑现</Button>
      <p className="text-[11px] text-muted">填税前到账金额即可。未定的兑现不用填，去右侧「兑现规划」看。</p>
    </div>
  );
}
