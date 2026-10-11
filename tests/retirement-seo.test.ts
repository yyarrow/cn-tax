import { describe, expect, it } from "vitest";
import {
  PENSION_REGIONS,
  RETIREMENT_TABLE_YEARS,
  flexibleRetirement,
  minContributionMonths,
  retirementTable,
  statutoryRetirement,
} from "@/lib/pension";
import { faq as ageFaq } from "@/content/retirement-age";
import { GAP_30Y, REGIONS_DESC, faq as baseFaq } from "@/content/pension-base";

const answer = (faq: { q: string; a: string }[], q: string) => faq.find((f) => f.q.includes(q))?.a ?? "";

describe("弹性退休区间", () => {
  it("1985-06 男：法定 63 岁，最早 60 岁（提前 3 年），最晚 66 岁", () => {
    const f = flexibleRetirement(1985, 6, "male");
    expect(f.earliest).toMatchObject({ ageYears: 60, ageMonths: 0, year: 2045, month: 6 });
    expect(f.latest).toMatchObject({ ageYears: 66, ageMonths: 0, year: 2051, month: 6 });
  });
  it("1975-01 男：法定 62 岁 7 个月，提前不能早于原 60 岁", () => {
    const f = flexibleRetirement(1975, 1, "male");
    expect(f.earliest).toMatchObject({ ageYears: 60, ageMonths: 0, year: 2035, month: 1 });
    expect(f.latest).toMatchObject({ ageYears: 65, ageMonths: 7, year: 2040, month: 8 });
  });
  it("1990-01 女原 50：法定 55 岁，最早 52 岁", () => {
    expect(flexibleRetirement(1990, 1, "female50").earliest).toMatchObject({ ageYears: 52, ageMonths: 0, year: 2042, month: 1 });
  });
});

describe("延迟退休对照表", () => {
  it("覆盖范围：首行已开始延迟，末行全年都到最终年龄，首行之前不延迟", () => {
    for (const c of ["male", "female55", "female50"] as const) {
      const [from, to] = RETIREMENT_TABLE_YEARS[c];
      const rows = retirementTable(c);
      expect(rows[0].birthYear).toBe(from);
      expect(rows[rows.length - 1].birthYear).toBe(to);
      expect(statutoryRetirement(from - 1, 12, c).delayMonths).toBe(0);
      expect(rows[0].jan.delayMonths).toBe(1);
      const cap = { male: 36, female55: 36, female50: 60 }[c];
      expect(rows[rows.length - 1].jan.delayMonths).toBe(cap);
      // 末行是第一个全年封顶的年份：前一年 1 月未封顶
      expect(statutoryRetirement(to - 1, 12, c).delayMonths).toBe(cap);
      expect(statutoryRetirement(to - 1, 1, c).delayMonths).toBeLessThan(cap);
    }
  });
  it("1975 男：1 月 62 岁 7 个月 2037-08，12 月 62 岁 9 个月 2038-09", () => {
    const row = retirementTable("male").find((r) => r.birthYear === 1975)!;
    expect(row.jan).toMatchObject({ ageYears: 62, ageMonths: 7, year: 2037, month: 8 });
    expect(row.dec).toMatchObject({ ageYears: 62, ageMonths: 9, year: 2038, month: 9 });
  });
});

describe("退休年龄页文案与引擎一致", () => {
  it("1970 男", () => {
    const a = answer(ageFaq, "1970 年出生的男性");
    expect(statutoryRetirement(1970, 1, "male")).toMatchObject({ ageYears: 61, ageMonths: 4, year: 2031, month: 5 });
    expect(statutoryRetirement(1970, 12, "male")).toMatchObject({ ageYears: 61, ageMonths: 6, year: 2032, month: 6 });
    expect(a).toContain("61 岁 4 个月退休（2031 年 5 月）");
    expect(a).toContain("61 岁 6 个月退休（2032 年 6 月）");
  });
  it("1975 女：原 55 与原 50", () => {
    const a = answer(ageFaq, "1975 年出生的女性");
    expect(statutoryRetirement(1975, 1, "female55")).toMatchObject({ ageYears: 56, ageMonths: 4, year: 2031, month: 5 });
    expect(statutoryRetirement(1975, 12, "female50")).toMatchObject({ ageYears: 50, ageMonths: 6, year: 2026, month: 6 });
    expect(a).toContain("56 岁 4 个月退休（2031 年 5 月）");
    expect(a).toContain("50 岁 1 个月退休（2025 年 2 月）");
    expect(a).toContain("50 岁 6 个月退休（2026 年 6 月）");
  });
  it("1980：男统一 63，女原 55 / 原 50", () => {
    const a = answer(ageFaq, "1980 年出生");
    expect(statutoryRetirement(1980, 12, "male")).toMatchObject({ ageYears: 63, ageMonths: 0, year: 2043, month: 12 });
    expect(a).toContain("63 岁退休（2043 年 12 月）");
    expect(a).toContain("57 岁 7 个月退休（2037 年 8 月）");
    expect(a).toContain("53 岁退休（2033 年 12 月）");
  });
  it("1990 后与最低缴费年限", () => {
    expect(answer(ageFaq, "1990 年后")).toContain("2053 年 6 月");
    const a = answer(ageFaq, "最低缴费年限");
    expect(minContributionMonths(2037)).toBe(228);
    expect(a).toContain("2037 年退休，要求 19 年");
    expect(a).toContain("2030 年退休要 15 年 6 个月");
  });
  it("弹性提前", () => {
    const a = answer(ageFaq, "弹性提前");
    expect(a).toContain("最早可以 60 岁（2045 年 6 月）");
    expect(a).toContain("最多提前 2 年 7 个月");
  });
});

describe("计发基数页", () => {
  it("按基数降序，与数据同长", () => {
    expect(REGIONS_DESC).toHaveLength(PENSION_REGIONS.length);
    for (let i = 1; i < REGIONS_DESC.length; i++) expect(REGIONS_DESC[i - 1].base.value).toBeGreaterThanOrEqual(REGIONS_DESC[i].base.value);
  });
  it("最高最低差额 = (max − min) × 30 × 1%（指数 1.0）", () => {
    const max = Math.max(...PENSION_REGIONS.map((r) => r.base.value));
    const min = Math.min(...PENSION_REGIONS.map((r) => r.base.value));
    expect(GAP_30Y).toBe(Math.round((max - min) * 0.3));
    expect(answer(baseFaq, "哪里最高")).toContain(GAP_30Y.toLocaleString("zh-CN"));
  });
});
