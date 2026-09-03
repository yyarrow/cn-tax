"use client";

import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import type { EquityEvent, EquityPlan, Profile, Segment, SpecialDeductions } from "@/lib/tax";
import { uid } from "./format";

const KEY = "cn-tax-profile-v1";

export function defaultDeductions(): SpecialDeductions {
  return {
    children: 0,
    continuingEducation: "none",
    housing: "none",
    rentTier: 1,
    elderly: "none",
    elderlySharedAmount: 1500,
    infants: 0,
    seriousIllnessPaid: 0,
    personalPension: 0,
    otherAnnual: 0,
  };
}

export function newSegment(over: Partial<Segment> = {}): Segment {
  return {
    id: uid(),
    name: "",
    startMonth: 1,
    endMonth: 12,
    monthlySalary: 20000,
    social: { mode: "auto" },
    ...over,
  };
}

export function newEvent(over: Partial<EquityEvent> = {}): EquityEvent {
  return { id: uid(), name: "", amount: 100000, month: 12, ...over };
}

/** 兼容旧版本（grants + companyType）的本地数据 */
function migrateEquity(raw: unknown): EquityPlan {
  const base: EquityPlan = { taxMode: "combined", events: [] };
  if (!raw || typeof raw !== "object") return base;
  const r = raw as Record<string, unknown>;
  if (Array.isArray(r.events) && typeof r.taxMode === "string") return { ...base, ...(r as unknown as EquityPlan) };
  const grants = Array.isArray(r.grants) ? (r.grants as Record<string, number | string>[]) : [];
  return {
    taxMode: r.companyType === "unlisted" ? "unlisted" : "listed",
    events: grants.map((g) => ({
      id: String(g.id ?? uid()),
      name: String(g.name ?? ""),
      amount: Math.max(0, (Number(g.fairValue) - (g.kind === "rsu" ? 0 : Number(g.strikePrice))) * Number(g.quantity)) || 0,
      month: Number(g.month) || 12,
    })),
  };
}

export function defaultProfile(): Profile {
  return {
    year: new Date().getFullYear(),
    cityId: "beijing",
    segments: [newSegment({ name: "当前公司" })],
    deductions: defaultDeductions(),
    bonusMode: "auto",
    equity: { taxMode: "combined", events: [] },
  };
}

function load(): Profile | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as Profile;
    if (!p || !Array.isArray(p.segments)) return null;
    return { ...defaultProfile(), ...p, deductions: { ...defaultDeductions(), ...p.deductions }, equity: migrateEquity(p.equity) };
  } catch {
    return null;
  }
}

/** 仅在客户端挂载后为 true（服务端渲染时为 false），用于避免 localStorage 造成的 hydration 不一致 */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
}

/** 只能在客户端组件挂载后调用（见 useHydrated） */
export function useProfile() {
  const [profile, setProfile] = useState<Profile>(() => load() ?? defaultProfile());
  const ready = true;

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(profile));
    } catch {
      /* ignore */
    }
  }, [profile]);

  const patch = useCallback((p: Partial<Profile>) => setProfile((prev) => ({ ...prev, ...p })), []);
  const patchSegment = useCallback(
    (id: string, p: Partial<Segment>) =>
      setProfile((prev) => ({ ...prev, segments: prev.segments.map((s) => (s.id === id ? { ...s, ...p } : s)) })),
    [],
  );
  const removeSegment = useCallback(
    (id: string) => setProfile((prev) => ({ ...prev, segments: prev.segments.filter((s) => s.id !== id) })),
    [],
  );
  const addSegment = useCallback(
    () =>
      setProfile((prev) => {
        const last = prev.segments[prev.segments.length - 1];
        const start = last ? Math.min(12, last.endMonth + 1) : 1;
        return { ...prev, segments: [...prev.segments, newSegment({ startMonth: start, endMonth: 12, monthlySalary: last?.monthlySalary ?? 20000 })] };
      }),
    [],
  );
  const patchDeductions = useCallback(
    (p: Partial<SpecialDeductions>) => setProfile((prev) => ({ ...prev, deductions: { ...prev.deductions, ...p } })),
    [],
  );
  const reset = useCallback(() => setProfile(defaultProfile()), []);

  return useMemo(
    () => ({ profile, ready, patch, patchSegment, removeSegment, addSegment, patchDeductions, reset, setProfile }),
    [profile, ready, patch, patchSegment, removeSegment, addSegment, patchDeductions, reset],
  );
}

/** 当前年份进行到第几个月（用于区分实际/预测） */
export function currentMonthFor(year: number): number {
  const now = new Date();
  if (year < now.getFullYear()) return 12;
  if (year > now.getFullYear()) return 0;
  return now.getMonth() + 1;
}
