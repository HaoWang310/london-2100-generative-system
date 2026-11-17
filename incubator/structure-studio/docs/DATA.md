# 数据 · Data

## 输入：张量场快照 `*.snapshot.json`（format `structure-studio/snapshot@1`）

由 `scripts/export-snapshot.js` 在张量场工作室第 8 步完成后导出。坐标为本地米制：`BNG = 本地 + origin`（EPSG:27700）。

这是**第 1 步（张量场）交给第 2 步（结构）的数据**：以后在整个 app 里一步步推导时，上游直接把它交给 09，格式不变。
来源：09 里"从张量场工作室取结果"（读 `__ts6.roadNet()` 与 `fieldAtT`）、`scripts/export-snapshot.js`、或 09 的"导出快照"。

09 导出的快照另带两个可选字段：`name`（输入列表里的名字）、`structureParams`（当时的结构参数 P）；载入时一起恢复。
目前只记"结果"，不记张量场自己的种子和参数。

本机保存：IndexedDB 库 `structureStudio`，`inputs`（每份的名字、时间、路数、哈希、参数 P）与 `snaps`（快照本体，约 300 KB / 份）；
`localStorage.structureStudio.session` 记当前用的是哪份（`builtin` = 内置车站 P2）以及内置示例的参数。按路网内容去重。

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
| `name` · `structureParams` | 可选，09"导出快照"时附上的名字与结构参数 |
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
