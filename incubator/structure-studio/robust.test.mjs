// 结构工作室 · 规则普适性回归测试：node --test incubator/structure-studio/
// 同一套规则在不同条件下都要成立：换随机种子、换生成模式、加大拉扯、把核心挪到靠水 / 靠场地边缘 / 两核相距 450 m。
// 每种条件逐项核对：坡道旁边的板边过渡顺（每一层）、塔脚落在室里或由三层走廊环托住（塔座 L3 + 走廊环，离边 ≥ 3 m）、三道谷、塔座不悬在低一层的走廊上、塔片不穿任何走廊板、走廊节点板外圈不打结。
// 以后加了伦敦其他地方的快照（assets/*.snapshot.json），在 SITES 里加一行就会一起检查。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const dir = new URL('.', import.meta.url);
const self = {}; for (const f of ['engine/structure.js', 'engine/deck.js', 'engine/tower.js']) new Function('self', 'module', readFileSync(new URL(f, dir), 'utf8'))(self, undefined);
const SS = self.SS, TW = SS.tower, J = JSON.parse(readFileSync(new URL('assets/tower-model.json', dir), 'utf8')), SH = J.towers.map(w => new Int16Array(Buffer.from(w.mesh.v, 'base64').buffer.slice(0)));
const html = readFileSync(new URL('index.html', dir), 'utf8'), P0 = Function('return ' + html.match(/const P = (\{[^}]*\});/)[1])();
const SITES = { p2: JSON.parse(readFileSync(new URL('assets/station-p2.snapshot.json', dir), 'utf8')) };
const moved = (snap, d) => { const s = JSON.parse(JSON.stringify(snap)); let k = 0; for (const a of s.attractors) if (a.kind === 'main') { a.x += d[k][0]; a.y += d[k][1]; k++; } return s; };
const CASES = [];
for (const [name, snap] of Object.entries(SITES)) {
  for (const seed of [1, 7, 11]) CASES.push([name + ' · seed ' + seed, snap, { ...P0, seed }]);
  for (const mode of ['v1', 'radial', 'frei', 'vein']) CASES.push([name + ' · mode ' + mode, snap, { ...P0, mode }]);
  CASES.push([name + ' · pull 1, 2 primaries', snap, { ...P0, pull: 1, nPrim: 2 }]);
  CASES.push([name + ' · pull 2', snap, { ...P0, pull: 2 }]);
  CASES.push([name + ' · core moved toward water', moved(snap, [[0, 0], [250, 150]]), P0]);
  CASES.push([name + ' · cores moved toward the site edge', moved(snap, [[250, 120], [-220, -150]]), P0]);
  CASES.push([name + ' · cores 450 m apart', moved(snap, [[-250, -250], [250, 250]]), P0]); }
function check(snap, P) { const site = SS.prepareSite(snap), F = SS.buildStructure(site, P, new Set()), D = SS.deck.buildDeck(F, SS.deck.DEF), dm = SS.deck.deckMesh(D, 1);
  const G = new Map(), C = 6; for (let q = 0; q < dm.top.length; q += 9) { const xs = [dm.top[q], dm.top[q + 3], dm.top[q + 6]], ys = [dm.top[q + 1], dm.top[q + 4], dm.top[q + 7]];
    for (let x = Math.floor(Math.min(...xs) / C); x <= Math.floor(Math.max(...xs) / C); x++) for (let y = Math.floor(Math.min(...ys) / C); y <= Math.floor(Math.max(...ys) / C); y++) { const k = x + ',' + y; if (!G.has(k)) G.set(k, []); G.get(k).push(q); } }
  const tris = (x, y) => G.get(Math.floor(x / C) + ',' + Math.floor(y / C)) || [], inTri = (p, q) => TW.inPoly(p, [[dm.top[q], dm.top[q + 1]], [dm.top[q + 3], dm.top[q + 4]], [dm.top[q + 6], dm.top[q + 7]]]);
  const zTop = (x, y) => { let z = -1; for (const q of tris(x, y)) { const a = dm.top, d = (a[q + 4] - a[q + 7]) * (a[q] - a[q + 6]) + (a[q + 6] - a[q + 3]) * (a[q + 1] - a[q + 7]); if (!d) continue;
    const u = ((a[q + 4] - a[q + 7]) * (x - a[q + 6]) + (a[q + 6] - a[q + 3]) * (y - a[q + 7])) / d, v = ((a[q + 7] - a[q + 1]) * (x - a[q + 6]) + (a[q] - a[q + 6]) * (y - a[q + 7])) / d, w = 1 - u - v; if (u < -1e-6 || v < -1e-6 || w < -1e-6) continue; z = Math.max(z, u * a[q + 2] + v * a[q + 5] + w * a[q + 8]); } return z; };
  return { F, D, towers: F.plazas.map(z => { const T = SS.plazaTiers(z, site), g = T.grid; let hang = 0, n = 0, clash = 0;
    for (let i = 0; i < z.poly.length; i++) { const a = z.poly[i], b = z.poly[(i + 1) % z.poly.length], L = Math.hypot(b[0] - a[0], b[1] - a[1]);
      for (let s = 0; s < L; s++) { const p = [a[0] + (b[0] - a[0]) * s / L, a[1] + (b[1] - a[1]) * s / L], dx = p[0] - z.c[0], dy = p[1] - z.c[1], r = Math.hypot(dx, dy), o = [p[0] + dx / r * 4, p[1] + dy / r * 4], q = [p[0] - dx / r * 1.5, p[1] - dy / r * 1.5];
        const gi = Math.floor((q[0] - g.x0) / g.res), gj = Math.floor((q[1] - g.y0) / g.res), lv = T.levels.reduce((m, L_, li) => L_.mask[gj * g.W + gi] ? li + 1 : m, 0); if (!lv) continue; n++; if (zTop(o[0], o[1]) < [0, 7.2, 11.8, 16.4][lv] - 0.3) hang++; } }
    const f = TW.xf(F.towers[z.ti], -1); for (const v of SH) for (let i = 0; i < v.length; i += 3 * 11) { const p = f(v[i] / 100, v[i + 1] / 100, v[i + 2] / 100); if (p[2] > 30) continue;
      for (const q of tris(p[0], p[1])) { const a = dm.top, zt = Math.max(a[q + 2], a[q + 5], a[q + 8]), zb = Math.min(a[q + 2], a[q + 5], a[q + 8]) - 1; if (p[2] < zb + 0.05 || p[2] > zt - 0.05) continue; if (inTri(p, q)) { clash++; break; } } }
    return { T, hang, n, clash }; }) }; }
for (const [name, snap, P] of CASES) test('rules hold: ' + name, () => {
  const { F, D, towers } = check(snap, P); assert.ok(F.plazas.length >= 1 && F.plazas.length === F.towers.length, 'every tower has a base'); assert.equal(D.stats.badPlates, 0, 'node plates that cross themselves');
  for (const t of F.towers) assert.equal(t[7], 16.4, 'tower on L3');
  // 每一层坡道旁边的板边过渡（v0.9.30–31）：收尖都是缓曲线、二层→三层坡顶下面不再有一站长的斜切三角、三层板边和下面叠齐（接头只顺前后 4 个点）
  const cv = D.stats.tips.curves || []; assert.ok(cv.length > 50, 'tapers recorded: ' + cv.length);
  for (const c of cv) if (c.kind === '23' && c.tag === 'tl') assert.ok(c.T >= 2, 'L2 under an L2→L3 ramp top narrows over ' + c.T + ' station(s)');
  assert.ok((D.stats.tips.joinMoved || 0) <= 8, 'L3 join smoothing moved ' + D.stats.tips.joinMoved + ' outline points (L3 edges must stay stacked on L2)');
  for (const { T, hang, n, clash } of towers) {
    assert.ok(T.footClear >= 3 - 1e-6, 'feet on L3 or the three-level ring, >= 3 m from the edge: ' + T.footClear);
    assert.equal(T.arcs.length, 3, 'three valleys between the three shells'); assert.ok(T.levels[0].area > T.levels[1].area && T.levels[1].area > T.levels[2].area, 'smaller going up');
    assert.ok(n > 150, 'base reaches the ring on ' + n + ' m'); assert.equal(hang, 0, 'metres where the base hangs over a lower corridor'); assert.equal(clash, 0, 'shell points inside a corridor slab'); }
});
