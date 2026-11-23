// 01 · Loop City step 1. These tests read the incubator page's own file, so they also
// guard the link: if the page changes in a way the workspace cannot follow (its frame,
// its stations, the engine contract), they fail in CI.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import mod from '../module.js';
import { validateModule, validateBundle } from '../../../shared/schemas/index.js';
import { SOURCE_PATH, CONTRACT, sourceBase, YEARS } from '../engine.js';
import { FRAME, frameMesh, frameRing, meshPosition, toMerc, fromMerc, toLonLat } from '../georef.js';
import { toWGS84, toBNG } from '../../../shared/geo-core/index.js';

const PAGE = readFileSync(fileURLToPath(new URL(`../../../${SOURCE_PATH}index.html`, import.meta.url)), 'utf8');
const cfgLine = PAGE.slice(PAGE.indexOf('const CFG = ') + 12, PAGE.indexOf('\n', PAGE.indexOf('const CFG = ')));
const CFG = JSON.parse(cfgLine.trim().replace(/;$/, ''));

// metres on the ground between two Web Mercator points near latitude lat
const R = 6378137;
const groundM = (a, b, lat) => Math.hypot(a[0] - b[0], a[1] - b[1]) * 2 * Math.PI * R * Math.cos(lat * Math.PI / 180);

test('contract', () => assert.deepEqual(validateModule(mod), []));

test('the bundle is valid without the engine', async () => {
  const b = await mod.run();
  assert.deepEqual(validateBundle(b), []);
  assert.deepEqual(b.boundary, frameRing(FRAME));
});

test('the frame is the incubator page\'s own frame', () => {
  const ex = CFG.map.extentBNG;
  for (const k of ['e0', 'e1', 'n0', 'n1']) assert.equal(FRAME[k], ex[k], `extentBNG.${k}`);
  // the sheet is 35 m a pixel, to within a centimetre
  const [w, h] = CFG.map.size;
  assert.ok(Math.abs((ex.e1 - ex.e0) / w - 35) < 0.01 && Math.abs((ex.n1 - ex.n0) / h - 35) < 0.01);
});

test('the incubator page still offers what the workspace reads', () => {
  assert.match(PAGE, /window\.LoopCityEngine\s*=/);
  assert.match(PAGE, /embed=1/);
  const block = PAGE.slice(PAGE.indexOf('window.LoopCityEngine ='));
  for (const k of CONTRACT) assert.match(block, new RegExp(`(get\\s+${k}\\s*\\(|\\b${k}\\s*\\(|\\b${k}\\s*:)`), `LoopCityEngine.${k}`);
  assert.equal(CFG.map.nodes.length, 17);
  assert.ok(sourceBase('https://x.test/releases/v1/modules/01-loop-city/engine.js').endsWith(`/${SOURCE_PATH}`));
  assert.ok(!sourceBase('https://x.test/releases/v1/modules/01-loop-city/engine.js').includes('/releases/'));
  assert.equal(YEARS, 75);
});

test('the mesh puts every point within a metre of its exact position', () => {
  const mesh = frameMesh(FRAME);
  let worst = 0;
  const check = (E, N) => {
    const exactLL = toWGS84([E, N]);
    const d = groundM(meshPosition(mesh, FRAME, [E, N]), toMerc(exactLL), exactLL[1]);
    if (d > worst) worst = d;
  };
  for (const n of CFG.map.nodes) check(n.E, n.N);                    // the 17 stations
  for (let i = 0; i <= 40; i++) for (let j = 0; j <= 40; j++)         // and a grid of points off the mesh's own vertices
    check(FRAME.e0 + (i + 0.37) / 41 * (FRAME.e1 - FRAME.e0), FRAME.n1 - (j + 0.61) / 41 * (FRAME.n1 - FRAME.n0));
  assert.ok(worst < 1, `worst ${worst.toFixed(3)} m`);
});

test('a picture stretched from its four corners would be far off, which is why the mesh exists', () => {
  const one = frameMesh(FRAME, 1, 1);
  const E = (FRAME.e0 + FRAME.e1) / 2, N = (FRAME.n0 + FRAME.n1) / 2, ll = toWGS84([E, N]);
  const d = groundM(meshPosition(one, FRAME, [E, N]), toMerc(ll), ll[1]);
  assert.ok(d > 100, `four corners: ${d.toFixed(0)} m off at the centre`);
});

test('grid north and map north differ across the frame', () => {
  const turn = E => { const a = toWGS84([E, 180000]), b = toWGS84([E, 190000]); return Math.atan2((b[0] - a[0]) * Math.cos(a[1] * Math.PI / 180), b[1] - a[1]) * 180 / Math.PI; };
  const west = turn(FRAME.e0), east = turn(FRAME.e1);
  assert.ok(west > 0.3 && west < 0.9, `west ${west.toFixed(2)} deg`);
  assert.ok(east > 2.0 && east < 2.6, `east ${east.toFixed(2)} deg`);
});

test('GeoJSON in grid metres goes to lon/lat vertex by vertex, and back', () => {
  const fc = { type: 'FeatureCollection', features: [
    { type: 'Feature', properties: { id: 'P1', kind: 'primary' }, geometry: { type: 'Point', coordinates: [CFG.map.nodes[0].E, CFG.map.nodes[0].N] } },
    { type: 'Feature', properties: { class: 'highway' }, geometry: { type: 'LineString', coordinates: [[500000, 200000], [501000, 200500]] } },
    { type: 'Feature', properties: { use: 'urban' }, geometry: { type: 'Polygon', coordinates: [[[500000, 200000], [501000, 200000], [501000, 201000], [500000, 200000]]] } }
  ] };
  const ll = toLonLat(fc);
  assert.equal(ll.features.length, 3);
  assert.deepEqual(ll.features[0].properties, { id: 'P1', kind: 'primary' });
  const back = toBNG(ll.features[0].geometry.coordinates);
  assert.ok(Math.hypot(back[0] - CFG.map.nodes[0].E, back[1] - CFG.map.nodes[0].N) < 0.01);
  const p = ll.features[2].geometry.coordinates[0][2], q = toBNG(p);
  assert.ok(Math.hypot(q[0] - 501000, q[1] - 201000) < 0.01);
  assert.ok(ll.features[1].geometry.coordinates[0][0] < 0 && ll.features[1].geometry.coordinates[0][1] > 51);   // west of Greenwich, north of 51
  assert.deepEqual(fromMerc(toMerc([-0.1278, 51.5074])).map(v => +v.toFixed(6)), [-0.1278, 51.5074]);
});
