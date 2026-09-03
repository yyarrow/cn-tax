import { annualTax, marginalRate, round2 } from "./brackets";
import type { EquityPlan, EquityResult } from "./types";

const UNLISTED_RATE = 0.2;

export function equityIncome(plan: EquityPlan): number {
  return round2(
    plan.grants.reduce((s, g) => {
      const strike = g.kind === "rsu" ? 0 : g.strikePrice;
      return s + Math.max(0, g.fairValue - strike) * Math.max(0, g.quantity);
    }, 0),
  );
}

function equityTax(income: number, type: EquityPlan["companyType"]): number {
  if (income <= 0) return 0;
  return type === "listed" ? annualTax(income) : round2(income * UNLISTED_RATE);
}

/**
 * 上市公司股权激励：不并入综合所得，全年多次合并，单独按年度税率表计税。
 * 非上市公司（已备案）：递延至转让时按财产转让所得 20%。
 */
export function analyzeEquity(plan: EquityPlan): EquityResult | null {
  const income = equityIncome(plan);
  if (income <= 0) return null;
  const taxOneYear = equityTax(income, plan.companyType);
  const split = (n: number) => {
    const perYear = round2(income / n);
    const totalTax = round2(equityTax(perYear, plan.companyType) * n);
    return { perYear, totalTax, saving: round2(taxOneYear - totalTax) };
  };
  return {
    totalIncome: income,
    companyType: plan.companyType,
    taxOneYear,
    rateOneYear: plan.companyType === "listed" ? marginalRate(income) : UNLISTED_RATE,
    splitTwoYears: split(2),
    splitThreeYears: split(3),
  };
}
