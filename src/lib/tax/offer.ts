import { computeAll } from "./index";
import { analyzeBonus } from "./bonus";
import { round2 } from "./brackets";
import { getCity } from "./constants";
import { computeSocialBreakdown } from "./social";
import type { Profile, SpecialDeductions } from "./types";

/** 公积金免税上限：单位、个人各自的缴存比例（基本 + 补充合计）不超过 12%（财税〔2006〕10 号） */
export const HOUSING_TAX_FREE_RATE = 0.12;
/** 个人年金缴费税前扣除上限：本人缴费工资计税基数的 4%（财税〔2013〕103 号） */
export const ANNUITY_DEDUCT_RATE = 0.04;
export const BENEFIT_MAX = { supplementaryHousing: 0.12, annuityEmployer: 0.08, annuityPersonal: 0.04 } as const;
/** 「按事业单位 / 国企预填」：公积金个人 12%，职业年金单位 8% / 个人 4% */
export const SOE_PRESET = { housingRate: 0.12, annuityEmployerRate: 0.08, annuityPersonalRate: 0.04 } as const;

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
  /** 补充公积金比例（0–12%，个人和单位同比例；缺省按 0） */
  supplementaryHousingRate?: number;
  /** 企业年金 / 职业年金：单位比例（0–8%，按税前月薪计；缺省按 0） */
  annuityEmployerRate?: number;
  /** 企业年金 / 职业年金：个人比例（0–4%；缺省按 0） */
  annuityPersonalRate?: number;
  /** 其他现金补贴（元/年：餐补、交通、通讯、过节费等），按工资计税，平摊到 12 个月 */
  cashAllowance?: number;
  /** 非现金福利估值（元/年：体检、补充医疗、食堂、宿舍等），不计个税、不进到手，只进总回报 */
  nonCashBenefit?: number;
}

function clampNum(v: unknown, lo: number, hi: number): number {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : 0;
}

/** 福利字段清洗：缺失 / 非数字按 0，比例夹到合法范围（分享链接的数据不可信） */
export function cleanBenefits(o: Partial<OfferInput>) {
  return {
    suppRate: clampNum(o.supplementaryHousingRate, 0, BENEFIT_MAX.supplementaryHousing),
    annuityEmployerRate: clampNum(o.annuityEmployerRate, 0, BENEFIT_MAX.annuityEmployer),
    annuityPersonalRate: clampNum(o.annuityPersonalRate, 0, BENEFIT_MAX.annuityPersonal),
    cashAllowance: clampNum(o.cashAllowance, 0, 1e9),
    nonCashBenefit: clampNum(o.nonCashBenefit, 0, 1e9),
  };
}

/** 福利与账户的月度拆解（元/月，除注明外）；一份 offer 的所有口径判断都在这里 */
function planBenefits(o: OfferInput) {
  const city = getCity(o.cityId);
  const salary = Math.max(0, o.monthlySalary);
  const b = cleanBenefits(o);
  // 社保 / 公积金基数只看税前月薪，现金补贴不进基数
  const bd = computeSocialBreakdown(salary, { mode: "auto", housingRate: o.housingRate, supplementaryHousingRate: b.suppRate }, city);
  const socialPart = round2(bd.pension + bd.medical + bd.unemployment);
  // 公积金：基本 + 补充合计比例超过 12% 的部分不能免税（个人不扣除、单位缴的并入工资）
  const housingPersonal = bd.housing + bd.supplementaryHousing;
  const totalRate = (o.housingRate ?? city.housingRateDefault) + b.suppRate;
  const housingCap = Math.round(bd.housingBase * HOUSING_TAX_FREE_RATE);
  const housingOver = totalRate > HOUSING_TAX_FREE_RATE + 1e-9 ? Math.max(0, housingPersonal - housingCap) : 0;
  const housingDeductible = housingPersonal - housingOver;
  // 年金：单位缴费暂不计税；个人缴费在 4%（基数 = 月薪，最高按社平 3 倍 = 城市社保上限）内税前扣除
  const annuityPersonal = round2(salary * b.annuityPersonalRate);
  const annuityEmployer = round2(salary * b.annuityEmployerRate);
  const annuityCap = round2(Math.min(salary, city.socialMax) * ANNUITY_DEDUCT_RATE);
  const annuityDeductible = Math.min(annuityPersonal, annuityCap);
  const annuityOver = round2(annuityPersonal - annuityDeductible);
  return {
    city,
    salary,
    b,
    bd,
    socialPart,
    housingPersonal,
    housingOver,
    housingDeductible,
    annuityPersonal,
    annuityEmployer,
    annuityDeductible,
    annuityOver,
    allowanceMonthly: b.cashAllowance / 12,
  };
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
  /** 账户与福利（全年，元）：公积金、年金都含个人 + 单位；这些钱不在到手里 */
  accounts: {
    /** 公积金账户（基本 + 补充，个人 + 单位） */
    housing: number;
    /** 其中补充公积金（个人 + 单位） */
    housingSupplementary: number;
    /** 年金账户（个人 + 单位） */
    annuity: number;
    annuityPersonal: number;
    annuityEmployer: number;
    /** 非现金福利估值 */
    nonCash: number;
    /** 其他现金补贴（已含在税前总包和到手里） */
    cashAllowance: number;
  };
  /** 全年总回报 = 全年到手 + 公积金 + 年金 + 非现金福利估值 */
  totalReturn: number;
  /** 超出免税 / 扣除上限、需要自己提醒用户的部分（全年，元） */
  overLimit: {
    /** 个人公积金超过 12% 的部分（单位同额）：并入工资计税 */
    housingPersonal: number;
    /** 个人年金超过 4% / 封顶基数的部分：不能税前扣除 */
    annuityPersonal: number;
  };
  /** 首页完整测算用的 Profile（分享 / 跳转首页时带上） */
  profile: Profile;
}

export interface OfferComparison {
  results: OfferResult[];
  /** 全年到手最高的 offer */
  bestId: string;
  /** 各 offer 相对最高者的差额（负数） */
  deltas: Record<string, number>;
  /** 全年总回报最高的 offer */
  bestReturnId: string;
  /** 各 offer 全年总回报相对最高者的差额（负数） */
  returnDeltas: Record<string, number>;
}

type Plan = ReturnType<typeof planBenefits>;

function buildProfile(o: OfferInput, year: number, deductions: SpecialDeductions, plan: Plan, mode: "display" | "engine"): Profile {
  const { city, salary, allowanceMonthly } = plan;
  // engine：单位超限公积金作为「虚拟工资」并入计税（算完再从到手里扣掉）；社保合计只含税前可扣除的部分
  // display：首页完整测算用，按自然口径（补充公积金 / 年金个人部分走 SocialConfig），不处理超限
  const monthly = salary + allowanceMonthly + (mode === "engine" ? plan.housingOver : 0);
  return {
    year,
    cityId: city.id,
    segments: [
      {
        id: `offer-${o.id}`,
        name: o.name || "Offer",
        startMonth: 1,
        endMonth: 12,
        monthlySalary: monthly,
        bonus: o.bonus > 0 ? o.bonus : undefined,
        bonusMonth: o.bonus > 0 ? 12 : undefined,
        social:
          mode === "engine"
            ? { mode: "manual", totalMonthly: round2(plan.socialPart + plan.housingDeductible + plan.annuityDeductible) }
            : {
                mode: "auto",
                housingRate: o.housingRate,
                supplementaryHousingRate: plan.b.suppRate > 0 ? plan.b.suppRate : undefined,
                extraMonthly: plan.annuityDeductible > 0 ? plan.annuityDeductible : undefined,
                // 现金补贴不进缴费基数：锁定按月薪算出的基数
                ...(allowanceMonthly > 0 ? { socialBase: plan.bd.socialBase, housingBase: plan.bd.housingBase } : {}),
              },
        monthOverrides: o.signOn > 0 ? { 1: monthly + o.signOn } : undefined,
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

/** 首页完整测算用的 Profile（含现金补贴、补充公积金、年金个人部分；不处理超限部分） */
export function offerToProfile(o: OfferInput, year: number, deductions: SpecialDeductions): Profile {
  return buildProfile(o, year, deductions, planBenefits(o), "display");
}

export function computeOffer(o: OfferInput, year: number, deductions: SpecialDeductions): OfferResult {
  const plan = planBenefits(o);
  const profile = buildProfile(o, year, deductions, plan, "display");
  const r = computeAll(buildProfile(o, year, deductions, plan, "engine"), 12);
  const a = r.annual;
  // 引擎里多出来的「虚拟工资」（单位超限公积金）不是钱；个人超限公积金 / 超限年金进了引擎的税前扣除之外，但确实从到手里扣走
  const phantomYear = round2(plan.housingOver * 12);
  const cashFixMonthly = plan.housingOver + plan.housingOver + plan.annuityOver;
  const regular = r.rows.find((row) => row.month === 6);
  const grossTotal = round2(a.grossTotal - phantomYear);
  const netTotal = round2(a.netTotal - cashFixMonthly * 12);
  const totalCash = a.totalSalary + a.totalBonus + (a.equityMode === "combined" ? a.equityIncome : 0) - phantomYear;
  let split: OfferResult["split"] = null;
  if (a.totalBonus > 0 || a.totalSalary > 0) {
    const baseTaxable = round2(a.taxable - (a.bonusSeparate ? 0 : a.totalBonus));
    const b = analyzeBonus(baseTaxable, a.totalBonus, totalCash);
    if (b.optimalSplit.saving > 1) split = { bestBonus: b.optimalSplit.bestBonus, saving: b.optimalSplit.saving };
  }
  const housingSupplementary = round2(plan.bd.supplementaryHousing * 2 * 12);
  const accounts: OfferResult["accounts"] = {
    housing: round2((plan.housingPersonal * 2) * 12),
    housingSupplementary,
    annuity: round2((plan.annuityPersonal + plan.annuityEmployer) * 12),
    annuityPersonal: round2(plan.annuityPersonal * 12),
    annuityEmployer: round2(plan.annuityEmployer * 12),
    nonCash: plan.b.nonCashBenefit,
    cashAllowance: plan.b.cashAllowance,
  };
  return {
    id: o.id,
    cityName: plan.city.name,
    grossTotal,
    // 五险一金个人部分（含补充公积金；年金个人部分在 accounts.annuityPersonal）
    totalSocial: round2((plan.socialPart + plan.housingPersonal) * 12),
    totalTax: a.totalTax,
    netTotal,
    netMonthly: round2(netTotal / 12),
    netRegularMonth: regular ? round2(regular.net - cashFixMonthly) : 0,
    effectiveRate: grossTotal > 0 ? a.totalTax / grossTotal : 0,
    marginalRate: a.marginalRate,
    bonusSeparate: a.bonusSeparate,
    split,
    accounts,
    totalReturn: round2(netTotal + accounts.housing + accounts.annuity + accounts.nonCash),
    overLimit: { housingPersonal: round2(plan.housingOver * 12), annuityPersonal: round2(plan.annuityOver * 12) },
    profile,
  };
}

export function compareOffers(offers: OfferInput[], year: number, deductions: SpecialDeductions): OfferComparison {
  const results = offers.map((o) => computeOffer(o, year, deductions));
  const best = results.reduce((m, r) => (r.netTotal > m.netTotal ? r : m), results[0]);
  const bestReturn = results.reduce((m, r) => (r.totalReturn > m.totalReturn ? r : m), results[0]);
  const deltas: Record<string, number> = {};
  const returnDeltas: Record<string, number> = {};
  for (const r of results) {
    deltas[r.id] = round2(r.netTotal - best.netTotal);
    returnDeltas[r.id] = round2(r.totalReturn - bestReturn.totalReturn);
  }
  return { results, bestId: best?.id ?? "", deltas, bestReturnId: bestReturn?.id ?? "", returnDeltas };
}
