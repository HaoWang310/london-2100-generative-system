# 01 · Loop City step 1 · 黏菌与生长

整条 412 km 环线上黏菌与城市共同生长（2025–2100 年），百年结束后从黏菌的干道读出单元；按真实位置画在 OSM 地图上。
The slime mould and the city grown together round the whole 412 km loop, 2025–2100; when the century ends the cells are read from the mould's highways. Drawn on the OSM map at its true position.

- **在导航中 · In the nav**：`01`，任何层级都能打开，离开后默认留作背景。23 Nov 2026 起它取代了原来的 `01 城市生长模拟`（`modules/01-growth-simulator`，代码保留在仓库里，不再出现在导航中；找回办法见该模块的 README）。此前一天它以 `07` 的编号与旧版并排放过。
- **输出 · Output**：`ScaleBundle` level `london`，边界是模型的范围，车站为 `nodes`。
- 预览 · Preview：`preview.html`；测试 · Tests：`node --test modules/01-loop-city/tests/module.test.mjs`；位置检查 · Position check：`tests/overlay-check.html`（在浏览器里打开）。

## 打开即看：发布的结果 · What opens: a published result

23 Nov 2026 起，打开 01 **不再计算**：它显示一份在电脑上算好并存下来的结果（`result/`，约 4 MB，打开时先取 1.7 MB），任何设备都一样快。按「运行百年」时才载入引擎（下一节），用当前参数自己算一次；算完可以点「回到发布的结果」。

| | 发布的结果 | 自己运行（引擎） |
|---|---|---|
| 打开到看见 | 不到 1 秒加下载时间 | 十几秒准备，再算 1 到 3 分钟 |
| 内存（模拟手机，主程序内，离线视图） | 约 300 MB，其中主程序外壳约 180 MB | 760 MB 起，运行中更高 |
| 拖时间轴 | 每年 10 到 40 毫秒 | 每年约 0.1 秒 |

- **存了什么 · What is stored**：城市生长是 2025 年的整张图加上此后每年变化的格子（`growth.bin.gz`，逐年精确）；黏菌每 5 年存一张图，中间年份由前后两张按比例叠加；干道、单元、车站、铁路是国家格网米的线（`result.json`）。图和颜色都是从孵化区页面自己的画布上读下来的，所以这里不含任何模型知识。
- **重新发布 · Publish again**：`node modules/01-loop-city/tools/publish-result.mjs`（需要 Playwright 和 Chrome；一两分钟）。孵化区的算法或配色改了以后要重新发布，否则打开看到的还是旧的那次运行。面板上写着这份结果的运行日期；`node --test` 会在孵化区页面比发布时新的情况下给出一行提醒（不算失败）。
- **配色 · Colours (23 Nov 2026)**：孵化区页面的默认配色改成了色板的 C 方案（城市 `#E3B47B`、乡村 `#9EBE7A`）。这份发布结果没有重跑：只把 `result.json` 里城市生长的 5 个颜色换成了 C 的五档（低层 227,180,123 · 地面农田 98,118,76 · 中层 236,204,165 · 垂直农场 179,204,151 · 高层 244,227,205），单元的颜色在 `overlay.js` 的 `USE_COLOUR`。下次重新发布时颜色会自动从页面读到，不需要再手改。 The incubator page now opens on palette C; this result was not grown again, only its five growth colours were set to C's tints, and the cells' colours are `USE_COLOUR` in `overlay.js`.
- **种子 2100 的那一次 · The run of seed 2100 (25 Nov 2026)**：孵化区的页面现在有固定的随机种子（默认 2100），所以发布的结果可以重现：种子 2100、默认设置，运行名 `s2100·n1bz`，123 个单元。`result.json` 里的 `run` 写着种子和运行名，每个单元的属性里有 `key` 和 `run`。只有运行名相同的单元才能拼在一起。只在 Chromium 上验证过。 The incubator page now grows from a fixed seed (2100 by default), so the published result can be made again: seed 2100, the default settings, run `s2100·n1bz`, 123 cells. `result.json` carries `run` (the seed and the name), and each cell its `key`.
- 没有发布结果、或浏览器打不开它时，退回到原来的做法：打开时直接载入引擎。

## 与孵化区是同一份 · One source with the incubator

本模块**不保存模型的副本**。它在后台打开孵化区的页面 `incubator/loop-city-mould-growth/index.html?embed=1`（不显示），通过该页面自己提供的接口 `window.LoopCityEngine` 运行和读取：`run()`、`onYear()`、`show(year)`、黏菌和生长的两张画布及其范围、运行结束后的干道与单元（国家格网米的 GeoJSON）、车站与铁路。所以在孵化区改好，主程序跟着变。

`tests/module.test.mjs` 同时是这条链接的保险：孵化区页面若改掉了范围、车站或接口里本模块用到的任何一项，CI 会失败。
主程序的历史版本（`/releases/<id>/`）不含 `incubator/`，会读取站点根目录下最新的孵化区页面。

## 位置 · Position

模型的范围是英国国家格网（EPSG:27700）里的一个矩形：`E 452754.1 – 602766.5`，`N 123481.0 – 246493.2`（150 × 123 km），与孵化区页面的 `CFG.map.extentBNG` 相同（测试中核对）。地图是 Web 墨卡托，两者的"北"在范围西边差 0.59°，东边差 2.28°。

- **两张图（黏菌、城市生长）**：通过 60 × 50 的细网绘制，每个顶点用 `shared/geo-core` 精确换算（OS 横轴墨卡托 + Helmert，约 2–5 m），网内线性插值误差最大 0.31 m（测试中验证）。只按四个角拉伸最多会偏约 930 m，所以不这样做。
- **干道、单元、铁路、车站**：每个顶点单独换算成经纬度，没有插值。
- **`tests/overlay-check.html`**：用与 MapLibre 6 相同的相机矩阵画出真实图层并读回像素，在 40 处、13,562 个点上检查每个 92.6 m 格子的四条边，全部在 2 m 以内；把图故意东移 5 m 的对照会失败。
- **底图本身的坐标**（23 Nov 2026 核对）：把 `incubator/loop-city-real-map/assets/rail.geojson`（OSM 铁路，31.6 万个采样点）换算到孵化区底图上，与它自己的铁路图层在零偏移处吻合，全图和东、中、西、南、北五个分区都是；绿带边界在 1 个像素（35 m）内吻合。

准的是位置，不是细节：黏菌一格 92.6 m，城市生长一格 70 m，放大到街道级会看到格子。干道和单元是平滑过的线。

## 使用上要知道的 · Good to know

- **自己运行时每次结果都不同**：黏菌没有固定的随机种子。打开时显示的发布结果是固定的一份。
- **运行期间地图响应会变慢**：引擎页面与主程序在同一个线程上，百年运行按 120 ms 的片段进行。
- **干道和单元只在 2100 年显示**：它们在百年结束后才读出。拖动时间轴回放时，显示的是那一年的黏菌和城市。
- **车站位置以孵化区第 1 步页面为准**，与旧版城市生长模拟的车站相差最多约 360 m（两个 app 的数据不同）。
- **参数**：面板上是引擎页面自己列为接口的九个滑块和开关（`LoopCityEngine.sliders`）；其余参数在孵化区页面里调。

## 手机上 · On a phone

手机上主程序工作区用和各应用相同的手机布局（`app/phone.js`，2026-11-24）：地图铺满，面板是底部卡。本模块面板里带 `data-phone-quick` 的元素（「运行百年」「回到发布的结果」）会显示在收起的底部卡里，点击处理不变；面板重建时外壳会重新接上。

## 文件 · Files

| 文件 | 作用 |
|---|---|
| `module.js` | 模块约定 + `createLoopCityTool(viewer)`（主程序挂载用） |
| `engine.js` | 打开孵化区页面，转接它的 `LoopCityEngine`；每年把两张画布复制过来 |
| `result.js` | 读取并回放 `result/` 里发布的结果（不计算） |
| `result/` | 发布的结果：`result.json`、`growth.bin.gz`、`mould-YYYY.webp` |
| `tools/publish-result.mjs` | 在无头浏览器里跑一次百年并写出 `result/` |
| `georef.js` | 范围在地图上的位置：细网、国家格网 GeoJSON → 经纬度 |
| `overlay.js` | 地图图层（WebGL 图片层 / 备用画布）、干道、单元、铁路与车站 |
| `panel.js` | 右侧面板：运行、数据、显示开关、参数 |
