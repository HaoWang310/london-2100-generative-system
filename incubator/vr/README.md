# London 2100 · VR / MR

在线：https://haowang310.github.io/london-2100-generative-system/incubator/vr/

London 2100 生成式城市系统的 VR / MR 设计文件夹，目标设备是 **Meta Quest 3S**。用 Quest 自带浏览器打开即可（WebXR），不需要安装 app。

- 这个文件夹**只读场景文件**，不引用其他 app 的代码，格式见 [`docs/SCENE-FORMAT.md`](docs/SCENE-FORMAT.md)。所以可以和 Tensor Studio 同时开发：那边继续改算法，这边改三维和交互，互不影响。
- 它和其他 app 在同一个网址下，以后可以直接读取正在运行的 Tensor Studio，不用再导出文件。

## 现在有什么（原型 v0.1）

- `index.html`：打开后显示 `data/station-p2.scene.json`，即 Tensor Studio 车站 P2 示例按「立即生成」得到的 145 条道路、地形和洪水风险。
  - 换场景：`?scene=别的文件.json`，或者直接把场景文件拖进页面。英文界面：`?lang=en`
- 电脑上：三维预览。拖动旋转，滚轮缩放，右键平移。可以开关洪水风险和现有街道，调高程放大倍数。
- Quest 3S 上：出现「进入 MR」按钮。
  - **MR 桌面沙盘**：开彩色透视，模型约 90 cm 宽，放在面前的桌子上
  - 握持键或捏合手指抓取模型；双手同时抓可以缩放、旋转
  - 右摇杆：旋转和缩放 · 左摇杆：升降
  - **A** 洪水风险 · **B** 在桌面和 1:1 漫游之间切换 · **X** 现有街道 · **Y** 把模型放回面前
  - **1:1 漫游**：站在真实尺度的街道里，左摇杆行走，右摇杆每次转 30°
  - 左手上方有一张操作说明卡

完全不依赖外部库：`src/xr_view.js` 直接用 WebGL2 + WebXR 写成，地形、道路和底座的几何都由它生成。

## 在 Quest 3S 上测试

1. 推送到 main 以后，等部署完成（一两分钟）。
2. 用 Quest 浏览器打开上面的在线地址，或者从主页目录里点「VR / MR · Quest 3S」。WebXR 必须用 HTTPS，GitHub Pages 正好满足。
3. 点「进入 MR」，允许访问空间数据。

## 文件

| 文件 | 内容 |
|---|---|
| `index.html` | 入口：载入场景，打开三维视图 |
| `src/xr_view.js` | 三维视图、WebXR 会话、手柄和手势交互、几何生成（`buildTerrain` / `buildRibbons` 是纯函数） |
| `src/scene.js` | 检查场景文件，并转换成视图需要的只读接口 |
| `data/*.scene.json` | 场景 |
| `tools/export-from-tensor-studio.mjs` | 无界面运行 Tensor Studio，导出场景（在本文件夹里运行） |
| `docs/SCENE-FORMAT.md` | VR 与生成系统之间的数据约定 |

## 接下来（建议）

1. 在 3S 上实际测试：模型大小、道路粗细、透视下的颜色
2. 场景里加建筑体块和水面；为 1:1 漫游预设视点
3. 设计 VR 里的界面：方案切换（18 个图册预设）、指标卡
4. 主系统开发完后：在 Tensor Studio 里加「导出 VR 场景」按钮，或者让本视图直接读取正在运行的引擎（接口与 `src/scene.js` 相同）
5. 进一步：多人同看，或者在 VR 里看道路生长（需要把引擎放进 Web Worker）
