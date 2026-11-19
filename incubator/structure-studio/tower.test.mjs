// 结构工作室 · 种植塔（台座 + 三片壳）回归测试：node --test incubator/structure-studio/
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
test('tower model asset: 4 tiers, 3 shells each with a skin pushed at least 2 m off', () => {
  assert.equal(J.format, 'structure-studio/tower@1'); assert.equal(J.tiers.length, 4); assert.deepEqual(J.towers.map(t => t.id), ['A', 'B', 'C']);
  for (const m of [...J.tiers, ...J.towers.flatMap(t => [t.shell, t.skin])]) { const v = new Int16Array(Buffer.from(m.v, 'base64').buffer.slice(0)), i = new Uint16Array(Buffer.from(m.i, 'base64').buffer.slice(0));
    assert.equal(v.length, m.n * 3); assert.equal(i.length % 3, 0); assert.ok(Math.max(...i) < m.n); }
  for (const t of J.towers) assert.ok(t.skinGap >= 2, t.id + ' skin gap ' + t.skinGap);
  assert.equal(J.towers[0].h, TW.MODEL.hTop);
});
test('each core gets one tower: tallest shell 170 m, the smaller site scaled by area, a corner along the primary', () => {
  assert.equal(F.towers.length, 2); const base = 170 / SS.TOWER_MODEL.h;
  const A = F.towers.map(t => { const pc = snap.pieces.find(pc => TW.inPoly(t, pc.outer)); return area(pc.outer) - (pc.holes || []).filter(h => h.length > 2).reduce((s, h) => s + area(h), 0); }), Am = Math.max(...A);
  F.towers.forEach((t, i) => { assert.ok(Math.abs(t[5] - base * Math.max(0.8, Math.sqrt(A[i] / Am))) < 1e-3, 'scale ' + t[5]); assert.ok(Math.abs(t[3] - (21 + SS.TOWER_MODEL.h * t[5])) < 0.1, 'tip height');
    let best = null; for (const S of F.strands) for (let k = 0; k < S.length; k++) { const d = Math.hypot(S[k][0] - t[0], S[k][1] - t[1]); if (!best || d < best.d) best = { d, S, k }; }
    const a = best.S[Math.max(0, best.k - 5)], b = best.S[Math.min(best.S.length - 1, best.k + 5)], th = Math.atan2(b[1] - a[1], b[0] - a[0]);
    assert.ok(SS.TOWER_MODEL.corners.some(c => Math.abs(Math.sin(c + t[6] - th)) < 1e-3), 'one podium corner points along the primary'); });
  assert.ok(F.towers.some(t => Math.abs(t[3] - 191) < 0.5), 'the bigger site keeps the 191 m tip');
});
test('corridors stop at the podium: nothing left inside a tier at or below its top', () => {
  const D = SS.deck.buildDeck(F, SS.deck.DEF), dm = SS.deck.deckMesh(D, 1), keep = TW.keepOutside(dm.top, F.towers), L = F.towers.map(TW.place);
  assert.ok(keep.length > 0.9 * dm.top.length / 9 && keep.length < dm.top.length / 9, 'some deck is cut, most stays');
  for (const k of keep) { const i = 9 * k, p = [(dm.top[i] + dm.top[i + 3] + dm.top[i + 6]) / 3, (dm.top[i + 1] + dm.top[i + 4] + dm.top[i + 7]) / 3], z = (dm.top[i + 2] + dm.top[i + 5] + dm.top[i + 8]) / 3;
    for (const T of L) for (let j = 0; j < 4; j++) assert.ok(!(z <= TW.TOPS[j] + 0.6 && TW.inPoly(p, T[j]))); }
  const f = TW.xf(F.towers[0], 3), q = f(0, 0, J.tiers[3].z[1], J.tiers[3].z); assert.ok(Math.abs(q[2] - 21) < 1e-9, 'top tier lands at 21 m');
  assert.ok(Math.abs(TW.xf(F.towers[0], -1)(0, 0, 100)[2] - (21 + 100 * F.towers[0][5])) < 1e-9, 'shells stand on the 21 m top, scaled');
});
test('the page loads the model, cuts the corridor and keeps the old tower as a fallback', () => {
  for (const k of ['<script src="engine/tower.js"></script>', "fetch('assets/tower-model.json')", 'M.corridor = clipCorr(M.corridor);', 'function buildTowerModel()', 'MAT.pod[k]', 'MAT.shell', 'MAT.skin', 'if (!TOWER3 || !SS.tower)']) assert.ok(html.includes(k), k);
});
