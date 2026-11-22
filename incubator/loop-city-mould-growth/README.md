# Loop City · 第 1 步 整环：黏菌与生长 · Step 1, the whole loop: mould and growth

> **范例 · The example (22 Nov 2026).** 这一步的范例就是整条环线本身：打开后停在 2025 年，点「运行百年」开始。 The example of this step is the whole loop itself: the page opens on 2025; press Run the century.
>
> **界面 · Interface (22 Nov 2026).** 界面参照城市生长模拟器重新编排：`skin.css` 和 `skin.js` 把页面原有的控件搬进两个悬浮面板，左边是四张步骤卡（运行百年、提取单元、选单元、送往第 2 步）和「全部参数」，右边是播放、数据、视图、图层、导出。每个控件的 id 和事件都不变，引擎没有改动。网址加 `#noskin` 显示原来的界面。 The interface follows the Growth Simulator: `skin.css` and `skin.js` move the page's own controls into two floating panels, four step cards and a fold with every setting on the left, playback, readout, view, layers and export on the right. Every control keeps its id and handlers; the engine is untouched. `#noskin` in the address shows the old interface.
>
> **打开速度 · Loading (22 Nov 2026).** 18 张底图和图层原来写在网页里（20.1 MB），现在是 `img/` 里的无损 WebP（逐像素相同，共 7.8 MB），网页本身 1.7 MB；浅色底图在页面出现之后才下载。生长模型的第一遍（pass 1）改为页面显示之后分片计算，期间「运行百年」「重置」不可点。因此本页须通过网页服务器打开（GitHub Pages 或 `python3 -m http.server`），不能直接双击。 The 18 base images were inline (20.1 MB); they are now lossless WebP files in `img/` (pixel for pixel the same, 7.8 MB) and the page is 1.7 MB; the light map is fetched once the page is up. Pass 1 of the growth model now runs in slices after the page is shown; Run and Reset wait for it. The page must be served over http; it no longer opens from the disk.


黏菌与城市生长在整条环线上同时运行（2025–2100），读取现有的高速公路和 A 级道路。百年结束后，从黏菌的主干道读出单元并按规则清理。点一个单元，或按住 Shift 选多个相邻单元，双击（或按「在毛线页面中打开」）进入第 2 步；也可以「保存单元（文件）」。

The slime mould and the city growth run together over the whole loop (2025-2100), reading the existing motorways and A roads. When the century ends, the cells are read from the mould's highways and cleaned by a rule. Click a cell, shift-click neighbours, then double-click (or "Open in the wool") for step 2; or save the cells as a file.

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
