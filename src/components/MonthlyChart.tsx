"use client";

import { useState } from "react";
import { ANNUAL_BRACKETS, MONTH_NAMES, type MonthRow } from "@/lib/tax";
import { fmtMoney, fmtPct } from "@/lib/format";
import { Segmented } from "./ui";

const RATE_STEPS = ["#dbe8f9", "#b5cff2", "#8db4ea", "#6398e0", "#3f7dd3", "#2a5fae", "#1c4280"];

function rateColor(rate: number) {
  const i = ANNUAL_BRACKETS.findIndex((b) => b.rate === rate);
  return i < 0 ? "#eeede9" : RATE_STEPS[i];
}

export function MonthlyChart({ rows, currentMonth }: { rows: MonthRow[]; currentMonth: number }) {
  const [view, setView] = useState<"chart" | "table">("chart");
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(1, ...rows.map((r) => r.gross));
  const W = 720;
  const H = 220;
  const padL = 8;
  const padB = 22;
  const padT = 8;
  const colW = (W - padL) / 12;
  const barW = colW * 0.62;
  const scale = (v: number) => (v / max) * (H - padB - padT);

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted">
          <span className="inline-flex items-center gap-1"><i className="h-2.5 w-2.5 rounded-sm" style={{ background: "var(--series-net)" }} />到手</span>
          <span className="inline-flex items-center gap-1"><i className="h-2.5 w-2.5 rounded-sm" style={{ background: "var(--series-tax)" }} />个税（预扣）</span>
          <span className="inline-flex items-center gap-1"><i className="h-2.5 w-2.5 rounded-sm" style={{ background: "var(--series-social)" }} />五险一金</span>
        </div>
        <Segmented value={view} onChange={setView} options={[{ value: "chart", label: "图" }, { value: "table", label: "表" }]} />
      </div>

      {view === "chart" ? (
        <div className="relative">
          <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="逐月税前收入拆分为到手、个税、五险一金">
            {rows.map((r, i) => {
              const x = padL + i * colW + (colW - barW) / 2;
              const base = H - padB;
              const hNet = scale(Math.max(0, r.net));
              const hTax = scale(r.tax + r.bonusTax);
              const hSoc = scale(r.social);
              const gap = 2;
              const dim = r.isFuture ? 0.55 : 1;
              return (
                <g key={r.month} opacity={dim} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
                  <rect x={padL + i * colW} y={padT} width={colW} height={H - padT} fill={hover === i ? "#00000008" : "transparent"} />
                  {r.isGap ? (
                    <rect x={x} y={base - 40} width={barW} height={40} fill="none" stroke="#d9d7d0" strokeDasharray="3 3" rx={4} />
                  ) : (
                    <>
                      <rect x={x} y={base - hNet} width={barW} height={hNet} fill="var(--series-net)" rx={hTax + hSoc > 0 ? 0 : 4} />
                      {hTax > 0 && <rect x={x} y={base - hNet - gap - hTax} width={barW} height={hTax} fill="var(--series-tax)" />}
                      {hSoc > 0 && <rect x={x} y={base - hNet - hTax - gap * 2 - hSoc} width={barW} height={hSoc} fill="var(--series-social)" rx={4} />}
                    </>
                  )}
                  <text x={x + barW / 2} y={H - 6} textAnchor="middle" fontSize={11} fill={r.month === currentMonth ? "#16150f" : "#6b6a64"} fontWeight={r.month === currentMonth ? 600 : 400}>
                    {MONTH_NAMES[i]}
                  </text>
                </g>
              );
            })}
          </svg>
          {hover !== null && (
            <div className="pointer-events-none absolute top-2 rounded-lg border border-line bg-white px-3 py-2 text-xs shadow-md" style={{ left: `${Math.min(70, (hover / 12) * 100)}%` }}>
              <div className="font-medium text-ink">
                {MONTH_NAMES[hover]}
                {rows[hover].isFuture ? "（预测）" : ""}
                {rows[hover].isGap ? " · 无收入" : ""}
              </div>
              {!rows[hover].isGap && (
                <div className="mt-1 space-y-0.5 tabular-nums text-muted">
                  <div>
                    税前 {fmtMoney(rows[hover].gross)}
                    {rows[hover].equity > 0 ? `（含期权 ${fmtMoney(rows[hover].equity)}）` : ""}
                  </div>
                  <div>五险一金 −{fmtMoney(rows[hover].social)}</div>
                  <div>
                    个税 −{fmtMoney(rows[hover].tax + rows[hover].bonusTax)}
                    {rows[hover].bonusTax > 0 ? `（含年终奖 ${fmtMoney(rows[hover].bonusTax)}）` : ""}
                  </div>
                  <div className="text-ink">到手 {fmtMoney(rows[hover].net)}</div>
                  {rows[hover].entries.map((e) => (
                    <div key={e.segmentId}>
                      {e.segmentName || "工作"}：累计应纳税所得 {fmtMoney(e.cumTaxable)} → 预扣率 {fmtPct(e.rate, 0)}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs tabular-nums">
            <thead className="text-muted">
              <tr className="border-b border-line text-left">
                <th className="py-1.5 pr-2 font-medium">月份</th>
                <th className="py-1.5 pr-2 text-right font-medium">税前</th>
                <th className="py-1.5 pr-2 text-right font-medium">五险一金</th>
                <th className="py-1.5 pr-2 text-right font-medium">个税</th>
                <th className="py-1.5 pr-2 text-right font-medium">到手</th>
                <th className="py-1.5 pr-2 text-right font-medium">累计应纳税所得</th>
                <th className="py-1.5 text-right font-medium">预扣率</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.month} className={`border-b border-line/60 ${r.isFuture ? "text-muted" : "text-ink"}`}>
                  <td className="py-1.5 pr-2">
                    {MONTH_NAMES[r.month - 1]}
                    {r.isFuture ? <span className="ml-1 text-[10px] text-muted">预测</span> : null}
                  </td>
                  <td className="py-1.5 pr-2 text-right">{r.isGap ? "—" : fmtMoney(r.gross)}</td>
                  <td className="py-1.5 pr-2 text-right">{r.isGap ? "—" : fmtMoney(r.social)}</td>
                  <td className="py-1.5 pr-2 text-right">{r.isGap ? "—" : fmtMoney(r.tax + r.bonusTax)}</td>
                  <td className="py-1.5 pr-2 text-right font-medium">{r.isGap ? "—" : fmtMoney(r.net)}</td>
                  <td className="py-1.5 pr-2 text-right">{r.isGap ? "—" : r.entries.map((e) => fmtMoney(e.cumTaxable)).join(" / ")}</td>
                  <td className="py-1.5 text-right">{r.isGap ? "—" : r.entries.map((e) => fmtPct(e.rate, 0)).join(" / ")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* 预扣率阶梯 */}
      <div className="mt-4">
        <div className="mb-1.5 flex items-center justify-between text-[11px] text-muted">
          <span>每月预扣率（累计预扣，换工作后新单位从头累计）</span>
        </div>
        <div className="grid grid-cols-12 gap-1">
          {rows.map((r) => (
            <div
              key={r.month}
              className="flex h-9 items-center justify-center rounded-md text-[11px] font-medium tabular-nums"
              style={{ background: r.isGap ? "#eeede9" : rateColor(r.rate), color: r.isGap ? "#6b6a64" : r.rate >= 0.25 ? "#fff" : "#16150f", opacity: r.isFuture ? 0.6 : 1 }}
              title={`${MONTH_NAMES[r.month - 1]}：${r.isGap ? "无收入" : fmtPct(r.rate, 0)}`}
            >
              {r.isGap ? "—" : fmtPct(r.rate, 0)}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
