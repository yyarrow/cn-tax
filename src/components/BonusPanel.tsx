"use client";

import type { BonusAnalysis, BonusMode } from "@/lib/tax";
import { fmtMoney } from "@/lib/format";
import { Hint, Segmented } from "./ui";

export function BonusPanel({ b, mode, onMode, bonusSeparate }: { b: BonusAnalysis; mode: BonusMode; onMode: (m: BonusMode) => void; bonusSeparate: boolean }) {
  const better = b.recommended;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-sm text-muted">
          年终奖 <b className="text-ink">{fmtMoney(b.bonus)}</b>，当前按「{bonusSeparate ? "单独计税" : "并入综合所得"}」计算
        </div>
        <Segmented
          value={mode}
          onChange={onMode}
          options={[
            { value: "auto", label: "自动选最省" },
            { value: "separate", label: "单独计税" },
            { value: "combined", label: "并入" },
          ]}
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        {(["separate", "combined"] as const).map((k) => {
          const v = k === "separate" ? b.separate : b.combined;
          const isBest = better === k;
          return (
            <div key={k} className={`rounded-xl border p-4 ${isBest ? "border-good bg-good/5" : "border-line"}`}>
              <div className="flex items-center justify-between text-xs text-muted">
                <span>{k === "separate" ? "单独计税" : "并入综合所得"}</span>
                {isBest && <span className="rounded-full bg-good px-2 py-0.5 text-[10px] font-medium text-white">推荐</span>}
              </div>
              <div className="mt-1 text-2xl font-semibold tabular-nums text-ink">{fmtMoney(v.total)}</div>
              <div className="mt-1 text-[11px] text-muted">
                {k === "separate" ? `工资部分 ${fmtMoney(b.separate.comprehensiveTax)} + 奖金 ${fmtMoney(b.separate.bonusTax)}` : `合并后按年度税率表计算`}
              </div>
            </div>
          );
        })}
      </div>
      <p className="text-xs text-muted">
        {b.saving > 1 ? (
          <>
            选「{better === "separate" ? "单独计税" : "并入"}」全年少交 <b className="text-good">{fmtMoney(b.saving)}</b>。汇算清缴时在个税 App 里可自行切换，不需要公司配合。
          </>
        ) : (
          "两种方式税额几乎一样。"
        )}
      </p>
      {b.trap && (
        <Hint>
          <b className="text-danger">陷阱区间：</b>年终奖 {fmtMoney(b.bonus)} 落在 {fmtMoney(b.trap.lower)}–{fmtMoney(b.trap.upper)} 之间，单独计税跳档后比正好发 {fmtMoney(b.trap.lower)} 反而少拿 <b>{fmtMoney(b.trap.extraTax)}</b>。可以和公司协商把多出的部分并进工资发。
        </Hint>
      )}
      <div className="rounded-xl border border-line p-4">
        <div className="text-xs font-medium text-ink">如果能和公司商量「工资 : 年终奖」的比例</div>
        {b.optimalSplit.saving < 1 ? (
          <p className="mt-2 text-xs text-muted">现在的工资 / 年终奖比例已经是最省的（全年现金 {fmtMoney(b.optimalSplit.totalCash)}），不需要调整。</p>
        ) : (
        <div className="mt-2 grid grid-cols-3 gap-3 text-xs">
          <div>
            <div className="text-muted">全年现金不变</div>
            <div className="mt-0.5 text-base font-semibold tabular-nums">{fmtMoney(b.optimalSplit.totalCash)}</div>
          </div>
          <div>
            <div className="text-muted">最优年终奖</div>
            <div className="mt-0.5 text-base font-semibold tabular-nums text-accent">{fmtMoney(b.optimalSplit.bestBonus)}</div>
          </div>
          <div>
            <div className="text-muted">比现在再省</div>
            <div className="mt-0.5 text-base font-semibold tabular-nums text-good">{fmtMoney(b.optimalSplit.saving)}</div>
          </div>
        </div>
        )}
        <p className="mt-2 text-[11px] text-muted">最优点通常是某个税率档的边界（如 36,000 / 144,000 / 300,000），把奖金卡在边界、其余走工资。</p>
      </div>
    </div>
  );
}
