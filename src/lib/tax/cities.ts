import type { CityPreset } from "./constants";

/**
 * 城市参考值。基数上下限每年 7 月左右调整，这里是 2026 年度（2026-07 起）参考值，
 * 只影响默认估算；用户可在高级设置中覆盖。
 * 注意：`other` 必须放在最后（getCity 找不到 id 时回退到它）。
 */
export const CITY_PRESETS: CityPreset[] = [
  {
    id: "beijing", name: "北京", province: "北京", provinceId: "beijing", pinyin: "beijing", initials: "bj",
    socialMin: 7270, socialMax: 36348, housingMin: 2540, housingMax: 36348,
    pensionRate: 0.08, medicalRate: 0.02, medicalFixed: 3, unemploymentRate: 0.002,
    housingRateDefault: 0.12, rentTier: 1, quality: "city", year: 2026,
  },
  {
    id: "shanghai", name: "上海", province: "上海", provinceId: "shanghai", pinyin: "shanghai", initials: "sh",
    socialMin: 7546, socialMax: 37731, housingMin: 2690, housingMax: 37302,
    pensionRate: 0.08, medicalRate: 0.02, medicalFixed: 0, unemploymentRate: 0.005,
    housingRateDefault: 0.07, rentTier: 1, quality: "city", year: 2026,
    note: "上海基本公积金比例 5%–7%，可另有补充公积金 1%–5%",
  },
  {
    id: "shenzhen", name: "深圳", province: "广东", provinceId: "guangdong", pinyin: "shenzhen", initials: "sz",
    socialMin: 4775, socialMax: 27549, housingMin: 2520, housingMax: 48471,
    pensionRate: 0.08, medicalRate: 0.02, medicalFixed: 0, unemploymentRate: 0.002,
    housingRateDefault: 0.12, rentTier: 1, quality: "city", year: 2026,
  },
  {
    id: "guangzhou", name: "广州", province: "广东", provinceId: "guangdong", pinyin: "guangzhou", initials: "gz",
    socialMin: 5510, socialMax: 27549, housingMin: 2500, housingMax: 41697,
    pensionRate: 0.08, medicalRate: 0.02, medicalFixed: 0, unemploymentRate: 0.002,
    housingRateDefault: 0.12, rentTier: 1, quality: "city", year: 2026,
  },
  {
    id: "hangzhou", name: "杭州", province: "浙江", provinceId: "zhejiang", pinyin: "hangzhou", initials: "hz",
    socialMin: 4986, socialMax: 25299, housingMin: 2490, housingMax: 42151,
    pensionRate: 0.08, medicalRate: 0.02, medicalFixed: 0, unemploymentRate: 0.005,
    housingRateDefault: 0.12, rentTier: 1, quality: "city", year: 2026,
  },
  {
    id: "chengdu", name: "成都", province: "四川", provinceId: "sichuan", pinyin: "chengdu", initials: "cd",
    socialMin: 4588, socialMax: 22938, housingMin: 2280, housingMax: 32969,
    pensionRate: 0.08, medicalRate: 0.02, medicalFixed: 0, unemploymentRate: 0.004,
    housingRateDefault: 0.12, rentTier: 1, quality: "city", year: 2026,
  },
  {
    id: "other", name: "其他城市", province: "", provinceId: "", pinyin: "qitachengshi", initials: "qtcs",
    socialMin: 4000, socialMax: 25000, housingMin: 2000, housingMax: 30000,
    pensionRate: 0.08, medicalRate: 0.02, medicalFixed: 0, unemploymentRate: 0.005,
    housingRateDefault: 0.12, rentTier: 2, quality: "estimated", year: 2026,
    note: "通用参考值，请按当地标准在高级设置中调整",
  },
];

/** 选择器「热门」分组：北上广深杭成 + 之后补充的省会/计划单列市；只列清单里存在的 id */
const HOT_WISHLIST = ["beijing", "shanghai", "guangzhou", "shenzhen", "hangzhou", "chengdu"];
export const HOT_CITY_IDS: string[] = HOT_WISHLIST.filter((id) => CITY_PRESETS.some((c) => c.id === id));
