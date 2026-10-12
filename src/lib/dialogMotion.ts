"use client";

import { useReducedMotion } from "./useReducedMotion";

/** 与 globals.css 里 .dlg-* 的淡出时长一致 */
export const DIALOG_EXIT_MS = 140;

/**
 * 弹窗关闭：先给 dialog 打上 data-closing 播淡出，再调用 done（真正 close() 或卸载）。
 * 减弱动态效果时直接 done。淡出期间重复触发（连点、Esc 加点背景）会被忽略。
 */
export function useDialogExit(getDialog: () => HTMLDialogElement | null, done: () => void) {
  const reduced = useReducedMotion();
  return () => {
    const dialog = getDialog();
    if (!dialog || reduced) {
      done();
      return;
    }
    if (dialog.dataset.closing) return;
    dialog.dataset.closing = "1";
    setTimeout(() => {
      done();
    }, DIALOG_EXIT_MS);
  };
}
