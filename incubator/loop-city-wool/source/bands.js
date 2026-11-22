/* bands.js : the wool bands pipeline in the browser (a port of the Python study in _build, 21 Nov).
   Relaxed wool threads inside city cells -> density -> swollen bands -> one mass with the existing roads and the
   cell edge -> centres resolved -> small blocks merged -> open ends carried on -> centrelines, classes, parcels.
   No libraries, no network, no modules: a plain script that sets window.Bands. See PORT_NOTES.md. */
(function (root) {
'use strict';

const DEFAULTS = {
  px: 0,                       // metres a grid square; 0 = (x1 - x0) / gridW, as the Python does
  gridW: 1540,
  threadPx: 3,                 // a thread is painted this many squares wide
  levels: [[1, 0], [3, 1], [6, 2], [10, 4], [16, 6]],   // [threads from, squares the band grows each side]
  exW: {M: 5, A: 4, B: 3},     // existing roads in the mass, squares wide
  rim: 7,                      // the cell edge in the mass, squares wide
  attract: {on: true, reach: 250, angle: 30, minLen: 300, ease: 250},
  close1: 3, rmax: 4, minBlockHa: 3, close2: 2, narrow: 3,
  small: 12, smallMax: 30,     // ha; small 0 = no merging
  closeEnds: true, endReach: 2800,
  sigma: 90, step: 14,
  widths: {b1: 24, b2: 30, a1: 48, a2: 60, m: 90},
  parkHa: 25, farmShare: 0.5, markTol: 80,
  outlines: true,              // true = each outline is worked out when it is first read; 'all' = all five inside run; a list of stage names = those inside run, the others when first read; false = none
  outlineAlign: 'python',      // 'python' = exactly where the Python pictures draw it; 'pixel' = on the true grid (up to half a square different)
  debug: false
};

const now = () => (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
const prof = {};                                             // milliseconds spent inside the heavy tools, for numbers.ms.inside
function tick(name, t0) { prof[name] = (prof[name] || 0) + now() - t0; }

/* round half to even, as Python's round() and numpy's rint */
function rint(v) { const f = Math.floor(v), d = v - f; return d < 0.5 ? f : d > 0.5 ? f + 1 : (f % 2 === 0 ? f : f + 1); }
/* PIL's two rounding rules: halves away from zero, halves towards zero */
function roundUp(f) { return f >= 0 ? Math.floor(f + 0.5) : -Math.floor(Math.abs(f) + 0.5); }
function roundDown(f) { return f >= 0 ? Math.ceil(f - 0.5) : -Math.ceil(Math.abs(f) - 0.5); }
function dist(ax, ay, bx, by) { const dx = bx - ax, dy = by - ay; return Math.sqrt(dx * dx + dy * dy); }

/* the defaults with the caller's values over them (one level deep for the grouped ones) */
function settings(p) {
  const P = {}; p = p || {};
  for (const k in DEFAULTS) {
    const d = DEFAULTS[k], v = p[k];
    if (d && typeof d === 'object' && !Array.isArray(d)) P[k] = Object.assign({}, d, (v && typeof v === 'object') ? v : (k === 'attract' && typeof v === 'boolean') ? {on: v} : {});
    else P[k] = v === undefined ? d : v;
  }
  return P;
}

// ------------------------------------------------------------------ lines and rings (flat [x, y, ...])

/* the frame round all the rings, with a margin (draw_light.box) */
function boxOf(rings, pad) {
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (const r of rings) for (let i = 0; i + 1 < r.length; i += 2) { if (r[i] < x0) x0 = r[i]; if (r[i] > x1) x1 = r[i]; if (r[i + 1] < y0) y0 = r[i + 1]; if (r[i + 1] > y1) y1 = r[i + 1]; }
  const w = x1 - x0, h = y1 - y0; return [x0 - w * pad, y0 - h * pad, x1 + w * pad, y1 + h * pad];
}

/* is the point inside the ring (draw_light.inside) */
function inside(x, y, ring) {
  let c = false; const n = ring.length;
  for (let i = 0; i < n; i += 2) {
    const j = (i - 2 + n) % n, xi = ring[i], yi = ring[i + 1], xj = ring[j], yj = ring[j + 1];
    if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c;
  }
  return c;
}

function plen(P) { let L = 0; for (let i = 2; i + 1 < P.length; i += 2) L += dist(P[i - 2], P[i - 1], P[i], P[i + 1]); return L; }

/* a point every `step` metres along the line, the last point kept (main_roads.resample) */
function resampleStep(P, step) {
  const n = P.length >> 1, out = [P[0], P[1]]; let carry = 0;
  for (let i = 0; i + 1 < n; i++) {
    const ax = P[2 * i], ay = P[2 * i + 1], bx = P[2 * i + 2], by = P[2 * i + 3], L = dist(ax, ay, bx, by);
    if (!L) continue;
    let t = step - carry;
    while (t <= L) { out.push(ax + (bx - ax) * t / L, ay + (by - ay) * t / L); t += step; }
    carry = (carry + L) % step;
  }
  const m = out.length;
  if (out[m - 2] !== P[2 * n - 2] || out[m - 1] !== P[2 * n - 1]) out.push(P[2 * n - 2], P[2 * n - 1]);
  return out;
}

/* the direction of the line at each point, degrees 0 to 180 (main_roads.headings) */
function headings(P) {
  const n = P.length >> 1, h = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const a = Math.max(0, i - 1), b = Math.min(n - 1, i + 1);
    let d = Math.atan2(P[2 * b + 1] - P[2 * a + 1], P[2 * b] - P[2 * a]) * (180 / Math.PI) % 180;
    if (d < 0) d += 180;
    h[i] = d;
  }
  return h;
}

/* the line cut into equal pieces of about s metres (band_true.resample) */
function resampleN(P, s) {
  const n = P.length >> 1, L = new Float64Array(n);
  for (let i = 1; i < n; i++) L[i] = L[i - 1] + dist(P[2 * i - 2], P[2 * i - 1], P[2 * i], P[2 * i + 1]);
  const tot = L[n - 1], m = Math.max(1, rint(tot / s)), out = new Float64Array(2 * (m + 1)), stepL = tot / m; let j = 0;
  for (let i = 0; i <= m; i++) {
    if (i === 0) { out[0] = P[0]; out[1] = P[1]; continue; }
    if (i === m) { out[2 * m] = P[2 * n - 2]; out[2 * m + 1] = P[2 * n - 1]; continue; }
    const t = i * stepL;
    while (j < n - 2 && L[j + 1] < t) j++;
    const d = L[j + 1] - L[j], f = d > 0 ? (t - L[j]) / d : 0;
    out[2 * i] = P[2 * j] + f * (P[2 * j + 2] - P[2 * j]); out[2 * i + 1] = P[2 * j + 1] + f * (P[2 * j + 3] - P[2 * j + 1]);
  }
  return out;
}

// ------------------------------------------------------------------ drawing on the grid exactly as PIL does

/* PIL's wide line and polygon fill (Draw.c of Pillow 12), copied rule for rule and checked against PIL pixel by pixel:
   whole-number corners, 32-bit float crossings, spans from round-half-up to round-half-down, and the extra squares
   PIL adds at a sharp top or bottom corner. span(y, xa, xb) gets every filled run, already clipped. */
function Raster(W, H) {
  const fr = Math.fround, E4 = [mk(), mk(), mk(), mk()], tab = []; let xx = new Float32Array(64);
  function mk() { return {xmin: 0, xmax: 0, ymin: 0, ymax: 0, x0: 0, y0: 0, dx: 0}; }
  function setE(e, x0, y0, x1, y1) {
    if (x0 <= x1) { e.xmin = x0; e.xmax = x1; } else { e.xmin = x1; e.xmax = x0; }
    if (y0 <= y1) { e.ymin = y0; e.ymax = y1; } else { e.ymin = y1; e.ymax = y0; }
    e.dx = y0 === y1 ? 0 : fr((x1 - x0) / (y1 - y0)); e.x0 = x0; e.y0 = y0; return e;
  }
  function xat(e, y) { return fr(fr((y - e.y0) * e.dx) + e.x0); }
  function endx(e, y) { return y === e.y0 ? e.x0 : e.xmin + e.xmax - e.x0; }
  function hl(x0, y, x1, span) {
    if (y < 0 || y >= H) return;
    if (x0 < 0) x0 = 0; else if (x0 >= W) return;
    if (x1 < 0) return;
    if (x1 >= W) x1 = W - 1;
    if (x0 <= x1) span(y, x0, x1);
  }
  function fill(E, n, span) {
    let ymin = H - 1, ymax = 0, i, j, k; tab.length = 0;
    for (i = 0; i < n; i++) {
      const e = E[i];
      if (ymin > e.ymin) ymin = e.ymin;
      if (ymax < e.ymax) ymax = e.ymax;
      if (e.ymin === e.ymax) { hl(e.xmin, e.ymin, e.xmax, span); continue; }
      tab.push(e);
    }
    if (ymin < 0) ymin = 0;
    if (ymax > H) ymax = H;
    const m = tab.length;
    if (xx.length < 2 * m + 2) xx = new Float32Array(2 * m + 2);
    for (let y = ymin; y <= ymax; y++) {
      j = 0;
      for (i = 0; i < m; i++) {
        const cur = tab[i];
        if (y < cur.ymin || y > cur.ymax) continue;
        xx[j++] = xat(cur, y);
        if (y === cur.ymax && y < ymax) { xx[j] = xx[j - 1]; j++; }
        else if (cur.dx !== 0 && (y === cur.ymin || y === cur.ymax)) {          // a sharp corner: reach towards the next row
          for (k = 0; k < i; k++) {
            const o = tab[k];
            if ((cur.dx > 0 && o.dx <= 0) || (cur.dx < 0 && o.dx >= 0)) continue;
            if (!((y === cur.ymin && y === o.ymin) || (y === cur.ymax && y === o.ymax))) continue;
            if (endx(cur, y) !== endx(o, y)) continue;
            const off = y === ymax ? -1 : 1, a1 = xat(cur, y + off), a2 = xat(o, y + off), far = (cur.dx > 0) !== (y === cur.ymax);
            const nv = far ? roundUp(Math.min(a1, a2)) - 1 : roundUp(Math.max(a1, a2)) + 1;
            if (far ? nv > xx[j - 1] : nv < xx[j - 1]) xx[j - 1] = nv;
            break;
          }
        }
      }
      for (i = 1; i < j; i++) { const v = xx[i]; k = i - 1; while (k >= 0 && xx[k] > v) { xx[k + 1] = xx[k]; k--; } xx[k + 1] = v; }
      for (i = 1; i < j; i += 2) hl(roundUp(xx[i - 1]), y, roundDown(xx[i]), span);
    }
  }
  function wide(x0, y0, x1, y1, width, span) {
    const dx = x1 - x0, dy = y1 - y0;
    if (dx === 0 && dy === 0) { if (x0 >= 0 && x0 < W && y0 >= 0 && y0 < H) span(y0, x0, x0); return; }
    const big = Math.sqrt(dx * dx + dy * dy), lo = ((width - 1) >> 1) / big, hi = (width >> 1) / big;   // an even width has one square more on one side
    const dxmin = roundUp(lo * dy), dxmax = roundDown(hi * dy), dymin = roundUp(lo * dx), dymax = roundDown(hi * dx);
    const ax = x0 - dxmin, ay = y0 + dymax, bx = x1 - dxmin, by = y1 + dymax, cx = x1 + dxmax, cy = y1 - dymin, ex = x0 + dxmax, ey = y0 - dymin;
    setE(E4[0], ax, ay, bx, by); setE(E4[1], bx, by, cx, cy); setE(E4[2], cx, cy, ex, ey); setE(E4[3], ex, ey, ax, ay);
    fill(E4, 4, span);
  }
  function hair(x0, y0, x1, y1, span) {                 // PIL's one-square line (not used at the default widths; not checked against PIL)
    let dx = x1 - x0, dy = y1 - y0, xs = 1, ys = 1, i, e;
    const pt = (x, y) => { if (x >= 0 && x < W && y >= 0 && y < H) span(y, x, x); };
    if (dx < 0) { dx = -dx; xs = -1; }
    if (dy < 0) { dy = -dy; ys = -1; }
    if (dx === 0) { for (i = 0; i < dy; i++) { pt(x0, y0); y0 += ys; } }
    else if (dy === 0) { for (i = 0; i < dx; i++) { pt(x0, y0); x0 += xs; } }
    else if (dx > dy) { const n = dx; dy += dy; e = dy - dx; dx += dx; for (i = 0; i < n; i++) { pt(x0, y0); if (e >= 0) { y0 += ys; e -= dx; } e += dy; x0 += xs; } }
    else { const n = dy; dx += dx; e = dx - dy; dy += dy; for (i = 0; i < n; i++) { pt(x0, y0); if (e >= 0) { x0 += xs; e -= dy; } e += dx; y0 += ys; } }
  }
  /* a line through the points q (grid coordinates, flat), `width` squares wide: each piece is its own slab, no joints */
  function line(q, width, span) {
    const n = q.length >> 1; if (n < 2) return;
    let x0 = Math.trunc(q[0]), y0 = Math.trunc(q[1]);
    for (let i = 1; i < n; i++) {
      const x1 = Math.trunc(q[2 * i]), y1 = Math.trunc(q[2 * i + 1]);
      if (width <= 1) hair(x0, y0, x1, y1, span); else wide(x0, y0, x1, y1, width, span);
      x0 = x1; y0 = y1;
    }
    if (width <= 1 && x0 >= 0 && x0 < W && y0 >= 0 && y0 < H) span(y0, x0, x0);
  }
  /* a filled polygon through the points q (grid coordinates, flat) */
  function polygon(q, span) {
    const n = q.length >> 1; if (n < 3) return;
    const X = new Int32Array(n), Y = new Int32Array(n), E = [];
    for (let i = 0; i < n; i++) { X[i] = Math.trunc(q[2 * i]); Y[i] = Math.trunc(q[2 * i + 1]); }
    for (let i = 0; i < n - 1; i++) {
      const x0 = X[i], y0 = Y[i], x1 = X[i + 1], y1 = Y[i + 1];
      if (y0 === y1 && i !== 0 && y0 === Y[i - 1] && E.length) {                 // two level pieces in a row are one
        const last = E[E.length - 1];
        if (x1 > x0 && x0 > X[i - 1]) { last.xmax = x1; continue; }
        else if (x1 < x0 && x0 < X[i - 1]) { last.xmin = x1; continue; }
      }
      E.push(setE(mk(), x0, y0, x1, y1));
    }
    if (X[n - 1] !== X[0] || Y[n - 1] !== Y[0]) E.push(setE(mk(), X[n - 1], Y[n - 1], X[0], Y[0]));
    fill(E, E.length, span);
  }
  return {line: line, polygon: polygon};
}

// ------------------------------------------------------------------ tools on the grid (Uint8Array masks, row 0 on top)

let _rx0 = new Int32Array(4096), _rx1 = new Int32Array(4096), _ry = new Int32Array(4096), _par = new Int32Array(4096);

/* number the connected pieces of the squares equal to `val`, in reading order of their first square (scipy label).
   Four neighbours, or eight when `eight`. Returns {lab, n, size} (size[0] is unused).
   Works on the level runs of each row, not on single squares: a run joins the runs it touches in the row above. */
function label(mask, W, H, val, eight) {
  const t0 = now(), lab = new Int32Array(W * H), ext = eight ? 1 : 0; let nr = 0, prevS = 0, prevE = 0;
  let rx0 = _rx0, rx1 = _rx1, ry = _ry, par = _par;
  const find = i => { while (par[i] !== i) { par[i] = par[par[i]]; i = par[i]; } return i; };
  for (let y = 0; y < H; y++) {
    const o = y * W, curS = nr; let x = 0, p = prevS;
    while (x < W) {
      if (mask[o + x] !== val) { x++; continue; }
      let e = x;
      while (e + 1 < W && mask[o + e + 1] === val) e++;
      if (nr === rx0.length) {                                   // more room for runs
        const cap = 2 * nr, a = new Int32Array(cap), b = new Int32Array(cap), c = new Int32Array(cap), d = new Int32Array(cap);
        a.set(rx0); b.set(rx1); c.set(ry); d.set(par); rx0 = _rx0 = a; rx1 = _rx1 = b; ry = _ry = c; par = _par = d;
      }
      rx0[nr] = x; rx1[nr] = e; ry[nr] = y; par[nr] = nr;
      while (p < prevE && rx1[p] < x - ext) p++;
      let q = p;
      while (q < prevE && rx0[q] <= e + ext) {                   // every run above that touches this one
        const a = find(q), b = find(nr);
        if (a < b) par[b] = a; else if (b < a) par[a] = b;
        q++;
      }
      if (q > p) p = q - 1;                                      // the last of them may touch the next run too
      nr++; x = e + 1;
    }
    prevS = curS; prevE = nr;
  }
  const id = new Int32Array(nr), size = [0]; let n = 0;
  for (let r = 0; r < nr; r++) {                                 // the first run of a piece, in reading order, is its root: number as they come
    const root = find(r); let k = id[root];
    if (!k) { k = ++n; id[root] = k; size.push(0); }
    size[k] += rx1[r] - rx0[r] + 1; lab.fill(k, ry[r] * W + rx0[r], ry[r] * W + rx1[r] + 1);
  }
  tick('label', t0);
  return {lab: lab, n: n, size: size};
}

/* exact Euclidean distance transform: for every square, the squared distance (d2) to the nearest square equal to
   `feat`, and which square that is (idx). Two passes, the same method and the same choice between equal distances
   as scipy's distance_transform_edt (down the columns first, the upper one wins; then along the rows, the left wins). */
function edt(mask, W, H, feat) {
  const t0 = now(), N = W * H, fu = new Int16Array(N), fd = new Int16Array(N), d2 = new Int32Array(N), idx = new Int32Array(N), g = new Int32Array(W + 2), gf = new Int32Array(W + 2);
  let x, y, i, o;
  /* down the columns: for every square that is not `feat`, the row of the nearest `feat` square above it (fu) and
     below it (fd), -1 = none. Only those squares are written. */
  for (y = 0; y < H; y++) { o = y * W; for (x = 0; x < W; x++) { i = o + x; if (mask[i] !== feat) fu[i] = y === 0 ? -1 : (mask[i - W] === feat ? y - 1 : fu[i - W]); } }
  for (y = H - 1; y >= 0; y--) { o = y * W; for (x = 0; x < W; x++) { i = o + x; if (mask[i] !== feat) fd[i] = y === H - 1 ? -1 : (mask[i + W] === feat ? y + 1 : fd[i + W]); } }
  /* along the rows: only the squares that are not `feat` need work, run by run. A run is shut in by a `feat` square
     at each end (distance 0 in this row), so nothing beyond those two can be nearer: the columns of the run and its
     two ends are all the candidates. Same result as the whole row at once, for a fraction of the work. */
  for (y = 0; y < H; y++) {
    o = y * W; x = 0;
    while (x < W) {
      if (mask[o + x] === feat) { idx[o + x] = o + x; x++; continue; }
      let e = x;
      while (e + 1 < W && mask[o + e + 1] !== feat) e++;
      const lo = x > 0 ? x - 1 : x, hi = e < W - 1 ? e + 1 : e; let l = -1, c;
      for (c = lo; c <= hi; c++) {
        let f = y;                                               // the `feat` square that shuts the run in
        if (c >= x && c <= e) { const up = fu[o + c], dn = fd[o + c]; f = up < 0 ? dn : (dn >= 0 && dn - y < y - up) ? dn : up; if (f < 0) continue; }
        const wR = (f - y) * (f - y);
        while (l >= 1) {
          const i1 = g[l], i2 = g[l - 1], a = i1 - i2, b = c - i1, ab = a + b, v = gf[l] - y, u = gf[l - 1] - y;
          if (ab * v * v - b * u * u - a * wR - a * b * ab <= 0) break;
          l--;
        }
        l++; g[l] = c; gf[l] = f;
      }
      const maxl = l;
      if (maxl < 0) { for (c = x; c <= e; c++) { d2[o + c] = 1073741824; idx[o + c] = -1; } }
      else {
        l = 0;
        for (c = x; c <= e; c++) {
          let gl = g[l], dr = gf[l] - y, d1 = dr * dr + (gl - c) * (gl - c);
          while (l < maxl) {
            const g2 = g[l + 1], dr2 = gf[l + 1] - y, dd = dr2 * dr2 + (g2 - c) * (g2 - c);
            if (d1 <= dd) break;
            d1 = dd; l++;
          }
          d2[o + c] = d1; idx[o + c] = gf[l] * W + g[l];
        }
      }
      x = e + 1;
    }
  }
  tick('edt', t0);
  return {d2: d2, idx: idx};
}

/* grow a mask by one square up, down, left and right, n times (scipy binary_dilation, iterations = n) */
function dilCross(src, W, H, n) {
  const t0 = now(), N = W * H, out = new Uint8Array(N);
  if (n <= 0) { out.set(src); return out; }
  const d = new Uint16Array(N); let x, y, i, v;                   // steps to the nearest set square, moving up, down, left, right: two sweeps
  for (y = 0; y < H; y++) for (x = 0, i = y * W; x < W; x++, i++) {
    if (src[i]) continue;
    v = 60000;
    if (x > 0 && d[i - 1] + 1 < v) v = d[i - 1] + 1;
    if (y > 0 && d[i - W] + 1 < v) v = d[i - W] + 1;
    d[i] = v;
  }
  for (y = H - 1; y >= 0; y--) for (x = W - 1, i = y * W + W - 1; x >= 0; x--, i--) {
    v = d[i];
    if (x < W - 1 && d[i + 1] + 1 < v) v = d[i + 1] + 1;
    if (y < H - 1 && d[i + W] + 1 < v) v = d[i + W] + 1;
    d[i] = v; out[i] = v <= n ? 1 : 0;
  }
  tick('dilCross', t0);
  return out;
}

/* is a set square within n steps (up, down, left, right) of this one */
function crossNear(mask, W, H, x, y, n) {
  for (let dy = -n; dy <= n; dy++) {
    const yy = y + dy; if (yy < 0 || yy >= H) continue;
    const h = n - Math.abs(dy), xa = Math.max(0, x - h), xb = Math.min(W - 1, x + h);
    for (let xx = xa; xx <= xb; xx++) if (mask[yy * W + xx]) return 1;
  }
  return 0;
}

/* in every row, how many squares to the nearest square equal to `feat` in that row (65535 = none) */
function rowDist(mask, W, H, feat) {
  const hd = new Uint16Array(W * H);
  for (let y = 0; y < H; y++) {
    const o = y * W; let d = 65535, x;
    for (x = 0; x < W; x++) { if (mask[o + x] === feat) d = 0; else if (d < 65535) d++; hd[o + x] = d; }
    d = 65535;
    for (x = W - 1; x >= 0; x--) { if (mask[o + x] === feat) d = 0; else if (d < 65535) d++; if (d < hd[o + x]) hd[o + x] = d; }
  }
  return hd;
}

/* 1 where a square equal to `feat` lies within the squared distance T (a round disk, exact). A disk is a stack of
   level runs, so every level run of `feat` squares is painted, widened, into the rows above and below it. */
function nearDisk(mask, W, H, T, feat) {
  const t0 = now(), out = new Uint8Array(W * H);
  if (!(T >= 0)) return out;
  const R = Math.floor(Math.sqrt(T)), hs = [];
  for (let dy = -R; dy <= R; dy++) hs.push(Math.floor(Math.sqrt(T - dy * dy)));
  for (let y = 0; y < H; y++) {
    const o = y * W, ya = y - R < 0 ? 0 : y - R, yb = y + R > H - 1 ? H - 1 : y + R; let x = 0;
    while (x < W) {
      if (mask[o + x] !== feat) { x++; continue; }
      let e = x;
      while (e + 1 < W && mask[o + e + 1] === feat) e++;
      for (let yy = ya; yy <= yb; yy++) {
        const h = hs[yy - y + R], a = x - h < 0 ? 0 : x - h, b = e + h > W - 1 ? W - 1 : e + h;
        out.fill(1, yy * W + a, yy * W + b + 1);
      }
      x = e + 1;
    }
  }
  tick('disk', t0);
  return out;
}

/* grow by a round disk of r squares, then shrink by the same: gaps and inside corners fill with an arc.
   Done on a padded copy, as the Python does, so the frame edge plays no part. */
function closing(mask, W, H, r, pad) {
  const W2 = W + 2 * pad, H2 = H + 2 * pad, big = new Uint8Array(W2 * H2), T = r * r + 0.5, out = new Uint8Array(W * H); let y, x, i;
  for (y = 0; y < H; y++) big.set(mask.subarray(y * W, y * W + W), (y + pad) * W2 + pad);
  const dil = nearDisk(big, W2, H2, T, 1), gap = nearDisk(dil, W2, H2, T, 0);
  for (y = 0; y < H; y++) for (x = 0; x < W; x++) { i = (y + pad) * W2 + x + pad; out[y * W + x] = (dil[i] && !gap[i]) ? 1 : 0; }
  return out;
}

/* the weights of a Gaussian of reach 4 sigma, as scipy makes them: w[0] the middle, w[k] k squares away */
function kernel(sigma) {
  const R = Math.floor(4 * sigma + 0.5), full = new Float64Array(2 * R + 1), w = new Float64Array(R + 1), s2 = sigma * sigma; let sum = 0, k;
  for (k = -R; k <= R; k++) { full[k + R] = Math.exp(-0.5 / s2 * (k * k)); sum += full[k + R]; }
  for (k = 0; k <= R; k++) w[k] = full[R + k] / sum;
  return w;
}

/* Gaussian blur of the thread counts as scipy's gaussian_filter: mirrored at the frame, down the columns then along
   the rows, the sums taken in scipy's own order so that the thresholds fall on the same squares */
function gauss(src, W, H, sigma) {
  const t0 = now(), w = kernel(sigma), R = w.length - 1, out = new Float64Array(W * H), buf = new Float64Array(W + 2 * R), w0 = w[0]; let y, x, k;
  for (y = 0; y < H; y++) {
    const o = y * W;
    for (x = 0; x < W; x++) buf[R + x] = src[o + x] * w0;
    for (k = R; k >= 1; k--) {
      let ya = y - k, yb = y + k;
      if (ya < 0) ya = -ya - 1;
      if (yb >= H) yb = 2 * H - 1 - yb;
      const oa = ya * W, ob = yb * W, wk = w[k];
      for (x = 0; x < W; x++) buf[R + x] += (src[oa + x] + src[ob + x]) * wk;
    }
    for (k = 1; k <= R; k++) { buf[R - k] = buf[R + k - 1]; buf[R + W - 1 + k] = buf[R + W - k]; }
    for (x = 0; x < W; x++) {
      let v = buf[R + x] * w0;
      for (k = R; k >= 1; k--) v += (buf[R + x - k] + buf[R + x + k]) * w[k];
      out[o + x] = v;
    }
  }
  tick('gauss', t0);
  return out;
}

/* thin a mask to lines one square wide (Zhang-Suen; every pass decides for all squares at once, as the numpy version) */
function thin(mask, W, H) {
  const t0 = now(), W2 = W + 2, img = new Uint8Array(W2 * (H + 2)); let n = 0, q, x, y;
  for (y = 0; y < H; y++) for (x = 0; x < W; x++) if (mask[y * W + x]) { img[(y + 1) * W2 + x + 1] = 1; n++; }
  const list = new Int32Array(n), rm = new Int32Array(n);
  q = 0; for (let i = 0; i < img.length; i++) if (img[i]) list[q++] = i;
  let go = true;
  while (go) {
    go = false;
    for (let step = 0; step < 2; step++) {
      let nr = 0;
      for (q = 0; q < n; q++) {
        const i = list[q], p2 = img[i - W2], p4 = img[i + 1], p6 = img[i + W2], p8 = img[i - 1];
        if (p2 && p4 && p6 && p8) continue;                      // shut in on all four sides: neither pass can take it
        const p3 = img[i - W2 + 1], p5 = img[i + W2 + 1], p7 = img[i + W2 - 1], p9 = img[i - W2 - 1];
        const b = p2 + p3 + p4 + p5 + p6 + p7 + p8 + p9;
        if (b < 2 || b > 6) continue;
        let a = 0;
        if (!p2 && p3) a++; if (!p3 && p4) a++; if (!p4 && p5) a++; if (!p5 && p6) a++;
        if (!p6 && p7) a++; if (!p7 && p8) a++; if (!p8 && p9) a++; if (!p9 && p2) a++;
        if (a !== 1) continue;
        if (step === 0) { if (p2 * p4 * p6 !== 0 || p4 * p6 * p8 !== 0) continue; }
        else if (p2 * p4 * p8 !== 0 || p2 * p6 * p8 !== 0) continue;
        rm[nr++] = q;
      }
      if (nr) {
        go = true;
        for (let k = 0; k < nr; k++) { img[list[rm[k]]] = 0; list[rm[k]] = -1; }
        let m = 0;
        for (q = 0; q < n; q++) if (list[q] >= 0) list[m++] = list[q];
        n = m;
      }
    }
  }
  const out = new Uint8Array(W * H);
  for (y = 0; y < H; y++) for (x = 0; x < W; x++) out[y * W + x] = img[(y + 1) * W2 + x + 1];
  tick('thin', t0);
  return out;
}

/* a hole in the mass smaller than `ha` hectares is not a block: fill it (band_resolved.fill_small) */
function fillSmall(m, W, H, px, ha) {
  const L = label(m, W, H, 0, false), out = m.slice(), small = new Uint8Array(L.n + 1), lim = ha * 1e4;
  for (let q = 1; q <= L.n; q++) small[q] = L.size[q] * px * px < lim ? 1 : 0;
  for (let i = 0; i < out.length; i++) if (small[L.lab[i]]) out[i] = 1;
  return out;
}

/* blocks in a mass: how many, how many under 6 ha, the median size (blocks over 5000 ha are the outside) */
function statsOf(size, px) {
  const inner = []; let u6 = 0;
  for (let q = 1; q < size.length; q++) { const v = size[q] * px * px / 1e4; if (v < 5000) { inner.push(v); if (v < 6) u6++; } }
  return {blocks: inner.length, 'under 6 ha': u6, 'median ha': inner.length ? Math.round(median(inner) * 10) / 10 : 0};
}
function blockStats(mask, W, H, px) { return statsOf(label(mask, W, H, 0, false).size, px); }

function median(v) {
  const a = Array.prototype.slice.call(v).sort((p, q) => p - q), n = a.length;
  return n ? (n % 2 ? a[(n - 1) / 2] : (a[n / 2 - 1] + a[n / 2]) / 2) : 0;
}

// ------------------------------------------------------------------ the pipeline, piece by piece

/* the stretches of the existing roads that lie in the cells (band_integrated.existing_in_cells) */
function existingInCells(existing, rings, exW) {
  const out = [];
  for (const q of existing) {
    const p = q.p, n = p.length >> 1, ins = new Uint8Array(n), c = exW[q.c] !== undefined ? q.c : 'B'; let run = [];
    for (let i = 0; i < n; i++) for (const rg of rings) if (inside(p[2 * i], p[2 * i + 1], rg)) { ins[i] = 1; break; }
    for (let i = 0; i < n; i++) {
      if (ins[i] || (i > 0 && ins[i - 1]) || (i + 1 < n && ins[i + 1])) run.push(p[2 * i], p[2 * i + 1]);
      else { if (run.length >= 4) out.push({c: c, p: run}); run = []; }
    }
    if (run.length >= 4) out.push({c: c, p: run});
  }
  return out;
}

/* a thread that runs beside an existing road (within reach, within the angle, for minLen or more) is pulled onto
   it; the pull is eased either side so the thread bends on and off (band_integrated.attract) */
function attract(threads, ex, A) {
  const G = 500, cells = new Map(), reach = A.reach, par = A.angle, rr = Math.floor(reach / G) + 1, K = Math.max(0, Math.round(A.ease / 50));
  const key = (gx, gy) => (gx + 100000) * 400000 + gy + 100000;
  for (const e of ex) {
    const Q = resampleStep(e.p, 50), hs = headings(Q);
    for (let i = 0; i < hs.length; i++) {
      const kk = key(Math.floor(Q[2 * i] / G), Math.floor(Q[2 * i + 1] / G)); let c = cells.get(kk);
      if (!c) { c = []; cells.set(kk, c); }
      c.push(Q[2 * i], Q[2 * i + 1], hs[i]);
    }
  }
  const hit = [0, 0];
  function near(x, y, h) {
    let bd = -1; const cx = Math.floor(x / G), cy = Math.floor(y / G);
    for (let gx = cx - rr; gx <= cx + rr; gx++) for (let gy = cy - rr; gy <= cy + rr; gy++) {
      const c = cells.get(key(gx, gy));
      if (!c) continue;
      for (let q = 0; q < c.length; q += 3) {
        let dh = Math.abs(c[q + 2] - h); dh = Math.min(dh, 180 - dh);
        if (dh > par) continue;
        const d = dist(x, y, c[q], c[q + 1]);
        if (d < reach && (bd < 0 || d < bd)) { bd = d; hit[0] = c[q]; hit[1] = c[q + 1]; }
      }
    }
    return bd >= 0;
  }
  const out = []; let moved = 0, total = 0;
  for (const l of threads) {
    const P = resampleStep(l, 50), hs = headings(P), n = hs.length, ox = new Float64Array(n), oy = new Float64Array(n), on = new Uint8Array(n);
    let i, j, k;
    for (i = 0; i < n; i++) if (near(P[2 * i], P[2 * i + 1], hs[i])) { on[i] = 1; ox[i] = hit[0] - P[2 * i]; oy[i] = hit[1] - P[2 * i + 1]; }
    i = 0;
    while (i < n) {                                              // a brush past a road is not running beside it
      if (!on[i]) { i++; continue; }
      j = i;
      while (j + 1 < n && on[j + 1]) j++;
      if ((j - i) * 50 < A.minLen) for (k = i; k <= j; k++) { ox[k] = 0; oy[k] = 0; on[k] = 0; }
      i = j + 1;
    }
    const Q = new Array(2 * n);
    for (i = 0; i < n; i++) {
      const a0 = Math.max(0, i - K), b0 = Math.min(n, i + K + 1); let sx = 0, sy = 0;
      for (k = a0; k < b0; k++) { sx += ox[k]; sy += oy[k]; }
      Q[2 * i] = P[2 * i] + sx / (b0 - a0); Q[2 * i + 1] = P[2 * i + 1] + sy / (b0 - a0);
    }
    Q[0] = P[0]; Q[1] = P[1]; Q[2 * n - 2] = P[2 * n - 2]; Q[2 * n - 1] = P[2 * n - 1];
    total += n * 50; for (i = 0; i < n; i++) moved += on[i] * 50;
    out.push(Q);
  }
  return {threads: out, movedKm: moved / 1000, totalKm: total / 1000};
}

/* how many threads cover each square (wool_swell.density): every thread painted `width` squares wide, counted once */
function density(threads, W, H, x0, y1, k, width, R) {
  const N = W * H, acc = new Uint16Array(N), stamp = new Int32Array(N);
  for (let t = 0; t < threads.length; t++) {
    const l = threads[t], n = l.length >> 1, q = new Float64Array(2 * n), id = t + 1;
    for (let i = 0; i < n; i++) { q[2 * i] = (l[2 * i] - x0) * k; q[2 * i + 1] = (y1 - l[2 * i + 1]) * k; }
    R.line(q, width, (y, a, b) => { for (let i = y * W + a, e = y * W + b; i <= e; i++) if (stamp[i] !== id) { stamp[i] = id; acc[i]++; } });
  }
  return acc;
}

/* the bands: wider where more threads run together (band_resolved.bands) */
function bandsOf(Ds, W, H, levels) {
  const t0 = now(), N = W * H, m = new Uint8Array(N), d = new Int16Array(N), nl = levels.length, th = [], gr = []; let x, y, i, v, k, tmin = Infinity;
  for (k = 0; k < nl; k++) { th.push(levels[k][0] > 1 ? levels[k][0] - 0.5 : 0.5); gr.push(Math.max(0, Math.floor(levels[k][1]))); if (th[k] < tmin) tmin = th[k]; }
  /* all the levels in one go: a square of a level starts at minus that level's growth, every step away (up, down,
     left, right) adds one, and the band is where the count stays at 0 or under. Two sweeps. */
  for (y = 0; y < H; y++) for (x = 0, i = y * W; x < W; x++, i++) {
    const s = Ds[i]; v = 30000;
    if (s >= tmin) for (k = 0; k < nl; k++) if (s >= th[k] && -gr[k] < v) v = -gr[k];
    if (x > 0 && d[i - 1] + 1 < v) v = d[i - 1] + 1;
    if (y > 0 && d[i - W] + 1 < v) v = d[i - W] + 1;
    d[i] = v;
  }
  for (y = H - 1; y >= 0; y--) for (x = W - 1, i = y * W + W - 1; x >= 0; x--, i--) {
    v = d[i];
    if (x < W - 1 && d[i + 1] + 1 < v) v = d[i + 1] + 1;
    if (y < H - 1 && d[i + W] + 1 < v) v = d[i + W] + 1;
    d[i] = v; m[i] = v <= 0 ? 1 : 0;
  }
  tick('swell', t0);
  return m;
}

/* the wide masses rebuilt as the roads that run through them (band_resolved.resolve): thin the mass, lay a road
   along every centreline at the mass's own half-width there, never more than rmax; small blocks filled before and after */
function resolve(m0, W, H, px, P) {
  const N = W * H, m = fillSmall(m0, W, H, px, P.minBlockHa), sk = thin(m, W, H), hd = rowDist(m, W, H, 0), out = new Uint8Array(N), rmax = Math.max(1, Math.floor(P.rmax)), spans = [], lim = (rmax - 0.5) * (rmax - 0.5);
  for (let r = 0; r <= rmax; r++) { const s = []; for (let dy = -r; dy <= r; dy++) s.push(Math.floor(Math.sqrt(r * r + 0.5 - dy * dy))); spans.push(s); }
  for (let i = 0; i < N; i++) {
    if (!sk[i]) continue;
    const x = i % W, y = (i - x) / W; let best = 1e9;            // the squared distance to the edge of the mass, as far as it matters (under rmax)
    for (let dy = 1 - rmax; dy <= rmax - 1; dy++) {
      const yy = y + dy; if (yy < 0 || yy >= H) continue;
      const h = hd[yy * W + x]; if (h === 65535) continue;
      const d = dy * dy + h * h; if (d < best) best = d;
    }
    const r = best >= lim ? rmax : Math.max(1, Math.round(Math.sqrt(best))), s = spans[r];
    for (let dy = -r; dy <= r; dy++) {
      const yy = y + dy; if (yy < 0 || yy >= H) continue;
      const h = s[dy + r], xa = Math.max(0, x - h), xb = Math.min(W - 1, x + h);
      out.fill(1, yy * W + xa, yy * W + xb + 1);
    }
  }
  const d1 = dilCross(m, W, H, 1);
  for (let i = 0; i < N; i++) out[i] &= d1[i];
  return {res: fillSmall(out, W, H, px, P.minBlockHa), fill: m, sk: sk};
}

/* a block narrower than about 2 x narrow squares between two roads is not a block: the two roads are one there */
function narrowMerge(after, W, H, narrow) {
  const out = after.slice(); let cnt = 0;
  if (!(narrow > 0)) return {out: out, merged: 0};
  const L = label(after, W, H, 0, false), near = nearDisk(after, W, H, Math.ceil(narrow * narrow) - 1, 1), wide = new Uint8Array(L.n + 1);   // near: a road closer than `narrow`
  for (let i = 0; i < out.length; i++) if (!near[i]) wide[L.lab[i]] = 1;       // a block with one square that far from every road is wide enough
  for (let q = 1; q <= L.n; q++) if (!wide[q]) cnt++;
  for (let i = 0; i < out.length; i++) if (L.lab[i] && !wide[L.lab[i]]) out[i] = 1;
  return {out: out, merged: cnt};
}

/* two small blocks side by side become one: the road between them is taken out, the weakest road (fewest threads)
   first; an existing road or the cell edge (prot) is never taken out (band_true.merge_small) */
function mergeSmall(after0, prot, Ds, W, H, px, AS, AMX, rounds) {
  const N = W * H, after = after0.slice(); let done = 0;
  for (let round = 0; round < rounds; round++) {
    const L = label(after, W, H, 0, false), hl = L.lab, nh = L.n, area = new Float64Array(nh + 1), e = edt(after, W, H, 0), T = new Int32Array(N), M = new Map();
    const r0 = new Int32Array(nh + 1).fill(H), r1 = new Int32Array(nh + 1).fill(-1), c0 = new Int32Array(nh + 1).fill(W), c1 = new Int32Array(nh + 1).fill(-1);
    let i, x, y;
    for (i = 1; i <= nh; i++) area[i] = L.size[i] * px * px / 1e4;
    for (y = 0; y < H; y++) for (x = 0; x < W; x++) {
      i = y * W + x; T[i] = e.idx[i] >= 0 ? hl[e.idx[i]] : 0; const q = hl[i];
      if (q) { if (y < r0[q]) r0[q] = y; if (y > r1[q]) r1[q] = y; if (x < c0[q]) c0[q] = x; if (x > c1[q]) c1[q] = x; }
    }
    const add = (a, b, at) => {                                  // the line where the ground of two blocks meets
      const kk = a < b ? a * (nh + 1) + b : b * (nh + 1) + a; let s = M.get(kk);
      if (!s) { s = [0, 0, 0, 0]; M.set(kk, s); }
      s[0]++; s[1] += prot[at]; s[2] += Ds[at]; if (e.d2[at] > s[3]) s[3] = e.d2[at];
    };
    for (y = 0; y < H; y++) for (x = 0; x < W - 1; x++) { i = y * W + x; if (T[i] !== T[i + 1]) add(T[i], T[i + 1], i); }
    for (y = 0; y < H - 1; y++) for (x = 0; x < W; x++) { i = y * W + x; if (T[i] !== T[i + W]) add(T[i], T[i + W], i); }
    const keys = Array.from(M.keys()).sort((p, q) => p - q), nbr = new Map();
    for (const kk of keys) {
      const s = M.get(kk), a = Math.floor(kk / (nh + 1)), b = kk % (nh + 1), tm = s[2] / s[0], w = Math.sqrt(s[3]);
      if (s[0] < 3 || s[1] / s[0] > 0.05 || area[a] >= AS || area[b] >= AS || area[a] + area[b] > AMX) continue;
      if (!nbr.has(a)) nbr.set(a, []);
      nbr.get(a).push([tm, b, w]);
      if (!nbr.has(b)) nbr.set(b, []);
      nbr.get(b).push([tm, a, w]);
    }
    const used = new Set(), order = Array.from(nbr.keys()).sort((p, q) => area[p] - area[q]); let did = 0;
    for (const a of order) {
      if (used.has(a)) continue;
      const cand = nbr.get(a).filter(q => !used.has(q[1])).sort((p, q) => (p[0] - q[0]) || (p[1] - q[1]) || (p[2] - q[2]));
      for (const cd of cand) {
        const b = cd[1], r = Math.trunc(Math.min(8, Math.ceil(cd[2]) + 3));
        const ya = Math.max(0, Math.min(r0[a], r0[b]) - r - 2), yb = Math.min(H, Math.max(r1[a], r1[b]) + 1 + r + 2), xa = Math.max(0, Math.min(c0[a], c0[b]) - r - 2), xb = Math.min(W, Math.max(c1[a], c1[b]) + 1 + r + 2);
        const ww = xb - xa, wh = yb - ya, U = new Uint8Array(ww * wh), was = new Uint8Array(ww * wh); let fa = -1, fb = -1;
        for (y = 0; y < wh; y++) for (x = 0; x < ww; x++) {
          const g = (ya + y) * W + xa + x, q = hl[g], j = y * ww + x;
          if (q === a) { U[j] = 1; if (fa < 0) fa = j; } else if (q === b) { U[j] = 1; if (fb < 0) fb = j; }
          was[j] = after[g];
        }
        const nb = closing(U, ww, wh, r, r + 1), cur = new Uint8Array(ww * wh);
        for (y = 0; y < wh; y++) for (x = 0; x < ww; x++) { const g = (ya + y) * W + xa + x, j = y * ww + x; cur[j] = (was[j] && !(nb[j] && !prot[g])) ? 1 : 0; }
        const l2 = label(cur, ww, wh, 0, false).lab;
        if (l2[fa] === l2[fb]) {                                 // the two are one block now
          for (y = 0; y < wh; y++) for (x = 0; x < ww; x++) after[(ya + y) * W + xa + x] = cur[y * ww + x];
          used.add(a); used.add(b); did++; break;
        }                                                        // else something protected lies between them: left as it was
      }
    }
    done += did;
    if (!did) break;
  }
  return {after: after, done: done};
}

function nb8(sk, W, H, i) {
  const x = i % W, y = (i - x) / W; let n = 0;
  for (let dy = -1; dy <= 1; dy++) {
    const yy = y + dy; if (yy < 0 || yy >= H) continue;
    for (let dx = -1; dx <= 1; dx++) { if (!dx && !dy) continue; const xx = x + dx; if (xx >= 0 && xx < W && sk[yy * W + xx]) n++; }
  }
  return n;
}

/* the thinned lines as a graph: junctions (squares with three or more neighbours, grouped) and the pieces between
   them, each traced end to end (band_roads.graph_of). A piece is traced from its end that comes first in reading
   order; the Python starts from whichever end its set gives first, so a piece can run the other way round here. */
function graphOf(sk, W, H) {
  const N = W * H, J = new Uint8Array(N), C = new Uint8Array(N); let i, q;
  for (i = 0; i < N; i++) if (sk[i]) { if (nb8(sk, W, H, i) >= 3) J[i] = 1; else C[i] = 1; }
  const LJ = label(J, W, H, 1, true), jl = LJ.lab, LC = label(C, W, H, 1, true), cl = LC.lab;
  const sr = new Float64Array(LJ.n + 1), sc = new Float64Array(LJ.n + 1), nodes = [];
  for (i = 0; i < N; i++) if (jl[i]) { const x = i % W; sr[jl[i]] += (i - x) / W; sc[jl[i]] += x; }
  for (q = 1; q <= LJ.n; q++) nodes.push([sr[q] / LJ.size[q], sc[q] / LJ.size[q]]);
  const start = new Int32Array(LC.n + 2);
  for (q = 1; q <= LC.n; q++) start[q + 1] = start[q] + LC.size[q];
  const fp = start.slice(), pix = new Int32Array(start[LC.n + 1]), seen = new Uint8Array(N), edges = [];
  for (i = 0; i < N; i++) if (cl[i]) pix[fp[cl[i]]++] = i;
  const ORD = [-1, 0, 0, -1, 0, 1, 1, 0, -1, -1, -1, 1, 1, -1, 1, 1];      // straight neighbours first, then the diagonal ones, each in reading order
  const count = (p, id) => { const x = p % W, y = (p - x) / W; let n = 0; for (let t = 0; t < 16; t += 2) { const yy = y + ORD[t], xx = x + ORD[t + 1]; if (yy >= 0 && yy < H && xx >= 0 && xx < W && cl[yy * W + xx] === id) n++; } return n; };
  const next = (p, id) => { const x = p % W, y = (p - x) / W; for (let t = 0; t < 16; t += 2) { const yy = y + ORD[t], xx = x + ORD[t + 1]; if (yy >= 0 && yy < H && xx >= 0 && xx < W) { const j = yy * W + xx; if (cl[j] === id && !seen[j]) return j; } } return -1; };
  const adj = p => { const x = p % W, y = (p - x) / W, out = []; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const yy = y + dy, xx = x + dx; if (yy >= 0 && yy < H && xx >= 0 && xx < W) { const v = jl[yy * W + xx] - 1; if (v >= 0 && out.indexOf(v) < 0) out.push(v); } } return out; };
  const rc = p => { const x = p % W; return [(p - x) / W, x]; };
  for (q = 1; q <= LC.n; q++) {
    const s = start[q], e = start[q + 1]; let cur = pix[s];
    for (let t = s; t < e; t++) if (count(pix[t], q) <= 1) { cur = pix[t]; break; }
    const order = [cur]; seen[cur] = 1;
    for (;;) { const nx = next(cur, q); if (nx < 0) break; cur = nx; order.push(cur); seen[cur] = 1; }
    const ja = adj(order[0]), jb = adj(order[order.length - 1]); let a = -1, b = -1;
    if (order.length === 1) { if (ja.length) a = ja[0]; if (ja.length > 1) b = ja[1]; }
    else {
      if (ja.length) a = ja[0];
      for (const v of jb) if (v !== a) { b = v; break; }
      if (b < 0 && jb.length) b = jb[0];
    }
    if (a < 0) { nodes.push(rc(order[0])); a = nodes.length - 1; }
    if (b < 0) { nodes.push(rc(order[order.length - 1])); b = nodes.length - 1; }
    if (a === b && order.length < 20) continue;                  // a tiny loop on one junction
    edges.push({a: a, b: b, pix: order});
  }
  return {nodes: nodes, edges: edges};
}

/* class and width of a road from the threads it carries, the existing road under it, the cell edge (band_true.width_of) */
function widthOf(t, fM, fA, rim, P) {
  const Wd = P.widths, lv = P.levels, t1 = lv.length > 1 ? lv[1][0] - 0.5 : 2.5, t2 = lv.length > 2 ? lv[2][0] - 0.5 : 5.5, t3 = lv.length > 3 ? lv[3][0] - 0.5 : 9.5;
  if (rim > 0.6 || fM > 0.6) return ['M', Wd.m];
  let w = t < t1 ? Wd.b1 : t < t2 ? Wd.b2 : t < t3 ? Wd.a1 : Wd.a2;
  if (fA > 0.6) w = Math.max(w, Wd.a1);
  return [w >= Wd.a1 ? 'A' : 'B', w];
}

/* the mass thinned to centrelines and traced: lines between junctions, each with its thread count, class and width
   (band_true.graph). S holds the grid: W, H, px, x0, y1, after, Ds, exby, rimm. */
function graph(S, P) {
  const W = S.W, H = S.H, px = S.px, x0 = S.x0, y1 = S.y1, N = W * H, sk = thin(S.after, W, H), tg = now(); let live = [];
  for (let i = 0; i < N; i++) if (sk[i]) live.push(i);
  for (let it = 0; it < 8; it++) {                               // the whiskers thinning leaves
    const ends = [], rest = [];
    for (const i of live) { if (nb8(sk, W, H, i) <= 1) ends.push(i); else rest.push(i); }
    if (!ends.length) break;
    for (const i of ends) sk[i] = 0;
    live = rest;
  }
  const g = graphOf(sk, W, H), exM = S.exby.M, exA = S.exby.A, exB = S.exby.B, rimm = S.rimm, Ds = S.Ds;
  let E = [];
  for (const e of g.edges) {
    const pix = e.pix, n = pix.length, vals = new Float64Array(n); let fM = 0, fA = 0, fB = 0, rim = 0;
    for (let q = 0; q < n; q++) {                                // the most threads within two squares; an existing road or the cell edge within two steps
      const i = pix[q], x = i % W, y = (i - x) / W, ya = Math.max(0, y - 2), yb = Math.min(H - 1, y + 2), xa = Math.max(0, x - 2), xb = Math.min(W - 1, x + 2); let mx = -Infinity;
      for (let yy = ya; yy <= yb; yy++) for (let xx = xa; xx <= xb; xx++) { const v = Ds[yy * W + xx]; if (v > mx) mx = v; }
      vals[q] = mx; fM += crossNear(exM, W, H, x, y, 2); fA += crossNear(exA, W, H, x, y, 2); fB += crossNear(exB, W, H, x, y, 2); rim += crossNear(rimm, W, H, x, y, 2);
    }
    fM /= n; fA /= n; fB /= n; rim /= n;
    const t = median(vals), na = g.nodes[e.a], nb = g.nodes[e.b], full = [x0 + (na[1] + 0.5) * px, y1 - (na[0] + 0.5) * px];
    for (let q = 0; q < n; q++) { const i = pix[q], x = i % W, y = (i - x) / W; full.push(x0 + (x + 0.5) * px, y1 - (y + 0.5) * px); }
    full.push(x0 + (nb[1] + 0.5) * px, y1 - (nb[0] + 0.5) * px);
    const raw = [full[0], full[1]];
    for (let q = 2; q < full.length; q += 2) if (dist(full[q - 2], full[q - 1], full[q], full[q + 1]) > 0.01) raw.push(full[q], full[q + 1]);
    if (raw.length < 4) continue;
    const cw = widthOf(t, fM, fA, rim, P);
    E.push({a: e.a, b: e.b, P: resampleN(raw, P.step), t: t, cls: cw[0], w: cw[1], ex: Math.max(fM, fA, fB) > 0.6, rim: rim > 0.6});
  }
  for (let it = 0; it < 3; it++) {                               // stubs under 400 m that end in nothing
    const deg = new Map();
    for (const e of E) { deg.set(e.a, (deg.get(e.a) || 0) + 1); deg.set(e.b, (deg.get(e.b) || 0) + 1); }
    const keep = E.filter(e => !((deg.get(e.a) === 1 || deg.get(e.b) === 1) && plen(e.P) < 400));
    if (keep.length === E.length) break;
    E = keep;
  }
  tick('trace', tg);
  return {E: E, sk: sk};
}

/* every point moves towards the middle of its two neighbours along the road, many times. A junction moves with the
   road that runs straightest through it; the side road follows. Open ends and true Y junctions stay put
   (band_true.smooth). Sets e.pts and e.stroke (the continuous road a line belongs to, -1 if it stands alone). */
function smooth(E, P) {
  const idSet = new Set();
  for (const e of E) { idSet.add(e.a); idSet.add(e.b); }
  const ids = Array.from(idSet).sort((p, q) => p - q), nid = new Map(); let total = ids.length;
  ids.forEach((v, i) => nid.set(v, i));
  for (const e of E) total += (e.P.length >> 1) - 2;
  let X = new Float64Array(total), Y = new Float64Array(total); const nA = new Int32Array(total).fill(-1), nB = new Int32Array(total).fill(-1), inc = new Map();
  for (const e of E) { const m = e.P.length >> 1, ia = nid.get(e.a), ib = nid.get(e.b); X[ia] = e.P[0]; Y[ia] = e.P[1]; X[ib] = e.P[2 * m - 2]; Y[ib] = e.P[2 * m - 1]; }
  let base = ids.length;
  E.forEach((e, k) => {
    const m = e.P.length >> 1, ix = new Int32Array(m);
    ix[0] = nid.get(e.a); ix[m - 1] = nid.get(e.b);
    for (let q = 1; q < m - 1; q++) { ix[q] = base; X[base] = e.P[2 * q]; Y[base] = e.P[2 * q + 1]; base++; }
    for (let q = 1; q < m - 1; q++) { nA[ix[q]] = ix[q - 1]; nB[ix[q]] = ix[q + 1]; }
    e.idx = ix;
    if (!inc.has(ix[0])) inc.set(ix[0], []);
    inc.get(ix[0]).push([k, 0]);
    if (!inc.has(ix[m - 1])) inc.set(ix[m - 1], []);
    inc.get(ix[m - 1]).push([k, 1]);
  });
  const S = {'open ends': 0, 'junctions of 3': 0, 'junctions of 4 or more': 0, 'junctions a road runs straight through': 0};
  const par = new Int32Array(E.length); for (let i = 0; i < par.length; i++) par[i] = i;
  const find = i => { while (par[i] !== i) { par[i] = par[par[i]]; i = par[i]; } return i; };
  inc.forEach((L, v) => {
    const arms = L.map(ke => {
      const ix = E[ke[0]].idx, m = ix.length, nb = ke[1] === 0 ? ix[1] : ix[m - 2], far = ke[1] === 0 ? ix[Math.min(m - 1, 8)] : ix[Math.max(0, m - 9)];
      let dx = X[far] - X[v], dy = Y[far] - Y[v]; const n = Math.sqrt(dx * dx + dy * dy);
      if (n > 0) { dx /= n; dy /= n; }
      return {nb: nb, dx: dx, dy: dy, w: E[ke[0]].w, k: ke[0]};
    });
    if (arms.length === 1) S['open ends']++;
    else if (arms.length === 2) { nA[v] = arms[0].nb; nB[v] = arms[1].nb; par[find(arms[0].k)] = find(arms[1].k); }
    else {
      S[arms.length === 3 ? 'junctions of 3' : 'junctions of 4 or more']++; let best = null;
      for (let i = 0; i < arms.length; i++) for (let j = i + 1; j < arms.length; j++) {
        const dot = arms[i].dx * arms[j].dx + arms[i].dy * arms[j].dy, c = dot - 0.002 * Math.min(arms[i].w, arms[j].w);
        if (best === null || c < best.c) best = {c: c, i: i, j: j, dot: dot};
      }
      if (best.dot < -0.6) { nA[v] = arms[best.i].nb; nB[v] = arms[best.j].nb; S['junctions a road runs straight through']++; par[find(arms[best.i].k)] = find(arms[best.j].k); }
    }
  });
  const mv = []; for (let i = 0; i < total; i++) if (nA[i] >= 0) mv.push(i);
  let X2 = new Float64Array(X), Y2 = new Float64Array(Y); const iters = Math.max(0, rint(P.sigma * P.sigma / (0.5 * P.step * P.step)));
  for (let it = 0; it < iters; it++) {
    for (let q = 0; q < mv.length; q++) { const i = mv[q], a = nA[i], b = nB[i]; X2[i] = X[i] + 0.5 * (0.5 * (X[a] + X[b]) - X[i]); Y2[i] = Y[i] + 0.5 * (0.5 * (Y[a] + Y[b]) - Y[i]); }
    let t = X; X = X2; X2 = t; t = Y; Y = Y2; Y2 = t;
  }
  const cnt = new Map(), sid = new Map();
  for (let k = 0; k < E.length; k++) { const r = find(k); cnt.set(r, (cnt.get(r) || 0) + 1); }
  E.forEach((e, k) => {
    const m = e.idx.length, p = new Float64Array(2 * m), r = find(k);
    for (let q = 0; q < m; q++) { p[2 * q] = X[e.idx[q]]; p[2 * q + 1] = Y[e.idx[q]]; }
    e.pts = p;
    if (cnt.get(r) < 2) e.stroke = -1; else { if (!sid.has(r)) sid.set(r, sid.size); e.stroke = sid.get(r); }
  });
  return S;
}

/* carry every open end straight on, in the mass, until it meets the next road or the cell edge (network_set2.close_ends) */
function closeEnds(S, E, P) {
  const W = S.W, H = S.H, px = S.px, x0 = S.x0, y1 = S.y1, N = W * H, deg = new Map(), after = S.after.slice(), Ds = new Float64Array(S.Ds), dn = new Float32Array(N), done = [];
  for (const e of E) { deg.set(e.a, (deg.get(e.a) || 0) + 1); deg.set(e.b, (deg.get(e.b) || 0) + 1); }
  for (const e of E) {
    for (let end = 0; end < 2; end++) {
      if (deg.get(end === 0 ? e.a : e.b) !== 1) continue;
      const Q = e.pts, m = Q.length >> 1, k = Math.min(m - 1, 14), qi = end === 0 ? 0 : m - 1, ki = end === 0 ? k : m - 1 - k, qx = Q[2 * qi], qy = Q[2 * qi + 1];
      let dx = qx - Q[2 * ki], dy = qy - Q[2 * ki + 1], s = 0, left = false, hit = false, hx = 0, hy = 0; const dl = Math.max(1e-9, Math.sqrt(dx * dx + dy * dy));
      dx /= dl; dy /= dl;
      while (s < P.endReach) {
        s += px / 2; const x = qx + dx * s, y = qy + dy * s, r = Math.trunc((y1 - y) / px), c = Math.trunc((x - x0) / px);
        if (!(r >= 0 && r < H && c >= 0 && c < W)) break;
        if (!S.after[r * W + c]) left = true;
        else if (left) { hit = true; hx = qx + dx * (s + 2 * px); hy = qy + dy * (s + 2 * px); break; }
      }
      if (!hit) { done.push({at: [Math.round(qx), Math.round(qy)], joined: false}); continue; }
      const ax = qx - dx * 2 * px, ay = qy - dy * 2 * px, ln = [(ax - x0) / px, (y1 - ay) / px, (hx - x0) / px, (y1 - hy) / px], tv = Math.fround(e.t);
      S.raster.line(ln, 3, (y, a, b) => { after.fill(1, y * W + a, y * W + b + 1); });
      S.raster.line(ln, 5, (y, a, b) => { dn.fill(tv, y * W + a, y * W + b + 1); });
      done.push({at: [Math.round(qx), Math.round(qy)], joined: true, 'carried on m': Math.round(s)});
    }
  }
  for (let i = 0; i < N; i++) if (dn[i] > Ds[i]) Ds[i] = dn[i];
  return {after: after, Ds: Ds, done: done};
}

/* every block gets a use: urban, farming or park (band_true.classify). Mostly built already = urban. Under parkHa
   to the road centrelines = park. farmShare or more on the good farm soil = farming. The rest = urban.
   Also gives every square the label of its nearest block, the gross areas, and how deep each block's ground is. */
function classify(S, input, rings, P) {
  const W = S.W, H = S.H, px = S.px, x0 = S.x0, y1 = S.y1, after = S.after, N = W * H;
  const maskOf = polys => {
    const m = new Uint8Array(N);
    for (const p of polys) {
      const n = p.length >> 1; if (n < 3) continue;
      const q = new Float64Array(2 * n);
      for (let i = 0; i < n; i++) { q[2 * i] = (p[2 * i] - x0) / px; q[2 * i + 1] = (y1 - p[2 * i + 1]) / px; }
      S.raster.polygon(q, (y, a, b) => { m.fill(1, y * W + a, y * W + b + 1); });
    }
    return m;
  };
  const cell = maskOf(rings), town = maskOf(input.towns || []), farm = maskOf(input.farm || []);
  const L = label(after, W, H, 0, false), hl = L.lab, nh = L.n, e = edt(after, W, H, 0), tl = new Int32Array(N), gross = new Int32Array(nh + 1);
  const inC = new Float64Array(nh + 1), fS = new Float64Array(nh + 1), tS = new Float64Array(nh + 1), k = new Uint8Array(nh + 1), ha = new Float32Array(nh + 1), inr = new Float32Array(nh + 1);
  const r0 = new Int32Array(nh + 1).fill(H), r1 = new Int32Array(nh + 1).fill(-1), c0 = new Int32Array(nh + 1).fill(W), c1 = new Int32Array(nh + 1).fill(-1);
  let i, x, y, q;
  for (y = 0; y < H; y++) for (x = 0; x < W; x++) {
    i = y * W + x; q = hl[i];
    if (q) { inC[q] += cell[i]; fS[q] += farm[i]; tS[q] += town[i]; }
    q = e.idx[i] >= 0 ? hl[e.idx[i]] : 0; tl[i] = q; gross[q]++;
    if (y < r0[q]) r0[q] = y; if (y > r1[q]) r1[q] = y; if (x < c0[q]) c0[q] = x; if (x > c1[q]) c1[q] = x;
  }
  const gin = [], km2 = [0, 0, 0, 0], parcels = [0, 0, 0, 0];
  for (q = 1; q <= nh; q++) {
    const n = L.size[q], ga = gross[q] * px * px / 1e4; ha[q] = ga;
    if (inC[q] / n < 0.5 || n * px * px / 1e4 > 5000) continue;
    k[q] = tS[q] / n > 0.5 ? 1 : ga < P.parkHa ? 3 : fS[q] / n >= P.farmShare ? 2 : 1;
    gin.push(ga); parcels[k[q]]++; km2[k[q]] += gross[q];
  }
  let soil = 0, soilF = 0, soilU = 0;
  for (i = 0; i < N; i++) if (farm[i] && cell[i] && !after[i]) { soil++; q = k[hl[i]]; if (q === 2) soilF++; else if (q === 1) soilU++; }
  for (q = 1; q <= nh; q++) {                                    // how deep the ground of each block is: the largest distance from inside it to its edge
    if (r1[q] < 0) continue;                                     // (the ground outside the cells is a block too: the frame counts as its edge)
    const bw = c1[q] - c0[q] + 1, bh = r1[q] - r0[q] + 1, f = (!k[q] && bw * bh > 4096) ? 4 : 1;
    /* a block with a use is measured square by square. The ground without a use (outside the cells: most of the
       frame) is measured on a grid four times coarser, good to about four squares, which is all its size is used for */
    const ww = Math.ceil(bw / f) + 2, wh = Math.ceil(bh / f) + 2, cnt = new Uint8Array(ww * wh), full = f * f; let mx = 0;
    for (y = r0[q]; y <= r1[q]; y++) { const o = (Math.floor((y - r0[q]) / f) + 1) * ww + 1; for (x = c0[q]; x <= c1[q]; x++) if (tl[y * W + x] === q) cnt[o + Math.floor((x - c0[q]) / f)]++; }
    for (i = 0; i < cnt.length; i++) cnt[i] = cnt[i] === full ? 1 : 0;
    const d = edt(cnt, ww, wh, 0).d2;
    for (i = 0; i < cnt.length; i++) if (cnt[i] && d[i] > mx) mx = d[i];
    inr[q] = Math.sqrt(mx) * f * px;
  }
  const r1d = v => Math.round(v * 10) / 10, names = ['', 'urban parcels', 'farming parcels', 'parks'], num = {};
  for (q = 1; q <= 3; q++) num[names[q]] = {parcels: parcels[q], 'km2 to the road centrelines': r1d(km2[q] * px * px / 1e6)};
  num['parcel size to the road centrelines, ha'] = {'under 6': gin.filter(v => v < 6).length, 'under 12': gin.filter(v => v < 12).length, 'under 20': gin.filter(v => v < 20).length, median: r1d(median(gin))};
  num['good farm soil in farming parcels %'] = r1d(100 * soilF / Math.max(1, soil));
  num['good farm soil in urban parcels %'] = r1d(100 * soilU / Math.max(1, soil));
  num['a park is a block under, ha'] = P.parkHa;
  return {blocks: {label: tl, n: nh, cls: k, ha: ha, inradius: inr}, numbers: num, cell: cell, town: town, farm: farm, sizes: L.size};
}

/* the display classes (network_set2.classes as it was specified, with the marks as lines instead of a raster):
   H = 90 m highway (cell edge, or traced blue on a motorway); R = 60 m main road, red (traced red, or a motorway
   inside a cell); N = the rest. marks = {red: [flat lines], blue: [flat lines]} or nothing. Sets disp, w2, len, red. */
function classes(E, marks, params) {
  const P = params && params.widths && params.markTol !== undefined ? params : settings(params), tol = P.markTol, G = Math.max(200, 4 * tol);
  const key = (gx, gy) => (gx + 100000) * 400000 + gy + 100000;
  const index = lines => {
    if (!lines || !lines.length) return null;
    const m = new Map();
    for (const l of lines) for (let i = 0; i + 3 < l.length; i += 2) {
      const ax = l[i], ay = l[i + 1], bx = l[i + 2], by = l[i + 3];
      for (let gx = Math.floor((Math.min(ax, bx) - tol) / G); gx <= Math.floor((Math.max(ax, bx) + tol) / G); gx++)
        for (let gy = Math.floor((Math.min(ay, by) - tol) / G); gy <= Math.floor((Math.max(ay, by) + tol) / G); gy++) {
          const kk = key(gx, gy); let c = m.get(kk);
          if (!c) { c = []; m.set(kk, c); }
          c.push(ax, ay, bx, by);
        }
    }
    return m;
  };
  const near = (m, x, y) => {
    if (!m) return false;
    const c = m.get(key(Math.floor(x / G), Math.floor(y / G)));
    if (!c) return false;
    for (let i = 0; i < c.length; i += 4) {
      const ax = c[i], ay = c[i + 1], vx = c[i + 2] - ax, vy = c[i + 3] - ay, l2 = vx * vx + vy * vy;
      let u = l2 ? ((x - ax) * vx + (y - ay) * vy) / l2 : 0; u = u < 0 ? 0 : u > 1 ? 1 : u;
      const dx = ax + u * vx - x, dy = ay + u * vy - y;
      if (dx * dx + dy * dy <= tol * tol) return true;
    }
    return false;
  };
  const red = index(marks && marks.red), blue = index(marks && marks.blue), at = new Map();
  E.forEach((e, i) => {
    const p = e.pts, n = p.length >> 1; let nr = 0, nb = 0;
    for (let q = 0; q < n; q++) { if (near(red, p[2 * q], p[2 * q + 1])) nr++; else if (near(blue, p[2 * q], p[2 * q + 1])) nb++; }
    const rs = nr / n, bs = nb / n;
    e.len = plen(p); e.red = rs;
    e.disp = rs >= 0.6 ? 'R' : (e.rim || (bs >= 0.3 && rs < 0.3 && e.cls === 'M')) ? 'H' : e.cls === 'M' ? 'R' : 'N';
    for (const nd of [e.a, e.b]) { if (!at.has(nd)) at.set(nd, []); at.get(nd).push(i); }
  });
  const has = (i, nd, k) => at.get(nd).some(j => j !== i && E[j].disp === k);
  for (let it = 0; it < 4; it++) E.forEach((e, i) => {             // a piece between two red pieces, partly under the stroke, is red too
    if (e.disp !== 'R' && (e.red >= 0.25 || e.len < 320) && has(i, e.a, 'R') && has(i, e.b, 'R') && !(e.disp === 'H' && e.red < 0.25)) e.disp = 'R';
  });
  for (let it = 0; it < 4; it++) E.forEach((e, i) => {             // a short red piece that leads nowhere is a side road caught by the stroke: not red
    if (e.disp === 'R' && e.cls !== 'M' && e.len < 700 && !((has(i, e.a, 'R') || has(i, e.a, 'H')) && (has(i, e.b, 'R') || has(i, e.b, 'H')))) e.disp = e.rim ? 'H' : 'N';
  });
  const km = {}, Wd = P.widths;
  for (const e of E) {
    e.w2 = e.disp === 'H' ? Wd.m : e.disp === 'R' ? Wd.a2 : Math.min(e.w, Wd.a2);
    const k = e.disp === 'H' ? 'highways on the cell boundaries, ' + Wd.m + ' m' : e.disp === 'R' ? 'branching main roads, ' + Wd.a2 + ' m (red)' : 'other main roads, ' + Math.trunc(e.w2) + ' m';
    km[k] = (km[k] || 0) + e.len / 1000;
  }
  const out = {};
  Object.keys(km).sort().forEach(k => { out[k] = Math.round(km[k] * 10) / 10; });
  return out;
}

// ------------------------------------------------------------------ the outline of a mass

/* the smooth field the Python pictures contour (band_resolved.field): specks under 40 squares dropped, the mask
   enlarged two times (straight-line interpolation, corners on corners), then blurred by 1.6 */
function fieldOf(mask, W, H) {
  const t0 = now(), L = label(mask, W, H, 1, false), W2 = 2 * W, H2 = 2 * H, keep = new Uint8Array(L.n + 1), m = new Uint8Array(W * H);
  for (let q = 1; q <= L.n; q++) keep[q] = L.size[q] >= 40 ? 1 : 0;
  for (let i = 0; i < m.length; i++) m[i] = keep[L.lab[i]];
  const ax = fieldTaps(W), ay = fieldTaps(H), K = ax.K, K1 = K + 1, sx = ax.start, cw = ax.cw, jmin = ax.jmin, jmax = ax.jmax, T = new Float32Array(H * W2);
  let cap = 4096, ivS = new Int32Array(cap), ivE = new Int32Array(cap), nv = 0; const ivRow = new Int32Array(H + 1);
  /* along the rows: every grid row becomes a row of 2 W samples. The mask is 0 or 1, so a level run of 1s adds, to
     each sample it reaches, the sum of that sample's weights over the run (taken from running totals). Only the
     samples a run reaches are touched; the stretches touched in each row are remembered for the next step. */
  for (let y = 0; y < H; y++) {
    const o = y * W, o2 = y * W2; let x = 0, cs = -1, ce = -2;
    ivRow[y] = nv;
    while (x <= W) {
      let e = -1, j0 = 0, j1 = -1;
      while (x < W && !m[o + x]) x++;
      if (x < W) {
        e = x;
        while (e + 1 < W && m[o + e + 1]) e++;
        j0 = jmin[x]; j1 = jmax[e];
        for (let j = j0; j <= j1; j++) { const s = sx[j], qa = x > s ? x - s : 0, qb = e + 1 - s < K ? e + 1 - s : K; T[o2 + j] += cw[j * K1 + qb] - cw[j * K1 + qa]; }
      }
      if (e < 0 || j0 > ce + 1) {                                // the stretch so far is closed (also at the end of the row)
        if (ce >= cs) { if (nv === cap) { cap *= 2; const a = new Int32Array(cap), b = new Int32Array(cap); a.set(ivS); b.set(ivE); ivS = a; ivE = b; } ivS[nv] = cs; ivE[nv] = ce; nv++; }
        cs = j0; ce = j1;
      } else if (j1 > ce) ce = j1;
      if (e < 0) break;
      x = e + 1;
    }
  }
  ivRow[H] = nv;
  const Wp = W2 + 2, g = new Float32Array(Wp * (H2 + 2)), Ky = ay.K, sy = ay.start, wy = ay.wt;
  for (let i = 0; i < H2; i++) {                                 // down the columns, into a result with one empty square all round
    const gi = (i + 1) * Wp + 1, r0 = sy[i];
    for (let q = 0; q < Ky; q++) {
      const wq = wy[i * Ky + q]; if (wq === 0) continue;
      const r = r0 + q, tr = r * W2;
      for (let v = ivRow[r]; v < ivRow[r + 1]; v++) { const j1 = ivE[v]; for (let j = ivS[v]; j <= j1; j++) g[gi + j] += wq * T[tr + j]; }
    }
  }
  tick('field', t0);
  return {g: g, W2: W2, H2: H2};
}

const _taps = new Map();

/* enlarging two times and blurring by 1.6 are both plain weighted sums, so along one axis sample j of the field is
   one weighted sum of a few neighbouring grid squares. The weights (the enlarging with corners on corners, the blur
   mirrored at the frame, both as scipy does them) are worked out once for a grid of n squares. */
function fieldTaps(n) {
  if (_taps.has(n)) return _taps.get(n);
  const n2 = 2 * n, s = (n - 1) / (n2 - 1), w = kernel(1.6), R = w.length - 1, rows = [], los = new Int32Array(n2), row = new Float64Array(n); let K = 1;
  for (let j = 0; j < n2; j++) {
    let lo = n, hi = -1;
    for (let k = -R; k <= R; k++) {
      let t = j + k;
      if (t < 0) t = -t - 1; else if (t >= n2) t = 2 * n2 - 1 - t;
      const xs = t * s; let c = Math.floor(xs); if (c > n - 2) c = n - 2;
      const tau = xs - c, wk = w[k < 0 ? -k : k];
      row[c] += wk * (1 - tau); row[c + 1] += wk * tau;
      if (c < lo) lo = c;
      if (c + 1 > hi) hi = c + 1;
    }
    rows.push(row.slice(lo, hi + 1)); row.fill(0, lo, hi + 1); los[j] = lo;
    if (hi - lo + 1 > K) K = hi - lo + 1;
  }
  const start = new Int32Array(n2), wt = new Float64Array(n2 * K);
  for (let j = 0; j < n2; j++) {
    const a = rows[j], lo = Math.min(los[j], n - K);
    start[j] = lo;
    for (let q = 0; q < a.length; q++) wt[j * K + los[j] - lo + q] = a[q];
  }
  /* cw: running totals of the weights of each sample; jmin[x], jmax[x]: the first and the last sample that grid square x reaches */
  const K1 = K + 1, cw = new Float64Array(n2 * K1), jmin = new Int32Array(n), jmax = new Int32Array(n);
  for (let j = 0; j < n2; j++) for (let q = 0; q < K; q++) cw[j * K1 + q + 1] = cw[j * K1 + q] + wt[j * K + q];
  for (let x = 0, j = 0; x < n; x++) { while (j + 1 < n2 && start[j + 1] <= x) j++; jmax[x] = j; }
  for (let x = 0, j = 0; x < n; x++) { while (j < n2 - 1 && start[j] + K - 1 < x) j++; jmin[x] = j; }
  const T = {K: K, start: start, wt: wt, cw: cw, jmin: jmin, jmax: jmax}; _taps.set(n, T); return T;
}

/* the 0.5 line of a field as closed loops (marching squares, straight-line interpolation). g is the field with one
   empty square all round: outside the frame counts as 0, so a loop that reaches the frame closes along it.
   xs, ys give the place of every column and row of the field itself. */
function contours(g, W2, H2, level, xs, ys) {
  const t0 = now(), Wp = W2 + 2, Hp = H2 + 2, XS = new Float64Array(Wp), YS = new Float64Array(Hp);
  for (let j = 0; j < Wp; j++) XS[j] = xs[Math.min(W2 - 1, Math.max(0, j - 1))];
  for (let i = 0; i < Hp; i++) YS[i] = ys[Math.min(H2 - 1, Math.max(0, i - 1))];
  const px = [], py = [], nA = [], nB = [];
  const node = (x, y) => { px.push(x); py.push(y); nA.push(-1); nB.push(-1); return px.length - 1; };
  const link = (p, q) => { if (p < 0 || q < 0) return; if (nA[p] < 0) nA[p] = q; else nB[p] = q; if (nA[q] < 0) nA[q] = p; else nB[q] = p; };
  let top = new Int32Array(Wp).fill(-1), bot = new Int32Array(Wp).fill(-1), binA = new Uint8Array(Wp), binB = new Uint8Array(Wp), anyA = 0;
  for (let I = 0; I < Hp - 1; I++) {
    const o = I * Wp, o2 = o + Wp; let left = -1, anyB = 0;
    for (let J = 0; J < Wp; J++) { const v = g[o2 + J] >= level ? 1 : 0; binB[J] = v; anyB |= v; }     // which samples of the next row are inside
    bot.fill(-1);
    if (anyA | anyB) for (let J = 0; J < Wp - 1; J++) {          // the square with corners a b / d c
      const cs = (binA[J] << 3) | (binA[J + 1] << 2) | (binB[J + 1] << 1) | binB[J];
      if (cs === 0 || cs === 15) { left = -1; continue; }
      const a = g[o + J], b = g[o + J + 1], c = g[o2 + J + 1], d = g[o2 + J], ib = (cs >> 2) & 1, ic = (cs >> 1) & 1, id = cs & 1, T = top[J], Lf = left;
      const R = ib !== ic ? node(XS[J + 1], YS[I] + (level - b) / (c - b) * (YS[I + 1] - YS[I])) : -1;
      const B = id !== ic ? node(XS[J] + (level - d) / (c - d) * (XS[J + 1] - XS[J]), YS[I + 1]) : -1;
      bot[J] = B; left = R;
      switch (cs) {
        case 1: case 14: link(Lf, B); break;
        case 2: case 13: link(B, R); break;
        case 3: case 12: link(Lf, R); break;
        case 4: case 11: link(T, R); break;
        case 6: case 9: link(T, B); break;
        case 7: case 8: link(T, Lf); break;
        case 5: if ((a + b + c + d) / 4 >= level) { link(T, Lf); link(B, R); } else { link(T, R); link(Lf, B); } break;
        case 10: if ((a + b + c + d) / 4 >= level) { link(T, R); link(Lf, B); } else { link(T, Lf); link(B, R); } break;
      }
    }
    const t = top; top = bot; bot = t;
    const tb = binA; binA = binB; binB = tb; anyA = anyB;
  }
  const n = px.length, seen = new Uint8Array(n), loops = [];
  for (let s = 0; s < n; s++) {
    if (seen[s]) continue;
    const pts = []; let prev = -1, cur = s;
    for (;;) {
      seen[cur] = 1; pts.push(px[cur], py[cur]);
      const nx = nA[cur] !== prev ? nA[cur] : nB[cur];
      if (nx < 0 || nx === s || seen[nx]) break;
      prev = cur; cur = nx;
    }
    if (pts.length >= 6) loops.push(Float64Array.from(pts));
  }
  tick('contour', t0);
  return loops;
}

/* the outline of a mass as closed loops in metres: the 0.5 line of the Python field */
function outlineOf(mask, W, H, box, align) {
  const F = fieldOf(mask, W, H), W2 = F.W2, H2 = F.H2, xs = new Float64Array(W2), ys = new Float64Array(H2), x0 = box[0], y0 = box[1], x1 = box[2], y1 = box[3], px = (x1 - x0) / W;
  if (align === 'pixel') {
    for (let j = 0; j < W2; j++) xs[j] = x0 + (j * (W - 1) / (W2 - 1) + 0.5) * px;
    for (let i = 0; i < H2; i++) ys[i] = y1 - (i * (H - 1) / (H2 - 1) + 0.5) * px;
  } else {
    for (let j = 0; j < W2; j++) xs[j] = x0 + j * (x1 - x0) / (W2 - 1);
    for (let i = 0; i < H2; i++) ys[i] = y1 - i * (y1 - y0) / (H2 - 1);
  }
  return contours(F.g, W2, H2, 0.5, xs, ys);
}

// ------------------------------------------------------------------ the whole chain

/* input, params and result as in PORT_NOTES.md. Synchronous. onStage(name) is called before each stage. */
function run(input, params, onStage) {
  const P = settings(params), ms = {}, tStart = now(); let tPrev = tStart, curStage = null;
  const stage = name => { const t = now(); if (curStage) ms[curStage] = Math.round(((ms[curStage] || 0) + t - tPrev) * 10) / 10; tPrev = t; curStage = name; if (name && onStage) onStage(name); };
  const ctx = {dbg: {}, stages: {}}; api._last = ctx;
  for (const key in prof) delete prof[key];
  const dbg = ctx.dbg, rings = (input.cells || []).map(c => c.ring).filter(r => r && r.length >= 6);
  if (!rings.length && !input.box) throw new Error('Bands.run: the input has no cells and no box');
  const box = input.box ? Array.prototype.slice.call(input.box) : boxOf(rings, 0.04), x0 = box[0], y0 = box[1], x1 = box[2], y1 = box[3];
  const W = P.px > 0 ? Math.max(16, Math.round((x1 - x0) / P.px)) : P.gridW, H = Math.max(16, rint(W * (y1 - y0) / (x1 - x0))), k = W / (x1 - x0), px = 1.0 / k, N = W * H, R = Raster(W, H);
  ctx.W = W; ctx.H = H; ctx.px = px; ctx.box = box;
  const toPix = p => { const n = p.length >> 1, q = new Float64Array(2 * n); for (let i = 0; i < n; i++) { q[2 * i] = (p[2 * i] - x0) / px; q[2 * i + 1] = (y1 - p[2 * i + 1]) / px; } return q; };
  const paint = m => (y, a, b) => { m.fill(1, y * W + a, y * W + b + 1); };
  const pad1 = Math.max(6, Math.ceil(P.close1) + 1), pad2 = Math.max(6, Math.ceil(P.close2) + 1);

  stage('attract');
  const threads = (input.threads || []).filter(l => l && l.length >= 4), ex = existingInCells(input.existing || [], rings, P.exW);
  const att = P.attract.on ? attract(threads, ex, P.attract) : {threads: threads, movedKm: 0, totalKm: 0};

  stage('bands');
  const dn0 = density(threads, W, H, x0, y1, k, P.threadPx, R), Ds0 = gauss(dn0, W, H, 0.8);
  const sBands = closing(bandsOf(Ds0, W, H, P.levels), W, H, P.close1, pad1);
  ctx.stages.bands = sBands; dbg.dn_raw = dn0;

  stage('integrated');
  const dn = P.attract.on ? density(att.threads, W, H, x0, y1, k, P.threadPx, R) : dn0, Ds = P.attract.on ? gauss(dn, W, H, 0.8) : Ds0;
  const exby = {M: new Uint8Array(N), A: new Uint8Array(N), B: new Uint8Array(N)}, rimm = new Uint8Array(N), exm = new Uint8Array(N);
  for (const e of ex) R.line(toPix(e.p), P.exW[e.c], paint(exby[e.c] || exby.B));
  for (const rg of rings) { const p = Array.prototype.slice.call(rg, 0, (rg.length >> 1) * 2); p.push(rg[0], rg[1]); R.line(toPix(p), P.rim || 7, paint(rimm)); }
  const m0 = bandsOf(Ds, W, H, P.levels);
  for (let i = 0; i < N; i++) { exm[i] = exby.M[i] | exby.A[i] | exby.B[i]; m0[i] |= exm[i] | rimm[i]; }
  const sInt = closing(m0, W, H, P.close1, pad1);
  ctx.stages.integrated = sInt; dbg.dn = dn; dbg.exM = exby.M; dbg.exA = exby.A; dbg.exB = exby.B; dbg.rimm = rimm; dbg.m0 = m0;

  stage('tuned');
  const rs = resolve(sInt, W, H, px, P), cl2 = closing(rs.res, W, H, P.close2, pad2), nm = narrowMerge(cl2, W, H, P.narrow), sTuned = nm.out;
  ctx.stages.tuned = sTuned; dbg.res_fill = rs.fill; dbg.res_sk = rs.sk; dbg.resolved = rs.res; dbg.closed2 = cl2;

  stage('merged');
  let sMerged = sTuned, pairs = 0;
  if (P.small > 0) {
    const pr = new Uint8Array(N); for (let i = 0; i < N; i++) pr[i] = exm[i] | rimm[i];
    const mr = mergeSmall(sTuned, dilCross(pr, W, H, 1), Ds, W, H, px, P.small, P.smallMax, 4); sMerged = mr.after; pairs = mr.done;
  }
  ctx.stages.merged = sMerged;

  stage('graph');
  const S = {W: W, H: H, px: px, x0: x0, y1: y1, after: sMerged, Ds: Ds, exby: exby, rimm: rimm, raster: R};
  let g = graph(S, P), J = smooth(g.E, P), ends = [], sFinal = sMerged;
  if (P.closeEnds) {
    stage('final');
    const ce = closeEnds(S, g.E, P); ends = ce.done; sFinal = ce.after; S.after = ce.after; S.Ds = ce.Ds;
    g = graph(S, P); J = smooth(g.E, P);
  }
  ctx.stages.final = sFinal; dbg.sk = g.sk;

  stage('blocks');
  const cf = classify(S, input, rings, P);
  dbg.poly_cell = cf.cell; dbg.poly_town = cf.town; dbg.poly_farm = cf.farm;

  stage('classes');
  const E = g.E, kmDisp = classes(E, input.marks, P), kmCls = {}, NAME = {M: 'outer highway', A: 'A road', B: 'B road'}; let kmAll = 0;
  for (const e of E) { const key = NAME[e.cls] + ', ' + Math.trunc(e.w) + ' m'; kmCls[key] = (kmCls[key] || 0) + e.len / 1000; kmAll += e.len / 1000; }
  const kmOut = {}; Object.keys(kmCls).sort().forEach(key => { kmOut[key] = Math.round(kmCls[key] * 10) / 10; });
  const edges = E.map(e => ({pts: e.pts, cls: e.cls, w: e.w, t: e.t, ex: e.ex, rim: e.rim, a: e.a, b: e.b, stroke: e.stroke, disp: e.disp, w2: e.w2, len: e.len, red: e.red}));

  stage('outlines');
  const stages = {bands: sBands, integrated: sInt, tuned: sTuned, merged: sMerged, final: sFinal}, outlines = {}, stBlocks = {final: statsOf(cf.sizes, px)};
  const later = name => Object.defineProperty(outlines, name, {enumerable: true, configurable: true, get: () => {      // worked out when first read, then kept
    const t = now(), v = outlineOf(stages[name], W, H, box, P.outlineAlign);
    ms['outline ' + name] = Math.round((now() - t) * 10) / 10;
    Object.defineProperty(outlines, name, {value: v, enumerable: true, writable: true, configurable: true}); return v;
  }});
  for (const name in stages) {
    if (P.outlines === false) outlines[name] = [];
    else if (P.outlines === 'all' || (Array.isArray(P.outlines) && P.outlines.indexOf(name) >= 0)) outlines[name] = outlineOf(stages[name], W, H, box, P.outlineAlign);
    else later(name);
    if (P.debug) stBlocks[name] = blockStats(stages[name], W, H, px);
  }
  stage(null);
  ms.total = Math.round((now() - tStart) * 10) / 10; ms.inside = {};
  for (const key in prof) ms.inside[key] = Math.round(prof[key] * 10) / 10;

  const fb = stBlocks.final, numbers = {
    blocks: fb.blocks, 'under 6 ha': fb['under 6 ha'], 'median ha': fb['median ha'],
    'road km by class': kmOut, 'road km by display class': kmDisp, 'all main roads km': Math.round(kmAll * 10) / 10,
    junctions: J, 'open ends carried on': ends, 'open ends left': J['open ends'],
    'parcels by use': cf.numbers, 'small blocks merged (pairs)': pairs, 'narrow blocks merged': nm.merged,
    'thread km pulled onto existing roads': Math.round(att.movedKm * 10) / 10, 'thread km': Math.round(att.totalKm * 10) / 10,
    'blocks by stage': stBlocks, ms: ms
  };
  const res = {px: px, W: W, H: H, box: box, stages: stages, outlines: outlines, edges: edges, blocks: cf.blocks, numbers: numbers};
  if (P.debug) res.debug = dbg;
  return res;
}

const api = {
  DEFAULTS: DEFAULTS, run: run,
  classes: classes,            // classes(result.edges, marks, params): the display classes again, for new marks, without the rest
  outline: outlineOf,          // outline(mask, W, H, box, 'python' | 'pixel'): the loops of one mass
  _last: null,
  _: {Raster: Raster, label: label, edt: edt, dilCross: dilCross, closing: closing, gauss: gauss, thin: thin, graphOf: graphOf, fieldOf: fieldOf, contours: contours, boxOf: boxOf, inside: inside, settings: settings}
};
root.Bands = api;
})(typeof window !== 'undefined' ? window : this);
