import { PENSION_REGIONS, type PensionRegion } from "./params";
import { annuityMonths, minContributionMonths, retireAtAge, statutoryRetirement, type PensionCategory, type StatutoryRetirement } from "./retirement";

/** 一个参保地的历史记录（社保 App 里「按参保地」查到的几项数字） */
export interface PastRecord {
  /** 该记录参保地所属计发基数地区（调用方用 regionForCity 解析；找不到传 undefined，视同与领取地相同） */
  region?: PensionRegion;
  /** 该参保地社保上下限（社平 ≈ socialMax/3，按当前年度） */
  city: { socialMin: number; socialMax: number };
  /** 该地累计缴费月数 */
  months: number;
  /** 该地个人账户金额（累计储存额，或个人缴费划入个人账户总额） */
  amount: number;
  /** 该地最后缴费年月，缺省 = today 的上个月 */
  lastYM?: { year: number; month: number };
}

export interface PensionInput {
  birthYear: number;
  birthMonth: number;
  category: PensionCategory;
  /** 当前缴费城市的社保参数（用其 socialMin/socialMax，社平 ≈ socialMax/3） */
  city: { socialMin: number; socialMax: number };
  /** 当前月缴费基数（调用方已按税前/到手/养老扣款算好，这里再夹到上下限内） */
  currentBase: number;
  /** 今天（从下个月开始算未来缴费） */
  today: { year: number; month: number };
  /** 过去各参保地的缴费记录；缺省 = 没有 */
  records?: PastRecord[];
  /** 退休年龄（总月数）；给了就代替法定退休年龄（弹性退休情景用） */
  retireAgeMonths?: number;
  /** 视同缴费年限，默认 0 */
  deemedYears?: number;
  /** 停缴年龄（岁，可小数），缺省 = 退休 */
  stopAge?: number;
  /** 社平/计发基数年增长，如 0.04 */
  wageGrowth: number;
  /** 本人工资年增长 */
  salaryGrowth: number;
  /** 个人账户记账利率，如 0.03 */
  accountRate: number;
  /** 折现用通胀，如 0.025 */
  inflation: number;
  /** 过渡系数，默认 0.012 */
  transitionCoef?: number;
  /**
   * 缴费地所属地区（计发基数口径）。领取地不同时，按国办发〔2009〕66 号第七条，
   * 各年度缴费工资要按领取地对应年度的平均工资重新折算指数，这里用两地计发基数之比近似。
   */
  homeRegion?: PensionRegion;
}

export interface RegionPension {
  region: PensionRegion;
  baseAtRetirement: number;
  /** 按该领取地折算后的平均缴费指数 */
  index: number;
  basic: number;
  transitional: number;
  personal: number;
  total: number;
  /** 折合今天的钱 */
  totalToday: number;
  /** 替代率：total ÷ 退休前最后缴费基数 */
  replacement: number;
}

/** 每条记录反推出的结果（相对其自身参保地） */
export interface RecordResult {
  /** 平均缴费基数 = 金额 ÷ 月数 ÷ 8%；金额或月数缺失时没有 */
  base?: number;
  /** 缴费指数；金额缺失时 = 当前指数 */
  index: number;
  months: number;
  amount: number;
}

export interface PensionResult {
  /** 实际采用的退休年龄（给了 retireAgeMonths 则是它，否则 = statutory） */
  retirement: StatutoryRetirement;
  /** 法定退休年龄 */
  statutory: StatutoryRetirement;
  records: RecordResult[];
  /** 当前基数 / 当前社平，夹在 0.6–3 */
  currentIndex: number;
  /** 实际缴费总月数（不含视同） */
  totalMonths: number;
  /** 缴费年限（含视同） */
  years: number;
  /** 相对各自参保地的平均缴费指数（未按领取地折算） */
  avgIndex: number;
  minMonths: number;
  meetsMinimum: boolean;
  shortfallMonths: number;
  accountAtRetirement: number;
  annuityMonths: number;
  /** 个人账户养老金（月，名义） */
  personal: number;
  /** 退休前最后一个月的缴费基数 */
  lastBase: number;
  /** 每个 region 一行，按 total 降序 */
  byRegion: RegionPension[];
}

const PERSONAL_RATE = 0.08;
/** 折算到领取地后的平均缴费指数上限（同缴费基数 300% 封顶） */
const MAX_INDEX = 3;

function clamp(v: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, v));
}

export function estimatePension(input: PensionInput, regions: PensionRegion[] = PENSION_REGIONS): PensionResult {
  const { city, wageGrowth, salaryGrowth } = input;
  const deemedYears = input.deemedYears ?? 0;
  const transitionCoef = input.transitionCoef ?? 0.012;
  const statutory = statutoryRetirement(input.birthYear, input.birthMonth, input.category);
  let retirement: StatutoryRetirement = statutory;
  if (input.retireAgeMonths !== undefined) {
    const total = Math.round(input.retireAgeMonths);
    const at = retireAtAge(input.birthYear, input.birthMonth, total);
    retirement = { ...at, delayMonths: total - statutory.originalAge * 12, originalAge: statutory.originalAge };
  }

  const birthIdx = input.birthYear * 12 + (input.birthMonth - 1);
  const retireIdx = retirement.year * 12 + (retirement.month - 1);
  const todayIdx = input.today.year * 12 + (input.today.month - 1);
  // 停缴年月（该月起不再缴）；退休当月不再缴
  const stopIdx = input.stopAge === undefined ? retireIdx : birthIdx + Math.round(input.stopAge * 12);
  const lastPayIdx = Math.min(stopIdx, retireIdx) - 1;
  const futureMonths = Math.max(0, lastPayIdx - todayIdx);

  const socialAvg = city.socialMax / 3;
  const clampedNow = clamp(input.currentBase, city.socialMin, city.socialMax);
  const currentIndex = clamp(clampedNow / socialAvg, 0.6, 3);

  // ---- 过去各参保地：由 金额 ÷ 月数 ÷ 8% 反推平均缴费基数，再除以当时当地社平得到指数 ----
  const records: (RecordResult & { region?: PensionRegion })[] = (input.records ?? []).map((r) => {
    const months = Math.max(0, r.months);
    const amount = Math.max(0, r.amount);
    if (months > 0 && amount > 0) {
      const base = amount / months / PERSONAL_RATE;
      const lastIdx = r.lastYM ? r.lastYM.year * 12 + (r.lastYM.month - 1) : todayIdx - 1;
      const yearsAgo = Math.max(0, (todayIdx - (lastIdx - months / 2)) / 12);
      const socialThen = r.city.socialMax / 3 / Math.pow(1 + wageGrowth, yearsAgo);
      return { region: r.region, base, index: clamp(base / socialThen, 0.3, 3), months, amount };
    }
    return { region: r.region, index: currentIndex, months, amount };
  });
  const pastMonths = records.reduce((s, r) => s + r.months, 0);
  const pastBalance = records.reduce((s, r) => s + r.amount, 0);

  const monthlyRate = Math.pow(1 + input.accountRate, 1 / 12) - 1;
  let balance = pastBalance;
  let indexSum = 0;
  const futureIdx: number[] = [];
  let lastBase = clampedNow;
  for (let t = 1; t <= futureMonths; t++) {
    const wg = Math.pow(1 + wageGrowth, t / 12);
    const base = clamp(input.currentBase * Math.pow(1 + salaryGrowth, t / 12), city.socialMin * wg, city.socialMax * wg);
    const idx = base / (socialAvg * wg);
    futureIdx.push(idx);
    indexSum += idx;
    balance = balance * (1 + monthlyRate) + base * PERSONAL_RATE;
    lastBase = base;
  }
  // 停缴后到退休当月，账户继续计息
  const monthsToRetire = Math.max(0, retireIdx - todayIdx);
  for (let t = futureMonths + 1; t <= monthsToRetire; t++) balance *= 1 + monthlyRate;

  const totalMonths = pastMonths + futureMonths;
  const pastIndexSum = records.reduce((s, r) => s + r.index * r.months, 0);
  const avgIndex = totalMonths > 0 ? (pastIndexSum + indexSum) / totalMonths : 0;
  const years = totalMonths / 12 + deemedYears;

  const minMonths = minContributionMonths(retirement.year);
  const effectiveMonths = totalMonths + deemedYears * 12;
  const meetsMinimum = effectiveMonths >= minMonths;
  const shortfallMonths = Math.max(0, minMonths - effectiveMonths);

  const annuity = annuityMonths(retirement.ageYears, retirement.ageMonths);
  const personal = balance / annuity;
  const discount = Math.pow(1 + input.inflation, monthsToRetire / 12);

  const projectBase = (region: PensionRegion) =>
    region.base.value * Math.pow(1 + (region.growth ?? wageGrowth), retirement.year - region.base.year);
  const home = input.homeRegion;
  const homeBase = home ? projectBase(home) : 0;

  const byRegion: RegionPension[] = regions
    .map((region) => {
      const baseAtRetirement = projectBase(region);
      // 折算到领取地（国办发〔2009〕66 号第七条）：同样的缴费工资，相对领取地平均工资折出的指数不同。
      // 各段的比值 = 参保地计发基数 ÷ 领取地计发基数（找不到参保地 = 视同相同），逐段封顶 3
      const conv = (from: PensionRegion | undefined, idx: number) => {
        if (!from || baseAtRetirement <= 0) return idx;
        return Math.min(MAX_INDEX, (idx * projectBase(from)) / baseAtRetirement);
      };
      let index = 0;
      if (totalMonths > 0) {
        const past = records.reduce((s, r) => s + conv(r.region, r.index) * r.months, 0);
        const ratio = home && baseAtRetirement > 0 ? homeBase / baseAtRetirement : 1;
        const future = ratio === 1 ? indexSum : futureIdx.reduce((s, x) => s + Math.min(MAX_INDEX, x * ratio), 0);
        index = (past + future) / totalMonths;
      }
      const basic = ((baseAtRetirement * (1 + index)) / 2) * years * 0.01;
      const transitional = baseAtRetirement * index * deemedYears * transitionCoef;
      const total = basic + transitional + personal;
      return {
        region,
        baseAtRetirement,
        index,
        basic,
        transitional,
        personal,
        total,
        totalToday: total / discount,
        replacement: lastBase > 0 ? total / lastBase : 0,
      };
    })
    .sort((a, b) => b.total - a.total);

  return {
    retirement,
    statutory,
    records: records.map(({ base, index, months, amount }) => ({ base, index, months, amount })),
    currentIndex,
    totalMonths,
    years,
    avgIndex,
    minMonths,
    meetsMinimum,
    shortfallMonths,
    accountAtRetirement: balance,
    annuityMonths: annuity,
    personal,
    lastBase,
    byRegion,
  };
}
