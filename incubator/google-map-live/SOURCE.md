# 来源 · Source

从 [HaoWang310/google-map-live](https://github.com/HaoWang310/google-map-live) 原样复制，
提交 `a1ca9ac`（v3.30.0，2026-11-12）。之后在这里的修改与原仓库互相独立。

在线访问：https://haowang310.github.io/london-2100-generative-system/incubator/google-map-live/

说明：
- 原仓库带来的 `.github/workflows/`（9 个）、`google-style-3d.html` 和 `assets/terrain_b64/` 已于 2026-11-26 删除：GitHub 只运行仓库根目录的工作流，后两样没有任何页面用。原来不会被 `node --test` 找到的测试改了名（`*.test.mjs`），现在每次都跑；3 个过时的删掉了。界面上的版本号去掉了分支名留下的「-english」。
- 后续融合时，相关功能会通过 `modules/00-london-map`、`02-wool-network`、`03-tensor-roads` 的适配层接入统一系统。

## v3.44.0 · 规划图层 · Planning layers (25 Nov 2026)

`assets/planning/` 来自原「Loop City 真实地图」模块的数据（v13，2026-11-21）。未裁剪的铁路和 AONB 原始文件存在本应用自己的 `source/planning/`，用 `scripts/build_planning_layers.py` 裁到 70 km 研究范围；绿带和高铁文件本身就是原始文件（绿带全在圈内，高铁保留全线）。`scripts/planning_layers.js`、`relief_local.js`、`relief_worker.js` 为新写，画法（铁路着色、线宽、高度色带）沿用该应用的 `scripts/app.js`。
`assets/planning/` comes from the data of the former "Loop City on the real map" app (v13, 21 Nov 2026). The uncut rail and AONB files are kept in this app's own `source/planning/` and cut to the 70 km study circle with `scripts/build_planning_layers.py`; the Green Belt and high-speed files are the uncut files themselves (the belt lies inside the circle, HS1 and HS2 are kept whole). `scripts/planning_layers.js`, `relief_local.js` and `relief_worker.js` are new, and follow that app's `scripts/app.js` for the look (rail colours, line widths, the height ramps).

| 文件 File | 数据 Data | 许可 Licence |
|---|---|---|
| `rail.geojson` | 铁路线 Rail lines, © OpenStreetMap contributors (Overpass API, 21 Nov 2026), cut to the circle | ODbL |
| `highspeed.geojson` | HS1: © OpenStreetMap contributors; HS2: HS2 Ltd `HS2_Route_Detailed` (Phase One). Whole lines | ODbL · Open Government Licence |
| `green_belt.geojson` | England Green Belt 2024/25 (MHCLG), the London belt merged | Open Government Licence |
| `aonb.geojson` | AONB / National Landscapes, Natural England, cut to the circle | Open Government Licence |
| (streamed) | 高程 Heights: Terrain Tiles (Mapzen), AWS Open Data | open data |
