import { ANNUAL_BRACKETS } from "./constants";
import { annualTax, findBracket, marginalRate, round2 } from "./brackets";
import type { EquityKink, EquityPlan, EquityResult } from "./types";

const UNLISTED_RATE = 0.2;

export function equityIncome(plan: EquityPlan): number {
  return round2(plan.events.reduce((s, e) => s + Math.max(0, e.amount || 0), 0));
}

/**
 * 期权 / RSU 兑现规划。
 * @param base 当前"底数"：listed 模式为已兑现的股权激励收入；combined 模式为当前综合所得应纳税所得额（已含已兑现部分）
 * @param income 已录入兑现收入
 */
export function analyzeEquity(plan: EquityPlan, base: number, income: number): EquityResult {
  const mode = plan.taxMode;
  const maxX = Math.max(50_000, plan.chartMax ?? 1_000_000);

  // 再兑现 x 元时的增量税
  const taxAt = (x: number): number => {
    if (mode === "unlisted") return round2(x * UNLISTED_RATE);
    return round2(annualTax(Math.max(0, base + x)) - annualTax(Math.max(0, base)));
  };
  const rateAt = (x: number): number => (mode === "unlisted" ? UNLISTED_RATE : marginalRate(Math.max(0, base + x) || 1));

  // 已录入兑现对应的税
  let tax: number;
  if (mode === "unlisted") tax = round2(income * UNLISTED_RATE);
  else tax = round2(annualTax(Math.max(0, base)) - annualTax(Math.max(0, base - income)));

  // 拐点：年度税率表边界 − 底数
  const kinks: EquityKink[] = [];
  if (mode !== "unlisted") {
    for (let i = 0; i < ANNUAL_BRACKETS.length - 1; i++) {
      const x = ANNUAL_BRACKETS[i].upTo - Math.max(0, base);
      if (x > 0 && x <= maxX) {
        kinks.push({ x: round2(x), rateBefore: ANNUAL_BRACKETS[i].rate, rateAfter: ANNUAL_BRACKETS[i + 1].rate, tax: taxAt(x) });
      }
    }
  }
  const xs = [0, ...kinks.map((k) => k.x), maxX];
  const curve = xs.map((x) => ({ x, tax: taxAt(x) }));

  let planned: EquityResult["planned"];
  const amount = plan.plannedExtra ?? 0;
  if (amount > 0) {
    const t = taxAt(amount);
    const kinkBelow = [...kinks].reverse().find((k) => k.x < amount);
    let deferSaving = 0;
    if (kinkBelow && mode !== "unlisted") {
      const excess = amount - kinkBelow.x;
      // 明年：listed 模式底数归零；combined 模式假设明年工资相同
      const nextYearBase = mode === "listed" ? 0 : Math.max(0, base);
      const nextYearTax = annualTax(nextYearBase + excess) - annualTax(nextYearBase);
      deferSaving = round2(t - (kinkBelow.tax + nextYearTax));
    }
    planned = {
      amount,
      tax: t,
      net: round2(amount - t),
      effectiveRate: t / amount,
      marginalRate: rateAt(amount),
      deferKink: kinkBelow?.x,
      deferSaving: Math.max(0, deferSaving),
    };
  }

  return {
    mode,
    income,
    tax,
    currentRate: mode === "unlisted" ? UNLISTED_RATE : base > 0 ? ANNUAL_BRACKETS[findBracket(base)].rate : ANNUAL_BRACKETS[0].rate,
    curve,
    kinks,
    maxX,
    planned,
  };
}
