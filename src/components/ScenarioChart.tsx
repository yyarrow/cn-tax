"use client";

import { useEffect, useRef, useState } from "react";
import { fmtYearsMonths, type ScenarioPoint } from "@/lib/pension";
import { fmtMoney } from "@/lib/format";

export type ScenarioMode = "flex" | "stop";

const W = 720;
const GRAY_TOP = "#c9c7c0";
const GRAY_BOTTOM = "#dedcd5";
/** 容器窄于这个宽度（px）就改用横向条形列表 */
const NARROW_PX = 560;

/** 坐标轴文字：弹性 = "61岁" / "62岁" "7个月"；停缴 = "45岁" "停缴" */
function axisLines(p: ScenarioPoint): [string, string] {
  if (p.ageMonths !== undefined) {
    const y = Math.floor(p.ageMonths / 12);
    const m = p.ageMonths % 12;
    return [`${y}岁`, m ? `${m}个月` : ""];
  }
  if (p.stopAge !== undefined) return [`${p.stopAge}岁`, "停缴"];
  return ["缴到", "退休"];
}

function SeriesDot({ color, children }: { color: string; children: string }) {
  return (
    <span className="inline-flex items-center gap-1">
      <i className="h-2.5 w-2.5 rounded-sm" style={{ background: color }} />
      {children}
    </span>
  );
}

export function ScenarioChart({
  points,
  mode,
  statutoryAge,
  staticMode = false,
}: {
  points: ScenarioPoint[];
  mode: ScenarioMode;
  /** 法定退休年龄文案，如 "63 岁" */
  statutoryAge: string;
  staticMode?: boolean;
}) {
  const boxRef = useRef<HTMLDivElement>(null);
  // 容器宽度：SSR / 首帧是 null，按宽屏渲染；挂载后量一次并跟随变化
  const [boxW, setBoxW] = useState<number | null>(null);
  const [active, setActive] = useState<number | null>(null);

  useEffect(() => {
    const el = boxRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const update = () => {
      const w = el.getBoundingClientRect().width;
      if (w > 0) setBoxW(w);
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // SVG 用 viewBox 缩放时文字会跟着缩小：k = viewBox 宽度 / 实际渲染宽度，fontSize = 12 * k 保持屏幕上 12px
  const k = boxW ? W / boxW : 1;
  const listMode = staticMode || (boxW !== null && boxW < NARROW_PX);

  const n = points.length;
  if (n === 0) {
    return <p className="rounded-lg bg-paper px-3 py-2 text-xs leading-relaxed text-muted">{mode === "flex" ? "已到可以弹性退休的年龄范围，没有可以比较的提前 / 延迟情景。" : "离法定退休不到一年，没有可以比较的停缴情景。"}</p>;
  }

  const fs = 12 * k;
  const padL = 8;
  const padR = 8;
  const colW = (W - padL - padR) / n;
  const barW = Math.min(colW * 0.62, 72);
  const labelW = Math.max(...points.map((p) => fmtMoney(p.total).length)) * fs * 0.62 + 6 * k;
  const padT = fs + 12 * k;
  const padB = fs * 2 + 14 * k;
  const plotH = 150 * Math.max(1, 0.9 * k);
  const H = padT + plotH + padB;
  const base = padT + plotH;
  const axisMax = Math.max(1, ...points.map((p) => p.total)) * 1.04;

  const currentIdx = points.findIndex((p) => p.isCurrent);
  const current = currentIdx >= 0 ? points[currentIdx] : undefined;
  // 没点选时，结论默认比较「最早」的那个点（和当前方案不同的第一个）
  const defaultFocus = points.findIndex((p) => !p.isCurrent);
  const focusIdx = active ?? (defaultFocus >= 0 ? defaultFocus : currentIdx);
  const focus = focusIdx >= 0 ? points[focusIdx] : undefined;
  const hasGray = points.some((p) => !p.meetsMinimum);

  const retireText = (p: ScenarioPoint) => `${p.retire.year} 年 ${p.retire.month} 月`;

  // ---- 结论 ----
  const lines: string[] = [];
  if (focus && current) {
    const diff = current.total - focus.total;
    const money = fmtMoney(Math.abs(diff));
    if (focus === current) {
      lines.push(`${mode === "flex" ? "法定退休" : "缴到退休"}，退休时每月实发约 ${fmtMoney(current.total)}。`);
    } else if (mode === "flex") {
      const gap = Math.abs((focus.ageMonths ?? 0) - (current.ageMonths ?? 0));
      const early = (focus.ageMonths ?? 0) < (current.ageMonths ?? 0);
      lines.push(
        `比法定${early ? "提前" : "推迟"} ${fmtYearsMonths(gap)}退休（${focus.label}，${retireText(focus)}），退休时每月实发${diff > 0 ? "少" : "多"}约 ${money}。` +
          (focus.meetsMinimum ? "" : "但这样缴费年限不够，按月领不了。"),
      );
      // 退休年份不同，实发数字里含了这几年计发基数的上涨；按今天的购买力再给一个对比
      const todayDiff = Math.abs(current.totalToday - focus.totalToday);
      lines.push(`其中一部分是${early ? "早退休时计发基数还没涨上去" : "晚退休时计发基数又涨了几年"}；按今天的购买力比，每月差约 ${fmtMoney(todayDiff)}。`);
    } else {
      lines.push(
        `${focus.label}、到 ${statutoryAge}再领，退休时每月实发约 ${fmtMoney(focus.total)}，比缴到退休${diff > 0 ? "少" : "多"} ${money}。` +
          (focus.meetsMinimum ? "" : "但这样缴费年限不够，按月领不了。"),
      );
    }
  }
  const note =
    mode === "flex"
      ? "弹性提前要满足最低缴费年限，最多提前 3 年且不低于原退休年龄；弹性延迟需本人自愿、单位同意，最多 3 年。"
      : "停缴后账户余额继续计息，但缴费年限不再增加；仍须满足最低缴费年限才能按月领。";

  // 坐标轴标签太挤时隔 stride 个显示一个（当前方案和选中的点一律显示，附近的让位）
  const stride = Math.max(1, Math.ceil((fs * 3.4) / colW));
  const showAxis = (i: number) =>
    stride === 1 ||
    i === currentIdx ||
    i === focusIdx ||
    (i % stride === 0 && (currentIdx < 0 || Math.abs(i - currentIdx) >= stride) && (focusIdx < 0 || Math.abs(i - focusIdx) >= stride));

  // 金额标注：列宽放得下就全标；放不下只标当前方案、选中柱、首尾柱（互相挨得太近的让位，当前方案优先）
  const labelled = new Set<number>();
  if (colW >= labelW) {
    points.forEach((_, i) => labelled.add(i));
  } else {
    for (const i of [currentIdx, focusIdx, 0, n - 1]) {
      if (i < 0 || labelled.has(i)) continue;
      if ([...labelled].every((j) => Math.abs(i - j) * colW >= labelW)) labelled.add(i);
    }
  }
  const showLabel = (i: number) => labelled.has(i);

  const maxTotal = Math.max(1, ...points.map((p) => p.total));
  const ariaFor = (p: ScenarioPoint) => `${p.label}，退休时每月实发约 ${fmtMoney(p.total)}${!p.meetsMinimum ? "，缴费年限不够" : ""}`;

  return (
    <div ref={boxRef}>
      <div className="mb-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
        <SeriesDot color="var(--accent)">基础养老金 + 过渡性</SeriesDot>
        <SeriesDot color="var(--series-social)">个人账户</SeriesDot>
        <span className="inline-flex items-center gap-1">
          <i className="h-2.5 w-2.5 rounded-sm border-[1.5px] border-ink" />
          当前方案
        </span>
      </div>

      {listMode ? (
      <div className="grid gap-1" role="group" aria-label={mode === "flex" ? "不同退休年龄下退休时每月实发养老金" : "不同停缴年龄下退休时每月实发养老金"}>
        {points.map((p, i) => {
          const gray = !p.meetsMinimum;
          const isCur = !!p.isCurrent;
          const isFocus = i === focusIdx;
          const wPersonal = (Math.max(0, p.personal) / maxTotal) * 100;
          const wTop = (Math.max(0, p.basic + p.transitional) / maxTotal) * 100;
          const rowCls = `grid min-h-10 w-full grid-cols-[4.5rem_minmax(0,1fr)_4.75rem] items-center gap-x-2 rounded-lg border px-2 py-1 text-left ${
            isCur ? "border-ink" : "border-transparent"
          } ${isFocus && !staticMode ? "bg-ink/5" : ""}`;
          const inner = (
            <>
              <span className={`text-[13px] leading-tight ${isCur ? "font-semibold text-ink" : "text-muted"}`}>{p.label}</span>
              <span className="flex h-4 min-w-0 overflow-hidden" style={{ opacity: isCur || isFocus ? 1 : 0.72 }}>
                <i className="block h-full rounded-l-[3px]" style={{ width: `${wPersonal}%`, background: gray ? GRAY_BOTTOM : "var(--series-social)" }} />
                <i className="block h-full rounded-r-[3px]" style={{ width: `${wTop}%`, background: gray ? GRAY_TOP : "var(--accent)", marginLeft: wPersonal > 0 && wTop > 0 ? 1 : 0 }} />
              </span>
              <span className={`whitespace-nowrap text-right text-sm tabular-nums ${gray ? "text-muted" : "text-ink"} ${isCur ? "font-semibold" : ""}`}>{fmtMoney(p.total)}</span>
            </>
          );
          return staticMode ? (
            <div key={p.key} className={rowCls}>
              {inner}
            </div>
          ) : (
            <button key={p.key} type="button" className={`${rowCls} cursor-pointer`} aria-pressed={isFocus} aria-label={ariaFor(p)} onClick={() => setActive(i)}>
              {inner}
            </button>
          );
        })}
      </div>
      ) : (
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full select-none" role="group" aria-label={mode === "flex" ? "不同退休年龄下退休时每月实发养老金" : "不同停缴年龄下退休时每月实发养老金"}>
        <line x1={padL} x2={W - padR} y1={base} y2={base} stroke="var(--line)" />
        {points.map((p, i) => {
          const cx = padL + colW * (i + 0.5);
          const x = cx - barW / 2;
          const hPersonal = Math.max(0, p.personal / axisMax) * plotH;
          const hTop = Math.max(0, (p.basic + p.transitional) / axisMax) * plotH;
          const hAll = hPersonal + hTop;
          const gray = !p.meetsMinimum;
          const isCur = !!p.isCurrent;
          const isFocus = i === focusIdx;
          const [l1, l2] = axisLines(p);
          // 金额标注贴着画布边缘时改成靠边对齐，免得被裁掉
          const valueText = fmtMoney(p.total);
          const halfW = (valueText.length * fs * 0.6) / 2;
          const vAnchor = cx - halfW < 0 ? "start" : cx + halfW > W ? "end" : "middle";
          const vX = vAnchor === "start" ? padL : vAnchor === "end" ? W - padR : cx;
          const select = () => setActive(i);
          return (
            <g
              key={p.key}
              opacity={isCur || isFocus ? 1 : 0.62}
              tabIndex={0}
              role="button"
              aria-label={ariaFor(p)}
              style={{ cursor: "pointer", outline: "none" }}
              onMouseEnter={select}
              onFocus={select}
              onClick={select}
            >
              <rect x={padL + colW * i} y={0} width={colW} height={H} fill={isFocus ? "#00000008" : "transparent"} />
              {hPersonal > 0 && <rect x={x} y={base - hPersonal} width={barW} height={hPersonal} fill={gray ? GRAY_BOTTOM : "var(--series-social)"} rx={3} />}
              {hTop > 0 && <rect x={x} y={base - hAll} width={barW} height={Math.max(0, hTop - 1.5)} fill={gray ? GRAY_TOP : "var(--accent)"} rx={3} />}
              {isCur && <rect x={x - 2} y={base - hAll - 2} width={barW + 4} height={hAll + 2} fill="none" stroke="var(--ink)" strokeWidth={1.5} rx={4} />}
              {showLabel(i) && (
                <text
                  x={vX}
                  y={base - hAll - 6 * k}
                  textAnchor={vAnchor}
                  fontSize={fs}
                  fill={gray ? "var(--muted)" : "var(--ink)"}
                  fontWeight={isCur ? 600 : 400}
                  style={{ fontVariantNumeric: "tabular-nums" }}
                >
                  {valueText}
                </text>
              )}
              {showAxis(i) && (
                <>
                  <text x={cx} y={base + fs + 4 * k} textAnchor="middle" fontSize={fs} fill={isCur ? "var(--ink)" : "var(--muted)"} fontWeight={isCur ? 600 : 400}>
                    {l1}
                  </text>
                  <text x={cx} y={base + fs * 2 + 5 * k} textAnchor="middle" fontSize={fs} fill={isCur ? "var(--ink)" : "var(--muted)"} fontWeight={isCur ? 600 : 400}>
                    {l2}
                  </text>
                </>
              )}
            </g>
          );
        })}
      </svg>
      )}

      {hasGray && <p className="mt-1 text-xs text-muted">灰色 = 缴费年限不够，按月领不了。</p>}

      <div className="mt-3 space-y-1.5">
        {lines.map((t) => (
          <p key={t} className="text-sm leading-relaxed text-ink">
            {t}
          </p>
        ))}
        {!staticMode && focus && focus !== current && (
          <p className="text-xs tabular-nums text-muted">
            {focus.label}：{retireText(focus)}起领，基础 + 过渡性 {fmtMoney(focus.basic + focus.transitional)} + 个人账户 {fmtMoney(focus.personal)} = {fmtMoney(focus.total)}（相当于今天的 {fmtMoney(focus.totalToday)}）。{listMode ? "点一行" : "点柱子"}可以看其他情景。
          </p>
        )}
        <p className="text-xs leading-relaxed text-muted">{note}</p>
      </div>
    </div>
  );
}
