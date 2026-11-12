import test from 'node:test';
import assert from 'node:assert/strict';
import { toBNG, toWGS84, _internal, clipPolygonConvex, area, rectRing, truncatePolyline, polylineLength, clipPolylineToPolygon, circleRing }
  from '../geo-core/index.js';

const { projectOSGB, unprojectOSGB, DEG } = _internal;

test('OS worked example: OSGB36 52°39\'27.2531"N 1°43\'4.5177"E -> E651409.903 N313177.270', () => {
  const lat = (52 + 39 / 60 + 27.2531 / 3600) * DEG;
  const lon = (1 + 43 / 60 + 4.5177 / 3600) * DEG;
  const [E, N] = projectOSGB(lat, lon);
  assert.ok(Math.abs(E - 651409.903) < 0.01, `E=${E}`);
  assert.ok(Math.abs(N - 313177.270) < 0.01, `N=${N}`);
  const [la, lo] = unprojectOSGB(E, N);
  assert.ok(Math.abs(la - lat) / DEG * 3600 < 1e-4);
  assert.ok(Math.abs(lo - lon) / DEG * 3600 < 1e-4);
});

test('WGS84 round trip across London stays below 1 mm', () => {
  for (const p of [[-0.1278, 51.5074], [-0.5, 51.3], [0.3, 51.7], [-0.0015, 51.4778]]) {
    const back = toWGS84(toBNG(p));
    const dE = (back[0] - p[0]) * 111320 * Math.cos(p[1] * DEG), dN = (back[1] - p[1]) * 110574;
    assert.ok(Math.hypot(dE, dN) < 0.001, `${p} -> ${back}`);
  }
});

test('Royal Observatory Greenwich lands near its published grid reference (TQ 3887 7737)', () => {
  const [E, N] = toBNG([-0.0015, 51.4778]);
  assert.ok(Math.abs(E - 538870) < 60 && Math.abs(N - 177370) < 60, `${E}, ${N}`);
});

test('convex clipping and areas', () => {
  const a = rectRing(0, 0, 10, 10), b = rectRing(5, 5, 15, 15);
  assert.equal(area(clipPolygonConvex(a, b)), 25);
  assert.deepEqual(clipPolygonConvex(a, rectRing(20, 20, 30, 30)), []);
});

test('timeline truncation keeps the requested share of length', () => {
  const l = [[0, 0], [100, 0], [100, 100]];
  assert.ok(Math.abs(polylineLength(truncatePolyline(l, 0.25)) - 50) < 1e-9);
  assert.equal(truncatePolyline(l, 1), l);
});

test('polyline clipping to a circle', () => {
  const pieces = clipPolylineToPolygon([[-200, 0], [200, 0]], circleRing([0, 0], 100, 256), 1);
  assert.equal(pieces.length, 1);
  assert.ok(Math.abs(polylineLength(pieces[0]) - 200) < 3);
});
