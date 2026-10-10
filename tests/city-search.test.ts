import { describe, expect, it } from "vitest";
import { searchCities } from "@/lib/citySearch";

const mk = (name: string, province: string, pinyin: string, initials: string) => ({ name, province, pinyin, initials });
const LIST = [
  mk("北京", "北京", "beijing", "bj"),
  mk("杭州", "浙江", "hangzhou", "hz"),
  mk("宁波", "浙江", "ningbo", "nb"),
  mk("惠州", "广东", "huizhou", "hz"),
  mk("海口", "海南", "haikou", "hk"),
  mk("西安", "陕西", "xian", "xa"),
  mk("其他城市", "", "qitachengshi", "qtcs"),
];
const names = (q: string, limit?: number) => searchCities(LIST, q, limit).map((c) => c.name);

describe("searchCities", () => {
  it("empty / whitespace query returns the whole list in order", () => {
    expect(names("")).toEqual(LIST.map((c) => c.name));
    expect(names("   ")).toEqual(LIST.map((c) => c.name));
  });

  it("matches Chinese substring on name", () => {
    expect(names("杭")).toEqual(["杭州"]);
    expect(names("州")).toEqual(["杭州", "惠州"]);
  });

  it("matches province name", () => {
    expect(names("浙江")).toEqual(["杭州", "宁波"]);
  });

  it("matches full pinyin prefix only (not mid-word)", () => {
    expect(names("hang")).toEqual(["杭州"]);
    expect(names("zhou")).toEqual([]);
    expect(names("hangzhou")).toEqual(["杭州"]);
  });

  it("matches initials prefix", () => {
    expect(names("hz")).toEqual(["杭州", "惠州"]);
    expect(names("qt")).toEqual(["其他城市"]);
  });

  it("is case-insensitive and ignores spaces", () => {
    expect(names("HZ")).toEqual(["杭州", "惠州"]);
    expect(names("HangZhou")).toEqual(["杭州"]);
    expect(names(" han g ")).toEqual(["杭州"]);
  });

  it("ranks name prefix above pinyin matches, stable otherwise", () => {
    const list = [mk("甲", "乙", "h", "h"), mk("h城", "", "x", "x")];
    expect(searchCities(list, "h").map((c) => c.name)).toEqual(["h城", "甲"]);
  });

  it("respects the limit and returns nothing for unknown queries", () => {
    expect(names("h", 2)).toHaveLength(2);
    expect(names("zzz")).toEqual([]);
  });
});
