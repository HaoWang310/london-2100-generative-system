# 00 · London map 伦敦地图

- **输入**：无（根层级）
- **输出**：`ScaleBundle` level `london`，研究范围（默认 70 km 圆，EPSG:27700）
- **现状 P0**：研究范围 + OSM/OpenFreeMap 底图（由 `shared/map-viewer` 绘制）
- **P1 迁入**（来自 google-map-live，原样放入 `legacy/`）：`terrain_local.js`、`terrain_worker.js`、`drainage_display.js`、`drainage_worker.js`、`flood_detail.js`、`place_search.js`、`osm_basemap_themes.js` 及 `assets/`
- 预览：`preview.html`；测试：`node --test modules/00-london-map`
