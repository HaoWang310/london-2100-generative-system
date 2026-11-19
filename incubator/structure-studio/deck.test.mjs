// 结构工作室 · 第 6 步（多层走道结构）回归测试：node --test incubator/structure-studio/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const dir = new URL('.', import.meta.url);
const self = {}; for (const f of ['engine/structure.js', 'engine/deck.js']) new Function('self', 'module', readFileSync(new URL(f, dir), 'utf8'))(self, undefined);
const SS = self.SS, snap = JSON.parse(readFileSync(new URL('assets/station-p2.snapshot.json', dir), 'utf8'));
const html = readFileSync(new URL('index.html', dir), 'utf8'), P = Function('return ' + html.match(/const P = (\{[^}]*\});/)[1])();
const site = SS.prepareSite(snap), F = SS.buildStructure(site, P, new Set()), DK = SS.deck.buildDeck(F, {}), s = DK.stats;

test('step 6 is wired into the page', () => {
  assert.ok(html.includes('engine/deck.js') && html.includes('data-k="6"'), 'deck.js and the step 6 card are in index.html');
  assert.ok(html.includes('[-1, -1, 0, 1, 2, 2, 2, 3, 3, 4, 5]'), 'the 3D demo stage belongs to step 6, not step 5');
});
test('step cards carry two buttons: play analysis and next', () => {
  for (const k of ['function guidedPlay(', 'function guidedNext(', 'function guidedRollback(', "L('播放分析', 'Play analysis')", "L('下一步', 'Next') : L('完成', 'Finish')", '.pmStep.locked']) assert.ok(html.includes(k), k);
  assert.ok(!html.includes('完成 · 转到三维'), 'old single-button label is gone');
});
test('levels: 3.6 m storeys lifted one storey', () => { assert.deepEqual(SS.deck.LV, [0, 7.2, 10.8, 14.4]); });
test('level 3 only near the two main towers, and every edge of it has a ramp', () => {
  assert.ok(s.l3nodes > 10 && s.l3nodes < 0.35 * s.nodes, 'L3 nodes ' + s.l3nodes + ' / ' + s.nodes);
  assert.equal(s.r23, s.edges3, 'one L2→L3 ramp per L3 edge'); assert.equal(s.steep, 0, 'no shortened ramps (grow outward instead)');
  const big = F.towers.filter(t => !t[4]); F.nodeP.forEach((p, j) => { if (DK.in3[j]) assert.ok(big.some(t => Math.hypot(p[0] - t[0], p[1] - t[1]) < 200 + 400), 'L3 node stays around a main tower'); });
});
test('ground entries exist and stay off streets and water', () => {
  assert.ok(s.entries >= 50, 'entries ' + s.entries); assert.ok(s.r12 >= 80, 'L1→L2 ramps ' + s.r12);
  for (const r of DK.ramps) if (r.kind[0] === 0) for (let i = 0; i <= 10; i++) { const p = [r.a[0] + (r.b[0] - r.a[0]) * i / 10, r.a[1] + (r.b[1] - r.a[1]) * i / 10]; assert.ok(!site.inWater(p), 'entry ramp over water'); assert.ok(site.roadDistAll(p) > 3, 'entry ramp on a street'); }
});
test('subdivided surface: finite, flat plates, edges on the step 5 outline', () => {
  const m = SS.deck.deckMesh(DK, 1); for (const v of m.top) assert.ok(Number.isFinite(v));
  const V = m.V, n = V.length / 3; let flat = 0; for (let i = 0; i < n; i++) { const z = V[3 * i + 2]; assert.ok(z > -1e-6 && z < 14.4 + 1e-6, 'z in range ' + z); if (SS.deck.LV.some(l => Math.abs(z - l) < 0.02)) flat++; }
  assert.ok(flat / n > 0.8, 'plates are level: ' + (flat / n).toFixed(2));
  const d = []; for (let i = 0; i < m.boundary.length; i += 2) { const a = m.boundary[i]; d.push(DK.outline.dist([V[3 * a], V[3 * a + 1]], 30)); } d.sort((x, y) => x - y);
  assert.ok(d[Math.floor(d.length * 0.5)] < 0.5, 'median edge-to-outline distance ' + d[Math.floor(d.length * 0.5)].toFixed(2) + ' m');
  assert.ok(s.gapOn > 4 * s.gapOff, 'node plates follow the outline between most neighbouring corridors: ' + s.gapOn + ' / ' + s.gapOff);
});
test('same input gives the same structure; parameters respond', () => {
  const again = SS.deck.buildDeck(F, {}); assert.deepEqual(again.stats, s);
  const wide = SS.deck.buildDeck(F, { r3: 320 }); assert.ok(wide.stats.l3nodes > s.l3nodes, 'bigger radius → more L3');
  const steep = SS.deck.buildDeck(F, { entrySlope: 4 }), gentle = SS.deck.buildDeck(F, { entrySlope: 7 }); assert.ok(steep.stats.entries >= gentle.stats.entries, 'steeper entries fit on more corridors');
});
test('every face is counter-clockwise seen from above (normals up), control mesh and subdivided', () => {
  const area = (V, f) => { let a = 0; for (let k = 0; k < f.length; k++) { const p = 3 * f[k], q = 3 * f[(k + 1) % f.length]; a += V[p] * V[q + 1] - V[q] * V[p + 1]; } return a / 2; };
  let cw = 0; DK.F.forEach(f => { if (area(DK.V, f) < -0.02) cw++; }); assert.equal(cw, 0, 'clockwise control faces');
  const R = SS.deck.subdivide(DK, 1); let neg = 0, pos = 0; R.F.forEach(f => { const a = area(R.V, f); if (a < 0) neg -= a; else pos += a; }); assert.ok(neg < 0.002 * pos, 'flipped area after subdivision ' + neg.toFixed(1) + ' / ' + pos.toFixed(0));
  const m = SS.deck.deckMesh(DK, 1), t = m.top; let down = 0, upA = 0; for (let i = 0; i < t.length; i += 9) { const nz = (t[i + 3] - t[i]) * (t[i + 7] - t[i + 1]) - (t[i + 4] - t[i + 1]) * (t[i + 6] - t[i]); if (nz < 0) down -= nz / 2; else upA += nz / 2; } assert.ok(down < 0.001 * upA, 'area of triangles facing down: ' + down.toFixed(1) + ' / ' + upA.toFixed(0));
});
