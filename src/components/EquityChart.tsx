"use client";

import { useRef, useState } from "react";
import { useSvgScale } from "@/lib/useSvgScale";
import type { EquityPlan, EquityResult } from "@/lib/tax";
import { fmtMoney, fmtPct } from "@/lib/format";
import { Field, Hint, NumberInput, Select } from "./ui";

const RATE_ORDER = [0.03, 0.1, 0.2, 0.25, 0.3, 0.35, 0.45];
/** 税率越高，蓝色越深（浅色渐进，保证折线可读） */
function rateFill(rate: number) {
  const i = Math.max(0, RATE_ORDER.indexOf(rate));
  return `rgba(42, 120, 214, ${(0.06 + i * 0.05).toFixed(2)})`;
}

function short(n: number) {
  if (n >= 10000) return `${(n / 10000).toLocaleString("zh-CN", { maximumFractionDigits: 1 })}万`;
  return n.toLocaleString("zh-CN");
}

export function EquityChart({ e, plan, onChange, staticMode = false }: { e: EquityResult; plan: EquityPlan; onChange: (p: EquityPlan) => void; staticMode?: boolean }) {
  const W = 720;
  const svgRef = useRef<SVGSVGElement>(null);
  const k = useSvgScale(svgRef, W);
  const fs = 12 * k;
  const H = 260;
  const padL = 56 * Math.max(1, k * 0.7);
  const padR = 16 * Math.max(1, k * 1.4);
  const padT = 28 * Math.max(1, k * 0.7);
  const padB = 30;
  const maxX = e.maxX;
  const maxTax = Math.max(1, e.curve[e.curve.length - 1].tax);
  const sx = (x: number) => padL + (x / maxX) * (W - padL - padR);
  const sy = (t: number) => padT + (1 - t / maxTax) * (H - padT - padB);
  const [hoverX, setHoverX] = useState<number | null>(null);

  // 在折线上按 x 求税额（分段线性插值）
  const taxAt = (x: number) => {
    const c = e.curve;
    for (let i = 1; i < c.length; i++) {
      if (x <= c[i].x) {
        const a = c[i - 1];
        const b = c[i];
        const t = b.x === a.x ? 0 : (x - a.x) / (b.x - a.x);
        return a.tax + (b.tax - a.tax) * t;
      }
    }
    return c[c.length - 1].tax;
  };
  const rateAt = (x: number) => {
    const k = e.kinks.find((k) => x < k.x);
    return k ? k.rateBefore : e.kinks.length ? e.kinks[e.kinks.length - 1].rateAfter : e.currentRate;
  };

  const bands: { from: number; to: number; rate: number }[] = [];
  {
    let from = 0;
    for (const k of e.kinks) {
      bands.push({ from, to: k.x, rate: k.rateBefore });
      from = k.x;
    }
    bands.push({ from, to: maxX, rate: rateAt(maxX) });
  }

  const path = e.curve.map((p, i) => `${i ? "L" : "M"}${sx(p.x).toFixed(1)},${sy(p.tax).toFixed(1)}`).join(" ");
  const planned = e.planned;
  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((f) => f * maxTax);
  const xTicks = [0, 0.25, 0.5, 0.75, 1].map((f) => f * maxX);

  const onMove = (ev: React.MouseEvent<SVGSVGElement>) => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return;
    const px = ((ev.clientX - rect.left) / rect.width) * W;
    const x = Math.max(0, Math.min(maxX, ((px - padL) / (W - padL - padR)) * maxX));
    setHoverX(x);
  };

  const modeText = e.mode === "combined" ? "并入工资计税" : e.mode === "listed" ? "单独按年度税率表" : "递延 20%";

  return (
    <div className="space-y-4">
      {staticMode ? (
        <div className="text-xs text-muted">
          {modeText}
          {e.income > 0 ? ` · 已兑现 ${fmtMoney(e.income)}，税 ${fmtMoney(e.tax)}` : ""} · 当前边际 {fmtPct(e.currentRate, 0)}
          {planned ? ` · 计划再兑现 ${fmtMoney(planned.amount)}` : ""}
        </div>
      ) : (
      <div className="flex flex-wrap items-start gap-3">
        <Field label="计划再兑现（税前）" className="w-44">
          <NumberInput value={plan.plannedExtra} placeholder="0" prefix="¥" step={10000} onChange={(plannedExtra) => onChange({ ...plan, plannedExtra })} />
        </Field>
        <Field label="横轴范围" className="w-32">
          <Select value={plan.chartMax ?? 1_000_000} onChange={(ev) => onChange({ ...plan, chartMax: Number(ev.target.value) })}>
            <option value={200_000}>20 万</option>
            <option value={500_000}>50 万</option>
            <option value={1_000_000}>100 万</option>
            <option value={2_000_000}>200 万</option>
            <option value={5_000_000}>500 万</option>
          </Select>
        </Field>
        <div className="w-full text-xs text-muted sm:ml-auto sm:mt-5 sm:w-auto sm:leading-9">
          {modeText}
          {e.income > 0 ? ` · 已兑现 ${fmtMoney(e.income)}，税 ${fmtMoney(e.tax)}` : ""} · 当前边际 {fmtPct(e.currentRate, 0)}
        </div>
      </div>
      )}

      <div className="relative">
        <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} className="w-full select-none" onMouseMove={staticMode ? undefined : onMove} onMouseLeave={() => setHoverX(null)} role="img" aria-label="再兑现金额与需缴税额的关系曲线">
          {bands.map((b, i) => (
            <g key={i}>
              <rect x={sx(b.from)} y={padT} width={Math.max(0, sx(b.to) - sx(b.from))} height={H - padT - padB} fill={rateFill(b.rate)} />
              {sx(b.to) - sx(b.from) > 34 && (
                <text x={(sx(b.from) + sx(b.to)) / 2} y={padT - 8} textAnchor="middle" fontSize={fs} fill="#52514e">
                  {fmtPct(b.rate, 0)}
                </text>
              )}
            </g>
          ))}
          {yTicks.map((t) => (
            <g key={t}>
              <line x1={padL} x2={W - padR} y1={sy(t)} y2={sy(t)} stroke="#ffffff" strokeWidth={1} />
              <text x={padL - 6} y={sy(t) + 4} textAnchor="end" fontSize={fs} fill="#6b6a64">
                {short(t)}
              </text>
            </g>
          ))}
          {xTicks.map((t) => (
            <text key={t} x={sx(t)} y={H - 10} textAnchor="middle" fontSize={fs} fill="#6b6a64">
              {short(t)}
            </text>
          ))}
          <path d={path} fill="none" stroke="#16150f" strokeWidth={2} strokeLinejoin="round" />
          {e.kinks.map((k) => (
            <g key={k.x}>
              <line x1={sx(k.x)} x2={sx(k.x)} y1={sy(k.tax)} y2={H - padB} stroke="#eb6834" strokeDasharray="3 3" strokeWidth={1} />
              <circle cx={sx(k.x)} cy={sy(k.tax)} r={4.5} fill="#eb6834" stroke="#fff" strokeWidth={2} />
            </g>
          ))}
          {planned && planned.amount <= maxX && (
            <g>
              <line x1={sx(planned.amount)} x2={sx(planned.amount)} y1={padT} y2={H - padB} stroke="#2a78d6" strokeWidth={1.5} />
              <circle cx={sx(planned.amount)} cy={sy(planned.tax)} r={5} fill="#2a78d6" stroke="#fff" strokeWidth={2} />
            </g>
          )}
          {hoverX !== null && (
            <g>
              <line x1={sx(hoverX)} x2={sx(hoverX)} y1={padT} y2={H - padB} stroke="#16150f" strokeOpacity={0.35} strokeWidth={1} />
              <circle cx={sx(hoverX)} cy={sy(taxAt(hoverX))} r={4} fill="#fff" stroke="#16150f" strokeWidth={1.5} />
            </g>
          )}
        </svg>
        {hoverX !== null && (
          <div className="pointer-events-none absolute top-8 rounded-lg border border-line bg-white px-3 py-2 text-xs shadow-md" style={{ left: `${Math.min(72, (sx(hoverX) / W) * 100)}%` }}>
            <div className="font-medium text-ink">再兑现 {fmtMoney(hoverX)}</div>
            <div className="mt-0.5 tabular-nums text-muted">
              税 {fmtMoney(taxAt(hoverX))}（{hoverX > 0 ? fmtPct(taxAt(hoverX) / hoverX) : "—"}），到手 {fmtMoney(hoverX - taxAt(hoverX))}
            </div>
            <div className="text-muted">这一段边际 {fmtPct(rateAt(hoverX), 0)}</div>
          </div>
        )}
      </div>

      <p className="-mt-2 text-xs text-muted">横轴再兑现金额，纵轴这部分的税。色带越深税率越高；橙点为跳档拐点，蓝点为计划金额。</p>
      {e.kinks.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full text-xs tabular-nums">
            <thead className="text-muted">
              <tr className="border-b border-line text-left">
                <th className="py-1.5 pr-2 font-medium">拐点（再兑现到）</th>
                <th className="py-1.5 pr-2 text-right font-medium">累计税</th>
                <th className="py-1.5 pr-2 text-right font-medium">到手</th>
                <th className="py-1.5 pr-2 text-right font-medium">综合税率</th>
                <th className="py-1.5 text-right font-medium">再多兑现的税率</th>
              </tr>
            </thead>
            <tbody>
              {e.kinks.map((k) => (
                <tr key={k.x} className="border-b border-line/60 text-ink">
                  <td className="py-1.5 pr-2">
                    <span className="mr-1.5 inline-block h-2 w-2 rounded-full bg-[#eb6834] align-middle" />
                    {fmtMoney(k.x)}
                  </td>
                  <td className="py-1.5 pr-2 text-right">{fmtMoney(k.tax)}</td>
                  <td className="py-1.5 pr-2 text-right">{fmtMoney(k.x - k.tax)}</td>
                  <td className="py-1.5 pr-2 text-right">{fmtPct(k.tax / k.x)}</td>
                  <td className="py-1.5 text-right">
                    {fmtPct(k.rateBefore, 0)} → <b>{fmtPct(k.rateAfter, 0)}</b>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <Hint>{e.mode === "unlisted" ? "递延纳税固定 20%，没有拐点。" : "范围内没有跳档点，可把横轴调大。"}</Hint>
      )}

      {planned && (
        <div className="rounded-lg bg-accent/5 px-4 py-3 text-sm">
          <div className="text-ink">
            计划再兑现 <b>{fmtMoney(planned.amount)}</b>：税 <b>{fmtMoney(planned.tax)}</b>（综合 {fmtPct(planned.effectiveRate)}，最后一段按 {fmtPct(planned.marginalRate, 0)}），到手 <b>{fmtMoney(planned.net)}</b>
          </div>
          {planned.deferKink && planned.deferSaving > 1 && (
            <div className="mt-1 text-xs text-muted">
              今年兑现到 {fmtMoney(planned.deferKink)}、其余 {fmtMoney(planned.amount - planned.deferKink)} 放明年，可省约 <b className="text-good-text">{fmtMoney(planned.deferSaving)}</b>
              {e.mode === "combined" ? "（按明年工资不变估）" : ""}。
            </div>
          )}
        </div>
      )}
    </div>
  );
}
