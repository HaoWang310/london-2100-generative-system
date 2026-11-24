// 结构工作室 · 开场短片：数据（任意场地实算）与页面接线的回归测试：node --test incubator/structure-studio/intro.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const dir = new URL('.', import.meta.url);
const self = {}; for (const f of ['engine/structure.js', 'engine/deck.js', 'engine/tower.js', 'intro/data.js', 'intro/draw.js']) new Function('self', 'module', readFileSync(new URL(f, dir), 'utf8'))(self, undefined);
const SS = self.SS, ID = self.SSIntroData, snap = JSON.parse(readFileSync(new URL('assets/station-p2.snapshot.json', dir), 'utf8'));
const html = readFileSync(new URL('index.html', dir), 'utf8'), P = Function('return ' + html.match(/const P = (\{[^}]*\});/)[1])();
const A = ID.fromSnap(snap), site = SS.prepareSite(snap), F = SS.buildStructure(site, P, new Set()), B = ID.fromStructure(F, site, P), DK = SS.deck.buildDeck(F, {}), C = ID.fromDeck(DK, F);

test('scene 1–2: the ground of station P2, read from the snapshot', () => {
  assert.equal(A.stats.landHa, Math.round(site.landHa)); assert.equal(A.stats.roads, snap.roads.length);
  assert.ok(A.stats.T > 80, 'mostly T-junctions ' + A.stats.T); assert.equal(A.stats.T + A.stats.X + A.stats.Y, 100);
  assert.ok(A.stats.blocks > 40 && A.stats.blocks < 70, 'street blocks ' + A.stats.blocks); assert.ok(A.stats.blockHa > 1 && A.stats.blockHa < 4, 'median block ' + A.stats.blockHa);
  assert.ok(A.outline.length === snap.pieces.length && A.outline.every(pc => pc[0].length > 3), 'outlines kept (closed rings simplified in halves)');
});
test('scene 3–4: the corridor net, its nodes and angles, the field', () => {
  assert.equal(B.stats.nodes3, B.stats.nodes, 'every node three-way on P2'); assert.ok(B.stats.Tlike < 30, 'few T-shaped nodes ' + B.stats.Tlike);
  assert.equal(B.stats.d1, Math.round(F.stats.d1)); assert.ok(B.stats.farm + B.stats.corr <= 100);
  assert.ok(B.stream.length > 30, 'streamlines ' + B.stream.length); assert.equal(B.cores.length, site.cores.length); assert.equal(B.strands.length, F.strands.length);
});
test('scene 5: the structure of step 6', () => {
  assert.ok(C.entries >= 50 && C.r12 >= 80 && C.r23 > 0, JSON.stringify(C).slice(0, 80)); assert.equal(C.ramps.length, DK.ramps.length); assert.ok(C.lenKm > 10);
});
test('the data cross to the worker as plain data (no functions)', () => { for (const x of [A, B, C]) assert.doesNotThrow(() => structuredClone(x)); });
test('the film has five scenes ending at about 31 s, and the wool threads 16 frames', () => {
  assert.deepEqual(self.SSIntroDraw.T, [0, 4.5, 9.5, 14.5, 19.5]); assert.ok(self.SSIntroDraw.END > 30 && self.SSIntroDraw.END < 32);
  const w = JSON.parse(readFileSync(new URL('intro/wool.json', dir), 'utf8')); assert.equal(w.F.length, 16); assert.equal(w.A.length, 48); assert.equal(w.F[0].length, 24);
});
test('the page plays the film first, hands over without replaying the tensor field, and can play it again', () => {
  const ver = readFileSync(new URL('docs/CHANGELOG.md', dir), 'utf8').match(/^## v([0-9.]+)/m)[1];
  for (const f of ['data', 'draw', 'scene5']) assert.ok(html.includes(`<script src="intro/${f}.js?v=${ver}"></script>`), f);
  assert.ok(html.includes(`<script src="intro/intro.js?v=${ver}"></script>`) && html.indexOf('intro/intro.js') < html.indexOf('three.min.js'), 'the cover comes before three.js');
  assert.ok(html.includes(`intro/intro.css?v=${ver}`));
  for (const k of ['SSIntro.onSnap(SNAP, name)', 'SSIntro.onStructure(skip => guidedIntro(skip))', 'async function guidedIntro(skip)', 'if (skip) DEMO.T = Math.max(dmT0[1], DEMO.stopAt - 2)', "$('introBtn').onclick", '"▶ 开场短片": "▶ Opening film"']) assert.ok(html.includes(k), k);
  assert.ok(html.indexOf('SSIntro.onSnap(SNAP, name)') < html.indexOf('SITE = SS.prepareSite(SNAP); SITE4 = null'), 'the snapshot goes to the film before the page starts computing');
  const w = readFileSync(new URL('intro/worker.js', dir), 'utf8'); assert.ok(w.includes("importScripts('data.js' + (self.location.search || ''), 'draw.js' + (self.location.search || ''))"));
  const js = readFileSync(new URL('intro/intro.js', dir), 'utf8'); for (const k of ['nointro', 'embed=1', 'prefers-reduced-motion', "classList.contains('l2ui')", 'transferControlToOffscreen']) assert.ok(js.includes(k), k);
  assert.ok(!/window\.parent\s*!==\s*window/.test(js), 'the catalogue opens the app in a frame: being framed must not stop the film');
});
