/* Tensor Studio · the growth engine (v8), unchanged except where marked (site).
 * Loaded by index.html once window.__TS.D holds the site. */
'use strict';
const D = window.__TS.D;   // set by index.html: the site from the London map, or the station P2 example
const $ = id => document.getElementById(id), v = id => +$(id).value, PI = Math.PI, NL = String.fromCharCode(10);
const clamp = (a, b, c) => Math.max(b, Math.min(c, a));

/* ------------------------------------------------------------------ Parcel 62 only: its land, its anchors, its attractors, its river street */
// (v7) the cells run together: every piece and anchor kept, each piece tagged with its cell (parcel)
const in62 = p => D.pieces.some(q => inRing(p, q.outer));
D.attract.main = D.attract.main.filter(in62); D.attract.sec = D.attract.sec.filter(in62);
function dPoly(p, pts){ let d = 1e18; for (let i = 1; i < pts.length; i++){ const a = pts[i - 1], b = pts[i], dx = b[0] - a[0], dy = b[1] - a[1], L2 = dx * dx + dy * dy || 1, t = clamp(((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / L2, 0, 1);
  d = Math.min(d, Math.hypot(p[0] - a[0] - dx * t, p[1] - a[1] - dy * t)); } return d; }
D.fixed.streets = D.fixed.streets.filter(st => st.some(p => in62(p) || D.pieces.some(q => dPoly(p, q.outer) < 40)));
{ const keep = [D.fixed.link, ...D.fixed.streets]; D.fixed.bridges = D.fixed.bridges.filter(b => keep.some(st => Math.min(dPoly(b[0], st), dPoly(b[b.length - 1], st)) < 30)); }

/* ------------------------------------------------------------------ theme */
const PAL = {
  // light: the paper version of the references, warm cream ground, plum ink, teal water, orange for what is strong
  light: { bg:'#f2f2f4', land:'#ffffff', landShadow:'rgba(0,0,0,0.08)', edge:'#1d1d1f', contour:'rgba(0,0,0,0.07)', contourIdx:'rgba(0,0,0,0.16)', label:'#8e8e93',
    water:'#d9e8f6', waterEdge:'#6aa6dc', stream:'#6aa6dc', room:'rgba(0,113,227,0.05)', bld:'#e5e5ea', urban:'rgba(0,0,0,0.025)', lane:'#e8e8ed',
    prim:'#1d1d1f', rib:{M:'#c7c7cc',A:'#d1d1d6',B:'#dcdce0',C:'#e5e5ea'}, main:'#1d1d1f', second:'#8e8e93', grow:'#0071e3', glow:'rgba(0,113,227,0.28)',
    anchor:'#1d1d1f', attr:'#0071e3', attr2:'#f08a00', attrE:'#af52de', bridge:'#1d1d1f', culvert:'#0071e3', width:'#1d1d1f',
    flow:[[0,113,227],[99,99,102],[255,149,0]], flowBlend:'source-over', flowAlpha:0.42, fade:0.03,
    fieldLine:'rgba(0,113,227,0.45)', fieldLine2:'rgba(0,0,0,0.18)', wLo:[209,209,214], wHi:[29,29,31], wind:{west:'#0071e3',north:'#5ac8fa',east:'#ff9500',south:'#34c759'}, windAlong:'#0071e3', windAcross:'#ff9500', ghost:'rgba(0,0,0,0.25)', cells:['#fafafa','#efeff2','#e2e2e7','#d1d1d6','#bcbcc2'], cross:'rgba(0,0,0,0.32)', evBranch:'#0071e3', evFork:'#ff9500', evCross:'#1d1d1f', evInfill:'#34c759', other:'rgba(255,149,0,0.6)', uTeal:[0,113,227], uOrange:[255,149,0] },
  // dark: the references (deep plum-charcoal ground, cream linework, teal water, orange heat, sage canopy)
  dark: { bg:'#000000', land:'#111113', landShadow:'rgba(0,0,0,0)', edge:'#f5f5f7', contour:'rgba(255,255,255,0.06)', contourIdx:'rgba(255,255,255,0.15)', label:'#8e8e93',
    water:'#0c2238', waterEdge:'#409cff', stream:'#409cff', room:'rgba(10,132,255,0.07)', bld:'#2c2c2e', urban:'rgba(255,255,255,0.025)', lane:'#232325',
    prim:'#f5f5f7', rib:{M:'#3a3a3c',A:'#444446',B:'#3a3a3c',C:'#2c2c2e'}, main:'#f5f5f7', second:'#8e8e93', grow:'#0a84ff', glow:'rgba(10,132,255,0.5)',
    anchor:'#f5f5f7', attr:'#0a84ff', attr2:'#ff9f0a', attrE:'#bf5af2', bridge:'#f5f5f7', culvert:'#0a84ff', width:'#f5f5f7',
    flow:[[10,132,255],[235,235,245],[255,159,10]], flowBlend:'source-over', flowAlpha:0.36, fade:0.03,
    fieldLine:'rgba(10,132,255,0.55)', fieldLine2:'rgba(255,255,255,0.22)', wLo:[72,72,74], wHi:[245,245,247], wind:{west:'#0a84ff',north:'#64d2ff',east:'#ff9f0a',south:'#30d158'}, windAlong:'#0a84ff', windAcross:'#ff9f0a', ghost:'rgba(255,255,255,0.2)', cells:['#111113','#19191b','#222225','#2c2c30','#3a3a3e'], cross:'rgba(255,255,255,0.28)', evBranch:'#0a84ff', evFork:'#ff9f0a', evCross:'#f5f5f7', evInfill:'#30d158', other:'rgba(255,159,10,0.65)', uTeal:[10,132,255], uOrange:[255,159,10] }
};
// (site) on a London site the existing main roads are context, not the network being grown: drawn quieter
if (D.site){ PAL.light.prim = '#b4b4ba'; PAL.dark.prim = '#4a4a4e'; }
let THEME = 'light', P = PAL.light;
let FIELDMODE = 'move', FROZEN = false, FLINES = null;
function setTheme(t){ GIMG = null; THEME = t; P = PAL[t]; document.documentElement.setAttribute('data-theme', t);
  for (const b of document.querySelectorAll('#theme button')) b.classList.toggle('on', b.dataset.t === t);
  try { localStorage.setItem('ts7-theme', t); } catch (e) {}
  baseDirty = true; netDirty = true; widthDirty = true; CELLIMG = null; FLINES = null; UNDERIMG = null; clearTrails(); drawKey(); if (document.getElementById('wRamp')) drawRamp(); if (typeof syncTools === 'function' && document.getElementById('tWind')) try { syncTools(); } catch (e) {} }

/* ------------------------------------------------------------------ data */
function dec(s, scale){ const b = atob(s), n = b.length >> 1, out = new Float32Array(n);
  for (let i = 0; i < n; i++){ let x = b.charCodeAt(2*i) | (b.charCodeAt(2*i+1) << 8); if (x > 32767) x -= 65536; out[i] = x / scale; } return out; }
const nx = D.grid.nx, ny = D.grid.ny, cell = D.grid.cell, N = nx * ny, OX = D.origin[0], OY = D.origin[1];
const BA = { cA: dec(D.basis.cA, 1e4), cW: dec(D.basis.cW, 1e3), eD: dec(D.basis.eD, 1), eA: dec(D.basis.eA, 1e4), sD: dec(D.basis.sD, 1), sA: dec(D.basis.sA, 1e4), rD: D.basis.rD ? dec(D.basis.rD, 1) : null, rA: D.basis.rA ? dec(D.basis.rA, 1e4) : null };
const DIRS = D.dirs.map(d => ({ frm: d.frm, name: d.name, job: d.job, S: dec(d.S, 1e3), rel: dec(d.rel, 1e4) }));
const YEAR = D.year;                              // 12 months and the whole year: each direction's share of hours, mean speed
const YSUM = YEAR[12].share.reduce((s, x, k) => s + x * YEAR[12].v[k] ** 2, 0) || 1;   // the year's wind pressure, all directions
let MONTH = 12;
const HR = { u: D.hours.u.map(x => x / 100), v: D.hours.v.map(x => x / 100), month: D.hours.month, day: D.hours.day, step: D.hours.step_h };
const HRANGE = []; for (let m = 0; m < 12; m++){ let a = -1, b = -1; HR.month.forEach((x, i) => { if (x === m + 1){ if (a < 0) a = i; b = i; } }); HRANGE.push([a, b + 1]); } HRANGE.push([0, HR.u.length]);
let HCLOCK = HRANGE[12][0];
const SECTOR = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
function windNow(){ const [a, b] = HRANGE[MONTH]; if (HCLOCK < a || HCLOCK >= b) HCLOCK = a; const i = Math.floor(HCLOCK), j = (i + 1 < b) ? i + 1 : a, t = HCLOCK - i;
  const u = HR.u[i] * (1 - t) + HR.u[j] * t, v_ = HR.v[i] * (1 - t) + HR.v[j] * t, spd = Math.hypot(u, v_), frm = ((Math.atan2(-u, -v_) * 180 / PI) + 360) % 360;
  return { u, v: v_, spd, frm, k: Math.round(frm / 45) % 8, i }; }
const ZB = Uint8Array.from(atob(D.zone.bits), ch => ch.charCodeAt(0));
// (v7) our rail lines at ground level: 5 m bits of the rail and 10 m either side; a street crosses only near square (a bridge)
const RB = D.zone.rail ? Uint8Array.from(atob(D.zone.rail), ch => ch.charCodeAt(0)) : null;
function inRail(x, y){ if (!RB) return false; const z = D.zone, c = Math.floor(x / z.c), r = Math.floor((D.h - y) / z.c); if (c < 0 || r < 0 || c >= z.W || r >= z.H) return false; const i = r * z.W + c; return (RB[i >> 3] >> (7 - (i & 7))) & 1; }
function railAngle(x, y){ const c = clamp(Math.round(x / cell), 0, nx - 1), r = clamp(Math.round(y / cell), 0, ny - 1); return BA.rA ? BA.rA[r * nx + c] : 0; }
const RAIL_MIN = 70;   // degrees: a street crosses the rail within 20 degrees of square, or not at all
function railDist(x, y){ if (!BA.rD) return 1e9; const c = clamp(Math.round(x / cell), 0, nx - 1), r = clamp(Math.round(y / cell), 0, ny - 1); return BA.rD[r * nx + c]; }
function alongRail(x, y, dx, dy){ if (railDist(x, y) > 40) return false; let a = Math.abs((Math.atan2(dy, dx) - railAngle(x, y)) * 180 / PI) % 180; a = a > 90 ? 180 - a : a; return a < 30; }
function railOK(x, y, dx, dy){ let a = Math.abs((Math.atan2(dy, dx) - railAngle(x, y)) * 180 / PI) % 180; a = a > 90 ? 180 - a : a; return a >= RAIL_MIN; }
let BRIDGES = [];
function railCross(x, y, dx, dy){ if (!railOK(x + dx * 8, y + dy * 8, dx, dy)) return null;
  for (let s = 5; s <= 60; s += 5){ const qx = x + dx * s, qy = y + dy * s; if (!inLand(qx, qy)) return null; if (!inRail(qx, qy)){ BRIDGES.push({ x: (x + qx) / 2, y: (y + qy) / 2 }); return [qx, qy]; } } return null; }
function inZone(x, y){ if (GZ){ const c = Math.floor(x / cell), r = Math.floor(y / cell); if (c >= 0 && r >= 0 && c < nx && r < ny && GZ[r * nx + c]) return true; }
  const z = D.zone, c = Math.floor(x / z.c), r = Math.floor((D.h - y) / z.c); if (c < 0 || r < 0 || c >= z.W || r >= z.H) return false; const i = r * z.W + c; return (ZB[i >> 3] >> (7 - (i & 7))) & 1; }
// (v8.8) the blue-green corridors: the main runoff paths, widened. A hard constraint, the same as the watercourses: no
// street runs inside one, a street crosses one square-ish (30 degrees or more) on a culvert. GZ 1 in a corridor (10 m
// cells), GD the distance to the nearest corridor axis (m), GA the axis there, for the field (waterside streets)
let GZ = null, GD = null, GA = null, GKEY = '', GINFO = null, GIMG = null;
const corrOn = () => !!(window.__TS.D.env && window.__TS.envFns) && !!document.getElementById('gOn')?.checked;
function buildCorridors(){ const on = corrOn(), key = on ? v('gW') + ':' + document.getElementById('gQ').value : 'off'; if (key === GKEY) return; GKEY = key; GIMG = null;
  if (!on){ GZ = GD = GA = null; GINFO = null; return; }
  const g = window.__TS.envFns.corridors(window.__TS.D.env, D.landMask || null, nx, ny, cell, { minHa: +document.getElementById('gQ').value, half: v('gW') / 2 });
  GZ = g.mask; GD = g.dist; GA = g.axis; GINFO = { cells: g.cells, areaHa: g.areaHa, share: g.share, minHa: g.minHa, raised: g.raised }; }
function axisOf(frm, job){ const to = (frm + 180) % 360, a = (90 - to) * PI / 180; return job === 'along' ? a : a + PI / 2; }
// (v8.5) flood risk (EA): the class of each 10 m cell, the higher of surface water and rivers & sea (0 none … 4 high)
const FLOOD = D.flood || null, FR = FLOOD && FLOOD.grid && FLOOD.grid.length === N ? FLOOD.grid : null;
let FRW = null;   // smoothed weights of the flow part: low 0.5, medium 1, high 1.4
function floodWeights(){ if (FRW || !FR) return FRW; const w = new Float32Array(N); for (let i = 0; i < N; i++) w[i] = [0, 0.25, 0.5, 1, 1.4][FR[i]] || 0; return (FRW = blur(w, 1.5)); }
const floodOn = () => !!FR && !!document.getElementById('fOn')?.checked;
const floodAvoid = () => floodOn() ? +document.getElementById('fAvoid').value : 0;
function toVec(frm){ const to = (frm + 180) % 360, a = (90 - to) * PI / 180; return [Math.cos(a), Math.sin(a)]; }

/* ------------------------------------------------------------------ the land mask (2.5 m), with the circus holes */
let MASK = null, MW = 0, MH = 0; const MC = 2.5; let HOLES = [];
function ringPath(g, pts, sc){ pts.forEach((p, k) => k ? g.lineTo(p[0] / sc, (D.h - p[1]) / sc) : g.moveTo(p[0] / sc, (D.h - p[1]) / sc)); g.closePath(); }
function buildMask(){ buildCorridors(); MW = Math.ceil(D.w / MC); MH = Math.ceil(D.h / MC); const oc = document.createElement('canvas'); oc.width = MW; oc.height = MH; const g = oc.getContext('2d');
  g.fillStyle = '#000'; g.beginPath(); for (const p of D.pieces){ ringPath(g, p.outer, MC); for (const h of p.holes) ringPath(g, h, MC); } g.fill('evenodd');
  g.globalCompositeOperation = 'destination-out';
  // (site) shapes across the boundary that could not be cut exactly are taken out of the land
  for (const pg of (D.cut || [])){ g.beginPath(); for (const r of pg) ringPath(g, r, MC); g.fill('evenodd'); }
  { const fa = floodAvoid(); if (fa && FLOOD.zones[fa]?.length){ g.beginPath(); for (const r of FLOOD.zones[fa]) ringPath(g, r, MC); g.fill('evenodd'); } }   // (v8.5) flood zones kept clear
  for (const h of HOLES){ g.beginPath(); g.arc(h.x / MC, (D.h - h.y) / MC, (h.r + 2) / MC, 0, 2 * PI); g.fill(); }
  const d = g.getImageData(0, 0, MW, MH).data; MASK = new Uint8Array(MW * MH); for (let i = 0; i < MW * MH; i++) MASK[i] = d[4 * i + 3] > 127 ? 1 : 0; }
function inLand(x, y){ const c = Math.floor(x / MC), r = Math.floor((D.h - y) / MC); return c >= 0 && r >= 0 && c < MW && r < MH && MASK[r * MW + c] === 1; }
function inRing(p, r){ let ins = false; for (let i = 0, j = r.length - 1; i < r.length; j = i++){ const a = r[i], b = r[j]; if ((a[1] > p[1]) !== (b[1] > p[1]) && p[0] < (b[0] - a[0]) * (p[1] - a[1]) / (b[1] - a[1]) + a[0]) ins = !ins; } return ins; }
function nearestOnRing(r, x, y){ let best = null; for (let i = 1; i < r.length; i++){ const a = r[i - 1], b = r[i], dx = b[0] - a[0], dy = b[1] - a[1], L2 = dx * dx + dy * dy || 1;
    const t = clamp(((x - a[0]) * dx + (y - a[1]) * dy) / L2, 0, 1), px = a[0] + dx * t, py = a[1] + dy * t, d = Math.hypot(x - px, y - py);
    if (!best || d < best.d){ const L = Math.sqrt(L2); best = { x: px, y: py, d, tx: dx / L, ty: dy / L }; } } return best; }

/* ------------------------------------------------------------------ the field: target (for growing) and current (morphing, for the flow) */
let TC, TS, TW, CC, CS, CWt, MORPH = 0;
function blur(a, sg){ if (sg < 0.3) return a; const R = Math.ceil(sg * 2.5), k = []; let s = 0; for (let i = -R; i <= R; i++){ const w = Math.exp(-i * i / (2 * sg * sg)); k.push(w); s += w; } for (let i = 0; i < k.length; i++) k[i] /= s;
  const t = new Float32Array(N), o = new Float32Array(N);
  for (let r = 0; r < ny; r++) for (let c = 0; c < nx; c++){ let w = 0; for (let i = -R; i <= R; i++) w += a[r * nx + clamp(c + i, 0, nx - 1)] * k[i + R]; t[r * nx + c] = w; }
  for (let r = 0; r < ny; r++) for (let c = 0; c < nx; c++){ let w = 0; for (let i = -R; i <= R; i++) w += t[clamp(r + i, 0, ny - 1) * nx + c] * k[i + R]; o[r * nx + c] = w; } return o; }
// the attractors: at the wind's calm points (as baked), spread out over the land, or on the edge; each draggable
let ATTR = [], AMODE = 'calm', CALM = null, HAND = null;   // (v8) HAND: the points placed by hand
const SKETCH_MAIN = D.site ? [] : [[520246, 238074], [520995, 237343]];   // the user's two main attractors (21 Oct), British National Grid
const SKETCH_EDGE = D.site ? [] : [[520585, 238212], [521267, 237543], [520347, 237038]];   // and their three on the edge: north, east, south-west
// (v8.12) KPULL: a pull for each kind of attractor (the process mode sets it); null: the one 'pull' slider, secondaries at / 2.4
let KPULL = null;
function attractorsOn(){ const pull = v('pull'), kp = (k, d) => KPULL && KPULL[k] != null ? KPULL[k] : d;
  return ATTR.map(a => a.kind === 'main' ? { x: a.x, y: a.y, reach: 230, pull: kp('main', pull), main: true, kind: 'main' } : a.kind === 'edge' ? { x: a.x, y: a.y, reach: 340, pull: kp('edge', pull), main: true, edge: true, kind: 'edge' } : { x: a.x, y: a.y, reach: 140, pull: kp('sec', pull / 2.4), main: false, kind: 'sec' }); }
// where the year's winds cancel: the size of their summed street directions, smoothed (small = calm)
function calmMap(){ if (CALM) return CALM; const M = YEAR[12], C = new Float32Array(N), S = new Float32Array(N);
  for (let d = 0; d < 8; d++){ const k = DIRS[d], a = M.share[d] * M.v[d] * M.v[d] / YSUM; if (a < 1e-4) continue; const t = axisOf(k.frm, k.job), c2 = Math.cos(2 * t), s2 = Math.sin(2 * t);
    for (let i = 0; i < N; i++){ C[i] += k.S[i] * a * c2; S[i] += k.S[i] * a * s2; } }
  const m = new Float32Array(N); for (let i = 0; i < N; i++) m[i] = Math.hypot(C[i], S[i]); return (CALM = blur(m, 6)); }
function landCells(minEdge){ const out = []; for (let r = 0; r < ny; r += 2) for (let c = 0; c < nx; c += 2){ const x = c * cell, y = r * cell, i = r * nx + c; if (!inLand(x, y) || inZone(x, y) || BA.eD[i] < minEdge) continue; out.push([x, y, i]); } return out; }
// k centres sharing the land out (weighted k-means, calmer land weighs more), each then moved to the calmest place within 150 m
function kmeans(P, w, k){ if (!k || !P.length) return []; let cx = 0, cy = 0, W = 0; P.forEach((p, i) => { cx += p[0] * w[i]; cy += p[1] * w[i]; W += w[i]; }); cx /= W; cy /= W;
  const cen = []; let ref = [[cx, cy]];
  for (let j = 0; j < k; j++){ let best = P[0], bd = -1; for (const p of P){ const d = Math.min(...ref.map(q => Math.hypot(p[0] - q[0], p[1] - q[1]))); if (d > bd){ bd = d; best = p; } } if (j === 0) ref = []; ref.push([best[0], best[1]]); cen.push([best[0], best[1]]); }
  for (let it = 0; it < 20; it++){ const sx = cen.map(() => [0, 0, 0]);
    P.forEach((p, i) => { let bj = 0, bd = 1e18; cen.forEach((c, j) => { const d = (p[0] - c[0]) ** 2 + (p[1] - c[1]) ** 2; if (d < bd){ bd = d; bj = j; } }); sx[bj][0] += p[0] * w[i]; sx[bj][1] += p[1] * w[i]; sx[bj][2] += w[i]; });
    cen.forEach((c, j) => { if (sx[j][2]){ c[0] = sx[j][0] / sx[j][2]; c[1] = sx[j][1] / sx[j][2]; } }); }
  const C = calmMap();
  return cen.map(c => { let best = null, bv = 1e18; for (const p of P){ if (Math.hypot(p[0] - c[0], p[1] - c[1]) > 150) continue; if (C[p[2]] < bv){ bv = C[p[2]]; best = p; } } return best ? [best[0], best[1]] : c; }); }
function spreadOut(nm, ns){ const P = landCells(120); if (!P.length) return []; const C = calmMap(); let mx = -1e9, mn = 1e9; for (const p of P){ mx = Math.max(mx, C[p[2]]); mn = Math.min(mn, C[p[2]]); }
  const w = P.map(p => 0.25 + (mx - C[p[2]]) / ((mx - mn) || 1)), mains = kmeans(P, w, nm);
  const all = kmeans(P, w, nm + ns).map(c => [c[0], c[1], mains.length ? Math.min(...mains.map(q => Math.hypot(c[0] - q[0], c[1] - q[1]))) : 1]).sort((a, b) => b[2] - a[2]);
  return mains.map(c => ({ x: c[0], y: c[1], kind: 'main' })).concat(all.slice(0, ns).map(c => ({ x: c[0], y: c[1], kind: 'sec' }))); }
// on the edge: points along a straight stretch of the land's edge (not a corner, where a semicircle would shrink to a
// wedge) with at least 450 m of land behind them, spread along it (the deepest first, then each the farthest from those chosen)
function onEdge(n){ if (!n) return []; const cand = [];
  for (const p of D.pieces){ const Rg = densify(p.outer, 25); for (let i = 1; i < Rg.length; i++){ const a = Rg[i - 1], b = Rg[i], dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy) || 1; let ux = -dy / L, uy = dx / L;
      if (!inLand(b[0] + ux * 15, b[1] + uy * 15)){ ux = -ux; uy = -uy; } if (!inLand(b[0] + ux * 15, b[1] + uy * 15)) continue;
      if (!inLand(b[0] + ux * 30 + dx / L * 120, b[1] + uy * 30 + dy / L * 120) || !inLand(b[0] + ux * 30 - dx / L * 120, b[1] + uy * 30 - dy / L * 120)) continue;
      let dep = 10; while (dep < 700 && inLand(b[0] + ux * (dep + 10), b[1] + uy * (dep + 10))) dep += 10; if (dep >= 450) cand.push([b[0], b[1], dep]); } }
  // the first three where they were drawn on 21 Oct (snapped to the edge), any more spread along it
  const out = SKETCH_EDGE.slice(0, n).map(p => { let best = null; for (const pc of D.pieces){ const q = nearestOnRing(pc.outer, p[0] - OX, p[1] - OY); if (!best || q.d < best.d) best = q; } return [best.x, best.y, 0]; });
  if (!cand.length) return out.map(p => ({ x: p[0], y: p[1], kind: 'edge' }));
  while (out.length < n){ let best = null, bd = -1; for (const p of cand){ const d = Math.min(...out.map(q => Math.hypot(p[0] - q[0], p[1] - q[1]))); if (d > bd){ bd = d; best = p; } } if (!best || bd < 200) break; out.push(best); }
  return out.map(p => ({ x: p[0], y: p[1], kind: 'edge' })); }
// the largest piece of land: its points, middle and length
function mainPiece(){ return D.pieces.reduce((b, p) => Math.abs(polyArea(p.outer)) > Math.abs(polyArea(b.outer)) ? p : b); }
function longAxis(P){ let mx = 0, my = 0; P.forEach(p => { mx += p[0]; my += p[1]; }); mx /= P.length; my /= P.length; let a = 0, b = 0, c = 0;
  P.forEach(p => { const dx = p[0] - mx, dy = p[1] - my; a += dx * dx; b += dx * dy; c += dy * dy; }); return 0.5 * Math.atan2(2 * b, a - c); }
function nearestCell(P, x, y){ let best = P[0], bd = 1e18; for (const p of P){ const d = (p[0] - x) ** 2 + (p[1] - y) ** 2; if (d < bd){ bd = d; best = p; } } return best; }
// from the field: the calmest places (the baked calm points first), at least 450 m apart, 120 m in from the edge
function calmN(n){ const out = D.attract.main.slice(0, n).map(p => ({ x: p[0], y: p[1], kind: 'main' })); if (out.length >= n) return out;
  const C = calmMap(), P = landCells(120).sort((a, b) => C[a[2]] - C[b[2]]);
  for (const p of P){ if (out.length >= n) break; if (out.every(a => Math.hypot(p[0] - a.x, p[1] - a.y) > 450)) out.push({ x: p[0], y: p[1], kind: 'main' }); }
  return out; }
// near the centre: one at the land's deepest middle; two to four on a ring round it, a fifth of the land's size out,
// turned along the land's length
function centreN(n){ if (!n) return []; const P = landCells(120); if (!P.length) return []; let cx = 0, cy = 0; P.forEach(p => { cx += p[0]; cy += p[1]; }); cx /= P.length; cy /= P.length;
  const score = p => BA.eD[p[2]] - 0.5 * Math.hypot(p[0] - cx, p[1] - cy), core = P.reduce((b, p) => score(p) > score(b) ? p : b);
  if (n === 1) return [{ x: core[0], y: core[1], kind: 'main' }];
  const R = Math.max(220, 0.2 * Math.sqrt(P.length * (2 * cell) ** 2)), ax = longAxis(P), out = [];
  for (let k = 0; k < n; k++){ const a = ax + k * 2 * PI / n, q = nearestCell(P, core[0] + R * Math.cos(a), core[1] + R * Math.sin(a)); out.push({ x: q[0], y: q[1], kind: 'main' }); }
  return out; }
// near the corners: the largest piece's farthest corners, spread apart (the farthest from the middle first), each moved in
// toward the middle until it is 150 m from the edge
function cornersN(n){ if (!n) return []; const pc = mainPiece(), R = densify(pc.outer, 20), P = landCells(150); if (!P.length) return [];
  let cx = 0, cy = 0; P.forEach(p => { cx += p[0]; cy += p[1]; }); cx /= P.length; cy /= P.length;
  const far = R.map(p => [p[0], p[1], Math.hypot(p[0] - cx, p[1] - cy)]), dmax = Math.max(...far.map(p => p[2])), cand = far.filter(p => p[2] >= 0.55 * dmax);
  const pick = [cand.reduce((b, p) => p[2] > b[2] ? p : b)];
  while (pick.length < n){ let best = null, bd = -1; for (const p of cand){ const d = Math.min(...pick.map(q => Math.hypot(p[0] - q[0], p[1] - q[1]))); if (d > bd){ bd = d; best = p; } } if (!best) break; pick.push(best); }
  return pick.map(p => { const dx = cx - p[0], dy = cy - p[1], L = Math.hypot(dx, dy) || 1; let x = p[0], y = p[1];
    for (let s_ = 0; s_ < L; s_ += 10){ x = p[0] + dx / L * s_; y = p[1] + dy / L * s_; if (inLand(x, y) && BA.eD[cellAt(x, y)] >= 150) break; }
    const q = nearestCell(P, x, y); return { x: q[0], y: q[1], kind: 'main' }; }); }
function placeAttractors(){ const nm = v('nMain'), ns = v('nSec');
  if (AMODE === 'hand'){ ATTR = HAND || ATTR; HAND = ATTR; }   // (v8) by hand: kept as placed (at first, the ones already there)
  else if (AMODE === 'edge') ATTR = onEdge(v('nEdge'));
  else if (AMODE === 'centre') ATTR = centreN(nm);
  else if (AMODE === 'corners') ATTR = cornersN(nm);
  else if (AMODE === 'spread') ATTR = spreadOut(nm, ns);
  else if (AMODE === 'sketch'){ const mm = SKETCH_MAIN.slice(0, nm).map(p => ({ x: p[0] - OX, y: p[1] - OY, kind: 'main' }));
    // the secondary ones stay at the calm points only where they are at least 600 m from both main ones (none were drawn)
    ATTR = mm.concat(D.attract.sec.slice(0, ns).filter(p => mm.every(a => Math.hypot(p[0] - a.x, p[1] - a.y) >= 600)).map(p => ({ x: p[0], y: p[1], kind: 'sec' }))); }
  else ATTR = calmN(nm).concat(D.attract.sec.slice(0, ns).map(p => ({ x: p[0], y: p[1], kind: 'sec' })));
  $('rMain').style.display = ['edge', 'hand'].includes(AMODE) ? 'none' : ''; $('rSec').style.display = ['calm', 'sketch', 'spread'].includes(AMODE) ? '' : 'none'; $('rEdge').style.display = AMODE === 'edge' ? '' : 'none'; }
let PC, PS, OC_, OS_, CONF, CLAR, UNDERIMG = null;
// (v7) the watercourses here are field drains: they no longer steer the streets (they made streets run along a drain and stop
// at it, leaving ground empty); streets still cross them square, on culverts (tryCulvert)
const STREAM_W = 0.0;
function buildTarget(){ buildCorridors();
  // (v8.8) the climate: streets along the summer wind where it blows (wSum), across the winter cold where it bites (wWin)
  const ENV_ = window.__TS.D.env, st = ENV_ && ENV_.stats, wsum = st ? v('wSum') : 0, wwin = st ? v('wWin') : 0;
  const wc = v('wC'), ww = $('windOn').checked ? v('wWind') : 0, tot = (wc + ww + wsum + wwin) || 1, pc = { contour: wc };
  // the parts kept apart as well as summed: the contour (1); the other forces, the wind, the attractors and the streams (2);
  // the land's edge (0, in the sum only)
  const C = new Float32Array(N), S = new Float32Array(N), Wt = new Float32Array(N).fill(1e-6);
  const cC = new Float32Array(N), cS = new Float32Array(N), oC = new Float32Array(N), oS = new Float32Array(N);
  const add = (i, t, w, part) => { const c2 = w * Math.cos(2 * t), s2 = w * Math.sin(2 * t); C[i] += c2; S[i] += s2; Wt[i] += w;
    if (part === 1){ cC[i] += c2; cS[i] += s2; } else if (part === 2){ oC[i] += c2; oS[i] += s2; } };
  if (pc.contour > 0){ const f = pc.contour / tot; for (let i = 0; i < N; i++) add(i, BA.cA[i], BA.cW[i] * f, 1); }
  // the wind of the month: each direction by its share of the hours x its speed squared (pressure), against the year's
  // total, so a calm month pulls less; strongest on the side it comes in (baked per direction)
  if (ww > 0){ const M = YEAR[MONTH], f = ww / tot;
    for (let d = 0; d < 8; d++){ const k = DIRS[d], a = M.share[d] * M.v[d] * M.v[d] / YSUM; if (a < 1e-4) continue;
      const t = axisOf(k.frm, k.job), c2 = Math.cos(2 * t), s2 = Math.sin(2 * t);
      for (let i = 0; i < N; i++){ const w = k.S[i] * a * f; C[i] += w * c2; S[i] += w * s2; Wt[i] += w; oC[i] += w * c2; oS[i] += w * s2; } } }
  // (v8.8) summer air: each direction by its share of the summer's wind energy, strongest where that wind comes in (S), streets
  // along it; winter cold: the cold directions by their share of the winter's cold energy, streets across them
  if (wsum > 0 || wwin > 0){ const eS = st.summerEnergy, eW = st.winterColdEnergy, sS = eS.reduce((a, b) => a + b, 0) || 1, sW = eW.reduce((a, b) => a + b, 0) || 1;
    for (let d = 0; d < 8; d++){ const k = DIRS[d], aS = wsum / tot * eS[d] / sS, aW = wwin / tot * eW[d] / sW; if (aS < 1e-4 && aW < 1e-4) continue;
      const tS = axisOf(k.frm, 'along'), tW = axisOf(k.frm, 'across');
      for (let i = 0; i < N; i++){ const sp = k.S[i]; if (sp < 1e-3) continue; if (aS > 1e-4) add(i, tS, sp * aS, 2); if (aW > 1e-4) add(i, tW, sp * aW, 2); } } }
  // (v8.8) along the corridors: a waterside street follows the corridor's axis, within about 60 m of it
  if (GZ && v('wG') > 0){ const f = v('wG') / 100; for (let i = 0; i < N; i++){ const d = GD[i]; if (d > 90) continue; const w = f * Math.exp(-((d / 45) ** 2)); if (w > 1e-4) add(i, GA[i], w, 2); } }
  // (v8.5) flood risk: where water would run, the streets run with the flow (downhill, across the contour): drainage corridors
  if (floodOn() && v('fW') > 0){ const f = v('fW') / 100, W_ = floodWeights(); for (let i = 0; i < N; i++){ const w = W_[i] * f * Math.min(1.5, BA.cW[i]); if (w > 1e-4) add(i, BA.cA[i] + PI / 2, w, 2); } }
  for (let i = 0; i < N; i++){ add(i, BA.eA[i], 0.6 * Math.exp(-((BA.eD[i] / 80) ** 2)), 0); add(i, BA.sA[i], STREAM_W * Math.exp(-((BA.sD[i] / 70) ** 2)), 2); if (BA.rA) add(i, BA.rA[i], 0.9 * Math.exp(-((BA.rD[i] / 90) ** 2)), 2); }
  for (const a of attractorsOn()){ const R = Math.ceil(a.reach * 2.6 / cell), c0 = Math.round(a.x / cell), r0 = Math.round(a.y / cell);
    for (let r = Math.max(0, r0 - R); r <= Math.min(ny - 1, r0 + R); r++) for (let c = Math.max(0, c0 - R); c <= Math.min(nx - 1, c0 + R); c++){
      const dx = c * cell - a.x, dy = r * cell - a.y, w = a.pull * Math.exp(-(dx * dx + dy * dy) / (a.reach * a.reach)); if (w > 1e-4) add(r * nx + c, Math.atan2(dy, dx) + PI / 2, w, 2); } }
  const sg = v('smooth') / cell; TC = blur(C, sg); TS = blur(S, sg); TW = blur(Wt, sg); PC = blur(cC, sg); PS = blur(cS, sg); OC_ = blur(oC, sg); OS_ = blur(oS, sg);
  // what the field says about itself: clarity, how strongly one direction rules (|sum| / sum of weights); conflict, the
  // contour against the other forces: sin^2 of the angle between their directions x the balance of their strengths
  CLAR = new Float32Array(N); CONF = new Float32Array(N);
  for (let i = 0; i < N; i++){ CLAR[i] = Math.min(1, Math.hypot(TC[i], TS[i]) / TW[i]); const a1 = Math.hypot(PC[i], PS[i]), a2 = Math.hypot(OC_[i], OS_[i]);
    if (a1 > 1e-9 && a2 > 1e-9) CONF[i] = (1 - (PC[i] * OC_[i] + PS[i] * OS_[i]) / (a1 * a2)) / 2 * Math.min(a1, a2) / Math.max(a1, a2); }
  if (!CC){ CC = new Float32Array(N); CS = new Float32Array(N); CWt = new Float32Array(N).fill(1); }
  MORPH = 1; CROSSIMG = null; FLINES = null; UNDERIMG = null; baseDirty = true; }
function morphStep(){ if (!MORPH) return; let diff = 0; const a = 0.12;
  for (let i = 0; i < N; i++){ const dc = TC[i] - CC[i], ds = TS[i] - CS[i], dw = TW[i] - CWt[i]; CC[i] += dc * a; CS[i] += ds * a; CWt[i] += dw * a; diff = Math.max(diff, Math.abs(dc) + Math.abs(ds)); }
  if (diff < 0.002){ MORPH = 0; } }
function sampleCS(Ca, Sa, x, y){ const fx = x / cell, fy = y / cell; if (fx < 0 || fy < 0 || fx >= nx - 1 || fy >= ny - 1) return null; const c = Math.floor(fx), r = Math.floor(fy), u = fx - c, w = fy - r;
  const i00 = r * nx + c, i01 = i00 + 1, i10 = i00 + nx, i11 = i10 + 1;
  return [(Ca[i00] * (1 - u) + Ca[i01] * u) * (1 - w) + (Ca[i10] * (1 - u) + Ca[i11] * u) * w, (Sa[i00] * (1 - u) + Sa[i01] * u) * (1 - w) + (Sa[i10] * (1 - u) + Sa[i11] * u) * w]; }
function fieldAtT(x, y){ const q = sampleCS(TC, TS, x, y); if (!q || q[0] * q[0] + q[1] * q[1] < 1e-12) return null; return 0.5 * Math.atan2(q[1], q[0]); }
function flowAt(x, y){ const q = sampleCS(CC, CS, x, y); if (!q) return null; const c = Math.floor(x / cell), r = Math.floor(y / cell), w = CWt[r * nx + c] || 1; return [0.5 * Math.atan2(q[1], q[0]), Math.min(1, Math.hypot(q[0], q[1]) / w)]; }

/* ------------------------------------------------------------------ the streets: a growth simulation (generators) */
let LINES = [], HASH = new Map(), CULVERTS = [], GROW = null, GEN = null, GROWING = false, STEPS = 0, PHASE = '', CELLS = null, CELLIMG = null, FINISHED = false;
// (v8.7) the process mode drives the growth from outside: PROC.stopAt(phase) pauses the generator at a phase boundary, PROC.record()
// is called once a frame while it grows, PROC.onStop / PROC.onDone when it pauses or ends; SCRUB (a recorded frame) draws the net as it was
let PROC = null, PH0 = '', SCRUB = null;
const HC = 20, hk = (x, y) => Math.floor(x / HC) + ',' + Math.floor(y / HC);
// (v7) the circus: the radius of its street's centre line (45 m: 90 m across, 105 m over its outer edge); and ring streets
// round each whole circus, each {r: radius of its centre line, level: 1 main / 2 second} (none by default)
var CIRCUS_R = 45, RINGS = [];
function addLine(l){ l.id = LINES.length; LINES.push(l); const Pp = l.pts;
  for (let k = 0; k < Pp.length; k++){ const a = Pp[Math.max(0, k - 1)], b = Pp[Math.min(Pp.length - 1, k + 1)], dx = b[0] - a[0], dy = b[1] - a[1], n = Math.hypot(dx, dy) || 1, key = hk(Pp[k][0], Pp[k][1]);
    let bk = HASH.get(key); if (!bk){ bk = []; HASH.set(key, bk); } bk.push(Pp[k][0], Pp[k][1], l.id, dx / n, dy / n); } return l; }
function near(x, y, d, dir, par, levels, skip){ const r = Math.ceil(d / HC), cx = Math.floor(x / HC), cy = Math.floor(y / HC); let best = null;
  for (let i = -r; i <= r; i++) for (let j = -r; j <= r; j++){ const bk = HASH.get((cx + i) + ',' + (cy + j)); if (!bk) continue;
    for (let k = 0; k < bk.length; k += 5){ const lid = bk[k + 2]; if (lid === skip) continue; const L = LINES[lid]; if (L.dead || (levels && !levels.has(L.level))) continue;
      const dd = Math.hypot(bk[k] - x, bk[k + 1] - y); if (dd >= d) continue;
      if (dir){ const dot = Math.abs(bk[k + 3] * dir[0] + bk[k + 4] * dir[1]); if (par && dot < 0.75) continue; if (!par && dot > 0.6) continue; }
      if (!best || dd < best[0]) best = [dd, bk[k], bk[k + 1], lid, bk[k + 3], bk[k + 4]]; } }
  return best; }
function densify(pts, step){ const out = [pts[0]]; for (let i = 1; i < pts.length; i++){ const a = pts[i - 1], b = pts[i], n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / step));
    for (let k = 1; k <= n; k++) out.push([a[0] + (b[0] - a[0]) * k / n, a[1] + (b[1] - a[1]) * k / n]); } return out; }
function streamAngle(x, y){ const c = clamp(Math.round(x / cell), 0, nx - 1), r = clamp(Math.round(y / cell), 0, ny - 1), i = r * nx + c; return GZ && GZ[i] ? GA[i] : BA.sA[i]; }
// (v7) would a street going u cross the watercourse here at 30 degrees or more (on a culvert)?
function culvertOK(x, y, u){ let a = Math.abs((Math.atan2(u[1], u[0]) - streamAngle(x, y)) * 180 / PI) % 180; a = a > 90 ? 180 - a : a; return a >= 30; }
function tryCulvert(x, y, dx, dy){ let a = Math.abs((Math.atan2(dy, dx) - streamAngle(x + dx * 8, y + dy * 8)) * 180 / PI) % 180; a = a > 90 ? 180 - a : a; if (a < 30) return null;
  for (let s = 5; s <= 40; s += 5){ const qx = x + dx * s, qy = y + dy * s; if (!inLand(qx, qy)) return null; if (!inZone(qx, qy)){ CULVERTS.push({ x: (x + qx) / 2, y: (y + qy) / 2 }); return [qx, qy]; } } return null; }
function mergeTarget(hit, ux, uy, ahead){ const Pp = LINES[hit[3]].pts; let k = 0, bd = 1e18; for (let i = 0; i < Pp.length; i++){ const d = (Pp[i][0] - hit[1]) ** 2 + (Pp[i][1] - hit[2]) ** 2; if (d < bd){ bd = d; k = i; } }
  const a = Pp[Math.min(Pp.length - 1, k + 1)], b = Pp[Math.max(0, k - 1)], st = ((a[0] - b[0]) * ux + (a[1] - b[1]) * uy) >= 0 ? 1 : -1; let acc = 0;
  while (k + st >= 0 && k + st < Pp.length && acc < ahead){ acc += Math.hypot(Pp[k + st][0] - Pp[k][0], Pp[k + st][1] - Pp[k][1]); k += st; } return Pp[k]; }
function* traceGen(level, dsep, fams, seeds, o){
  const stopAt = o.stopAt || new Set(), stopOwn = o.stopOwn || 0, through = o.through || 0, merge = !!o.merge, nearK = o.nearK || 0.45, startK = o.startK ?? 0.8;
  const maxlen = o.maxlen || 6000, minlen = o.minlen || 40, spread = o.spread !== false; let rs = o.seed || 1; const rnd = () => { rs = (rs * 16807) % 2147483647; return rs / 2147483647; };
  const Q = seeds.slice(); let qi = 0, tries = 0;
  while (qi < Q.length && tries++ < 40000 && LINES.length < 6000){
    const [sx, sy, fam] = Q[qi++]; if (!fams.includes(fam) || !inLand(sx, sy) || inZone(sx, sy)) continue;
    const t0 = fieldAtT(sx, sy); if (t0 === null) continue; const d0 = [Math.cos(t0 + fam * PI / 2), Math.sin(t0 + fam * PI / 2)];
    if (near(sx, sy, dsep * startK, d0, true, new Set([level]), -1)) continue;
    const lid = LINES.length, own = rnd() < stopOwn, over = rnd() < through, halves = [], ends = [];
    for (const sg of [1, -1]){ const pts = []; let prev = [d0[0] * sg, d0[1] * sg], x = sx, y = sy, L = 0, why = 'len';
      GROW = { level, h0: halves[0] || null, cur: pts, seed: [sx, sy] };
      while (L < maxlen){ const t = fieldAtT(x, y); if (t === null){ why = 'flat'; break; }
        const a = t + fam * PI / 2; let dx = Math.cos(a), dy = Math.sin(a); if (dx * prev[0] + dy * prev[1] < 0){ dx = -dx; dy = -dy; }
        const nx_ = x + dx * 5, ny_ = y + dy * 5;
        if (!inLand(nx_, ny_)){ why = 'edge'; break; }
        if (inZone(nx_, ny_)){ const far = tryCulvert(x, y, dx, dy); if (!far){ why = 'bank'; break; } pts.push(far); x = far[0]; y = far[1]; L += Math.hypot(far[0] - nx_, far[1] - ny_) + 5; prev = [dx, dy]; yield 1; continue; }
        if (stopAt.size || own){ const lv = new Set(stopAt); if (own) lv.add(level); const c = near(nx_, ny_, 6, [dx, dy], false, lv, lid);
          if (c){ const higher = LINES[c[3]].level < level; if ((higher && !over) || (!higher && L > dsep * 0.3)){ pts.push([c[1], c[2]]); why = 'T'; LINES[c[3]].hits = (LINES[c[3]].hits || 0) + 1; break; } } }
        const hit = near(nx_, ny_, dsep * nearK, [dx, dy], true, new Set([level]), lid);
        if (hit){ if (merge && L > dsep * 0.5){ let ux = hit[4], uy = hit[5]; if (ux * dx + uy * dy < 0){ ux = -ux; uy = -uy; } const tg = mergeTarget(hit, ux, uy, dsep * 0.8), cxp = x + dx * dsep * 0.4, cyp = y + dy * dsep * 0.4; why = 'Y'; LINES[hit[3]].hits = (LINES[hit[3]].hits || 0) + 1;
            for (let k = 1; k <= 8; k++){ const s = k / 8, bx = (1 - s) * (1 - s) * x + 2 * (1 - s) * s * cxp + s * s * tg[0], by = (1 - s) * (1 - s) * y + 2 * (1 - s) * s * cyp + s * s * tg[1];
              if (!inLand(bx, by) || inZone(bx, by)){ why = 'near'; break; } pts.push(k === 8 ? [tg[0], tg[1]] : [bx, by]); } }
          else why = 'near'; break; }
        pts.push([nx_, ny_]); prev = [dx, dy]; x = nx_; y = ny_; L += 5; STEPS++; yield 1; }
      halves.push(pts); ends.push(why); }
    GROW = null;
    const Pp = halves[1].reverse().concat([[sx, sy]], halves[0]); if (Pp.length < 3) continue;
    let Ln = 0; for (let k = 1; k < Pp.length; k++) Ln += Math.hypot(Pp[k][0] - Pp[k - 1][0], Pp[k][1] - Pp[k - 1][1]); if (Ln < minlen) continue;
    addLine({ level, fam, pts: Pp, ends });
    if (spread){ let acc = 0; for (let k = 1; k < Pp.length; k++){ acc += Math.hypot(Pp[k][0] - Pp[k - 1][0], Pp[k][1] - Pp[k - 1][1]); if (acc >= dsep * 0.6){ acc = 0;
        const dx = Pp[k][0] - Pp[k - 1][0], dy = Pp[k][1] - Pp[k - 1][1], n = Math.hypot(dx, dy) || 1, ax = -dy / n, ay = dx / n;
        Q.push([Pp[k][0] + ax * dsep, Pp[k][1] + ay * dsep, fam], [Pp[k][0] - ax * dsep, Pp[k][1] - ay * dsep, fam], [Pp[k][0], Pp[k][1], 1 - fam]); } } }
    yield 1; } }
function gridSeeds(sp, fams, onlyWide){ const out = []; for (let x = sp / 2; x < D.w; x += sp) for (let y = sp / 2; y < D.h; y += sp){ if (!inLand(x, y)) continue;
    if (onlyWide && !D.pieces.some(p => p.wide && inRing([x, y], p.outer))) continue; for (const f of fams) out.push([x, y, f]); } return out; }
function anchorSeeds(){ const out = []; for (const a of D.anchors) for (const p of D.pieces){ if (p.parcel !== a.parcel) continue; const q = nearestOnRing(p.outer, a.x, a.y); if (q.d > 150) continue;
    let nxv = -q.ty, nyv = q.tx; if (!inLand(q.x + nxv * 20, q.y + nyv * 20)){ nxv = -nxv; nyv = -nyv; } if (!inLand(q.x + nxv * 20, q.y + nyv * 20)) continue;
    const sx = q.x + nxv * 12, sy = q.y + nyv * 12, t = fieldAtT(sx, sy); out.push([sx, sy, (t !== null && Math.abs(Math.cos(t) * nxv + Math.sin(t) * nyv) >= 0.35) ? 0 : 1]); } return out; }
function curve(a, d, b){ const L = Math.hypot(b[0] - a[0], b[1] - a[1]), cx = a[0] + d[0] * L * 0.4, cy = a[1] + d[1] * L * 0.4, out = [];
  for (let k = 1; k <= 10; k++){ const s = k / 10; out.push([(1 - s) * (1 - s) * a[0] + 2 * (1 - s) * s * cx + s * s * b[0], (1 - s) * (1 - s) * a[1] + 2 * (1 - s) * s * cy + s * s * b[1]]); } return out; }
function cutBack(l, side, levels){ const Pp = l.pts; const idx = side === 0 ? [...Array(Pp.length).keys()].reverse() : [...Array(Pp.length).keys()];
  for (const k of idx.slice(1)){ if (near(Pp[k][0], Pp[k][1], 4, null, false, levels || null, l.id)){ if (side === 0) l.pts = Pp.slice(0, k + 1); else l.pts = Pp.slice(k); l.ends[side] = 'T'; return; } }
  l.dead = true; }
function* closeGen(){ PHASE = 'every end meets a street';
  for (let lid = 0; lid < LINES.length; lid++){ const l = LINES[lid]; if (l.level === 0 || l.dead) continue;
    for (const side of [0, 1]){ const Pp = l.pts, why = l.ends[side]; if (why === 'T' || why === 'Y' || why === 'J' || why === 'ring') continue; const end = side === 0 ? Pp[Pp.length - 1] : Pp[0];
      // (in B, a street stopped for running alongside another is cut back to its last junction, never extended alongside it)
      if (MODE === 'B' && why === 'near'){ cutBack(l, side); yield 1; continue; }
      if (why === 'edge'){ const c = near(end[0], end[1], 25, null, false, new Set([0, 1]), lid); if (c){ if (MODE === 'B') endOn(l, [c[1], c[2]], side); if (side === 0) l.pts.push([c[1], c[2]]); else l.pts.unshift([c[1], c[2]]); l.ends[side] = 'T'; } continue; }
      // (in B the heading comes from a point at least 3 m back: an end can repeat or step back on its last point)
      let pv = side === 0 ? Pp[Pp.length - 2] : Pp[1]; if (MODE === 'B') for (let k = 1; k < Pp.length; k++){ const q = side === 0 ? Pp[Pp.length - 1 - k] : Pp[k]; if (Math.hypot(q[0] - end[0], q[1] - end[1]) >= 3){ pv = q; break; } }
      let dx = end[0] - pv[0], dy = end[1] - pv[1]; const n = Math.hypot(dx, dy) || 1; dx /= n; dy /= n;
      let x = end[0], y = end[1], L = 0, ext = [], hit = null;
      while (L < 220){ const t = fieldAtT(x, y); if (t !== null){ for (const a of [t, t + PI / 2]){ const ux = Math.cos(a), uy = Math.sin(a); if (ux * dx + uy * dy >= 0.7){ dx = ux; dy = uy; break; } if (-ux * dx - uy * dy >= 0.7){ dx = -ux; dy = -uy; break; } } }
        const px = x, py = y; x += dx * 5; y += dy * 5; L += 5; if (!inLand(x, y)) break;
        if (inZone(x, y)){ const far = tryCulvert(px, py, dx, dy); if (!far){ x = px; y = py; break; } x = far[0]; y = far[1]; L += Math.hypot(far[0] - px, far[1] - py); ext.push([x, y]); continue; }   // (v8.8) across a corridor square-ish, or not at all
        const c = near(x, y, 6.5, null, false, null, lid); if (c){ hit = [c[1], c[2]]; LINES[c[3]].hits = (LINES[c[3]].hits || 0) + 1; break; } ext.push([x, y]); }
      if (hit) ext.push(hit); else { let c = near(end[0], end[1], 120, null, false, null, lid); if (c && MODE === 'B' && (c[1] - end[0]) * dx + (c[2] - end[1]) * dy < 0.5 * c[0]) c = null; ext = c ? curve(end, [dx, dy], [c[1], c[2]]) : null; if (ext && ext.some(q => inZone(q[0], q[1]))) ext = null; if (c) LINES[c[3]].hits = (LINES[c[3]].hits || 0) + 1; }
      if (ext){ if (side === 0) Pp.push(...ext); else Pp.unshift(...ext.reverse()); l.ends[side] = 'T'; } else cutBack(l, side);
      yield 1; } }
  netDirty = true; widthDirty = true; }
function* growAll(){
  resetNet();
  const d1 = v('d1'), d2 = v('d2');
  PHASE = 'main streets from your anchors';
  yield* traceGen(1, d1, [0, 1], anchorSeeds(), { stopAt: new Set([0, 1]), merge: true, nearK: 0.3, startK: 0.05, through: 0.3, seed: 11, minlen: 30, spread: false });
  PHASE = 'main streets along the contours';
  yield* traceGen(1, d1, [0], gridSeeds(d1, [0], true), { stopAt: new Set([0]), merge: true, nearK: 0.45, startK: 0.75, through: 1.0, seed: 12, minlen: 120 });
  PHASE = 'second streets';
  const along = []; for (const l of LINES){ if (l.level > 1) continue; let acc = 0; const Pp = l.pts; for (let k = 1; k < Pp.length; k++){ acc += Math.hypot(Pp[k][0] - Pp[k - 1][0], Pp[k][1] - Pp[k - 1][1]); if (acc >= d2){ acc = 0;
        const dx = Pp[k][0] - Pp[k - 1][0], dy = Pp[k][1] - Pp[k - 1][1], n = Math.hypot(dx, dy) || 1; for (const sg of [1, -1]) for (const f of [0, 1]) along.push([Pp[k][0] - dy / n * 14 * sg, Pp[k][1] + dx / n * 14 * sg, f]); } } }
  yield* traceGen(2, d2, [0, 1], along.concat(gridSeeds(d2, [0, 1], false)), { stopAt: new Set([0, 1, 2]), stopOwn: v('stag') / 100, merge: $('merge').checked, through: v('thru') / 100, seed: 13, minlen: 35 });
  yield* closeGen();
  PHASE = 'done'; FINISHED = true; readCells(); measures(); finishRun(); }
function inLandNoHoles(x, y){ return D.pieces.some(p => inRing([x, y], p.outer) && !p.holes.some(h => inRing([x, y], h))); }
function start(animated){ GEN = MODE === 'B' ? growBranching() : growAll(); GROWING = true; if (!animated){ runAll(); } }
function runAll(){ if (!GEN) return; let r; do { r = GEN.next(); } while (!r.done); GEN = null; GROWING = false; }
function resetNet(){
  LINES = []; HASH = new Map(); CULVERTS = []; BRIDGES = []; STEPS = 0; CELLS = null; CELLIMG = null; FINISHED = false; netDirty = true; widthDirty = true; GROW = null;
  TIPS = []; TIPMAP = new Map(); EVENTS = []; BUDS = []; METR = null; NODES = new Map(); MNODES = new Map();
  HOLES = attractorsOn().filter(a => a.main && a.pull >= 2).filter(a => a.edge || [0, 1, 2, 3].every(k => inLandNoHoles(a.x + 60 * Math.cos(k * PI / 2), a.y + 60 * Math.sin(k * PI / 2)))).map(a => ({ x: a.x, y: a.y, r: CIRCUS_R, edge: !!a.edge }));
  buildMask();
  // (v7) the land's edge in two kinds: a wool road's edge (streets meet it) and a shore, of water or the station ring (they do not)
  if (D.edges){ for (const r of D.edges.road) addLine({ level: 0, fam: 0, pts: densify(r, 4), ends: ['edge', 'edge'], ring: true, hole: false });
    for (const r of (D.edges.shared || [])) addLine({ level: 0, fam: 0, pts: densify(r, 4), ends: ['edge', 'edge'], ring: true, hole: false, shared: true });
    for (const r of D.edges.shore) addLine({ level: 0, fam: 0, pts: densify(r, 4), ends: ['edge', 'edge'], ring: true, hole: true }); }
  else for (const p of D.pieces){ for (const r of [p.outer, ...p.holes]) addLine({ level: 0, fam: 0, pts: densify(r, 4), ends: ['edge', 'edge'], ring: true, hole: r !== p.outer }); }
  // (v8.5) a flood zone kept clear is a shore, as water is: its edge inside the land, which streets follow or stop at
  { const fa = floodAvoid(); if (fa) for (const ring of FLOOD.zones[fa] || []){ const pts = densify(ring, 4), ins = pts.map(p => inLandNoHoles(p[0], p[1]));
      if (ins.every(Boolean)){ addLine({ level: 0, fam: 0, pts, ends: ['edge', 'edge'], ring: true, hole: true, flood: true }); continue; } if (!ins.some(Boolean)) continue;
      const k0 = ins.indexOf(false), Pq = pts.slice(0, -1), Iq = ins.slice(0, -1), Rq = Pq.slice(k0).concat(Pq.slice(0, k0)), Jq = Iq.slice(k0).concat(Iq.slice(0, k0)); let run = [];
      const flush = () => { if (run.length > 3) addLine({ level: 0, fam: 0, pts: run, ends: ['edge', 'edge'], hole: true, flood: true }); run = []; };
      Rq.forEach((p, k) => { if (Jq[k]) run.push(p); else flush(); }); flush(); } }
  for (const h of HOLES){ const ring = []; for (let k = 0; k <= 48; k++) ring.push([h.x + h.r * Math.cos(k * PI / 24), h.y + h.r * Math.sin(k * PI / 24)]);
    const pts = densify(ring, 4), ins = pts.map(p => inLandNoHoles(p[0], p[1])), k0 = ins.indexOf(false);
    if (!h.edge || k0 < 0){ addLine({ level: 1, fam: 0, pts, ends: ['ring', 'ring'], circus: true }); continue; }
    // on the edge: the part of the ring inside the land, a half circus whose ends meet the edge road
    const Pq = pts.slice(0, -1), Iq = ins.slice(0, -1), Rq = Pq.slice(k0).concat(Pq.slice(0, k0)), Jq = Iq.slice(k0).concat(Iq.slice(0, k0)); let run = [];
    const flush = () => { if (run.length > 3) addLine({ level: 1, fam: 0, pts: run, ends: ['edge', 'edge'], circus: true, arc: true }); run = []; };
    Rq.forEach((p, k) => { if (Jq[k]) run.push(p); else flush(); }); flush(); } }

/* ------------------------------------------------------------------ mode B: branching growth (Experimental Growth Mode v1)
   Main streets start at your anchors and grow inward, 5 m a step, all at once. Each turns toward the field's axis nearest
   its heading by k = 0.10 + 0.30 x clarity a step (quickly where one direction rules, slowly where the parts cancel). As
   it grows it puts out side streets, one side then the other, d2 x (0.65 + 0.9 x clarity) apart. Where the contour and the
   other forces disagree, it forks into their two directions (a Y), each arm following its own part for a while. A street
   stops where it meets another: square on, a T; at a shallow angle (under 55 degrees), it merges (a Y); head on, the two
   become one street. No fixed shares of T, Y or X: they come out of the growth. */
let MODE = 'A', TIPS = [], TIPMAP = new Map(), EVENTS = [], BUDS = [], SNAP = { A: null, B: null }, UNDER = 'zones';
const B_IDS = ['bMem', 'bGap', 'bFork', 'mMethod'], LV0 = new Set([0]), LV1 = new Set([1]), LV01 = new Set([0, 1]), LV012 = new Set([0, 1, 2]);
function gridAt(a, x, y){ return a ? a[cellAt(x, y)] : 0; }
function partAxis(Ca, Sa, x, y){ const q = sampleCS(Ca, Sa, x, y); if (!q || Math.hypot(q[0], q[1]) < 1e-9) return null; return 0.5 * Math.atan2(q[1], q[0]); }
// of the two axes of a cross (t, t + 90 degrees), the one nearest a heading, pointing the heading's way
function nearestAxis(t, hx, hy){ let best = null, bd = -1; for (const a of [t, t + PI / 2]){ let ux = Math.cos(a), uy = Math.sin(a), d = ux * hx + uy * hy; if (d < 0){ ux = -ux; uy = -uy; d = -d; } if (d > bd){ bd = d; best = [ux, uy]; } } return best; }
function nearB(x, y, d, own, ign, dir, par, levels){ const r = Math.ceil(d / HC), cx = Math.floor(x / HC), cy = Math.floor(y / HC); let best = null;
  for (let i = -r; i <= r; i++) for (let j = -r; j <= r; j++){ const bk = HASH.get((cx + i) + ',' + (cy + j)); if (!bk) continue;
    for (let k = 0; k < bk.length; k += 5){ const lid = bk[k + 2]; if (lid === own || (ign.length && ign.includes(lid))) continue; const L = LINES[lid]; if (L.dead || (levels && !levels.has(L.level))) continue;
      const dd = Math.hypot(bk[k] - x, bk[k + 1] - y); if (dd >= d) continue;
      if (dir){ const dot = Math.abs(bk[k + 3] * dir[0] + bk[k + 4] * dir[1]); if (par && dot < 0.75) continue; if (!par && dot > 0.6) continue; }
      if (!best || dd < best[0]) best = [dd, bk[k], bk[k + 1], lid, bk[k + 3], bk[k + 4]]; } }
  return best; }
// every junction made so far (a street's start or end on another, a fork, a merge, a crossroads), on a 30 m hash: no new
// junction is made within a few tens of metres of one (no bundles); a street ending close to one ends on it
let NODES = new Map(), MNODES = new Map();   // MNODES: the junctions of main streets with main streets
function addNode(x, y, main){ for (const H of main ? [NODES, MNODES] : [NODES]){ const k = Math.floor(x / 30) + ',' + Math.floor(y / 30); let b = H.get(k); if (!b){ b = []; H.set(k, b); } b.push(x, y); } }
// a junction of main streets straight ahead (within 60 m, 30 degrees either side): a main street steers round it
function mainNodeAhead(x, y, hx, hy){ const cx = Math.floor(x / 30), cy = Math.floor(y / 30); let best = null;
  for (let i = -2; i <= 2; i++) for (let j = -2; j <= 2; j++){ const b = MNODES.get((cx + i) + ',' + (cy + j)); if (!b) continue;
    for (let k = 0; k < b.length; k += 2){ const vx = b[k] - x, vy = b[k + 1] - y, d = Math.hypot(vx, vy); if (d < 8 || d > 60 || vx * hx + vy * hy < d * 0.866) continue; if (!best || d < best[0]) best = [d, b[k], b[k + 1]]; } }
  return best; }
function nearNode(x, y, r){ const cx = Math.floor(x / 30), cy = Math.floor(y / 30), n = Math.ceil(r / 30); let best = null;
  for (let i = -n; i <= n; i++) for (let j = -n; j <= n; j++){ const b = NODES.get((cx + i) + ',' + (cy + j)); if (!b) continue; for (let k = 0; k < b.length; k += 2){ const d = Math.hypot(b[k] - x, b[k + 1] - y); if (d < r && (!best || d < best[0])) best = [d, b[k], b[k + 1]]; } }
  return best; }
function hashPt(l, p, dx, dy){ const key = hk(p[0], p[1]); let bk = HASH.get(key); if (!bk){ bk = []; HASH.set(key, bk); } bk.push(p[0], p[1], l.id, dx, dy); }
function newLine(level, pts, ux, uy, born){ const l = { id: LINES.length, level, fam: 0, pts: [], ends: ['open', born === 'fork' ? 'Y' : 'T'], born, kids: 0 }; LINES.push(l);
  for (const p of pts){ l.pts.push(p); hashPt(l, p, ux, uy); } return l; }
function newTip(l, x, y, hx, hy, o){ const t = Object.assign({ l, x, y, hx, hy, level: l.level, L: 0, acc: 0, fAcc: 0, side: l.id % 2 ? 1 : -1, follow: '', fLeft: 0, ig: [] }, o || {});
  TIPS.push(t); TIPMAP.set(l.id, t); return t; }
// end a street exactly on a point: first drop its last steps that went past the point (side 0: the end, 1: the start)
function endOn(l, q, side){ const P = l.pts;
  if (side === 1){ while (P.length > 2 && (q[0] - P[0][0]) * (P[0][0] - P[1][0]) + (q[1] - P[0][1]) * (P[0][1] - P[1][1]) < 0){ unhash(l, 0, 1); P.shift(); } }
  else { while (P.length > 2){ const a = P[P.length - 1], b = P[P.length - 2]; if ((q[0] - a[0]) * (a[0] - b[0]) + (q[1] - a[1]) * (a[1] - b[1]) >= 0) break; unhash(l, P.length - 1); P.pop(); } } }
function push(tp, p){ tp.l.pts.push(p); hashPt(tp.l, p, tp.hx, tp.hy); tp.x = p[0]; tp.y = p[1]; }
// take points of a street out of the lookup (when it is cut back), so nothing later ends on what is no longer there
function unhash(l, from, to){ for (let i = from; i < (to === undefined ? l.pts.length : to); i++){ const p = l.pts[i], bk = HASH.get(hk(p[0], p[1])); if (!bk) continue;
    for (let k = bk.length - 5; k >= 0; k -= 5) if (bk[k + 2] === l.id && bk[k] === p[0] && bk[k + 1] === p[1]) bk.splice(k, 5); } }
// cut a street back from one end (0: its last point, 1: its first) to its last junction, a point on another street,
// ending exactly on that point; with no junction left it goes
function trimEnd(l, side){ const P = l.pts, n = P.length, idx = side === 0 ? [...Array(Math.max(0, n - 1)).keys()].reverse() : [...Array(n).keys()].slice(1);
  for (const k of idx){ const c = near(P[k][0], P[k][1], 4, null, false, null, l.id); if (!c) continue; const off = Math.hypot(c[1] - P[k][0], c[2] - P[k][1]) > 0.3;
    if (side === 0){ unhash(l, k + 1); l.pts = P.slice(0, k + 1); endOn(l, [c[1], c[2]], 0); if (off){ l.pts.push([c[1], c[2]]); hashPt(l, [c[1], c[2]], 0, 0); } }
    else { unhash(l, 0, k); l.pts = P.slice(k); endOn(l, [c[1], c[2]], 1); if (off){ l.pts.unshift([c[1], c[2]]); hashPt(l, [c[1], c[2]], 0, 0); } }
    l.ends[side] = 'T'; if (plen(l.pts) < 1){ unhash(l, 0); l.dead = true; } return true; }
  unhash(l, 0); l.dead = true; return false; }
// every street stopped for running alongside another goes back to its last junction (its own side streets stay on it),
// repeated until nothing changes
function tidyNear(){ for (let pass = 0; pass < 8; pass++){ let changed = false;
    for (const l of LINES){ if (l.dead || l.level === 0 || l.circus) continue; for (const side of [0, 1]) if (!l.dead && l.ends[side] === 'near'){ trimEnd(l, side); changed = true; } }
    if (!changed) break; } }
// carry an end on along the field (turning no more than a street may) to the next street within maxL, ahead of it; not if it
// would run alongside a street on the way
function extendEnd(l, side, maxL, levels){ const P = l.pts; if (P.length < 2) return false; const e = side === 0 ? P[P.length - 1] : P[0];
  // the street's heading at that end, from a point at least 3 m back (an end can repeat its last point)
  let pv = null; for (let k = 1; k < P.length; k++){ const q = side === 0 ? P[P.length - 1 - k] : P[k]; if (Math.hypot(q[0] - e[0], q[1] - e[1]) >= 3){ pv = q; break; } } if (!pv) return false;
  let hx = e[0] - pv[0], hy = e[1] - pv[1]; const hn = Math.hypot(hx, hy); if (hn < 1e-6) return false; hx /= hn; hy /= hn; const mt = (l.level === 1 ? 5 : 9) * PI / 180, alongR = l.level === 1 && levels ? v('d1') * 0.3 : 48;
  let x = e[0], y = e[1], turned = 0; const ext = []; let hit = null;
  for (let L = 0; L < maxL && !hit; L += 5){ const t = fieldAtT(x, y); let ux = hx, uy = hy;
    if (t !== null){ const a = nearestAxis(t, hx, hy); ux = hx * 0.7 + a[0] * 0.3; uy = hy * 0.7 + a[1] * 0.3; const un = Math.hypot(ux, uy) || 1; ux /= un; uy /= un; }
    let tr = Math.atan2(hx * uy - hy * ux, hx * ux + hy * uy); if (Math.abs(tr) > mt){ tr = Math.sign(tr) * mt; const a0 = Math.atan2(hy, hx) + tr; ux = Math.cos(a0); uy = Math.sin(a0); }
    turned += tr; if (Math.abs(turned) > PI / 3) return false;   // no curling round: 60 degrees in all at most
    const px = x, py = y; x += ux * 5; y += uy * 5; hx = ux; hy = uy; if (!inLand(x, y)) return false;
    if (inZone(x, y)){ const far = tryCulvert(px, py, ux, uy); if (!far) return false; x = far[0]; y = far[1]; ext.push([x, y]); continue; }
    const c = near(x, y, 6.5, null, false, levels || null, l.id); if (c){ hit = [c[1], c[2]]; break; }
    if (L > 15 && near(x, y, 48, [ux, uy], true, null, l.id) && !near(x, y, 48, [ux, uy], true, levels || null, l.id)) return false;   // a second street alongside
    if (L > 15){ const q = near(x, y, alongR, [ux, uy], true, levels || null, l.id); if (q){
      // alongside a street: turn into it, short and steep (a T), if nothing is in the way; else give up
      let vx = q[4], vy = q[5]; if (vx * ux + vy * uy < 0){ vx = -vx; vy = -vy; } const tg = mergeTarget(q, vx, vy, q[0] * 0.35), bend = [];
      for (let k = 1; k <= 16; k++){ const s_ = k / 16, cx = x + ux * q[0] * 0.1, cy = y + uy * q[0] * 0.1, bx = (1 - s_) * (1 - s_) * x + 2 * (1 - s_) * s_ * cx + s_ * s_ * tg[0], by = (1 - s_) * (1 - s_) * y + 2 * (1 - s_) * s_ * cy + s_ * s_ * tg[1];
        if (!inLand(bx, by) || inZone(bx, by) || (k < 16 && nearB(bx, by, 5, l.id, [q[3]], null, false, null))) return false; bend.push(k === 16 ? [tg[0], tg[1]] : [bx, by]); }
      if ((tg[0] - x) * ux + (tg[1] - y) * uy < 0) return false; ext.push([x, y], ...bend.slice(0, -1)); hit = bend[bend.length - 1]; break; } }
    ext.push([x, y]); }
  if (!hit) return false; if (!ext.length) endOn(l, hit, side); ext.push(hit);
  if (side === 0) for (const p of ext){ P.push(p); hashPt(l, p, hx, hy); } else for (const p of ext){ P.unshift(p); hashPt(l, p, hx, hy); }
  l.ends[side] = 'T'; return true; }
// no open ends: an end on nothing carries on to the next street ahead (220 m), or goes back to its last junction
// two streets side by side (parallel within 20 degrees, closer than 40 m; 45 m for a main and a second street; 75 m for
// two main streets) for 60 m or more: the second street (or the shorter) loses that stretch, from the junction before it to
// the junction after it, so nothing is left hanging. Returns how many stretches went.
function sideRuns(){ const runs = new Map(), live = LINES.filter(l => !l.dead && l.level > 0 && !l.circus);
  for (const l of live){ const P = l.pts;
    for (let i = 1; i < P.length; i++){ const sl = Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]); if (sl < 0.5) continue;
      const x = P[i][0], y = P[i][1], ux = (P[i][0] - P[i - 1][0]) / sl, uy = (P[i][1] - P[i - 1][1]) / sl, cx = Math.floor(x / HC), cy = Math.floor(y / HC), seen = new Set();
      for (let a = -5; a <= 5; a++) for (let b = -5; b <= 5; b++){ const bk = HASH.get((cx + a) + ',' + (cy + b)); if (!bk) continue;
        for (let q = 0; q < bk.length; q += 5){ const lid = bk[q + 2]; if (lid === l.id || seen.has(lid)) continue; const L = LINES[lid]; if (L.dead || L.circus || L.level === 0) continue;
          const dd = Math.hypot(bk[q] - x, bk[q + 1] - y), Dm = (l.level === 1 && L.level === 1) ? 75 : (l.level === 1 || L.level === 1) ? 45 : 40; if (dd < 4 || dd > Dm) continue;
          if (Math.abs(bk[q + 3] * ux + bk[q + 4] * uy) < 0.94) continue; seen.add(lid); } }
      for (const lid of seen){ const k = l.id + ':' + lid; let e = runs.get(k); if (!e){ e = []; runs.set(k, e); } e.push(i); } } }
  const out = [];
  for (const [k, idx] of runs){ const [a, b] = k.split(':').map(Number), P = LINES[a].pts; let best = null, s0 = idx[0], prev = idx[0];
    // (a little stricter than the check: runs from 45 m, so whatever the check would count is cleaned)
    const close = (i0, i1) => { let L = 0; for (let i = i0 + 1; i <= i1; i++) L += Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]); if (L >= 45 && (!best || L > best[2])) best = [i0, i1, L]; };
    for (let j = 1; j < idx.length; j++){ if (idx[j] - prev > 4){ close(s0, prev); s0 = idx[j]; } prev = idx[j]; } close(s0, prev);
    if (best) out.push({ a, b, k0: best[0], k1: best[1], L: best[2] }); }
  return out; }
function cutSide(keepMains){ const runs = sideRuns(); let n = 0; const byPair = new Map(runs.map(r => [r.a + ':' + r.b, r])), done = new Set(), touched = new Set();
  for (const r of runs){ const A = LINES[r.a], B = LINES[r.b]; if (A.dead || B.dead || touched.has(r.a) || touched.has(r.b)) continue;   // (a street cut in this pass waits for the next) const uk = Math.min(r.a, r.b) + ':' + Math.max(r.a, r.b); if (done.has(uk)) continue; done.add(uk);
    // two halves of one street meeting end to end are one street
    const ends = L_ => [[L_.pts[0], L_.ends[1]], [L_.pts[L_.pts.length - 1], L_.ends[0]]];
    if (ends(A).some(([p, ea]) => ends(B).some(([q, eb]) => Math.hypot(p[0] - q[0], p[1] - q[1]) < 3 && (ea === 'J' || eb === 'J')))) continue;
    if (keepMains && A.level === 1 && B.level === 1 && !A.extended && !B.extended){ const pr_ = [A, B].filter(x => x.promoted), sh = plen(A.pts) <= plen(B.pts) ? A : B; if (!pr_.length && plen(sh.pts) >= 600) continue;
      const dm = pr_.length === 2 ? sh : pr_.length === 1 ? pr_[0] : sh; dm.level = 2; dm.promoted = false; touched.add(dm.id); n++; netDirty = widthDirty = true; continue; }
    const vic = A.level !== B.level ? (A.level > B.level ? A : B) : (A.extended && !B.extended) ? A : (B.extended && !A.extended) ? B : (plen(A.pts) <= plen(B.pts) ? A : B), oth = vic === A ? B : A;
    let rr = vic === A ? r : byPair.get(B.id + ':' + A.id);
    if (!rr){ // the stretch seen from the other street only: the victim's points nearest its two ends
      const nearestIdx = p => { let bi = 0, bd = 1e18; vic.pts.forEach((q, i) => { const d = (q[0] - p[0]) ** 2 + (q[1] - p[1]) ** 2; if (d < bd){ bd = d; bi = i; } }); return bi; };
      const i0 = nearestIdx(oth.pts[r.k0]), i1 = nearestIdx(oth.pts[r.k1]); rr = { k0: Math.min(i0, i1), k1: Math.max(i0, i1) }; }
    if (rr.k1 >= vic.pts.length) continue;
    const P = vic.pts, jn = i => i === 0 || i === P.length - 1 || !!near(P[i][0], P[i][1], 2, null, false, null, vic.id);
    let j0 = rr.k0; while (j0 > 0 && !jn(j0)) j0--; let j1 = rr.k1; while (j1 < P.length - 1 && !jn(j1)) j1++;
    if (j1 - j0 < 1) continue; touched.add(vic.id);
    const head = P.slice(0, j0 + 1), tail = P.slice(j1), e0 = vic.ends[0], e1 = vic.ends[1];
    unhash(vic, 0); vic.pts = head;
    if (head.length >= 2 && plen(head) >= 1){ for (let i = 0; i < head.length; i++){ const p0 = head[Math.max(0, i - 1)], p1 = head[Math.min(head.length - 1, i + 1)], dl = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]) || 1; hashPt(vic, head[i], (p1[0] - p0[0]) / dl, (p1[1] - p0[1]) / dl); } vic.ends = ['T', e1]; }
    else vic.dead = true;
    if (tail.length >= 2 && plen(tail) >= 1) addLine({ level: vic.level, fam: vic.fam, pts: tail, ends: [e0, 'T'], born: vic.born, promoted: vic.promoted, cut: true });
    n++; }
  netDirty = widthDirty = true; return n; }
// would this street, as a main street, run alongside another main street (parallel within 20 degrees, closer than 75 m)
// for 60 m or more?
function alongsideMain(l){ const P = l.pts; let run = 0;
  for (let i = 1; i < P.length; i++){ const sl = Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]); if (sl < 0.5) continue; const ux = (P[i][0] - P[i - 1][0]) / sl, uy = (P[i][1] - P[i - 1][1]) / sl, cx = Math.floor(P[i][0] / HC), cy = Math.floor(P[i][1] / HC); let hit = false;
    for (let a = -4; a <= 4 && !hit; a++) for (let b = -4; b <= 4 && !hit; b++){ const bk = HASH.get((cx + a) + ',' + (cy + b)); if (!bk) continue;
      for (let q = 0; q < bk.length; q += 5){ const L = LINES[bk[q + 2]]; if (L === l || L.dead || L.level !== 1 || L.circus) continue; const dd = Math.hypot(bk[q] - P[i][0], bk[q + 1] - P[i][1]); if (dd < 4 || dd > 75) continue; if (Math.abs(bk[q + 3] * ux + bk[q + 4] * uy) >= 0.94){ hit = true; break; } } }
    run = hit ? run + sl : 0; if (run >= 60) return true; }
  return false; }
// a main street that cannot reach a main street from this end: it is split at its last main junction (or the edge), the
// part beyond becoming a second street; everything on it stays on it
function splitDemote(l, side){ const P = l.pts, n = P.length, on1 = i => !!near(P[i][0], P[i][1], 2.5, null, false, LV01, l.id);
  let j = -1; if (side === 0){ for (let i = n - 2; i >= 1; i--) if (on1(i)){ j = i; break; } } else { for (let i = 1; i <= n - 2; i++) if (on1(i)){ j = i; break; } }
  if (j < 0){ l.level = 2; l.promoted = false; return; }
  const keep = side === 0 ? P.slice(0, j + 1) : P.slice(j), rest = side === 0 ? P.slice(j) : P.slice(0, j + 1);
  unhash(l, 0); l.pts = keep; for (let i = 0; i < keep.length; i++){ const a = keep[Math.max(0, i - 1)], b = keep[Math.min(keep.length - 1, i + 1)], dl = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1; hashPt(l, keep[i], (b[0] - a[0]) / dl, (b[1] - a[1]) / dl); }
  const ends = l.ends.slice(); l.ends[side] = 'T';
  if (rest.length >= 2 && plen(rest) >= 1) addLine({ level: 2, fam: l.fam, pts: rest, ends: side === 0 ? [ends[0], 'T'] : ['T', ends[1]], born: l.born, demoted: true });
  netDirty = widthDirty = true; }
// every main street ends on a main street, a circus or the edge: one that does not is split at its last main junction
// (repeated until nothing changes: a main street split can leave another ending on a second street)
function mainsFinal(){ if (!$('bMains').checked) return;
  for (let pass = 0; pass < 6; pass++){ rehashAll(); let n = 0;
    for (const l of LINES){ if (l.dead || l.level !== 1 || l.circus || l.pts.length < 2) continue;
      for (const side of [0, 1]){ const Pp = l.pts, e = side === 0 ? Pp[Pp.length - 1] : Pp[0]; if (near(e[0], e[1], 2.5, null, false, LV01, l.id) || Pp.slice(5, -5).some(q => Math.hypot(q[0] - e[0], q[1] - e[1]) < 2.5)) continue; splitDemote(l, side); n++; } }
    if (!n) break; } }
// no spikes: a point where a street turns back by more than 120 degrees within a few metres goes, unless another street
// ends on it (repeated duplicates go too)
function despike(){ let n = 0;
  for (const l of LINES){ if (l.dead || l.level === 0 || l.circus) continue; const P = l.pts; let changed = true, guard = 0;
    while (changed && P.length > 2 && guard++ < 50){ changed = false;
      for (let i = 1; i < P.length - 1; i++){ const ax = P[i][0] - P[i - 1][0], ay = P[i][1] - P[i - 1][1], bx = P[i + 1][0] - P[i][0], by = P[i + 1][1] - P[i][1], la = Math.hypot(ax, ay), lb = Math.hypot(bx, by);
        if (la < 1e-6 || lb < 1e-6){ P.splice(i, 1); changed = true; n++; break; }
        if ((ax * bx + ay * by) / (la * lb) > -0.5 || Math.min(la, lb) > 8) continue;
        if (LINES.some(m => m !== l && !m.dead && m.level > 0 && [m.pts[0], m.pts[m.pts.length - 1]].some(e => Math.hypot(e[0] - P[i][0], e[1] - P[i][1]) < 1))) continue;
        P.splice(i, 1); changed = true; n++; break; } } }
  if (n){ rehashAll(); netDirty = widthDirty = true; } return n; }
// a second street under 25 m that nothing else ends on is a stub: it goes
function dropStubs(){ let n = 0;
  for (const l of LINES){ if (l.dead || l.level !== 2 || l.circus || plen(l.pts) >= 25) continue;
    const others = LINES.filter(m => m !== l && !m.dead && m.level > 0);
    const carries = others.some(m => [[m.pts[0], m.ends[1]], [m.pts[m.pts.length - 1], m.ends[0]]].some(([e, why]) => why !== 'J' && l.pts.some(p => Math.hypot(p[0] - e[0], p[1] - e[1]) < 1.5) && !others.some(k => k !== m && k.pts.some(q => Math.hypot(q[0] - e[0], q[1] - e[1]) < 1.5))));
    if (!carries){ unhash(l, 0); l.dead = true; n++; } }
  if (n) netDirty = widthDirty = true; return n; }
// the lookup rebuilt from the streets as they are (closeGen adds and drops points without it)
function rehashAll(){ HASH = new Map(); for (const l of LINES){ if (l.dead) continue; const Pp = l.pts;
    for (let k = 0; k < Pp.length; k++){ const a = Pp[Math.max(0, k - 1)], b = Pp[Math.min(Pp.length - 1, k + 1)], dx = b[0] - a[0], dy = b[1] - a[1], n = Math.hypot(dx, dy) || 1; hashPt(l, Pp[k], dx / n, dy / n); } } }
function* sweepOpen(trimOnly){ PHASE = 'no open ends'; rehashAll();
  for (let pass = 0; pass < 6; pass++){ let n = 0;
    for (const l of LINES){ if (l.dead || l.level === 0 || l.circus) continue; if (l.pts.length < 2 || plen(l.pts) < 1){ unhash(l, 0); l.dead = true; continue; }
      for (const side of [0, 1]){ if (l.dead) break; const Q = l.pts, e = side === 0 ? Q[Q.length - 1] : Q[0], f = side === 0 ? Q[0] : Q[Q.length - 1];
        if (Math.hypot(e[0] - f[0], e[1] - f[1]) < 0.5 || near(e[0], e[1], 1.5, null, false, null, l.id) || Q.slice(5, -5).some(q => Math.hypot(q[0] - e[0], q[1] - e[1]) < 1.5)) continue;
        n++; if (trimOnly || !extendEnd(l, side, 220, null)) trimEnd(l, side); } }
    if (!n) break; yield 1; }
  netDirty = widthDirty = true; }
function tipEnd(tp, why, d){ tp.done = true; TIPMAP.delete(tp.l.id); tp.l.ends[0] = why; const L = plen(tp.l.pts);
  // a stub goes, unless a street has been built on it: under 20 m, or under 25 m and not ended on a street, or stopped alongside one early
  if (!tp.l.kids && !tp.l.hits && why !== 'near' && ((why !== 'J' && L < 20) || (why !== 'T' && why !== 'Y' && why !== 'J' && L < 25))) tp.l.dead = true;
  else if (why === 'edge') EVENTS.push({ x: tp.x, y: tp.y, k: 'edge' });
  return false; }
// a Y: the street curves into the one it meets, a little ahead along it
function curveInto(tp, hit, ahead, ctrl, kind){ let ux = hit[4], uy = hit[5]; if (ux * tp.hx + uy * tp.hy < 0){ ux = -ux; uy = -uy; }
  const tg = mergeTarget(hit, ux, uy, ahead), cx = tp.x + tp.hx * ctrl, cy = tp.y + tp.hy * ctrl, add = [], skip = tp.ig.filter(q => tp.L < q.until).map(q => q.id).concat([hit[3]]);
  { const ex = tg[0] - tp.x, ey = tg[1] - tp.y, el = Math.hypot(ex, ey); if (el < 8 || ex * tp.hx + ey * tp.hy < 0.5 * el) return false; }   // only a point ahead (within 60 degrees): never doubling back
  { const fx = tg[0] - cx, fy = tg[1] - cy, ct = Math.atan2(tp.hx * fy - tp.hy * fx, tp.hx * fx + tp.hy * fy); if (Math.abs((tp.turn || 0) + ct) > 120 * PI / 180) return false; }   // nor past 120 degrees of turning in all
  for (let k = 1; k <= 16; k++){ const s = k / 16, bx = (1 - s) * (1 - s) * tp.x + 2 * (1 - s) * s * cx + s * s * tg[0], by = (1 - s) * (1 - s) * tp.y + 2 * (1 - s) * s * cy + s * s * tg[1];
    if (!inLand(bx, by) || inZone(bx, by)) return false;
    if (k < 16 && nearB(bx, by, 5, tp.l.id, skip, null, false, null)) return false;   // it would cross another street on the way
    add.push(k === 16 ? [tg[0], tg[1]] : [bx, by]); }
  if (nearB(tg[0], tg[1], 20, tp.l.id, skip, null, false, null)) return false;   // other streets already meet there: no bundle
  for (const p of add){ const dx = p[0] - tp.x, dy = p[1] - tp.y, n = Math.hypot(dx, dy) || 1; tp.hx = dx / n; tp.hy = dy / n; push(tp, p); }
  LINES[hit[3]].hits = (LINES[hit[3]].hits || 0) + 1; EVENTS.push({ x: tg[0], y: tg[1], k: kind || 'merge' }); addNode(tg[0], tg[1], tp.level === 1 && LINES[hit[3]].level === 1); return true; }
// a short bend from the tip to a point, if it crosses no other street on the way
function bendTo(tp, tg, ctrl, skipIds){ const cx = tp.x + tp.hx * ctrl, cy = tp.y + tp.hy * ctrl, add = [], skip = tp.ig.filter(q => tp.L < q.until).map(q => q.id).concat(skipIds);
  { const fx = tg[0] - cx, fy = tg[1] - cy, ct = Math.atan2(tp.hx * fy - tp.hy * fx, tp.hx * fx + tp.hy * fy); if (Math.abs((tp.turn || 0) + ct) > 120 * PI / 180) return false; }
  for (let k = 1; k <= 16; k++){ const s = k / 16, bx = (1 - s) * (1 - s) * tp.x + 2 * (1 - s) * s * cx + s * s * tg[0], by = (1 - s) * (1 - s) * tp.y + 2 * (1 - s) * s * cy + s * s * tg[1];
    if (!inLand(bx, by) || inZone(bx, by)) return false; if (k < 16 && nearB(bx, by, 5, tp.l.id, skip, null, false, null)) return false; add.push(k === 16 ? [tg[0], tg[1]] : [bx, by]); }
  for (const p of add){ const dx = p[0] - tp.x, dy = p[1] - tp.y, n = Math.hypot(dx, dy) || 1; tp.hx = dx / n; tp.hy = dy / n; push(tp, p); } return true; }
function ownHit(tp, x, y){ const Pp = tp.l.pts, n = Pp.length - 14; for (let i = 0; i < n; i++){ const q = Pp[i]; if (Math.abs(q[0] - x) < 6.5 && Math.abs(q[1] - y) < 6.5 && Math.hypot(q[0] - x, q[1] - y) < 6.5) return q; } return null; }
// room for a side street here, going u: nothing leaving (or meeting) the parent here the same way, nothing alongside, no street just ahead
function canBranch(x, y, u, pid){ const d = v('d2'), ig = [pid], ax = x + u[0] * 20, ay = y + u[1] * 20;
  if (!inLand(ax, ay) || (inZone(ax, ay) && !culvertOK(ax, ay, u)) || inRail(ax, ay) || inRail(x, y)) return false;   // (v7: a ditch ahead is fine if the street will cross it square)
  if (nearNode(x, y, d * 0.25)) return false;   // a junction already here
  if (nearB(x, y, d * 0.35, -1, ig, u, true, null)) return false;
  if (nearB(ax, ay, d * 0.45, -1, ig, u, true, null)) return false;
  if (nearB(x + u[0] * 34, y + u[1] * 34, 18, -1, ig, null, false, null)) return false;
  return true; }
function spawn(par, x, y, u, kind, ptip){ if (LINES.length > 5000) return null; const l = newLine(2, [[x, y]], u[0], u[1], kind), t = newTip(l, x, y, u[0], u[1], { ig: [{ id: par.id, until: 16 }] });
  par.hits = (par.hits || 0) + 1; par.kids = (par.kids || 0) + 1; if (ptip && !ptip.done) ptip.ig.push({ id: l.id, until: ptip.L + 15 }); EVENTS.push({ x, y, k: kind }); addNode(x, y); return t; }
// a fork: the arm nearer the heading carries on along its own part of the field, the other starts here along the other
function tryFork(tp, d){ const x = tp.x, y = tp.y, tc = partAxis(PC, PS, x, y), to = partAxis(OC_, OS_, x, y); if (tc === null || to === null || nearNode(x, y, 30)) return;
  const ac = nearestAxis(tc, tp.hx, tp.hy), ao = nearestAxis(to, tp.hx, tp.hy), cd = ac[0] * ao[0] + ac[1] * ao[1]; if (cd > Math.cos(35 * PI / 180)) return;
  const keepC = (ac[0] * tp.hx + ac[1] * tp.hy) >= (ao[0] * tp.hx + ao[1] * tp.hy), arm = keepC ? ao : ac, sd = Math.sqrt(Math.max(0, 1 - cd * cd));
  const px = x + arm[0] * d * 0.5, py = y + arm[1] * d * 0.5; if (!inLand(px, py) || inZone(px, py) || nearB(px, py, d * 0.3, tp.l.id, [], null, false, null)) return;
  const ignLen = Math.min(1.5 * d, 0.4 * d / Math.max(0.2, sd)) + 10, l = newLine(tp.level, [[x, y]], arm[0], arm[1], 'fork');
  newTip(l, x, y, arm[0], arm[1], { ig: [{ id: tp.l.id, until: ignLen }], follow: keepC ? 'o' : 'c', fLeft: d * 1.2, side: -tp.side });
  tp.ig.push({ id: l.id, until: tp.L + ignLen }); tp.follow = keepC ? 'c' : 'o'; tp.fLeft = d * 1.2; tp.fAcc = 0;
  tp.l.hits = (tp.l.hits || 0) + 1; tp.l.kids++; EVENTS.push({ x, y, k: 'fork' }); addNode(x, y, tp.level === 1); }
function tipStep(tp, o){
  const x = tp.x, y = tp.y, d = tp.level === 1 ? v('d1') : v('d2'), d2 = v('d2');
  let t = null; if (tp.fLeft > 0){ t = tp.follow === 'c' ? partAxis(PC, PS, x, y) : partAxis(OC_, OS_, x, y); tp.fLeft -= 5; }
  if (t === null) t = fieldAtT(x, y);
  if (t === null) return tipEnd(tp, 'flat', d);
  const ax = nearestAxis(t, tp.hx, tp.hy), k = clamp((0.10 + 0.30 * gridAt(CLAR, x, y)) * o.memK, 0.02, 0.95);
  let dx = tp.hx * (1 - k) + ax[0] * k, dy = tp.hy * (1 - k) + ax[1] * k; const n = Math.hypot(dx, dy) || 1; dx /= n; dy /= n;
  // no hairpins: a main street turns at most 5 degrees a step (a curve of 57 m radius or wider), a second street 9
  { const mt = (tp.level === 1 ? 5 : 9) * PI / 180; let tr = Math.atan2(tp.hx * dy - tp.hy * dx, tp.hx * dx + tp.hy * dy); if (Math.abs(tr) > mt){ tr = Math.sign(tr) * mt; const a0 = Math.atan2(tp.hy, tp.hx) + tr; dx = Math.cos(a0); dy = Math.sin(a0); }
    tp.turn = (tp.turn || 0) + tr; if (Math.abs(tp.turn) > 120 * PI / 180) return tipEnd(tp, 'near', d); }   // no curls: 120 degrees in all at most
  // no bundles of main streets: one heading into a junction of main streets steers round it (5 degrees a step, away from it)
  if (tp.level === 1 && o.mainsT){ const nd = mainNodeAhead(x, y, dx, dy); if (nd){ const sd = Math.sign(dx * (nd[2] - y) - dy * (nd[1] - x)) || 1, a0 = Math.atan2(dy, dx) - sd * 5 * PI / 180; dx = Math.cos(a0); dy = Math.sin(a0); } }
  const nx_ = x + dx * 5, ny_ = y + dy * 5;
  if (!inLand(nx_, ny_)) return tipEnd(tp, 'edge', d);
  tp.hx = dx; tp.hy = dy;
  if (inRail(nx_, ny_)){ const far = railCross(x, y, dx, dy); if (!far) return tipEnd(tp, 'bank', d); push(tp, far); tp.L += Math.hypot(far[0] - x, far[1] - y); return true; }
  if (tp.L > 15 && alongRail(nx_, ny_, dx, dy)) return tipEnd(tp, 'near', d);   // (v7) never along the rail
  if (inZone(nx_, ny_)){ const far = tryCulvert(x, y, dx, dy); if (!far) return tipEnd(tp, 'bank', d); push(tp, far); tp.L += Math.hypot(far[0] - x, far[1] - y); return true; }
  const ig = tp.ig.filter(q => tp.L < q.until).map(q => q.id), lv = tp.level === 1 ? LV01 : LV012;
  // 1 it meets a street
  for (let tries = 0; tries < 4; tries++){
    const c = nearB(nx_, ny_, 6.5, tp.l.id, ig, null, false, lv); if (!c) break; const other = LINES[c[3]], ot = TIPMAP.get(c[3]);
    if (ot && ot !== tp && ot.hx * dx + ot.hy * dy < -0.5 && Math.hypot(ot.x - nx_, ot.y - ny_) < 14){   // head on: the two become one street
      push(tp, [ot.x, ot.y]); ot.l.ends[0] = 'J'; ot.done = true; TIPMAP.delete(ot.l.id); EVENTS.push({ x: ot.x, y: ot.y, k: 'meet' }); return tipEnd(tp, 'J', d); }
    if (Math.hypot(c[1] - x, c[2] - y) < 5.5){ tp.ig.push({ id: c[3], until: tp.L + 15 }); ig.push(c[3]); continue; }   // it has just been met, here
    if (tp.through && other.level === 1 && !other.circus && Math.abs(c[4] * dx + c[5] * dy) <= 0.574){ tp.ig.push({ id: c[3], until: tp.L + 15 }); ig.push(c[3]); addNode(c[1], c[2], true); continue; }   // main on main: a crossroads
    if (!(o.mainsT && tp.level === 1) && Math.abs(c[4] * dx + c[5] * dy) > 0.574 && tp.L > 25 && curveInto(tp, c, 30, 12)) return tipEnd(tp, 'Y', d);
    { const nd = nearNode(c[1], c[2], 22), ok = nd && !inZone(nd[1], nd[2]) && (nd[1] - x) * dx + (nd[2] - y) * dy > 0 && other.pts.some(p => Math.abs(p[0] - nd[1]) < 2 && Math.abs(p[1] - nd[2]) < 2),
        q = ok ? [nd[1], nd[2]] : [c[1], c[2]];
      // (onto the junction already on that street, if it lies ahead)
      endOn(tp.l, q, 0); push(tp, q); other.hits = (other.hits || 0) + 1; EVENTS.push({ x: q[0], y: q[1], k: 'join' }); if (!ok || (tp.level === 1 && other.level === 1)) addNode(q[0], q[1], tp.level === 1 && other.level === 1); return tipEnd(tp, 'T', d); } }
  { const q = ownHit(tp, nx_, ny_); if (q){ endOn(tp.l, q, 0); push(tp, q.slice()); EVENTS.push({ x: q[0], y: q[1], k: 'join' }); return tipEnd(tp, 'T', d); } }
  // 2 it runs alongside a street too closely: it merges into it, or stops
  const pr = nearB(nx_, ny_, tp.level === 1 ? Math.max(d * 0.3, 80) : d * 0.4, tp.l.id, ig, [dx, dy], true, tp.level === 1 ? LV1 : LV012);
  // (a circus runs every way, so it is never 'alongside')
  if (pr && tp.L > 12 && !LINES[pr[3]].circus){
    // two growing streets meeting head on but offset: they become one street, joined by a short bend (never passing side by side)
    const ot = TIPMAP.get(pr[3]);
    if (ot && ot !== tp && ot.level === tp.level && ot.hx * dx + ot.hy * dy < -0.5){ const gx = ot.x - x, gy = ot.y - y, g = Math.hypot(gx, gy);
      if (g > 5 && g < d * 0.8 && gx * dx + gy * dy > 0.7 * g && bendTo(tp, [ot.x, ot.y], g * 0.35, [ot.l.id])){ ot.l.ends[0] = 'J'; ot.done = true; TIPMAP.delete(ot.l.id); EVENTS.push({ x: ot.x, y: ot.y, k: 'meet' }); return tipEnd(tp, 'J', d); } }
    // a street that comes alongside another turns into it short and steep: a main street as a T, a second street as a Y
    if (o.mainsT && tp.level === 1){ if (curveInto(tp, pr, pr[0] * 0.6, pr[0] * 0.2, 'join')) return tipEnd(tp, 'T', d); return tipEnd(tp, 'near', d); }
    if (tp.L > d * 0.4 && curveInto(tp, pr, pr[0] * 0.7, pr[0] * 0.3)) return tipEnd(tp, 'Y', d); return tipEnd(tp, 'near', d); }
  push(tp, [nx_, ny_]); tp.L += 5; tp.acc += 5; tp.fAcc += 5; STEPS++;
  if (tp.L > 4000) return tipEnd(tp, 'len', d);
  // 3 a fork, where the contour and the other forces pull hard in different directions
  if (o.forkT < 0.55 && !(o.mainsT && tp.level === 1) && tp.fAcc >= (tp.level === 1 ? 0.6 : 0.9) * d && tp.L > 30 && gridAt(CONF, nx_, ny_) > o.forkT) tryFork(tp, d);
  // 4 a side street, one side then the other. Along the field's main direction they are far apart where the field is clear,
  // across it close together: so blocks run long along the field (on clear ground) and about 0.75 x d2 deep
  const tM = fieldAtT(nx_, ny_), along = tM === null || Math.abs(Math.cos(tM) * dx + Math.sin(tM) * dy) >= 0.7071;
  const gap = d2 * o.gapK * (along ? 0.7 + 0.9 * gridAt(CLAR, nx_, ny_) : 0.75);
  if (tp.acc >= gap && tp.L > 30){ let made = false;
    for (const s of [tp.side, -tp.side]){ const px = -dy * s, py = dx * s, t2 = fieldAtT(nx_, ny_); let u = t2 === null ? [px, py] : nearestAxis(t2, px, py); if (Math.abs(u[0] * dx + u[1] * dy) > 0.6) u = [px, py];
      if (tp.level === 1 && o.phase === 1){ BUDS.push({ x: nx_, y: ny_, u, parent: tp.l }); made = true; tp.side = -s; break; }
      if (canBranch(nx_, ny_, u, tp.l.id) && spawn(tp.l, nx_, ny_, u, 'branch', tp)){ made = true; tp.side = -s; break; } }
    tp.acc = made ? 0 : gap * 0.6; }
  return true; }
function* runTips(o){ let guard = 0;
  while (guard++ < 200000){ let any = false;
    for (let i = 0; i < TIPS.length; i++){ const tp = TIPS[i]; if (tp.done) continue; any = true; (o.sec6 && tp.level === 2 ? tipStep6 : tipStep)(tp, o); yield 1; }
    TIPS = TIPS.filter(t => !t.done); if (!any) break; } }
/* v6.3: the second streets grown as in v6 (the user, 22 Oct: v6's second streets were right; only the main streets and
   the attractors change). v6's rules for a second street, unchanged, except that a street curving into another aims at a
   point ahead of it (never doubling back) */
function tipEnd6(tp, why, d){ tp.done = true; TIPMAP.delete(tp.l.id); tp.l.ends[0] = why; const L = plen(tp.l.pts);
  if (!tp.l.kids && !tp.l.hits && ((why === 'near' && L < d * 0.4) || (why !== 'J' && L < 20) || (why !== 'T' && why !== 'Y' && why !== 'J' && L < 25))) tp.l.dead = true;
  else if (why === 'edge') EVENTS.push({ x: tp.x, y: tp.y, k: 'edge' });
  return false; }
function curveInto6(tp, hit, ahead, ctrl){ let ux = hit[4], uy = hit[5]; if (ux * tp.hx + uy * tp.hy < 0){ ux = -ux; uy = -uy; }
  const tg = mergeTarget(hit, ux, uy, ahead), cx = tp.x + tp.hx * ctrl, cy = tp.y + tp.hy * ctrl, add = [], skip = tp.ig.filter(q => tp.L < q.until).map(q => q.id).concat([hit[3]]);
  { const ex = tg[0] - tp.x, ey = tg[1] - tp.y, el = Math.hypot(ex, ey); if (el < 8 || ex * tp.hx + ey * tp.hy < 0.5 * el) return false; }
  for (let k = 1; k <= 16; k++){ const s = k / 16, bx = (1 - s) * (1 - s) * tp.x + 2 * (1 - s) * s * cx + s * s * tg[0], by = (1 - s) * (1 - s) * tp.y + 2 * (1 - s) * s * cy + s * s * tg[1];
    if (!inLand(bx, by) || inZone(bx, by)) return false;
    if (k < 16 && nearB(bx, by, 5, tp.l.id, skip, null, false, null)) return false;
    add.push(k === 16 ? [tg[0], tg[1]] : [bx, by]); }
  for (const p of add){ const dx = p[0] - tp.x, dy = p[1] - tp.y, n = Math.hypot(dx, dy) || 1; tp.hx = dx / n; tp.hy = dy / n; push(tp, p); }
  LINES[hit[3]].hits = (LINES[hit[3]].hits || 0) + 1; EVENTS.push({ x: tg[0], y: tg[1], k: 'merge' }); return true; }
function canBranch6(x, y, u, pid){ const d = v('d2'), ig = [pid], ax = x + u[0] * 20, ay = y + u[1] * 20;
  if (!inLand(ax, ay) || (inZone(ax, ay) && !culvertOK(ax, ay, u)) || inRail(ax, ay) || inRail(x, y)) return false;   // (v7: a ditch ahead is fine if the street will cross it square)
  if (nearB(x, y, d * 0.3, -1, ig, u, true, null)) return false;
  if (nearB(ax, ay, d * 0.45, -1, ig, u, true, null)) return false;
  if (nearB(x + u[0] * 34, y + u[1] * 34, 18, -1, ig, null, false, null)) return false;
  return true; }
function tryFork6(tp, d){ const x = tp.x, y = tp.y, tc = partAxis(PC, PS, x, y), to = partAxis(OC_, OS_, x, y); if (tc === null || to === null) return;
  const ac = nearestAxis(tc, tp.hx, tp.hy), ao = nearestAxis(to, tp.hx, tp.hy), cd = ac[0] * ao[0] + ac[1] * ao[1]; if (cd > Math.cos(25 * PI / 180)) return;
  const keepC = (ac[0] * tp.hx + ac[1] * tp.hy) >= (ao[0] * tp.hx + ao[1] * tp.hy), arm = keepC ? ao : ac, sd = Math.sqrt(Math.max(0, 1 - cd * cd));
  const px = x + arm[0] * d * 0.5, py = y + arm[1] * d * 0.5; if (!inLand(px, py) || inZone(px, py) || nearB(px, py, d * 0.3, tp.l.id, [], null, false, null)) return;
  const ignLen = Math.min(1.5 * d, 0.4 * d / Math.max(0.2, sd)) + 10, l = newLine(tp.level, [[x, y]], arm[0], arm[1], 'fork');
  newTip(l, x, y, arm[0], arm[1], { ig: [{ id: tp.l.id, until: ignLen }], follow: keepC ? 'o' : 'c', fLeft: d * 1.2, side: -tp.side });
  tp.ig.push({ id: l.id, until: tp.L + ignLen }); tp.follow = keepC ? 'c' : 'o'; tp.fLeft = d * 1.2; tp.fAcc = 0;
  tp.l.hits = (tp.l.hits || 0) + 1; tp.l.kids++; EVENTS.push({ x, y, k: 'fork' }); }
function tipStep6(tp, o){
  const x = tp.x, y = tp.y, d = v('d2'), d2 = v('d2');
  let t = null; if (tp.fLeft > 0){ t = tp.follow === 'c' ? partAxis(PC, PS, x, y) : partAxis(OC_, OS_, x, y); tp.fLeft -= 5; }
  if (t === null) t = fieldAtT(x, y);
  if (t === null) return tipEnd6(tp, 'flat', d);
  const ax = nearestAxis(t, tp.hx, tp.hy), k = clamp((0.10 + 0.30 * gridAt(CLAR, x, y)) * o.memK, 0.02, 0.95);
  let dx = tp.hx * (1 - k) + ax[0] * k, dy = tp.hy * (1 - k) + ax[1] * k; const n = Math.hypot(dx, dy) || 1; dx /= n; dy /= n;
  const nx_ = x + dx * 5, ny_ = y + dy * 5;
  if (!inLand(nx_, ny_)) return tipEnd6(tp, 'edge', d);
  tp.hx = dx; tp.hy = dy;
  if (inRail(nx_, ny_)){ const far = railCross(x, y, dx, dy); if (!far) return tipEnd6(tp, 'bank', d); push(tp, far); tp.L += Math.hypot(far[0] - x, far[1] - y); return true; }
  if (tp.L > 15 && alongRail(nx_, ny_, dx, dy)) return tipEnd6(tp, 'near', d);   // (v7) never along the rail
  if (inZone(nx_, ny_)){ const far = tryCulvert(x, y, dx, dy); if (!far) return tipEnd6(tp, 'bank', d); push(tp, far); tp.L += Math.hypot(far[0] - x, far[1] - y); return true; }
  const ig = tp.ig.filter(q => tp.L < q.until).map(q => q.id);
  // 1 it meets a street
  for (let tries = 0; tries < 4; tries++){
    const c = nearB(nx_, ny_, 6.5, tp.l.id, ig, null, false, LV012); if (!c) break; const other = LINES[c[3]], ot = TIPMAP.get(c[3]);
    if (ot && ot !== tp && ot.hx * dx + ot.hy * dy < -0.5 && Math.hypot(ot.x - nx_, ot.y - ny_) < 14){
      push(tp, [ot.x, ot.y]); ot.l.ends[0] = 'J'; ot.done = true; TIPMAP.delete(ot.l.id); EVENTS.push({ x: ot.x, y: ot.y, k: 'meet' }); return tipEnd6(tp, 'J', d); }
    if (Math.hypot(c[1] - x, c[2] - y) < 5.5){ tp.ig.push({ id: c[3], until: tp.L + 15 }); ig.push(c[3]); continue; }
    if (Math.abs(c[4] * dx + c[5] * dy) > 0.574 && tp.L > 25 && curveInto6(tp, c, 30, 12)) return tipEnd6(tp, 'Y', d);
    push(tp, [c[1], c[2]]); other.hits = (other.hits || 0) + 1; EVENTS.push({ x: c[1], y: c[2], k: 'join' }); return tipEnd6(tp, 'T', d); }
  { const q = ownHit(tp, nx_, ny_); if (q){ push(tp, q.slice()); EVENTS.push({ x: q[0], y: q[1], k: 'join' }); return tipEnd6(tp, 'T', d); } }
  // 2 it runs alongside a street too closely: it merges into it, or stops
  const pr = nearB(nx_, ny_, d * 0.35, tp.l.id, ig, [dx, dy], true, LV012);
  if (pr && tp.L > 12){ if (tp.L > d * 0.4 && curveInto6(tp, pr, d * 0.6, d * 0.3)) return tipEnd6(tp, 'Y', d); return tipEnd6(tp, 'near', d); }
  push(tp, [nx_, ny_]); tp.L += 5; tp.acc += 5; tp.fAcc += 5; STEPS++;
  if (tp.L > 4000) return tipEnd6(tp, 'len', d);
  // 3 a fork, where the contour and the other forces pull hard in different directions
  if (o.forkT < 0.55 && tp.fAcc >= 0.9 * d && tp.L > 30 && gridAt(CONF, nx_, ny_) > o.forkT) tryFork6(tp, d);
  // 4 a side street, one side then the other: far apart along the field where it is clear, close across it
  const tM = fieldAtT(nx_, ny_), along = tM === null || Math.abs(Math.cos(tM) * dx + Math.sin(tM) * dy) >= 0.7071;
  const gap = d2 * o.gapK * (along ? 0.7 + 0.9 * gridAt(CLAR, nx_, ny_) : 0.75);
  if (tp.acc >= gap && tp.L > 30){ let made = false;
    for (const s of [tp.side, -tp.side]){ const px = -dy * s, py = dx * s, t2 = fieldAtT(nx_, ny_); let u = t2 === null ? [px, py] : nearestAxis(t2, px, py); if (Math.abs(u[0] * dx + u[1] * dy) > 0.6) u = [px, py];
      if (canBranch6(nx_, ny_, u, tp.l.id) && spawn(tp.l, nx_, ny_, u, 'branch', tp)){ made = true; tp.side = -s; break; } }
    tp.acc = made ? 0 : gap * 0.6; }
  return true; }
// (v7) no street ends against water or the station ring: one whose end lies on a hole's edge (and on no other street) goes
// back to its last junction; repeated until nothing changes, since cutting one back can leave another that ended on it
// hanging at the shore (the lookup rebuilt before every pass)
// (v7) a street that reaches a shore (water, or the station ring) follows it, set back 8 m, to the nearest street or
// wool road's edge within 260 m along the shore (a waterfront street, a street round the station's clear ring)
function shoreLink(l, side, shores){ const LV12 = new Set([1, 2]); const P = l.pts, e = side === 0 ? P[P.length - 1] : P[0];
  const c = nearB(e[0], e[1], 8, l.id, [], null, false, LV0); if (!c || !LINES[c[3]].hole) return false;
  const S = LINES[c[3]].pts, closed = Math.hypot(S[0][0] - S[S.length - 1][0], S[0][1] - S[S.length - 1][1]) < 1, N = S.length;
  let k0 = 0, bd = 1e18; S.forEach((q, i) => { const d = Math.hypot(q[0] - e[0], q[1] - e[1]); if (d < bd){ bd = d; k0 = i; } });
  let best = null;
  for (const dir of [1, -1]){ let acc = 0, path = [], ok = true;
    for (let s = 1; s < N && acc < 260; s++){ let i = k0 + dir * s, j = i - dir; if (closed){ i = ((i % N) + N) % N; j = ((j % N) + N) % N; } else if (i < 0 || i >= N) break;
      const q = S[i], pq = S[j]; acc += Math.hypot(q[0] - pq[0], q[1] - pq[1]);
      const tx = q[0] - pq[0], ty = q[1] - pq[1], tn = Math.hypot(tx, ty) || 1; let nx = -ty / tn, ny = tx / tn; if (!inLand(q[0] + nx * 8, q[1] + ny * 8)){ nx = -nx; ny = -ny; }
      const w = [q[0] + nx * 8, q[1] + ny * 8]; if (!inLand(w[0], w[1])){ ok = false; break; }
      path.push(w);
      if (acc > 15){ const hit = near(w[0], w[1], 10, null, false, LV12, l.id) || nearB(w[0], w[1], 10, l.id, shores, null, false, LV0);
        if (hit){ path.push([hit[1], hit[2]]); if (!best || acc < best.acc) best = { acc, path: path.slice() }; break; } } }
    if (!ok) continue; }
  if (!best) return false;
  const pts = densify([e].concat(best.path), 4).slice(1);
  if (side === 0) l.pts = P.concat(pts); else l.pts = pts.slice().reverse().concat(P);
  l.ends[side] = 'T'; l.shore = true; return true; }
// (v7) no street ends against water or the station ring, and none is left loose: an end on a shore follows the shore to the
// next street or road (shoreLink); one that cannot, and any end left loose, goes back to the last point where it meets a
// street or a road's edge, put exactly on it; repeated until nothing changes (cutting one back can leave another loose);
// the lookup rebuilt before every pass; a street shrunk to a point, or a scrap under 12 m that nothing ends on, goes
function holeTrim(){ const LV12 = new Set([1, 2]); let total = 0;
  const shores = LINES.filter(l => l.hole).map(l => l.id);
  const joined = (x, y, own, r) => !!near(x, y, r, null, false, LV12, own) || !!nearB(x, y, r, own, shores, null, false, LV0);
  for (let pass = 0; pass < 12; pass++){
    for (const l of LINES) if (!l.dead && l.level > 0 && !l.circus && (l.pts.length < 2 || plen(l.pts) < 1)) l.dead = true;
    rehashAll(); let n = 0;
    for (const l of LINES){ if (l.dead || l.level === 0 || l.circus) continue;
      for (const side of [0, 1]){ if (l.dead) break; const P = l.pts, e = side === 0 ? P[P.length - 1] : P[0];
        if (joined(e[0], e[1], l.id, 1.5)) continue;
        if (shoreLink(l, side, shores)){ n++; rehashAll(); continue; }
        const idx = side === 0 ? [...Array(P.length).keys()].reverse() : [...Array(P.length).keys()];
        let cut = -1; for (const k of idx.slice(1)){ if (joined(P[k][0], P[k][1], l.id, 4)){ cut = k; break; } }
        if (cut < 0 || (side === 0 ? cut : P.length - 1 - cut) < 1){ l.dead = true; n++; continue; }
        l.pts = side === 0 ? P.slice(0, cut + 1) : P.slice(cut); l.ends[side] = 'T'; n++;
        const P2 = l.pts, e2 = side === 0 ? P2[P2.length - 1] : P2[0], q = near(e2[0], e2[1], 5, null, false, LV12, l.id) || nearB(e2[0], e2[1], 5, l.id, shores, null, false, LV0);
        if (q && q[0] > 0.01){ if (side === 0) P2.push([q[1], q[2]]); else P2.unshift([q[1], q[2]]); } } }
    rehashAll();
    for (const l of LINES){ if (l.dead || l.level === 0 || l.circus || plen(l.pts) >= 12) continue;
      const carries = LINES.some(m => m !== l && !m.dead && m.level > 0 && [m.pts[0], m.pts[m.pts.length - 1]].some(e => l.pts.some(q => Math.hypot(q[0] - e[0], q[1] - e[1]) < 1.5)));
      if (!carries){ l.dead = true; n++; } }
    total += n; if (!n) break; }
  rehashAll(); netDirty = widthDirty = true; return total; }
// (v7) two streets side by side (the v6.2 test: parallel, close, for 45 m or more): the second street of the pair goes,
// the shorter if both are, as long as no other street ends on it (so nothing is left loose); repeated until none can go
function dropSide(){ let n = 0;
  for (let pass = 0; pass < 6; pass++){ rehashAll(); const runs = sideRuns(); let k = 0;
    for (const r of runs){ const A = LINES[r.a], Bq = LINES[r.b]; if (A.dead || Bq.dead) continue;
      const cand = [A, Bq].filter(l => l.level === 2 && !l.circus).sort((x, y) => plen(x.pts) - plen(y.pts));
      for (const l of cand){ const carries = LINES.some(m => m !== l && !m.dead && m.level > 0 && [m.pts[0], m.pts[m.pts.length - 1]].some(e => l.pts.slice(1, -1).some(q => Math.hypot(q[0] - e[0], q[1] - e[1]) < 1.5)));
        if (carries) continue; l.dead = true; k++; break; } }
    n += k; if (!k) break; }
  rehashAll(); netDirty = widthDirty = true; return n; }
// (v7) two streets meeting end to end at a sharp turn (and nothing else there) read as a hook: they are one street turning
// a corner, so the corner is rounded into a bend, each street cut back up to 40 m and the two joined by a curve through
// the corner, split at its middle so each keeps its own half; not where the curve would leave the land or touch another street
function roundKinks(){ let n = 0; rehashAll();
  const endsAt = (l, side) => side === 0 ? l.pts[l.pts.length - 1] : l.pts[0];
  const back = (l, side, d) => { const P = side === 0 ? l.pts.slice().reverse() : l.pts.slice(); let acc = 0; for (let k = 1; k < P.length; k++){ acc += Math.hypot(P[k][0] - P[k - 1][0], P[k][1] - P[k - 1][1]); if (acc >= d) return [k, P[k]]; } return [P.length - 1, P[P.length - 1]]; };
  const live = LINES.filter(l => !l.dead && l.level > 0 && !l.circus && l.pts.length > 2);
  for (const l of live){ for (const side of [0, 1]){ if (l.dead) break; const e = endsAt(l, side);
      const at = live.filter(m => m !== l && !m.dead && m.pts.some(q => Math.hypot(q[0] - e[0], q[1] - e[1]) < 1.2)); if (at.length !== 1) continue;
      if (near(e[0], e[1], 1.5, null, false, LV0, l.id)) continue;
      const m = at[0], ms = Math.hypot(m.pts[0][0] - e[0], m.pts[0][1] - e[1]) < 1.2 ? 1 : Math.hypot(m.pts[m.pts.length - 1][0] - e[0], m.pts[m.pts.length - 1][1] - e[1]) < 1.2 ? 0 : -1; if (ms < 0) continue;
      const dl = Math.min(40, 0.45 * plen(l.pts)), dm = Math.min(40, 0.45 * plen(m.pts)); if (dl < 8 || dm < 8) continue;
      const [kl, A] = back(l, side, dl), [km, Bp] = back(m, ms, dm);
      const ha = Math.atan2(e[1] - A[1], e[0] - A[0]), hb = Math.atan2(Bp[1] - e[1], Bp[0] - e[0]); let t = Math.abs(((hb - ha) % (2 * PI) + 3 * PI) % (2 * PI) - PI); if (t < 45 * PI / 180) continue;
      const curve = []; for (let k = 0; k <= 16; k++){ const u = k / 16; curve.push([(1 - u) * (1 - u) * A[0] + 2 * (1 - u) * u * e[0] + u * u * Bp[0], (1 - u) * (1 - u) * A[1] + 2 * (1 - u) * u * e[1] + u * u * Bp[1]]); }
      if (curve.some(q => !inLand(q[0], q[1]) || nearB(q[0], q[1], 6, l.id, [m.id], null, false, null))) continue;
      const half1 = curve.slice(0, 9), half2 = curve.slice(8);
      if (side === 0) l.pts = l.pts.slice(0, l.pts.length - kl).concat(half1); else l.pts = half1.slice().reverse().concat(l.pts.slice(kl));
      if (ms === 1) m.pts = half2.concat(m.pts.slice(km)); else m.pts = m.pts.slice(0, m.pts.length - km).concat(half2.slice().reverse());
      n++; rehashAll(); } }
  netDirty = widthDirty = true; return n; }
// (v7) the cells joined across the road between them: a street of this level that ends on that road (from one cell) starts
// again straight across it, on the other cell's side, going the same way, unless a street already ends on the road within
// 25 m there; then the new streets grow by the same rules
function pieceAt(x, y){ for (let i = 0; i < D.pieces.length; i++){ const p = D.pieces[i]; if (inRing([x, y], p.outer) && !p.holes.some(h => inRing([x, y], h))) return i; } return -1; }
function* crossShared(o, level){ rehashAll(); const todo = [];
  for (const l of LINES){ if (l.dead || l.level !== level || l.circus || l.pts.length < 2) continue;
    for (const side of [0, 1]){ const P = l.pts, e = side === 0 ? P[P.length - 1] : P[0];
      const c = nearB(e[0], e[1], 3, l.id, [], null, false, LV0); if (!c || !LINES[c[3]].shared) continue;
      let pv = null; for (let k = 1; k < P.length; k++){ const q = side === 0 ? P[P.length - 1 - k] : P[k]; if (Math.hypot(q[0] - e[0], q[1] - e[1]) >= 12){ pv = q; break; } } if (!pv) continue;
      let hx = e[0] - pv[0], hy = e[1] - pv[1]; const n = Math.hypot(hx, hy); hx /= n; hy /= n;
      const pi = pieceAt(pv[0], pv[1]); if (pi < 0) continue; todo.push([e, hx, hy, D.pieces[pi].parcel]); } }
  let made = 0;
  for (const [e, hx, hy, cell0] of todo){ let q = null;
    for (let s = 4; s <= 70; s += 2){ const x = e[0] + hx * s, y = e[1] + hy * s; if (inLandNoHoles(x, y)){ const pj = pieceAt(x, y); if (pj >= 0 && D.pieces[pj].parcel !== cell0) q = [x, y]; break; } }
    if (!q) continue;
    const r0 = nearB(q[0], q[1], 8, -1, [], null, false, LV0); if (r0) q = [r0[1], r0[2]];
    // (a street of the other cell already ends on the road just there: its end within 25 m, the street itself in that cell)
    const tgt = pieceAt(q[0] + hx * 6, q[1] + hy * 6), tcell = tgt >= 0 ? D.pieces[tgt].parcel : -1;
    const endIn = (m, i) => { const e = m.pts[i], b = m.pts[i === 0 ? Math.min(3, m.pts.length - 1) : Math.max(0, m.pts.length - 4)], pj = pieceAt(b[0], b[1]); return Math.hypot(e[0] - q[0], e[1] - q[1]) < 25 && pj >= 0 && D.pieces[pj].parcel === tcell; };
    if (LINES.some(m => !m.dead && m.level > 0 && !m.circus && m.pts.length > 1 && (endIn(m, 0) || endIn(m, m.pts.length - 1)))) continue;
    const l = newLine(level, [[q[0], q[1]]], hx, hy, 'across'); newTip(l, q[0], q[1], hx, hy, { L: 0, through: level === 1 }); EVENTS.push({ x: q[0], y: q[1], k: 'join' }); made++; }
  if (made) yield* runTips(o);
  return made; }
// (v7) the streets of the two cells lined up across the road between them: where a street of one cell meets that road and a
// street of the other meets it within 40 m of the point straight across, the second one's last 40 m is eased over so it
// meets the road exactly opposite (the second street of the pair moves, or the shorter if both are of one level); not
// where that would take it off the land or into another street
function alignShared(){ rehashAll(); const ends = [];
  for (const l of LINES){ if (l.dead || l.level === 0 || l.circus || l.pts.length < 3) continue;
    for (const side of [0, 1]){ const P = l.pts, e = side === 0 ? P[P.length - 1] : P[0];
      const c = nearB(e[0], e[1], 3, l.id, [], null, false, LV0); if (!c || !LINES[c[3]].shared) continue;
      let pv = null; for (let k = 1; k < P.length; k++){ const q = side === 0 ? P[P.length - 1 - k] : P[k]; if (Math.hypot(q[0] - e[0], q[1] - e[1]) >= 12){ pv = q; break; } } if (!pv) continue;
      let hx = e[0] - pv[0], hy = e[1] - pv[1]; const n = Math.hypot(hx, hy); hx /= n; hy /= n; const pi = pieceAt(pv[0], pv[1]); if (pi < 0) continue;
      ends.push({ l, side, e, hx, hy, cell: D.pieces[pi].parcel }); } }
  const used = new Set(); let n = 0;
  for (const A of ends){ if (used.has(A)) continue; let q = null;
    for (let s = 4; s <= 70; s += 2){ const x = A.e[0] + A.hx * s, y = A.e[1] + A.hy * s; if (inLandNoHoles(x, y)){ const pj = pieceAt(x, y); if (pj >= 0 && D.pieces[pj].parcel !== A.cell) q = [x, y]; break; } }
    if (!q) continue; const r0 = nearB(q[0], q[1], 8, -1, [], null, false, LV0); if (r0) q = [r0[1], r0[2]];
    let best = null; for (const B of ends){ if (B === A || used.has(B) || B.cell === A.cell) continue; const d = Math.hypot(B.e[0] - q[0], B.e[1] - q[1]); if (d < 40 && (!best || d < best[0])) best = [d, B]; }
    if (!best || best[0] < 2) { if (best) { used.add(A); used.add(best[1]); } continue; }
    const B = best[1]; let mover = B, target = q;
    if (A.l.level > B.l.level || (A.l.level === B.l.level && plen(A.l.pts) < plen(B.l.pts))){ mover = A;
      let q2 = null; for (let s = 4; s <= 70; s += 2){ const x = B.e[0] + B.hx * s, y = B.e[1] + B.hy * s; if (inLandNoHoles(x, y)){ const pj = pieceAt(x, y); if (pj >= 0 && D.pieces[pj].parcel !== B.cell) q2 = [x, y]; break; } }
      if (!q2) continue; const r2 = nearB(q2[0], q2[1], 8, -1, [], null, false, LV0); target = r2 ? [r2[1], r2[2]] : q2; }
    const P = mover.side === 0 ? mover.l.pts.slice().reverse() : mover.l.pts.slice(), dx = target[0] - mover.e[0], dy = target[1] - mover.e[1];
    let acc = 0; const moved = [P[0]];
    for (let k = 1; k < P.length; k++){ acc += Math.hypot(P[k][0] - P[k - 1][0], P[k][1] - P[k - 1][1]); moved.push(P[k]); }
    acc = 0; const out = []; for (let k = 0; k < P.length; k++){ if (k) acc += Math.hypot(P[k][0] - P[k - 1][0], P[k][1] - P[k - 1][1]); const u = Math.max(0, 1 - acc / 40), w = u * u * (3 - 2 * u); out.push([P[k][0] + dx * w, P[k][1] + dy * w]); }
    if (out.slice(1, 12).some(q => !inLand(q[0], q[1]) || nearB(q[0], q[1], 4, mover.l.id, [], null, false, new Set([1, 2])))) continue;
    unhash(mover.l, 0); mover.l.pts = mover.side === 0 ? out.reverse() : out; n++; used.add(A); used.add(B); }
  rehashAll(); netDirty = widthDirty = true; return n; }
// (v7) no block over 1.5 ha (the brief's largest): each is cut by a second street through its middle, across its long side
// and along the field's nearer direction, from the street on one side to the street on the other (a T at both ends);
// a cut that would cross water, the rail at a slant, a watercourse at a slant, or leave either half under 0.3 ha is not
// made; the biggest blocks first, repeated until none is left that can be cut
function splitBlocks(maxHa){ maxHa = maxHa || 1.5; let made = 0;
  for (let round = 0; round < 6; round++){ readCells(); rehashAll(); const { lab, W, H, c, areas } = CELLS; const sx = new Float64Array(areas.length), sy = new Float64Array(areas.length), sxx = new Float64Array(areas.length), syy = new Float64Array(areas.length), sxy = new Float64Array(areas.length), cnt = new Float64Array(areas.length);
    for (let i = 0; i < W * H; i++){ const L_ = lab[i]; if (L_ < 0) continue; const x = (i % W + 0.5) * c, y = D.h - (((i / W) | 0) + 0.5) * c; sx[L_] += x; sy[L_] += y; sxx[L_] += x * x; syy[L_] += y * y; sxy[L_] += x * y; cnt[L_]++; }
    const order = areas.map((a, i) => [a, i]).filter(q => q[0] > maxHa).sort((a, b) => b[0] - a[0]); let n = 0;
    for (const [area, L_] of order){ const mx = sx[L_] / cnt[L_], my = sy[L_] / cnt[L_], vxx = sxx[L_] / cnt[L_] - mx * mx, vyy = syy[L_] / cnt[L_] - my * my, vxy = sxy[L_] / cnt[L_] - mx * my;
      const long = 0.5 * Math.atan2(2 * vxy, vxx - vyy), cross = [Math.cos(long + PI / 2), Math.sin(long + PI / 2)];
      // the start: the block's pixel nearest its centre (the centre may fall outside an odd-shaped block)
      let best = null; for (let i = 0; i < W * H; i++){ if (lab[i] !== L_) continue; const x = (i % W + 0.5) * c, y = D.h - (((i / W) | 0) + 0.5) * c, d = (x - mx) ** 2 + (y - my) ** 2; if (!best || d < best[0]) best = [d, x, y]; }
      if (!best) continue; const x0 = best[1], y0 = best[2], t = fieldAtT(x0, y0), u = t === null ? cross : nearestAxis(t, cross[0], cross[1]);
      const half = sg => { const pts = []; let x = x0, y = y0, hx = u[0] * sg, hy = u[1] * sg;
        for (let k = 0; k < 120; k++){ const tt = fieldAtT(x, y); if (tt !== null){ const ax = nearestAxis(tt, hx, hy); hx = hx * 0.85 + ax[0] * 0.15; hy = hy * 0.85 + ax[1] * 0.15; const nn = Math.hypot(hx, hy); hx /= nn; hy /= nn; }
          const nx2 = x + hx * 5, ny2 = y + hy * 5; if (!inLand(nx2, ny2)) return null;
          const hit = nearB(nx2, ny2, 6, -1, [], null, false, null); if (hit){ if (LINES[hit[3]].hole) return null; pts.push([hit[1], hit[2]]); return pts; }
          if (inRail(nx2, ny2) || (inZone(nx2, ny2) && !culvertOK(nx2, ny2, [hx, hy]))) return null;
          pts.push([nx2, ny2]); x = nx2; y = ny2; } return null; };
      const a = half(1), b = half(-1); if (!a || !b) continue;
      const pts = b.slice().reverse().concat([[x0, y0]], a); if (plen(pts) < 40) continue;
      // no street alongside the cut (parallel, within 22 m) away from its two ends
      { let acc = 0, bad = false; const tot = plen(pts);
        for (let k = 1; k < pts.length && !bad; k++){ const q = pts[k], pq = pts[k - 1], sl = Math.hypot(q[0] - pq[0], q[1] - pq[1]); acc += sl; if (acc < 25 || tot - acc < 25 || sl < 0.5) continue;
          if (nearB(q[0], q[1], 22, -1, [], [(q[0] - pq[0]) / sl, (q[1] - pq[1]) / sl], true, new Set([1, 2]))) bad = true; }
        if (bad) continue; }
      const l = newLine(2, pts, u[0], u[1], 'split'); l.ends = ['T', 'T']; EVENTS.push({ x: x0, y: y0, k: 'split' }); n++; }
    made += n; if (!n) break; }
  rehashAll(); netDirty = widthDirty = true; return made; }
// v6's closing pass, as it was: an end that meets nothing carries on along the field to the next street (or curves into
// the nearest within 120 m); one that cannot is cut back to its last junction
function* closeGen6(){ PHASE = 'every end meets a street';
  for (let lid = 0; lid < LINES.length; lid++){ const l = LINES[lid]; if (l.level === 0 || l.dead) continue;
    for (const side of [0, 1]){ if (l.dead) break; const Pp = l.pts, why = l.ends[side]; const end = side === 0 ? Pp[Pp.length - 1] : Pp[0];
      // (v7) a street that runs into water or the station ring (a hole in the land, not a road) goes back to its last junction
      { const c = nearB(end[0], end[1], 8, lid, [], null, false, LV0); if (c && LINES[c[3]].hole) continue; }   // (a shore end: holeTrim deals with it)
      if (why === 'T' || why === 'Y' || why === 'J' || why === 'ring') continue;
      if (why === 'edge'){ const c = near(end[0], end[1], 25, null, false, new Set([0, 1]), lid); if (c){ if (side === 0) Pp.push([c[1], c[2]]); else Pp.unshift([c[1], c[2]]); l.ends[side] = 'T'; } continue; }
      if (Pp.length < 2) continue;
      const pv = side === 0 ? Pp[Pp.length - 2] : Pp[1]; let dx = end[0] - pv[0], dy = end[1] - pv[1]; const n = Math.hypot(dx, dy) || 1; dx /= n; dy /= n;
      let x = end[0], y = end[1], L = 0, ext = [], hit = null;
      while (L < 220){ const t = fieldAtT(x, y); if (t !== null){ for (const a of [t, t + PI / 2]){ const ux = Math.cos(a), uy = Math.sin(a); if (ux * dx + uy * dy >= 0.7){ dx = ux; dy = uy; break; } if (-ux * dx - uy * dy >= 0.7){ dx = -ux; dy = -uy; break; } } }
        const px = x, py = y; x += dx * 5; y += dy * 5; L += 5; if (!inLand(x, y)) break; if (inRail(x, y) && !railOK(x, y, dx, dy)) break; if (L > 15 && alongRail(x, y, dx, dy)) break;
        // (v8.8) a watercourse or a corridor ahead: across it square-ish on a culvert, or not at all
        if (inZone(x, y)){ const far = tryCulvert(px, py, dx, dy); if (!far){ x = px; y = py; break; } x = far[0]; y = far[1]; L += Math.hypot(far[0] - px, far[1] - py); ext.push([x, y]); continue; }
        const c = near(x, y, 6.5, null, false, null, lid); if (c){ hit = [c[1], c[2]]; LINES[c[3]].hits = (LINES[c[3]].hits || 0) + 1; break; } ext.push([x, y]); }
      if (hit) ext.push(hit); else { const c = near(end[0], end[1], 120, null, false, null, lid); ext = c ? curve(end, [dx, dy], [c[1], c[2]]) : null; if (ext && ext.some(q => inRail(q[0], q[1]) || inZone(q[0], q[1]))) ext = null; if (c) LINES[c[3]].hits = (LINES[c[3]].hits || 0) + 1; }
      if (ext){ if (side === 0) Pp.push(...ext); else Pp.unshift(...ext.reverse()); l.ends[side] = 'T'; } else cutBack(l, side);
      yield 1; } }
  netDirty = true; widthDirty = true; }
/* (v8.15) STITCHED MAIN STREETS: main streets planned as a network that links places, not grown blind from the anchors.
 * 1 the places: the entries (anchors: where outside streets meet the site), the main nodes and the edge nodes (a circus,
 *   if one formed, is reached on its ring); entries closer than 60 m are one place
 * 2 who links to whom: a minimum spanning tree over the places of each piece of land (so every place is reached), then a
 *   few loops where the tree makes a long detour (network distance over twice the direct one): through routes and choice
 * 3 each link routed on the 10 m grid at the least cost: the length, made dearer where it runs across the field's two
 *   directions (so the streets still follow the contour, the wind and the water), up a slope, hugging the land's edge;
 *   water and the rail are not crossed, a watercourse or a blue-green corridor only near square (60 degrees or more) and
 *   at a cost (a culvert). A tree link may end on any main street already joined to its far place (a T); a link reuses
 *   the streets already laid (cheaper) so links share trunks; a loop avoids them (dearer) so it is a second way
 * 4 the route smoothed (and kept on land), drawn as a main street; the side-street buds laid along it for step 7 */
const STITCH = { PLACE_MERGE: 60, MAX_LINK: 2000, EDGE_COST: 1.8, ALIGN: 1.6, SLOPE: 12, ZONE_ANGLE: 60, ZONE_COST: 30, REUSE: 0.55, LOOP_AVOID: 2.5, LOOP_RATIO: 1.7 };
function* stitchMains(o){
  PHASE = 'main streets link the entries and the nodes';
  const Ncell = nx * ny, ci = (x, y) => { const c = Math.round(x / cell), r = Math.round(y / cell); return c < 0 || r < 0 || c >= nx || r >= ny ? -1 : r * nx + c; }, cx = i => (i % nx) * cell, cy = i => ((i / nx) | 0) * cell;
  // the grid: passable (land, off the rail), in a zone, the field's axis and clarity, the distance to the land's edge, the ground
  const PASS = new Uint8Array(Ncell), ZN = new Uint8Array(Ncell), TH = new Float32Array(Ncell), ED = new Float32Array(Ncell).fill(1e9);
  for (let i = 0; i < Ncell; i++){ const x = cx(i), y = cy(i); if (inLand(x, y) && !inRail(x, y)){ PASS[i] = 1; ZN[i] = inZone(x, y) ? 1 : 0; const t = fieldAtT(x, y); TH[i] = t === null ? NaN : t; } }
  { const q = []; for (let i = 0; i < Ncell; i++) if (!PASS[i]){ ED[i] = 0; q.push(i); }
    for (let h = 0; h < q.length; h++){ const k = q[h], r = (k / nx) | 0, c = k % nx; for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]]){ const rr = r + dr, cc = c + dc; if (rr < 0 || cc < 0 || rr >= ny || cc >= nx) continue; const j = rr * nx + cc; if (ED[j] > ED[k] + cell){ ED[j] = ED[k] + cell; q.push(j); } } } }
  const Z = window.__TS.D.env ? window.__TS.D.env.Z : null;
  // the pieces of land (4-connected), so places link only within one
  const COMP = new Int32Array(Ncell).fill(-1); { let nc = 0; for (let s = 0; s < Ncell; s++){ if (!PASS[s] || COMP[s] >= 0) continue; const st = [s]; COMP[s] = nc;
    while (st.length){ const k = st.pop(), r = (k / nx) | 0, c = k % nx; for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]]){ const rr = r + dr, cc = c + dc; if (rr < 0 || cc < 0 || rr >= ny || cc >= nx) continue; const j = rr * nx + cc; if (PASS[j] && COMP[j] < 0){ COMP[j] = nc; st.push(j); } } } nc++; } }
  const nearPass = (x, y, R) => { let best = -1, bd = 1e9; const c0 = Math.round(x / cell), r0 = Math.round(y / cell), k = Math.ceil(R / cell);
    for (let r = r0 - k; r <= r0 + k; r++) for (let c = c0 - k; c <= c0 + k; c++){ if (r < 0 || c < 0 || r >= ny || c >= nx) continue; const i = r * nx + c; if (!PASS[i] || ZN[i]) continue; const d = Math.hypot(c * cell - x, r * cell - y); if (d < bd && d <= R){ bd = d; best = i; } } return best; };
  // 1 the places
  const PL = [];
  for (const a of D.anchors) for (const p of D.pieces){ if (p.parcel !== a.parcel) continue; const q = [p.outer, ...p.holes].map(r => nearestOnRing(r, a.x, a.y)).reduce((b, c) => c.d < b.d ? c : b); if (q.d > 150) continue;
    let nxv = -q.ty, nyv = q.tx; if (!inLand(q.x + nxv * 20, q.y + nyv * 20)){ nxv = -nxv; nyv = -nyv; } if (!inLand(q.x + nxv * 20, q.y + nyv * 20)) continue;
    const sx = q.x + nxv * 12, sy = q.y + nyv * 12; if (alongRail(sx, sy, nxv, nyv)) continue; const port = nearPass(sx, sy, 20); if (port < 0) continue;
    const rp = nearB(q.x, q.y, 6, -1, [], null, false, LV0), s0 = rp ? [rp[1], rp[2]] : [q.x, q.y];
    if (PL.some(P => P.kind === 'entry' && Math.hypot(P.x - sx, P.y - sy) < STITCH.PLACE_MERGE)) continue;
    PL.push({ kind: 'entry', x: sx, y: sy, ports: [port], s0, n: [nxv, nyv], station: !!a.station }); }
  for (const a of attractorsOn()){ if (!a.main) continue; const h = HOLES.find(h => Math.hypot(h.x - a.x, h.y - a.y) < 3);
    if (h){ const ports = [], k = Math.ceil((h.r + 16) / cell); for (let r = Math.round(a.y / cell) - k; r <= Math.round(a.y / cell) + k; r++) for (let c = Math.round(a.x / cell) - k; c <= Math.round(a.x / cell) + k; c++){ if (r < 0 || c < 0 || r >= ny || c >= nx) continue; const i = r * nx + c, d = Math.hypot(c * cell - a.x, r * cell - a.y); if (PASS[i] && !ZN[i] && d >= h.r + 2 && d <= h.r + 16) ports.push(i); }
      if (ports.length) PL.push({ kind: a.kind, x: a.x, y: a.y, ports, hole: h }); }
    else { const p = nearPass(a.x, a.y, 40); if (p >= 0) PL.push({ kind: a.kind, x: a.x, y: a.y, ports: [p] }); } }
  PL.forEach((P, k) => { P.id = k; P.comp = COMP[P.ports[0]]; P.isPort = new Set(P.ports); });
  // union-find over the places
  const UF = PL.map((_, k) => k), find = k => { while (UF[k] !== k){ UF[k] = UF[UF[k]]; k = UF[k]; } return k; }, unite = (a, b) => { UF[find(a)] = find(b); };
  // the cells a main street runs through, each with the place it belongs to (for ending a link on the network)
  const USED = new Int32Array(Ncell).fill(-1), USEDL = new Int32Array(Ncell).fill(-1), DU = new Float32Array(Ncell).fill(1e9);
  // (v8.17) a street laid marks the cells it runs through and, within 12 m, the band it owns (a link reaching the band has
  // reached the street); DU is the distance to the nearest street laid, up to 60 m (beside a street is dear: no doubling)
  const BAND = 12, BESIDE = 60;
  function markUsed(pts, owner, lid){ const q = [];
    for (const p of pts){ const i = ci(p[0], p[1]); if (i < 0) continue; if (USED[i] < 0 || DU[i] > 0){ USED[i] = owner; USEDL[i] = lid; } if (DU[i] > 0){ DU[i] = 0; q.push(i); } }
    for (let h = 0; h < q.length; h++){ const k = q[h], r = (k / nx) | 0, c = k % nx;
      for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++){ if (!dr && !dc) continue; const rr = r + dr, cc = c + dc; if (rr < 0 || cc < 0 || rr >= ny || cc >= nx) continue; const j = rr * nx + cc, nd = DU[k] + Math.hypot(dr, dc) * cell;
        if (nd < DU[j] && nd <= BESIDE){ DU[j] = nd; q.push(j); if (nd <= BAND && USED[j] < 0){ USED[j] = USED[k]; USEDL[j] = USEDL[k]; } } } } }
  for (const P of PL) if (P.hole){ const circ = LINES.find(l => l.circus && !l.dead && Math.hypot(l.pts[0][0] - P.hole.x - P.hole.r, l.pts[0][1] - P.hole.y) < 2); if (circ){ P.circ = circ; markUsed(circ.pts, P.id, circ.id); } }
  // 2 the links: candidates within a piece; two entries link only across the land (not along its edge)
  const cand = [];
  for (let a = 0; a < PL.length; a++) for (let b = a + 1; b < PL.length; b++){ const A = PL[a], B = PL[b]; if (A.comp !== B.comp) continue; const d = Math.hypot(A.x - B.x, A.y - B.y); if (d > STITCH.MAX_LINK || d < 40) continue;
    // two entries link only across the land, not along its edge (unless their piece of land has no node to link through)
    if (A.kind === 'entry' && B.kind === 'entry'){ const hub = PL.some(C => C.comp === A.comp && C.kind !== 'entry');
      if (hub){ if (d < 400) continue; const m = ci((A.x + B.x) / 2, (A.y + B.y) / 2); if (m < 0 || ED[m] < 80) continue; } else if (d < 150) continue; }
    cand.push([d, a, b]); }
  cand.sort((p, q) => p[0] - q[0]);
  // 3 a route on the grid (A*: 16 moves, the costs above); goal(i) says where it may end
  const MV = []; for (const [dc, dr] of [[1, 0], [0, 1], [-1, 0], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1], [2, 1], [1, 2], [-1, 2], [-2, 1], [-2, -1], [-1, -2], [1, -2], [2, -1]]) MV.push([dc, dr, Math.hypot(dc, dr) * cell, Math.atan2(dr, dc)]);
  const G = new Float64Array(Ncell), PREV = new Int32Array(Ncell);
  function route(A, B, goal, loop){ G.fill(Infinity); PREV.fill(-1); const H = [], hx = B.x, hy = B.y;
    const pushH = (f, i) => { H.push([f, i]); let k = H.length - 1; while (k){ const p = (k - 1) >> 1; if (H[p][0] <= H[k][0]) break; [H[p], H[k]] = [H[k], H[p]]; k = p; } };
    const popH = () => { const t = H[0], l = H.pop(); if (H.length){ H[0] = l; let k = 0; for (;;){ const a = 2 * k + 1, b = a + 1; let m = k; if (a < H.length && H[a][0] < H[m][0]) m = a; if (b < H.length && H[b][0] < H[m][0]) m = b; if (m === k) break; [H[m], H[k]] = [H[k], H[m]]; k = m; } } return t; };
    for (const p of A.ports){ G[p] = 0; pushH(0.95 * Math.hypot(cx(p) - hx, cy(p) - hy), p); }
    let pops = 0;
    while (H.length){ const [f, i] = popH(); const g = G[i]; if (f - 0.95 * Math.hypot(cx(i) - hx, cy(i) - hy) > g + 1e-6) continue;
      if (goal(i) && !A.isPort.has(i)) return i; if (++pops > 400000) return -1;
      const r = (i / nx) | 0, c = i % nx, nearEnds = Math.min(Math.hypot(cx(i) - A.x, cy(i) - A.y), Math.hypot(cx(i) - B.x, cy(i) - B.y)) < 60;
      for (const [dc, dr, L, th] of MV){ const rr = r + dr, cc = c + dc; if (rr < 0 || cc < 0 || rr >= ny || cc >= nx) continue; const j = rr * nx + cc; if (!PASS[j]) continue;
        if (Math.abs(dc) + Math.abs(dr) === 3){ const m = Math.round(r + dr / 2) * nx + Math.round(c + dc / 2); if (!PASS[m]) continue; }
        let cost = L;
        if (ZN[j]){ let za = Math.abs((th - streamAngle(cx(j), cy(j))) * 180 / PI) % 180; za = za > 90 ? 180 - za : za; if (za < STITCH.ZONE_ANGLE) continue; if (!ZN[i]) cost += STITCH.ZONE_COST; }
        const t = TH[i]; if (t === t){ const s = Math.abs(Math.sin(2 * (th - t))); cost *= 1 + (loop === 'through' ? 0.35 : 1) * STITCH.ALIGN * s * (0.3 + 0.7 * CLAR[i]); }
        if (Z) cost += L * STITCH.SLOPE * Math.abs(Z[j] - Z[i]) / L;
        if (ED[j] < 70 && !nearEnds) cost *= 1 + (STITCH.EDGE_COST - 1) * (1 - ED[j] / 70);
        if (!nearEnds){ if (DU[j] <= BAND) cost *= loop === 'through' ? 1.4 : loop ? STITCH.LOOP_AVOID : STITCH.REUSE; else if (DU[j] < BESIDE) cost *= 1 + 0.9 * (1 - (DU[j] - BAND) / (BESIDE - BAND)); }
        const ng = g + cost; if (ng < G[j]){ G[j] = ng; PREV[j] = i; pushH(ng + 0.95 * Math.hypot(cx(j) - hx, cy(j) - hy), j); } } }
    return -1; }
  const pathTo = e => { const out = []; for (let i = e; i >= 0; i = PREV[i]) out.push(i); return out.reverse(); };
  const chaikin = P => { const out = [P[0]]; for (let k = 0; k < P.length - 1; k++){ const a = P[k], b = P[k + 1]; out.push([0.75 * a[0] + 0.25 * b[0], 0.75 * a[1] + 0.25 * b[1]], [0.25 * a[0] + 0.75 * b[0], 0.25 * a[1] + 0.75 * b[1]]); } out.push(P[P.length - 1]); return out; };
  const resample = (P, s) => { const out = [P[0]]; let acc = 0; for (let k = 1; k < P.length; k++){ const a = P[k - 1], b = P[k], L = Math.hypot(b[0] - a[0], b[1] - a[1]); let t = s - acc; while (t <= L){ out.push([a[0] + (b[0] - a[0]) * t / L, a[1] + (b[1] - a[1]) * t / L]); t += s; } acc = L - (t - s); } const e = P[P.length - 1], l = out[out.length - 1]; if (Math.hypot(e[0] - l[0], e[1] - l[1]) > 1) out.push(e); return out; };
  const okPts = (P, raw) => P.every(q => inLand(q[0], q[1]) && !inRail(q[0], q[1]));
  const EDGES = [];   // the links made: [a, b, length]
  // lay a route as a main street, drawn a few points a frame
  function* lay(A, B, cells, endCell, loop, ign){ ign = ign || [];
    let raw = cells.map(i => [cx(i), cy(i)]);
    if (A.kind === 'entry') raw = [A.s0.slice(), [A.x, A.y]].concat(raw);
    else if (A.circ){ const q0 = raw[0], r0 = A.circ.pts.reduce((b, q) => Math.hypot(q[0] - q0[0], q[1] - q0[1]) < Math.hypot(b[0] - q0[0], b[1] - q0[1]) ? q : b, A.circ.pts[0]); raw.unshift(r0.slice()); A.circ.hits = (A.circ.hits || 0) + 1; }
    // the end: on a place's own point, a circus ring or a street already laid
    let endLine = null, endPt = raw[raw.length - 1];
    if (USEDL[endCell] >= 0){ const c = nearB(endPt[0], endPt[1], BAND + 14, -1, ign, null, false, LV1); if (c){ endLine = LINES[c[3]]; endPt = [c[1], c[2]]; raw[raw.length - 1] = endPt; } }
    else if (B.kind === 'entry' && B.isPort.has(endCell)){ raw.push([B.x, B.y], B.s0.slice()); endPt = B.s0; }
    else if (B.circ && B.isPort.has(endCell)){ const r0 = B.circ.pts.reduce((b, q) => Math.hypot(q[0] - endPt[0], q[1] - endPt[1]) < Math.hypot(b[0] - endPt[0], b[1] - endPt[1]) ? q : b, B.circ.pts[0]); raw.push(r0.slice()); endPt = r0; endLine = B.circ; }
    // the grid's staircase simplified (Douglas-Peucker, 14 m, a straight run kept only if it stays on land and off the
    // zones it does not cross square), then rounded (Chaikin, three times, as long as it stays on land)
    const segOK = (a, b) => { const L = Math.hypot(b[0] - a[0], b[1] - a[1]), n = Math.ceil(L / 4); for (let k = 1; k < n; k++){ const x = a[0] + (b[0] - a[0]) * k / n, y = a[1] + (b[1] - a[1]) * k / n; if (!inLand(x, y) || inRail(x, y)) return false; } return true; };
    const rdp = (Q, tol) => { if (Q.length < 3) return Q.slice(); const a = Q[0], b = Q[Q.length - 1], dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy) || 1; let bi = -1, bd = -1;
      for (let k = 1; k < Q.length - 1; k++){ const d = Math.abs((Q[k][0] - a[0]) * dy - (Q[k][1] - a[1]) * dx) / L; if (d > bd){ bd = d; bi = k; } }
      if (bd <= tol && segOK(a, b)) return [a, b]; if (bi < 0) bi = Q.length >> 1; const l1 = rdp(Q.slice(0, bi + 1), tol), l2 = rdp(Q.slice(bi), tol); return l1.slice(0, -1).concat(l2); };
    let P = rdp(raw, loop === 'through' ? 24 : 14); for (let it = 0; it < 3; it++){ const s = chaikin(P); if (!okPts(s)) break; P = s; }
    P = resample(P, 5); if (P.length < 2) return null;
    // (v8.17) where the route runs on a main street already laid (within 12 m) it has joined it: only the parts off the
    // network are laid, each its own street, its ends put on the street it leaves or meets (a T or a crossroads)
    const onEx = P.map(q => !!nearB(q[0], q[1], BAND, -1, ign, null, false, LV1)), runs = []; let cur = null;
    P.forEach((q, k) => { if (!onEx[k]){ if (!cur) cur = { s: k, pts: [] }; cur.pts.push(q); } else if (cur){ cur.e = k; runs.push(cur); cur = null; } }); if (cur){ cur.e = P.length; runs.push(cur); }
    const res = { ok: true, startLine: null, lines: [] };
    // (v8.19) a short stretch on the network between two parts (under 60 m) is the route crossing a street: the two parts
    // are one street running on through it (a crossroads, the street crossed left whole); only a long stretch along a street
    // is the route following the network, and is not laid again
    for (let n = runs.length - 1; n > 0; n--){ const A_ = runs[n - 1], B_ = runs[n]; if (plen(P.slice(A_.e - 1, B_.s + 1)) > 60) continue;
      const mid = P[(A_.e + B_.s) >> 1], c = nearB(mid[0], mid[1], BAND + 14, -1, ign, null, false, LV1); if (c){ addNode(c[1], c[2], true); LINES[c[3]].hits = (LINES[c[3]].hits || 0) + 1; EVENTS.push({ x: c[1], y: c[2], k: 'cross' }); }
      A_.pts = A_.pts.concat(P.slice(A_.e, B_.s), B_.pts); A_.e = B_.e; runs.splice(n, 1); }
    const crossAt = new Map();
    for (const run of runs){ const pts = run.pts.slice();
      for (const [k, at] of [[run.s - 1, 0], [run.e, 1]]){ if (k < 0 || k >= P.length) continue;
        const x = at === 1 ? crossAt.get(run.e) : crossAt.get(-run.s), c = x ? [0, x.pt[0], x.pt[1], x.line] : nearB(P[k][0], P[k][1], BAND + 14, -1, ign, null, false, LV1); if (!c) continue;
        if (at === 0) pts.unshift([c[1], c[2]]); else pts.push([c[1], c[2]]); LINES[c[3]].hits = (LINES[c[3]].hits || 0) + 1; addNode(c[1], c[2], true); if (!x || at === 1) EVENTS.push({ x: c[1], y: c[2], k: x ? 'cross' : 'join' }); }
      if (pts.length < 2 || (plen(pts) < 25 && runs.length > 1)) continue;
      const l = newLine(1, [pts[0], pts[1]], 1, 0, 'stitch'); l.stitched = true; l.ends = ['T', 'T']; res.lines.push(l); if (run.s === 0) res.startLine = l;
      for (let k = 2; k < pts.length; k++){ const a = pts[k - 1], b = pts[k], L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1; l.pts.push(b); hashPt(l, b, (b[0] - a[0]) / L, (b[1] - a[1]) / L); if (k % 3 === 0) yield 1; }
      // culverts where it crosses a watercourse or a corridor
      let inZ = false, z0 = null; for (const q of pts){ const z = inZone(q[0], q[1]); if (z && !inZ) z0 = q; if (!z && inZ && z0) CULVERTS.push({ x: (z0[0] + q[0]) / 2, y: (z0[1] + q[1]) / 2 }); inZ = z; }
      markUsed(pts, A.id, l.id);
      // the side-street buds along it (for step 7), as a grown main street lays them
      { const d2 = v('d2'); let acc = 0, side = l.id % 2 ? 1 : -1;
        for (let k = 1; k < pts.length; k++){ const a = pts[k - 1], b = pts[k], L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1, dx = (b[0] - a[0]) / L, dy = (b[1] - a[1]) / L; acc += L;
          const tM = fieldAtT(b[0], b[1]), along = tM === null || Math.abs(Math.cos(tM) * dx + Math.sin(tM) * dy) >= 0.7071, gap = d2 * o.gapK * (along ? 0.7 + 0.9 * gridAt(CLAR, b[0], b[1]) : 0.75);
          if (acc < gap || k < 6 || pts.length - k < 6) continue;
          const px = -dy * side, py = dx * side; let u = tM === null ? [px, py] : nearestAxis(tM, px, py); if (Math.abs(u[0] * dx + u[1] * dy) > 0.6) u = [px, py];
          BUDS.push({ x: b[0], y: b[1], u, parent: l }); side = -side; acc = 0; } } }
    if (endLine){ endLine.hits = (endLine.hits || 0) + 1; addNode(endPt[0], endPt[1], true); }
    EDGES.push([A.id, B.id, plen(P)]); return res; }
  // the tree
  for (const [, a, b] of cand){ if (find(a) === find(b)) continue; const A = PL[a], B = PL[b], rb = find(b);
    // a link to a node goes all the way to it (through the streets it meets: crossroads); one to an entry may end on the
    // network already joined to it (a T)
    const toNode = B.kind !== 'entry' || A.kind !== 'entry', [S, E] = A.kind === 'entry' && B.kind !== 'entry' ? [A, B] : B.kind === 'entry' && A.kind !== 'entry' ? [B, A] : [A, B], re = find(E.id);
    const end = route(S, E, toNode ? (i => E.isPort.has(i)) : (i => E.isPort.has(i) || (USED[i] >= 0 && find(USED[i]) === re)), false); if (end < 0) continue;
    if (yield* lay(S, E, pathTo(end), end, false)) unite(a, b); }
  // every place joined: one the tree left out (no link it could take) goes to the nearest main street of its land
  { const deg = PL.map(() => 0); for (const [a, b] of EDGES){ deg[a]++; deg[b]++; }
    for (const A of PL){ if (deg[A.id]) continue; if (!USED.some((u, i) => u >= 0 && COMP[i] === A.comp)) continue;
      PHASE = 'main streets: every entry joined';
      const end = route(A, A, i => USED[i] >= 0 && COMP[i] === A.comp, false); if (end < 0) continue; const B = PL[USED[end]] || A;
      if (yield* lay(A, B, pathTo(end), end, false)) deg[A.id]++; } }
  // (v8.16) the local nodes (neighbourhood centres) on the main network: each joined by two main streets from two sides,
  // so it sits on a street that runs through it (the first to the nearest main street, the second away from the first)
  for (const a of attractorsOn()){ if (a.main) continue; const port = nearPass(a.x, a.y, 40); if (port < 0) continue;
    const S = { kind: 'sec', x: a.x, y: a.y, ports: [port], id: PL.length, comp: COMP[port] }; S.isPort = new Set(S.ports); PL.push(S); UF.push(S.id);
    if (!USED.some((u, i) => u >= 0 && COMP[i] === S.comp)) continue;
    PHASE = 'main streets: the local centres joined';
    const e1 = route(S, S, i => USED[i] >= 0 && COMP[i] === S.comp, false); if (e1 < 0) continue;
    const B1 = PL[USED[e1]] || S, r1 = yield* lay(S, B1, pathTo(e1), e1, false); if (!r1) continue;
    const x1 = cx(e1), y1 = cy(e1), d1 = Math.hypot(x1 - S.x, y1 - S.y), first = r1.startLine ? r1.startLine.id : -2;
    const e2 = route(S, S, i => USED[i] >= 0 && COMP[i] === S.comp && USEDL[i] !== first && Math.hypot(cx(i) - x1, cy(i) - y1) > Math.max(150, d1) && ((cx(i) - S.x) * (x1 - S.x) + (cy(i) - S.y) * (y1 - S.y)) < 0, true);
    // failing the far side, any side at least 60 degrees round from the first link (never back along it)
    let e2x = e2; if (e2x < 0){ const ax = x1 - S.x, ay = y1 - S.y, aL = Math.hypot(ax, ay) || 1;
      e2x = route(S, S, i => { if (!(USED[i] >= 0 && COMP[i] === S.comp && USEDL[i] !== first)) return false; const bx = cx(i) - S.x, by = cy(i) - S.y, bL = Math.hypot(bx, by) || 1; return (ax * bx + ay * by) / (aL * bL) < 0.5 && Math.hypot(cx(i) - x1, cy(i) - y1) > 120; }, true); }
    // the two links made one street through the node (so no pass sees an end there)
    const r2 = e2x >= 0 ? yield* lay(S, PL[USED[e2x]] || S, pathTo(e2x), e2x, true, first >= 0 ? [first] : []) : null;   // (its start, on the first link at the node, is not 'on the network')
    if (r2 && r1.startLine && r2.startLine){ const l1 = r1.startLine, l2 = r2.startLine;
      const pts = l1.pts.slice().reverse().concat(l2.pts.slice(1)); l2.dead = true; l1.pts = []; for (let k = 0; k < pts.length; k++){ const a = pts[Math.max(0, k - 1)], b = pts[k], L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1; l1.pts.push(b); hashPt(l1, b, (b[0] - a[0]) / L, (b[1] - a[1]) / L); }
      l1.ends = ['T', 'T']; l1.through = true; rehashAll(); } }
  // (v8.19) THROUGH ROUTES, in place of the grown contour avenues: main streets right across the land, edge to edge, from
  // one entry (or a gate on the edge) to one on the far side, wherever no main street already runs alongside within 0.75 x
  // the main spacing. Each crosses the streets it meets (crossroads), so the network is a net and not a tree
  if ($('bMains').checked){ const d1 = v('d1'), gap = 0.75 * d1;
    // the gates: points on each piece's outer edge every 40 m, at least 60 m from an entry (the outside's roads come first)
    const ends = PL.filter(P => P.kind === 'entry').map(P => ({ P, n: P.n }));
    for (const p of D.pieces){ const R = p.outer; let acc = 0;
      for (let k = 1; k < R.length; k++){ const a = R[k - 1], b = R[k], L = Math.hypot(b[0] - a[0], b[1] - a[1]); if (L < 1e-6) continue; const tx = (b[0] - a[0]) / L, ty = (b[1] - a[1]) / L;
        for (let t = (40 - acc) % 40; t < L; t += 40){ const x = a[0] + tx * t, y = a[1] + ty * t; let nxv = -ty, nyv = tx; if (!inLand(x + nxv * 20, y + nyv * 20)){ nxv = -nxv; nyv = -nyv; } if (!inLand(x + nxv * 20, y + nyv * 20)) continue;
          const sx = x + nxv * 12, sy = y + nyv * 12; if (inRail(sx, sy) || alongRail(sx, sy, nxv, nyv) || PL.some(P => P.kind === 'entry' && Math.hypot(P.x - sx, P.y - sy) < 60)) continue;
          const port = nearPass(sx, sy, 15); if (port < 0) continue;
          const G = { kind: 'entry', gate: true, x: sx, y: sy, ports: [port], s0: [x, y], n: [nxv, nyv], id: PL.length, comp: COMP[port] }; G.isPort = new Set(G.ports); ends.push({ P: G, n: G.n }); }
        acc = (acc + L) % 40; } }
    // the pairs: on far sides (inward directions opposed), at least 500 m apart, the straight line between them over land
    const pairs = [];
    for (let i = 0; i < ends.length; i++) for (let j = i + 1; j < ends.length; j++){ const A = ends[i], B = ends[j]; if (A.P.comp !== B.P.comp) continue;
      const d = Math.hypot(A.P.x - B.P.x, A.P.y - B.P.y); if (d < 500) continue; const ux = (B.P.x - A.P.x) / d, uy = (B.P.y - A.P.y) / d;
      if (A.n[0] * B.n[0] + A.n[1] * B.n[1] > -0.3 || A.n[0] * ux + A.n[1] * uy < 0.4 || -(B.n[0] * ux + B.n[1] * uy) < 0.4) continue;
      let land = 0; for (let k = 1; k < 10; k++){ const x = A.P.x + ux * d * k / 10, y = A.P.y + uy * d * k / 10; if (inLand(x, y)) land++; } if (land < 8) continue;
      if ([0.25, 0.5, 0.75].some(f => { const m = ci(A.P.x + ux * d * f, A.P.y + uy * d * f); return m < 0 || ED[m] < 80; })) continue;   // (across the land, not along its edge)
      pairs.push([d * (A.P.gate ? 1 : 1.15) * (B.P.gate ? 1 : 1.15), A.P, B.P, ux, uy, d]); }   // (entries preferred: they meet the outside's roads)
    pairs.sort((p, q) => q[0] - p[0]);
    let made = 0; const maxThrough = 8;
    for (const [, A, B, ux, uy, d] of pairs){ if (made >= maxThrough) break;
      // a main street alongside the planned line, within 0.75 x the spacing, at a quarter, half or three quarters of the way: skip
      if ([0.25, 0.5, 0.75].some(f => nearB(A.x + ux * d * f, A.y + uy * d * f, gap, -1, [], [ux, uy], true, LV1))) continue;
      for (const P of [A, B]) if (P.gate && !PL.includes(P)){ P.id = PL.length; PL.push(P); UF.push(P.id); }
      PHASE = 'main streets: through routes across the land';
      const end = route(A, B, i => B.isPort.has(i), 'through'); if (end < 0) continue;
      if (yield* lay(A, B, pathTo(end), end, 'through')) made++; } }
  // an entry still alone (its piece of land too small, or nothing to reach) grows into the land along the field, as before
  { const deg = PL.map(() => 0); for (const [a, b] of EDGES){ deg[a]++; deg[b]++; } let grew = false;
    for (const A of PL){ if (A.kind !== 'entry' || deg[A.id]) continue; const t = fieldAtT(A.x, A.y), u = (t === null || A.station) ? A.n : nearestAxis(t, A.n[0], A.n[1]);
      addNode(A.s0[0], A.s0[1]); const l = newLine(1, [A.s0.slice(), [A.x, A.y]], u[0], u[1], 'anchor'); newTip(l, A.x, A.y, u[0], u[1], { L: 12, through: $('bMains').checked }); grew = true; }
    if (grew){ PHASE = 'main streets grow from your anchors'; yield* runTips(o); } }
  // the loops: where the tree's way between two places is over twice the direct distance
  const netDist = (s, t) => { const dist = PL.map(() => Infinity); dist[s] = 0; const seen = new Set(); for (;;){ let u = -1, bd = Infinity; dist.forEach((d, k) => { if (!seen.has(k) && d < bd){ bd = d; u = k; } }); if (u < 0 || u === t) break; seen.add(u);
    for (const [a, b, L] of EDGES){ const w = a === u ? b : b === u ? a : -1; if (w >= 0 && dist[u] + L < dist[w]) dist[w] = dist[u] + L; } } return dist[t]; };
  let loops = 0; const maxLoops = Math.max(1, Math.round(PL.length / 3));
  for (const [d, a, b] of cand){ if (loops >= maxLoops) break; if (d < 200 || d > 1200) continue; const A = PL[a], B = PL[b];
    if (PL.some((C, k) => k !== a && k !== b && (C.x - A.x) ** 2 + (C.y - A.y) ** 2 + (C.x - B.x) ** 2 + (C.y - B.y) ** 2 < d * d)) continue;   // a Gabriel link only
    const nd = netDist(a, b); if (nd < STITCH.LOOP_RATIO * d) continue;
    PHASE = 'main streets: a second way where the network detours';
    const end = route(A, B, i => B.isPort.has(i) || (USED[i] >= 0 && Math.hypot(cx(i) - B.x, cy(i) - B.y) < 80), true); if (end < 0) continue;
    if (yield* lay(A, B, pathTo(end), end, true)) loops++; }
  rehashAll(); netDirty = widthDirty = true; }
function* growBranching(){
  resetNet(); const o = { memK: 1.5 - v('bMem') / 100, gapK: v('bGap'), forkT: v('bFork'), phase: 1, mainsT: $('bMains').checked, sec6: $('bSec6').checked };
  // (v8.15) the main streets: stitched (a planned network linking the entries and the nodes) or grown from the anchors
  if (($('mMethod') || {}).value === 'stitch') yield* stitchMains(o); else {
  PHASE = 'main streets grow from your anchors';
  for (const a of D.anchors) for (const p of D.pieces){ if (p.parcel !== a.parcel) continue; const q = [p.outer, ...p.holes].map(r => nearestOnRing(r, a.x, a.y)).reduce((b, c) => c.d < b.d ? c : b); if (q.d > 150) continue;
    let nxv = -q.ty, nyv = q.tx; if (!inLand(q.x + nxv * 20, q.y + nyv * 20)){ nxv = -nxv; nyv = -nyv; } if (!inLand(q.x + nxv * 20, q.y + nyv * 20)) continue;
    const rp = nearB(q.x, q.y, 6, -1, [], null, false, LV0), s0 = rp ? [rp[1], rp[2]] : [q.x, q.y];
    // (a street from the station's side leaves it square, whatever the field says there)
    const sx = q.x + nxv * 12, sy = q.y + nyv * 12, t = fieldAtT(sx, sy), u = (t === null || a.station) ? [nxv, nyv] : nearestAxis(t, nxv, nyv);
    if (alongRail(sx, sy, u[0], u[1])) continue;
    addNode(s0[0], s0[1]); const l = newLine(1, [s0, [sx, sy]], u[0], u[1], 'anchor'); newTip(l, sx, sy, u[0], u[1], { L: 12, through: $('bMains').checked }); }
  yield* runTips(o); }
  if ($('bMains').checked){ const d1 = v('d1'), angD = (a, b) => Math.abs((((a - b) % (2 * PI)) + 3 * PI) % (2 * PI) - PI);
    // contour avenues, edge to edge: from the clearest ground first, wherever no main street runs alongside within 0.75 x d1
    // (v8.19) with the stitched method these only fill the gaps the through routes left (no main street within 0.75 x d1)
    {
    PHASE = 'main streets along the contour, edge to edge';
    const seeds = gridSeeds(d1, [0], true).map(q => [q[0], q[1], gridAt(CLAR, q[0], q[1])]).sort((a, b) => b[2] - a[2]);
    for (const [sx, sy] of seeds){ if (inZone(sx, sy)) continue; const t = fieldAtT(sx, sy); if (t === null) continue; const u = [Math.cos(t), Math.sin(t)];
      if (nearB(sx, sy, d1 * 0.75, -1, [], u, true, LV1) || nearB(sx, sy, 25, -1, [], null, false, null)) continue;
      const l1 = newLine(1, [[sx, sy]], u[0], u[1], 'avenue'), l2 = newLine(1, [[sx, sy]], -u[0], -u[1], 'avenue'); l1.ends[1] = 'J'; l2.ends[1] = 'J';
      newTip(l1, sx, sy, u[0], u[1], { through: true, ig: [{ id: l2.id, until: 1e9 }] }); newTip(l2, sx, sy, -u[0], -u[1], { through: true, ig: [{ id: l1.id, until: 1e9 }] });   // two halves of one street
      yield* runTips(o); } }
    // each whole circus tied in by up to three main streets, out along the field's radial direction, as far from the others as can be
    PHASE = 'each circus tied into the main streets';
    for (const h of HOLES){ if (h.edge) continue; const circ = LINES.find(l => l.circus && !l.dead && Math.hypot(l.pts[0][0] - h.x - h.r, l.pts[0][1] - h.y) < 2); if (!circ) continue;
      const tried = [], ids = new Set();
      for (const l of LINES){ if (l.dead || l.level !== 1 || l.circus) continue; for (const p of [l.pts[0], l.pts[l.pts.length - 1]]) if (Math.hypot(p[0] - h.x, p[1] - h.y) < h.r + 8){ tried.push(Math.atan2(p[1] - h.y, p[0] - h.x)); ids.add(l.id); } }
      for (let n = 0; n < 8 && ids.size < 3; n++){ let best = 0, bd = -1;
        for (let a = 0; a < 36; a++){ const ang = a * PI / 18, dm = tried.length ? Math.min(...tried.map(m => angD(ang, m))) : PI; if (dm > bd){ bd = dm; best = ang; } }
        if (bd < 60 * PI / 180) break; tried.push(best);
        const ux = Math.cos(best), uy = Math.sin(best), px = h.x + ux * (h.r + 20), py = h.y + uy * (h.r + 20); if (!inLand(px, py) || inZone(px, py)) continue;
        const t = fieldAtT(px, py), u = t === null ? [ux, uy] : nearestAxis(t, ux, uy); if (u[0] * ux + u[1] * uy < 0.8) continue;
        const s0 = circ.pts.reduce((b, q) => Math.hypot(q[0] - h.x - ux * h.r, q[1] - h.y - uy * h.r) < Math.hypot(b[0] - h.x - ux * h.r, b[1] - h.y - uy * h.r) ? q : b, circ.pts[0]);
        const l = newLine(1, [s0.slice()], u[0], u[1], 'spoke'); newTip(l, s0[0], s0[1], u[0], u[1], { through: true, ig: [{ id: circ.id, until: 1e9 }] });
        ids.add(l.id); circ.hits = (circ.hits || 0) + 1; EVENTS.push({ x: s0[0], y: s0[1], k: 'spoke' }); yield* runTips(o); } } }
  // (v7) ring streets round each whole circus, before the second streets (which then end on them): a circle of the given
  // radius, kept where it is on land and off the rail, in arcs; an arc under 60 m dropped; an arc's end within 12 m of a
  // road's edge put on it
  if (RINGS.length){ PHASE = 'ring streets round the circuses';
    for (const h of HOLES){ if (h.edge) continue;
      for (const rg of RINGS){ const n = Math.ceil(2 * PI * rg.r / 4), pts = [];
        for (let k = 0; k < n; k++){ const a = 2 * PI * k / n; pts.push([h.x + rg.r * Math.cos(a), h.y + rg.r * Math.sin(a)]); }
        const ok = pts.map(q => inLandNoHoles(q[0], q[1]) && !inRail(q[0], q[1]));
        let k0 = ok.indexOf(false); const runs = [];
        if (k0 < 0){ runs.push(pts.concat([pts[0]])); runs[0].closed = true; }
        else { let run = [];
          for (let j = 1; j <= n; j++){ const k = (k0 + j) % n; if (ok[k]) run.push(pts[k]); else { if (run.length) runs.push(run); run = []; } }
          if (run.length) runs.push(run); }
        for (const run of runs){ if (plen(run) < 60) continue;
          for (const e of [0, 1]){ const q = e === 0 ? run[0] : run[run.length - 1], c = nearB(q[0], q[1], 12, -1, [], null, false, LV0); if (c){ if (e === 0) run.unshift([c[1], c[2]]); else run.push([c[1], c[2]]); } }
          // (a whole ring, closed, is kept whole as the circus is: no pass cuts it or turns it second)
          const l = newLine(rg.level, run, 1, 0, 'ring'); l.ends = ['T', 'T']; l.ringStreet = true; if (run.closed) l.circus = true; } } }
    rehashAll(); }
  if (o.sec6){
    // v6's second streets, as they were: off the main streets, off the land's edge, the empty ground reached from the
    // nearest street, every end met; then the main streets' last word (each ends on a main street). No clean-up passes
    PHASE = 'the main streets carried on across the road between the cells'; yield* crossShared(o, 1);
    PHASE = 'second streets branch off them'; o.phase = 2;
    for (const b of BUDS){ if (b.parent.dead) continue; if (canBranch6(b.x, b.y, b.u, b.parent.id)) spawn(b.parent, b.x, b.y, b.u, 'branch', null); }
    yield* runTips(o);
    PHASE = "side streets off the land's edge, where there is room";
    for (const l of LINES.slice()){ if (!l.ring || l.hole) continue; const Pp = l.pts; let acc = 0;
      for (let k = 1; k < Pp.length; k++){ const a = Pp[k - 1], b = Pp[k]; acc += Math.hypot(b[0] - a[0], b[1] - a[1]);
        if (acc < v('d2') * o.gapK * (0.75 + 0.6 * gridAt(CLAR, b[0], b[1]))) continue;
        const dx = b[0] - a[0], dy = b[1] - a[1], n = Math.hypot(dx, dy) || 1; let px = -dy / n, py = dx / n;
        if (!inLand(b[0] + px * 15, b[1] + py * 15)){ px = -px; py = -py; } if (!inLand(b[0] + px * 15, b[1] + py * 15)) continue;
        const t = fieldAtT(b[0] + px * 10, b[1] + py * 10), u = t === null ? [px, py] : nearestAxis(t, px, py); if (u[0] * px + u[1] * py < 0.5) continue;
        if (canBranch6(b[0], b[1], u, l.id) && spawn(l, b[0], b[1], u, 'edge-branch', null)) acc = 0; } }
    yield* runTips(o);
    if ($('bInfill').checked){ PHASE = 'empty ground reached from the nearest street'; const d2 = v('d2'), sp = d2 * 0.5;
      for (let round = 0; round < 3; round++){ let made = 0;
        for (let x = sp / 2; x < D.w; x += sp) for (let y = sp / 2; y < D.h; y += sp){ if (!inLand(x, y) || inZone(x, y) || inRail(x, y) || nearB(x, y, d2 * 0.6, -1, [], null, false, null)) continue;
          const c = nearB(x, y, d2 * 2.5, -1, [], null, false, null); if (!c) continue; const par = LINES[c[3]];
          let ux = x - c[1], uy = y - c[2]; const m = Math.hypot(ux, uy) || 1; ux /= m; uy /= m; const t = fieldAtT(c[1], c[2]), u = t === null ? [ux, uy] : nearestAxis(t, ux, uy);
          if (!canBranch6(c[1], c[2], u, par.id) || !spawn(par, c[1], c[2], u, 'infill', null)) continue; made++; yield* runTips(o); }
        if (!made) break; } }
    PHASE = 'the second streets carried on across the road between the cells'; yield* crossShared(o, 2);
    TIPS = []; TIPMAP = new Map(); BUDS = [];
    yield* closeGen6(); holeTrim();
    yield* mainsEnd(); mainsFinal(); despike();
    for (const l of LINES) if (!l.dead && l.level === 2 && plen(l.pts) < 1) l.dead = true;   // (a side street that never grew: a point on its parent)
    // (v7) a main street left under 150 m long (a stub where the rest was cut or turned second) is a second street
    for (const l of LINES) if (!l.dead && l.level === 1 && !l.circus && l.born !== 'spoke' && plen(l.pts) < 150) l.level = 2;   // (a circus's spoke stays a main street, however short)
    holeTrim(); dropSide(); holeTrim(); alignShared(); splitBlocks(1.5); holeTrim(); roundKinks();
    rehashAll();
    PHASE = 'done'; FINISHED = true; readCells(); measures(); finishRun(); return; }
  PHASE = 'second streets branch off them'; o.phase = 2;
  for (const b of BUDS){ if (b.parent.dead) continue; if (canBranch(b.x, b.y, b.u, b.parent.id)) spawn(b.parent, b.x, b.y, b.u, 'branch', null); }
  yield* runTips(o);
  PHASE = 'side streets off the land\'s edge, where there is room';
  for (const l of LINES.slice()){ if (!l.ring || l.hole) continue; const Pp = l.pts; let acc = 0;
    for (let k = 1; k < Pp.length; k++){ const a = Pp[k - 1], b = Pp[k]; acc += Math.hypot(b[0] - a[0], b[1] - a[1]);
      if (acc < v('d2') * o.gapK * (0.75 + 0.6 * gridAt(CLAR, b[0], b[1]))) continue;
      const dx = b[0] - a[0], dy = b[1] - a[1], n = Math.hypot(dx, dy) || 1; let px = -dy / n, py = dx / n;
      if (!inLand(b[0] + px * 15, b[1] + py * 15)){ px = -px; py = -py; } if (!inLand(b[0] + px * 15, b[1] + py * 15)) continue;
      const t = fieldAtT(b[0] + px * 10, b[1] + py * 10), u = t === null ? [px, py] : nearestAxis(t, px, py); if (u[0] * px + u[1] * py < 0.8) continue;   // the field runs along the edge here
      if (canBranch(b[0], b[1], u, l.id) && spawn(l, b[0], b[1], u, 'edge-branch', null)) acc = 0; } }
  yield* runTips(o);
  // streets stopped for running alongside another go back to their last junction; the ground left empty is reached from the
  // nearest street, and tidied again (twice)
  tidyNear();
  for (let r = 0; r < 2; r++){ if ($('bInfill').checked) yield* infillGen(o); tidyNear(); }
  TIPS = []; TIPMAP = new Map(); BUDS = [];
  yield* closeGen(); rehashAll();
  yield* mainsEnd();
  // no two streets side by side: cut, join the main streets up again, until none is left; then the ground opened up is
  // reached again from the nearest street, and the last pass leaves no second street side by side and no open end
  for (let it = 0; it < 4; it++){ PHASE = 'no two streets side by side'; const n = cutSide(false); yield 1; if (!n) break; yield* mainsEnd(); yield* sweepOpen(); }
  if ($('bInfill').checked){ yield* infillGen(o); tidyNear(); TIPS = []; TIPMAP = new Map(); yield* closeGen(); rehashAll(); yield* sweepOpen(); }
  for (let it = 0; it < 5; it++){ PHASE = 'no two streets side by side'; const n = cutSide(true); yield* sweepOpen(); if (!n) break; }
  dropStubs(); yield* sweepOpen();
  // the last word on the main streets: one still ending on a second street ends at its last main junction instead
  // (repeated until nothing changes: a main street split here can leave another ending on a second street); then the
  // side-by-side pass again, twice at most, with this after it
  for (let round = 0; round < 8; round++){
    mainsFinal(); rehashAll(); if (dropStubs()) yield* sweepOpen(); rehashAll();
    const n = cutSide(true); if (!n) break; yield* sweepOpen(); }
  // the last word: cut what is left side by side, and close any open end by cutting it back only (which can make neither
  // a new pair nor a new open end); then the main streets end on main streets
  for (let k = 0; k < 4; k++){ rehashAll(); const n = cutSide(true), st = dropStubs(); if (!n && !st) break; yield* sweepOpen(true); }
  mainsFinal(); despike(); rehashAll();
  PHASE = 'done'; FINISHED = true; readCells(); measures(); finishRun(); }
function* infillGen(o){ { PHASE = 'empty ground reached from the nearest street'; const d2 = v('d2'), sp = d2 * 0.5;
    for (let round = 0; round < 3; round++){ let made = 0;
      for (let x = sp / 2; x < D.w; x += sp) for (let y = sp / 2; y < D.h; y += sp){ if (!inLand(x, y) || inZone(x, y) || inRail(x, y) || nearB(x, y, d2 * 0.6, -1, [], null, false, null)) continue;
        const c = nearB(x, y, d2 * 2.5, -1, [], null, false, null); if (!c) continue; const par = LINES[c[3]];
        let ux = x - c[1], uy = y - c[2]; const m = Math.hypot(ux, uy) || 1; ux /= m; uy /= m; const t = fieldAtT(c[1], c[2]), u = t === null ? [ux, uy] : nearestAxis(t, ux, uy);
        if (!canBranch(c[1], c[2], u, par.id) || !spawn(par, c[1], c[2], u, 'infill', null)) continue; made++; yield* runTips(o); }
      if (!made) break; } }
}
function* mainsEnd(){
  // a long second street running from a main street (or the edge) to another acts as a main street: it becomes one
  if ($('bMains').checked){ const d1 = v('d1'), onMain = (p, id) => !!near(p[0], p[1], 1.5, null, false, LV01, id);
    for (let pass = 0; pass < 2; pass++) for (const l of LINES){ if (l.dead || l.level !== 2 || plen(l.pts) < 1.4 * d1) continue;
      if (onMain(l.pts[0], l.id) && onMain(l.pts[l.pts.length - 1], l.id) && !alongsideMain(l)){ l.level = 1; l.promoted = true; } }
    // every main street ends on a main street, a circus or the edge: one that ends on a second street carries on along the
    // field (crossing second streets, turning 5 degrees a step at most) to the next main street or the edge
    PHASE = 'every main street ends on a main street';
    for (const l of LINES){ if (l.dead || l.level !== 1 || l.circus || l.pts.length < 2) continue;
      for (const side of [0, 1]){ const Pp = l.pts, end = side === 0 ? Pp[Pp.length - 1] : Pp[0];
        if (near(end[0], end[1], 2.5, null, false, LV01, l.id) || Pp.slice(5, -5).some(q => Math.hypot(q[0] - end[0], q[1] - end[1]) < 2.5)) continue;
        if (extendEnd(l, side, 500, LV01)){ l.extended = (l.extended || 0) + 1; continue; }
        // it cannot carry on: the second street it ends on carries the main route on, if that street runs on to a main street or the edge
        const c = near(end[0], end[1], 2.5, null, false, null, l.id), s2 = c && LINES[c[3]]; if (!s2 || s2.level !== 2) continue;
        const on1 = p => !!near(p[0], p[1], 2.5, null, false, LV01, s2.id); if ((on1(s2.pts[0]) || on1(s2.pts[s2.pts.length - 1])) && !alongsideMain(s2)){ s2.level = 1; s2.promoted = true; continue; }
        // nothing carries it on: its last stretch, from its last main junction, becomes a second street (the main ends on a main)
        splitDemote(l, side); } }
    netDirty = widthDirty = true; }
  yield 1; }

/* ------------------------------------------------------------------ the two modes kept, and compared */
function settingsKey(){ return (KPULL ? 'k' + KPULL.main + ':' + KPULL.sec + ':' + KPULL.edge + ',' : '') + FIELD_IDS.concat(NET_IDS, B_IDS).map(id => $(id).value).join(',') + ',' + $('windOn').checked + ',' + $('merge').checked + ',' + $('bInfill').checked + ',' + $('bMains').checked + ',' + $('bSec6').checked + ',' + MONTH + ',' + (floodOn() ? 'f' + $('fAvoid').value + ':' + v('fW') : 'f0') + ',' + (corrOn() ? 'g' + v('gW') + ':' + $('gQ').value : 'g0') + ',' + AMODE + ',' + ATTR.map(a => Math.round(a.x) + ':' + Math.round(a.y)).join(';'); }
function finishRun(){
  if (MODE === 'A'){ EVENTS = []; for (const l of LINES){ if (l.dead || l.level === 0 || l.circus) continue; const Pp = l.pts;
      l.ends.forEach((e, sd) => { const p = sd === 0 ? Pp[Pp.length - 1] : Pp[0]; if (e === 'T') EVENTS.push({ x: p[0], y: p[1], k: 'join' }); if (e === 'Y') EVENTS.push({ x: p[0], y: p[1], k: 'merge' }); }); } }
  for (const q of MEAS.xpts) EVENTS.push({ x: q[0], y: q[1], k: 'cross' });
  METR = metrics();
  SNAP[MODE] = { key: settingsKey(), m: METR, culverts: CULVERTS.slice(), events: EVENTS.slice(), holes: HOLES.slice(),
    lines: LINES.filter(l => !l.dead).map(l => ({ level: l.level, fam: l.fam, pts: l.pts.map(p => p.slice()), ends: l.ends.slice(), circus: !!l.circus, ring: !!l.ring, hits: l.hits || 0, born: l.born, flood: !!l.flood })) };
  drawCmp(); }
function restore(sn){ GEN = null; GROWING = false; LINES = []; HASH = new Map(); TIPS = []; TIPMAP = new Map(); GROW = null; GHOST = null;
  for (const l of sn.lines) addLine({ level: l.level, fam: l.fam, pts: l.pts.map(p => p.slice()), ends: l.ends.slice(), circus: l.circus, ring: l.ring, hits: l.hits, born: l.born, flood: l.flood });
  CULVERTS = sn.culverts.slice(); EVENTS = sn.events.slice(); HOLES = sn.holes.slice(); buildMask(); FINISHED = true; readCells(); measures(); METR = sn.m;
  netDirty = widthDirty = baseDirty = true; }
function setMode(m){ if (GEN){ GEN = null; GROWING = false; } MODE = m; const sn = SNAP[m];
  if (sn && sn.key === settingsKey()) restore(sn); else start(true); syncTools(); drawCmp(); }
function compareBoth(){ SIM = null; GHOST = null; $('bSimPause').textContent = 'Pause'; settleField();
  MODE = 'A'; start(false); MODE = 'B'; start(false); $('lOther').checked = true; netDirty = widthDirty = baseDirty = true; syncTools(); drawCmp(); }
function setUnder(u){ UNDER = u; UNDERIMG = null; baseDirty = true; syncTools(); drawKey(); }
function landArea(){ return D.pieces.reduce((s_, p) => s_ + Math.abs(polyArea(p.outer)), 0); }
// junctions round each cell: every junction (a street's end on another, a crossing) counted for each cell it touches
function cellSides(){ if (!CELLS) return null; const { lab, W, H, c, areas } = CELLS, cnt = new Map(), seen = new Set(), nodes = [];
  const add = p => { const key = Math.round(p[0] / 8) + ',' + Math.round(p[1] / 8); if (seen.has(key)) return; seen.add(key); nodes.push(p); };
  for (const l of LINES){ if (l.dead || l.level === 0 || l.circus) continue; const Pp = l.pts; if (l.ends[0] === 'T' || l.ends[0] === 'Y') add(Pp[Pp.length - 1]); if (l.ends[1] === 'T' || l.ends[1] === 'Y') add(Pp[0]); }
  for (const q of MEAS.xpts) add(q);
  for (const p of nodes){ const ls = new Set();
    for (const r of [12, 18, 26]) for (let a = 0; a < 16; a++){ const x = p[0] + r * Math.cos(a * PI / 8), y = p[1] + r * Math.sin(a * PI / 8), cx = Math.floor(x / c), cy = Math.floor((D.h - y) / c);
      if (cx < 0 || cy < 0 || cx >= W || cy >= H) continue; const L_ = lab[cy * W + cx]; if (L_ >= 0) ls.add(L_); }
    for (const L_ of ls) cnt.set(L_, (cnt.get(L_) || 0) + 1); }
  const out = { 3: 0, 4: 0, 5: 0, 6: 0, '7+': 0 }; let n = 0;
  areas.forEach((a, i) => { if (a < 0.05) return; const s_ = cnt.get(i) || 0; out[s_ <= 3 ? 3 : s_ >= 7 ? '7+' : s_]++; n++; });
  for (const k in out) out[k] = n ? 100 * out[k] / n : 0; return out; }
function metrics(){ const M = MEAS; let Ls = 0, Cs = 0, al = 0, alL = 0;
  for (const l of LINES){ if (l.dead || l.level === 0 || l.circus) continue; const Pp = l.pts, L = plen(Pp), ch = Math.hypot(Pp[Pp.length - 1][0] - Pp[0][0], Pp[Pp.length - 1][1] - Pp[0][1]);
    if (ch > 30){ Ls += L; Cs += ch; }
    for (let k = 1; k < Pp.length; k++){ const a = Pp[k - 1], b = Pp[k], sl = Math.hypot(b[0] - a[0], b[1] - a[1]); if (sl < 0.5) continue; const t = fieldAtT((a[0] + b[0]) / 2, (a[1] + b[1]) / 2); if (t === null) continue;
      let dd = Math.abs(Math.atan2(b[1] - a[1], b[0] - a[0]) - t) % (PI / 2); dd = Math.min(dd, PI / 2 - dd); al += dd * sl; alL += sl; } }
  let area = 0; for (const st of streetWidths()) for (let k = 1; k < st.pts.length; k++) area += Math.hypot(st.pts[k][0] - st.pts[k - 1][0], st.pts[k][1] - st.pts[k - 1][1]) * st.w[k];
  return { km1: M.km1, km2: M.km2, dens: M.dens, T: M.T, Y: M.Y, X: M.X, loose: M.loose, sin: Cs ? Ls / Cs : 1, align: alL ? al / alL * 180 / PI : 0, cells: M.cellsN, med: M.med, sides: cellSides(), road: 100 * area / landArea() }; }
const CMP_ROWS = [['-', 'the streets'], ['km1', 'main, km', 1], ['km2', 'second, km', 1], ['dens', 'km per km²', 1], ['road', 'land in streets, %', 0], ['sin', 'sinuosity (length ÷ chord)', 2], ['align', 'off the field, ° (mean)', 1],
  ['-', 'the junctions'], ['T', 'T, %', 0], ['Y', 'Y, %', 0], ['X', 'X, %', 0], ['loose', 'dead ends', 0],
  ['-', 'the cells'], ['cells', 'cells', 0], ['med', 'median, ha', 2], ['s3', '3 junctions round (or fewer), %', 0], ['s4', '4, %', 0], ['s5', '5, %', 0], ['s6', '6, %', 0], ['s7', '7 or more, %', 0]];
function drawCmp(){ const key = settingsKey(), col = m => { const sn = SNAP[m]; if (!sn) return null; const r = Object.assign({}, sn.m); if (sn.m.sides){ r.s3 = sn.m.sides[3]; r.s4 = sn.m.sides[4]; r.s5 = sn.m.sides[5]; r.s6 = sn.m.sides[6]; r.s7 = sn.m.sides['7+']; } r.stale = sn.key !== key; return r; };
  const A = col('A'), B = col('B'), f = (r, k, d) => r ? '<td class="' + (r.stale ? 'stale' : '') + '">' + (+r[k]).toFixed(d) + '</td>' : '<td class="stale">–</td>';
  let h = '<tr><th></th><th class="' + (MODE === 'A' ? 'cur' : '') + '">A · today</th><th class="' + (MODE === 'B' ? 'cur' : '') + '">B · branching</th></tr>';
  for (const [k, lab, d] of CMP_ROWS) h += k === '-' ? '<tr class="gap"><td colspan="3">' + lab + '</td></tr>' : '<tr><td>' + lab + '</td>' + f(A, k, d) + f(B, k, d) + '</tr>';
  $('cmp').innerHTML = h;
  $('cmpNote').textContent = (A && A.stale) || (B && B.stale) ? 'Grey: grown with other settings. "Grow both and compare" grows both in the same field.' : (A && B ? 'Both grown in the same field. Junctions round a cell are counted from the raster: close, not exact.' : ''); }
function drawUnder(g){ if (!CLAR) return;
  if (!UNDERIMG){ const oc = mk(); oc.width = nx; oc.height = ny; const gg = oc.getContext('2d'), im = gg.createImageData(nx, ny), te = P.uTeal, or = P.uOrange;
    for (let r = 0; r < ny; r++) for (let c = 0; c < nx; c++){ const i = r * nx + c, o = 4 * ((ny - 1 - r) * nx + c); let col = null, a = 0;
      if (UNDER === 'clarity'){ a = clamp((CLAR[i] - 0.2) / 0.8, 0, 1) * 0.8; col = te; }
      else if (UNDER === 'conflict'){ a = clamp(CONF[i] / 0.45, 0, 1) * 0.85; col = or; }
      else if (CONF[i] > 0.25){ a = 0.5; col = or; } else if (CLAR[i] > 0.7 && CONF[i] < 0.15){ a = 0.4; col = te; }
      if (col){ im.data[o] = col[0]; im.data[o + 1] = col[1]; im.data[o + 2] = col[2]; im.data[o + 3] = Math.round(255 * a * (THEME === 'dark' ? 0.34 : 0.42)); } }
    gg.putImageData(im, 0, 0); UNDERIMG = oc; }
  g.save(); g.beginPath(); for (const p of D.pieces) pathRings(g, [p.outer, ...p.holes]); g.clip('evenodd'); g.imageSmoothingEnabled = true;
  g.drawImage(UNDERIMG, X(-cell / 2), Y((ny - 0.5) * cell), nx * cell * view.s, ny * cell * view.s); g.restore(); }
function drawEvents(){ const r = clamp(view.s * 8, 2.4, 5.5);
  for (const e of (SCRUB ? EVENTS.slice(0, SCRUB.ev) : EVENTS)){ const x = X(e.x), y = Y(e.y); if (x < -10 || y < -10 || x > VW + 10 || y > VH + 10) continue;
    if (e.k === 'branch' || e.k === 'edge-branch' || e.k === 'spoke'){ ctx.fillStyle = P.evBranch; ctx.beginPath(); ctx.arc(x, y, r * 0.75, 0, 2 * PI); ctx.fill(); }
    else if (e.k === 'fork'){ ctx.strokeStyle = P.evFork; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x, y + r * 1.3); ctx.lineTo(x, y); ctx.lineTo(x - r, y - r); ctx.moveTo(x, y); ctx.lineTo(x + r, y - r); ctx.stroke(); }
    else if (e.k === 'merge'){ ctx.fillStyle = P.evFork; ctx.beginPath(); ctx.arc(x, y, r * 0.75, 0, 2 * PI); ctx.fill(); }
    else if (e.k === 'join'){ ctx.fillStyle = P.main; ctx.beginPath(); ctx.arc(x, y, r * 0.55, 0, 2 * PI); ctx.fill(); }
    else if (e.k === 'cross'){ ctx.strokeStyle = P.evCross; ctx.lineWidth = 1.7; ctx.beginPath(); ctx.moveTo(x - r, y - r); ctx.lineTo(x + r, y + r); ctx.moveTo(x - r, y + r); ctx.lineTo(x + r, y - r); ctx.stroke(); }
    else if (e.k === 'edge'){ ctx.fillStyle = P.label; ctx.fillRect(x - r * 0.5, y - r * 0.5, r, r); }
    else if (e.k === 'infill'){ ctx.strokeStyle = P.evInfill; ctx.lineWidth = 1.8; ctx.beginPath(); ctx.moveTo(x - r, y); ctx.lineTo(x + r, y); ctx.moveTo(x, y - r); ctx.lineTo(x, y + r); ctx.stroke(); }
    else if (e.k === 'meet'){ ctx.strokeStyle = P.main; ctx.lineWidth = 1.3; ctx.beginPath(); ctx.arc(x, y, r * 0.85, 0, 2 * PI); ctx.stroke(); } } }

/* ------------------------------------------------------------------ measures and cells */
let MEAS = { km1: 0, km2: 0, dens: 0, T: 0, Y: 0, X: 0, loose: 0, xpts: [], cellsN: 0, med: 0 }, METR = null;
function measures(){ floodNum();
  const len = Pp => Pp.reduce((s, p, k) => k ? s + Math.hypot(p[0] - Pp[k - 1][0], p[1] - Pp[k - 1][1]) : 0, 0), xpts = [];
  const km = { 1: 0, 2: 0 }; let T = 0, Y = 0, loose = 0;
  for (const l of LINES){ if (l.dead || l.level === 0) continue; km[l.level] += len(l.pts) / 1000; for (const e of l.ends){ if (e === 'T') T++; if (e === 'Y') Y++; }
    const a0 = l.pts[0], a1 = l.pts[l.pts.length - 1]; if (l.circus || Math.hypot(a0[0] - a1[0], a0[1] - a1[1]) < 0.5) continue;   // a closed ring has no ends
    // an end on another street, or (a loop) back on its own street further along, is not loose
    for (const p of [a0, a1]) if (!near(p[0], p[1], 1.5, null, false, null, l.id) && !l.pts.slice(5, -5).some(q => Math.hypot(q[0] - p[0], q[1] - p[1]) < 1.5)) loose++; }
  const segs = new Map(), C = 40; let X = 0; const put = (k, x) => { let b = segs.get(k); if (!b){ b = []; segs.set(k, b); } b.push(x); };
  LINES.forEach(l => { if (l.dead || l.level === 0) return; for (let k = 1; k < l.pts.length; k++){ const a = l.pts[k - 1], b = l.pts[k]; put(Math.floor((a[0] + b[0]) / 2 / C) + ',' + Math.floor((a[1] + b[1]) / 2 / C), [l.id, a, b]); } });
  const seen = new Set();
  for (const [key, arr] of segs){ const [cx, cy] = key.split(',').map(Number); const cand = []; for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++){ const b = segs.get((cx + i) + ',' + (cy + j)); if (b) cand.push(...b); }
    for (const [id1, a1, b1] of arr) for (const [id2, a2, b2] of cand){ if (id1 >= id2) continue; const rx = b1[0] - a1[0], ry = b1[1] - a1[1], sx = b2[0] - a2[0], sy = b2[1] - a2[1], den = rx * sy - ry * sx; if (Math.abs(den) < 1e-9) continue;
      const t = ((a2[0] - a1[0]) * sy - (a2[1] - a1[1]) * sx) / den, u = ((a2[0] - a1[0]) * ry - (a2[1] - a1[1]) * rx) / den; if (t > 0.02 && t < 0.98 && u > 0.02 && u < 0.98){ const k2 = Math.round(a1[0] + rx * t) + ',' + Math.round(a1[1] + ry * t); if (!seen.has(k2)){ seen.add(k2); X++; xpts.push([a1[0] + rx * t, a1[1] + ry * t]); } } } }
  const J = T + Y + X || 1, area = D.pieces.reduce((s, p) => s + Math.abs(polyArea(p.outer)), 0) / 1e6;
  const ok = CELLS ? CELLS.areas.filter(a => a > 0.05).sort((a, b) => a - b) : [], med = ok.length ? ok[Math.floor(ok.length / 2)] : 0;
  MEAS = { km1: km[1], km2: km[2], dens: (km[1] + km[2]) / area, T: 100 * T / J, Y: 100 * Y / J, X: 100 * X / J, loose, xpts, cellsN: ok.length, med };
  $('num').innerHTML = '<b>' + km[1].toFixed(1) + '</b> km main · <b>' + km[2].toFixed(1) + '</b> km second · <b>' + ((km[1] + km[2]) / area).toFixed(1) + '</b> km/km² (towns 12–16)' + NL +
    'junctions: T <b>' + Math.round(100 * T / J) + '</b> % · Y <b>' + Math.round(100 * Y / J) + '</b> % · X <b>' + Math.round(100 * X / J) + '</b> %' + NL +
    'loose ends <b>' + loose + '</b> · culverts ' + CULVERTS.length + (ok.length ? ' · <b>' + ok.length + '</b> cells, median <b>' + med.toFixed(2) + '</b> ha' : ''); }
function polyArea(r){ let a = 0; for (let i = 0, j = r.length - 1; i < r.length; j = i++) a += (r[j][0] + r[i][0]) * (r[j][1] - r[i][1]); return a / 2; }
function readCells(){ const c = 5, W = Math.ceil(D.w / c), H = Math.ceil(D.h / c), occ = new Uint8Array(W * H), ins = new Uint8Array(W * H);
  const mark = (x, y) => { const X_ = Math.floor(x / c), Y_ = Math.floor((D.h - y) / c); for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++){ const xx = X_ + i, yy = Y_ + j; if (xx >= 0 && yy >= 0 && xx < W && yy < H) occ[yy * W + xx] = 1; } };
  for (const l of LINES){ if (l.dead) continue; const Pp = l.pts; for (let k = 1; k < Pp.length; k++){ const a = Pp[k - 1], q = Pp[k], L = Math.hypot(q[0] - a[0], q[1] - a[1]), n = Math.max(1, Math.ceil(L / 2.5)); for (let s = 0; s <= n; s++) mark(a[0] + (q[0] - a[0]) * s / n, a[1] + (q[1] - a[1]) * s / n); } }
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) ins[y * W + x] = inLand((x + 0.5) * c, D.h - (y + 0.5) * c) ? 1 : 0;
  const lab = new Int32Array(W * H).fill(-1), areas = [], Q = new Int32Array(W * H);
  for (let i = 0; i < W * H; i++){ if (!ins[i] || occ[i] || lab[i] >= 0) continue; let h = 0, t = 0; Q[t++] = i; lab[i] = areas.length;
    while (h < t){ const q = Q[h++], x = q % W, y = (q / W) | 0; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]){ const xx = x + dx, yy = y + dy; if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue; const p = yy * W + xx; if (ins[p] && !occ[p] && lab[p] < 0){ lab[p] = areas.length; Q[t++] = p; } } }
    areas.push(t * c * c / 1e4); }
  CELLS = { lab, W, H, c, areas }; CELLIMG = null; }

/* ------------------------------------------------------------------ the view and the layers */
const cv = $('c'), ctx = cv.getContext('2d'); let VW = 0, VH = 0, DPR = 1, view = { x: 0, y: 0, s: 0.3 }, fitted = false;
let baseDirty = true, netDirty = true, widthDirty = true, CROSSIMG = null;
const mk = () => document.createElement('canvas');
const L_base = mk(), L_net = mk(), L_flow = mk(), L_wind = mk(), L_width = mk();
let netDrawn = 0;
const X = x => (x - view.x) * view.s + VW / 2, Y = y => VH / 2 - (y - view.y) * view.s;
function resize(){ DPR = Math.min(2, devicePixelRatio || 1); VW = cv.clientWidth; VH = cv.clientHeight; for (const c of [cv, L_base, L_net, L_flow, L_wind, L_width]){ c.width = Math.round(VW * DPR); c.height = Math.round(VH * DPR); }
  if (!fitted && VW){ let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; for (const p of D.pieces) for (const q of p.outer){ x0 = Math.min(x0, q[0]); y0 = Math.min(y0, q[1]); x1 = Math.max(x1, q[0]); y1 = Math.max(y1, q[1]); }
    const ins = window.__TS_INSETS ? window.__TS_INSETS() : { l: 0, r: 0 };   // (v8.3) fitted between the floating panels
    view.s = Math.min((VW - ins.l - ins.r) / (x1 - x0), (VH - 130) / (y1 - y0)) * 0.92; view.x = (x0 + x1) / 2 - (ins.l - ins.r) / 2 / view.s; view.y = (y0 + y1) / 2 + 30 / view.s; fitted = true; } baseDirty = netDirty = widthDirty = true; clearTrails(); }
function g2d(c){ const g = c.getContext('2d'); g.setTransform(DPR, 0, 0, DPR, 0, 0); return g; }
function pathLine(g, Pp){ g.beginPath(); Pp.forEach((p, k) => k ? g.lineTo(X(p[0]), Y(p[1])) : g.moveTo(X(p[0]), Y(p[1]))); }
function pathRings(g, rings){ for (const r of rings){ r.forEach((p, k) => k ? g.lineTo(X(p[0]), Y(p[1])) : g.moveTo(X(p[0]), Y(p[1]))); g.closePath(); } }
function drawBase(){ const g = g2d(L_base); g.clearRect(0, 0, VW, VH); g.fillStyle = P.bg; g.fillRect(0, 0, VW, VH);
  const bm = BASEMAP !== 'none' && drawBasemap(g), ctxOn = $('lCtx').checked && !bm;   // (v8.5) a basemap replaces the drawn context
  if (ctxOn){ g.fillStyle = P.urban; for (const r of D.ctx.urban){ g.beginPath(); pathRings(g, r); g.fill('evenodd'); } }
  if ($('lCont').checked){ g.lineJoin = 'round';
    for (const c of D.contours){ const idx = c.z % 5 === 0; g.strokeStyle = idx ? P.contourIdx : P.contour; g.lineWidth = idx ? 1.0 : 0.6; pathLine(g, c.p); g.stroke(); }
    g.fillStyle = P.label; g.font = '10px -apple-system, BlinkMacSystemFont, "SF Pro Text", "Helvetica Neue", "PingFang SC", "Microsoft YaHei", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    if (view.s > 0.18) for (const [x, y, a, t] of D.labels){ g.save(); g.translate(X(x), Y(y)); let r = -a; if (r > PI / 2) r -= PI; if (r < -PI / 2) r += PI; g.rotate(r); g.fillText(t, 0, 0); g.restore(); } }
  if (ctxOn){ g.fillStyle = P.room; for (const r of D.ctx.room){ g.beginPath(); pathRings(g, r); g.fill('evenodd'); }
    for (const rb of D.ctx.rib){ g.fillStyle = P.rib[rb.c]; g.beginPath(); pathRings(g, rb.r); g.fill('evenodd'); }
    g.strokeStyle = P.lane; g.lineWidth = 0.8; for (const l of D.ctx.lanes){ pathLine(g, l); g.stroke(); }
    g.fillStyle = P.bld; for (const r of D.ctx.bld){ g.beginPath(); pathRings(g, r); g.fill('evenodd'); }
    g.fillStyle = P.water; g.strokeStyle = P.waterEdge; g.lineWidth = 0.8; for (const r of D.ctx.water){ g.beginPath(); pathRings(g, r); g.fill('evenodd'); g.stroke(); }
    g.strokeStyle = P.stream; g.lineWidth = 1.1; for (const l of D.ctx.streams){ pathLine(g, l); g.stroke(); }
    g.strokeStyle = P.prim; g.lineWidth = 2.0; for (const l of D.ctx.prim){ pathLine(g, l); g.stroke(); } }
  // the land: no colour of its own, a quiet ground under the field (no yellow)
  g.save(); g.shadowColor = bm ? 'rgba(0,0,0,0)' : P.landShadow; g.shadowBlur = 14; g.fillStyle = P.land; g.globalAlpha = bm ? (THEME === 'dark' ? 0.32 : 0.3) : THEME === 'dark' ? 0.9 : 0.82;
  g.beginPath(); for (const p of D.pieces) pathRings(g, [p.outer, ...p.holes]); g.fill('evenodd'); g.restore();
  drawEnv(g); drawFlood(g); drawGreen(g);
  if (UNDER !== 'off') drawUnder(g);
  if ($('lCells').checked && CELLS) drawCells(g);
  if ($('lCross').checked) drawCrosses(g);
  if (FIELDMODE === 'lines') drawFieldLines(g);
  baseDirty = false; }
/* ------------------------------------------------------------------ (v8.6) environmental fields (layer 1) */
const ENV = D.env || null, ENVIMG = {};
let ENVSEL = (() => { try { const v = localStorage.getItem('tensorStudio.envLayer'); return ENV && ['Z', 'Q', 'V', 'Cw', 'C'].includes(v) ? v : 'off'; } catch (e){ return 'off'; } })();
const ENVRAMP = { Z: ['#24414f', '#5f7f6e', '#b5ad83', '#e6d8b0'], Q: ['#0a84ff', '#64d2ff'], V: ['#0d2b26', '#1f8a5b', '#30d158'], Cw: ['#14132b', '#4b48b8', '#9d9bff'], C: ['#5e5ce6', '#8e8e93', '#ff9f0a'] };
function hex(c){ if (c.startsWith('rgba')) { const m = c.match(/[\d.]+/g).map(Number); return [m[0], m[1], m[2], m[3]]; } return [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16), 1]; }
function rampAt(stops, t){ const s = stops.map(hex), x = clamp(t, 0, 1) * (s.length - 1), i = Math.min(s.length - 2, Math.floor(x)), f = x - i; return s[i].map((v, k) => v + (s[i + 1][k] - v) * f); }
function envRange(k){ const A = ENV[k], M = D.landMask; let lo = Infinity, hi = -Infinity; for (let i = 0; i < N; i++) if (!M || M[i]){ lo = Math.min(lo, A[i]); hi = Math.max(hi, A[i]); } return [lo, hi]; }
// (v8.7) drawn 4 times finer than the 10 m grid, each value read between the cells (bilinear), so the maps are smooth
// instead of a mosaic of 10 m squares; the runoff is lightly smoothed first, so its flow paths come out as soft lines
const ENV_UP = 4;   // beyond the land the maps are faint (12 %), so the map round the site stays readable
function envImg(k){ if (ENVIMG[k]) return ENVIMG[k];
  const M = D.landMask, Z = ENV.Z, [lo, hi] = envRange(k), A = k === 'Q' ? blur(ENV.Q, 1.4) : ENV[k];
  let qlo = lo, qhi = hi; if (k === 'Q'){ qlo = Infinity; qhi = -Infinity; for (let i = 0; i < N; i++) if (!M || M[i]){ qlo = Math.min(qlo, A[i]); qhi = Math.max(qhi, A[i]); } }
  // per cell: the value (0..1), the hill shade (elevation only), the land (1) or not
  const T = new Float32Array(N), SH = k === 'Z' ? new Float32Array(N) : null, LM = new Float32Array(N);
  for (let r = 0; r < ny; r++) for (let c = 0; c < nx; c++){ const i = r * nx + c; T[i] = k === 'Q' ? (A[i] - qlo) / (qhi - qlo || 1) : (A[i] - lo) / (hi - lo || 1); LM[i] = !M || M[i] ? 1 : 0;
    if (SH){ // hillshade from the north-west, 45° up
      const dzx = (Z[r * nx + Math.min(c + 1, nx - 1)] - Z[r * nx + Math.max(c - 1, 0)]) / (2 * cell), dzy = (Z[Math.min(r + 1, ny - 1) * nx + c] - Z[Math.max(r - 1, 0) * nx + c]) / (2 * cell);
      const ex = 4, nxv = -dzx * ex, nyv = -dzy * ex, nz = 1, L = Math.hypot(nxv, nyv, nz); SH[i] = clamp(0.55 + 0.75 * ((nxv * -0.5 + nyv * 0.5 + nz * 0.707) / L), 0.35, 1.25); } }
  const W = nx * ENV_UP, H = ny * ENV_UP, oc = mk(); oc.width = W; oc.height = H; const gg = oc.getContext('2d'), im = gg.createImageData(W, H), d = im.data;
  const bil = (F, u, w) => { const c0 = clamp(Math.floor(u), 0, nx - 1), r0 = clamp(Math.floor(w), 0, ny - 1), c1 = Math.min(c0 + 1, nx - 1), r1 = Math.min(r0 + 1, ny - 1), fu = clamp(u - c0, 0, 1), fw = clamp(w - r0, 0, 1);
    return (F[r0 * nx + c0] * (1 - fu) + F[r0 * nx + c1] * fu) * (1 - fw) + (F[r1 * nx + c0] * (1 - fu) + F[r1 * nx + c1] * fu) * fw; };
  const ramp = ENVRAMP[k];
  for (let py = 0; py < H; py++){ const w = ny - 1 - ((py + 0.5) / ENV_UP - 0.5);
    for (let px = 0; px < W; px++){ const u = (px + 0.5) / ENV_UP - 0.5, t = bil(T, u, w), col = rampAt(ramp, t);
      let a = k === 'Q' ? Math.pow(clamp((t - 0.5) / 0.45, 0, 1), 1.1) : col[3];   // runoff: only the stronger flow paths, as lines
      if (SH){ const sh = bil(SH, u, w); col[0] = clamp(col[0] * sh, 0, 255); col[1] = clamp(col[1] * sh, 0, 255); col[2] = clamp(col[2] * sh, 0, 255); }
      const lm = bil(LM, u, w), o = 4 * (py * W + px);
      d[o] = col[0]; d[o + 1] = col[1]; d[o + 2] = col[2]; d[o + 3] = Math.round(255 * a * (0.12 + 0.88 * lm)); } }
  gg.putImageData(im, 0, 0); return (ENVIMG[k] = oc); }
function drawEnv(g){ if (!ENV || ENVSEL === 'off') return; if (window.ENVANIM && ENVANIM.on && ENVANIM.k === ENVSEL) return;   // (v8.9) being animated: drawn by scripts/env_anim.js g.save(); g.imageSmoothingEnabled = true; g.globalAlpha = ENVSEL === 'Q' ? 0.95 : 0.82;
  g.drawImage(envImg(ENVSEL), X(-cell / 2), Y((ny - 0.5) * cell), nx * cell * view.s, ny * cell * view.s); g.restore(); }
function syncEnv(){ for (const b of document.querySelectorAll('#tgEnv button')){ b.classList.toggle('on', b.dataset.env === ENVSEL); if (!ENV && b.dataset.env !== 'off') b.disabled = true; }
  const key = document.getElementById('envKey'); if (!key) return; key.hidden = !ENV || ENVSEL === 'off'; if (key.hidden) return;
  const zh = TS_LANG === 'zh', [lo, hi] = envRange(ENVSEL), st = ENV.stats;
  document.getElementById('envRamp').style.background = 'linear-gradient(90deg,' + ENVRAMP[ENVSEL].join(',') + ')';
  const lab = { Z: [lo.toFixed(1) + ' m', hi.toFixed(1) + ' m'], Q: zh ? ['不汇水', '主汇水线'] : ['no runoff', 'main flow paths'], V: zh ? ['弱', '强'] : ['low', 'high'], Cw: zh ? ['少', '多'] : ['low', 'high'], C: zh ? ['冷、闷', '暖、通风'] : ['cold, still', 'mild, airy'] }[ENVSEL];
  document.getElementById('envLo').textContent = lab[0]; document.getElementById('envHi').textContent = lab[1];
  document.getElementById('envNote').textContent = {
    Z: zh ? '高程（' + (st.elevationFrom === 'contours' ? '由 1 m 等高线重建' : 'OS Terrain 50') + '），叠加西北光照的山体阴影。' : 'Elevation (' + (st.elevationFrom === 'contours' ? 'rebuilt from the 1 m contours' : 'OS Terrain 50') + '), hill-shaded from the north-west.',
    Q: zh ? '雨水汇集的路径：D8 流向的汇流面积（对数）。' : 'Where rain gathers: D8 flow accumulation (log scale).',
    V: zh ? '6–8 月各风向的风能（占比 × 风速²），按每个方向吹进场地的强弱分布。' : 'Summer (Jun–Aug) wind energy, share × speed², by how each direction reaches the site.',
    Cw: zh ? '12–2 月北、东北、东向冷风的风能分布。' : 'Winter (Dec–Feb) wind energy from the N, NE and E.',
    C: zh ? '舒适 = 0.6 ×（1 − 冷风）+ 0.4 × 通风。' : 'Comfort = 0.6 × (1 − cold wind) + 0.4 × summer air.' }[ENVSEL]; }
for (const b of document.querySelectorAll('#tgEnv button')) b.onclick = () => { ENVSEL = b.dataset.env; try { localStorage.setItem('tensorStudio.envLayer', ENVSEL); } catch (e) {} baseDirty = true; syncEnv(); };

/* ------------------------------------------------------------------ (v8.5) flood risk layer and basemap tiles */
let SHOWFLOOD = (() => { try { return localStorage.getItem('tensorStudio.showFlood') !== '0'; } catch (e){ return true; } })(), FLOODIMG = null;
let SHOWGREEN = (() => { try { return localStorage.getItem('tensorStudio.showGreen') !== '0'; } catch (e){ return true; } })();
function drawGreen(g){ if (!GZ || !SHOWGREEN) return;
  if (!GIMG){ // drawn 4x finer, the distance to the axis read between the cells, so the band has a soft, even edge
    const U = ENV_UP, W = nx * U, H = ny * U, oc = mk(); oc.width = W; oc.height = H; const gg = oc.getContext('2d'), im = gg.createImageData(W, H), d = im.data, col = THEME === 'dark' ? [48, 209, 88] : [36, 160, 76], half = v('gW') / 2, M = D.landMask;
    const bil = (F, u, w) => { const c0 = clamp(Math.floor(u), 0, nx - 1), r0 = clamp(Math.floor(w), 0, ny - 1), c1 = Math.min(c0 + 1, nx - 1), r1 = Math.min(r0 + 1, ny - 1), fu = clamp(u - c0, 0, 1), fw = clamp(w - r0, 0, 1);
      return (F[r0 * nx + c0] * (1 - fu) + F[r0 * nx + c1] * fu) * (1 - fw) + (F[r1 * nx + c0] * (1 - fu) + F[r1 * nx + c1] * fu) * fw; };
    const LM = new Float32Array(N); for (let i = 0; i < N; i++) LM[i] = !M || M[i] ? 1 : 0;
    const GDc = new Float32Array(N); for (let i = 0; i < N; i++) GDc[i] = Math.min(GD[i], half + 60); const GDs = blur(GDc, 1.3);   // smoothed: the 8-neighbour distance has steps
    for (let py = 0; py < H; py++){ const w = ny - 1 - ((py + 0.5) / U - 0.5); for (let px = 0; px < W; px++){ const u = (px + 0.5) / U - 0.5, dist = bil(GDs, u, w); if (dist > half + 4) continue;
      const edge = clamp((half + 4 - dist) / 6, 0, 1), core = 0.3 * clamp(1 - dist / (half * 0.7), 0, 1), a = (0.4 + core) * edge * bil(LM, u, w), o = 4 * (py * W + px); d[o] = col[0]; d[o + 1] = col[1]; d[o + 2] = col[2]; d[o + 3] = Math.round(255 * a); } }
    gg.putImageData(im, 0, 0); GIMG = oc; }
  g.save(); g.imageSmoothingEnabled = true; g.globalAlpha = BASEMAP === 'none' ? 1 : 0.85; g.drawImage(GIMG, X(0), Y(ny * cell), nx * cell * view.s, ny * cell * view.s); g.restore(); }
function drawFlood(g){ if (!FR || !SHOWFLOOD) return;
  if (!FLOODIMG){ const oc = mk(); oc.width = nx; oc.height = ny; const gg = oc.getContext('2d'), im = gg.createImageData(nx, ny), C = [null, [156, 221, 234], [247, 211, 89], [242, 157, 56], [215, 55, 49]];
    for (let r = 0; r < ny; r++) for (let c = 0; c < nx; c++){ const k = FR[r * nx + c]; if (!k) continue; const o = 4 * ((ny - 1 - r) * nx + c), col = C[k]; im.data[o] = col[0]; im.data[o + 1] = col[1]; im.data[o + 2] = col[2]; im.data[o + 3] = Math.round([0, 40, 70, 140, 175][k] * (inLandNoHoles(c * cell, r * cell) ? 1 : 0.45)); }   // quieter outside the land, low risk light
    gg.putImageData(im, 0, 0); FLOODIMG = oc; }
  g.save(); g.imageSmoothingEnabled = true; g.globalAlpha = (THEME === 'dark' ? 0.8 : 0.7) * (BASEMAP !== 'none' ? 0.8 : 1); g.drawImage(FLOODIMG, X(-cell / 2), Y((ny - 0.5) * cell), nx * cell * view.s, ny * cell * view.s); g.restore();
  const fa = floodAvoid(); if (fa){ g.save(); g.strokeStyle = P.waterEdge; g.setLineDash([4, 3]); g.lineWidth = 1; for (const r of FLOOD.zones[fa] || []){ pathLine(g, r); g.stroke(); } g.restore(); } }
const BASEMAPS = {
  osm: { url: (z, x, y) => 'https://tile.openstreetmap.org/' + z + '/' + x + '/' + y + '.png', max: 19, attr: '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors' },
  light: { url: (z, x, y, r) => 'https://' + 'abcd'[(x + y) % 4] + '.basemaps.cartocdn.com/light_all/' + z + '/' + x + '/' + y + r + '.png', max: 20, retina: true, attr: '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors © <a href="https://carto.com/attributions" target="_blank" rel="noopener">CARTO</a>' },
  dark: { url: (z, x, y, r) => 'https://' + 'abcd'[(x + y) % 4] + '.basemaps.cartocdn.com/dark_all/' + z + '/' + x + '/' + y + r + '.png', max: 20, retina: true, attr: '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors © <a href="https://carto.com/attributions" target="_blank" rel="noopener">CARTO</a>' } };
let BASEMAP = (() => { try { const b = localStorage.getItem('tensorStudio.basemap'); return BASEMAPS[b] ? b : 'none'; } catch (e){ return 'none'; } })();
const TILES = new Map();
function tileImg(key, src){ let t = TILES.get(key); if (t) return t; t = new Image(); t.crossOrigin = 'anonymous'; t.decoding = 'async';
  t.onload = () => { baseDirty = true; }; t.onerror = () => { t.failed = true; }; t.src = src; TILES.set(key, t);
  if (TILES.size > 500) TILES.delete(TILES.keys().next().value); return t; }
// tiles are Web Mercator; the plan is British National Grid, about 1.4° turned and 1.6× scaled here: each tile is drawn through
// the affine map of its own corners (sub-metre over a tile)
function drawBasemap(g){ const B = BASEMAPS[BASEMAP], geo = window.__TS && window.__TS.geo; if (!B || !geo) return false;
  const wx = sx => (sx - VW / 2) / view.s + view.x, wy = sy => (VH / 2 - sy) / view.s + view.y;
  const cs = [[0, 0], [VW, 0], [0, VH], [VW, VH]].map(([sx, sy]) => geo.bngToWGS84(OX + wx(sx), OY + wy(sy))), lat0 = cs.reduce((s, c) => s + c[1], 0) / 4;
  const z = clamp(Math.round(Math.log2(156543.03 * Math.cos(lat0 * PI / 180) * view.s * (B.retina ? 1 : Math.min(2, DPR)))), 3, B.max), Z = 2 ** z;
  const tx = lon => (lon + 180) / 360 * Z, ty = lat => (1 - Math.log(Math.tan(lat * PI / 180) + 1 / Math.cos(lat * PI / 180)) / PI) / 2 * Z;
  const x0 = Math.floor(Math.min(...cs.map(c => tx(c[0])))), x1 = Math.floor(Math.max(...cs.map(c => tx(c[0])))), y0 = Math.floor(Math.min(...cs.map(c => ty(c[1])))), y1 = Math.floor(Math.max(...cs.map(c => ty(c[1]))));
  if ((x1 - x0 + 1) * (y1 - y0 + 1) > 160) return false;
  const lonOf = x => x / Z * 360 - 180, latOf = y => Math.atan(Math.sinh(PI * (1 - 2 * y / Z))) * 180 / PI;
  const scr = (lon, lat) => { const q = geo.wgs84ToBNG(lon, lat); return [X(q[0] - OX), Y(q[1] - OY)]; }, r2 = B.retina && DPR > 1 ? '@2x' : '';
  g.save(); g.imageSmoothingEnabled = true; let drawn = 0;
  for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++){ const im = tileImg(BASEMAP + '/' + z + '/' + x + '/' + y + r2, B.url(z, x, y, r2)); if (!im.complete || im.failed || !im.naturalWidth) continue;
    const a = scr(lonOf(x), latOf(y)), b = scr(lonOf(x + 1), latOf(y)), c = scr(lonOf(x), latOf(y + 1)), S = im.naturalWidth;
    g.setTransform(DPR * (b[0] - a[0]) / S, DPR * (b[1] - a[1]) / S, DPR * (c[0] - a[0]) / S, DPR * (c[1] - a[1]) / S, DPR * a[0], DPR * a[1]);
    g.drawImage(im, -0.4, -0.4, S + 0.8, S + 0.8); drawn++; }
  g.restore(); return true; }
function syncBase(){ for (const b of document.querySelectorAll('#tgBase button')) b.classList.toggle('on', b.dataset.bm === BASEMAP);
  const el = document.getElementById('bmAttrib'); if (el){ const B = BASEMAPS[BASEMAP]; el.hidden = !B; el.innerHTML = B ? B.attr : ''; window.__TS_INSETS && window.__TS_INSETS(); } }
for (const b of document.querySelectorAll('#tgBase button')) b.onclick = () => { BASEMAP = b.dataset.bm; try { localStorage.setItem('tensorStudio.basemap', BASEMAP); } catch (e) {} baseDirty = true; syncBase(); };
// how much of the network lies where floods are expected
let FLAND = null;
function floodNum(){ const el = document.getElementById('fNum'); if (!el) return; const zh = TS_LANG === 'zh';
  if (!FR){ el.textContent = zh ? '此场地不在 EA 洪水风险数据范围内。' : 'No EA flood risk data for this site.'; return; }
  if (!FLAND){ FLAND = [0, 0, 0, 0, 0]; for (let r = 0; r < ny; r++) for (let c = 0; c < nx; c++) if (inLandNoHoles(c * cell, r * cell)) FLAND[FR[r * nx + c]] += cell * cell / 1e4; }
  let tot = 0, med = 0, high = 0;
  for (const l of LINES){ if (l.dead || l.level < 1) continue; const Pp = l.pts; for (let k = 1; k < Pp.length; k++){ const a = Pp[k - 1], b = Pp[k], L = Math.hypot(b[0] - a[0], b[1] - a[1]); tot += L;
      const k2 = FR[clamp(Math.round((a[1] + b[1]) / 2 / cell), 0, ny - 1) * nx + clamp(Math.round((a[0] + b[0]) / 2 / cell), 0, nx - 1)]; if (k2 >= 4) high += L; else if (k2 === 3) med += L; } }
  const km = x => (x / 1000).toFixed(2), pc = (100 * (med + high) / (tot || 1)).toFixed(1), ha = x => x.toFixed(1);
  const key = '<br><span class="fk"><span><i style="background:#f7d359"></i>' + (zh ? '低' : 'low') + '</span><span><i style="background:#f29d38"></i>' + (zh ? '中' : 'medium') + '</span><span><i style="background:#d73731"></i>' + (zh ? '高' : 'high') + '</span></span>';
  el.innerHTML = zh
    ? '道路落在中风险区 <b>' + km(med) + ' km</b>、高风险区 <b>' + km(high) + ' km</b>（占 ' + pc + '%）<br>场地内：高风险 ' + ha(FLAND[4]) + ' 公顷，中风险 ' + ha(FLAND[3]) + ' 公顷，低风险 ' + ha(FLAND[2]) + ' 公顷' + key
    : 'Streets in medium risk <b>' + km(med) + ' km</b>, in high risk <b>' + km(high) + ' km</b> (' + pc + ' %)<br>On the land: high ' + ha(FLAND[4]) + ' ha, medium ' + ha(FLAND[3]) + ' ha, low ' + ha(FLAND[2]) + ' ha' + key; }
function drawCells(g){ if (!CELLIMG){ const { lab, W, H, areas } = CELLS, oc = mk(); oc.width = W; oc.height = H; const gg = oc.getContext('2d'), im = gg.createImageData(W, H);
    const band = a => a < 0.1 ? 0 : a < 0.5 ? 1 : a < 2 ? 2 : a < 10 ? 3 : 4, rgb = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
    for (let i = 0; i < W * H; i++){ if (lab[i] < 0) continue; const c = rgb(P.cells[band(areas[lab[i]])]); im.data[4 * i] = c[0]; im.data[4 * i + 1] = c[1]; im.data[4 * i + 2] = c[2]; im.data[4 * i + 3] = 255; }
    gg.putImageData(im, 0, 0); CELLIMG = oc; }
  g.imageSmoothingEnabled = false; g.drawImage(CELLIMG, X(0), Y(D.h), CELLS.W * CELLS.c * view.s, CELLS.H * CELLS.c * view.s); }
function drawCrosses(g){ const step = Math.max(1, Math.round(26 / (cell * view.s))), Ls = cell * step * 0.42; g.strokeStyle = P.cross; g.lineWidth = 0.8; g.beginPath();
  for (let r = 0; r < ny; r += step) for (let c = 0; c < nx; c += step){ const x = c * cell, y = r * cell; if (!inLand(x, y)) continue; const i = r * nx + c, t = 0.5 * Math.atan2(TS[i], TC[i]), a = Math.cos(t), b = Math.sin(t);
    g.moveTo(X(x - a * Ls), Y(y - b * Ls)); g.lineTo(X(x + a * Ls), Y(y + b * Ls)); g.moveTo(X(x + b * Ls * 0.45), Y(y - a * Ls * 0.45)); g.lineTo(X(x - b * Ls * 0.45), Y(y + a * Ls * 0.45)); }
  g.stroke(); }
function styleFor(l){ if (GROWING && TIPMAP.has(l.id)) return [P.grow, l.level === 1 ? 2.8 : 1.5]; if (l.level === 0) return l.flood ? [P.waterEdge, 1.1] : [P.edge, 1.3]; if (l.level === 1) return [P.main, 2.4]; return [P.second, 1.0]; }
function drawNet(full){ const g = g2d(L_net); if (full){ g.clearRect(0, 0, VW, VH); netDrawn = 0; }
  if (!$('lStreets').checked){ netDrawn = LINES.length; return; }
  g.lineCap = 'round'; g.lineJoin = 'round';
  if (THEME === 'dark'){ g.shadowColor = 'rgba(120,220,255,0.35)'; g.shadowBlur = 0; }
  if (SCRUB){ for (let i = 0; i < SCRUB.n.length; i++){ const l = SCRUB.o[i], n = SCRUB.n[i]; if (!l || n < 2) continue; const [col, w] = styleFor(l); g.strokeStyle = col; g.lineWidth = w;
      if (THEME === 'dark' && l.level === 1){ g.shadowBlur = 6; } else g.shadowBlur = 0; const Pp = SCRUB.p[i]; pathLine(g, Pp.length === n ? Pp : Pp.slice(0, n)); g.stroke(); }
    g.shadowBlur = 0; netDrawn = LINES.length; netDirty = false; return; }
  for (let i = netDrawn; i < LINES.length; i++){ const l = LINES[i]; if (l.dead) continue; const [col, w] = styleFor(l); g.strokeStyle = col; g.lineWidth = w;
    if (THEME === 'dark' && l.level === 1){ g.shadowBlur = 6; } else g.shadowBlur = 0; pathLine(g, l.pts); g.stroke(); }
  g.shadowBlur = 0; netDrawn = LINES.length; netDirty = false; }
// (v8.7) a frame of the growth: each line's points so far (the arrays only grow while a street grows, so a frame keeps a reference and a length)
function recordFrame(){ const n = new Uint32Array(LINES.length), p = new Array(LINES.length); for (let i = 0; i < LINES.length; i++){ const l = LINES[i]; n[i] = l.dead ? 0 : l.pts.length; p[i] = l.pts; }
  return { n, p, o: LINES.slice(), ev: EVENTS.length, cul: CULVERTS.length, phase: PHASE, streets: LINES.filter(l => l.level > 0 && !l.dead).length }; }
function setScrub(f){ SCRUB = f || null; netDirty = true; widthDirty = true; }
// a value 0-1 for each street (or each point of it, for the tapering drivers), remapped into the domain [narrowest, widest]
function plen(Pp){ let L = 0; for (let k = 1; k < Pp.length; k++) L += Math.hypot(Pp[k][0] - Pp[k - 1][0], Pp[k][1] - Pp[k - 1][1]); return L; }
function cellAt(x, y){ return clamp(Math.round(y / cell), 0, ny - 1) * nx + clamp(Math.round(x / cell), 0, nx - 1); }
function exposureAt(x, y){ const M = YEAR[MONTH], i = cellAt(x, y); let e = 0; for (let d = 0; d < 8; d++) e += M.share[d] * M.v[d] * M.v[d] / YSUM * DIRS[d].S[i]; return e; }
function widthOf(t){ const lo = v('wMin'), hi = Math.max(v('wMax'), lo); let w = lo + (hi - lo) * clamp(t, 0, 1); if ($('wSnap').checked) w = Math.round(w / 3) * 3; return Math.max(3, w); }
function streetWidths(){ const by = $('wBy').value, ls = LINES.filter(l => !l.dead && l.level > 0 && !l.circus), out = [];
  const maxHits = Math.max(1, ...ls.map(l => l.hits || 0)), maxLen = Math.max(1, ...ls.map(l => plen(l.pts))), att = attractorsOn();
  for (const l of ls){ let t = null;
    if (by === 'level') t = l.level === 1 ? 1 : 0;
    else if (by === 'conn') t = Math.sqrt((l.hits || 0) / maxHits);
    else if (by === 'hier'){ const c = Math.sqrt((l.hits || 0) / maxHits); t = l.level === 1 ? 0.5 + 0.5 * c : 0.5 * c; }
    else if (by === 'length') t = plen(l.pts) / maxLen;
    if (t !== null){ out.push({ pts: l.pts, w: l.pts.map(() => widthOf(t)), level: l.level }); continue; }
    const w = l.pts.map(p => { let tt = 0;
      if (by === 'edge') tt = 1 - clamp(BA.eD[cellAt(p[0], p[1])] / 260, 0, 1);
      else if (by === 'attr'){ let d = 1e9; for (const a of att) d = Math.min(d, Math.hypot(p[0] - a.x, p[1] - a.y)); tt = att.length ? 1 - clamp((d - 45) / 380, 0, 1) : 0; }
      else if (by === 'wind') tt = 1 - clamp((exposureAt(p[0], p[1]) - 0.3) / 1.4, 0, 1);
      return widthOf(tt); });
    out.push({ pts: l.pts, w, level: l.level }); }
  for (const l of LINES) if (!l.dead && l.circus) out.push({ pts: l.pts, w: l.pts.map(() => widthOf(1)), level: 1 });
  return out; }
function rampCol(w){ const lo = v('wMin'), hi = Math.max(v('wMax'), lo + 1), t = clamp((w - lo) / (hi - lo), 0, 1); return 'rgb(' + mix(P.wLo, P.wHi, t).join(',') + ')'; }
function strokeVar(g, sw, pad, colour){ // each segment at its own width; round caps join them
  for (const st of sw){ const Pp = st.pts; let k = 1;
    while (k < Pp.length){ const w = st.w[k]; g.beginPath(); g.moveTo(X(Pp[k - 1][0]), Y(Pp[k - 1][1]));
      while (k < Pp.length && st.w[k] === w){ g.lineTo(X(Pp[k][0]), Y(Pp[k][1])); k++; }
      g.lineWidth = (w + pad) * view.s; if (colour) g.strokeStyle = rampCol(w); g.stroke(); } } }
function drawWidth(){ const w = L_width.width, h = L_width.height, sw = streetWidths();
  // 1 the road surface: every street at its width, the land's edge road at the widest, the link; closed by a blur (the fillets)
  const a = mk(); a.width = w; a.height = h; const ga = a.getContext('2d'); ga.setTransform(DPR, 0, 0, DPR, 0, 0); ga.strokeStyle = '#000'; ga.lineCap = 'round'; ga.lineJoin = 'round';
  strokeVar(ga, sw, 0, false);
  ga.lineWidth = Math.max(v('wMax'), v('wMin')) * view.s; for (const l of LINES){ if (!l.dead && l.level === 0 && !l.hole){ pathLine(ga, l.pts); ga.stroke(); } }   // (v8.8) the shores of water and flood zones are not roads
  for (const s_ of D.fixed.streets.concat([D.fixed.link])){ pathLine(ga, s_); ga.stroke(); }
  const m = mk(); m.width = w; m.height = h; const gm = m.getContext('2d'); gm.filter = 'blur(' + Math.max(1, Math.round(6 * view.s * DPR)) + 'px)'; gm.drawImage(a, 0, 0); gm.filter = 'none';
  const im = gm.getImageData(0, 0, w, h), d = im.data; for (let i = 0; i < d.length; i += 4){ d[i + 3] = d[i + 3] >= 105 ? 255 : 0; } gm.putImageData(im, 0, 0);
  // 2 the colour by width: narrow to wide, the wider drawn last, a little wider than the road so it fills the fillets
  const g = L_width.getContext('2d'); g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, w, h); g.setTransform(DPR, 0, 0, DPR, 0, 0); g.lineCap = 'round'; g.lineJoin = 'round';
  const hiCol = rampCol(Math.max(v('wMax'), v('wMin')));
  g.strokeStyle = hiCol; g.lineWidth = (Math.max(v('wMax'), v('wMin')) + 8) * view.s; for (const l of LINES){ if (!l.dead && l.level === 0 && !l.hole){ pathLine(g, l.pts); g.stroke(); } }
  for (const s_ of D.fixed.streets.concat([D.fixed.link])){ pathLine(g, s_); g.stroke(); }
  const segs = []; for (const st of sw) for (let k = 1; k < st.pts.length; k++) segs.push([st.w[k], st.pts[k - 1], st.pts[k]]);
  segs.sort((p, q) => p[0] - q[0]);
  for (const [ww, p0, p1] of segs){ g.strokeStyle = rampCol(ww); g.lineWidth = (ww + 8) * view.s; g.beginPath(); g.moveTo(X(p0[0]), Y(p0[1])); g.lineTo(X(p1[0]), Y(p1[1])); g.stroke(); }
  g.setTransform(1, 0, 0, 1, 0, 0); g.globalCompositeOperation = 'destination-in'; g.drawImage(m, 0, 0); g.globalCompositeOperation = 'source-over';
  widthDirty = false; widthNumbers(sw); }
function widthNumbers(sw){ const by = {}; let area = 0;
  for (const st of sw) for (let k = 1; k < st.pts.length; k++){ const L = Math.hypot(st.pts[k][0] - st.pts[k - 1][0], st.pts[k][1] - st.pts[k - 1][1]), ww = st.w[k]; area += L * ww; const key = $('wSnap').checked ? ww : Math.round(ww); by[key] = (by[key] || 0) + L; }
  const land = D.pieces.reduce((s_, p) => s_ + Math.abs(polyArea(p.outer)), 0), tot = Object.values(by).reduce((a, b) => a + b, 0) || 1;
  const keys = Object.keys(by).map(Number).sort((a, b) => a - b), avg = area / tot;
  $('wnum').innerHTML = keys.map(k => '<b>' + k + ' m</b> ' + (by[k] / 1000).toFixed(1) + ' km').join(' · ') + NL +
    'average <b>' + avg.toFixed(1) + ' m</b> · the inside streets take <b>' + Math.round(100 * area / land) + ' %</b> of the land'; }
function drawRamp(){ $('wRamp').style.background = 'linear-gradient(90deg,' + rampCol(v('wMin')) + ',' + rampCol(Math.max(v('wMax'), v('wMin'))) + ')';
  $('wLo').textContent = v('wMin') + ' m'; $('wHi').textContent = Math.max(v('wMax'), v('wMin')) + ' m'; }

/* ------------------------------------------------------------------ moving layers: the field flowing, the winds blowing */
const FLOW = [], WIND = []; const NFLOW = 6500, NWIND = 3000; let rs2 = 7; const rnd2 = () => { rs2 = (rs2 * 16807) % 2147483647; return rs2 / 2147483647; };
function clearTrails(){ for (const c of [L_flow, L_wind]){ const g = c.getContext('2d'); g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, c.width, c.height); } }
function spawnFlow(p){ for (let k = 0; k < 40; k++){ const x = rnd2() * D.w, y = rnd2() * D.h; if (inLandNoCircus(x, y)){ p.x = x; p.y = y; p.age = 0; p.max = 90 + rnd2() * 160; p.dx = 0; p.dy = 0; p.sg = rnd2() < 0.5 ? 1 : -1; return; } } p.x = -1; }
function inLandNoCircus(x, y){ const c = Math.floor(x / MC), r = Math.floor((D.h - y) / MC); return MASK && c >= 0 && r >= 0 && c < MW && r < MH && MASK[r * MW + c] === 1; }
function stepFlow(){ const g = L_flow.getContext('2d'); g.setTransform(DPR, 0, 0, DPR, 0, 0);
  g.globalCompositeOperation = 'destination-out'; g.fillStyle = 'rgba(0,0,0,' + P.fade + ')'; g.fillRect(0, 0, VW, VH); g.globalCompositeOperation = P.flowBlend;
  const buckets = [[], [], [], [], [], []]; const base = 1.6 / view.s, spd = 2.8 / view.s;
  if (FLOW.length < NFLOW){ for (let k = FLOW.length; k < NFLOW; k++){ const p = {}; spawnFlow(p); FLOW.push(p); } }
  for (const p of FLOW){ if (p.x < 0){ spawnFlow(p); continue; } const f = flowAt(p.x, p.y); if (!f){ spawnFlow(p); continue; }
    let dx = Math.cos(f[0]), dy = Math.sin(f[0]); if (p.dx === 0 && p.dy === 0){ dx *= p.sg; dy *= p.sg; } else if (dx * p.dx + dy * p.dy < 0){ dx = -dx; dy = -dy; }
    const m = f[1], sp = base + spd * m, nx_ = p.x + dx * sp, ny_ = p.y + dy * sp;
    if (!inLandNoCircus(nx_, ny_) || ++p.age > p.max){ spawnFlow(p); continue; }
    buckets[Math.min(5, Math.floor(m * 6))].push(X(p.x), Y(p.y), X(nx_), Y(ny_)); p.x = nx_; p.y = ny_; p.dx = dx; p.dy = dy; }
  for (let b = 0; b < 6; b++){ const s = buckets[b]; if (!s.length) continue; const t = b / 5, c = t < 0.5 ? mix(P.flow[0], P.flow[1], t * 2) : mix(P.flow[1], P.flow[2], (t - 0.5) * 2);
    g.strokeStyle = 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + (P.flowAlpha * (0.45 + 0.55 * t)) + ')'; g.lineWidth = 0.75 + 0.6 * t; g.beginPath();
    for (let i = 0; i < s.length; i += 4){ g.moveTo(s[i], s[i + 1]); g.lineTo(s[i + 2], s[i + 3]); } g.stroke(); }
  g.globalCompositeOperation = 'source-over'; }
function mix(a, b, t){ return [0, 1, 2].map(i => Math.round(a[i] + (b[i] - a[i]) * t)); }
function spawnWind(p){ p.x = rnd2() * D.w; p.y = rnd2() * D.h; p.age = 0; p.max = 80 + rnd2() * 140; p.j = (rnd2() - 0.5) * 0.22; }
function recycleWind(){ const [a] = HRANGE[MONTH]; HCLOCK = a; }
// the wind as it blew: all the air moving one way, turning as the weather turned (24 h smoothed), a day every second;
// faster where the site is exposed to that direction, slower where the ground shelters it
function stepWind(){ const g = L_wind.getContext('2d'); g.setTransform(DPR, 0, 0, DPR, 0, 0);
  g.globalCompositeOperation = 'destination-out'; g.fillStyle = 'rgba(0,0,0,0.05)'; g.fillRect(0, 0, VW, VH); g.globalCompositeOperation = 'source-over';
  if (WIND.length < NWIND){ for (let k = WIND.length; k < NWIND; k++){ const p = {}; spawnWind(p); WIND.push(p); } }
  HCLOCK += (24 / HR.step) / 60; const w = windNow(), kd = DIRS[w.k], base = Math.atan2(w.v, w.u), sp0 = 0.55 / view.s * Math.max(0.6, w.spd);
  const segs = [];
  for (const p of WIND){ const c = clamp(Math.floor(p.x / cell), 0, nx - 1), r = clamp(Math.floor(p.y / cell), 0, ny - 1), rel = kd.rel[r * nx + c];
    const a = base + p.j, sp = sp0 * (0.45 + 0.55 * rel), nx_ = p.x + Math.cos(a) * sp, ny_ = p.y + Math.sin(a) * sp;
    if (nx_ < 0 || ny_ < 0 || nx_ > D.w || ny_ > D.h || ++p.age > p.max){ spawnWind(p); continue; }
    segs.push(X(p.x), Y(p.y), X(nx_), Y(ny_)); p.x = nx_; p.y = ny_; }
  g.strokeStyle = kd.job === 'along' ? P.windAlong : P.windAcross; g.globalAlpha = THEME === 'dark' ? 0.55 : 0.45; g.lineWidth = 0.95; g.beginPath();
  for (let i = 0; i < segs.length; i += 4){ g.moveTo(segs[i], segs[i + 1]); g.lineTo(segs[i + 2], segs[i + 3]); } g.stroke();
  g.globalAlpha = 1; }
function drawRose(){ if (!$('lRose').checked || !($('windOn').checked || $('lWind').checked || SIM)) return;
  const M = YEAR[MONTH], R = 46, cx = (window.__TS_INSETS ? window.__TS_INSETS().l : 0) + 26 + R + 8, cy = VH - 26 - R - 18, mx = Math.max(...YEAR.map(m => Math.max(...m.share)));
  const bw = 2 * R + 36 + ($('lWind').checked ? 190 : 0);
  ctx.fillStyle = THEME === 'dark' ? 'rgba(28,28,30,0.86)' : 'rgba(255,255,255,0.9)'; ctx.strokeStyle = P.contourIdx; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.roundRect ? ctx.roundRect(cx - R - 18, cy - R - 30, bw, 2 * R + 52, 10) : ctx.rect(cx - R - 18, cy - R - 30, bw, 2 * R + 52); ctx.fill(); ctx.stroke();
  ctx.strokeStyle = P.contour; for (const f of [0.5, 1]){ ctx.beginPath(); ctx.arc(cx, cy, R * f, 0, 2 * PI); ctx.stroke(); }
  for (let d = 0; d < 8; d++){ const L = R * Math.sqrt(M.share[d] / mx), a = (90 - DIRS[d].frm) * PI / 180, w = PI / 9;
    ctx.fillStyle = DIRS[d].job === 'along' ? P.windAlong : P.windAcross; ctx.globalAlpha = 0.85; ctx.beginPath(); ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, L, -(a + w), -(a - w)); ctx.closePath(); ctx.fill(); }
  ctx.globalAlpha = 1; ctx.fillStyle = P.main; ctx.font = '600 12px -apple-system, BlinkMacSystemFont, "SF Pro Text", "Helvetica Neue", "PingFang SC", "Microsoft YaHei", sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  ctx.fillText('wind, ' + M.name, cx, cy - R - 12); ctx.font = '10px -apple-system, BlinkMacSystemFont, "SF Pro Text", "Helvetica Neue", "PingFang SC", "Microsoft YaHei", sans-serif'; ctx.fillStyle = P.label;
  ctx.fillText('N', cx, cy - R - 1); ctx.fillText('S', cx, cy + R + 10); ctx.textAlign = 'left'; ctx.fillText('E', cx + R + 3, cy + 3); ctx.textAlign = 'right'; ctx.fillText('W', cx - R - 3, cy + 3);
  ctx.textAlign = 'center'; ctx.fillText('calm ' + Math.round(100 * M.calm) + ' %', cx, cy + R + 22);
  if ($('lWind').checked){ const w = windNow(), a = (90 - w.frm) * PI / 180, L = R * Math.min(1, w.spd / 9); ctx.strokeStyle = P.main; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(cx + Math.cos(a) * L, cy - Math.sin(a) * L); ctx.lineTo(cx, cy); ctx.stroke(); ctx.fillStyle = P.main; ctx.beginPath(); ctx.arc(cx, cy, 2.5, 0, 2 * PI); ctx.fill();
    const MN = 'Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec'.split(' ');
    ctx.font = '10.5px -apple-system, BlinkMacSystemFont, "SF Pro Text", "Helvetica Neue", "PingFang SC", "Microsoft YaHei", sans-serif'; ctx.fillStyle = P.main; ctx.textAlign = 'left';
    ctx.fillText(HR.day[w.i] + ' ' + MN[HR.month[w.i] - 1] + ' · from ' + SECTOR[Math.round(w.frm / 22.5) % 16] + ' · ' + w.spd.toFixed(1) + ' m/s', cx + R + 24, cy - 6);
    ctx.fillStyle = DIRS[w.k].job === 'along' ? P.windAlong : P.windAcross; ctx.fillText(DIRS[w.k].job === 'along' ? 'streets along it' : 'streets across it', cx + R + 24, cy + 9); } }

/* ------------------------------------------------------------------ the field as still lines: every street the field could make */
function fieldLines(sp){ if (FLINES) return FLINES; const out = [], cs = sp * 0.5;
  for (const fam of [0, 1]){ const occ = new Map(), k = (x, y) => Math.floor(x / cs) + ',' + Math.floor(y / cs);
    const free = (x, y) => { const cx = Math.floor(x / cs), cy = Math.floor(y / cs); for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++){ const b = occ.get((cx + i) + ',' + (cy + j)); if (b) for (let q = 0; q < b.length; q += 2) if (Math.hypot(b[q] - x, b[q + 1] - y) < cs) return false; } return true; };
    const put = (x, y) => { const key = k(x, y); let b = occ.get(key); if (!b){ b = []; occ.set(key, b); } b.push(x, y); };
    const fsp = fam === 0 ? sp : sp * 1.6;
    for (let x = fsp / 2; x < D.w; x += fsp) for (let y = fsp / 2; y < D.h; y += fsp){ if (!inLand(x, y) || !free(x, y)) continue;
      const t0 = fieldAtT(x, y); if (t0 === null) continue; const d0 = [Math.cos(t0 + fam * PI / 2), Math.sin(t0 + fam * PI / 2)], halves = [];
      for (const sg of [1, -1]){ const pts = []; let px = x, py = y, prev = [d0[0] * sg, d0[1] * sg];
        for (let n = 0; n < 160; n++){ const t = fieldAtT(px, py); if (t === null) break; let dx = Math.cos(t + fam * PI / 2), dy = Math.sin(t + fam * PI / 2); if (dx * prev[0] + dy * prev[1] < 0){ dx = -dx; dy = -dy; }
          const qx = px + dx * 5, qy = py + dy * 5; if (!inLand(qx, qy) || !free(qx, qy)) break; pts.push([qx, qy]); prev = [dx, dy]; px = qx; py = qy; }
        halves.push(pts); }
      const L = halves[1].reverse().concat([[x, y]], halves[0]); if (L.length < 6) continue; for (const q of L) put(q[0], q[1]); out.push({ fam, pts: L }); } }
  return (FLINES = out); }
function drawFieldLines(g){ const fl = fieldLines(40); g.lineCap = 'round'; g.lineJoin = 'round';
  for (const l of fl){ g.strokeStyle = l.fam === 0 ? P.fieldLine : P.fieldLine2; g.lineWidth = l.fam === 0 ? 1.0 : 0.6; pathLine(g, l.pts); g.stroke(); } }

/* ------------------------------------------------------------------ the frame */
let T0 = performance.now(), lastView = '';
function render(now){
  const vk = view.x.toFixed(2) + ',' + view.y.toFixed(2) + ',' + view.s.toFixed(5) + ',' + VW + ',' + VH;
  if (vk !== lastView){ lastView = vk; baseDirty = netDirty = widthDirty = true; clearTrails(); }
  if (baseDirty) drawBase();
  if (netDirty) drawNet(true); else if (netDrawn < LINES.length) drawNet(false);
  if (FIELDMODE === 'lines' && !FLINES) baseDirty = true, drawBase();
  if ($('lFlow').checked && !FROZEN) stepFlow();
  if ($('lWind').checked && !FROZEN) stepWind();
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, cv.width, cv.height);
  ctx.drawImage(L_base, 0, 0);
  if (window.ENVANIM && ENVANIM.on) ENVANIM.draw(ctx, now);   // (v8.9) the analysis map, animated (step 2)
  if ($('lFlow').checked) ctx.drawImage(L_flow, 0, 0);
  if ($('lWidth').checked && FINISHED){ if (widthDirty) drawWidth(); ctx.drawImage(L_width, 0, 0); }
  if (GHOST && $('lStreets').checked){ const ga = GHOSTT ? clamp(1 - (now - GHOSTT) / 1600, 0, 1) : 1; if (ga > 0){ ctx.save(); ctx.setTransform(DPR, 0, 0, DPR, 0, 0); ctx.globalAlpha = ga;
      ctx.strokeStyle = P.ghost; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; for (const g of GHOST){ ctx.lineWidth = g.level === 1 ? 2.6 : 1.0; ctx.beginPath(); g.pts.forEach((p, k) => k ? ctx.lineTo(X(p[0]), Y(p[1])) : ctx.moveTo(X(p[0]), Y(p[1]))); ctx.stroke(); }
      ctx.restore(); } else GHOST = null; }
  if ($('lOther').checked){ const sn = SNAP[MODE === 'A' ? 'B' : 'A']; if (sn){ ctx.save(); ctx.setTransform(DPR, 0, 0, DPR, 0, 0); ctx.strokeStyle = P.other; ctx.setLineDash([5, 4]); ctx.lineCap = 'butt';
      for (const l of sn.lines){ if (l.level === 0) continue; ctx.lineWidth = l.level === 1 ? 2.0 : 1.0; ctx.beginPath(); l.pts.forEach((p, k) => k ? ctx.lineTo(X(p[0]), Y(p[1])) : ctx.moveTo(X(p[0]), Y(p[1]))); ctx.stroke(); }
      ctx.restore(); } }
  ctx.drawImage(L_net, 0, 0);
  if ($('lWind').checked) ctx.drawImage(L_wind, 0, 0);
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  // the street growing now
  if (GROW && !SCRUB && $('lStreets').checked){ const [col, w] = GROW.level === 1 ? [P.grow, 3] : [P.grow, 1.6]; ctx.strokeStyle = col; ctx.lineWidth = w;
    if (GROW.h0){ ctx.beginPath(); const h = GROW.h0; h.forEach((p, k) => k ? ctx.lineTo(X(p[0]), Y(p[1])) : ctx.moveTo(X(p[0]), Y(p[1]))); ctx.stroke(); }
    const cur = GROW.cur; if (cur.length){ ctx.beginPath(); ctx.moveTo(X(GROW.seed[0]), Y(GROW.seed[1])); for (const p of cur) ctx.lineTo(X(p[0]), Y(p[1])); ctx.stroke();
      const tip = cur[cur.length - 1]; ctx.fillStyle = P.glow; ctx.beginPath(); ctx.arc(X(tip[0]), Y(tip[1]), 9, 0, 2 * PI); ctx.fill(); ctx.fillStyle = P.grow; ctx.beginPath(); ctx.arc(X(tip[0]), Y(tip[1]), 3, 0, 2 * PI); ctx.fill(); } }
  // mode B: every street growing now, its tip glowing
  if (MODE === 'B' && GROWING && !SCRUB && $('lStreets').checked){ for (const tp of TIPS){ if (tp.done) continue; ctx.fillStyle = P.glow; ctx.beginPath(); ctx.arc(X(tp.x), Y(tp.y), 7, 0, 2 * PI); ctx.fill(); ctx.fillStyle = P.grow; ctx.beginPath(); ctx.arc(X(tp.x), Y(tp.y), 2.4, 0, 2 * PI); ctx.fill(); } }
  // the link and the bridges (as bridges: deck, parapets, abutments)
  ctx.strokeStyle = P.main; ctx.lineWidth = 2.4; for (const s of [D.fixed.link, ...D.fixed.streets]){ ctx.beginPath(); s.forEach((p, k) => k ? ctx.lineTo(X(p[0]), Y(p[1])) : ctx.moveTo(X(p[0]), Y(p[1]))); ctx.stroke(); }
  for (const b of D.fixed.bridges){ const a = b[0], c = b[b.length - 1]; ctx.lineCap = 'butt'; ctx.strokeStyle = P.bridge; ctx.lineWidth = 8; ctx.beginPath(); ctx.moveTo(X(a[0]), Y(a[1])); ctx.lineTo(X(c[0]), Y(c[1])); ctx.stroke();
    ctx.strokeStyle = P.bg; ctx.lineWidth = 4.5; ctx.stroke(); ctx.lineCap = 'round'; }
  // culverts, anchors, attractors (pulsing)
  if ($('lStreets').checked){ ctx.strokeStyle = P.culvert; ctx.lineWidth = 1.2; ctx.fillStyle = P.bg; for (const c of (SCRUB ? CULVERTS.slice(0, SCRUB.cul) : CULVERTS)){ ctx.beginPath(); ctx.arc(X(c.x), Y(c.y), 2.4, 0, 2 * PI); ctx.fill(); ctx.stroke(); } }
  if ($('lEvents').checked) drawEvents();
  ctx.fillStyle = P.anchor; for (const a of D.anchors){ ctx.beginPath(); ctx.arc(X(a.x), Y(a.y), 4, 0, 2 * PI); ctx.fill(); }
  const tt = (now - T0) / 1000;
  // (v8.12) each kind its own colour and size: main blue and large, local cyan and small, edge purple; the dot and the
  // pulse grow with the kind's pull, the faint circle is its reach
  for (const a of attractorsOn()){ const col = a.kind === 'edge' ? P.attrE : a.main ? P.attr : P.attr2, sz = a.kind === 'sec' ? 4.5 : 4.5, pf = clamp(a.pull / 2.4, 0.15, 1.3), x = X(a.x), y = Y(a.y);
    ctx.globalAlpha = 0.22; ctx.strokeStyle = col; ctx.lineWidth = 1; ctx.setLineDash([3, 4]); ctx.beginPath(); ctx.arc(x, y, a.reach * view.s, 0, 2 * PI); ctx.stroke(); ctx.setLineDash([]);
    for (let k = 0; k < 2; k++){ const ph = ((tt * 0.6 + k * 0.5) % 1), r = sz + 3 + ph * (a.reach * view.s * 0.55 * pf); ctx.strokeStyle = col; ctx.globalAlpha = (1 - ph) * 0.6 * Math.min(1, 0.35 + pf); ctx.lineWidth = a.kind === 'sec' ? 1.1 : 1.8; ctx.beginPath(); ctx.arc(x, y, r, 0, 2 * PI); ctx.stroke(); }
    const rr = sz + 2.2 * pf; ctx.globalAlpha = 1; ctx.fillStyle = col; ctx.strokeStyle = THEME === 'dark' ? '#000' : '#fff'; ctx.lineWidth = 1.5;
    // (v8.13) the shape tells the kind: main a circle, local a square, edge a triangle
    if (a.kind === 'edge'){ const h = rr * 1.25; ctx.beginPath(); ctx.moveTo(x, y - h * 1.05); ctx.lineTo(x + h, y + h * 0.75); ctx.lineTo(x - h, y + h * 0.75); ctx.closePath(); ctx.fill(); ctx.stroke(); }
    else if (a.kind === 'main'){ ctx.beginPath(); ctx.arc(x, y, rr + 2.5, 0, 2 * PI); ctx.lineWidth = 2.5; ctx.strokeStyle = col; ctx.stroke(); ctx.beginPath(); ctx.arc(x, y, rr, 0, 2 * PI); ctx.fill(); }
    else { const h = rr * 1.05; ctx.beginPath(); ctx.rect(x - h, y - h, 2 * h, 2 * h); ctx.fill(); ctx.stroke(); } }
  drawScale(); drawRose(); hud(); }
function drawScale(){ const want = VW * 0.16 / view.s; let m = 50; for (const s of [50, 100, 200, 250, 500, 1000, 2000]) if (s <= want) m = s;
  const x1 = VW - 24 - (window.__TS_INSETS ? window.__TS_INSETS().rb : 0), x0 = x1 - m * view.s, y = VH - 26; for (let k = 0; k < 4; k++){ ctx.fillStyle = k % 2 ? P.bg : P.main; ctx.fillRect(x0 + m * view.s * k / 4, y, m * view.s / 4, 5); }
  ctx.strokeStyle = P.main; ctx.lineWidth = 0.8; ctx.strokeRect(x0, y, m * view.s, 5); ctx.fillStyle = P.main; ctx.font = '11px -apple-system, BlinkMacSystemFont, "SF Pro Text", "Helvetica Neue", "PingFang SC", "Microsoft YaHei", sans-serif'; ctx.textAlign = 'right'; ctx.textBaseline = 'alphabetic'; ctx.fillText(m + ' m', x1, y - 6); ctx.textAlign = 'left'; ctx.fillText('0', x0, y - 6);
  const cx = x0 - 26, cy = y - 2, R = 9; ctx.beginPath(); ctx.arc(cx, cy, R, 0, 2 * PI); ctx.stroke(); ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx, cy - R); ctx.stroke(); ctx.textAlign = 'center'; ctx.fillText('N', cx, cy - R - 4); }
function hud(){ const pre = '<b>' + (MODE === 'A' ? 'A · today' : 'B · branching') + '</b> · ' + (SIM ? 'wind simulation · <b>' + YEAR[MONTH].name + '</b> · ' : ($('windOn').checked ? 'wind of <b>' + YEAR[MONTH].name + '</b> · ' : 'along the contour · '));
  const hudHTML = pre + (GROWING ? 'growing: <b>' + PHASE + '</b> · ' + LINES.filter(l => l.level > 0 && !l.dead).length + ' streets' : (FINISHED ? '<b>' + LINES.filter(l => l.level > 0 && !l.dead).length + '</b> streets · ' + CULVERTS.length + ' culverts · ' + HOLES.length + ' circuses' : 'ready')); if ($('hud')._lastEnglish !== hudHTML){ $('hud')._lastEnglish = hudHTML; $('hud').innerHTML = hudHTML; } }
function genDone(now){ GEN = null; GROWING = false; netDirty = true; GHOSTT = now; if (SIM) SIM.next = now + SIM_HOLD; if (PROC && PROC.onDone) PROC.onDone(); }
// (v8.7) run the generator at once up to the first phase pred(phase) accepts (or the end), without drawing: the steps before the one being watched
function runUntil(pred){ if (!GEN) return; let r; do { r = GEN.next(); if (PHASE !== PH0){ PH0 = PHASE; if (!r.done && pred(PHASE)){ GROWING = false; return; } } } while (!r.done); genDone(performance.now()); }
function frame(now){ morphStep();
  if (GROWING && GEN){ const t0 = performance.now(), cap = PROC && PROC.steps ? PROC.steps() : 0, budget = cap ? 14 : v('speed'); let r, stopped = false, n = 0;
    // (v8.7) the process mode grows a fixed number of steps a frame (cap), so slow is slow on any machine
    do { r = GEN.next(); n++; if (PROC && PHASE !== PH0){ PH0 = PHASE; if (!r.done && PROC.stopAt && PROC.stopAt(PHASE)){ GROWING = false; stopped = true; break; } } } while (!r.done && (!cap || n < cap) && performance.now() - t0 < budget);
    if (r.done){ if (PROC && PROC.record) PROC.record(true); genDone(now); }
    else { measuresLive(); if (MODE === 'B') netDirty = true; if (PROC && PROC.record) PROC.record(false); if (stopped && PROC.onStop) PROC.onStop(PHASE); } }
  if (SIM && !SIM.paused && !GROWING && now >= SIM.next){ if (SIM.i >= 12){ SIM = null; } else { SIM.i++; setMonth(SIM.i, true); SIM.next = now + ($('simGrow').checked ? 1e9 : SIM_HOLD + 1200); } }
  render(now); requestAnimationFrame(frame); }
let SIM = null, GHOST = null, GHOSTT = 0; const SIM_HOLD = 1500;
function setMonth(i, regrow){ MONTH = i; $('month').value = i; $('month').nextElementSibling.textContent = YEAR[i].name; recycleWind(); buildTarget();
  if (regrow && $('simGrow').checked){ GHOST = LINES.filter(l => !l.dead && l.level > 0).map(l => ({ level: l.level, pts: l.pts })); GHOSTT = 0; start(true); } }
function simStart(){ $('windOn').checked = true; $('lWind').checked = true; FROZEN = false; clearTrails(); SIM = { i: -1, next: 0 }; syncTools(); }
function simPause(){ if (SIM){ SIM.paused = !SIM.paused; $('bSimPause').textContent = SIM.paused ? 'Resume' : 'Pause'; } }
// stop: the year's result, settled, every street at width, nothing moving
function settleField(){ for (let i = 0; i < N; i++){ CC[i] = TC[i]; CS[i] = TS[i]; CWt[i] = TW[i]; } MORPH = 0; }
function simStop(){ SIM = null; $('bSimPause').textContent = 'Pause'; if ($('windOn').checked){ MONTH = 12; $('month').value = 12; $('month').nextElementSibling.textContent = YEAR[12].name; buildTarget(); settleField(); GHOST = null; start(false); }
  showResult(); }
function showResult(){ SIM = null; if (GEN) runAll(); GHOST = null; setField('off'); $('lWind').checked = false; $('lStreets').checked = true; $('lWidth').checked = true;
  clearTrails(); baseDirty = netDirty = widthDirty = true; syncTools(); }
function setField(m){ FIELDMODE = m; $('lFlow').checked = (m === 'move'); FLINES = null; baseDirty = true; clearTrails(); syncTools(); }
function syncTools(){ for (const b of document.querySelectorAll('#tgField button')) b.classList.toggle('on', b.dataset.v === FIELDMODE);
  $('tWind').classList.toggle('on', $('lWind').checked);   // (v8.3) switches in the display panel: no text swap
  $('tStreets').classList.toggle('on', $('lStreets').checked); $('tWidth').classList.toggle('on', $('lWidth').checked);
  for (const b of document.querySelectorAll('#tgMode button, .modes button')) b.classList.toggle('on', b.dataset.m === MODE);
  for (const b of document.querySelectorAll('#tgUnder button')) b.classList.toggle('on', b.dataset.u === UNDER);
  $('tEvents').classList.toggle('on', $('lEvents').checked); $('tFlood')?.classList.toggle('on', SHOWFLOOD && !!FR); $('tGreen')?.classList.toggle('on', SHOWGREEN && !!GZ);
  $('tFreeze').classList.toggle('on', FROZEN); $('tFreeze').innerHTML = FROZEN ? '&#9654; Resume motion' : '&#10074;&#10074; Freeze motion';
  const st = $('windOn').checked ? 3 : (ATTR.length ? 2 : 1); for (const b of document.querySelectorAll('.steps button')) b.classList.toggle('on', +b.dataset.s === st); }
function setStep(n){ SIM = null; FROZEN = false; GHOST = null;
  if (n === 1){ $('nMain').value = 0; $('nSec').value = 0; $('nEdge').value = 0; $('windOn').checked = false; }
  if (n === 2){ $('nMain').value = 2; $('nSec').value = 2; $('nEdge').value = 3; $('windOn').checked = false; }
  if (n === 3){ if (v('nMain') + v('nSec') === 0){ $('nMain').value = 2; $('nSec').value = 2; } if (!v('nEdge')) $('nEdge').value = 3; }
  for (const id of ['nMain', 'nSec', 'nEdge']){ const o = $(id).nextElementSibling; if (o) o.textContent = $(id).value; }
  placeAttractors();
  $('lWind').checked = false; $('lWidth').checked = false; $('lStreets').checked = true; setField('move');
  buildTarget(); if (n === 3){ simStart(); } else { start(true); } syncTools(); }
let liveTick = 0; function measuresLive(){ if (++liveTick % 8) return; measures(); }

/* ------------------------------------------------------------------ the key */
function drawKey(){ const k = $('key'), sw = (c, w, dash) => '<i style="border-top:' + w + 'px ' + (dash || 'solid') + ' ' + c + '"></i>';
  const g = 'linear-gradient(90deg, rgb(' + P.flow[0] + '), rgb(' + P.flow[1] + '), rgb(' + P.flow[2] + '))';
  k.innerHTML = sw(P.main, 3) + '<span>main street (level 1)</span>' + sw(P.second, 1.5) + '<span>second street (level 2)</span>' + sw(P.edge, 2) + '<span>the land\'s edge, a road</span>' +
    '<i style="border:0;height:9px;width:9px;border-radius:50%;background:' + P.anchor + '"></i><span>your anchor</span>' + '<i style="border:2px solid ' + P.attr + ';height:8px;width:8px;border-radius:50%"></i><span>attractor (main · secondary · on the edge): drag to move, double-click to add, right-click to remove</span>' +
    sw(P.bridge, 6) + '<span>bridge</span>' + '<i class="grad" style="border:0;background:' + g + '"></i><span>the field flowing: faint where its parts cancel, bright where one rules</span>' +
    sw(P.windAlong, 2) + '<span>the wind blowing from south-east to west: streets along it (air through)</span>' + sw(P.windAcross, 2) + '<span>blowing from north-west to east: streets across it (shelter)</span>' +
    sw(P.ghost, 3) + '<span>the month before, fading</span>' + sw(P.other, 2, 'dashed') + '<span>the other mode (to compare)</span>' +
    '<i style="border:0;height:8px;width:8px;border-radius:50%;background:' + P.evBranch + '"></i><span>B: a side street branches off (T)</span>' +
    '<i style="border:0;height:10px;width:10px;color:' + P.evFork + ';font:700 12px/10px sans-serif;font-style:normal">Y</i><span>B: a street forks, contour against wind</span>' +
    '<i style="border:0;height:8px;width:8px;border-radius:50%;background:' + P.evFork + '"></i><span>merges into another (Y)</span>' +
    '<i style="border:0;height:6px;width:6px;border-radius:50%;background:' + P.main + '"></i><span>ends on another street (T)</span>' +
    '<i style="border:0;height:10px;width:10px;color:' + P.evCross + ';font:700 12px/10px sans-serif;font-style:normal">×</i><span>two streets cross (X)</span>' +
    '<i style="border:0;height:10px;width:10px;color:' + P.evInfill + ';font:700 13px/10px sans-serif;font-style:normal">+</i><span>B: empty ground reached</span>' +
    '<i class="grad" style="border:0;background:rgba(' + P.uTeal + ',0.45)"></i><span>read: clear, one direction rules</span>' +
    '<i class="grad" style="border:0;background:rgba(' + P.uOrange + ',0.55)"></i><span>read: conflict, contour against wind</span>'; }

/* ------------------------------------------------------------------ interaction */
let drag = null;
let adrag = null;
function attrAt(mx, my){ let best = null, bd = 14; ATTR.forEach((a, i) => { const d = Math.hypot(X(a.x) - mx, Y(a.y) - my); if (d < bd){ bd = d; best = i; } }); return best; }
cv.addEventListener('pointerdown', e => { if (e.button === 2) return; const r = cv.getBoundingClientRect(), i = attrAt(e.clientX - r.left, e.clientY - r.top); cv.setPointerCapture(e.pointerId);
  if (i !== null){ adrag = { i, moved: false }; cv.style.cursor = 'grabbing'; return; } drag = [e.clientX, e.clientY, view.x, view.y]; });
cv.addEventListener('pointermove', e => { const r = cv.getBoundingClientRect(), mx = e.clientX - r.left, my = e.clientY - r.top;
  if (adrag){ const x = (mx - VW / 2) / view.s + view.x, y = (VH / 2 - my) / view.s + view.y, a = ATTR[adrag.i];
    if (a.kind === 'edge'){ let best = null; for (const p of D.pieces){ const q = nearestOnRing(p.outer, x, y); if (!best || q.d < best.d) best = q; } if (best){ a.x = best.x; a.y = best.y; adrag.moved = true; } }
    else if (inLandNoHoles(x, y)){ a.x = x; a.y = y; adrag.moved = true; } return; }
  if (!drag){ cv.style.cursor = attrAt(mx, my) !== null ? 'grab' : ''; return; }
  view.x = drag[2] - (e.clientX - drag[0]) / view.s; view.y = drag[3] + (e.clientY - drag[1]) / view.s; });
cv.addEventListener('pointerup', e => { if (drag && !adrag && Math.hypot(e.clientX - drag[0], e.clientY - drag[1]) < 4 && window.__TS_CLICK){ const r = cv.getBoundingClientRect(), mx = e.clientX - r.left, my = e.clientY - r.top; window.__TS_CLICK((mx - VW / 2) / view.s + view.x, (VH / 2 - my) / view.s + view.y, e); } });
cv.addEventListener('pointerup', () => { if (adrag && adrag.moved){ buildTarget(); if ($('auto').checked) start(true); drawCmp(); } adrag = null; drag = null; cv.style.cursor = ''; });
// (v8) attractors by hand: double-click on the land adds a main one (shift: a secondary one; alt: one on the edge, snapped
// to it); right-click on one removes it. Either switches to 'your placement (by hand)', keeping the ones already there
function attrChanged(){ placeAttractors(); buildTarget(); syncTools(); if ($('auto').checked) start(true); drawCmp(); }
function toHand(){ if (AMODE !== 'hand'){ AMODE = 'hand'; $('aMode').value = 'hand'; HAND = ATTR; } }
function addAttr(x, y, kind){ if (kind === 'edge'){ let best = null; for (const p of D.pieces){ const q = nearestOnRing(p.outer, x, y); if (!best || q.d < best.d) best = q; } if (!best) return false; x = best.x; y = best.y; }
  else if (!inLandNoHoles(x, y)) return false;
  toHand(); ATTR.push({ x, y, kind }); attrChanged(); return true; }
cv.addEventListener('dblclick', e => { e.preventDefault(); const r = cv.getBoundingClientRect(), mx = e.clientX - r.left, my = e.clientY - r.top; if (attrAt(mx, my) !== null) return;
  addAttr((mx - VW / 2) / view.s + view.x, (VH / 2 - my) / view.s + view.y, e.altKey ? 'edge' : e.shiftKey ? 'sec' : 'main'); });
cv.addEventListener('contextmenu', e => { const r = cv.getBoundingClientRect(), i = attrAt(e.clientX - r.left, e.clientY - r.top); if (i === null) return; e.preventDefault();
  toHand(); ATTR.splice(i, 1); attrChanged(); });
cv.addEventListener('wheel', e => { e.preventDefault(); const r = cv.getBoundingClientRect(), mx = e.clientX - r.left, my = e.clientY - r.top, wx = (mx - VW / 2) / view.s + view.x, wy = (VH / 2 - my) / view.s + view.y, k = Math.exp(-e.deltaY * 0.0015);
  view.s = clamp(view.s * k, 0.05, 8); view.x = wx - (mx - VW / 2) / view.s; view.y = wy - (VH / 2 - my) / view.s; }, { passive: false });
let tmr = null; const FIELD_IDS = ['wC', 'wWind', 'month', 'smooth', 'nMain', 'nSec', 'nEdge', 'pull', 'wSum', 'wWin', 'wG'], NET_IDS = ['d1', 'd2', 'thru', 'stag'];
for (const el of document.querySelectorAll('input[type=range]')){ const o = el.nextElementSibling;
  const up = () => { if (!o) return; if (el.id === 'month'){ o.textContent = YEAR[+el.value].name; return; } if (el.id === 'bFork'){ o.textContent = +el.value >= 0.55 ? 'off' : (+el.value).toFixed(2); return; } if (el.id === 'bGap'){ o.textContent = '× ' + (+el.value).toFixed(2); return; } if (el.id === 'bMem'){ o.textContent = el.value + ' %'; return; } o.textContent = (+el.value).toLocaleString('en-GB') + (['wC', 'wWind', 'thru', 'stag'].includes(el.id) ? ' %' : (el.id === 'speed' ? ' ms' : '')); };
  up(); el.addEventListener('input', up); }
$('month').addEventListener('input', () => { MONTH = +$('month').value; recycleWind(); });
$('windOn').addEventListener('change', () => { buildTarget(); if ($('auto').checked){ GHOST = LINES.filter(l => !l.dead && l.level > 0).map(l => ({ level: l.level, pts: l.pts })); GHOSTT = 0; start(true); } });
$('bSim').onclick = () => setStep(3); $('bSimStop').onclick = simStop; $('bSimPause').onclick = simPause;
for (const b of document.querySelectorAll('.steps button')) b.onclick = () => setStep(+b.dataset.s);
for (const b of document.querySelectorAll('#tgField button')) b.onclick = () => setField(b.dataset.v);
$('tWind').onclick = () => { $('lWind').checked = !$('lWind').checked; clearTrails(); syncTools(); };
$('tStreets').onclick = () => { $('lStreets').checked = !$('lStreets').checked; netDirty = true; syncTools(); };
$('tWidth').onclick = () => { $('lWidth').checked = !$('lWidth').checked; widthDirty = true; syncTools(); };
for (const id of ['wMin', 'wMax', 'wBy', 'wSnap']) $(id).addEventListener(id === 'wBy' || id === 'wSnap' ? 'change' : 'input', () => { if (+$('wMax').value < +$('wMin').value) $('wMax').value = $('wMin').value;
  widthDirty = true; drawRamp(); if (!$('lWidth').checked){ $('lWidth').checked = true; syncTools(); } });
$('tFreeze').onclick = () => { FROZEN = !FROZEN; syncTools(); };
$('tResult').onclick = showResult;
for (const b of document.querySelectorAll('#tgMode button, .modes button')) b.onclick = () => setMode(b.dataset.m);
for (const b of document.querySelectorAll('#tgUnder button')) b.onclick = () => setUnder(b.dataset.u);
$('tGreen').onclick = () => { SHOWGREEN = !SHOWGREEN; try { localStorage.setItem('tensorStudio.showGreen', SHOWGREEN ? '1' : '0'); } catch (e) {} baseDirty = true; syncTools(); };
$('tFlood').onclick = () => { SHOWFLOOD = !SHOWFLOOD; try { localStorage.setItem('tensorStudio.showFlood', SHOWFLOOD ? '1' : '0'); } catch (e) {} baseDirty = true; syncTools(); };
{ const out = $('fW').nextElementSibling, upd = () => { out.textContent = v('fW'); }; upd();
  const regrow = () => { clearTimeout(tmr); tmr = setTimeout(() => { buildTarget(); baseDirty = true; if ($('auto').checked) start(true); drawCmp(); floodNum(); }, 160); };
  $('fW').addEventListener('input', () => { upd(); regrow(); }); $('fOn').addEventListener('change', regrow); $('fAvoid').addEventListener('change', regrow);
  $('gW').addEventListener('input', regrow); $('gOn').addEventListener('change', regrow); $('gQ').addEventListener('change', regrow);
  if (!(window.__TS.D.env && window.__TS.envFns)) for (const id of ['gOn', 'gW', 'gQ', 'wSum', 'wWin', 'wG']) $(id).disabled = true;
  if (!FR) for (const id of ['fOn', 'fAvoid', 'fW']) $(id).disabled = true; }
$('tEvents').onclick = () => { $('lEvents').checked = !$('lEvents').checked; syncTools(); };
$('bBoth').onclick = compareBoth;
for (const id of B_IDS) $(id).addEventListener('input', () => { clearTimeout(tmr); tmr = setTimeout(() => { if (MODE === 'B' && $('auto').checked) start(true); drawCmp(); }, 160); });
$('bInfill').addEventListener('change', () => { if (MODE === 'B' && $('auto').checked) start(true); drawCmp(); });
$('bMains').addEventListener('change', () => { if (MODE === 'B' && $('auto').checked) start(true); drawCmp(); });
$('bSec6').addEventListener('change', () => { if (MODE === 'B' && $('auto').checked) start(true); drawCmp(); });
$('aMode').addEventListener('change', () => { AMODE = $('aMode').value; placeAttractors(); buildTarget(); syncTools(); if ($('auto').checked) start(true); drawCmp(); });
for (const id of FIELD_IDS.concat(NET_IDS)) $(id).addEventListener('input', () => { clearTimeout(tmr); tmr = setTimeout(() => { if (['nMain', 'nSec', 'nEdge'].includes(id)) placeAttractors(); if (FIELD_IDS.includes(id)) buildTarget(); if ($('auto').checked) start(true); drawCmp(); }, 160); });
$('merge').addEventListener('change', () => { if ($('auto').checked) start(true); });
for (const el of document.querySelectorAll('input.lay')) el.addEventListener('change', () => { baseDirty = netDirty = widthDirty = true; if (el.id === 'lFlow'){ FIELDMODE = el.checked ? 'move' : 'off'; } if (el.id === 'lFlow' || el.id === 'lWind') clearTrails(); syncTools(); });
$('bGrow').onclick = () => { if (GEN && !GROWING){ GROWING = true; return; } start(true); };
$('bPause').onclick = () => { if (GEN) GROWING = !GROWING; };
$('bInstant').onclick = () => { if (!GEN) start(false); else runAll(); netDirty = true; };
for (const b of document.querySelectorAll('#theme button')) b.onclick = () => setTheme(b.dataset.t);
function save(name, text, type){ const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type })); a.download = name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500); }
const bng = p => [+(p[0] + OX).toFixed(2), +(p[1] + OY).toFixed(2)];
$('bGeo').onclick = () => { const SW = new Map(streetWidths().map(st => [st.pts, st.w]));
  const F = LINES.filter(l => !l.dead && l.level > 0).map(l => { const ws = SW.get(l.pts) || [], mn = ws.length ? Math.min(...ws) : null, mx = ws.length ? Math.max(...ws) : null;
    return { type: 'Feature', properties: { layer: l.circus ? 'circus' : 'level ' + l.level, width_m: ws.length ? Math.round(10 * ws.reduce((a, b) => a + b, 0) / ws.length) / 10 : null, width_min_m: mn, width_max_m: mx }, geometry: { type: 'LineString', coordinates: l.pts.map(bng) } }; })
    .concat(CULVERTS.map((c, k) => ({ type: 'Feature', properties: { layer: 'culvert', n: k + 1 }, geometry: { type: 'Point', coordinates: bng([c.x, c.y]) } })))
    .concat(D.fixed.bridges.map((b, k) => ({ type: 'Feature', properties: { layer: 'bridge', n: k + 1 }, geometry: { type: 'LineString', coordinates: b.map(bng) } })));
  const set = {}; for (const id of FIELD_IDS.concat(NET_IDS)) set[id] = +$(id).value; set.width_min = v('wMin'); set.width_max = v('wMax'); set.width_by = $('wBy').value; set.width_snap = $('wSnap').checked; set.merge = $('merge').checked; set.windOn = $('windOn').checked; set.wind_of = YEAR[MONTH].name;
  set.flood = floodOn() ? { source: 'EA max(RoFSW, RoFRS)', keep_clear_from_class: +$('fAvoid').value, along_the_flow: v('fW') } : null; set.mode = MODE; set.metrics = METR; set.attractors = { where: AMODE, points: ATTR.map(a => ({ kind: a.kind, at: bng([a.x, a.y]) })) }; save((D.site ? 'tensor studio - london site - mode ' : 'tensor studio v8 - station window - mode ') + MODE + '.geojson', JSON.stringify({ type: 'FeatureCollection', crs: { type: 'name', properties: { name: 'urn:ogc:def:crs:EPSG::27700' } }, settings: set, features: F }), 'application/geo+json'); };
$('bPng').onclick = () => cv.toBlob(b => { const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = (D.site ? 'tensor studio - london site - mode ' : 'tensor studio v8 - station window - mode ') + MODE + '.png'; a.click(); });
window.addEventListener('resize', resize);

/* ------------------------------------------------------------------ start */
(function boot(){ let t = null; try { t = localStorage.getItem('ts7-theme'); } catch (e) {}
  setTheme(t || 'dark');   // dark by default (reviews are in dark)
  resize(); HOLES = []; buildMask();
  // the current result's field (step 3, settled: the contour 70 %, the year's wind 40 %, the attractors): A at once, then B grows live
  $('nMain').value = 2; $('nSec').value = 2; for (const id of ['nMain', 'nSec']){ const o = $(id).nextElementSibling; if (o) o.textContent = '2'; } $('windOn').checked = true; MONTH = 12;
  placeAttractors(); buildTarget(); settleField(); FIELDMODE = 'off'; $('lFlow').checked = false;
  // (v8.7) in the process mode the app opens on step 1, nothing grown yet; the free mode opens on the result as before
  if (window.__TS_PROCESS_ON){ MODE = 'B'; resetNet(); } else { MODE = 'A'; start(false); MODE = 'B'; start(true); } syncTools(); drawKey(); requestAnimationFrame(frame);
  window.__ts6 = { get attr(){ return ATTR; }, placeAttractors, addAttr, get amode(){ return AMODE; }, setAMode: m => { AMODE = m; $('aMode').value = m; placeAttractors(); buildTarget(); syncTools(); }, get mode(){ return MODE; }, setMode, compareBoth, setUnder, get snap(){ return SNAP; }, get events(){ return EVENTS; }, get metr(){ return METR; }, metrics, get tips(){ return TIPS; },
    get conf(){ return CONF; }, get clar(){ return CLAR; }, get D(){ return D; }, get lines(){ return LINES; }, get growing(){ return GROWING; }, get finished(){ return FINISHED; }, runAll, start, measures, setTheme, setMonth, simStart, simStop, setStep, setField, showResult, streetWidths, drawWidth, get culverts(){ return CULVERTS; },
    // (v8.7) for the process mode
    setProc: p => { PROC = p; PH0 = ''; }, syncTools, drawCmp, get phase(){ return PHASE; }, get gen(){ return !!GEN; }, pause(){ if (GEN) GROWING = false; }, resume(){ if (GEN){ GROWING = true; PH0 = PHASE; } }, runUntil, recordFrame, setScrub, resetNet, buildTarget, placeAttractors, settleField,
    setModeQuiet(m){ if (GEN){ GEN = null; GROWING = false; } MODE = m; syncTools(); drawCmp(); }, setEnv(k){ ENVSEL = ENV && k !== 'off' ? k : 'off'; baseDirty = true; syncEnv(); }, get env(){ return ENVSEL; }, get envStats(){ return ENV ? ENV.stats : null; },
    setFlood(b){ SHOWFLOOD = !!b; baseDirty = true; syncTools(); }, setGreen(b){ SHOWGREEN = !!b; baseDirty = true; syncTools(); }, get corr(){ return GINFO; }, get corrOn(){ return !!GZ; }, get flood(){ return FR; }, get floodZones(){ return FLOOD ? FLOOD.zones : null; }, floodNum, get land(){ return FLAND; },
    landHa(){ let n = 0; for (let i = 0; i < MASK.length; i++) n += MASK[i]; return n * MC * MC / 1e4; }, get holes(){ return HOLES; }, get year(){ return YEAR; }, get dirs(){ return DIRS; }, get month(){ return MONTH; }, clearNet(){ GEN = null; GROWING = false; resetNet(); SCRUB = null; } }; })();

/* ---------------- catalogue presets */
const HAND2 = [[518481.8, 238052.3], [517962, 238141]];            // two attractors placed by hand (British National Grid)
const HAND4 = HAND2.concat([[518710, 238817], [519254, 238776]]);  // and two more on the other side of the river (the final pattern)
const OPTIONS = {
  // catalogue 1: contour and wind (no attractors, second streets 95 m apart)
  '1.1': { name: 'Contour only',              wC: 70, wWind: 40, wind: false },
  '1.2': { name: 'Wind only',                 wC: 0,  wWind: 40 },
  '1.3': { name: 'Contour 30, wind 70',       wC: 30, wWind: 70 },
  '1.4': { name: 'Contour 50, wind 50',       wC: 50, wWind: 50 },
  '1.5': { name: 'Contour 70, wind 40 (chosen)', wC: 70, wWind: 40 },
  '1.6': { name: 'Contour 90, wind 20',       wC: 90, wWind: 20 },
  // catalogue 2: street spacing (contour 70, wind 40, no attractors)
  '2.1': { name: '80 m apart',  d2: 80 },  '2.2': { name: '95 m apart (chosen)', d2: 95 }, '2.3': { name: '115 m apart', d2: 115 },
  '2.4': { name: '140 m apart', d2: 140 }, '2.5': { name: '170 m apart', d2: 170 },         '2.6': { name: '200 m apart', d2: 200 },
  // catalogue 3: attractors (contour 70, wind 40, 95 m)
  '3.1': { name: 'Four at the wind\'s calm points', where: 'calm', nMain: 4 },
  '3.2': { name: 'Four near the corners',           where: 'corners', nMain: 4 },
  '3.3': { name: 'Three on the edge',               where: 'edge', nEdge: 3 },
  '3.4': { name: 'Four spread out',                 where: 'spread', nMain: 4 },
  ...(D.site ? {} : { '3.5': { name: 'Two, placed by hand',             hand: HAND2 },
  '3.6': { name: 'Four, placed by hand (chosen: the final pattern)', hand: HAND4 } }),
};


const presetSelect=document.getElementById('presetSelect');
for(const [code,o] of Object.entries(OPTIONS)){
 const opt=document.createElement('option');opt.value=code;opt.textContent=code+' · '+o.name;presetSelect.append(opt);
}
presetSelect.value=D.site?'1.5':'3.6';
// Exact setting reset for catalogue comparisons; original growth engine is unchanged.
document.getElementById('applyPreset').onclick=()=>{
 const code=presetSelect.value,o=OPTIONS[code],status=document.getElementById('presetStatus');
 status.textContent='Generating…';
 setTimeout(()=>{
  try{
   SIM=null;GHOST=null;GROWING=false;
   for(const id of FIELD_IDS.concat(NET_IDS,B_IDS)){
    const e=document.getElementById(id);if(e&&e.type==='range')e.value=e.defaultValue;
   }
   const set=(id,value,unit='')=>{const e=document.getElementById(id);e.value=value;const out=e.nextElementSibling;if(out?.tagName==='OUTPUT')out.textContent=value+unit;};
   CIRCUS_R=42.5;RINGS=[{r:177.5,level:1}];MODE='B';MONTH=12;
   set('wC',o.wC??70,' %');set('wWind',o.wWind??40,' %');set('d1',300);set('d2',o.d2??95);
   set('nMain',o.hand?o.hand.length:(o.nMain||0));set('nSec',0);set('nEdge',o.nEdge||0);set('month',12);
   document.getElementById('month').nextElementSibling.textContent=YEAR[12].name;
   for(const id of ['merge','bMains','bInfill','bSec6'])document.getElementById(id).checked=true;
   document.getElementById('windOn').checked=o.wind!==false&&(o.wWind??40)>0;
   AMODE=o.hand?'hand':(o.where||'centre');document.getElementById('aMode').value=AMODE;
   if(o.hand)HAND=o.hand.map(p=>({x:p[0]-D.origin[0],y:p[1]-D.origin[1],kind:'main'}));
   placeAttractors();buildTarget();settleField();if(!window.__TS_PROCESS_ON)start(false);syncTools();drawKey();
   for(const e of document.querySelectorAll('#panel input[type="range"]')){
    if(e.id==='month')continue;const out=e.nextElementSibling;if(out?.tagName==='OUTPUT')out.textContent=e.value+(['wC','wWind','thru','stag','bMem'].includes(e.id)?' %':'');
   }
   status.textContent='Applied preset '+code;
  }catch(error){status.textContent='Generation failed: '+error.message;console.error(error);}
 },40);
};

/* ---------------- (site) the header and the site panel */
(() => {
  const T = window.__TS, H = T.host, s = D.site, m = T.meta || {}, KEY = 'tensorStudio.uiLanguage', zh = () => TS_LANG === 'zh';
  const ORIG_SUB = "The station window round P2 (22 Oct): the chosen cells of the final wool network, its roads fixed as they are. Water bodies and the station's 250 m ring are holes no street enters; streets cross watercourses square, on culverts; a street that runs into water or the ring goes back to its last junction. Main streets grow from the wool junctions on the edge, completed first; second streets as in v6. The app places 1 to 4 attractors from the field, near the centre, near the corners, on the edge or spread out, all draggable.";
  const $id = id => document.getElementById(id);
  const info = () => { const el = $id('siteInfo'); if (!el) return;
    if (!s){ el.textContent = ORIG_SUB; return; }
    const e = s.elevation ? (zh() ? '高程 ' + s.elevation[0] + '–' + s.elevation[1] + ' 米，平均坡度 ' + s.meanSlopePct + '%' : 'elevation ' + s.elevation[0] + '–' + s.elevation[1] + ' m, mean slope ' + s.meanSlopePct + ' %') : (zh() ? '无高程数据' : 'no elevation');
    const warn = (m.warnings || []).map(w => '<br>· ' + w).join('');
    el.innerHTML = zh()
      ? '你在伦敦地图上选定的场地：' + s.areaHa + ' 公顷，跨度约 ' + s.sideM + ' 米；' + e + '。土地 = 选区减去水体' + (T.keepBuildings ? '和现有建筑' : '') + '；锚点 ' + m.anchors + ' 个，取自现有道路与边界的交点。地形来自 OS Terrain 50（50 米），道路、水体、铁路、建筑来自 OpenStreetMap / OpenFreeMap，风为 London Luton 典型气象年。' + warn
      : 'The site you drew on the London map: ' + s.areaHa + ' ha, about ' + s.sideM + ' m across; ' + e + '. The land is the site less the water' + (T.keepBuildings ? ' and the existing buildings' : '') + '; ' + m.anchors + ' anchors where existing streets meet the edge. Terrain: OS Terrain 50 (50 m). Streets, water, rail and buildings: OpenStreetMap via OpenFreeMap. Wind: London Luton typical year.' + warn; };
  // language: remembered between visits, and it follows the London 2100 framework's own switch when framed
  const orig = window.setInterfaceLanguage;
  window.setInterfaceLanguage = l => { orig(l); try { localStorage.setItem(KEY, TS_LANG); } catch (e) {} info(); try { floodNum(); syncEnv(); } catch (e) {} };
  syncBase(); syncEnv();
  window.addEventListener('message', e => { if (e.origin === location.origin && e.data?.type === 'l2100:lang') window.setInterfaceLanguage(e.data.lang); });
  if (s){
    $id('siteNav').hidden = false;
    const badge = $id('siteBadge'); badge.dataset.zh = '伦敦选区'; badge.dataset.en = 'London site';
    const pt = $id('presetTitle'); pt.dataset.zh = '图册方案 · 16 个预设'; pt.dataset.en = 'Catalogue presets · 16 options';
    document.querySelector('#aMode option[value="sketch"]')?.remove();
    $id('siteBack').onclick = () => H?.close?.();
    for (const b of document.querySelectorAll('[data-keep]')){ const on = (b.dataset.keep === '1') === T.keepBuildings; b.classList.toggle('active', on);
      b.onclick = () => { if (on) return; $id('hud').textContent = zh() ? '正在重新生成场地…' : 'Rebuilding the site…'; location.search = b.dataset.keep === '1' ? '?keep=1' : ''; }; }
  }
  window.setInterfaceLanguage(T.lang);
})();
