import { SAD_STANDARD, type CityPreset } from "./constants";
import { round2 } from "./brackets";
import { salaryFor, simulateSegment } from "./withholding";
import type { ResolvedSocial, Segment, SocialBreakdown, SocialConfig, SpecialDeductions } from "./types";

/** 员工按月向单位申报、预扣时可用的专项附加扣除（元/月） */
export function sadMonthly(d: SpecialDeductions): number {
  let s = 0;
  s += Math.max(0, d.children) * SAD_STANDARD.childEducation;
  if (d.continuingEducation === "degree") s += SAD_STANDARD.continuingEducationDegree;
  if (d.housing === "loan") s += SAD_STANDARD.housingLoan;
  if (d.housing === "rent") {
    s += d.rentTier === 1 ? SAD_STANDARD.rentTier1 : d.rentTier === 2 ? SAD_STANDARD.rentTier2 : SAD_STANDARD.rentTier3;
  }
  if (d.elderly === "only") s += SAD_STANDARD.elderlyOnly;
  if (d.elderly === "shared") s += Math.min(SAD_STANDARD.elderlySharedMax, Math.max(0, d.elderlySharedAmount));
  s += Math.max(0, d.infants) * SAD_STANDARD.infant;
  return s;
}

/** 只能在汇算清缴时扣除的年度项目 */
export function annualOnlyDeductions(d: SpecialDeductions): { cert: number; illness: number; pension: number; other: number; total: number } {
  const cert = d.continuingEducation === "cert" ? SAD_STANDARD.continuingEducationCert : 0;
  const illness = Math.min(
    SAD_STANDARD.seriousIllnessCap,
    Math.max(0, d.seriousIllnessPaid - SAD_STANDARD.seriousIllnessThreshold),
  );
  const pension = Math.min(SAD_STANDARD.personalPensionCap, Math.max(0, d.personalPension));
  const other = Math.max(0, d.otherAnnual);
  return { cert, illness, pension, other, total: cert + illness + pension + other };
}

function clamp(v: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, v));
}

/** 按城市规则 + 配置计算五险一金个人部分 */
export function computeSocialBreakdown(gross: number, cfg: SocialConfig, city: CityPreset): SocialBreakdown {
  const socialBase = cfg.socialBase ?? clamp(gross, city.socialMin, city.socialMax);
  const housingBase = cfg.housingBase ?? clamp(gross, city.housingMin, city.housingMax);
  const pensionRate = cfg.pensionRate ?? city.pensionRate;
  const medicalRate = cfg.medicalRate ?? city.medicalRate;
  const medicalFixed = cfg.medicalFixed ?? city.medicalFixed;
  const unemploymentRate = cfg.unemploymentRate ?? city.unemploymentRate;
  const housingRate = cfg.housingRate ?? city.housingRateDefault;
  const suppRate = cfg.supplementaryHousingRate ?? 0;
  const pension = round2(socialBase * pensionRate);
  const medical = round2(socialBase * medicalRate + medicalFixed);
  const unemployment = round2(socialBase * unemploymentRate);
  const housing = Math.round(housingBase * housingRate);
  const supplementaryHousing = Math.round(housingBase * suppRate);
  const extra = cfg.extraMonthly ?? 0;
  const total = round2(pension + medical + unemployment + housing + supplementaryHousing + extra);
  return { socialBase, housingBase, pension, medical, unemployment, housing, supplementaryHousing, extra, total };
}

/**
 * 由某个月的税后到手反推该段每月五险一金个人缴纳额。
 * 到手 = 税前 − 扣除额 D − 当月预扣税(D)。到手关于 D 严格单调递减，二分求唯一解。
 */
export function inferMonthlyDeduction(
  seg: Segment,
  sadMonthlyAmount: number,
  bonusSeparate: boolean,
): { value: number; ok: boolean; note: string } {
  const sample = seg.netSample;
  if (!sample || sample.amount <= 0) return { value: 0, ok: false, note: "未提供税后到手" };
  const m = sample.month;
  if (m < seg.startMonth || m > seg.endMonth) return { value: 0, ok: false, note: "样本月份不在本段工作期间内" };
  // 反推时忽略个别月份的五险一金覆盖（覆盖值本身就是要推的量）
  const plain: Segment = { ...seg, socialOverrides: undefined };
  const netAt = (d: number) => {
    const entries = simulateSegment(plain, d, sadMonthlyAmount, bonusSeparate, 12);
    const e = entries.find((x) => x.month === m)!;
    // 反推时忽略当月奖金（用户应给普通月份的到手）
    return e.salary - d - e.tax;
  };
  const target = sample.amount;
  if (target > seg.monthlySalary) return { value: 0, ok: false, note: "到手大于税前，请检查输入" };
  if (netAt(0) < target - 0.5) {
    return { value: 0, ok: false, note: "到手高于零扣除情况下的理论值，可能包含奖金/补贴，请换一个普通月份" };
  }
  let lo = 0;
  let hi = seg.monthlySalary;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    if (netAt(mid) > target) lo = mid;
    else hi = mid;
  }
  return { value: round2((lo + hi) / 2), ok: true, note: "" };
}

/** 决定一段工作每月的五险一金个人扣除额 */
export function resolveSocial(
  seg: Segment,
  city: CityPreset,
  sadMonthlyAmount: number,
  bonusSeparate: boolean,
): ResolvedSocial {
  const gross = seg.monthlySalary;
  if (seg.social.mode === "manual") {
    if (seg.social.totalMonthly !== undefined && seg.social.totalMonthly >= 0) {
      return { monthly: round2(seg.social.totalMonthly), source: "manual", note: "按你填写的合计" };
    }
    const breakdown = computeSocialBreakdown(gross, seg.social, city);
    return { monthly: breakdown.total, breakdown, source: "manual" };
  }
  if (seg.social.mode === "infer" && seg.netSample) {
    const sampleMonth = seg.netSample.month;
    const sampleGross = salaryFor(seg, sampleMonth);
    let value: number | undefined;
    let tax = 0;
    let failNote = "";
    if (seg.netSample.tax !== undefined && seg.netSample.tax >= 0) {
      // 工资条给了个税：直接相减，不用猜
      tax = seg.netSample.tax;
      value = round2(sampleGross - seg.netSample.amount - tax);
      if (value < 0) failNote = "到手 + 个税 大于税前，请检查输入";
    } else {
      const r = inferMonthlyDeduction(seg, sadMonthlyAmount, bonusSeparate);
      if (r.ok) {
        value = r.value;
        const e = simulateSegment({ ...seg, socialOverrides: undefined }, value, sadMonthlyAmount, bonusSeparate, 12).find((x) => x.month === sampleMonth);
        tax = e?.tax ?? 0;
      } else failNote = r.note;
    }
    if (value !== undefined && !failNote) {
      const ref = computeSocialBreakdown(gross, { mode: "auto", housingRate: 0 }, city);
      const socialPart = ref.pension + ref.medical + ref.unemployment;
      const housingPart = value - socialPart;
      const housingRate = housingPart / ref.housingBase;
      let note = seg.netSample.tax !== undefined ? "按工资条的到手和个税直接相减" : "由到手反推（个税按累计预扣法推算）";
      let inferredHousingRate: number | undefined;
      if (housingRate >= 0.045 && housingRate <= 0.175) {
        inferredHousingRate = Math.round(housingRate * 100) / 100;
        note += `：社保约 ${socialPart.toFixed(0)} 元 + 公积金约 ${housingPart.toFixed(0)} 元（≈${(inferredHousingRate * 100).toFixed(0)}%）`;
      } else if (housingPart < 0) {
        note += "，低于常规社保水平，公司可能按较低基数缴纳";
      } else {
        note += "，高于常规水平，可能含补充公积金或企业年金";
      }
      const ratio = sampleGross > 0 ? value / sampleGross : 0;
      let warning: string | undefined;
      if (ratio > 0.3 && seg.netSample.tax === undefined) {
        warning = `推算出的五险一金占税前 ${(ratio * 100).toFixed(0)}%，明显偏高（常见 15%–25%）。${
          sampleMonth <= 3 ? `${sampleMonth} 月刚开始累计、个税很少，扣款大头被算成了五险一金；` : ""
        }请确认到手是这个月的普通工资，或在旁边填上工资条里的「个税」。`;
      } else if (ratio > 0.3) {
        warning = `五险一金占税前 ${(ratio * 100).toFixed(0)}%，明显偏高，请核对工资条。`;
      }
      return {
        monthly: value,
        source: "inferred",
        note,
        inferredHousingRate,
        sample: { month: sampleMonth, gross: sampleGross, social: value, tax: round2(tax), net: seg.netSample.amount },
        warning,
      };
    }
    const fallback = computeSocialBreakdown(gross, seg.social, city);
    return { monthly: fallback.total, breakdown: fallback, source: "inferFailed", note: failNote };
  }
  const breakdown = computeSocialBreakdown(gross, seg.social, city);
  return { monthly: breakdown.total, breakdown, source: "preset" };
}
