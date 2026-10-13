import { describe, expect, it } from "vitest";
import { clampNumber, formatNumeric, parseNumeric, sanitizeNumeric } from "@/lib/numericInput";

describe("sanitizeNumeric", () => {
  it("只保留数字和一个小数点", () => {
    expect(sanitizeNumeric("1e5")).toBe("15");
    expect(sanitizeNumeric("+20-00")).toBe("2000");
    expect(sanitizeNumeric("1.2.3")).toBe("1.23");
    expect(sanitizeNumeric("abc")).toBe("");
  });

  it("粘贴带千分位、货币符号、空格的金额", () => {
    expect(sanitizeNumeric("¥40,000")).toBe("40000");
    expect(sanitizeNumeric(" 12 345.6 ")).toBe("12345.6");
    expect(sanitizeNumeric("12%")).toBe("12");
  });

  it("全角数字和句点转半角", () => {
    expect(sanitizeNumeric("２５０００")).toBe("25000");
    expect(sanitizeNumeric("３．５")).toBe("3.5");
    expect(sanitizeNumeric("3。5")).toBe("3.5");
  });

  it("限制整数位数和小数位数", () => {
    expect(sanitizeNumeric("12345678901234")).toBe("123456789");
    expect(sanitizeNumeric("1.23456")).toBe("1.23");
    expect(sanitizeNumeric("99", { maxIntDigits: 1 })).toBe("9");
    expect(sanitizeNumeric("1.5", { maxDecimals: 0 })).toBe("1");
  });

  it("前导零收成一个，保留正在输入的小数点", () => {
    expect(sanitizeNumeric("007")).toBe("7");
    expect(sanitizeNumeric("0")).toBe("0");
    expect(sanitizeNumeric("0.5")).toBe("0.5");
    expect(sanitizeNumeric(".5")).toBe("0.5");
    expect(sanitizeNumeric("12.")).toBe("12.");
  });
});

describe("parseNumeric / formatNumeric / clampNumber", () => {
  it("解析", () => {
    expect(parseNumeric("")).toBeUndefined();
    expect(parseNumeric(".")).toBeUndefined();
    expect(parseNumeric("12.")).toBe(12);
    expect(parseNumeric("0.5")).toBe(0.5);
  });

  it("格式化不出现科学计数法和浮点尾巴", () => {
    expect(formatNumeric(undefined)).toBe("");
    expect(formatNumeric(25000)).toBe("25000");
    expect(formatNumeric(0.1 + 0.2)).toBe("0.3");
    expect(formatNumeric(4443.155)).toBe("4443.16");
    expect(formatNumeric(123456789)).toBe("123456789");
    expect(formatNumeric(12.5)).toBe("12.5");
  });

  it("夹到区间", () => {
    expect(clampNumber(25, 0, 20)).toBe(20);
    expect(clampNumber(-1, 0)).toBe(0);
    expect(clampNumber(5)).toBe(5);
  });
});
