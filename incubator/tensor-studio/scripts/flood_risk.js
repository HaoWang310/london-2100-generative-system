/* Tensor Studio · flood risk for a site.
 *
 * Reads the Environment Agency's present-day risk rasters (the same files the London map uses,
 * copied to assets/flood_risk/): Risk of Flooding from Surface Water (RoFSW) and from Rivers and
 * Sea (RoFRS), 25 m cells on one EPSG:3857 grid (E 460–600 km, N 110–250 km of the National Grid).
 * Each pixel's colour is an ordinal class: 1 very low < 0.1 %, 2 low 0.1–1 %, 3 medium 1–3.3 %,
 * 4 high ≥ 3.3 % a year (5 unavailable, read as none). For every 10 m cell of the site we keep the
 * HIGHER class of the two sources.
 *
 * floodForSite(D, base) → { grid: Uint8Array (row 0 south, as D.basis), covered, zones: {3: rings, 4: rings} }
 *   zones[k] = closed rings round the cells of class ≥ k (smoothed, small specks dropped),
 *   in D's local metres: the parts the streets avoid, and the shore they turn along.
 * © Environment Agency copyright and/or database right 2025. Open Government Licence v3.0.
 */
import { bngToWGS84 } from './site_builder.js?v=8.5.0';

const SOURCES = ['surface_water', 'rivers_sea'];
const COL = [[156, 221, 234, 1], [247, 211, 89, 2], [242, 157, 56, 3], [215, 55, 49, 4], [153, 156, 158, 5]];
const R = 6378137;
const merc = (lon, lat) => [R * lon * Math.PI / 180, R * Math.log(Math.tan(Math.PI / 4 + lat * Math.PI / 360))];

// Web Mercator coordinates of every cell: exact on a 9 × 9 lattice, bilinear between (sub-metre over a few km)
function mercGrid(D){
  const { nx, ny, cell } = D.grid, [OX, OY] = D.origin, K = 8, L = [];
  for (let j = 0; j <= K; j++) for (let i = 0; i <= K; i++){ const [lon, lat] = bngToWGS84(OX + (nx - 1) * cell * i / K, OY + (ny - 1) * cell * j / K); L.push(merc(lon, lat)); }
  const MX = new Float64Array(nx * ny), MY = new Float64Array(nx * ny);
  for (let r = 0; r < ny; r++) for (let c = 0; c < nx; c++){
    const u = c / Math.max(1, nx - 1) * K, v = r / Math.max(1, ny - 1) * K, i0 = Math.min(K - 1, Math.floor(u)), j0 = Math.min(K - 1, Math.floor(v)), fu = u - i0, fv = v - j0;
    const a = L[j0 * (K + 1) + i0], b = L[j0 * (K + 1) + i0 + 1], cc = L[(j0 + 1) * (K + 1) + i0], d = L[(j0 + 1) * (K + 1) + i0 + 1], k = r * nx + c;
    MX[k] = (a[0] * (1 - fu) + b[0] * fu) * (1 - fv) + (cc[0] * (1 - fu) + d[0] * fu) * fv;
    MY[k] = (a[1] * (1 - fu) + b[1] * fu) * (1 - fv) + (cc[1] * (1 - fu) + d[1] * fu) * fv; }
  return { MX, MY };
}

async function readSource(src, base, MX, MY, F){
  const meta = await (await fetch(base + src + '_metadata.json')).json(), g = meta.web_grid, [left, bottom, right, top] = g.bounds_m;
  const tw = g.width / 2, th = g.height / 2, N = MX.length, PX = new Int32Array(N), PY = new Int32Array(N);
  const win = [0, 1, 2, 3].map(() => ({ x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity, n: 0 })); let covered = 0;
  for (let k = 0; k < N; k++){
    const gx = Math.floor((MX[k] - left) / (right - left) * g.width), gy = Math.floor((top - MY[k]) / (top - bottom) * g.height);
    if (gx < 0 || gy < 0 || gx >= g.width || gy >= g.height){ PX[k] = -1; continue; }
    covered++; PX[k] = gx; PY[k] = gy; const w = win[(gy >= th ? 2 : 0) + (gx >= tw ? 1 : 0)];
    w.x0 = Math.min(w.x0, gx % tw); w.x1 = Math.max(w.x1, gx % tw); w.y0 = Math.min(w.y0, gy % th); w.y1 = Math.max(w.y1, gy % th); w.n++; }
  for (let t = 0; t < 4; t++){ const w = win[t]; if (!w.n) continue;
    const blob = await (await fetch(base + src + '_' + (t >> 1) + '-' + (t & 1) + '.webp')).blob();
    const sw = w.x1 - w.x0 + 1, sh = w.y1 - w.y0 + 1, bm = await createImageBitmap(blob, w.x0, w.y0, sw, sh);
    const oc = new OffscreenCanvas(sw, sh), cx = oc.getContext('2d', { willReadFrequently: true }); cx.drawImage(bm, 0, 0); bm.close();
    const px = cx.getImageData(0, 0, sw, sh).data, cache = new Map();
    for (let k = 0; k < N; k++){ if (PX[k] < 0) continue; const gx = PX[k], gy = PY[k]; if ((gy >= th ? 2 : 0) + (gx >= tw ? 1 : 0) !== t) continue;
      const n = ((gy % th - w.y0) * sw + (gx % tw - w.x0)) * 4; if (px[n + 3] < 100) continue;
      const key = (px[n] << 16) | (px[n + 1] << 8) | px[n + 2]; let cls = cache.get(key);
      if (cls === undefined){ let bd = Infinity; cls = 0; for (const [r, gg, b, c] of COL){ const dd = (px[n] - r) ** 2 + (px[n + 1] - gg) ** 2 + (px[n + 2] - b) ** 2; if (dd < bd){ bd = dd; cls = c; } } if (bd >= 1200 || cls === 5) cls = 0; cache.set(key, cls); }
      if (cls > F[k]) F[k] = cls; } }
  return covered / N;
}

function blur(a, nx, ny, sg){ const R_ = Math.ceil(sg * 2.5), k = []; let s = 0; for (let i = -R_; i <= R_; i++){ const w = Math.exp(-i * i / (2 * sg * sg)); k.push(w); s += w; } for (let i = 0; i < k.length; i++) k[i] /= s;
  const t = new Float32Array(a.length), o = new Float32Array(a.length), cl = (v, m) => v < 0 ? 0 : v > m ? m : v;
  for (let r = 0; r < ny; r++) for (let c = 0; c < nx; c++){ let w = 0; for (let i = -R_; i <= R_; i++) w += a[r * nx + cl(c + i, nx - 1)] * k[i + R_]; t[r * nx + c] = w; }
  for (let r = 0; r < ny; r++) for (let c = 0; c < nx; c++){ let w = 0; for (let i = -R_; i <= R_; i++) w += t[cl(r + i, ny - 1) * nx + c] * k[i + R_]; o[r * nx + c] = w; } return o; }
const ringArea = r => { let s = 0; for (let i = 1; i < r.length; i++) s += r[i - 1][0] * r[i][1] - r[i][0] * r[i - 1][1]; return Math.abs(s / 2); };

// closed rings round the cells of class ≥ minClass: marching squares on the smoothed 0/1 field, with a zero border
export function zoneRings(F, nx, ny, cell, minClass, minArea = 600){
  const W = nx + 2, H = ny + 2, I = new Float32Array(W * H);
  for (let r = 0; r < ny; r++) for (let c = 0; c < nx; c++) I[(r + 1) * W + c + 1] = F[r * nx + c] >= minClass ? 1 : 0;
  const S = blur(I, W, H, 0.9); for (let c = 0; c < W; c++){ S[c] = 0; S[(H - 1) * W + c] = 0; } for (let r = 0; r < H; r++){ S[r * W] = 0; S[r * W + W - 1] = 0; }
  const segs = [], at = (c, r) => [(c - 1) * cell, (r - 1) * cell];
  for (let r = 0; r < H - 1; r++) for (let c = 0; c < W - 1; c++){
    const v = [S[r * W + c], S[r * W + c + 1], S[(r + 1) * W + c + 1], S[(r + 1) * W + c]], P = [[c, r], [c + 1, r], [c + 1, r + 1], [c, r + 1]], pts = [];
    for (let e = 0; e < 4; e++){ const a = v[e], b = v[(e + 1) % 4]; if ((a < 0.5) !== (b < 0.5)){ const t = (0.5 - a) / (b - a), p = P[e], q = P[(e + 1) % 4]; pts.push(at(p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t)); } }
    if (pts.length === 2) segs.push(pts); else if (pts.length === 4){ segs.push([pts[0], pts[1]]); segs.push([pts[2], pts[3]]); } }
  const key = p => Math.round(p[0] * 10) + ',' + Math.round(p[1] * 10), ends = new Map(), used = new Uint8Array(segs.length), rings = [];
  segs.forEach((s, i) => { for (const p of s){ const k = key(p); if (!ends.has(k)) ends.set(k, []); ends.get(k).push(i); } });
  for (let i = 0; i < segs.length; i++){ if (used[i]) continue; used[i] = 1; const ring = [segs[i][0], segs[i][1]];
    for (;;){ const p = ring.at(-1), j = (ends.get(key(p)) || []).find(x => !used[x]); if (j === undefined) break; used[j] = 1; const s = segs[j]; ring.push(key(s[0]) === key(p) ? s[1] : s[0]); }
    if (ring.length > 3 && ringArea(ring) >= minArea) rings.push(ring.map(p => [Math.round(p[0] * 10) / 10, Math.round(p[1] * 10) / 10])); }
  return rings;
}

export async function floodForSite(D, base){
  const { nx, ny, cell } = D.grid, F = new Uint8Array(nx * ny), { MX, MY } = mercGrid(D);
  let covered = 0;
  for (const src of SOURCES) covered = Math.max(covered, await readSource(src, base, MX, MY, F));
  return { grid: F, covered, sources: 'max(RoFSW, RoFRS)', zones: { 3: zoneRings(F, nx, ny, cell, 3), 4: zoneRings(F, nx, ny, cell, 4) } };
}
