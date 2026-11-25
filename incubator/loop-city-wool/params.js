/* Loop City step 2 · every setting, with its step (25 Nov 2026).
   The flow (flow.js) shows each step's settings on its own card: the main ones at once, the rest under "More". Each has
   its default (a mark on the slider), its value now and a way back to the default. Changing one works the method out
   again from where it acts:
     bake  — steps 4 to 8, worked out again from their stage (window.__woolRedo in the page);
     page  — a slider the page had already (steps 8 to 16): its own control is set, so its own handler does the rest;
     net   — the anchors and threads made again (step 8 near the station, step 9 segments);
     exist — which existing roads count (step 4): the bands traced again.
   The page's own controls stay where they were, hidden: one set of handlers, nothing done twice. */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var T = function (en, cn) { return /^zh/i.test(document.documentElement.lang || '') ? cn : en; };
  var fmt = function (v, d) { return Number(v).toLocaleString('en-GB', { minimumFractionDigits: d || 0, maximumFractionDigits: d || 0 }); };
  var fire = function (el) { if (!el) return; el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); };
  var m28 = function (v) { return fmt(v * 28) + ' m'; };
  var K = function () { return window.__WOOL_K__ || {}; };
  // a slider the page had: its value is the control's
  var pageR = function (id) { return { get: function () { var e = $(id); return e ? +e.value : NaN; }, set: function (v) { var e = $(id); if (!e) return; e.value = v; fire(e); }, how: 'page' }; };
  var pageC = function (id) { return { get: function () { var e = $(id); return e && e.checked ? 1 : 0; }, set: function (v) { var e = $(id); if (!e) return; e.checked = !!v; fire(e); }, how: 'page' }; };
  var bake = function (key, stage, scale) { scale = scale || 1; return { get: function () { return K()[key] / scale; }, set: function (v) { K()[key] = v * scale; }, how: 'bake', stage: stage }; };
  var L = [];
  var add = function (o) { L.push(Object.assign.apply(null, [o].concat([].slice.call(arguments, 1)))); };

  // 4 · existing roads
  add({ step: 4, id: 'TOWN_MIN', lab: ['A town is cut out from', '城镇计入下限'], kind: 'range', min: 0.05, max: 2, st: 0.05, def: 0.25, f: function (v) { return fmt(v, 2) + ' km²'; },
    note: ['Towns smaller than this stay inside the cells.', '小于此的城镇不从单元里挖掉。'] }, bake('TOWN_MIN', 4));
  add({ step: 4, id: 'EXCLS', more: 1, lab: ['Existing roads that count', '计入的现有道路'], kind: 'seg', def: 'MAB',
    opts: [['MAB', ['M · A · B', 'M · A · B']], ['MA', ['M · A', 'M · A']], ['M', ['M only', '只有 M']]],
    note: ['The roads the new network may merge into and raise (steps 12 and 16).', '新路网可以并入、可以提升的现有道路（第 12、16 步）。'] },
    { get: function () { return typeof EX_CLS === 'undefined' ? 'MAB' : ['M', 'A', 'B'].filter(function (c) { return EX_CLS[c]; }).join(''); },
      set: function (v) { if (typeof EX_CLS === 'undefined') return; ['M', 'A', 'B'].forEach(function (c) { if (v.indexOf(c) >= 0) EX_CLS[c] = c; else delete EX_CLS[c]; });
        EXIST = DATA.roads.filter(function (r) { return EX_CLS[r.c]; }); BD.key = null; BD.cache.clear(); if (typeof bdChanged === 'function') bdChanged(); legend(); schedule(); }, how: 'exist' });
  // 5 · primary cells
  add({ step: 5, id: 'EASE', lab: ['Corners eased by', '转角圆角'], kind: 'range', min: 0, max: 200, st: 5, def: 85, f: function (v) { return fmt(v) + ' m'; } }, bake('EASE', 5));
  add({ step: 5, id: 'HALF_ROAD', more: 1, lab: ['Road cut, width', '道路刀宽'], kind: 'range', min: 10, max: 100, st: 5, def: 40, f: function (v) { return fmt(v) + ' m'; },
    note: ['Only where a road runs through a cell.', '只在有道路穿过单元时起作用。'] }, bake('HALF_ROAD', 5, 0.5));
  add({ step: 5, id: 'MIN_PRIM', more: 1, lab: ['Smallest piece woven', '最小可编织块'], kind: 'range', min: 0.5, max: 10, st: 0.5, def: 3, f: function (v) { return fmt(v, 1) + ' km²'; } }, bake('MIN_PRIM', 5, 1e6));
  add({ step: 5, id: 'SIMPLIFY', more: 1, lab: ['Outline simplified by', '边界简化'], kind: 'range', min: 10, max: 150, st: 5, def: 45, f: function (v) { return fmt(v) + ' m'; } }, bake('SIMPLIFY', 5));
  // 7 · good land kept for farming
  add({ step: 7, id: 'KEEP', lab: ['Kept for farming', '保留为耕地'], kind: 'seg', def: 2, opts: [[1, ['Grade 1', '一级']], [2, ['Grade 1–2', '一、二级']], [3, ['Grade 1–3a', '一至 3a 级']]] }, bake('KEEP', 7));
  add({ step: 7, id: 'SMOOTH', lab: ['Edges smoothed by', '边界平滑半径'], kind: 'range', min: 20, max: 400, st: 10, def: 160, f: function (v) { return fmt(v) + ' m'; } }, bake('SMOOTH', 7));
  add({ step: 7, id: 'MIN_PIECE', lab: ['Bits under this join a neighbour', '小于此的碎块并入相邻'], kind: 'range', min: 10, max: 300, st: 10, def: 60, f: function (v) { return fmt(v) + ' ha'; } }, bake('MIN_PIECE', 7, 1e4));
  add({ step: 7, id: 'MIN_ZONE', more: 1, lab: ['Smallest soil cell', '最小土壤单元'], kind: 'range', min: 5, max: 200, st: 5, def: 40, f: function (v) { return fmt(v) + ' ha'; } }, bake('MIN_ZONE', 7, 1e4));
  // 8 · anchors
  add({ step: 8, id: 'spacing', lab: ['Anchor spacing', '锚点间距'], kind: 'range', min: 1000, max: 5000, st: 100, def: 3000, f: function (v) { return fmt(v) + ' m'; } }, pageR('spacing'));
  add({ step: 8, id: 'nearF', lab: ['Within 3 km of the station', '车站附近'], kind: 'range', min: 0.4, max: 1, st: 0.05, def: 1, f: function (v) { return '× ' + fmt(v, 2); } }, pageR('nearF'));
  add({ step: 8, id: 'soilF', lab: ['On Grade 1–2 soil', '一、二级农地上'], kind: 'range', min: 1, max: 2.5, st: 0.05, def: 1.5, f: function (v) { return '× ' + fmt(v, 2); } }, pageR('soilF'));
  add({ step: 8, id: 'APART', more: 1, lab: ['Road anchors at least', '路口锚点间至少'], kind: 'range', min: 200, max: 1500, st: 50, def: 600, f: function (v) { return fmt(v) + ' m'; } }, bake('APART', 8));
  add({ step: 8, id: 'NEAR_R', more: 1, lab: ['"Near the station" reaches', '「车站附近」半径'], kind: 'range', min: 1, max: 6, st: 0.5, def: 3, f: function (v) { return fmt(v, 1) + ' km'; } },
    { get: function () { return typeof NEAR_R === 'undefined' ? 3 : NEAR_R / 1000; }, set: function (v) { NEAR_R = v * 1000; rebuildNet(); buttons(); }, how: 'net' });
  add({ step: 8, id: 'NEAR_AREA', more: 1, lab: ['A road end this near makes an anchor', '路端多近算锚点'], kind: 'range', min: 100, max: 600, st: 20, def: 260, f: function (v) { return fmt(v) + ' m'; } }, bake('NEAR_AREA', 8));
  add({ step: 8, id: 'CLEAR', more: 1, lab: ['Kept clear round a station', '车站周围留空'], kind: 'range', min: 0, max: 600, st: 25, def: 250, f: function (v) { return fmt(v) + ' m'; } }, bake('CLEAR', 8));
  // 9 · base net
  add({ step: 9, id: 'net', lab: ['Rule', '连线规则'], kind: 'seg', def: 'opp', opts: [['opp', ['Across the cell', '连向对面']], ['alt', ['Every second', '隔一个连']]] },
    { get: function () { return typeof OPP === 'undefined' || OPP ? 'opp' : 'alt'; }, set: function (v) { var b = document.querySelector('#bdNet [data-net="' + v + '"]'); if (b) b.click(); }, how: 'page' });
  add({ step: 9, id: 'bd_oppw', lab: ['Ties per anchor', '每个锚点的连线'], kind: 'range', min: 1, max: 4, st: 1, def: 2, f: function (v) { return fmt(2 * v + 1); } }, pageR('bd_oppw'));
  add({ step: 9, id: 'segs', more: 1, lab: ['Segments per thread', '每根线的段数'], kind: 'range', min: 20, max: 160, st: 10, def: 80, f: function (v) { return fmt(v); },
    note: ['More segments bend more finely and relax more slowly.', '段数越多弯得越细，松弛越慢。'] },
    { get: function () { return typeof DEF === 'undefined' ? 80 : DEF.segs; }, set: function (v) { DEF.segs = v; rebuildNet(); buttons(); }, how: 'net' });
  // 10 · relaxing
  add({ step: 10, id: 'magnet', lab: ['Magnet', '磁力'], kind: 'range', min: 100, max: 2500, st: 50, def: 1000, f: function (v) { return fmt(v); } }, pageR('magnet'), { relax: 1 });
  // (25 Nov, the method's second version) the surplus: how much longer than the shortest way each thread may be
  add({ step: 10, id: 'over', lab: ['Surplus', '余量'], kind: 'range', min: 0, max: 15, st: 1, def: 8, f: function (v) { return fmt(v) + ' %'; },
    note: ['How much longer each thread is than the shortest way between its anchors: all the room it has to bend.', '每根线比两锚点间最短路径长出多少：它能弯曲的全部余地。'] }, pageR('over'), { relax: 1 });
  add({ step: 10, id: 'angle', more: 1, lab: ['Angle (stiffness)', '抗弯（角度）'], kind: 'range', min: 0, max: 40000, st: 500, def: 0, f: function (v) { return fmt(v); } }, pageR('angle'), { relax: 1 });
  add({ step: 10, id: 'steps', lab: ['Steps', '步数'], kind: 'range', min: 200, max: 3000, st: 100, def: 1500, f: function (v) { return fmt(v); } }, pageR('steps'), { relax: 1 });
  // 11 · road bands
  add({ step: 21, id: 'bd_thread', lab: ['Band of one thread', '单根线的带宽'], kind: 'range', min: 2, max: 5, st: 1, def: 3, f: m28 }, pageR('bd_thread'));
  add({ step: 21, id: 'bd_close1', lab: ['Rounding where bands meet', '交汇处圆角'], kind: 'range', min: 0, max: 5, st: 1, def: 3, f: m28 }, pageR('bd_close1'));
  // 12 · with the existing roads
  add({ step: 22, id: 'bd_attract', lab: ['Merge into existing roads', '并入现有道路'], kind: 'chk', def: 1 }, pageC('bd_attract'));
  add({ step: 22, id: 'bd_reach', lab: ['Reach', '吸附范围'], kind: 'range', min: 0, max: 500, st: 25, def: 250, f: function (v) { return fmt(v) + ' m'; }, off: function () { return !$('bd_attract') || !$('bd_attract').checked ? T('Merge is off', '并入已关闭') : ''; } }, pageR('bd_reach'));
  add({ step: 22, id: 'bd_rim', more: 1, lab: ['Cell edge as a road', '单元边界作为路'], kind: 'range', min: 3, max: 9, st: 1, def: 7, f: m28 }, pageR('bd_rim'));
  // 13 · fine tuning
  add({ step: 23, id: 'bd_rmax', lab: ['Widest band, each side', '最宽的带（每侧）'], kind: 'range', min: 2, max: 6, st: 1, def: 4, f: m28 }, pageR('bd_rmax'));
  add({ step: 23, id: 'bd_narrow', lab: ['Close blocks narrower than', '合上窄于此的街区'], kind: 'range', min: 0, max: 6, st: 0.5, def: 3, f: function (v) { return v ? m28(v) : T('off', '关'); } }, pageR('bd_narrow'));
  add({ step: 23, id: 'bd_ends', more: 1, lab: ['Open ends carried on to the next road', '断头延伸到下一条路'], kind: 'chk', def: 1 }, pageC('bd_ends'));
  add({ step: 23, id: 'bd_sigma', more: 1, lab: ['Smoothing along a road', '沿路平滑'], kind: 'range', min: 0, max: 200, st: 10, def: 90, f: function (v) { return fmt(v) + ' m'; } }, pageR('bd_sigma'));
  // 14 · bigger parcels
  add({ step: 24, id: 'bd_small', lab: ['Merge blocks under', '合并小于此的街区'], kind: 'range', min: 0, max: 30, st: 1, def: 12, f: function (v) { return v ? fmt(v) + ' ha' : T('off', '关'); } }, pageR('bd_small'));
  add({ step: 24, id: 'bd_smallMax', more: 1, lab: ['A merged parcel never over', '合并后不超过'], kind: 'range', min: 10, max: 80, st: 5, def: 30, f: function (v) { return fmt(v) + ' ha'; } }, pageR('bd_smallMax'));
  // 15 · parcels by use
  add({ step: 25, id: 'useFrom', lab: ['Use from', '用途依据'], kind: 'seg', def: 1, opts: [[1, ['The growth', '增长模拟']], [0, ['The soil', '土壤']]] },
    { get: function () { return typeof BD === 'undefined' ? 1 : BD.p.useFrom; }, set: function (v) { var b = document.querySelector('#bdUseFrom [data-uf="' + v + '"]'); if (b) b.click(); }, how: 'page' });
  add({ step: 25, id: 'bd_park', lab: ['A park is a parcel under', '小于此的地块是公园'], kind: 'range', min: 0, max: 60, st: 1, def: 25, f: function (v) { return v ? fmt(v) + ' ha' : T('off', '关'); } }, pageR('bd_park'));
  add({ step: 25, id: 'bd_farm', lab: ['Farming when good soil is over', '良田超过此比例为农业'], kind: 'range', min: 20, max: 90, st: 5, def: 50, f: function (v) { return fmt(v) + ' %'; },
    off: function () { return typeof BD !== 'undefined' && BD.p.useFrom ? T('Only when the use comes from the soil', '只在「依据土壤」时起作用') : ''; } }, pageR('bd_farm'));
  // 16 · road hierarchy, and the true widths
  add({ step: 26, id: 'bd_r2', lab: ['No place further from a primary road than', '离一级道路不超过'], kind: 'range', min: 1.5, max: 4, st: 0.25, def: 2.5, f: function (v) { return fmt(v, 2) + ' km'; } }, pageR('bd_r2'));
  add({ step: 26, id: 'bd_r3', lab: ['No place further from an A road than', '离 A 级道路不超过'], kind: 'range', min: 0.75, max: 2, st: 0.125, def: 1.25, f: function (v) { return fmt(v, 2) + ' km'; } }, pageR('bd_r3'));
  add({ step: 26, id: 'bd_exfirst', lab: ['Existing roads first', '现有道路优先'], kind: 'chk', def: 1 }, pageC('bd_exfirst'));
  add({ step: 26, id: 'bd_line', more: 1, lab: ['Main roads smoothed over', '主路平滑'], kind: 'range', min: 0, max: 500, st: 20, def: 320, f: function (v) { return fmt(v) + ' m'; } }, pageR('bd_line'));
  add({ step: 26, id: 'bd_wH', more: 1, lab: ['Boundary highways, wide', '边界高速 宽'], kind: 'range', min: 60, max: 120, st: 5, def: 90, f: function (v) { return fmt(v) + ' m'; } }, pageR('bd_wH'));
  add({ step: 26, id: 'bd_wP', more: 1, lab: ['Primary roads, wide', '一级道路 宽'], kind: 'range', min: 48, max: 80, st: 4, def: 60, f: function (v) { return fmt(v) + ' m'; } }, pageR('bd_wP'));
  add({ step: 26, id: 'bd_wA', more: 1, lab: ['A roads, wide', 'A 级道路 宽'], kind: 'range', min: 36, max: 72, st: 4, def: 48, f: function (v) { return fmt(v) + ' m'; } }, pageR('bd_wA'));
  add({ step: 26, id: 'bd_wB', more: 1, lab: ['B roads, from', 'B 级道路 起'], kind: 'range', min: 12, max: 36, st: 2, def: 24, f: function (v) { return fmt(v) + ' m'; } }, pageR('bd_wB'));
  add({ step: 26, id: 'bd_fillet', more: 1, lab: ['Largest corner radius', '最大转角半径'], kind: 'range', min: 0, max: 200, st: 10, def: 110, f: function (v) { return fmt(v) + ' m'; } }, pageR('bd_fillet'));

  var near = function (a, b) { return typeof a === 'number' && typeof b === 'number' ? Math.abs(a - b) < 1e-9 : String(a) === String(b); };
  window.__lcParams = {
    list: L,
    of: function (k) { return L.filter(function (p) { return p.step === k; }); },
    byId: function (id) { return L.find(function (p) { return p.id === id; }); },
    val: function (p) { try { return p.get(); } catch (e) { return p.def; } },
    changed: function (p) { return !near(this.val(p), p.def); },
    lab: function (p) { return T(p.lab[0], p.lab[1]); },
    show: function (p, v) { if (v === undefined) v = this.val(p); if (p.kind === 'chk') return v ? T('on', '开') : T('off', '关');
      if (p.kind === 'seg') { var o = p.opts.find(function (q) { return near(q[0], v); }); return o ? T(o[1][0], o[1][1]) : String(v); } return p.f ? p.f(v) : String(v); },
    count: L.length
  };
})();
