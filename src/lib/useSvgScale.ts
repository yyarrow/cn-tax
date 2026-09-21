"use client";

import { useEffect, useState, type RefObject } from "react";

/**
 * SVG 用 viewBox 缩放时文字会跟着缩小，手机上 12 单位只剩五六像素。
 * 返回 k = viewBox 宽度 / 实际渲染宽度，文字用 fontSize = 12 * k 就能保持屏幕上 12px。
 */
export function useSvgScale(ref: RefObject<SVGSVGElement | null>, viewBoxWidth: number): number {
  const [k, setK] = useState(1);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const update = () => {
      const w = el.getBoundingClientRect().width;
      if (w > 0) setK(viewBoxWidth / w);
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref, viewBoxWidth]);
  return k;
}
