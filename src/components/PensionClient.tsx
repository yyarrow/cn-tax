"use client";

import { useHydrated } from "@/lib/store";
import { PensionTool } from "./PensionTool";

export function PensionClient() {
  const hydrated = useHydrated();
  if (!hydrated) return <div className="mx-auto min-h-[60vh] max-w-6xl px-4 pt-4 text-sm text-muted sm:px-6">计算器加载中…</div>;
  return <PensionTool />;
}
