import { compressToEncodedURIComponent, decompressFromEncodedURIComponent } from "lz-string";
import type { Profile } from "@/lib/tax";

export const SITE = "https://tax.warmbeing.com";
const HASH_KEY = "s";

/** 把当前输入压缩进链接：查询串带来源标记（给统计），数据放在 hash 里不经过服务器 */
export function buildShareUrl(profile: Profile, source = "share"): string {
  const payload = compressToEncodedURIComponent(JSON.stringify(profile));
  return `${SITE}/?utm_source=${source}#${HASH_KEY}=${payload}`;
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
