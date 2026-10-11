import Link from "next/link";
import {
  RETIREMENT_TABLE_YEARS,
  fmtAgeYM,
  fmtYearsMonths,
  flexibleRetirement,
  minContributionMonths,
  retirementTable,
  statutoryRetirement,
  type PensionCategory,
} from "@/lib/pension";

const TABLES: { category: PensionCategory; title: string; rule: string }[] = [
  { category: "male", title: "男职工（原 60 岁退休）", rule: "每 4 个月延迟 1 个月，最终 63 岁" },
  { category: "female55", title: "女职工（原 55 岁退休）", rule: "每 4 个月延迟 1 个月，最终 58 岁" },
  { category: "female50", title: "女职工（原 50 岁退休）", rule: "每 2 个月延迟 1 个月，最终 55 岁" },
];

/** 最低缴费年限对照表覆盖的退休年份 */
const MIN_YEARS = Array.from({ length: 2039 - 2029 + 1 }, (_, i) => 2029 + i);

/** "62 岁 7 个月（2037 年 8 月）" */
const at = (y: number, m: number, c: PensionCategory) => {
  const r = statutoryRetirement(y, m, c);
  return `${fmtAgeYM(r.ageYears, r.ageMonths)}（${r.year} 年 ${r.month} 月）`;
};
/** 1 月 / 12 月出生的两端 */
const when = (y: number, m: number, c: PensionCategory) => {
  const r = statutoryRetirement(y, m, c);
  return `${fmtAgeYM(r.ageYears, r.ageMonths)}退休（${r.year} 年 ${r.month} 月）`;
};
const range = (y: number, c: PensionCategory) => `${y} 年 1 月出生的，${when(y, 1, c)}；12 月出生的，${when(y, 12, c)}`;

const male1990 = statutoryRetirement(1990, 6, "male");
const m1980 = statutoryRetirement(1980, 1, "male");
const m1985 = statutoryRetirement(1985, 6, "male");
const flex1985 = flexibleRetirement(1985, 6, "male");
const flex1975 = flexibleRetirement(1975, 1, "male");
const s1975 = statutoryRetirement(1975, 1, "male");
const flexF55 = flexibleRetirement(1985, 6, "female55");
const sF55 = statutoryRetirement(1985, 6, "female55");
const sF50 = statutoryRetirement(1985, 6, "female50");

export const faq: { q: string; a: string }[] = [
  {
    q: "延迟退休后我几岁退休？怎么查？",
    a: `按出生年月和退休类别查。2025 年 1 月 1 日起，男职工原 60 岁，每 4 个月延迟 1 个月，最终 63 岁；女职工原 55 岁，每 4 个月延迟 1 个月，最终 58 岁；女职工原 50 岁，每 2 个月延迟 1 个月，最终 55 岁。上面的计算器填出生年月就能看到具体的退休年月，下面的对照表也列了每个出生年的结果。例如 1985 年 6 月出生：男职工 ${at(1985, 6, "male")}，女职工原 55 岁的 ${at(1985, 6, "female55")}，原 50 岁的 ${at(1985, 6, "female50")}。`,
  },
  {
    q: "1970 年出生的男性几岁退休？",
    a: `${range(1970, "male")}。1970 年出生的男职工，延迟的月数在 ${statutoryRetirement(1970, 1, "male").delayMonths} 到 ${statutoryRetirement(1970, 12, "male").delayMonths} 个月之间，具体看出生在哪个月，其余月份介于两者之间。`,
  },
  {
    q: "1975 年出生的女性几岁退休？",
    a: `要先分原退休年龄。原 55 岁退休的（管理和技术岗为主）：${range(1975, "female55")}。原 50 岁退休的（生产操作岗为主）：${range(1975, "female50")}。女职工原 55 还是原 50，按所在岗位和单位认定，不是自己选的。`,
  },
  {
    q: "1980 年出生几岁退休？",
    a: `1980 年出生的男职工已经满额延迟，统一 ${fmtAgeYM(m1980.ageYears, m1980.ageMonths)}退休：${range(1980, "male")}。女职工原 55 岁的，${range(1980, "female55")}；原 50 岁的，${range(1980, "female50")}。`,
  },
  {
    q: "1990 年后出生的人几岁退休？",
    a: `已经全部满额延迟：男职工 63 岁，女职工原 55 岁的 58 岁，原 50 岁的 55 岁，与出生月份无关。例如 1990 年 6 月出生的男职工，${fmtAgeYM(male1990.ageYears, male1990.ageMonths)}退休，${male1990.year} 年 ${male1990.month} 月。具体到时候的政策如有新调整，以官方为准。`,
  },
  {
    q: "弹性提前退休最多提前几年？",
    a: `最多提前 3 年，且不能早于原法定退休年龄，并且累计缴费要达到最低缴费年限。最早年龄 = max(原退休年龄，法定退休年龄 − 3 年)。例如 1985 年 6 月出生的男职工，法定 ${fmtAgeYM(m1985.ageYears, m1985.ageMonths)}，最早可以 ${fmtAgeYM(flex1985.earliest.ageYears, flex1985.earliest.ageMonths)}（${flex1985.earliest.year} 年 ${flex1985.earliest.month} 月）退休，提前了 3 年；而 1975 年 1 月出生的男职工，法定 ${fmtAgeYM(s1975.ageYears, s1975.ageMonths)}，但原退休年龄是 60 岁，最早也只能 ${fmtAgeYM(flex1975.earliest.ageYears, flex1975.earliest.ageMonths)}（${flex1975.earliest.year} 年 ${flex1975.earliest.month} 月）退休，最多提前 ${fmtYearsMonths(s1975.ageYears * 12 + s1975.ageMonths - 60 * 12)}。女职工原 55 岁的，1985 年 6 月出生法定 ${fmtAgeYM(sF55.ageYears, sF55.ageMonths)}，最早 ${fmtAgeYM(flexF55.earliest.ageYears, flexF55.earliest.ageMonths)}。提前退休养老金会相应减少。`,
  },
  {
    q: "延迟退休后最低缴费年限是多少？",
    a: `2029 年及以前退休是 15 年；自 2030 年 1 月 1 日起每年提高 6 个月，2030 年退休要 ${fmtYearsMonths(minContributionMonths(2030))}，2035 年 ${fmtYearsMonths(minContributionMonths(2035))}，2039 年起提高到 20 年。按退休年份看，不是按出生年份：例如 1985 年 6 月出生的男职工 ${m1985.year} 年退休，要求 ${fmtYearsMonths(minContributionMonths(m1985.year))}；1975 年 1 月出生的男职工 ${s1975.year} 年退休，要求 ${fmtYearsMonths(minContributionMonths(s1975.year))}。`,
  },
  {
    q: "女职工原 50 岁还是 55 岁，怎么判断？",
    a: `按岗位，不按个人意愿：一般管理和技术岗位的女职工原退休年龄是 55 岁，生产操作岗位（一线工人等）是 50 岁，以劳动合同、档案中的岗位认定和当地社保经办机构为准。同样 1985 年 6 月出生，原 55 岁的 ${fmtAgeYM(sF55.ageYears, sF55.ageMonths)}退休，原 50 岁的 ${fmtAgeYM(sF50.ageYears, sF50.ageMonths)}退休，差了 3 年。`,
  },
];

function RetirementTables() {
  return (
    <>
      {TABLES.map(({ category, title, rule }) => {
        const rows = retirementTable(category);
        const [from, to] = RETIREMENT_TABLE_YEARS[category];
        const orig = statutoryRetirement(from - 1, 12, category);
        const last = statutoryRetirement(to, 1, category);
        return (
          <section key={category}>
            <h3>{`${title}：${from}–${to} 年出生`}</h3>
            <p>{`${rule}。${from - 1} 年及以前出生的不延迟，仍按 ${orig.originalAge} 岁退休；${to} 年及以后出生的统一按 ${fmtAgeYM(last.ageYears, last.ageMonths)}退休。`}</p>
            <div className="overflow-x-auto">
              <table className="min-w-[34rem]">
                <thead>
                  <tr>
                    <th>出生年</th>
                    <th>1 月出生：退休年龄</th>
                    <th>退休年月</th>
                    <th>12 月出生：退休年龄</th>
                    <th>退休年月</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.birthYear}>
                      <td>{`${r.birthYear} 年`}</td>
                      <td>{fmtAgeYM(r.jan.ageYears, r.jan.ageMonths)}</td>
                      <td>{`${r.jan.year} 年 ${r.jan.month} 月`}</td>
                      <td>{fmtAgeYM(r.dec.ageYears, r.dec.ageMonths)}</td>
                      <td>{`${r.dec.year} 年 ${r.dec.month} 月`}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        );
      })}
    </>
  );
}

export function RetirementAgeArticle() {
  return (
    <>
      <p>
        延迟退休后到底几岁退休？答案取决于<strong>出生年月</strong>和<strong>原退休年龄</strong>（男 60 岁、女 55 岁或女 50 岁）：2025 年起法定退休年龄逐月渐进式延迟，1965 年出生的男职工只延迟 1 到 3 个月，1976 年 9 月及以后出生的男职工、1981 年 9 月及以后出生的原 55 岁女职工、1984 年 11 月及以后出生的原 50 岁女职工，都已经延迟到位。上面的计算器填出生年月即可查到；下面是完整对照表和规则说明。
      </p>

      <h2>延迟退休年龄对照表</h2>
      <p>每个出生年列出 1 月和 12 月出生的结果，其余月份介于两者之间。退休年月是达到法定退休年龄的那个月。</p>
      <RetirementTables />

      <h2>延迟退休是怎么规定的</h2>
      <p>
        2024 年 9 月，全国人大常委会通过《关于实施渐进式延迟法定退休年龄的决定》，自 <strong>2025 年 1 月 1 日</strong>起施行，用 15 年左右的时间逐步到位：
      </p>
      <table>
        <thead>
          <tr><th>类别</th><th>原退休年龄</th><th>延迟节奏</th><th>最终</th></tr>
        </thead>
        <tbody>
          <tr><td>男职工</td><td>60 岁</td><td>每 4 个月延迟 1 个月</td><td>63 岁</td></tr>
          <tr><td>女职工（原 55 岁）</td><td>55 岁</td><td>每 4 个月延迟 1 个月</td><td>58 岁</td></tr>
          <tr><td>女职工（原 50 岁）</td><td>50 岁</td><td>每 2 个月延迟 1 个月</td><td>55 岁</td></tr>
        </tbody>
      </table>
      <p>特殊工种、因病完全丧失劳动能力等提前退休的情形，仍按国家有关规定办理，不在上面的对照表范围内。</p>

      <h2>怎么用出生年月算自己的退休年龄</h2>
      <p>
        男职工以 1965 年 1 月为起点：1965 年 1–4 月出生的延迟 1 个月，5–8 月出生的延迟 2 个月，之后每 4 个月出生的人多延迟 1 个月，延迟满 36 个月（1976 年 9 月出生）封顶。女职工原 55 岁以 1970 年 1 月为起点，节奏同男职工，延迟满 36 个月（1981 年 9 月出生）封顶。女职工原 50 岁以 1975 年 1 月为起点，1–2 月出生的延迟 1 个月，3–4 月出生的延迟 2 个月，每 2 个月多延迟 1 个月，延迟满 60 个月（1984 年 11 月出生）封顶。
      </p>
      <p>
        拿到延迟月数后，退休年龄 = 原退休年龄 + 延迟月数，退休年月 = 出生年月 + 退休年龄。例如男职工 1975 年 1 月出生：{(() => {
          const r = statutoryRetirement(1975, 1, "male");
          return `延迟 ${r.delayMonths} 个月，${fmtAgeYM(r.ageYears, r.ageMonths)}退休，${r.year} 年 ${r.month} 月。`;
        })()}
      </p>

      <h2>弹性提前退休和弹性延迟退休</h2>
      <ul>
        <li>
          <strong>弹性提前</strong>：本人自愿，累计缴费年限达到最低缴费年限，可以在法定退休年龄前最多 3 年退休，但不能早于原法定退休年龄。最早年龄 = max(原退休年龄，法定退休年龄 − 3 年)。提前退休养老金相应减少，具体办法以各地为准。
        </li>
        <li>
          <strong>弹性延迟</strong>：本人自愿，并且所在单位协商一致，可以在法定退休年龄后最多再延 3 年，多缴多领。
        </li>
      </ul>
      <p>上面的计算器会同时给出这两个端点的年月。</p>

      <h2>最低缴费年限：从 2030 年起逐步提高到 20 年</h2>
      <p>
        领取按月发放的基本养老金需要累计缴费满最低年限。目前是 15 年；自 2030 年 1 月 1 日起每年提高 6 个月，逐步提高到 20 年。按<strong>退休年份</strong>对照：
      </p>
      <div className="overflow-x-auto">
        <table>
          <thead>
            <tr><th>退休年份</th><th>最低缴费年限</th></tr>
          </thead>
          <tbody>
            {MIN_YEARS.map((y) => (
              <tr key={y}>
                <td>{y === 2029 ? "2029 年及以前" : y === 2039 ? "2039 年起" : `${y} 年`}</td>
                <td>{fmtYearsMonths(minContributionMonths(y))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p>缴费年限不够，可以延长缴费至满，部分地区允许补缴，也可以转入城乡居民基本养老保险，具体办法各地不同。</p>

      <h2>女职工原 50 岁还是 55 岁</h2>
      <p>
        按岗位划分：管理和技术岗位的女职工一般原 55 岁退休，生产操作岗位（一线工人等）一般原 50 岁退休，具体认定以单位档案和当地社保经办机构为准。两类的延迟节奏不同：同样 1985 年 6 月出生，原 55 岁的{fmtAgeYM(sF55.ageYears, sF55.ageMonths)}退休，原 50 岁的{fmtAgeYM(sF50.ageYears, sF50.ageMonths)}退休。
      </p>

      <h2>知道了几岁退休，下一步算养老金</h2>
      <p>
        退休年龄也会影响个人账户养老金（计发月数随退休年龄变化）和最低缴费年限。想知道到时候每月能领多少、换个城市领取差多少，可以用<Link href="/pension">养老金计算器</Link>，它会按你的出生年月、缴费情况和打算领取的城市估算。
      </p>

      <h2>常见问题</h2>
      {faq.map((f) => (
        <div key={f.q}>
          <h3>{f.q}</h3>
          <p>{f.a}</p>
        </div>
      ))}
    </>
  );
}
