"use client";

import { useEffect, useRef, useState } from "react";

/** 仅在没有存档或分享数据的首次打开提示；开始修改后收起。 */
export function ExampleHint({ storageKeys, enabled = true }: { storageKeys: string[]; enabled?: boolean }) {
  const [visible, setVisible] = useState(() => {
    if (!enabled || typeof window === "undefined") return false;
    try {
      return storageKeys.every((key) => !localStorage.getItem(key));
    } catch {
      return true;
    }
  });
  const ref = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    const container = ref.current?.parentElement;
    if (!container) return;
    const dismiss = () => setVisible(false);
    container.addEventListener("input", dismiss);
    container.addEventListener("change", dismiss);
    return () => {
      container.removeEventListener("input", dismiss);
      container.removeEventListener("change", dismiss);
    };
  }, []);
  if (!visible || !enabled) return null;
  return (
    <p ref={ref} role="note" className="mb-5 rounded-xl border border-accent/20 bg-accent/5 px-4 py-3 text-sm text-accent-text">
      当前为示例数据。请修改收入、城市和扣除项目，再查看你的测算结果。
    </p>
  );
}
