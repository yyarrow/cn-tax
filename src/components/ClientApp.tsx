"use client";

import { useHydrated } from "@/lib/store";
import { App } from "./App";

export function ClientApp() {
  const hydrated = useHydrated();
  if (!hydrated) return <div className="mx-auto max-w-6xl px-4 pt-6 text-sm text-muted">加载中…</div>;
  return <App />;
}
