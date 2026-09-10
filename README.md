# 个税规划器（cn-tax）

算清中国大陆居民一年的工资薪金个税：输入工作经历（哪几个月有收入、每段税前月薪）和专项附加扣除，自动得到逐月预扣税、年度汇算退/补税、年终奖单独/并入对比与最优拆分、期权/RSU 跨年行权对比，以及按节省金额排序的减税建议。

- 纯前端，无后端；测算数据只存浏览器 localStorage。
- 支持：多段工作、空档月份、兼职重叠、应届生减除费用从 1 月累计、由税后到手反推五险一金、手动填社保/公积金基数与比例。
- 规则口径见 [docs/PRODUCT.md](docs/PRODUCT.md)。

## 开发

```bash
npm install
npm run dev      # http://localhost:3000
npm test         # 计算引擎单测（vitest）
npm run check    # tsc
npm run lint
npm run build
```

## 目录

- `src/lib/tax/` 计算引擎（纯函数）：`constants` 税率表与城市参考值、`withholding` 累计预扣、`social` 五险一金与反推、`annual` 汇算、`bonus` 年终奖、`equity` 股权激励、`advice` 建议。
- `src/components/` UI；`src/lib/store.ts` 本地状态。
- `tests/` 引擎单测。

## 页面

- `/` 计算器 + 税率表/累计预扣法长文
- `/bonus` 年终奖计算器 + 陷阱区间
- `/settlement` 汇算清缴退税
- `/social-insurance` 税后工资 / 五险一金反推

## 部署

Vercel（项目 `cn-tax`，域名 tax.warmbeing.com）。`npx vercel --prod` 即可。可选环境变量：`NEXT_PUBLIC_BAIDU_TONGJI_ID`、`NEXT_PUBLIC_BAIDU_SITE_VERIFICATION`。

## 访问统计

已在根布局接入 Vercel Web Analytics，覆盖计算器和各说明页面，统计页面浏览、匿名访客和访问来源，不上报工资、扣除项、税额或 localStorage 中的测算数据。

上线前确认 Vercel 项目的 Web Analytics 已启用，然后重新部署。使用未拦截统计脚本的浏览器访问线上页面，在开发者工具 Network 中确认统计脚本及页面浏览上报请求成功，再查看 Vercel Analytics 面板。仅在后台启用 Analytics 不会自动为旧部署添加采集代码，接入前的访问也不会补录。

免责声明：仅供测算参考，不构成税务建议。社保/公积金基数按各城市年度公布值取参考，实际以工资条为准。
