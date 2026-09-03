# cn-tax · 个税规划器

- Next.js 16 App Router + TS + Tailwind v4，纯前端；计算引擎在 `src/lib/tax/`，改规则先改引擎 + `tests/engine.test.ts`。
- 跑：`npm run dev`；测：`npm test`；提交前 `npm run lint && npm run check && npm run build`。
- 部署：Vercel 项目 `cn-tax`（账号 yuanyanva-7250），`npx vercel --prod`。
- 税法口径与产品设计见 `docs/PRODUCT.md`。城市社保/公积金上下限在 `constants.ts`，每年 7 月前后要更新。
- 坑：`NumberInput` 用本地字符串态 + 渲染期派生同步，不要改回 useEffect（React Compiler lint 会报）；`useProfile` 只能在 `ClientApp` 挂载后调用（读 localStorage）。

@AGENTS.md
