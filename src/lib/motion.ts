/**
 * 动效参数的 JS 侧唯一来源。每个数字都对应 src/app/globals.css :root 里的同名 CSS 变量：
 *   fast  ↔ --dur-fast   下拉出现、悬停变色、按钮按下
 *   base  ↔ --dur-base   弹窗进场、旋转箭头、滑块、对勾弹出
 *   exit  ↔ --dur-exit   弹窗淡出
 *   panel ↔ --dur-panel  details 展开、底部条滑动、提示收起
 *   slow  ↔ --dur-slow   数字补间、图表、比例条
 *   flash ↔ --dur-flash  数字变化的底色提示
 * 缓动曲线只有一条：--ease-out（cubic-bezier(.2,.7,.2,1)）。
 * tests/motion.test.ts 会校验两边一致，改数字时两处一起改。
 */
export const MOTION_MS = {
  fast: 120,
  base: 180,
  exit: 140,
  panel: 240,
  slow: 300,
  flash: 600,
} as const;

/** 金额数字停止变化多久后才闪一次高亮（连续输入时不会每个键都闪） */
export const FLASH_DEBOUNCE_MS = MOTION_MS.base;
/** 挂载后这段时间内的变化视为「恢复存档 / 分享链接预填」，数字直接到位 */
export const RESTORE_WINDOW_MS = 600;
