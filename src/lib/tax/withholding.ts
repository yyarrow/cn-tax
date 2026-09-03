import { BASIC_DEDUCTION_MONTHLY } from "./constants";
import { annualTax, bonusSeparateTax, findBracket, round2 } from "./brackets";
import { ANNUAL_BRACKETS } from "./constants";
import type { MonthEntry, MonthRow, Segment } from "./types";

/** 年终奖发放月份：落在本段工作期间内，否则按本段最后一个月 */
export function effectiveBonusMonth(seg: Segment): number | undefined {
  if (!seg.bonus || seg.bonus <= 0) return undefined;
  const m = seg.bonusMonth ?? seg.endMonth;
  return Math.min(seg.endMonth, Math.max(seg.startMonth, m));
}

/**
 * 累计预扣法：对一段工作逐月模拟预扣预缴。
 * 减除费用 = 5000 × 本单位任职月数（应届/首次就业可从 1 月起算）。
 */
export function simulateSegment(
  seg: Segment,
  socialMonthly: number,
  sadMonthly: number,
  bonusSeparate: boolean,
  currentMonth: number,
): MonthEntry[] {
  const entries: MonthEntry[] = [];
  let cumIncome = 0;
  let cumSocial = 0;
  let cumSad = 0;
  let withheld = 0;
  const start = Math.max(1, Math.min(12, seg.startMonth));
  const end = Math.max(start, Math.min(12, seg.endMonth));
  const bonusMonth = effectiveBonusMonth(seg);
  for (let m = start; m <= end; m++) {
    const indexInSegment = seg.firstJobOfYear ? m : m - start + 1;
    const hasBonus = bonusMonth === m;
    const bonus = hasBonus ? seg.bonus! : 0;
    const bonusCombined = hasBonus && !bonusSeparate;
    cumIncome += seg.monthlySalary + (bonusCombined ? bonus : 0);
    cumSocial += socialMonthly;
    cumSad += sadMonthly;
    const cumTaxable = Math.max(
      0,
      cumIncome - BASIC_DEDUCTION_MONTHLY * indexInSegment - cumSocial - cumSad,
    );
    const cumTax = annualTax(cumTaxable);
    const tax = round2(Math.max(0, cumTax - withheld));
    withheld += tax;
    const bonusTax = hasBonus && bonusSeparate ? bonusSeparateTax(bonus) : 0;
    const rate = cumTaxable > 0 ? ANNUAL_BRACKETS[findBracket(cumTaxable)].rate : 0;
    const net = round2(seg.monthlySalary + bonus - socialMonthly - tax - bonusTax);
    entries.push({
      month: m,
      segmentId: seg.id,
      segmentName: seg.name,
      indexInSegment,
      salary: seg.monthlySalary,
      bonus,
      bonusCombined,
      social: socialMonthly,
      sad: sadMonthly,
      cumIncome,
      cumTaxable,
      rate,
      tax,
      bonusTax,
      net,
      isFuture: m > currentMonth,
    });
  }
  return entries;
}

/** 把各段的月度条目合并成 12 行 */
export function mergeRows(allEntries: MonthEntry[], currentMonth: number): MonthRow[] {
  const rows: MonthRow[] = [];
  for (let m = 1; m <= 12; m++) {
    const entries = allEntries.filter((e) => e.month === m);
    const gross = entries.reduce((s, e) => s + e.salary + e.bonus, 0);
    const social = entries.reduce((s, e) => s + e.social, 0);
    const tax = entries.reduce((s, e) => s + e.tax, 0);
    const bonusTax = entries.reduce((s, e) => s + e.bonusTax, 0);
    rows.push({
      month: m,
      entries,
      gross: round2(gross),
      social: round2(social),
      tax: round2(tax),
      bonusTax: round2(bonusTax),
      net: round2(gross - social - tax - bonusTax),
      rate: entries.reduce((r, e) => Math.max(r, e.rate), 0),
      isGap: entries.length === 0,
      isFuture: m > currentMonth,
    });
  }
  return rows;
}
