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
  pensionScenarios,
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

  it("过去记录的月数、指数、存量余额一起进入加权与滚存", () => {
    // 60 个月、个人账户 28800 → 基数 28800 ÷ 60 ÷ 8% = 6000，社平 10000 → 指数 0.6
    const r = estimatePension({ ...flat, records: [{ city, months: 60, amount: 28800 }] }, oneRegion);
    expect(r.totalMonths).toBe(360);
    expect(r.avgIndex).toBeCloseTo((0.6 * 60 + 300) / 360, 10);
    expect(r.accountAtRetirement).toBeCloseTo(28800 + 240000, 6);
  });

  it("利息：余额按记账利率月复利，当月缴费次月起计息", () => {
    const r = estimatePension({ ...flat, today: { year: 2053, month: 3 }, records: [{ city, months: 120, amount: 100000 }], accountRate: 0.03 }, oneRegion);
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

describe("领取地折算缴费指数（国办发〔2009〕66 号第七条）", () => {
  const home: PensionRegion = { id: "high", name: "甲", provinceId: "high", base: { year: 2026, value: 12000 }, growth: 0 };
  const low: PensionRegion = { id: "low", name: "乙", provinceId: "low", base: { year: 2026, value: 7000 }, growth: 0 };
  const input = {
    birthYear: 1990, birthMonth: 6, category: "male" as const,
    city: { socialMin: 6000, socialMax: 30000 }, currentBase: 10000,
    today: { year: 2026, month: 10 },
    wageGrowth: 0, salaryGrowth: 0, accountRate: 0, inflation: 0,
  };

  it("在缴费地领时指数不变，去平均工资低的地方领按两地计发基数之比放大", () => {
    const r = estimatePension({ ...input, homeRegion: home }, [home, low]);
    const atHome = r.byRegion.find((x) => x.region.id === "high")!;
    const atLow = r.byRegion.find((x) => x.region.id === "low")!;
    expect(atHome.index).toBeCloseTo(r.avgIndex, 10);
    expect(atLow.index).toBeCloseTo((r.avgIndex * 12000) / 7000, 10);
    expect(atLow.basic).toBeCloseTo(((7000 * (1 + atLow.index)) / 2) * r.years * 0.01, 6);
  });

  it("折算后的指数封顶 3", () => {
    const r = estimatePension({ ...input, currentBase: 30000, homeRegion: home }, [home, low]);
    expect(r.avgIndex).toBeCloseTo(3, 6);
    expect(r.byRegion.find((x) => x.region.id === "low")!.index).toBe(3);
  });

  it("不传 homeRegion 时各地都用原指数（兼容旧调用）", () => {
    const r = estimatePension(input, [home, low]);
    for (const row of r.byRegion) expect(row.index).toBeCloseTo(r.avgIndex, 10);
  });
});

describe("多条参保记录", () => {
  it("单条记录：由 金额 ÷ 月数 ÷ 8% 反推基数，再除以当时社平得到指数", () => {
    const r = estimatePension({ ...flat, records: [{ city, months: 60, amount: 28800 }] }, oneRegion);
    expect(r.records).toHaveLength(1);
    expect(r.records[0].base).toBeCloseTo(6000, 8);
    expect(r.records[0].index).toBeCloseTo(0.6, 8);
    expect(r.records[0]).toMatchObject({ months: 60, amount: 28800 });
  });

  it("社平年增长 4% 时，当时社平按该段中点距今的年数折回", () => {
    // 缺省最后缴费 = 上个月：中点距今 (1 + 60/2) = 31 个月
    const r = estimatePension({ ...flat, wageGrowth: 0.04, records: [{ city, months: 60, amount: 28800 }] }, oneRegion);
    const socialThen = 10000 / Math.pow(1.04, 31 / 12);
    expect(r.records[0].index).toBeCloseTo(6000 / socialThen, 8);
    // 指定最后缴费年月 2024-05（今天 2028-05，共 48 个月前）：中点距今 48 + 30 = 78 个月
    const r2 = estimatePension(
      { ...flat, wageGrowth: 0.04, records: [{ city, months: 60, amount: 28800, lastYM: { year: 2024, month: 5 } }] },
      oneRegion,
    );
    expect(r2.records[0].index).toBeCloseTo(6000 / (10000 / Math.pow(1.04, 78 / 12)), 8);
    expect(r2.records[0].index).toBeGreaterThan(r.records[0].index);
  });

  it("记录指数夹在 0.3–3", () => {
    const hi = estimatePension({ ...flat, records: [{ city, months: 12, amount: 1e6 }] }, oneRegion);
    expect(hi.records[0].index).toBe(3);
    const lo = estimatePension({ ...flat, records: [{ city, months: 120, amount: 100 }] }, oneRegion);
    expect(lo.records[0].index).toBe(0.3);
  });

  it("金额缺失：指数取当前指数，没有平均基数，也不增加账户余额", () => {
    const r = estimatePension({ ...flat, currentBase: 12000, records: [{ city, months: 60, amount: 0 }] }, oneRegion);
    expect(r.currentIndex).toBeCloseTo(1.2, 10);
    expect(r.records[0].index).toBeCloseTo(1.2, 10);
    expect(r.records[0].base).toBeUndefined();
    expect(r.totalMonths).toBe(360);
    expect(r.avgIndex).toBeCloseTo(1.2, 10);
    expect(r.accountAtRetirement).toBeCloseTo(12000 * 0.08 * 300, 6);
  });

  it("个人账户存量 = 各记录金额之和", () => {
    const r = estimatePension(
      { ...flat, stopAge: 40, records: [{ city, months: 36, amount: 20000 }, { city, months: 24, amount: 15000 }] },
      oneRegion,
    );
    // 未来 24 个月 × 800 = 19200
    expect(r.accountAtRetirement).toBeCloseTo(20000 + 15000 + 19200, 6);
  });

  it("两条不同地区的记录：按月数加权，并按领取地的计发基数逐段折算", () => {
    const A: PensionRegion = { id: "A", name: "甲", provinceId: "A", base: { year: 2026, value: 12000 }, growth: 0 };
    const B: PensionRegion = { id: "B", name: "乙", provinceId: "B", base: { year: 2026, value: 8000 }, growth: 0 };
    const cityA = { socialMin: 6000, socialMax: 30000 }; // 社平 10000
    const cityB = { socialMin: 4000, socialMax: 24000 }; // 社平 8000
    const r = estimatePension(
      {
        ...flat,
        city: cityA,
        homeRegion: A,
        records: [
          { region: A, city: cityA, months: 120, amount: 144000 }, // 基数 15000 → 指数 1.5
          { region: B, city: cityB, months: 60, amount: 38400 }, // 基数 8000 → 指数 1.0
        ],
      },
      [A, B],
    );
    expect(r.records[0].index).toBeCloseTo(1.5, 8);
    expect(r.records[1].index).toBeCloseTo(1.0, 8);
    expect(r.totalMonths).toBe(480);
    expect(r.avgIndex).toBeCloseTo((1.5 * 120 + 60 + 300) / 480, 8);
    expect(r.accountAtRetirement).toBeCloseTo(144000 + 38400 + 240000, 6);
    // 在甲地领：乙地那段折算 1.0 × 8000 / 12000；未来按甲地不变
    const atA = r.byRegion.find((x) => x.region.id === "A")!;
    expect(atA.index).toBeCloseTo((1.5 * 120 + (8000 / 12000) * 60 + 300) / 480, 8);
    // 在乙地领：甲地那段 1.5 × 12000 / 8000 = 2.25，未来每月 1 × 1.5
    const atB = r.byRegion.find((x) => x.region.id === "B")!;
    expect(atB.index).toBeCloseTo((2.25 * 120 + 60 + 1.5 * 300) / 480, 8);
    expect(atB.basic).toBeCloseTo(((8000 * (1 + atB.index)) / 2) * 40 * 0.01, 6);
  });

  it("折算逐段封顶 3；找不到记录地区时视同与领取地相同", () => {
    const A: PensionRegion = { id: "A", name: "甲", provinceId: "A", base: { year: 2026, value: 20000 }, growth: 0 };
    const B: PensionRegion = { id: "B", name: "乙", provinceId: "B", base: { year: 2026, value: 5000 }, growth: 0 };
    const rec = (region?: PensionRegion) => [{ region, city, months: 100, amount: 100 * 0.08 * 20000 }]; // 基数 20000 → 指数 2
    const withRegion = estimatePension({ ...flat, stopAge: 40, records: rec(A) }, [A, B]);
    expect(withRegion.byRegion.find((x) => x.region.id === "B")!.index).toBeCloseTo((3 * 100 + 1 * 24) / 124, 8); // 2 × 4 = 8 → 封顶 3
    const noRegion = estimatePension({ ...flat, stopAge: 40, records: rec(undefined) }, [A, B]);
    for (const row of noRegion.byRegion) expect(row.index).toBeCloseTo((2 * 100 + 24) / 124, 8);
  });
});

describe("退休年龄覆盖", () => {
  it("retireAgeMonths 改变退休年月、计发月数和缴费月数", () => {
    // 1990-06 男：法定 63 岁 = 2053-06。覆盖为 60 岁 → 2050-06，缴 2028-06 … 2050-05 = 264 个月
    const r = estimatePension({ ...flat, retireAgeMonths: 60 * 12 }, oneRegion);
    expect(r.retirement).toMatchObject({ year: 2050, month: 6, ageYears: 60, ageMonths: 0 });
    expect(r.statutory).toMatchObject({ year: 2053, month: 6, ageYears: 63 });
    expect(r.totalMonths).toBe(264);
    expect(r.annuityMonths).toBe(139);
    expect(r.personal).toBeCloseTo((800 * 264) / 139, 6);
  });

  it("最低缴费年限按覆盖后的退休年份检查", () => {
    // 58 岁 → 2048-06，要求 240 个月，缴了 240 个月，刚好够
    const ok = estimatePension({ ...flat, retireAgeMonths: 58 * 12 }, oneRegion);
    expect(ok.totalMonths).toBe(240);
    expect(ok.minMonths).toBe(240);
    expect(ok.meetsMinimum).toBe(true);
    // 57 岁 → 2047-06，只缴 228 个月，差 12 个月
    const bad = estimatePension({ ...flat, retireAgeMonths: 57 * 12 }, oneRegion);
    expect(bad.totalMonths).toBe(228);
    expect(bad.meetsMinimum).toBe(false);
    expect(bad.shortfallMonths).toBe(12);
  });

  it("2029 年前退休只要 180 个月", () => {
    // 1970-06 男，覆盖为 59 岁 → 2029-06 退休
    const old = estimatePension({ ...flat, birthYear: 1970, category: "male", today: { year: 2020, month: 1 }, retireAgeMonths: 59 * 12 }, oneRegion);
    expect(old.retirement.year).toBe(2029);
    expect(old.minMonths).toBe(180);
  });

  it("停缴早于覆盖后的退休点：仍按停缴年龄停", () => {
    const r = estimatePension({ ...flat, retireAgeMonths: 62 * 12, stopAge: 50 }, oneRegion);
    expect(r.totalMonths).toBe(144);
  });
});

describe("pensionScenarios", () => {
  const scen = (patch: Partial<PensionInput> = {}) => pensionScenarios({ ...flat, ...patch }, oneRegion, "x");

  it("弹性退休：法定 ±3 年共 7 个点，法定那个点与直接计算一致", () => {
    const { flex } = scen();
    expect(flex.map((p) => p.ageMonths)).toEqual([60, 61, 62, 63, 64, 65, 66].map((y) => y * 12));
    expect(flex.map((p) => p.label)).toEqual(["60 岁", "61 岁", "62 岁", "63 岁", "64 岁", "65 岁", "66 岁"]);
    const cur = flex.filter((p) => p.isCurrent);
    expect(cur).toHaveLength(1);
    expect(cur[0].isStatutory).toBe(true);
    const direct = estimatePension(flat, oneRegion);
    expect(cur[0].total).toBeCloseTo(direct.byRegion[0].total, 8);
    expect(cur[0].retire).toEqual({ year: 2053, month: 6 });
    // 提前 3 年：缴 264 个月，所以 60 岁退休的点缴费年限更短
    expect(flex[0].retire).toEqual({ year: 2050, month: 6 });
  });

  it("弹性退休：滤掉低于原退休年龄的点", () => {
    // 1965-01 男：法定 60 岁 1 个月（721 个月），−36/−24/−12 都低于 720，只剩 4 个点
    const { flex } = scen({ birthYear: 1965, birthMonth: 1, today: { year: 2020, month: 1 } });
    expect(flex.map((p) => p.ageMonths)).toEqual([721, 733, 745, 757]);
    expect(flex[0].label).toBe("60 岁 1 个月");
    expect(flex[0].isCurrent).toBe(true);
  });

  it("弹性退休：滤掉早于今天的点", () => {
    // 1976-09 男：法定 63 岁 = 2039-09。今天 2038-01：60 岁 (2036-09)、61 岁 (2037-09) 已过
    const { flex } = scen({ birthYear: 1976, birthMonth: 9, today: { year: 2038, month: 1 } });
    expect(flex.map((p) => p.ageMonths)).toEqual([62, 63, 64, 65, 66].map((y) => y * 12));
  });

  it("弹性退休：越早退休缴费越少，不足最低年限的点标出来", () => {
    const { flex } = scen({ stopAge: undefined, today: { year: 2038, month: 5 } });
    // 2038-06 起缴；60 岁 (2050-06) 缴 144 个月 < 240
    expect(flex[0].meetsMinimum).toBe(false);
    expect(flex[flex.length - 1].meetsMinimum).toBe(false);
    const full = scen();
    expect(full.flex.every((p) => p.meetsMinimum)).toBe(true);
  });

  it("停缴情景：从当前年龄取整 + 1 到法定退休（不含），超过 16 点隔年取，最后一点缴到退休", () => {
    // 今天 2028-05，出生 1990-06 → 37.9 岁，起点 39；到 62 共 24 点 > 16 → 39,41,…,61
    const { stop } = scen();
    expect(stop.slice(0, -1).map((p) => p.stopAge)).toEqual([39, 41, 43, 45, 47, 49, 51, 53, 55, 57, 59, 61]);
    const last = stop[stop.length - 1];
    expect(last.label).toBe("缴到退休");
    expect(last.stopAge).toBeUndefined();
    expect(last.isCurrent).toBe(true);
    expect(stop[0].label).toBe("39 岁停缴");
    expect(stop.filter((p) => p.isCurrent)).toHaveLength(1);
  });

  it("停缴情景：点数不多时逐年", () => {
    const { stop } = scen({ today: { year: 2045, month: 5 } }); // 54.9 岁 → 56…62
    expect(stop.slice(0, -1).map((p) => p.stopAge)).toEqual([56, 57, 58, 59, 60, 61, 62]);
  });

  it("停缴情景：停缴越晚，每月养老金不减", () => {
    const { stop } = scen();
    for (let i = 1; i < stop.length; i++) {
      expect(stop[i].total).toBeGreaterThanOrEqual(stop[i - 1].total);
      expect(stop[i].totalToday).toBeGreaterThanOrEqual(stop[i - 1].totalToday);
    }
    expect(stop[stop.length - 1].total).toBeCloseTo(estimatePension(flat, oneRegion).byRegion[0].total, 8);
    // 停缴点都按法定年龄退休
    for (const p of stop) expect(p.retire).toEqual({ year: 2053, month: 6 });
  });

  it("领取地不存在时取所有地区的中位数那一行", () => {
    const regions: PensionRegion[] = [5000, 8000, 11000].map((v, i) => ({ id: `r${i}`, name: `R${i}`, provinceId: `r${i}`, base: { year: 2026, value: v }, growth: 0 }));
    const { flex } = pensionScenarios(flat, regions, "nope");
    const mid = estimatePension(flat, regions).byRegion[1];
    expect(flex.find((p) => p.isCurrent)!.total).toBeCloseTo(mid.total, 8);
  });
});
