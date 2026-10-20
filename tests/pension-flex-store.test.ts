import { describe, expect, it } from "vitest";
import { normalize } from "@/lib/pensionStore";

const base = { birthYear: 1990, birthMonth: 6, category: "male" as const, cityId: "beijing" };

describe("pensionStore · 灵活就业续交设置", () => {
  it("旧数据缺字段 = 不续交，最低档 60%", () => {
    const n = normalize(base);
    expect(n.flexOn).toBe(false);
    expect(n.flexTier).toBe("min");
    expect(n.flexRatio).toBe(0.6);
  });

  it("档次决定比例：最低 0.6、按社平 1；自定义保留输入", () => {
    expect(normalize({ ...base, flexOn: true, flexTier: "avg", flexRatio: 2 })).toMatchObject({ flexOn: true, flexTier: "avg", flexRatio: 1 });
    expect(normalize({ ...base, flexOn: true, flexTier: "min", flexRatio: 2 }).flexRatio).toBe(0.6);
    expect(normalize({ ...base, flexOn: true, flexTier: "custom", flexRatio: 1.5 }).flexRatio).toBe(1.5);
  });

  it("自定义输入过程中不被下限改写（使用处再夹到 0.6–3），上限夹到 3，乱数据回退", () => {
    expect(normalize({ ...base, flexTier: "custom", flexRatio: 0.1 }).flexRatio).toBe(0.1);
    expect(normalize({ ...base, flexTier: "custom", flexRatio: 9 }).flexRatio).toBe(3);
    const bad = normalize({ ...base, flexOn: "yes" as unknown as boolean, flexTier: "x" as unknown as "min", flexRatio: "abc" as unknown as number });
    expect(bad).toMatchObject({ flexOn: false, flexTier: "min", flexRatio: 0.6 });
  });
});
