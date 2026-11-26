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

**手机（2026-11-23）。** `phone.css` 和 `phone.js` 是所有 app 在手机上的同一个布局（手机 = 触屏且短边小于 600 像素，与伦敦地图的判断一致；iPad 和电脑不变）：地图或模型铺满屏幕；左上角「显示」按钮，点一下显示面板从它下面展开（整宽，只占上半屏）；功能面板是底部的一张卡，收起时只留名称、当前状态和最常用的一两个按钮，点把手或 + 展开。两个面板不会同时打开。按钮不小于 44 像素。app 在页面头部给 `<html>` 加 `l2phone`，再在自己的 `skin.js` 里调用 `L2Phone.init({ sheet, display, title, status, quick, hide })`；面板里的控件原样搬进去，不改引擎。Loop City 第 1 步、伦敦地图和张量场工作室各有自己更早的手机代码，位置和尺寸与这里一致。

**配色选择（2026-11-25）。** `swatches.css` 是所有 app 选配色的同一个样子：黑色小卡片，三个圆点（这套配色最有代表性的三种颜色）加名字；选中的卡片 2 px 白框、名字变白。网格按面板宽度排列，浅色面板（`data-theme="light"`）用白卡。用到它的：毛线带（主 · 次 · 节点）、黏菌生长的外观（黏菌由淡到浓）和单元配色（城市 · 乡村 · 其他）、结构工作室平面（核心 · 中间 · 外围）和三维（地块核心 · 外围 · 道路）、张量场工作室（主 · 亮 · 最亮）、伦敦地图。只改选择器的样子，配色本身不变。

The tokens every app's interface layer reads. Black, white and white at lower opacity only; colour is kept for map keys and warnings. DM Sans. Floating panels: the process on the left, the display on the right. Each app's own `skin.css` / `skin.js` maps its controls onto these tokens and this layout and leaves its engine alone.

**Phones (23 Nov 2026).** `phone.css` and `phone.js` are the one phone layout (a touch screen under 600 px on its short side; iPads and computers are unchanged): the map or model fills the screen, a Display button at the top left opens the display panel under it (full width, upper half), and the process panel is a sheet along the bottom that folds to its name, its state and one or two main buttons. Only one of the two is open at a time. An app sets `l2phone` on `<html>` in its head and calls `L2Phone.init(...)` from its own `skin.js`; the controls are moved as they are and the engine is left alone.

## One language · 全站一个语言 (`lang.js`, 26 Nov 2026)

The home page, the whole system and VR keep the language in one place, `localStorage` `l2100.lang` (`shared/i18n/index.js`).
Each incubator app has a key of its own; `lang.js` joins it to the one place without touching the app's code:

```html
<script src="../../shared/ui/lang.js?v=1" data-key="myApp.uiLanguage" data-button='#langSw button[data-language="{lang}"]'></script>
```

as **the first script of the page**, so the app reads its key after it. The two values are the app's `embed.langStorageKey`
and `embed.langButton` in `incubator/catalogue.json` (`tools/tests/lang.test.mjs` holds them equal). On opening, the app's
key is set to the shared language (nothing chosen anywhere: the device's, Chinese for any Chinese and English for every
other). A change made in the app goes back to the shared place; a change made in another tab presses the app's own
button, so open pages follow at once. The app must keep `<html lang>` in step with its language, as all five do.

全站只记一个语言。每个 app 页面最前面加这一行，就和主页、多尺度系统、VR 用同一个语言：打开时拿到共用的语言，
自己切换时记回去，别的标签页切换时马上跟着换。新 app 只要加这一行，并在目录条目里写好 `langStorageKey` 和 `langButton`。

## The chain row · 统一的「上一步 / 下一步」 (`chain.css`, `chain.js`, 26 Nov 2026)

One line under an app's title, the same in every catalogue app: six marks for the research line (London map → 1 mould →
2 wool → Tensor Studio → Structure Studio → VR; until 26 Nov 2026 a step 3, the tensor base, stood between the wool and
Tensor Studio), the step before on the left, **Next** on the right in
white, and under them what goes with it or what is still missing (then Next is grey, with a link to the next app's example).
The whole system stands beside the line: no marks. (The real map stood beside it too until it was removed on 26 Nov 2026.)

```html
<link rel="stylesheet" href="../../shared/ui/chain.css?v=1"><script src="../../shared/ui/chain.js?v=2"></script>
<script>L2Chain.mount({ id: 'my-app', into: panel, before: firstThingUnderTheTitle,
  state: () => ({ ready, carry: ['en', '中文'], need: ['en', '中文'] }),   // only for a step that hands its result on
  go: () => myOwnHandOver() });</script>
```

Rules: Next opens the next app in a new tab (inside the catalogue: the catalogue showing that app), so the page stays and can
hand over again. The step before opens in this page, nothing carried. Framed by another app the row is hidden; framed by the
catalogue it goes through it. The order and the names live in `chain.js`; `tools/tests/chain.test.mjs` checks them.
