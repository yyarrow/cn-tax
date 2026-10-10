import type { CityPreset } from "@/lib/tax";

type Searchable = Pick<CityPreset, "name" | "province" | "pinyin" | "initials">;

/**
 * 城市搜索：汉字 name/province 子串、全拼前缀、首字母前缀，不区分大小写。
 * 空查询返回完整清单（拷贝）。排序：名称前缀 > 拼音/首字母前缀 > 其余子串，同档保持原顺序。
 */
export function searchCities<T extends Searchable>(list: readonly T[], query: string, limit = Infinity): T[] {
  const q = query.trim().toLowerCase().replace(/\s+/g, "");
  if (!q) return list.slice(0, limit);
  const scored: { c: T; score: number; i: number }[] = [];
  list.forEach((c, i) => {
    const name = c.name.toLowerCase();
    let score = -1;
    if (name === q) score = 0;
    else if (name.startsWith(q)) score = 1;
    else if (c.pinyin.toLowerCase().startsWith(q) || c.initials.toLowerCase().startsWith(q)) score = 2;
    else if (name.includes(q) || c.province.toLowerCase().includes(q)) score = 3;
    if (score >= 0) scored.push({ c, score, i });
  });
  scored.sort((a, b) => a.score - b.score || a.i - b.i);
  return scored.slice(0, limit).map((s) => s.c);
}
