"use client";

import { MONTH_NAMES, type Segment } from "@/lib/tax";

export const SEGMENT_COLORS = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#4a3aa7"];

export function segmentColor(index: number) {
  return SEGMENT_COLORS[index % SEGMENT_COLORS.length];
}

export function Timeline({ segments, currentMonth }: { segments: Segment[]; currentMonth: number }) {
  return (
    <div>
      <div className="grid grid-cols-12 gap-1">
        {MONTH_NAMES.map((n, i) => {
          const m = i + 1;
          const covering = segments
            .map((s, idx) => ({ s, idx }))
            .filter(({ s }) => m >= s.startMonth && m <= s.endMonth);
          const isGap = covering.length === 0;
          return (
            <div key={m} className="flex flex-col items-center gap-1">
              <div
                className={`h-8 w-full overflow-hidden rounded-md ${isGap ? "border border-dashed border-line bg-white" : ""}`}
                title={isGap ? `${n}：无工作` : covering.map(({ s }) => s.name || "工作").join(" + ")}
              >
                {covering.map(({ idx }) => (
                  <div key={idx} className="h-full w-full" style={{ background: segmentColor(idx), height: `${100 / covering.length}%`, opacity: m > currentMonth ? 0.45 : 1 }} />
                ))}
              </div>
              <span className={`text-[10px] ${m === currentMonth ? "font-semibold text-ink" : "text-muted"}`}>{n}</span>
            </div>
          );
        })}
      </div>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted">
        {segments.map((s, idx) => (
          <span key={s.id} className="inline-flex items-center gap-1">
            <i className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: segmentColor(idx) }} />
            {s.name || `工作 ${idx + 1}`}
          </span>
        ))}
        <span className="inline-flex items-center gap-1">
          <i className="inline-block h-2.5 w-2.5 rounded-sm border border-dashed border-line bg-white" />
          空档（无收入）
        </span>
        {currentMonth > 0 && currentMonth < 12 && <span>浅色 = 未来月份（预测）</span>}
      </div>
    </div>
  );
}
