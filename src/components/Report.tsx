"use client";

import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { buildShareUrl } from "@/lib/share";
import { MONTH_NAMES, getCity, sadMonthly, type Profile } from "@/lib/tax";
import type { FullResult } from "@/lib/tax";
import { fmtMoney } from "@/lib/format";
import { Button, Segmented } from "./ui";
import { Summary } from "./Summary";
import { MonthlyChart } from "./MonthlyChart";
import { EquityChart } from "./EquityChart";
import { AdviceList } from "./AdviceList";

function Section({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <section className="report-section rounded-2xl border border-line bg-white p-5">
      <h2 className="text-base font-semibold text-ink">{title}</h2>
      {subtitle && <p className="mt-0.5 text-xs text-muted">{subtitle}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

export function Report({ profile, result, currentMonth, onClose }: { profile: Profile; result: FullResult; currentMonth: number; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState(false);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [mode, setMode] = useState<"brief" | "full">("brief");
  const [qr, setQr] = useState<string>("");
  const [copied, setCopied] = useState(false);
  const shareUrl = buildShareUrl(profile);
  const displayUrl = "tax.warmbeing.com";
  const ua = typeof navigator === "undefined" ? "" : navigator.userAgent;
  const inWeChat = /MicroMessenger/i.test(ua);
  const isMobile = inWeChat || /iPhone|iPad|Android/i.test(ua);
  const city = getCity(profile.cityId);
  const segments = profile.segments.filter((s) => s.monthlySalary > 0);
  const showEquity = profile.equity.taxMode !== "unlisted" || result.equity.income > 0;
  const sad = sadMonthly(profile.deductions);
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

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      window.prompt("复制这个链接：", shareUrl);
    }
  };

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  const exportPng = async () => {
    if (!ref.current || busy) return;
    setBusy(true);
    try {
      // html-to-image 的 toPng 在部分浏览器里 img.decode() 不返回，这里只用它的 toSvg，后面自己画 canvas
      const { toSvg } = await import("html-to-image");
      const svgUrl = await toSvg(ref.current, { skipFonts: true });
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const el = new Image();
        const timer = setTimeout(() => reject(new Error("timeout")), 15000);
        el.onload = () => {
          clearTimeout(timer);
          resolve(el);
        };
        el.onerror = () => {
          clearTimeout(timer);
          reject(new Error("load"));
        };
        el.src = svgUrl;
      });
      const scale = 2;
      const canvas = document.createElement("canvas");
      canvas.width = img.width * scale;
      canvas.height = img.height * scale;
      const ctx = canvas.getContext("2d")!;
      ctx.fillStyle = "#f6f5f2";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.scale(scale, scale);
      ctx.drawImage(img, 0, 0);
      const png = canvas.toDataURL("image/png");
      if (isMobile) {
        // 微信 / 手机浏览器不支持 download，改为展示图片让用户长按保存
        setImageUrl(png);
      } else {
        const a = document.createElement("a");
        a.href = png;
        a.download = `个税测算报告-${profile.year}-${dateText}.png`;
        a.click();
      }
    } catch (err) {
      console.error(err);
      alert("导出图片失败，请改用「保存 PDF」");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="report-modal fixed inset-0 z-50 overflow-y-auto bg-ink/60 backdrop-blur-sm" onClick={onClose}>
      <div className="mx-auto my-6 w-full max-w-3xl px-4" onClick={(e) => e.stopPropagation()}>
        <div className="report-toolbar mb-3 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-white/95 px-4 py-2.5 shadow-md">
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-ink">报告预览</span>
            <Segmented value={mode} onChange={setMode} options={[{ value: "brief", label: "摘要" }, { value: "full", label: "完整" }]} />
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={copyLink}>
              {copied ? "已复制" : "复制链接"}
            </Button>
            {!inWeChat && (
              <Button variant="secondary" onClick={() => window.print()}>
                保存 PDF
              </Button>
            )}
            <Button variant="primary" onClick={exportPng}>
              {busy ? "导出中…" : "导出图片"}
            </Button>
            <Button variant="ghost" onClick={onClose}>
              关闭
            </Button>
          </div>
        </div>

        {inWeChat && <p className="mb-3 rounded-lg bg-white/90 px-3 py-2 text-xs text-muted">微信里点「导出图片」后长按图片即可保存；要 PDF 请点右上角「在浏览器打开」。</p>}

        {imageUrl && (
          <div className="fixed inset-0 z-[60] flex flex-col items-center justify-center bg-ink/80 p-4" onClick={() => setImageUrl(null)}>
            <p className="mb-3 text-sm font-medium text-white">长按图片保存到相册</p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={imageUrl} alt="个税测算报告" className="max-h-[80vh] w-auto max-w-full rounded-lg shadow-lg" onClick={(e) => e.stopPropagation()} />
            <button type="button" className="mt-3 rounded-lg bg-white/90 px-4 py-1.5 text-sm text-ink" onClick={() => setImageUrl(null)}>
              关闭
            </button>
          </div>
        )}

        <div ref={ref} className="report-root space-y-4 rounded-2xl bg-paper p-5">
          <header className="flex flex-wrap items-end justify-between gap-2">
            <div>
              <h1 className="text-xl font-semibold text-ink">{profile.year} 年个税测算报告</h1>
              <p className="mt-1 text-xs text-muted">
                {city.name} ·{" "}
                {segments
                  .map((s) => `${MONTH_NAMES[s.startMonth - 1]}–${MONTH_NAMES[s.endMonth - 1]} ${s.name ? `${s.name} ` : ""}${fmtMoney(s.monthlySalary)}/月${s.bonus ? `，年终奖 ${fmtMoney(s.bonus)}` : ""}`)
                  .join("；")}
                {sad > 0 ? ` · 专项附加 ${fmtMoney(sad)}/月` : ""}
              </p>
            </div>
            <span className="text-[11px] text-muted">生成于 {dateText}</span>
          </header>
          <p className="rounded-lg bg-accent/10 px-3 py-1.5 text-sm font-medium text-accent">→ 查看完整报告、改成你自己的：{displayUrl}</p>

          <Section title="全年测算" subtitle={currentMonth > 0 && currentMonth < 12 ? `${currentMonth} 月前按实际，之后为预测。` : undefined}>
            <Summary a={result.annual} />
          </Section>

          {mode === "full" && (
            <>
              <Section title="逐月明细" subtitle="每月到手、扣款，以及预扣税率何时跳档。">
                <MonthlyChart rows={result.rows} currentMonth={currentMonth} staticMode />
              </Section>

              {showEquity && (
                <Section title="期权 / RSU 兑现规划" subtitle="今年再兑现不同金额各要交多少税，橙点为跳档拐点。">
                  <EquityChart e={result.equity} plan={profile.equity} onChange={() => {}} staticMode />
                </Section>
              )}

              <Section title="减税建议" subtitle="按预计节省排序，均为合规操作。">
                <AdviceList items={result.advice} />
              </Section>
            </>
          )}

          <footer className="flex items-center gap-4 rounded-2xl border border-line bg-white p-4">
            {qr ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={qr} alt="扫码打开这份报告" width={96} height={96} className="h-24 w-24 shrink-0" />
            ) : (
              <div className="h-24 w-24 shrink-0 rounded bg-paper" />
            )}
            <div className="min-w-0">
              <div className="text-base font-semibold text-ink">扫码打开这份报告，改成你自己的</div>
              <div className="mt-1 text-lg font-semibold tracking-wide text-accent">{displayUrl}</div>
              <div className="mt-1 text-[11px] text-muted">
                {mode === "brief" ? "逐月明细、年终奖与期权规划、减税建议在网页里。" : ""}
                个税规划器 · 免费 · 数据不上传。仅供测算，不构成税务建议。
              </div>
            </div>
          </footer>
        </div>
      </div>
    </div>
  );
}
