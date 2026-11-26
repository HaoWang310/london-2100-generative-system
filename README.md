# London 2100 — Multi-Scale Generative Urban System
# 伦敦 2100 · 多尺度参数化城市生成系统

一个研究伦敦 2100 年城市形态的设计系统：在伦敦全域的真实地理上，让黏菌与城市沿一条环线一起生长，再把选出的单元一步步生成道路、街道和结构。

```
研究主线（目录里的独立 app，用「下一步」连起来）
伦敦地图 → 第 1 步 整环：黏菌与生长 → 第 2 步 毛线带 → 张量场工作室 → 结构工作室 → VR

主界面「多尺度城市生成系统」（目录第 1 张卡片）
伦敦全域底图 (00) + 第 1 步整环的结果 (01)，叠在同一张真实地图上，可保存和打开工作空间
```

最初的计划是在主界面里一级级往下做：大区域划分 (02) → 毛线路网 (03) → 张量场道路 (04) → 路网整合 (05) → 方案输出 (06)。这五个模块仍在 `modules/` 里，测试照跑，但 02–04 还是占位算法，所以主界面暂时关着它们（`app/registry.js` 里的 `ROAD_CHAIN`）。同样的事现在由研究主线上的 app 用真实算法完成：第 1 步的单元取代按网格分区，毛线带和张量场工作室生成真实的道路。

- 计算坐标系：**EPSG:27700**（英国国家格网，米），仅在地图显示时转换为 WGS84
- 地图：MapLibre GL + OpenStreetMap / OpenFreeMap，预留 Google Maps 接口
- 界面：中文 / English 一键切换；默认跟随设备语言，所有 app 共用同一个选择
- 无构建步骤：浏览器原生 ES Modules，GitHub Pages 直接发布

**在线预览**：https://haowang310.github.io/london-2100-generative-system/
（各模块独立预览：`/modules/<模块>/preview.html`）

架构、数据接口与分阶段计划见 [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)；UI 设计参考与 Design / Motion System 草案见 [docs/DESIGN-REFERENCES.md](docs/DESIGN-REFERENCES.md)。

## 仓库结构

| 路径 | 用途 |
|---|---|
| `app/` | 统一 App 外壳：左侧模块导航、中央地图、右侧参数面板、底部时间轴 |
| `modules/00-london-map` … `06-catalogue-export` | 功能模块，每个可独立运行、预览和测试（`01-loop-city` 直连孵化区的 Loop City 第 1 步；`01-growth-simulator` 是它取代的旧版城市生长模拟，代码保留，不在导航中） |
| `shared/geo-core` | EPSG:27700 坐标转换与几何计算 |
| `shared/schemas` | 模块之间的标准数据接口 `ScaleBundle` |
| `shared/state` | 多尺度工作空间状态（逐级进入 / 返回，保留各级结果） |
| `shared/i18n` | 中英文词典与切换 |
| `shared/map-viewer` | 地图视图封装（MapLibre，失败时自动退回离线矢量视图） |
| `shared/ui` | 公共 UI 组件（参数面板、提示等） |
| `incubator/` | 孵化区：独立 app 先放这里各自运行，之后再融合进 `modules/` |
| `tools/` | 工具脚本（模块隔离检查、单 HTML 打包等） |
| `docs/` | 架构与接口文档 |

## 本地运行

任意静态服务器即可，例如：

```sh
python3 -m http.server 8000
# 打开 http://localhost:8000/            统一 App
# 打开 http://localhost:8000/modules/03-wool-network/preview.html   单独预览某个模块
node --test                               # 运行全部测试
```

## 开发

见 [CONTRIBUTING.md](CONTRIBUTING.md)。

## 相关仓库

- [google-map-live](https://github.com/HaoWang310/google-map-live)：现有的伦敦地图、水文分析、张量场与 Wool 路网算法（迁入时为 v3.30.0；本仓库孵化区内的伦敦地图现为 v3.44.1），将逐步通过适配层迁入本仓库，原仓库保持不变。
