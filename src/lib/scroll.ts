/** 平滑滚动到某个元素；系统设了「减弱动态效果」时直接跳过去 */
export function scrollToEl(el: Element | null | undefined, block: ScrollLogicalPosition = "start") {
  if (!el) return;
  const reduced = typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  el.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block });
}
