"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import QRCode from "qrcode";
import { SITE } from "@/lib/share";
import { exportNodeAsPng, savePng } from "@/lib/exportImage";
import { Button } from "./ui";

/**
 * 各页通用的「报告预览」弹层：工具条（复制链接 / 保存 PDF / 导出图片 / 关闭）＋ 报告正文 ＋ 二维码页脚。
 * 微信里不给「保存 PDF」，导出图片改成长按保存。
 */
export function ShareModal({
  title,
  subtitle,
  shareUrl,
  fileName,
  onClose,
  children,
  extraControls,
  ctaLabel = "查看完整报告",
  footerNote,
}: {
  title: string;
  subtitle?: ReactNode;
  shareUrl: string;
  fileName: string;
  onClose: () => void;
  children: ReactNode;
  /** 工具条上这一页自己的控件（如首页的摘要 / 完整切换） */
  extraControls?: ReactNode;
  /** 正文顶部引导语里「查看完整报告」那段文案 */
  ctaLabel?: string;
  /** 页脚免责声明前面补一句这一页自己的说明 */
  footerNote?: ReactNode;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [busy, setBusy] = useState(false);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [qr, setQr] = useState<string>("");
  const [copied, setCopied] = useState(false);

  const displayUrl = typeof window !== "undefined" ? window.location.host : new URL(SITE).host;
  const ua = typeof navigator === "undefined" ? "" : navigator.userAgent;
  const inWeChat = /MicroMessenger/i.test(ua);
  const isMobile = /iPhone|iPad|Android|MicroMessenger/i.test(ua);
  const today = new Date();
  const dateText = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

  useEffect(() => {
    let alive = true;
    QRCode.toDataURL(shareUrl, { margin: 0, width: 220, errorCorrectionLevel: "M", color: { dark: "#16150f", light: "#ffffff" } })
      .then((u) => alive && setQr(u))
      .catch(() => alive && setQr(""));
    return () => {
      alive = false;
    };
  }, [shareUrl]);

  useEffect(() => {
    const dialog = dialogRef.current;
    const trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialog?.showModal();
    return () => {
      dialog?.close();
      document.body.style.overflow = prev;
      trigger?.focus();
    };
  }, []);

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      window.prompt("复制这个链接：", shareUrl);
    }
  };

  const exportPng = async () => {
    if (!rootRef.current || busy) return;
    setBusy(true);
    try {
      const png = await exportNodeAsPng(rootRef.current, { fileName, background: "#f6f5f2" });
      if (isMobile) {
        // 微信 / 手机浏览器不支持 download，改为展示图片让用户长按保存
        setImageUrl(png);
      } else {
        savePng(png, fileName);
      }
    } catch (err) {
      console.error(err);
      alert("导出图片失败，请改用「保存 PDF」");
    } finally {
      setBusy(false);
    }
  };

  return (
    <dialog ref={dialogRef} aria-label={title} className="report-modal fixed inset-0 z-50 m-0 h-full max-h-none w-full max-w-none overflow-y-auto border-0 bg-ink/60 p-0 text-ink backdrop-blur-sm" onClick={onClose} onCancel={(e) => {
      e.preventDefault();
      if (imageUrl) setImageUrl(null);
      else onClose();
    }}>
      <div className="mx-auto my-6 w-full max-w-3xl px-4" onClick={(e) => e.stopPropagation()}>
        <div className="report-toolbar mb-2 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-white/95 px-4 py-2.5 shadow-md">
          <span className="text-sm font-medium text-ink">报告预览</span>
          <div className="flex flex-wrap items-center gap-2">
            <div className="hidden items-center gap-2 sm:flex">
              {extraControls}
              {!inWeChat && (
                <Button variant="secondary" onClick={() => window.print()} className="h-9">
                  保存 PDF
                </Button>
              )}
            </div>
            <Button variant="primary" onClick={exportPng} className="h-9">
              {busy ? "导出中…" : "导出图片"}
            </Button>
            <Button variant="secondary" onClick={copyLink} className="h-9">
              {copied ? "已复制" : "复制链接"}
            </Button>
            <Button variant="ghost" onClick={onClose} className="h-9">
              关闭
            </Button>
          </div>
        </div>

        {(extraControls || !inWeChat) && (
          <div className="report-toolbar-secondary mb-3 flex flex-wrap items-center gap-2 rounded-xl bg-white/95 px-4 py-2 shadow-md sm:hidden">
            {extraControls}
            {!inWeChat && (
              <Button variant="secondary" onClick={() => window.print()} className="h-9">
                保存 PDF
              </Button>
            )}
          </div>
        )}

        {inWeChat && <p className="mb-3 rounded-lg bg-white/90 px-3 py-2 text-xs text-muted">微信里点「导出图片」后长按图片即可保存；要 PDF 请点右上角「在浏览器打开」。</p>}

        {imageUrl && (
          <div className="fixed inset-0 z-[60] flex flex-col items-center justify-center bg-ink/80 p-4" onClick={() => setImageUrl(null)}>
            <p className="mb-3 text-sm font-medium text-white">长按图片保存到相册</p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={imageUrl} alt={title} className="max-h-[80vh] w-auto max-w-full rounded-lg shadow-lg" onClick={(e) => e.stopPropagation()} />
            <button type="button" className="mt-3 rounded-lg bg-white/90 px-4 py-1.5 text-sm text-ink" onClick={() => setImageUrl(null)}>
              关闭
            </button>
          </div>
        )}

        <div ref={rootRef} className="report-root space-y-4 rounded-2xl bg-paper p-5">
          <header className="flex flex-wrap items-end justify-between gap-2">
            <div>
              <h1 className="text-xl font-semibold text-ink">{title}</h1>
              {subtitle && <p className="mt-1 text-xs text-muted">{subtitle}</p>}
            </div>
            <span className="text-xs text-muted">生成于 {dateText}</span>
          </header>
          <p className="rounded-lg bg-accent/10 px-3 py-1.5 text-sm font-medium text-accent-text">
            {ctaLabel}：{displayUrl}
          </p>

          {children}

          <footer className="flex items-center gap-4 rounded-2xl border border-line bg-white p-4">
            {qr ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={qr} alt="扫码打开这份报告" width={96} height={96} className="h-24 w-24 shrink-0" />
            ) : (
              <div className="h-24 w-24 shrink-0 rounded bg-paper" />
            )}
            <div className="min-w-0">
              <div className="text-base font-semibold text-ink">扫码查看完整报告</div>
              <div className="mt-1 text-lg font-semibold tracking-wide text-accent-text">{displayUrl}</div>
              <div className="mt-1 text-xs text-muted">
                {footerNote}
                个税规划器 · 免费 · 数据不上传。仅供测算，不构成税务建议。
              </div>
            </div>
          </footer>
        </div>
      </div>
    </dialog>
  );
}
