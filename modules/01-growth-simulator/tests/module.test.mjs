// 01 · Growth simulator. These tests read the incubator app's own files, so they
// also guard the link: if the incubator changes in a way the workspace cannot
// follow (engine API, controls, data layout), they fail in CI.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { inflateRawSync, inflateSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import mod from '../module.js';
import { validateModule, validateBundle } from '../../../shared/schemas/index.js';
import { evaluateShared, evaluateEngine, sourceBase, SOURCE_PATH } from '../source.js';
import { cellsFromEvents, classAt, tierAt } from '../cells.js';
import { gridMesh, gridFrame, toMerc, fromMerc, cellAt, mercX, mercY } from '../georef.js';
import { toWGS84, toBNG } from '../../../shared/geo-core/index.js';

const SRC = fileURLToPath(new URL(`../../../${SOURCE_PATH}`, import.meta.url));
const read = p => readFileSync(SRC + p, 'utf8');
const unz = p => { const b = readFileSync(SRC + p); let o; try { o = inflateSync(b); } catch { o = inflateRawSync(b); } return o.buffer.slice(o.byteOffset, o.byteOffset + o.byteLength); };
const shared = evaluateShared(read('data/meta.js'), read('controls.js'));
const { D, GVC, I18N } = shared;
const M = D.meta, N = M.NX * M.NY;
const finalEv = { idx: new Uint32Array(unz(D.final.idx)), cls: new Uint8Array(unz(D.final.cls)), off: D.final.off };

test('contract', () => assert.deepEqual(validateModule(mod), []));

test('the incubator still offers what the workspace reads', () => {
  for (const k of ['XMIN', 'YMAX', 'C', 'NX', 'NY', 'NODES']) assert.ok(k in M, `meta.${k}`);
  assert.equal(M.C, 50);
  for (const k of ['orbital', 'high_speed', 'radials']) assert.ok(Array.isArray(D.rails[k]), `rails.${k}`);
  assert.equal(D.final.off.length, 77);
  assert.equal(D.final.stats.length, 76);
  for (const n of ['BITS', 'ZONE', 'CAT', 'SPUR', 'FIELD', 'VEIN', 'DRAIL']) assert.match(D.arr[n], /^data\//);
  assert.ok(Array.isArray(GVC.GROUPS) && Array.isArray(GVC.SIMPLE) && GVC.UNDER && I18N.zh);
  const GV = evaluateEngine(read('engine.js'));
  for (const f of ['init', 'run', 'get']) assert.equal(typeof GV[f], 'function', `GV.${f}`);
  const ids = GVC.GROUPS.flatMap(g => g.s.map(s => s[0])).sort();
  assert.deepEqual(ids, Object.keys(GV.DEFAULTS).sort(), 'every engine setting has an Advanced slider');
  for (const g of GVC.SIMPLE) for (const c of g.c) {            // every simple control reads and writes the settings
    const q = { ...GV.DEFAULTS }, def = c.get(q);
    assert.ok(def >= c.min - 1e-9 && def <= c.max + 1e-9, `${c.id} default in range`);
    c.set(q, def);
    assert.deepEqual(q, GV.DEFAULTS, `${c.id} at its default leaves the release's values`);
    assert.equal(typeof c.show(def, v => String(v), s => s), 'string');
  }
});

test('source: a frozen release reads the live incubator', () => {
  assert.equal(sourceBase('https://x.io/site/modules/01-growth-simulator/source.js'), 'https://x.io/site/incubator/growth-simulator-dark/');
  assert.equal(sourceBase('https://x.io/site/releases/0.1.0-abc1234/modules/01-growth-simulator/source.js'), 'https://x.io/site/incubator/growth-simulator-dark/');
});

test('parcel records give the same picture as replaying the events, every 5 years', () => {
  const cells = cellsFromEvents(N, finalEv), tier = new Uint8Array(N), got = new Uint8Array(N);
  let applied = 0;
  for (let y = 0; y <= 75; y++) {
    for (; applied < finalEv.off[y + 1]; applied++) tier[finalEv.idx[applied]] = finalEv.cls[applied];
    if (y % 5 && y !== 75) continue;
    tierAt(cells, N, y, got);
    let diff = 0; for (let i = 0; i < N; i++) if (got[i] !== tier[i]) diff++;
    assert.equal(diff, 0, `year ${2025 + y}`);
    // and the areas match the release's own statistics
    const n = [0, 0, 0, 0, 0, 0]; for (let i = 0; i < N; i++) n[got[i]]++;
    const k = D.final.stats[y].km2;
    for (const [c, key] of [[1, 'l'], [2, 'm'], [3, 'h'], [4, 'fh'], [5, 'fv']]) assert.ok(Math.abs(n[c] * M.CELL - k[key]) < 0.06, `${2025 + y} ${key}`);
  }
  assert.equal(classAt(cells, 0, 75), tier[0]);
});

test('georeference: the mesh puts every parcel within 1 m of its exact position', () => {
  const mesh = gridMesh(M), f = gridFrame(M);
  const lat = toWGS84([(f.e0 + f.e1) / 2, (f.n0 + f.n1) / 2])[1];
  const metresPerUnit = 40075016.686 * Math.cos(lat * Math.PI / 180);
  let worst = 0;
  for (let r = 0; r < mesh.rows; r += 7) for (let c = 0; c < mesh.cols; c += 7) {
    const at = (cc, rr) => { const k = (rr * (mesh.cols + 1) + cc) * 2; return [mesh.pos[k] + mesh.origin[0], mesh.pos[k + 1] + mesh.origin[1]]; };
    const a = at(c, r), b = at(c + 1, r), d = at(c, r + 1), e = at(c + 1, r + 1);
    for (const [u, v] of [[0.5, 0.5], [0.25, 0.75], [0.9, 0.1]]) {
      // the two triangles of a mesh cell: (a, d, b) and (b, d, e)
      const p = u + v <= 1 ? [a[0] + (b[0] - a[0]) * u + (d[0] - a[0]) * v, a[1] + (b[1] - a[1]) * u + (d[1] - a[1]) * v]
        : [e[0] + (d[0] - e[0]) * (1 - u) + (b[0] - e[0]) * (1 - v), e[1] + (d[1] - e[1]) * (1 - u) + (b[1] - e[1]) * (1 - v)];
      const E = f.e0 + (c + u) / mesh.cols * (f.e1 - f.e0), Nn = f.n1 - (r + v) / mesh.rows * (f.n1 - f.n0);
      const exact = toMerc(toWGS84([E, Nn]));
      worst = Math.max(worst, Math.hypot(p[0] - exact[0], p[1] - exact[1]) * metresPerUnit);
    }
  }
  assert.ok(worst < 1, `worst mesh error ${worst.toFixed(3)} m`);
});

test('georeference: known places fall on the right parcels', () => {
  // WGS84 positions of places on the Thames and on land (OpenStreetMap), against the
  // release's own water layer is checked in the browser; here: map point -> parcel -> back.
  const towerBridge = [-0.07536, 51.50546];
  const c = cellAt(M, towerBridge);
  assert.ok(c, 'Tower Bridge is inside the grid');
  const [E, Nn] = toBNG(towerBridge);
  assert.ok(Math.abs(E - 533600) < 150 && Math.abs(Nn - 180200) < 150, `Tower Bridge at ${E.toFixed(0)}, ${Nn.toFixed(0)} (TQ 336 802)`);
  const centre = [M.XMIN + (c.j + 0.5) * M.C, M.YMAX - (c.i + 0.5) * M.C];
  assert.ok(Math.hypot(centre[0] - E, centre[1] - Nn) <= M.C * Math.SQRT1_2 + 1e-6, 'the parcel found contains the point');
  const ll = toWGS84(centre), m = toMerc(ll), back = fromMerc(m);
  assert.ok(Math.abs(back[0] - ll[0]) < 1e-9 && Math.abs(back[1] - ll[1]) < 1e-9, 'mercator round trip');
  assert.ok(Math.abs(mercX(0) - 0.5) < 1e-12 && Math.abs(mercY(0) - 0.5) < 1e-12);
  assert.equal(cellAt(M, [2.35, 48.85]), null, 'Paris is outside the grid');
});

test('run() gives a valid EPSG:27700 bundle of the loop', async () => {
  const growth = { load: async () => {}, state: { D, final: { stats: D.final.stats }, P: {} } };
  const b = await mod.run(null, {}, { growth });
  assert.deepEqual(validateBundle(b), []);
  assert.equal(b.stats.pop2100, 12222179);
  assert.equal(b.nodes.length, M.NODES.length);
});

test('the engine, read from the incubator, grows the release totals', { timeout: 180000 }, async () => {
  const GV = evaluateEngine(read('engine.js'));
  const arr = {};
  for (const n of ['BITS', 'ZONE', 'CAT', 'SPUR', 'FIELD', 'VEIN', 'DRAIL']) { const b = unz(D.arr[n]); arr[n] = n === 'DRAIL' ? new Uint16Array(b) : new Uint8Array(b); }
  GV.init(M, arr);
  const res = await GV.run({});
  assert.equal(res.stats[75].pop, 12222179);
  const cells = cellsFromEvents(N, { idx: res.idx, cls: res.cls, off: res.off });
  const n = [0, 0, 0, 0, 0, 0]; for (let i = 0; i < N; i++) n[classAt(cells, i, 75)]++;
  assert.ok(Math.abs((n[1] + n[2] + n[3]) * M.CELL - 837.8) < 0.1, 'built area 837.8 km²');
});
