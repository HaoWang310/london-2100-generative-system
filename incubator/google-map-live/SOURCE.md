# 来源 · Source

从 [HaoWang310/google-map-live](https://github.com/HaoWang310/google-map-live) 原样复制，
提交 `a1ca9ac`（v3.30.0，2026-11-12）。之后在这里的修改与原仓库互相独立。

在线访问：https://haowang310.github.io/london-2100-generative-system/incubator/google-map-live/

说明：
- 这里的 `.github/workflows/` 只作参考，GitHub 只运行仓库根目录的工作流。
- 后续融合时，相关功能会通过 `modules/00-london-map`、`02-wool-network`、`03-tensor-roads` 的适配层接入统一系统。

## v3.44.0 · 规划图层 · Planning layers (25 Nov 2026)

`assets/planning/` 来自本仓库 `incubator/loop-city-real-map/assets`（v13，2026-11-21），用 `scripts/build_planning_layers.py` 裁到 70 km 研究范围；`scripts/planning_layers.js`、`relief_local.js`、`relief_worker.js` 为新写，画法（铁路着色、线宽、高度色带）沿用该应用的 `scripts/app.js`。
`assets/planning/` comes from `incubator/loop-city-real-map/assets` in this repository (v13, 21 Nov 2026), cut to the 70 km study circle with `scripts/build_planning_layers.py`; `scripts/planning_layers.js`, `relief_local.js` and `relief_worker.js` are new, and follow that app's `scripts/app.js` for the look (rail colours, line widths, the height ramps).

| 文件 File | 数据 Data | 许可 Licence |
|---|---|---|
| `rail.geojson` | 铁路线 Rail lines, © OpenStreetMap contributors (Overpass API, 21 Nov 2026), cut to the circle | ODbL |
| `highspeed.geojson` | HS1: © OpenStreetMap contributors; HS2: HS2 Ltd `HS2_Route_Detailed` (Phase One). Whole lines | ODbL · Open Government Licence |
| `green_belt.geojson` | England Green Belt 2024/25 (MHCLG), the London belt merged | Open Government Licence |
| `aonb.geojson` | AONB / National Landscapes, Natural England, cut to the circle | Open Government Licence |
| (streamed) | 高程 Heights: Terrain Tiles (Mapzen), AWS Open Data | open data |
