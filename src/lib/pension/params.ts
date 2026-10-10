import { PENSION_REGIONS } from "./regions";

/** 某年度计发基数（元/月） */
export interface PensionBase {
  year: number;
  value: number;
}

/** 待遇领取地：省，或计发基数单独公布的城市 */
export interface PensionRegion {
  id: string;
  name: string;
  provinceId: string;
  base: PensionBase;
  /** 该地计发基数年增长；缺省用调用方的社平增长假设 */
  growth?: number;
  /** 数据说明（如来源置信度低、按估算） */
  note?: string;
}

export { PENSION_REGIONS };

/** 个人账户养老金计发月数（国发〔2005〕38号），退休年龄 40–70 岁 */
export const ANNUITY_MONTHS: Record<number, number> = {
  40: 233, 41: 230, 42: 226, 43: 223, 44: 220, 45: 216, 46: 212, 47: 208, 48: 204, 49: 199,
  50: 195, 51: 190, 52: 185, 53: 180, 54: 175, 55: 170, 56: 164, 57: 158, 58: 152, 59: 145,
  60: 139, 61: 132, 62: 125, 63: 117, 64: 109, 65: 101, 66: 93, 67: 84, 68: 75, 69: 65, 70: 56,
};

/** 先按城市 id 找单独公布的，再按 provinceId 找省 */
export function regionForCity(cityId: string, provinceId: string): PensionRegion | undefined {
  return (
    PENSION_REGIONS.find((r) => r.id === cityId) ??
    PENSION_REGIONS.find((r) => r.id === provinceId)
  );
}
