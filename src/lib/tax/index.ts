import { getCity } from "./constants";
import { round2 } from "./brackets";
import { annualOnlyDeductions, resolveSocial, sadMonthly } from "./social";
import { effectiveBonusMonth, mergeRows, simulateSegment } from "./withholding";
import { computeAnnual } from "./annual";
import { analyzeBonus } from "./bonus";
import { analyzeEquity } from "./equity";
import { buildAdvice } from "./advice";
import { BASIC_DEDUCTION_ANNUAL } from "./constants";
import type { Advice, AnnualResult, BonusAnalysis, EquityResult, MonthRow, Profile, ResolvedSocial } from "./types";

export interface FullResult {
  rows: MonthRow[];
  annual: AnnualResult;
  bonus: BonusAnalysis | null;
  bonusSeparate: boolean;
  equity: EquityResult | null;
  socials: Record<string, ResolvedSocial>;
  advice: Advice[];
}

export function computeAll(profile: Profile, currentMonth = 12): FullResult {
  const city = getCity(profile.cityId);
  const sadM = sadMonthly(profile.deductions);
  const segments = profile.segments.filter((s) => s.monthlySalary > 0);

  // 先按“单独计税”解五险一金（反推只用普通月份，与奖金方式无关）
  const socials: Record<string, ResolvedSocial> = {};
  for (const seg of segments) socials[seg.id] = resolveSocial(seg, city, sadM, true);

  const months = (s: typeof segments[number]) => Math.max(0, s.endMonth - s.startMonth + 1);
  const totalSalary = round2(segments.reduce((s, seg) => s + seg.monthlySalary * months(seg), 0));
  const totalBonus = round2(segments.reduce((s, seg) => s + (effectiveBonusMonth(seg) ? seg.bonus! : 0), 0));
  const totalSocial = round2(segments.reduce((s, seg) => s + socials[seg.id].monthly * months(seg), 0));
  const baseTaxable = round2(
    totalSalary - BASIC_DEDUCTION_ANNUAL - totalSocial - sadM * 12 - annualOnlyDeductions(profile.deductions).total,
  );

  const bonus = totalBonus > 0 ? analyzeBonus(baseTaxable, totalBonus, totalSalary + totalBonus) : null;
  const bonusSeparate =
    profile.bonusMode === "auto" ? (bonus ? bonus.recommended === "separate" : true) : profile.bonusMode === "separate";

  const entries = segments.flatMap((seg) =>
    simulateSegment(seg, socials[seg.id].monthly, sadM, bonusSeparate, currentMonth),
  );
  const rows = mergeRows(entries, currentMonth);
  const annual = computeAnnual(profile, rows, { totalSalary, totalBonus, totalSocial }, bonusSeparate);
  const equity = analyzeEquity(profile.equity);
  const advice = buildAdvice(profile, annual, bonus, equity, socials, city);
  return { rows, annual, bonus, bonusSeparate, equity, socials, advice };
}

export * from "./types";
export * from "./constants";
export { annualTax, bonusSeparateTax, marginalRate, findBracket, round2 } from "./brackets";
export { bonusTrapZones } from "./bonus";
export { sadMonthly, annualOnlyDeductions, computeSocialBreakdown, inferMonthlyDeduction } from "./social";
