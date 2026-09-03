import { describe, expect, it } from "vitest";
import { annualTax, bonusSeparateTax, bonusTrapZones, computeAll, inferMonthlyDeduction } from "@/lib/tax";
import { analyzeBonus } from "@/lib/tax/bonus";
import { simulateSegment } from "@/lib/tax/withholding";
import type { Profile, Segment } from "@/lib/tax";

const baseDeductions: Profile["deductions"] = {
  children: 0,
  continuingEducation: "none",
  housing: "none",
  rentTier: 1,
  elderly: "none",
  elderlySharedAmount: 0,
  infants: 0,
  seriousIllnessPaid: 0,
  personalPension: 0,
  otherAnnual: 0,
};

function seg(over: Partial<Segment>): Segment {
  return {
    id: "a",
    name: "A",
    startMonth: 1,
    endMonth: 12,
    monthlySalary: 20000,
    social: { mode: "manual", socialBase: 20000, housingBase: 20000, housingRate: 0.12 },
    ...over,
  };
}

function profile(over: Partial<Profile>): Profile {
  return { year: 2026, cityId: "beijing", segments: [], deductions: baseDeductions, bonusMode: "auto", equity: { taxMode: "combined", events: [] }, ...over };
}

describe("税率表", () => {
  it("年度税率表边界", () => {
    expect(annualTax(0)).toBe(0);
    expect(annualTax(36000)).toBe(1080);
    expect(annualTax(36001)).toBeCloseTo(1080.1, 2);
    expect(annualTax(144000)).toBe(11880);
    expect(annualTax(1_000_000)).toBe(268080);
  });
  it("年终奖单独计税", () => {
    expect(bonusSeparateTax(36000)).toBe(1080);
    expect(bonusSeparateTax(36001)).toBeCloseTo(3390.1, 2);
    expect(bonusSeparateTax(144000)).toBe(14190);
  });
  it("陷阱区间", () => {
    const z = bonusTrapZones();
    expect(z[0].lower).toBe(36000);
    expect(z[0].upper).toBeCloseTo(38566.67, 2);
    expect(z[1].upper).toBeCloseTo(160500, 2);
    expect(z[2].upper).toBeCloseTo(318333.33, 2);
    expect(z[5].upper).toBeCloseTo(1120000, 2);
  });
});

describe("累计预扣", () => {
  it("月薪 3 万、无扣除，前几个月预扣税逐级上升", () => {
    const s = seg({ monthlySalary: 30000, social: { mode: "manual", socialBase: 0, housingBase: 0, housingRate: 0, medicalFixed: 0 } });
    const e = simulateSegment(s, 0, 0, true, 12);
    // 1 月: 25000 × 3% = 750
    expect(e[0].tax).toBe(750);
    // 2 月: 累计 50000 → 50000×10%−2520 = 2480, 本期 1730
    expect(e[1].tax).toBe(1730);
    expect(e[11].cumTaxable).toBe(300000);
    const total = e.reduce((a, b) => a + b.tax, 0);
    expect(total).toBeCloseTo(annualTax(300000), 2);
  });
  it("中途入职：减除费用从入职月起算", () => {
    const s = seg({ startMonth: 7, endMonth: 12, monthlySalary: 30000, social: { mode: "manual", socialBase: 0, housingBase: 0, housingRate: 0, medicalFixed: 0 } });
    const e = simulateSegment(s, 0, 0, true, 12);
    expect(e[0].month).toBe(7);
    expect(e[0].indexInSegment).toBe(1);
    expect(e[0].tax).toBe(750);
  });
  it("应届：减除费用从 1 月累计", () => {
    const s = seg({ startMonth: 7, endMonth: 12, monthlySalary: 30000, firstJobOfYear: true, social: { mode: "manual", socialBase: 0, housingBase: 0, housingRate: 0, medicalFixed: 0 } });
    const e = simulateSegment(s, 0, 0, true, 12);
    // 7 月: 30000 − 5000×7 = -5000 → 0
    expect(e[0].tax).toBe(0);
  });
});

describe("反推五险一金", () => {
  it("给定到手可以还原扣除额", () => {
    const s = seg({ monthlySalary: 30000, netSample: undefined });
    // 先正向算：D = 4000，3 月
    const e = simulateSegment(s, 4000, 1000, true, 12);
    const net3 = e[2].salary - 4000 - e[2].tax;
    const r = inferMonthlyDeduction({ ...s, social: { mode: "infer" }, netSample: { month: 3, amount: net3 } }, 1000, true);
    expect(r.ok).toBe(true);
    expect(r.value).toBeCloseTo(4000, 1);
  });
});

describe("汇算清缴", () => {
  it("全年同一单位、无变动 → 退补为 0", () => {
    const p = profile({ segments: [seg({ monthlySalary: 30000 })] });
    const r = computeAll(p, 12);
    expect(Math.abs(r.annual.settlement)).toBeLessThan(1);
  });
  it("半年 gap → 退税", () => {
    const p = profile({ segments: [seg({ startMonth: 7, endMonth: 12, monthlySalary: 30000 })] });
    const r = computeAll(p, 12);
    expect(r.annual.gapMonths.length).toBe(6);
    expect(r.annual.settlement).toBeLessThan(0);
  });
  it("换工作 → 两家各减 5000/月 → 汇算需补税", () => {
    const p = profile({
      segments: [
        seg({ id: "a", startMonth: 1, endMonth: 6, monthlySalary: 30000 }),
        seg({ id: "b", startMonth: 7, endMonth: 12, monthlySalary: 40000 }),
      ],
    });
    const r = computeAll(p, 12);
    expect(r.annual.settlement).toBeGreaterThan(0);
  });
});

describe("年终奖", () => {
  it("发放月份超出工作段时按最后一个月发放，预扣与汇算口径一致", () => {
    const p = profile({ segments: [seg({ startMonth: 1, endMonth: 5, monthlySalary: 20000, bonus: 100000, bonusMonth: 12 })] });
    const r = computeAll(p, 12);
    expect(r.rows[4].bonusTax + r.rows[4].tax).toBeGreaterThan(0);
    expect(r.annual.totalBonus).toBe(100000);
    // 半年 gap，只可能退税，不应出现补税
    expect(r.annual.settlement).toBeLessThanOrEqual(0);
  });
  it("高收入单独计税更优；扣除未用满时并入更优", () => {
    const hi = analyzeBonus(500000, 100000, 700000);
    expect(hi.recommended).toBe("separate");
    const lo = analyzeBonus(-30000, 30000, 80000);
    expect(lo.recommended).toBe("combined");
    expect(lo.combined.total).toBe(0);
  });
  it("最优拆分不差于当前", () => {
    const a = analyzeBonus(200000, 150000, 400000);
    expect(a.optimalSplit.bestTotalTax).toBeLessThanOrEqual(a.optimalSplit.currentTotalTax);
    expect(a.trap).toBeDefined(); // 150000 在 144000–160500 陷阱区
  });
});

describe("个别月份工资与期权", () => {
  it("月份覆盖生效：试用期半薪", () => {
    const s = seg({ monthlySalary: 30000, monthOverrides: { 1: 15000 }, social: { mode: "manual", socialBase: 0, housingBase: 0, housingRate: 0, medicalFixed: 0 } });
    const e = simulateSegment(s, 0, 0, true, 12);
    expect(e[0].salary).toBe(15000);
    expect(e[0].tax).toBe(300); // (15000-5000)*3%
    expect(e[1].salary).toBe(30000);
  });
  it("并入工资的回购随工资预扣，汇算无退补", () => {
    const p = profile({
      segments: [seg({ monthlySalary: 30000 })],
      equity: { taxMode: "combined", events: [{ id: "e", name: "", amount: 200000, month: 6 }] },
    });
    const r = computeAll(p, 12);
    expect(r.rows[5].equity).toBe(200000);
    expect(r.annual.equityIncome).toBe(200000);
    expect(r.annual.equityTax).toBeGreaterThan(0);
    expect(Math.abs(r.annual.settlement)).toBeLessThan(1);
    // 规划曲线拐点在年度税率边界 − 当前应纳税所得额
    expect(r.equity.kinks.every((k) => k.x > 0)).toBe(true);
    expect(r.equity.curve[0].tax).toBe(0);
  });
  it("上市公司单独计税：不影响工资，拐点从 36000 起", () => {
    const p = profile({
      segments: [seg({ monthlySalary: 30000 })],
      equity: { taxMode: "listed", events: [], plannedExtra: 100000 },
    });
    const r = computeAll(p, 12);
    expect(r.equity.kinks[0].x).toBe(36000);
    expect(r.equity.planned?.tax).toBe(annualTax(100000));
    expect(r.equity.planned?.deferKink).toBe(36000);
    expect(r.equity.planned!.deferSaving).toBeGreaterThan(0);
  });
  it("递延 20%：线性无拐点", () => {
    const p = profile({ segments: [seg({})], equity: { taxMode: "unlisted", events: [{ id: "e", name: "", amount: 100000, month: 3 }] } });
    const r = computeAll(p, 12);
    expect(r.annual.equityTax).toBe(20000);
    expect(r.equity.kinks.length).toBe(0);
  });
});
