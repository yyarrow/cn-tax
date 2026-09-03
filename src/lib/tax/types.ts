export type SocialMode = "auto" | "infer" | "manual";

/** 五险一金个人缴纳设置（每段工作各自一份） */
export interface SocialConfig {
  /** auto: 按城市参考值估算；infer: 由税后到手反推；manual: 手动填写 */
  mode: SocialMode;
  /** 社保缴费基数（manual） */
  socialBase?: number;
  /** 公积金缴存基数（manual） */
  housingBase?: number;
  pensionRate?: number;
  medicalRate?: number;
  medicalFixed?: number;
  unemploymentRate?: number;
  /** 公积金个人比例（auto/manual 都可覆盖） */
  housingRate?: number;
  /** 补充公积金比例 */
  supplementaryHousingRate?: number;
  /** 其他税前扣除（企业年金个人部分等），元/月 */
  extraMonthly?: number;
}

export interface Segment {
  id: string;
  name: string;
  /** 1–12，含 */
  startMonth: number;
  endMonth: number;
  /** 税前月薪 */
  monthlySalary: number;
  /** 年终奖（在本段发放） */
  bonus?: number;
  bonusMonth?: number;
  /** 某个月的税后到手，用于反推五险一金 */
  netSample?: { month: number; amount: number };
  social: SocialConfig;
  /** 今年首次就业（应届生等）：减除费用从 1 月起累计 */
  firstJobOfYear?: boolean;
  /** 个别月份工资不同（试用期、请假、半月入职等）：月份 → 当月税前 */
  monthOverrides?: Record<number, number>;
}

export interface SpecialDeductions {
  children: number;
  continuingEducation: "none" | "degree" | "cert";
  housing: "none" | "loan" | "rent";
  rentTier: 1 | 2 | 3;
  elderly: "none" | "only" | "shared";
  /** 非独生子女分摊金额（≤1500） */
  elderlySharedAmount: number;
  infants: number;
  /** 大病医疗年度自付金额 */
  seriousIllnessPaid: number;
  /** 个人养老金年缴（≤12000） */
  personalPension: number;
  /** 其他年度扣除（税优健康险等） */
  otherAnnual: number;
}

export type BonusMode = "auto" | "separate" | "combined";

/** 一次期权 / RSU 兑现（行权、归属、回购），直接填税前到账金额 */
export interface EquityEvent {
  id: string;
  name: string;
  /** 税前兑现金额 */
  amount: number;
  /** 兑现月份 1–12 */
  month: number;
}

/**
 * combined: 并入工资薪金，由公司随工资代扣（回购、非上市未备案等）
 * listed: 上市公司股权激励，不并入综合所得，全年合并按年度税率表单独计税
 * unlisted: 非上市公司已备案递延，转让时按财产转让所得 20%
 */
export type EquityTaxMode = "combined" | "listed" | "unlisted";

export interface EquityPlan {
  taxMode: EquityTaxMode;
  events: EquityEvent[];
  /** 规划：今年再兑现多少（用于规划图上的标记） */
  plannedExtra?: number;
  /** 规划图横轴上限 */
  chartMax?: number;
}

export interface Profile {
  year: number;
  cityId: string;
  segments: Segment[];
  deductions: SpecialDeductions;
  bonusMode: BonusMode;
  equity: EquityPlan;
}

/* ---------- 计算结果 ---------- */

export interface SocialBreakdown {
  socialBase: number;
  housingBase: number;
  pension: number;
  medical: number;
  unemployment: number;
  housing: number;
  supplementaryHousing: number;
  extra: number;
  total: number;
}

export interface ResolvedSocial {
  monthly: number;
  breakdown?: SocialBreakdown;
  source: "preset" | "inferred" | "manual" | "inferFailed";
  /** 反推时的说明 */
  note?: string;
  /** 反推得到的近似公积金比例 */
  inferredHousingRate?: number;
}

export interface MonthEntry {
  month: number;
  segmentId: string;
  segmentName: string;
  /** 本段任职第几个月（用于减除费用） */
  indexInSegment: number;
  salary: number;
  bonus: number;
  bonusCombined: boolean;
  /** 并入工资计税的期权 / RSU 兑现 */
  equity: number;
  social: number;
  sad: number;
  cumIncome: number;
  cumTaxable: number;
  /** 当前所处预扣率 */
  rate: number;
  /** 本月预扣税（工资） */
  tax: number;
  /** 年终奖单独计税税额（发放月） */
  bonusTax: number;
  net: number;
  isFuture: boolean;
}

export interface MonthRow {
  month: number;
  entries: MonthEntry[];
  gross: number;
  social: number;
  tax: number;
  bonusTax: number;
  net: number;
  equity: number;
  /** 最高预扣率（多段并存时取最高） */
  rate: number;
  isGap: boolean;
  isFuture: boolean;
}

export interface AnnualResult {
  totalSalary: number;
  totalBonus: number;
  bonusSeparate: boolean;
  /** 期权 / RSU 已兑现收入 */
  equityIncome: number;
  equityMode: EquityTaxMode;
  /** 期权 / RSU 的税（并入模式下为归因于期权的增量税） */
  equityTax: number;
  totalSocial: number;
  basicDeduction: number;
  sadAnnual: number;
  sadMonthly: number;
  otherDeductions: number;
  /** 综合所得应纳税所得额 */
  taxable: number;
  /** 综合所得应纳税额（不含单独计税的奖金） */
  comprehensiveTax: number;
  bonusTax: number;
  /** 全年应纳税额（综合 + 奖金单独 + 期权单独） */
  totalTax: number;
  withheld: number;
  /** 正数补税，负数退税 */
  settlement: number;
  marginalRate: number;
  bracketIndex: number;
  /** 距离下一档还差多少应纳税所得额 */
  roomToNextBracket: number;
  effectiveRate: number;
  grossTotal: number;
  netTotal: number;
  gapMonths: number[];
  /** 汇算清缴是否可免申报 */
  settlementExempt: boolean;
}

export interface BonusAnalysis {
  bonus: number;
  /** 不含奖金的综合所得应纳税所得额（可能为负，表示扣除未用满） */
  baseTaxable: number;
  separate: { bonusTax: number; comprehensiveTax: number; total: number };
  combined: { comprehensiveTax: number; total: number };
  recommended: "separate" | "combined";
  saving: number;
  /** 陷阱区间提示 */
  trap?: { lower: number; upper: number; extraTax: number };
  /** 若可与公司协商工资/奖金拆分 */
  optimalSplit: {
    totalCash: number;
    bestBonus: number;
    bestTotalTax: number;
    currentTotalTax: number;
    saving: number;
  };
}

export interface EquityKink {
  /** 再兑现到这个金额之前，边际税率是 rateBefore */
  x: number;
  rateBefore: number;
  rateAfter: number;
  /** 兑现 x 时的累计税 */
  tax: number;
}

export interface EquityResult {
  mode: EquityTaxMode;
  /** 已录入的兑现收入 */
  income: number;
  /** 已录入兑现对应的税 */
  tax: number;
  /** 当前（再兑现 0 元时）的边际税率 */
  currentRate: number;
  /** 规划曲线：再兑现 x 元 → 增量税 */
  curve: { x: number; tax: number }[];
  kinks: EquityKink[];
  maxX: number;
  planned?: {
    amount: number;
    tax: number;
    net: number;
    effectiveRate: number;
    marginalRate: number;
    /** 若把超过上一个拐点的部分推到明年，能省多少 */
    deferKink?: number;
    deferSaving: number;
  };
}

export interface Advice {
  id: string;
  title: string;
  detail: string;
  /** 预计年节省（元） */
  saving: number;
  kind: "deduction" | "bonus" | "equity" | "settlement" | "info";
}
