# 设计参考分析 · Design reference analysis

为 London 2100 Generative City App 的 UI / UX 升级准备的参考分析。分析对象：
[MotionSites](https://motionsites.ai/)、[MotionSites Studio](https://studio.motionsites.ai/)、
[Recent](https://recent.design/)、[Font In Logo](https://www.fontinlogo.com/)、[60fps.design](https://60fps.design/)。

> **说明**：本次分析基于各网站的页面结构、文字内容与公开介绍。抓取工具只能读取文字，读不到 CSS，
> 所以文中没有列出这些网站的具体字号、色值或动画参数。第 3 节的 Design System 数值是根据它们的设计取向，
> 结合本项目现有的 `shared/ui/theme.css`，**为我们自己制定**的，不是从这些网站复制而来。

---

## 1. 逐站分析

### 1.1 MotionSites — 电影感的第一印象

**它是什么**：AI 网站设计提示词与模板库（Hero、Landing、SaaS、Agency、3D、Dashboard…），每个模板都是一段可以直接生成网站的提示词。

**设计特征**
- 首屏一句大标题，中间用斜体强调一个词（“Unlock *your* AI Design Superpowers”）：靠字重和字形对比制造层级，不靠颜色。
- 模板大量使用循环视频背景（带淡入淡出）、渐变文字、液态玻璃（Liquid Glass）卡片、Logo 跑马灯，以及 Framer Motion 驱动的入场动画。
- 内容分类做得很清楚：Featured / Popular / Recent 三个排序标签，下面一行分类胶囊（Hero、SaaS、3D、Dashboard…）。
- 提示词规格极其精确：像素值、色值、字重、字距都写明。这种“规格先行”的做法值得学。

**对我们有用的**
- ✅ “规格先行”：我们的 Design System 也要写到数值级别，`theme.css` 里的 token 就是唯一来源。
- ✅ 排序标签 + 分类胶囊这种二级筛选，适合以后的方案目录（05）和图层列表。
- ✅ 首屏的克制：一句话加一个主操作。我们的“进入下一尺度”按钮就是这个主操作。
- ⚠️ 视频背景、渐变文字、大面积玻璃效果不要照搬。我们的“视频”是地图和实时生成动画本身，界面不能和它抢注意力，否则就成了营销页。

### 1.2 MotionSites Studio — 工具化的创作界面

**它是什么**：MotionSites 的在线创作工具。用户输入提示词或附加品牌素材（Attach），从模板库选择设计，“Start creating”生成。

**设计特征**
- 核心是一个类似对话框的输入区：标签（Designs）、浏览入口、附件、主按钮，四样东西全部收在一个控件里。
- 功能卡片用“循环短视频 + 一句标题 + 一个操作”的结构，每张卡只讲一件事。
- 深色星空背景的首屏，内容浮在上面。
- 画廊有排序分段控件（Featured / Popular / Recent）和类型标签（All / Apps / Sections）。

**对我们有用的**
- ✅ **一个控件只做一件事、一张卡只讲一件事**：右侧参数面板的每个分组都应当可以单独折叠，标题说清楚它控制什么。
- ✅ 分段控件（segmented control）作为模式切换的标准形态：2D/3D、网格/放射、WGS84/EPSG:27700 都用它。
- ✅ “循环小视频解释功能”：以后每个算法模块的说明可以配一段几秒的生成过程录屏或 GIF，用来做新手引导。

### 1.3 Recent（原 Godly）— 让作品成为界面

**它是什么**：每日更新的设计灵感画廊（网站、Launch Videos、App 截图、App 图标、OG 图片、品牌）。

**设计特征**
- 极简、以内容为先：界面本身几乎没有装饰，作品图块占据全部视觉。
- 信息层级：标题加一句标语 → 分类过滤 → 作品流。导航分“Browse”和“Resources”两组。
- 每个作品图块只带最少元数据：作者头像、名字、页数（“3 slides”）。
- 图片按尺寸分级加载（如 1200 / 2048 两档），首屏轻、细节按需加载。

**对我们有用的**
- ✅ **界面退后，地图与生成结果在前**，这是本项目最重要的原则。界面元素用黑白灰、细线、半透明，不使用彩色色块。
- ✅ 导航分组：左侧“尺度 / 整合与输出”分组已有雏形，后面还要加“图层 / 场景”。
- ✅ 元数据极简：卡片、列表项只显示 1–2 个关键数字，其余放进展开详情。
- ✅ 分级加载：与 google-map-live 现有的“总览图先显示、细节瓦片按需加载”思路一致，加载反馈也应遵循“先低清后高清”。

### 1.4 Font In Logo — 字体即品牌

**它是什么**：查询世界品牌 Logo 所用字体的数据库，按行业和衬线 / 无衬线分类，带 ⌘K 快捷搜索。

**设计特征**
- ⌘K 命令式搜索作为主要入口。
- 列表条目结构稳定：状态徽章（Verified / Closest Font…）→ 名称 → 字体 → 一句备注。
- 收录的极简科技品牌常用字体以几何 / 新怪诞无衬线体为主（如 Helvetica、Univers、Futura、Avenir、Circular、Product Sans 等）。

**对我们有用的**
- ✅ **字体决定专业感**：界面统一使用一套无衬线字体加一套等宽字体（数字和坐标），不混用第三套。
- ✅ **⌘K 命令面板**：适合复杂软件。可以搜索地名、跳转尺度、切换图层、执行“重新生成”，减少点击。
- ✅ 徽章体系：我们已有“占位算法”“EPSG:27700”“上级已更新”徽章，应统一成一套状态徽章规范。
- ✅ “London 2100” 字标（wordmark）可以参考这些品牌字体的气质：几何、克制、字距略收紧。

### 1.5 60fps.design — 微交互的词汇表

**它是什么**：收录优秀 App 动画与交互细节的视频库（2000+ 条），用 Framer 搭建。

**设计特征**
- 每条作品是一段循环短视频，命名规则统一为“App + 交互类型”，例如 “Revolut Card Ready Animation”。
- **最有价值的是它的分类法**，共 108 个筛选项，分四个家族：
  - **手势 Gestures**：Drag、Pan、Pinch、Scroll、Scrub、Slide、Tap、Long Press…
  - **模式 Patterns**：Empty State、Onboarding、Quick Actions、Timer…
  - **效果 Effects**：Blur、Draw、Glow、Morph、Parallax、Particles、Shimmer、Spring Physics、Stagger、Zoom…
  - **元素 Elements**：Bottom Sheet、Button、Map、Menu、Progress、Slider、Tabs、Toast、Tooltip…

**对我们有用的**
- ✅ 把它的分类法当作我们 Motion System 的清单，逐项决定要不要用、怎么用（见第 4 节）。
- ✅ 与本项目直接相关的条目：**Scrub**（时间轴拖动）、**Draw**（道路生长）、**Particles**（张量场 / 洪水粒子）、**Stagger**（区域依次出现）、**Zoom**（尺度切换）、**Shimmer**（加载占位）、**Spring Physics**（面板展开）、**Bottom Sheet**（手机端参数面板）、**Slider**、**Toast**、**Map**。

---

## 2. 综合出的设计原则

1. **画布为王**：地图与实时生成画布永远是视觉中心。所有面板都可以折叠、可以隐藏，且不遮挡生成内容的核心区域。
2. **界面黑白灰，数据才有颜色**：界面只用中性色；颜色只留给道路层级、张量场、粒子、洪水、地形等数据图层，而且统一采用低饱和度。
3. **规格先行**：所有颜色、字号、间距、圆角、阴影、动画时长与缓动都定义为 token，组件只引用 token。
4. **一个控件只做一件事**：每个参数分组有清楚的标题，可以折叠；常用参数在上，高级参数默认收起。
5. **动画是为了传达状态，不是装饰**：每段动画都要回答“发生了什么 / 从哪里来 / 到哪里去”。尺度切换要有空间连续感，道路生长要体现生成顺序。
6. **即时反馈**：任何操作在 100 ms 内要有可见反应（按下态、进度、骨架屏），长计算显示进度且可以取消。
7. **60 FPS 优先**：动画只改 `transform` / `opacity`；地图数据更新走 GPU 图层，不在动画帧里重建 GeoJSON。
8. **键盘与命令面板**：常用操作都能用键盘完成（⌘K、Esc 返回、Enter 进入、空格播放）。

---

## 3. Design System 草案（数值）

### 3.1 字体

| 用途 | 字体栈 | 说明 |
|---|---|---|
| 界面 | `-apple-system, "SF Pro Text", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", Inter, sans-serif` | 苹果设备上就是 SF Pro / 苹方，不需要额外加载字体 |
| 数字 / 坐标 / 参数值 | `ui-monospace, "SF Mono", Menlo, Consolas, monospace` + `font-variant-numeric: tabular-nums` | 拖动滑块时数字不会跳动 |

字号阶梯（px / 行高 / 字重）：

| Token | 尺寸 | 用途 |
|---|---|---|
| `--fs-display` | 28 / 1.15 / 600，字距 −0.02em | 尺度标题（如“伦敦全域”）、空状态 |
| `--fs-title` | 20 / 1.2 / 600，字距 −0.015em | 面板标题 |
| `--fs-body` | 13 / 1.45 / 400 | 正文、参数名 |
| `--fs-caption` | 11 / 1.35 / 500 | 说明、徽章、单位 |
| `--fs-eyebrow` | 11 / 1 / 500，字距 0.06em，大写 | 分组标签（英文时） |

### 3.2 颜色

**界面（只用中性色）**

| Token | 值 | 用途 |
|---|---|---|
| `--bg` | `#000000` | 最底层 |
| `--surface-1` | `#0f0f10` | 面板 |
| `--surface-2` | `#1a1a1c` | 输入框、按钮 |
| `--surface-3` | `#2a2a2d` | 悬停 / 选中 |
| `--glass` | `rgba(22,22,24,.72)` + `backdrop-filter: blur(24px) saturate(140%)` | 浮在地图上的面板 |
| `--hairline` | `rgba(255,255,255,.08)` | 分隔线 |
| `--text` / `--text-2` / `--text-3` | `#f5f5f7` / `#a1a1a6` / `#6e6e73` | 三级文字 |
| `--accent` | `#f5f5f7`（白） | 主按钮、选中。界面不再使用彩色强调色 |

**数据（低饱和度，统一明度）**：道路层级沿用 `shared/map-viewer/palette.js`，后续再为张量场、粒子、洪水深度、地形各定义一条连续色带，并统一验证在黑底上的对比度。

### 3.3 间距、圆角、层级

- 间距：4 px 基准，`4 / 8 / 12 / 16 / 24 / 32 / 48`。
- 圆角：控件 8，面板 14，浮动面板 18，胶囊 999。
- 阴影：只用于浮在地图上的元素，`0 12px 40px rgba(0,0,0,.45)`。
- 层级 z-index：地图 0 → 地图浮层 10 → 面板 20 → 弹出层 40 → 提示 50。

---

## 4. Motion System 草案

### 4.1 时长与缓动

| Token | 时长 | 缓动 | 用途 |
|---|---|---|---|
| `--motion-instant` | 80 ms | `linear` | 按下态、开关 |
| `--motion-fast` | 160 ms | `cubic-bezier(.2,0,0,1)` | 悬停、提示出现 |
| `--motion-base` | 240 ms | `cubic-bezier(.2,0,0,1)` | 面板展开、分段控件滑块 |
| `--motion-slow` | 420 ms | `cubic-bezier(.16,1,.3,1)` | 面板进出、页面过渡 |
| `--motion-camera` | 900 ms | 地图 `easeTo`，ease-in-out | 尺度切换的相机飞行 |
| 弹簧 | — | stiffness 380 / damping 32 | 可拖拽面板、Bottom Sheet |

`prefers-reduced-motion` 时：除相机移动外（改为 0 时长）全部关闭。

### 4.2 按 60fps 分类法逐项落地

| 类型 | 条目 | 在本项目中的用法 |
|---|---|---|
| 效果 | **Zoom** | 尺度切换：相机飞向选中区域，同时上一级内容淡出成灰色“幽灵线”，下一级内容渐入 |
| 效果 | **Draw** | 道路按层级依次“画”出：主路 → 分支 → 次干路 → 支路，由底部时间轴控制 |
| 效果 | **Stagger** | 区域划分结果按距中心远近依次出现，每块间隔 12–20 ms，总时长不超过 600 ms |
| 效果 | **Particles** | 张量场、洪水的粒子流，使用 GPU 绘制，粒子数随缩放级别自适应 |
| 效果 | **Shimmer** | 地图瓦片与数据图层加载时的占位微光 |
| 效果 | **Blur** | 只用于浮动面板的背景模糊，不用于内容 |
| 手势 | **Scrub** | 时间轴拖动实时回放生成过程，不触发重新计算 |
| 手势 | **Pinch / Pan / Drag** | 地图默认手势；普通缩放只移动相机，绝不清空或重新生成模型 |
| 元素 | **Slider** | 拖动时 GPU 预览，松手才提交计算（已实现：拖动 `input`，提交 `change`） |
| 元素 | **Bottom Sheet** | 手机和窄屏上，参数面板改为底部抽屉 |
| 元素 | **Toast** | 版本更新、计算完成或失败提示 |
| 模式 | **Empty State** | 尚未生成时给出一句说明和一个主操作 |
| 模式 | **Quick Actions** | ⌘K 命令面板 |

---

## 5. 布局方案（地图为中心、面板可隐藏）

```
┌──────────────────────────────────────────────────────────────┐
│ ● London 2100   伦敦全域 › R34 · Wool › L41 · Tensor   ⌘K  2D|3D  EN  v │  玻璃顶栏
├────┬─────────────────────────────────────────────┬───────────┤
│ 00 │                                             │ 参数面板   │
│ 01 │              地图 / 生成画布                  │ （可折叠   │
│ 02 │          （全出血，面板浮在上面）               │  可隐藏）   │
│ 03 │                                             │           │
│ ── │                                             │           │
│ 04 │                                             │           │
│ 05 │  [图例]                         [缩放 / 指南针] │           │
├────┴─────────────────────────────────────────────┴───────────┤
│ ▶  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  生长 68%   已生成 · 22 ms │  时间轴
└──────────────────────────────────────────────────────────────┘
```

- 左侧导航默认收成图标栏（56 px），悬停或按 `[` 展开。
- 右侧面板按 `]` 隐藏；隐藏后画布变为全宽，面板的最小化入口留在右上角。
- 快捷键 `F` 进入专注模式：只保留画布和时间轴。
- 1100 px 以下：左侧只显示图标。760 px 以下：参数面板变为 Bottom Sheet，时间轴固定在底部。

---

## 6. 升级的执行范围与顺序（供后续实施）

**只改**：`shared/ui/theme.css`、`shared/ui/index.js`（组件）、`app/app.css`、`app/main.js` 中的渲染与交互部分、`shared/map-viewer`（图层样式与过渡）、`shared/i18n` 文案，以及 `incubator/google-map-live` 的样式与交互层。

**不改**：任何 `module.js` 中的 `run()` 与算法、`shared/schemas`、`shared/geo-core`、`shared/state` 的数据结构、google-map-live 的计算脚本（`*_worker.js`、`hydro_tensor_*`、`parcel_*` 等）。升级前后用同一组输入跑测试并对比输出完全一致，作为“视觉升级不影响计算结果”的证据。

**顺序**
1. Token 化：把第 3、4 节写进 `theme.css`，现有组件改为引用 token。
2. 组件规范：按钮、分段控件、滑块、开关、折叠分组、徽章、提示、命令面板。
3. 布局：可折叠、可隐藏面板，专注模式，响应式（Bottom Sheet）。
4. 动效：尺度切换（Zoom + 幽灵线）、道路 Draw、区域 Stagger、加载 Shimmer。
5. 性能：动画帧预算检查（Chrome Performance 录制，60 FPS），粒子自适应。
6. 回归测试：`node --test` 输出比对 + 浏览器逐项交互检查 + 中英文全覆盖。

---

**来源**
- [motionsites.ai](https://motionsites.ai/)、[studio.motionsites.ai](https://studio.motionsites.ai/)、[recent.design](https://recent.design/)、[fontinlogo.com](https://www.fontinlogo.com/)、[60fps.design](https://60fps.design/)
- [MotionSites 是什麼？用 Prompt 就能產出高級動態網站的提示詞庫完整介紹 · rar.design](https://rar.design/posts/motionsites-ai-prompt-library)
- [MotionSites · jc-aiwiki](https://jc-aiwiki.pages.dev/ai-web-design/motionsites)
- [Recent.Design – Best Web Design Inspiration · UI UX Showcase](https://uiuxshowcase.com/resources/recent-design-best-web-design-inspiration/)
- [60FPS Design – Animation Inspiration · UI UX Showcase](https://uiuxshowcase.com/resources/60fps-design-animation-inspiration-for-mobile-web-apps/)
