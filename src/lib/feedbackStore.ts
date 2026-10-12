import { randomBytes } from "node:crypto";
import { put } from "@vercel/blob";
import type { Feedback } from "./feedback";

/**
 * 反馈存进 Vercel Blob 私有 store（cn-tax-feedback）。
 * 凭证由 Vercel 注入环境变量（BLOB_READ_WRITE_TOKEN），put 自动读取；代码里不显式传 token、不读它的值；
 * 记录里不放 IP（限流只在内存里用）。
 */

/** 没有可用的 Blob 凭证（本地 / 预览环境没连 store） */
export class FeedbackStoreNotConfiguredError extends Error {
  constructor() {
    super("blob store not configured");
    this.name = "FeedbackStoreNotConfiguredError";
  }
}

export type FeedbackRecord = {
  createdAt: string;
  page: string | null;
  email: string | null;
  message: string;
};

/** feedback/YYYY/MM/<ISO 时间戳，冒号换成 ->-<8 位随机>.json，后台按月浏览、按文件名即按时间排序 */
export function feedbackPathname(now: Date, rand = randomBytes(4).toString("hex")): string {
  const iso = now.toISOString();
  return `feedback/${iso.slice(0, 4)}/${iso.slice(5, 7)}/${iso.replaceAll(":", "-")}-${rand}.json`;
}

/** 只判断有没有配置，不读取值 */
export function isBlobConfigured(): boolean {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN || process.env.BLOB_STORE_ID);
}

/** @vercel/blob 在找不到凭证时抛的错误（消息里不含任何密钥） */
function isMissingCredentials(err: unknown): boolean {
  return err instanceof Error && /No blob credentials found|No read-write token found/i.test(err.message);
}

export async function saveFeedback(fb: Feedback, now = new Date()): Promise<{ pathname: string }> {
  if (!isBlobConfigured()) throw new FeedbackStoreNotConfiguredError();
  const record: FeedbackRecord = {
    createdAt: now.toISOString(),
    page: fb.page ?? null,
    email: fb.email ?? null,
    message: fb.message,
  };
  const pathname = feedbackPathname(now);
  try {
    await put(pathname, JSON.stringify(record, null, 2), {
      access: "private",
      contentType: "application/json",
      addRandomSuffix: false,
    });
  } catch (err) {
    if (isMissingCredentials(err)) throw new FeedbackStoreNotConfiguredError();
    throw err;
  }
  return { pathname };
}
