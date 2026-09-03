"use client";

import { useState, type ReactNode, type SelectHTMLAttributes } from "react";
import { MONTH_NAMES } from "@/lib/tax";

export function Card({ title, subtitle, action, children, className = "" }: { title?: ReactNode; subtitle?: ReactNode; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-2xl border border-line bg-white p-5 shadow-sm ${className}`}>
      {(title || action) && (
        <header className="mb-4 flex items-start justify-between gap-3">
          <div>
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
      <span className="text-xs font-medium text-muted">{label}</span>
      {children}
      {hint && <span className="text-[11px] text-muted/80">{hint}</span>}
    </label>
  );
}

const inputCls =
  "h-9 w-full rounded-lg border border-line bg-white px-2.5 text-sm text-ink outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20 disabled:bg-paper disabled:text-muted";

/** 数字输入：本地保留字符串，避免输入过程被格式化打断 */
export function NumberInput({
  value,
  onChange,
  prefix,
  suffix,
  min = 0,
  step,
  placeholder,
  disabled,
  className = "",
}: {
  value: number | undefined;
  onChange: (v: number) => void;
  prefix?: string;
  suffix?: string;
  min?: number;
  step?: number;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
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
        min={min}
        step={step}
        disabled={disabled}
        placeholder={placeholder}
        className={`${inputCls} ${prefix ? "pl-7" : ""} ${suffix ? "pr-9" : ""}`}
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

export function TextInput({ value, onChange, placeholder, className = "" }: { value: string; onChange: (v: string) => void; placeholder?: string; className?: string }) {
  return <input type="text" className={`${inputCls} ${className}`} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />;
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

export function Segmented<T extends string>({ value, options, onChange, className = "" }: { value: T; options: { value: T; label: ReactNode }[]; onChange: (v: T) => void; className?: string }) {
  return (
    <div className={`inline-flex rounded-lg border border-line bg-paper p-0.5 text-sm ${className}`} role="radiogroup">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={`rounded-md px-3 py-1 transition ${value === o.value ? "bg-white text-ink shadow-sm" : "text-muted hover:text-ink"}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Button({ children, onClick, variant = "secondary", className = "", type = "button" }: { children: ReactNode; onClick?: () => void; variant?: "primary" | "secondary" | "ghost" | "danger"; className?: string; type?: "button" | "submit" }) {
  const v = {
    primary: "bg-accent text-white hover:bg-accent/90",
    secondary: "border border-line bg-white text-ink hover:bg-paper",
    ghost: "text-muted hover:bg-paper hover:text-ink",
    danger: "text-danger hover:bg-danger/10",
  }[variant];
  return (
    <button type={type} onClick={onClick} className={`inline-flex h-8 shrink-0 items-center gap-1 whitespace-nowrap rounded-lg px-3 text-sm font-medium transition ${v} ${className}`}>
      {children}
    </button>
  );
}

export function Stat({ label, value, sub, tone = "default", big = false }: { label: ReactNode; value: ReactNode; sub?: ReactNode; tone?: "default" | "good" | "bad" | "accent"; big?: boolean }) {
  const color = { default: "text-ink", good: "text-good", bad: "text-danger", accent: "text-accent" }[tone];
  return (
    <div className="rounded-xl bg-paper px-4 py-3">
      <div className="text-xs text-muted">{label}</div>
      <div className={`mt-1 font-semibold tabular-nums ${big ? "text-3xl" : "text-xl"} ${color}`}>{value}</div>
      {sub && <div className="mt-0.5 text-[11px] text-muted">{sub}</div>}
    </div>
  );
}

export function Hint({ children }: { children: ReactNode }) {
  return <p className="rounded-lg bg-paper px-3 py-2 text-xs leading-relaxed text-muted">{children}</p>;
}

export function Details({ summary, children, open }: { summary: ReactNode; children: ReactNode; open?: boolean }) {
  return (
    <details className="group" open={open}>
      <summary className="cursor-pointer select-none text-xs font-medium text-accent hover:underline">{summary}</summary>
      <div className="mt-3">{children}</div>
    </details>
  );
}
