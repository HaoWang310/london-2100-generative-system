# 01 · Growth simulator 城市生长模拟

> **已停用 · Retired from the workspace (23 Nov 2026).** 主程序导航里的 `01` 现在是 Loop City 第 1 步（`modules/01-loop-city`：黏菌与城市共同生长）。本模块的代码、预览和测试都保留在仓库里，只是不再被主程序加载。
> 找回办法：在 `app/registry.js` 里重新 `import growth, { createGrowthTool } from '../modules/01-growth-simulator/module.js'`，并把 `{ key: 'growth', module: growth, create: createGrowthTool }` 加回 `SIMULATIONS`。
> This module is no longer loaded by the main program; Loop City step 1 (`modules/01-loop-city`) is `01` in the nav now. Its code, preview and tests stay. To bring it back, import it in `app/registry.js` and add it to `SIMULATIONS` again.

整条 412 km 环线 2025–2100 年的城市生长（50 m 地块），按真实位置画在 OSM 地图上；主程序的第一个模拟。
City growth along the whole 412 km loop, 2025–2100, on 50 m parcels, drawn on the OSM map at its true position.

- **在导航中 · In the nav**：`01`，紧跟 `00 伦敦地图`；任何层级都能打开。离开后默认留作背景（可在面板「显示」中关闭）。
- **输出 · Output**：`ScaleBundle` level `london`，环线车站为 `nodes`，`context.grid` 给出网格定位；每年每个地块的类别在地图图层中。
- 预览 · Preview：`preview.html`；测试 · Tests：`node --test modules/01-growth-simulator/tests/`

## 与孵化区是同一份 · One source with the incubator

本模块**不保存模拟器的副本**。运行时读取孵化区 app 自己的文件，所以在孵化区改好，主程序跟着变：

| 读取的文件 | 内容 |
|---|---|
| `incubator/growth-simulator-dark/engine.js` | 模拟引擎 `GV`（在 `worker.js` 里运行，不卡地图） |
| `incubator/growth-simulator-dark/controls.js` | 文字 `I18N`、全部原始设置 `GVC.GROUPS`、简化控制 `GVC.SIMPLE`、红色段 `GVC.UNDER` |
| `incubator/growth-simulator-dark/data/meta.js` | 网格、铁路、车站、最终结果逐年统计 `D` |
| `incubator/growth-simulator-dark/data/*.z` | 最终结果事件流与引擎所需网格（打开时约 4.5 MB；运行变体时再加载约 21 MB） |

这些文件是按数据 `fetch` 的，不是 `import`，模块隔离规则不变（`tools/check-isolation.mjs` 通过）。
`tests/module.test.mjs` 同时是这条链接的保险：孵化区若改出主程序跟不上的变化（引擎接口、控制定义、数据布局），CI 会失败。
主程序的历史版本（`/releases/<id>/`）不含 `incubator/`，会读取站点根目录下最新的孵化区文件。

## 位置 · Position

网格是英国国家格网（EPSG:27700）：`E = XMIN + j·50`，`N = YMAX − i·50`（第 0 行在北）。
地图是 Web 墨卡托。`georef.js` 把网格做成 60 × 50 的细网，每个顶点用 `shared/geo-core` 精确换算（OS 横轴墨卡托 + Helmert，约 2–5 m），
网内线性插值误差小于 1 m（测试中验证）。整张图只按四个角拉伸会偏约 280 m，所以不这样做。

`overlay.js`：MapLibre 用一个 WebGL 自定义图层，每个地块 4 字节（`cells.js`）一次上传，年份是 uniform，播放不重传数据；
放大到每个地块 ≥ 6 px 时画出 50 m 地块边线。没有 MapLibre 时，备用画布直接在 EPSG:27700 里画同一张图。
`tests/overlay-check.html` 在浏览器里用与 MapLibre 6 相同的相机矩阵画出真实图层并读回像素，逐个地块核对位置与颜色。

50 m 是模型本身的精度：放大看到的是哪些真实街区落在哪个地块里，不会出现更细的规划细节。

## 文件 · Files

| 文件 | 作用 |
|---|---|
| `module.js` | 模块约定 + `createGrowthTool(viewer)`（主程序挂载用） |
| `source.js` | 孵化区文件的位置与读取 |
| `growth.js` | 页面一侧的状态：设置、最终结果 / 变体、年份 |
| `worker.js` | 后台线程里的引擎与「与最终结果对比」 |
| `cells.js` | 事件流 → 每个地块一条记录 |
| `georef.js` | 网格在地图上的位置 |
| `overlay.js` | 地图图层（WebGL / 备用画布）、铁路与车站 |
| `panel.js` | 右侧面板：与孵化区相同的「生成流程」九个步骤（控制分在各步中）、数据、对比、显示开关 |
| `step-images.js` | 步骤展开时铺在地块下的图：地面图层、磁力场、第一遍城市的边缘 |
