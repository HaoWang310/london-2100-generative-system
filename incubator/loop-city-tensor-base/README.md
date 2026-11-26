# Loop City · 第 3 步 张量场底图 · Step 3, the base for the tensor field

> **远处的公园 · A park far from the parcels (26 Nov 2026).** 地块表里，离城市地块太远、张量场工作室画面装不下的公园用橙色标出：「离地块 1.9 km，在张量场画面外」。其余不变。 In the parcel table a park beyond Tensor Studio's view is marked in orange with its distance.

> **范例来自种子 2100 · The example is the run of seed 2100 (26 Nov 2026).** 内置范例地块换成第 2 步新范例里车站 P2 旁的三块相连的城市地块（C67.64、C67.65、C67.41，合计 180 ha）和公园 C67.122（`sample-parcels.js`）：跨度 2.02 km，用地 186.5 ha，3 个毛线路口锚点，带运行名 `s2100·n1bz` 和单元身份。锚点比旧范例（12 个）少，因为毛线带第二版的地块更大、地块之间的路口更少。 The built-in parcels are now three touching urban parcels by station P2 from step 2's new example, with a park: 2.02 km across, 186.5 ha, three anchors, carrying the run's name and the cell key.

> **一键进入张量场工作室 · On to Tensor Studio in one press (25 Nov 2026).** 「保存」里多一个主按钮「在张量场工作室打开」：把用地文件留在浏览器里，再在新窗口打开张量场工作室（`../tensor-studio/index.html#site`），它就在这几块地上开始。场地超过 3.6 km 或不到 2 公顷时按钮变灰。浏览器不让保存（无痕模式）时会提示改用「保存张量场用地文件」，再到张量场工作室里「打开用地文件…」。用地文件的格式没有变。 A main button, Open in Tensor Studio: the site file is left in the browser and Tensor Studio opened on it in a new window. Grey when the site is too wide or too small. The site file itself is unchanged.

> **运行名与单元身份 · The run and the cells' keys (25 Nov 2026).** 地块包带来的 `run`（运行名和种子）和 `cell_keys`（每个单元的身份）原样写进张量场用地文件，面板的「场地」里多一行「单元身份」。旧地块包没有这两项，显示「旧地块包」；范例来自较早的一次运行。只有运行名相同的地块才能拼在一起。 The `run` (its name and seed) and `cell_keys` a parcel package brings are written into the tensor site file, and the Site table has a Cell key row. An older package has neither. Only parcels of one run fit together.

> **手机界面 · The phone (23 Nov 2026).** 手机上换成统一的手机布局（`shared/ui/phone.css`、`phone.js`）：地图铺满屏幕，左上角「显示」打开外观和图层（整宽、上半屏），功能面板成为底部的卡，收起时留名称、所选地块和「保存张量场用地文件」。iPad 和电脑不变。只在手机模拟里验证过。 On a phone the page takes the shared phone layout: Display (top left) opens the look and the layers, and the process panel is a sheet along the bottom that folds to its name, the parcels and the save button. Checked in phone emulation only.

> **界面 · Interface (22 Nov 2026).** 与其他 app 统一：黑白、DM Sans、两个悬浮面板，读 `shared/ui/tokens.css`。`skin.css` 和 `skin.js` 只加面板头、所在步骤和返回第 2 步的按钮；每个控件的 id 与事件不变。图层色块保留颜色（地图的图例），不合格的数值用警告红。网址加 `#noskin` 显示原来的界面。 One interface with the other apps: black and white, DM Sans, two floating panels, reading `shared/ui/tokens.css`. The layer swatches keep their colour (they are the key to the map); a figure that fails shows in the warning red. `#noskin` shows the old interface.
>
> **范例 · The example (22 Nov 2026).** 单独打开时载入内置范例：车站 P2 旁的三块城区地块和一个公园（`sample-parcels.js`，由第 2 步的范例生成）。由第 2 步打开或用「打开地块包…」时用交来的地块。`?sample` 强制范例，`#nosample` 不载入。 Opened on its own, the page loads its example: three urban parcels and a park by station P2 (`sample-parcels.js`, made in step 2 from its own example).


显示第 2 步（毛线带，第 17 步）选出的城区地块和一起带上的公园，放在底图上，并保存张量场工作室读取的场地文件（另有 GeoJSON、DXF、PNG）。单独打开时用「打开地块包…」读入第 2 步保存的地块文件。公园保持为公园，张量场不在其上运行。

Shows the urban parcels picked in step 2 (the wool bands, step 17) and the parks taken with them on their base map, and saves the site file the tensor app reads (also GeoJSON, DXF, PNG). Opened on its own, use "Open a parcel package…" with the file saved in step 2. A park stays a park; the tensor field does not run on it.

**还没接上 · Not connected yet:** 张量场工作室目前还不能打开这个场地文件（下一阶段）。 Tensor Studio cannot open this site file yet (the next stage).

**来源：** 原为 `incubator/loop-city-wool-bands/`（2026-11-21）中的一页。2026-11-22 拆成一步一个孵化器 app：页面内容不变，只把「打开下一步」的那一行路径改成了新文件夹。

**Source:** one page of `incubator/loop-city-wool-bands/` (21 Nov 2026). On 22 Nov 2026 the chain was split into one incubator app per step: the page is unchanged except for the one line that opens the next step, which now points at the new folder.

## 链条 · The chain

| 步骤 | 文件夹 | 交给下一步 |
|---|---|---|
| 1 整环：黏菌与生长 | `incubator/loop-city-mould-growth/` | 单元包 `loop-city-cell-package` |
| 2 毛线带 | `incubator/loop-city-wool/` | 地块包 `loop-city-parcel-package` |
| 3 张量场底图 | `incubator/loop-city-tensor-base/` | 场地文件 `tensor-site-input` |
| 4 张量场工作室 | `incubator/tensor-studio/` | 街道 |
| 5 结构工作室 | `incubator/structure-studio/` | |

每一步可以自动打开下一步（浏览器询问时请允许弹出窗口），也可以把结果存成文件，到下一步里打开。规则和数据来源见 `incubator/loop-city-wool/README.md`、`SOURCE.md` 和 `docs/`。
