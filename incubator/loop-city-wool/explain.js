/* Loop City step 2 · the explanation card (25 Nov 2026).
   For someone who does not know the method: each step says, in the left panel, what it did, why, with which
   settings (the values the page is using now) and what came out (worked out on the cells on show). The sixteen
   steps fall into four chapters, shown as a bar over the map; Previous / Next sit under the map with the demo.
   It reads the page's own state (DATA, S, P, BD) and changes nothing in it: a setting row opens the slider that
   sets it. The right panel (the look) is as it was. #noskin shows the page without it. */
(function () {
  'use strict';
  var H = document.documentElement;
  var $ = function (id) { return document.getElementById(id); };
  var zh = function () { return /^zh/i.test(H.lang || ''); };
  var T = function (en, cn) { return zh() ? cn : en; };
  var esc = function (s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  var f = function (v, d) { return Number(v).toLocaleString('en-GB', { minimumFractionDigits: d || 0, maximumFractionDigits: d || 0 }); };
  var K = function () { return window.__WOOL_K__ || {}; };
  var ok = function () { return typeof DATA !== 'undefined' && DATA && typeof S !== 'undefined' && S && S.view; };

  // ---------------------------------------------------------------- the chapters
  var CH = [
    { n: 1, en: 'Reading the ground', zh: '读地', steps: [1, 2, 3, 4] },
    { n: 2, en: 'Cutting', zh: '切分', steps: [5, 6, 7] },
    { n: 3, en: 'Weaving', zh: '编织', steps: [8, 9, 10] },
    { n: 4, en: 'Making roads', zh: '成路', steps: [21, 22, 23, 24, 25, 26] },
    { n: 5, en: 'Evaluation', zh: '评价', steps: [28] }
  ];
  var CHZ = function (n) { return '第 ' + n + ' 章'; };
  var shown = function (k) { return k > 20 ? k - 10 : k; };
  var chapterOf = function (k) { for (var i = 0; i < CH.length; i++) if (CH[i].steps.indexOf(k) >= 0) return CH[i]; return null; };
  var ORDER = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 21, 22, 23, 24, 25, 26, 28, 27];
  var stepName = function (k) { var b = document.querySelector('[data-step="' + k + '"]'); return b ? b.textContent.replace(/^\d+\s*/, '').trim() : ''; };

  // ---------------------------------------------------------------- the numbers each step reads
  var sum = function (o, k) { var s = 0; for (var c in o) s += (o[c] && o[c][k]) || 0; return s; };
  var soilShare = null;
  function soil() {                       // the share of each soil grade inside the cells, on a 200 m grid
    if (soilShare || typeof soilAt !== 'function' || !DATA.soilGrid) return soilShare;
    var cnt = [0, 0, 0, 0, 0, 0, 0, 0, 0], n = 0;
    DATA.cells.forEach(function (c) { var r = c.ring, b = [Infinity, Infinity, -Infinity, -Infinity];
      for (var i = 0; i < r.length; i += 2) { b[0] = Math.min(b[0], r[i]); b[2] = Math.max(b[2], r[i]); b[1] = Math.min(b[1], r[i + 1]); b[3] = Math.max(b[3], r[i + 1]); }
      for (var x = b[0]; x < b[2]; x += 200) for (var y = b[1]; y < b[3]; y += 200) if (inRing(r, x, y)) { var g = soilAt(x, y); cnt[g < 8 ? g : 8]++; n++; } });
    soilShare = cnt.map(function (v) { return n ? v / n : 0; });
    return soilShare;
  }
  var anchorsN = function () { var ids = new Map(); (S.per || []).forEach(function (l) { l.forEach(function (q) { ids.set(q.id, q.kind); }); });
    var all = Array.from(ids.values()); return { all: ids.size, road: all.filter(function (k) { return k === 'road' || k === 'turn'; }).length,
      between: all.filter(function (k) { return k === 'between'; }).length, mine: all.filter(function (k) { return k === 'manual'; }).length }; };
  var gatesN = function () { return (S.gates || []).reduce(function (s, G) { return s + (G ? G.length : 0); }, 0); };
  var threadsN = function () { return (S.jobs || []).reduce(function (s, j) { return s + (j ? j.T : 0); }, 0); };
  var R = function () { return typeof BD !== 'undefined' ? BD.res : null; };
  var N = function () { var r = R(); return (r && r.numbers) || {}; };
  var hierKm = function () { var r = R(); if (!r || !r.hier) return null; var a = 0; for (var k in r.hier.km) a += r.hier.km[k]; return a; };
  var bp = function (k) { return typeof BD !== 'undefined' ? BD.p[k] : undefined; };
  var m28 = function (v) { return f(v * 28) + ' m'; };
  var notYet = T('not worked out yet', '尚未计算');
  var FLW = function () { return typeof FLOOD !== 'undefined' ? FLOOD : null; };    // (25 Nov 2026) the flood corridors, when the page has them

  // ---------------------------------------------------------------- the sixteen steps (and the way out, 17)
  // each: title, what it did (with the numbers), why, settings [label, value, slider id], results [value, label], legend rows to show
  function info0(k) {
    var n = DATA.nums, c3 = DATA.cells.length, k5 = K();
    switch (k) {
      case 1: return { t: T('The network the slime mould found is the new town’s frame', '黏菌找到的网，就是新城的骨架'),
        did: T('The paths the agents of step 1’s whole-loop run took; brighter where more of them went.', '第 1 步整环模拟里代理走过的路径，越亮走得越多。'),
        why: T('The mould links the stations with the least total length and some spare loops: an efficient, robust network.', '黏菌用最短的总长把车站连起来，还留有备用的环路：高效又不怕断。'),
        prm: [[T('From', '来源'), T('step 1, the whole loop', '第 1 步：整环')], [T('Cells taken', '带来的单元'), DATA.cells.map(function (c) { return c.id; }).join(' · ')]],
        res: [[c3, T('cells', '个单元')], [DATA.stations.filter(function (s) { return s.cell; }).length, T('stations in them', '个车站')]], leg: 2 };
      case 2: return { t: T('The veins drawn in to centrelines', '菌脉收成中心线'),
        did: T('Where the trail is over ' + vein() + ' it is a vein; each vein is thinned to its centreline. A vein that ends is a spur (dashed).', '路径值大于 ' + vein() + ' 的地方是菌脉，每条菌脉细化成它的中心线；末端的支脉用虚线。'),
        why: T('A vein is a band; only a line can close round a cell.', '菌脉是一条条「带」，只有线才能围出单元的边界。'),
        prm: [[T('Vein: trail over', '菌脉阈值'), vein()]],
        res: [[DATA.centrelines.filter(function (c) { return !c.spur; }).length, T('centrelines', '条中心线')], [DATA.centrelines.filter(function (c) { return c.spur; }).length, T('spurs', '条支脉')]], leg: 3 };
      case 3: return { t: T('The centrelines close three cells', '中心线围出单元'),
        did: T('The cells the centrelines close: ', '中心线围出的单元：') + DATA.cells.map(function (c) { return c.id + ' ' + f(n.cells[c.id], 1) + ' km²'; }).join(' · ') + T('. The bright edge is the one two cells share.', '。亮线是两个单元共享的边。'),
        why: T('A cell is one station’s hinterland. On the shared edge the two networks will have to meet.', '一个单元是一个车站的腹地；在共享边上，两张路网要接起来。'),
        prm: [[T('Cells', '单元'), c3], [T('Shared edge', '共享边'), f(n.shared, 1) + ' km']],
        res: [[f(Object.keys(n.cells).reduce(function (s, c) { return s + n.cells[c]; }, 0), 1), T('km² in all', 'km² 合计')], [f(n.shared, 1), T('km shared', 'km 共享边')]], leg: 3 };
      case 4: return { t: T('The roads and towns there today go down first', '现有的路和城镇先摆上'),
        did: T('The motorways, A and B roads and the towns over the cells.', '把现有的高速、A 级、B 级道路和城镇叠到单元上。'),
        why: T('The new network has to join the roads there are; towns are kept.', '新路网要接上已有的路，城镇不拆。'),
        prm: [[T('A town counts from', '城镇计入下限'), (k5.TOWN_MIN || 0.25) + ' km²']],
        res: n.roads && Object.keys(n.roads).length ? [[f(sum(n.roads, 'M'), 1), T('km motorway', 'km 高速')], [f(sum(n.roads, 'A'), 1), T('km A roads', 'km A 级')], [f(sum(n.roads, 'B'), 1), T('km B roads', 'km B 级')]] : [], leg: 4 };
      case 5: return { t: T('Roads and towns are lines the wool cannot cross', '路和城镇是穿不过的线'),
        did: T('Each cell cut along the roads and round the towns, the corners eased; pieces under the minimum are not woven.', '沿道路和城镇把每个单元切开，转角做圆；小于下限的碎块不编织。'),
        why: T('The wool is woven inside each piece only; it never runs across a road that is there.', '毛线只在每一块里面编，不能跨过现有的路。')
          + (FLW() ? T(' The flood corridors (blue) are kept for water: the wool may cross them but does not gather in them, and no main road runs along them.', ' 洪泛走廊（蓝色）留给水：毛线可以穿过，但不在里面聚集，主路也不沿着它走。') : ''),
        prm: [[T('Road cut, width', '道路刀宽'), (2 * (k5.HALF_ROAD || 20)) + ' m'], [T('Corners eased by', '转角圆角'), (k5.EASE || 85) + ' m'], [T('Smallest piece woven', '最小可编织块'), ((k5.MIN_PRIM || 3e6) / 1e6) + ' km²']]
          .concat(FLW() ? [[T('Flood corridor: medium and high risk in one piece of at least', '洪泛走廊：中、高风险连成一片，至少'), (window.CORR_HA_ || 5) + ' ha']] : []),
        res: DATA.primary.length ? [[DATA.primary.length, T('primary cells', '个一级单元')], [f(DATA.primary.reduce(function (s, p) { return s + p.km2; }, 0), 1), 'km²'], [DATA.small.length, T('small pieces left', '块小碎块')]]
          .concat(FLW() ? [[FLW().pieces, T('flood corridors', '片洪泛走廊')], [f(FLW().km2, 1) + ' km²', T('in flood corridors', '在洪泛走廊里')]] : []) : [], leg: 5 };
      case 6: { var sh = soil(); return { t: T('Soil is not all the same', '土壤有好坏'),
        did: T('The agricultural land classification under the primary cells, on a 50 m grid.', '把农业用地分级（ALC，50 m 网格）叠到一级单元下。'),
        why: T('The best farmland is found first, so the next step can keep it.', '先认出最好的耕地，下一步才能把它留下。'),
        prm: [[T('Grid', '网格'), '50 m'], [T('Grades', '等级'), T('1 to 5, non-agricultural, urban', '一至五级、非农、城市')]],
        res: sh ? [[f((sh[0] + sh[1]) * 100) + ' %', T('Grade 1–2', '一、二级')], [f((sh[2] + sh[3]) * 100) + ' %', T('Grade 3', '三级')], [f((sh[4] + sh[5] + sh[6] + sh[7] + sh[8]) * 100) + ' %', T('other', '其他')]] : [], leg: 5 }; }
      case 7: return { t: T('The good land is kept for farming', '好地留给耕种'),
        did: T('Grade 1–2 becomes farmland, Grade 3a and poorer land to build on; the edges smoothed, small bits joined to their neighbour.', '一、二级农地划为耕地，3a 级及以下划为建设用地；边界平滑，小碎块并入相邻的一块。'),
        why: T('Farmland should not be cut up by roads: the net is looser on it (step 8), denser where people will build.', '好的耕地不该被路网切碎：耕地上的网更稀（第 8 步），建设用地上更密。'),
        prm: [[T('Kept for farming', '保留为耕地'), T('Grade 1–2', '一、二级')], [T('Edges smoothed by', '边界平滑半径'), (k5.SMOOTH || 160) + ' m'], [T('Smallest soil cell', '最小土壤单元'), ((k5.MIN_ZONE || 4e5) / 1e4) + ' ha'], [T('Bits under this join a neighbour', '小于此的碎块并入相邻'), ((k5.MIN_PIECE || 6e5) / 1e4) + ' ha']],
        res: n.zones && Object.keys(n.zones).length ? [[f(sum(n.zones, 'farm'), 0), T('km² farmland', 'km² 耕地')], [f(sum(n.zones, 'build'), 0), T('km² to build on', 'km² 建设用地')], [sum(n.zones, 'n'), T('soil cells', '个土壤单元')]] : [], leg: 2 };
      case 8: { var a = anchorsN(); return { t: T('New roads start from the junctions there are', '新路从现有路口接出去'),
        did: T('An anchor where each existing road crosses a primary cell’s edge, and more between them at the spacing', '在现有道路与一级单元边界相交处放锚点，锚点之间再按间距补上') + (FLW() ? T(', none in a flood corridor.', '，洪泛走廊里不放。') : T('.', '。')),
        why: T('The anchors fix where roads come in and out, and how dense the net will be.', '锚点决定路从哪里进出，也决定网有多密。'),
        prm: [[T('Spacing', '锚点间距'), f(P.spacing) + ' m', 'spacing'], [T('Within 3 km of the station', '车站 3 km 内'), '× ' + f(P.nearF, 2), 'nearF'], [T('On Grade 1–2 soil', '一、二级农地上'), '× ' + f(P.soilF, 2), 'soilF'], [T('Road anchors at least', '路口锚点间至少'), (k5.APART || 600) + ' m']],
        res: [[a.all, T('anchors', '个锚点')], [a.road, T('on the roads', '个在路口')], [a.between, T('between', '个按间距')]], leg: 3 }; }
      case 9: return { t: T('Anchors tied to one another', '锚点两两相连'),
        did: T('Inside each primary cell every anchor is tied to anchors ', '每个一级单元里，每个锚点连向') + (OPP ? T('across the cell', '边界对面的锚点') : T('round the edge, every second one', '沿边界隔一个的锚点')) + T('; each thread has 80 segments.', '；每根线分 80 段。')
          + (gatesN() ? T(' Where a cell has a station, each anchor is also tied to the gateway it faces: the station, or a point just outside the station’s town (white).', ' 有车站的单元里，每个锚点还连向它朝向的门户：车站，或车站所在城镇边缘外的一个点（白色）。') : ''),
        why: T('Frei Otto’s wet wool: first every possible straight link, then let the forces pick the routes.', 'Frei Otto 的湿毛线：先给出所有可能的直线连接，再让力学挑出路线。'),
        prm: [[T('Rule', '连线规则'), OPP ? T('across the cell', '连向对面') : T('every second', '隔一个连')], [T('Ties per anchor', '每个锚点的连线'), (bp('oppw') || 2), 'bd_oppw'], [T('Segments per thread', '每根线'), T('80', '80 段')]],
        res: [[threadsN(), T('threads', '根毛线')], [(S.jobs || []).filter(Boolean).length, T('primary cells woven', '个一级单元')]].concat(gatesN() ? [[gatesN(), T('gateways', '个门户')]] : []), leg: 4 };
      case 10: { var dt = S.detour, rg = S.ring && S.ring.over === P.over && S.ring.angle === P.angle ? S.ring : null, v1 = /[#&]v1(?![\w])/.test(location.hash);
        return { t: T('The wet wool draws together', '湿毛线聚成束'),
        did: v1 ? T('The threads pull towards each other (magnet) and resist bending (angle), live, until they settle in bundles.', '毛线之间互相吸引（磁力），又抵抗弯曲（角度），实时松弛，直到并成一束束。')
          : T('Each thread is ' + f(P.over) + ' % longer than the shortest way between its anchors (round the towns) and cannot stretch. Wet, the threads pull towards each other and draw together into bundles until they come to rest; then each is smoothed lightly, its ends held.',
              '每根线比两个锚点之间（绕开城镇）的最短路长 ' + f(P.over) + '%，而且拉不长。浸湿后线互相吸引，并成一束束，直到静止；最后每根线轻度平滑一次，两端不动。'),
        why: v1 ? T('Where threads run together is where traffic would gather: those are the roads.', '线并在一起的地方，就是交通会自然汇集的地方：那就是路。')
          : T('Frei Otto’s wet-wool experiment: the surplus is its one control. A thread can only join a bundle by spending its surplus, so no route is longer than the surplus allows, and the bundles are where routes are worth sharing: the roads. Wet wool hardly resists bending, so the angle is 0; the smoothing only takes out the kinks the computation leaves.',
              'Frei Otto 的湿毛线实验：余长是唯一的控制量。线要并进束里只能花掉自己的余长，所以没有一条路线会比余长允许的更绕；束出现在值得合用路线的地方，就是路。湿毛线几乎不抗弯，所以抗弯为 0；平滑只去掉计算留下的折线，不改变走向。'),
        prm: (v1 ? [] : [[T('Surplus', '余长'), f(P.over) + ' %', 'over']]).concat([[T('Magnet', '磁力'), f(P.magnet), 'magnet'], [T('Angle (stiffness)', '抗弯（角度）'), f(P.angle), 'angle'], [T('Steps, at most', '最多步数'), f(P.steps), 'steps']],
          v1 ? [] : [[T('Smoothing', '平滑'), T(P.smooth + ' passes', P.smooth + ' 次')]]),
        res: [[threadsN(), T('threads', '根毛线')], [S.relaxMs !== null && S.relaxMs !== undefined ? f(S.relaxMs / 1000, 1) + ' s' : (S.busy ? T('running', '运行中') : notYet), T('to relax', '松弛用时')]]
          .concat(dt && dt.med ? [[f(dt.med, 3), T('detour, median', '绕路中位')], [Math.round(100 * dt.within / Math.max(1, dt.n)) + ' %', T('within the surplus', '在余长之内')]] : []),
        extra: v1 ? '' : '<div class="l">' + T('Calibration', '校准') + '</div><div class="ring">' + (rg ? '<canvas width="132" height="132"></canvas><p>' + T('Frei Otto’s ring, with these settings: 24 anchors, each tied across. Detour median ', 'Frei Otto 的圆环实验，用这里的设置：24 个锚点，每个连向对面。绕路中位 ') + f(rg.med, 3) + T(', longest ', '，最长 ') + f(rg.max, 3) + T(' (the surplus allows ', '（余长允许 ') + f(1 + P.over / 100, 2) + T(').', '）。') + '</p>'
          : '<p>' + T('Run the same solver on Frei Otto’s ring, to see the surplus do what it does in the experiment.', '用同一个求解器在 Frei Otto 的圆环上跑一遍，看余长是否和实验里一样起作用。') + '</p><button type="button" class="ringGo"' + (S.ringBusy ? ' disabled' : '') + '>' + (S.ringBusy ? T('Running…', '计算中…') : T('▶ Ring calibration', '▶ 圆环校准')) + '</button>') + '</div>',
        after: function (el) { var b = el.querySelector('.ringGo'); if (b) b.onclick = function () { if (window.ringCalib) window.ringCalib(); };
          var c = el.querySelector('.ring canvas'); if (c && rg) { var g = c.getContext('2d'), s = 132 / 230; g.clearRect(0, 0, 132, 132); g.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue('--fg') || '#fff'; g.globalAlpha = 0.35; g.lineWidth = 0.8;
            rg.lines.forEach(function (L) { g.beginPath(); for (var i = 0; i < L.length; i += 2) { var x = 66 + L[i] * s, y = 66 - L[i + 1] * s; if (i) g.lineTo(x, y); else g.moveTo(x, y); } g.stroke(); }); } },
        leg: 2 }; }
      case 21: return { t: T('More threads, a wider road', '线越多，路越宽'),
        did: T('The relaxed wool read as one mass: every thread a band, wider where more run together, the corners rounded where bands meet.', '把松弛后的毛线读成一个整体：每根线是一条带，线越多带越宽，带交汇处倒圆。'),
        why: T('The band is the road; its two edges are the road’s double line.', '带就是路，带的两条边就是道路的双线。'),
        prm: [[T('Band of one thread', '单根线的带宽'), m28(bp('thread')), 'bd_thread'], [T('Rounding where bands meet', '交汇处圆角'), m28(bp('close1')), 'bd_close1']],
        res: R() ? [[f(hierKm() || N()['all main roads km'] || 0), T('km of main roads', 'km 主干路')], [N().blocks, T('blocks', '个街区')]] : [], leg: 3 };
      case 22: { var tk = N()['thread km'], pk = N()['thread km pulled onto existing roads']; return { t: T('Onto the roads there are', '并到现有路上'),
        did: T('A new band that runs beside an existing road, in its direction, is pulled onto it.', '与现有道路平行、方向一致的新带，被吸到那条路上。'),
        why: T('No new road is built right beside an old one.', '不在现有道路旁边再修一条。'),
        prm: [[T('Merge into existing roads', '并入现有道路'), bp('attract') ? T('on', '开') : T('off', '关'), 'bd_attract'], [T('Reach', '吸附范围'), bp('reach') + ' m', 'bd_reach'], [T('Cell edge as a road', '单元边界作为路'), m28(bp('rim')), 'bd_rim']],
        res: pk !== undefined ? [[f(pk), T('km of thread pulled on', 'km 毛线被吸过去')], [f(tk ? pk / tk * 100 : 0, 1) + ' %', T('of all the thread', '占全部毛线')]] : [], leg: 3 }; }
      case 23: { var oe = N()['open ends carried on'] || []; return { t: T('Tidied', '清理'),
        did: T('Wide masses where many bands meet are rebuilt as the roads through them, blocks too narrow are closed, open ends carried on to the next road.', '很多带交汇的宽团块重建为穿过它的路；太窄的街区合上；断头沿原方向延伸到下一条路。'),
        why: T('Every block must be usable, and no road may stop in mid-field.', '每个街区都要能用，路不能断在半途。'),
        prm: [[T('Widest band, each side', '最宽的带（每侧）'), m28(bp('rmax')), 'bd_rmax'], [T('Close blocks narrower than', '合上窄于此的街区'), bp('narrow') ? m28(bp('narrow')) : T('off', '关'), 'bd_narrow'], [T('Smoothing along a road', '沿路平滑'), bp('sigma') + ' m', 'bd_sigma']],
        res: R() ? [[N()['narrow blocks merged'] || 0, T('narrow blocks closed', '个窄街区合上')], [oe.filter(function (e) { return e.joined; }).length, T('ends carried on', '处断头延伸')], [N()['open ends left'] || 0, T('left open', '处保留')]] : [], leg: 3 }; }
      case 24: return { t: T('Small blocks joined into bigger parcels', '小块并成大地块'),
        did: T('Neighbouring small blocks are merged, never across an existing road or the cell edge.', '相邻的小街区合并成大地块，不跨现有道路和单元边界。'),
        why: T('A block too small cannot be used as a parcel.', '太小的地块没法用。'),
        prm: [[T('Merge blocks under', '合并小于此的街区'), bp('small') ? bp('small') + ' ha' : T('off', '关'), 'bd_small'], [T('A merged parcel never over', '合并后不超过'), bp('smallMax') + ' ha', 'bd_smallMax']],
        res: R() ? [[N()['small blocks merged (pairs)'] || 0, T('pairs merged', '对合并')], [N().blocks, T('parcels', '个地块')]] : [], leg: 3 };
      case 25: { var r = R(), u = r && r.useN, km = r && r.useKm; return { t: T('What each parcel is for', '每块地的用途'),
        did: ((r && r.useFrom === 'growth') ? T('From the growth simulation: urban where over half is built, farming where over half is farmed, a park where the parcel is small.', '依据增长模拟：过半建成的是城市，过半耕种的是农业，小地块做公园。') : T('From the soil: farming where enough of the parcel is good farm soil, urban otherwise, a park where it is small.', '依据土壤：良田占比够的是农业，其余是城市，小地块做公园。')) + (FLW() ? T(' A parcel more than half in a flood corridor is blue-green: wetland, flood storage, wet farming.', ' 一半以上在洪泛走廊里的地块是蓝绿：湿地、蓄洪、湿地农业。') : ''),
        why: T('The wool gives the roads; the growth simulation gives what the land between them becomes.', '毛线给出路，增长模拟给出路之间的土地做什么。'),
        prm: [[T('A park is a parcel under', '小于此的地块是公园'), bp('park') + ' ha', 'bd_park'], [T('Farming when good soil is over', '良田超过此比例为农业'), bp('farm') + ' %', 'bd_farm']],
        res: u ? [[u[1] || 0, T('urban', '块城市') + ' · ' + f(km[1] || 0, 0) + ' km²'], [u[2] || 0, T('farming', '块农业') + ' · ' + f(km[2] || 0, 0) + ' km²'], [(u[3] || 0), T('parks', '块公园')]]
          .concat(u[6] ? [[u[6], T('blue-green', '块蓝绿') + ' · ' + f(km[6] || 0, 1) + ' km²']] : []) : [], leg: 5 }; }
      case 26: { var h = R() && R().hier, o2 = h && h.out['60'], o3 = h && h.out['48'], jx = R() && R().jx && R().jx.stats; return { t: T('The roads given their class', '道路分级'),
        did: T('Four classes at true widths. The cell edge is the boundary highway; a whole existing road is raised before a new road is made.', '分成四级，按真实宽度。单元边界是边界高速；先把整条现有道路提升，再新建道路。'),
        why: T('Every place should be within reach of a main road, without two main roads running side by side.', '每块地都要离主路够近，又不能两条主路并排走。') + (FLW() ? T(' A main road may cross a flood corridor, never run along it for more than 200 m.', ' 主路可以跨过洪泛走廊，但不沿着它走超过 200 m。') : ''),
        prm: [[T('No place further from a primary road than', '离一级道路不超过'), f(bp('r2'), 2) + ' km', 'bd_r2'], [T('No place further from an A road than', '离 A 级道路不超过'), f(bp('r3'), 2) + ' km', 'bd_r3'], [T('Existing roads first', '现有道路优先'), bp('exfirst') ? T('yes', '是') : T('no', '否'), 'bd_exfirst']],
        res: o2 ? [[o2['new roads'], T('new primary roads', '条新一级道路')], [o3 ? o3['new roads'] : 0, T('new A roads', '条新 A 级道路')], [o2.raised.length + (o3 ? o3.raised.length : 0), T('existing roads raised whole', '条现有道路整条提升')], [o2['land within reach %'] + ' %', T('of the land near a primary road', '用地在一级路覆盖内')]]
          .concat(jx ? [[jx.roundabout + jx['big roundabout'], T('roundabouts', '个环岛')], [jx.interchange, T('interchanges', '个立交')], [jx.turned + jx.moved, T('side roads squared', '条支路转正')]] : []) : [], leg: 4,
        extra: jx ? '<p style="margin-top:10px;font-size:12.5px">' + T('Junctions as they would be built: interchanges and large roundabouts on the boundary highway, ' + jx.lilo + ' B roads left in and left out, ' + jx.closed + ' closed; roundabouts where main roads meet at a skew; side roads turned to meet square (over 75° with a main road, 60° between B roads).', '路口按能建造的方式处理：边界高速上做立交和大环岛，' + jx.lilo + ' 条 B 级路只许左进左出，' + jx.closed + ' 条关闭；主路斜交处做环岛；支路转正接入（有主路参与时 75° 以上，B 级路之间 60° 以上）。') + '</p>' : '' }; }
      case 28: return window.Wool5 ? window.Wool5.info() : null;
      case 27: return { t: T('Take the parcels on to the tensor field', '选出地块，交给张量场'),
        did: window.TOUCH ? T('Tap an urban parcel to take it, tap more to add them; then Next · Tensor Studio.', '点一下城市地块选中，再点别的加选；然后点「下一步 · 张量场工作室」。') : T('Click an urban parcel to take it, shift-click for more; double-click to open them in Tensor Studio.', '点击城市地块选中，按住 Shift 多选；双击把它们在张量场工作室里打开。'),
        why: T('The street pattern inside each parcel is made in the next step, the tensor field.', '每块地里面的街道在下一步（张量场）生成。'),
        prm: [], res: [], leg: 3 };
    }
    return null;
  }

  // (25 Nov 2026) the whole loop. The vein threshold is the one the package was made with (an older package does not
  // say: a dash). A cell that is already a town is not woven: step 5 says so and why, steps 8 to 15 are passed over,
  // step 16 shows the roads that are there. A cell with no urban parcel says so at steps 15 and 17.
  function vein() { return typeof veinEdge === 'function' ? veinEdge() : '—'; }
  var OFF = [8, 9, 10, 21, 22, 23, 24, 25];
  function info(k) {
    var x = info0(k); if (!x || typeof WS === 'undefined') return x;
    var b = WS.built(), all = WS.allBuilt(), min = (K().MIN_PRIM || 3e6) / 1e6, one = DATA.cells.length === 1;
    var big = function (id) { var a = WS.largest(id); return a >= 0.05 && a < min ? f(a, 1) + ' km²' : a < 0.05 ? T('no piece left', '没有成块的土地') : T('under ', '不到 ') + min + ' km²'; };
    var left = function (id) { var a = WS.largest(id);       // the reason, in a sentence
      return a >= 0.05 && a < min ? T('With its roads and towns cut out, the largest piece left is ' + f(a, 1) + ' km²: less than the ' + min + ' km² that can be woven.', '切掉道路和城镇后，剩下最大的一块只有 ' + f(a, 1) + ' km²，不到可编织的 ' + min + ' km²。')
        : a < 0.05 ? T('With its roads and towns cut out, no piece of open land is left to weave.', '切掉道路和城镇后，没有剩下可以编织的成块土地。')
        : T('With its roads and towns cut out, every piece left is under the ' + min + ' km² that can be woven.', '切掉道路和城镇后，剩下的每一块都不到可编织的 ' + min + ' km²。'); };
    if (k === 5 && all) {
      var top = b.slice().sort(function (p, q) { return WS.largest(q) - WS.largest(p); })[0];
      x.note = T(one ? 'This cell is already a town: it stays as it is.' : 'These cells are already towns: they stay as they are.', one ? '这个单元已经是城市，保留现状。' : '这些单元已经是城市，保留现状。');
      x.noteWhy = left(top) + T(' Steps 8 to 15 are passed over.', '第 8 到 15 步跳过。');
      x.act = { t: T('Back to step 1: choose it with its neighbours', '回到第 1 步，和邻居一起选'), href: '../loop-city-mould-growth/index.html' };
    } else if (k === 5 && b.length) {
      x.note = T('Already towns, kept as they are and not woven: ', '已经是城市、保留现状、不编织的单元：') + b.map(function (id) { return id + T(' (largest piece ', '（最大一块 ') + big(id) + T(')', '）'); }).join(T(', ', '、'));
      x.noteWhy = T('The other cells are woven as usual.', '其余单元照常编织。');
    }
    if (all && OFF.indexOf(k) >= 0) return { t: x.t, off: true, did: T('Already a town: nothing is woven here, so this step is passed over.', '这个单元已经是城市，不编织：这一步跳过。'), why: '', prm: [], res: [], leg: 0 };
    if (all && k === 26) { x.note = T('No new road is made here: the map shows the roads that are there.', '这里不新建道路：地图只显示现有道路。'); x.res = []; }
    if (k === 25 && !all && WS.urban() === 0) { x.note = T('This cell has no urban parcel: it is all farming or park.', '这个单元没有城市地块，全部是农业或公园。');
      x.noteWhy = T('By the rule, only urban parcels go on to the tensor field.', '按规则只有城市地块进入张量场。'); }
    if (k === 27) { var st = WS.stop();
      if (st === 'built') { x.did = T('Nothing is taken from this cell.', '这个单元不选取地块。'); x.note = T('This cell is already a town and stays as it is.', '这个单元已经是城市，保留现状。'); x.noteWhy = T('There is no parcel to hand to the tensor field.', '没有地块可以交给张量场。'); }
      else if (st === 'nourban') { x.note = T('No urban parcel to hand to the tensor field.', '没有城市地块可以交给张量场。'); x.noteWhy = T('This cell is all farming or park; the map can still be clicked.', '这个单元全部是农业或公园；地图仍然可以点击查看。'); } }
    return x;
  }
  function noteHTML(x) { if (!x.note) return '';
    return '<div class="nb"><b>' + esc(x.note) + '</b>' + (x.noteWhy ? '<span>' + esc(x.noteWhy) + '</span>' : '') +
      (x.act ? '<a class="go" href="' + x.act.href + '" target="_blank" rel="noopener">' + esc(x.act.t) + ' ›</a>' : '') + '</div>'; }
  window.__lcNote = noteHTML; window.__lcOff = function (k) { return typeof WS !== 'undefined' && WS.allBuilt() && OFF.indexOf(k) >= 0; };

  // ---------------------------------------------------------------- the card
  var card = null, chap = null, nav = null;
  function build() {
    var L = $('left'); if (!L || card) return;
    card = document.createElement('div'); card.id = 'lcCard'; card.setAttribute('translate', 'no');
    var head = L.querySelector('.l2-head'), steps = L.querySelector('.steps'), sh = steps && steps.previousElementSibling;
    if (head && head.parentNode === L) L.insertBefore(card, head.nextSibling);
    else if (sh && sh.tagName === 'H2') sh.parentNode.insertBefore(card, sh);              // the phone's sheet keeps its own head
    else L.insertBefore(card, L.firstChild);
    // the steps, by chapter, after the card; the links to step 1 and to a package after them
    if (steps && !steps.querySelector('.lcChapH')) {
      CH.concat([{ n: 5, en: 'The way out', zh: '出口', steps: [27] }]).forEach(function (c) {
        var b = steps.querySelector('[data-step="' + c.steps[0] + '"]'); if (!b) return;
        var h = document.createElement('div'); h.className = 'lcChapH'; h.dataset.ch = c.n; steps.insertBefore(h, b); });
      var h2 = steps.previousElementSibling; if (h2 && h2.tagName === 'H2') h2.dataset.lc = 'steps';
      var meta = L.querySelector('.l2-badge'); meta = meta && meta.parentElement;
      var navL = L.querySelector('.l2-nav'), after = navL || steps;
      if (meta) after.parentNode.insertBefore(meta, after.nextSibling);
    }
    // over the map: the chapters; under it: previous, the demo (when there is one), next
    var wrap = $('wrap');
    chap = document.createElement('div'); chap.id = 'lcChap'; chap.setAttribute('translate', 'no'); wrap.appendChild(chap);
    nav = document.createElement('div'); nav.id = 'lcNav'; nav.setAttribute('translate', 'no');
    nav.innerHTML = '<button type="button" class="pv"></button><span class="slot"></span><button type="button" class="nx"></button>';
    wrap.appendChild(nav);
    nav.querySelector('.pv').onclick = function () { go(-1); }; nav.querySelector('.nx').onclick = function () { go(1); };
    // the example's demo bar joins them (on a phone it stays where it is, over the map)
    var dock = function () { var b = $('lcAuto'); if (b && !H.classList.contains('l2phone') && b.parentNode !== nav.querySelector('.slot')) nav.querySelector('.slot').appendChild(b); };
    dock(); new MutationObserver(dock).observe(document.body, { childList: true });
    new MutationObserver(render).observe(H, { attributes: true, attributeFilter: ['lang'] });
  }
  function go(d) { var i = ORDER.indexOf(S.step), j = i + d; if (i < 0 || j < 0 || j >= ORDER.length) return;
    var b = document.querySelector('[data-step="' + ORDER[j] + '"]'); if (b) b.click(); }
  function openSetting(id) {                               // the slider that sets this, opened and shown
    var el = $(id); if (!el) return;
    var adv = el.closest('.l2-adv'); if (adv && !adv.classList.contains('open')) adv.classList.add('open');
    var row = el.closest('.row') || el.closest('label') || el;
    row.scrollIntoView({ behavior: 'smooth', block: 'center' });
    row.classList.remove('lcFlash'); void row.offsetWidth; row.classList.add('lcFlash');
  }
  function render() {
    if (!card || !ok()) return;
    var k = S.step, x = info(k), ch = chapterOf(k), pos = ORDER.indexOf(k);
    if (!x) { card.innerHTML = ''; return; }
    var kick = (ch ? T('Chapter ' + ch.n + ' · ' + ch.en, CHZ(ch.n) + ' · ' + ch.zh) : T('The way out', '出口')) + '<span>' + (k === 28 ? T('After step 16', '第 16 步之后') : k === 27 ? T('Step 17', '第 17 步') : T('Step ' + shown(k) + ' of 17', '第 ' + shown(k) + ' / 17 步')) + '</span>';
    var h = '<div class="k">' + kick + '</div><h3>' + esc(x.t) + '</h3>';
    h += '<div class="l">' + T('What it did', '做了什么') + '</div><p>' + esc(x.did) + '</p>';
    if (x.why) h += '<div class="l">' + T('Why', '为什么') + '</div><p>' + esc(x.why) + '</p>';
    h += noteHTML(x);
    if (x.prm.length) { h += '<div class="l">' + T('Settings', '参数') + '</div><div class="prm">';
      x.prm.forEach(function (p) { h += '<div' + (p[2] && $(p[2]) ? ' class="set" data-set="' + p[2] + '" title="' + T('Change it', '调整') + '"' : '') + '><span>' + esc(p[0]) + '</span><b>' + esc(p[1]) + '</b>' + (p[2] && $(p[2]) ? '<i>' + T('change', '调整') + ' ›</i>' : '') + '</div>'; });
      h += '</div>'; }
    if (x.res.length || !x.extra) h += '<div class="l">' + T('What came out', '结果') + '</div>';
    if (x.res.length) { h += '<div class="res">'; x.res.forEach(function (r) { h += '<div><b>' + esc(r[0]) + '</b><span>' + esc(r[1]) + '</span></div>'; }); h += '</div>'; }
    else if (!x.extra && !x.off && !x.note) h += '<p class="wait">' + (k > 20 && !S.relaxed ? T('Relax the wool first (step 10).', '先松弛毛线（第 10 步）。') : T('Working it out…', '计算中…')) + '</p>';
    if (x.extra) h += x.extra;
    var lg = $('legend'), rows = lg ? [].slice.call(lg.children, 0, x.leg || 3) : [];
    if (rows.length) h += '<div class="lg">' + rows.map(function (r) { return '<div>' + r.innerHTML + '</div>'; }).join('') + '</div>';
    card.innerHTML = h;
    [].forEach.call(card.querySelectorAll('[data-set]'), function (d) { d.onclick = function () { openSetting(d.dataset.set); }; });
    if (x.after) x.after(card);
    // the chapters over the map
    var c = '';
    var CC = { 1: '#5FF2FF', 2: '#C6F432', 3: '#B08CFF', 4: '#FF8A3D' };      // (25 Nov) each chapter its colour
    CH.forEach(function (C) { var on = C.steps.indexOf(k) >= 0;
      c += '<div class="ch' + (on ? ' on' : '') + '" style="--c:' + CC[C.n] + '"><div class="cl">' + (zh() ? C.n + ' ' + C.zh : C.n + ' ' + C.en) + '</div><div class="tk">';
      C.steps.forEach(function (s) { var i = ORDER.indexOf(s); c += '<i data-s="' + s + '" class="' + (s === k ? 'c' : i < pos ? 'd' : '') + '" title="' + (s === 28 ? T('After step 16 · Evaluation', '第 16 步之后 · 评价') : shown(s) + ' ' + esc(stepName(s))) + '"></i>'; });      // (26 Nov 2026) 28 is no step 18
      c += '</div></div>'; });
    chap.innerHTML = c;
    [].forEach.call(chap.querySelectorAll('[data-s]'), function (t) { t.onclick = function () {      // a step picked here stops the demo, as a button does
      var A = window.__LC_AUTO__, st = document.querySelector('#lcAuto .stop'); if (A && A.on && st) st.click();
      var b = document.querySelector('[data-step="' + t.dataset.s + '"]'); if (b) b.click(); }; });
    // previous and next, named
    var pv = nav.querySelector('.pv'), nx = nav.querySelector('.nx'), a = ORDER[pos - 1], b = ORDER[pos + 1];
    pv.disabled = !a; nx.disabled = !b;
    var no = function (s) { return s === 27 ? '17 ' : s === 28 ? '' : shown(s) + ' '; };
    pv.textContent = a ? '‹ ' + no(a) + stepName(a) : '‹';
    nx.textContent = b ? no(b) + stepName(b) + ' ›' : '›';
    [].forEach.call(document.querySelectorAll('#left .lcChapH'), function (e) { var n = +e.dataset.ch, C = CH[n - 1];
      e.textContent = C ? (zh() ? CHZ(n) + ' · ' + C.zh : 'Chapter ' + n + ' · ' + C.en) : T('The way out', '出口'); });
    var sh2 = document.querySelector('#left h2[data-lc="steps"]'); if (sh2) sh2.textContent = T('All the steps', '全部步骤');
    place();
  }
  function place() {                                     // under the map, or just above the zoom buttons when they would meet
    if (!nav) return; nav.style.bottom = '';
    var z = $('lkZoom'), w = $('wrap'); if (!z || !w) return;
    var a = nav.getBoundingClientRect(), b = z.getBoundingClientRect(), r = w.getBoundingClientRect();
    if (a.left < b.right + 8 && a.right > b.left - 8 && a.bottom > b.top - 8) nav.style.bottom = Math.round(r.bottom - b.top + 10) + 'px';
  }
  window.addEventListener('resize', function () { setTimeout(place, 60); });
  window.__lcInfo = info; window.__lcOpenSetting = openSetting;      // (25 Nov) the flow (flow.js) shows them in its cards
  window.__lcCard = function () { if (!H.classList.contains('l2ui')) return; build(); render(); };
  window.__lcCardSoilReset = function () { soilShare = null; };
})();
