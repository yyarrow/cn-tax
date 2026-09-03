import { ANNUAL_BRACKETS, BASIC_DEDUCTION_ANNUAL } from "./constants";
import { annualTax, bonusSeparateTax, findBracket, round2 } from "./brackets";
import { annualOnlyDeductions, sadMonthly } from "./social";
import type { AnnualResult, MonthRow, Profile } from "./types";

export interface AnnualInputs {
  totalSalary: number;
  totalBonus: number;
  totalSocial: number;
  /** 并入工资计税的期权 / RSU 收入 */
  equityCombined: number;
  /** 单独计税 / 递延的期权收入及其税 */
  equitySeparate: number;
  equitySeparateTax: number;
}

/** 年度汇算清缴 */
export function computeAnnual(
  profile: Profile,
  rows: MonthRow[],
  inputs: AnnualInputs,
  bonusSeparate: boolean,
): AnnualResult {
  const sadM = sadMonthly(profile.deductions);
  const sadAnnual = sadM * 12;
  const annualOnly = annualOnlyDeductions(profile.deductions);
  const { totalSalary, totalBonus, totalSocial, equityCombined, equitySeparate, equitySeparateTax } = inputs;
  const comprehensiveIncome = totalSalary + equityCombined + (bonusSeparate ? 0 : totalBonus);
  const taxableOf = (income: number) =>
    Math.max(0, round2(income - BASIC_DEDUCTION_ANNUAL - totalSocial - sadAnnual - annualOnly.total));
  const taxable = taxableOf(comprehensiveIncome);
  const comprehensiveTax = annualTax(taxable);
  const bonusTax = bonusSeparate ? bonusSeparateTax(totalBonus) : 0;
  const equityIncome = round2(equityCombined + equitySeparate);
  const equityTax =
    equityCombined > 0 ? round2(comprehensiveTax - annualTax(taxableOf(comprehensiveIncome - equityCombined))) : equitySeparateTax;
  const totalTax = round2(comprehensiveTax + bonusTax + equitySeparateTax);
  // 单独计税的股权激励由公司在兑现时代扣，预扣与应纳相等
  const withheld = round2(rows.reduce((s, r) => s + r.tax + r.bonusTax, 0) + equitySeparateTax);
  const settlement = round2(totalTax - withheld);
  const bracketIndex = findBracket(taxable);
  const bracket = ANNUAL_BRACKETS[bracketIndex];
  const grossTotal = round2(totalSalary + totalBonus + equityIncome);
  const netTotal = round2(grossTotal - totalSocial - totalTax);
  const gapMonths = rows.filter((r) => r.isGap).map((r) => r.month);
  const settlementExempt = settlement > 0 && (comprehensiveIncome <= 120_000 || settlement <= 400);
  return {
    totalSalary,
    totalBonus,
    bonusSeparate,
    equityIncome,
    equityMode: profile.equity.taxMode,
    equityTax,
    totalSocial: round2(totalSocial),
    basicDeduction: BASIC_DEDUCTION_ANNUAL,
    sadAnnual,
    sadMonthly: sadM,
    otherDeductions: annualOnly.total,
    taxable,
    comprehensiveTax,
    bonusTax,
    totalTax,
    withheld,
    settlement,
    marginalRate: taxable > 0 ? bracket.rate : 0,
    bracketIndex,
    roomToNextBracket: Number.isFinite(bracket.upTo) ? round2(bracket.upTo - taxable) : 0,
    effectiveRate: grossTotal > 0 ? totalTax / grossTotal : 0,
    grossTotal,
    netTotal,
    gapMonths,
    settlementExempt,
  };
}
