# London 2100 — Multi-Scale Generative Urban System
# 伦敦 2100 · 多尺度参数化城市生成系统

一个在统一地图工作空间中，从伦敦全域逐级生成城市路网的设计软件：

```
伦敦真实地理 (00) → 大区域划分 (01) → Wool 羊毛算法区域主路 (02)
                → Tensor 张量场局部道路 (03) → 路网整合 (04) → 方案输出 (05)
```

- 计算坐标系：**EPSG:27700**（英国国家格网，米），仅在地图显示时转换为 WGS84
- 地图：MapLibre GL + OpenStreetMap / OpenFreeMap，预留 Google Maps 接口
- 界面：中文 / English 一键切换，默认中文
- 无构建步骤：浏览器原生 ES Modules，GitHub Pages 直接发布

## 仓库结构

| 路径 | 用途 |
|---|---|
| `app/` | 统一 App 外壳：左侧模块导航、中央地图、右侧参数面板、底部时间轴 |
| `modules/00-london-map` … `05-catalogue-export` | 六个功能模块，每个可独立运行、预览和测试 |
| `shared/geo-core` | EPSG:27700 坐标转换与几何计算 |
| `shared/schemas` | 模块之间的标准数据接口 `ScaleBundle` |
| `shared/state` | 多尺度工作空间状态（逐级进入 / 返回，保留各级结果） |
| `shared/i18n` | 中英文词典与切换 |
| `shared/map-viewer` | 地图视图封装（MapLibre，失败时自动退回离线矢量视图） |
| `shared/ui` | 公共 UI 组件（参数面板、提示等） |
| `incubator/` | 孵化区：合作者已有的独立 app 先放这里各自运行，之后再融合进 `modules/` |
| `tools/` | 工具脚本（模块隔离检查、单 HTML 打包等） |
| `docs/` | 架构与接口文档 |

## 本地运行

任意静态服务器即可，例如：

```sh
python3 -m http.server 8000
# 打开 http://localhost:8000/            统一 App
# 打开 http://localhost:8000/modules/02-wool-network/preview.html   单独预览某个模块
node --test                               # 运行全部测试
```

## 协作

见 [CONTRIBUTING.md](CONTRIBUTING.md)。

## 相关仓库

- [google-map-live](https://github.com/HaoWang310/google-map-live)：现有的伦敦地图、水文分析、张量场与 Wool 路网算法（v3.30.0），将逐步通过适配层迁入本仓库，原仓库保持不变。
