// 结构工作室 · 种植塔（三片壳）回归测试：node --test incubator/structure-studio/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const dir = new URL('.', import.meta.url);
const self = {}; for (const f of ['engine/structure.js', 'engine/deck.js', 'engine/tower.js']) new Function('self', 'module', readFileSync(new URL(f, dir), 'utf8'))(self, undefined);
const SS = self.SS, snap = JSON.parse(readFileSync(new URL('assets/station-p2.snapshot.json', dir), 'utf8'));
const html = readFileSync(new URL('index.html', dir), 'utf8'), P = Function('return ' + html.match(/const P = (\{[^}]*\});/)[1])();
const site = SS.prepareSite(snap), F = SS.buildStructure(site, P, new Set()), TW = SS.tower;
const J = JSON.parse(readFileSync(new URL('assets/tower-model.json', dir), 'utf8'));
const area = Q => { let a = 0; for (let i = 0, j = Q.length - 1; i < Q.length; j = i++) a += (Q[j][0] + Q[i][0]) * (Q[j][1] - Q[i][1]); return Math.abs(a) / 2; };

test('the engine and the generated tower data agree on the model', () => {
  assert.deepEqual(SS.TOWER_MODEL.corners, TW.MODEL.corners); assert.equal(SS.TOWER_MODEL.h, TW.MODEL.hTop); assert.equal(SS.TOWER_MODEL.top, TW.TOPS[3]);
  assert.deepEqual(TW.TOPS, [7.2, 11.8, 16.4, 21.0], 'podium tiers line up with the deck levels'); assert.equal(TW.MODEL.tiers.length, 4);
  const w = TW.MODEL.tiers.map(T => Math.max(...T.map(p => p[0])) - Math.min(...T.map(p => p[0]))); assert.ok(w[0] > 190 && w[0] < 200, 'lowest tier ~195 m wide'); for (let i = 1; i < 4; i++) assert.ok(w[i] < w[i - 1], 'tiers step in');
});
test('tower model asset: 4 podium tiers and 3 shells, one mesh each (no duplicate skin)', () => {
  assert.equal(J.format, 'structure-studio/tower@2'); assert.equal(J.tiers.length, 4); assert.deepEqual(J.towers.map(t => t.id), ['A', 'B', 'C']);
  for (const m of [...J.tiers, ...J.towers.map(t => t.mesh)]) { const v = new Int16Array(Buffer.from(m.v, 'base64').buffer.slice(0)), i = new Uint16Array(Buffer.from(m.i, 'base64').buffer.slice(0));
    assert.equal(v.length, m.n * 3); assert.equal(i.length % 3, 0); let mx = 0; for (const k of i) if (k > mx) mx = k; assert.ok(mx < m.n); }
  for (const t of J.towers) assert.ok(!t.skin && !t.shell); assert.equal(J.towers[0].h, TW.MODEL.hTop); assert.equal(TW.MODEL.feet.length, 3);
});
test('each core gets one tower on its stepped base (L3, 16.4 m): tallest shell 170 m, the smaller site scaled by area, turned along the primary', () => {
  assert.equal(F.towers.length, 2); const base = 170 / SS.TOWER_MODEL.h;
  const A = F.towers.map(t => { const pc = snap.pieces.find(pc => TW.inPoly(t, pc.outer)); return area(pc.outer) - (pc.holes || []).filter(h => h.length > 2).reduce((s, h) => s + area(h), 0); }), Am = Math.max(...A);
  F.towers.forEach((t, i) => { assert.equal(t[7], 16.4, 'tower foot on L3'); assert.ok(Math.abs(t[5] - base * Math.max(0.8, Math.sqrt(A[i] / Am))) < 1e-3, 'scale ' + t[5]); assert.ok(Math.abs(t[3] - 16.4 - SS.TOWER_MODEL.h * t[5]) < 0.1, 'tip height');
    let best = null; for (const S of F.strands) for (let k = 0; k < S.length; k++) { const d = Math.hypot(S[k][0] - t[0], S[k][1] - t[1]); if (!best || d < best.d) best = { d, S, k }; }
    const a = best.S[Math.max(0, best.k - 5)], b = best.S[Math.min(best.S.length - 1, best.k + 5)], th = Math.atan2(b[1] - a[1], b[0] - a[0]);
    assert.ok(SS.TOWER_MODEL.corners.some(c => Math.abs(Math.sin(c + t[6] - th)) < 1e-3), 'one model corner points along the primary'); });
  assert.ok(F.towers.some(t => Math.abs(t[3] - 186.4) < 0.5), 'the bigger site keeps the 170 m shell, tip 186.4 m');
  assert.ok(Math.abs(TW.xf(F.towers[0], -1)(0, 0, 100)[2] - 16.4 - 100 * F.towers[0][5]) < 1e-9, 'shells start on L3, scaled');
});
test('towers alone leave the corridor network untouched and do not pass through any deck slab', () => {
  const D = SS.deck.buildDeck(F, SS.deck.DEF), dm = SS.deck.deckMesh(D, 1); assert.equal(TW.keepOutside(dm.top, F.towers).length, dm.top.length / 9, 'nothing is cut');
  // every tower-wall vertex below 18 m: not inside a deck triangle whose slab (top − 1 m … top) spans that height
  for (const t of F.towers) { const f = TW.xf(t, -1), near = []; for (let q = 0; q < dm.top.length; q += 9) if (Math.hypot(dm.top[q] - t[0], dm.top[q + 1] - t[1]) < 110) near.push(q);
    for (const w of J.towers) { const v = new Int16Array(Buffer.from(w.mesh.v, 'base64').buffer.slice(0));
      for (let i = 0; i < v.length; i += 3 * 7) { const p = f(v[i] / 100, v[i + 1] / 100, v[i + 2] / 100); if (p[2] > 18) continue;
        for (const q of near) { const zt = Math.max(dm.top[q + 2], dm.top[q + 5], dm.top[q + 8]), zb = Math.min(dm.top[q + 2], dm.top[q + 5], dm.top[q + 8]) - 1; if (p[2] < zb || p[2] > zt) continue;
          assert.ok(!TW.inPoly(p, [[dm.top[q], dm.top[q + 1]], [dm.top[q + 3], dm.top[q + 4]], [dm.top[q + 6], dm.top[q + 7]]]), 'tower wall inside a deck slab'); } } } }
});
test('other bases stay available in the engine: ground, podium (21 m) and three plates (16.4 m)', () => {
  const Fg = SS.buildStructure(site, { ...P, towerBase: 'none' }, new Set()); assert.ok(Fg.towers.every(t => t[7] === 0) && Fg.plazas.length === 0 && Fg.rings.every(r => r.r === r.r0), 'ground: no plaza, ring as before');
  const Fp = SS.buildStructure(site, { ...P, towerBase: 'podium' }, new Set()); assert.ok(Fp.towers.every(t => t[7] === 21) && Fp.towers.some(t => Math.abs(t[3] - 191) < 0.5));
  const Fl = SS.buildStructure(site, { ...P, towerBase: 'plates' }, new Set()); assert.ok(Fl.towers.every(t => t[7] === 16.4));
  const D = SS.deck.buildDeck(Fl, SS.deck.DEF), dm = SS.deck.deckMesh(D, 1), pl = TW.plates(Fl.towers[1], dm.top); assert.equal(pl.area.length, 3); for (const a of pl.area) assert.ok(a > 10000 && a < 15000, 'each plate ~1.2 ha: ' + a);
  assert.ok(!pl.leak && pl.top.length % 9 === 0 && pl.cols.length > 20);
});
test('the page loads the model, draws three shells per core and the tower feet on the plan', () => {
  for (const k of ["fetch('assets/tower-model.json?v=2')", 'dec(t.mesh || t.shell)', 'function buildTowerModel()', 'towerMesh(w.mesh, f, null, MAT.skin)', 'if (t[7] === SS.tower.BASE.podium)', 'SS.tower.feet(t)', 'if (!TOWER3 || !SS.tower)']) assert.ok(html.includes(k), k);
});
test('engine files are loaded with the release version, so a cached page never runs against a different engine', () => {
  const ver = readFileSync(new URL('docs/CHANGELOG.md', dir), 'utf8').match(/^## v([0-9.]+)/m)[1];
  for (const f of ['structure', 'deck', 'tower', 'nav']) assert.ok(html.includes(`<script src="engine/${f}.js?v=${ver}"></script>`), f + ' ?v=' + ver);
  assert.ok(html.includes(`new Worker('engine/compare-worker.js?v=${ver}')`)); assert.ok(readFileSync(new URL('engine/compare-worker.js', dir), 'utf8').includes("importScripts('structure.js' + (self.location.search || ''))"));
  assert.ok(html.includes('SS.tower && SS.tower.feet && t[5]'));
});
// ---- 环台（塔下的一层广场）
const dPS = (p, a, b) => { const dx = b[0] - a[0], dy = b[1] - a[1], l2 = dx * dx + dy * dy || 1, u = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l2)); return Math.hypot(p[0] - a[0] - u * dx, p[1] - a[1] - u * dy); };
const dPoly = (p, Q) => { let m = Infinity; for (let i = 0, j = Q.length - 1; i < Q.length; j = i++) m = Math.min(m, dPS(p, Q[j], Q[i])); return m; };
test('engine feet outline matches the tower model', () => {
  assert.equal(SS.TOWER_MODEL.feet.length, 3); SS.TOWER_MODEL.feet.forEach((f, i) => { assert.ok(f.length >= 15); for (const p of f) assert.ok(TW.MODEL.feet[i].some(q => Math.hypot(q[0] - p[0], q[1] - p[1]) < 0.08), 'foot point from the model'); });
  assert.ok(Math.abs(SS.TOWER_MODEL.footR - Math.max(...TW.MODEL.feet.flat().map(p => Math.hypot(p[0], p[1])))) < 0.01); assert.equal(TW.BASE.plaza, 16.4); assert.equal(SS.TOWER_MODEL.base.plaza, 16.4);
});
const TT = F.plazas.map(z => SS.plazaTiers(z, site));
test('each tower has a base in the cell around it, with the roundabout underneath and an oculus', () => {
  assert.equal(F.plazas.length, F.towers.length); assert.equal(F.ringExtra, null, 'P2 fits on the first pass');
  for (const z of F.plazas) { const t = F.towers[z.ti]; assert.ok(TW.inPoly(t, z.poly), 'base is in the tower cell'); assert.equal(z.poly, F.cellPolys[z.cell].poly);
    assert.ok(z.ok && z.gap >= 1, 'every foot point inside the cell, >= 1 m from its edge: ' + z.gap);
    assert.ok(z.ring && Math.abs(z.ring.r - 45) < 1 && z.ring.w === 12, 'the tensor-field roundabout is found under the base');
    const fmin = Math.min(...TW.feet(t).flat().map(p => Math.hypot(p[0] - t[0], p[1] - t[1]))); assert.ok(z.oc >= 10 && z.oc <= fmin - 4 + 1e-9 && z.oc <= z.ring.r - z.ring.w / 2 - 4 + 1e-9, 'oculus clears the feet and the roundabout: ' + z.oc); }
});
test('the tower cell grows so the corridor ring clears the feet (ring radius from the footprint)', () => {
  F.rings.forEach((g, i) => { const t = F.towers[i]; assert.ok(g.r >= SS.TOWER_MODEL.footR * t[5] + 0.8 * Math.max(P.wCore, P.wP) + 2 - 0.01, 'ring ' + g.r); assert.ok(g.r > g.r0, 'grown from ' + g.r0); });
});
// ---- 三层退台塔座（v0.9.27）
const cellOf = (T, x, y) => { const g = T.grid, i = Math.floor((x - g.x0) / g.res), j = Math.floor((y - g.y0) / g.res); return i >= 0 && j >= 0 && i < g.W && j < g.H ? j * g.W + i : -1; };
test('three levels 7.2 / 11.8 / 16.4, each one smaller than the one below and inside it, oculus open on all three', () => {
  TT.forEach((T, k) => { const z = F.plazas[k]; assert.deepEqual(T.levels.map(L => L.z), [7.2, 11.8, 16.4]);
    assert.ok(T.levels[0].area > T.levels[1].area && T.levels[1].area > T.levels[2].area, 'smaller going up: ' + T.levels.map(L => L.area));
    assert.ok(T.levels[2].area > 6000 && T.levels[0].area < 13000, 'areas ' + T.levels.map(L => Math.round(L.area)));
    for (let i = 0; i < T.levels[0].mask.length; i++) { if (T.levels[2].mask[i]) assert.ok(T.levels[1].mask[i]); if (T.levels[1].mask[i]) assert.ok(T.levels[0].mask[i]); if (T.levels[0].mask[i]) assert.ok(T.cell[i]); }
    for (const a of [0, 1, 2, 3, 4, 5]) { const q = cellOf(T, z.c[0] + (z.oc - 1) * Math.cos(a), z.c[1] + (z.oc - 1) * Math.sin(a)); for (const L of T.levels) assert.ok(!L.mask[q], 'oculus open'); }
    assert.ok(T.voidArea > 1500, 'valleys open to the ground: ' + T.voidArea); });
});
test('the tower stands on L3: every foot at least 2.5 m inside L3, three valleys between the three shells, apex >= 8 m off the oculus', () => {
  TT.forEach((T, k) => { const z = F.plazas[k]; assert.ok(T.footClear >= 2.5, 'feet inside L3: ' + T.footClear); assert.equal(T.arcs.length, 3);
    for (const a of T.arcs) { assert.ok(a.depth >= z.oc + 8 - 1e-6, 'apex off the oculus: ' + a.depth); for (const f of z.feet) for (const p of f) assert.ok(Math.hypot(p[0] - a.c[0], p[1] - a.c[1]) >= a.r, 'foot inside a valley'); } });
});
test('L1 sends arms along the radial roads to the corridor ring; L2 and L3 reach it through the lobes', () => {
  TT.forEach(T => { assert.ok(T.spokes.length >= 5, 'spokes ' + T.spokes.length); for (const s of T.spokes) { const p = s.pts.find(q => { const i = cellOf(T, q[0], q[1]); return i >= 0 && T.cell[i] && Math.hypot(q[0] - F.plazas[TT.indexOf(T)].c[0], q[1] - F.plazas[TT.indexOf(T)].c[1]) > 70; }); if (p) assert.ok(T.levels[0].mask[cellOf(T, p[0], p[1])], 'L1 over the spoke near the ring'); } });
});
test('the shells never pass through a base level or a corridor slab', () => {
  const D = SS.deck.buildDeck(F, SS.deck.DEF), dm = SS.deck.deckMesh(D, 1);
  F.towers.forEach((t, k) => { const T = TT[k], f = TW.xf(t, -1), near = []; for (let q = 0; q < dm.top.length; q += 9) if (Math.hypot(dm.top[q] - t[0], dm.top[q + 1] - t[1]) < 130) near.push(q);
    for (const w of J.towers) { const v = new Int16Array(Buffer.from(w.mesh.v, 'base64').buffer.slice(0));
      for (let i = 0; i < v.length; i += 3 * 5) { const p = f(v[i] / 100, v[i + 1] / 100, v[i + 2] / 100); if (p[2] > 40) continue; assert.ok(p[2] >= 16.4 - 1e-6, 'shell below L3');
        for (const q of near) { const zt = Math.max(dm.top[q + 2], dm.top[q + 5], dm.top[q + 8]), zb = Math.min(dm.top[q + 2], dm.top[q + 5], dm.top[q + 8]) - 1; if (p[2] < zb + 0.05 || p[2] > zt - 0.05) continue;
          assert.ok(!TW.inPoly(p, [[dm.top[q], dm.top[q + 1]], [dm.top[q + 3], dm.top[q + 4]], [dm.top[q + 6], dm.top[q + 7]]]), 'shell inside a corridor slab'); } } } });
});
test('no notches: every visible step edge turns with a radius of 2 m or more (ring and oculus count as solid)', () => {
  TT.forEach((T, k) => { const z = F.plazas[k], g = T.grid; let sharp = 0, pts = 0;
    for (const L of T.levels) { const sd = new Float32Array(L.mask.length); for (let i = 0; i < sd.length; i++) { const x = g.x0 + (i % g.W + .5) * g.res, y = g.y0 + (((i / g.W) | 0) + .5) * g.res, solid = L.mask[i] || !T.cell[i] || Math.hypot(x - z.c[0], y - z.c[1]) <= z.oc; sd[i] = solid ? 1 : -1; }
      for (const r of SS.contourField(sd, g.W, g.H, g.x0, g.y0, g.res).rings) { const P2 = r, Lc = [0]; for (let i = 1; i < P2.length; i++) Lc.push(Lc[i - 1] + Math.hypot(P2[i][0] - P2[i - 1][0], P2[i][1] - P2[i - 1][1])); if (Lc[Lc.length - 1] < 20) continue;
        const S = []; for (let s = 0, i = 0; s < Lc[Lc.length - 1]; s += 2) { while (Lc[i + 1] < s) i++; const u = (s - Lc[i]) / ((Lc[i + 1] - Lc[i]) || 1); S.push([P2[i][0] + (P2[i + 1][0] - P2[i][0]) * u, P2[i][1] + (P2[i + 1][1] - P2[i][1]) * u]); }
        for (let i = 0; i < S.length; i++) { const a = S[(i + S.length - 1) % S.length], b = S[i], c = S[(i + 1) % S.length]; if (Math.hypot(b[0] - z.c[0], b[1] - z.c[1]) > 110 || Math.abs(Math.hypot(b[0] - z.c[0], b[1] - z.c[1]) - z.oc) < 2) continue; pts++;
          const cr = Math.abs((b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])), rad = Math.hypot(a[0] - b[0], a[1] - b[1]) * Math.hypot(b[0] - c[0], b[1] - c[1]) * Math.hypot(c[0] - a[0], c[1] - a[1]) / (2 * cr || 1e-9); if (rad < 2) sharp++; } } }
    assert.ok(pts > 300 && sharp <= 0.01 * pts, 'sharp points ' + sharp + ' / ' + pts); });
});
test('open-sided: columns only — ground columns off the roads, L2 / L3 columns stand on the level below', () => {
  TT.forEach((T, k) => { const z = F.plazas[k], near = snap.roads.filter(r => r.pts.some(q => Math.hypot(q[0] - z.c[0], q[1] - z.c[1]) < 200)), n = [0, 0, 0];
    for (const c of T.cols) { const li = [0, 7.2, 11.8].indexOf(c[3]); assert.ok(li >= 0, 'column base ' + c[3]); n[li]++; assert.ok(Math.abs(c[2] - [6.2, 10.8, 15.4][li]) < 1e-9, 'column top under the slab');
      const i = cellOf(T, c[0], c[1]); assert.ok(T.levels[li].mask[i], 'column under its slab'); if (li) assert.ok(T.levels[li - 1].mask[i], 'stands on the level below');
      if (!li) for (const r of near) for (let q = 1; q < r.pts.length; q++) assert.ok(dPS(c, r.pts[q - 1], r.pts[q]) >= r.width / 2 + 1.5, 'column on a road'); }
    assert.ok(n.every(x => x > 15), 'columns per level ' + n); });
});
test('base mesh: three levels of faces facing up, areas match the levels (edges tucked 1.5 m into the corridor ring)', () => {
  const M = SS.meshes(F, P), top = M.plaza.top; assert.ok(top.length > 0 && M.plaza.side.length > 0 && M.plaza.bottom.length === top.length && M.plaza.lvl.length === top.length / 9);
  assert.equal(M.plaza.cols.length, TT.reduce((a, T) => a + T.cols.length, 0)); const A = [0, 0, 0, 0];
  for (let q = 0; q < top.length; q += 9) { const cr = (top[q + 3] - top[q]) * (top[q + 7] - top[q + 1]) - (top[q + 6] - top[q]) * (top[q + 4] - top[q + 1]); assert.ok(cr > -1e-6, 'faces up'); A[M.plaza.lvl[q / 9]] += cr / 2;
    assert.ok(Math.abs(top[q + 2] - ([0, 7.2, 11.8, 16.4][M.plaza.lvl[q / 9]] - 0.02)) < 1e-4); }
  for (let li = 1; li <= 3; li++) { const want = TT.reduce((a, T) => a + T.levels[li - 1].area, 0); assert.ok(A[li] >= want && A[li] < want * 1.08, 'level ' + li + ' area ' + A[li] + ' vs ' + want); }
  const O = SS.plazaOutline(F.plazas[0], site); for (const L of O) { const ar = Q => { let a = 0; for (let i = 0, j = Q.length - 1; i < Q.length; j = i++) a += (Q[j][0] + Q[i][0]) * (Q[j][1] - Q[i][1]); return -a / 2; };
    assert.equal(L.rings.filter(r => ar(r) > 0).length, 1, 'one outer ring per level'); assert.equal(L.rings.filter(r => ar(r) < 0).length, 1, 'one hole (the oculus)'); }
});
test('the page draws the base: three levels in 3D with the corridor shading, columns from their own level, L1 outline in the plan, tower rises from L3', () => {
  for (const k of ['M.plaza.lvl', 'triMesh(M.plaza.top, MAT.deckLv)', 'M.plaza.cols', 'SS.plazaOutline(z, F.site)', "oc.fill('evenodd')", 'const z0 = c[3] || 0', 'G.towerModel.position.z', "put('plaza_top'", "'tower base L'"]) assert.ok(html.includes(k), k);
});
