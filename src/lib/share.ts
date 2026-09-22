import { compressToEncodedURIComponent, decompressFromEncodedURIComponent } from "lz-string";
import type { OfferInput, Profile } from "@/lib/tax";

export const SITE = "https://tax.warmbeing.com";
const HASH_KEY = "s";
const OFFERS_HASH_KEY = "o";

/** 把当前输入压缩进链接：查询串带来源标记（给统计），数据放在 hash 里不经过服务器 */
export function buildShareUrl(profile: Profile, source = "share"): string {
  const payload = compressToEncodedURIComponent(JSON.stringify(profile));
  const origin = typeof window !== "undefined" ? window.location.origin : SITE;
  return `${origin}/?utm_source=${source}#${HASH_KEY}=${payload}`;
}

/** 从当前地址的 hash 里解出分享的输入；成功后清掉 hash，避免刷新时反复覆盖本地数据 */
export function consumeSharedProfile(): Profile | null {
  if (typeof window === "undefined") return null;
  const m = window.location.hash.match(new RegExp(`[#&]${HASH_KEY}=([^&]+)`));
  if (!m) return null;
  try {
    const json = decompressFromEncodedURIComponent(m[1]);
    if (!json) return null;
    const p = JSON.parse(json) as Profile;
    if (!p || !Array.isArray(p.segments)) return null;
    const url = new URL(window.location.href);
    url.hash = "";
    window.history.replaceState(null, "", url.toString());
    return p;
  } catch {
    return null;
  }
}

/** Offer 对比：把几份 offer 压进 /offer 的 hash */
export function buildOfferShareUrl(offers: OfferInput[]): string {
  const payload = compressToEncodedURIComponent(JSON.stringify(offers));
  const origin = typeof window !== "undefined" ? window.location.origin : SITE;
  return `${origin}/offer?utm_source=share#${OFFERS_HASH_KEY}=${payload}`;
}

/** 从 hash 里解出分享的 offer 列表；成功后清掉 hash，避免刷新时反复覆盖本地数据 */
export function consumeSharedOffers(): OfferInput[] | null {
  if (typeof window === "undefined") return null;
  const m = window.location.hash.match(new RegExp(`[#&]${OFFERS_HASH_KEY}=([^&]+)`));
  if (!m) return null;
  try {
    const json = decompressFromEncodedURIComponent(m[1]);
    if (!json) return null;
    const list = JSON.parse(json) as OfferInput[];
    if (!Array.isArray(list) || list.length === 0) return null;
    if (!list.every((o) => o && typeof o === "object" && typeof o.monthlySalary === "number")) return null;
    const url = new URL(window.location.href);
    url.hash = "";
    window.history.replaceState(null, "", url.toString());
    return list;
  } catch {
    return null;
  }
}
