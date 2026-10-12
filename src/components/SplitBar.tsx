import type { ReactNode } from "react";
import { fmtMoney } from "@/lib/format";

export interface SplitSegment {
  key: string;
  label: string;
  value: number;
  /** 例如 var(--series-net) */
  color: string;
}

/**
 * 头条卡下的比例条：一根细横条按比例分段，下面一行小字图例。
 * 各段宽度变化有过渡（减弱动态效果时全局关闭）。
 */
export function SplitBar({
  segments,
  lead,
  onDark = false,
  stack = false,
  className = "",
}: {
  segments: SplitSegment[];
  /** 图例前面的总量说明，如「税前 ¥300,000：」 */
  lead?: ReactNode;
  onDark?: boolean;
  /** 窄卡片里（如年终奖的两张对比卡）图例改成每项一行：标签靠左、金额靠右 */
  stack?: boolean;
  className?: string;
}) {
  const parts = segments.map((s) => ({ ...s, value: Math.max(0, s.value) }));
  const total = parts.reduce((sum, s) => sum + s.value, 0);
  if (total <= 0) return null;
  return (
    <div className={className}>
      <div
        role="img"
        aria-label={parts.map((p) => `${p.label} ${fmtMoney(p.value)}`).join("，")}
        className={`flex h-1.5 gap-0.5 overflow-hidden rounded-full ${onDark ? "bg-white/10" : "bg-paper"}`}
      >
        {parts.map(
          (p) =>
            p.value > 0 && (
              <i
                key={p.key}
                className="block h-full min-w-[3px] rounded-full transition-[width] duration-(--dur-slow) ease-(--ease-out)"
                style={{ width: `${(p.value / total) * 100}%`, background: p.color }}
              />
            ),
        )}
      </div>
      {stack ? (
        <div className={`mt-2 space-y-0.5 text-xs leading-relaxed tabular-nums ${onDark ? "text-white/70" : "text-muted"}`}>
          {lead && <p>{lead}</p>}
          {parts.map((p) => (
            <div key={p.key} className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-1 whitespace-nowrap">
                <i className="inline-block h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: p.color }} aria-hidden="true" />
                {p.label}
              </span>
              <span className={onDark ? "text-white" : "text-ink"}>{fmtMoney(p.value)}</span>
            </div>
          ))}
        </div>
      ) : (
      /* 手机：lead 一行，各项「色点 + 标签 / 金额」等宽 N 列；桌面：全部排成一行 */
      <div className={`mt-2 text-xs leading-relaxed tabular-nums sm:flex sm:flex-wrap sm:items-center sm:gap-x-3 sm:gap-y-0.5 ${onDark ? "text-white/70" : "text-muted"}`}>
        {lead && <p className="mb-1.5 sm:mb-0">{lead}</p>}
        <div className="grid gap-x-2 sm:contents" style={{ gridTemplateColumns: `repeat(${parts.length}, minmax(0, 1fr))` }}>
          {parts.map((p) => (
            <div key={p.key} className="min-w-0 sm:flex sm:items-center sm:gap-1">
              <span className="flex items-center gap-1 whitespace-nowrap">
                <i className="inline-block h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: p.color }} aria-hidden="true" />
                {p.label}
              </span>
              <span className={`block pl-2.5 text-[13px] font-medium sm:inline sm:pl-0 sm:text-xs sm:font-normal sm:text-inherit ${onDark ? "text-white" : "text-ink"}`}>{fmtMoney(p.value)}</span>
            </div>
          ))}
        </div>
      </div>
      )}
    </div>
  );
}
