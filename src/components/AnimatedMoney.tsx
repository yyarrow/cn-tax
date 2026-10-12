"use client";

import { useEffect, useRef, useState } from "react";
import { fmtMoney } from "@/lib/format";
import { useArmed } from "@/lib/useArmed";
import { useReducedMotion } from "@/lib/useReducedMotion";

const DURATION_MS = 300;
/** 值稳定这么久才闪一次高亮（连续敲键盘时不会每个键都闪） */
const FLASH_DEBOUNCE_MS = 180;
/** 挂载后这段时间内的变化视为「恢复存档 / 分享链接预填」，直接到位，不补间也不闪 */
const RESTORE_WINDOW_MS = 600;

/**
 * 金额数字：值变化时在 ~300ms 内补间到新值（连续输入时持续跟随）；
 * 值稳定后再给一次短暂的底色提示「这里变了」。
 * 首次渲染和刚挂载时的恢复不动画；系统设了「减弱动态效果」时直接显示新值。
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
  const settled = useArmed(RESTORE_WINDOW_MS);
  const still = reduced || !settled;
  const [shown, setShown] = useState(value);
  // 跳过补间时（减弱动态效果 / 刚挂载）渲染期直接对齐
  if (still && shown !== value) setShown(value);
  /** 补间被打断时从当前显示值继续，而不是从旧终点重来 */
  const shownRef = useRef(value);
  useEffect(() => {
    shownRef.current = shown;
  });
  /** 上一次已经（或不需要）闪过的值 */
  const flashedRef = useRef(value);
  const [flashKey, setFlashKey] = useState(0);

  useEffect(() => {
    if (still || !Number.isFinite(value)) return;
    const from = shownRef.current;
    if (from === value) return;
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, Math.max(0, (now - start) / DURATION_MS));
      const v = t >= 1 ? value : from + (value - from) * (1 - Math.pow(1 - t, 3));
      setShown(v);
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, still]);

  useEffect(() => {
    if (still || !Number.isFinite(value)) {
      flashedRef.current = value;
      return;
    }
    if (Object.is(flashedRef.current, value)) return;
    const id = setTimeout(() => {
      flashedRef.current = value;
      setFlashKey((k) => k + 1);
    }, FLASH_DEBOUNCE_MS);
    return () => clearTimeout(id);
  }, [value, still]);

  return (
    <span key={flashKey} className={`money tabular-nums ${onDark ? "money-on-dark" : ""} ${flashKey > 0 ? "money-flash" : ""} ${className}`}>
      {format(shown)}
    </span>
  );
}
