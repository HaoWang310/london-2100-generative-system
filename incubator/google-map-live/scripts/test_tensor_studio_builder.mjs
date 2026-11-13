// Tensor Studio site builder: projection accuracy, the baked data contract, anchors and zones.
// Run: node scripts/test_tensor_studio_builder.mjs
import assert from 'node:assert/strict';
import {wgs84ToBNG, buildTensorSite, MAX_SIDE_M} from './tensor_studio_builder.js';

// 1. WGS84 → British National Grid within the Helmert transform's stated accuracy (~5 m)
const bigBen = wgs84ToBNG(-0.124625, 51.500729);
assert.ok(Math.hypot(bigBen[0] - 530268, bigBen[1] - 179640) < 8, 'Big Ben lands on its OS grid reference');

// 2. a synthetic 1 km square site in south London, with one road across it, a pond and a stream
const lng0 = -0.09, lat0 = 51.49, dLng = 0.0144, dLat = 0.009;   // ≈ 1 km each way
const P = (fx, fy) => [lng0 + fx * dLng, lat0 + fy * dLat];
const ring = [P(0, 0), P(1, 0), P(1, 1), P(0, 1)];
const wind = {
  year: Array.from({length: 13}, () => ({name: 'the year', share: Array(8).fill(1 / 8), v: Array(8).fill(5), calm: 0.02})),
  hours: {u: [300, -300], v: [300, -300], month: [1, 1], day: [1, 1], step_h: 3}
};
const {D, meta} = buildTensorSite({
  ring,
  roads: [{coords: [P(-0.2, 0.5), P(1.2, 0.5)], cls: 'primary'}, {coords: [P(0.5, -0.2), P(0.5, 1.2)], cls: 'residential'}],
  rails: [{coords: [P(-0.2, 0.9), P(1.2, 0.95)]}],
  waters: [[[P(0.2, 0.2), P(0.3, 0.2), P(0.3, 0.3), P(0.2, 0.3), P(0.2, 0.2)]]],
  waterways: [{coords: [P(0.7, -0.1), P(0.7, 1.1)], cls: 'stream'}],
  buildings: [[[P(0.4, 0.4), P(0.42, 0.4), P(0.42, 0.42), P(0.4, 0.42), P(0.4, 0.4)]]],
  elevation: (lng, lat) => 20 + 2000 * (lat - lat0),
  wind
});

// the baked contract: grid, int16 base64 lengths, zone bits, south-up field rows
const {nx, ny} = D.grid;
assert.equal(D.grid.cell, 10);
assert.ok(nx * ny > 10000 && D.w / 10 >= nx - 1 && D.h / 10 >= ny - 1);
for (const k of ['cA', 'cW', 'eD', 'eA', 'sD', 'sA', 'rD', 'rA'])
  assert.equal(Buffer.from(D.basis[k], 'base64').length, 2 * nx * ny, k + ' is int16 per cell');
assert.equal(D.dirs.length, 8);
for (const d of D.dirs) assert.equal(Buffer.from(d.S, 'base64').length, 2 * nx * ny);
assert.equal(D.zone.c, 5);
assert.equal(Buffer.from(D.zone.bits, 'base64').length, Math.ceil(D.zone.W * D.zone.H / 8));
assert.ok(D.zone.rail, 'ground-level rail paints a bridge zone');

// anchors sit where the two drawn streets cross the boundary (4 crossings)
assert.ok(meta.anchors >= 4 && meta.anchors <= 6, 'anchors from street crossings, got ' + meta.anchors);
for (const a of D.anchors) assert.ok(a.x >= 0 && a.x <= D.w && a.y >= 0 && a.y <= D.h);

// the pond is a hole in the land; the site keeps about 1 km side
assert.equal(meta.pieces, 1);
assert.ok(meta.holes + (D.cut || []).length >= 1, 'the pond is kept out of the land');
assert.ok(Math.abs(meta.sideM - 1000) < 120, 'site side ≈ 1 km, got ' + meta.sideM);
assert.ok(meta.areaHa > 80 && meta.areaHa < 120);

// the contour axis runs along the slope: east–west here (height grows north), so cA ≈ 0 on land
const cA = Buffer.from(D.basis.cA, 'base64');
const mid = (Math.floor(ny / 2) * nx + Math.floor(nx / 2)) * 2;
let v = cA.readInt16LE(mid) / 1e4;
assert.ok(Math.abs(v) < 0.15, 'contour axis follows the slope, got ' + v);
assert.ok(D.contours.length > 3, 'contour lines for the drawing');
assert.deepEqual(Object.keys(D.ctx).sort(), ['bld', 'lanes', 'parcels', 'prim', 'rib', 'room', 'streams', 'urban', 'water'].sort());

// 3. refusals: too large, degenerate
assert.throws(() => buildTensorSite({ring: [[-0.2, 51.4], [0.2, 51.4], [0.2, 51.6], [-0.2, 51.6]], wind}), /smaller site/i, 'over ' + MAX_SIDE_M + ' m is refused');
assert.throws(() => buildTensorSite({ring: [P(0, 0), P(0.001, 0), P(0.001, 0.001)], wind}), /at least/i, 'a tiny sliver is refused');

console.log(JSON.stringify({pass: true, bigBenOffsetM: +Math.hypot(bigBen[0] - 530268, bigBen[1] - 179640).toFixed(1), meta}));
