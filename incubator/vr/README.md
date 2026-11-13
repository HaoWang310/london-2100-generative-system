# London 2100 · VR / MR

在线：https://haowang310.github.io/london-2100-generative-system/incubator/vr/

London 2100 生成式城市系统的 VR / MR 设计文件夹，目标设备是 **Meta Quest 3S**。用 Quest 自带浏览器打开即可（WebXR），不需要安装 app。

- 这个文件夹**只读场景文件**，不引用其他 app 的代码，格式见 [`docs/SCENE-FORMAT.md`](docs/SCENE-FORMAT.md)。所以可以和 Tensor Studio 同时开发：那边继续改算法，这边改三维和交互，互不影响。
- 它和其他 app 在同一个网址下，以后可以直接读取正在运行的 Tensor Studio，不用再导出文件。

## 从伦敦地图进入 VR（v0.4，打通流程）

打开 **`map.html`**：https://haowang310.github.io/london-2100-generative-system/incubator/vr/map.html

它把伦敦地图（`../google-map-live/`）原样嵌进来，地图的所有功能照常可用，**地图主程序一行都没改**。VR 按钮在这个外层页面上（右下角坐标上方）：
1. 在地图上照常设置：搜索地点、开图层、选主题和光照、画场地边界……
2. 按 **VR**：地图会短暂转成正北朝上的平面，截下当前画面（开着的图层都在里面），再把地图已经载入的 OSM 建筑按 `render_height` 拉伸成体块。相机随即回到原来的角度
3. 三维沙盘覆盖在地图上：电脑上可以预览，Quest 上按「进入 MR」放到桌上，按 B 走进街道
4. 按「关闭」回到地图，所有状态都还在

建议缩放到 14–16 级再按（低于 13 级时地图不载入建筑，只有平面）。VR 里的地面是一张截图，在 VR 里不能改图层；要改就关掉 VR，在地图上改完再按一次。

外层页面怎么拿到地图：`src/map_bridge.js` 在地图页面自己的环境里再导入一次同一个 MapLibre 模块（拿到的是同一个 Map 类），临时包一下 `Map.prototype.fire`，等地图触发下一个事件时取得地图对象，然后马上还原。如果以后地图换了 MapLibre 的加载方式，只需要改这个文件。

另外，`?scene=osm:纬度,经度,半边长米` 可以不经过地图，直接从 OpenFreeMap 读取 OSM 数据生成场景（`src/osm.js`，顶栏菜单里有伦敦市中心）。

## 现有场景（v0.2）

- `index.html`：打开后显示 **Hydro Lab · 伦敦 70 公里**，顶栏的菜单可以切换场景：
  - `data/hydro-lab-70km.scene.json`：London map · Hydro Lab 的 70 公里研究圈，300 m 网格。OS Terrain 50 地形（高程默认放大 12 倍，伦敦太平了）、EA 洪水风险（河流海洋与地表水的较高等级）、汇水网络（上游面积 ≥ 1 / 10 / 100 / 1000 km²，颜色由浅到深）、大伦敦边界和 70 公里圈。用 `tools/build-scene-hydro-lab.py` 从 Hydro Lab 自己的资源文件生成。
  - `data/station-p2.scene.json`：Tensor Studio 车站 P2 示例按「立即生成」得到的 145 条道路、地形和洪水风险。
  - 换场景：`?scene=别的文件.json`，或者直接把场景文件拖进页面。英文界面：`?lang=en`
- 电脑上：三维预览。拖动旋转，滚轮缩放，右键平移。可以开关洪水风险、汇水网络、边界或现有街道，调高程放大倍数。
- Quest 3S 上：出现「进入 MR」按钮。
  - **MR 桌面沙盘**：开彩色透视，模型约 90 cm 宽，放在面前的桌子上
  - 握持键或捏合手指抓取模型；双手同时抓可以缩放、旋转
  - 右摇杆：旋转和缩放 · 左摇杆：升降
  - **A** 洪水风险 · **B** 在桌面和 1:1 漫游之间切换 · **X** 汇水网络（Tensor Studio 场景里是现有街道）· **Y** 把模型放回面前
  - **1:1 漫游**：站在真实尺度的地面上，脚下跟着地形起伏；左摇杆行走，按住越久越快（70 公里的场景里最快约 2,000 m/s），右摇杆每次转 30°
  - 左手上方有一张操作说明卡

完全不依赖外部库：`src/xr_view.js` 直接用 WebGL2 + WebXR 写成，地形、道路和底座的几何都由它生成。

头显部分在一个模拟的 WebXR 环境里跑过（抓取、双手缩放、按键、漫游都没有报错），但还没在真机上测过。

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
| `map.html` | 嵌入伦敦地图 + VR 按钮（地图本身不改） |
| `src/map_bridge.js` | 从嵌入的地图页面里找到 MapLibre 地图对象 |
| `src/from_map.js` | 截图、建筑、打开视图 |
| `src/osm.js` | OpenFreeMap 矢量瓦片解码、地面贴图、建筑体块 |
| `data/*.scene.json` | 场景；`data/scenes.json` 是顶栏菜单的列表 |
| `tools/build-scene-hydro-lab.py` | 从 `../google-map-live/assets` 生成 Hydro Lab 场景（需要 numpy 和 Pillow；参数是网格倍数，默认 6 = 300 m） |
| `tools/export-from-tensor-studio.mjs` | 无界面运行 Tensor Studio，导出场景（在本文件夹里运行） |
| `docs/SCENE-FORMAT.md` | VR 与生成系统之间的数据约定 |

## 接下来（建议）

1. 在 3S 上实际测试：模型大小、道路粗细、透视下的颜色
2. Hydro Lab：按菜单在 VR 里切换图层（汇水面积、排水网络阈值），从地图上框选区域导出更细的场景
3. 场景里加建筑体块和水面；为 1:1 漫游预设视点
4. 设计 VR 里的界面：方案切换（18 个图册预设）、指标卡
5. 主系统开发完后：在 Tensor Studio 里加「导出 VR 场景」按钮，或者让本视图直接读取正在运行的引擎（接口与 `src/scene.js` 相同）
6. 进一步：多人同看，或者在 VR 里看道路生长（需要把引擎放进 Web Worker）
