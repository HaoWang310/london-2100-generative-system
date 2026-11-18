// 结构工作室 · 车站 P2 回归测试：node --test incubator/structure-studio/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const dir = new URL('.', import.meta.url);
const self = {}; new Function('self', readFileSync(new URL('engine/structure.js', dir), 'utf8'))(self);
const SS = self.SS, snap = JSON.parse(readFileSync(new URL('assets/station-p2.snapshot.json', dir), 'utf8'));
const html = readFileSync(new URL('index.html', dir), 'utf8'), P = Function('return ' + html.match(/const P = (\{[^}]*\});/)[1])();
const site = SS.prepareSite(snap), F = SS.buildStructure(site, P, new Set());

test('P2 snapshot loads with two cores and the tensor field', () => {
  assert.equal(site.cores.length, 2);
  assert.ok(site.landHa > 200 && site.landHa < 220);
  assert.ok(site.field([1500, 1300]));
});
test('two off-road primaries, kept away from main roads', () => {
  assert.equal(F.strands.length, 2);
  for (const S of F.strands) { const ds = S.filter(site.inSite).map(site.roadDist).sort((a, b) => a - b); assert.ok(ds[Math.floor(ds.length * 0.5)] > 20); }
});
test('cells: a sensible number, none thinner than the minimum width', () => {
  assert.ok(F.cells.length >= 40 && F.cells.length <= 140, 'cells ' + F.cells.length);
  const big = F.cells.filter(c => !c.edge); assert.ok(big.length > 10);
});
test('the structure is continuous over water and rail, cut only at the site outline', () => {
  const g = F.grid; let bad = 0; for (let i = 0; i < g.W * g.H; i++) if (g.corr[i] && !site.siteM[i]) bad++;
  assert.equal(bad, 0);
  assert.ok(F.nBridge > 5 && F.bridgeL > 300, 'bridges ' + F.nBridge + ' / ' + F.bridgeL);
  assert.ok(F.columns.length > 0);
  const share = F.stats.corrA / (site.landHa * 1e4); assert.ok(share > 0.1 && share < 0.35, 'share ' + share);
});
test('buildings are off for now; when switched on they keep the setback from water and rail', () => {
  assert.equal(F.grid.bldM.reduce((a, v) => a + v, 0), 0, 'no buildings by default');
  const FB = SS.buildStructure(site, { ...P, buildings: 1 }, new Set()); assert.ok(FB.stats.bld > 50, 'engine can still place buildings');
  const g = FB.grid, ns = new Uint8Array(g.W * g.H); for (let i = 0; i < ns.length; i++) ns[i] = site.landM[i] && !site.waterM[i] ? 0 : 1;
  const d = SS.util.edt(ns, g.W, g.H); let bad = 0; for (let i = 0; i < ns.length; i++) if (g.bldM[i] && d[i] * g.RES < P.setback - 2) bad++;
  assert.equal(bad, 0);
});
test('cell outlines are smooth: no turn sharper than 45° between 2 m steps', () => {
  let worst = 0;
  for (const cp of F.cellPolys) { const Q = SS.util.resample([...cp.poly, cp.poly[0]], 2); Q.pop(); Q.push(Q[0], Q[1]); for (let i = 1; i < Q.length - 1; i++) { if (!site.inSite(Q[i])) continue; const a = [Q[i][0] - Q[i - 1][0], Q[i][1] - Q[i - 1][1]], b = [Q[i + 1][0] - Q[i][0], Q[i + 1][1] - Q[i][1]];
    const t = Math.abs(Math.atan2(a[0] * b[1] - a[1] * b[0], a[0] * b[0] + a[1] * b[1])) * 180 / Math.PI; if (t > worst) worst = t; } }
  assert.ok(worst < 45, 'worst turn ' + worst.toFixed(1));
});

// v1 · 局部场格网：同一套检查也要通过
test('v1 field lattice: sensible cells, structure inside the site, smooth outlines, street scale measured', () => {
  const F1 = SS.buildStructure(site, { ...P, mode: 'v1' }, new Set());
  assert.ok(F1.cells.length >= 40 && F1.cells.length <= 160, 'cells ' + F1.cells.length);
  const g = F1.grid; let bad = 0; for (let i = 0; i < g.W * g.H; i++) if (g.corr[i] && !site.siteM[i]) bad++; assert.equal(bad, 0);
  const share = F1.stats.corrA / (site.landHa * 1e4); assert.ok(share > 0.1 && share < 0.4, 'share ' + share);
  let worst = 0;
  for (const cp of F1.cellPolys) { const Q = SS.util.resample([...cp.poly, cp.poly[0]], 2); Q.pop(); Q.push(Q[0], Q[1]); for (let i = 1; i < Q.length - 1; i++) { if (!site.inSite(Q[i])) continue; const a = [Q[i][0] - Q[i - 1][0], Q[i][1] - Q[i - 1][1]], b = [Q[i + 1][0] - Q[i][0], Q[i + 1][1] - Q[i][1]];
    const t = Math.abs(Math.atan2(a[0] * b[1] - a[1] * b[0], a[0] * b[0] + a[1] * b[1])) * 180 / Math.PI; if (t > worst) worst = t; } }
  assert.ok(worst < 45, 'worst turn ' + worst.toFixed(1));
  assert.ok(site.d1 > 200 && site.d1 < 600 && site.d2 > 60 && site.d2 < 250, 'd1 ' + site.d1 + ' d2 ' + site.d2);
  assert.ok(F1.stats.onRoad >= 0 && F1.stats.onRoad < 0.35, 'onRoad ' + F1.stats.onRoad);
});

// 三种吸引点：主节点成环形广场（中心塔）、次节点加密 + 小塔、边界节点生成入口主线 + 入口板
test('attractors: roundabout at main nodes, towers at secondary nodes, entry line from an edge node', () => {
  const F0 = SS.buildStructure(site, P, new Set());
  for (const c of site.cores) assert.ok(F0.towers.some(t => Math.hypot(t[0] - c[0], t[1] - c[1]) < 1 && t[2] >= 20), 'big tower at plaza centre');
  assert.equal(site.secs.length, 2); for (const a of site.secs) assert.ok(F0.towers.some(t => t[4] === 'sec' && Math.hypot(t[0] - a.p[0], t[1] - a.p[1]) < 80), 'small tower near sec node');
  const s2 = JSON.parse(JSON.stringify(snap)); s2.attractors.push({ x: 609, y: 864, kind: 'edge', reach: 340, pull: 2.4 });
  const site2 = SS.prepareSite(s2), F2 = SS.buildStructure(site2, P, new Set());
  assert.equal(F2.entryStrands.length, 1); const E = F2.entryStrands[0], end = E[E.length - 1];
  assert.ok(Math.min(...site2.cores.map(c => Math.hypot(c[0] - end[0], c[1] - end[1]))) < 60, 'entry line reaches a core');
  const g = F2.grid, q = [Math.floor((609 - g.xmin) / g.RES), Math.floor((g.ymax - 864) / g.RES)]; let n = 0; for (let y = q[1] - 6; y <= q[1] + 6; y++) for (let x = q[0] - 6; x <= q[0] + 6; x++) if (g.corr[y * g.W + x]) n++;
  assert.ok(n > 40, 'entry plate is structure');
});

test('roundabout plaza island holds only the tower, no buildings', () => {
  const g = F.grid; let n = 0; for (let i = 0; i < g.W * g.H; i++) if (g.bldM[i]) { const wx = g.xmin + (i % g.W + .5) * g.RES, wy = g.ymax - (((i / g.W) | 0) + .5) * g.RES; if (F.rings.some(r => Math.hypot(wx - r.c[0], wy - r.c[1]) < r.r)) n++; }
  assert.equal(n, 0);
});

// 八种生成模式都能跑通：室数合理、结构只在场地内、走廊占比合理
test('all eight generation modes build a sensible structure', () => {
  for (const mode of ['v0', 'v1', 'v2', 'radial', 'dual', 'frei', 'vein', 'slime']) {
    const Fm = SS.buildStructure(site, { ...P, mode }, new Set());
    assert.equal(Fm.mode, mode);
    assert.ok(Fm.cells.length >= 25 && Fm.cells.length <= 220, mode + ' cells ' + Fm.cells.length);
    const g = Fm.grid; let bad = 0; for (let i = 0; i < g.W * g.H; i++) if (g.corr[i] && !site.siteM[i]) bad++; assert.equal(bad, 0, mode);
    const share = Fm.stats.corrA / (site.landHa * 1e4); assert.ok(share > 0.08 && share < 0.4, mode + ' share ' + share);
  }
});

// 种植塔全部来自张量场：小塔落在重要路口附近、彼此至少隔一个主路间距；主线走廊不比次级窄
test('planting towers come from the tensor field; primaries never narrower than secondaries', () => {
  assert.ok(site.hubs.length > 0, 'important junctions found');
  const hubs = F.towers.filter(t => t[4] === 'hub'); assert.ok(hubs.length >= 1, 'junction towers placed');
  for (const t of hubs) assert.ok(site.hubs.some(h => Math.hypot(h.p[0] - t[0], h.p[1] - t[1]) <= site.d2 + 1), 'hub tower near an important junction');
  for (let i = 0; i < F.towers.length; i++) for (let j = i + 1; j < F.towers.length; j++) { const a = F.towers[i], b = F.towers[j]; if (a[4] === 'hub' || b[4] === 'hub') assert.ok(Math.hypot(a[0] - b[0], a[1] - b[1]) >= site.d1 - 1, 'towers spaced by d1'); }
  const Fw = SS.buildStructure(site, { ...P, wS: 25, wP: 12 }, new Set()), Fe = SS.buildStructure(site, { ...P, wS: 25, wP: 25 }, new Set());
  assert.equal(Fw.stats.corrA, Fe.stats.corrA, 'wP below wS is lifted to wS');
});

// 算法修正：主线做成主线走廊；场内没有比最小室宽更窄的室；没有主吸引点也能生成
const segD = (p, a, b) => { const dx = b[0] - a[0], dy = b[1] - a[1]; let t = ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (dx * dx + dy * dy || 1); t = Math.max(0, Math.min(1, t)); return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy); };
const primCover = Fx => { const pf = Fx.fibres.filter(f => f.prim); let n = 0, c = 0;
  for (const S of Fx.strands) for (let i = 0; i < S.length; i += 5) { const p = S[i]; if (!site.inSite(p) || site.bdist(p) < 40 || Fx.rings.some(r => Math.hypot(p[0] - r.c[0], p[1] - r.c[1]) < 2.6 * r.r)) continue; n++;
    let m = 1e9; for (const f of pf) for (let k = 1; k < f.P.length; k++) m = Math.min(m, segD(p, f.P[k - 1], f.P[k])); if (m < 8) c++; } return c / n; };
test('primaries become primary corridors (mode 1, strong pull, radial web)', () => {
  assert.ok(primCover(F) > 0.9, 'mode 1 ' + primCover(F));
  const Fp = SS.buildStructure(site, { ...P, pull: 2 }, new Set()); assert.ok(primCover(Fp) > 0.8, 'pull 2 ' + primCover(Fp));
  const Fr = SS.buildStructure(site, { ...P, mode: 'radial' }, new Set()); assert.ok(primCover(Fr) > 0.85, 'radial ' + primCover(Fr));
});
test('no cell inside the site is thinner than the minimum width (cells along primaries included)', () => {
  const minW = Pp => { let best = 1e9; for (let i = 0; i < Pp.length; i++) { const a = Pp[i], b = Pp[(i + 1) % Pp.length], L = Math.hypot(b[0] - a[0], b[1] - a[1]); if (L < 1) continue; const nn = [-(b[1] - a[1]) / L, (b[0] - a[0]) / L]; let m = 0; for (const q of Pp) m = Math.max(m, Math.abs((q[0] - a[0]) * nn[0] + (q[1] - a[1]) * nn[1])); best = Math.min(best, m); } return best; };
  for (const o of [{}, { pull: 2 }, { mode: 'v2' }]) { const Fx = SS.buildStructure(site, { ...P, ...o }, new Set());
    const bad = Fx.cellPolys.filter(cp => !cp.narrow && cp.raw.filter(p => site.inSite(p)).length > cp.raw.length / 2 && minW(cp.V.map(v => v.p)) < P.minThick - 0.5); assert.equal(bad.length, 0, JSON.stringify(o)); }
});
test('a site without main attractors still builds in every mode', () => {
  const s2 = JSON.parse(JSON.stringify(snap)); s2.attractors = s2.attractors.filter(a => a.kind !== 'main'); const site2 = SS.prepareSite(s2);
  assert.equal(site2.cores.length, 0);
  for (const mode of ['v0', 'v1', 'v2', 'radial', 'dual', 'frei', 'vein', 'slime']) { const Fx = SS.buildStructure(site2, { ...P, mode }, new Set()); assert.ok(Fx.cells.length >= 20, mode + ' ' + Fx.cells.length); assert.ok(Fx.towers.every(t => t[4]), 'no big tower without a main attractor'); }
});

// 跨路：走廊压在张量场路面上的段做成架空，净空按顶标高；柱子不立在路面上
test('street crossings are elevated with enough clearance; no column on a road surface', () => {
  assert.ok(F.nRoad > 50 && F.roadL > 500, 'street spans found ' + F.nRoad);
  assert.equal(SS.roadSpan(3.6).ok, false); assert.ok(SS.roadSpan(7.2).ok && SS.roadSpan(7.2).clear >= 5); assert.equal(SS.roadSpan(10.8).floors, 1);
  const g = F.grid; for (const c of F.columns) { const x = Math.floor((c[0] - g.xmin) / g.RES), y = Math.floor((g.ymax - c[1]) / g.RES); if (c[2] != null) assert.equal(site.roadM[y * g.W + x], 0, 'column on a road'); }
  const M = SS.meshes(F, P); let low = 0; const S = M.corridor.side;
  for (let i = 0; i < S.length; i += 3) { const x = Math.floor((S[i] - g.xmin) / g.RES), y = Math.floor((g.ymax - S[i + 1]) / g.RES); if (site.roadM[y * g.W + x] && site.landM[y * g.W + x] && !site.waterM[y * g.W + x] && S[i + 2] > 0.01 && S[i + 2] < 5 - 0.01) low++; }
  assert.ok(low / (S.length / 3) < 0.02, 'corridor geometry between the street and 5 m: ' + low);
});

// 极端情况：没有主干路时主路间距不失控，重要路口退到贯通 × 贯通
test('main-road spacing stays sensible without main roads', () => {
  const a = JSON.parse(JSON.stringify(snap)); a.roads = a.roads.filter(r => r.grade !== 'main'); const sa = SS.prepareSite(a);
  assert.ok(sa.d1 >= 1.6 * sa.d2 && sa.d1 <= 3.5 * sa.d2, 'd1 ' + sa.d1); assert.ok(sa.hubs.length > 0, 'through x through junctions');
  const b = JSON.parse(JSON.stringify(a)); b.roads = b.roads.filter(r => r.grade === 'local'); const sb = SS.prepareSite(b); assert.ok(sb.d1 <= 3.5 * sb.d2, 'd1 ' + sb.d1);
  assert.ok(Math.abs(site.d1 - 378) < 5, 'P2 unchanged ' + site.d1);
});

// 页面脚本能解析（防止改动时把半行代码注释掉、括号不配对）
test('index.html inline script parses', () => {
  const html = readFileSync(new URL('./index.html', import.meta.url), 'utf8');
  const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]); assert.ok(scripts.length >= 1);
  for (const src of scripts) assert.doesNotThrow(() => new Function(src));
});

// 方案打分（与张量场工作室统一：5 组 0–100、按权重加权）；后台线程脚本能解析
test('structure score: five groups in 0–100, weighted total, deterministic; worker script parses', () => {
  const s = SS.scoreStructure(F); assert.deepEqual(Object.keys(s.groups).sort(), ['cells', 'eff', 'farm', 'prim', 'span']);
  for (const v of Object.values(s.groups)) if (v != null) assert.ok(v >= 0 && v <= 100);
  assert.ok(s.total > 40 && s.total <= 100, 'P2 default scores sensibly ' + s.total);
  assert.equal(SS.scoreStructure(SS.buildStructure(site, P, new Set())).total, s.total, 'same seed, same score');
  const only = SS.scoreStructure(F, { farm: 0, cells: 0, prim: 1, span: 0, eff: 0 }); assert.equal(only.total, s.groups.prim, 'weights select groups');
  const sk = SS.runSketch(F); assert.equal(sk.cells.length, F.cellPolys.length); assert.equal(sk.towers.length, F.towers.length);
  assert.doesNotThrow(() => new Function('importScripts', readFileSync(new URL('./engine/compare-worker.js', import.meta.url), 'utf8')));
});
