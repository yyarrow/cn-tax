# 个税规划器（cn-tax）

算清中国大陆居民一年的工资薪金个税：输入工作经历（哪几个月有收入、每段税前月薪）和专项附加扣除，自动得到逐月预扣税、年度汇算退/补税、年终奖单独/并入对比与最优拆分、期权/RSU 跨年行权对比，以及按节省金额排序的减税建议。

- 纯前端，无后端；数据只存浏览器 localStorage。
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

## 部署

Vercel（项目 `cn-tax`）。`npx vercel --prod` 即可。

免责声明：仅供测算参考，不构成税务建议。社保/公积金基数按各城市年度公布值取参考，实际以工资条为准。
