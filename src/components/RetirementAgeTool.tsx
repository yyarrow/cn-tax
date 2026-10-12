"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import { fmtAgeYM, fmtYearsMonths, flexibleRetirement, minContributionMonths, statutoryRetirement, type PensionCategory } from "@/lib/pension";
import { Card, Field, Hint, MonthSelect, Segmented, Select } from "./ui";

const CATEGORIES: { value: PensionCategory; label: ReactNode }[] = [
  { value: "male", label: "男" },
  { value: "female55", label: <>女 · 原 55 岁<span className="hidden min-[400px]:inline">退休</span></> },
  { value: "female50", label: <>女 · 原 50 岁<span className="hidden min-[400px]:inline">退休</span></> },
];

const BIRTH_YEARS = Array.from({ length: 2010 - 1950 + 1 }, (_, i) => 2010 - i);

function Cell({ label, value, sub }: { label: string; value: ReactNode; sub?: ReactNode }) {
  return (
    <div className="min-w-0 bg-white px-3 py-2.5">
      <div className="text-xs text-muted">{label}</div>
      <div className="mt-1 whitespace-nowrap text-xl font-semibold tabular-nums text-ink @max-[20rem]:text-lg">{value}</div>
      {sub && <div className="mt-0.5 text-xs leading-relaxed text-muted">{sub}</div>}
    </div>
  );
}

/** 延迟退休年龄查询：只依赖出生年月和类别，纯计算，不读写本地存储 */
export function RetirementAgeTool() {
  const [year, setYear] = useState(1985);
  const [month, setMonth] = useState(6);
  const [category, setCategory] = useState<PensionCategory>("male");

  const r = statutoryRetirement(year, month, category);
  const { earliest, latest } = flexibleRetirement(year, month, category);
  const minMonths = minContributionMonths(r.year);
  const ym = (x: { year: number; month: number }) => `${x.year} 年 ${x.month} 月`;

  return (
    <div className="mx-auto max-w-6xl px-4 pt-4 sm:px-6">
      <Card title="查你的退休年龄" subtitle="填出生年月和退休类别，按 2025 年起实施的渐进式延迟退休规则计算">
        <div className="grid gap-4 sm:grid-cols-[auto_auto_1fr] sm:items-end">
          <Field label="出生年">
            <Select value={year} onChange={(e) => setYear(Number(e.target.value))} aria-label="出生年">
              {BIRTH_YEARS.map((y) => (
                <option key={y} value={y}>
                  {y} 年
                </option>
              ))}
            </Select>
          </Field>
          <Field label="出生月">
            <MonthSelect value={month} onChange={setMonth} />
          </Field>
          <Field label="退休类别" hint="女职工按岗位：管理和技术岗一般原 55 岁，生产操作岗一般原 50 岁">
            <Segmented label="退休类别" value={category} options={CATEGORIES} onChange={setCategory} />
          </Field>
        </div>

        <div className="@container mt-5">
          <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-line bg-line sm:grid-cols-3">
            <Cell label="法定退休年月" value={ym(r)} sub={`出生于 ${year} 年 ${month} 月`} />
            <Cell label="法定退休年龄" value={fmtAgeYM(r.ageYears, r.ageMonths)} sub={`原退休年龄 ${r.originalAge} 岁`} />
            <Cell label="比原来延迟" value={r.delayMonths ? `${r.delayMonths} 个月` : "不延迟"} />
            <Cell label="当年最低缴费年限" value={fmtYearsMonths(minMonths)} sub={`按 ${r.year} 年退休`} />
            <Cell label="弹性提前，最早" value={ym(earliest)} sub={`${fmtAgeYM(earliest.ageYears, earliest.ageMonths)}，养老金相应减少`} />
            <Cell label="弹性延迟，最晚" value={ym(latest)} sub={`${fmtAgeYM(latest.ageYears, latest.ageMonths)}，需单位协商一致`} />
          </div>
        </div>

        {r.delayMonths === 0 && <div className="mt-3"><Hint>这个出生年月不受延迟退休影响，仍按原退休年龄 {r.originalAge} 岁。</Hint></div>}

        <div className="mt-5 flex flex-wrap items-center gap-3">
          <Link
            href="/pension"
            className="inline-flex min-h-11 items-center rounded-lg bg-accent-text px-4 text-sm font-medium text-white transition-colors duration-(--dur-fast) hover:bg-[color-mix(in_oklab,var(--accent-text),black_14%)] sm:min-h-9"
          >
            算算到时候每月能领多少
          </Link>
          <span className="text-xs text-muted">按你的缴费记录估算养老金，并对比换个城市领取差多少</span>
        </div>
      </Card>
    </div>
  );
}
