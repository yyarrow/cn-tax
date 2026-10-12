/** 意见反馈：校验、限流（纯逻辑，route.ts 只做 HTTP 编排） */

export const MAX_MESSAGE = 1000;
export const MAX_EMAIL = 254;
export const MAX_PAGE = 200;
export const MAX_BODY_BYTES = 16 * 1024;
export const RATE_LIMIT_PER_HOUR = 5;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CONTROL_RE = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/;

export function isValidEmail(email: string): boolean {
  return email.length <= MAX_EMAIL && EMAIL_RE.test(email);
}

export type Feedback = { message: string; email?: string; page?: string };
export type ParseResult = { ok: true; value: Feedback } | { ok: false; error: string };

/** 校验已解析的 JSON 请求体（蜜罐在此之前处理） */
export function validateFeedback(body: unknown): ParseResult {
  if (!body || typeof body !== "object" || Array.isArray(body)) return { ok: false, error: "请求格式不正确" };
  const b = body as Record<string, unknown>;

  if (typeof b.message !== "string") return { ok: false, error: "请填写反馈内容" };
  const message = b.message.trim();
  if (message.length < 1) return { ok: false, error: "请填写反馈内容" };
  if (message.length > MAX_MESSAGE) return { ok: false, error: `反馈内容不能超过 ${MAX_MESSAGE} 字` };
  if (CONTROL_RE.test(message)) return { ok: false, error: "反馈内容含有无法识别的字符" };

  let email: string | undefined;
  if (b.email !== undefined && b.email !== null && b.email !== "") {
    if (typeof b.email !== "string") return { ok: false, error: "邮箱格式不正确" };
    const e = b.email.trim();
    if (e) {
      if (!isValidEmail(e)) return { ok: false, error: "邮箱格式不正确" };
      email = e;
    }
  }

  let page: string | undefined;
  if (b.page !== undefined && b.page !== null && b.page !== "") {
    if (typeof b.page !== "string" || !b.page.startsWith("/") || b.page.length > MAX_PAGE || CONTROL_RE.test(b.page) || /[\r\n]/.test(b.page)) {
      return { ok: false, error: "页面路径不正确" };
    }
    page = b.page;
  }

  return { ok: true, value: { message, email, page } };
}

/**
 * 内存限流：每 IP 每小时最多 RATE_LIMIT_PER_HOUR 条。
 * 有意的轻量方案——serverless 多实例 / 冷启动下计数不精确，只用来挡住最粗暴的刷量，
 * 不引入外部存储。真被刷了再换 KV / Upstash。
 */
const WINDOW_MS = 60 * 60 * 1000;
const hits = new Map<string, number[]>();

export function consumeRateLimit(ip: string, now = Date.now()): boolean {
  if (hits.size > 2000) {
    for (const [k, v] of hits) if (v.every((t) => now - t >= WINDOW_MS)) hits.delete(k);
  }
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  if (recent.length >= RATE_LIMIT_PER_HOUR) {
    hits.set(ip, recent);
    return false;
  }
  recent.push(now);
  hits.set(ip, recent);
  return true;
}

/** 仅测试用 */
export function resetRateLimit() {
  hits.clear();
}

export function clientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return xff || req.headers.get("x-real-ip")?.trim() || "unknown";
}
