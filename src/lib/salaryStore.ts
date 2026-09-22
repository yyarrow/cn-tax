"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { compressToEncodedURIComponent, decompressFromEncodedURIComponent } from "lz-string";
import { getCity } from "@/lib/tax";
import type { Profile, SpecialDeductions } from "@/lib/tax";
import { SITE } from "./share";
import { defaultDeductions } from "./store";

const SALARY_KEY = "cn-tax-salary-v1";
/** 首页计算器的输入（src/lib/store.ts 的 KEY），只读取用于预填 */
const PROFILE_KEY = "cn-tax-profile-v1";
const HASH_KEY = "w";

/** 工作段 id 固定，结果里用它取 socials */
export const SALARY_SEGMENT_ID = "salary";

/** net: 由税前算到手；infer: 由到手反推五险一金 */
export type SalaryMode = "net" | "infer";

export interface SalaryInput {
  mode: SalaryMode;
  cityId: string;
  /** 税前月薪 */
  monthlySalary: number;
  /** 看哪个月的到手，1–12 */
  month: number;
  /** 公积金个人比例，0–0.2 */
  housingRate: number;
  /** 今年在本公司从哪个月开始，1–12 */
  startMonth: number;
  /** 反推模式：当月税后到手 */
  netAmount?: number;
  /** 反推模式：工资条上当月个税（可选，填了就直接相减） */
  netTax?: number;
}

/** 今年进行到第几个月（1–12） */
export function currentMonth(): number {
  return new Date().getMonth() + 1;
}

function clampMonth(m: unknown, fallback = 1): number {
  const n = Math.round(Number(m));
  if (!Number.isFinite(n)) return fallback;
  return Math.min(12, Math.max(1, n));
}

function optionalAmount(v: unknown): number | undefined {
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0) return undefined;
  return n;
}

function normalize(raw: Partial<SalaryInput>): SalaryInput {
  const city = getCity(typeof raw.cityId === "string" ? raw.cityId : "");
  const startMonth = clampMonth(raw.startMonth, 1);
  const rate = Number(raw.housingRate);
  return {
    mode: raw.mode === "infer" ? "infer" : "net",
    cityId: city.id,
    monthlySalary: Math.max(0, Number(raw.monthlySalary) || 0),
    startMonth,
    month: Math.max(startMonth, clampMonth(raw.month, currentMonth())),
    housingRate: Number.isFinite(rate) && rate >= 0 && rate <= 0.2 ? rate : city.housingRateDefault,
    netAmount: optionalAmount(raw.netAmount),
    netTax: optionalAmount(raw.netTax),
  };
}

function readProfile(): Profile | null {
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

/** 默认输入：城市 / 月薪 / 公积金比例沿用首页第一段，没有就用北京 25000 */
function defaultInput(p: Profile | null): SalaryInput {
  const seg = p?.segments?.find((s) => s.monthlySalary > 0) ?? p?.segments?.[0];
  const cityId = p?.cityId || "beijing";
  return normalize({
    mode: "net",
    cityId,
    monthlySalary: seg && seg.monthlySalary > 0 ? seg.monthlySalary : 25000,
    month: currentMonth(),
    startMonth: 1,
    housingRate: seg?.social?.housingRate ?? getCity(cityId).housingRateDefault,
  });
}

/** 把输入压进 /social-insurance 的 hash（不经过服务器） */
export function buildSalaryShareUrl(input: SalaryInput): string {
  const payload = compressToEncodedURIComponent(JSON.stringify(input));
  const origin = typeof window !== "undefined" ? window.location.origin : SITE;
  return `${origin}/social-insurance?utm_source=share#${HASH_KEY}=${payload}`;
}

/** 从 hash 里解出分享的输入；成功后清掉 hash，避免刷新时反复覆盖本地数据 */
export function consumeSharedSalary(): SalaryInput | null {
  if (typeof window === "undefined") return null;
  const m = window.location.hash.match(new RegExp(`[#&]${HASH_KEY}=([^&]+)`));
  if (!m) return null;
  try {
    const json = decompressFromEncodedURIComponent(m[1]);
    if (!json) return null;
    const raw = JSON.parse(json) as Partial<SalaryInput>;
    if (!raw || typeof raw !== "object" || typeof raw.monthlySalary !== "number") return null;
    const url = new URL(window.location.href);
    url.hash = "";
    window.history.replaceState(null, "", url.toString());
    return normalize(raw);
  } catch {
    return null;
  }
}

/** 用一份输入拼出单段 Profile，交给 computeAll */
export function salaryProfile(input: SalaryInput, year: number, deductions: SpecialDeductions): Profile {
  const infer = input.mode === "infer" && (input.netAmount ?? 0) > 0;
  return {
    year,
    cityId: input.cityId,
    segments: [
      {
        id: SALARY_SEGMENT_ID,
        name: "当前公司",
        startMonth: input.startMonth,
        endMonth: 12,
        monthlySalary: input.monthlySalary,
        social: infer ? { mode: "infer", housingRate: input.housingRate } : { mode: "auto", housingRate: input.housingRate },
        netSample: infer ? { month: input.month, amount: input.netAmount!, tax: input.netTax } : undefined,
      },
    ],
    deductions,
    bonusMode: "auto",
    equity: { taxMode: "combined", events: [] },
  };
}

function load(): { input: SalaryInput; fromShare: boolean } {
  if (typeof window === "undefined") return { input: defaultInput(null), fromShare: false };
  const shared = consumeSharedSalary();
  if (shared) return { input: shared, fromShare: true };
  try {
    const raw = localStorage.getItem(SALARY_KEY);
    if (raw) {
      const saved = JSON.parse(raw) as Partial<SalaryInput>;
      if (saved && typeof saved === "object" && typeof saved.monthlySalary === "number") {
        return { input: normalize(saved), fromShare: false };
      }
    }
  } catch {
    /* ignore */
  }
  return { input: defaultInput(readProfile()), fromShare: false };
}

/** 只能在客户端组件挂载后调用（见 store.ts 的 useHydrated） */
export function useSalary() {
  const [initial] = useState(load);
  const [input, setInput] = useState<SalaryInput>(initial.input);
  const [base] = useState(() => {
    const p = readProfile();
    return {
      year: p?.year && p.year > 2000 ? p.year : new Date().getFullYear(),
      deductions: { ...defaultDeductions(), ...(p?.deductions ?? {}) } as SpecialDeductions,
    };
  });

  useEffect(() => {
    try {
      localStorage.setItem(SALARY_KEY, JSON.stringify(input));
    } catch {
      /* ignore */
    }
  }, [input]);

  const patch = useCallback(
    (p: Partial<SalaryInput>) =>
      setInput((prev) => {
        // 换城市时公积金比例跟着换默认值（除非这次就在改比例）
        const next = { ...prev, ...p };
        if (p.cityId && p.cityId !== prev.cityId && p.housingRate === undefined) {
          next.housingRate = getCity(p.cityId).housingRateDefault;
        }
        return normalize(next);
      }),
    [],
  );
  const reset = useCallback(() => setInput(defaultInput(readProfile())), []);

  return useMemo(
    () => ({ input, patch, reset, year: base.year, deductions: base.deductions, fromShare: initial.fromShare }),
    [input, patch, reset, base, initial.fromShare],
  );
}
