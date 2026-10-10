"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { compressToEncodedURIComponent, decompressFromEncodedURIComponent } from "lz-string";
import { getCity } from "@/lib/tax";
import type { Profile, SpecialDeductions } from "@/lib/tax";
import type { PensionCategory } from "@/lib/pension";
import { SITE } from "./share";
import { defaultDeductions } from "./store";

const PENSION_KEY = "cn-tax-pension-v1";
/** 首页计算器的输入（src/lib/store.ts 的 KEY），只读取用于预填 */
const PROFILE_KEY = "cn-tax-profile-v1";
const HASH_KEY = "p";

/** gross: 按税前工资；net: 税前 + 到手反推；pension: 按工资条养老扣款 */
export type PensionMode = "gross" | "net" | "pension";

export interface PensionInput {
  birthYear: number;
  birthMonth: number;
  category: PensionCategory;
  /** 参保城市 */
  cityId: string;
  /** 打算在哪领；默认 = 参保城市 */
  receiveCityId: string;
  mode: PensionMode;
  /** 税前月薪 */
  gross: number;
  /** net 模式：某月到手 */
  net?: number;
  /** net 模式：到手是几月的，1–12 */
  netMonth: number;
  /** pension 模式：工资条养老保险个人扣款（元/月） */
  pensionDeduction?: number;
  /** net 模式：公积金个人比例，0–0.2 */
  housingRate: number;
  /** 个人账户累计储存额 */
  balance: number;
  /** 已缴费 X 年 + Y 月 */
  paidYears: number;
  paidMonthsExtra: number;
  /** 过去平均缴费指数；缺省 = 当前指数 */
  pastIndex?: number;
  /** 视同缴费年限 */
  deemedYears: number;
  /** 缴到多少岁；缺省 = 缴到退休 */
  stopAge?: number;
  /** 社平年增长；缺省 = 领取地 region.growth ?? 0.03 */
  wageGrowth?: number;
  /** 本人工资年增长；缺省 = 社平年增长 */
  salaryGrowth?: number;
  accountRate: number;
  inflation: number;
  transitionCoef: number;
}

export const DEFAULT_WAGE_GROWTH = 0.03;

/** 今天（年、月） */
export function todayYM(): { year: number; month: number } {
  const d = new Date();
  return { year: d.getFullYear(), month: d.getMonth() + 1 };
}

function num(v: unknown): number | undefined {
  if (v === null || v === undefined || v === "") return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

/** 夹到 [lo, hi]；非数字用 fallback。夹取而不是拒绝，免得输入到一半（如先敲 "6" 再敲 "65"）被清空 */
function inRange(v: unknown, lo: number, hi: number, fallback: number): number {
  const n = num(v);
  return n === undefined ? fallback : Math.min(hi, Math.max(lo, n));
}

/** 可选项：非数字或负数 = 未填；否则只夹上限（下限留给调用方在使用处夹，避免打字过程中被改写） */
function optionalInRange(v: unknown, hi: number): number | undefined {
  const n = num(v);
  return n === undefined || n < 0 ? undefined : Math.min(hi, n);
}

function intInRange(v: unknown, lo: number, hi: number, fallback: number): number {
  const n = num(v);
  if (n === undefined) return fallback;
  return Math.min(hi, Math.max(lo, Math.round(n)));
}

const CATEGORIES: PensionCategory[] = ["male", "female55", "female50"];
const MODES: PensionMode[] = ["gross", "net", "pension"];

export function normalize(raw: Partial<PensionInput>): PensionInput {
  const city = getCity(typeof raw.cityId === "string" ? raw.cityId : "");
  const receive = getCity(typeof raw.receiveCityId === "string" && raw.receiveCityId ? raw.receiveCityId : city.id);
  return {
    birthYear: intInRange(raw.birthYear, 1950, 2010, 1990),
    birthMonth: intInRange(raw.birthMonth, 1, 12, 6),
    category: CATEGORIES.includes(raw.category as PensionCategory) ? (raw.category as PensionCategory) : "male",
    cityId: city.id,
    receiveCityId: receive.id,
    mode: MODES.includes(raw.mode as PensionMode) ? (raw.mode as PensionMode) : "gross",
    gross: Math.max(0, num(raw.gross) ?? 0),
    net: optionalInRange(raw.net, 1e7),
    netMonth: intInRange(raw.netMonth, 1, 12, new Date().getMonth() + 1),
    pensionDeduction: optionalInRange(raw.pensionDeduction, 1e6),
    housingRate: inRange(raw.housingRate, 0, 0.2, city.housingRateDefault),
    balance: inRange(raw.balance, 0, 1e8, 0),
    paidYears: intInRange(raw.paidYears, 0, 60, 0),
    paidMonthsExtra: intInRange(raw.paidMonthsExtra, 0, 11, 0),
    pastIndex: optionalInRange(raw.pastIndex, 5),
    deemedYears: inRange(raw.deemedYears, 0, 40, 0),
    stopAge: optionalInRange(raw.stopAge, 100),
    wageGrowth: optionalInRange(raw.wageGrowth, 0.2),
    salaryGrowth: optionalInRange(raw.salaryGrowth, 0.2),
    accountRate: inRange(raw.accountRate, 0, 0.2, 0.02),
    inflation: inRange(raw.inflation, 0, 0.2, 0.02),
    transitionCoef: inRange(raw.transitionCoef, 0, 0.05, 0.012),
  };
}

export function readProfile(): Profile | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(PROFILE_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as Profile;
    if (!p || !Array.isArray(p.segments)) return null;
    return p;
  } catch {
    return null;
  }
}

/** 默认输入：城市 / 税前月薪沿用首页第一段，没有就用北京 25000；1990-06 出生、男 */
function defaultInput(p: Profile | null): PensionInput {
  const seg = p?.segments?.find((s) => s.monthlySalary > 0) ?? p?.segments?.[0];
  const cityId = p?.cityId || "beijing";
  return normalize({
    birthYear: 1990,
    birthMonth: 6,
    category: "male",
    cityId,
    receiveCityId: cityId,
    mode: "gross",
    gross: seg && seg.monthlySalary > 0 ? seg.monthlySalary : 25000,
    netMonth: new Date().getMonth() + 1,
    housingRate: seg?.social?.housingRate ?? getCity(cityId).housingRateDefault,
    balance: 0,
    paidYears: 0,
    paidMonthsExtra: 0,
    deemedYears: 0,
  });
}

/** 把输入压进 /pension 的 hash（不经过服务器） */
export function buildPensionShareUrl(input: PensionInput): string {
  const payload = compressToEncodedURIComponent(JSON.stringify(input));
  const origin = typeof window !== "undefined" ? window.location.origin : SITE;
  return `${origin}/pension?utm_source=share#${HASH_KEY}=${payload}`;
}

/** 从 hash 里解出分享的输入；成功后清掉 hash，避免刷新时反复覆盖本地数据 */
export function consumeSharedPension(): PensionInput | null {
  if (typeof window === "undefined") return null;
  const m = window.location.hash.match(new RegExp(`[#&]${HASH_KEY}=([^&]+)`));
  if (!m) return null;
  try {
    const json = decompressFromEncodedURIComponent(m[1]);
    if (!json) return null;
    const raw = JSON.parse(json) as Partial<PensionInput>;
    if (!raw || typeof raw !== "object" || typeof raw.birthYear !== "number") return null;
    const url = new URL(window.location.href);
    url.hash = "";
    window.history.replaceState(null, "", url.toString());
    return normalize(raw);
  } catch {
    return null;
  }
}

function load(): { input: PensionInput; fromShare: boolean } {
  if (typeof window === "undefined") return { input: defaultInput(null), fromShare: false };
  const shared = consumeSharedPension();
  if (shared) return { input: shared, fromShare: true };
  try {
    const raw = localStorage.getItem(PENSION_KEY);
    if (raw) {
      const saved = JSON.parse(raw) as Partial<PensionInput>;
      if (saved && typeof saved === "object" && typeof saved.birthYear === "number") {
        return { input: normalize(saved), fromShare: false };
      }
    }
  } catch {
    /* ignore */
  }
  return { input: defaultInput(readProfile()), fromShare: false };
}

/** 只能在客户端组件挂载后调用（见 store.ts 的 useHydrated） */
export function usePension() {
  const [initial] = useState(load);
  const [input, setInput] = useState<PensionInput>(initial.input);
  const [base] = useState(() => {
    const p = readProfile();
    return {
      deductions: { ...defaultDeductions(), ...(p?.deductions ?? {}) } as SpecialDeductions,
    };
  });

  useEffect(() => {
    try {
      localStorage.setItem(PENSION_KEY, JSON.stringify(input));
    } catch {
      /* ignore */
    }
  }, [input]);

  const patch = useCallback(
    (p: Partial<PensionInput>) =>
      setInput((prev) => {
        const next = { ...prev, ...p };
        if (p.cityId && p.cityId !== prev.cityId) {
          // 领取地原本跟参保地一致的，换参保城市时跟着走（除非这次同时指定了领取地）
          if (p.receiveCityId === undefined && prev.receiveCityId === prev.cityId) next.receiveCityId = p.cityId;
          // 公积金比例跟着换默认值（除非这次就在改比例）
          if (p.housingRate === undefined) next.housingRate = getCity(p.cityId).housingRateDefault;
        }
        return normalize(next);
      }),
    [],
  );
  const reset = useCallback(() => setInput(defaultInput(readProfile())), []);

  return useMemo(
    () => ({ input, patch, reset, deductions: base.deductions, fromShare: initial.fromShare }),
    [input, patch, reset, base, initial.fromShare],
  );
}
