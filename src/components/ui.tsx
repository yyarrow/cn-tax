"use client";

import { useState, type ReactNode, type Ref, type SelectHTMLAttributes } from "react";
import { MONTH_NAMES } from "@/lib/tax";

export function Card({
  title,
  subtitle,
  action,
  children,
  className = "",
  ref,
  id,
}: {
  title?: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  /** React 19：ref 作为普通 prop 传下去（导出图片时需要拿到这个 section） */
  ref?: Ref<HTMLElement>;
  id?: string;
}) {
  return (
    <section ref={ref} id={id} className={`min-w-0 rounded-2xl border border-line bg-white p-5 shadow-sm ${className}`}>
      {(title || action) && (
        <header className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            {title && <h2 className="text-base font-semibold text-ink">{title}</h2>}
            {subtitle && <p className="mt-0.5 text-xs text-muted">{subtitle}</p>}
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
      {hint && <span className="text-xs text-muted/80">{hint}</span>}
    </label>
  );
}

const inputCls =
  "h-11 w-full min-w-0 rounded-lg border border-line bg-white px-2.5 text-base text-ink outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20 disabled:bg-paper disabled:text-muted sm:h-9 sm:text-sm";

/** 数字输入：本地保留字符串，避免输入过程被格式化打断 */
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
  const [text, setText] = useState(value === undefined || Number.isNaN(value) ? "" : String(value));
  const [prevValue, setPrevValue] = useState(value);
  // 外部 value 变化时同步本地文本（渲染期间派生状态，避免多余的 effect）
  if (value !== prevValue) {
    setPrevValue(value);
    const cur = parseFloat(text);
    if (value === undefined) {
      if (text !== "") setText("");
    } else if (Number.isNaN(cur) || Math.abs(cur - value) > 1e-9) {
      setText(String(value));
    }
  }
  return (
    <div className={`relative ${className}`}>
      {prefix && <span className="pointer-events-none absolute inset-y-0 left-2.5 flex items-center text-sm text-muted">{prefix}</span>}
      <input
        type="number"
        inputMode="decimal"
        aria-label={ariaLabel}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        placeholder={placeholder}
        className={`${inputCls} ${prefix ? "pl-7" : ""} ${suffix ? "pr-9" : ""} ${dense ? "h-8 px-1.5 text-[13px]" : ""}`}
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          const n = parseFloat(e.target.value);
          if (!Number.isNaN(n)) onChange(n);
          else if (e.target.value === "") onChange(0);
        }}
      />
      {suffix && <span className="pointer-events-none absolute inset-y-0 right-2.5 flex items-center text-xs text-muted">{suffix}</span>}
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
  return (
    <div className={`inline-flex flex-wrap rounded-lg border border-line bg-paper p-0.5 text-sm ${className}`} role="radiogroup" aria-label={label}>
      {options.map((o, index) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          tabIndex={value === o.value ? 0 : -1}
          onClick={() => onChange(o.value)}
          onKeyDown={(e) => {
            const next = e.key === "Home" ? 0 : e.key === "End" ? options.length - 1
              : e.key === "ArrowRight" || e.key === "ArrowDown" ? (index + 1) % options.length
              : e.key === "ArrowLeft" || e.key === "ArrowUp" ? (index + options.length - 1) % options.length : null;
            if (next === null) return;
            e.preventDefault();
            onChange(options[next].value);
            (e.currentTarget.parentElement?.children[next] as HTMLButtonElement)?.focus();
          }}
          className={`min-h-11 rounded-md px-3 py-1 transition sm:min-h-0 ${value === o.value ? "bg-white text-ink shadow-sm" : "text-muted hover:text-ink"}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Button({ children, onClick, variant = "secondary", className = "", type = "button" }: { children: ReactNode; onClick?: () => void; variant?: "primary" | "secondary" | "ghost" | "danger"; className?: string; type?: "button" | "submit" }) {
  const v = {
    primary: "bg-accent-text text-white hover:bg-accent-text/90",
    secondary: "border border-line bg-white text-ink hover:bg-paper",
    ghost: "text-muted hover:bg-paper hover:text-ink",
    danger: "text-danger-text hover:bg-danger/10",
  }[variant];
  return (
    <button type={type} onClick={onClick} className={`inline-flex h-8 min-h-11 shrink-0 items-center gap-1 whitespace-nowrap rounded-lg px-3 text-sm font-medium transition sm:min-h-0 ${v} ${className}`}>
      {children}
    </button>
  );
}

export function Stat({ label, value, sub, tone = "default", big = false }: { label: ReactNode; value: ReactNode; sub?: ReactNode; tone?: "default" | "good" | "bad" | "accent"; big?: boolean }) {
  const color = { default: "text-ink", good: "text-good-text", bad: "text-danger-text", accent: "text-accent-text" }[tone];
  return (
    <div className="px-3 py-2.5">
      <div className="text-xs text-muted">{label}</div>
      <div className={`mt-1 whitespace-nowrap font-semibold tabular-nums ${big ? "text-3xl" : "text-xl @max-[20rem]:text-lg"} ${color}`}>{value}</div>
      {sub && <div className="mt-0.5 text-xs text-muted">{sub}</div>}
    </div>
  );
}

export function Hint({ children }: { children: ReactNode }) {
  return <p className="rounded-lg bg-paper px-3 py-2 text-xs leading-relaxed text-muted">{children}</p>;
}

export function Details({ summary, children, open }: { summary: ReactNode; children: ReactNode; open?: boolean }) {
  return (
    <details className="group" open={open}>
      <summary className="cursor-pointer select-none text-xs font-medium text-accent-text hover:underline">{summary}</summary>
      <div className="mt-3">{children}</div>
    </details>
  );
}
