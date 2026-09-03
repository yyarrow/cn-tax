import { getCity } from "./constants";
import { round2 } from "./brackets";
import { annualOnlyDeductions, resolveSocial, sadMonthly } from "./social";
import { effectiveBonusMonth, mergeRows, salaryFor, simulateSegment, socialFor } from "./withholding";
import { computeAnnual } from "./annual";
import { analyzeBonus } from "./bonus";
import { analyzeEquity, equityIncome } from "./equity";
import { buildAdvice } from "./advice";
import { BASIC_DEDUCTION_ANNUAL } from "./constants";
import type { Advice, AnnualResult, BonusAnalysis, EquityResult, MonthRow, Profile, ResolvedSocial } from "./types";

export interface FullResult {
  rows: MonthRow[];
  annual: AnnualResult;
  bonus: BonusAnalysis | null;
  bonusSeparate: boolean;
  equity: EquityResult;
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

  const segSalary = (seg: typeof segments[number]) => {
    let t = 0;
    for (let m = seg.startMonth; m <= seg.endMonth; m++) t += salaryFor(seg, m);
    return t;
  };
  const totalSalary = round2(segments.reduce((s, seg) => s + segSalary(seg), 0));

  // 期权 / RSU：并入模式按月挂到覆盖该月的工作段（由公司随工资代扣）
  const equityMode = profile.equity.taxMode;
  const equityTotal = equityIncome(profile.equity);
  const equityByMonth: Record<string, Record<number, number>> = {};
  let equityCombined = 0;
  if (equityMode === "combined") {
    for (const ev of profile.equity.events) {
      if (!ev.amount || ev.amount <= 0) continue;
      equityCombined += ev.amount;
      const host = segments.find((s) => ev.month >= s.startMonth && ev.month <= s.endMonth);
      if (host) {
        equityByMonth[host.id] ??= {};
        equityByMonth[host.id][ev.month] = (equityByMonth[host.id][ev.month] ?? 0) + ev.amount;
      }
    }
  }
  equityCombined = round2(equityCombined);
  const equitySeparate = equityMode === "combined" ? 0 : equityTotal;
  const totalBonus = round2(segments.reduce((s, seg) => s + (effectiveBonusMonth(seg) ? seg.bonus! : 0), 0));
  const segSocial = (seg: typeof segments[number]) => {
    let t = 0;
    for (let m = seg.startMonth; m <= seg.endMonth; m++) t += socialFor(seg, m, socials[seg.id].monthly);
    return t;
  };
  const totalSocial = round2(segments.reduce((s, seg) => s + segSocial(seg), 0));
  const baseTaxable = round2(
    totalSalary + equityCombined - BASIC_DEDUCTION_ANNUAL - totalSocial - sadM * 12 - annualOnlyDeductions(profile.deductions).total,
  );

  const bonus = totalBonus > 0 ? analyzeBonus(baseTaxable, totalBonus, totalSalary + equityCombined + totalBonus) : null;
  const bonusSeparate =
    profile.bonusMode === "auto" ? (bonus ? bonus.recommended === "separate" : true) : profile.bonusMode === "separate";

  const entries = segments.flatMap((seg) =>
    simulateSegment(seg, socials[seg.id].monthly, sadM, bonusSeparate, currentMonth, equityByMonth[seg.id] ?? {}),
  );
  const rows = mergeRows(entries, currentMonth);

  // 单独计税 / 递延的期权税
  const equityPre = analyzeEquity(profile.equity, equityMode === "listed" ? equitySeparate : 0, equitySeparate);
  const annual = computeAnnual(
    profile,
    rows,
    { totalSalary, totalBonus, totalSocial, equityCombined, equitySeparate, equitySeparateTax: equityMode === "combined" ? 0 : equityPre.tax },
    bonusSeparate,
  );
  // 规划曲线：combined 模式底数是综合所得应纳税所得额；listed 模式是已兑现的股权激励收入
  const equity = analyzeEquity(
    profile.equity,
    equityMode === "combined" ? annual.taxable : equityMode === "listed" ? equitySeparate : 0,
    equityMode === "combined" ? equityCombined : equitySeparate,
  );
  const advice = buildAdvice(profile, annual, bonus, equity, socials, city);
  return { rows, annual, bonus, bonusSeparate, equity, socials, advice };
}

export * from "./types";
export * from "./constants";
export { annualTax, bonusSeparateTax, marginalRate, findBracket, round2 } from "./brackets";
export { bonusTrapZones } from "./bonus";
export { sadMonthly, annualOnlyDeductions, computeSocialBreakdown, inferMonthlyDeduction } from "./social";
