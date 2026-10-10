# 全国城市 + 养老金预估：方案与分工

## 一、全国城市

### 数据模型（`src/lib/tax/constants.ts` 的 `CityPreset` 扩展）
```ts
export interface CityPreset {
  id: string;            // 拼音 slug；beijing/shanghai/shenzhen/guangzhou/hangzhou/chengdu/other 保持不变（localStorage、分享链接里存的是 id）
  name: string;          // 常用简称："杭州"、"延边"
  province: string;      // "浙江"；直辖市为自身
  provinceId: string;    // "zhejiang"
  pinyin: string;        // "hangzhou"（搜索用）
  initials: string;      // "hz"（搜索用）
  socialMin: number; socialMax: number;   // 养老保险个人缴费基数上下限（元/月）
  housingMin: number; housingMax: number; // 公积金缴存基数上下限
  pensionRate: number; medicalRate: number; medicalFixed: number; unemploymentRate: number;
  housingRateDefault: number;
  rentTier: 1 | 2 | 3;
  /** 数据口径：city=该市公布值；province=沿用全省统一口径；estimated=按最低工资/省均推算 */
  quality: "city" | "province" | "estimated";
  /** 数据年度（如 2026 = 2026-07 起执行的年度） */
  year: number;
  note?: string;
}
```
- 城市清单：全部地级行政区 + 直辖市 + 省直辖县级单位，约 370 条。数据由 `scripts/gen-cities.mjs` 从 `data/cities/*.json`（调研原始数据，带来源 URL）生成 `src/lib/tax/cities.ts`（生成文件，提交进仓库）。每年 7 月更新时改 JSON 重新生成。
- 合并规则：社保 = 城市例外值 ?? 全省统一值；公积金 = 城市公布值 ?? （下限=所属档最低工资，上限=社保上限 × 公积金/社保上限比的全国中位数，标 estimated）；比例默认 = 城市值 ?? 0.12（省会/直辖/计划单列）或 0.10（其他）。
- 保留 `other`（"其他城市（通用参考）"），旧数据里存的 `other` 不失效；`getCity` 找不到 id 时仍回退到它。
- 换城市时首页 profile 的 `deductions.rentTier` 跟着设成该城市的档位（之前城市的 rentTier 字段没被用上）。

### 选择器 `CityPicker`（替换 5 个页面里的 `<Select>`）
- 可搜索的 combobox：输入框（显示当前城市名）+ 下拉列表；支持汉字、全拼、首字母搜索；空搜索时先列热门（北上广深杭成 + 其余省会/计划单列市），再按省份分组列全部。
- 键盘：↑↓ 移动、Enter 选中、Esc 关闭；ARIA combobox 模式（role=combobox / listbox / option，aria-activedescendant）。
- 手机：下拉在输入框下方，max-h 约 60vh 可滚动；点外部关闭；输入框 `text-base` 防 iOS 缩放（沿用 `inputCls`）。
- 选中项下方小字（可选）：`quality !== "city"` 时提示「按全省统一口径」或「估算值，可在高级设置中调整」。
- 页面里提到"支持北京、上海、深圳、广州、杭州、成都"的 SEO 文案改为"支持全国 300 多个城市"。

## 二、养老金预估页 `/pension`

### 输入
1. **你**：出生年月；类别 = 男职工 / 女职工（原 55 岁退休，管理技术岗）/ 女职工（原 50 岁退休）。
2. **现在怎么缴**：参保城市（CityPicker）+ 三种方式确定当前月缴费基数：
   - `gross` 按税前工资：基数 = clamp(税前, socialMin, socialMax)（低于下限按下限——养老保险不允许低于下限缴）；
   - `net` 税前 + 到手反推：复用 `inferMonthlyDeduction` 求出五险一金个人合计 D，再按 `D = B×(养老+医疗+失业) + 医疗固定额 + B×公积金比例` 解出 B（公积金比例默认城市值，可改，可填 0 表示没交公积金）。用来识别"公司按最低基数缴"的情况；
   - `pension` 工资条上的养老保险个人扣款 X：B = X ÷ 8%。
   - 显示：当前缴费基数、当前缴费指数 = B ÷ 当地社平（社平 ≈ socialMax ÷ 3），夹在 0.6–3。
3. **已经缴了多少（查电子社保卡 / 掌上 12333 的个人权益记录）**：个人账户累计储存额、累计缴费月数、过去平均缴费指数（查不到就默认等于现在的指数，可改）、视同缴费年限（高级，默认 0）。
4. **假设（默认折叠）**：继续缴到多少岁（默认到退休）、社平工资年增长（默认 = 该省计发基数近 5 年复合增速，取不到用 4%）、本人工资增长（默认 = 社平增长，即指数不变）、个人账户记账利率（默认 3%）、通胀（默认 2.5%，用于"折合今天的钱"）、过渡系数（默认 1.2%，只在视同缴费年限 > 0 时用）。

### 计算口径（`src/lib/pension/` 纯函数 + `tests/pension.test.ts`）
- **法定退休年龄**（2025-01-01 起渐进式延迟）：设 n = 出生月相对起点的月数（0 起）。
  - 男：起点 1965-01，延迟 = n<0 ? 0 : min(36, floor(n/4)+1)，原 60 岁；
  - 女（原 55）：起点 1970-01，延迟 = min(36, floor(n/4)+1)；
  - 女（原 50）：起点 1975-01，延迟 = min(60, floor(n/2)+1)。
  - 退休年月 = 出生年月 + 原年龄 + 延迟月数。以调研结果（`data/pension/notes.md`）核对边界。
- **最低缴费年限**：退休年份 < 2030 为 15 年；自 2030 年起每年 +6 个月，到 20 年封顶。不足时提示需要延长缴费到多少月。
- **缴费月数** = 已缴月数 + 从下个月到 min(停缴年龄, 退休) 的月数；缴费年限 = 月数 ÷ 12（+ 视同缴费年限）。
- **平均缴费指数** = (过去指数 × 已缴月数 + 未来各月指数之和) ÷ 实际缴费总月数；未来各月指数 = 当月基数 ÷ 当月当地社平（两者按各自增长率走，基数夹在当年上下限内）。
- **退休时计发基数** = 待遇领取省（市）最新计发基数 × (1+社平增长)^(退休年份 − 该值年度)。
- **基础养老金** = 计发基数 × (1 + 平均指数) ÷ 2 × 缴费年限 × 1%。
- **个人账户** = 存量余额按记账利率按月复利滚到退休 + 未来每月 基数×8% 同样滚存；个人账户养老金 = 余额 ÷ 计发月数（按退休年龄查表，非整岁线性插值，以调研为准）。
- **过渡性养老金** = 计发基数 × 平均指数 × 视同缴费年限 × 过渡系数。
- **输出**：退休时每月养老金（名义）+ 折合今天的钱 + 三项拆分 + 替代率（养老金 ÷ 退休前一月税前工资）+ 最低年限检查。
- **不同地方退休对比**（这是这页的重点）：缴费历史不变，只换"待遇领取地"，对 31 个省（及计发基数单独公布的城市）各算一遍基础养老金 + 个人账户（个人账户与地点无关），排序成表，标出当前参保地。旁边讲清楚：
  1. 为什么不一样：基础养老金用**领取地**的计发基数，而缴费指数是**相对缴费地**社平算的，指数跟着人走——在高工资城市按高基数缴，回低计发基数的地方领，基础养老金会按低基数打折；反过来亦然。
  2. 领取地不能随便挑：国办发〔2009〕66 号的判定规则（户籍地 / 最后参保地满 10 年 / 回溯上一个满 10 年的参保地 / 都不满回户籍地），以调研结果为准。

### 页面与存储
- 路由 `/pension`，结构同 `/social-insurance`：`page.tsx`（Hero + `PensionClient` + `Article`）、`src/content/pension.tsx`（文章 + faq）、`src/lib/pensionStore.ts`（localStorage `cn-tax-pension-v1`，分享 hash `#p=`）、`src/components/PensionTool.tsx`、`PensionClient.tsx`（`useHydrated` 门控）。
- 默认值沿用首页第一段：城市、税前月薪；出生年月默认 1990-06、男。
- 加进 `seo.tsx` 的 `SITE_NAV`、`RELATED`、`sitemap.ts`。

## 三、分工
| 子任务 | 执行 | 依赖 |
|---|---|---|
| R1–R4 调研：城市清单 / 社保基数 / 公积金基数+最低工资 / 养老金规则+各省计发基数 | sonnet ×4 并行 | — |
| C1 `CityPicker` + `CityPreset` 扩展 + 替换 5 处 + rentTier 联动 | sonnet | — |
| C2 养老金引擎 + 单测 | sonnet | 本文档 |
| D1 `gen-cities.mjs` + 生成 `cities.ts` + 养老金参数文件 | 主 chat 定合并规则，sonnet 写 | R1–R4、C1 |
| C3 `/pension` 页面 + 文案 + 导航 | sonnet | C2 |
| 联调、CR、移动端验证、PR | 主 chat | 全部 |
