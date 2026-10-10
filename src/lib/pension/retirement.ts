import { ANNUITY_MONTHS } from "./params";

export type PensionCategory = "male" | "female55" | "female50";

export interface StatutoryRetirement {
  /** 法定退休年龄：整岁部分 + 月数部分 */
  ageYears: number;
  ageMonths: number;
  delayMonths: number;
  /** 退休年月 */
  year: number;
  month: number;
  /** 改革前原退休年龄（岁） */
  originalAge: number;
}

const RULES: Record<PensionCategory, { originalAge: number; startYear: number; step: number; cap: number }> = {
  // 延迟 = min(cap, floor(n / step) + 1)，n = 出生月相对起点（1 月）的月数
  male: { originalAge: 60, startYear: 1965, step: 4, cap: 36 },
  female55: { originalAge: 55, startYear: 1970, step: 4, cap: 36 },
  female50: { originalAge: 50, startYear: 1975, step: 2, cap: 60 },
};

/** 2025-01-01 起渐进式延迟退休的法定退休年月 */
export function statutoryRetirement(birthYear: number, birthMonth: number, category: PensionCategory): StatutoryRetirement {
  const rule = RULES[category];
  const n = birthYear * 12 + (birthMonth - 1) - rule.startYear * 12;
  const delayMonths = n < 0 ? 0 : Math.min(rule.cap, Math.floor(n / rule.step) + 1);
  const ageTotal = rule.originalAge * 12 + delayMonths;
  const retireIdx = birthYear * 12 + (birthMonth - 1) + ageTotal;
  return {
    ageYears: Math.floor(ageTotal / 12),
    ageMonths: ageTotal % 12,
    delayMonths,
    year: Math.floor(retireIdx / 12),
    month: (retireIdx % 12) + 1,
    originalAge: rule.originalAge,
  };
}

/** 最低缴费年限（月）：2030 年前 15 年，自 2030 年起每年 +6 个月，20 年封顶 */
export function minContributionMonths(retireYear: number): number {
  if (retireYear < 2030) return 180;
  return Math.min(240, 180 + 6 * (retireYear - 2029));
}

/** 个人账户养老金计发月数；非整岁在相邻整岁间按月线性插值，超出 40–70 岁截断 */
export function annuityMonths(ageYears: number, ageMonths: number): number {
  const total = ageYears * 12 + ageMonths;
  if (total <= 40 * 12) return ANNUITY_MONTHS[40];
  if (total >= 70 * 12) return ANNUITY_MONTHS[70];
  const lo = Math.floor(total / 12);
  const frac = (total % 12) / 12;
  if (frac === 0) return ANNUITY_MONTHS[lo];
  return Math.round(ANNUITY_MONTHS[lo] + (ANNUITY_MONTHS[lo + 1] - ANNUITY_MONTHS[lo]) * frac);
}
