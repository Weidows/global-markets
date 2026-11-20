# AGENTS.md

给后续改这个仓库的 agent 的约定。

## 数据

- 唯一数据源是东方财富行情接口（`scripts/fetch-data.mjs` 里的三个 host 轮询重试）。**不要**为了"更全"而换成需要 key 的服务。
- 页面只读 `public/data/snapshot.json`，绝不直连接口：站点要能在离线/静态托管下完整渲染，且每一屏数字都能对应到一次提交。
- 52 个市场的名单在 `src/data/places.json`。加市场 = 加一条记录（code + market 前缀 + 经纬度 + core 标记），跑一次 `npm run fetch` 看是否返回数据。
- **不要伪造缺失数据**。接口没返回就留 `null`，UI 显示 `—`；`fetch-data.mjs` 会在返回率低于 80% 时直接失败退出。

## 地图

- `src/data/geo.generated.ts` 是 `scripts/gen-map.mjs` 的生成物，**不手改**。改投影/缩放/城市坐标去改脚本或 `places.json`。
- 投影固定为 d3 `geoNaturalEarth1`，viewBox 1000×520，`ZOOM` 把极地空白裁掉。改 `ZOOM` 后气泡坐标会一起变（同一 projection），不需要手调。
- 同一城市多个指数靠 `nudge` 字段给初始偏移，再由 `lib/layout.ts` 的斥力松弛解重叠，位移超过 6 单位就画引线指回真实锚点。加同城指数时记得给 nudge，否则会被推得很远。

## 视觉

- 涨红跌绿（中国习惯），`--up` / `--down` / `--flat` 在 `src/index.css` 的 `:root` 里。
- 气泡半径 `radiusOf()`：`30 + 13.5 * sqrt(|pct|)`，clamp 到 [29, 84]。用 sqrt 而不是线性，否则 -6% 会把地图撑满。
- 气泡内文字按**视觉宽度**反算字号（中文 1em、英数 0.56em），名字变长要检查是否溢出；`short` 字段控制在 6 个汉字以内。
- 顶栏/底栏是固定的，地图区域不允许出现页面级滚动：验收条件是 `document.documentElement.scrollHeight === window.innerHeight`。

## 验证

改完之后跑一遍无头浏览器检查（Edge/Chrome + CDP），至少确认：

- 主要市场视图 `[data-bubble]` 数量 = places.json 里 core 的数量
- 悬停任意气泡出现 `.tip`，且卡片顶边 > 100px（不压顶栏）
- 打开市场列表 `.prow` 数量 = 52
- 390×844 下 `scrollWidth === clientWidth`
- 控制台零错误

## 部署

GitHub Pages 项目页，`VITE_BASE=/<repo>/` 由 workflow 注入。`index.html` 里的资源用 `./` 相对路径，只有 `vite build` 的输出才带绝对前缀。
