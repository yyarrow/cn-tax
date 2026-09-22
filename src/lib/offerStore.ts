"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { OfferInput, Profile, SpecialDeductions } from "@/lib/tax";
import { uid } from "./format";
import { consumeSharedOffers } from "./share";
import { defaultDeductions } from "./store";

const OFFERS_KEY = "cn-tax-offers-v1";
/** 首页计算器的输入（src/lib/store.ts 的 KEY），只读取用于预填 */
const PROFILE_KEY = "cn-tax-profile-v1";

export const MAX_OFFERS = 3;
const LETTERS = ["A", "B", "C"];

/** 第 i 份 offer 的显示名（没填就用 Offer A/B/C） */
export function offerLabel(o: { name: string }, i: number): string {
  return o.name.trim() || `Offer ${LETTERS[i] ?? i + 1}`;
}

export function newOffer(over: Partial<OfferInput> = {}): OfferInput {
  return {
    id: uid(),
    name: "",
    cityId: "beijing",
    monthlySalary: 25000,
    bonus: 0,
    signOn: 0,
    equityPerYear: 0,
    ...over,
  };
}

function normalize(o: Partial<OfferInput>, i: number): OfferInput {
  return newOffer({
    ...o,
    id: o.id || uid(),
    name: typeof o.name === "string" ? o.name : `Offer ${LETTERS[i] ?? i + 1}`,
    monthlySalary: Math.max(0, Number(o.monthlySalary) || 0),
    bonus: Math.max(0, Number(o.bonus) || 0),
    signOn: Math.max(0, Number(o.signOn) || 0),
    equityPerYear: Math.max(0, Number(o.equityPerYear) || 0),
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

/** 默认两份 offer：A 用首页已填的现公司数据，B 复制 A 的月薪，用户只改差异 */
function defaultOffers(p: Profile | null): OfferInput[] {
  const seg = p?.segments?.find((s) => s.monthlySalary > 0) ?? p?.segments?.[0];
  const a = newOffer({
    name: seg?.name?.trim() ? "现公司" : "Offer A",
    cityId: p?.cityId || "beijing",
    monthlySalary: seg && seg.monthlySalary > 0 ? seg.monthlySalary : 25000,
    bonus: seg?.bonus && seg.bonus > 0 ? seg.bonus : 0,
  });
  const b = newOffer({ name: "Offer B", cityId: a.cityId, monthlySalary: a.monthlySalary });
  return [a, b];
}

let loadedFromShare = false;
/** 本次打开是否由分享链接预填（用于提示） */
export function wasLoadedFromShare(): boolean {
  return loadedFromShare;
}

function load(): OfferInput[] {
  if (typeof window === "undefined") return defaultOffers(null);
  const shared = consumeSharedOffers();
  if (shared) {
    loadedFromShare = true;
    return shared.slice(0, MAX_OFFERS).map(normalize);
  }
  try {
    const raw = localStorage.getItem(OFFERS_KEY);
    if (raw) {
      const list = JSON.parse(raw) as OfferInput[];
      if (Array.isArray(list) && list.length > 0 && list.every((o) => o && typeof o.monthlySalary === "number")) {
        return list.slice(0, MAX_OFFERS).map(normalize);
      }
    }
  } catch {
    /* ignore */
  }
  return defaultOffers(readProfile());
}

/** 只能在客户端组件挂载后调用（见 store.ts 的 useHydrated） */
export function useOffers() {
  const [offers, setOffers] = useState<OfferInput[]>(() => load());
  const [base] = useState(() => {
    const p = readProfile();
    return {
      year: p?.year && p.year > 2000 ? p.year : new Date().getFullYear(),
      deductions: { ...defaultDeductions(), ...(p?.deductions ?? {}) } as SpecialDeductions,
    };
  });

  useEffect(() => {
    try {
      localStorage.setItem(OFFERS_KEY, JSON.stringify(offers));
    } catch {
      /* ignore */
    }
  }, [offers]);

  const patchOffer = useCallback(
    (id: string, partial: Partial<OfferInput>) =>
      setOffers((prev) => prev.map((o) => (o.id === id ? { ...o, ...partial } : o))),
    [],
  );
  const addOffer = useCallback(
    () =>
      setOffers((prev) => {
        if (prev.length >= MAX_OFFERS) return prev;
        const last = prev[prev.length - 1];
        return [...prev, newOffer({ ...last, id: uid(), name: `Offer ${LETTERS[prev.length] ?? prev.length + 1}` })];
      }),
    [],
  );
  const removeOffer = useCallback(
    (id: string) => setOffers((prev) => (prev.length <= 2 ? prev : prev.filter((o) => o.id !== id))),
    [],
  );
  const reset = useCallback(() => setOffers(defaultOffers(readProfile())), []);

  return useMemo(
    () => ({ offers, setOffers, patchOffer, addOffer, removeOffer, reset, year: base.year, deductions: base.deductions }),
    [offers, patchOffer, addOffer, removeOffer, reset, base],
  );
}
