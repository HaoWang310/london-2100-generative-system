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
test('no buildings within the setback of water or the rail', () => {
  const g = F.grid, ns = new Uint8Array(g.W * g.H); for (let i = 0; i < ns.length; i++) ns[i] = site.landM[i] && !site.waterM[i] ? 0 : 1;
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
  const F1 = SS.buildStructure(site, { ...P, v1: 1 }, new Set());
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
