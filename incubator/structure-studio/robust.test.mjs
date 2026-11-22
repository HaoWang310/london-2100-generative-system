// 结构工作室 · 规则普适性回归测试：node --test incubator/structure-studio/
// 同一套规则在不同条件下都要成立：换随机种子、换生成模式、加大拉扯、把核心挪到靠水 / 靠场地边缘 / 两核相距 450 m。
// 每种条件逐项核对：塔座不出场地红线、坡道旁边的板边过渡顺（每一层）、塔脚落在室里或由三层走廊环托住（塔座 L3 + 走廊环，离边 ≥ 3 m）、三道谷、塔座不悬在低一层的走廊上、塔片不穿任何走廊板、走廊节点板外圈不打结。
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
  // 悬空的量法（v0.9.32）：沿室的每条边、顺着边的外法向量（原来顺着"塔心 → 边"的方向量，室被拉尖时在尖角处会误报）：边内 1.5 m 有塔座、边外 4 m 没有同高的走廊板 = 悬空。
  // outA = 塔座铺到场地红线外的面积（三层合计；红线是 2 m 栅格，允许约 1 m 的锯齿）
  return { F, D, site, towers: F.plazas.map(z => { const T = SS.plazaTiers(z, site), g = T.grid; let hang = 0, n = 0, clash = 0, area = 0, outA = 0;
    for (let i = 0; i < z.poly.length; i++) { const a = z.poly[i], b = z.poly[(i + 1) % z.poly.length]; area += a[0] * b[1] - b[0] * a[1]; } const sg = area > 0 ? 1 : -1;
    for (let i = 0; i < z.poly.length; i++) { const a = z.poly[i], b = z.poly[(i + 1) % z.poly.length], L = Math.hypot(b[0] - a[0], b[1] - a[1]); if (L < 1e-6) continue; const nx = sg * (b[1] - a[1]) / L, ny = -sg * (b[0] - a[0]) / L;
      for (let s = 0; s < L; s++) { const p = [a[0] + (b[0] - a[0]) * s / L, a[1] + (b[1] - a[1]) * s / L], o = [p[0] + nx * 4, p[1] + ny * 4], q = [p[0] - nx * 1.5, p[1] - ny * 1.5];
        const gi = Math.floor((q[0] - g.x0) / g.res), gj = Math.floor((q[1] - g.y0) / g.res), lv = T.levels.reduce((m, L_, li) => L_.mask[gj * g.W + gi] ? li + 1 : m, 0); if (!lv) continue; n++; if (zTop(o[0], o[1]) < [0, 7.2, 11.8, 16.4][lv] - 0.3) hang++; } }
    for (const L_ of T.levels) for (let j = 0; j < g.H; j++) for (let i = 0; i < g.W; i++) if (L_.mask[j * g.W + i] && !site.inSite([g.x0 + (i + 0.5) * g.res, g.y0 + (j + 0.5) * g.res])) outA += g.res * g.res;
    const f = TW.xf(F.towers[z.ti], -1); for (const v of SH) for (let i = 0; i < v.length; i += 3 * 11) { const p = f(v[i] / 100, v[i + 1] / 100, v[i + 2] / 100); if (p[2] > 30) continue;
      for (const q of tris(p[0], p[1])) { const a = dm.top, zt = Math.max(a[q + 2], a[q + 5], a[q + 8]), zb = Math.min(a[q + 2], a[q + 5], a[q + 8]) - 1; if (p[2] < zb + 0.05 || p[2] > zt - 0.05) continue; if (inTri(p, q)) { clash++; break; } } }
    return { T, hang, n, clash, outA }; }) }; }
for (const [name, snap, P] of CASES) test('rules hold: ' + name, () => {
  const { F, D, towers } = check(snap, P); assert.ok(F.plazas.length >= 1 && F.plazas.length === F.towers.length, 'every tower has a base'); assert.equal(D.stats.badPlates, 0, 'node plates that cross themselves');
  for (const t of F.towers) assert.equal(t[7], 16.4, 'tower on L3');
  // 每一层坡道旁边的板边过渡（v0.9.30–31）：收尖都是缓曲线、二层→三层坡顶下面不再有一站长的斜切三角、三层板边和下面叠齐（接头只顺前后 4 个点）
  const cv = D.stats.tips.curves || []; assert.ok(cv.length > 50, 'tapers recorded: ' + cv.length);
  for (const c of cv) if (c.kind === '23' && c.tag === 'tl') assert.ok(c.T >= 2, 'L2 under an L2→L3 ramp top narrows over ' + c.T + ' station(s)');
  assert.ok((D.stats.tips.joinMoved || 0) <= 8, 'L3 join smoothing moved ' + D.stats.tips.joinMoved + ' outline points (L3 edges must stay stacked on L2)');
  for (const { T, hang, n, clash, outA } of towers) { assert.ok(outA <= 60, 'base beyond the red line: ' + outA.toFixed(0) + ' m²');
    assert.ok(T.footClear >= 3 - 1e-6, 'feet on L3 or the three-level ring, >= 3 m from the edge: ' + T.footClear);
    assert.equal(T.arcs.length, 3, 'three valleys between the three shells'); assert.ok(T.levels[0].area > T.levels[1].area && T.levels[1].area > T.levels[2].area, 'smaller going up');
    assert.ok(n > 150, 'base reaches the ring on ' + n + ' m'); assert.equal(hang, 0, 'metres where the base hangs over a lower corridor'); assert.equal(clash, 0, 'shell points inside a corridor slab'); }
});

// 红线离塔很近（v0.9.32，伦敦全域检查发现）：把场地沿一条直线裁掉一块，让红线离塔 110 m。拉扯大时塔所在的室被拉长、伸出红线——
// 塔座三层只做到红线，在红线处平口截断；塔脚、三道谷、塔片不穿板、节点板不打结照旧成立
const cropped = (snap, k, deg, d) => { const s = JSON.parse(JSON.stringify(snap)), m = s.attractors.filter(a => a.kind === 'main')[k], c = [m.x, m.y], u = [Math.cos(deg * Math.PI / 180), Math.sin(deg * Math.PI / 180)], f = p => (p[0] - c[0]) * u[0] + (p[1] - c[1]) * u[1] - d;
  const clip = P => { const out = []; for (let i = 0; i < P.length; i++) { const a = P[i], b = P[(i + 1) % P.length], fa = f(a), fb = f(b); if (fa <= 0) out.push(a); if ((fa < 0) !== (fb < 0)) { const t = fa / (fa - fb); out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]); } } return out; };
  s.pieces = s.pieces.map(pc => ({ outer: clip(pc.outer), holes: pc.holes || [] })).filter(pc => pc.outer.length > 2); return s; };
const PU = { ...P0, nPrim: 2, coreR: 1100, sCore: 170, sOut: 160, pull: 1, wS: 21, wP: 28, blendK: 1.45, minThick: 24, colStep: 60, setback: 8 };
for (const [name, snap, P] of [['p2 · red line 110 m east of tower 2, pull 2', cropped(SITES.p2, 1, 0, 110), { ...P0, pull: 2 }], ['p2 · red line 110 m west of tower 1, wide corridors', cropped(SITES.p2, 0, 180, 110), PU]]) test('tower base stops at the red line: ' + name, () => {
  const { F, D, towers } = check(snap, P); assert.ok(F.plazas.length >= 1 && F.plazas.length === F.towers.length, 'every tower has a base'); assert.equal(D.stats.badPlates, 0, 'node plates that cross themselves');
  assert.ok(towers.some(t => t.T.clipArea > 500), 'the tower room does reach past the red line here: ' + towers.map(t => t.T.clipArea.toFixed(0)));
  for (const { T, clash, outA } of towers) { assert.ok(outA <= 60, 'base beyond the red line: ' + outA.toFixed(0) + ' m²'); assert.ok(T.footClear >= 3 - 1e-6, 'feet held: ' + T.footClear); assert.equal(T.arcs.length, 3, 'three valleys'); assert.equal(clash, 0, 'shell points inside a corridor slab'); }
});

// 断头的臂不做（v0.9.33）：室贴着红线、那一侧的走廊被红线切掉时，L1 不沿穿出那条边的辐射路伸臂。没贴红线的塔（车站 P2 原样）一条都不少
test('tower base arms only follow roads that reach a corridor: p2 · red line 110 m north of tower 1, wide corridors', () => {
  const { F, towers } = check(cropped(SITES.p2, 0, 90, 110), PU), dead = towers.map(t => t.T.deadArms); assert.ok(dead.some(n => n >= 1), 'a dead-end arm is found here: ' + dead);
  // 只认连续 12 m 以上没有走廊的一段（v0.9.34）：转角处零星一两个点不算
  for (const z of F.plazas) { const runs = []; let cur = 0; z.free.forEach((p, k) => { if (k && Math.hypot(p[0] - z.free[k - 1][0], p[1] - z.free[k - 1][1]) > 3) { runs.push(cur); cur = 0; } cur++; }); if (cur) runs.push(cur);
    if (runs.length > 1 && Math.hypot(z.free[0][0] - z.free[z.free.length - 1][0], z.free[0][1] - z.free[z.free.length - 1][1]) <= 3) runs[0] += runs.pop();
    for (const n of runs) assert.ok(n * 2 >= 12, 'a stretch without a corridor shorter than 12 m is ignored: ' + n * 2 + ' m'); }
  F.plazas.forEach((z, i) => { const T = towers[i].T, g = T.grid, L1 = T.levels[0].mask, L2 = T.levels[1].mask; assert.equal(T.arcs.length, 3); assert.ok(T.footClear >= 3 - 1e-6); assert.ok(towers[i].outA <= 60);
    // 没有走廊的那段室边：边内 3 m 处不再有"只有 L1"的板（臂），只剩和 L2、L3 一起收住的那一圈
    let armOnly = 0; for (const p of z.free) { const dx = z.c[0] - p[0], dy = z.c[1] - p[1], r = Math.hypot(dx, dy), q = [p[0] + dx / r * 3, p[1] + dy / r * 3], k = Math.floor((q[1] - g.y0) / g.res) * g.W + Math.floor((q[0] - g.x0) / g.res); if (L1[k] && !L2[k]) armOnly++; }
    assert.ok(armOnly * 2 <= 12, 'L1-only slab left along the edge without a corridor: ' + armOnly * 2 + ' m of ' + z.free.length * 2 + ' m'); });
});
test('tower base arms: nothing is dropped where the corridor ring is complete (station P2)', () => {
  const site = SS.prepareSite(SITES.p2), F = SS.buildStructure(site, P0, new Set());
  for (const z of F.plazas) { assert.equal(z.free.length, 0, 'room edge without a corridor: ' + z.free.length * 2 + ' m'); const T = SS.plazaTiers(z, site); assert.equal(T.deadArms, 0); assert.ok(T.spokes.length >= 5); }
});
