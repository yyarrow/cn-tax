import { describe, expect, it } from "vitest";
import { annualTax, computeAll, getCity } from "@/lib/tax";
import { SOE_PRESET, cleanBenefits, compareOffers, computeOffer } from "@/lib/tax/offer";
import type { OfferInput } from "@/lib/tax/offer";
import type { SpecialDeductions } from "@/lib/tax";

const noDeductions: SpecialDeductions = {
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

/**
 * 基准：北京，月薪 20,000，公积金个人 12%，无奖金。
 * 北京社保：养老 8% = 1,600；医疗 2% + 3 = 403；失业 0.2% = 40 → 每月 2,043；公积金 12% = 2,400。
 * 全年个人扣款 (2,043 + 2,400) × 12 = 53,316。应纳税所得额 240,000 − 60,000 − 53,316 = 126,684。
 * 个税 126,684 × 10% − 2,520 = 10,148.4；到手 240,000 − 53,316 − 10,148.4 = 176,535.6。
 */
function offer(over: Partial<OfferInput> = {}): OfferInput {
  return { id: "t", name: "T", cityId: "beijing", monthlySalary: 20000, bonus: 0, signOn: 0, equityPerYear: 0, housingRate: 0.12, ...over };
}
const run = (over: Partial<OfferInput> = {}) => computeOffer(offer(over), 2026, noDeductions);

describe("基准（无福利）", () => {
  it("手算：个税 10,148.4，到手 176,535.6，总回报 = 到手 + 公积金个人 + 单位", () => {
    const r = run();
    expect(r.totalSocial).toBe(53316);
    expect(r.totalTax).toBeCloseTo(10148.4, 2);
    expect(r.netTotal).toBeCloseTo(176535.6, 2);
    expect(r.accounts.housing).toBe(57600); // 2,400 × 2 × 12
    expect(r.accounts.annuity).toBe(0);
    expect(r.totalReturn).toBeCloseTo(176535.6 + 57600, 2);
    expect(r.overLimit).toEqual({ housingPersonal: 0, annuityPersonal: 0 });
  });
  it("旧数据 / 旧链接缺福利字段按 0 处理，结果与显式填 0 一致", () => {
    const legacy = { id: "t", name: "T", cityId: "beijing", monthlySalary: 20000, bonus: 0, signOn: 0, equityPerYear: 0 } as OfferInput;
    const r = computeOffer(legacy, 2026, noDeductions);
    const zero = run({ supplementaryHousingRate: 0, annuityEmployerRate: 0, annuityPersonalRate: 0, cashAllowance: 0, nonCashBenefit: 0 });
    expect(r.netTotal).toBeCloseTo(zero.netTotal, 2);
    expect(r.totalReturn).toBeCloseTo(zero.totalReturn, 2);
    expect(r.accounts.nonCash).toBe(0);
  });
  it("坏数据被夹回合法范围，不产生 NaN", () => {
    const b = cleanBenefits({
      supplementaryHousingRate: 0.5,
      annuityEmployerRate: Number.NaN,
      annuityPersonalRate: "x" as unknown as number,
      cashAllowance: -100,
      nonCashBenefit: undefined,
    });
    expect(b).toEqual({ suppRate: 0.12, annuityEmployerRate: 0, annuityPersonalRate: 0, cashAllowance: 0, nonCashBenefit: 0 });
  });
});

describe("补充公积金", () => {
  it("基本 + 补充合计不超过 12%：全额免税，与只缴基本 12% 的税完全一样", () => {
    const r = run({ housingRate: 0.07, supplementaryHousingRate: 0.05 });
    expect(r.totalSocial).toBe(53316);
    expect(r.totalTax).toBeCloseTo(10148.4, 2);
    expect(r.netTotal).toBeCloseTo(176535.6, 2);
    expect(r.accounts.housing).toBe(57600);
    expect(r.accounts.housingSupplementary).toBe(24000); // 1,000 × 2 × 12
    expect(r.overLimit.housingPersonal).toBe(0);
  });
  it("合计 17%：超出的 5%（1,000/月）个人不能扣、单位缴的同额并入工资计税", () => {
    // 应纳税所得额 = 240,000 + 单位超限 12,000 − 60,000 − 12 × (2,043 + 2,400 可扣) = 138,684
    // 个税 138,684 × 10% − 2,520 = 11,348.4；个人实扣 12 × (2,043 + 3,400) = 65,316
    // 到手 240,000 − 65,316 − 11,348.4 = 163,335.6
    const r = run({ housingRate: 0.12, supplementaryHousingRate: 0.05 });
    expect(r.totalSocial).toBe(65316);
    expect(r.totalTax).toBeCloseTo(11348.4, 2);
    expect(r.netTotal).toBeCloseTo(163335.6, 2);
    expect(r.grossTotal).toBe(240000);
    expect(r.overLimit.housingPersonal).toBe(12000);
    expect(r.accounts.housing).toBe(81600); // 3,400 × 2 × 12
    expect(r.totalReturn).toBeCloseTo(163335.6 + 81600, 2);
    // 普通月到手 = 20,000 − 5,443 − 当月预扣税；全年 12 个月平均
    expect(r.netMonthly).toBeCloseTo(163335.6 / 12, 2);
  });
  it("基本公积金单独超过 12% 同样按超限处理（15% → 超 3%）", () => {
    const r = run({ housingRate: 0.15 });
    expect(r.overLimit.housingPersonal).toBe(7200); // 600 × 12
    // 应纳税所得额 = 240,000 + 7,200 − 60,000 − 12 × (2,043 + 2,400) = 133,884 → 税 10,868.4
    expect(r.totalTax).toBeCloseTo(133884 * 0.1 - 2520, 2);
  });
});

describe("企业年金 / 职业年金", () => {
  it("个人 4% 以内税前扣除、单位 8% 不计税；个人年金从到手里扣", () => {
    // 个人 800/月、单位 1,600/月。应纳税所得额 126,684 − 9,600 = 117,084 → 税 9,188.4
    // 到手 240,000 − 53,316 − 9,600 − 9,188.4 = 167,895.6
    const r = run({ annuityPersonalRate: 0.04, annuityEmployerRate: 0.08 });
    expect(r.totalTax).toBeCloseTo(9188.4, 2);
    expect(r.netTotal).toBeCloseTo(167895.6, 2);
    expect(r.accounts.annuityPersonal).toBe(9600);
    expect(r.accounts.annuityEmployer).toBe(19200);
    expect(r.accounts.annuity).toBe(28800);
    expect(r.totalReturn).toBeCloseTo(167895.6 + 57600 + 28800, 2);
    expect(r.overLimit.annuityPersonal).toBe(0);
  });
  it("只有单位年金：到手不变，只增加总回报", () => {
    const r = run({ annuityEmployerRate: 0.08 });
    expect(r.netTotal).toBeCloseTo(176535.6, 2);
    expect(r.totalReturn).toBeCloseTo(176535.6 + 57600 + 19200, 2);
  });
  it("月薪超过社平 3 倍时扣除基数封顶：北京 60,000 → 按 36,348 × 4% = 1,453.92 扣", () => {
    const city = getCity("beijing");
    expect(city.socialMax).toBe(36348);
    const r = run({ monthlySalary: 60000, annuityPersonalRate: 0.04 });
    // 个人实缴 60,000 × 4% = 2,400/月，可扣 1,453.92，超出 946.08/月
    expect(r.accounts.annuityPersonal).toBe(28800);
    expect(r.overLimit.annuityPersonal).toBeCloseTo(946.08 * 12, 2);
    // 社保基数 36,348：养老 2,907.84 + 医疗 726.96 + 3 + 失业 72.7；公积金基数 36,348 × 12% = 4,361.76 → 4,362
    const monthlyDeduct = 2907.84 + 729.96 + 72.7 + 4362; // 8,072.5
    const taxable = 720000 - 60000 - 12 * (monthlyDeduct + 1453.92);
    const tax = annualTax(taxable);
    expect(r.totalTax).toBeCloseTo(tax, 1);
    expect(r.netTotal).toBeCloseTo(720000 - 12 * monthlyDeduct - 28800 - tax, 1);
  });
  it("月薪 40,000 刚好在封顶线上方：扣除额仍是 36,348 × 4%，不是 40,000 × 4%", () => {
    const r = run({ monthlySalary: 40000, annuityPersonalRate: 0.04 });
    expect(r.overLimit.annuityPersonal).toBeCloseTo((1600 - 1453.92) * 12, 2);
  });
});

describe("现金补贴与非现金福利", () => {
  it("现金补贴按工资计税并入，平摊 12 个月，不抬高五险一金基数", () => {
    // 12,000/年 = 1,000/月。应纳税所得额 252,000 − 60,000 − 53,316 = 138,684 → 税 11,348.4
    const r = run({ cashAllowance: 12000 });
    expect(r.grossTotal).toBe(252000);
    expect(r.totalSocial).toBe(53316); // 基数仍按 20,000
    expect(r.totalTax).toBeCloseTo(11348.4, 2);
    expect(r.netTotal).toBeCloseTo(252000 - 53316 - 11348.4, 2);
    expect(r.accounts.cashAllowance).toBe(12000);
    expect(r.totalReturn).toBeCloseTo(r.netTotal + 57600, 2); // 补贴已在到手里，不重复算
  });
  it("非现金福利不计税、不进到手，只进总回报", () => {
    const r = run({ nonCashBenefit: 6000 });
    expect(r.netTotal).toBeCloseTo(176535.6, 2);
    expect(r.totalTax).toBeCloseTo(10148.4, 2);
    expect(r.totalReturn).toBeCloseTo(176535.6 + 57600 + 6000, 2);
  });
});

describe("总回报与预填", () => {
  it("总回报 = 到手 + 公积金(个人+单位) + 年金(个人+单位) + 非现金福利", () => {
    const r = run({ annuityPersonalRate: 0.04, annuityEmployerRate: 0.08, nonCashBenefit: 6000 });
    expect(r.totalReturn).toBeCloseTo(r.netTotal + r.accounts.housing + r.accounts.annuity + r.accounts.nonCash, 2);
    expect(r.totalReturn).toBeCloseTo(167895.6 + 57600 + 28800 + 6000, 2);
  });
  it("「按事业单位 / 国企预填」= 公积金个人 12%、年金单位 8% / 个人 4%", () => {
    expect(SOE_PRESET).toEqual({ housingRate: 0.12, annuityEmployerRate: 0.08, annuityPersonalRate: 0.04 });
    const r = run({ ...SOE_PRESET });
    expect(r.netTotal).toBeCloseTo(167895.6, 2);
    expect(r.accounts.annuity).toBe(28800);
  });
  it("无超限时，给首页用的 profile 重新测算结果与对比器一致", () => {
    const r = run({ ...SOE_PRESET, supplementaryHousingRate: 0, cashAllowance: 12000 });
    const full = computeAll(r.profile, 12);
    expect(full.annual.netTotal).toBeCloseTo(r.netTotal, 1);
    expect(full.annual.totalTax).toBeCloseTo(r.totalTax, 1);
  });
  it("排名翻转：现金到手 A 更多，算上账户和福利 B 更多", () => {
    const a = offer({ id: "a", name: "A", monthlySalary: 30000 });
    const b = offer({ id: "b", name: "B", monthlySalary: 27000, ...SOE_PRESET, nonCashBenefit: 20000 });
    const c = compareOffers([a, b], 2026, noDeductions);
    expect(c.bestId).toBe("a");
    expect(c.bestReturnId).toBe("b");
    expect(c.deltas.a).toBe(0);
    expect(c.deltas.b).toBeLessThan(0);
    expect(c.returnDeltas.b).toBe(0);
    expect(c.returnDeltas.a).toBeLessThan(0);
  });
});
