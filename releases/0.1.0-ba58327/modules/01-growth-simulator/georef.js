// Where the 50 m grid sits on the map.
//
// The simulator's grid is British National Grid (EPSG:27700): column j, row i
// covers E = XMIN + j*C .. +C, N = YMAX - i*C .. -C (row 0 is the north edge).
// The map is Web Mercator. The grid is drawn as a fine mesh whose every vertex
// is projected exactly (shared/geo-core: OS Transverse Mercator + Helmert,
// about 2-5 m); inside one mesh cell the error of linear interpolation is
// well under 1 m. One picture stretched from its four corners would be off by
// up to ~280 m, which is why this exists.

import { toWGS84, toBNG } from '../../shared/geo-core/index.js?v=ba58327';

/** Web Mercator, in MapLibre's 0..1 world units (MercatorCoordinate.fromLngLat). */
export const mercX = lon => (180 + lon) / 360;
export const mercY = lat => (180 - (180 / Math.PI) * Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360))) / 360;
export const toMerc = ([lon, lat]) => [mercX(lon), mercY(lat)];
export const fromMerc = ([x, y]) => [x * 360 - 180, (360 / Math.PI) * Math.atan(Math.exp((180 - y * 360) * Math.PI / 180)) - 90];

/** BNG corner of the grid and its size. */
export function gridFrame(meta) {
  return { e0: meta.XMIN, n1: meta.YMAX, e1: meta.XMIN + meta.NX * meta.C, n0: meta.YMAX - meta.NY * meta.C, nx: meta.NX, ny: meta.NY, c: meta.C };
}

/** The grid's outline as a BNG ring (for fitting the map and for the bundle boundary). */
export function gridRing(meta) {
  const f = gridFrame(meta);
  return [[f.e0, f.n1], [f.e1, f.n1], [f.e1, f.n0], [f.e0, f.n0]];
}

/**
 * A mesh over the grid. Each vertex carries its exact Web Mercator position
 * (relative to `origin`, for float precision) and its grid coordinate uv in 0..1
 * (u east, v south). 60 x 50 cells of about 2.5 km.
 */
export function gridMesh(meta, cols = 60, rows = 50) {
  const f = gridFrame(meta);
  const origin = toMerc(toWGS84([f.e0, f.n1]));
  const pos = new Float32Array((cols + 1) * (rows + 1) * 2);
  const uv = new Float32Array((cols + 1) * (rows + 1) * 2);
  let k = 0;
  for (let r = 0; r <= rows; r++) {
    for (let c = 0; c <= cols; c++) {
      const u = c / cols, v = r / rows;
      const m = toMerc(toWGS84([f.e0 + u * (f.e1 - f.e0), f.n1 - v * (f.n1 - f.n0)]));
      pos[k] = m[0] - origin[0]; pos[k + 1] = m[1] - origin[1];
      uv[k] = u; uv[k + 1] = v; k += 2;
    }
  }
  const index = new Uint16Array(cols * rows * 6);
  k = 0;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const a = r * (cols + 1) + c, b = a + 1, d = a + cols + 1, e = d + 1;
      index.set([a, d, b, b, d, e], k); k += 6;
    }
  }
  return { origin, pos, uv, index, cols, rows };
}

/** Grid cell under a map point [lon, lat], or null outside the grid. */
export function cellAt(meta, lonlat) {
  const [E, N] = toBNG(lonlat);
  const j = Math.floor((E - meta.XMIN) / meta.C), i = Math.floor((meta.YMAX - N) / meta.C);
  if (j < 0 || i < 0 || j >= meta.NX || i >= meta.NY) return null;
  return { i, j, index: i * meta.NX + j, E, N };
}

/** BNG polylines to GeoJSON lon/lat. */
export const lineToLL = line => line.map(toWGS84);
