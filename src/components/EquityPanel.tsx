"use client";

import type { EquityResult } from "@/lib/tax";
import { fmtMoney, fmtPct } from "@/lib/format";
import { Hint } from "./ui";

export function EquityPanel({ e }: { e: EquityResult }) {
  const rows = [
    { label: "今年一次行权", tax: e.taxOneYear, saving: 0, sub: `最高档 ${fmtPct(e.rateOneYear, 0)}` },
    { label: "分 2 年行权", tax: e.splitTwoYears.totalTax, saving: e.splitTwoYears.saving, sub: `每年 ${fmtMoney(e.splitTwoYears.perYear)}` },
    { label: "分 3 年行权", tax: e.splitThreeYears.totalTax, saving: e.splitThreeYears.saving, sub: `每年 ${fmtMoney(e.splitThreeYears.perYear)}` },
  ];
  return (
    <div className="space-y-3">
      <div className="text-sm text-muted">
        股权激励收入 <b className="text-ink">{fmtMoney(e.totalIncome)}</b>
        {e.companyType === "listed" ? "，不并入工资，单独按年度税率表计税（全年多次合并）" : "，已备案递延，转让时按 20% 计税"}
      </div>
      <div className="grid grid-cols-3 gap-3">
        {rows.map((r, i) => (
          <div key={r.label} className={`rounded-xl border p-3 ${i > 0 && r.saving > 1 ? "border-good bg-good/5" : "border-line"}`}>
            <div className="text-xs text-muted">{r.label}</div>
            <div className="mt-1 text-lg font-semibold tabular-nums text-ink">{fmtMoney(r.tax)}</div>
            <div className="text-[11px] text-muted">{r.sub}</div>
            {i > 0 && <div className={`mt-1 text-xs font-medium ${r.saving > 1 ? "text-good" : "text-muted"}`}>{r.saving > 1 ? `省 ${fmtMoney(r.saving)}` : "无差别"}</div>}
          </div>
        ))}
      </div>
      <Hint>
        {e.companyType === "listed"
          ? "跨年分批只对上市公司股权激励有意义（每年重新走一遍低税率档）。分批要承担股价波动，税差不大时不必硬等。单独计税政策执行至 2027-12-31。"
          : "非上市公司期权需要公司向税务机关备案才能递延；未备案的按工资薪金并入综合所得，税率最高 45%。"}
      </Hint>
    </div>
  );
}
