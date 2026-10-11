import { estimatePension, type PensionInput } from "./engine";
import { PENSION_REGIONS, type PensionRegion } from "./params";
import { fmtAgeYM, retireAtAge, statutoryRetirement } from "./retirement";

/** 一个情景点：换一种退休年龄 / 停缴年龄后，在退休城市每月能领多少 */
export interface ScenarioPoint {
  key: string;
  /** "61 岁" / "45 岁停缴" / "缴到退休" */
  label: string;
  /** 弹性退休情景：退休年龄（总月数） */
  ageMonths?: number;
  /** 提前停缴情景：停缴年龄（岁）；缺省 = 缴到退休 */
  stopAge?: number;
  retire: { year: number; month: number };
  basic: number;
  personal: number;
  transitional: number;
  total: number;
  /** 折合今天的钱 */
  totalToday: number;
  meetsMinimum: boolean;
  /** 法定退休年龄 + 缴到退休 */
  isStatutory?: boolean;
  /** 等同于用户当前的方案（图里高亮） */
  isCurrent?: boolean;
}

export interface PensionScenarios {
  flex: ScenarioPoint[];
  stop: ScenarioPoint[];
}

/** 弹性退休的年龄偏移（月）：法定 −3 年到 +3 年，每年一档 */
const FLEX_OFFSETS = [-36, -24, -12, 0, 12, 24, 36];
/** 停缴情景最多画这么多个停缴点，超过就隔一年取一个 */
const MAX_STOP_POINTS = 16;

function pickRow(rows: ReturnType<typeof estimatePension>["byRegion"], receiveRegionId: string | undefined) {
  // 找不到领取地时用所有地区中位数那一行，和页面现有逻辑一致
  return rows.find((r) => r.region.id === receiveRegionId) ?? rows[Math.floor(rows.length / 2)];
}

/**
 * 两组情景：弹性退休（法定 ±3 年）、提前停缴（停缴年龄从现在到法定退休）。
 * 只算领取地那一行；不改 input 里的其它假设。
 */
export function pensionScenarios(input: PensionInput, regions: PensionRegion[] = PENSION_REGIONS, receiveRegionId?: string): PensionScenarios {
  const found = regions.find((r) => r.id === receiveRegionId);
  // 领取地存在时只算它一个，省掉其余 30 多行；不存在才全算取中位数
  const calc = (patch: Partial<PensionInput>): ScenarioPoint => {
    const r = estimatePension({ ...input, ...patch }, found ? [found] : regions);
    const row = pickRow(r.byRegion, receiveRegionId);
    return {
      key: "",
      label: "",
      retire: { year: r.retirement.year, month: r.retirement.month },
      basic: row?.basic ?? 0,
      personal: row?.personal ?? 0,
      transitional: row?.transitional ?? 0,
      total: row?.total ?? 0,
      totalToday: row?.totalToday ?? 0,
      meetsMinimum: r.meetsMinimum,
    };
  };

  const birthIdx = input.birthYear * 12 + (input.birthMonth - 1);
  const todayIdx = input.today.year * 12 + (input.today.month - 1);
  const s = statutoryRetirement(input.birthYear, input.birthMonth, input.category);
  const statutoryTotal = s.ageYears * 12 + s.ageMonths;
  const originalTotal = s.originalAge * 12;

  // ---- 弹性退休 ----
  const flex: ScenarioPoint[] = [];
  for (const off of FLEX_OFFSETS) {
    const ageMonths = statutoryTotal + off;
    if (ageMonths < originalTotal) continue;
    const at = retireAtAge(input.birthYear, input.birthMonth, ageMonths);
    if (at.year * 12 + (at.month - 1) <= todayIdx) continue;
    flex.push({
      ...calc({ retireAgeMonths: ageMonths }),
      key: `flex-${off}`,
      label: ageMonths % 12 === 0 ? `${ageMonths / 12} 岁` : fmtAgeYM(at.ageYears, at.ageMonths),
      ageMonths,
      isStatutory: off === 0,
      isCurrent: off === 0,
    });
  }

  // ---- 提前停缴：停缴年龄从「当前年龄向上取整 + 1」到法定退休年龄（不含） ----
  const ageNow = (todayIdx - birthIdx) / 12;
  const first = Math.ceil(ageNow) + 1;
  const ages: number[] = [];
  for (let a = first; a * 12 < statutoryTotal; a++) ages.push(a);
  const picked = ages.length > MAX_STOP_POINTS ? ages.filter((_, i) => i % 2 === 0) : ages;
  const stop: ScenarioPoint[] = picked.map((a) => ({
    ...calc({ stopAge: a, retireAgeMonths: undefined }),
    key: `stop-${a}`,
    label: `${a} 岁停缴`,
    stopAge: a,
    isCurrent: input.stopAge !== undefined && Math.abs(input.stopAge - a) < 1e-9,
  }));
  stop.push({
    ...calc({ stopAge: undefined, retireAgeMonths: undefined }),
    key: "stop-none",
    label: "缴到退休",
    isStatutory: true,
    isCurrent: input.stopAge === undefined || input.stopAge * 12 >= statutoryTotal,
  });
  return { flex, stop };
}
