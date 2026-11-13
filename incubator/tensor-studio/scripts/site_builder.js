/* Tensor Studio · site builder.
 *
 * Builds the data object `D` that Tensor Studio v8's growth engine reads, for ANY
 * site drawn on the London map, instead of the one site that was baked in Python
 * (tf_app_v7.py). Pure functions: no DOM, no network, so it runs in a page, a worker
 * or Node (see test_tensor_studio_builder.mjs).
 *
 * Inputs (all WGS84 lng/lat):
 *   ring        the red site boundary (closed or open)
 *   roads       [{coords:[[lng,lat]...], cls, brunnel}]   OpenMapTiles `transportation`
 *   rails       [{coords}]                                at ground level only
 *   waters      [[ring, hole...], ...]                    OpenMapTiles `water` polygons
 *   waterways   [{coords, cls}]                           OpenMapTiles `waterway` lines
 *   buildings   [[ring, hole...], ...]
 *   elevation   (lng, lat) => metres | NaN               the host's OS Terrain 50 sampler
 *   wind        {year, hours}                             a weather year (Luton TMYx by default)
 *   clip        polygon-clipping module, or null          exact land = site − water (− buildings)
 *   keepBuildings  existing buildings become holes the streets go round
 *
 * Output D follows the baked format exactly (British National Grid metres, origin at
 * the frame's south-west corner, 10 m field grid with row 0 in the south, 5 m zone
 * bits with row 0 in the north, int16 base64 grids), so the engine runs unchanged.
 */

const PI = Math.PI;
const clamp = (a, b, c) => Math.max(b, Math.min(c, a));
const CELL = 10, ZC = 5;
export const MAX_SIDE_M = 3600;
export const MIN_AREA_M2 = 20000;

/* ---------------------------------------------------------------- WGS84 → OSGB36 / BNG */
// Ordnance Survey's 7-parameter Helmert (about 5 m accuracy) then Transverse Mercator on Airy 1830.
export function wgs84ToBNG(lon, lat){
  const d2r = PI / 180;
  // WGS84 geodetic → cartesian
  let a = 6378137, b = 6356752.314245, e2 = 1 - (b * b) / (a * a);
  let phi = lat * d2r, lam = lon * d2r;
  const nu0 = a / Math.sqrt(1 - e2 * Math.sin(phi) ** 2);
  const x1 = nu0 * Math.cos(phi) * Math.cos(lam), y1 = nu0 * Math.cos(phi) * Math.sin(lam), z1 = nu0 * (1 - e2) * Math.sin(phi);
  // Helmert WGS84 → OSGB36
  const tx = -446.448, ty = 125.157, tz = -542.060, s = 20.4894e-6;
  const rx = (-0.1502 / 3600) * d2r, ry = (-0.2470 / 3600) * d2r, rz = (-0.8421 / 3600) * d2r;
  const x2 = tx + (1 + s) * x1 - rz * y1 + ry * z1;
  const y2 = ty + rz * x1 + (1 + s) * y1 - rx * z1;
  const z2 = tz - ry * x1 + rx * y1 + (1 + s) * z1;
  // cartesian → Airy 1830 geodetic
  a = 6377563.396; b = 6356256.909; e2 = 1 - (b * b) / (a * a);
  const p = Math.hypot(x2, y2);
  phi = Math.atan2(z2, p * (1 - e2));
  for (let i = 0; i < 8; i++){ const nu = a / Math.sqrt(1 - e2 * Math.sin(phi) ** 2); phi = Math.atan2(z2 + e2 * nu * Math.sin(phi), p); }
  lam = Math.atan2(y2, x2);
  // Transverse Mercator (National Grid)
  const F0 = 0.9996012717, phi0 = 49 * d2r, lam0 = -2 * d2r, N0 = -100000, E0 = 400000;
  const n = (a - b) / (a + b), sp = Math.sin(phi), cp = Math.cos(phi), tp = Math.tan(phi);
  const nu = a * F0 / Math.sqrt(1 - e2 * sp * sp), rho = a * F0 * (1 - e2) / Math.pow(1 - e2 * sp * sp, 1.5), eta2 = nu / rho - 1;
  const dp = phi - phi0, sm = phi + phi0;
  const M = b * F0 * ((1 + n + 1.25 * n * n + 1.25 * n ** 3) * dp - (3 * n + 3 * n * n + 2.625 * n ** 3) * Math.sin(dp) * Math.cos(sm)
    + (1.875 * n * n + 1.875 * n ** 3) * Math.sin(2 * dp) * Math.cos(2 * sm) - (35 / 24) * n ** 3 * Math.sin(3 * dp) * Math.cos(3 * sm));
  const I = M + N0, II = nu / 2 * sp * cp, III = nu / 24 * sp * cp ** 3 * (5 - tp * tp + 9 * eta2), IIIA = nu / 720 * sp * cp ** 5 * (61 - 58 * tp * tp + tp ** 4);
  const IV = nu * cp, V = nu / 6 * cp ** 3 * (nu / rho - tp * tp), VI = nu / 120 * cp ** 5 * (5 - 18 * tp * tp + tp ** 4 + 14 * eta2 - 58 * tp * tp * eta2);
  const dl = lam - lam0;
  return [E0 + IV * dl + V * dl ** 3 + VI * dl ** 5, I + II * dl * dl + III * dl ** 4 + IIIA * dl ** 6];
}

// British National Grid → WGS84: Newton's method on the forward transform (converges to < 1 mm in a few steps)
export function bngToWGS84(E, N){
  let lon = -2 + (E - 400000) / 69000, lat = 49 + (N + 100000) / 111000;
  for (let i = 0; i < 8; i++){
    const [e, n] = wgs84ToBNG(lon, lat), h = 1e-6, [e1, n1] = wgs84ToBNG(lon + h, lat), [e2, n2] = wgs84ToBNG(lon, lat + h);
    const a = (e1 - e) / h, b = (e2 - e) / h, c = (n1 - n) / h, d = (n2 - n) / h, det = a * d - b * c, de = E - e, dn = N - n;
    lon += (d * de - b * dn) / det; lat += (-c * de + a * dn) / det;
    if (Math.abs(de) + Math.abs(dn) < 1e-4) break;
  }
  return [lon, lat];
}

/* ---------------------------------------------------------------- small geometry */
const closeRing = r => { const o = r.map(p => [p[0], p[1]]); if (o.length && (o[0][0] !== o.at(-1)[0] || o[0][1] !== o.at(-1)[1])) o.push([...o[0]]); return o; };
function ringArea(r){ let s = 0; for (let i = 1; i < r.length; i++) s += r[i - 1][0] * r[i][1] - r[i][0] * r[i - 1][1]; return s / 2; }
function inRing(p, r){ let ins = false; for (let i = 0, j = r.length - 1; i < r.length; j = i++){ const a = r[i], b = r[j];
  if ((a[1] > p[1]) !== (b[1] > p[1]) && p[0] < (b[0] - a[0]) * (p[1] - a[1]) / (b[1] - a[1]) + a[0]) ins = !ins; } return ins; }
function segX(a, b, c, d){ // intersection point of segments ab and cd, or null
  const r0 = b[0] - a[0], r1 = b[1] - a[1], s0 = d[0] - c[0], s1 = d[1] - c[1], den = r0 * s1 - r1 * s0; if (Math.abs(den) < 1e-12) return null;
  const t = ((c[0] - a[0]) * s1 - (c[1] - a[1]) * s0) / den, u = ((c[0] - a[0]) * r1 - (c[1] - a[1]) * r0) / den;
  return t >= 0 && t <= 1 && u >= 0 && u <= 1 ? [a[0] + t * r0, a[1] + t * r1] : null; }
function bboxOf(pts){ let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity; for (const p of pts){ x0 = Math.min(x0, p[0]); y0 = Math.min(y0, p[1]); x1 = Math.max(x1, p[0]); y1 = Math.max(y1, p[1]); } return [x0, y0, x1, y1]; }
const boxHit = (a, b) => a[0] <= b[2] && a[2] >= b[0] && a[1] <= b[3] && a[3] >= b[1];
const axisNorm = t => { let a = (t + PI / 2) % PI; if (a < 0) a += PI; return a - PI / 2; };   // a street axis, in [-π/2, π/2)
const r1 = v => Math.round(v * 10) / 10;
const lineLen = l => { let s = 0; for (let i = 1; i < l.length; i++) s += Math.hypot(l[i][0] - l[i - 1][0], l[i][1] - l[i - 1][1]); return s; };

/* ---------------------------------------------------------------- encoders (as the Python builder) */
function b64(bytes){
  if (typeof btoa === 'function'){ let s = ''; for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000)); return btoa(s); }
  return Buffer.from(bytes).toString('base64');
}
function enc16(arr, scale){ const out = new Uint8Array(arr.length * 2);
  for (let i = 0; i < arr.length; i++){ let x = Math.round(arr[i] * scale); x = clamp(x, -32768, 32767); if (x < 0) x += 65536; out[2 * i] = x & 255; out[2 * i + 1] = x >> 8; } return b64(out); }
function encBits(bits){ const out = new Uint8Array(Math.ceil(bits.length / 8)); for (let i = 0; i < bits.length; i++) if (bits[i]) out[i >> 3] |= 1 << (7 - (i & 7)); return b64(out); }

/* ---------------------------------------------------------------- distance field to segments, with their axes */
// Exact distance seeded along each segment, then propagated by nearest-segment labels (two raster sweeps, twice).
function segmentField(segs, nx, ny, cell){
  const N = nx * ny, D = new Float32Array(N).fill(1e9), L = new Int32Array(N).fill(-1);
  if (!segs.length) return { D: D.fill(32000), A: new Float32Array(N) };
  const dseg = (k, x, y) => { const [a, b] = segs[k], dx = b[0] - a[0], dy = b[1] - a[1], L2 = dx * dx + dy * dy || 1, t = clamp(((x - a[0]) * dx + (y - a[1]) * dy) / L2, 0, 1); return Math.hypot(x - a[0] - dx * t, y - a[1] - dy * t); };
  const tryK = (i, k, x, y) => { const d = dseg(k, x, y); if (d < D[i]){ D[i] = d; L[i] = k; } };
  segs.forEach(([a, b], k) => { const len = Math.hypot(b[0] - a[0], b[1] - a[1]), n = Math.max(1, Math.ceil(len / (cell * 0.5)));
    for (let s = 0; s <= n; s++){ const x = a[0] + (b[0] - a[0]) * s / n, y = a[1] + (b[1] - a[1]) * s / n, c0 = Math.round(x / cell), r0 = Math.round(y / cell);
      for (let r = r0 - 1; r <= r0 + 1; r++) for (let c = c0 - 1; c <= c0 + 1; c++) if (c >= 0 && r >= 0 && c < nx && r < ny) tryK(r * nx + c, k, c * cell, r * cell); } });
  const pass = (fwd) => { const rs = fwd ? 0 : ny - 1, re = fwd ? ny : -1, st = fwd ? 1 : -1;
    for (let r = rs; r !== re; r += st) for (let c = fwd ? 0 : nx - 1; c !== (fwd ? nx : -1); c += st){ const i = r * nx + c;
      for (const [dc, dr] of fwd ? [[-1, 0], [0, -1], [-1, -1], [1, -1]] : [[1, 0], [0, 1], [1, 1], [-1, 1]]){ const cc = c + dc, rr = r + dr; if (cc < 0 || rr < 0 || cc >= nx || rr >= ny) continue; const k = L[rr * nx + cc]; if (k >= 0 && k !== L[i]) tryK(i, k, c * cell, r * cell); } } };
  for (let it = 0; it < 2; it++){ pass(true); pass(false); }
  const A = new Float32Array(N); for (let i = 0; i < N; i++){ const k = L[i]; if (k < 0) continue; const [a, b] = segs[k]; A[i] = axisNorm(Math.atan2(b[1] - a[1], b[0] - a[0])); }
  return { D, A };
}
const segsOf = lines => { const out = []; for (const l of lines) for (let i = 1; i < l.length; i++) if (l[i][0] !== l[i - 1][0] || l[i][1] !== l[i - 1][1]) out.push([l[i - 1], l[i]]); return out; };

function blur(a, nx, ny, sg){ if (sg < 0.3) return a; const R = Math.ceil(sg * 2.5), k = []; let s = 0; for (let i = -R; i <= R; i++){ const w = Math.exp(-i * i / (2 * sg * sg)); k.push(w); s += w; } for (let i = 0; i < k.length; i++) k[i] /= s;
  const t = new Float32Array(a.length), o = new Float32Array(a.length);
  for (let r = 0; r < ny; r++) for (let c = 0; c < nx; c++){ let w = 0; for (let i = -R; i <= R; i++) w += a[r * nx + clamp(c + i, 0, nx - 1)] * k[i + R]; t[r * nx + c] = w; }
  for (let r = 0; r < ny; r++) for (let c = 0; c < nx; c++){ let w = 0; for (let i = -R; i <= R; i++) w += t[clamp(r + i, 0, ny - 1) * nx + c] * k[i + R]; o[r * nx + c] = w; } return o; }

/* ---------------------------------------------------------------- contours (marching squares, chained) */
function contours(Z, nx, ny, cell, levels){ const out = [];
  for (const z of levels){ const segs = [];
    for (let r = 0; r < ny - 1; r++) for (let c = 0; c < nx - 1; c++){ const v = [Z[r * nx + c], Z[r * nx + c + 1], Z[(r + 1) * nx + c + 1], Z[(r + 1) * nx + c]];
      const P = [[c, r], [c + 1, r], [c + 1, r + 1], [c, r + 1]], pts = [];
      for (let e = 0; e < 4; e++){ const a = v[e], b = v[(e + 1) % 4]; if ((a < z) !== (b < z)){ const t = (z - a) / (b - a), p = P[e], q = P[(e + 1) % 4]; pts.push([(p[0] + (q[0] - p[0]) * t) * cell, (p[1] + (q[1] - p[1]) * t) * cell]); } }
      if (pts.length === 2) segs.push(pts); else if (pts.length === 4){ segs.push([pts[0], pts[1]]); segs.push([pts[2], pts[3]]); } }
    // chain segments sharing end points
    const key = p => Math.round(p[0] * 10) + ',' + Math.round(p[1] * 10), ends = new Map(), used = new Uint8Array(segs.length);
    segs.forEach((s, i) => { for (const p of s){ const k = key(p); if (!ends.has(k)) ends.set(k, []); ends.get(k).push(i); } });
    for (let i = 0; i < segs.length; i++){ if (used[i]) continue; used[i] = 1; const line = [segs[i][0], segs[i][1]];
      for (const head of [false, true]){ for (;;){ const p = head ? line[0] : line.at(-1), cand = (ends.get(key(p)) || []).find(j => !used[j]); if (cand === undefined) break; used[cand] = 1;
        const s = segs[cand], q = key(s[0]) === key(p) ? s[1] : s[0]; if (head) line.unshift(q); else line.push(q); } }
      if (line.length > 2) out.push({ z, p: line.map(p => [r1(p[0]), r1(p[1])]) }); } }
  return out; }

/* ---------------------------------------------------------------- the builder */
const MAJOR = /^(motorway|trunk|primary|secondary|tertiary)$/;
const STREET = /^(motorway|trunk|primary|secondary|tertiary|minor|residential|unclassified|living_street)$/;
const NARROW_WATER = /^(stream|ditch|drain|brook|canal|river)$/;
const WINDS = [[0, 'N', 'across'], [45, 'NE', 'across'], [90, 'E', 'across'], [135, 'SE', 'along'], [180, 'S', 'along'], [225, 'SW', 'along'], [270, 'W', 'along'], [315, 'NW', 'across']];

export function buildTensorSite({ ring, roads = [], rails = [], waters = [], waterways = [], buildings = [], elevation = null, wind, clip = null, keepBuildings = false }){
  if (!ring || ring.length < 3) throw new Error('Site boundary needs at least three points');
  if (!wind?.year?.length || !wind?.hours?.u?.length) throw new Error('Weather year missing');
  const warnings = [];
  // 1. project everything to British National Grid
  const toB = ([lng, lat]) => wgs84ToBNG(lng, lat);
  const siteB = closeRing(ring).map(toB);
  const [e0, n0, e1, n1] = bboxOf(siteB), side = Math.max(e1 - e0, n1 - n0), area = Math.abs(ringArea(siteB));
  if (side > MAX_SIDE_M) throw new Error('Site is ' + (side / 1000).toFixed(1) + ' km across; Tensor Studio runs up to ' + (MAX_SIDE_M / 1000).toFixed(1) + ' km. Draw a smaller site.');
  if (area < MIN_AREA_M2) throw new Error('Site is ' + (area / 1e4).toFixed(1) + ' ha; Tensor Studio needs at least ' + (MIN_AREA_M2 / 1e4) + ' ha.');
  const margin = clamp(0.15 * side, 100, 280);
  const OX = Math.floor((e0 - margin) / CELL) * CELL, OY = Math.floor((n0 - margin) / CELL) * CELL;
  const w = r1(e1 + margin - OX), h = r1(n1 + margin - OY), nx = Math.ceil(w / CELL), ny = Math.ceil(h / CELL), N = nx * ny;
  const loc = p => { const q = toB(p); return [r1(q[0] - OX), r1(q[1] - OY)]; };
  const frame = [-60, -60, w + 60, h + 60];
  const site = siteB.map(q => [r1(q[0] - OX), r1(q[1] - OY)]);
  const lines = arr => arr.map(f => ({ ...f, pts: (f.coords || []).map(loc) })).filter(f => f.pts.length > 1 && boxHit(bboxOf(f.pts), frame));
  const seen = new Set(), polys = arr => arr.map(rings => rings.map(r => closeRing(r).map(loc))).filter(pg => {
    if (!pg[0] || pg[0].length < 4 || !boxHit(bboxOf(pg[0]), frame)) return false;
    const k = JSON.stringify(pg[0].slice(0, 6)) + pg[0].length; if (seen.has(k)) return false; seen.add(k); return true; });
  const R = lines(roads), RL = lines(rails), WW = lines(waterways), WA = polys(waters), BL = polys(buildings);

  // 2. the land: the site, less the water (and, if asked, the buildings)
  const sBox = bboxOf(site);
  const cutters = WA.filter(pg => Math.abs(ringArea(pg[0])) >= 150 && boxHit(bboxOf(pg[0]), sBox));
  if (keepBuildings) cutters.push(...BL.filter(pg => boxHit(bboxOf(pg[0]), sBox)));
  let pieces = [], cut = [];
  if (clip && cutters.length){
    try { const mp = clip.difference([site], ...cutters.map(pg => pg));
      pieces = mp.map(pg => ({ outer: pg[0], holes: pg.slice(1) })); }
    catch (err){ warnings.push('Exact water cut failed (' + (err?.message || err) + '); water inside the site kept as holes only'); pieces = []; }
  }
  if (!pieces.length){
    // without the exact cut: shapes wholly inside become holes; shapes across the boundary are taken out of the
    // engine's land mask instead (D.cut), so no street enters them
    const inside = pg => pg[0].every(p => inRing(p, site));
    const holes = cutters.filter(inside).map(pg => pg[0]);
    cut = cutters.filter(pg => !inside(pg)).map(pg => pg.map(r => r.map(q => [r1(q[0]), r1(q[1])])));
    pieces = [{ outer: site, holes }];
  }
  pieces = pieces.map(p => ({ outer: p.outer.map(q => [r1(q[0]), r1(q[1])]), holes: p.holes.map(hh => hh.map(q => [r1(q[0]), r1(q[1])])) }))
    .filter(p => Math.abs(ringArea(p.outer)) - p.holes.reduce((s, hh) => s + Math.abs(ringArea(hh)), 0) >= 400)
    .map(p => ({ parcel: 0, outer: p.outer, holes: p.holes, wide: true }));
  if (!pieces.length) throw new Error('No land is left in the site once the water is taken out');
  const inLand = (x, y) => pieces.some(p => inRing([x, y], p.outer) && !p.holes.some(hh => inRing([x, y], hh)));

  // 3. anchors: where existing streets cross the land's edge (streets carry the network on)
  const anchors = [];
  const addAnchor = (x, y) => { if (anchors.every(a => Math.hypot(a.x - x, a.y - y) > 35)) anchors.push({ id: anchors.length, parcel: 0, x: r1(x), y: r1(y) }); };
  const streetLines = R.filter(f => STREET.test(f.cls || '') && f.brunnel !== 'tunnel');
  for (const f of streetLines.filter(f => MAJOR.test(f.cls)).concat(streetLines.filter(f => !MAJOR.test(f.cls)))){
    const fb = bboxOf(f.pts);
    for (const p of pieces){ if (!boxHit(fb, bboxOf(p.outer))) continue;
      for (let i = 1; i < f.pts.length; i++) for (let j = 1; j < p.outer.length; j++){ const q = segX(f.pts[i - 1], f.pts[i], p.outer[j - 1], p.outer[j]); if (q) addAnchor(q[0], q[1]); } } }
  if (anchors.length < 3){ // no streets reach the edge: spread anchors round the largest piece
    warnings.push('Few existing streets meet the boundary; anchors were spread along the edge');
    const big = pieces.reduce((b, p) => Math.abs(ringArea(p.outer)) > Math.abs(ringArea(b.outer)) ? p : b), per = lineLen(big.outer), n = Math.max(4, Math.round(per / 300));
    let acc = 0, next = 0, k = 0;
    for (let i = 1; i < big.outer.length && k < n; i++){ const a = big.outer[i - 1], b = big.outer[i], L = Math.hypot(b[0] - a[0], b[1] - a[1]);
      while (next <= acc + L && k < n){ const t = (next - acc) / (L || 1); addAnchor(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t); k++; next = k * per / n; } acc += L; } }

  // 4. the 5 m zones: narrow watercourses (crossed square, on culverts) and rail at ground level (crossed square, on bridges)
  const ZW = Math.ceil(w / ZC), ZH = Math.ceil(h / ZC);
  const paint = (lns, half) => { const bits = new Uint8Array(ZW * ZH); let any = false;
    for (const l of lns) for (let i = 1; i < l.length; i++){ const a = l[i - 1], b = l[i], len = Math.hypot(b[0] - a[0], b[1] - a[1]), n = Math.max(1, Math.ceil(len / 2));
      for (let s = 0; s <= n; s++){ const x = a[0] + (b[0] - a[0]) * s / n, y = a[1] + (b[1] - a[1]) * s / n, R_ = Math.ceil(half / ZC);
        const c0 = Math.floor(x / ZC), rr0 = Math.floor((h - y) / ZC);
        for (let r = rr0 - R_; r <= rr0 + R_; r++) for (let c = c0 - R_; c <= c0 + R_; c++){ if (c < 0 || r < 0 || c >= ZW || r >= ZH) continue;
          if (Math.hypot((c + 0.5) * ZC - x, h - (r + 0.5) * ZC - y) <= half){ bits[r * ZW + c] = 1; any = true; } } } }
    return any ? bits : null; };
  const streamLines = WW.filter(f => NARROW_WATER.test(f.cls || 'stream') && f.brunnel !== 'tunnel').map(f => f.pts);
  const railLines = RL.filter(f => !f.brunnel || f.brunnel === 'ford').map(f => f.pts);
  const zoneBits = paint(streamLines, 2.6) || new Uint8Array(ZW * ZH), railBits = paint(railLines, 12);

  // 5. the field's parts on the 10 m grid (row 0 in the south)
  //    terrain: elevation sampled through an affine inverse of the projection (exact enough over a few km)
  const Z = new Float32Array(N);
  let zOK = 0;
  if (elevation){
    const sample = closeRing(ring).slice(0, -1).concat([[Math.min(...ring.map(p => p[0])), Math.min(...ring.map(p => p[1]))], [Math.max(...ring.map(p => p[0])), Math.max(...ring.map(p => p[1]))]]);
    const fit = affineFit(sample.map(p => { const q = toB(p); return [q[0] - OX, q[1] - OY]; }), sample);
    for (let r = 0; r < ny; r++) for (let c = 0; c < nx; c++){ const [lng, lat] = fit(c * CELL, r * CELL), z = elevation(lng, lat); Z[r * nx + c] = z; if (Number.isFinite(z)) zOK++; }
  }
  if (zOK < 0.5 * N){ warnings.push('No usable elevation here: the contour part of the field is off'); Z.fill(0); }
  else { let m = 0, k = 0; for (const z of Z) if (Number.isFinite(z)){ m += z; k++; } m /= k; for (let i = 0; i < N; i++) if (!Number.isFinite(Z[i])) Z[i] = m; }
  const Zs = blur(Z, nx, ny, 1.5), cA = new Float32Array(N), sl = new Float32Array(N);
  for (let r = 0; r < ny; r++) for (let c = 0; c < nx; c++){ const i = r * nx + c, gx = (Zs[r * nx + Math.min(c + 1, nx - 1)] - Zs[r * nx + Math.max(c - 1, 0)]) / (2 * CELL), gy = (Zs[Math.min(r + 1, ny - 1) * nx + c] - Zs[Math.max(r - 1, 0) * nx + c]) / (2 * CELL);
    sl[i] = Math.hypot(gx, gy); cA[i] = axisNorm(Math.atan2(gy, gx) + PI / 2); }
  const land10 = new Uint8Array(N); for (let r = 0; r < ny; r++) for (let c = 0; c < nx; c++) land10[r * nx + c] = inLand(c * CELL, r * CELL) ? 1 : 0;
  let ms = 0, mk = 0; for (let i = 0; i < N; i++) if (land10[i]){ ms += sl[i]; mk++; } ms = mk ? ms / mk : 0;
  // weights as baked (mean about 1), damped on flat ground: under 0.8 % mean slope the contour pulls proportionally less
  const cW = new Float32Array(N); for (let i = 0; i < N; i++) cW[i] = clamp(sl[i] / Math.max(ms, 0.008), 0.2, 2.6);
  if (ms < 0.008 && zOK >= 0.5 * N) warnings.push('Flat ground (mean slope ' + (100 * ms).toFixed(2) + ' %): the contour pulls weakly here');
  const edge = segmentField(segsOf(pieces.flatMap(p => [p.outer, ...p.holes])), nx, ny, CELL);
  const strm = segmentField(segsOf(streamLines), nx, ny, CELL);
  const rail = railBits ? segmentField(segsOf(railLines), nx, ny, CELL) : null;

  // 6. the winds: for each of 8 directions, strong on the side it comes in, fading as it travels over the land (L = 600 m)
  //    (the baked version also used the Global Wind Atlas' local speeds; here the speed is the weather year's alone)
  const dirs = WINDS.map(([frm, name, job]) => {
    const ux = Math.round(Math.sin(frm * PI / 180)), uy = Math.round(Math.cos(frm * PI / 180)), step = Math.hypot(ux, uy) * CELL, F = new Float32Array(N);
    const rOrder = uy > 0 ? [ny - 1, -1, -1] : [0, ny, 1], cOrder = ux > 0 ? [nx - 1, -1, -1] : [0, nx, 1];
    for (let r = rOrder[0]; r !== rOrder[1]; r += rOrder[2]) for (let c = cOrder[0]; c !== cOrder[1]; c += cOrder[2]){ const i = r * nx + c; if (!land10[i]) continue;
      const rr = r + uy, cc = c + ux; F[i] = (rr >= 0 && cc >= 0 && rr < ny && cc < nx ? F[rr * nx + cc] : 0) + step; }
    const S = new Float32Array(N), rel = new Float32Array(N);
    for (let i = 0; i < N; i++){ const f = Math.exp(-F[i] / 600); rel[i] = 0.25 + 1.3 * f; S[i] = 1.9 * rel[i] * rel[i]; }
    return { frm, name, job, S: enc16(blur(S, nx, ny, 2), 1e3), rel: enc16(rel, 1e4) }; });

  // 7. contours for the drawing, 1 m (or 2 / 5 m on steeper ground), labelled on the index lines
  let zl = Infinity, zh = -Infinity; for (const z of Zs){ zl = Math.min(zl, z); zh = Math.max(zh, z); }
  const step = zh - zl < 15 ? 1 : zh - zl < 40 ? 2 : 5, lv = []; for (let z = Math.ceil(zl / step) * step; z <= zh; z += step) lv.push(z);
  const cont = zOK >= 0.5 * N && lv.length < 120 ? contours(Zs, nx, ny, CELL, lv) : [];
  const labels = [];
  for (const c of cont){ if (c.z % 5 !== 0 && step < 5 && cont.length > 6) continue; const L = lineLen(c.p); if (L < 160) continue;
    for (let at = 120, acc = 0, i = 1; i < c.p.length; i++){ const a = c.p[i - 1], b = c.p[i], s = Math.hypot(b[0] - a[0], b[1] - a[1]); acc += s;
      if (acc >= at){ labels.push([r1(a[0]), r1(a[1]), +Math.atan2(b[1] - a[1], b[0] - a[0]).toFixed(3), c.z + ' m']); at += 450; } } }

  // 8. context (drawing only)
  const prim = R.filter(f => MAJOR.test(f.cls || '')).map(f => f.pts), lanes = R.filter(f => !MAJOR.test(f.cls || '') && f.cls !== 'path').map(f => f.pts);
  const D = {
    origin: [OX, OY], w, h, grid: { nx, ny, cell: CELL },
    basis: { cA: enc16(cA, 1e4), cW: enc16(cW, 1e3), eD: enc16(edge.D, 1), eA: enc16(edge.A, 1e4), sD: enc16(strm.D, 1), sA: enc16(strm.A, 1e4),
      ...(rail ? { rD: enc16(rail.D, 1), rA: enc16(rail.A, 1e4) } : {}) },
    dirs, year: wind.year, hours: wind.hours,
    zone: { c: ZC, W: ZW, H: ZH, bits: encBits(zoneBits), ...(railBits ? { rail: encBits(railBits) } : {}) },
    pieces, cut, anchors, attract: { main: [], sec: [] }, contours: cont, labels,
    ctx: { water: WA, room: [], streams: WW.map(f => f.pts), urban: [], bld: BL, lanes, prim, rib: [], parcels: [] },
    fixed: { link: [], bridges: [], streets: [] },
    edges: { road: pieces.map(p => p.outer), shore: pieces.flatMap(p => p.holes), shared: [] },
    station: { cells: [], foot: [], street: [] },
    site: { ring: closeRing(ring), areaHa: +(area / 1e4).toFixed(2), sideM: Math.round(side), elevation: zOK >= 0.5 * N ? [+zl.toFixed(1), +zh.toFixed(1)] : null, meanSlopePct: +(100 * ms).toFixed(2) }
  };
  const meta = { areaHa: D.site.areaHa, sideM: D.site.sideM, grid: [nx, ny], pieces: pieces.length, holes: pieces.reduce((s, p) => s + p.holes.length, 0), anchors: anchors.length,
    buildings: BL.length, roads: R.length, waterways: WW.length, rails: railLines.length, contours: cont.length, elevation: D.site.elevation, warnings };
  return { D, meta };
}

// least-squares affine map from local BNG metres back to lng/lat
function affineFit(xy, ll){ const n = xy.length, A = [[0, 0, 0], [0, 0, 0], [0, 0, 0]], bx = [0, 0, 0], by = [0, 0, 0];
  for (let k = 0; k < n; k++){ const v = [xy[k][0], xy[k][1], 1]; for (let i = 0; i < 3; i++){ for (let j = 0; j < 3; j++) A[i][j] += v[i] * v[j]; bx[i] += v[i] * ll[k][0]; by[i] += v[i] * ll[k][1]; } }
  const solve = b => { const M = A.map((r, i) => [...r, b[i]]);
    for (let i = 0; i < 3; i++){ let p = i; for (let j = i + 1; j < 3; j++) if (Math.abs(M[j][i]) > Math.abs(M[p][i])) p = j; [M[i], M[p]] = [M[p], M[i]];
      for (let j = 0; j < 3; j++) if (j !== i){ const f = M[j][i] / M[i][i]; for (let k = i; k < 4; k++) M[j][k] -= f * M[i][k]; } }
    return M.map((r, i) => r[3] / r[i]); };
  const cx = solve(bx), cy = solve(by);
  return (x, y) => [cx[0] * x + cx[1] * y + cx[2], cy[0] * x + cy[1] * y + cy[2]]; }
