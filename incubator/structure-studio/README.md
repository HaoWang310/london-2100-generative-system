# Structure Studio · 结构工作室（Linear Farm 走廊）

在线：https://haowang310.github.io/london-2100-generative-system/incubator/structure-studio/

在**张量场工作室生成的真实场地**上，生成一张架在街道之上的 **Linear Farm 种植工厂走廊网**：走廊 15–25 m 宽、顶面 3.6 m 一层，
两侧是建筑，走廊围出的"室"里是农田；种植塔落在核心节点上。默认打开车站 P2 示例（209 ha，张量场道路 149 条）。

Builds a network of planting-factory corridors (Linear Farm) over a site whose streets were grown in Tensor Studio. The corridors float
above the streets; buildings line both sides; the cells between them are farmland. Opens on the station P2 example.

## 怎么用

- 直接打开页面：载入 `assets/station-p2.snapshot.json`（张量场工作室第 8 步完成后的结果），约 3 秒生成。
- **左侧白色控制栏**改变结果：① 线网（核心、离路主线、疏密）② 拉扯 ③ 走廊（宽度、节点过渡、防细条、桥）④ 两侧建筑与农田。
- **右侧黑色视口**：平面 / 三维切换；张量场道路、主线、建筑、农田、种植塔可开关。
- **卡片墙**：每个室一张卡（面积、形态、建筑栋数），点卡片聚焦；"设为景观"去掉这个室的建筑。
- **导出**：GeoJSON（EPSG:27700，可直接叠回伦敦地图）、OBJ（Rhino）、JSON、平面 PNG。
- **换场地**：在张量场工作室里跑完全流程，把 `scripts/export-snapshot.js` 粘进浏览器控制台，会下载 `<场地>.snapshot.json`；
  在本页"载入快照…"选它即可。

## 文件

| 文件 | 内容 |
|---|---|
| `index.html` | 页面（控制栏、视口、卡片墙、导出） |
| `engine/structure.js` | 生成核心，纯函数，页面与测试共用 |
| `assets/station-p2.snapshot.json` | 车站 P2 的张量场快照 |
| `scripts/export-snapshot.js` | 在张量场工作室里导出快照 |
| `structure.test.mjs` | 在 P2 上的回归测试（`node --test`） |
| `docs/DESIGN.md` | 生成逻辑与设计规则 |
| `docs/DATA.md` | 输入快照与输出格式 |
| `docs/CHANGELOG.md` | 版本记录 |

## 与系统的关系

- 输入只来自张量场工作室公开的接口 `window.__ts6.roadNet()` 和场地数据，**不修改张量场工作室**。
- 融合进主程序时，在 `modules/` 里写适配器，直连本文件夹的 `engine/structure.js`（读取，不复制）。
