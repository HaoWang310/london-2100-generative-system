# 来源 · Source

Growth Variations v1 (`Growth Variations v1.html`), 2026-11-12. The file is unchanged here, renamed `index.html`.
The final outcome replays the release run of the Growth Simulator event by event. The variations are the release rules ported to JavaScript on the same 50 m grid. The data, the dark base layers and the English | 中文 words are all inlined in the page.

城市生长变体 v1，2026-11-12，原文件未改动，仅更名为 `index.html`。最终结果逐事件回放城市生长模拟器的发布版本；变体为发布规则在同一 50 米网格上的 JavaScript 移植。数据、深色底图与中英文文字均内嵌于页面中。

## 2026-11-13 · 加载优化 · Loading

The data that was inlined as base64 in the page is now in `data/` as the same bytes (raw deflate `.z`, PNG layers, the DM Sans font). The page fetches them: the final outcome first, the variation ground after. The code and the rules are unchanged; a variation with the release settings (`#test`) gives the same result as the original file. The original single file is in the git history (commit before this one).

原先以 base64 内嵌在页面中的数据，已原样拆到 `data/`（deflate `.z`、PNG 底图、DM Sans 字体），由页面按需载入：先载入最终结果，再载入变体数据。代码与规则未改；以发布参数运行变体（`#test`）的结果与原文件完全一致。原单文件版本保留在 git 历史中。

## 2026-11-13 · 界面 · Layout

Laid out like the London map: the map fills the window, a floating panel on the left holds the controls (mode, run, the magnet curves, every slider) and one on the right holds the display (playback, view, layers, the readout). Both panels collapse. The year and population sit in a pill at the bottom right. The rules and the data are unchanged.

界面改为与伦敦地图一致：地图铺满窗口，左侧浮动面板为控制（模式、运行、吸引力曲线、全部滑块），右侧浮动面板为显示（播放、视图、图层、数据）。两侧面板均可收起，右下角胶囊显示年份与人口。规则与数据未改。

## 2026-11-14 · 简化控制 · Simple controls

The 23 settings are now behind 11 plain controls and one button, with every original setting kept in a folded Advanced section. Where the engine only uses a ratio (the three weights, VEIN base and strength, adjacency base and reward: the draw ranks parcels, so scaling a pair together changes nothing, checked to the parcel), one control holds that ratio. The station fade distances and the density distances are scaled together; the slider limits stop before the land targets go unmet (mid rise beyond about 1,200 m, high rise beyond about 2,600 m, reach under 1.1, vertical band under 0.5). FIELD, the line's fade, contrast and the warp of the density rings are in Advanced only. Every control snaps to the release's exact values at its default, so the default run is unchanged. The engine is unchanged.

23 项设置改为 11 个简明控制加一个按钮，全部原始设置保留在默认收起的「高级设置」中。引擎只用到比例的参数（三个权重、VEIN 基数与强度、邻接基数与奖励：抽签只比较地块排名，成对同比缩放不改变任何地块，已逐格验证）合并为一个比例控制；车站衰减距离、中高层起始距离改为同比缩放，滑块上限停在用地目标仍能长满之处。FIELD、铁路线衰减距离、对比度、密度环扭曲只在高级区。每个控制在默认位置吸附到发布版精确数值，默认运行结果不变。引擎代码未改。
