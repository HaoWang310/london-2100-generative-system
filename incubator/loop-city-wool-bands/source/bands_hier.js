// ================================================================ the road hierarchy (21 Nov 2026), as network_set3.py
// The rule, the same for any set of cells:
//   1  the cell boundary is class 1 (90 m)
//   2  every existing road is ONE road with ONE class along its whole length. It starts with the class its number
//      gives it: motorways and A1 to A99 class 2 (60 m); A100 to A999 class 3 (48 m); the rest class 4
//   3  class 2 by spacing: find the place furthest from a class 1-2 road. If it is further than the reach (2.5 km):
//        a  existing first: an existing road of a lower class that passes within reach is raised WHOLE to class 2
//        b  otherwise a new road is run through the place along the wool, the smoothest way out in both directions
//           until each end meets a class 1-2 road. A new road may cross an existing road, never run along one
//      repeat until no place is further than the reach
//   4  class 3 the same (1.25 km). For class 3 the boundary between two cells does not count as a road already there
//   5  an A road that stops on a primary road or a shared boundary carries on to the next A road
//   6  every other road is class 4 (30 m where it carries some wool, else 24 m)
// Works on the result of Bands.run (R.edges, R.box) and the page's own road data (class, number, line).
const BH = { ORD: { B: 0, 48: 1, 60: 2, H: 3 }, RANKS: 'MTAaBb', CL: { M: '60', T: '60', A: '48', a: 'B', B: 'B', b: 'B' }, W: { M: 60, T: 60, A: 48, a: 30, B: 30, b: 24 }, BACK: 600, CARRY: 5000 };
function bhRank(c, n) {                          // the class of an existing road from its own number: fewer digits, a more important road
  const d = ((n || '').split('(')[0].match(/[0-9]/g) || []).length || 9;
  if (c === 'M' || /\(M\)/.test(n || '')) return 'M';
  if (c === 'A') return d <= 2 ? 'T' : d === 3 ? 'A' : 'a';
  return d <= 3 ? 'B' : 'b';
}
function bhIndex(cell) {                         // points in a hash of squares: the nearest one within a radius
  const m = new Map(), key = (i, j) => (i + 40000) * 100000 + (j + 40000);
  return { add(x, y, id) { const k = key(Math.floor(x / cell), Math.floor(y / cell)); let a = m.get(k); if (!a) m.set(k, a = []); a.push(x, y, id); },
    nearest(x, y, r) { let bd = r * r, bi = -1; const i0 = Math.floor((x - r) / cell), i1 = Math.floor((x + r) / cell), j0 = Math.floor((y - r) / cell), j1 = Math.floor((y + r) / cell);
      for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) { const a = m.get(key(i, j)); if (!a) continue; for (let q = 0; q < a.length; q += 3) { const d = (a[q] - x) * (a[q] - x) + (a[q + 1] - y) * (a[q + 1] - y); if (d <= bd) { bd = d; bi = a[q + 2]; } } }
      return bi < 0 ? null : [Math.sqrt(bd), bi]; },
    each(x, y, r, f) { const i0 = Math.floor((x - r) / cell), i1 = Math.floor((x + r) / cell), j0 = Math.floor((y - r) / cell), j1 = Math.floor((y + r) / cell);
      for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) { const a = m.get(key(i, j)); if (!a) continue; for (let q = 0; q < a.length; q += 3) if ((a[q] - x) * (a[q] - x) + (a[q + 1] - y) * (a[q + 1] - y) <= r * r) f(a[q + 2]); } } };
}
function bhResample(p, s, closed) {              // a flat polyline with a point every s metres
  const q = closed ? [...p, p[0], p[1]] : p, out = []; let acc = 0; out.push(q[0], q[1]);
  for (let i = 2; i < q.length; i += 2) { const dx = q[i] - q[i - 2], dy = q[i + 1] - q[i - 1], L = Math.hypot(dx, dy); if (!L) continue; let t = s - acc; while (t <= L) { out.push(q[i - 2] + dx * t / L, q[i - 1] + dy * t / L); t += s; } acc = L - (t - s); }
  if (!closed) out.push(q[q.length - 2], q[q.length - 1]); return out;
}
const bhAng = (a, b) => Math.abs(((a - b + Math.PI / 2) % Math.PI + Math.PI) % Math.PI - Math.PI / 2);
const bhLen = p => { let L = 0; for (let i = 2; i < p.length; i += 2) L += Math.hypot(p[i] - p[i - 2], p[i + 1] - p[i - 1]); return L; };
function bhTan(p) { const n = p.length / 2, a = new Float64Array(n); for (let i = 0; i < n; i++) { const i0 = Math.max(0, i - 1), i1 = Math.min(n - 1, i + 1); a[i] = Math.atan2(p[2 * i1 + 1] - p[2 * i0 + 1], p[2 * i1] - p[2 * i0]); } return a; }

function bhHierarchy(R, opt) {
  const E = R.edges, [x0, y0, x1, y1] = R.box, ORD = BH.ORD, R2 = opt.r2, R3 = opt.r3, t0 = performance.now();
  for (const e of E) { e.pts = Float64Array.from(e.pts0); e.len = bhLen(e.pts); e.on = null; e.unit = -1; e.up = false; e.inner = false; e.cl = null; }
  // ---- the ground on a 50 m grid: inside the cells, and the distance routine
  const gs = 50, gw = Math.ceil((x1 - x0) / gs), gh = Math.ceil((y1 - y0) / gs), gi = (x, y) => { const c = Math.floor((x - x0) / gs), r = Math.floor((y1 - y) / gs); return c < 0 || r < 0 || c >= gw || r >= gh ? -1 : r * gw + c; };
  const cvI = document.createElement('canvas'); cvI.width = gw; cvI.height = gh; const gI = cvI.getContext('2d', { willReadFrequently: true }); gI.fillStyle = '#fff'; gI.strokeStyle = '#fff'; gI.lineWidth = 1.2;
  for (const c of DATA.cells) { gI.beginPath(); for (let i = 0; i < c.ring.length; i += 2) gI[i ? 'lineTo' : 'moveTo']((c.ring[i] - x0) / gs, (y1 - c.ring[i + 1]) / gs); gI.closePath(); gI.fill(); gI.stroke(); }
  const idat = gI.getImageData(0, 0, gw, gh).data, inside = new Uint8Array(gw * gh); for (let i = 0; i < gw * gh; i++) inside[i] = idat[4 * i + 3] > 100 ? 1 : 0;
  const isIn = (x, y) => { const k = gi(x, y); return k >= 0 && inside[k] === 1; };
  const field = mask => { const d = bdEDT(mask, gw, gh, false), o = new Float32Array(gw * gh); for (let i = 0; i < o.length; i++) o[i] = Math.sqrt(d[i]) * gs; return o; };
  const mark = (mask, p) => { for (let i = 0; i < p.length; i += 2) { const k = gi(p[i], p[i + 1]); if (k >= 0) mask[k] = 1; } };
  const at = (F, x, y) => { const k = gi(x, y); return k < 0 ? 1e9 : F[k]; };
  // ---- the cell boundary as points
  const ring = [], rang = [], ringIdx = bhIndex(150), ringMask = new Uint8Array(gw * gh);
  for (const c of DATA.cells) { const q = bhResample(Array.from(c.ring), 14, true), a = bhTan(q); for (let i = 0; i < q.length; i += 2) { ringIdx.add(q[i], q[i + 1], rang.length); rang.push(a[i / 2]); } mark(ringMask, q); }
  const Dring = field(ringMask);
  // ---- the existing roads as real lines, the parts inside the cells; a stretch along the cell edge is the boundary itself
  const X = [];
  for (const q of (typeof EXIST !== 'undefined' ? EXIST : [])) {
    const cl = EX_CLS[q.c] || q.c; if (!'MAB'.includes(cl)) continue;
    let bx0 = 1e18, by0 = 1e18, bx1 = -1e18, by1 = -1e18; for (let i = 0; i < q.p.length; i += 2) { bx0 = Math.min(bx0, q.p[i]); bx1 = Math.max(bx1, q.p[i]); by0 = Math.min(by0, q.p[i + 1]); by1 = Math.max(by1, q.p[i + 1]); }
    if (bx1 < x0 || bx0 > x1 || by1 < y0 || by0 > y1) continue;
    const p = bhResample(Array.from(q.p), 10, false), n = p.length / 2; if (n < 3) continue; const a = bhTan(p); let i = 0;
    const keep = j => { const x = p[2 * j], y = p[2 * j + 1]; if (!isIn(x, y)) return false; const nr = ringIdx.nearest(x, y, 150); return !(nr && bhAng(a[j], rang[nr[1]]) < 0.5); };
    while (i < n) { if (!keep(i)) { i++; continue; } let j = i; while (j < n && keep(j)) j++; if (j - i >= 20) X.push({ c: cl, n: q.n || '', k: bhRank(cl, q.n), P: Float64Array.from(p.slice(2 * i, 2 * j)) }); i = j; }
  }
  // ---- whole roads: the lines of one number that touch are one road
  const par = X.map((_, i) => i), find = i => { while (par[i] !== i) { par[i] = par[par[i]]; i = par[i]; } return i; }, groups = new Map();
  X.forEach((x, i) => { const k = (x.n || '#' + i) + '|' + x.k; if (!groups.has(k)) groups.set(k, []); groups.get(k).push(i); });
  for (const ids of groups.values()) {
    if (ids.length < 2) continue; const ix = bhIndex(80); for (const i of ids) { const P = X[i].P; for (let j = 0; j < P.length; j += 2) ix.add(P[j], P[j + 1], i); }
    for (const i of ids) { const P = X[i].P, m = P.length / 2; for (let j = 0; j < m; j += (j === 0 || j + 25 < m ? 25 : m - 1 - j) || 1) { ix.each(P[2 * j], P[2 * j + 1], 80, o => { if (o !== i) par[find(i)] = find(o); }); if (j === m - 1) break; } }
  }
  const U = new Map();
  X.forEach((x, i) => { x.u = find(i); if (!U.has(x.u)) U.set(x.u, { id: x.u, n: x.n, k: x.k, feat: [], L: 0, ends: [], cl: BH.CL[x.k], raised: false }); const u = U.get(x.u); u.feat.push(i); u.L += bhLen(x.P); });
  for (const u of U.values()) {
    const ix = bhIndex(80); for (const i of u.feat) { const P = X[i].P; for (let j = 0; j < P.length; j += 2) ix.add(P[j], P[j + 1], i); }
    for (const i of u.feat) { const P = X[i].P, m = P.length / 2;
      for (const [j, j2] of [[0, Math.min(8, m - 1)], [m - 1, Math.max(0, m - 9)]]) { let alone = true; ix.each(P[2 * j], P[2 * j + 1], 80, o => { if (o !== i) alone = false; });
        if (alone) { const dx = P[2 * j] - P[2 * j2], dy = P[2 * j + 1] - P[2 * j2 + 1], L = Math.hypot(dx, dy) || 1e-9; u.ends.push([P[2 * j], P[2 * j + 1], dx / L, dy / L]); } } }
  }
  // ---- the network as a graph
  const adj = new Map(), pos = new Map();
  E.forEach((e, i) => { const q = e.pts, n = q.length / 2; if (!adj.has(e.a)) adj.set(e.a, []); if (!adj.has(e.b)) adj.set(e.b, []); adj.get(e.a).push([i, 0]); adj.get(e.b).push([i, 1]); if (!pos.has(e.a)) pos.set(e.a, [q[0], q[1]]); if (!pos.has(e.b)) pos.set(e.b, [q[2 * n - 2], q[2 * n - 1]]); });
  const other = (i, end) => (end === 0 ? E[i].b : E[i].a);
  // ---- which pieces are the boundary, which lie on an existing road
  const xIdx = bhIndex(60), xu = [], xk = [], xa = [], xx = [], xy = [];
  X.forEach(x => { const a = bhTan(x.P); for (let j = 0; j < x.P.length; j += 2) { xIdx.add(x.P[j], x.P[j + 1], xu.length); xu.push(x.u); xk.push(BH.RANKS.indexOf(x.k)); xa.push(a[j / 2]); xx.push(x.P[j]); xy.push(x.P[j + 1]); } });
  const wgt = [1.5, 1.4, 1.2, 1.1, 1, 1];
  for (const e of E) {
    const q = e.pts, n = q.length / 2, a = bhTan(q), cnt = [0, 0, 0, 0, 0, 0], us = [new Map(), new Map(), new Map(), new Map(), new Map(), new Map()]; let rim = 0, ok = 0;
    for (let j = 0; j < n; j++) { const x = q[2 * j], y = q[2 * j + 1], nr = ringIdx.nearest(x, y, 150); if (nr && bhAng(a[j], rang[nr[1]]) < 0.6) rim++;
      const nx = xIdx.nearest(x, y, 60); if (nx && bhAng(a[j], xa[nx[1]]) < 0.6) { ok++; const k = xk[nx[1]]; cnt[k]++; us[k].set(xu[nx[1]], (us[k].get(xu[nx[1]]) || 0) + 1); } }
    e.rimf = rim / n; e.exf = ok / n; e.H = !!e.rim || e.rimf >= 0.7;
    if (!e.H && e.exf >= 0.6) { let bk = 0, bv = -1; for (let k = 0; k < 6; k++) if (cnt[k] * wgt[k] > bv) { bv = cnt[k] * wgt[k]; bk = k; } e.on = BH.RANKS[bk]; let bu = -1, bn = 0; for (const [u, v] of us[bk]) if (v > bn) { bn = v; bu = u; } e.unit = bu; }
  }
  const sk = bdStrokes(E);
  for (let pass = 0; pass < 3; pass++) E.forEach((e, i) => {            // a short piece between two boundary pieces is boundary; between two pieces of one existing road, that road
    if (e.H) return; const nb = [e.a, e.b].map(n => adj.get(n).map(v => v[0]).filter(j => j !== i));
    if (e.len < 900 && e.rimf >= 0.35 && nb.every(q => q.some(j => E[j].H))) { e.H = true; e.on = null; e.unit = -1; return; }
    if (!e.on && e.len < 500 && e.exf >= 0.3) { const cs = nb.map(q => q.filter(j => E[j].on && sk[j] === sk[i])); const j0 = cs[0].find(j => cs[1].some(k => E[k].on === E[j].on)); if (j0 !== undefined) { e.on = E[j0].on; e.unit = E[j0].unit; } }
  });
  for (let pass = 0; pass < 3; pass++) {                                   // the boundary is one continuous highway: where it still stops, the two ends are joined along the network
    const deg = new Map(); for (const e of E) if (e.H) for (const n of [e.a, e.b]) deg.set(n, (deg.get(n) || 0) + 1);
    const ends = [...deg].filter(v => v[1] === 1).map(v => v[0]); let added = 0;
    for (const u of ends) for (const v of ends) {
      if (u === v) continue; const pu = pos.get(u), pv = pos.get(v), d0 = Math.hypot(pu[0] - pv[0], pu[1] - pv[1]); if (!(d0 > 0 && d0 < 1800)) continue;
      const lim = 1.6 * d0 + 100, best = new Map([[u, 0]]), prev = new Map(), hp = Heap(); hp.push(0, u);
      while (hp.size) { const [c, n] = hp.pop(); if (n === v || c > lim) break; if (c > best.get(n)) continue;
        for (const [i, end] of adj.get(n)) { if (E[i].H || E[i].rimf < 0.3) continue; const n2 = other(i, end), c2 = c + E[i].len; if (c2 < (best.has(n2) ? best.get(n2) : 1e18)) { best.set(n2, c2); prev.set(n2, [n, i]); hp.push(c2, n2); } } }
      if (best.has(v) && best.get(v) <= lim) { let n = v; while (prev.has(n)) { const [m, i] = prev.get(n); E[i].H = true; E[i].on = null; E[i].unit = -1; added++; n = m; } }
    }
    if (!added) break;
  }
  // ---- junctions on an existing road sit on the real line; the new roads that meet there bend to follow
  const T = new Map();
  for (const e of E) { if (!e.on) continue; const q = e.pts, n = q.length / 2; for (const [node, j] of [[e.a, 0], [e.b, n - 1]]) { const nx = xIdx.nearest(q[2 * j], q[2 * j + 1], 150); if (nx) T.set(node, [xx[nx[1]], xy[nx[1]]]); } }
  const follow = (Tm, skip) => E.forEach((e, i) => { if (skip(e, i)) return; const q = e.pts, m = q.length / 2, mm = Math.max(1, Math.min(18, m >> 1));
    for (const [node, end] of [[e.a, 0], [e.b, 1]]) { const v = Tm.get(node); if (!v) continue; const j0 = end ? m - 1 : 0, dx = v[0] - q[2 * j0], dy = v[1] - q[2 * j0 + 1]; if (Math.hypot(dx, dy) < 0.01) continue;
      for (let k = 0; k < mm; k++) { const j = end ? m - 1 - k : k, w = 1 - k / mm; q[2 * j] += dx * w; q[2 * j + 1] += dy * w; } } });
  follow(T, e => !!e.on || e.H); for (const [n, v] of T) pos.set(n, v);
  // ---- classes to start with, and the leaving directions
  const LV = E.map(e => { const q = e.pts, n = q.length / 2, k = Math.min(n - 1, 8), u = (ax, ay, bx, by) => { const L = Math.hypot(bx - ax, by - ay) || 1e-9; return [(bx - ax) / L, (by - ay) / L]; };
    return [u(q[0], q[1], q[2 * k], q[2 * k + 1]), u(q[2 * n - 2], q[2 * n - 1], q[2 * (n - 1 - k)], q[2 * (n - 1 - k) + 1])]; });
  for (const e of E) {
    e.cl = e.H ? 'H' : e.on ? U.get(e.unit).cl : null;
    if (e.H) { const q = e.pts, n = q.length / 2, a = bhTan(q); let both = 0; for (let j = 0; j < n; j++) { const nx = -Math.sin(a[j]) * 220, ny = Math.cos(a[j]) * 220; if (isIn(q[2 * j] + nx, q[2 * j + 1] + ny) && isIn(q[2 * j] - nx, q[2 * j + 1] - ny)) both++; } e.inner = both / n > 0.6; }
  }
  const hN = new Set(); for (const e of E) if (e.H) { hN.add(e.a); hN.add(e.b); }
  const nodeIdx = bhIndex(300); for (const [n, p] of pos) nodeIdx.add(p[0], p[1], n);
  // ---- the places to serve: one every 200 m inside the cells
  const S = []; for (let r = 0; r < gh; r += 4) for (let c = 0; c < gw; c += 4) if (inside[r * gw + c]) S.push(r * gw + c);
  const sxy = k => [x0 + (k % gw + 0.5) * gs, y1 - (Math.floor(k / gw) + 0.5) * gs];
  const search = (n0, go0, origin, goal, factor, limit) => {                 // the smoothest way on from junction n0, setting out in direction go0, to the first junction that is a goal
    const best = new Map(), prev = new Map(), hp = Heap(), K = (i, n) => (i < 0 ? -1 : i * 2 + (E[i].b === n ? 1 : 0)); best.set(-1, 0); hp.push(0, [-1, n0]);
    while (hp.size) {
      const [c0, [cur, n]] = hp.pop(), kc = K(cur, n); if (c0 > best.get(kc)) continue;
      if (goal(n)) { const path = []; let st = [cur, n]; while (st[0] >= 0) { path.push(st); st = prev.get(K(st[0], st[1])); } return path.reverse(); }
      if (c0 > limit) return null;
      const go = cur < 0 ? go0 : (() => { const v = LV[cur][E[cur].a === n ? 0 : 1]; return [-v[0], -v[1]]; })(), pn = pos.get(n), dn = Math.hypot(pn[0] - origin[0], pn[1] - origin[1]);
      for (const [j, ej] of adj.get(n)) {
        if (j === cur) continue; const f = factor(j); if (f === null) continue;
        const n2 = other(j, ej), dot = LV[j][ej][0] * go[0] + LV[j][ej][1] * go[1], p2 = pos.get(n2);
        if (dot < 0.342 || Math.hypot(p2[0] - origin[0], p2[1] - origin[1]) < dn - BH.BACK) continue;       // no turn over 70 degrees; never coming back towards where it set out
        const th = Math.acos(Math.max(-1, Math.min(1, dot))), c2 = c0 + E[j].len * f + 400 * (th / (Math.PI / 4)) ** 2, k2 = K(j, n2);
        if (c2 < (best.has(k2) ? best.get(k2) : 1e18)) { best.set(k2, c2); prev.set(k2, [cur, n]); hp.push(c2, [j, n2]); }
      }
    }
    return null;
  };
  const ent = (j, nArr) => (E[j].b !== nArr ? 1 : 0);
  const take = (route, level) => { for (const [j] of route) { if (E[j].cl === null) E[j].cl = level; else if (E[j].on && ORD[E[j].cl] < ORD[level]) { E[j].cl = level; E[j].up = true; } } };
  const shortOn = j => !!E[j].on && E[j].len < 350, out = {};
  const grow = (level, reach, apart, isNet, cross, gmin) => {
    const routes = [], raised = [], dead = new Uint8Array(gw * gh), deadU = new Set(); let nnew = 0, D = null;
    const netField = () => { const m = new Uint8Array(gw * gh); for (const e of E) if (isNet(e)) mark(m, e.pts); for (const u of U.values()) if (ORD[u.cl] >= ORD[level]) for (const i of u.feat) mark(m, X[i].P); return field(m); };
    for (let it = 0; it < 300; it++) {
      D = netField(); let k = -1, dk = reach; for (const s of S) if (!dead[s] && D[s] > dk) { dk = D[s]; k = s; }
      if (k < 0) break;
      const c = sxy(k), netN = new Set(); for (const e of E) if (isNet(e)) { netN.add(e.a); netN.add(e.b); }
      const cand = [];                                                       // a  existing first: the whole road is raised
      if (opt.exfirst) for (const u of U.values()) {
        if (ORD[u.cl] >= ORD[level] || deadU.has(u.id) || u.L < 2000) continue;
        let near = false, n = 0, beside = 0; const seen = new Set();
        for (const i of u.feat) { const P = X[i].P; for (let j = 0; j < P.length; j += 8) { n++; if (at(D, P[j], P[j + 1]) < apart) beside++; if (Math.hypot(P[j] - c[0], P[j + 1] - c[1]) <= reach) near = true; } }
        if (!near || beside / n > 0.5) continue;
        const rr = Math.ceil(reach / 200);                                    // the places it would bring within reach
        for (const i of u.feat) { const P = X[i].P; for (let j = 0; j < P.length; j += 20) { const c0 = Math.floor((P[j] - x0) / gs / 4), r0 = Math.floor((y1 - P[j + 1]) / gs / 4);
          for (let r = r0 - rr; r <= r0 + rr; r++) for (let cc = c0 - rr; cc <= c0 + rr; cc++) { if (r < 0 || cc < 0 || r * 4 >= gh || cc * 4 >= gw) continue; const s = r * 4 * gw + cc * 4; if (!inside[s] || dead[s] || D[s] <= reach || seen.has(s)) continue; const p = sxy(s); if (Math.hypot(p[0] - P[j], p[1] - P[j + 1]) <= reach) seen.add(s); } } }
        if (seen.size >= gmin) cand.push([seen.size, u]);
      }
      cand.sort((a, b) => b[0] - a[0]); let done = false;
      for (const [, u] of cand) {
        const ext = []; let ok = true;
        for (const [ex, ey, dx, dy] of u.ends) {
          if (at(Dring, ex, ey) < 300 || at(D, ex, ey) < 300) continue;
          const nn = nodeIdx.nearest(ex, ey, 300); if (!nn) { ok = false; break; }
          const path = search(nn[1], [dx, dy], [ex, ey], m => netN.has(m) || hN.has(m), j => (E[j].cl === null ? 1 : shortOn(j) ? 2 : null), BH.CARRY);
          if (!path) { ok = false; break; } ext.push(path.map(([j, m]) => [j, ent(j, m)]));
        }
        if (!ok) { deadU.add(u.id); continue; }
        u.cl = level; u.raised = true; raised.push(u.n || 'a road without a number'); for (const e of E) if (e.on && e.unit === u.id) e.cl = level;
        for (const r of ext) if (r.length) { take(r, level); routes.push(r); }
        done = true; break;
      }
      if (done) continue;
      let ec = -1, bd = 1e18;                                                // b  a new road along the wool, through the place
      E.forEach((e, i) => { if (e.cl !== null) return; const q = e.pts; for (let j = 0; j < q.length; j += 6) { const d = (q[j] - c[0]) ** 2 + (q[j + 1] - c[1]) ** 2; if (d < bd) { bd = d; ec = i; } } });
      const kill = () => { for (const s of S) { const p = sxy(s); if (Math.hypot(p[0] - c[0], p[1] - c[1]) < 600) dead[s] = 1; } };
      if (ec < 0) break; if (Math.sqrt(bd) > reach) { kill(); continue; }     // the middle of a big parcel or a town: no road can bring it within reach
      const sm = new Uint8Array(gw * gh); for (const e of E) if (e.cl === 'H' || e.cl === '60' || e.cl === '48') mark(sm, e.pts); for (const u of U.values()) if (u.cl !== 'B') for (const i of u.feat) mark(sm, X[i].P); const Ds = field(sm);
      const banned = new Set([ec]), hug = j => { const q = E[j].pts, m = (q.length >> 2) * 2; return at(Ds, q[m], q[m + 1]) < apart; };
      const factor = j => (banned.has(j) ? null : E[j].cl === null ? (hug(j) ? 1.5 : 1) : (shortOn(j) || cross(E[j])) ? 2 : null);
      const p1 = search(E[ec].b, [-LV[ec][1][0], -LV[ec][1][1]], pos.get(E[ec].b), n => netN.has(n), factor, 30000);
      if (p1) for (const [j] of p1) banned.add(j);
      const p2 = p1 ? search(E[ec].a, [-LV[ec][0][0], -LV[ec][0][1]], pos.get(E[ec].a), n => netN.has(n), factor, 30000) : null;
      if (!p1 || !p2) { kill(); continue; }
      const route = [...p2.slice().reverse().map(([j, n]) => [j, 1 - ent(j, n)]), [ec, 0], ...p1.map(([j, n]) => [j, ent(j, n)])]; take(route, level); routes.push(route); nnew++;
    }
    D = netField(); let inR = 0, far = 0; for (const s of S) { if (D[s] <= reach) inR++; far = Math.max(far, D[s]); }
    out[level] = { raised, 'new roads': nnew, 'land within reach %': Math.round(1000 * inR / Math.max(1, S.length)) / 10, 'furthest place m': Math.round(far), 'reach m': reach };
    return routes;
  };
  const r2 = grow('60', R2, 1000, e => e.cl === 'H' || e.cl === '60', () => false, 40);
  const r3 = grow('48', R3, 500, e => e.cl === '60' || e.cl === '48' || (e.cl === 'H' && !e.inner), e => e.cl === 'H' && e.inner, 10);
  let carried = 0;                                                           // an A road that stops on a primary road or a shared boundary carries on to the next A road
  for (let pass = 0; pass < 2; pass++) {
    const deg3 = new Map(); for (const e of E) if (e.cl === '48') for (const n of [e.a, e.b]) deg3.set(n, (deg3.get(n) || 0) + 1);
    E.forEach((e, i) => {
      if (e.cl !== '48' || e.on) return;
      for (const [n, end] of [[e.a, 0], [e.b, 1]]) {
        if (deg3.get(n) !== 1 || !adj.get(n).some(([j]) => j !== i && (E[j].cl === '60' || (E[j].cl === 'H' && E[j].inner)))) continue;
        const st = pos.get(n), goal = m => m !== n && Math.hypot(pos.get(m)[0] - st[0], pos.get(m)[1] - st[1]) > 400 && adj.get(m).some(([j]) => E[j].cl === '48');
        const factor = j => (j === i ? null : E[j].cl === null ? 1 : ((E[j].cl === '60' || (E[j].cl === 'H' && E[j].inner) || E[j].on) && E[j].len < 450) ? 2 : null);
        const path = search(n, [-LV[i][end][0], -LV[i][end][1]], st, goal, factor, BH.CARRY);
        if (path && path.some(([j]) => E[j].cl === null)) { const route = path.map(([j, m]) => [j, ent(j, m)]); take(route, '48'); r3.push(route); carried++; }
      }
    });
  }
  out['48'].carried = carried;
  const runs = new Map(); E.forEach((e, i) => { if (e.cl === null) { if (!runs.has(sk[i])) runs.set(sk[i], []); runs.get(sk[i]).push(i); } });
  for (const ids of runs.values()) { let L = 0, tk = 0; for (const i of ids) { L += E[i].len; tk += E[i].len * E[i].t; } for (const i of ids) E[i].cl = tk / Math.max(1e-9, L) >= 2.5 ? '30' : '24'; }
  for (const x of X) { const u = U.get(x.u); x.cl = u.cl; x.wk = u.cl === 'B' ? (BH.W[u.k] >= 30 ? '30' : '24') : u.cl; x.raised = u.raised; }
  for (const e of E) if (e.cl === 'B') e.cl = BH.W[U.get(e.unit).k] >= 30 ? '30' : '24';
  // ---- the boundary and every chosen road smoothed end to end as one line; what meets them follows
  const inner = new Map(), onChain = new Set();
  const smoothChain = (chain, sigma, cyc) => {                               // chain: [edge, forward?] in order
    const Xs = [], Ys = [], base = []; chain.forEach(([i, fwd], k) => { const q = E[i].pts, m = q.length / 2; base.push(Xs.length - (k ? 1 : 0)); for (let j = k ? 1 : 0; j < m; j++) { const t = fwd ? j : m - 1 - j; Xs.push(q[2 * t]); Ys.push(q[2 * t + 1]); } });
    let N = Xs.length; if (N < 6) return; if (cyc) N--;
    let x = Float64Array.from(Xs.slice(0, N)), y = Float64Array.from(Ys.slice(0, N)), xb = new Float64Array(N), yb = new Float64Array(N);
    for (let r = Math.round(sigma * sigma / 98); r > 0; r--) { for (let j = 0; j < N; j++) { if (!cyc && (j === 0 || j === N - 1)) { xb[j] = x[j]; yb[j] = y[j]; continue; } const a = j ? j - 1 : N - 1, b = j < N - 1 ? j + 1 : 0; xb[j] = x[j] + 0.5 * ((x[a] + x[b]) / 2 - x[j]); yb[j] = y[j] + 0.5 * ((y[a] + y[b]) / 2 - y[j]); } let t = x; x = xb; xb = t; t = y; y = yb; yb = t; }
    chain.forEach(([i, fwd], k) => { const q = E[i].pts, m = q.length / 2; onChain.add(i); for (let j = 0; j < m; j++) { const t = fwd ? j : m - 1 - j, g = (base[k] + j) % N; q[2 * t] = x[g]; q[2 * t + 1] = y[g]; }
      if (k || cyc) { const g = base[k] % N, n0 = fwd ? E[i].a : E[i].b; if (!inner.has(n0)) inner.set(n0, [0, 0, 0]); const v = inner.get(n0); v[0] += x[g]; v[1] += y[g]; v[2]++; } });
  };
  const hGroups = new Map(); E.forEach((e, i) => { if (e.cl === 'H') { if (!hGroups.has(sk[i])) hGroups.set(sk[i], []); hGroups.get(sk[i]).push(i); } });
  for (const ids of hGroups.values()) {
    const a2 = new Map(); for (const i of ids) for (const n of [E[i].a, E[i].b]) { if (!a2.has(n)) a2.set(n, []); a2.get(n).push(i); }
    let start = null; for (const [n, v] of a2) if (v.length === 1) { start = n; break; } const cyc = start === null; if (cyc) start = a2.keys().next().value;
    const chain = [], seen = new Set(); let n = start; for (;;) { const i = a2.get(n).find(j => !seen.has(j)); if (i === undefined) break; seen.add(i); const fwd = E[i].a === n; chain.push([i, fwd]); n = fwd ? E[i].b : E[i].a; }
    smoothChain(chain, opt.line, cyc);
  }
  const split = (routes, level) => { const res = []; for (const r of routes) { let cur = []; for (const [j, end] of r) { if (E[j].cl === level && !E[j].on) cur.push([j, end === 0]); else if (cur.length) { res.push(cur); cur = []; } } if (cur.length) res.push(cur); } return res; };
  for (const ch of split(r2, '60')) smoothChain(ch, opt.line * 0.8, false);
  for (const ch of split(r3, '48')) smoothChain(ch, opt.line * 0.62, false);
  const Tm = new Map(); for (const [n, v] of inner) Tm.set(n, [v[0] / v[2], v[1] / v[2]]); follow(Tm, (e, i) => onChain.has(i) || !!e.on);
  for (const e of E) { const q = e.pts; let a = 1e18, b = 1e18, c = -1e18, d = -1e18; for (let i = 0; i < q.length; i += 2) { a = Math.min(a, q[i]); c = Math.max(c, q[i]); b = Math.min(b, q[i + 1]); d = Math.max(d, q[i + 1]); } e.bb = [a, b, c, d]; e.draw = !e.on || e.up; }
  for (const x of X) { const q = x.P; let a = 1e18, b = 1e18, c = -1e18, d = -1e18; for (let i = 0; i < q.length; i += 2) { a = Math.min(a, q[i]); c = Math.max(c, q[i]); b = Math.min(b, q[i + 1]); d = Math.max(d, q[i + 1]); } x.bb = [a, b, c, d]; x.L = bhLen(q); }
  const km = {}, add = (k, v) => { km[k] = (km[k] || 0) + v / 1000; };
  for (const e of E) if (e.draw) add({ H: '1 Boundary highway', 60: '2 Primary, new', 48: '3 A road, new', 30: '4 B road, new', 24: '4 B road, new' }[e.cl], e.len);
  for (const x of X) add({ 60: '2 Primary, existing', 48: '3 A road, existing', B: '4 B road, existing' }[x.cl], x.L);
  R.X = X; R.hier = { out, km, ms: Math.round(performance.now() - t0), units: U.size };
}
