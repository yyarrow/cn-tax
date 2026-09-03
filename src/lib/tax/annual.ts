import { ANNUAL_BRACKETS, BASIC_DEDUCTION_ANNUAL } from "./constants";
import { annualTax, bonusSeparateTax, findBracket, round2 } from "./brackets";
import { annualOnlyDeductions, sadMonthly } from "./social";
import type { AnnualResult, MonthRow, Profile } from "./types";

export interface AnnualInputs {
  totalSalary: number;
  totalBonus: number;
  totalSocial: number;
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
  const { totalSalary, totalBonus, totalSocial } = inputs;
  const comprehensiveIncome = totalSalary + (bonusSeparate ? 0 : totalBonus);
  const taxable = Math.max(
    0,
    round2(comprehensiveIncome - BASIC_DEDUCTION_ANNUAL - totalSocial - sadAnnual - annualOnly.total),
  );
  const comprehensiveTax = annualTax(taxable);
  const bonusTax = bonusSeparate ? bonusSeparateTax(totalBonus) : 0;
  const totalTax = round2(comprehensiveTax + bonusTax);
  const withheld = round2(rows.reduce((s, r) => s + r.tax + r.bonusTax, 0));
  const settlement = round2(totalTax - withheld);
  const bracketIndex = findBracket(taxable);
  const bracket = ANNUAL_BRACKETS[bracketIndex];
  const grossTotal = round2(totalSalary + totalBonus);
  const netTotal = round2(grossTotal - totalSocial - totalTax);
  const gapMonths = rows.filter((r) => r.isGap).map((r) => r.month);
  const settlementExempt = settlement > 0 && (comprehensiveIncome <= 120_000 || settlement <= 400);
  return {
    totalSalary,
    totalBonus,
    bonusSeparate,
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
