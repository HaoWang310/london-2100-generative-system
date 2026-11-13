// Environmental fields (layer 1): elevation from contours, runoff, seasonal winds, comfort.
// Run: node scripts/test_env_fields.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { environmentFields, elevationFromContours, flowAccumulation, landMaskOf } from './env_fields.js';

// 1. a valley: two slopes falling to a stream along x = 500 that runs south; rain must gather on the stream
const nx = 101, ny = 101, cell = 10, Z = new Float32Array(nx * ny);
for (let r = 0; r < ny; r++) for (let c = 0; c < nx; c++) Z[r * nx + c] = 20 + 0.02 * Math.abs(c * cell - 500) + 0.005 * r * cell;
const { A } = flowAccumulation(Z, nx, ny, cell);
const mid = A[10 * nx + 50], side = A[10 * nx + 20];
assert.ok(mid > 20 * side, 'runoff gathers on the valley floor (' + mid + ' vs ' + side + ')');

// 2. contours back to a surface: a plane rising north 1 m every 20 m
const contours = []; for (let z = 0; z <= 50; z++) contours.push({ z, p: [[0, z * 20], [1000, z * 20]] });
const R = elevationFromContours(contours, nx, ny, cell);
assert.ok(Math.abs(R[50 * nx + 50] - 25) < 0.3, 'rebuilt elevation in the middle ≈ 25 m, got ' + R[50 * nx + 50].toFixed(2));

// 3. the station P2 example: fields in range, the winds by season as the weather year says
const D = JSON.parse(fs.readFileSync(new URL('../assets/station-p2.json', import.meta.url)));
const M = landMaskOf(D), E = environmentFields(D, M);
let land = 0; for (const m of M) land += m;
assert.ok(Math.abs(land / 100 - 209) < 6, 'about 209 ha of land, got ' + land / 100);
assert.equal(E.stats.elevationFrom, 'contours');
assert.ok(E.stats.zMin > 30 && E.stats.zMax < 50, 'elevation 33–48 m');
for (const k of ['Q', 'V', 'Cw']) for (const v of [Math.min(...E[k]), Math.max(...E[k])]) assert.ok(v >= 0 && v <= 1, k + ' in 0–1');
const names = D.dirs.map(d => d.name), sE = E.stats.summerEnergy, wE = E.stats.winterColdEnergy;
assert.equal(names[sE.indexOf(Math.max(...sE))], 'W', 'summer air comes mostly from the west');
assert.equal(names[wE.indexOf(Math.max(...wE))], 'N', 'winter cold comes mostly from the north');
assert.deepEqual(wE.slice(3), [0, 0, 0, 0, 0], 'cold wind counts only N, NE, E');

console.log(JSON.stringify({ pass: true, landHa: land / 100, stats: E.stats }));

// (v8.8) the corridors: a band along the main runoff paths, a few percent of the land, no specks
{ const { corridors } = await import('./env_fields.js');
  const D = JSON.parse(fs.readFileSync(new URL('../assets/station-p2.json', import.meta.url)));
  const lm = landMaskOf(D), env = environmentFields(D, lm), { nx, ny, cell } = D.grid;
  const g = corridors(env, lm, nx, ny, cell, { q: 0.6, half: 15 });
  const land = lm.reduce((s, x) => s + x, 0), share = g.cells / land;
  let onLand = true; for (let i = 0; i < g.mask.length; i++) if (g.mask[i] && !lm[i]) onLand = false;
  const ok = share > 0.03 && share < 0.25 && onLand && g.dist[g.seed.indexOf(1)] === 0;
  console.log(JSON.stringify({ corridors: ok ? 'pass' : 'FAIL', share: +share.toFixed(3), areaHa: +g.areaHa.toFixed(1) }));
  if (!ok) process.exit(1); }
