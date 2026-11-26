// Tensor Studio · a site from Loop City (v8.49; v8.51: the wool's parcel package read here): node --test incubator/tensor-studio/
// The parks handed on with the parcels stay parks: no street enters one. A site without parks is built as before.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildTensorSite, bngToWGS84, MAX_SIDE_M, MIN_AREA_M2 } from './scripts/site_builder.js';
import { siteFromParcelPackage, packageCheck, isParcelPackage, MAX_SIDE_M as PK_MAX, MIN_AREA_M2 as PK_MIN } from './scripts/parcel_package.js';

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
test('the Loop City example parcels: a site file of seed 2100, with its run and cell key', () => {
  const f = JSON.parse(readFileSync(new URL('assets/loop-city-sample-site.json', dir), 'utf8')), html = readFileSync(new URL('index.html', dir), 'utf8');
  assert.equal(f.type, 'tensor-site-input'); assert.equal(f.run.id, 's2100·n1bz'); assert.equal(f.run.seed, 2100);
  assert.deepEqual(Object.keys(f.cell_keys), ['C67']); assert.ok(f.ring.length >= 4); assert.ok(f.size.across_m <= 3600);
  assert.ok(html.includes('id="fileSample"')); assert.ok(html.includes('assets/loop-city-sample-site.json'));
  const { D, meta } = buildTensorSite({ ...base, ring: f.ring, roads: f.features.roads, waters: f.features.waters, waterways: f.features.waterways, parks: f.features.parks });
  assert.ok(D.pieces.length >= 1); assert.ok(meta.areaHa > 150 && meta.areaHa < 220);
});
test('the wool hands its parcels on under the same key, and Structure Studio carries the run', () => {
  const w = readFileSync(new URL('../loop-city-wool/index.html', dir), 'utf8'), s = readFileSync(new URL('../structure-studio/index.html', dir), 'utf8');
  assert.ok(w.includes("KEY: 'tensorStudio.siteFile'")); assert.ok(w.includes("localStorage.setItem(TSTUDIO.KEY, JSON.stringify(bdParcelPackage(L)))")); assert.ok(w.includes('../tensor-studio/index.html#site'));
  assert.ok(s.includes('cell_keys: T.source.cell_keys')); assert.ok(s.includes("'loop-city-parcels'"));
});

// (v8.51) the parcel package of the wool bands, read as a site (scripts/parcel_package.js). The example package is the
// wool's own example (three urban parcels by station P2 and a park, seed 2100); the example site is what the former
// step 3 saved from the same parcels. Read here, the package must give that site, coordinate for coordinate.
const pkg = () => JSON.parse(readFileSync(new URL('assets/loop-city-sample-parcels.json', dir), 'utf8'));
test('a parcel package reads as the site the former step 3 saved from the same parcels', () => {
  const old = JSON.parse(readFileSync(new URL('assets/loop-city-sample-site.json', dir), 'utf8')), now = siteFromParcelPackage(pkg(), bngToWGS84);
  assert.equal(now.type, 'tensor-site-input');
  for (const k of ['ring', 'features', 'bng', 'size', 'run', 'cells', 'cell_keys', 'parcels']) assert.deepEqual(now[k], old[k], k);
  const { D, meta } = buildTensorSite({ ...base, ring: now.ring, roads: now.features.roads, waters: now.features.waters, waterways: now.features.waterways, parks: now.features.parks });
  assert.ok(D.pieces.length >= 1); assert.ok(meta.areaHa > 150 && meta.areaHa < 220);
});
test('the package: wool classes become street classes, junction stubs become roads, parks stay parks', () => {
  const p = pkg(), f = siteFromParcelPackage(p, bngToWGS84), R = f.features.roads;
  assert.equal(R.length, p.roads.length + p.site.junctions.length, 'the existing roads are already among the wool roads');
  const map = { M: 'trunk', A: 'primary', B: 'secondary', C: 'tertiary' }; p.roads.forEach((r, i) => assert.equal(R[i].cls, map[r.cls]));
  assert.equal(R.filter(r => String(r.wool).startsWith('junction')).length, p.site.junctions.length);
  assert.equal(f.features.parks.length, p.parks.length); assert.equal(f.features.buildings.length, 0);
  const a = f.ring[0], z = f.ring[f.ring.length - 1]; assert.deepEqual(a, z, 'the ring is closed');
  assert.ok(a[0] > -1 && a[0] < 1 && a[1] > 51 && a[1] < 52.5, 'longitude, latitude round London');
});
test('the package: its size is checked by Tensor Studio\u2019s own limits, and only a parcel package is read', () => {
  const p = pkg(), c = packageCheck(p);
  assert.equal(PK_MAX, MAX_SIDE_M); assert.equal(PK_MIN, MIN_AREA_M2);
  assert.ok(c.ok && c.pieces === 1 && Math.round(c.side) === 2015 && Math.round(c.area / 1e4) === 187);
  const wide = { ...p, site: { ...p.site, rings: [[[500000, 200000], [504000, 200000], [504000, 201000], [500000, 201000]]] } }; assert.equal(packageCheck(wide).why, 'wide');
  const small = { ...p, site: { ...p.site, rings: [[[500000, 200000], [500100, 200000], [500100, 200100], [500000, 200100]]] } }; assert.equal(packageCheck(small).why, 'small');
  assert.equal(isParcelPackage(p), true); assert.equal(isParcelPackage({ type: 'tensor-site-input' }), false); assert.equal(isParcelPackage({ type: 'loop-city-parcel-package', parcels: [] }), false);
  assert.throws(() => siteFromParcelPackage({ type: 'tensor-site-input' }, bngToWGS84));
});
test('the page reads a package handed on or opened, and keeps the site it makes', () => {
  const html = readFileSync(new URL('index.html', dir), 'utf8'), app = readFileSync(new URL('app.js', dir), 'utf8');
  assert.ok(html.includes("from './scripts/parcel_package.js?v=")); assert.ok(html.includes('const asSite = f => (isParcelPackage(f) ? siteFromParcelPackage(f, bngToWGS84) : f);'));
  assert.ok(html.includes('use(f0){ const f = asSite(f0);'), 'Open a site file takes the package too');
  assert.ok(app.includes("j.type === 'loop-city-parcel-package'") && !app.includes('Open it in step 3'), 'a package is no longer sent back to step 3');
  assert.ok(html.includes("location.href = '../loop-city-wool/index.html'"), 'the way back is the wool bands');
});
