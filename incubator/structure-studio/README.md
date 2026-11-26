# Structure Studio · 结构工作室（Linear Farm 走廊）

> **一个语言 · One language for every app (26 Nov 2026).** 全站只记一个语言（`l2100.lang`，主页、多尺度系统和 VR 原来就用它）。本页最前面多一行 `shared/ui/lang.js`：打开时把这个共用的语言交给本应用自己的语言设置，在本应用里切换时记回共用的地方，别的标签页切换时本页马上跟着换。哪里都没选过时跟系统语言（中文系统显示中文，其他显示英文）。本应用自己的语言代码没有改。 One language is kept for the whole site (`l2100.lang`). The first line of this page, `shared/ui/lang.js`, gives it to the app's own setting on opening, takes the app's own change back, and follows a change made in another tab at once. Nothing chosen anywhere: the device's language. The app's own language code is unchanged.

> **统一的「下一步」· The chain row (26 Nov 2026).** 每个 app 左侧面板标题下有同一行（`shared/ui/chain.js`、`chain.css`）：六个小格是研究主线上的位置（伦敦地图 → 1 黏菌 → 2 毛线带 → 张量场工作室 → 结构工作室 → VR；26 Nov 2026 起毛线带直接交给张量场工作室，原来中间的第 3 步张量场底图已去掉），左边「‹ 上一步」在本页打开上一个 app，右边白色的「下一步」在新标签页打开下一个；下面一行小字写带什么过去，或者还差哪一步（这时按钮变灰，并给一个去看下一步范例的链接）。被别的 app 嵌在里面时这一行不显示。这里上一步是张量场工作室，下一步是 VR（不带数据：VR 用预先导出的场景）。另外，张量场工作室的「下一步 · 结构工作室」会用 `#from=tensor` 打开本页：本页直接读那个窗口里的路网，作为新的输入。「从张量场工作室取结果」不变。 Before, Tensor Studio; after, VR (nothing carried). Opened by Tensor Studio's Next (`#from=tensor`), this page reads the network standing in that window as its input. Take the result from Tensor Studio is unchanged.

> **来自 Loop City 地块的结果 · Results grown on Loop City parcels (25 Nov 2026).** 从张量场工作室取结果时，如果那块场地来自 Loop City 毛线带的地块（26 Nov 2026 前经第 3 步的用地文件），快照里多四项：`site: 'loop-city-parcels'`、`run`（第 1 步的运行名和种子）、`cells`、`cell_keys`（每个单元的身份）、`parcels`。输入的名称写成「C67 · P2 · 145 条路」，下面多一行运行名。结构算法不读这些字段；内置示例和以前保存的结果照常使用。 A snapshot taken from a Loop City site carries the run of step 1 and the cells' keys; the input is named by them. The structure itself does not read them.

> **开场短片 · The opening film (24 Nov 2026).** 打开页面时先播一部约 31 秒、五幕的短片，盖住载入和生成的等待，讲这一步在研究里做什么：① 地面：张量场长出的街道，路口大多是丁字口；② 问题：把主干和贯通路直接做成 20 m 走廊，只得到一块块街区——加宽的街道；③ 先例：Frei Otto 湿毛线，线并成束、节点成三岔（24 根线的模拟）；④ 规则：同一个场推出两张网（分解轴测：场、地面网、架空网、农田，四条关联逐条亮起）；⑤ 立起来：第 6 步的结构用 WebGL 画出——整张网升到真实标高、层间距拉开看坡道怎样把三层缝在一起、镜头推近大塔（完整的三片壳和外皮、三层退台塔座）、合回真实层高，最后淡回平面，正好接上页面停住的张量场画面（不再重播 00 / 01）。数字和线条都由当前打开的场地实算（`intro/data.js`），换场地照样成立。第 1–4 幕在后台线程里画（`intro/worker.js`），页面算结构时不卡；结构到第 3 幕末还没好就停在那里等。"跳过"或 Esc 随时关掉，结构好了以后"进入"或 Enter。每次打开都播（单独打开或从目录打开都播）；网址加 `#nointro`、`#noskin`、`?embed=1`，或系统"减少动态效果"时不播；生成流程里"▶ 开场短片"再看一遍。 On opening, a five-scene film of about 31 s covers the loading and tells what this step does: the streets the tensor field grew (mostly T-junctions); why corridors along them would only be wider streets; Frei Otto's wet wool threads; one field giving two nets (an exploded axonometric); and the step-6 structure standing up in WebGL — rising, its levels pulled apart to show the ramps weaving them, a close look at a tower, back to true heights and the plan, which is the page's own first picture. All of it is computed from the site that is open. Scenes 1–4 are drawn in a worker, so they keep moving while the page builds. Skip/Esc at any time; Enter once the structure is ready. Every visit, on its own or from the catalogue; not with `#nointro`, `#noskin`, `?embed=1`, or with reduced motion; "▶ Opening film" plays it again.

> **手机上平面图居中 · The plan centred on a phone (24 Nov 2026).** 手机上平面图原来画在屏幕外（模拟器全黑，iPhone 15 Plus 上只剩右上角一小块）：画图区域按"左面板右边缘到右面板左边缘"计算，而手机上的参数面板是整屏宽的底部卡，被当成了左面板。现在手机上的画图区域是整个屏幕宽度，从「显示」按钮下方到收起的底部卡上方，和张量场一样居中、缩放到正好放下；逐步生成时的步骤标题（如「01 张量场」）放在「显示」按钮下方并缩小，说明文字最多两行，打开显示面板时隐藏。比例尺和指北针按同一区域定位。只在手机布局下生效，电脑端不变（改动前后平面图和标题的位置相同）。改动在 `index.html`（`phoneRect()`）和 `skin.css`。

> **手机界面 · The phone (23 Nov 2026).** 手机上换成统一的手机布局（`shared/ui/phone.css`、`phone.js`，本 app 的接线在 `phone.js`）：模型铺满屏幕，左上角「显示」打开视图、视口、显示模式和图层（整宽、上半屏），功能面板成为底部的卡，收起时留名称、场地和「逐步生成 / 暂停 / 立即完成」；「室列表」按钮移到卡的上方，任一面板打开时隐藏。iPad 和电脑不变。布局只在手机模拟里验证过，三维画面在那里无法载入，需要在真机上看一次。 On a phone the page takes the shared phone layout (wired in this app's `phone.js`): Display (top left) opens the views, display modes and layers, the process panel is a sheet along the bottom that folds to its name, the site and the three run buttons, and the room-list button stands above the sheet. The layout was checked in phone emulation, where the 3D view could not load; it needs one look on a real phone.

> **界面统一（2026-11-22）。** 与其他 app 同一套界面：黑、白和半透明的白，DM Sans，读 `shared/ui/tokens.css` 和 `shared/ui/studio.css`；本 app 的变量在 `skin.css` 里对应到共用变量。只改颜色、字体和圆角，控件和引擎都没动。颜色只留给图例和警告。网址加 `#noskin` 显示原来的界面。


在线：https://haowang310.github.io/london-2100-generative-system/incubator/structure-studio/

在**张量场工作室生成的真实场地**上，生成一张架在街道之上的 **Linear Farm 种植工厂走廊网**：走廊 15–25 m 宽、层高 3.6 m（默认 2 层，顶标高 7.2 m），
走廊围出的"室"里是农田；跨过张量场街道、水面和铁路的段架空，桥下按顶标高留出净空。种植塔只放在张量场的主吸引点上（每个核心一座大塔，立在三层退台塔座的顶层 16.4 m 上；塔座三叶形、塔间三道弧形谷，盖过张量场的环岛，中心开天井，层间开敞）。沿走廊的建筑暂时不排，之后单独做成一个功能。默认打开车站 P2 示例（209 ha，张量场道路 149 条）。

Builds a network of planting-factory corridors (Linear Farm) over a site whose streets were grown in Tensor Studio. The corridors float
above the streets (street, water and rail crossings are bridged with a clearance set by the deck level); the cells between them are farmland;
planting towers sit on the tensor field's attractors and major junctions. Buildings are left out for now. Opens on the station P2 example.

## 怎么用

- 直接打开页面：载入 `assets/station-p2.snapshot.json`（张量场工作室第 8 步完成后的结果），约 3 秒生成。
- 界面与张量场工作室、伦敦地图统一：**左侧浮动参数栏**按生成流程分五步（核心与疏密、离路主线、拉扯、走廊与节点、方案），每步展开就是这一步的参数和说明；
  第 3 步可选 8 种生成模式（1 · 全局拉伸（默认）、2 · 局部场流线行、3 · 各向异性分格、4 · 放射蛛网、5 · 双向流线格网、6 · Frei Otto 湿毛线、7 · 叶脉生长、8 · 黏菌），第 5 步换随机种子得到另一种方案；
  **右侧浮动显示栏**是视图（平面 / 三维）、镜头、图层开关、图例、统计、导出和操作说明。
- **方案比较**（第 5 步，与张量场工作室统一）：设方案数（1–24）后自动试多个随机种子（或 8 种生成模式 + 细调），按 5 组自动打分排序；底部缩略图条点开预览，"用这个方案"采用。
- **开场**：载入场地后不直接显示结果，先播场地和张量场图底并停住；在每张步骤卡底部点"生成这一步 / 下一步"一步步生成，点已完成的步骤卡可退回去改。"立即完成"直接跳到完整结果。
- **底部室卡片条**：每个室一张卡（面积、形态、长宽比），点卡片聚焦；可在右侧图层里关掉。
- **导出**：GeoJSON（EPSG:27700，可直接叠回伦敦地图）、OBJ（Rhino）、JSON、平面 PNG。
- **换场地**：点"从张量场工作室取结果"，在弹出的张量场工作室里选场地、跑完全流程（第 8 步），再点"用这个结果"。
  也可以用"载入文件…"打开导出的快照（"导出快照"按钮，或在张量场工作室里运行 `scripts/export-snapshot.js`）。
- **周边环境**：红线以外画现状建筑、小路、现状主路、建成区（来自张量场工作室），作为压暗的城市背景；右侧图层"周边环境"可关。
- **只看张量场结果**：场地卡里的开关，隐藏结构和农田，只看输入的路网（主干 / 贯通 / 支路）、路口、吸引点，可叠张量场方向线，方便检查上游结果。
- **引导模式（下一步）**：每张步骤卡底部有"下一步"。点了以后画布播放下一步的生成过程，停在这一步的结果上，下一张卡自动展开；这时调这张卡的参数，画面停在原步骤实时更新；调好再点"下一步"。最后一张卡是"完成 · 转到三维"，结果按调过的参数生成。用来熟悉研究步骤。
- **逐步生成（演示）**：左侧"生成流程"下的"▶ 逐步生成"。按当前控制条的参数，从场地、张量场、核心、主线、布点、分格、清理、走廊、跨越、农田与种植塔一步步自动生成，最后转到三维；画布里有粒子特效和每步标题，下面对应的步骤卡依次展开、高亮。"暂停 / 继续"、"立即完成"（直接跳到结果）、演示速度 0.5–2×；拖动任何参数会停止演示并照常重算。"全屏演示"收起两侧面板，底部有时间轴（跳步、切换生成模式），Esc 退出；演示跟着第 3 步的"生成模式"（每次开场都是 1 · 全局拉伸）；全屏底栏换模式时第 3 步同步。
- **保存（输入）**：取来或载入的结果自动存在这台电脑的浏览器里（IndexedDB），出现在"输入"下拉里，每份记着自己的参数；
  打开 09 时回到上次用的那份，不用再跑张量场。"内置示例 · 车站 P2"始终在列表第一项。可改名、删除（点两次）；
  "导出快照"把当前输入连同参数下载成文件，换电脑或发给别人时用"载入文件…"打开，名字和参数一起恢复。
  清除浏览器数据、无痕窗口或换电脑时本机保存会丢失。仓库里的默认示例（自动测试也用它）暂不替换，结构设计定稿后再换。

## 文件

| 文件 | 内容 |
|---|---|
| `index.html` | 页面（控制栏、视口、卡片墙、导出） |
| `engine/structure.js` | 生成核心，纯函数，页面与测试共用 |
| `engine/deck.js` | 第 6 步：多层走道结构（规则 → 控制网格 → 细分曲面），读第 5 步的结果 |
| `engine/nav.js` | 三维视口导航（参考 Rhino）：旋转 / 平移 / 缩放 / 标准视图 / 缩放至全部的镜头数学 |
| `assets/station-p2.snapshot.json` | 车站 P2 的张量场快照 |
| `scripts/export-snapshot.js` | 在张量场工作室里导出快照 |
| `scripts/london-audit.js` | 伦敦全域检查：在线上伦敦地图页的控制台里运行，19 块真实场地 × 7 组参数，从地图到张量场到结构整条流程跑一遍，核对塔座、节点板、坡道板边的规则（用法见文件开头） |
| `structure.test.mjs` | 在 P2 上的回归测试（`node --test`） |
| `deck.test.mjs` | 第 6 步的回归测试 |
| `nav.test.mjs` | 三维视口导航的回归测试 |
| `robust.test.mjs` | 规则普适性测试：14 种条件（种子、生成模式、拉扯、核心位置、红线离塔很近）下塔座、走廊和坡道旁边板边的规则都要成立 |
| `intro/intro.js` | 开场短片：盖住载入、计时、跳过 / 进入、播完交给页面（`SSIntro`） |
| `intro/data.js` | 开场短片的数据：从快照、第 5 步、第 6 步实算（任意场地） |
| `intro/draw.js` | 开场短片的画面（第 1–4 幕、字幕、进度），后台线程和页面共用 |
| `intro/worker.js` | 后台线程：在 OffscreenCanvas 上画第 1–4 幕，结构没好就在第 3 幕末等 |
| `intro/scene5.js` | 第 5 幕：第 6 步的结构、塔座和塔，WebGL（页面自己的 three.js） |
| `intro/wool.json` | 第 3 幕的湿毛线模拟（`tools/build-intro-wool.mjs` 生成） |
| `intro.test.mjs` | 开场短片的数据和页面接线测试 |
| `docs/DESIGN.md` | 生成逻辑与设计规则 |
| `docs/DATA.md` | 输入快照与输出格式 |
| `docs/CHANGELOG.md` | 版本记录 |

## 与系统的关系

- 输入只来自张量场工作室公开的接口 `window.__ts6.roadNet()` 和场地数据，**不修改张量场工作室**。
- 融合进主程序时，在 `modules/` 里写适配器，直连本文件夹的 `engine/structure.js`（读取，不复制）。
