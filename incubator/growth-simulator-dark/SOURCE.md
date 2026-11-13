# 来源 · Source

Growth Variations v1 (`Growth Variations v1.html`), 2026-11-12. The file is unchanged here, renamed `index.html`.
The final outcome replays the release run of the Growth Simulator event by event. The variations are the release rules ported to JavaScript on the same 50 m grid. The data, the dark base layers and the English | 中文 words are all inlined in the page.

城市生长变体 v1，2026-11-12，原文件未改动，仅更名为 `index.html`。最终结果逐事件回放城市生长模拟器的发布版本；变体为发布规则在同一 50 米网格上的 JavaScript 移植。数据、深色底图与中英文文字均内嵌于页面中。

## 2026-11-13 · 加载优化 · Loading

The data that was inlined as base64 in the page is now in `data/` as the same bytes (raw deflate `.z`, PNG layers, the DM Sans font). The page fetches them: the final outcome first, the variation ground after. The code and the rules are unchanged; a variation with the release settings (`#test`) gives the same result as the original file. The original single file is in the git history (commit before this one).

原先以 base64 内嵌在页面中的数据，已原样拆到 `data/`（deflate `.z`、PNG 底图、DM Sans 字体），由页面按需载入：先载入最终结果，再载入变体数据。代码与规则未改；以发布参数运行变体（`#test`）的结果与原文件完全一致。原单文件版本保留在 git 历史中。
