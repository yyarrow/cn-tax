import { PENSION_REGIONS, type PensionRegion } from "./params";
import { annuityMonths, minContributionMonths, statutoryRetirement, type PensionCategory } from "./retirement";

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
  /** 个人账户累计储存额（元） */
  balance: number;
  /** 已累计缴费月数 */
  paidMonths: number;
  /** 过去平均缴费指数；缺省 = 当前指数 */
  pastIndex?: number;
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
}

export interface RegionPension {
  region: PensionRegion;
  baseAtRetirement: number;
  basic: number;
  transitional: number;
  personal: number;
  total: number;
  /** 折合今天的钱 */
  totalToday: number;
  /** 替代率：total ÷ 退休前最后缴费基数 */
  replacement: number;
}

export interface PensionResult {
  retirement: ReturnType<typeof statutoryRetirement>;
  /** 当前基数 / 当前社平，夹在 0.6–3 */
  currentIndex: number;
  /** 实际缴费总月数（不含视同） */
  totalMonths: number;
  /** 缴费年限（含视同） */
  years: number;
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

function clamp(v: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, v));
}

export function estimatePension(input: PensionInput, regions: PensionRegion[] = PENSION_REGIONS): PensionResult {
  const { city, wageGrowth, salaryGrowth } = input;
  const deemedYears = input.deemedYears ?? 0;
  const transitionCoef = input.transitionCoef ?? 0.012;
  const retirement = statutoryRetirement(input.birthYear, input.birthMonth, input.category);

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
  const pastIndex = input.pastIndex ?? currentIndex;

  const monthlyRate = Math.pow(1 + input.accountRate, 1 / 12) - 1;
  let balance = input.balance;
  let indexSum = 0;
  let lastBase = clampedNow;
  for (let t = 1; t <= futureMonths; t++) {
    const wg = Math.pow(1 + wageGrowth, t / 12);
    const base = clamp(input.currentBase * Math.pow(1 + salaryGrowth, t / 12), city.socialMin * wg, city.socialMax * wg);
    indexSum += base / (socialAvg * wg);
    balance = balance * (1 + monthlyRate) + base * PERSONAL_RATE;
    lastBase = base;
  }
  // 停缴后到退休当月，账户继续计息
  const monthsToRetire = Math.max(0, retireIdx - todayIdx);
  for (let t = futureMonths + 1; t <= monthsToRetire; t++) balance *= 1 + monthlyRate;

  const totalMonths = input.paidMonths + futureMonths;
  const avgIndex = totalMonths > 0 ? (pastIndex * input.paidMonths + indexSum) / totalMonths : 0;
  const years = totalMonths / 12 + deemedYears;

  const minMonths = minContributionMonths(retirement.year);
  const effectiveMonths = totalMonths + deemedYears * 12;
  const meetsMinimum = effectiveMonths >= minMonths;
  const shortfallMonths = Math.max(0, minMonths - effectiveMonths);

  const annuity = annuityMonths(retirement.ageYears, retirement.ageMonths);
  const personal = balance / annuity;
  const discount = Math.pow(1 + input.inflation, monthsToRetire / 12);

  const byRegion: RegionPension[] = regions
    .map((region) => {
      const baseAtRetirement = region.base.value * Math.pow(1 + (region.growth ?? wageGrowth), retirement.year - region.base.year);
      const basic = ((baseAtRetirement * (1 + avgIndex)) / 2) * years * 0.01;
      const transitional = baseAtRetirement * avgIndex * deemedYears * transitionCoef;
      const total = basic + transitional + personal;
      return {
        region,
        baseAtRetirement,
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
