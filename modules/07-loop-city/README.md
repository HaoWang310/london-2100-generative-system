# 07 · Loop City step 1 · 黏菌与生长

整条 412 km 环线上黏菌与城市共同生长（2025–2100 年），百年结束后从黏菌的干道读出单元；按真实位置画在 OSM 地图上。
The slime mould and the city grown together round the whole 412 km loop, 2025–2100; when the century ends the cells are read from the mould's highways. Drawn on the OSM map at its true position.

- **在导航中 · In the nav**：`07`，排在 `01 城市生长模拟` 后面，任何层级都能打开。两个模拟同时只在地图上显示一个：打开一个，另一个让开。23 Nov 2026：先与 01 并排，核对无误后再替换 01。
- **输出 · Output**：`ScaleBundle` level `london`，边界是模型的范围，车站为 `nodes`。
- 预览 · Preview：`preview.html`；测试 · Tests：`node --test modules/07-loop-city/tests/module.test.mjs`；位置检查 · Position check：`tests/overlay-check.html`（在浏览器里打开）。

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

- **每次运行结果都不同**：黏菌没有固定的随机种子。主程序里没有固定的"最终结果"，打开后要点「运行百年」。
- **运行期间地图响应会变慢**：引擎页面与主程序在同一个线程上，百年运行按 120 ms 的片段进行。
- **干道和单元只在 2100 年显示**：它们在百年结束后才读出。拖动时间轴回放时，显示的是那一年的黏菌和城市。
- **车站位置以孵化区第 1 步页面为准**，与 01 的车站相差最多约 360 m（两个 app 的数据不同）。
- **参数**：面板上是引擎页面自己列为接口的九个滑块和开关（`LoopCityEngine.sliders`）；其余参数在孵化区页面里调。

## 文件 · Files

| 文件 | 作用 |
|---|---|
| `module.js` | 模块约定 + `createLoopCityTool(viewer)`（主程序挂载用） |
| `engine.js` | 打开孵化区页面，转接它的 `LoopCityEngine`；每年把两张画布复制过来 |
| `georef.js` | 范围在地图上的位置：细网、国家格网 GeoJSON → 经纬度 |
| `overlay.js` | 地图图层（WebGL 图片层 / 备用画布）、干道、单元、铁路与车站 |
| `panel.js` | 右侧面板：运行、数据、显示开关、参数 |
