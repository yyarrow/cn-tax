import type { ScenarioPoint } from "@/lib/pension";
import { fmtMoney } from "@/lib/format";

/** 回本年数：续交总自付 ÷ 每年多领的钱；不续交也能按月领的，只算多出来的那部分 */
export function flexPaybackYears(p: ScenarioPoint): number | undefined {
  if (!p.flexCost || !p.withoutFlex || !p.meetsMinimum) return undefined;
  const gain = p.total - (p.withoutFlex.meetsMinimum ? p.withoutFlex.total : 0);
  if (gain <= 0) return undefined;
  return Math.round((p.flexCost.total / (gain * 12)) * 10) / 10;
}

function Reminder({ title, children }: { title: string; children: string }) {
  return (
    <li className="border-l-2 border-warn bg-warn/10 py-1.5 pl-3 pr-2 text-xs leading-relaxed text-ink">
      <b className="font-semibold">{title}</b>
      {children}
    </li>
  );
}

/** 开了「按灵活就业续交」时，某个停缴点的花费小结 + 两条提醒（金额口径：退休时每月实发，名义） */
export function FlexSummary({ point, cityName }: { point: ScenarioPoint; cityName: string }) {
  const fc = point.flexCost;
  if (!fc || point.stopAge === undefined) return null;
  const wo = point.withoutFlex;
  const years = flexPaybackYears(point);
  return (
    <div className="mt-3 space-y-2 rounded-xl border border-line bg-paper/70 p-3">
      <p className="text-sm leading-relaxed text-ink">
        <b className="font-semibold tabular-nums">{point.stopAge} 岁</b>停缴后，按灵活就业每月自付约 <b className="font-semibold tabular-nums">{fmtMoney(fc.monthlyNow)}</b>（{cityName}停缴当年标准估算，以后随社平上调），到退休共交约{" "}
        <b className="font-semibold tabular-nums">{fmtMoney(fc.total)}</b>，其中 <span className="tabular-nums">{fmtMoney(fc.toAccount)}</span> 记入你的个人账户。
        {point.meetsMinimum ? (
          <>
            退休时每月约 <b className="font-semibold tabular-nums">{fmtMoney(point.total)}</b>，
            {wo?.meetsMinimum ? (
              <>
                比不续交多 <b className="font-semibold tabular-nums">{fmtMoney(point.total - wo.total)}</b>
              </>
            ) : (
              "从按月领不了变成可以按月领"
            )}
            {years !== undefined && `，约 ${years.toFixed(1)} 年领回全部自付`}。
          </>
        ) : (
          <>即使续交，缴费年限仍不够最低要求，还是按月领不了。</>
        )}
      </p>
      <ul className="space-y-1.5">
        <Reminder title="医保要单独交：">灵活就业医保是另一笔钱，很多城市要求医保累计交满一定年限（如男 25 年、女 20 年，各地不同）退休后才能免缴。</Reminder>
        <Reminder title="在哪交、怎么交：">多数城市已放开户籍限制，可在户籍地或就业 / 居住地以灵活就业身份参保，一般通过当地税务 App、支付宝或银行缴费，以当地社保部门规定为准。</Reminder>
      </ul>
    </div>
  );
}
