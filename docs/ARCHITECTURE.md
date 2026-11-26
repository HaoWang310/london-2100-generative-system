# 系统架构与开发计划 · Architecture & roadmap

> **现在的样子 · As it stands (26 Nov 2026).** 下面写的是主界面最初的逐级计划。主界面现在只显示 00 伦敦地图和 01 Loop City（第 1 步整环），
> 02–06 五个模块还在 `modules/` 里、测试照跑，但 02–04 仍是占位算法，所以暂时关着（`app/registry.js` 里的 `ROAD_CHAIN = false`）。
> 同样的事现在由研究主线上的独立 app 用真实算法完成：伦敦地图 → 第 1 步 整环：黏菌与生长 → 第 2 步 毛线带 → 张量场工作室 → 结构工作室 → VR
> （`incubator/`，用 `shared/ui/chain.js` 的「下一步」连起来）。
> What follows is the main program's first plan, level by level. It now shows only 00 and 01; modules 02–06 are kept and tested
> but switched off, 02–04 being placeholders. The same work is done by the research line's own apps, with real algorithms.

## 1. 多尺度流程

| 层级 level | 模块 | 输入 | 输出 `children`（可进入下一级） | 主要道路层级 |
|---|---|---|---|---|
| `london` | 00-london-map | 无 | — | — |
| 模拟（任意层级可开） | 01-loop-city | 无（在后台打开孵化区的 Loop City 第 1 步页面） | — | — |
| `region` | 02-region-planning | 伦敦研究范围 | 规划区域 | `region-link` |
| `wool` | 03-wool-network | 选中的区域 | 局部区域 | `primary`、`branch` |
| `tensor` | 04-tensor-roads | 选中的局部区域 + Wool 主路约束 | — | `secondary`、`local` |
| 工具 | 05-road-integration | 当前区域 Wool + 所有 Tensor 道路 | — | `integrated` |
| 工具 | 06-catalogue-export | 任意结果 | — | — |

上一级结果通过 `childInput(parent, childId)` 变成下一级输入：子区域边界成为工作边界，上一级道路放入
`context.parentRoads` 作为约束，保证下级道路能接到上级主路上。

## 2. 标准数据接口 `ScaleBundle`

定义与校验：`shared/schemas/index.js`。所有坐标为 **EPSG:27700 米 `[E, N]`**；只有地图显示与 WGS84 导出时才转换。

```
{ schema, schemaVersion, id, level, parentId, crs: 'EPSG:27700',
  boundary, roads[{id, hierarchy, coords}], nodes[{id, xy, kind}], edges[{id, from, to, roadId}],
  children[{id, label, boundary, centre}], context{parentRoads, …}, scenario{…参数},
  algorithm{module, id, version}, stats{…}, createdAt }
```

`validateBundle()` 会拒绝错误坐标系（例如误传经纬度）、重复 ID、不完整几何。

## 3. 工作空间状态

`shared/state`：每个（层级, 输入）保存一份参数、状态和结果；逐级进入/返回只改变路径，不删除结果；
上级重新生成时，下级结果标记为“基于旧版本”而不是被清空。**地图缩放与状态完全无关**，不会清空或重新生成模型。
状态自动保存在浏览器，也可以“保存工作空间”为 JSON 文件备份或换设备继续。

## 4. 坐标精度

`shared/geo-core/epsg27700.js`：OS 横轴墨卡托公式（与 OS 官方算例误差 < 1 cm）+ Helmert 七参数（绝对精度约 2–5 m）。
反算经迭代修正，往返误差 < 0.1 mm。如需亚米级精度，后续接入 OSTN15 格网改正。

## 5. 版本与部署

- `main` 每次合并 → GitHub Actions 测试 → 构建 → 发布到 GitHub Pages
- `/version.json`：App 每 5 分钟检查一次，有新版本时提示“刷新”
- `/releases/<版本>-<提交>/`：最近 20 个历史版本，可在右上角版本菜单回退
- 所有相对 import 自动加 `?v=<提交>`，避免新旧文件缓存混用

## 6. 分阶段计划

| 阶段 | 内容 | 状态 |
|---|---|---|
| P0 | 框架、接口、状态、中英、版本、部署、6 个模块占位与独立预览 | ✅ 完成 |
| P1 | 迁入 google-map-live 地图层：地形、洪涝、汇水、排水网络、搜索、3D 建筑 | 待开始 |
| P2 | 02 区域划分真实算法（降雨 / 地形 / 汇水 / 洪涝 / 连接度加权） | |
| P3 | 03 接入原 Wool 羊毛算法（区域边界、吸引点、障碍、连接节点） | |
| P4 | 04 接入原张量场算法（以 Wool 道路、地形、水系为约束） | |
| P5 | 05 交叉口拆分、层级整合、街区划分 | |
| P6 | 06 方案目录、多方案对比、单 HTML 打包 | |
| 并行 | `incubator/` 独立 app 迁入与逐个融合 | |

**孵化区直连（01 Loop City）**：模块不复制模型，运行时在后台打开孵化区的 `incubator/loop-city-mould-growth/`，读它的引擎和结果（不 `import`），
孵化区改好主程序即跟随；模块测试同时校验这条链接。地图图层通过 `viewer.addOverlay()` 接入，网格按 EPSG:27700 精确换算到地图。

已有算法迁入方式：原文件**原样**放入对应模块的 `legacy/`，在 `module.js` 中写适配层，不删减原有功能。
