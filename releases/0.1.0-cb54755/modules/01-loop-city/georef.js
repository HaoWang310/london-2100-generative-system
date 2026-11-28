// 01 · Loop City step 1 — where the model's frame sits on the map.
//
// The step 1 page works in British National Grid (EPSG:27700): its sheet, the
// mould's grid and the growth grid are all north-up in grid metres, inside one
// frame { e0, e1, n0, n1 } (the outer edge of the outer cells). The map is Web
// Mercator, whose north is 0.6 degrees off grid north at the frame's west edge
// and 2.3 degrees off at its east edge. A picture stretched from its four
// corners would be off by up to about 900 m. So each picture is drawn through
// a fine mesh whose every vertex is projected exactly (shared/geo-core: OS
// Transverse Mercator + Helmert, about 2-5 m); inside one mesh cell the error
// of linear interpolation is 0.3 m at most (tests/module.test.mjs measures it).
// The same method as the former growth simulator's georef.js (modules/01-growth-simulator, removed 26 Nov 2026), written for a frame.

import { toWGS84, toBNG } from '../../shared/geo-core/index.js?v=cb54755';

/** The frame of the step 1 page (CFG.map.extentBNG). tests/ checks it against the page itself. */
export const FRAME = Object.freeze({ e0: 452754.1, e1: 602766.4806, n0: 123480.995, n1: 246493.2 });

/** Web Mercator, in MapLibre's 0..1 world units (MercatorCoordinate.fromLngLat). */
export const mercX = lon => (180 + lon) / 360;
export const mercY = lat => (180 - (180 / Math.PI) * Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360))) / 360;
export const toMerc = ([lon, lat]) => [mercX(lon), mercY(lat)];
export const fromMerc = ([x, y]) => [x * 360 - 180, (360 / Math.PI) * Math.atan(Math.exp((180 - y * 360) * Math.PI / 180)) - 90];

/** The frame's outline as a BNG ring (for fitting the map and for the bundle boundary). */
export const frameRing = f => [[f.e0, f.n1], [f.e1, f.n1], [f.e1, f.n0], [f.e0, f.n0]];

/**
 * A mesh over the frame. Each vertex carries its exact Web Mercator position
 * (relative to `origin`, for float precision) and its picture coordinate uv in
 * 0..1 (u east, v south). 60 x 50 cells of about 2.5 km.
 */
export function frameMesh(f, cols = 60, rows = 50) {
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

/** Where the mesh puts a BNG point, in Web Mercator world units: the two triangles of its mesh cell, as the GPU does it. */
export function meshPosition(mesh, f, [E, N]) {
  const u = (E - f.e0) / (f.e1 - f.e0), v = (f.n1 - N) / (f.n1 - f.n0);
  const c = Math.min(mesh.cols - 1, Math.max(0, Math.floor(u * mesh.cols))), r = Math.min(mesh.rows - 1, Math.max(0, Math.floor(v * mesh.rows)));
  const fu = u * mesh.cols - c, fv = v * mesh.rows - r;
  const at = (rr, cc) => { const i = (rr * (mesh.cols + 1) + cc) * 2; return [mesh.pos[i], mesh.pos[i + 1]]; };
  const a = at(r, c), b = at(r, c + 1), d = at(r + 1, c), e = at(r + 1, c + 1);
  // triangles (a, d, b) and (b, d, e), as in the index buffer
  const p = fu + fv <= 1
    ? [a[0] + (b[0] - a[0]) * fu + (d[0] - a[0]) * fv, a[1] + (b[1] - a[1]) * fu + (d[1] - a[1]) * fv]
    : [e[0] + (d[0] - e[0]) * (1 - fu) + (b[0] - e[0]) * (1 - fv), e[1] + (d[1] - e[1]) * (1 - fu) + (b[1] - e[1]) * (1 - fv)];
  return [p[0] + mesh.origin[0], p[1] + mesh.origin[1]];
}

/** BNG polylines to GeoJSON lon/lat. */
export const lineToLL = line => line.map(p => toWGS84([p[0], p[1]]));

/** A GeoJSON FeatureCollection in BNG metres (as the engine gives them) to lon/lat, every vertex projected exactly. */
export function toLonLat(fc) {
  const geom = g => {
    if (!g) return g;
    const t = g.type, c = g.coordinates;
    if (t === 'Point') return { type: t, coordinates: toWGS84([c[0], c[1]]) };
    if (t === 'LineString' || t === 'MultiPoint') return { type: t, coordinates: lineToLL(c) };
    if (t === 'Polygon' || t === 'MultiLineString') return { type: t, coordinates: c.map(lineToLL) };
    if (t === 'MultiPolygon') return { type: t, coordinates: c.map(p => p.map(lineToLL)) };
    return g;
  };
  return { type: 'FeatureCollection', features: (fc?.features || []).map(f => ({ type: 'Feature', properties: { ...(f.properties || {}) }, geometry: geom(f.geometry) })) };
}

export { toWGS84, toBNG };
