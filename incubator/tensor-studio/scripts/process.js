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
    note: () => L('依次看高程、汇水、夏季通风、冬季冷风和气候舒适度，每张图下面有一句结论。这一步只是查看，选哪张图都不会改变道路。', 'Elevation, runoff, summer air, winter cold and comfort in turn, each with what it shows. Only a reading: the map you pick does not change the streets.') },
  { k: 3, zh: '定约束', en: 'Constraints', rows: ['fOn', 'fAvoid', 'gOn', 'gW', 'gQ'],
    note: () => L('水体和要避让的洪水区从土地中扣除，道路不会进入。主要汇水路径留成蓝绿走廊：道路不沿走廊内部走，只能近似垂直地跨过（涵洞）。', 'Water and the flood zones kept clear come out of the land; no street enters them. The main runoff paths are kept as blue-green corridors: no street runs inside one, streets only cross them, near square, on culverts.') },
  { k: 4, zh: '建张量场', en: 'Tensor field', rows: ['wC', 'wSum', 'wWin', 'wG', 'fW', 'smooth'],
    note: () => L('每个因素给出一个方向，按权重叠成张量场：顺等高线；通风处顺夏季风；冷风强处横切冬季冷风；走廊旁沿走廊（滨水路）；洪水区顺流排水。流线就是道路将要遵循的方向，拖动滑块会实时转向。', 'Each factor gives a direction, weighted into one field: along the contour; along the summer wind where it blows; across the winter cold where it bites; along the corridors beside them (waterside streets); with the flow in the flood zones. The flow lines are the directions the streets will follow; they turn as you move a slider.') },
  { k: 5, zh: '放吸引点', en: 'Attractors', rows: ['aMode', 'nMain', 'nSec', 'nEdge', 'pull'],
    note: () => L('吸引点把附近的流线弯成环形与放射状。可拖动移动；双击添加（Shift 次级，Alt 边界），右键删除。', 'Attractors bend the flow round them into rings and spokes. Drag to move; double-click to add (shift: secondary, alt: on the edge), right-click to remove.') },
  { k: 6, zh: '长主路', en: 'Main streets', rows: ['d1', 'bMains', 'bMem', 'bFork'],
    note: () => L('主路从锚点出发，沿场的方向每步 5 米生长，遇到别的道路形成 T 或 Y 路口。', 'Main streets start at the anchors and grow 5 m a step along the field, making a T or a Y where they meet another street.') },
  { k: 7, zh: '长次路', en: 'Second streets', rows: ['d2', 'bGap', 'bInfill', 'bSec6'],
    note: () => L('次路从主路两侧分出，再清理并行和断头的道路。', 'Second streets branch off the main ones, then streets side by side and open ends are tidied.') },
  { k: 8, zh: '评价出图', en: 'Review and export', rows: ['fNum', 'bGeo'],
    note: () => L('路网指标与上一个方案对比；道路按宽度显示。', 'The network measured against the previous run; streets drawn at width.') } ];

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
  let tm = null; const changed = () => { clearTimeout(tm); tm = setTimeout(() => onChange(s.k), 230); };
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
for (const [k] of ENVK){ const b = document.createElement('button'); b.type = 'button'; b.dataset.env = k; b.onclick = () => { stopAuto(); PM.envTok++; T6.setEnv(k); ui(); }; chips.append(b); }
const envTxt = document.createElement('p'); envTxt.className = 'pmOut';
STEPS[1].extra.append(chips, envTxt);
const siteTxt = document.createElement('div'); siteTxt.className = 'pmOut'; STEPS[0].extra.append(siteTxt);
const areaTxt = document.createElement('p'); areaTxt.className = 'pmOut'; STEPS[2].extra.after(areaTxt);
const metTbl = document.createElement('table'); metTbl.className = 'pmMet'; STEPS[7].extra.append(metTbl);

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
addEventListener('resize', placeBar); new ResizeObserver(placeBar).observe(panel); new ResizeObserver(placeBar).observe(el('displayPanel'));
// parts of the display panel that belong to the free mode
const freeOnly = [el('tgMode')?.closest('.dpSection'), el('tResult')].filter(Boolean);

/* ------------------------------------------------------------------ the engine's hooks */
T6.setProc({
  stopAt: p => PM.active && PM.target === 6 && p === SECOND,
  steps: () => PM.active ? SPEED[PM.speed].steps : 0,
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
  else { if (AMODE === 'hand' && !HAND && PM.saved) HAND = PM.saved; placeAttractors(); PM.nAttr = ATTR.length; } }
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
  setField(k === 4 || k === 5 ? 'move' : 'off'); setUnder('off'); T6.setFlood(k === 3 && !!FR); T6.setGreen(k >= 3); if (k !== 2) T6.setEnv('off');
  FROZEN = false; baseDirty = netDirty = widthDirty = true; syncTools(); }
function go(k, auto){
  if (k < 1 || k > 8) return; PM.envTok++;
  PM.cur = k; PM.reached = Math.max(PM.reached, k); world(k);
  if (k === 2 && !auto) envTour(++PM.envTok);
  ui(); const li = STEPS[k - 1].li; requestAnimationFrame(() => li.scrollIntoView({ block: 'nearest', behavior: 'smooth' })); }
// a setting in step k changed: the steps after it are no longer current
function onChange(k){
  if (!PM.active) return; stopAuto();
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
async function envTour(tok){ if (!ENV) return; for (const [k] of ENVK){ if (tok !== PM.envTok) return; T6.setEnv(k); ui(); await sleep(PM.auto ? 1700 : 2200); } }
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
  if (k === 5) return L(PM.nAttr + ' 个吸引点', PM.nAttr + ' attractors');
  if (k === 6){ const f = PM.frames[PM.b6]; if (!f) return ''; let n = 0; f.o.forEach((l, i) => { if (l.level === 1 && !l.circus && f.n[i] > 1) n++; });
    return L(n + ' 条主路 · 间距 ' + v('d1') + ' m', n + ' main streets · ' + v('d1') + ' m apart'); }
  if (k === 7){ const m = PM.lastM; if (!m) return ''; return L((m.km1 + m.km2).toFixed(1) + ' km 道路 · ' + m.cells + ' 个地块', (m.km1 + m.km2).toFixed(1) + ' km of street · ' + m.cells + ' cells'); }
  return ''; }
function argmax(a){ let b = 0; a.forEach((x, i) => { if (x > a[b]) b = i; }); return b; }
function envConclusion(){ const st = T6.envStats, k = T6.env; if (!st) return L('此场地没有环境分析数据，可以直接进入下一步。', 'No environmental fields for this site: go on to the next step.');
  const pct = (a, i) => Math.round(100 * a[i] / (a.reduce((s, x) => s + x, 0) || 1));
  if (k === 'Z') return L('场地高程 ' + st.zMin + '–' + st.zMax + ' 米，高差 ' + (st.zMax - st.zMin).toFixed(1) + ' 米。道路将优先顺着等高线走。', 'The land runs from ' + st.zMin + ' to ' + st.zMax + ' m. Streets will follow the contours first.');
  if (k === 'Q') return L('亮蓝线是雨水汇集的路径。下一步把主要路径留成蓝绿走廊，道路只能跨过它们。', 'The bright lines are where rain gathers. The next step keeps the main paths as blue-green corridors, which streets only cross.');
  if (k === 'V'){ const i = argmax(st.summerEnergy); return L('夏季通风以' + dirName(i) + '风为主，占夏季风能的 ' + pct(st.summerEnergy, i) + '%。深色处风最强，第 4 步在那里让道路顺着风走。', 'Summer air comes mostly from the ' + dirName(i) + ', ' + pct(st.summerEnergy, i) + ' % of its energy. Step 4 runs the streets along it where it is strongest (dark).'); }
  if (k === 'Cw'){ const i = argmax(st.winterColdEnergy); return L('冬季冷风主要来自' + dirName(i) + '，占 ' + pct(st.winterColdEnergy, i) + '%。深色处最冷，第 4 步在那里让道路横切冷风。', 'The winter cold comes mostly from the ' + dirName(i) + ', ' + pct(st.winterColdEnergy, i) + ' %. Step 4 runs the streets across it where it bites (dark).'); }
  if (k === 'C') return L('暖色处避开冬季冷风、又有夏季通风，适合布置公共空间。', 'Warm ground is out of the winter cold and open to summer air: good for public space.');
  return L('点击上面的图层，或播放分析。', 'Pick a map above, or play the analysis.'); }
function siteText(){ const s = D.site, st = T6.envStats, list = [];
  list.push(L('地形：', 'Terrain: ') + (s ? 'OS Terrain 50' : (st && st.elevationFrom === 'contours' ? L('OS 1 米等高线', 'OS 1 m contours') : 'OS')));
  list.push(L('洪水：', 'Flood: ') + (FR ? L('EA 地表水与河流海洋风险', 'EA surface water, rivers and sea') : L('不在 EA 数据范围内', 'outside the EA data')));
  list.push(L('风：London Luton 典型气象年（逐时）', 'Wind: London Luton typical year, hourly'));
  if (s) list.push(L('道路、水体、铁路、建筑：OpenStreetMap', 'Streets, water, rail, buildings: OpenStreetMap'));
  return '<b>' + summary(1) + '</b><ul>' + list.map(x => '<li>' + x + '</li>').join('') + '</ul>'; }
function metHTML(){ const m = METR || PM.lastM, p = PM.prevM; if (!m) return '';
  const rows = [['km1', '主路', 'Main streets', ' km', 1], ['km2', '次路', 'Second streets', ' km', 1], ['dens', '路网密度', 'Density', ' km/km²', 1], ['road', '道路用地', 'Land in streets', ' %', 0],
    ['T', 'T 路口', 'T junctions', ' %', 0], ['Y', 'Y 路口', 'Y junctions', ' %', 0], ['X', '十字路口', 'Crossings', ' %', 0], ['loose', '断头路', 'Dead ends', '', 0], ['cells', '地块', 'Cells', '', 0], ['med', '地块中位面积', 'Median cell', ' ha', 2]];
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
  envTxt.textContent = envConclusion(); siteTxt.innerHTML = siteText();
  const g = T6.corr, gTxt = g ? L(' 蓝绿走廊 ' + g.areaHa.toFixed(1) + ' 公顷，道路只能跨过。', ' Blue-green corridors ' + g.areaHa.toFixed(1) + ' ha, which streets only cross.') : '';
  areaTxt.textContent = (PM.area && floodOn() ? L('场地土地 ' + PM.area.base.toFixed(1) + ' 公顷，洪水避让 ' + (PM.area.base - PM.area.use).toFixed(1) + ' 公顷，可生长道路的土地 ' + PM.area.use.toFixed(1) + ' 公顷。',
    'Land ' + PM.area.base.toFixed(1) + ' ha; kept clear of flooding ' + (PM.area.base - PM.area.use).toFixed(1) + ' ha; ' + PM.area.use.toFixed(1) + ' ha left for streets.') : (FR ? L('洪水风险未参与。', 'Flood risk is off.') : L('此场地不在 EA 洪水数据范围内。', 'No EA flood data for this site.'))) + gTxt;
  metTbl.innerHTML = PM.cur === 8 ? metHTML() : '';
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
    PM.valid = 0; PM.reached = 0; PM.frames = []; PM.marks = []; PM.b6 = -1; PM.atB = false; PM.target = 0; go(1); }
  else { stopAuto(); stopPlay(); setScrub(null); PM.active = false; PM.cur = 0; giveBack(); el('auto').checked = true; el('speed').value = 6;
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
  viewEl.addEventListener('dblclick', e => { if (PM.active && PM.cur < 5) e.stopPropagation(); }, true);
  viewEl.addEventListener('pointerdown', () => { before = akey(); }, true);
  for (const ev of ['pointerup', 'dblclick', 'contextmenu']) viewEl.addEventListener(ev, () => { if (!PM.active || PM.cur < 5) return; setTimeout(() => { if (akey() !== before){ before = akey(); onChange(5); } }, 0); });
  viewEl.addEventListener('contextmenu', () => { before = before || akey(); }, true); }
// the language: the panel's own words follow the switch
{ const orig = window.setInterfaceLanguage; window.setInterfaceLanguage = l => { orig(l); ui(); }; }

let on = true; try { on = localStorage.getItem(KEY) !== 'free'; } catch (e) {}
setMode(on, true);
})();
