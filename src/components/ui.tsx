"use client";

import { useEffect, useRef, useState, type ReactNode, type Ref, type SelectHTMLAttributes } from "react";
import { MONTH_NAMES } from "@/lib/tax";
import { clampNumber, formatNumeric, parseNumeric, sanitizeNumeric } from "@/lib/numericInput";

export function Card({
  title,
  subtitle,
  action,
  children,
  className = "",
  ref,
  id,
  tone = "result",
}: {
  title?: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  /** React 19：ref 作为普通 prop 传下去（导出图片时需要拿到这个 section） */
  ref?: Ref<HTMLElement>;
  id?: string;
  /** input = 你填的（无阴影）；result = 算出来的（轻阴影，默认） */
  tone?: "input" | "result";
}) {
  return (
    <section ref={ref} id={id} className={`min-w-0 rounded-2xl border border-line bg-white p-5 ${tone === "result" ? "shadow-sm" : ""} ${className}`}>
      {(title || action) && (
        <header className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            {title && <h2 className="text-base font-semibold text-ink">{title}</h2>}
            {subtitle && <p className="mt-0.5 text-xs leading-relaxed text-muted">{subtitle}</p>}
          </div>
          {action}
        </header>
      )}
      {children}
    </section>
  );
}

export function Field({ label, hint, children, className = "" }: { label: ReactNode; hint?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <label className={`flex flex-col gap-1 ${className}`}>
      <span className="whitespace-nowrap text-xs font-medium text-muted">{label}</span>
      {children}
      {hint && <span className="text-xs leading-relaxed text-muted">{hint}</span>}
    </label>
  );
}

export const inputCls =
  "h-11 w-full min-w-0 rounded-lg border border-line bg-white px-2.5 text-base text-ink outline-none transition-[border-color,box-shadow] duration-(--dur-fast) hover:border-muted/40 focus:border-accent focus:ring-2 focus:ring-accent/20 disabled:bg-paper disabled:text-muted sm:h-9 sm:text-sm";

/** 金额的「万」单位提示：40000 → 4 万，385000 → 38.5 万（保留 1 位小数，整数不带 .0） */
function wanHint(v: number | undefined): string | null {
  if (v === undefined || !Number.isFinite(v) || v < 10000) return null;
  return `${(v / 10000).toFixed(1).replace(/\.0$/, "")} 万`;
}

/** 数字输入框外壳：边框和焦点环画在外壳上，前缀 / 后缀 / 「万」提示与输入区并排，不会互相遮挡 */
const numberShellCls =
  "flex w-full min-w-0 items-center rounded-lg border border-line bg-white text-ink transition-[border-color,box-shadow] duration-(--dur-fast) hover:border-muted/40 focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/20";
const numberShellSize = "h-11 gap-1.5 px-2.5 text-base sm:h-9 sm:text-sm";
const numberShellDense = "h-8 gap-1 px-1.5 text-[13px]";

/**
 * 数字输入：普通文本框 + 数字键盘（不用 type=number——它会被鼠标滚轮改值、和页面滚动冲突，
 * 还接受 e / + / - 这类字符）。本地保留字符串，输入过程中不被外部格式化或夹值打断，失焦时再校正。
 */
export function NumberInput({
  value,
  onChange,
  prefix,
  suffix,
  min = 0,
  max,
  step,
  placeholder,
  disabled,
  className = "",
  dense = false,
  ariaLabel,
}: {
  value: number | undefined;
  onChange: (v: number) => void;
  prefix?: string;
  suffix?: string;
  min?: number;
  max?: number;
  step?: number;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  /** 紧凑：更小的内边距和字号（用于一排很多个的小输入框） */
  dense?: boolean;
  ariaLabel?: string;
}) {
  const [text, setText] = useState(() => formatNumeric(value));
  const [prevValue, setPrevValue] = useState(value);
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  /** 本次聚焦是不是鼠标 / 手指点进来的（是的话不全选，让光标停在点的位置） */
  const pointerFocus = useRef(false);
  // 外部 value 变化时同步本地文本（渲染期派生）；正在输入时不打断，失焦再统一校正
  if (value !== prevValue) {
    setPrevValue(value);
    if (!focused) {
      const cur = parseNumeric(text);
      if (value === undefined ? text !== "" : cur === undefined || Math.abs(cur - value) > 1e-9) setText(formatNumeric(value));
    }
  }
  const emit = (n: number) => onChange(n);
  const stepBy = (dir: 1 | -1) => {
    if (!step) return;
    const base = parseNumeric(text) ?? value ?? 0;
    const next = clampNumber(Math.round((base + dir * step) * 100) / 100, min, max);
    setText(formatNumeric(next));
    emit(next);
  };
  // 金额输入（带 ¥ 前缀）≥ 1 万时，在框内右侧提示几万，方便一眼看清位数；正在输入时收起，把宽度让给数字
  const unit = prefix === "¥" && !focused ? wanHint(value) : null;
  return (
    <div
      className={`${numberShellCls} ${dense ? numberShellDense : numberShellSize} ${disabled ? "bg-paper text-muted" : ""} ${className}`}
      onMouseDown={(e) => {
        // 点到前缀 / 后缀 / 空白处也聚焦输入框
        if (e.target !== inputRef.current) {
          e.preventDefault();
          pointerFocus.current = true;
          inputRef.current?.focus();
        }
      }}
    >
      {prefix && <span className="shrink-0 text-sm text-muted">{prefix}</span>}
      <input
        ref={inputRef}
        type="text"
        inputMode="decimal"
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        enterKeyHint="done"
        aria-label={ariaLabel}
        disabled={disabled}
        placeholder={placeholder}
        maxLength={13}
        className="h-full w-full min-w-0 flex-1 bg-transparent text-ink outline-none placeholder:text-muted/70 disabled:text-muted"
        value={text}
        onPointerDown={() => {
          pointerFocus.current = true;
        }}
        onFocus={(e) => {
          setFocused(true);
          // 只有用键盘 Tab 进来才全选（方便直接改数）；点进来的保持浏览器默认光标位置
          if (!pointerFocus.current) e.currentTarget.select();
          pointerFocus.current = false;
        }}
        onBlur={() => {
          setFocused(false);
          if (text === "" || value === undefined) return;
          const clamped = clampNumber(value, min, max);
          if (clamped !== value) emit(clamped);
          setText(formatNumeric(clamped));
        }}
        onKeyDown={(e) => {
          if (e.key === "ArrowUp" || e.key === "ArrowDown") {
            if (!step) return;
            e.preventDefault();
            stepBy(e.key === "ArrowUp" ? 1 : -1);
          } else if (e.key === "Enter") {
            e.currentTarget.blur();
          }
        }}
        onChange={(e) => {
          const clean = sanitizeNumeric(e.target.value);
          setText(clean);
          const n = parseNumeric(clean);
          if (n !== undefined) emit(n);
          else if (clean === "") emit(0);
        }}
      />
      {unit && (
        <span aria-hidden="true" className="shrink-0 whitespace-nowrap text-xs tabular-nums text-muted">
          {unit}
        </span>
      )}
      {suffix && <span className="shrink-0 whitespace-nowrap text-xs text-muted">{suffix}</span>}
    </div>
  );
}

export function TextInput({ value, onChange, placeholder, className = "", ariaLabel }: { value: string; onChange: (v: string) => void; placeholder?: string; className?: string; ariaLabel?: string }) {
  return <input type="text" aria-label={ariaLabel} className={`${inputCls} ${className}`} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />;
}

export function Select({ className = "", children, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={`${inputCls} appearance-none bg-[url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2212%22 height=%2212%22 viewBox=%220 0 24 24%22 fill=%22none%22 stroke=%22%2352514e%22 stroke-width=%222%22><path d=%22M6 9l6 6 6-6%22/></svg>')] bg-[length:12px] bg-[position:right_8px_center] bg-no-repeat pr-7 ${className}`} {...rest}>
      {children}
    </select>
  );
}

export function MonthSelect({ value, onChange, min = 1, max = 12, className = "" }: { value: number; onChange: (m: number) => void; min?: number; max?: number; className?: string }) {
  return (
    <Select value={value} onChange={(e) => onChange(Number(e.target.value))} className={className}>
      {MONTH_NAMES.map((n, i) => {
        const m = i + 1;
        return (
          <option key={m} value={m} disabled={m < min || m > max}>
            {n}
          </option>
        );
      })}
    </Select>
  );
}

export function Segmented<T extends string>({ value, options, onChange, label, className = "" }: { value: T; options: { value: T; label: ReactNode }[]; onChange: (v: T) => void; label: string; className?: string }) {
  const groupRef = useRef<HTMLDivElement>(null);
  const selIndex = options.findIndex((o) => o.value === value);
  /** 选中项的位置（相对容器内边距框）；量到之前选中项自己画白底，量到后交给滑块 */
  const [thumb, setThumb] = useState<{ x: number; y: number; w: number; h: number } | null>(null);

  useEffect(() => {
    const root = groupRef.current;
    if (!root) return;
    const measure = () => {
      const btn = root.querySelectorAll<HTMLButtonElement>(":scope > button")[selIndex];
      if (!btn || btn.offsetWidth === 0) {
        setThumb(null);
        return;
      }
      const next = { x: btn.offsetLeft, y: btn.offsetTop, w: btn.offsetWidth, h: btn.offsetHeight };
      setThumb((prev) => (prev && prev.x === next.x && prev.y === next.y && prev.w === next.w && prev.h === next.h ? prev : next));
    };
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(measure);
    ro.observe(root);
    root.querySelectorAll("button").forEach((b) => ro.observe(b));
    return () => ro.disconnect();
  }, [selIndex, options.length]);

  return (
    <div ref={groupRef} className={`relative inline-flex flex-wrap rounded-lg border border-line bg-paper p-0.5 text-sm ${className}`} role="radiogroup" aria-label={label}>
      {thumb && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute left-0 top-0 rounded-md bg-white shadow-sm transition-[transform,width,height] duration-(--dur-base) ease-(--ease-out)"
          style={{ width: thumb.w, height: thumb.h, transform: `translate(${thumb.x}px, ${thumb.y}px)` }}
        />
      )}
      {options.map((o, index) => {
        const selected = value === o.value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={selected}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(o.value)}
            onKeyDown={(e) => {
              const next = e.key === "Home" ? 0 : e.key === "End" ? options.length - 1
                : e.key === "ArrowRight" || e.key === "ArrowDown" ? (index + 1) % options.length
                : e.key === "ArrowLeft" || e.key === "ArrowUp" ? (index + options.length - 1) % options.length : null;
              if (next === null) return;
              e.preventDefault();
              onChange(options[next].value);
              groupRef.current?.querySelectorAll<HTMLButtonElement>(":scope > button")[next]?.focus();
            }}
            className={`relative min-h-11 rounded-md px-3 py-1 transition-colors duration-(--dur-fast) sm:min-h-0 ${selected ? `text-ink ${thumb ? "" : "bg-white shadow-sm"}` : "text-muted hover:text-ink active:bg-ink/5"}`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export function Button({
  children,
  onClick,
  variant = "secondary",
  className = "",
  type = "button",
  disabled = false,
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: "primary" | "secondary" | "ghost" | "danger";
  className?: string;
  type?: "button" | "submit";
  disabled?: boolean;
}) {
  const v = {
    primary: "bg-accent-text text-white hover:bg-[color-mix(in_oklab,var(--accent-text),black_14%)]",
    secondary: "border border-line bg-white text-ink hover:bg-paper",
    ghost: "text-muted hover:bg-paper hover:text-ink",
    danger: "text-danger-text hover:bg-danger/10",
  }[variant];
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex h-8 min-h-11 shrink-0 items-center gap-1 whitespace-nowrap rounded-lg px-3 text-sm font-medium transition-[background-color,color,transform,opacity] duration-(--dur-fast) ease-(--ease-out) enabled:active:scale-[.98] disabled:cursor-not-allowed disabled:opacity-50 sm:min-h-0 ${v} ${className}`}
    >
      {children}
    </button>
  );
}

/** 复制到剪贴板：成功后 copied 保持 1.5 秒；剪贴板不可用时退回 prompt 让用户手动复制 */
export function useCopy(ms = 1500) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  const copy = async (text: string, promptLabel = "复制这个链接：") => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), ms);
    } catch {
      window.prompt(promptLabel, text);
    }
  };
  return { copied, copy };
}

/** 复制类按钮：点击后变成「已复制 ✓」1.5 秒再恢复，全站统一 */
export function CopyButton({
  text,
  label = "复制链接",
  promptLabel,
  variant = "secondary",
  className = "",
}: {
  /** 传函数则点击时才计算（链接要压缩序列化，别每次渲染都算） */
  text: string | (() => string);
  label?: string;
  promptLabel?: string;
  variant?: "primary" | "secondary" | "ghost";
  className?: string;
}) {
  const { copied, copy } = useCopy();
  return (
    <>
      <Button variant={variant} className={`min-w-[5.75rem] justify-center ${className}`} onClick={() => copy(typeof text === "function" ? text() : text, promptLabel)}>
        {copied ? "已复制 ✓" : label}
      </Button>
      <span role="status" className="sr-only">
        {copied ? "已复制" : ""}
      </span>
    </>
  );
}

/** 触屏上正在往文字 / 数字框里输入：软键盘很可能已经弹出 */
function useTouchTyping(): boolean {
  const [typing, setTyping] = useState(false);
  useEffect(() => {
    if (typeof window.matchMedia !== "function" || !window.matchMedia("(pointer: coarse)").matches) return;
    const check = () => {
      const el = document.activeElement;
      const editable =
        el instanceof HTMLTextAreaElement ||
        (el instanceof HTMLInputElement && !["checkbox", "radio", "button", "submit", "range", "color", "file"].includes(el.type));
      setTyping(editable);
    };
    // focusout 后下一个 focusin 才到：错开一拍再看，输入框之间切换时底部条不会闪
    const onChange = () => setTimeout(check, 0);
    document.addEventListener("focusin", onChange);
    document.addEventListener("focusout", onChange);
    return () => {
      document.removeEventListener("focusin", onChange);
      document.removeEventListener("focusout", onChange);
    };
  }, []);
  return typing;
}

/**
 * 手机底部结果条：出现 / 隐藏用上下滑动，隐藏时不可聚焦。
 * 触屏上输入时（软键盘弹出）也收起，免得盖住正在填的输入框。
 */
export function MobileBar({ show = true, children }: { show?: boolean; children: ReactNode }) {
  const typing = useTouchTyping();
  show = show && !typing;
  return (
    <div
      inert={!show}
      aria-hidden={!show}
      className={`fixed inset-x-0 bottom-0 z-40 border-t border-line bg-white px-4 py-2.5 pb-[max(0.625rem,env(safe-area-inset-bottom))] transition-transform duration-(--dur-panel) ease-(--ease-out) lg:hidden ${show ? "translate-y-0" : "translate-y-full"}`}
    >
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3">{children}</div>
    </div>
  );
}

export function Stat({ label, value, sub, tone = "default", big = false }: { label: ReactNode; value: ReactNode; sub?: ReactNode; tone?: "default" | "good" | "bad" | "accent"; big?: boolean }) {
  const color = { default: "text-ink", good: "text-good-text", bad: "text-danger-text", accent: "text-accent-text" }[tone];
  return (
    <div className="px-3 py-2.5">
      <div className="text-xs text-muted">{label}</div>
      <div className={`mt-1 whitespace-nowrap font-semibold tabular-nums ${big ? "text-3xl" : "text-xl @max-[20rem]:text-lg"} ${color}`}>{value}</div>
      {sub && <div className="mt-0.5 text-xs leading-relaxed text-muted">{sub}</div>}
    </div>
  );
}

export function Hint({ children }: { children: ReactNode }) {
  return <p className="rounded-lg bg-paper px-3 py-2 text-xs leading-relaxed text-muted">{children}</p>;
}

export function Details({ summary, children, open }: { summary: ReactNode; children: ReactNode; open?: boolean }) {
  return (
    <details className="ui-details group" open={open}>
      <summary className="group/summary flex cursor-pointer select-none items-start gap-1 rounded text-xs active:opacity-60 font-medium leading-relaxed text-accent-text">
        <svg aria-hidden="true" viewBox="0 0 24 24" className="ui-details-chev mt-[3px] h-3.5 w-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 6l6 6-6 6" />
        </svg>
        <span className="group-hover/summary:underline">{summary}</span>
      </summary>
      <div className="mt-3">{children}</div>
    </details>
  );
}
