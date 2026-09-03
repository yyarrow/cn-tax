"use client";

import type { Advice } from "@/lib/tax";
import { fmtMoney } from "@/lib/format";

const KIND_LABEL: Record<Advice["kind"], string> = {
  deduction: "扣除",
  bonus: "年终奖",
  equity: "期权",
  settlement: "汇算",
  info: "了解",
};

export function AdviceList({ items }: { items: Advice[] }) {
  return (
    <ol className="space-y-2">
      {items.map((a, i) => (
        <li key={a.id} className="flex gap-3 rounded-xl border border-line p-3">
          <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-paper text-xs font-semibold text-muted">{i + 1}</span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded bg-paper px-1.5 py-0.5 text-[10px] text-muted">{KIND_LABEL[a.kind]}</span>
              <span className="text-sm font-medium text-ink">{a.title}</span>
            </div>
            <p className="mt-1 text-xs leading-relaxed text-muted">{a.detail}</p>
          </div>
          {a.saving > 0 && <div className="shrink-0 text-sm font-semibold tabular-nums text-good">+{fmtMoney(a.saving)}</div>}
        </li>
      ))}
    </ol>
  );
}
