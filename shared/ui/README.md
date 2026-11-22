# shared/ui · 全部 app 共用的界面规则

`tokens.css` 是所有 app 界面层读取的一份变量：颜色、字体、圆角、面板宽度。改这里的一个值，所有 app 一起变。

规则（2026-11-22 定）：

- 界面只用黑、白和降低不透明度的白。
- 颜色只留给两样：给地图当图例的色块和配色选项；警告和错误（`--l2-warn`）。
- 地图和三维场景是内容，不算界面，不改。VR 不改。
- 字体全部 DM Sans；中文字形来自系统字体。
- 悬浮圆角面板：左边讲流程（步骤），右边管显示（播放、数据、视图、图层、导出）。
- 实心白 = 主操作和当前选中；白色描边 = 当前展开的步骤。

`studio.css` 是张量场工作室、结构工作室这一族（同一套类名：`#panel.ts-panel`、`.displayPanel`、`.pm*`）共用的一层，只改颜色、字体和圆角。

每个 app 自己的 `skin.css` / `skin.js` 只做一件事：把这个 app 原有的控件对应到这些变量和这个布局上，不改它的引擎。

The tokens every app's interface layer reads. Black, white and white at lower opacity only; colour is kept for map keys and warnings. DM Sans. Floating panels: the process on the left, the display on the right. Each app's own `skin.css` / `skin.js` maps its controls onto these tokens and this layout and leaves its engine alone.
