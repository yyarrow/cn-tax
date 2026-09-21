"use client";

import { ANNUAL_BRACKETS, type AnnualResult } from "@/lib/tax";
import { fmtMoney, fmtPct } from "@/lib/format";
import { Stat, Hint } from "./ui";

export function Summary({ a }: { a: AnnualResult }) {
  const settlementLabel = a.settlement < -0.5 ? "汇算清缴预计退税" : a.settlement > 0.5 ? "汇算清缴预计补税" : "汇算清缴";
  const settlementTone = a.settlement < -0.5 ? "good" : a.settlement > 0.5 ? "bad" : "default";
  const next = ANNUAL_BRACKETS[a.bracketIndex + 1];

  let settlementNote: { text: string; tone: "good" | "bad" } | null = null;
  if (a.settlement < -1) {
    const amt = fmtMoney(-a.settlement);
    settlementNote = {
      tone: "good",
      text:
        a.gapMonths.length > 0
          ? `6 万减除和专项附加按全年算，单位预扣只按在职月份算，明年 3–6 月在个税 App 办汇算就能退 ${amt} 到银行卡。`
          : `退税通常是专项附加没在单位申报，或年终奖换了计税方式，明年 3–6 月在个税 App 办汇算就能退 ${amt} 到银行卡。`,
    };
  } else if (a.settlement > 1) {
    const amt = fmtMoney(a.settlement);
    settlementNote = {
      tone: "bad",
      text: a.settlementExempt
        ? "年收入不超 12 万或补税不超 400 元可以免办、不用补。"
        : `这通常是换工作或多处取薪：每家单位各自重新累计、都用一遍 3% 低档，汇算合并后要补 ${amt}。6 月 30 日前补上即可，提前留好这笔钱。`,
    };
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <div className="col-span-2 rounded-xl bg-ink px-5 py-4 text-white">
          <div className="text-xs text-white/70">全年到手（含年终奖、期权 / RSU）</div>
          <div className="mt-1 text-4xl font-semibold tabular-nums">{fmtMoney(a.netTotal)}</div>
          <div className="mt-2 text-xs text-white/70">
            税前 {fmtMoney(a.grossTotal)} → 五险一金 −{fmtMoney(a.totalSocial)} → 个税 −{fmtMoney(a.totalTax)}
          </div>
        </div>
        <div className="col-span-2 grid grid-cols-2 divide-x divide-line rounded-xl border border-line">
          <Stat label="全年个税" value={fmtMoney(a.totalTax)} sub={`综合税负 ${fmtPct(a.effectiveRate)}${a.bonusTax > 0 ? ` · 含年终奖 ${fmtMoney(a.bonusTax)}` : ""}`} />
          <Stat label={settlementLabel} value={a.settlement < -0.5 ? `+${fmtMoney(-a.settlement)}` : fmtMoney(a.settlement)} tone={settlementTone} sub={`预扣合计 ${fmtMoney(a.withheld)}，应纳 ${fmtMoney(a.totalTax)}`} />
        </div>
      </div>
      {settlementNote && (
        <Hint>
          <span className={`mr-1.5 inline-block h-1.5 w-1.5 rounded-full align-middle ${settlementNote.tone === "good" ? "bg-good-text" : "bg-danger-text"}`} />
          {settlementNote.text}
        </Hint>
      )}
      <div className="grid grid-cols-2 gap-3 rounded-xl border border-line p-3 md:grid-cols-4">
        <Stat label="应纳税所得额" value={fmtMoney(a.taxable)} sub={`收入 − 6 万 − 五险一金 − 专项附加 ${fmtMoney(a.sadAnnual + a.otherDeductions)}`} />
        <Stat label="所处税率档" value={a.taxable > 0 ? fmtPct(a.marginalRate, 0) : "免税"} tone="accent" sub={next ? `再多 ${fmtMoney(a.roomToNextBracket)} 进 ${fmtPct(next.rate, 0)} 档` : "已是最高档"} />
        <Stat label="五险一金（个人）" value={fmtMoney(a.totalSocial)} sub="税前扣除" />
        {a.equityIncome > 0 ? (
          <Stat
            label="期权 / RSU"
            value={fmtMoney(a.equityIncome)}
            sub={`税 ${fmtMoney(a.equityTax)} · ${a.equityMode === "combined" ? "并入工资计税" : a.equityMode === "listed" ? "单独计税" : "递延 20%"}`}
          />
        ) : (
          <Stat label="无收入月份" value={a.gapMonths.length ? `${a.gapMonths.length} 个月` : "无"} sub={a.gapMonths.length ? "减除按全年算，汇算可退税" : "全年都有收入"} />
        )}
      </div>
    </div>
  );
}
