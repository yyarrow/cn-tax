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

export interface EquityGrant {
  id: string;
  name: string;
  kind: "option" | "rsu";
  quantity: number;
  /** 行权价（期权） */
  strikePrice: number;
  /** 行权/归属时市价 */
  fairValue: number;
  /** 行权月份 1–12 */
  month: number;
}

export interface EquityPlan {
  /** listed: 上市公司股权激励单独计税；unlisted: 非上市公司备案递延纳税 */
  companyType: "listed" | "unlisted";
  grants: EquityGrant[];
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
  /** 最高预扣率（多段并存时取最高） */
  rate: number;
  isGap: boolean;
  isFuture: boolean;
}

export interface AnnualResult {
  totalSalary: number;
  totalBonus: number;
  bonusSeparate: boolean;
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
  /** 全年应纳税额（综合 + 奖金单独） */
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

export interface EquityResult {
  totalIncome: number;
  companyType: "listed" | "unlisted";
  taxOneYear: number;
  rateOneYear: number;
  splitTwoYears: { perYear: number; totalTax: number; saving: number };
  splitThreeYears: { perYear: number; totalTax: number; saving: number };
}

export interface Advice {
  id: string;
  title: string;
  detail: string;
  /** 预计年节省（元） */
  saving: number;
  kind: "deduction" | "bonus" | "equity" | "settlement" | "info";
}
