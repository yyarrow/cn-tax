import { inferMonthlyDeduction } from "@/lib/tax/social";
import type { CityPreset } from "@/lib/tax/constants";
import type { Segment } from "@/lib/tax/types";

function clamp(v: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, v));
}

/** 按税前工资：基数 = clamp(税前, 下限, 上限)（养老保险不允许低于下限缴） */
export function baseFromGross(gross: number, city: { socialMin: number; socialMax: number }): number {
  return clamp(gross, city.socialMin, city.socialMax);
}

/** 按工资条上的养老保险个人扣款：基数 = 扣款 ÷ 8% */
export function baseFromPensionDeduction(x: number): number {
  return x / 0.08;
}

export interface BaseFromNetInput {
  gross: number;
  net: number;
  /** 到手样本所在月份 1–12 */
  month: number;
  city: CityPreset;
  /** 公积金个人比例（没交填 0） */
  housingRate: number;
  /** 专项附加扣除合计（元/月） */
  sadMonthly: number;
}

/**
 * 税前 + 到手反推缴费基数：先反推五险一金个人合计 D，
 * 再按 D = B×(养老+医疗+失业+公积金比例) + 医疗固定额 解出 B（社保、公积金基数视为同一个 B）。
 */
export function baseFromNet(p: BaseFromNetInput): { base: number; deduction: number; ok: boolean; note: string } {
  const seg: Segment = {
    id: "pension-infer",
    name: "infer",
    startMonth: 1,
    endMonth: 12,
    monthlySalary: p.gross,
    netSample: { month: p.month, amount: p.net },
    social: { mode: "infer" },
  };
  const r = inferMonthlyDeduction(seg, p.sadMonthly, true);
  const fallback = baseFromGross(p.gross, p.city);
  if (!r.ok) return { base: fallback, deduction: 0, ok: false, note: r.note || "反推失败，按税前工资估算" };
  const rate = p.city.pensionRate + p.city.medicalRate + p.city.unemploymentRate + p.housingRate;
  const raw = rate > 0 ? (r.value - p.city.medicalFixed) / rate : NaN;
  if (!Number.isFinite(raw) || raw <= 0) {
    return { base: fallback, deduction: r.value, ok: false, note: "反推出的基数不合理，按税前工资估算" };
  }
  return { base: raw, deduction: r.value, ok: true, note: r.note };
}
