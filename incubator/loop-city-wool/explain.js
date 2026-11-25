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
    { n: 4, en: 'Making roads', zh: '成路', steps: [21, 22, 23, 24, 25, 26] }
  ];
  var CHZ = function (n) { return '第 ' + n + ' 章'; };
  var shown = function (k) { return k > 20 ? k - 10 : k; };
  var chapterOf = function (k) { for (var i = 0; i < CH.length; i++) if (CH[i].steps.indexOf(k) >= 0) return CH[i]; return null; };
  var ORDER = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 21, 22, 23, 24, 25, 26, 27];
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
  var threadsN = function () { return (S.jobs || []).reduce(function (s, j) { return s + (j ? j.T : 0); }, 0); };
  var R = function () { return typeof BD !== 'undefined' ? BD.res : null; };
  var N = function () { var r = R(); return (r && r.numbers) || {}; };
  var hierKm = function () { var r = R(); if (!r || !r.hier) return null; var a = 0; for (var k in r.hier.km) a += r.hier.km[k]; return a; };
  var bp = function (k) { return typeof BD !== 'undefined' ? BD.p[k] : undefined; };
  var m28 = function (v) { return f(v * 28) + ' m'; };
  var notYet = T('not worked out yet', '尚未计算');

  // ---------------------------------------------------------------- the sixteen steps (and the way out, 17)
  // each: title, what it did (with the numbers), why, settings [label, value, slider id], results [value, label], legend rows to show
  function info(k) {
    var n = DATA.nums, c3 = DATA.cells.length, k5 = K();
    switch (k) {
      case 1: return { t: T('The network the slime mould found is the new town’s frame', '黏菌找到的网，就是新城的骨架'),
        did: T('The paths the agents of step 1’s whole-loop run took; brighter where more of them went.', '第 1 步整环模拟里代理走过的路径，越亮走得越多。'),
        why: T('The mould links the stations with the least total length and some spare loops: an efficient, robust network.', '黏菌用最短的总长把车站连起来，还留有备用的环路：高效又不怕断。'),
        prm: [[T('From', '来源'), T('step 1, the whole loop', '第 1 步：整环')], [T('Cells taken', '带来的单元'), DATA.cells.map(function (c) { return c.id; }).join(' · ')]],
        res: [[c3, T('cells', '个单元')], [DATA.stations.filter(function (s) { return s.cell; }).length, T('stations in them', '个车站')]], leg: 2 };
      case 2: return { t: T('The veins drawn in to centrelines', '菌脉收成中心线'),
        did: T('Where the trail is over 0.20 it is a vein; each vein is thinned to its centreline. A vein that ends is a spur (dashed).', '路径值大于 0.20 的地方是菌脉，每条菌脉细化成它的中心线；末端的支脉用虚线。'),
        why: T('A vein is a band; only a line can close round a cell.', '菌脉是一条条「带」，只有线才能围出单元的边界。'),
        prm: [[T('Vein: trail over', '菌脉阈值'), '0.20']],
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
        why: T('The wool is woven inside each piece only; it never runs across a road that is there.', '毛线只在每一块里面编，不能跨过现有的路。'),
        prm: [[T('Road cut, width', '道路刀宽'), (2 * (k5.HALF_ROAD || 20)) + ' m'], [T('Corners eased by', '转角圆角'), (k5.EASE || 85) + ' m'], [T('Smallest piece woven', '最小可编织块'), ((k5.MIN_PRIM || 3e6) / 1e6) + ' km²']],
        res: DATA.primary.length ? [[DATA.primary.length, T('primary cells', '个一级单元')], [f(DATA.primary.reduce(function (s, p) { return s + p.km2; }, 0), 1), 'km²'], [DATA.small.length, T('small pieces left', '块小碎块')]] : [], leg: 4 };
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
        did: T('An anchor where each existing road crosses a primary cell’s edge, and more between them at the spacing.', '在现有道路与一级单元边界相交处放锚点，锚点之间再按间距补上。'),
        why: T('The anchors fix where roads come in and out, and how dense the net will be.', '锚点决定路从哪里进出，也决定网有多密。'),
        prm: [[T('Spacing', '锚点间距'), f(P.spacing) + ' m', 'spacing'], [T('Within 3 km of the station', '车站 3 km 内'), '× ' + f(P.nearF, 2), 'nearF'], [T('On Grade 1–2 soil', '一、二级农地上'), '× ' + f(P.soilF, 2), 'soilF'], [T('Road anchors at least', '路口锚点间至少'), (k5.APART || 600) + ' m']],
        res: [[a.all, T('anchors', '个锚点')], [a.road, T('on the roads', '个在路口')], [a.between, T('between', '个按间距')]], leg: 3 }; }
      case 9: return { t: T('Anchors tied to one another', '锚点两两相连'),
        did: T('Inside each primary cell every anchor is tied to anchors ', '每个一级单元里，每个锚点连向') + (OPP ? T('across the cell', '边界对面的锚点') : T('round the edge, every second one', '沿边界隔一个的锚点')) + T('; each thread has 80 segments.', '；每根线分 80 段。'),
        why: T('Frei Otto’s wet wool: first every possible straight link, then let the forces pick the routes.', 'Frei Otto 的湿毛线：先给出所有可能的直线连接，再让力学挑出路线。'),
        prm: [[T('Rule', '连线规则'), OPP ? T('across the cell', '连向对面') : T('every second', '隔一个连')], [T('Ties per anchor', '每个锚点的连线'), (bp('oppw') || 2), 'bd_oppw'], [T('Segments per thread', '每根线'), T('80', '80 段')]],
        res: [[threadsN(), T('threads', '根毛线')], [(S.jobs || []).filter(Boolean).length, T('primary cells woven', '个一级单元')]], leg: 2 };
      case 10: return { t: T('The wet wool draws together', '湿毛线聚成束'),
        did: T('The threads pull towards each other (magnet) and resist bending (angle), live, until they settle in bundles.', '毛线之间互相吸引（磁力），又抵抗弯曲（角度），实时松弛，直到并成一束束。'),
        why: T('Where threads run together is where traffic would gather: those are the roads.', '线并在一起的地方，就是交通会自然汇集的地方：那就是路。'),
        prm: [[T('Magnet', '磁力'), f(P.magnet), 'magnet'], [T('Angle (stiffness)', '抗弯（角度）'), f(P.angle), 'angle'], [T('Steps', '步数'), f(P.steps), 'steps']],
        res: [[threadsN(), T('threads', '根毛线')], [S.relaxMs !== null && S.relaxMs !== undefined ? f(S.relaxMs / 1000, 1) + ' s' : (S.busy ? T('running', '运行中') : notYet), T('to relax', '松弛用时')]], leg: 2 };
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
        did: (r && r.useFrom === 'growth') ? T('From the growth simulation: urban where over half is built, farming where over half is farmed, a park where the parcel is small.', '依据增长模拟：过半建成的是城市，过半耕种的是农业，小地块做公园。') : T('From the soil: farming where enough of the parcel is good farm soil, urban otherwise, a park where it is small.', '依据土壤：良田占比够的是农业，其余是城市，小地块做公园。'),
        why: T('The wool gives the roads; the growth simulation gives what the land between them becomes.', '毛线给出路，增长模拟给出路之间的土地做什么。'),
        prm: [[T('A park is a parcel under', '小于此的地块是公园'), bp('park') + ' ha', 'bd_park'], [T('Farming when good soil is over', '良田超过此比例为农业'), bp('farm') + ' %', 'bd_farm']],
        res: u ? [[u[1] || 0, T('urban', '块城市') + ' · ' + f(km[1] || 0, 0) + ' km²'], [u[2] || 0, T('farming', '块农业') + ' · ' + f(km[2] || 0, 0) + ' km²'], [(u[3] || 0), T('parks', '块公园')]] : [], leg: 4 }; }
      case 26: { var h = R() && R().hier, o2 = h && h.out['60'], o3 = h && h.out['48']; return { t: T('The roads given their class', '道路分级'),
        did: T('Four classes at true widths. The cell edge is the boundary highway; a whole existing road is raised before a new road is made.', '分成四级，按真实宽度。单元边界是边界高速；先把整条现有道路提升，再新建道路。'),
        why: T('Every place should be within reach of a main road, without two main roads running side by side.', '每块地都要离主路够近，又不能两条主路并排走。'),
        prm: [[T('No place further from a primary road than', '离一级道路不超过'), f(bp('r2'), 2) + ' km', 'bd_r2'], [T('No place further from an A road than', '离 A 级道路不超过'), f(bp('r3'), 2) + ' km', 'bd_r3'], [T('Existing roads first', '现有道路优先'), bp('exfirst') ? T('yes', '是') : T('no', '否'), 'bd_exfirst']],
        res: o2 ? [[o2['new roads'], T('new primary roads', '条新一级道路')], [o3 ? o3['new roads'] : 0, T('new A roads', '条新 A 级道路')], [o2.raised.length + (o3 ? o3.raised.length : 0), T('existing roads raised whole', '条现有道路整条提升')], [o2['land within reach %'] + ' %', T('of the land near a primary road', '用地在一级路覆盖内')]] : [], leg: 4 }; }
      case 27: return { t: T('Take the parcels on to the tensor field', '选出地块，交给张量场'),
        did: T('Click an urban parcel to take it, shift-click for more; double-click to open them in the base for the tensor field.', '点击城市地块选中，按住 Shift 多选；双击把它们在张量场底图里打开。'),
        why: T('The street pattern inside each parcel is made in the next step, the tensor field.', '每块地里面的街道在下一步（张量场）生成。'),
        prm: [], res: [], leg: 3 };
    }
    return null;
  }

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
    var kick = (ch ? T('Chapter ' + ch.n + ' · ' + ch.en, CHZ(ch.n) + ' · ' + ch.zh) : T('The way out', '出口')) + '<span>' + (k === 27 ? T('Step 17', '第 17 步') : T('Step ' + shown(k) + ' of 16', '第 ' + shown(k) + ' / 16 步')) + '</span>';
    var h = '<div class="k">' + kick + '</div><h3>' + esc(x.t) + '</h3>';
    h += '<div class="l">' + T('What it did', '做了什么') + '</div><p>' + esc(x.did) + '</p>';
    h += '<div class="l">' + T('Why', '为什么') + '</div><p>' + esc(x.why) + '</p>';
    if (x.prm.length) { h += '<div class="l">' + T('Settings', '参数') + '</div><div class="prm">';
      x.prm.forEach(function (p) { h += '<div' + (p[2] && $(p[2]) ? ' class="set" data-set="' + p[2] + '" title="' + T('Change it', '调整') + '"' : '') + '><span>' + esc(p[0]) + '</span><b>' + esc(p[1]) + '</b>' + (p[2] && $(p[2]) ? '<i>' + T('change', '调整') + ' ›</i>' : '') + '</div>'; });
      h += '</div>'; }
    h += '<div class="l">' + T('What came out', '结果') + '</div>';
    if (x.res.length) { h += '<div class="res">'; x.res.forEach(function (r) { h += '<div><b>' + esc(r[0]) + '</b><span>' + esc(r[1]) + '</span></div>'; }); h += '</div>'; }
    else h += '<p class="wait">' + (k > 20 && !S.relaxed ? T('Relax the wool first (step 10).', '先松弛毛线（第 10 步）。') : T('Working it out…', '计算中…')) + '</p>';
    var lg = $('legend'), rows = lg ? [].slice.call(lg.children, 0, x.leg || 3) : [];
    if (rows.length) h += '<div class="lg">' + rows.map(function (r) { return '<div>' + r.innerHTML + '</div>'; }).join('') + '</div>';
    card.innerHTML = h;
    [].forEach.call(card.querySelectorAll('[data-set]'), function (d) { d.onclick = function () { openSetting(d.dataset.set); }; });
    // the chapters over the map
    var c = '';
    var CC = { 1: '#5FF2FF', 2: '#C6F432', 3: '#B08CFF', 4: '#FF8A3D' };      // (25 Nov) each chapter its colour
    CH.forEach(function (C) { var on = C.steps.indexOf(k) >= 0;
      c += '<div class="ch' + (on ? ' on' : '') + '" style="--c:' + CC[C.n] + '"><div class="cl">' + (zh() ? C.n + ' ' + C.zh : C.n + ' ' + C.en) + '</div><div class="tk">';
      C.steps.forEach(function (s) { var i = ORDER.indexOf(s); c += '<i data-s="' + s + '" class="' + (s === k ? 'c' : i < pos ? 'd' : '') + '" title="' + shown(s) + ' ' + esc(stepName(s)) + '"></i>'; });
      c += '</div></div>'; });
    chap.innerHTML = c;
    [].forEach.call(chap.querySelectorAll('[data-s]'), function (t) { t.onclick = function () {      // a step picked here stops the demo, as a button does
      var A = window.__LC_AUTO__, st = document.querySelector('#lcAuto .stop'); if (A && A.on && st) st.click();
      var b = document.querySelector('[data-step="' + t.dataset.s + '"]'); if (b) b.click(); }; });
    // previous and next, named
    var pv = nav.querySelector('.pv'), nx = nav.querySelector('.nx'), a = ORDER[pos - 1], b = ORDER[pos + 1];
    pv.disabled = !a; nx.disabled = !b;
    pv.textContent = a ? '‹ ' + (a === 27 ? 17 : shown(a)) + ' ' + stepName(a) : '‹';
    nx.textContent = b ? (b === 27 ? 17 : shown(b)) + ' ' + stepName(b) + ' ›' : '›';
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
