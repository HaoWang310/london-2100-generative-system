// The VR folder keeps its own copy of the National Grid maths (src/epsg27700.js) so it can be packed on its own.
// This checks that the copy still matches shared/geo-core/epsg27700.js, and that the local grid frame round-trips.
//   node incubator/vr/tools/check-geo.mjs
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { localGrid } from '../src/geo.js';

const here = p => fileURLToPath(new URL(p, import.meta.url));
const body = s => s.slice(s.indexOf('// EPSG:27700'));
const mine = body(readFileSync(here('../src/epsg27700.js'), 'utf8')), shared = body(readFileSync(here('../../../shared/geo-core/epsg27700.js'), 'utf8'));
let bad = 0; const fail = m => { console.error('✗ ' + m); bad++; };
if (mine !== shared) fail('src/epsg27700.js differs from shared/geo-core/epsg27700.js: copy it again (keep the two header lines)');

const G = localGrid({ lat: 51.5074, lon: -0.1278 });
for (const p of [[0, 0], [1234, -567], [-20000, 30000], [60000, 60000]]){
  const q = G.fromLL(G.toLL(p)); if (Math.hypot(q[0] - p[0], q[1] - p[1]) > 1e-3) fail('round trip ' + p + ' → ' + q); }
// a z14 tile: bilinear points against exact ones
const T = G.tile(14, 8186, 5448); let worst = 0;
for (let i = 0; i <= 20; i++) for (let j = 0; j <= 20; j++){ const u = i / 20, v = j / 20, n = 2 ** 14;
  const lon = (8186 + u) / n * 360 - 180, lat = Math.atan(Math.sinh(Math.PI * (1 - 2 * (5448 + v) / n))) * 180 / Math.PI;
  const a = T.at(u, v), b = G.fromLL([lon, lat]); worst = Math.max(worst, Math.hypot(a[0] - b[0], a[1] - b[1])); }
if (worst > 0.05) fail('z14 tile interpolation off by ' + worst.toFixed(3) + ' m');
console.log(bad ? bad + ' problem(s)' : `ok · VR grid copy matches shared · z14 tile within ${(worst * 100).toFixed(2)} cm · grid north vs true north ${G.northDeg.toFixed(2)}°`);
process.exit(bad ? 1 : 0);
