/** 数字输入框的纯逻辑：清洗输入文本、格式化显示值（不依赖 React，便于测试） */

export interface NumericOptions {
  /** 整数部分最多几位（默认 9 位，到亿级） */
  maxIntDigits?: number;
  /** 小数最多几位（默认 2 位） */
  maxDecimals?: number;
}

const FULL_WIDTH_DIGIT = /[０-９]/g;

/**
 * 把用户输入 / 粘贴的文本清洗成「数字 + 至多一个小数点」：
 * 全角数字和句点转半角，去掉千分位逗号、空格、¥、% 等，多余的小数点和超长位数直接丢弃，
 * 前导零收成一个（"007" → "7"，"0.5" 保留）。
 */
export function sanitizeNumeric(raw: string, { maxIntDigits = 9, maxDecimals = 2 }: NumericOptions = {}): string {
  const s = raw
    .replace(FULL_WIDTH_DIGIT, (d) => String.fromCharCode(d.charCodeAt(0) - 0xfee0))
    .replace(/[．。]/g, ".")
    .replace(/[^\d.]/g, "");
  const dot = s.indexOf(".");
  let int = dot === -1 ? s : s.slice(0, dot);
  let dec = dot === -1 ? "" : s.slice(dot + 1).replace(/\./g, "");
  int = int.replace(/^0+(?=\d)/, "").slice(0, maxIntDigits);
  dec = dec.slice(0, maxDecimals);
  if (dot === -1 || maxDecimals === 0) return int;
  return `${int || "0"}.${dec}`;
}

/** 文本 → 数值；空串或只有小数点时返回 undefined */
export function parseNumeric(text: string): number | undefined {
  if (text === "" || text === ".") return undefined;
  const n = Number(text);
  return Number.isFinite(n) ? n : undefined;
}

/** 数值 → 输入框里显示的文本（不用科学计数法，最多 2 位小数，去掉末尾的 0） */
export function formatNumeric(value: number | undefined, maxDecimals = 2): string {
  if (value === undefined || !Number.isFinite(value)) return "";
  const f = 10 ** maxDecimals;
  const rounded = Math.round(value * f) / f;
  return rounded.toFixed(maxDecimals).replace(/\.?0+$/, "");
}

/** 夹到 [min, max] 区间（没给的边界不限制） */
export function clampNumber(v: number, min?: number, max?: number): number {
  let n = v;
  if (min !== undefined && n < min) n = min;
  if (max !== undefined && n > max) n = max;
  return n;
}
