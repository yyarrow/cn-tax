import { ANNUAL_BRACKETS, MONTHLY_BRACKETS, type Bracket } from "./constants";

export function findBracket(taxable: number, table: Bracket[] = ANNUAL_BRACKETS): number {
  if (taxable <= 0) return 0;
  for (let i = 0; i < table.length; i++) {
    if (taxable <= table[i].upTo) return i;
  }
  return table.length - 1;
}

/** 超额累进：taxable × rate − quick */
export function progressiveTax(taxable: number, table: Bracket[] = ANNUAL_BRACKETS): number {
  if (taxable <= 0) return 0;
  const b = table[findBracket(taxable, table)];
  return round2(taxable * b.rate - b.quick);
}

export function annualTax(taxable: number): number {
  return progressiveTax(taxable, ANNUAL_BRACKETS);
}

export function marginalRate(taxable: number): number {
  if (taxable <= 0) return 0;
  return ANNUAL_BRACKETS[findBracket(taxable)].rate;
}

/** 全年一次性奖金单独计税 */
export function bonusSeparateTax(bonus: number): number {
  if (bonus <= 0) return 0;
  const b = MONTHLY_BRACKETS[findBracket(bonus / 12, MONTHLY_BRACKETS)];
  return round2(bonus * b.rate - b.quick);
}

export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}
