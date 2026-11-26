// Tensor Studio · a site file from Loop City step 3 (v8.49): node --test incubator/tensor-studio/
// The parks handed on with the parcels stay parks: no street enters one. A site without parks is built as before.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildTensorSite } from './scripts/site_builder.js';

const dir = new URL('.', import.meta.url);
const lng0 = -0.09, lat0 = 51.49, dLng = 0.0144, dLat = 0.009;   // about 1 km each way
const P = (fx, fy) => [lng0 + fx * dLng, lat0 + fy * dLat], sq = (x, y, s) => [[P(x, y), P(x + s, y), P(x + s, y + s), P(x, y + s), P(x, y)]];
const ring = [P(0, 0), P(1, 0), P(1, 1), P(0, 1)];
const wind = { year: Array.from({ length: 13 }, () => ({ name: 'the year', share: Array(8).fill(1 / 8), v: Array(8).fill(5), calm: 0.02 })), hours: { u: [300, -300], v: [300, -300], month: [1, 1], day: [1, 1], step_h: 3 } };
const base = { ring, roads: [{ coords: [P(-0.2, 0.5), P(1.2, 0.5)], cls: 'primary' }], wind };

test('no parks: the site is built as before, with no parks in its context', () => {
  const { D, meta } = buildTensorSite(base);
  assert.equal(D.ctx.parks, undefined); assert.equal(meta.holes, 0); assert.equal(D.pieces.length, 1);
});
test('a park inside the site is a hole no street enters, and is kept for drawing', () => {
  const { D, meta } = buildTensorSite({ ...base, parks: [sq(0.4, 0.6, 0.2)] });
  assert.equal(D.ctx.parks.length, 1); assert.equal(meta.holes, 1);
  assert.equal(D.buildingHoles.length, 0, 'a park is not a building');
});
test('a park beside the site is drawn but cuts nothing; one far away is left out', () => {
  const near = buildTensorSite({ ...base, parks: [sq(1.05, 0.2, 0.15)] });
  assert.equal(near.D.ctx.parks.length, 1); assert.equal(near.meta.holes, 0); assert.equal((near.D.cut || []).length, 0);
  const far = buildTensorSite({ ...base, parks: [sq(4, 4, 0.2)] });
  assert.equal(far.D.ctx.parks, undefined);
});
test('the page: a site file is read without the London map, and the three ways in are there', () => {
  const html = readFileSync(new URL('index.html', dir), 'utf8'), app = readFileSync(new URL('app.js', dir), 'utf8');
  for (const id of ['fileNav', 'fileOpen', 'fileBack', 'fileP2', 'fileLast', 'fileIn']) assert.ok(html.includes('id="' + id + '"'), id);
  assert.ok(html.includes("f.type === 'tensor-site-input'")); assert.ok(html.includes('tensorStudio.siteFile'));
  assert.ok(html.includes("window.parent.__TENSOR_SITE_INPUT__"), 'the London map still hands its site the same way');
  assert.ok(app.includes("H.source === 'file'")); assert.ok(app.includes('D.ctx.parks'));
});
test('step 3 hands the site on under the same key, and Structure Studio carries the run', () => {
  const b = readFileSync(new URL('../loop-city-tensor-base/index.html', dir), 'utf8'), s = readFileSync(new URL('../structure-studio/index.html', dir), 'utf8');
  assert.ok(b.includes("localStorage.setItem('tensorStudio.siteFile'")); assert.ok(b.includes('../tensor-studio/index.html#site'));
  assert.ok(s.includes('cell_keys: T.source.cell_keys')); assert.ok(s.includes("'loop-city-parcels'"));
});
