// Plan metres for the VR viewer = British National Grid (EPSG:27700) minus an origin, like every other app here:
//   plan [x, y] = toBNG([lon, lat]) − origin        x east (grid), y north (grid), metres
// so OSM buildings, Tensor Studio roads (GeoJSON / scene files with crs EPSG:27700) and the Hydro Lab grid all line up.
// Before v0.52 the viewer used Web Mercator × cos(lat), which is turned about 1.5° against the grid in London
// (≈ 25 m off per km away from the start point).
//
// The National Grid only makes sense around Great Britain. Far away (the whole-world views on the table) points fall
// back to an affine fit of the grid at the origin: continuous, and nobody measures Australia in the headset.
// OSM tiles: each tile gets a small grid of exactly converted points; everything in that tile (ground picture,
// buildings, trees, cars) is placed by bilinear interpolation inside it — under 2 cm off at z14, and fast.

import { toBNG, toWGS84 } from './epsg27700.js';

const R = 6378137, WORLD = 2 * Math.PI * R, DEG = Math.PI / 180;
export const merc = ([lon, lat]) => [R * lon * DEG, R * Math.log(Math.tan(Math.PI / 4 + lat * DEG / 2))];
export const unmerc = ([mx, my]) => [mx / R / DEG, (2 * Math.atan(Math.exp(my / R)) - Math.PI / 2) / DEG];
/** where the National Grid is used exactly (lon, lat in degrees) */
export const onGrid = (lon, lat) => lon > -12 && lon < 6 && lat > 46 && lat < 63;
const tileM = z => WORLD / 2 ** z;

/** A local National Grid frame. at: { lat, lon } (its BNG point becomes plan (0, 0)) or { origin: [E, N] }. */
export function localGrid(at){
  const O = at.origin ? at.origin.slice() : toBNG([at.lon, at.lat]);
  const ll0 = at.origin ? toWGS84(O) : [at.lon, at.lat], m0 = merc(ll0);
  const exact = ll => { const p = toBNG(ll); return [p[0] - O[0], p[1] - O[1]]; };
  // affine fit at the origin: plan ≈ A · (merc − m0)
  const h = 50, d = (dx, dy) => exact(unmerc([m0[0] + dx, m0[1] + dy]));
  const px = d(h, 0), nx = d(-h, 0), py = d(0, h), ny = d(0, -h);
  const a = (px[0] - nx[0]) / (2 * h), c = (px[1] - nx[1]) / (2 * h), b = (py[0] - ny[0]) / (2 * h), e = (py[1] - ny[1]) / (2 * h), det = a * e - b * c;
  const affine = m => { const dx = m[0] - m0[0], dy = m[1] - m0[1]; return [a * dx + b * dy, c * dx + e * dy]; };
  const unaffine = p => [m0[0] + (e * p[0] - b * p[1]) / det, m0[1] + (a * p[1] - c * p[0]) / det];
  const fromLL = ll => onGrid(ll[0], ll[1]) ? exact(ll) : affine(merc(ll));
  const toLL = p => { const ll = unmerc(unaffine(p)); if (!onGrid(ll[0], ll[1]) || Math.hypot(p[0], p[1]) > 1.5e6) return ll;
    return toWGS84([p[0] + O[0], p[1] + O[1]]); };
  const cache = new Map();
  return {
    crs: 'EPSG:27700', origin: O,
    /** grid north → true north, degrees (positive: true north lies east of grid north) — about −1.5° in London */
    northDeg: Math.atan2(b, e) / DEG,
    fromLL, toLL,
    fromMerc: m => fromLL(unmerc(m)), toMerc: p => merc(toLL(p)),
    /** tile z/x/y → { N, pts, at(u, v), box } · u east, v south, 0…1 across the tile (a little outside is fine) */
    tile(z, x, y){
      const key = z + '/' + x + '/' + y; let T = cache.get(key); if (T) return T;
      const s = tileM(z), mx0 = x * s - WORLD / 2, my0 = WORLD / 2 - y * s;
      const corners = [[0, 0], [1, 0], [0, 1], [1, 1]].map(([u, v]) => unmerc([mx0 + u * s, my0 - v * s]));
      const ex = z >= 6 && corners.every(q => onGrid(q[0], q[1])), N = ex ? (z >= 12 ? 4 : 8) : 1, pts = new Float64Array((N + 1) * (N + 1) * 2);
      for (let j = 0; j <= N; j++) for (let i = 0; i <= N; i++){ const m = [mx0 + i / N * s, my0 - j / N * s], p = ex ? exact(unmerc(m)) : affine(m), k = (j * (N + 1) + i) * 2; pts[k] = p[0]; pts[k + 1] = p[1]; }
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      for (let k = 0; k < pts.length; k += 2){ x0 = Math.min(x0, pts[k]); x1 = Math.max(x1, pts[k]); y0 = Math.min(y0, pts[k + 1]); y1 = Math.max(y1, pts[k + 1]); }
      const at = (u, v) => { const fu = u * N, fv = v * N, i = Math.max(0, Math.min(N - 1, Math.floor(fu))), j = Math.max(0, Math.min(N - 1, Math.floor(fv))), s1 = fu - i, t1 = fv - j;
        const k00 = (j * (N + 1) + i) * 2, k10 = k00 + 2, k01 = k00 + (N + 1) * 2, k11 = k01 + 2, w00 = (1 - s1) * (1 - t1), w10 = s1 * (1 - t1), w01 = (1 - s1) * t1, w11 = s1 * t1;
        return [w00 * pts[k00] + w10 * pts[k10] + w01 * pts[k01] + w11 * pts[k11], w00 * pts[k00 + 1] + w10 * pts[k10 + 1] + w01 * pts[k01 + 1] + w11 * pts[k11 + 1]]; };
      T = { N, pts, at, box: [x0, y0, x1, y1], exact: ex };
      if (cache.size > 4000) cache.clear(); cache.set(key, T); return T;
    }
  };
}
