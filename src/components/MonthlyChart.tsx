"use client";

import { useRef, useState } from "react";
import { useSvgScale } from "@/lib/useSvgScale";
import { ANNUAL_BRACKETS, MONTH_NAMES, type MonthRow } from "@/lib/tax";
import { fmtMoney, fmtPct } from "@/lib/format";
import { Segmented } from "./ui";

const RATE_STEPS = ["#dbe8f9", "#b5cff2", "#8db4ea", "#6398e0", "#3f7dd3", "#2a5fae", "#1c4280"];

function rateColor(rate: number) {
  const i = ANNUAL_BRACKETS.findIndex((b) => b.rate === rate);
  return i < 0 ? "#eeede9" : RATE_STEPS[i];
}

/** 一行里"年终奖"部分的税前金额：来自各 entry 的 bonus 之和 */
function bonusOfRow(r: MonthRow): number {
  return r.entries.reduce((s, e) => s + e.bonus, 0);
}

const CAP_H = 14; // 截断标记段固定高度

function wan(n: number) {
  return n >= 10000 ? `${(n / 10000).toLocaleString("zh-CN", { maximumFractionDigits: 1 })}万` : n.toLocaleString("zh-CN");
}
const CAP_GAP = 3; // 截断标记段与柱体 / label 之间的间距
const LABEL_GAP = 4; // label 基线与截断标记段顶部的间距

export function MonthlyChart({ rows, currentMonth, staticMode = false }: { rows: MonthRow[]; currentMonth: number; staticMode?: boolean }) {
  const [view, setView] = useState<"chart" | "table">("chart");
  const [hover, setHover] = useState<number | null>(null);
  // 用"常规收入"（税前 − 年终奖 − 期权）定比例尺，避免单月大额奖金/期权把其余 11 根柱子压扁
  const regularMax = Math.max(1, ...rows.map((r) => r.gross - bonusOfRow(r) - r.equity));
  const axisMax = regularMax * 1.08; // ~8% headroom
  const W = 720;
  const svgRef = useRef<SVGSVGElement>(null);
  const k = useSvgScale(svgRef, W);
  const fs = 12 * k; // 屏幕上恒为 12px
  const compact = k > 1.5; // 手机：标注用短写
  const H = 220;
  const padL = 8;
  const padB = 22;
  // 顶部留白按实际需要算：截断段 + 标注文字，相邻两个月都有标注时再加一行
  const cappedFlags = rows.map((r) => !r.isGap && (bonusOfRow(r) > 0 || r.equity > 0));
  const anyCapped = cappedFlags.some(Boolean);
  const anyAdjacent = cappedFlags.some((c, i) => c && i > 0 && cappedFlags[i - 1]);
  const padT = anyCapped ? CAP_H + CAP_GAP + LABEL_GAP * k + fs + (anyAdjacent ? fs + 2 * k : 0) + 6 * k : 12;
  const colW = (W - padL) / 12;
  const barW = colW * 0.62;
  const plotH = H - padB - padT;
  const scale = (v: number) => (v / axisMax) * plotH;

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
          <span className="inline-flex items-center gap-1"><i className="h-2.5 w-2.5 rounded-sm" style={{ background: "var(--series-net)" }} />到手</span>
          <span className="inline-flex items-center gap-1"><i className="h-2.5 w-2.5 rounded-sm" style={{ background: "var(--series-tax)" }} />个税（预扣）</span>
          <span className="inline-flex items-center gap-1"><i className="h-2.5 w-2.5 rounded-sm" style={{ background: "var(--series-social)" }} />五险一金</span>
        </div>
        {!staticMode && <Segmented value={view} onChange={setView} options={[{ value: "chart", label: "图" }, { value: "table", label: "表" }]} />}
      </div>

      {view === "chart" ? (
        <div className="relative">
          <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="逐月税前收入拆分为到手、个税、五险一金">
            <defs>
              <pattern id="chart-cap-hatch" width="6" height="6" patternTransform="rotate(45)" patternUnits="userSpaceOnUse">
                <rect width="6" height="6" fill="#eeede9" />
                <line x1="0" y1="0" x2="0" y2="6" stroke="#c9c7c0" strokeWidth={2} />
              </pattern>
            </defs>
            {rows.map((r, i) => {
              // 相邻两个月都有标注时，后一个抬高一行，避免重叠
              const prevCapped = i > 0 && !rows[i - 1].isGap && (bonusOfRow(rows[i - 1]) > 0 || rows[i - 1].equity > 0);
              const labelLift = prevCapped ? fs + 2 * k : 0;
              const x = padL + i * colW + (colW - barW) / 2;
              const base = H - padB;
              const gap = 2;
              const dim = r.isFuture ? 0.55 : 1;

              const bonusAmt = bonusOfRow(r);
              const equityAmt = r.equity;
              // 有年终奖 / 期权的月份一律用截断段 + 标注表示，不管金额大小，否则小额奖金会在图上消失
              const isCapped = !r.isGap && (bonusAmt > 0 || equityAmt > 0);

              // r.net 里含了年终奖/期权兑现的到手部分（可能巨大），常规柱子只画"常规到手"：
              // 常规税前 − 五险一金 − 个税（含年终奖个税，保持诚实）
              const regularGross = r.gross - bonusAmt - equityAmt;
              // 常规部分只含工资：年终奖及其单独计税的税额一起进截断段，避免奖金税把当月工资柱吃掉
              const regularNet = regularGross - r.social - r.tax;
              const hNet = scale(Math.max(0, regularNet));
              const hSoc = scale(r.social);
              const hTaxRaw = scale(r.tax);
              let hTax = hTaxRaw;
              let taxClamped = false;
              const overflow = hNet + hTaxRaw + hSoc + gap * 2 - plotH;
              if (overflow > 0) {
                hTax = Math.max(0, hTaxRaw - overflow);
                taxClamped = true;
              }
              const stackTop = hSoc > 0 ? base - hNet - hTax - gap * 2 - hSoc : hTax > 0 ? base - hNet - gap - hTax : base - hNet;
              const capY = stackTop - CAP_GAP - CAP_H;

              const isFirstHalf = r.month <= 6;
              const labelAnchor = isFirstHalf ? "start" : "end";
              const labelX = isFirstHalf ? x : x + barW;
              const capLabelParts: string[] = [];
              if (bonusAmt > 0) capLabelParts.push(compact ? `奖金 ${wan(bonusAmt)}` : `含年终奖 ${fmtMoney(bonusAmt)}${r.bonusTax > 0 ? `（税 ${fmtMoney(r.bonusTax)}）` : ""}`);
              if (equityAmt > 0) capLabelParts.push(compact ? `期权 ${wan(equityAmt)}` : `含期权 ${fmtMoney(equityAmt)}`);
              const capLabel = capLabelParts.join(" · ");

              return (
                <g key={r.month} opacity={dim} onMouseEnter={() => !staticMode && setHover(i)} onMouseLeave={() => setHover(null)}>
                  <rect x={padL + i * colW} y={padT} width={colW} height={H - padT} fill={hover === i ? "#00000008" : "transparent"} />
                  {r.isGap ? (
                    <rect x={x} y={base - 40} width={barW} height={40} fill="none" stroke="#d9d7d0" strokeDasharray="3 3" rx={4} />
                  ) : (
                    <>
                      <rect x={x} y={base - hNet} width={barW} height={hNet} fill="var(--series-net)" rx={hTax + hSoc > 0 ? 0 : 4} />
                      {hTax > 0 && (
                        <rect x={x} y={base - hNet - gap - hTax} width={barW} height={hTax} fill={taxClamped ? "url(#chart-cap-hatch)" : "var(--series-tax)"} />
                      )}
                      {hSoc > 0 && <rect x={x} y={base - hNet - hTax - gap * 2 - hSoc} width={barW} height={hSoc} fill="var(--series-social)" rx={4} />}
                      {isCapped && capLabel && (
                        <>
                          <line x1={x + barW * 0.3} y1={stackTop + 3} x2={x + barW * 0.42} y2={stackTop - 3} stroke="#fff" strokeWidth={2} strokeLinecap="round" />
                          <line x1={x + barW * 0.58} y1={stackTop + 3} x2={x + barW * 0.7} y2={stackTop - 3} stroke="#fff" strokeWidth={2} strokeLinecap="round" />
                          <rect x={x} y={capY} width={barW} height={CAP_H} fill="url(#chart-cap-hatch)" rx={2} />
                          <text
                            x={labelX}
                            y={capY - LABEL_GAP * k - labelLift}
                            textAnchor={labelAnchor}
                            fontSize={fs}
                            fill="var(--ink)"
                            style={{ fontVariantNumeric: "tabular-nums" }}
                          >
                            {capLabel}
                          </text>
                        </>
                      )}
                    </>
                  )}
                  <text x={x + barW / 2} y={H - 6} textAnchor="middle" fontSize={fs} fill={r.month === currentMonth ? "#16150f" : "#6b6a64"} fontWeight={r.month === currentMonth ? 600 : 400}>
                    {compact ? i + 1 : MONTH_NAMES[i]}
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
                  {bonusOfRow(rows[hover]) > 0 && <div>年终奖 {fmtMoney(bonusOfRow(rows[hover]))}</div>}
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
                    {r.isFuture ? <span className="ml-1 text-xs text-muted">预测</span> : null}
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
        <div className="mb-1.5 flex items-center justify-between text-xs text-muted">
          <span>每月预扣率 %（累计预扣，换工作后新单位从头累计）</span>
        </div>
        <div className="grid grid-cols-12 gap-1">
          {rows.map((r) => (
            <div
              key={r.month}
              className="flex h-9 items-center justify-center rounded-md text-xs font-medium tabular-nums"
              style={{ background: r.isGap ? "#eeede9" : rateColor(r.rate), color: r.isGap ? "#6b6a64" : r.rate >= 0.25 ? "#fff" : "#16150f", opacity: r.isFuture ? 0.6 : 1 }}
              title={`${MONTH_NAMES[r.month - 1]}：${r.isGap ? "无收入" : fmtPct(r.rate, 0)}`}
            >
              {r.isGap ? "—" : `${Math.round(r.rate * 100)}`}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
