/**
 * 中国个人所得税（居民个人、综合所得）常量。
 * 规则适用 2019–2027 纳税年度（年终奖单独计税、上市公司股权激励单独计税均延续至 2027-12-31）。
 */

import { CITY_PRESETS } from "./cities";

export const BASIC_DEDUCTION_MONTHLY = 5000;
export const BASIC_DEDUCTION_ANNUAL = 60000;

export interface Bracket {
  /** 本级应纳税所得额上限（含） */
  upTo: number;
  rate: number;
  /** 速算扣除数 */
  quick: number;
}

/** 综合所得年度税率表（7 级超额累进） */
export const ANNUAL_BRACKETS: Bracket[] = [
  { upTo: 36_000, rate: 0.03, quick: 0 },
  { upTo: 144_000, rate: 0.1, quick: 2_520 },
  { upTo: 300_000, rate: 0.2, quick: 16_920 },
  { upTo: 420_000, rate: 0.25, quick: 31_920 },
  { upTo: 660_000, rate: 0.3, quick: 52_920 },
  { upTo: 960_000, rate: 0.35, quick: 85_920 },
  { upTo: Infinity, rate: 0.45, quick: 181_920 },
];

/** 按月换算后的综合所得税率表（用于全年一次性奖金单独计税） */
export const MONTHLY_BRACKETS: Bracket[] = [
  { upTo: 3_000, rate: 0.03, quick: 0 },
  { upTo: 12_000, rate: 0.1, quick: 210 },
  { upTo: 25_000, rate: 0.2, quick: 1_410 },
  { upTo: 35_000, rate: 0.25, quick: 2_660 },
  { upTo: 55_000, rate: 0.3, quick: 4_410 },
  { upTo: 80_000, rate: 0.35, quick: 7_160 },
  { upTo: Infinity, rate: 0.45, quick: 15_160 },
];

/** 专项附加扣除标准（2023-01-01 起执行的现行标准） */
export const SAD_STANDARD = {
  /** 子女教育：每个子女每月 */
  childEducation: 2000,
  /** 继续教育（学历）：每月，最长 48 个月 */
  continuingEducationDegree: 400,
  /** 继续教育（职业资格）：取得证书当年，每年 */
  continuingEducationCert: 3600,
  /** 住房贷款利息：每月（首套） */
  housingLoan: 1000,
  /** 住房租金：直辖市/省会/计划单列市等 */
  rentTier1: 1500,
  /** 市辖区户籍人口 > 100 万 */
  rentTier2: 1100,
  /** 市辖区户籍人口 ≤ 100 万 */
  rentTier3: 800,
  /** 赡养老人：独生子女每月 */
  elderlyOnly: 3000,
  /** 赡养老人：非独生子女分摊上限每月 */
  elderlySharedMax: 1500,
  /** 3 岁以下婴幼儿照护：每个每月 */
  infant: 2000,
  /** 大病医疗：年度自付超过此额度的部分可扣 */
  seriousIllnessThreshold: 15000,
  /** 大病医疗：年度扣除上限 */
  seriousIllnessCap: 80000,
  /** 个人养老金：年度税前扣除上限 */
  personalPensionCap: 12000,
  /** 个人养老金领取时税率 */
  personalPensionWithdrawRate: 0.03,
} as const;

export interface CityPreset {
  /** 拼音 slug；localStorage 和分享链接里存的是它，已有 id 不可改 */
  id: string;
  /** 常用简称："杭州"、"延边" */
  name: string;
  /** 省份简称；直辖市为自身；"其他城市"为空串 */
  province: string;
  provinceId: string;
  /** 全拼（小写、无空格），搜索用 */
  pinyin: string;
  /** 拼音首字母（小写），搜索用 */
  initials: string;
  /** 社保缴费基数上下限（元/月） */
  socialMin: number;
  socialMax: number;
  /** 公积金缴存基数上下限（元/月） */
  housingMin: number;
  housingMax: number;
  /** 个人缴费比例 */
  pensionRate: number;
  medicalRate: number;
  /** 医疗附加固定金额（如北京大病医疗 3 元/月） */
  medicalFixed: number;
  unemploymentRate: number;
  /** 公积金个人常见比例（默认值） */
  housingRateDefault: number;
  /** 房租扣除档位 */
  rentTier: 1 | 2 | 3;
  /** 数据口径：city=该市公布值；province=沿用全省统一口径；estimated=推算值 */
  quality: "city" | "province" | "estimated";
  /** 数据年度（2026 = 2026-07 起执行的年度） */
  year: number;
  note?: string;
}

export function getCity(id: string): CityPreset {
  return CITY_PRESETS.find((c) => c.id === id) ?? CITY_PRESETS.find((c) => c.id === "other") ?? CITY_PRESETS[CITY_PRESETS.length - 1];
}

export const MONTH_NAMES = ["1月", "2月", "3月", "4月", "5月", "6月", "7月", "8月", "9月", "10月", "11月", "12月"];
