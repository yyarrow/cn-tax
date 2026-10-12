import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@vercel/blob", () => ({ put: vi.fn() }));

import { put } from "@vercel/blob";
import { POST } from "@/app/api/feedback/route";
import { resetRateLimit } from "@/lib/feedback";
import { feedbackPathname } from "@/lib/feedbackStore";

const putMock = vi.mocked(put);

let ipSeq = 0;
function post(body: unknown, headers: Record<string, string> = {}) {
  const raw = typeof body === "string" ? body : JSON.stringify(body);
  return POST(
    new Request("http://localhost/api/feedback", {
      method: "POST",
      headers: { "content-type": "application/json", "x-forwarded-for": `10.0.0.${++ipSeq}`, ...headers },
      body: raw,
    }),
  );
}

let errorSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  vi.stubEnv("BLOB_READ_WRITE_TOKEN", "placeholder-not-a-real-token");
  vi.stubEnv("BLOB_STORE_ID", "");
  resetRateLimit();
  ipSeq = 0;
  putMock.mockReset();
  putMock.mockResolvedValue({} as Awaited<ReturnType<typeof put>>);
  errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("validation", () => {
  it.each([
    ["empty message", { message: "" }],
    ["whitespace-only message", { message: "   \n " }],
    ["missing message", {}],
    ["non-string message", { message: 123 }],
    ["too long message", { message: "a".repeat(1001) }],
    ["bad email", { message: "hi", email: "not-an-email" }],
    ["email too long", { message: "hi", email: `${"a".repeat(250)}@x.com` }],
    ["page without leading slash", { message: "hi", page: "pension" }],
    ["page too long", { message: "hi", page: `/${"a".repeat(200)}` }],
    ["non-object body", [1, 2]],
  ])("rejects %s with 400 and a Chinese error", async (_name, body) => {
    const res = await post(body);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/[一-龥]/);
    expect(putMock).not.toHaveBeenCalled();
  });

  it("rejects invalid JSON", async () => {
    expect((await post("{not json")).status).toBe(400);
  });

  it("rejects bodies over 16KB", async () => {
    const res = await post({ message: "hi", page: "/", pad: "x".repeat(17 * 1024) });
    expect(res.status).toBe(413);
    expect(putMock).not.toHaveBeenCalled();
  });

  it("accepts exactly 1000 characters and trims whitespace", async () => {
    const res = await post({ message: `  ${"好".repeat(1000)}  `, email: "", page: "/pension" });
    expect(res.status).toBe(200);
    const record = JSON.parse(putMock.mock.calls[0][1] as string);
    expect(record.message).toBe("好".repeat(1000));
    expect(record.email).toBeNull();
  });
});

describe("honeypot", () => {
  it("returns ok but stores nothing when website is filled", async () => {
    const res = await post({ message: "spam", website: "http://spam.example" });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(putMock).not.toHaveBeenCalled();
  });
});

describe("saving to Vercel Blob", () => {
  it("puts a private JSON record under feedback/YYYY/MM/ without the IP", async () => {
    const res = await post({ message: "算错了", email: "a@x.com", page: "/pension", website: "" }, { "x-forwarded-for": "203.0.113.7" });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });

    expect(putMock).toHaveBeenCalledTimes(1);
    const [pathname, body, options] = putMock.mock.calls[0];
    expect(pathname).toMatch(/^feedback\/\d{4}\/\d{2}\/\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}\.\d{3}Z-[0-9a-f]{8}\.json$/);
    const [, y, m] = pathname.match(/^feedback\/(\d{4})\/(\d{2})\//)!;
    expect(pathname).toContain(`${y}-${m}-`);
    expect(options).toMatchObject({ access: "private", contentType: "application/json", addRandomSuffix: false });

    const record = JSON.parse(body as string);
    expect(Object.keys(record).sort()).toEqual(["createdAt", "email", "message", "page"]);
    expect(record).toMatchObject({ message: "算错了", email: "a@x.com", page: "/pension" });
    expect(new Date(record.createdAt).toISOString()).toBe(record.createdAt);
    expect(body as string).not.toContain("203.0.113.7");
  });

  it("stores null for missing email / page", async () => {
    await post({ message: "hi" });
    const record = JSON.parse(putMock.mock.calls[0][1] as string);
    expect(record).toMatchObject({ message: "hi", email: null, page: null });
  });

  it("returns 503 without calling put when no Blob env is configured", async () => {
    vi.stubEnv("BLOB_READ_WRITE_TOKEN", "");
    const res = await post({ message: "hi" });
    expect(res.status).toBe(503);
    expect((await res.json()).error).toBe("反馈服务暂未配置");
    expect(putMock).not.toHaveBeenCalled();
  });

  it("also returns 503 when put itself reports missing credentials", async () => {
    putMock.mockRejectedValueOnce(new Error("Vercel Blob: No blob credentials found. Pass a `token` option, set `BLOB_READ_WRITE_TOKEN`, or use `oidcToken`."));
    const res = await post({ message: "hi" });
    expect(res.status).toBe(503);
    expect((await res.json()).error).toBe("反馈服务暂未配置");
  });

  it("returns 502 when put fails, logging error info but not user content", async () => {
    putMock.mockRejectedValueOnce(new Error("Vercel Blob: Unknown error, please visit https://vercel.com/help"));
    const res = await post({ message: "private user content", email: "a@x.com" });
    expect(res.status).toBe(502);
    expect((await res.json()).error).toBe("保存失败，请稍后再试");
    const logged = JSON.stringify(errorSpy.mock.calls);
    expect(logged).toContain("Unknown error");
    expect(logged).not.toContain("private user content");
    expect(logged).not.toContain("a@x.com");
  });
});

describe("rate limit", () => {
  it("allows 5 per IP per hour, then 429", async () => {
    const h = { "x-forwarded-for": "1.2.3.4, 5.6.7.8" };
    for (let i = 0; i < 5; i++) expect((await post({ message: `m${i}` }, h)).status).toBe(200);
    const sixth = await post({ message: "m6" }, h);
    expect(sixth.status).toBe(429);
    expect((await sixth.json()).error).toBe("发送太频繁，请稍后再试");
    expect(putMock).toHaveBeenCalledTimes(5);
    // 其他 IP 不受影响
    expect((await post({ message: "other" }, { "x-forwarded-for": "8.8.8.8" })).status).toBe(200);
  });

  it("falls back to x-real-ip", async () => {
    const h = { "x-forwarded-for": "", "x-real-ip": "7.7.7.7" };
    for (let i = 0; i < 5; i++) await post({ message: "x" }, h);
    expect((await post({ message: "x" }, h)).status).toBe(429);
  });
});

describe("feedbackPathname", () => {
  it("builds feedback/YYYY/MM/<iso with dashes>-<rand>.json", () => {
    expect(feedbackPathname(new Date("2026-10-12T07:30:05.123Z"), "abcd1234")).toBe("feedback/2026/10/2026-10-12T07-30-05.123Z-abcd1234.json");
  });
});
