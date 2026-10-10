#!/usr/bin/env node
// 由 data/cities/*.json（调研原始数据，带来源）生成：
//   src/lib/tax/cities.ts        全国城市社保 / 公积金参考值
//   src/lib/pension/regions.ts   各省（及单独公布城市）养老金计发基数
// 用法：node scripts/gen-cities.mjs   每年 7 月前后更新 JSON 后重新生成。
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (f) => JSON.parse(readFileSync(join(root, "data/cities", f), "utf8"));
const cities = read("cities.json");
const social = read("social.json");
const housing = read("housing.json");
const pension = read("pension.json");

const median = (xs) => {
  const s = xs.filter((x) => Number.isFinite(x)).sort((a, b) => a - b);
  return s.length ? s[Math.floor(s.length / 2)] : NaN;
};
const round = (x) => Math.round(x);
const shortName = (n) => n.replace(/(市|地区|盟|自治州|林区)$/, "");
const sameCity = (a, c) => a === c.name || a === c.fullName || shortName(a) === c.name;

// 原 6 城的个人缴费比例沿用之前人工核对过的值（调研里的比例多数没有核实）
const KEEP_RATES = {
  beijing: { medicalRate: 0.02, medicalFixed: 3, unemploymentRate: 0.002 },
  shanghai: { medicalRate: 0.02, medicalFixed: 0, unemploymentRate: 0.005 },
  shenzhen: { medicalRate: 0.02, medicalFixed: 0, unemploymentRate: 0.002 },
  guangzhou: { medicalRate: 0.02, medicalFixed: 0, unemploymentRate: 0.002 },
  hangzhou: { medicalRate: 0.02, medicalFixed: 0, unemploymentRate: 0.005 },
  chengdu: { medicalRate: 0.02, medicalFixed: 0, unemploymentRate: 0.004 },
};
const NOTES = {
  shanghai: "上海基本公积金比例 5%–7%，可另有补充公积金 1%–5%",
};

// ---- 社保：省统一口径，缺省用全国中位数（标 estimated）----
const provSocial = new Map(social.provinces.map((p) => [p.provinceId, p]));
const natSocialMin = median(social.provinces.map((p) => p.socialMin));
const natSocialMax = median(social.provinces.map((p) => p.socialMax));
const cityOverride = (c) => social.cities.find((x) => x.provinceId === c.provinceId && sameCity(x.city, c));

// ---- 公积金：城市公布值 > 最低工资档（下限）+ 省社保上限 × 系数（上限）----
const housingOf = (c) => housing.cities.find((x) => x.provinceId === c.provinceId && sameCity(x.city, c));
const minWageOf = (c) => {
  const mw = housing.minWage.find((m) => m.provinceId === c.provinceId);
  if (!mw) return undefined;
  const tier = mw.tiers.find((t) => t.cities.some((n) => sameCity(n, c)));
  if (tier) return tier.amount;
  // 没列名的城市取该省第二档（多数地级市主城区所在档），只有一档就取它
  const amounts = mw.tiers.map((t) => t.amount).filter(Boolean).sort((a, b) => b - a);
  return amounts[Math.min(1, amounts.length - 1)];
};
// 非省会城市「公积金上限 ÷ 省社保上限」的中位数，用于推算没公布的城市
const capitalLike = (c) => c.level === "municipality" || c.rentTier === 1;
const ratioSamples = [];
for (const c of cities) {
  const h = housingOf(c);
  const p = provSocial.get(c.provinceId);
  if (h?.housingMax && p?.socialMax && !capitalLike(c)) ratioSamples.push(h.housingMax / p.socialMax);
}
const housingMaxRatio = median(ratioSamples) || 1.1;

const out = [];
const qualityCount = { city: 0, province: 0, estimated: 0 };
for (const c of cities) {
  const p = provSocial.get(c.provinceId);
  const o = cityOverride(c);
  const socialMin = o?.socialMin ?? p?.socialMin ?? natSocialMin;
  const socialMax = o?.socialMax ?? p?.socialMax ?? natSocialMax;
  const socialEstimated = !(o?.socialMin ?? p?.socialMin);
  const h = housingOf(c);
  const housingMin = h?.housingMin ?? minWageOf(c) ?? round(socialMin * 0.5);
  const housingMax = h?.housingMax ?? round(socialMax * housingMaxRatio);
  const housingPublished = !!(h?.housingMin && h?.housingMax);
  const rates = KEEP_RATES[c.id] ?? {
    medicalRate: o?.medicalRate ?? p?.medicalRate ?? 0.02,
    medicalFixed: o?.medicalFixed ?? p?.medicalFixed ?? 0,
    unemploymentRate: o?.unemploymentRate ?? p?.unemploymentRate ?? 0.005,
  };
  const quality = socialEstimated ? "estimated" : housingPublished ? "city" : "province";
  qualityCount[quality]++;
  out.push({
    id: c.id,
    name: c.name,
    province: c.province,
    provinceId: c.provinceId,
    pinyin: c.pinyin,
    initials: c.initials,
    socialMin: round(socialMin),
    socialMax: round(socialMax),
    housingMin: round(housingMin),
    housingMax: round(housingMax),
    pensionRate: 0.08,
    ...rates,
    housingRateDefault: h?.housingRateDefault ?? (capitalLike(c) ? 0.12 : 0.1),
    rentTier: c.rentTier,
    quality,
    year: o?.year ?? p?.year ?? 2026,
    ...(NOTES[c.id] ? { note: NOTES[c.id] } : {}),
  });
}
out.push({
  id: "other", name: "其他城市", province: "", provinceId: "", pinyin: "qitachengshi", initials: "qtcs",
  socialMin: round(natSocialMin), socialMax: round(natSocialMax), housingMin: 2000, housingMax: round(natSocialMax * housingMaxRatio),
  pensionRate: 0.08, medicalRate: 0.02, medicalFixed: 0, unemploymentRate: 0.005,
  housingRateDefault: 0.12, rentTier: 2, quality: "estimated", year: 2026,
  note: "全国中位参考值，请按当地标准在高级设置中调整",
});

const ids = new Set();
for (const c of out) {
  if (ids.has(c.id)) throw new Error(`重复 id: ${c.id}`);
  ids.add(c.id);
}
for (const id of Object.keys(KEEP_RATES)) if (!ids.has(id)) throw new Error(`缺少必须保留的 id: ${id}`);

const lines = out.map((c) => `  ${JSON.stringify(c)},`);
writeFileSync(
  join(root, "src/lib/tax/cities.ts"),
  `// 由 scripts/gen-cities.mjs 从 data/cities/*.json 生成，不要手改。
import type { CityPreset } from "./constants";

/**
 * 全国城市参考值（社保为养老保险个人缴费基数上下限，多数省份全省统一；公积金为各市公积金中心口径）。
 * quality：city = 该市公布值；province = 沿用全省口径、公积金按最低工资推算；estimated = 缺数据按全国中位估算。
 * 只影响默认估算；用户可在高级设置中覆盖。注意：\`other\` 必须放在最后（getCity 找不到 id 时回退到它）。
 */
export const CITY_PRESETS: CityPreset[] = [
${lines.join("\n")}
];

/** 选择器「热门」分组：直辖市 + 计划单列市 + 省会（只列清单里存在的 id） */
const HOT_WISHLIST = ${JSON.stringify(["beijing", "shanghai", "guangzhou", "shenzhen", "hangzhou", "chengdu", "nanjing", "wuhan", "xian", "chongqing", "tianjin", "suzhou", "changsha", "zhengzhou", "xiamen", "qingdao"].map((id) => (id === "suzhou" ? cities.find((c) => c.name === "苏州")?.id ?? id : id)))};
export const HOT_CITY_IDS: string[] = HOT_WISHLIST.filter((id) => CITY_PRESETS.some((c) => c.id === id));
`,
);

// ---- 养老金计发基数 ----
const cityIdByName = (name, provinceId) => cities.find((c) => c.provinceId === provinceId && sameCity(name, c))?.id;
const regions = [];
for (const p of pension.baseByProvince) {
  let value = p.latest?.value;
  let note = p.confidence === "low" ? "来源置信度低" : undefined;
  // 湖北没有全省统一值：武汉单列，其余地区多在 7200–7400，取 7300 估算
  if (!value && p.provinceId === "hubei") {
    value = 7300;
    note = "湖北未全省统一，武汉以外地区按 7300 估算";
  }
  if (!value) continue;
  // 省内有城市单独公布时，省这一行代表「其他地区」
  const hasCityRows = pension.baseByCity.some((c) => c.provinceId === p.provinceId && c.latest?.value);
  regions.push({ id: p.provinceId, name: hasCityRows ? `${p.province}（其他地区）` : p.province, provinceId: p.provinceId, base: { year: p.latest?.year ?? 2025, value }, ...(note ? { note } : {}) });
}
for (const c of pension.baseByCity) {
  const id = cityIdByName(c.city, c.provinceId);
  if (!id || !c.latest?.value) {
    console.warn(`计发基数城市未匹配，跳过：${c.city}`);
    continue;
  }
  const lowConf = /confidence=low|仅一篇/.test(c.note ?? "");
  regions.push({ id, name: c.city, provinceId: c.provinceId, base: { year: c.latest.year, value: c.latest.value }, ...(lowConf ? { note: "来源置信度低" } : {}) });
}
writeFileSync(
  join(root, "src/lib/pension/regions.ts"),
  `// 由 scripts/gen-cities.mjs 从 data/cities/pension.json 生成，不要手改。
import type { PensionRegion } from "./params";

/** 各省（及单独公布的城市）最新养老金计发基数（元/月）。id 为省 id 或城市 id。 */
export const PENSION_REGIONS: PensionRegion[] = [
${regions.map((r) => `  ${JSON.stringify(r)},`).join("\n")}
];
`,
);

console.log(`cities: ${out.length}（city ${qualityCount.city} / province ${qualityCount.province} / estimated ${qualityCount.estimated}），公积金上限推算系数 ${housingMaxRatio.toFixed(3)}`);
console.log(`pension regions: ${regions.length}`);
