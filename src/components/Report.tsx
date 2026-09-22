"use client";

import { useState } from "react";
import { buildShareUrl } from "@/lib/share";
import { MONTH_NAMES, getCity, sadMonthly, type Profile } from "@/lib/tax";
import type { FullResult } from "@/lib/tax";
import { fmtMoney } from "@/lib/format";
import { Segmented } from "./ui";
import { ShareModal } from "./ShareModal";
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
  const [mode, setMode] = useState<"brief" | "full">("brief");
  const shareUrl = buildShareUrl(profile);
  const city = getCity(profile.cityId);
  const segments = profile.segments.filter((s) => s.monthlySalary > 0);
  const showEquity = profile.equity.taxMode !== "unlisted" || result.equity.income > 0;
  const sad = sadMonthly(profile.deductions);
  const today = new Date();
  const dateText = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

  const subtitle = (
    <>
      {city.name} ·{" "}
      {segments
        .map((s) => `${MONTH_NAMES[s.startMonth - 1]}–${MONTH_NAMES[s.endMonth - 1]} ${s.name ? `${s.name} ` : ""}${fmtMoney(s.monthlySalary)}/月${s.bonus ? `，年终奖 ${fmtMoney(s.bonus)}` : ""}`)
        .join("；")}
      {sad > 0 ? ` · 专项附加 ${fmtMoney(sad)}/月` : ""}
    </>
  );

  return (
    <ShareModal
      title={`${profile.year} 年个税测算报告`}
      subtitle={subtitle}
      shareUrl={shareUrl}
      fileName={`个税测算报告-${profile.year}-${dateText}.png`}
      onClose={onClose}
      footerNote={mode === "brief" ? "年终奖、期权规划与减税建议在网页里。" : ""}
      extraControls={
        <Segmented value={mode} onChange={setMode} options={[{ value: "brief", label: "摘要" }, { value: "full", label: "完整" }]} />
      }
    >
      <Section title="全年测算" subtitle={currentMonth > 0 && currentMonth < 12 ? `${currentMonth} 月前按实际，之后为预测。` : undefined}>
        <Summary a={result.annual} />
      </Section>

      <Section title="逐月明细" subtitle="每月到手、扣款，以及预扣税率何时跳档。">
        <MonthlyChart rows={result.rows} currentMonth={currentMonth} staticMode />
      </Section>

      {mode === "full" && (
        <>
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
    </ShareModal>
  );
}
