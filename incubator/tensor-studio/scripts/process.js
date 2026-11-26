/* Tensor Studio · the process mode (v8.7).
 * The generation shown as eight steps: site, environment, constraints, the tensor field, attractors, main streets,
 * second streets, review. Each step shows only its own settings and its own intermediate result; changing a setting
 * marks the later steps for a re-run. The growth (steps 6 and 7) is recorded frame by frame, so the timeline at the
 * bottom can play it back, pause it, change its speed and scrub back through it.
 * A classic script loaded after app.js: it uses the engine's globals directly (LINES, GEN, ATTR, …). */
'use strict';
(() => {
const T6 = window.__ts6; if (!T6) return;
const zh = () => TS_LANG === 'zh', L = (a, b) => zh() ? a : b, el = id => document.getElementById(id);
const SECOND = 'second streets branch off them';
const KEY = 'tensorStudio.flowMode';
const SPEED = { slow: { steps: 4, rate: 0.4 }, mid: { steps: 10, rate: 1 }, fast: { steps: 32, rate: 3 } };   // steps: growth steps (5 m each) a frame; rate: recorded frames a frame
const PHZH = {
  'main streets grow from your anchors': '主路从锚点出发生长',
  'main streets link the entries and the nodes': '主路连接入口与节点',
  'main streets: a second way where the network detours': '在绕远处补一条环路',
  'main streets: every entry joined': '每个入口都接入主路网',
  'main streets: the local centres joined': '次节点从两侧接入主路网',
  'main streets: through routes across the land': '贯通路横穿场地',
  'main streets along the contour, edge to edge': '主路沿等高线贯通到边界',
  'each circus tied into the main streets': '环形广场接入主路',
  'ring streets round the circuses': '环路围绕广场',
  'the main streets carried on across the road between the cells': '主路跨过地块间的道路继续',
  'second streets branch off them': '次路从主路两侧分出',
  "side streets off the land's edge, where there is room": '有空间处从边界伸出支路',
  'empty ground reached from the nearest street': '空地由最近的道路接入',
  'the second streets carried on across the road between the cells': '次路跨过地块间的道路继续',
  'no two streets side by side': '消除并行重复的道路',
  'no open ends': '清理断头路',
  'every end meets a street': '每个端点都接到道路上',
  'every main street ends on a main street': '主路端点接到主路上',
  'main streets done': '主路完成',
  'the blocks tidied': '整理地块与路口',
  'done': '完成' };
const ph = p => zh() ? (PHZH[p] || p) : p;
const DIRZH = { N: '北', NE: '东北', E: '东', SE: '东南', S: '南', SW: '西南', W: '西', NW: '西北' };
const dirName = k => { const n = DIRS[k] ? DIRS[k].name : '?'; return zh() ? (DIRZH[n] || n) : n; };

const PM = window.PM = { active: false, cur: 0, valid: 0, reached: 0, frames: [], marks: [], b6: -1, atB: false, target: 0,
  playing: null, livePaused: false, speed: 'mid', tok: 0, envTok: 0, auto: false, waiter: null, saved: null, nAttr: 0,
  area: null, prevM: null, lastM: null, runEV: [], runCul: [] };
try { const s = localStorage.getItem('tensorStudio.flowSpeed'); if (SPEED[s]) PM.speed = s; } catch (e) {}

/* ------------------------------------------------------------------ the eight steps */
const STEPS = [
  { k: 1, zh: '选场地', en: 'The site', rows: [],
    note: () => L('场地红线、锚点（现有道路与边界的交点）和后面要用到的数据。', 'The boundary, the anchors (where existing streets meet the edge) and the data the steps use.') },
  { k: 2, zh: '看环境', en: 'Environment', rows: [],
    note: () => L('点开每张图会循环播放它的动画：水位上升、雨水汇流、夏季风与冬季冷风吹过、舒适度叠合。这一步只是查看，不设参数；这些数据在后面参与道路计算：高程和汇水用于第 3 步的约束和第 4 步的张量场，风用于第 4 步的张量场和第 6、7 步的选线，舒适度和汇水用于第 7 步的次路疏密，全部用于第 8 步的评分。', 'Each map plays as a loop: the water rising, the rain running off, the summer and winter winds blowing through, comfort coming out of the two. A reading only, nothing to set here; the data shapes the streets later: elevation and runoff the constraints (step 3) and the field (step 4), the winds the field and the routes (steps 4, 6, 7), comfort and runoff the second streets\' density (step 7), and all of it the score (step 8).') },
  { k: 3, zh: '定约束', en: 'Constraints', rows: ['fOn', 'fAvoid', 'gOn', 'gW', 'gQ'],
    note: () => L('水体和要避让的洪水区从土地中扣除，道路不会进入。主要汇水路径留成蓝绿走廊：道路不沿走廊内部走，只能近似垂直地跨过（涵洞）。', 'Water and the flood zones kept clear come out of the land; no street enters them. The main runoff paths are kept as blue-green corridors: no street runs inside one, streets only cross them, near square, on culverts.') },
  { k: 4, zh: '建张量场', en: 'Tensor field', rows: ['wC', 'wSum', 'wWin', 'wG', 'fW', 'smooth'],
    note: () => L('每个因素给出一个方向，按权重叠成张量场：顺等高线；通风处顺夏季风；冷风强处横切冬季冷风；走廊旁沿走廊（滨水路）；洪水区顺流排水。流线就是道路将要遵循的方向，拖动滑块会实时转向。夏季通风和冬季挡风两项还直接作用于道路：主路选线时顺夏季风更省、顺冬季冷风更费；次路在顺夏季风、横切冷风的方向上分得更密。', 'Each factor gives a direction, weighted into one field: along the contour; along the summer wind where it blows; across the winter cold where it bites; along the corridors beside them (waterside streets); with the flow in the flood zones. The flow lines are the directions the streets will follow; they turn as you move a slider. The summer air and winter shelter sliders also act on the streets themselves: the route of a main street is cheaper along the summer wind and dearer along the winter cold, and side streets come closer where they would run along the summer wind or across the cold.') },
  { k: 5, zh: '放吸引点', en: 'Attractors', rows: ['pull'],
    note: () => L('点选一种节点，再在地图上单击放置；拖动可移动，右键删除。下面的滑块调节所选种类的吸引强度，每种各自保存。', 'Pick a kind of node, then click on the map to place it; drag to move, right-click to remove. The slider below sets the pull of the kind picked; each kind keeps its own.') },
  { k: 6, zh: '长主路', en: 'Main streets', rows: ['mMethod', 'd1', 'bMains', 'bMem'],
    note: () => L(el('mMethod').value === 'stitch' ? '缝合主路：先确定入口、主节点和边界节点之间谁连谁（最小生成树，再在绕远处补环路），每个次节点再从两侧各接一条主路，再按最低代价在场地上走线——顺着场的方向、避开陡坡和边缘、绕过水体、只能近似垂直跨过走廊。打开“优先完成主路”时，还会按主路间距补上贯通的等高线主路。' : '主路从锚点出发，沿场的方向每步 5 米生长，遇到别的主路形成十字或 T 路口，不与其他主路并行。打开“优先完成主路”时，还会按主路间距补上贯通的等高线主路，并把环形广场接进路网。', el('mMethod').value === 'stitch' ? 'Stitched main streets: first who links to whom among the entries, main nodes and edge nodes (a minimum spanning tree, then loops where it detours), each local node joined from two sides, then each link routed at the least cost — along the field, off steep ground and the edge, round the water, across a corridor only near square. With “main streets first”, contour avenues are added at the main spacing.' : 'Main streets start at the anchors and grow 5 m a step along the field, crossing or making a T where they meet another main street, never running alongside one. With “main streets first”, contour avenues are added at the main spacing and each circus is tied into the network.') },
  { k: 7, zh: '长次路', en: 'Second streets', rows: ['d2', 'wDens', 'bGap', 'bFork', 'bInfill'],
    note: () => L('次路从主路两侧分出，再清理并行和断头的道路；过大的地块沿水岸和走廊补一条滨水路，再横切开，仍切不开的（可建面积超过 4 公顷）保留为绿地；两条次路夹出的细长地块和小于 0.15 公顷的碎地块，去掉其中一条次路并入旁边，去不掉的作为口袋绿地；锐角路口掰正，主路两侧相距 25 m 内的次路接成十字。舒适度与节点定疏密：舒适处和节点附近次路更密，风大、低洼处更稀（0 % 为均匀）。分叉冲突阈值越低，在场方向冲突的地方越容易分出 Y 形岔路；拉到最右为关闭。', 'Second streets branch off the main ones, then streets side by side and open ends are tidied; a block still too big gets a waterside street along the water or corridor, then a cut across, and one that still cannot be cut (over 4 ha that can be built on) is kept as a park; a thin lens between two second streets, or a sliver under 0.15 ha, loses one of its second streets and joins the block next to it, or else is kept as a pocket park; sharp junctions are squared, and second streets meeting a main street from its two sides within 25 m meet at one crossroads. Comfort and nodes set the density: closer where it is comfortable and near the nodes, wider where it is windy or low (0 %: even). The lower the fork threshold, the more Y forks where the field pulls two ways; fully right turns it off.') },
  { k: 8, zh: '评价出图', en: 'Review and export', rows: ['fNum', 'bGeo'],
    note: () => L('综合评分把地块、路网、气候、地形、水五组各打 0–100 分，按权重加权；“方案比较”按你设定的数量自动试多组设置，在地图上展示每个方案的生成过程，排序后可预览、一键采用。下面是路网指标与上一个方案的对比；道路按宽度显示。', 'The score rates five groups (blocks, network, climate, terrain, water) 0-100 each, weighted; Compare runs tries as many settings as you set, shows each one being made on the map, ranks them; any can be previewed or taken in a click. Below, the network against the previous run; streets drawn at width.') } ];

/* ------------------------------------------------------------------ the panel */
const panel = el('panel'), homes = new Map();
const rowOf = id => { const e = el(id); if (!e) return null; if (id === 'bGeo') return e.closest('.btns'); if (id === 'fNum') return e; return e.closest('.row') || e.closest('label.lay') || e; };
const modeSw = document.createElement('div'); modeSw.className = 'pmMode'; modeSw.setAttribute('role', 'group');
modeSw.innerHTML = '<button type="button" data-pm="1"></button><button type="button" data-pm="0"></button>';
const box = document.createElement('section'); box.id = 'pmBox';
box.innerHTML = '<div class="pmTop"><h2 id="pmTitle"></h2><button type="button" id="pmAll"></button></div><ol class="pmList" id="pmList"></ol>';
{ const nav = el('siteNav'), pre = panel.querySelector('.preset-box'); (nav || panel.querySelector('.ts-head')).after(modeSw); pre.after(box); }
const list = box.querySelector('#pmList');
for (const s of STEPS){ const li = document.createElement('li'); li.className = 'pmStep'; li.dataset.k = s.k;
  li.innerHTML = '<button type="button" class="pmHead"><span class="pmNum"></span><span class="pmName"></span><span class="pmFlag"></span></button><div class="pmSum"></div>' +
    '<div class="pmBody"><p class="pmNote"></p><div class="pmExtra"></div><div class="card pmCard"></div><div class="pmActs"></div></div>';
  list.append(li); s.li = li; s.extra = li.querySelector('.pmExtra'); s.card = li.querySelector('.pmCard'); s.acts = li.querySelector('.pmActs');
  li.querySelector('.pmHead').onclick = () => { if (s.k <= PM.valid + 1 && s.k !== PM.cur){ stopAuto(); go(s.k); } };
  let tm = null; const changed = e => { const id = e && e.target && e.target.id; clearTimeout(tm); tm = setTimeout(() => onChange(s.k, id), 230); };
  s.card.addEventListener('input', changed); s.card.addEventListener('change', changed); }
// the actions of each step
const btn = (txt, cls, fn) => { const b = document.createElement('button'); b.type = 'button'; if (cls) b.className = cls; b.onclick = fn; b._t = txt; return b; };
for (const s of STEPS){
  if (s.k === 6) s.run = btn(() => PM.valid >= 6 ? L('重新生长主路', 'Grow again') : L('生长主路', 'Grow the main streets'), 'primary', () => { stopAuto(); grow(6); });
  if (s.k === 7) s.run = btn(() => PM.valid >= 7 ? L('重新生长次路', 'Grow again') : L('生长次路', 'Grow the second streets'), 'primary', () => { stopAuto(); grow(7); });
  if (s.k === 2) s.run = btn(() => L('播放分析', 'Play the analysis'), '', () => { stopAuto(); envTour(++PM.envTok); });
  if (s.k < 8) s.next = btn(() => L('下一步', 'Next step'), s.k === 6 || s.k === 7 ? '' : 'primary', () => { stopAuto(); go(s.k + 1); });
  if (s.k === 8) s.next = btn(() => L('回到第 1 步', 'Back to step 1'), '', () => { stopAuto(); go(1); });
  for (const b of [s.run, s.next]) if (b) s.acts.append(b); }
// step 2: the five analysis maps as chips
const ENVK = [['Z', '高程', 'Elevation'], ['Q', '汇水', 'Runoff'], ['V', '夏季通风', 'Summer air'], ['Cw', '冬季冷风', 'Winter cold'], ['C', '气候舒适', 'Comfort']];
const chips = document.createElement('div'); chips.className = 'pmChips';
for (const [k] of ENVK){ const b = document.createElement('button'); b.type = 'button'; b.dataset.env = k; b.onclick = () => { stopAuto(); PM.envTok++; envShow(k); ui(); }; chips.append(b); }
const envTxt = document.createElement('p'); envTxt.className = 'pmOut';
STEPS[1].extra.append(chips, envTxt);
const siteTxt = document.createElement('div'); siteTxt.className = 'pmOut'; STEPS[0].extra.append(siteTxt);
const areaTxt = document.createElement('p'); areaTxt.className = 'pmOut'; STEPS[2].extra.after(areaTxt);
// (v8.11) step 5: placement by hand only, with three kinds of node to choose from
const KINDS = [
  { k: 'main', zh: '主节点 · 环形广场', en: 'Main node · circus', dzh: '圆形。影响约 230 米，周围道路绕成环形广场并向外放射（强度 7 以上才形成广场）', den: 'Circle. Reaches about 230 m: the streets ring it as a circus and run out from it (a circus from strength 7)' },
  { k: 'sec', zh: '次节点 · 街区中心', en: 'Local node · neighbourhood centre', dzh: '正方形。影响约 140 米，附近道路弯向它，不形成广场', den: 'Square. Reaches about 140 m: nearby streets bend towards it, no circus' },
  { k: 'edge', zh: '边界节点 · 入口广场', en: 'Edge node · gateway', dzh: '三角形。吸附在场地边界上，形成半圆形入口广场，影响约 340 米（强度 7 以上）', den: 'Triangle. Snaps to the site\'s edge: a half-circle gateway plaza, reaching about 340 m (from strength 7)' } ];
PM.kind = 'main';
const kindBox = document.createElement('div'); kindBox.className = 'pmKinds'; kindBox.setAttribute('role', 'radiogroup');
for (const K of KINDS){ const b = document.createElement('button'); b.type = 'button'; b.dataset.kind = K.k; b.setAttribute('role', 'radio');
  b.innerHTML = '<i class="pmDot ' + K.k + '" aria-hidden="true"></i><span class="pmKT"></span><span class="pmKD"></span>';
  b.onclick = () => { PM.kind = K.k; bindPull(); ui(); }; kindBox.append(b); }
// (v8.12) the strength slider sets the chosen kind's pull (KPULL in the engine); each kind keeps its own
// (v8.13) in the process mode the slider reads 1–10; the engine's pull is the level × 0.3 (1 → 0.3, 10 → 3.0)
const PULL_STEP = 0.3, toLevel = pl => clamp(Math.round(pl / PULL_STEP), 1, 10);
function bindPull(){ if (!KPULL) return; const r = el('pull'); r.min = 1; r.max = 10; r.step = 1; r.value = toLevel(KPULL[PM.kind]); const o = r.nextElementSibling; if (o) o.textContent = r.value;
  const lab = r.closest('.row')?.querySelector('label'); if (lab){ const K = KINDS.find(x => x.k === PM.kind); lab.innerHTML = ''; const sp = document.createElement('span'); sp.setAttribute('data-no-translate', ''); sp.textContent = L('吸引强度 · ', 'Pull · ') + L(K.zh.split(' · ')[0], K.en.split(' · ')[0]); lab.append(sp); } }
el('pull').addEventListener('input', () => { if (!(PM.active && KPULL)) return; const r = el('pull'); KPULL[PM.kind] = +(+r.value * PULL_STEP).toFixed(2); const o = r.nextElementSibling; if (o) setTimeout(() => { o.textContent = r.value; }, 0); });
const kindCount = document.createElement('div'); kindCount.className = 'pmKCount';
const clearBtn = document.createElement('button'); clearBtn.type = 'button'; clearBtn.className = 'pmLink';
clearBtn.onclick = () => { stopAuto(); HAND = []; ATTR = []; AMODE = 'hand'; el('aMode').value = 'hand'; buildTarget(); onChange(5); };
const kindRow = document.createElement('div'); kindRow.className = 'pmKRow'; kindRow.append(kindCount, clearBtn);
STEPS[4].extra.append(kindBox, kindRow);
const metTbl = document.createElement('table'); metTbl.className = 'pmMet';
// (v8.27) step 8: the score of this run, by group, with the weights; and the runs compared
const GROUPS = [['blocks', '地块', 'Blocks', '大地块、碎地块、地块中位面积', 'big blocks, slivers, median block'], ['network', '路网', 'Network', '十字路口、密度、锐角路口、并行主路', 'crossroads, density, sharp junctions, mains side by side'],
  ['climate', '气候', 'Climate', '主路顺夏季风、主次路横挡冬季冷风', 'mains along the summer wind, streets across the winter cold'], ['terrain', '地形', 'Terrain', '陡坡道路、偏离张量场', 'streets on steep ground, off the field'],
  ['water', '水', 'Water', '中高洪水风险区里的道路', 'streets in medium or high flood risk']];
const VARY = [['d2', '次路间距', 'Second apart', 85, 150, 5], ['wC', '等高线', 'Contour', 40, 100, 5], ['wSum', '夏季通风', 'Summer air', 0, 80, 5], ['wWin', '冬季挡风', 'Winter shelter', 0, 80, 5], ['wDens', '疏密', 'Density', 0, 100, 10]];
PM.w = Object.assign({}, T6.SCORE_W0); try { const s = JSON.parse(localStorage.getItem('tensorStudio.scoreW') || 'null'); if (s) Object.assign(PM.w, s); } catch (e) {}
const scoreBox = document.createElement('div'); scoreBox.className = 'pmScore';
const cmpBox = document.createElement('div'); cmpBox.className = 'pmCmp';
STEPS[7].extra.append(scoreBox, cmpBox, metTbl);
const curSet = () => Object.fromEntries(VARY.map(([id]) => [id, +el(id).value]));
const totalOf = g => { let tw = 0, ts = 0; for (const [k] of GROUPS){ if (g[k] == null) continue; tw += PM.w[k]; ts += PM.w[k] * g[k]; } return tw ? ts / tw : 0; };
function curScore(){ const C = PM.cmp; if (C && C.preview != null && C.list[C.preview]){ const c = C.list[C.preview]; return { groups: c.groups, raw: c.raw, fail: c.fail }; }
  const m = METR || PM.lastM; if (!m) return null; if (PM.sc && PM.sc.m === m) return PM.sc.s; const s = T6.scoreRun(PM.w); PM.sc = { m, s }; return s; }
function scoreHTML(){ const s = curScore(); if (!s) return ''; const t = totalOf(s.groups);
  let h = '<div class="pmSHead"><span>' + L('综合评分', 'Score') + '</span><b>' + Math.round(t) + '</b><i>/ 100</i></div>';
  if (s.fail.length) h += '<p class="pmWarn">' + L('有 ' + s.fail[0].n + ' 条断头路（不计分，但需要处理）', s.fail[0].n + ' open end(s): not scored, but a fault') + '</p>';
  for (const [k, zh_, en_, dz, de] of GROUPS){ const v = s.groups[k];
    h += '<div class="pmSRow"><div class="pmSName"><b>' + L(zh_, en_) + '</b><span>' + L(dz, de) + '</span></div><div class="pmSBar"><i style="width:' + (v == null ? 0 : Math.round(v)) + '%"></i></div><span class="pmSVal">' + (v == null ? '—' : Math.round(v)) + '</span>' +
      '<label class="pmSW" title="' + L('权重', 'Weight') + '"><input type="range" min="0" max="50" step="5" value="' + PM.w[k] + '" data-g="' + k + '" aria-label="' + L(zh_ + '权重', en_ + ' weight') + '"><em>' + PM.w[k] + '</em></label></div>'; }
  return h + '<p class="pmHint">' + L('右边的滑块是各组权重：总分 = 各组分数按权重加权平均。没有数据的组（—）不计入。', 'The sliders on the right are the weights: the score is the groups averaged by weight. A group without data (—) is left out.') + '</p>'; }
scoreBox.addEventListener('input', e => { const k = e.target.dataset && e.target.dataset.g; if (!k) return; PM.w[k] = +e.target.value; e.target.nextElementSibling.textContent = e.target.value;
  try { localStorage.setItem('tensorStudio.scoreW', JSON.stringify(PM.w)); } catch (err) {} const s = curScore(); if (s) scoreBox.querySelector('.pmSHead b').textContent = Math.round(totalOf(s.groups)); renderCmp(); });
// the settings to try: the current ones first, then a spread over the ranges (a Latin hypercube, the same each time)
function samples(base, n){ let r = 12345; const rnd = () => (r = (r * 16807) % 2147483647) / 2147483647, out = [Object.assign({}, base)];
  if (n < 2) return out;
  const cols = VARY.map(() => { const a = Array.from({ length: n - 1 }, (_, i) => i); for (let i = a.length - 1; i > 0; i--){ const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; });
  for (let i = 0; i < n - 1; i++){ const s = {}; VARY.forEach(([id, , , lo, hi, st], c) => { const u = (cols[c][i] + rnd()) / (n - 1); s[id] = Math.round((lo + u * (hi - lo)) / st) * st; }); out.push(s); }
  return out; }
// (v8.28) the second round, coarse to fine: settings close to the two best of the first round (each value moved by up to 15 %
// of its range), none tried twice
const setKey = s => VARY.map(([id]) => s[id]).join(',');
function refine(m){ const C = PM.cmp, best = C.list.filter(c => !c.fail.length).sort((a, b) => totalOf(b.groups) - totalOf(a.groups)).slice(0, 2);
  if (!best.length) return samples(C.base, m + 1).slice(1);
  let r = 777; const rnd = () => (r = (r * 16807) % 2147483647) / 2147483647, seen = new Set(C.list.map(c => setKey(c.set))), out = [];
  for (let k = 0; out.length < m && k < m * 40; k++){ const par = best[k % best.length].set, s = {};
    VARY.forEach(([id, , , lo, hi, st]) => { s[id] = clamp(Math.round((par[id] + (rnd() * 2 - 1) * 0.15 * (hi - lo)) / st) * st, lo, hi); });
    const kk = setKey(s); if (seen.has(kk)) continue; seen.add(kk); out.push(s); }
  return out.length ? out : samples(C.base, m + 1).slice(1); }
// (v8.28) how many, and how much of each run is shown on the map
PM.cmpN = 10; PM.cmpShow = 'full';
try { const n = +localStorage.getItem('tensorStudio.cmpRuns'); if (n >= 4 && n <= 48) PM.cmpN = n; const m = localStorage.getItem('tensorStudio.cmpShow'); if (['full', 'roads', 'off'].includes(m)) PM.cmpShow = m; } catch (e) {}
const SHOWS = [['full', '完整过程', 'Whole process'], ['roads', '只看道路', 'Streets only'], ['off', '不展示', 'No display']];
const PER = { full: 8.8, roads: 5, off: 2.3 };   // seconds a run (station P2)
function estimate(){ const s = Math.round(PM.cmpN * PER[PM.cmpShow]), m = Math.floor(s / 60), r = s % 60; return L('约 ' + (m ? m + ' 分 ' : '') + r + ' 秒', 'about ' + (m ? m + ' min ' : '') + r + ' s'); }
// over the map: the stage of the run being shown, the score as it lands, and the runs so far in a strip
const stageEl = document.createElement('div'); stageEl.id = 'pmStage'; stageEl.hidden = true;
const popEl = document.createElement('div'); popEl.id = 'pmPop';
const stripEl = document.createElement('div'); stripEl.id = 'pmStrip'; stripEl.hidden = true;
document.body.append(stageEl, popEl, stripEl);
function overMap(){ const ins = window.__TS_INSETS ? window.__TS_INSETS() : { l: 0, r: 0 }; return { l: ins.l, w: innerWidth - ins.l - ins.r }; }
function placeOver(){ const m = overMap(); stageEl.style.left = (m.l + m.w / 2) + 'px'; popEl.style.left = (m.l + m.w / 2) + 'px';
  const bw = parseFloat(bar.style.width) || 600; stripEl.style.left = bar.style.left; stripEl.style.maxWidth = bw + 'px'; }
addEventListener('resize', placeOver);
function stage(txt){ stageEl.hidden = !txt; stageEl.innerHTML = txt || ''; placeOver(); }
async function popScore(c, best){ const t = Math.round(totalOf(c.groups)); popEl.innerHTML = '<b>' + t + '</b><span>' + (best ? L('新的最高分', 'Best so far') : L('第 ' + PM.cmp.list.length + ' 个方案', 'Run ' + PM.cmp.list.length)) + '</span>';
  popEl.classList.toggle('best', !!best); placeOver(); popEl.classList.add('show'); await sleep(900); popEl.classList.remove('show'); await sleep(200); }
function ranked(){ const C = PM.cmp; return C ? C.list.map((c, i) => ({ c, i, t: totalOf(c.groups) - (c.fail.length ? 100 : 0) })).sort((a, b) => b.t - a.t) : []; }
function strip(){ const C = PM.cmp; if (!PM.active || PM.cur !== 8 || !C || !C.list.length){ stripEl.hidden = true; return; }
  const top = ranked()[0];
  stripEl.innerHTML = C.list.map((c, i) => '<button type="button" class="pmTh' + (top && top.i === i ? ' best' : '') + (C.preview === i ? ' view' : '') + '" data-i="' + i + '" title="' + VARY.map(([id, z, e]) => L(z, e) + ' ' + c.set[id]).join(' · ') + '">' +
    '<img alt="" src="' + c.img + '"><span>' + Math.round(totalOf(c.groups)) + (c.cur ? L(' 当前', ' now') : c.round === 2 ? L(' 细', ' fine') : '') + '</span></button>').join('');
  stripEl.hidden = false; placeOver(); const last = stripEl.lastElementChild; if (C.running && last) last.scrollIntoView({ block: 'nearest', inline: 'end' }); }
stripEl.addEventListener('click', e => { const b = e.target.closest('.pmTh'); if (!b || !PM.cmp || PM.cmp.running) return; preview(+b.dataset.i); });
// a run of the comparison looked at on the map (its network as it was grown); the run of the settings comes back after
function preview(i){ const C = PM.cmp, c = C && C.list[i]; if (!c) return; if (c.cur || C.preview === i){ unpreview(); ui(); return; }
  T6.restoreSnap(c.snap); C.preview = i; PM.sc = null; layers(8); ui(); }
function unpreview(){ const C = PM.cmp; if (!C || C.preview == null) return; C.preview = null; if (C.sn0){ T6.setSnapB(C.sn0); T6.restoreSnap(C.sn0); } PM.sc = null; layers(PM.cur); }
// one run shown on the map: the climate (its two winds, as strong as their weights), the tensor field turning to its weights,
// then the streets growing; its score
async function showRun(set, i){ const C = PM.cmp, ok = () => !C.stop && PM.active, A = window.ENVANIM, head = L('方案 ' + (i + 1) + ' / ' + C.n, 'Run ' + (i + 1) + ' of ' + C.n) + (i >= C.n1 ? L(' · 细调', ' · fine') : '');
  for (const [id] of VARY){ el(id).value = set[id]; setOut(id); }
  T6.resetNet();
  if (PM.cmpShow === 'full'){
    if (A && ENV && !(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches)){
      for (const [k, w, z, e] of [['V', set.wSum, '夏季通风', 'Summer air'], ['Cw', set.wWin, '冬季冷风', 'Winter cold']]){
        stage('<b>' + head + '</b><span>' + L('气候 · ' + z + ' 权重 ' + w, 'Climate · ' + e + ' weight ' + w) + '</span>');
        A.gain = 0.12 + 0.88 * Math.min(1, w / 80); T6.setEnv(k); A.start(k); await sleep(1000); if (!ok()) return null; }
      A.stop(); A.gain = 1; T6.setEnv('off'); }
    stage('<b>' + head + '</b><span>' + L('张量场 · 等高线 ' + set.wC + ' · 夏风 ' + set.wSum + ' · 冬风 ' + set.wWin, 'Tensor field · contour ' + set.wC + ' · summer ' + set.wSum + ' · winter ' + set.wWin) + '</span>');
    setField('move'); buildTarget(); await sleep(1300); if (!ok()) return null; setField('off'); }
  else { buildTarget(); T6.settleField(); }
  stage('<b>' + head + '</b><span>' + L('道路生长 · 次路间距 ' + set.d2 + ' m · 疏密 ' + set.wDens + '%', 'Streets growing · second streets ' + set.d2 + ' m apart · density ' + set.wDens + ' %') + '</span>');
  MODE = 'B'; T6.setModeQuiet('B'); PM.target = 0; GEN = growBranching(); T6.resume();
  while (GEN){ await sleep(50); if (!ok()){ GEN = null; GROWING = false; return null; } }
  return T6.scoreRun(); }
function stopShow(){ const A = window.ENVANIM; if (A){ A.stop(); A.gain = 1; } T6.setEnv('off'); if (GEN){ GEN = null; GROWING = false; } stage(''); popEl.classList.remove('show'); }
async function compareRuns(){ if (PM.cmp && PM.cmp.running) return; stopAuto(); stopPlay(); unpreview();
  const base = curSet(), sn0 = T6.snapB(), N = PM.cmpN, n1 = Math.min(N, Math.max(3, Math.round(N * 2 / 3))), wasW = el('lWidth').checked;
  PM.cmp = { running: true, i: 0, n: N, n1, list: [], stop: false, base, sn0, preview: null };
  el('lWidth').checked = false; el('lEvents').checked = false; T6.syncTools(); renderCmp(); strip();
  let queue = samples(base, n1);
  for (let i = 0; i < N; i++){
    if (i === n1) queue = queue.concat(refine(N - n1));
    if (PM.cmp.stop || !PM.active || !queue[i]) break; const set = queue[i]; let s;
    if (PM.cmpShow === 'off'){ await sleep(30); if (PM.cmp.stop) break; s = T6.quietRun(set); }
    else { s = await showRun(set, i); if (!s) break; }
    const prevBest = ranked()[0], c = { set, groups: s.groups, raw: s.raw, fail: s.fail, cur: i === 0, round: i < n1 ? 1 : 2, img: T6.thumbOf(132).toDataURL(), snap: T6.snapB() };
    PM.cmp.list.push(c); PM.cmp.i = i + 1; renderCmp(); strip();
    if (PM.cmpShow !== 'off') await popScore(c, !c.fail.length && (!prevBest || totalOf(c.groups) > prevBest.t)); }
  // back to the run of the settings, as it was
  stopShow(); for (const [id] of VARY){ el(id).value = base[id]; setOut(id); } buildTarget(); T6.settleField();
  if (sn0){ T6.setSnapB(sn0); T6.restoreSnap(sn0); } PM.sc = null; PM.cmp.running = false; PM.cmp.stop = false;
  el('lWidth').checked = wasW; layers(PM.cur); if (PM.cur !== 8) go(PM.cur, true); renderCmp(); strip(); ui(); }
function setOut(id){ const e = el(id), o = e && e.nextElementSibling; if (o && o.tagName === 'OUTPUT') o.textContent = e.value + (['wC', 'wDens'].includes(id) ? ' %' : ''); }
async function applyRun(c){ stopAuto(); stopPlay(); unpreview(); for (const [id] of VARY){ el(id).value = c.set[id]; setOut(id); } PM.cmp.applied = c;
  onChange(4); const tok = ++PM.tok, ok = () => tok === PM.tok; PM.auto = true; ui();
  go(6, true); await stepGrowth(6); if (!ok()) return; go(7, true); await stepGrowth(7); if (!ok()) return; await sleep(400); if (!ok()) return; go(8, true); PM.auto = false; PM.sc = null; ui(); }
function estText(){ return L(PM.cmpN + ' 个方案，', PM.cmpN + ' runs, ') + estimate() + (PM.cmpShow === 'full' ? L('。主视图依次展示每个方案的气候、张量场和道路生长。', '. The map shows each run\'s climate, tensor field and streets growing.') : PM.cmpShow === 'roads' ? L('。主视图只展示道路生长。', '. The map shows the streets growing.') : L('。在后台计算，不展示过程。', '. Worked out without showing it.')); }
function renderCmp(){ if (!PM.active) return; const C = PM.cmp, running = !!(C && C.running);
  let h = '<div class="pmCHead"><b>' + L('方案比较', 'Compare runs') + '</b>' + (running ? '<button type="button" class="pmLink" data-act="stop">' + L('停止', 'Stop') + '</button>' : '') + '</div>';
  if (!running){
    h += '<p class="pmHint">' + L('你放的节点和主路间距不变，自动改变次路间距、等高线、夏季通风、冬季挡风和疏密。先在整个范围里均匀试 2/3 的方案，再在前两名附近细调剩下的 1/3，按总分排序。', 'Your nodes and the main-street spacing stay; the second-street spacing, contour, summer air, winter shelter and density vary. Two thirds of the runs spread over the whole range, the last third close to the best two; ranked by the score.') + '</p>';
    h += '<div class="pmCCtl"><label>' + L('方案数', 'Runs') + '</label><input type="range" min="4" max="48" step="2" value="' + PM.cmpN + '" data-ctl="n" aria-label="' + L('方案数', 'Runs') + '"><output>' + PM.cmpN + '</output></div>';
    h += '<div class="pmCCtl"><label>' + L('展示', 'Show') + '</label><div class="pmSeg">' + SHOWS.map(([k, z, e]) => '<button type="button" data-show="' + k + '" class="' + (PM.cmpShow === k ? 'on' : '') + '">' + L(z, e) + '</button>').join('') + '</div></div>';
    h += '<p class="pmHint pmEst">' + estText() + '</p>'; }
  if (!C || (!running && !C.list.length)) h += '<div class="pmActs"><button type="button" class="primary" data-act="run">' + L('开始比较', 'Start') + '</button></div>';
  else {
    if (running) h += '<div class="pmProg"><i style="width:' + Math.round(100 * C.i / C.n) + '%"></i></div><p class="pmHint">' + L('已完成 ' + C.i + ' / ' + C.n + ' 个方案' + (C.i >= C.n1 ? '（细调阶段）' : ''), C.i + ' of ' + C.n + ' runs done' + (C.i >= C.n1 ? ' (fine-tuning)' : '')) + '</p>';
    const rows = ranked(), cur = rows.find(r => r.c.cur), top = rows.slice(0, 3); if (cur && !top.includes(cur)) top.push(cur);
    if (C.preview != null && !running) h += '<p class="pmHint pmPrev">' + L('地图上正在预览第 ' + (C.preview + 1) + ' 个方案；再点一次底部缩略图回到当前方案。', 'Previewing run ' + (C.preview + 1) + ' on the map; click its thumbnail again to go back.') + '</p>';
    h += '<div class="pmCList">' + top.map(r => { const c = r.c, t = totalOf(c.groups), d = cur && !c.cur ? t - totalOf(cur.c.groups) : null;
      return '<div class="pmCCard' + (c.cur ? ' cur' : '') + (C.preview === r.i ? ' view' : '') + '"><img alt="" src="' + c.img + '" data-pv="' + r.i + '"><div class="pmCInfo"><div class="pmCT"><b>' + Math.round(t) + '</b><span>' + (c.cur ? L('当前方案', 'This run') : L('第 ' + (rows.indexOf(r) + 1) + ' 名', 'No. ' + (rows.indexOf(r) + 1))) + (d != null ? ' · ' + (d >= 0 ? '+' : '') + d.toFixed(1) : '') + (c.round === 2 ? L(' · 细调', ' · fine') : '') + '</span></div>' +
        '<div class="pmCG">' + GROUPS.map(([k, z, e]) => '<span>' + L(z, e) + ' ' + (c.groups[k] == null ? '—' : Math.round(c.groups[k])) + '</span>').join('') + '</div>' +
        '<div class="pmCS">' + VARY.map(([id, z, e]) => L(z, e) + ' ' + c.set[id]).join(' · ') + '</div>' + (c.fail.length ? '<div class="pmWarn">' + L('有断头路', 'open ends') + '</div>' : '') +
        (!c.cur && !running ? '<button type="button" class="pmLink" data-act="use" data-i="' + r.i + '">' + L('用这个方案', 'Use this run') + '</button>' : '') + '</div></div>'; }).join('') + '</div>';
    if (!running) h += '<div class="pmActs"><button type="button" data-act="run">' + L('重新比较', 'Compare again') + '</button></div>'; }
  cmpBox.innerHTML = h; }
cmpBox.addEventListener('input', e => { if (e.target.dataset.ctl !== 'n') return; PM.cmpN = +e.target.value; e.target.nextElementSibling.textContent = PM.cmpN; try { localStorage.setItem('tensorStudio.cmpRuns', PM.cmpN); } catch (err) {}
  const est = cmpBox.querySelector('.pmEst'); if (est) est.textContent = estText(); });
cmpBox.addEventListener('click', e => { const sh = e.target.closest('[data-show]'); if (sh){ PM.cmpShow = sh.dataset.show; try { localStorage.setItem('tensorStudio.cmpShow', PM.cmpShow); } catch (err) {} renderCmp(); return; }
  const pv = e.target.closest('[data-pv]'); if (pv && PM.cmp && !PM.cmp.running){ preview(+pv.dataset.pv); return; }
  const b = e.target.closest('[data-act]'); if (!b) return; const a = b.dataset.act;
  if (a === 'run') compareRuns(); else if (a === 'stop' && PM.cmp) PM.cmp.stop = true; else if (a === 'use' && PM.cmp) applyRun(PM.cmp.list[+b.dataset.i]); });

// the timeline, at the bottom between the two panels
const bar = document.createElement('div'); bar.id = 'pmBar';
bar.innerHTML = '<button type="button" id="pmPlay" aria-label="play"></button><div class="pmMid"><div class="pmCap"><b id="pmStepT"></b><span id="pmPhase"></span></div>' +
  '<div class="pmTrack" id="pmTrack"><input type="range" id="pmRange" min="0" max="0" value="0" aria-label="timeline"><div id="pmTicks"></div></div><div class="pmDots" id="pmDots"></div></div>' +
  '<div class="pmSpeed" role="group"><button type="button" data-sp="slow"></button><button type="button" data-sp="mid"></button><button type="button" data-sp="fast"></button></div><span id="pmCount"></span>';
document.body.append(bar);
for (let k = 1; k <= 8; k++){ const d = document.createElement('button'); d.type = 'button'; d.dataset.k = k; d.onclick = () => { if (k <= PM.valid + 1){ stopAuto(); go(k); } }; el('pmDots').append(d); }
for (const b of bar.querySelectorAll('[data-sp]')) b.onclick = () => { PM.speed = b.dataset.sp; try { localStorage.setItem('tensorStudio.flowSpeed', PM.speed); } catch (e) {} applySpeed(); ui(); };
const PLAY = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 5l12 7-12 7z" fill="currentColor"/></svg>', PAUSE = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 5h3.5v14H7zM13.5 5H17v14h-3.5z" fill="currentColor"/></svg>';
el('pmPlay').onclick = togglePlay;
el('pmRange').addEventListener('input', e => { stopAuto(); stopPlay(); if (GEN && GROWING){ GROWING = false; PM.livePaused = true; } const i = +e.target.value; showFrame(i); ui(); });
// clear of the wind rose (bottom left of the map) and the scale bar (bottom right) where there is room
function placeBar(){ const ins = window.__TS_INSETS ? window.__TS_INSETS() : { l: 0, r: 0 }, room = innerWidth - ins.l - ins.r, side = room > 900 ? 150 : 12, W = room - 2 * side;
  const w = Math.max(260, Math.min(720, W)); bar.style.width = w + 'px'; bar.style.left = (ins.l + side + Math.max(0, (W - w) / 2)) + 'px'; }
addEventListener('resize', () => { placeBar(); placeOver(); }); new ResizeObserver(() => { placeBar(); placeOver(); }).observe(panel); new ResizeObserver(() => { placeBar(); placeOver(); }).observe(el('displayPanel'));
// parts of the display panel that belong to the free mode
const freeOnly = [el('tgMode')?.closest('.dpSection'), el('tResult')].filter(Boolean);

/* ------------------------------------------------------------------ the engine's hooks */
T6.setProc({
  stopAt: p => PM.active && PM.target === 6 && p === SECOND,
  steps: () => PM.active ? (PM.cmp && PM.cmp.running ? 40 : SPEED[PM.speed].steps) : 0,
  record(done){ if (!PM.active || !PM.target) return; PM.frames.push(recordFrame()); PM.runEV = EVENTS; PM.runCul = CULVERTS; mark(PM.frames.length - 1, PHASE); barLive(); },
  onStop(p){ if (!PM.active || p !== SECOND) return; PM.b6 = PM.frames.length - 1; PM.frames[PM.b6].phase = 'main streets done'; PM.atB = true; PM.target = 0; PM.valid = 6; PM.reached = Math.max(PM.reached, 6); ui(); settle(); },
  onDone(){ if (!PM.active || !PM.target) return; if (PM.b6 < 0) PM.b6 = PM.frames.length - 1; PM.atB = false; PM.target = 0; PM.valid = 7; PM.reached = Math.max(PM.reached, 7);
    PM.prevM = PM.lastM; PM.lastM = METR; ui(); settle(); } });
function settle(){ const w = PM.waiter; PM.waiter = null; if (w) w(); }
function mark(i, p){ if (!PM.marks.some(m => m.p === p)) PM.marks.push({ i, p }); }
function applySpeed(){}

/* ------------------------------------------------------------------ the world at each step */
function withoutFlood(fn){ const f = el('fOn'), c = f.checked; f.checked = false; try { return fn(); } finally { f.checked = c; } }
function attractorsFor(k){
  if (k <= 4){ if (ATTR.length) PM.saved = ATTR; ATTR = []; }
  else { if (AMODE === 'hand' && !HAND && PM.saved) HAND = PM.saved;
    // (v8.11) the process mode places by hand only: the first time, the points the field suggests become yours to move
    if (AMODE !== 'hand'){ placeAttractors(); AMODE = 'hand'; el('aMode').value = 'hand'; HAND = ATTR; }
    placeAttractors(); PM.nAttr = ATTR.length; } }
function restoreFinal(){ const sn = SNAP.B; if (!sn || sn.key !== settingsKey()) return false; if (!FINISHED) restore(sn); return true; }
function world(k){
  stopPlay(); PM.livePaused = false; setScrub(null);
  if (GEN && !(PM.atB && (k === 6 || k === 7))){ GEN = null; GROWING = false; PM.atB = false; PM.target = 0; }
  attractorsFor(k); buildTarget();
  if (k <= 5){
    if (k <= 2) withoutFlood(resetNet);
    else if (k === 3){ const base = withoutFlood(() => { buildMask(); return T6.landHa(); }); resetNet(); PM.area = { base, use: T6.landHa() }; }
    else resetNet();
    PM.valid = Math.max(PM.valid, k); }
  else if (k === 6){ if (!(GEN && PM.atB)){ if (PM.valid >= 6 && PM.b6 >= 0){ if (!restoreFinal()) resetNet(); showFrame(PM.b6); } else resetNet(); } }
  else if (k === 7){ if (PM.valid >= 7) restoreFinal(); else if (!(GEN && PM.atB) && PM.valid >= 6 && PM.b6 >= 0){ resetNet(); showFrame(PM.b6); } }
  else if (k === 8){ if (!restoreFinal() && PM.frames.length) showFrame(PM.frames.length - 1); measures(); METR = METR || PM.lastM; }
  layers(k); }
function layers(k){
  el('lWidth').checked = k === 8; el('lStreets').checked = true; el('lEvents').checked = k === 6 || k === 7; el('lWind').checked = false;
  setField(k === 4 || k === 5 ? 'move' : 'off'); setUnder('off'); T6.setFlood(k === 3 && !!FR); T6.setGreen(k >= 3); if (k !== 2){ T6.setEnv('off'); window.ENVANIM && ENVANIM.stop(); }
  FROZEN = false; baseDirty = netDirty = widthDirty = true; syncTools(); }
function go(k, auto){
  if (k < 1 || k > 8) return; PM.envTok++;
  if (PM.cmp && PM.cmp.running && k !== 8) PM.cmp.stop = true;   // (v8.28) leaving step 8 stops a comparison
  if (PM.cmp && PM.cmp.preview != null && k !== 8) unpreview();
  PM.cur = k; PM.reached = Math.max(PM.reached, k); world(k);
  if (k === 2 && !auto) envTour(++PM.envTok);
  ui(); const li = STEPS[k - 1].li; requestAnimationFrame(() => li.scrollIntoView({ block: 'nearest', behavior: 'smooth' })); }
// a setting in step k changed: the steps after it are no longer current
function onChange(k, id){
  if (!PM.active) return; stopAuto();
  // (v8.14) without 'main streets first' the fork threshold forks the main streets too: a change to it re-runs step 6
  if (k === 7 && id === 'bFork' && !el('bMains').checked) k = 6;
  if (k <= 6){ PM.frames = []; PM.marks = []; PM.b6 = -1; }
  else if (k === 7 && PM.b6 >= 0){ PM.frames.length = PM.b6 + 1; PM.marks = PM.marks.filter(m => m.i <= PM.b6); }
  if (GEN){ GEN = null; GROWING = false; } PM.atB = false; PM.target = 0;
  PM.valid = Math.min(PM.valid, k - (k >= 6 ? 1 : 0));
  if (k === 7) PM.valid = Math.min(PM.valid, 6);
  if (PM.cur > PM.valid + 1) PM.cur = PM.valid + 1;
  go(PM.cur, true); }

/* ------------------------------------------------------------------ the growth, recorded */
function grow(target){
  stopPlay(); PM.livePaused = false; setScrub(null); MODE = 'B'; T6.setModeQuiet('B');
  if (target === 6){ PM.frames = []; PM.marks = []; PM.b6 = -1; PM.atB = false; PM.valid = Math.min(PM.valid, 5); PM.target = 6; GEN = growBranching(); T6.setProc(PROC); }
  else {
    PM.target = 7; PM.valid = Math.min(PM.valid, 6);
    if (!(GEN && PM.atB)){   // the main streets again, at once (the same as recorded): the generator cannot be copied
      PM.frames.length = Math.max(0, PM.b6 + 1); PM.marks = PM.marks.filter(m => m.i <= PM.b6);
      const t = PM.target; PM.target = 0; GEN = growBranching(); T6.setProc(PROC); runUntil(p => p === SECOND); PM.target = t; PM.runEV = EVENTS; PM.runCul = CULVERTS; }
    PM.atB = false; }
  applySpeed(); T6.resume(); ui(); }
function showFrame(i){ const f = PM.frames[i]; if (!f) return; PM.scrub = i; EVENTS = PM.runEV; CULVERTS = PM.runCul; setScrub(f); barLive(); }
function timelineEnd(){ const F = PM.frames.length - 1; return PM.cur === 6 && PM.b6 >= 0 ? Math.min(PM.b6, F) : F; }
function replay(from, to, done){ stopPlay(); if (to < from || !PM.frames.length) { done && done(); return; }
  PM.playing = { pos: from, to, done };
  const tick = () => { const p = PM.playing; if (!p) return; p.pos = Math.min(p.to, p.pos + SPEED[PM.speed].rate); showFrame(Math.floor(p.pos));
    if (p.pos >= p.to){ PM.playing = null; afterReplay(); ui(); if (p.done) p.done(); return; } p.raf = requestAnimationFrame(tick); };
  ui(); tick(); }
function stopPlay(){ if (PM.playing){ cancelAnimationFrame(PM.playing.raf); PM.playing = null; } }
function afterReplay(){
  if (PM.livePaused && GEN){ PM.livePaused = false; setScrub(null); PM.scrub = -1; T6.resume(); return; }
  if (PM.cur >= 7 && PM.valid >= 7 && restoreFinal()){ setScrub(null); PM.scrub = -1; }
  else if (GEN && PM.atB){ setScrub(null); PM.scrub = -1; } }
function togglePlay(){ stopAuto();
  if (PM.playing){ stopPlay(); ui(); return; }
  if (GEN && GROWING){ GROWING = false; PM.livePaused = true; ui(); return; }
  if (!PM.frames.length) return;
  const end = timelineEnd(); let from = PM.scrub >= 0 && PM.scrub < end ? PM.scrub : 0;
  if (PM.cur === 7 && from === 0 && PM.b6 >= 0 && PM.scrub < 0) from = PM.b6;
  if (PM.livePaused && from >= end && GEN){ afterReplay(); ui(); return; }
  replay(from, end); }

/* ------------------------------------------------------------------ playing the whole process */
const sleep = ms => new Promise(r => setTimeout(r, ms));
// (v8.9) each map plays its animation (scripts/env_anim.js), looping; the tour shows each for one loop, the last keeps looping
function envShow(k){ T6.setEnv(k); const A = window.ENVANIM; if (A){ if (PM.active && PM.cur === 2 && k !== 'off') A.start(k); else A.stop(); } }
async function envTour(tok){ if (!ENV) return; const A = window.ENVANIM, anim = A && !(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
  for (const [k] of ENVK){ if (tok !== PM.envTok) return; envShow(k); ui(); await sleep(anim ? A.period(k) * 1000 - 80 : (PM.auto ? 1700 : 2200)); } }
function stepGrowth(target){ return new Promise(res => {
  if (target === 6 && PM.valid >= 6 && PM.b6 >= 0){ replay(0, PM.b6, res); return; }
  if (target === 7 && PM.valid >= 7){ setScrub(null); replay(Math.max(0, PM.b6), PM.frames.length - 1, res); return; }
  PM.waiter = res; grow(target); }); }
async function playAll(){ const tok = ++PM.tok, ok = () => tok === PM.tok; PM.auto = true; ui();
  go(1, true); await sleep(1800); if (!ok()) return;
  go(2, true); await envTour(++PM.envTok); if (!ok()) return; await sleep(400); if (!ok()) return;
  go(3, true); await sleep(2200); if (!ok()) return;
  go(4, true); await sleep(2800); if (!ok()) return;
  go(5, true); await sleep(2600); if (!ok()) return;
  go(6, true); await stepGrowth(6); if (!ok()) return; await sleep(800); if (!ok()) return;
  go(7, true); await stepGrowth(7); if (!ok()) return; await sleep(800); if (!ok()) return;
  go(8, true); PM.auto = false; ui(); }
function stopAuto(){ if (PM.auto){ PM.tok++; PM.auto = false; PM.waiter = null; } PM.envTok++; }
el('pmAll').onclick = () => { if (PM.auto){ stopAuto(); stopPlay(); if (GEN && GROWING){ GROWING = false; PM.livePaused = true; } ui(); } else playAll(); };

/* ------------------------------------------------------------------ the text of the panel and the bar */
function summary(k){ const st = T6.envStats, fmt = x => x.toFixed(1);
  if (k === 1) return L(fmt(landArea() / 1e4) + ' 公顷 · ' + D.anchors.length + ' 个锚点', fmt(landArea() / 1e4) + ' ha · ' + D.anchors.length + ' anchors');
  if (k === 2){ if (!st) return L('无环境数据', 'no environmental data'); const s = argmax(st.summerEnergy), w = argmax(st.winterColdEnergy);
    return L('高程 ' + st.zMin + '–' + st.zMax + ' m · 夏季' + dirName(s) + '风 · 冬季冷风来自' + dirName(w), st.zMin + '–' + st.zMax + ' m · summer air from ' + dirName(s) + ' · winter cold from ' + dirName(w)); }
  if (k === 3){ const g = T6.corr, gs = g ? L(' · 走廊 ' + fmt(g.areaHa) + ' 公顷', ' · corridors ' + fmt(g.areaHa) + ' ha') : '';
    if (!floodOn()) return L('不考虑洪水', 'flood risk off') + gs; if (!PM.area) return ''; const a = PM.area;
    return L('避让 ' + fmt(a.base - a.use) + ' 公顷 · 可用 ' + fmt(a.use) + ' 公顷', fmt(a.base - a.use) + ' ha kept clear · ' + fmt(a.use) + ' ha left') + gs; }
  if (k === 4) return L('等高线 ' + v('wC') + ' · 夏风 ' + v('wSum') + ' · 冬风 ' + v('wWin') + ' · 走廊 ' + (T6.corrOn ? v('wG') : '关') + ' · 顺流 ' + (floodOn() ? v('fW') : '关'), 'contour ' + v('wC') + ' · summer ' + v('wSum') + ' · winter ' + v('wWin') + ' · corridors ' + (T6.corrOn ? v('wG') : 'off') + ' · flow ' + (floodOn() ? v('fW') : 'off'));
  if (k === 5){ const c = kindCounts(); return L('主 ' + c.main + ' · 次 ' + c.sec + ' · 边界 ' + c.edge, c.main + ' main · ' + c.sec + ' local · ' + c.edge + ' edge'); }
  if (k === 6){ const f = PM.frames[PM.b6]; if (!f) return ''; let n = 0; f.o.forEach((l, i) => { if (l.level === 1 && !l.circus && f.n[i] > 1) n++; });
    return L(n + ' 条主路 · 间距 ' + v('d1') + ' m', n + ' main streets · ' + v('d1') + ' m apart'); }
  if (k === 7){ const m = PM.lastM; if (!m) return ''; return L((m.km1 + m.km2).toFixed(1) + ' km 道路 · ' + m.cells + ' 个地块', (m.km1 + m.km2).toFixed(1) + ' km of street · ' + m.cells + ' cells'); }
  return ''; }
function kindCounts(){ const src = ATTR.length ? ATTR : (HAND || []), c = { main: 0, sec: 0, edge: 0 }; for (const a of src) c[a.kind] = (c[a.kind] || 0) + 1; return c; }
function argmax(a){ let b = 0; a.forEach((x, i) => { if (x > a[b]) b = i; }); return b; }
function envConclusion(){ const st = T6.envStats, k = T6.env; if (!st) return L('此场地没有环境分析数据，可以直接进入下一步。', 'No environmental fields for this site: go on to the next step.');
  const pct = (a, i) => Math.round(100 * a[i] / (a.reduce((s, x) => s + x, 0) || 1));
  if (k === 'Z') return L('场地高程 ' + st.zMin + '–' + st.zMax + ' 米，高差 ' + (st.zMax - st.zMin).toFixed(1) + ' 米。道路将优先顺着等高线走。', 'The land runs from ' + st.zMin + ' to ' + st.zMax + ' m. Streets will follow the contours first.');
  if (k === 'Q') return L('亮蓝线是雨水汇集的路径。下一步把主要路径留成蓝绿走廊，道路只能跨过它们。', 'The bright lines are where rain gathers. The next step keeps the main paths as blue-green corridors, which streets only cross.');
  if (k === 'V'){ const i = argmax(st.summerEnergy); return L('夏季通风以' + dirName(i) + '风为主，占夏季风能的 ' + pct(st.summerEnergy, i) + '%。深色处风最强，第 4 步在那里让道路顺着风走。', 'Summer air comes mostly from the ' + dirName(i) + ', ' + pct(st.summerEnergy, i) + ' % of its energy. Step 4 runs the streets along it where it is strongest (dark).'); }
  if (k === 'Cw'){ const i = argmax(st.winterColdEnergy); return L('冬季冷风主要来自' + dirName(i) + '，占 ' + pct(st.winterColdEnergy, i) + '%。深色处最冷，第 4 步在那里让道路横切冷风。', 'The winter cold comes mostly from the ' + dirName(i) + ', ' + pct(st.winterColdEnergy, i) + ' %. Step 4 runs the streets across it where it bites (dark).'); }
  if (k === 'C') return L('暖色处避开冬季冷风、又有夏季通风，适合布置公共空间。圆圈标出最舒适的三处，作为广场候选（只作参考：广场位置由你在第 5 步放节点决定；舒适度另外用于第 7 步的次路疏密）。', 'Warm ground is out of the winter cold and open to summer air: good for public space. The rings mark the three best places, as plaza candidates (for reference: the plazas are where you put the nodes in step 5; comfort also sets the second streets\' density in step 7).');
  return L('点击上面的图层，或播放分析。', 'Pick a map above, or play the analysis.'); }
function siteText(){ const s = D.site, st = T6.envStats, list = [];
  list.push(L('地形：', 'Terrain: ') + (s ? 'OS Terrain 50' : (st && st.elevationFrom === 'contours' ? L('OS 1 米等高线', 'OS 1 m contours') : 'OS')));
  list.push(L('洪水：', 'Flood: ') + (FR ? L('EA 地表水与河流海洋风险', 'EA surface water, rivers and sea') : L('不在 EA 数据范围内', 'outside the EA data')));
  list.push(L('风：London Luton 典型气象年（逐时）', 'Wind: London Luton typical year, hourly'));
  const fsrc = window.__TS && window.__TS.meta && window.__TS.meta.source;      // (v8.49) a site file from Loop City step 3
  if (fsrc){ list[0] = L('地形：', 'Terrain: ') + (s.elevation ? 'OS Terrain 50' : L('没有数据，按平地', 'no data, flat ground'));
    list.push(L('道路：毛线带的道路等级（含现有道路）', 'Roads: the wool bands\u2019 hierarchy, existing roads among them'));
    const pk = (D.ctx.parks || []).length; if (pk) list.push(L('公园 ' + pk + ' 个：保持为公园，不长路', (pk > 1 ? pk + ' parks: kept as parks' : '1 park: kept as a park') + ', no street enters'));
    const ks = Object.values(fsrc.cell_keys || {}); list.push(L('单元身份：', 'Cell key: ') + (ks.join(L('；', '; ')) || L('旧用地文件，没有记录', 'an older site file, none recorded'))); }
  else if (s) list.push(L('道路、水体、铁路、建筑：OpenStreetMap', 'Streets, water, rail, buildings: OpenStreetMap'));
  return '<b>' + summary(1) + '</b><ul>' + list.map(x => '<li>' + x + '</li>').join('') + '</ul>'; }
function metHTML(){ const m = METR || PM.lastM, p = PM.prevM; if (!m) return '';
  const rows = [['km1', '主路', 'Main streets', ' km', 1], ['km2', '次路', 'Second streets', ' km', 1], ['dens', '路网密度', 'Density', ' km/km²', 1], ['road', '道路用地', 'Land in streets', ' %', 0],
    ['T', 'T 路口', 'T junctions', ' %', 0], ['Y', 'Y 路口', 'Y junctions', ' %', 0], ['X', '十字路口', 'Crossings', ' %', 0], ['loose', '断头路', 'Dead ends', '', 0], ['cells', '地块', 'Cells', '', 0], ['med', '地块中位面积', 'Median cell', ' ha', 2], ['parks', '保留绿地', 'Kept as parks', ' ha', 1]];
  const f = (x, d) => x == null || isNaN(x) ? '—' : (+x).toFixed(d);
  return '<tr><th></th><th>' + L('本次', 'This run') + '</th><th>' + L('上次', 'Previous') + '</th></tr>' +
    rows.map(r => '<tr><td>' + L(r[1], r[2]) + '</td><td>' + f(m[r[0]], r[4]) + r[3] + '</td><td>' + (p ? f(p[r[0]], r[4]) + r[3] : '—') + '</td></tr>').join(''); }
function stepCap(){ const s = STEPS[PM.cur - 1]; return s ? L('第 ' + s.k + ' 步 · ' + s.zh, 'Step ' + s.k + ' · ' + s.en) : ''; }
function barLive(){ if (!PM.active) return; const r = el('pmRange'), F = PM.frames.length, growing = !!(GEN && GROWING && !false);
  const showT = PM.cur >= 6 && F > 0; el('pmTrack').hidden = !showT; el('pmDots').hidden = showT;
  if (showT){ const end = timelineEnd(); r.max = Math.max(0, end); const i = GEN && GROWING ? F - 1 : (PM.scrub >= 0 && SCRUB ? PM.scrub : end); r.value = Math.min(i, end);
    const f = PM.frames[Math.min(i, F - 1)]; el('pmPhase').textContent = f ? ph(f.phase) : ''; el('pmCount').textContent = f ? L(f.streets + ' 条道路', f.streets + ' streets') : ''; }
  else { el('pmPhase').textContent = PM.cur === 6 || PM.cur === 7 ? L('设好参数后点“生长”', 'Set the values, then grow') : (STEPS[PM.cur - 1] ? stepHint(PM.cur) : ''); el('pmCount').textContent = PM.cur + ' / 8'; } }
function stepHint(k){ return k === 2 ? (T6.env !== 'off' ? L({ Z: '高程', Q: '汇水', V: '夏季通风', Cw: '冬季冷风', C: '气候舒适' }[T6.env], { Z: 'Elevation', Q: 'Runoff', V: 'Summer air', Cw: 'Winter cold', C: 'Comfort' }[T6.env]) : '') :
  { 1: L('场地与数据', 'The site and its data'), 3: L('从土地中扣除水体与洪水区', 'Water and flood zones out of the land'), 4: L('流线：道路将遵循的方向', 'The flow: where streets will run'), 5: L('吸引点弯曲了流线', 'The attractors bend the flow'), 8: L('结果与指标', 'The result, measured') }[k] || ''; }
function ui(){ if (!PM.active) return;
  modeSw.querySelector('[data-pm="1"]').textContent = L('流程模式', 'Process'); modeSw.querySelector('[data-pm="0"]').textContent = L('自由模式', 'Free');
  el('pmTitle').textContent = L('生成流程', 'How it is made'); el('pmAll').textContent = PM.auto ? L('停止播放', 'Stop') : L('播放全流程', 'Play it all');
  const growing = !!(GEN && GROWING);
  for (const s of STEPS){ const li = s.li, done = s.k < PM.cur && s.k <= PM.valid, stale = s.k > PM.valid && s.k <= PM.reached && s.k !== PM.cur;
    li.className = 'pmStep ' + (s.k === PM.cur ? 'cur' : done ? 'done' : s.k <= PM.valid + 1 ? 'open' : 'todo');
    li.querySelector('.pmNum').innerHTML = done ? '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>' : s.k;
    li.querySelector('.pmName').textContent = L(s.zh, s.en);
    li.querySelector('.pmFlag').textContent = stale ? L('需重算', 'to re-run') : (s.k === PM.cur && growing ? L('生长中', 'growing') : '');
    li.querySelector('.pmSum').textContent = done || stale ? summary(s.k) : '';
    li.querySelector('.pmNote').textContent = s.note();
    if (s.run){ s.run.textContent = s.run._t(); s.run.disabled = (s.k === 7 && PM.valid < 6) || (growing && PM.target === s.k); }
    if (s.next){ s.next.textContent = s.next._t(); s.next.disabled = s.k < 8 && s.k > PM.valid; } }
  for (const b of chips.children){ const e = ENVK.find(x => x[0] === b.dataset.env); b.textContent = L(e[1], e[2]); b.classList.toggle('on', T6.env === b.dataset.env); b.disabled = !ENV; }
  for (const b of kindBox.children){ const K = KINDS.find(x => x.k === b.dataset.kind), on = PM.kind === K.k; b.classList.toggle('on', on); b.setAttribute('aria-checked', on);
    b.querySelector('.pmKT').textContent = L(K.zh, K.en); b.querySelector('.pmKD').textContent = L(K.dzh, K.den); }
  { const c = kindCounts(); kindCount.textContent = L('已放置：主节点 ' + c.main + ' · 次节点 ' + c.sec + ' · 边界节点 ' + c.edge, 'Placed: ' + c.main + ' main · ' + c.sec + ' local · ' + c.edge + ' edge'); clearBtn.textContent = L('全部清除', 'Clear all'); clearBtn.disabled = !(c.main + c.sec + c.edge); }
  if (PM.cur === 5) bindPull();
  envTxt.textContent = envConclusion(); siteTxt.innerHTML = siteText();
  const g = T6.corr, gTxt = g ? L(' 蓝绿走廊 ' + g.areaHa.toFixed(1) + ' 公顷（占土地 ' + Math.round(100 * g.share) + '%），道路只能跨过。' + (g.raised ? '汇水线太多，门槛已自动提高到上游 ' + Math.round(g.minHa) + ' 公顷，使走廊不超过土地的 12%。' : ''), ' Blue-green corridors ' + g.areaHa.toFixed(1) + ' ha (' + Math.round(100 * g.share) + ' % of the land), which streets only cross.' + (g.raised ? ' Too many runoff paths: the threshold rose to ' + Math.round(g.minHa) + ' ha upstream, so the corridors keep under 12 % of the land.' : '')) : '';
  areaTxt.textContent = (PM.area && floodOn() ? L('场地土地 ' + PM.area.base.toFixed(1) + ' 公顷，洪水避让 ' + (PM.area.base - PM.area.use).toFixed(1) + ' 公顷，可生长道路的土地 ' + PM.area.use.toFixed(1) + ' 公顷。',
    'Land ' + PM.area.base.toFixed(1) + ' ha; kept clear of flooding ' + (PM.area.base - PM.area.use).toFixed(1) + ' ha; ' + PM.area.use.toFixed(1) + ' ha left for streets.') : (FR ? L('洪水风险未参与。', 'Flood risk is off.') : L('此场地不在 EA 洪水数据范围内。', 'No EA flood data for this site.'))) + gTxt;
  metTbl.innerHTML = PM.cur === 8 ? metHTML() : '';
  if (PM.cur === 8){ scoreBox.innerHTML = scoreHTML(); renderCmp(); } else { scoreBox.innerHTML = ''; cmpBox.innerHTML = ''; }
  strip();
  if (PM.cur === 8) floodNum();
  el('pmStepT').textContent = stepCap();
  el('pmPlay').innerHTML = PM.playing || growing ? PAUSE : PLAY; el('pmPlay').disabled = !(PM.frames.length || growing) || PM.cur < 6;
  for (const b of bar.querySelectorAll('[data-sp]')){ b.textContent = { slow: L('慢', 'Slow'), mid: L('中', 'Mid'), fast: L('快', 'Fast') }[b.dataset.sp]; b.classList.toggle('on', b.dataset.sp === PM.speed); }
  for (const d of el('pmDots').children){ const k = +d.dataset.k; d.className = k === PM.cur ? 'cur' : k <= PM.valid ? 'done' : ''; d.disabled = k > PM.valid + 1; d.title = L(STEPS[k - 1].zh, STEPS[k - 1].en); }
  // the ticks of the phases on the timeline
  const end = timelineEnd(), tk = el('pmTicks'); tk.innerHTML = '';
  if (PM.cur >= 6 && end > 0) for (const m of PM.marks){ if (m.i > end || m.p === 'done') continue; const t = document.createElement('i'); t.style.left = (100 * m.i / end) + '%'; if (m.p === SECOND) t.className = 'b6'; t.title = ph(m.p); tk.append(t); }
  barLive(); placeBar(); }

/* ------------------------------------------------------------------ switching between the modes */
function moveRows(){ for (const s of STEPS) for (const id of s.rows){ const r = rowOf(id); if (!r || homes.has(r)) continue; const ph_ = document.createComment('pm:' + id); r.before(ph_); homes.set(r, ph_); s.card.append(r); }
  for (const s of STEPS) s.card.hidden = !s.rows.length; }
function giveBack(){ for (const [r, ph_] of homes){ ph_.before(r); ph_.remove(); } homes.clear(); }
function setMode(on, first){
  try { localStorage.setItem(KEY, on ? 'process' : 'free'); } catch (e) {}
  for (const b of modeSw.children) b.classList.toggle('on', (b.dataset.pm === '1') === on);
  window.__TS_PROCESS_ON = on; document.body.classList.toggle('pm-on', on); bar.hidden = !on; box.hidden = !on;
  for (const x of freeOnly) x.style.display = on ? 'none' : '';
  if (on){ PM.active = true; moveRows(); el('auto').checked = false; MODE = 'B'; T6.setModeQuiet('B'); applySpeed();
    if (!PM.methodSet){ el('mMethod').value = 'stitch'; PM.methodSet = true; }   // (v8.15) the process mode opens on the stitched main streets
    if (!KPULL) KPULL = { main: 8 * PULL_STEP, sec: 3 * PULL_STEP, edge: 8 * PULL_STEP };   // levels 8, 3, 8 (as the engine's 2.4 and 1.0)
    bindPull();
    PM.valid = 0; PM.reached = 0; PM.frames = []; PM.marks = []; PM.b6 = -1; PM.atB = false; PM.target = 0; go(1); }
  else { stopAuto(); stopPlay(); setScrub(null); window.ENVANIM && ENVANIM.stop(); if (KPULL){ const r = el('pull'); r.min = 0; r.max = 3; r.step = 0.1; r.value = KPULL.main; const o = r.nextElementSibling; if (o) o.textContent = (+r.value).toFixed(1); KPULL = null; const lab = el('pull').closest('.row')?.querySelector('label'); if (lab) lab.textContent = TS_LANG === 'zh' ? '吸引强度' : 'pull'; } PM.active = false; PM.cur = 0; giveBack(); el('auto').checked = true; el('speed').value = 6;
    if (!first){ if (GEN){ GEN = null; GROWING = false; } if (AMODE === 'hand' && !HAND && PM.saved) HAND = PM.saved; placeAttractors(); buildTarget(); settleField(); let sf = true; try { sf = localStorage.getItem('tensorStudio.showFlood') !== '0'; } catch (e) {} T6.setFlood(sf);
      el('lEvents').checked = true; setField('off'); setUnder('zones');
      if (!restoreFinal()) start(true); }
    syncTools(); }
  placeBar(); }
for (const b of modeSw.children) b.onclick = () => { const on = b.dataset.pm === '1'; if (on !== PM.active) setMode(on); };
// a preset in the process mode fills the steps' values, then plays the process from step 1
el('applyPreset').addEventListener('click', () => { if (!PM.active) return; stopAuto(); setTimeout(() => { PM.valid = 0; PM.reached = 0; PM.frames = []; PM.marks = []; PM.b6 = -1; if (GEN){ GEN = null; GROWING = false; } PM.atB = false; playAll(); }, 160); });
// attractors: none to place before step 5; one moved, added or removed is a change in step 5
{ const viewEl = el('view'), akey = () => ATTR.map(a => a.kind + Math.round(a.x) + ':' + Math.round(a.y)).join(';'); let before = '';
  // (v8.12) in step 5 a click places the chosen kind (the engine calls __TS_CLICK on a click that did not drag the map);
  // a double-click adds nothing of its own (its first click has placed the point, its second lands on it)
  viewEl.addEventListener('dblclick', e => { if (!PM.active) return; if (PM.cur <= 5) e.stopPropagation(); }, true);
  window.__TS_CLICK = (x, y) => { if (!PM.active || PM.cur !== 5) return; stopAuto();
    if (addAttr(x, y, PM.kind)){ before = akey(); onChange(5); } };
  viewEl.addEventListener('pointerdown', () => { before = akey(); }, true);
  for (const ev of ['pointerup', 'dblclick', 'contextmenu']) viewEl.addEventListener(ev, () => { if (!PM.active || PM.cur < 5) return; setTimeout(() => { if (akey() !== before){ before = akey(); onChange(5); } }, 0); });
  viewEl.addEventListener('contextmenu', () => { before = before || akey(); }, true); }
// the language: the panel's own words follow the switch
{ const orig = window.setInterfaceLanguage; window.setInterfaceLanguage = l => { orig(l); ui(); }; }

let on = true; try { on = localStorage.getItem(KEY) !== 'free'; } catch (e) {}
setMode(on, true);
})();
