"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { compressToEncodedURIComponent, decompressFromEncodedURIComponent } from "lz-string";
import { getCity } from "@/lib/tax";
import type { Profile, SpecialDeductions } from "@/lib/tax";
import { SITE } from "./share";
import { defaultDeductions } from "./store";

/** /bonus 页的输入：只关心「月薪 + 年终奖」两个数 */
export interface BonusInput {
  cityId: string;
  monthlySalary: number;
  bonus: number;
  /** 公积金个人比例（0–0.2，留空用城市常见值） */
  housingRate?: number;
  /** 今年在本公司的工资月数 1–12 */
  paidMonths: number;
}

const BONUS_KEY = "cn-tax-bonus-v1";
/** 首页计算器的输入（src/lib/store.ts 的 KEY），只读取用于预填 */
const PROFILE_KEY = "cn-tax-profile-v1";
const HASH_KEY = "b";

export function newBonusInput(over: Partial<BonusInput> = {}): BonusInput {
  return { cityId: "beijing", monthlySalary: 25000, bonus: 0, paidMonths: 12, ...over };
}

function normalize(b: Partial<BonusInput>): BonusInput {
  const rate = Number(b.housingRate);
  return newBonusInput({
    cityId: typeof b.cityId === "string" && b.cityId ? b.cityId : "beijing",
    monthlySalary: Math.max(0, Number(b.monthlySalary) || 0),
    bonus: Math.max(0, Number(b.bonus) || 0),
    housingRate: Number.isFinite(rate) && rate >= 0 ? Math.min(0.2, rate) : undefined,
    paidMonths: Math.min(12, Math.max(1, Math.round(Number(b.paidMonths) || 12))),
  });
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

/** 默认输入：用首页已填的城市 / 月薪 / 年终奖预填 */
function defaultInput(p: Profile | null): BonusInput {
  const seg = p?.segments?.find((s) => s.monthlySalary > 0) ?? p?.segments?.[0];
  return newBonusInput({
    cityId: p?.cityId || "beijing",
    monthlySalary: seg && seg.monthlySalary > 0 ? seg.monthlySalary : 25000,
    bonus: seg?.bonus && seg.bonus > 0 ? seg.bonus : 0,
  });
}

/** 年终奖测算：把输入压进 /bonus 的 hash（数据不经过服务器） */
export function buildBonusShareUrl(b: BonusInput): string {
  const payload = compressToEncodedURIComponent(JSON.stringify(b));
  const origin = typeof window !== "undefined" ? window.location.origin : SITE;
  return `${origin}/bonus?utm_source=share#${HASH_KEY}=${payload}`;
}

/** 从 hash 里解出分享的输入；成功后清掉 hash，避免刷新时反复覆盖本地数据 */
export function consumeSharedBonus(): BonusInput | null {
  if (typeof window === "undefined") return null;
  const m = window.location.hash.match(new RegExp(`[#&]${HASH_KEY}=([^&]+)`));
  if (!m) return null;
  try {
    const json = decompressFromEncodedURIComponent(m[1]);
    if (!json) return null;
    const raw = JSON.parse(json) as Partial<BonusInput>;
    if (!raw || typeof raw !== "object" || typeof raw.monthlySalary !== "number") return null;
    const url = new URL(window.location.href);
    url.hash = "";
    window.history.replaceState(null, "", url.toString());
    return normalize(raw);
  } catch {
    return null;
  }
}

/** 一段工作 + 12 月发年终奖，交给引擎算全年（同 offerToProfile 的思路） */
export function bonusToProfile(b: BonusInput, year: number, deductions: SpecialDeductions): Profile {
  const city = getCity(b.cityId);
  const months = Math.min(12, Math.max(1, Math.round(b.paidMonths)));
  return {
    year,
    cityId: city.id,
    segments: [
      {
        id: "bonus-seg",
        name: "当前公司",
        startMonth: 13 - months,
        endMonth: 12,
        monthlySalary: Math.max(0, b.monthlySalary),
        bonus: b.bonus > 0 ? b.bonus : undefined,
        bonusMonth: b.bonus > 0 ? 12 : undefined,
        social: { mode: "auto", housingRate: b.housingRate },
      },
    ],
    deductions,
    bonusMode: "auto",
    equity: { taxMode: "combined", events: [] },
  };
}

let loadedFromShare = false;
/** 本次打开是否由分享链接预填（用于提示） */
export function wasBonusLoadedFromShare(): boolean {
  return loadedFromShare;
}

function load(): BonusInput {
  if (typeof window === "undefined") return defaultInput(null);
  const shared = consumeSharedBonus();
  if (shared) {
    loadedFromShare = true;
    return shared;
  }
  try {
    const raw = localStorage.getItem(BONUS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<BonusInput>;
      if (parsed && typeof parsed === "object" && typeof parsed.monthlySalary === "number") return normalize(parsed);
    }
  } catch {
    /* ignore */
  }
  return defaultInput(readProfile());
}

/** 只能在客户端组件挂载后调用（见 store.ts 的 useHydrated） */
export function useBonusInput() {
  const [input, setInput] = useState<BonusInput>(() => load());
  const [base] = useState(() => {
    const p = readProfile();
    return {
      year: p?.year && p.year > 2000 ? p.year : new Date().getFullYear(),
      deductions: { ...defaultDeductions(), ...(p?.deductions ?? {}) } as SpecialDeductions,
    };
  });

  useEffect(() => {
    try {
      localStorage.setItem(BONUS_KEY, JSON.stringify(input));
    } catch {
      /* ignore */
    }
  }, [input]);

  const patch = useCallback((p: Partial<BonusInput>) => setInput((prev) => ({ ...prev, ...p })), []);

  return useMemo(() => ({ input, patch, year: base.year, deductions: base.deductions }), [input, patch, base]);
}
