import { ANNUAL_BRACKETS, MONTHLY_BRACKETS } from "./constants";
import { annualTax, bonusSeparateTax, round2 } from "./brackets";
import type { BonusAnalysis } from "./types";

export interface TrapZone {
  lower: number;
  upper: number;
}

/**
 * 年终奖单独计税的“陷阱区间”：奖金落在 (lower, upper) 内时，
 * 税后反而比正好发 lower 元更少。
 */
export function bonusTrapZones(): TrapZone[] {
  const zones: TrapZone[] = [];
  for (let i = 0; i < MONTHLY_BRACKETS.length - 1; i++) {
    const lo = MONTHLY_BRACKETS[i];
    const hi = MONTHLY_BRACKETS[i + 1];
    const lower = lo.upTo * 12;
    // 求 x：x(1−r2)+q2 = lower(1−r1)+q1
    const upper = (lower * (1 - lo.rate) + lo.quick - hi.quick) / (1 - hi.rate);
    zones.push({ lower, upper: round2(upper) });
  }
  return zones;
}

export function findTrap(bonus: number): { lower: number; upper: number; extraTax: number } | undefined {
  for (const z of bonusTrapZones()) {
    if (bonus > z.lower && bonus < z.upper) {
      const extraTax = round2(bonusSeparateTax(bonus) - bonusSeparateTax(z.lower) - (bonus - z.lower));
      return { ...z, extraTax };
    }
  }
  return undefined;
}

/**
 * @param baseTaxable 不含奖金的综合所得应纳税所得额（可为负 = 扣除额未用满）
 * @param bonus 年终奖
 * @param totalCash 全年现金（工资 + 奖金），用于“可协商拆分”场景
 */
export function analyzeBonus(baseTaxable: number, bonus: number, totalCash: number): BonusAnalysis {
  const compBase = annualTax(Math.max(0, baseTaxable));
  const separate = {
    bonusTax: bonusSeparateTax(bonus),
    comprehensiveTax: compBase,
    total: round2(compBase + bonusSeparateTax(bonus)),
  };
  const combinedTax = annualTax(Math.max(0, baseTaxable + bonus));
  const combined = { comprehensiveTax: combinedTax, total: combinedTax };
  const recommended = separate.total <= combined.total ? "separate" : "combined";
  const saving = round2(Math.abs(separate.total - combined.total));
  const currentTotalTax = Math.min(separate.total, combined.total);

  // 可协商拆分：把 pool = baseTaxable + bonus 中的 b 作为奖金单独计税
  const pool = baseTaxable + bonus;
  const maxBonus = Math.max(0, totalCash);
  const candidates = new Set<number>([0, maxBonus]);
  for (const b of MONTHLY_BRACKETS) if (Number.isFinite(b.upTo)) candidates.add(b.upTo * 12);
  for (const b of ANNUAL_BRACKETS) if (Number.isFinite(b.upTo)) candidates.add(pool - b.upTo);
  // 奖金恰好用完扣除空间
  candidates.add(pool);
  let bestBonus = 0;
  let bestTotalTax = Infinity;
  for (const c of candidates) {
    const b = Math.min(maxBonus, Math.max(0, c));
    const t = round2(annualTax(Math.max(0, pool - b)) + bonusSeparateTax(b));
    if (t < bestTotalTax - 0.005 || (Math.abs(t - bestTotalTax) < 0.005 && b < bestBonus)) {
      bestTotalTax = t;
      bestBonus = b;
    }
  }
  return {
    bonus,
    baseTaxable,
    separate,
    combined,
    recommended,
    saving,
    trap: findTrap(bonus),
    optimalSplit: {
      totalCash,
      bestBonus: round2(bestBonus),
      bestTotalTax,
      currentTotalTax,
      saving: round2(Math.max(0, currentTotalTax - bestTotalTax)),
    },
  };
}
