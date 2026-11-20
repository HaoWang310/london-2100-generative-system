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
test('each core gets one tower on the ground: tallest shell 170 m, the smaller site scaled by area, turned along the primary', () => {
  assert.equal(F.towers.length, 2); const base = 170 / SS.TOWER_MODEL.h;
  const A = F.towers.map(t => { const pc = snap.pieces.find(pc => TW.inPoly(t, pc.outer)); return area(pc.outer) - (pc.holes || []).filter(h => h.length > 2).reduce((s, h) => s + area(h), 0); }), Am = Math.max(...A);
  F.towers.forEach((t, i) => { assert.equal(t[7], 0, 'tower foot on the ground'); assert.ok(Math.abs(t[5] - base * Math.max(0.8, Math.sqrt(A[i] / Am))) < 1e-3, 'scale ' + t[5]); assert.ok(Math.abs(t[3] - SS.TOWER_MODEL.h * t[5]) < 0.1, 'tip height');
    let best = null; for (const S of F.strands) for (let k = 0; k < S.length; k++) { const d = Math.hypot(S[k][0] - t[0], S[k][1] - t[1]); if (!best || d < best.d) best = { d, S, k }; }
    const a = best.S[Math.max(0, best.k - 5)], b = best.S[Math.min(best.S.length - 1, best.k + 5)], th = Math.atan2(b[1] - a[1], b[0] - a[0]);
    assert.ok(SS.TOWER_MODEL.corners.some(c => Math.abs(Math.sin(c + t[6] - th)) < 1e-3), 'one model corner points along the primary'); });
  assert.ok(F.towers.some(t => Math.abs(t[3] - 170) < 0.5), 'the bigger site keeps the 170 m tip');
  assert.ok(Math.abs(TW.xf(F.towers[0], -1)(0, 0, 100)[2] - 100 * F.towers[0][5]) < 1e-9, 'shells start at ground level, scaled');
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
test('other bases stay available in the engine: podium (21 m) and three plates (16.4 m)', () => {
  const Fp = SS.buildStructure(site, { ...P, towerBase: 'podium' }, new Set()); assert.ok(Fp.towers.every(t => t[7] === 21) && Fp.towers.some(t => Math.abs(t[3] - 191) < 0.5));
  const Fl = SS.buildStructure(site, { ...P, towerBase: 'plates' }, new Set()); assert.ok(Fl.towers.every(t => t[7] === 16.4));
  const D = SS.deck.buildDeck(Fl, SS.deck.DEF), dm = SS.deck.deckMesh(D, 1), pl = TW.plates(Fl.towers[1], dm.top); assert.equal(pl.area.length, 3); for (const a of pl.area) assert.ok(a > 10000 && a < 15000, 'each plate ~1.2 ha: ' + a);
  assert.ok(!pl.leak && pl.top.length % 9 === 0 && pl.cols.length > 20);
});
test('the page loads the model, draws three shells per core and the tower feet on the plan', () => {
  for (const k of ['<script src="engine/tower.js"></script>', "fetch('assets/tower-model.json?v=2')", 'dec(t.mesh || t.shell)', 'function buildTowerModel()', 'towerMesh(w.mesh, f, null, MAT.skin)', 'if (t[7] === SS.tower.BASE.podium)', 'SS.tower.feet(t)', 'if (!TOWER3 || !SS.tower)']) assert.ok(html.includes(k), k);
});
