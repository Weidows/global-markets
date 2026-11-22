# 全球市场地图

![全球市场地图](docs/screenshot.webp)

暗色世界地图（**中国版，中央经线 150°E，太平洋居中**）上，每个主要市场是一块小卡片：**7 根柱 = 最近 7 个交易日，柱高 = 当日涨跌幅，绿跌红涨**，柱下一行是当日涨跌幅。覆盖 52 个指数、5 个大洲，地图上画 16 个核心市场。

- 柱高用同一个刻度（8px / 1%），可以直接横向比较哪个市场跌得凶
- 悬停任意卡片：点位、涨跌点数、逐日明细、区间累计、该市场的报价时间
- 全部 52 个市场：右侧列表按涨跌幅排序、按大洲分组
- 行情每小时更新，一周日线每天抓一次（GitHub Actions）

## 数据

| 项 | 说明 |
| --- | --- |
| 来源 | 东方财富全球指数行情（`push2.eastmoney.com`） |
| 实时快照 | `public/data/snapshot.json` — 52 个市场的点位/涨跌额/涨跌幅/报价时间 |
| 一周日线 | `public/data/history.json` — 16 个核心市场最近 8 个交易日的收盘与涨跌幅 |
| 频率 | GitHub Actions `cron: 5 * * * *`，每小时第 5 分钟；内容有变化才提交 |
| 时区 | 所有时间按北京时间（UTC+8）展示 |

页面读取的是**已提交的快照**，不直连行情接口 —— 所以站点在没有网络、没有后端的情况下也能完整渲染，数据可回溯到具体一次抓取。

## 本地运行

```bash
npm install
npm run fetch     # 抓最新行情；当天没抓过日线就顺带抓一周日线
npm run dev       # http://localhost:5173
npm run build     # 产物在 dist/
```

`push2his.eastmoney.com`（日线接口）对密集请求敏感，连发几十次会被临时断连。脚本已经做成串行 + 900ms 间隔 + 每天只抓一次；本地若仍失败，页面会退化成「只有当日一根柱」，实时行情不受影响。

生成/更新地图底图（改了 `src/data/places.json` 的经纬度后需要跑）：

```bash
node scripts/gen-map.mjs
```

`src/data/geo.generated.ts` 是生成物，别手改。

## 目录

```
scripts/
  fetch-data.mjs      抓东财行情 → snapshot.json；每天一次抓日线 → history.json
  gen-map.mjs         world-atlas → 中国版世界轮廓 path + 城市投影坐标
src/
  data/places.json    52 个市场的元数据（代码/名称/城市/经纬度/是否核心）
  data/geo.generated.ts
  lib/market.ts       类型、颜色、格式化、数据加载
  lib/blockLayout.ts  柱状图块避让（AABB 斥力松弛）
  components/MarketBars.tsx   SVG 世界地图 + 一周柱状图
  components/MarketPanel.tsx  列表侧栏 + 悬停详情卡
  App.tsx
.github/workflows/
  update.yml          定时抓数据并提交
  deploy.yml          构建并部署 GitHub Pages
```

## 统计口径

- 涨跌幅、点位、涨跌点数一律取自数据源原值，没有二次加工
- 「区间累计」是这 7 个交易日涨跌幅的复合，不是首尾收盘价的比值差（两者略有出入，前者与逐日数字自洽）
- "平均"是 52 个指数涨跌幅的算术平均，不代表任何可投资组合
- 各交易所收盘时间不同，同一时刻图上混合了隔夜收盘价与盘中价，气泡详情里给出每个市场的实际报价时间

## 免责

数据来自公开行情接口，可能延迟或有误；仅供观察，不构成投资建议。
