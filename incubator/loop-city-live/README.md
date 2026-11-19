# Loop City live

Three pages that work together, from the slime mould over the whole loop down to every junction of a cell's streets.

**Open `index.html`, or start with `01_Loop City - Mould and cells.html`.** Page 01 opens 02, and 02 opens 03, as you go. Both work from a double-click and on GitHub Pages.

1. **01 Mould and cells:** run the mould, then shift-click up to 10 neighbouring cells and double-click.
2. **02 Wool:** opens with your cells. Run the steps: the wool, the road hierarchy, parcels, capsule stops. Zoom in to see every road at its real width and every junction.
3. **03 Base for the tensor field:** at step 16 of 02, take parcels and double-click. Page 03 saves the site file for the tensor studio.

**Language:** EN | 中文, top left of every page. **Look:** dark or light, in the right panel.

For a Claude working on this app: read `CLAUDE.md`.

---

# Loop City 实时应用

三个协同工作的页面：从整个环线上的黏菌，一直到单元内每一条街道的路口。

**打开 `index.html`，或从 `01_Loop City - Mould and cells.html` 开始。** 01 会打开 02，02 再打开 03。双击本地打开或在 GitHub Pages 上都可以运行。

1. **01 黏菌与单元：** 运行黏菌，按住 Shift 点击最多 10 个相邻单元，然后双击。
2. **02 毛线：** 带着所选单元打开。依次运行各步：毛线、道路等级、地块、胶囊站点。放大即可看到每条道路的真实宽度和每个路口。
3. **03 张量场底图：** 在 02 的第 16 步选取地块并双击，03 会保存张量场工作室所需的用地文件。

**语言：** 每页左上角可切换 EN | 中文。**外观：** 右侧面板可选深色或浅色。

### Page 01 · Mould and cells

1. **Open** `01_Loop City - Mould and cells.html` by double-click. Allow pop-ups for it.
2. **Press Run the century.** The city and the slime mould grow together from 2025 to 2100, in about a minute. The mould's roads are held from 2065.
3. **When it ends,** the mould's highways and the cells they close appear. Press ▶ to replay the years.
4. **Click a cell** to zoom to it. **Shift-click** neighbouring cells to choose up to 10.
5. **Double-click** a chosen cell. The wool page (02) opens on it, in its own window.
6. **The left panel changes the result. The right panel is mostly the view,** and Mould look has six looks that leave the result unchanged.

**中文：**
1. 双击打开 `01_Loop City - Mould and cells.html`，并允许弹出窗口。
2. 按 “Run the century”：城市与黏菌一起从 2025 年生长到 2100 年，约需一分钟。2065 年起黏菌的道路保持不变。
3. 运行结束后显示主干道和它们围成的单元格；按 ▶ 可逐年回放。
4. 单击一个单元格可放大到它；按住 Shift 单击相邻单元格，最多可选 10 个。
5. 双击所选单元格，羊毛页面（02）会在新窗口中打开它们。
6. 左侧面板改变结果；右侧面板主要是显示设置，其中 “Mould look” 有六种外观，不影响结果。

## 02 Wool

- **Left panel:** the steps and what changes the result. **Right panel:** the look.
- **The steps:** step 11 reads the roads out of the wool. M roads are the loop highways only, and every other road is A, B or C. Step 15 places the capsule stops, and step 16 takes parcels for page 03.
- **Zoom in** with the wheel. Below 2.5 m per pixel each road is drawn at its real width (M 90, A 50, B 30, C 16 m). The loop road carries the fast line in its middle, the Superloop bus lanes, cycle tracks and footways.
- **Save PNG:** tick **with legend** to save the key beside the picture. Save GeoJSON is beside it.

## 02 毛线

- **左侧面板：** 各步骤及影响结果的设置。**右侧面板：** 外观。
- **步骤：** 第 11 步从毛线中读出道路：M 级只属于环线快速路，其余为 A、B、C 级。第 15 步布置胶囊站点，第 16 步为 03 选取地块。
- **放大：** 滚动鼠标。每像素 2.5 米以下按真实宽度绘制道路（M 90、A 50、B 30、C 16 米）。环线中央是快速线，两侧有 Superloop 公交专用道、自行车道和人行道。
- **保存 PNG：** 勾选 **含图例**，即可连同图例一起保存。旁边是保存 GeoJSON。

## 03 Base for the tensor field · 张量场底图

Shows the parcels you took on the base map and saves the **Tensor site** file (the site ring, roads, rails, water, buildings) for the tensor studio, with GeoJSON, DXF and PNG.

在底图上显示所选地块，并保存张量场工作室所需的 **Tensor site** 文件（用地边界、道路、铁路、水系、建筑），另可保存 GeoJSON、DXF 和 PNG。
