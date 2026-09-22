"use client";

import { useHydrated } from "@/lib/store";
import { OfferCompare } from "./OfferCompare";

export function OfferClient() {
  const hydrated = useHydrated();
  if (!hydrated) return <div className="mx-auto min-h-[60vh] max-w-6xl px-4 pt-4 text-sm text-muted sm:px-6">加载中…</div>;
  return <OfferCompare />;
}
