# 数据 · Data

## 输入：张量场快照 `*.snapshot.json`（format `structure-studio/snapshot@1`）

由 `scripts/export-snapshot.js` 在张量场工作室第 8 步完成后导出。坐标为本地米制：`BNG = 本地 + origin`（EPSG:27700）。

| 字段 | 内容 |
|---|---|
| `origin` `w` `h` | 本地坐标原点（BNG）与范围（m） |
| `pieces[]` | 场地各块土地：`outer` 外轮廓，`holes` 洞 |
| `water[]` | 水体（多边形，每个是若干环） |
| `streams[]` | 溪流中心线 |
| `attractors[]` | 吸引点 `{x, y, kind: main / sec}`，`main` 作为核心 |
| `roads[]` | 正式路网（`__ts6.roadNet()`）：`grade`（main / through / local）、`level`、`width`（12 / 9 / 6.5 m）、`pts` |
| `junctions[]` | 路口 `{x, y, type: T / X / Y / joint / dead end}` |
| `stats` | 路网统计（主路、次路 km，密度，路口比例） |
| `field` | 张量场主方向：`step` 米一格、`nx × ny`，每格一个字节 = 角度 × 254 / π（0–180°），255 = 场外；base64 |

## 输出

- **GeoJSON**（EPSG:27700）：`cell`（室，多边形）、`corridor centreline`（走廊中心线，带 `primary`、`width_m`、`deck_m`）、`planting tower`（点，带半径和高度）。
- **OBJ**：走廊顶面与侧面、建筑顶面与侧面（Y 向上）。
- **JSON**：参数、塔、节点、边（中心线）、室（名称、形态、面积、形心、建筑数、是否景观）。

## 引擎接口（`engine/structure.js`，浏览器里是 `window.SS`）

```js
const site = SS.prepareSite(snapshot);          // 场地栅格（2 m）、张量场采样、核心、主干路距离
const F = SS.buildStructure(site, params, excl); // 走廊网、室多边形 cellPolys、塔、统计、栅格
const M = SS.meshes(F, params);                  // 三维网格 { corridor, farm, bld }
const img = SS.planImage(F);                     // 平面底图 RGBA
```
