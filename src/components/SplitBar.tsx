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
  className = "",
}: {
  segments: SplitSegment[];
  /** 图例前面的总量说明，如「税前 ¥300,000：」 */
  lead?: ReactNode;
  onDark?: boolean;
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
                className="block h-full min-w-[3px] rounded-full transition-[width] duration-300 ease-[cubic-bezier(.2,.7,.2,1)]"
                style={{ width: `${(p.value / total) * 100}%`, background: p.color }}
              />
            ),
        )}
      </div>
      <p className={`mt-2 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs leading-relaxed tabular-nums ${onDark ? "text-white/70" : "text-muted"}`}>
        {lead && <span>{lead}</span>}
        {parts.map((p) => (
          <span key={p.key} className="inline-flex items-center gap-1">
            <i className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: p.color }} aria-hidden="true" />
            {p.label} {fmtMoney(p.value)}
          </span>
        ))}
      </p>
    </div>
  );
}
