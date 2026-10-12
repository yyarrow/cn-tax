"use client";

import { useEffect, useState } from "react";

/**
 * 挂载后过一小会儿才返回 true。图表的过渡只在「稳定之后数据变了」时启用，
 * 避免首帧量完容器宽度重新排版时柱子被动画成「生长」出来。
 */
export function useArmed(delayMs = 500): boolean {
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    const id = setTimeout(() => setArmed(true), delayMs);
    return () => clearTimeout(id);
  }, [delayMs]);
  return armed;
}
