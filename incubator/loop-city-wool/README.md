> **2026-11-22 · 拆成一步一个孵化器 app · split into one incubator app per step.** 这个文件夹现在是第 2 步「毛线带」：`index.html`（原 02 页）和 `four-cells.html`（原 02b 页，已打开四个单元的演示）。第 1 步在 `incubator/loop-city-mould-growth/`（原 01 页），第 3 步在 `incubator/loop-city-tensor-base/`（原 03 页）。页面内容不变，只改了「打开下一步」的那一行路径；下面的说明里的旧文件名对应如上。

> **手机界面 · The phone (23 Nov 2026).** 手机上换成统一的手机布局（`shared/ui/phone.css`、`phone.js`）：地图铺满屏幕，左上角「显示」打开右侧面板的内容（整宽、上半屏），左侧面板成为底部的卡，收起时留名称、当前步骤和「上一步 / 下一步」。iPad 和电脑不变。只在手机模拟里验证过；这个页面本身占内存约 1 GB，在 iPhone 上仍可能被系统关闭，这一点还没有处理。 On a phone the page takes the shared phone layout: the map fills the screen, Display (top left) opens what the right panel holds, and the left panel is a sheet along the bottom that folds to its name, the current step and Back / Next. Checked in phone emulation only; the page still holds about 1 GB of memory, which an iPhone may not allow, and that is not dealt with yet.

> **界面 · Interface (22 Nov 2026).** 与其他 app 统一：黑白、DM Sans、两个悬浮面板，读 `shared/ui/tokens.css`。`skin.css` 和 `skin.js` 保留页面的每个控件（id 与事件不变），只移动几样：标题和语言切换进固定的面板头，十七个步骤下面加「上一步 / 下一步」，滑块收进「全部参数」，数据和保存移到右侧「显示」面板。颜色只留给毛线和道路的配色选项与图例。网址加 `#noskin` 显示原来的界面。 One interface with the other apps: black and white, DM Sans, two floating panels, reading `shared/ui/tokens.css`. `skin.css` and `skin.js` keep every control and move a few. `#noskin` shows the old interface.
>
> **修正 · Fix (22 Nov 2026).** 中文下「由毛线生成的路网」这一组滑块（第 11–17 步用）以前不会出现，旧的道路等级滑块也没有被隐藏：页面按英文标题找位置，换成中文后找不到。现在按 id 找。 In Chinese the group "The network, from the wool" (the sliders of steps 11 to 17) was never built and the older road-hierarchy sliders stayed on show: the page looked its headings up by their English text. They are now found by id.
>
> **打开更快 · Faster to open (24 Nov 2026).** 打开单元包从约 20 秒减到约 8 秒（本机，范例三个单元）：土壤切分后的碎片归并只扫碎片自己的格子，找名字位置只在地块外框里算。算好的结果存在浏览器里（最近 3 个），同一个单元包再打开约 1 秒；换了单元或代码有改动会自动重算，地址加 `#rebake` 可强制重算。算出的数据与改前逐字节相同，画面不变。 Opening a package went from about 20 s to about 8 s; the result is kept in the browser, so the same cells open again in about a second. The baked data is byte for byte the same.
>
> **粒子配色与显示面板 · Particle palettes and the display panel (24 Nov 2026).** 第 1–17 步换成一套画法：现状（城镇、现有道路、铁路、车站）一律白灰；算法生成的东西画成粒子和发光的路径，再整体泛光。五套配色（用户的色板）：01 石墨红、02 酸性黄绿、03 洋红电紫、04 深海铜蓝（默认）、06 森林青金，每套五个角色：背景、粒子、主路径、次路径、节点 / 场域。右侧「显示」面板按第 1 步的样式重做：播放、数据（大数字 + 4 行 + 位置小地图）、配色卡、光感（发光、粒子密度、线宽）、第 16 步才出现的道路宽度，以及折叠的图层（只列本步）、细节线宽、图例、导出；地图左下加了 −、+、适应。旧的毛线颜色、现有道路颜色、道路配色和深浅模式去掉了。路网、等级、选地块和单元包与改前逐项相同。地址里 `#pal=p1`…`p6` 可直接选配色。 Steps 1 to 17 drawn one way: what exists today in white and grey, what the method makes as particles and glowing paths with a bloom, in five palettes of five roles; the display panel rebuilt as step 1's. The network, its hierarchy, the parcels picked and the package are unchanged.
>
> **精简 · Removed (24 Nov 2026).** 删掉了已经不起作用的旧第 11–16 步：右侧「道路等级」一组（道路颜色、C/B/A/M 线宽、真实宽度、支线站点、第 12 步红色现有道路）、左侧 8 个旧道路等级参数、4 个旧图层（道路等级、倒角道路、地块、胶囊站点）、「读取道路」按钮、旧的分阶段读路面板和旧的选地块面板，以及只有它们用到的代码（旧读路、旧交通站点、放大后的路口细节、三段旧道路脚本和旧测试钩子），页面从约 11 000 行减到约 4 800 行。第 1–17 步的画面、数字、选地块和单元包与删之前逐项相同（深色、浅色各拍一遍）。地址里的 `#step=11` 到 `#step=17` 打开按钮上同号的步骤。 The older steps 11 to 16, which nothing reached any more, are gone with every control, layer and test that only they used (about 6 000 lines); steps 1 to 17 give the same pictures, numbers, picked parcels and package as before.
>
> **范例 · The example (24 Nov 2026).** 单独打开（没有交来单元）时载入内置范例：车站 P2 的单元和沿环线的两个相邻单元——西南 A3 机场站的单元和东侧一块农业单元（`sample-cells.js`，第 1 步按默认设置跑一次百年后导出的单元包 v2：C66 P2 + C60 A3 + C77）。载入后页面自己把各步运行一遍：第 3 步出现三个单元，第 4–9 步每步停一两秒，第 10 步实时松弛，第 11–16 步描出道路并分级，停在第 16 步；地图上方的提示条显示进度，「停止」或点任何按钮、拖任何滑块（语言和收起面板除外）都会停下，交还给你。只有范例会自动运行；由第 1 步打开或用「打开单元包…」时用交来的单元，和以前一样按「运行」。`?sample` 强制范例，`#nosample` 不载入，`#noauto` 载入但不自动运行，网址里自带 `#step=` 时也不自动运行。第 1 步每次运行的单元都不同，所以你自己跑出的编号和边界会和范例不一样。实测（本机，桌面尺寸，20 Mbps）：约 28 秒出现范例（其中烘焙约 20 秒），自动运行约 45 秒，约 74 秒停在第 16 步。`four-cells.html` 只是跳转到这里。 Opened on its own, the page loads its example: station P2's cell and its two neighbours along the orbital (A3's cell to the south-west, a farming cell to the east; a version-2 package from one default run of step 1), then runs the steps on it by itself and stops at step 16, with a small bar over the map; Stop, or any button or slider of yours, hands the page back. Cells from step 1 or a file wait for Run as before. `#noauto` keeps the example still.

> This folder is now step 2, the wool bands: `index.html` (page 02) and `four-cells.html` (page 02b). Step 1 is `incubator/loop-city-mould-growth/` (page 01) and step 3 is `incubator/loop-city-tensor-base/` (page 03). The pages are unchanged except for the one line that opens the next step. The file names below are the older ones.

# Loop City: from the whole loop to the parcel

Three pages that work as one chain. Each is a single self-contained HTML file: open it by double-click, no server, no install. English and Chinese (EN | 中文, top left of the map; the choice carries from page to page).

| Page | What it does |
|---|---|
| `01 Loop City - whole loop, mould and growth.html` | The slime mould and the city growth run together over the whole loop, reading the existing motorways and A roads. When the century ends, the cells are read from the mould's highways and cleaned by a rule. Pick one cell, or shift-click several. |
| `02 Loop City - wool bands.html` | The wool on the picked cells, in 17 steps: cells, soil, anchors, threads (opposite or alternate rule), relaxing, then the network read as bands, joined to the existing roads, tidied, parcels merged, parcels by use, road hierarchy at true widths, and the parcels to take on. |
| `03 Loop City - base for the tensor field.html` | The picked parcels on their base map, and the site file the tensor app reads. |
| `02b Loop City - wool bands, four cells already open.html` | Page 02 with four test cells (stations S1, A3, P2) already loaded, to try the wool without running the century first. |

## How to use it

1. Open page 01 and press Run. Allow pop-ups for the page when the browser asks: the other pages open from it.
2. Click a cell, shift-click neighbours to add them, then double-click or press "Open in the wool".
3. In page 02 go through the steps. Step 10: Run relaxes the wool. Steps 11 to 17 build the road network and the parcels, and step 17 takes parcels to page 03.
4. Step 17: click an urban parcel, shift-click for more, double-click to open them in page 03.
5. In page 03, save the site for the tensor field.

Keep the files in one folder: each opens the next by its file name.

## Rules built in

- Several cells stay several cells: each keeps its own edge as a 90 m boundary highway.
- Every existing road is one road with one class from end to end; a whole existing road is raised before a new one is made.
- Road hierarchy by spacing: boundary highway 90 m, primary road 60 m, A road 48 m, B road 24 to 30 m.
- Parcel use comes from the growth result handed over by page 01: urban where over half is built, farming where over half is farming, a park under 25 ha, kept open inside a protected landscape.
- Only urban parcels go to the tensor field. A park can be taken with them and stays a park.

## Notes for Hao

- **What this is next to `incubator/loop-city-live`:** the same three-page chain, with a new page 01 (it reads the existing roads; one cell system, cleaned by a rule, join by hand with undo) and a new method in page 02 (the wool read as bands, a road hierarchy by spacing, parcel use from the growth). The file names are new, and the pages open each other by these names.
- **For the tensor app:** page 03 writes the same site file as before (`tensor-site-input`, ring and features in WGS84, the same in British National Grid beside them). Two things are new:
  - `features.parks` and `bng.parks` list the parks taken with the parcels. They are outside the site ring unless urban parcels surround them. **The tensor app does not read this field yet; it should treat it as keep-out.**
  - The existing roads are already among `roads`, each with its class (the package says `existing_in_roads: true`), so page 03 no longer adds them a second time.
- **Road classes in the package** keep the letters the older page used: M = boundary highway 90 m, A = primary road 60 m, B = A road 48 m, C = B road 24 to 30 m. `width` is the true width in metres.
- **The rules in full** are in `docs/HANDOVER - parcels for the tensor field (rules).md`. The package the wool sends is `loop-city-parcel-package`, version 2; the cell package from page 01 is `loop-city-cell-package`, with a new field `growth` (the class grid of the growth result for the window).
- **Source:** the band method is the four script files in `source/`, with a note on how the page is put together.
- **Checked:** one headless run of the whole chain on these exact files (century, cells, a two-cell pick through all 17 steps, parcels read by page 03). The chain was also opened page to page in a browser by hand.
- **Not done, known:** the Chinese of the new labels is unreviewed; text drawn on the maps is English; page 02b shows one open road end in its four cells; the lane and junction detail of the older wool page (zoomed in) is not in the new steps; the site limits are unchanged (up to 3.6 km across, at least 2 ha).

## Data

Roads, towns and buildings: OS Open Zoomstack (OGL v3). Soil: Agricultural Land Classification (Natural England). Protected landscapes: Natural England. Rail: the Loop City railway.
