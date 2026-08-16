# dsh-quant-ui

🌐 **Live demo**: https://dsh-quant-ui.pages.dev


**Jane Street 风格量化工作台** —— dsh-quant 的官方前端。

加载 dsh-quant 的 chart/回测数据（粘贴 JSON 或文件），渲染：

- 📈 K 线 + 均线叠加 + 买卖点标记（Lightweight Charts，TradingView 出品）
- 📉 回测净值曲线 / 基金费后净值对比
- 🏦 量化基金模拟卡（1 亿起步 · NAV 1.00 · 管理费/高水位提成）
- ✅ 指标选择器（Sharpe/Return/MaxDD 必有 + 可选指标勾选显示）

## 使用

```sh
npm install
npm run dev      # http://localhost:5173（自动加载示例数据 public/sample.json）
npm run build    # 产出 dist/（静态部署）
```

示例数据由 dsh-quant 生成：`npx tsx demos/gen-ui-demo-data.ts`（在 dsh-quant 仓库）。

## 设计

克制浅色 + 橙色点缀 + 等宽数据（Jane Street 美学）× Lightweight Charts 引擎。
数据协议与 dsh-quant 的 chart 输出一致（candles/series/annotations）。

## 路线

- [x] 0.1.0 工作台（K线/净值/基金卡/指标选择器/JSON 加载）
- [ ] dsh client plugin（ConversationNodeDefinition，成为 dsh 内真实节点）
- [ ] dsh-chart 通用协议提炼
- [ ] 数据标注可视化（severity 红/黄/绿）
