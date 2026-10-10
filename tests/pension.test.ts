import { describe, expect, it } from "vitest";
import { computeAll, getCity, sadMonthly } from "@/lib/tax";
import type { Profile } from "@/lib/tax";
import {
  PENSION_REGIONS,
  annuityMonths,
  baseFromGross,
  baseFromNet,
  baseFromPensionDeduction,
  estimatePension,
  minContributionMonths,
  regionForCity,
  statutoryRetirement,
  type PensionInput,
  type PensionRegion,
} from "@/lib/pension";

describe("法定退休年龄", () => {
  it("男：起点之前不延迟", () => {
    expect(statutoryRetirement(1964, 12, "male")).toMatchObject({ ageYears: 60, ageMonths: 0, delayMonths: 0, year: 2024, month: 12, originalAge: 60 });
  });
  it("男：1965-01 延迟 1 个月，2025-02 退休", () => {
    expect(statutoryRetirement(1965, 1, "male")).toMatchObject({ ageYears: 60, ageMonths: 1, delayMonths: 1, year: 2025, month: 2 });
  });
  it("男：每 4 个月多延迟 1 个月", () => {
    expect(statutoryRetirement(1965, 4, "male").delayMonths).toBe(1);
    expect(statutoryRetirement(1965, 5, "male").delayMonths).toBe(2);
  });
  it("男：1976-09 达到 36 个月封顶 = 63 岁", () => {
    // n = (1976-1965)*12 + 8 = 140，floor(140/4)+1 = 36
    expect(statutoryRetirement(1976, 9, "male")).toMatchObject({ delayMonths: 36, ageYears: 63, ageMonths: 0, year: 2039, month: 9 });
    expect(statutoryRetirement(1976, 8, "male").delayMonths).toBe(35);
  });
  it("男：1990-06 → 63 岁，2053-06", () => {
    expect(statutoryRetirement(1990, 6, "male")).toMatchObject({ ageYears: 63, ageMonths: 0, year: 2053, month: 6 });
  });
  it("女原 50：1975-01 延迟 1，1984-11 封顶 55 岁", () => {
    expect(statutoryRetirement(1975, 1, "female50")).toMatchObject({ delayMonths: 1, ageYears: 50, ageMonths: 1, year: 2025, month: 2 });
    // n = 9*12 + 10 = 118，floor(118/2)+1 = 60
    expect(statutoryRetirement(1984, 11, "female50")).toMatchObject({ delayMonths: 60, ageYears: 55, ageMonths: 0, year: 2039, month: 11 });
    expect(statutoryRetirement(1984, 10, "female50").delayMonths).toBe(59);
  });
  it("女原 55：1970-01 延迟 1，1981-09 封顶 58 岁", () => {
    expect(statutoryRetirement(1970, 1, "female55")).toMatchObject({ delayMonths: 1, ageYears: 55, ageMonths: 1, year: 2025, month: 2 });
    expect(statutoryRetirement(1981, 9, "female55")).toMatchObject({ delayMonths: 36, ageYears: 58, ageMonths: 0, year: 2039, month: 9 });
  });
});

describe("最低缴费年限", () => {
  it("2030 前 180 个月，之后每年 +6，240 封顶", () => {
    expect(minContributionMonths(2029)).toBe(180);
    expect(minContributionMonths(2030)).toBe(186);
    expect(minContributionMonths(2035)).toBe(216);
    expect(minContributionMonths(2039)).toBe(240);
    expect(minContributionMonths(2045)).toBe(240);
  });
});

describe("计发月数", () => {
  it("整岁查表", () => {
    expect(annuityMonths(60, 0)).toBe(139);
    expect(annuityMonths(63, 0)).toBe(117);
  });
  it("非整岁线性插值：61 岁 6 个月 = (132+125)/2 → 129", () => {
    expect(annuityMonths(61, 6)).toBe(129);
  });
  it("超出范围截断", () => {
    expect(annuityMonths(35, 0)).toBe(233);
    expect(annuityMonths(72, 3)).toBe(56);
  });
});

describe("regionForCity", () => {
  it("先按城市 id，再按省", () => {
    expect(regionForCity("beijing", "beijing")?.id).toBe("beijing");
    expect(regionForCity("hangzhou", "zhejiang")?.id).toBe("zhejiang");
    expect(regionForCity("nowhere", "nowhere")).toBeUndefined();
  });
});

// 构造一个所有增长率/利率都为 0 的基准输入
const city = { socialMin: 3000, socialMax: 30000 }; // 社平 = 10000
const flat: PensionInput = {
  birthYear: 1990,
  birthMonth: 6,
  category: "male", // 63 岁，2053-06 退休
  city,
  currentBase: 10000, // 指数 1
  today: { year: 2028, month: 5 }, // 下个月 2028-06 起缴，到 2053-05 止，共 300 个月
  balance: 0,
  paidMonths: 0,
  wageGrowth: 0,
  salaryGrowth: 0,
  accountRate: 0,
  inflation: 0,
};
const oneRegion: PensionRegion[] = [{ id: "x", name: "X", provinceId: "x", base: { year: 2025, value: 10000 }, growth: 0 }];

describe("estimatePension 手算", () => {
  it("300 个月、指数 1、计发基数 10000", () => {
    const r = estimatePension(flat, oneRegion);
    // 1990-06 男 → 63 岁 0 月，2053-06 退休；缴费月 2028-06 … 2053-05 = 25×12 = 300 个月
    expect(r.retirement).toMatchObject({ year: 2053, month: 6, ageYears: 63 });
    expect(r.totalMonths).toBe(300);
    expect(r.years).toBe(25);
    expect(r.avgIndex).toBeCloseTo(1, 10);
    expect(r.currentIndex).toBeCloseTo(1, 10);
    // 基础养老金 = 10000 × (1+1)/2 × 25 × 1% = 2500
    expect(r.byRegion[0].basic).toBeCloseTo(2500, 6);
    // 个人账户 = 10000 × 8% × 300 = 240000；计发月数 63 岁 = 117
    expect(r.accountAtRetirement).toBeCloseTo(240000, 6);
    expect(r.annuityMonths).toBe(117);
    expect(r.personal).toBeCloseTo(240000 / 117, 6);
    expect(r.byRegion[0].transitional).toBe(0);
    expect(r.byRegion[0].total).toBeCloseTo(2500 + 240000 / 117, 6);
    expect(r.byRegion[0].totalToday).toBeCloseTo(r.byRegion[0].total, 6); // 通胀 0
    expect(r.lastBase).toBe(10000);
    expect(r.byRegion[0].replacement).toBeCloseTo((2500 + 240000 / 117) / 10000, 6);
    expect(r.meetsMinimum).toBe(true); // 2053 年要求 240 个月
    expect(r.shortfallMonths).toBe(0);
  });

  it("已缴月数、过去指数、存量余额一起进入加权与滚存", () => {
    const r = estimatePension({ ...flat, paidMonths: 60, pastIndex: 0.6, balance: 50000 }, oneRegion);
    expect(r.totalMonths).toBe(360);
    expect(r.avgIndex).toBeCloseTo((0.6 * 60 + 300) / 360, 10);
    expect(r.accountAtRetirement).toBeCloseTo(50000 + 240000, 6);
  });

  it("利息：余额按记账利率月复利，当月缴费次月起计息", () => {
    const r = estimatePension({ ...flat, today: { year: 2053, month: 3 }, balance: 100000, accountRate: 0.03 }, oneRegion);
    // 2053-04、2053-05 两个月缴费，2053-06 退休（共 3 个月计息窗口）
    const i = Math.pow(1.03, 1 / 12) - 1;
    const expected = ((100000 * (1 + i) + 800) * (1 + i) + 800) * (1 + i);
    expect(r.accountAtRetirement).toBeCloseTo(expected, 6);
  });

  it("通胀折现按今天到退休的月数", () => {
    const r = estimatePension({ ...flat, inflation: 0.025 }, oneRegion);
    // 2028-05 → 2053-06 = 301 个月
    expect(r.byRegion[0].totalToday).toBeCloseTo(r.byRegion[0].total / Math.pow(1.025, 301 / 12), 6);
  });
});

describe("estimatePension 其他口径", () => {
  it("基数夹在上下限内", () => {
    const hi = estimatePension({ ...flat, currentBase: 100000 }, oneRegion);
    expect(hi.currentIndex).toBe(3);
    expect(hi.lastBase).toBe(30000);
    expect(hi.avgIndex).toBeCloseTo(3, 10);
    expect(hi.accountAtRetirement).toBeCloseTo(30000 * 0.08 * 300, 6);
    const lo = estimatePension({ ...flat, city: { socialMin: 6000, socialMax: 30000 }, currentBase: 100 }, oneRegion);
    expect(lo.lastBase).toBe(6000);
    expect(lo.currentIndex).toBeCloseTo(0.6, 10);
    expect(lo.avgIndex).toBeCloseTo(0.6, 10);
  });

  it("工资增速高于社平时，上限跟着社平增长，指数不会越过上限", () => {
    const r = estimatePension({ ...flat, currentBase: 30000, salaryGrowth: 0.1, wageGrowth: 0.04 }, oneRegion);
    expect(r.avgIndex).toBeCloseTo(3, 10);
    expect(r.lastBase).toBeCloseTo(30000 * Math.pow(1.04, 300 / 12), 4);
  });

  it("停缴年龄早于退休：只缴到停缴，余额继续计息", () => {
    // 50 岁 = 2040-06 起不再缴 → 缴 2028-06 … 2040-05 = 144 个月
    const r = estimatePension({ ...flat, stopAge: 50 }, oneRegion);
    expect(r.totalMonths).toBe(144);
    expect(r.accountAtRetirement).toBeCloseTo(10000 * 0.08 * 144, 6);
    expect(r.years).toBe(12);
    const withInterest = estimatePension({ ...flat, stopAge: 50, accountRate: 0.03 }, oneRegion);
    const noStop = estimatePension({ ...flat, accountRate: 0.03 }, oneRegion);
    expect(withInterest.accountAtRetirement).toBeGreaterThan(10000 * 0.08 * 144);
    expect(withInterest.accountAtRetirement).toBeLessThan(noStop.accountAtRetirement);
  });

  it("停缴年龄晚于退休：以退休为准", () => {
    expect(estimatePension({ ...flat, stopAge: 70 }, oneRegion).totalMonths).toBe(300);
  });

  it("不满最低年限：给出 shortfall，仍照算", () => {
    // 2028-06 … 2030-05 共 24 个月；2053 年要求 240 个月
    const r = estimatePension({ ...flat, stopAge: 40 }, oneRegion);
    expect(r.totalMonths).toBe(24);
    expect(r.minMonths).toBe(240);
    expect(r.meetsMinimum).toBe(false);
    expect(r.shortfallMonths).toBe(216);
    expect(r.byRegion[0].total).toBeGreaterThan(0);
    // 视同缴费年限计入最低年限比较
    const d = estimatePension({ ...flat, stopAge: 40, deemedYears: 18 }, oneRegion);
    expect(d.meetsMinimum).toBe(true);
    expect(d.shortfallMonths).toBe(0);
  });

  it("视同缴费年限带来过渡性养老金", () => {
    const r = estimatePension({ ...flat, deemedYears: 10 }, oneRegion);
    // 过渡性 = 10000 × 平均指数 1 × 10 年 × 1.2% = 1200；缴费年限 25+10 = 35 → 基础 = 10000 × 1 × 35 × 1% = 3500
    expect(r.years).toBe(35);
    expect(r.totalMonths).toBe(300);
    expect(r.byRegion[0].transitional).toBeCloseTo(1200, 6);
    expect(r.byRegion[0].basic).toBeCloseTo(3500, 6);
    const c = estimatePension({ ...flat, deemedYears: 10, transitionCoef: 0.015 }, oneRegion);
    expect(c.byRegion[0].transitional).toBeCloseTo(1500, 6);
  });

  it("计发基数按领取地增速外推，缺省用社平增长", () => {
    const regions: PensionRegion[] = [
      { id: "a", name: "A", provinceId: "a", base: { year: 2025, value: 10000 } },
      { id: "b", name: "B", provinceId: "b", base: { year: 2025, value: 10000 }, growth: 0 },
    ];
    const r = estimatePension({ ...flat, wageGrowth: 0.04, salaryGrowth: 0.04 }, regions);
    const a = r.byRegion.find((x) => x.region.id === "a")!;
    const b = r.byRegion.find((x) => x.region.id === "b")!;
    expect(a.baseAtRetirement).toBeCloseTo(10000 * Math.pow(1.04, 28), 4);
    expect(b.baseAtRetirement).toBe(10000);
  });

  it("byRegion 按 total 降序，默认含全部占位地区", () => {
    const r = estimatePension(flat);
    expect(r.byRegion).toHaveLength(PENSION_REGIONS.length);
    for (let i = 1; i < r.byRegion.length; i++) expect(r.byRegion[i - 1].total).toBeGreaterThanOrEqual(r.byRegion[i].total);
    // 个人账户与领取地无关
    expect(new Set(r.byRegion.map((x) => x.personal)).size).toBe(1);
  });

  it("没有任何缴费时平均指数为 0，不出 NaN", () => {
    const r = estimatePension({ ...flat, today: { year: 2060, month: 1 } }, oneRegion);
    expect(r.totalMonths).toBe(0);
    expect(r.avgIndex).toBe(0);
    expect(Number.isFinite(r.byRegion[0].total)).toBe(true);
  });
});

describe("当前基数推算", () => {
  it("baseFromGross / baseFromPensionDeduction", () => {
    expect(baseFromGross(1000, city)).toBe(3000);
    expect(baseFromGross(12000, city)).toBe(12000);
    expect(baseFromGross(99999, city)).toBe(30000);
    expect(baseFromPensionDeduction(1600)).toBeCloseTo(20000, 8);
  });

  it("baseFromNet：正向算到手再反推回基数", () => {
    const cityP = getCity("beijing");
    const deductions: Profile["deductions"] = {
      children: 0, continuingEducation: "none", housing: "loan", rentTier: 1, elderly: "none",
      elderlySharedAmount: 0, infants: 0, seriousIllnessPaid: 0, personalPension: 0, otherAnnual: 0,
    };
    const sad = sadMonthly(deductions);
    for (const [gross, base, hr] of [[30000, 20000, 0.12], [45000, 25000, 0.07], [18000, 12000, 0]] as const) {
      const profile: Profile = {
        year: 2026, cityId: "beijing", deductions, bonusMode: "auto", equity: { taxMode: "combined", events: [] },
        segments: [{ id: "a", name: "A", startMonth: 1, endMonth: 12, monthlySalary: gross, social: { mode: "manual", socialBase: base, housingBase: base, housingRate: hr } }],
      };
      const net = computeAll(profile).rows[5].net; // 6 月
      const r = baseFromNet({ gross, net, month: 6, city: cityP, housingRate: hr, sadMonthly: sad });
      expect(r.ok).toBe(true);
      expect(Math.abs(r.base - base)).toBeLessThan(1);
    }
  });

  it("baseFromNet：反推失败回退到税前工资", () => {
    const r = baseFromNet({ gross: 20000, net: 25000, month: 6, city: getCity("beijing"), housingRate: 0.12, sadMonthly: 0 });
    expect(r.ok).toBe(false);
    expect(r.base).toBe(baseFromGross(20000, getCity("beijing")));
  });
});
