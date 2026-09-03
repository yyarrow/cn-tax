export function fmtMoney(n: number, digits = 0): string {
  const sign = n < 0 ? "-" : "";
  return `${sign}¥${Math.abs(n).toLocaleString("zh-CN", { maximumFractionDigits: digits, minimumFractionDigits: digits })}`;
}

export function fmtNum(n: number, digits = 0): string {
  return n.toLocaleString("zh-CN", { maximumFractionDigits: digits, minimumFractionDigits: digits });
}

export function fmtPct(r: number, digits = 1): string {
  return `${(r * 100).toFixed(digits)}%`;
}

export function uid(): string {
  return Math.random().toString(36).slice(2, 9);
}
