/* Tensor Studio · layer 1 of the climate-terrain-wind-flood logic: the environmental fields.
 *
 * environmentFields(D) → { Z, slope, Q, V, Cw, C, stats } on D's 10 m grid (row 0 south, as D.basis):
 *   Z      elevation, m — from D.elev when the site builder stored it (OS Terrain 50), otherwise rebuilt
 *          from D.contours (the station P2 example carries 1 m contours from the EA LIDAR, not a raster)
 *   slope  rise over run
 *   Q      where rain gathers: D8 flow accumulation on the depression-filled surface, 0–1 on a log scale
 *   V      ventilation: summer (Jun–Aug) wind energy reaching each cell, all eight directions, 0–1
 *   Cw     cold-wind exposure: winter (Dec–Feb) wind energy from north to east (N, NE, E), 0–1
 *   C      climate comfort, C = 0.6·(1 − Cw) + 0.4·V
 * Wind energy per direction = share × speed² for the season (D.year), spread over the site with that
 * direction's strength grid (D.dirs[k].S, strong where the wind comes in, fading over the land).
 * Pure: no DOM, so it runs in the page or in Node (test_env_fields.mjs).
 */

const clamp = (a, b, c) => Math.max(b, Math.min(c, a));

function dec16(s, scale){
  const bin = typeof atob === 'function' ? atob(s) : Buffer.from(s, 'base64').toString('binary');
  const n = bin.length >> 1, out = new Float32Array(n);
  for (let i = 0; i < n; i++){ let v = bin.charCodeAt(2 * i) | (bin.charCodeAt(2 * i + 1) << 8); if (v > 32767) v -= 65536; out[i] = v / scale; }
  return out;
}
function blur(a, nx, ny, sg){ if (sg < 0.3) return a; const R = Math.ceil(sg * 2.5), k = []; let s = 0; for (let i = -R; i <= R; i++){ const w = Math.exp(-i * i / (2 * sg * sg)); k.push(w); s += w; } for (let i = 0; i < k.length; i++) k[i] /= s;
  const t = new Float32Array(a.length), o = new Float32Array(a.length);
  for (let r = 0; r < ny; r++) for (let c = 0; c < nx; c++){ let w = 0; for (let i = -R; i <= R; i++) w += a[r * nx + clamp(c + i, 0, nx - 1)] * k[i + R]; t[r * nx + c] = w; }
  for (let r = 0; r < ny; r++) for (let c = 0; c < nx; c++){ let w = 0; for (let i = -R; i <= R; i++) w += t[clamp(r + i, 0, ny - 1) * nx + c] * k[i + R]; o[r * nx + c] = w; } return o; }

// elevation from contour lines: burn them into the grid, spread outwards, then relax (Laplace) between them
export function elevationFromContours(contours, nx, ny, cell){
  const N = nx * ny, sum = new Float64Array(N), cnt = new Uint16Array(N);
  for (const c of contours || []) for (let i = 1; i < c.p.length; i++){ const a = c.p[i - 1], b = c.p[i], L = Math.hypot(b[0] - a[0], b[1] - a[1]), n = Math.max(1, Math.ceil(L / (cell * 0.4)));
    for (let s = 0; s <= n; s++){ const x = a[0] + (b[0] - a[0]) * s / n, y = a[1] + (b[1] - a[1]) * s / n, cc = Math.round(x / cell), rr = Math.round(y / cell);
      if (cc < 0 || rr < 0 || cc >= nx || rr >= ny) continue; const k = rr * nx + cc; sum[k] += c.z; cnt[k]++; } }
  const Z = new Float32Array(N), fixed = new Uint8Array(N), q = new Int32Array(N); let head = 0, tail = 0;
  for (let k = 0; k < N; k++) if (cnt[k]){ Z[k] = sum[k] / cnt[k]; fixed[k] = 1; q[tail++] = k; }
  if (!tail) return null;
  const seen = fixed.slice();
  while (head < tail){ const k = q[head++], r = (k / nx) | 0, c = k % nx;   // nearest-contour start, breadth first
    for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]){ const cc = c + dc, rr = r + dr; if (cc < 0 || rr < 0 || cc >= nx || rr >= ny) continue; const j = rr * nx + cc; if (seen[j]) continue; seen[j] = 1; Z[j] = Z[k]; q[tail++] = j; } }
  const T = new Float32Array(N);
  for (let it = 0; it < 240; it++){   // Jacobi relaxation: smooth surfaces between the lines, the lines held
    for (let r = 0; r < ny; r++) for (let c = 0; c < nx; c++){ const k = r * nx + c; if (fixed[k]){ T[k] = Z[k]; continue; }
      T[k] = (Z[r * nx + Math.max(0, c - 1)] + Z[r * nx + Math.min(nx - 1, c + 1)] + Z[Math.max(0, r - 1) * nx + c] + Z[Math.min(ny - 1, r + 1) * nx + c]) / 4; }
    Z.set(T); }
  return blur(Z, nx, ny, 1);
}

// D8 flow accumulation after a priority-flood fill (Barnes et al. 2014, with a small epsilon so flats drain)
export function flowAccumulation(Z, nx, ny, cell){
  const N = nx * ny, F = Float32Array.from(Z), done = new Uint8Array(N), EPS = 1e-4;
  // binary heap on F
  const H = new Int32Array(N); let hn = 0;
  const up = i => { while (i){ const p = (i - 1) >> 1; if (F[H[p]] <= F[H[i]]) break; [H[p], H[i]] = [H[i], H[p]]; i = p; } };
  const down = i => { for (;;){ const l = 2 * i + 1, r = l + 1; let m = i; if (l < hn && F[H[l]] < F[H[m]]) m = l; if (r < hn && F[H[r]] < F[H[m]]) m = r; if (m === i) break; [H[m], H[i]] = [H[i], H[m]]; i = m; } };
  const push = k => { H[hn++] = k; up(hn - 1); }, pop = () => { const k = H[0]; H[0] = H[--hn]; down(0); return k; };
  for (let c = 0; c < nx; c++){ for (const r of [0, ny - 1]){ const k = r * nx + c; if (!done[k]){ done[k] = 1; push(k); } } }
  for (let r = 1; r < ny - 1; r++) for (const c of [0, nx - 1]){ const k = r * nx + c; if (!done[k]){ done[k] = 1; push(k); } }
  const order = new Int32Array(N); let on = 0;
  const NB = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
  while (hn){ const k = pop(); order[on++] = k; const r = (k / nx) | 0, c = k % nx;
    for (const [dc, dr] of NB){ const cc = c + dc, rr = r + dr; if (cc < 0 || rr < 0 || cc >= nx || rr >= ny) continue; const j = rr * nx + cc; if (done[j]) continue; done[j] = 1;
      if (F[j] <= F[k]) F[j] = F[k] + EPS; push(j); } }
  // receivers: steepest descent; every cell drains, as the fill guarantees a lower neighbour or the edge
  const A = new Float32Array(N).fill(1);
  for (let o = on - 1; o >= 0; o--){ const k = order[o], r = (k / nx) | 0, c = k % nx; let best = -1, bs = 0;
    for (const [dc, dr] of NB){ const cc = c + dc, rr = r + dr; if (cc < 0 || rr < 0 || cc >= nx || rr >= ny) continue; const j = rr * nx + cc, s = (F[k] - F[j]) / Math.hypot(dc, dr); if (s > bs){ bs = s; best = j; } }
    if (best >= 0) A[best] += A[k]; }
  return { A, filled: F };
}

// 1 where a 10 m cell centre is on the land (pieces less their holes)
export function landMaskOf(D){ const { nx, ny, cell } = D.grid, M = new Uint8Array(nx * ny);
  const inRing = (x, y, r) => { let ins = false; for (let i = 0, j = r.length - 1; i < r.length; j = i++){ const a = r[i], b = r[j]; if ((a[1] > y) !== (b[1] > y) && x < (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]) + a[0]) ins = !ins; } return ins; };
  const box = r => { let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity; for (const p of r){ x0 = Math.min(x0, p[0]); y0 = Math.min(y0, p[1]); x1 = Math.max(x1, p[0]); y1 = Math.max(y1, p[1]); } return [x0, y0, x1, y1]; };
  for (const p of D.pieces || []){ const [x0, y0, x1, y1] = box(p.outer);
    for (let r = Math.max(0, Math.floor(y0 / cell)); r <= Math.min(ny - 1, Math.ceil(y1 / cell)); r++) for (let c = Math.max(0, Math.floor(x0 / cell)); c <= Math.min(nx - 1, Math.ceil(x1 / cell)); c++){
      const x = c * cell, y = r * cell; if (inRing(x, y, p.outer) && !p.holes.some(h => inRing(x, y, h))) M[r * nx + c] = 1; } }
  return M; }

const SUMMER = [5, 6, 7], WINTER = [11, 0, 1], COLD = ['N', 'NE', 'E'];
// a blur that counts only the land: the sum over the land / the share of land in the kernel
function blurLand(a, mask, nx, ny, sg){ if (!mask) return blur(a, nx, ny, sg); const N = nx * ny, am = new Float32Array(N), m = new Float32Array(N);
  for (let i = 0; i < N; i++){ m[i] = mask[i] ? 1 : 0; am[i] = a[i] * m[i]; }
  const ba = blur(am, nx, ny, sg), bm = blur(m, nx, ny, sg), bp = blur(a, nx, ny, sg), o = new Float32Array(N);
  for (let i = 0; i < N; i++) o[i] = bm[i] > 0.02 ? ba[i] / bm[i] : bp[i]; return o; }
function percentile(a, mask, p){ const v = []; for (let i = 0; i < a.length; i++) if (!mask || mask[i]) v.push(a[i]); if (!v.length) return 1; v.sort((x, y) => x - y); return v[Math.min(v.length - 1, Math.floor(p * v.length))] || 1; }

export function environmentFields(D, landMask = null){
  const { nx, ny, cell } = D.grid, N = nx * ny;
  let Z = D.elev ? dec16(D.elev, 10) : null, source = 'D.elev';
  if (!Z || Z.length !== N){ Z = elevationFromContours(D.contours, nx, ny, cell); source = 'contours'; }
  if (!Z){ Z = new Float32Array(N); source = 'none'; }
  const slope = new Float32Array(N);
  for (let r = 0; r < ny; r++) for (let c = 0; c < nx; c++){ const gx = (Z[r * nx + Math.min(c + 1, nx - 1)] - Z[r * nx + Math.max(c - 1, 0)]) / (2 * cell), gy = (Z[Math.min(r + 1, ny - 1) * nx + c] - Z[Math.max(r - 1, 0) * nx + c]) / (2 * cell); slope[r * nx + c] = Math.hypot(gx, gy); }
  // where rain gathers
  const { A, filled } = flowAccumulation(Z, nx, ny, cell), Q = new Float32Array(N), aMax = Math.log(percentile(A, landMask, 0.995) + 1);
  for (let i = 0; i < N; i++) Q[i] = clamp(Math.log(A[i]) / aMax, 0, 1);
  // the winds by season
  const year = D.year || [], energy = (months, names) => D.dirs.map((d, k) => { if (names && !names.includes(d.name)) return 0; let e = 0; for (const m of months){ const y = year[m]; if (y) e += (y.share[k] || 0) * (y.v[k] || 0) ** 2; } return e / months.length; });
  const S = D.dirs.map(d => dec16(d.S, 1e3)), eS = energy(SUMMER), eW = energy(WINTER, COLD);
  const V = new Float32Array(N), Cw = new Float32Array(N);
  for (let i = 0; i < N; i++){ let v = 0, w = 0; for (let k = 0; k < S.length; k++){ v += eS[k] * S[k][i]; w += eW[k] * S[k][i]; } V[i] = v; Cw[i] = w; }
  // (v8.7) the wind speed-up grids carry stripes and steps along the grid axes (they are cast cell by cell); a 30 m smoothing
  // within the land removes them without carrying the water's values onto it
  { const sV = blurLand(V, landMask, nx, ny, 3), sW = blurLand(Cw, landMask, nx, ny, 3); V.set(sV); Cw.set(sW); }
  const vM = percentile(V, landMask, 0.98), wM = percentile(Cw, landMask, 0.98);
  const C = new Float32Array(N);
  for (let i = 0; i < N; i++){ V[i] = clamp(V[i] / vM, 0, 1); Cw[i] = clamp(Cw[i] / wM, 0, 1); C[i] = 0.6 * (1 - Cw[i]) + 0.4 * V[i]; }
  let zl = Infinity, zh = -Infinity; for (let i = 0; i < N; i++) if (!landMask || landMask[i]){ zl = Math.min(zl, Z[i]); zh = Math.max(zh, Z[i]); }
  return { Z, slope, Q, A, F: filled, V, Cw, C, stats: { elevationFrom: source, zMin: +zl.toFixed(1), zMax: +zh.toFixed(1),
    summerEnergy: eS.map(e => +e.toFixed(2)), winterColdEnergy: eW.map(e => +e.toFixed(2)) } };
}

/* (v8.8, v8.10) the blue-green corridors: the main runoff paths, widened to half m each side.
 * A path is a run of cells whose upstream area is at least minHa hectares (an absolute measure, so a flat or gently
 * sloping site does not get a corridor on every faint trickle), at least minLen m long. If the corridors would still take
 * more than maxShare of the land, the threshold rises until they do not (a cap, for the flat sites of London, where a
 * 50 m terrain grid makes many parallel paths). Returns the corridor mask (1 where a 10 m cell is in a corridor), the
 * distance of every cell to the nearest corridor axis (m) and the axis angle there (downhill on the filled surface). */
export function corridors(env, landMask, nx, ny, cell, { minHa = 2, half = 15, minLen = 100, maxShare = 0.12 } = {}){
  const N = nx * ny, F = env.F || env.Z, A = env.A, haPer = cell * cell / 1e4;
  let land = 0; for (let i = 0; i < N; i++) if (!landMask || landMask[i]) land++;
  // the axis angle: downhill on the (lightly smoothed) filled surface
  const Fs = blur(F, nx, ny, 1.5), ang = new Float32Array(N);
  for (let r = 0; r < ny; r++) for (let c = 0; c < nx; c++){ const gx = (Fs[r * nx + Math.min(c + 1, nx - 1)] - Fs[r * nx + Math.max(c - 1, 0)]), gy = (Fs[Math.min(r + 1, ny - 1) * nx + c] - Fs[Math.max(r - 1, 0) * nx + c]); ang[r * nx + c] = Math.atan2(-gy, -gx); }
  const build = th => {
    const seed = new Uint8Array(N);
    for (let i = 0; i < N; i++) if (A[i] * haPer >= th && (!landMask || landMask[i])) seed[i] = 1;
    // drop the short pieces (8-connected): a corridor is a line, not a speck
    const seen = new Uint8Array(N), stack = [], minCells = Math.max(3, Math.round(minLen / cell));
    for (let s = 0; s < N; s++){ if (!seed[s] || seen[s]) continue; const comp = []; stack.push(s); seen[s] = 1;
      while (stack.length){ const k = stack.pop(); comp.push(k); const r = (k / nx) | 0, c = k % nx;
        for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++){ const rr = r + dr, cc = c + dc; if (rr < 0 || cc < 0 || rr >= ny || cc >= nx) continue; const j = rr * nx + cc; if (seed[j] && !seen[j]){ seen[j] = 1; stack.push(j); } } }
      if (comp.length < minCells) for (const k of comp) seed[k] = 0; }
    // the distance to the nearest seed and the angle there (multi-source, 8 neighbours)
    const dist = new Float32Array(N).fill(Infinity), near = new Int32Array(N).fill(-1), H = [];
    const push = (d, k) => { H.push([d, k]); let i = H.length - 1; while (i){ const q = (i - 1) >> 1; if (H[q][0] <= H[i][0]) break; [H[q], H[i]] = [H[i], H[q]]; i = q; } };
    const pop = () => { const t = H[0], l = H.pop(); if (H.length){ H[0] = l; let i = 0; for (;;){ const a = 2 * i + 1, b = a + 1; let m = i; if (a < H.length && H[a][0] < H[m][0]) m = a; if (b < H.length && H[b][0] < H[m][0]) m = b; if (m === i) break; [H[m], H[i]] = [H[i], H[m]]; i = m; } } return t; };
    for (let i = 0; i < N; i++) if (seed[i]){ dist[i] = 0; near[i] = i; push(0, i); }
    while (H.length){ const [d, k] = pop(); if (d > dist[k]) continue; const r = (k / nx) | 0, c = k % nx;
      for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++){ if (!dr && !dc) continue; const rr = r + dr, cc = c + dc; if (rr < 0 || cc < 0 || rr >= ny || cc >= nx) continue; const j = rr * nx + cc, nd = d + Math.hypot(dr, dc) * cell;
        if (nd < dist[j]){ dist[j] = nd; near[j] = near[k]; push(nd, j); } } }
    const mask = new Uint8Array(N), axis = new Float32Array(N); let cells = 0;
    for (let i = 0; i < N; i++){ axis[i] = near[i] >= 0 ? ang[near[i]] : 0; if (dist[i] <= half && (!landMask || landMask[i])){ mask[i] = 1; cells++; } }
    return { mask, dist, axis, seed, cells }; };
  let th = minHa, g = build(th), raised = false;
  while (land && g.cells > maxShare * land && th < 2000){ th *= 1.5; g = build(th); raised = true; }
  return { ...g, areaHa: g.cells * haPer, share: land ? g.cells / land : 0, minHa: th, raised };
}
