"use client";

import { useEffect, useRef, useState } from "react";

/** 仅在没有存档或分享数据的首次打开提示；开始修改后收起。 */
export function ExampleHint({ storageKeys, enabled = true, text = "当前为示例数据。请修改收入、城市和扣除项目，再查看你的测算结果。" }: { storageKeys: string[]; enabled?: boolean; text?: string }) {
  const [visible, setVisible] = useState(() => {
    if (!enabled || typeof window === "undefined") return false;
    try {
      return storageKeys.every((key) => !localStorage.getItem(key));
    } catch {
      return true;
    }
  });
  /** 收起动画播完才卸载 */
  const [gone, setGone] = useState(!visible);
  const ref = useRef<HTMLDivElement>(null);
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
  if (gone || !enabled) return null;
  return (
    <div
      ref={ref}
      className="collapse-grid"
      data-collapsed={!visible}
      onTransitionEnd={(e) => {
        if (!visible && e.target === e.currentTarget && e.propertyName === "grid-template-rows") setGone(true);
      }}
    >
      <div>
        <p role="note" className="mb-5 rounded-xl border border-accent/20 bg-accent/5 px-4 py-2.5 text-sm leading-relaxed text-accent-text">
          {text}
        </p>
      </div>
    </div>
  );
}
