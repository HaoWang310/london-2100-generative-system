/* Structure Studio · the opening film's data (24 Nov 2026).
   Everything the film shows is computed here from the site the page has opened, so it holds on any site:
     fromSnap(snap)            the ground: outline, water, context, the tensor-field streets and their junctions,
                               and what the street blocks would be if the main and through streets became 20 m corridors
     fromStructure(F, site, P) the corridor net (step 5): cells, nodes and the angles at them, primaries, towers, streamlines
     fromDeck(DK, F)           the three-level structure (step 6): lengths, entries, ramps, spans
   Plain data out (no functions), so it can be posted to the film's worker. Used by intro.js and by intro.test.mjs. */
(function (root) {
'use strict';
const R = p => [Math.round(p[0]), Math.round(p[1])];
// Douglas–Peucker; a closed ring is simplified in two halves (its ends coincide)
function dp(pts, tol) {
  if (pts.length < 3) return pts.slice();
  const keep = new Uint8Array(pts.length); keep[0] = keep[pts.length - 1] = 1; const st = [[0, pts.length - 1]];
  while (st.length) { const [a, b] = st.pop(); let md = 0, mi = -1; const [ax, ay] = pts[a], [bx, by] = pts[b], L = Math.hypot(bx - ax, by - ay) || 1;
    for (let i = a + 1; i < b; i++) { const d = Math.abs((bx - ax) * (ay - pts[i][1]) - (ax - pts[i][0]) * (by - ay)) / L; if (d > md) { md = d; mi = i; } }
    if (md > tol) { keep[mi] = 1; st.push([a, mi], [mi, b]); } }
  return pts.filter((_, i) => keep[i]);
}
function S(pts, tol) { tol = tol == null ? 2.5 : tol; const n = pts.length; if (n < 2) return pts.map(R);
  const closed = n > 3 && Math.hypot(pts[0][0] - pts[n - 1][0], pts[0][1] - pts[n - 1][1]) < 1e-6;
  if (!closed) return dp(pts, tol).map(R); const m = n >> 1; return [...dp(pts.slice(0, m + 1), tol), ...dp(pts.slice(m), tol).slice(1)].map(R); }
const area = P => { let a = 0; for (let i = 0, j = P.length - 1; i < P.length; j = i++) a += (P[j][0] + P[i][0]) * (P[j][1] - P[i][1]); return Math.abs(a / 2); };
const inPoly = (x, y, P) => { let c = false; for (let i = 0, j = P.length - 1; i < P.length; j = i++) if ((P[i][1] > y) !== (P[j][1] > y) && x < (P[j][0] - P[i][0]) * (y - P[i][1]) / (P[j][1] - P[i][1]) + P[i][0]) c = !c; return c; };

// street blocks if the main and through streets were made into corridors of width `w`: count and mean size, on a grid of `res` m
function streetBlocks(snap, w, res) { w = w || 20; res = res || 5;
  const W = Math.ceil(snap.w / res), H = Math.ceil(snap.h / res), land = new Uint8Array(W * H), tmp = new Uint8Array(W * H);
  // even-odd scanline fill of a set of rings into tmp (toggled), sampling cell centres
  const fill = rings => { tmp.fill(0); for (const P of rings) { if (!P || P.length < 3) continue;
      for (let r = 0; r < H; r++) { const y = (r + 0.5) * res, xs = [];
        for (let i = 0, j = P.length - 1; i < P.length; j = i++) { const [xi, yi] = P[i], [xj, yj] = P[j]; if ((yi > y) !== (yj > y)) xs.push(xi + (y - yi) * (xj - xi) / (yj - yi)); }
        if (xs.length < 2) continue; xs.sort((a, b) => a - b);
        for (let k = 0; k + 1 < xs.length; k += 2) { const c0 = Math.max(0, Math.ceil(xs[k] / res - 0.5)), c1 = Math.min(W - 1, Math.floor(xs[k + 1] / res - 0.5)); for (let c = c0; c <= c1; c++) tmp[r * W + c] ^= 1; } } } };
  for (const pc of snap.pieces) { fill([pc.outer, ...(pc.holes || [])]); for (let i = 0; i < land.length; i++) if (tmp[i]) land[i] = 1; }
  for (const wp of snap.water || []) { fill([wp[0]]); for (let i = 0; i < land.length; i++) if (tmp[i]) land[i] = 0; }
  const half = w / 2;
  for (const rd of snap.roads) { if (rd.grade === 'local') continue; const P = rd.pts;
    for (let i = 1; i < P.length; i++) { const [ax, ay] = P[i - 1], [bx, by] = P[i], L = Math.hypot(bx - ax, by - ay), n = Math.max(1, Math.ceil(L / (res / 2)));
      for (let k = 0; k <= n; k++) { const x = ax + (bx - ax) * k / n, y = ay + (by - ay) * k / n, c0 = Math.floor((x - half) / res), c1 = Math.floor((x + half) / res), r0 = Math.floor((y - half) / res), r1 = Math.floor((y + half) / res);
        for (let r = Math.max(0, r0); r <= Math.min(H - 1, r1); r++) for (let c = Math.max(0, c0); c <= Math.min(W - 1, c1); c++) { const cx = (c + 0.5) * res, cy = (r + 0.5) * res; if ((cx - x) ** 2 + (cy - y) ** 2 <= half * half) land[r * W + c] = 0; } } } }
  const seen = new Uint8Array(W * H), q = new Int32Array(W * H), sizes = [];
  for (let i = 0; i < land.length; i++) { if (!land[i] || seen[i]) continue; let h = 0, t = 0; q[t++] = i; seen[i] = 1;
    while (h < t) { const k = q[h++], r = (k / W) | 0, c = k % W; if (c > 0 && land[k - 1] && !seen[k - 1]) { seen[k - 1] = 1; q[t++] = k - 1; } if (c < W - 1 && land[k + 1] && !seen[k + 1]) { seen[k + 1] = 1; q[t++] = k + 1; }
      if (r > 0 && land[k - W] && !seen[k - W]) { seen[k - W] = 1; q[t++] = k - W; } if (r < H - 1 && land[k + W] && !seen[k + W]) { seen[k + W] = 1; q[t++] = k + W; } }
    sizes.push(t * res * res / 1e4); }
  const big = sizes.filter(a => a >= 0.5).sort((a, b) => a - b);
  return { n: big.length, medianHa: big.length ? +big[big.length >> 1].toFixed(1) : 0 };
}

function fromSnap(snap) {
  const D = { w: Math.round(snap.w), h: Math.round(snap.h) };
  D.outline = snap.pieces.map(p => [S(p.outer, 3), ...(p.holes || []).map(h => S(h, 3))]);
  D.water = (snap.water || []).filter(w => w[0] && w[0].length > 2).map(poly => poly.map(r => S(r, 3)));
  D.roads = snap.roads.map(r => ({ g: (r.grade || 'local')[0], p: S(r.pts, 2) }));
  D.junc = (snap.junctions || []).map(j => [Math.round(j.x), Math.round(j.y), j.type]);
  D.attr = (snap.attractors || []).map(a => [a.x, a.y, a.kind]);
  const cx = snap.context || {};
  D.ctx = { prim: (cx.prim || []).map(l => S(l, 3)), urban: (cx.urban || []).map(poly => poly.map(r => S(r, 6))), bld: (cx.bld || []).map(poly => S(poly[0], 2)) };
  let A = 0; for (const pc of snap.pieces) { A += area(pc.outer); for (const h of pc.holes || []) A -= area(h); }
  const st = snap.stats || {}, nJ = D.junc.length || 1, pct = t => Math.round(D.junc.filter(j => j[2] === t).length / nJ * 100);
  const km = g => snap.roads.filter(r => g.includes(r.grade)).reduce((s, r) => { let l = 0; for (let i = 1; i < r.pts.length; i++) l += Math.hypot(r.pts[i][0] - r.pts[i - 1][0], r.pts[i][1] - r.pts[i - 1][1]); return s + l; }, 0) / 1000;
  const blocks = streetBlocks(snap);
  D.stats = { landHa: Math.round(A / 1e4), roads: snap.roads.length, km1: +(st.km1 != null ? st.km1 : km(['main'])).toFixed(1), km2: +(st.km2 != null ? st.km2 : km(['through', 'local'])).toFixed(1),
    T: Math.round(st.T != null ? st.T : pct('T')), X: Math.round(st.X != null ? st.X : pct('X')), Y: Math.round(st.Y != null ? st.Y : pct('Y')), blocks: blocks.n, blockHa: blocks.medianHa };
  return D;
}

// streamlines of the tensor field's major direction, evenly seeded (site.field(p) → unit vector or null)
function streamlines(site, w, h) { const sl = [], occ = new Map(), key = (x, y) => Math.floor(x / 55) + ',' + Math.floor(y / 55);
  const trace = (x0, y0, sgn) => { const pts = []; let x = x0, y = y0, pd = null;
    for (let k = 0; k < 140; k++) { if (!site.inSite([x, y])) break; const v = site.field([x, y]); if (!v) break; let u = v[0], q = v[1]; if (pd && u * pd[0] + q * pd[1] < 0) { u = -u; q = -q; } if (!pd && sgn < 0) { u = -u; q = -q; } pd = [u, q];
      const kk = key(x, y); if (k > 3 && occ.has(kk) && occ.get(kk) !== sl.length) break; pts.push([x, y]); x += u * 12; y += q * 12; }
    return pts; };
  for (let gy = 40; gy < h; gy += 110) for (let gx = 40; gx < w; gx += 110) { const x = gx + ((gy / 110) % 2) * 55, y = gy; if (!site.inSite([x, y]) || occ.has(key(x, y))) continue;
    const a = trace(x, y, 1), b = trace(x, y, -1), pts = [...b.reverse(), ...a.slice(1)]; if (pts.length < 8) continue; for (const p of pts) occ.set(key(p[0], p[1]), sl.length); sl.push(S(pts, 2)); }
  return sl; }

function fromStructure(F, site, P) {
  const D = {};
  D.cells = F.cellPolys.map(c => S(c.poly, 1.5));
  D.nodes = F.nodeP.map(R);
  const deg = new Array(F.nodeP.length).fill(0); for (const e of F.edges) { deg[e.a]++; deg[e.b]++; } D.deg = deg;
  D.strands = F.strands.map(s => S(s.filter(site.inSite), 4)).filter(s => s.length > 1);
  D.towers = F.towers.map(t => [Math.round(t[0]), Math.round(t[1])]);
  D.cores = site.cores.map(c => R(c.p || c));
  D.stream = streamlines(site, site.snap ? site.snap.w : 3000, site.snap ? site.snap.h : 3000);
  D.P = { sCore: P.sCore, sOut: P.sOut, coreR: P.coreR };
  const adj = new Map(); for (const e of F.edges) { (adj.get(e.a) || adj.set(e.a, []).get(e.a)).push(e.b); (adj.get(e.b) || adj.set(e.b, []).get(e.b)).push(e.a); }
  const big = []; for (const [k, ns] of adj) { if (ns.length !== 3) continue; const p = F.nodeP[k], a = ns.map(n => Math.atan2(F.nodeP[n][1] - p[1], F.nodeP[n][0] - p[0])).sort((x, y) => x - y);
    big.push(Math.max(a[1] - a[0], a[2] - a[1], 2 * Math.PI + a[0] - a[2]) * 180 / Math.PI); }
  const nodes = [...adj.values()].filter(ns => ns.length >= 3).length, land = site.landHa * 1e4;
  D.stats = { d1: Math.round(F.stats.d1), d2: Math.round(F.stats.d2), nodes, nodes3: big.length, Tlike: big.length ? Math.round(big.filter(x => x >= 160).length / big.length * 100) : 0,
    cells: F.stats.cells, totKm: +(F.stats.totL / 1000).toFixed(1), corr: Math.round(F.stats.corrA / land * 100), farm: Math.round(F.stats.farmA / land * 100), towers: F.towers.length };
  return D;
}

function fromDeck(DK, F) { const s = DK.stats || {};
  return { lenKm: +((s.lenKm || 0)).toFixed(1), entries: s.entries || 0, r12: s.r12 || 0, r23: s.r23 || 0, l3nodes: s.l3nodes || 0, bridges: F.nBridge || 0, bridgeKm: +((F.bridgeL || 0) / 1000).toFixed(1),
    ramps: (DK.ramps || []).map(r => [r.kind[0], r.kind[1], +r.a[0].toFixed(1), +r.a[1].toFixed(1), +r.b[0].toFixed(1), +r.b[1].toFixed(1)]) }; }

const API = { fromSnap, fromStructure, fromDeck, streetBlocks, simplify: S };
if (typeof module !== 'undefined' && module.exports) module.exports = API; else root.SSIntroData = API;
})(typeof self !== 'undefined' ? self : this);
