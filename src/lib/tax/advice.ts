import { SAD_STANDARD, type CityPreset } from "./constants";
import { annualTax, round2 } from "./brackets";
import type { Advice, AnnualResult, BonusAnalysis, EquityResult, Profile, ResolvedSocial } from "./types";

function fmt(n: number) {
  return Math.round(n).toLocaleString("zh-CN");
}

/** 增加 delta 的年度扣除后可节省的税 */
function savingFor(annual: AnnualResult, delta: number): number {
  const before = annual.comprehensiveTax;
  const after = annualTax(Math.max(0, annual.taxable - delta));
  return round2(before - after);
}

export function buildAdvice(
  profile: Profile,
  annual: AnnualResult,
  bonus: BonusAnalysis | null,
  equity: EquityResult,
  socials: Record<string, ResolvedSocial>,
  city: CityPreset,
): Advice[] {
  const out: Advice[] = [];
  const d = profile.deductions;
  const pct = `${(annual.marginalRate * 100).toFixed(0)}%`;

  // 汇算清缴：退税 / 补税
  if (annual.settlement < -1) {
    const why = annual.gapMonths.length
      ? `今年有 ${annual.gapMonths.length} 个月无工资，但 6 万减除和专项附加按全年算，预扣时没用满。`
      : "换工作后新单位重新累计，或专项附加未在预扣时申报，预扣多于应纳。";
    out.push({
      id: "refund",
      kind: "settlement",
      title: `明年 3–6 月汇算清缴，预计可退税 ${fmt(-annual.settlement)} 元`,
      detail: `${why}在个税 App 办年度汇算即可退到银行卡。`,
      saving: -annual.settlement,
    });
  } else if (annual.settlement > 1) {
    out.push({
      id: "pay",
      kind: "settlement",
      title: `汇算清缴预计需补税 ${fmt(annual.settlement)} 元${annual.settlementExempt ? "（符合免申报条件）" : ""}`,
      detail: annual.settlementExempt
        ? "年收入不超过 12 万或补税不超过 400 元，可免办汇算、不必补税。"
        : "换工作或多处取薪时，每家单位各自从头累计、各用一遍低税率档，汇算合并后要补。提前留出这笔钱。",
      saving: 0,
    });
  }

  // 未申报的专项附加扣除
  if (d.housing === "none") {
    const delta = (city.rentTier === 1 ? SAD_STANDARD.rentTier1 : city.rentTier === 2 ? SAD_STANDARD.rentTier2 : SAD_STANDARD.rentTier3) * 12;
    const s = savingFor(annual, delta);
    if (s > 0)
      out.push({
        id: "housing",
        kind: "deduction",
        title: `申报住房租金或房贷利息扣除，年省约 ${fmt(s)} 元`,
        detail: `租房每月扣 ${SAD_STANDARD.rentTier1}/${SAD_STANDARD.rentTier2}/${SAD_STANDARD.rentTier3}（按城市规模），首套房贷利息每月扣 ${SAD_STANDARD.housingLoan}，二选一。按 ${pct} 边际税率估。`,
        saving: s,
      });
  }
  if (d.elderly === "none") {
    const s = savingFor(annual, SAD_STANDARD.elderlyOnly * 12);
    if (s > 0)
      out.push({
        id: "elderly",
        kind: "deduction",
        title: `父母年满 60 岁可申报赡养老人扣除，年省最多约 ${fmt(s)} 元`,
        detail: `独生子女每月 ${SAD_STANDARD.elderlyOnly}，非独生与兄弟姐妹分摊、每人最高 ${SAD_STANDARD.elderlySharedMax}。`,
        saving: s,
      });
  }
  if (d.continuingEducation === "none") {
    const s = savingFor(annual, SAD_STANDARD.continuingEducationCert);
    if (s > 0)
      out.push({
        id: "edu",
        kind: "deduction",
        title: `考取职业资格证书当年可扣 ${SAD_STANDARD.continuingEducationCert} 元，省约 ${fmt(s)} 元`,
        detail: "CPA、法律职业资格、软考等证书取得当年一次性扣除；在职学历教育每月扣 400。",
        saving: s,
      });
  }

  // 个人养老金
  const pensionRoom = SAD_STANDARD.personalPensionCap - Math.min(SAD_STANDARD.personalPensionCap, d.personalPension);
  if (pensionRoom > 0) {
    const s = round2(savingFor(annual, pensionRoom) - pensionRoom * SAD_STANDARD.personalPensionWithdrawRate);
    if (s > 0)
      out.push({
        id: "pension",
        kind: "deduction",
        title: `个人养老金缴满 ${fmt(SAD_STANDARD.personalPensionCap)} 元/年，净省约 ${fmt(s)} 元`,
        detail: `缴费时按 ${pct} 税前扣除，领取时只按 ${SAD_STANDARD.personalPensionWithdrawRate * 100}% 缴税。边际税率越高越划算，3% 档意义不大。`,
        saving: s,
      });
  }

  // 公积金比例
  for (const seg of profile.segments) {
    const rs = socials[seg.id];
    const rate = seg.social.housingRate ?? rs?.inferredHousingRate ?? city.housingRateDefault;
    if (rate < 0.12 && rs?.breakdown) {
      const months = seg.endMonth - seg.startMonth + 1;
      const delta = Math.round(rs.breakdown.housingBase * (0.12 - rate)) * months;
      const s = savingFor(annual, delta);
      if (s > 0)
        out.push({
          id: `housing-rate-${seg.id}`,
          kind: "deduction",
          title: `${seg.name || "该段工作"}公积金比例提到 12%，年省约 ${fmt(s)} 元`,
          detail: `当前约 ${(rate * 100).toFixed(0)}%。个人缴存全额税前扣除，公司等额配缴，钱还是你的。能否调问 HR。`,
          saving: s,
        });
    }
  }

  // 年终奖
  if (bonus && bonus.bonus > 0) {
    if (bonus.saving > 1)
      out.push({
        id: "bonus-mode",
        kind: "bonus",
        title: `年终奖选择「${bonus.recommended === "separate" ? "单独计税" : "并入综合所得"}」，比另一种少交 ${fmt(bonus.saving)} 元`,
        detail:
          bonus.recommended === "separate"
            ? "政策至 2027 年底。汇算时在个税 App 自行切换计税方式即可。"
            : "扣除额没用满或工资较低，并入能用上低税率档。汇算时在个税 App 选并入。",
        saving: bonus.saving,
      });
    if (bonus.trap)
      out.push({
        id: "bonus-trap",
        kind: "bonus",
        title: `年终奖 ${fmt(bonus.bonus)} 元落在陷阱区间，多发反而少拿 ${fmt(bonus.trap.extraTax)} 元`,
        detail: `${fmt(bonus.trap.lower)}–${fmt(bonus.trap.upper)} 是“多发一元多缴上千”的区间。可协商把超出 ${fmt(bonus.trap.lower)} 的部分放进工资。`,
        saving: bonus.trap.extraTax,
      });
    if (bonus.optimalSplit.saving > 1 && Math.abs(bonus.optimalSplit.bestBonus - bonus.bonus) > 1)
      out.push({
        id: "bonus-split",
        kind: "bonus",
        title: `若可协商，年终奖调整为 ${fmt(bonus.optimalSplit.bestBonus)} 元、其余放工资，再省 ${fmt(bonus.optimalSplit.saving)} 元`,
        detail: "总现金不变，只改工资 : 年终奖比例。谈 offer 时可以提。",
        saving: bonus.optimalSplit.saving,
      });
  }

  // 期权 / RSU
  const nextKink = equity.kinks.find((k) => k.x > 0);
  if (equity.mode !== "unlisted" && nextKink && (equity.income > 0 || (equity.planned?.amount ?? 0) > 0)) {
    out.push({
      id: "equity-room",
      kind: "equity",
      title: `今年再兑现期权 / RSU 不超过 ${fmt(nextKink.x)} 元，仍按 ${(nextKink.rateBefore * 100).toFixed(0)}% 边际税率`,
      detail: `超出部分按 ${(nextKink.rateAfter * 100).toFixed(0)}%。${
        equity.mode === "combined" ? "回购款和工资共用年度税率表；" : "股权激励全年合并单独计税；"
      }不想跳档就把超出部分放到明年。`,
      saving: 0,
    });
  }
  if (equity.planned && equity.planned.deferSaving > 1 && equity.planned.deferKink)
    out.push({
      id: "equity-defer",
      kind: "equity",
      title: `计划兑现 ${fmt(equity.planned.amount)} 元：今年只兑现到 ${fmt(equity.planned.deferKink)} 元、其余明年，可省约 ${fmt(equity.planned.deferSaving)} 元`,
      detail: "跨年分批可重复利用低税率档。权衡股价波动和回购窗口，税差不大时不必硬等。",
      saving: equity.planned.deferSaving,
    });
  if (equity.mode === "unlisted" && equity.income > 0)
    out.push({
      id: "equity-unlisted",
      kind: "equity",
      title: "非上市公司期权：确认公司已办理递延纳税备案",
      detail: "备案后行权不交、转让时按 20%；未备案则并入工资，最高 45%（切到「并入工资」模式测算）。",
      saving: 0,
    });

  out.push({
    id: "annuity",
    kind: "info",
    title: "问问公司是否有企业年金 / 税优健康险",
    detail: "企业年金个人缴费（工资 4% 内）和税优健康险（每年 2400）都可税前扣除。",
    saving: 0,
  });

  return out.sort((a, b) => b.saving - a.saving);
}
