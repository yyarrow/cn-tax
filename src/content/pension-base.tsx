import Link from "next/link";
import { PENSION_REGIONS, type PensionRegion } from "@/lib/pension";

const fmt = (n: number) => n.toLocaleString("zh-CN", { maximumFractionDigits: 2 });

/** 按计发基数从高到低 */
export const REGIONS_DESC: PensionRegion[] = [...PENSION_REGIONS].sort((a, b) => b.base.value - a.base.value);

const top = REGIONS_DESC[0];
const bottom = REGIONS_DESC[REGIONS_DESC.length - 1];

/** 同样缴 30 年、平均缴费指数 1.0，基础养老金 = 基数 × (1 + 1) ÷ 2 × 30 × 1% = 基数 × 0.3 */
const basic30 = (base: number) => (base * (1 + 1)) / 2 * 30 * 0.01;
export const GAP_30Y = Math.round(basic30(top.base.value) - basic30(bottom.base.value));

const byId = (id: string) => PENSION_REGIONS.find((r) => r.id === id);
const line = (id: string) => {
  const r = byId(id);
  return r ? `${r.name} ${fmt(r.base.value)} 元/月（${r.base.year} 年度）` : "";
};

export const faq: { q: string; a: string }[] = [
  {
    q: "养老金计发基数是什么？",
    a: "计发基数是计算基础养老金的一个基准数，大致相当于当地上年度的社会平均工资（各地口径略有不同）。基础养老金 = 退休地计发基数 ×（1 + 本人平均缴费指数）÷ 2 × 缴费年限 × 1%，计发基数越高，同样的缴费记录领得越多。",
  },
  {
    q: "北京、上海、广东的养老金计发基数是多少？",
    a: `本页数据：${line("beijing")}，${line("shanghai")}，${line("guangdong")}，${line("shenzhen")}。广东省内深圳单独公布，其他地区按省里的标准。各地数据来自人社部门公布，部分为媒体汇总，最新以当地官方公布为准。`,
  },
  {
    q: "各省养老金计发基数哪里最高、哪里最低？",
    a: `本页数据里最高的是${top.name}（${fmt(top.base.value)} 元/月，${top.base.year} 年度），最低的是${bottom.name}（${fmt(bottom.base.value)} 元/月，${bottom.base.year} 年度）。同样缴 30 年、平均缴费指数 1.0，基础养老金每月相差约 ${fmt(GAP_30Y)} 元。注意各地公布年度不同，年度不同的地区之间不完全可比。`,
  },
  {
    q: "在 A 城市缴费、回 B 城市退休，用哪里的计发基数？",
    a: "按国办发〔2009〕66 号第七条，用你各年度的缴费工资、缴费年限和待遇领取地对应年度的平均工资来算：基础养老金里的计发基数取领取地（B 城市）的；你在 A 城市的缴费工资也要按 B 城市的平均工资重新折算指数。领取地不能随意挑，由户籍地和各地缴费年限决定；具体折算以 B 城市社保经办核定为准。用养老金计算器可以把同一份缴费记录放到各个地区去算。",
  },
  {
    q: "养老金计发基数每年什么时候公布？",
    a: "一般每年年中公布，并追溯到当年 1 月 1 日起执行。具体公布时间各地不同，以当地人社部门为准。",
  },
  {
    q: "计发基数涨了，已经退休的人养老金会跟着涨吗？",
    a: "不会直接涨。计发基数只用于新退休人员核定待遇。已退休人员的养老金每年按国家统一部署另行调整，调整幅度与计发基数是两套规则。",
  },
];

export function PensionBaseTable() {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-[28rem]">
        <thead>
          <tr>
            <th>地区</th>
            <th>计发基数（元/月）</th>
            <th>适用年度</th>
            <th>备注</th>
          </tr>
        </thead>
        <tbody>
          {REGIONS_DESC.map((r) => (
            <tr key={r.id}>
              <td>{r.name}</td>
              <td>{fmt(r.base.value)}</td>
              <td>{`${r.base.year} 年`}</td>
              <td>{r.note ?? ""}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function PensionBaseArticle() {
  return (
    <>
      <p>
        养老金计发基数是计算基础养老金的基准数，各地不同，每年调整。下表是各省（含单独公布的城市）最新的计发基数，按数值从高到低排列。同样缴 30 年、平均缴费指数 1.0，{`在最高的${top.name}和最低的${bottom.name}，每月基础养老金相差约 ${fmt(GAP_30Y)} 元。`}
      </p>

      <PensionBaseTable />
      <p className="text-xs text-muted">
        数据来自各省人社部门公布，部分为媒体汇总，最新以当地官方公布为准；计发基数一般每年年中公布并追溯到 1 月。各地公布年度不同，年度不同的地区之间不完全可比。
      </p>

      <h2>计发基数是什么，怎么影响基础养老金</h2>
      <p>
        企业职工的基础养老金 = 退休地计发基数 ×（1 + 本人平均缴费指数）÷ 2 × 缴费年限 × 1%。计发基数大致是当地上年度的社会平均工资（各地口径略有不同）；平均缴费指数是你各年缴费基数与当年当地社平工资之比的平均，指数 1 就是一直按社平缴。
      </p>
      <p>
        举例：计发基数 10,000 元，平均缴费指数 1.0，缴费 30 年，基础养老金 = 10,000 × (1 + 1.0) ÷ 2 × 30 × 1% = 3,000 元。同样的缴费记录放到计发基数 7,000 元的地方，就是 2,100 元，每月少 900 元。个人账户养老金只看账户余额，在哪领都一样，所以地区差异主要来自基础养老金这一块。
      </p>

      <h2>为什么各省不一样</h2>
      <p>
        计发基数跟着当地的平均工资走：经济发达、平均工资高的地方基数高，{`本页数据里${top.name}最高，${bottom.name}最低。`}基数每年随当地平均工资调整，增长快的地方，和别处的差距还会继续拉大。
      </p>

      <h2>跨省退休，按哪里的计发基数</h2>
      <p>
        按国办发〔2009〕66 号第七条，用你各年度的缴费工资、缴费年限和待遇领取地对应年度的平均工资来算：基础养老金里的计发基数取<strong>领取地</strong>的；你在别处的缴费工资也要按领取地的平均工资重新折算指数。同样的工资，放到平均工资低的地方，折出的指数更高，一般封顶 3；放到平均工资高的地方，指数会被摊薄。
      </p>
      <p>
        领取地不能随意挑：养老保险关系在户籍所在地的，在户籍地领取；不在户籍地、但在最后参保地累计缴费满 10 年的，在最后参保地领取；不在户籍地、最后参保地不满 10 年的，转回上一个缴费满 10 年的参保地领取；在各地累计缴费都不满 10 年的，转回户籍地领取。具体以当地社保经办机构为准。
      </p>
      <p>
        想知道你的缴费记录放到各地会是多少，可以用<Link href="/pension">养老金计算器</Link>：把你的缴费记录放到各地去算，并列出每个地区每月能领多少。退休年龄见<Link href="/retirement-age">延迟退休年龄计算器</Link>。
      </p>

      <h2>计发基数什么时候公布</h2>
      <p>
        一般每年年中公布，并追溯到当年 1 月 1 日起执行。各地公布时间不同，表中「适用年度」是各地最新一期数据对应的年度，所以年度不尽相同。
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
