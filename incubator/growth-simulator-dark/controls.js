/* Growth variations: the controls and the words (14 Nov 2026).
   Shared by this page and the main workspace's 01 module, so both offer the same settings and the same text.
   GROUPS: every original setting (Advanced). SIMPLE: the plain controls; get(q) reads a settings object,
   set(q, v) writes into it, show(v, fmt, T) labels a value. UNDER: values where the land targets go unmet. */
/* EN | 中文: the page's words in Chinese. English is the key; anything missing stays English. */
var I18N = { zh: { "Choose the loop": "选范围", "A 412 km rail loop round London, in six zones, cut into 50 m parcels.": "围绕伦敦的 412 km 铁路环线，分成 6 段，切成 50 m 一格的地块。", "loop": "环线", "zones": "段", "of 50 m parcels": "50 m 地块", "Read the ground": "读地面", "Which parcels may be built, where the best soil lies, and where the towns, water and protected landscapes are.": "哪些地块可以建、最好的土壤在哪里，以及城镇、水面和受保护的风景区在哪里。", "buildable": "可建", "best soil": "最优农地", "towns": "城镇", "water": "水面", "Lay the railway": "铺铁路", "The loop, six radials into London and a high-speed line. Towns will grow round the stations on the loop.": "环线、6 条通往伦敦的放射线和一条高铁。城镇会围绕环线上的车站生长。", "radials": "放射线", "high speed": "高铁", "main stations": "个一级站", "smaller": "个二级站", "airports": "个机场", "Set the targets": "定目标", "32 streams of growth, each with the land it must fill and the year it starts. The existing towns already hold 3.3 million people.": "32 股增长，每股要长满的用地和开始的年份。现有城镇里已经住着 330 万人。", "streams": "股增长", "to build": "要建", "low": "低层", "starts": "启动", "Work out the pull": "算吸引力", "Every parcel gets a score: the pull of the stations and the line, fading with distance, times two patterns of noise and the weight on the best soil.": "每个地块算一个分数：车站和铁路线的吸引力随距离衰减，再乘上两种纹理噪声和最优农地的权重。", "First pass: where the city ends": "第一遍：城市长到哪里", "Year by year the parcels are drawn by lottery, weighted by the score, until every stream has its land. This fixes where the city ends in 2100.": "逐年按分数抽签选地块，直到每股增长都长满用地。这一遍确定 2100 年城市的边界。", "a lottery a year": "每年一轮抽签", "reach": "扩展", "beside the built": "贴着已建", "Lay out the farming": "布置农业", "Beyond that edge: a collar of vertical farms, and fields drawn to good soil.": "在这条边界之外：一圈竖向农场环带，农田优先选好土。", "fields": "农田", "vertical farms": "竖向农场", "Second pass: the city and its farms": "第二遍：城市与农田一起长", "Grown again, the farms in place; each town densifies outward from its station.": "放进农田再长一遍；每个城镇从车站向外逐步增密。", "mid rise beyond": "中层始于", "high rise beyond": "高层始于", "The result": "结果", "2100: who lives in the loop, how much is built and how much farmed. Roll another layout, or run a variation with your settings.": "2100 年：环城住了多少人，建了多少、种了多少。可以换一种布局，或用你的设置运行变体。", "people": "人", "built": "建成", "farmed": "耕作", "How the city is made": "生成流程", "Play the whole process": "播放全流程", "Stop": "停止", "Next": "下一步", "Start": "开始", "Start again": "重新开始", "Show the result": "生成结果", "Settings changed: the next step grows the loop with them.": "参数已修改：点「下一步」时按新参数重新生成。", "Walk through the steps with Next. Change the settings in a step, or leave them and go on with the defaults.": "用「下一步」逐步完成。每一步可以修改参数，也可以不改，直接下一步使用默认参数。", "Run the variation to update this step.": "运行变体后更新这一步。", "With every setting at its default, a variation grows the same totals as the final, year by year, but only about 60 % of its built parcels stand where the final's do. The lottery is drawn differently: each parcel holds one fixed ticket, so that a slider moves only what it controls.": "默认设置下，变体与最终结果每年的总量相同，但只有约 60 % 的建成地块位置重合。这是因为抽签方式不同：变体给每个地块一张固定的签，这样拖动一个滑块只会改变它所控制的部分。", "How each pull fades with distance": "每种吸引力随距离衰减", "Every setting of the original, one by one. The controls above move these; change one here alone and the control above it shows Custom. A red stretch on a slider marks values where less is built than planned.": "原版的每一项设置。上面的控制会同步改动这里；只在这里单独改一项时，上面对应的控制会显示“自定义”。滑块上的红色段表示：调到这里会长不满，建成量少于计划。", "Here the land targets are not met: less is built than planned.": "这里会长不满：建成量少于计划。", "Where the city grows": "城市往哪里长", "How hard the stations and the railway pull, and how far.": "车站和铁路线的吸引力有多强、能拉多远。", "Smaller stations, against the main ones": "二级站的分量（相对一级站）", "no pull": "不吸引", "as strong": "一样强", "The railway, against the main stations": "铁路线的分量（相对一级站）", "towns round stations": "围绕车站成团", "a ribbon along the line": "沿铁路长成带", "How far the stations reach": "车站影响范围", "halves at": "减半于", "close": "近", "far": "远", "The shape": "城市的形态", "How the edge frays, how far a town spreads, how tightly it packs.": "边缘有多破碎、组团铺多开、建得多密实。", "Fingers along the threads": "边缘沿细丝伸出指状", "smooth edge": "边缘平滑", "long fingers": "长指状", "How far a town spreads": "组团铺开的范围", "Building beside what is built": "贴着已建区生长", "scattered": "分散", "solid": "密实", "Land and height": "土地与高度", "The best farmland, and how far from a station the city may rise.": "最好的农田，以及离车站多远才能盖高。", "Building on the best farmland": "在最好的农田上建城", "protect it": "保护", "treat it as any land": "和普通土地一样", "How far from a station it rises": "离车站多远开始盖高", "mid": "中层", "high": "高层", "further out": "更远", "Farming": "农业", "Fields and vertical farms, placed against the city's final edge.": "农田和竖向农场，沿城市最终边缘布置。", "Fields seek good soil": "农田优先找好土", "anywhere": "随处", "good soil first": "好土优先", "Fields on good soil near the railway": "铁路旁好土上的农田", "Width of the vertical-farm collar": "竖向农场环带宽度", "Another layout": "换一种布局", "Same rules, another roll of the dice. The release is layout 42.": "规则不变，重新掷一次骰子。发布版是第 42 号布局。", "Roll another layout": "随机换一种", "The release's layout": "回到发布版布局", "Layout": "布局", "the release": "发布版", "Custom": "自定义", "Advanced settings": "高级设置", "settings of the original": "项原始设置", "How each magnet fades": "吸引力随距离衰减", "Seed 42 · the release run · 50 m parcels": "种子 42 · 发布版本 · 50 米地块", "Mode": "模式", "Display": "显示", "Playback": "播放", "View": "视图", "Readout": "数据", "2025, the start: the release run before it grows. Press Play to watch it grow to 2100, or turn a setting and press Run variation.": "2025 年，起点：发布版本生长之前的状态。点击播放观看它生长到 2100 年，或调整设置后点击运行变体。", "Loading the final outcome…": "正在载入最终结果…", "Could not load the data files. Open this page through a web server (GitHub Pages or a local server), not as a file.": "无法载入数据文件。请通过网页服务器打开（GitHub Pages 或本地服务器），不要直接双击文件打开。",
  "Growth variations": "城市生长变体",
  "Loop City, 2025 to 2100. The final outcome, and what the same rules give when one of them is turned.": "环城，2025 至 2100 年。最终结果，以及调节其中一条规则时，同一套规则会给出什么。",
  "Final outcome": "最终结果", "Variation": "变体", "Final": "最终", "Run variation": "运行变体", "Reset to final": "恢复最终结果",
  "Play": "播放", "Pause": "暂停", "Slow": "慢", "Normal": "正常", "Fast": "快", "Flip to final": "切换到最终", "Flip to variation": "切换到变体", "PNG": "导出 PNG",
  "people living in the loop": "环城居住人口", "Land": "用地", "Against the final": "与最终结果对比", "The three magnets": "三种磁力", "Layers": "图层",
  "The release run of the Growth Simulator, cell for cell (50 m). Drag to move, scroll to zoom, double-click to fit. Space plays; F flips between the variation and the final.":
    "城市生长模拟器的发布版运行，逐格（50 米）。拖动平移，滚轮缩放，双击复位。空格键播放；F 键在变体与最终结果之间切换。",
  "Where growth is pulled: each station and the line, by weight and by the distance over which the pull fades.": "生长被吸引的方向：每个车站和铁路线，按权重以及吸引力衰减的距离。",
  "Primary station, weight": "一级车站，权重", "Primary station, fades over": "一级车站，衰减距离", "Secondary station, weight": "二级车站，权重",
  "Secondary station, fades over": "二级车站，衰减距离", "The line, weight": "铁路线，权重", "The line, fades over": "铁路线，衰减距离",
  "Two patterns of noise": "两种噪声图案",
  "FIELD, a slow drift, and VEIN, branching threads, multiply every score; the warp bends distance from the station.": "FIELD（缓慢漂移）与 VEIN（分叉细丝）与每个得分相乘；扭曲使到车站的距离弯曲。",
  "FIELD, base": "FIELD，基数", "FIELD, strength": "FIELD，强度", "VEIN, base": "VEIN，基数", "VEIN, strength": "VEIN，强度", "Warp of the density rings": "密度环的扭曲",
  "The draw": "抽签", "Each year's parcels are drawn by lottery, weighted by the score.": "每年的地块按得分加权抽签选出。",
  "Reach of a node": "节点的扩展范围", "Contrast, the power on the score": "对比度，得分的幂", "Adjacency, base": "邻接，基数", "Adjacency, reward": "邻接，奖励",
  "The ground": "地面", "The weight the city gives the best soil, grade 1 and 2.": "城市对最好土壤（1、2 级）赋予的权重。", "City on the best soil": "城市占用最好土壤",
  "Density": "密度", "How far from the station mid and high rise may begin.": "中高层可以从距车站多远处开始。",
  "Mid rise may begin beyond": "中层开始于", "High rise may begin beyond": "高层开始于",
  "Farming": "农业", "Fields and vertical farms, placed against the final edge. The two settings for good soil near the line are new; at 0 the release is unchanged.":
    "农田与垂直农场，沿最终城市边缘布置。铁路线附近好土壤的两项设置是新的；为 0 时发布版不变。",
  "Fields drawn to good soil": "农田趋向好土壤", "Good soil near the line, pull": "铁路线附近好土壤，吸引力", "Good soil near the line, reach": "铁路线附近好土壤，范围", "Vertical band, width": "垂直农场带，宽度",
  "Chance": "随机", "The seed draws the noise and the lottery. Seed 42 uses the release's own noise.": "种子决定噪声与抽签。种子 42 使用发布版自己的噪声。", "Seed": "种子",
  "Turn it": "调节", "Whole loop": "整个环城", "Spine": "脊线", "the line as a magnet against the node": "铁路线相对节点的吸引", "Vein": "细丝", "how strong the threads are": "细丝的强度",
  "Reach": "范围", "how far a node spreads for its land": "节点为其用地扩展多远", "Contrast": "对比度", "the power on the score": "得分的幂",
  "Adjacency": "邻接", "the reward for building beside fabric": "紧邻已建城市的奖励", "Soil": "土壤", "the weight on the best soil": "最好土壤的权重",
  "Promotion": "升级", "how far out density may begin": "密度从多远处开始", "Vertical band": "垂直农场带", "the collar of vertical farms": "垂直农场的环带",
  "same rules, another layout": "同样规则，另一种布局",
  "node city": "节点城市", "as run": "发布版", "ribbon city": "带状城市", "off": "关闭", "hard": "强", "tight": "紧凑", "loose": "松散", "flat": "平缓", "greedy": "贪婪",
  "weak": "弱", "strong": "强", "protected": "保护", "ignored": "忽略", "at the station": "在车站", "a far ring": "远环", "narrow": "窄", "wide": "宽",
  "seed 7": "种子 7", "seed 42": "种子 42", "seed 2026": "种子 2026",
  "National Landscape": "国家景观区", "Existing towns": "现有城镇", "Towns the loop absorbs": "被环城吸收的城镇", "Water": "水体", "Roads": "道路", "Green Belt boundary": "绿带边界",
  "Magnet field, the invisible landscape": "磁力场，看不见的景观", "FIELD, the slow drift": "FIELD，缓慢漂移", "VEIN, the threads": "VEIN，细丝", "Growth": "生长",
  "The final's edge": "最终结果的聚落边缘", "Rail": "铁路", "Stations": "车站", "Station names": "车站名称", "Zone lines": "分区线",
  "High rise": "高层", "Mid rise": "中层", "Low rise": "低层", "Fields": "农田", "Vertical farms": "垂直农场",
  "Primary": "一级", "Secondary": "二级", "The line": "铁路线", "Open circles: where each pull has halved.": "空心圆：每种吸引力减半之处。",
  "Variation (earlier settings)": "变体（先前的设置）", "Loading the model's ground…": "正在载入模型的地面数据…", "Growing the loop…": "环城正在生长…",
  "First pass: finding where the city ends": "第一遍：找出城市的边界", "Second pass: the city and its farmland": "第二遍：城市及其农田",
  "Grown in": "生长用时", "built": "建成", "farmed": "耕作", "people": "人",
  "Back to the final outcome. Every setting is at the release's value.": "已回到最终结果。所有设置均为发布版数值。",
  "The final outcome: the release run, cell for cell. Turn a setting and press Run variation.": "最终结果：发布版运行，逐格显示。调节一项设置，然后点击“运行变体”。",
  "Settings changed. Press Run variation to grow the loop with them.": "设置已更改。点击“运行变体”，用新设置让环城生长。",
  "Run a variation to compare it with the final: where it lands, how much stays in place.": "运行一个变体，与最终结果对比：它落在哪里，有多少保持原位。",
  "of the variation's built parcels stand where the final has built parcels": "变体的建成地块位于最终结果建成地块之处",
  "Fabric on the best soil": "建成区位于最好土壤", "Farming on the best soil": "农业位于最好土壤", "Fabric within 2 km of the line": "距铁路线 2 公里内的建成区",
  "High rise, median distance from a station": "高层到车站的中位距离",
  "Farming on good soil within 5 km of the line": "距铁路线 5 公里内、位于好土壤的农业"
} };

var GVC = (function () {
  var GROUPS = [
    { id: "mag", t: "The three magnets", note: "Where growth is pulled: each station and the line, by weight and by the distance over which the pull fades.",
      s: [["wP", "Primary station, weight", 0, 6, 0.1, 1], ["dP", "Primary station, fades over", 2000, 20000, 500, "km"],
          ["wS", "Secondary station, weight", 0, 4, 0.1, 1], ["dS", "Secondary station, fades over", 1000, 15000, 500, "km"],
          ["wR", "The line, weight", 0, 3, 0.05, 2], ["sR", "The line, fades over", 300, 5000, 100, "km"]],
      pre: [["Spine", "the line as a magnet against the node", [["node city", { wR: 0, sR: 1500 }], ["as run", { wR: 0.6, sR: 1500 }], ["ribbon city", { wR: 2.0, sR: 3000 }]]]] },
    { id: "noise", t: "Two patterns of noise", note: "FIELD, a slow drift, and VEIN, branching threads, multiply every score; the warp bends distance from the station.",
      s: [["fa", "FIELD, base", 0.2, 1.2, 0.02, 2], ["fb", "FIELD, strength", 0, 1.5, 0.05, 2],
          ["va", "VEIN, base", 0, 1, 0.02, 2], ["vb", "VEIN, strength", 0, 2.5, 0.05, 2], ["warp", "Warp of the density rings", 0, 2, 0.05, 2]],
      pre: [["Vein", "how strong the threads are", [["off", { va: 1.0, vb: 0 }], ["as run", { va: 0.28, vb: 1.35 }], ["hard", { va: 0.10, vb: 2.20 }]]]] },
    { id: "draw", t: "The draw", note: "Each year's parcels are drawn by lottery, weighted by the score.",
      s: [["reach", "Reach of a node", 1, 3, 0.05, 2], ["expo", "Contrast, the power on the score", 1, 3, 0.1, 1],
          ["adjA", "Adjacency, base", 0.1, 1, 0.05, 2], ["adjB", "Adjacency, reward", 0, 2, 0.05, 2]],
      pre: [["Reach", "how far a node spreads for its land", [["tight", { reach: 1.2 }], ["as run", { reach: 1.9 }], ["loose", { reach: 2.8 }]]],
            ["Contrast", "the power on the score", [["flat", { expo: 1.0 }], ["as run", { expo: 1.7 }], ["greedy", { expo: 3.0 }]]],
            ["Adjacency", "the reward for building beside fabric", [["weak", { adjA: 0.9, adjB: 0.2 }], ["as run", { adjA: 0.55, adjB: 0.75 }], ["strong", { adjA: 0.2, adjB: 1.6 }]]]] },
    { id: "ground", t: "The ground", note: "The weight the city gives the best soil, grade 1 and 2.",
      s: [["soil", "City on the best soil", 0.1, 1, 0.05, 2]],
      pre: [["Soil", "the weight on the best soil", [["protected", { soil: 0.2 }], ["as run", { soil: 0.45 }], ["ignored", { soil: 1.0 }]]]] },
    { id: "dens", t: "Density", note: "How far from the station mid and high rise may begin.",
      s: [["rcore", "Mid rise may begin beyond", 0, 2500, 50, "m"], ["rmed", "High rise may begin beyond", 0, 4000, 50, "m"]],
      pre: [["Promotion", "how far out density may begin", [["at the station", { rcore: 0, rmed: 0 }], ["as run", { rcore: 700, rmed: 1700 }], ["a far ring", { rcore: 1400, rmed: 3200 }]]]] },
    { id: "farm", t: "Farming", note: "Fields and vertical farms, placed against the final edge. The two settings for good soil near the line are new; at 0 the release is unchanged.",
      s: [["farmSoil", "Fields drawn to good soil", 0, 3, 0.1, 1], ["farmLineK", "Good soil near the line, pull", 0, 4, 0.1, 1],
          ["farmLineS", "Good soil near the line, reach", 500, 10000, 250, "km"], ["vband", "Vertical band, width", 0.25, 2.5, 0.05, "x"]],
      pre: [["Vertical band", "the collar of vertical farms", [["narrow", { vband: 0.25 }], ["as run", { vband: 1 }], ["wide", { vband: 2 }]]]] },
    { id: "chance", t: "Chance", note: "The seed draws the noise and the lottery. Seed 42 uses the release's own noise.",
      s: [["seed", "Seed", 1, 3000, 1, 0]],
      pre: [["Chance", "same rules, another layout", [["seed 7", { seed: 7 }], ["seed 42", { seed: 42 }], ["seed 2026", { seed: 2026 }]]]] }
  ];
  var r4 = function (v) { return Math.round(v * 1e4) / 1e4; };
  var SIMPLE = [
    { t: "Where the city grows", note: "How hard the stations and the railway pull, and how far.", graph: true, c: [
      { id: "sec", t: "Smaller stations, against the main ones", k: ["wS"], min: 0, max: 1.3, step: 0.05, can: function (q) { return q.wP > 0; },
        get: function (q) { return q.wP > 0 ? q.wS / q.wP : null; }, set: function (q, v) { q.wS = r4(v * q.wP); },
        show: function (v, fmt, T) { return fmt(v * 100) + " %"; }, ends: ["no pull", "as strong"] },
      { id: "line", t: "The railway, against the main stations", k: ["wR"], min: 0, max: 1, step: 0.02, can: function (q) { return q.wP > 0; },
        get: function (q) { return q.wP > 0 ? q.wR / q.wP : null; }, set: function (q, v) { q.wR = r4(v * q.wP); },
        show: function (v, fmt, T) { return fmt(v * 100) + " %"; }, ends: ["towns round stations", "a ribbon along the line"],
        pre: [["node city", { wR: 0, sR: 1500 }], ["as run", { wR: 0.6, sR: 1500 }], ["ribbon city", { wR: 2.0, sR: 3000 }]] },
      { id: "range", t: "How far the stations reach", k: ["dP", "dS"], min: 0.25, max: 2.2, step: 0.05,
        get: function (q) { var a = q.dP / 9000, b = q.dS / 6000; return Math.abs(a - b) < 1e-6 ? a : null; },
        set: function (q, v) { q.dP = Math.round(9000 * v); q.dS = Math.round(6000 * v); },
        show: function (v, fmt, T) { return T("halves at") + " " + fmt(9 * v * Math.LN2, 1) + " / " + fmt(6 * v * Math.LN2, 1) + " km"; }, ends: ["close", "far"] }] },
    { t: "The shape", note: "How the edge frays, how far a town spreads, how tightly it packs.", c: [
      { id: "vein", t: "Fingers along the threads", k: ["va", "vb"], min: 0, max: 1, step: 0.01,
        get: function (q) { return q.va + q.vb > 0 ? q.vb / (q.va + q.vb) : null; },
        set: function (q, v) { var a = (1 - v) * 1.63, b = v * 1.63; if (a > 1) { b /= a; a = 1; } q.va = r4(a); q.vb = r4(b); },
        show: function (v, fmt, T) { return fmt(v * 100) + " %"; }, ends: ["smooth edge", "long fingers"],
        pre: [["off", { va: 1.0, vb: 0 }], ["as run", { va: 0.28, vb: 1.35 }], ["hard", { va: 0.10, vb: 2.20 }]] },
      { id: "reach", t: "How far a town spreads", k: ["reach"], min: 1.1, max: 3, step: 0.05,
        get: function (q) { return q.reach; }, set: function (q, v) { q.reach = r4(v); },
        show: function (v, fmt, T) { return "× " + fmt(v, 2); }, ends: ["tight", "loose"] },
      { id: "adj", t: "Building beside what is built", k: ["adjA", "adjB"], min: 0, max: 0.92, step: 0.01,
        get: function (q) { return q.adjA + q.adjB > 0 ? q.adjB / (q.adjA + q.adjB) : null; },
        set: function (q, v) { var a = (1 - v) * 1.3, b = v * 1.3; if (a > 1) { b /= a; a = 1; } q.adjA = r4(a); q.adjB = r4(b); },
        show: function (v, fmt, T) { return fmt(v * 100) + " %"; }, ends: ["scattered", "solid"] }] },
    { t: "Land and height", note: "The best farmland, and how far from a station the city may rise.", c: [
      { id: "soil", t: "Building on the best farmland", k: ["soil"], min: 0.1, max: 1, step: 0.05,
        get: function (q) { return q.soil; }, set: function (q, v) { q.soil = r4(v); },
        show: function (v, fmt, T) { return "× " + fmt(v, 2); }, ends: ["protect it", "treat it as any land"],
        pre: [["protected", { soil: 0.2 }], ["as run", { soil: 0.45 }], ["ignored", { soil: 1.0 }]] },
      { id: "dens", t: "How far from a station it rises", k: ["rcore", "rmed"], min: 0, max: 1.45, step: 0.05,
        get: function (q) { var a = q.rcore / 700, b = q.rmed / 1700; return Math.abs(a - b) < 1e-6 ? a : null; },
        set: function (q, v) { q.rcore = Math.round(700 * v); q.rmed = Math.round(1700 * v); },
        show: function (v, fmt, T) { return T("mid") + " " + fmt(700 * v) + " m · " + T("high") + " " + fmt(1700 * v) + " m"; }, ends: ["at the station", "further out"] }] },
    { t: "Farming", note: "Fields and vertical farms, placed against the city's final edge.", c: [
      { id: "farmSoil", t: "Fields seek good soil", k: ["farmSoil"], min: 0, max: 1.5, step: 0.1,
        get: function (q) { return q.farmSoil; }, set: function (q, v) { q.farmSoil = r4(v); },
        show: function (v, fmt, T) { return "× " + fmt(v, 1); }, ends: ["anywhere", "good soil first"] },
      { id: "farmLineK", t: "Fields on good soil near the railway", k: ["farmLineK"], min: 0, max: 4, step: 0.1,
        get: function (q) { return q.farmLineK; }, set: function (q, v) { q.farmLineK = r4(v); },
        show: function (v, fmt, T) { return v ? "× " + fmt(v, 1) : T("off"); }, ends: ["off", "strong"] },
      { id: "vband", t: "Width of the vertical-farm collar", k: ["vband"], min: 0.3, max: 2.5, step: 0.05,
        get: function (q) { return q.vband; }, set: function (q, v) { q.vband = r4(v); },
        show: function (v, fmt, T) { return "× " + fmt(v, 2); }, ends: ["narrow", "wide"] }] },
    { t: "Another layout", note: "Same rules, another roll of the dice. The release is layout 42.", seed: true, c: [] }
  ];

  // Values where the land targets go unmet, the other settings at the release's values (measured, 14 Nov 2026).
  var UNDER = { reach: [1.0, 1.05], rcore: [1200, 2500], rmed: [2500, 4000], vband: [0.25, 0.25] };

  // The research process, step by step (14 Nov 2026). Both this page and the workspace's 01 module show
  // these nine steps in order. c: the SIMPLE controls that belong to the step (by id; "seed" = the layout
  // roll); graph: the pull graph; show: what the map shows (this page's layer keys; "pass1" = the first
  // pass's own city, "growth" = the outcome); sum(x): the step's line of numbers, from
  // x = { D, P, stats (2100 of what is shown), fmt, T }. live: the step depends on the settings, so it
  // is only done once a run has used them.
  var STEPS = [
    { id: "scope", t: "Choose the loop", note: "A 412 km rail loop round London, in six zones, cut into 50 m parcels.",
      show: ["rail", "zones"],
      sum: function (x) { var M = x.D.meta; return x.fmt(lineKm(x.D.rails.orbital)) + " km " + x.T("loop") + " · 6 " + x.T("zones") + " · " + x.fmt(M.NX * M.NY * M.C * M.C / 1e6) + " km² " + x.T("of 50 m parcels"); } },
    { id: "ground", t: "Read the ground", note: "Which parcels may be built, where the best soil lies, and where the towns, water and protected landscapes are.",
      show: ["aonb", "towns", "absorbed", "water", "belt"],
      sum: function (x) { var g = x.D.GROUND; return x.T("buildable") + " " + x.fmt(g.build) + " km² · " + x.T("best soil") + " " + x.fmt(g.best) + " km² · " + x.T("towns") + " " + x.fmt(g.urban) + " km² · " + x.T("water") + " " + x.fmt(g.water) + " km²"; } },
    { id: "rail", t: "Lay the railway", note: "The loop, six radials into London and a high-speed line. Towns will grow round the stations on the loop.",
      show: ["rail", "stations", "names"],
      sum: function (x) { var n = { P: 0, S: 0, A: 0 }; x.D.meta.NODES.forEach(function (d) { n[d[1]]++; });
        return x.T("radials") + " " + x.fmt(lineKm(x.D.rails.radials)) + " km · " + x.T("high speed") + " " + x.fmt(lineKm(x.D.rails.high_speed)) + " km · " + n.P + " " + x.T("main stations") + " · " + n.S + " " + x.T("smaller") + " · " + n.A + " " + x.T("airports"); } },
    { id: "targets", t: "Set the targets", note: "32 streams of growth, each with the land it must fill and the year it starts. The existing towns already hold 3.3 million people.",
      show: ["rail", "stations", "names"],
      sum: function (x) { var S = x.D.meta.STREAMS, a = { L: 0, M: 0, H: 0 }, c = x.D.meta.C * x.D.meta.C / 1e6, y = {};
        S.forEach(function (s) { a.L += s.L; a.M += s.M; a.H += s.H; y[s.gate] = 1; });
        return S.length + " " + x.T("streams") + " · " + x.T("to build") + " " + x.fmt((a.L + a.M + a.H) * c, 1) + " km² (" + x.T("low") + " " + x.fmt(a.L * c) + " · " + x.T("mid") + " " + x.fmt(a.M * c) + " · " + x.T("high") + " " + x.fmt(a.H * c) + ") · " + x.T("starts") + " " + Object.keys(y).join(" / "); } },
    { id: "pull", t: "Work out the pull", note: "Every parcel gets a score: the pull of the stations and the line, fading with distance, times two patterns of noise and the weight on the best soil.",
      c: ["sec", "line", "range", "vein", "soil"], graph: true, live: true, show: ["magnet", "rail", "stations"],
      sum: function (x) { var P = x.P, r = P.wR > 0 ? P.wR : 1, f = function (v) { return (Math.round(v / r * 10) / 10).toString(); };
        return (P.wR > 0 ? f(P.wP) + " : " + f(P.wS) + " : 1 · " : "") + x.T("halves at") + " " + x.fmt(P.dP / 1000 * Math.LN2, 1) + " / " + x.fmt(P.dS / 1000 * Math.LN2, 1) + " km"; } },
    { id: "pass1", t: "First pass: where the city ends", note: "Year by year the parcels are drawn by lottery, weighted by the score, until every stream has its land. This fixes where the city ends in 2100.",
      c: ["reach", "adj"], live: true, show: ["pass1", "rail", "stations"],
      sum: function (x) { return x.T("a lottery a year") + " · 2025–2100 · " + x.T("reach") + " × " + x.fmt(x.P.reach, 2) + " · " + x.T("beside the built") + " " + x.fmt(x.P.adjB / Math.max(1e-9, x.P.adjA + x.P.adjB) * 100) + " %"; } },
    { id: "farm", t: "Lay out the farming", note: "Beyond that edge: a collar of vertical farms, and fields drawn to good soil.",
      c: ["farmSoil", "farmLineK", "vband"], live: true, show: ["edge", "growth", "rail"],
      sum: function (x) { var k = x.stats.km2; return x.T("fields") + " " + x.fmt(k.fh, 1) + " km² · " + x.T("vertical farms") + " " + x.fmt(k.fv, 1) + " km²"; } },
    { id: "pass2", t: "Second pass: the city and its farms", note: "Grown again, the farms in place; each town densifies outward from its station.",
      c: ["dens"], live: true, show: ["growth", "rail", "stations"],
      sum: function (x) { return x.T("mid rise beyond") + " " + x.fmt(x.P.rcore) + " m · " + x.T("high rise beyond") + " " + x.fmt(x.P.rmed) + " m"; } },
    { id: "result", t: "The result", note: "2100: who lives in the loop, how much is built and how much farmed. Roll another layout, or run a variation with your settings.",
      c: ["seed"], live: true, show: ["growth", "rail", "stations"],
      sum: function (x) { var k = x.stats.km2; return x.fmt(x.stats.pop) + " " + x.T("people") + " · " + x.T("built") + " " + x.fmt(k.l + k.m + k.h, 1) + " km² · " + x.T("farmed") + " " + x.fmt(k.fh + k.fv, 1) + " km²"; } }
  ];
  function lineKm(lines) { var s = 0; lines.forEach(function (l) { for (var i = 1; i < l.length; i++) s += Math.hypot(l[i][0] - l[i - 1][0], l[i][1] - l[i - 1][1]); }); return Math.round(s / 1000); }
  return { GROUPS: GROUPS, SIMPLE: SIMPLE, UNDER: UNDER, STEPS: STEPS, r4: r4 };
})();
