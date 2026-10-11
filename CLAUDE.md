# cn-tax · 个税规划器

- Next.js 16 App Router + TS + Tailwind v4，纯前端；计算引擎在 `src/lib/tax/`，改规则先改引擎 + `tests/engine.test.ts`。
- 跑：`npm run dev`；测：`npm test`；提交前 `npm run lint && npm run check && npm run build`。
- 部署：Vercel 项目 `cn-tax`（账号 yuanyanva-7250），`npx vercel --prod`。
- 域名 tax.warmbeing.com（DNS 在 Cloudflare，灰云 CNAME → Vercel）。
- 页面：`/` 完整计算器；`/offer` Offer 税后对比（引擎 `src/lib/tax/offer.ts`，UI `OfferCompare.tsx`，存 `cn-tax-offers-v1`，分享 hash `#o=`）；专题页各有独立工具：`/bonus` `BonusTool`（存 `cn-tax-bonus-v1`，hash `#b=`）、`/settlement` `SettlementTool`（复用首页 `useProfile`，同一份数据）、`/social-insurance` `SalaryTool`（存 `cn-tax-salary-v1`，hash `#w=`）、`/pension` `PensionTool`（引擎 `src/lib/pension/`，状态 `src/lib/pensionStore.ts`，存 `cn-tax-pension-v1`，hash `#p=`；城市/税前默认沿用首页 profile；`cityId` = 工作城市、`receiveCityId` = 退休城市；过去缴费是 `records[]`（每个参保地一条：月数 + 个人账户金额，引擎反推基数/指数并按退休地逐段折算），旧存档的 balance/paidYears 读取时迁移成一条记录；情景图 `ScenarioChart` 由 `pensionScenarios` 驱动）。`/retirement-age` 延迟退休年龄计算器（`RetirementAgeTool` 纯客户端、不存档；对照表和 FAQ 的例子由引擎在构建时生成，`src/content/retirement-age.tsx`）；`/pension-base` 各省计发基数一览（纯服务端表，数据即 `PENSION_REGIONS`，`src/content/pension-base.tsx`）。链接带来的首页数据只预览，点「保留」才落盘（`store.ts` preview）。页头导航在 `seo.tsx` 的 `SiteNav`，新页面记得同时加进 `Article` 底部的 NAV 和 `sitemap.ts`。
- SEO：首页 + 专题落地页，文案在 `src/content/*.tsx`（含 faq 数组给 FAQPage JSON-LD）；`Hero` 是服务端渲染的 H1，`ClientApp` 才是计算器。metadata 在 `src/app/layout.tsx`，robots/sitemap 是 `src/app/robots.ts` `sitemap.ts`。
- 环境变量（Vercel env）：`NEXT_PUBLIC_BAIDU_TONGJI_ID` 百度统计、`NEXT_PUBLIC_BAIDU_SITE_VERIFICATION` 百度站长验证，都可留空。
- 百度：站长验证码走 env `NEXT_PUBLIC_BAIDU_SITE_VERIFICATION`；主动推送 `BAIDU_PUSH_TOKEN=xxx scripts/baidu-push.sh`（token 只放本地环境变量）。文章末尾 `RelatedTools` 是内链块，新页面加进 `seo.tsx` 的 RELATED。
- IndexNow：密钥文件 `public/<key>.txt`（key 见文件名），新页面上线后 `POST https://api.indexnow.org/indexnow` 推送 URL 列表，脚本在 `scripts/indexnow.sh`。
- 分享图 `public/og.png` 由 scratch 的 og.svg 用本机 Chrome 无头截图生成（qlmanage 会把 SVG 渲染溢出）。
- 税法口径与产品设计见 `docs/PRODUCT.md`。城市社保/公积金上下限在 `constants.ts`，每年 7 月前后要更新。
- 分享链接：`src/lib/share.ts` 用 lz-string 把整个 Profile 压进 `#s=`（hash 不经服务器），`?utm_source=share` 给统计；`store.ts` 的 load() 先消费 hash 再读 localStorage。报告有「摘要 / 完整」两档，摘要只含全年测算 + 二维码页脚。
- 坑：报告导出图片只用 html-to-image 的 `toSvg`，再自己 Image→canvas；它的 `toPng` 在内嵌 Chromium 里 `img.decode()` 会挂死。
- 坑：`NumberInput` 用本地字符串态 + 渲染期派生同步，不要改回 useEffect（React Compiler lint 会报）；`useProfile` 只能在 `ClientApp` 挂载后调用（读 localStorage）。

@AGENTS.md
