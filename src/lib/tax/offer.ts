import { computeAll } from "./index";
import { analyzeBonus } from "./bonus";
import { round2 } from "./brackets";
import { getCity } from "./constants";
import type { Profile, SpecialDeductions } from "./types";

/** 一份 offer 的输入（全部为税前、人民币） */
export interface OfferInput {
  id: string;
  name: string;
  cityId: string;
  monthlySalary: number;
  /** 年终奖，按全年一次性奖金处理（自动选单独 / 并入更省的一种） */
  bonus: number;
  /** 签字费 / 入职奖金，入职首月随工资并入计税 */
  signOn: number;
  /** 期权 / RSU 年均归属额，按并入工资计税（上市公司单独计税见首页兑现规划） */
  equityPerYear: number;
  /** 公积金个人比例（可选，默认城市常见值） */
  housingRate?: number;
}

export interface OfferResult {
  id: string;
  cityName: string;
  /** 全年税前总包 */
  grossTotal: number;
  totalSocial: number;
  totalTax: number;
  netTotal: number;
  /** 月均到手（全年到手 ÷ 12） */
  netMonthly: number;
  /** 仅工资部分的普通月份到手（不含奖金月） */
  netRegularMonth: number;
  effectiveRate: number;
  marginalRate: number;
  bonusSeparate: boolean;
  /** 同样总现金下，年终奖调到 bestBonus 可再省 saving */
  split: { bestBonus: number; saving: number } | null;
  /** 首页完整测算用的 Profile（分享 / 跳转首页时带上） */
  profile: Profile;
}

export interface OfferComparison {
  results: OfferResult[];
  /** 全年到手最高的 offer */
  bestId: string;
  /** 各 offer 相对最高者的差额（负数） */
  deltas: Record<string, number>;
}

export function offerToProfile(o: OfferInput, year: number, deductions: SpecialDeductions): Profile {
  const city = getCity(o.cityId);
  return {
    year,
    cityId: city.id,
    segments: [
      {
        id: `offer-${o.id}`,
        name: o.name || "Offer",
        startMonth: 1,
        endMonth: 12,
        monthlySalary: Math.max(0, o.monthlySalary),
        bonus: o.bonus > 0 ? o.bonus : undefined,
        bonusMonth: o.bonus > 0 ? 12 : undefined,
        social: { mode: "auto", housingRate: o.housingRate },
        monthOverrides: o.signOn > 0 ? { 1: Math.max(0, o.monthlySalary) + o.signOn } : undefined,
      },
    ],
    deductions,
    bonusMode: "auto",
    equity: {
      taxMode: "combined",
      events: o.equityPerYear > 0 ? [{ id: `eq-${o.id}`, name: "期权 / RSU 年均归属", amount: o.equityPerYear, month: 12 }] : [],
    },
  };
}

export function computeOffer(o: OfferInput, year: number, deductions: SpecialDeductions): OfferResult {
  const profile = offerToProfile(o, year, deductions);
  const r = computeAll(profile, 12);
  const a = r.annual;
  const regular = r.rows.find((row) => row.month === 6);
  const totalCash = a.totalSalary + a.totalBonus + (a.equityMode === "combined" ? a.equityIncome : 0);
  let split: OfferResult["split"] = null;
  if (a.totalBonus > 0 || a.totalSalary > 0) {
    const baseTaxable = round2(a.taxable - (a.bonusSeparate ? 0 : a.totalBonus));
    const b = analyzeBonus(baseTaxable, a.totalBonus, totalCash);
    if (b.optimalSplit.saving > 1) split = { bestBonus: b.optimalSplit.bestBonus, saving: b.optimalSplit.saving };
  }
  return {
    id: o.id,
    cityName: getCity(o.cityId).name,
    grossTotal: a.grossTotal,
    totalSocial: a.totalSocial,
    totalTax: a.totalTax,
    netTotal: a.netTotal,
    netMonthly: round2(a.netTotal / 12),
    netRegularMonth: regular ? regular.net : 0,
    effectiveRate: a.effectiveRate,
    marginalRate: a.marginalRate,
    bonusSeparate: a.bonusSeparate,
    split,
    profile,
  };
}

export function compareOffers(offers: OfferInput[], year: number, deductions: SpecialDeductions): OfferComparison {
  const results = offers.map((o) => computeOffer(o, year, deductions));
  const best = results.reduce((m, r) => (r.netTotal > m.netTotal ? r : m), results[0]);
  const deltas: Record<string, number> = {};
  for (const r of results) deltas[r.id] = round2(r.netTotal - best.netTotal);
  return { results, bestId: best?.id ?? "", deltas };
}
