"use client";

import { useId, useRef, useState, type FormEvent } from "react";
import { useDialogExit } from "@/lib/dialogMotion";
import { Button, inputCls } from "./ui";

const MAX_MESSAGE = 1000;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Status = "idle" | "sending" | "done";

/**
 * 意见反馈入口 + 原生 dialog 弹窗。
 * variant="header"：页头右上角的小号图标文字按钮；variant="link"：页脚行内文字链接。
 * 两处各自挂一个实例，互不影响。
 */
export function FeedbackButton({ variant = "header", label }: { variant?: "header" | "link"; label?: string }) {
  const uid = useId();
  const titleId = `${uid}-title`;
  const messageId = `${uid}-message`;
  const emailId = `${uid}-email`;
  const emailErrId = `${uid}-email-err`;
  const dialogRef = useRef<HTMLDialogElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState("");
  const [email, setEmail] = useState("");
  const [website, setWebsite] = useState("");
  const [emailTouched, setEmailTouched] = useState(false);
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState("");

  const trimmedEmail = email.trim();
  const emailInvalid = trimmedEmail !== "" && !EMAIL_RE.test(trimmedEmail);
  const sending = status === "sending";

  const open = () => {
    if (status === "done") setStatus("idle");
    setError("");
    document.body.style.overflow = "hidden";
    dialogRef.current?.showModal();
    textareaRef.current?.focus();
  };

  /** 原生 close 事件：清理淡出标记、恢复滚动和焦点 */
  const onClose = () => {
    delete dialogRef.current?.dataset.closing;
    document.body.style.overflow = "";
    triggerRef.current?.focus();
  };

  /** 取消 / 关闭 / Esc / 点遮罩都走这里：先淡出，再真正 close() */
  const close = useDialogExit(
    () => dialogRef.current,
    () => dialogRef.current?.close(),
  );

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (sending) return;
    const text = message.trim();
    if (!text) return;
    if (emailInvalid) {
      setEmailTouched(true);
      emailRef.current?.focus();
      return;
    }
    setStatus("sending");
    setError("");
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          ...(trimmedEmail ? { email: trimmedEmail } : {}),
          page: location.pathname,
          website,
        }),
      });
      if (res.ok) {
        setMessage("");
        setEmail("");
        setWebsite("");
        setEmailTouched(false);
        setStatus("done");
        return;
      }
      let msg = "";
      try {
        msg = ((await res.json()) as { error?: string }).error ?? "";
      } catch {
        // 非 JSON 响应，用兜底文案
      }
      setError(msg || "发送失败，请稍后再试");
    } catch {
      setError("网络异常，请稍后再试");
    }
    setStatus("idle");
  };

  const trigger =
    variant === "link" ? (
      <button ref={triggerRef} type="button" onClick={open} className="inline cursor-pointer rounded text-accent-text hover:underline print:hidden">
        {label ?? "意见反馈"}
      </button>
    ) : (
      <button
        ref={triggerRef}
        type="button"
        onClick={open}
        className="-mr-2 inline-flex min-h-11 shrink-0 items-center gap-1 self-start rounded-lg px-2 text-sm text-muted max-sm:min-w-11 max-sm:justify-center transition-[color,transform] duration-150 hover:text-ink active:scale-[.98] sm:min-h-8 print:hidden"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M21 12a8 8 0 0 1-11.6 7.1L4 20.5l1.5-4.6A8 8 0 1 1 21 12Z" />
          <path d="M8.5 11h7M8.5 14h4" />
        </svg>
        <span className="max-sm:sr-only">{label ?? "反馈"}</span>
      </button>
    );

  return (
    <>
      {trigger}
      <dialog
        ref={dialogRef}
        aria-labelledby={titleId}
        onClose={onClose}
        onCancel={(e) => {
          e.preventDefault();
          close();
        }}
        onClick={(e) => {
          // 点遮罩（dialog 自身，内容区已铺满）关闭
          if (e.target === e.currentTarget) close();
        }}
        className="dlg-panel dlg-backdrop m-auto w-[calc(100%-2rem)] max-w-md rounded-2xl border border-line bg-white p-0 text-ink shadow-xl backdrop:bg-ink/60 backdrop:backdrop-blur-sm print:hidden"
      >
        <div className="p-5">
          {status === "done" ? (
            <div className="py-6 text-center" role="status">
              <div className="check-pop mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-good/15 text-good-text">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path className="check-draw" d="m5 12.5 4.5 4.5L19 7.5" />
                </svg>
              </div>
              <h2 id={titleId} className="mt-3 text-base font-semibold text-ink">
                已收到，谢谢！
              </h2>
              <div className="mt-5">
                <Button variant="primary" onClick={close} className="h-9 px-5">
                  关闭
                </Button>
              </div>
            </div>
          ) : (
            <form onSubmit={submit} noValidate>
              <h2 id={titleId} className="text-base font-semibold text-ink">
                意见反馈
              </h2>
              <p className="mt-1 text-sm leading-relaxed text-muted">哪里算得不对、想要什么功能，都可以说。</p>

              <div className="mt-4">
                <label htmlFor={messageId} className="sr-only">
                  反馈内容
                </label>
                <textarea
                  id={messageId}
                  ref={textareaRef}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  maxLength={MAX_MESSAGE}
                  rows={5}
                  required
                  placeholder="写下你的想法…"
                  className={`${inputCls} h-auto resize-y py-2 leading-relaxed`}
                />
                <div className="mt-1 text-right text-xs tabular-nums text-muted" aria-live="off">
                  {message.length}/{MAX_MESSAGE}
                </div>
              </div>

              <div className="mt-2">
                <label htmlFor={emailId} className="sr-only">
                  邮箱（选填）
                </label>
                <input
                  id={emailId}
                  ref={emailRef}
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onBlur={() => setEmailTouched(true)}
                  maxLength={254}
                  placeholder="想收到回复可以留邮箱"
                  aria-invalid={emailTouched && emailInvalid}
                  aria-describedby={emailTouched && emailInvalid ? emailErrId : undefined}
                  className={inputCls}
                />
                {emailTouched && emailInvalid && (
                  <p id={emailErrId} className="mt-1 text-xs text-danger-text">
                    邮箱格式不太对，请检查一下
                  </p>
                )}
              </div>

              {/* 蜜罐：真人看不到也聚焦不到，机器人往往会填 */}
              <div aria-hidden="true" className="sr-only">
                <input type="text" name="website" tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} />
              </div>

              {error && (
                <p role="alert" className="mt-3 rounded-lg bg-danger/10 px-3 py-2 text-sm leading-relaxed text-danger-text">
                  {error}
                </p>
              )}

              <div className="mt-4 flex items-center justify-end gap-2">
                <Button variant="ghost" onClick={close} className="h-9">
                  取消
                </Button>
                <Button type="submit" variant="primary" disabled={sending || message.trim() === ""} className="h-9 px-5">
                  {sending ? "发送中…" : "发送"}
                </Button>
              </div>
            </form>
          )}
        </div>
      </dialog>
    </>
  );
}
