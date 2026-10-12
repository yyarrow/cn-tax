"use client";

import { useEffect, useRef, useState } from "react";
import { fmtMoney } from "@/lib/format";
import { useReducedMotion } from "@/lib/useReducedMotion";

const DURATION_MS = 300;

/**
 * 金额数字：值变化时在 ~300ms 内补间到新值，并给一次短暂的底色提示「这里变了」。
 * 首次渲染不动画；系统设了「减弱动态效果」时直接显示新值。
 */
export function AnimatedMoney({
  value,
  format = fmtMoney,
  className = "",
  onDark = false,
}: {
  value: number;
  format?: (n: number) => string;
  className?: string;
  /** 深色底（头条卡）上用白色高亮 */
  onDark?: boolean;
}) {
  const reduced = useReducedMotion();
  const [shown, setShown] = useState(value);
  /** 补间被打断时从当前显示值继续，而不是从旧终点重来 */
  const shownRef = useRef(value);
  // 渲染期派生：值一变就换 key，让高亮动画重新播放
  const [prevValue, setPrevValue] = useState(value);
  const [flashKey, setFlashKey] = useState(0);
  if (!Object.is(value, prevValue)) {
    setPrevValue(value);
    if (Number.isFinite(value)) setFlashKey(flashKey + 1);
  }

  useEffect(() => {
    if (reduced || !Number.isFinite(value)) {
      shownRef.current = value;
      return;
    }
    const from = shownRef.current;
    if (from === value) return;
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, Math.max(0, (now - start) / DURATION_MS));
      const v = t >= 1 ? value : from + (value - from) * (1 - Math.pow(1 - t, 3));
      shownRef.current = v;
      setShown(v);
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, reduced]);

  const display = reduced ? value : shown;
  return (
    <span key={flashKey} className={`money tabular-nums ${onDark ? "money-on-dark" : ""} ${flashKey > 0 ? "money-flash" : ""} ${className}`}>
      {format(display)}
    </span>
  );
}
