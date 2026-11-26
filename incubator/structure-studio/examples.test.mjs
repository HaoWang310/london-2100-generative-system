// Structure Studio · the two built-in examples (26 Nov 2026): node --test incubator/structure-studio/
// Station P2 is the app's own show-piece. C67 · P2 is the example of the research line: the wool bands' example
// (seed 2100) → Tensor Studio's Loop City example parcels → this snapshot. The three must stay one place.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const dir = new URL('.', import.meta.url), read = p => readFileSync(new URL(p, dir), 'utf8');
const self = {}; new Function('self', read('engine/structure.js'))(self);
const SS = self.SS, html = read('index.html'), P = Function('return ' + html.match(/const P = (\{[^}]*\});/)[1])();
const snap = JSON.parse(read('assets/loop-city-c67-p2.snapshot.json'));

test('the page offers both built-in examples and still opens on station P2', () => {
  assert.ok(html.includes("'builtin': { file: 'assets/station-p2.snapshot.json'")); assert.ok(html.includes("'builtin-lc': { file: 'assets/loop-city-c67-p2.snapshot.json'"));
  assert.ok(html.includes("let CUR = 'builtin'")); assert.ok(html.includes("for (const id in BUILT) add(id, BUILT[id].label());"));
  assert.ok(html.includes("window.L2Chain.wantsExample('structure-studio')") && html.includes("const LINE_EXAMPLE = 'builtin-lc'"), 'the chain row’s example link opens the example of the line');
});

test('C67 · P2 is a snapshot of Tensor Studio on the Loop City example parcels, with its run and cell key', () => {
  assert.equal(snap.format, 'structure-studio/snapshot@1'); assert.equal(snap.source, 'tensor-studio'); assert.equal(snap.site, 'loop-city-parcels');
  assert.deepEqual(snap.run, { id: 's2100·n1bz', seed: 2100 }); assert.deepEqual(snap.cell_keys, { C67: 's2100·n1bz · C67 · P2' });
  assert.equal(snap.roads.length, 178); assert.equal(snap.junctions.length, 268); assert.equal(snap.pieces.length, 1);
});

test('one place along the line: the same parcels and run as Tensor Studio’s example and the wool’s', () => {
  const ts = JSON.parse(read('../tensor-studio/assets/loop-city-sample-site.json')), wool = read('../loop-city-wool/sample-cells.js');
  assert.deepEqual(snap.parcels, ts.parcels); assert.equal(snap.run.id, ts.run.id); assert.deepEqual(snap.cell_keys, ts.cell_keys);
  assert.ok(wool.includes('s2100·n1bz'), 'the wool’s example is the same run'); assert.ok(/"id":\s*"C67"/.test(wool), 'and holds the cell C67');
  // the site of the snapshot is the site of the parcels: the same origin and size, to the metre
  const xs = ts.bng.ring.map(q => q[0]), ys = ts.bng.ring.map(q => q[1]), w = Math.max(...xs) - Math.min(...xs), h = Math.max(...ys) - Math.min(...ys);
  assert.ok(snap.w >= w && snap.w - w < 800, 'width ' + snap.w + ' against ' + w); assert.ok(snap.h >= h && snap.h - h < 800, 'height ' + snap.h + ' against ' + h);
});

test('the structure is built on it with the page’s own defaults', () => {
  const site = SS.prepareSite(snap), F = SS.buildStructure(site, P, new Set()), s = SS.scoreStructure(F);
  assert.equal(site.cores.length, 2); assert.equal(F.towers.length, 2); assert.ok(F.cells.length >= 60 && F.cells.length <= 95, F.cells.length + ' cells');
  assert.ok(Number.isFinite(s.total) && s.total > 60, 'score ' + s.total);
});
