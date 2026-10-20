import { describe, expect, it } from "vitest";
import { ASSUMPTION_PRESETS, normalize } from "@/lib/pensionStore";

describe("养老金假设档位", () => {
  it("新数据默认中性档", () => {
    const n = normalize({});
    expect(n.preset).toBe("neutral");
    expect(n.wageGrowth).toBe(ASSUMPTION_PRESETS.neutral.wageGrowth);
    expect(n.accountRate).toBe(ASSUMPTION_PRESETS.neutral.accountRate);
  });

  it("旧存档还是旧默认值（利率 2%、通胀 2%、没填增长）的迁到中性档", () => {
    const n = normalize({ accountRate: 0.02, inflation: 0.02 });
    expect(n.preset).toBe("neutral");
    expect(n.accountRate).toBe(0.015);
    expect(n.wageGrowth).toBe(0.02);
  });

  it("旧存档里手动改过的保留为自定义", () => {
    const n = normalize({ accountRate: 0.03, inflation: 0.02 });
    expect(n.preset).toBe("custom");
    expect(n.accountRate).toBe(0.03);
  });

  it("选了档位就用档位的数", () => {
    const n = normalize({ preset: "optimistic", accountRate: 0.08 });
    expect(n.accountRate).toBe(ASSUMPTION_PRESETS.optimistic.accountRate);
    expect(n.wageGrowth).toBe(ASSUMPTION_PRESETS.optimistic.wageGrowth);
  });

  it("自定义按填的数", () => {
    const n = normalize({ preset: "custom", wageGrowth: 0.04, accountRate: 0.01, inflation: 0.03 });
    expect([n.wageGrowth, n.accountRate, n.inflation]).toEqual([0.04, 0.01, 0.03]);
  });
});
