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

/** 过去在某个参保地的缴费记录（每个省 / 市一条） */
export interface PensionRecordInput {
  id: string;
  /** 参保地 */
  cityId: string;
  /** 该地累计缴费月数 */
  months: number;
  /** 该地个人账户金额 */
  amount: number;
  /** 最后缴费年月（可选；空 = 截至现在） */
  lastYear?: number;
  lastMonth?: number;
}

export const MAX_RECORDS = 8;

export interface PensionInput {
  birthYear: number;
  birthMonth: number;
  category: PensionCategory;
  /** 工作城市（现在缴社保的城市；字段名沿用 cityId 以兼容旧数据） */
  cityId: string;
  /** 退休城市（领养老金的地方）；默认 = 工作城市 */
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
  /** 过去的参保记录，至少一条（可以是空记录） */
  records: PensionRecordInput[];
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

/** 旧版（单一余额 + 缴费年限）字段，只在读取时迁移用 */
type LegacyFields = { balance?: unknown; paidYears?: unknown; paidMonthsExtra?: unknown };

let recordSeq = 0;
export function newRecordId(): string {
  recordSeq += 1;
  return `r${Date.now().toString(36)}${recordSeq}${Math.random().toString(36).slice(2, 6)}`;
}

export function emptyRecord(cityId: string): PensionRecordInput {
  return { id: newRecordId(), cityId, months: 0, amount: 0 };
}

function normalizeRecord(raw: unknown, fallbackCityId: string, index: number): PensionRecordInput {
  const r = (raw && typeof raw === "object" ? raw : {}) as Partial<PensionRecordInput>;
  const lastYear = optionalInRange(r.lastYear, 2100);
  const lastMonth = optionalInRange(r.lastMonth, 12);
  return {
    id: typeof r.id === "string" && r.id ? r.id : `r${index}`,
    cityId: typeof r.cityId === "string" && r.cityId ? getCity(r.cityId).id : fallbackCityId,
    months: intInRange(r.months, 0, 720, 0),
    amount: inRange(r.amount, 0, 1e8, 0),
    lastYear: lastYear === undefined || lastYear <= 0 ? undefined : Math.round(lastYear),
    lastMonth: lastMonth === undefined || lastMonth < 1 ? undefined : Math.round(lastMonth),
  };
}

/** 保证 id 唯一（分享链接 / 手改存档可能带重复 id） */
function uniqueIds(list: PensionRecordInput[]): PensionRecordInput[] {
  const seen = new Set<string>();
  return list.map((r) => {
    let id = r.id;
    while (seen.has(id)) id = newRecordId();
    seen.add(id);
    return id === r.id ? r : { ...r, id };
  });
}

export function normalize(raw: Partial<PensionInput> & LegacyFields): PensionInput {
  const city = getCity(typeof raw.cityId === "string" ? raw.cityId : "");
  const receive = getCity(typeof raw.receiveCityId === "string" && raw.receiveCityId ? raw.receiveCityId : city.id);

  let records: PensionRecordInput[];
  if (Array.isArray(raw.records)) {
    records = raw.records.slice(0, MAX_RECORDS).map((r, i) => normalizeRecord(r, city.id, i));
  } else {
    // 迁移：旧数据的 余额 + 缴费年数 + 月数 → 一条记录（过去平均指数 pastIndex 丢弃）
    const legacyMonths = intInRange(raw.paidYears, 0, 60, 0) * 12 + intInRange(raw.paidMonthsExtra, 0, 11, 0);
    const legacyAmount = inRange(raw.balance, 0, 1e8, 0);
    records = legacyMonths > 0 || legacyAmount > 0 ? [{ id: "r0", cityId: city.id, months: legacyMonths, amount: legacyAmount }] : [];
  }
  if (records.length === 0) records = [emptyRecord(city.id)];
  records = uniqueIds(records);

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
    records,
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
    records: [],
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
    const raw = JSON.parse(json) as Partial<PensionInput> & LegacyFields;
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
      const saved = JSON.parse(raw) as Partial<PensionInput> & LegacyFields;
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
          // 退休城市原本跟工作城市一致的，换工作城市时跟着走（除非这次同时指定了退休城市）
          if (p.receiveCityId === undefined && prev.receiveCityId === prev.cityId) next.receiveCityId = p.cityId;
          // 还没填数字、且参保地是原工作城市的空记录，也跟着走
          if (p.records === undefined) {
            next.records = prev.records.map((r) => (r.cityId === prev.cityId && r.months === 0 && r.amount === 0 ? { ...r, cityId: p.cityId! } : r));
          }
          // 公积金比例跟着换默认值（除非这次就在改比例）
          if (p.housingRate === undefined) next.housingRate = getCity(p.cityId).housingRateDefault;
        }
        return normalize(next);
      }),
    [],
  );
  const patchRecord = useCallback(
    (id: string, p: Partial<Omit<PensionRecordInput, "id">>) =>
      setInput((prev) => normalize({ ...prev, records: prev.records.map((r) => (r.id === id ? { ...r, ...p } : r)) })),
    [],
  );
  const addRecord = useCallback(
    () =>
      setInput((prev) =>
        prev.records.length >= MAX_RECORDS ? prev : normalize({ ...prev, records: [...prev.records, emptyRecord(prev.cityId)] }),
      ),
    [],
  );
  const removeRecord = useCallback(
    (id: string) => setInput((prev) => normalize({ ...prev, records: prev.records.filter((r) => r.id !== id) })),
    [],
  );
  const reset = useCallback(() => setInput(defaultInput(readProfile())), []);

  return useMemo(
    () => ({ input, patch, patchRecord, addRecord, removeRecord, reset, deductions: base.deductions, fromShare: initial.fromShare }),
    [input, patch, patchRecord, addRecord, removeRecord, reset, base, initial.fromShare],
  );
}
