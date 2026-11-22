# 来源 · Source

原始文件夹：`03_Loop City on the real map/v13`（2026-11-21，底图版本，不含黏菌与城市生长引擎），原样复制；仅去掉 Windows 启动器（`.cmd`）和 PDF，README 为网站重写。
Original folder: `03_Loop City on the real map/v13` (21 Nov 2026, the base map, without the mould and growth engine), copied as it is; only the Windows launcher (`.cmd`) and the PDF are left out, and the README is rewritten for the site.

本应用为新写，部分代码复制自 Hao Wang 的 london-2100-generative-system（提交 `e22bf500`，本地只读副本，2026-11-20），并注明出处。复制的文件不从原文件夹导入，以后可改为 `shared/` 导入。

| 本文件夹 | 来自 Hao 的仓库 | 改动 |
|---|---|---|
| `scripts/terrain_local.js` | `incubator/google-map-live/scripts/terrain_local.js` | 只加了署名和 worker 缓存标记 |
| `scripts/terrain_worker.js` | `incubator/google-map-live/scripts/terrain_worker.js` | 只加了署名 |
| `assets/terrain/overview.webp`、`metadata.json` | `incubator/google-map-live/assets/terrain/` | 无（© Environment Agency 2022，Open Government Licence） |
| `scripts/osm_basemap_themes.js` | `incubator/google-map-live/scripts/osm_basemap_themes.js` | `colorFor`、`mixHex` 和控制器为原样；控制器改为接收配色对象；保留 Dark tech、Mono、Faded、Default，另加两套深色和一套浅色打印 |
| `scripts/app.js` 中的方法 | `incubator/google-map-live/scripts/app.js`（`initOSM`、`ensureCityBuildings`、`cityBuildingTilesUrl`、`ensureOsmTerrainLayer`） | 按其思路重写：MapLibre 6.13.0 的加载方式、z13–z14 专用建筑数据源、本地地形瓦片协议 |
| 语言切换 | `app/appview.js` 与 `incubator/catalogue.json` 的 `embed` 约定 | `langStorageKey` = `loopCityMap.uiLanguage`，`#langbar button[data-lang]`，`l2100:lang` 消息 |

外部数据：OpenFreeMap Liberty 样式与瓦片（© OpenMapTiles © OpenStreetMap contributors）；绿带：England Green Belt 2024/25（MHCLG，Open Government Licence）；AONB：Natural England（Open Government Licence）；铁路线、车站和 HS1：© OpenStreetMap contributors（ODbL，经 Overpass API 获取）；HS2 线路：HS2 Ltd `HS2_Route_Detailed`（Open Government Licence）；地形着色与 3D 起伏用 AWS Terrain Tiles（Mapzen，开放数据）。

---

This app is new. Some of its code is copied, with credit, from Hao Wang's london-2100-generative-system (commit `e22bf500`, read-only local copy, 20 Nov 2026). The copies are not imported from his folders, so they can become `shared/` imports later.

| In this folder | From Hao's repository | Changes |
|---|---|---|
| `scripts/terrain_local.js` | `incubator/google-map-live/scripts/terrain_local.js` | Credit note and the worker's cache tag only |
| `scripts/terrain_worker.js` | `incubator/google-map-live/scripts/terrain_worker.js` | Credit note only |
| `assets/terrain/overview.webp`, `metadata.json` | `incubator/google-map-live/assets/terrain/` | None (© Environment Agency 2022, Open Government Licence) |
| `scripts/osm_basemap_themes.js` | `incubator/google-map-live/scripts/osm_basemap_themes.js` | `colorFor`, `mixHex` and the controller as they were; the controller takes a palette object; Dark tech, Mono, Faded and Default kept; two more dark palettes and a light print palette added |
| Methods in `scripts/app.js` | `incubator/google-map-live/scripts/app.js` (`initOSM`, `ensureCityBuildings`, `cityBuildingTilesUrl`, `ensureOsmTerrainLayer`) | Rewritten on the same lines: the MapLibre 6.13.0 loading, the dedicated z13–z14 building source, the local terrain tile protocol |
| Language switch | `app/appview.js` and the `embed` contract in `incubator/catalogue.json` | `langStorageKey` = `loopCityMap.uiLanguage`, `#langbar button[data-lang]`, `l2100:lang` messages |

Outside data: the OpenFreeMap Liberty style and tiles (© OpenMapTiles © OpenStreetMap contributors); the Green Belt from England Green Belt 2024/25 (MHCLG, Open Government Licence); AONB from Natural England (Open Government Licence); railway lines, stations and HS1 © OpenStreetMap contributors (ODbL, through the Overpass API); the HS2 route from HS2 Ltd's `HS2_Route_Detailed` (Open Government Licence); AWS Terrain Tiles (Mapzen, open data) for the topography colours and the 3D relief.
