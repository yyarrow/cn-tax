# cn-tax · 个税规划器

- Next.js 16 App Router + TS + Tailwind v4，纯前端；计算引擎在 `src/lib/tax/`，改规则先改引擎 + `tests/engine.test.ts`。
- 跑：`npm run dev`；测：`npm test`；提交前 `npm run lint && npm run check && npm run build`。
- 部署：Vercel 项目 `cn-tax`（账号 yuanyanva-7250），`npx vercel --prod`。
- 域名 tax.warmbeing.com（DNS 在 Cloudflare，灰云 CNAME → Vercel）。
- SEO：首页 + `/bonus` `/settlement` `/social-insurance` 三个落地页，文案在 `src/content/*.tsx`（含 faq 数组给 FAQPage JSON-LD）；`Hero` 是服务端渲染的 H1，`ClientApp` 才是计算器。metadata 在 `src/app/layout.tsx`，robots/sitemap 是 `src/app/robots.ts` `sitemap.ts`。
- 环境变量（Vercel env）：`NEXT_PUBLIC_BAIDU_TONGJI_ID` 百度统计、`NEXT_PUBLIC_BAIDU_SITE_VERIFICATION` 百度站长验证，都可留空。
- IndexNow：密钥文件 `public/<key>.txt`（key 见文件名），新页面上线后 `POST https://api.indexnow.org/indexnow` 推送 URL 列表，脚本在 `scripts/indexnow.sh`。
- 分享图 `public/og.png` 由 scratch 的 og.svg 用本机 Chrome 无头截图生成（qlmanage 会把 SVG 渲染溢出）。
- 税法口径与产品设计见 `docs/PRODUCT.md`。城市社保/公积金上下限在 `constants.ts`，每年 7 月前后要更新。
- 坑：报告导出图片只用 html-to-image 的 `toSvg`，再自己 Image→canvas；它的 `toPng` 在内嵌 Chromium 里 `img.decode()` 会挂死。
- 坑：`NumberInput` 用本地字符串态 + 渲染期派生同步，不要改回 useEffect（React Compiler lint 会报）；`useProfile` 只能在 `ClientApp` 挂载后调用（读 localStorage）。

@AGENTS.md
