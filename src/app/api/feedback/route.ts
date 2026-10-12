import { MAX_BODY_BYTES, clientIp, consumeRateLimit, validateFeedback } from "@/lib/feedback";
import { FeedbackStoreNotConfiguredError, saveFeedback } from "@/lib/feedbackStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const fail = (error: string, status: number) => Response.json({ error }, { status, headers: { "Cache-Control": "no-store" } });

export async function POST(req: Request) {
  const declared = Number(req.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) return fail("内容太长了", 413);

  let raw: string;
  try {
    raw = await req.text();
  } catch {
    return fail("请求格式不正确", 400);
  }
  if (Buffer.byteLength(raw, "utf8") > MAX_BODY_BYTES) return fail("内容太长了", 413);

  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return fail("请求格式不正确", 400);
  }

  // 蜜罐：人看不见这个字段，机器人会填。假装成功，但不保存
  if (body && typeof body === "object" && typeof (body as Record<string, unknown>).website === "string" && (body as Record<string, unknown>).website) {
    return Response.json({ ok: true });
  }

  const parsed = validateFeedback(body);
  if (!parsed.ok) return fail(parsed.error, 400);

  if (!consumeRateLimit(clientIp(req))) return fail("发送太频繁，请稍后再试", 429);

  try {
    await saveFeedback(parsed.value);
  } catch (err) {
    if (err instanceof FeedbackStoreNotConfiguredError) return fail("反馈服务暂未配置", 503);
    // 只记错误类型和消息，绝不打印用户提交的内容
    console.error("[feedback] save failed", { name: err instanceof Error ? err.name : "unknown", message: err instanceof Error ? err.message : "" });
    return fail("保存失败，请稍后再试", 502);
  }
  return Response.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
}
