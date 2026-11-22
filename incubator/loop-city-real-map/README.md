# Loop City on the real map: the base map

**What it is:** the real OpenStreetMap city round London with the project's data layers, dark and light, in plan and in 3D. It is the base on which Loop City (the mould, the growth, the wool) is to be laid. A standalone incubator app, built to be combined with the London map: the same MapLibre version and basemap, and no imports from outside its own folder.

Version v13, 21 November 2026. Nothing runs or grows in this version: it is the map and its data only.

## How to use it

- **The map** opens dark, on the 70 km frame round London. Drag to move, scroll to zoom, right-drag or Ctrl-drag to tilt and turn. The north symbol turns with the map; click it for north up.
- **The right panel** controls the look. Everything is live, with no reload.

| Section | Controls |
|---|---|
| View | Plan, Tilt, Whole loop |
| Labels | on or off, size |
| Buildings | off, flat or 3D (OpenStreetMap buildings, from zoom 13) |
| Terrain | topography coloured by height for the whole map, with hill shading and a legend (click the map for a height); the EA LiDAR terrain picture (70 km only); 3D relief |
| Map layers | roads, water, land use, rail, places; zoomed out only the main roads are drawn (motorways and primary A roads), more as you zoom in |
| Rail networks | National Rail, Underground, Overground, Elizabeth line, DLR, trams, HS1, HS2, stations. Rail colours: each tube line in its own colour, or three shades of one colour. National Rail by line speed |
| Line weights | roads, rail, Green Belt edge, AONB edge |
| Green Belt, AONB | switch, fill, colour |
| Colours | Dark or Light, palettes, colour pickers |

## The data

| Layer | Source | Cover |
|---|---|---|
| Basemap, buildings, plain rail | OpenFreeMap Liberty (OpenStreetMap data) | the world |
| Topography, 3D relief | AWS Terrain Tiles (Mapzen), streamed | the world |
| Rail by service, stations, HS1 | OpenStreetMap, fetched 21 Nov 2026 | the 70 km frame (HS1 whole) |
| HS2 | HS2 Ltd, `HS2_Route_Detailed` (Phase One) | London to the West Midlands |
| Green Belt | England Green Belt 2024/25 (MHCLG), the London belt merged | the 70 km frame |
| AONB | Natural England | the 70 km frame |
| EA terrain picture | Environment Agency LiDAR, from `incubator/google-map-live` | 70 km |

Licences and credits are in `SOURCE.md`.

## How it is put together

- `index.html`, `scripts/app.js`: the map and its panel.
- `scripts/osm_basemap_themes.js`, `scripts/terrain_local.js`, `scripts/terrain_worker.js`, `assets/terrain/`: copies from `incubator/google-map-live` (see `SOURCE.md`).
- `assets/*.geojson`: rail by service, stations, HS1 and HS2, Green Belt, AONB.
- `serve.py`: a small local server for testing (`python serve.py`, then the address it prints). The site does not need it.

## For combining it with the London map

- MapLibre GL JS 6.13.0 (unpkg, then jsDelivr) and the OpenFreeMap Liberty style, as in `incubator/google-map-live`. The basemap is recoloured by paint properties only; `setStyle` is never called.
- The layer switches work on the style's own layers, grouped by their source-layer; label size and line weights multiply the style's own values.
- Language: `langStorageKey` is `loopCityMap.uiLanguage`; the buttons are `#langbar button[data-lang="{lang}"]`; `#langbar` can be hidden; the app listens for `{ type: 'l2100:lang' }` and sets `data-ui-language` on `<html>`.
- Every layer and source this app adds has an id starting with `lc-`.
- The copied modules can become `shared/` imports; nothing else depends on files outside this folder.

## Good to know

- The rail by service, the Green Belt and the AONB cover the 70 km frame. Outside it the plain Rail switch still draws every railway.
- Tested in Chrome and Edge from a local server. **Not yet tested on GitHub Pages or inside the site's frame.**
- It needs the internet: map tiles from OpenFreeMap, height tiles from the AWS Terrain Tiles, MapLibre from a CDN.

---

# Loop City 真实地图：底图

**这是什么：**伦敦一带真实的 OpenStreetMap 城市，加上项目的数据图层，深色与浅色，可看平面和 3D。Loop City（黏菌、城市生长、毛线）将叠加在这张底图上。这是一个独立的孵化区应用，为与伦敦地图结合而做：相同的 MapLibre 版本和底图，不从自身文件夹之外导入任何代码。

版本 v13，2026 年 11 月 21 日。本版本中没有任何运行或生长的内容：只有地图及其数据。

## 怎么用

- **地图**以深色打开，显示伦敦周围 70 km 的范围。拖动移动，滚轮缩放，右键拖动或 Ctrl+拖动可倾斜和旋转。指北符号随地图转动，点击可让正北朝上。
- **右侧面板**控制外观，各项都即时生效，无需刷新。

| 分区 | 控件 |
|---|---|
| 视角 | 平面、倾斜、整个环线 |
| 标注 | 开关、大小 |
| 建筑 | 关、平面或 3D（OpenStreetMap 建筑，缩放级别 13 起） |
| 地形 | 整张地图按高程着色，带山体阴影和图例（点击地图读取高程）；EA LiDAR 地形图（仅 70 km）；3D 起伏 |
| 地图图层 | 道路、水体、土地利用、铁路、地点；缩小时只画主干道（高速公路和主要 A 级道路），放大后逐级增加 |
| 铁路网络 | 国家铁路、地铁、地上铁、伊丽莎白线、DLR、有轨电车、HS1、HS2、车站。铁路颜色：地铁各线用原色，或同一种颜色的三档。国家铁路可按线路速度着色 |
| 线宽 | 道路、铁路、绿带边线、AONB 边线 |
| 绿带、AONB | 开关、填充、颜色 |
| 颜色 | 深色或浅色、配色、取色器 |

## 数据

| 图层 | 来源 | 范围 |
|---|---|---|
| 底图、建筑、普通铁路 | OpenFreeMap Liberty（OpenStreetMap 数据） | 全球 |
| 地形着色、3D 起伏 | AWS Terrain Tiles（Mapzen），在线加载 | 全球 |
| 按服务分类的铁路、车站、HS1 | OpenStreetMap，2026 年 11 月 21 日获取 | 70 km 范围（HS1 为全线） |
| HS2 | HS2 Ltd，`HS2_Route_Detailed`（第一阶段） | 伦敦至西米德兰兹 |
| 绿带 | England Green Belt 2024/25（MHCLG），伦敦绿带已合并 | 70 km 范围 |
| AONB | Natural England | 70 km 范围 |
| EA 地形图 | 环境署 LiDAR，来自 `incubator/google-map-live` | 70 km |

许可和署名见 `SOURCE.md`。

## 结构

- `index.html`、`scripts/app.js`：地图和面板。
- `scripts/osm_basemap_themes.js`、`scripts/terrain_local.js`、`scripts/terrain_worker.js`、`assets/terrain/`：复制自 `incubator/google-map-live`（见 `SOURCE.md`）。
- `assets/*.geojson`：按服务分类的铁路、车站、HS1 和 HS2、绿带、AONB。
- `serve.py`：本地测试用的小服务器（运行 `python serve.py`，再打开它显示的地址）。网站不需要它。

## 与伦敦地图结合

- MapLibre GL JS 6.13.0（先 unpkg，后 jsDelivr）和 OpenFreeMap Liberty 样式，与 `incubator/google-map-live` 相同。底图只通过 paint 属性改色，从不调用 `setStyle`。
- 图层开关作用于样式自身的图层，按 source-layer 分组；标注大小和线宽是在样式原值上相乘。
- 语言：`langStorageKey` 为 `loopCityMap.uiLanguage`；按钮为 `#langbar button[data-lang="{lang}"]`；`#langbar` 可隐藏；应用接收 `{ type: 'l2100:lang' }` 消息，并在 `<html>` 上设置 `data-ui-language`。
- 本应用添加的每个图层和数据源，id 都以 `lc-` 开头。
- 复制来的模块可以改为 `shared/` 导入；除此之外不依赖本文件夹以外的文件。

## 须知

- 按服务分类的铁路、绿带和 AONB 覆盖 70 km 范围。范围之外，普通“铁路”开关仍会画出所有铁路。
- 已用 Chrome 和 Edge 通过本地服务器测试。**尚未在 GitHub Pages 上或网站的框架内测试。**
- 需要联网：地图瓦片来自 OpenFreeMap，高程瓦片来自 AWS Terrain Tiles，MapLibre 来自 CDN。
