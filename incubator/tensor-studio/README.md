# Tensor Studio · 张量场工作室

在线：https://haowang310.github.io/london-2100-generative-system/incubator/tensor-studio/

由等高线、全年风场与吸引点叠加成张量场，从锚点生长道路（v8 引擎，苹果风格界面）。
直接打开时运行原版的 **车站 P2 示例**（与 v8 单文件版结果一致：193 条道路、29 处涵洞、2 处环形广场）。

## 文件

| 文件 | 内容 |
|---|---|
| `index.html` | 页面、样式、中英文词典，以及启动脚本（取得场地数据后加载 `app.js`） |
| `app.js` | v8 生长引擎（原样），18 个图册预设，场地面板。改动处标有 `(site)` |
| `assets/station-p2.json` | 车站 P2 示例场地（v8 内嵌的 `D`，约 5 MB） |
| `assets/luton_wind.json` | London Luton 典型气象年：逐月风玫瑰 + 全年每 3 小时 |
| `scripts/site_builder.js` | 为任意伦敦选区生成 `D`（纯函数，无 DOM）：WGS84→BNG、土地 = 选区 − 水体（− 建筑）、锚点、涵洞 / 铁路区、等高线方向、8 向风 |
| `scripts/test_site_builder.mjs` | `node scripts/test_site_builder.mjs` |
| `integration/google-map-live-hook.js` | **参考，尚未接线**：从伦敦地图选区打开本 app 的入口代码 |

## 以后接到伦敦地图（google-map-live）

两边只通过一个对象通信，互不引用代码：地图页设置

```js
window.__TENSOR_SITE_INPUT__ = { ring, features, elevation, lang, close, fail };
```

再用同源 iframe 打开 `../tensor-studio/index.html`。本页检测到它，就用 `site_builder.js` 为该选区生成场地，
顶栏出现「返回伦敦地图」和「现有建筑：清除重建 / 保留绕开」。`?keep=1` 表示保留建筑。
接线步骤写在 `integration/google-map-live-hook.js` 开头。

## 限制

- 选区跨度 ≤ 3.6 km，面积 ≥ 2 公顷。
- 风暂用 Luton 一年（未按选区取风）；原版按 Global Wind Atlas 的局部风速未带过来，现仅按风吹入地块的衰减（L = 600 m）。
- 地形 OS Terrain 50（50 m）；伦敦大多平坦，平均坡度 < 0.8 % 时等高线权重按比例减弱。
- 图册、视频与原始脚本（v8 单文件版的「图册与视频 / 原始资料」）未放入本文件夹。
