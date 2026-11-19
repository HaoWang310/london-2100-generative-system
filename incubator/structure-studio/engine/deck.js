// 结构工作室 · 第 6 步：多层走道结构（SubD）
// 输入：第 5 步的结果 F（节点、走廊中心线、室多边形 = 走廊轮廓、塔、道路 / 水面）。
// 输出：控制网格（四边面为主）→ Catmull–Clark 细分 → 一张连续曲面。规则见 docs/DESIGN.md「第 6 步」。
(function (root) {
'use strict';
// 板厚 1 m，上下两层之间的净高 3.6 m → 层到层 4.6 m。第一层板顶 7.2 m（板底 6.2 m，街道净空 ≥ 5 m）
const THICK = 1, CLEAR = 3.6, STOREY = THICK + CLEAR, HEAD = 2.2;   // HEAD = 人能走的最小净高
const LV = [0, 7.2, 7.2 + STOREY, 7.2 + 2 * STOREY];            // 地面、L1、L2、L3 顶面标高：7.2 / 11.8 / 16.4
const DEF = { r3: 200, entrySlope: 5, rampSlope: 7, plat: 12, seg: 10, sub: 2, thick: THICK, avoidEdge: true, merge: 3, near: 1 };
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// ---------------------------------------------------------------- 走廊轮廓（室多边形）的线段索引
function outlineIndex(polys, cell) {
  const B = new Map(), segs = [];
  polys.forEach((poly, pi) => { const n = poly.length; for (let i = 0; i < n; i++) { const a = poly[i], b = poly[(i + 1) % n], id = segs.length; segs.push([a[0], a[1], b[0], b[1], pi, i]);
    const x0 = Math.floor(Math.min(a[0], b[0]) / cell), x1 = Math.floor(Math.max(a[0], b[0]) / cell), y0 = Math.floor(Math.min(a[1], b[1]) / cell), y1 = Math.floor(Math.max(a[1], b[1]) / cell);
    for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) { const k = x + ',' + y; let l = B.get(k); if (!l) B.set(k, l = []); l.push(id); } } });
  // 从 p 沿 d（单位向量）出发，maxD 内最近的轮廓交点：{ t, pi 多边形, si 边, u 边上参数 }
  function ray(p, d, maxD) { const qx = p[0] + d[0] * maxD, qy = p[1] + d[1] * maxD, x0 = Math.floor(Math.min(p[0], qx) / cell), x1 = Math.floor(Math.max(p[0], qx) / cell), y0 = Math.floor(Math.min(p[1], qy) / cell), y1 = Math.floor(Math.max(p[1], qy) / cell);
    let best = null; const seen = new Set();
    for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) { const l = B.get(x + ',' + y); if (!l) continue;
      for (const id of l) { if (seen.has(id)) continue; seen.add(id); const s = segs[id], ex = s[2] - s[0], ey = s[3] - s[1], den = d[0] * ey - d[1] * ex; if (Math.abs(den) < 1e-9) continue;
        const wx = s[0] - p[0], wy = s[1] - p[1], t = (wx * ey - wy * ex) / den, u = (wx * d[1] - wy * d[0]) / den;
        if (t >= 0 && t <= maxD && u >= -1e-6 && u <= 1 + 1e-6 && (!best || t < best.t)) best = { t, pi: s[4], si: s[5], u: clamp(u, 0, 1) }; } }
    return best; }
  // 到轮廓的最近距离（校验用）
  function dist(p, maxD) { const x0 = Math.floor((p[0] - maxD) / cell), x1 = Math.floor((p[0] + maxD) / cell), y0 = Math.floor((p[1] - maxD) / cell), y1 = Math.floor((p[1] + maxD) / cell); let best = maxD;
    for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) { const l = B.get(x + ',' + y); if (!l) continue;
      for (const id of l) { const s = segs[id], ex = s[2] - s[0], ey = s[3] - s[1], t = clamp(((p[0] - s[0]) * ex + (p[1] - s[1]) * ey) / (ex * ex + ey * ey || 1), 0, 1), dd = Math.hypot(p[0] - s[0] - ex * t, p[1] - s[1] - ey * t); if (dd < best) best = dd; } }
    return best; }
  return { ray, dist };
}
// 沿多边形从交点 h0 走到 h1（取较短的一侧），每 step 米取一个点（不含两端）
function walkOutline(poly, h0, h1, step) {
  const n = poly.length, pos = h => h.si + h.u, at = s => { const i = Math.floor(s) % n, u = s - Math.floor(s), a = poly[i], b = poly[(i + 1) % n]; return [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u]; };
  const path = dir => { const out = [at(pos(h0))]; let s = pos(h0), end = pos(h1); if (dir > 0) { if (end < s) end += n; for (let i = Math.floor(s) + 1; i < end; i++) out.push(poly[i % n]); } else { if (end > s) end -= n; for (let i = Math.ceil(s) - 1; i > end; i--) out.push(poly[((i % n) + n) % n]); } out.push(at(pos(h1))); return out; };
  const len = Q => { let l = 0; for (let i = 1; i < Q.length; i++) l += Math.hypot(Q[i][0] - Q[i - 1][0], Q[i][1] - Q[i - 1][1]); return l; };
  const A = path(1), Bk = path(-1), Q = len(A) <= len(Bk) ? A : Bk, L = len(Q); if (L < step * 0.75) return { pts: [], len: L };
  const m = Math.max(1, Math.round(L / step) - 1), out = []; let acc = 0, j = 1, la = 0;
  for (let k = 1; k <= m; k++) { const tgt = L * k / (m + 1); while (j < Q.length) { const l = Math.hypot(Q[j][0] - Q[j - 1][0], Q[j][1] - Q[j - 1][1]); if (acc + l >= tgt) { const u = (tgt - acc) / (l || 1); out.push([Q[j - 1][0] + (Q[j][0] - Q[j - 1][0]) * u, Q[j - 1][1] + (Q[j][1] - Q[j - 1][1]) * u]); break; } acc += l; j++; } }
  return { pts: out, len: L };
}

// 两条线段是否真相交（端点相接不算）
function segX(a, b, c, d) { const o = (p, q, r) => (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]); const d1 = o(a, b, c), d2 = o(a, b, d), d3 = o(c, d, a), d4 = o(c, d, b); return d1 * d2 < -1e-9 && d3 * d4 < -1e-9; }
// 两条线段之间的最短距离
function segD(a, b, c, d) { if (segX(a, b, c, d)) return 0; const pd = (p, q, r) => { const ex = r[0] - q[0], ey = r[1] - q[1], t = Math.max(0, Math.min(1, ((p[0] - q[0]) * ex + (p[1] - q[1]) * ey) / (ex * ex + ey * ey || 1))); return Math.hypot(p[0] - q[0] - ex * t, p[1] - q[1] - ey * t); }; return Math.min(pd(a, c, d), pd(b, c, d), pd(c, a, b), pd(d, a, b)); }
// 简单多边形（逆时针）切耳三角化，返回顶点序号三元组；失败返回 null
function earClip(P) {
  const n = P.length; if (n < 3) return null; let A = 0; for (let i = 0; i < n; i++) A += P[i][0] * P[(i + 1) % n][1] - P[(i + 1) % n][0] * P[i][1]; if (A <= 0) return null;
  const idx = P.map((_, i) => i), out = [], cr = (a, b, c) => (P[b][0] - P[a][0]) * (P[c][1] - P[a][1]) - (P[b][1] - P[a][1]) * (P[c][0] - P[a][0]);
  const inside = (a, b, c, q) => cr(a, b, q) > 1e-9 && cr(b, c, q) > 1e-9 && cr(c, a, q) > 1e-9;
  let guard = 0; while (idx.length > 3 && guard++ < 4 * n * n) { let best = -1, bq = -1; const m = idx.length;
    for (let i = 0; i < m; i++) { const a = idx[(i + m - 1) % m], b = idx[i], c = idx[(i + 1) % m], ar = cr(a, b, c); if (ar <= 1e-9) continue; let ok = true; for (const q of idx) if (q !== a && q !== b && q !== c && inside(a, b, c, q)) { ok = false; break; } if (!ok) continue;
      const l1 = Math.hypot(P[b][0] - P[a][0], P[b][1] - P[a][1]), l2 = Math.hypot(P[c][0] - P[b][0], P[c][1] - P[b][1]), l3 = Math.hypot(P[a][0] - P[c][0], P[a][1] - P[c][1]), ql = ar / (l1 * l1 + l2 * l2 + l3 * l3); if (ql > bq) { bq = ql; best = i; } }   // 取最饱满的耳，少出细长三角
    if (best < 0) { let fl = -1; for (let i = 0; i < m; i++) if (Math.abs(cr(idx[(i + m - 1) % m], idx[i], idx[(i + 1) % m])) <= 1e-9) { fl = i; break; } if (fl < 0) return null; idx.splice(fl, 1); continue; }   // 共线点直接跳过
    out.push([idx[(best + m - 1) % m], idx[best], idx[(best + 1) % m]]); idx.splice(best, 1); }
  if (idx.length === 3 && cr(idx[0], idx[1], idx[2]) > 1e-9) out.push([idx[0], idx[1], idx[2]]); return out.length ? out : null;
}

// ---------------------------------------------------------------- 规则 → 控制网格
function buildDeck(F, opt) {
  const D = Object.assign({}, DEF, opt || {}), site = F.site, N = F.nodeP, towers = F.towers;
  // 第 5 步里两条线相交的路口常被存成两个位置相同的节点（各连两条走道）。这里先把位置相同的节点当成同一个，
  // 否则一个路口会做出两块互不相连的板。FB = 换成统一节点号之后的走道表。
  const cn = N.map((_, i) => i); { const cell = new Map(); N.forEach((p, i) => { const k = Math.round(p[0] / 1.5) + ',' + Math.round(p[1] / 1.5); let hit = -1;
      for (let dx = -1; dx <= 1 && hit < 0; dx++) for (let dy = -1; dy <= 1 && hit < 0; dy++) { for (const q of cell.get((Math.round(p[0] / 1.5) + dx) + ',' + (Math.round(p[1] / 1.5) + dy)) || []) if (Math.hypot(N[q][0] - p[0], N[q][1] - p[1]) < 1.5) { hit = q; break; } }
      if (hit >= 0) cn[i] = hit; else { if (!cell.has(k)) cell.set(k, []); cell.get(k).push(i); } }); }
  const FB = F.fibres.map(f => Object.assign({}, f, { a: cn[f.a], b: cn[f.b] })), twins = cn.filter((c, i) => c !== i).length;
  const OI = outlineIndex(F.cellPolys.map(c => c.poly), 40);
  const inSite = p => site.inSite(p), inWater = p => site.inWater(p), roadD = p => site.roadDistAll ? site.roadDistAll(p) : 1e9;
  const dTow = N.map(p => { let d = 1e9; for (const t of towers) d = Math.min(d, Math.hypot(p[0] - t[0], p[1] - t[1])); return d; });
  const big = towers.filter(t => !t[4]);                        // 大塔 = 主吸引点上的塔（方案甲：只有它们带 L3）
  // ---- 靠得很近的节点并成一块板：两节点间距 < merge × 走道宽时，各自的节点板会在中间的短走道上互相叠压。
  //      并板后短走道不再单独生成，板边取这组节点所有外伸走道之间的走廊轮廓。
  const par = N.map((_, i) => i), find = i => { while (par[i] !== i) i = par[i] = par[par[i]]; return i; }, short = new Set();
  if (D.merge > 0) FB.forEach((f, fi) => { const a = N[f.a], b = N[f.b]; if (Math.hypot(b[0] - a[0], b[1] - a[1]) < D.merge * f.w && inSite(a) && inSite(b)) { short.add(fi); par[find(f.a)] = find(f.b); } });
  // 相距不到 near × 走道宽的节点，即使中间没有走道相连，也并成一块板
  const nearPairs = []; if (D.merge > 0 && D.near > 0) { const wN = new Map(); FB.forEach(f => { for (const n of [f.a, f.b]) wN.set(n, Math.max(wN.get(n) || 0, f.w)); }); const ids = [...wN.keys()].filter(i => inSite(N[i]));
    for (let x = 0; x < ids.length; x++) for (let y = x + 1; y < ids.length; y++) { const i = ids[x], k = ids[y]; if (find(i) === find(k)) continue; const d = Math.hypot(N[i][0] - N[k][0], N[i][1] - N[k][1]); if (d >= D.near * Math.max(wN.get(i), wN.get(k))) continue;
      if (d > 1e-6 && OI.ray(N[i], [(N[k][0] - N[i][0]) / d, (N[k][1] - N[i][1]) / d], d)) continue;                    // 中间隔着地块（两条并排的走道）不并
      par[find(i)] = find(k); nearPairs.push([i, k]); } }
  const grp = new Map(); N.forEach((_, i) => { if (cn[i] !== i) return; const r = find(i); if (!grp.has(r)) grp.set(r, []); grp.get(r).push(i); });
  const cenOf = j => { const g = grp.get(j); let x = 0, y = 0; for (const i of g) { x += N[i][0]; y += N[i][1]; } return [x / g.length, y / g.length]; };
  const spanOf = j => { const g = grp.get(j), c = cenOf(j); let r = 0; for (const i of g) r = Math.max(r, Math.hypot(N[i][0] - c[0], N[i][1] - c[1])); return r; };
  // ---- 走道口退让：同一块节点板上的各条走道，口部（端面）要退到互不压住为止。
  //      夹角小的两条走道在节点附近是叠在一起的，口部留在那里板就会自己压自己。
  const ends = new Map(), mg = new Map(); let absorbed = 0;
  FB.forEach((f, fi) => { if (short.has(fi)) return; const a = N[f.a], b = N[f.b], L = Math.hypot(b[0] - a[0], b[1] - a[1]); if (L < 6) return; const ra = find(f.a), rb = find(f.b);
    if (D.merge > 0 && ra === rb && inSite(a) && inSite(b)) { short.add(fi); absorbed++; return; }                    // 两端在同一块板上的走道并进板里
    const t = [(b[0] - a[0]) / L, (b[1] - a[1]) / L], init = Math.min(1.25 * f.w, 0.36 * L), cap = Math.max(init, 0.8 * L), H = 0.62 * f.w;
    for (const [key, r, o, d] of [[fi + 'a', ra, a, t], [fi + 'b', rb, b, [-t[0], -t[1]]]]) { const e = { key, fi, node: key.endsWith('a') ? f.a : f.b, o, d, L, H, m: init, cap, w: f.w }; mg.set(key, e); if (!ends.has(r)) ends.set(r, []); ends.get(r).push(e); } });
  const face = e => { if (e.fm === e.m) return e.fc; const c = [e.o[0] + e.d[0] * e.m, e.o[1] + e.d[1] * e.m], nl = [-e.d[1], e.d[0]], hw = h => (h ? Math.max(h.t, 0.25 * e.w) : 0.5 * e.w) + 1.5;   // 口部按走廊轮廓的实际半宽
    const wl = hw(OI.ray(c, nl, 1.6 * e.w)), wr = hw(OI.ray(c, [-nl[0], -nl[1]], 1.6 * e.w)); e.H = Math.max(wl, wr); e.fm = e.m;
    return e.fc = [[c[0] + nl[0] * wl, c[1] + nl[1] * wl], [c[0] - nl[0] * wr, c[1] - nl[1] * wr], c, [e.o[0] + e.d[0] * e.L, e.o[1] + e.d[1] * e.L]]; };
  const clash = (e, f) => { const A = face(e), B = face(f); if (e.fi === f.fi) return false; return segD(A[0], A[1], B[0], B[1]) < 1 || segD(A[0], A[1], B[2], B[3]) < f.H || segD(B[0], B[1], A[2], A[3]) < e.H; };
  for (const lst of ends.values()) for (let it = 0; it < 60; it++) { let moved = false;
    for (let i = 0; i < lst.length; i++) for (let k = i + 1; k < lst.length; k++) { const e = lst[i], f = lst[k]; if (!clash(e, f)) continue; for (const x of [e, f]) if (x.m < x.cap) { x.m = Math.min(x.cap, x.m + 0.2 * x.w); moved = true; } }
    if (!moved) break; }
  for (const lst of ends.values()) if (lst.length === 1) lst[0].m = 0;                                 // 尽端：走道一直做到节点
  let tight = 0; for (const lst of ends.values()) for (let i = 0; i < lst.length; i++) for (let k = i + 1; k < lst.length; k++) if (clash(lst[i], lst[k])) tight++;
  // ---- 分支：节点之间的直线段，按场地红线裁剪；两端各退出一段节点板
  const PCS = [];
  FB.forEach((f, fi) => { const a = N[f.a], b = N[f.b], L = Math.hypot(b[0] - a[0], b[1] - a[1]); if (L < 6 || short.has(fi)) return;
    const t = [(b[0] - a[0]) / L, (b[1] - a[1]) / L], nrm = [-t[1], t[0]], at = s => [a[0] + t[0] * s, a[1] + t[1] * s];
    let sA = 0, sB = L; const okA = inSite(a), okB = inSite(b);                       // 场内的连续段
    if (okA) { sB = L; for (let s = 2; s <= L; s += 2) if (!inSite(at(s))) { sB = s - 2; break; } }
    const runs = []; if (okA && sB >= L - 1e-6 && okB) runs.push([0, L, f.a, f.b]);
    else { if (okA && sB > 3) runs.push([0, sB, f.a, -1]); if (okB) { let s0 = 0; for (let s = L - 2; s >= 0; s -= 2) if (!inSite(at(s))) { s0 = s + 2; break; } if (L - s0 > 3 && !(okA && sB >= s0)) runs.push([s0, L, -1, f.b]); } }
    for (const [r0, r1, na, nb] of runs) { const w = f.w, len0 = r1 - r0, mA0 = na >= 0 ? Math.min(mg.get(fi + 'a').m, 0.8 * len0) : 0, mB0 = nb >= 0 ? Math.min(mg.get(fi + 'b').m, 0.8 * len0) : 0, fit = mA0 + mB0 > 0.88 * len0 ? 0.88 * len0 / (mA0 + mB0) : 1, mA = mA0 * fit, mB = mB0 * fit, u0 = r0 + mA, u1 = r1 - mB, n = Math.max(1, Math.round((u1 - u0) / D.seg)), seg = (u1 - u0) / n;
      const P = [], hl = [], hr = [], hitL = [], hitR = [], fl = [];
      for (let k = 0; k <= n; k++) { const p = at(u0 + seg * k); P.push(p);
        const L_ = OI.ray(p, nrm, 1.6 * w), R_ = OI.ray(p, [-nrm[0], -nrm[1]], 1.6 * w);
        hl.push(L_ ? Math.max(L_.t, 0.25 * w) : 0.5 * w); hr.push(R_ ? Math.max(R_.t, 0.25 * w) : 0.5 * w); hitL.push(L_); hitR.push(R_);
        let flag = 0; for (let o = -seg / 2; o <= seg / 2 + 1e-6 && !flag; o += 2) { const q = at(clamp(u0 + seg * k + o, r0, r1)); flag = inWater(q) ? 1 : roadD(q) <= w / 2 + 3 ? 3 : 0; } fl.push(flag); }   // 站点前后半段内有水 / 路都算
      // 伸出红线的一端：板做到红线，沿红线平口切断（左、中、右三点各自沿走道方向走到红线上）
      const EP = {}, cutAt = (k, dir) => { const reach = (p0) => { let q = 0; if (!inSite(p0)) { for (q = -0.5; q > -0.8 * seg; q -= 0.5) if (inSite([p0[0] + t[0] * dir * q, p0[1] + t[1] * dir * q])) break; } else for (; q < 2.5 * w; q += 0.5) if (!inSite([p0[0] + t[0] * dir * (q + 0.5), p0[1] + t[1] * dir * (q + 0.5)])) break; return [p0[0] + t[0] * dir * q, p0[1] + t[1] * dir * q]; };
        EP[k] = [reach([P[k][0] + nrm[0] * hl[k], P[k][1] + nrm[1] * hl[k]]), reach(P[k]), reach([P[k][0] - nrm[0] * hr[k], P[k][1] - nrm[1] * hr[k]])]; };
      if (nb < 0) cutAt(n, 1); if (na < 0) cutAt(0, -1);
      PCS.push({ id: PCS.length, fi, a: na < 0 ? -1 : find(na), b: nb < 0 ? -1 : find(nb), a0: na, b0: nb, EP, prim: !!f.prim, w, n, seg, P, N: nrm, T: t, hl, hr, hitL, hitR, fl, len: u1 - u0, land: null, ld: 0 }); } });
  // ---- 第三层：大塔 r3 内的节点，避开水面和场地边缘；板边放不下坡时往外推
  const in3 = N.map(p => big.some(t => Math.hypot(p[0] - t[0], p[1] - t[1]) < D.r3)); N.forEach((_, i) => { if (in3[i]) in3[find(cn[i])] = true; }); N.forEach((_, i) => { in3[i] = in3[find(cn[i])]; });
  if (D.avoidEdge) { const cut = new Set(); for (const pc of PCS) { if (pc.a < 0 && pc.b >= 0 && pc.len < 60) cut.add(pc.b); if (pc.b < 0 && pc.a >= 0 && pc.len < 60) cut.add(pc.a);
      const k = Math.min(pc.n, Math.ceil(40 / pc.seg)); for (let i = 0; i <= k; i++) { if (pc.a >= 0 && pc.fl[i] === 1) cut.add(pc.a); if (pc.b >= 0 && pc.fl[pc.n - i] === 1) cut.add(pc.b); } }
    for (const j of cut) in3[j] = false; }
  const nSeg = (len, pc) => Math.max(2, Math.round(len / pc.seg)), nPlat = pc => Math.max(1, Math.round(D.plat / pc.seg));
  const mLvl = pc => nSeg(STOREY * D.rampSlope, pc), mEnt = pc => nSeg(LV[1] * D.entrySlope, pc);
  const mode = pc => { const za = pc.a >= 0 && in3[pc.a], zb = pc.b >= 0 && in3[pc.b]; if ((za || zb) && (pc.a < 0 || pc.b < 0) && pc.n < mLvl(pc) + nPlat(pc)) return 'full';   // 伸到红线的短段放不下坡：三层板直接做到红线
    return za && zb ? 'full' : za ? 'A' : zb ? 'B' : null; };
  let grown = 0;
  for (let it = 0; it < 12; it++) { let ch = false; for (const pc of PCS) { const md = mode(pc); if ((md === 'A' || md === 'B') && pc.a >= 0 && pc.b >= 0 && pc.n < mLvl(pc) + nPlat(pc)) { in3[md === 'A' ? pc.b : pc.a] = true; ch = true; grown++; } } if (!ch) break; }
  // ---- 排坡
  const ramps = []; let alt = 0;
  const order = PCS.slice().sort((p, q) => Math.min(p.a >= 0 ? dTow[p.a] : 1e9, p.b >= 0 ? dTow[p.b] : 1e9) - Math.min(q.a >= 0 ? dTow[q.a] : 1e9, q.b >= 0 ? dTow[q.b] : 1e9));
  for (const pc of order) { const n = pc.n, ml = mLvl(pc), me = mEnt(pc), pl = nPlat(pc); let lo = n - 2 >= ml ? 1 : 0, hi = n - 2 >= ml ? n - 1 : n;
    if (pc.a < 0) lo = 0; if (pc.b < 0) hi = n;
    const side = () => (alt++ % 2 ? 0 : 2), md = mode(pc);
    const up = pc.a >= 0 && pc.b >= 0 ? (dTow[pc.b] < dTow[pc.a] ? 1 : -1) : pc.b >= 0 ? 1 : -1;     // 上坡朝离塔更近的一端
    if (md === 'A' || md === 'B') { let ld = pl, m3 = ml; if (n < ml + pl) { ld = n >= 3 ? 1 : 0; m3 = Math.max(1, n - ld); pc.steep = true; } pc.land = md; pc.ld = ld;
      if (md === 'A') { ramps.push({ pc, ka: ld, m: m3, up: -1, side: side(), kind: [2, 3] }); lo = Math.max(lo, ld + m3 + 1); } else { ramps.push({ pc, ka: n - m3 - ld, m: m3, up: 1, side: side(), kind: [2, 3] }); hi = Math.min(hi, n - ld - m3 - 1); } }
    // 地面入口：整条坡不压道路、不压水面
    let ent = null; if (hi - lo >= me) { const tryAt = s => { for (let k = s; k <= s + me; k++) if (pc.fl[k] !== 0) return false; return true; };
      if (up > 0) { for (let s = hi - me; s >= lo; s--) if (tryAt(s)) { ent = s; break; } } else { for (let s = lo; s <= hi - me; s++) if (tryAt(s)) { ent = s; break; } }
      if (ent == null) pc.noEntry = 'road'; } else pc.noEntry = 'short';
    if (ent != null) { ramps.push({ pc, ka: ent, m: me, up, side: side(), kind: [0, 1] }); const l = [lo, ent - 1], r = [ent + me + 1, hi]; if (l[1] - l[0] >= r[1] - r[0]) { lo = l[0]; hi = l[1]; } else { lo = r[0]; hi = r[1]; } }
    if (hi - lo >= ml) { const s = lo + Math.floor((hi - lo - ml) / 2); ramps.push({ pc, ka: s, m: ml, up, side: side(), kind: [1, 2] }); }
  }
  // ---- 控制网格
  const V = [], vid = new Map(), FC = [], FT = [];
  const vert = (key, x, y, z) => { let i = vid.get(key); if (i === undefined) { i = V.length / 3; vid.set(key, i); V.push(x, y, z); } return i; };
  const edgeP = (pc, k, c) => pc.EP[k] ? pc.EP[k][c] : c === 1 ? pc.P[k] : c === 0 ? [pc.P[k][0] + pc.N[0] * pc.hl[k], pc.P[k][1] + pc.N[1] * pc.hl[k]] : [pc.P[k][0] - pc.N[0] * pc.hr[k], pc.P[k][1] - pc.N[1] * pc.hr[k]];
  const pv = (pc, l, k, c) => { const p = edgeP(pc, k, c); return vert(pc.id + '_' + l + '_' + k + '_' + c, p[0], p[1], LV[l]); };
  // 所有面统一成俯视逆时针（法线朝上）。坡道和收尖的面按走向 / 左右侧生成，原来有一半是顺时针：
  // 法线朝下的面在三维里会被阴影偏移推到板的下面，整块显示成阴影色，看起来像板断开了一段。
  const add = (f, lv) => { let a = 0; for (let k = 0, n = f.length; k < n; k++) { const p = 3 * f[k], q = 3 * f[(k + 1) % n]; a += V[p] * V[q + 1] - V[q] * V[p + 1]; } FC.push(a < 0 ? f.slice().reverse() : f); FT.push(lv); }, dedupe = q => q.filter((x, i) => q.indexOf(x) === i);
  const removed = new Set();
  for (const r of ramps) for (let s = r.ka; s < r.ka + r.m; s++) { removed.add(r.pc.id + '_' + r.kind[1] + '_' + s + '_' + r.side); if (r.kind[0] > 0) removed.add(r.pc.id + '_' + r.kind[0] + '_' + s + '_' + r.side); }
  for (const pc of PCS) { const md = mode(pc);
    for (let l = 1; l <= 3; l++) { if (l === 3 && md !== 'full' && !pc.land) continue;
      for (let k = 0; k < pc.n; k++) { if (l === 3 && pc.land === 'A' && k >= pc.ld) continue; if (l === 3 && pc.land === 'B' && k < pc.n - pc.ld) continue;
        for (const sd of [0, 2]) { if (removed.has(pc.id + '_' + l + '_' + k + '_' + sd)) continue;
          add(sd === 0 ? [pv(pc, l, k, 0), pv(pc, l, k, 1), pv(pc, l, k + 1, 1), pv(pc, l, k + 1, 0)] : [pv(pc, l, k, 1), pv(pc, l, k, 2), pv(pc, l, k + 1, 2), pv(pc, l, k + 1, 1)], l); } } } }
  ramps.forEach((r, ri) => { const pc = r.pc, lo = r.kind[0], hi = r.kind[1], m = r.m, rise = LV[hi] - LV[lo]; let ks = []; for (let k = r.ka; k <= r.ka + m; k++) ks.push(k); if (r.up < 0) ks.reverse();
    const sg = r.side === 0 ? 1 : -1, row = [], kmax = Math.max(...ks), tp = hi === 3 && !!pc.land, oth = 2 - r.side, hwS = k => r.side === 0 ? pc.hl[k] : pc.hr[k], hwO = k => r.side === 0 ? pc.hr[k] : pc.hl[k];
    const us = [0, 0.3]; for (let i = 1; i < m; i++) us.push(i); us.push(m - 0.3, m);
    us.forEach((u, i) => { const kf = ks[0] + (ks[ks.length - 1] - ks[0]) * u / m, k0 = Math.floor(Math.min(kf, kmax - 1e-9)), fr = kf - k0, k1 = Math.min(k0 + 1, pc.n);
      const px = pc.P[k0][0] * (1 - fr) + pc.P[k1][0] * fr, py = pc.P[k0][1] * (1 - fr) + pc.P[k1][1] * fr, ws = hwS(k0) * (1 - fr) + hwS(k1) * fr, wo = hwO(k0) * (1 - fr) + hwO(k1) * fr;
      const t = clamp((u - 0.3) / (m - 0.6), 0, 1), z = LV[lo] + rise * t, nx = pc.N[0] * sg, ny = pc.N[1] * sg;
      if (i === 0 && lo > 0) row.push([pv(pc, lo, ks[0], r.side), pv(pc, lo, ks[0], 1), -1]);
      else if (i === us.length - 1) row.push([pv(pc, hi, ks[ks.length - 1], r.side), pv(pc, hi, ks[ks.length - 1], 1), -1]);
      else { const g = tp ? 0 : 0.22 * ws * Math.sin(Math.PI * u / m), wf = wo * Math.pow(u / m, 1.25);
        row.push([vert('r' + ri + '_' + i + '_0', px + nx * ws, py + ny * ws, z), vert('r' + ri + '_' + i + '_1', px + nx * g, py + ny * g, z), -1]); } });
    for (let i = 0; i < us.length - 1; i++) add([row[i][0], row[i][1], row[i + 1][1], row[i + 1][0]], hi);
    // 被坡打断的走道沿坡逐渐收窄成尖
    // 收尖的长度：收尖的板和坡道上下相叠，只叠到净高还够 HEAD 的地方为止（层间坡约为坡长的 30%），不留走不了人的夹角
    const Jn = Math.max(1, Math.min(m, Math.floor(m * Math.min(0.6, Math.max(0, rise - D.thick - HEAD) / rise) + 1e-6))), mate = (a, lv) => ramps.some(q => q !== r && q.pc === pc && q.side === r.side && q.kind[a] === lv && Math.abs(q.ka - r.ka) < 1);
    const taper = (lv, seq, tag, side = r.side, Jn_ = Jn) => { const Jn = Math.max(1, Math.min(seq.length - 1, Jn_)), sg = side === 0 ? 1 : -1, hw = k => side === 0 ? pc.hl[k] : pc.hr[k], E = [pv(pc, lv, seq[0], side)];
      for (let j = 1; j <= Jn; j++) { const k = seq[j]; if (j === Jn) E.push(pv(pc, lv, k, 1)); else { const w = hw(k) * Math.pow(1 - j / Jn, 1.25); E.push(vert(tag + ri + '_' + j, pc.P[k][0] + pc.N[0] * sg * w, pc.P[k][1] + pc.N[1] * sg * w, LV[lv])); } }
      for (let j = 0; j < Jn; j++) { const q = dedupe([pv(pc, lv, seq[j], 1), E[j], E[j + 1], pv(pc, lv, seq[j + 1], 1)]); if (q.length >= 3) add(q, lv); } };
    if (!tp && !mate(0, hi)) taper(hi, ks, 'th');
    if (tp) taper(hi, ks.slice().reverse(), 'tt', oth, m);     // 第三层板边：坡道一侧沿坡下去，另一侧的板留在第三层标高、沿坡长收成尖（水平的，不跟着坡倾斜，下面第二层净高不变）
    if (lo > 0 && !mate(1, lo)) taper(lo, ks.slice().reverse(), 'tl'); });
  // ---- 节点板：把相邻两条分支之间的走廊轮廓（第 5 步的过渡曲线）取成板边
  const inc = new Map(); for (const pc of PCS) { if (pc.a >= 0) { if (!inc.has(pc.a)) inc.set(pc.a, []); inc.get(pc.a).push([pc, 0]); } if (pc.b >= 0) { if (!inc.has(pc.b)) inc.set(pc.b, []); inc.get(pc.b).push([pc, 1]); } }
  let gapOn = 0, gapOff = 0, badPlates = 0, looseOrder = 0, arcs = 0;
  // 并板后各条走道绕板一圈的先后：沿着组内短走道连成的小网，贴着外侧逆时针走一圈，依次遇到的走道口就是板边的顺序
  const inner = new Map(), link = (u, v) => { if (u === v) return; for (const [p, q] of [[u, v], [v, u]]) { if (!inner.has(p)) inner.set(p, []); if (!inner.get(p).includes(q)) inner.get(p).push(q); } }; for (const fi of short) link(FB[fi].a, FB[fi].b); for (const [u, v] of nearPairs) link(u, v);
  function walkOrder(j, lst) { const adj = new Map(), A = (u, p) => Math.atan2(p[1] - N[u][1], p[0] - N[u][0]);
    for (const u of grp.get(j)) adj.set(u, (inner.get(u) || []).map(v => ({ v, a: A(u, N[v]) })));
    for (const x of lst) { const u = x[1] === 0 ? x[0].a0 : x[0].b0; if (!adj.has(u)) return null; const k = x[1] === 0 ? 0 : x[0].n; adj.get(u).push({ x, a: A(u, x[0].P[k]) }); }
    for (const l of adj.values()) l.sort((p, q) => p.a - q.a);
    const out = [], x0 = lst[0], u0 = x0[1] === 0 ? x0[0].a0 : x0[0].b0; let u = u0, i = adj.get(u).findIndex(e => e.x === x0);
    for (let guard = 0; guard < 400; guard++) { const e = adj.get(u)[i]; if (e.x) { if (e.x === x0 && out.length) break; out.push(e.x); i = (i + 1) % adj.get(u).length; }
      else { const l = adj.get(e.v), back = l.findIndex(q => q.v === u && !q.used); const b = back < 0 ? l.findIndex(q => q.v === u) : back; u = e.v; i = (b + 1) % l.length; } }
    return out.length === lst.length ? out : null; }
  for (const [j, lst] of inc) { const pj = cenOf(j), wide = spanOf(j), endK = x => x[1] === 0 ? 0 : x[0].n, ang = x => { const p = x[0].P[endK(x)]; return Math.atan2(p[1] - pj[1], p[0] - pj[0]); };
    lst.sort((p, q) => ang(p) - ang(q));
    if (grp.get(j).length > 1) { const od = walkOrder(j, lst); if (od) { lst.length = 0; for (const x of od) lst.push(x); } else looseOrder++; }
    // 逆时针绕节点：每条分支的端面按 右 → 中 → 左 的顺序；相邻分支之间插入轮廓上的点
    const ring = []; for (let i = 0; i < lst.length; i++) { const x = lst[i], y = lst[(i + 1) % lst.length], k = endK(x), fwd = x[1] === 0;      // fwd：分支方向背离节点
      ring.push({ pc: x[0], k, c: fwd ? 2 : 0 }, { pc: x[0], k, c: 1 }, { pc: x[0], k, c: fwd ? 0 : 2 });
      if (lst.length < 2) continue; const hx = fwd ? x[0].hitL[k] : x[0].hitR[k], ky = endK(y), hy = y[1] === 0 ? y[0].hitR[ky] : y[0].hitL[ky];
      if (hx && hy && hx.pi === hy.pi) { const wk = walkOutline(F.cellPolys[hx.pi].poly, hx, hy, 0.8 * D.seg); if (wk.len < 6 * x[0].w + 2.5 * wide) { wk.pts.forEach((p, gi) => ring.push({ g: j + '_' + i + '_' + gi, p })); gapOn++; continue; } }
      // 两个走道口之间取不到走廊轮廓、而这一侧张角又很大时（两条走道朝同一边伸出），板边绕节点外侧补一段圆弧，把节点包进板里
      gapOff++; const TAU = 2 * Math.PI, pa = edgeP(x[0], k, fwd ? 0 : 2), pb = edgeP(y[0], ky, y[1] === 0 ? 2 : 0), a0 = Math.atan2(pa[1] - pj[1], pa[0] - pj[0]), sp = ((Math.atan2(pb[1] - pj[1], pb[0] - pj[0]) - a0) % TAU + TAU) % TAU;
      if (sp > 1.9 && lst.length === 2 && grp.get(j).length === 1) { const r = 0.55 * x[0].w, m = Math.ceil(sp / 0.6); for (let q = 1; q < m; q++) { const th = a0 + sp * q / m; ring.push({ g: j + '_' + i + '_a' + q, p: [pj[0] + r * Math.cos(th), pj[1] + r * Math.sin(th)] }); } arcs++; } }
    if (lst.length < 2) continue;                                            // 尽端：端面三点共线，不成板
    // 板的外圈必须是一条不打结的闭合线：轮廓上的点如果让外圈自交（交点落在板边后面、或绕到了别的走道口后面），去掉它
    const R2 = ring.map(q => ({ q, p: q.pc ? edgeP(q.pc, q.k, q.c) : q.p }));
    for (let guard = 0; guard < 60; guard++) { const n = R2.length; let hit = -1;
      for (let a = 0; a < n && hit < 0; a++) for (let b = a + 2; b < n; b++) { if (a === 0 && b === n - 1) continue; if (segX(R2[a].p, R2[(a + 1) % n].p, R2[b].p, R2[(b + 1) % n].p)) { for (const i of [(a + 1) % n, b, a, (b + 1) % n]) if (!R2[i].q.pc) { hit = i; break; } if (hit < 0) hit = -2; break; } }
      if (hit === -1) break; if (hit === -2) { badPlates++; break; } R2.splice(hit, 1); }
    const tris = earClip(R2.map(x => x.p));                                   // 切耳三角化：凹的、细长的板都不会翻面
    for (let l = 1; l <= 3; l++) { if (l === 3 && !in3[j]) continue; const ids = R2.map(x => x.q.pc ? pv(x.q.pc, l, x.q.k, x.q.c) : vert('g' + x.q.g + '_' + l, x.p[0], x.p[1], LV[l]));
      if (!tris) { add(ids, l); continue; } for (const t of tris) add([ids[t[0]], ids[t[1]], ids[t[2]]], l); } }
  const sharp = []; for (const pc of PCS) for (const k in pc.EP) for (let l = 1; l <= 3; l++) for (const c of [0, 2]) { const i = vid.get(pc.id + '_' + l + '_' + k + '_' + c); if (i !== undefined) sharp.push(i); }
  const cnt = k => ramps.filter(r => r.kind[0] === k).length, edge3 = PCS.filter(pc => pc.land).length;
  const stats = { merged: [...grp.values()].filter(g => g.length > 1).length, mergedNodes: [...grp.values()].filter(g => g.length > 1).reduce((s, g) => s + g.length, 0), shortRuns: short.size, absorbed, tight, nodes: inc.size, branches: PCS.length, l3nodes: [...inc.keys()].filter(j => in3[j]).length, l3branches: PCS.filter(pc => mode(pc) === 'full').length, entries: cnt(0), r12: cnt(1), r23: cnt(2), edges3: edge3, steep: PCS.filter(pc => pc.steep).length, grown,
    noEntryShort: PCS.filter(pc => pc.noEntry === 'short').length, noEntryRoad: PCS.filter(pc => pc.noEntry === 'road').length, gapOn, gapOff, arcs, badPlates, looseOrder, twins, nearPairs: nearPairs.length, cutEnds: PCS.filter(pc => Object.keys(pc.EP).length).length, ctrlF: FC.length, ctrlV: V.length / 3,
    lenKm: PCS.reduce((s, pc) => s + pc.len, 0) / 1000 };
  return { V: new Float64Array(V), F: FC, FT, sharp, stats, in3, outline: OI, params: D,
    ramps: ramps.map(r => ({ kind: r.kind, a: r.pc.P[r.up > 0 ? r.ka : r.ka + r.m], b: r.pc.P[r.up > 0 ? r.ka + r.m : r.ka], side: r.side })) };
}

// ---------------------------------------------------------------- Catmull–Clark（边界按三次 B 样条，角点与非流形点不动）
function catmullClark(V, F, FT, sharp) { const fix = sharp && sharp.length ? new Set(sharp) : null;
  const nV = V.length / 3, nF = F.length, fp = new Float64Array(nF * 3), emap = new Map(), ea = [], eb = [], ef = [], ec = [], fe = new Array(nF);
  for (let i = 0; i < nF; i++) { const f = F[i], n = f.length; let x = 0, y = 0, z = 0; for (const v of f) { x += V[3 * v]; y += V[3 * v + 1]; z += V[3 * v + 2]; } fp[3 * i] = x / n; fp[3 * i + 1] = y / n; fp[3 * i + 2] = z / n;
    const ids = new Array(n); for (let k = 0; k < n; k++) { const a = f[k], b = f[(k + 1) % n], lo = a < b ? a : b, hi = a < b ? b : a, key = lo * nV + hi; let e = emap.get(key);
      if (e === undefined) { e = ea.length; emap.set(key, e); ea.push(lo); eb.push(hi); ef.push(i, -1); ec.push(0); } if (ec[e] === 1) ef[2 * e + 1] = i; ec[e]++; ids[k] = e; } fe[i] = ids; }
  const nE = ea.length, out = new Float64Array((nV + nF + nE) * 3), fs = new Float64Array(nV * 3), fc = new Int32Array(nV), ms = new Float64Array(nV * 3), mc = new Int32Array(nV), bs = new Float64Array(nV * 3), bc = new Int32Array(nV);
  for (let i = 0; i < nF; i++) for (const v of F[i]) { fs[3 * v] += fp[3 * i]; fs[3 * v + 1] += fp[3 * i + 1]; fs[3 * v + 2] += fp[3 * i + 2]; fc[v]++; }
  for (let e = 0; e < nE; e++) { const a = ea[e], b = eb[e], o = 3 * (nV + nF + e);
    for (let d = 0; d < 3; d++) { const mid = (V[3 * a + d] + V[3 * b + d]) / 2; out[o + d] = ec[e] === 2 ? (V[3 * a + d] + V[3 * b + d] + fp[3 * ef[2 * e] + d] + fp[3 * ef[2 * e + 1] + d]) / 4 : mid; ms[3 * a + d] += mid; ms[3 * b + d] += mid; if (ec[e] !== 2) { bs[3 * a + d] += V[3 * b + d]; bs[3 * b + d] += V[3 * a + d]; } }
    mc[a]++; mc[b]++; if (ec[e] !== 2) { bc[a]++; bc[b]++; } }
  for (let v = 0; v < nV; v++) for (let d = 0; d < 3; d++) { const p = V[3 * v + d];
    if (fc[v] === 0 || (bc[v] !== 0 && bc[v] !== 2) || (fix && fix.has(v))) out[3 * v + d] = p; else if (bc[v] === 2) out[3 * v + d] = (6 * p + bs[3 * v + d]) / 8; else { const n = fc[v]; out[3 * v + d] = (fs[3 * v + d] / n + 2 * ms[3 * v + d] / mc[v] + (n - 3) * p) / n; } }
  out.set(fp, nV * 3); const nF2 = [], nT = [];
  for (let i = 0; i < nF; i++) { const f = F[i], n = f.length, ids = fe[i]; for (let k = 0; k < n; k++) { nF2.push([f[k], nV + nF + ids[k], nV + i, nV + nF + ids[(k + n - 1) % n]]); nT.push(FT[i]); } }
  return { V: out, F: nF2, FT: nT, sharp };
}
function subdivide(deck, levels) { let r = { V: deck.V, F: deck.F, FT: deck.FT, sharp: deck.sharp }; for (let i = 0; i < levels; i++) r = catmullClark(r.V, r.F, r.FT, r.sharp); return r; }

// ---------------------------------------------------------------- 三角网：顶面（带标高）+ 侧面（板厚）；boundary = 板边的线段（校验用）
function deckMesh(deck, levels, thick) {
  const r = subdivide(deck, levels == null ? deck.params.sub : levels), V = r.V, F = r.F, TH = thick == null ? deck.params.thick : thick, nV = V.length / 3;
  let nt = 0; for (const f of F) nt += f.length - 2; const top = new Float32Array(nt * 9), lvl = new Uint8Array(nt * 3); let o = 0, q = 0; const em = new Map();
  for (let i = 0; i < F.length; i++) { const f = F[i], n = f.length; for (let k = 1; k < n - 1; k++) for (const v of [f[0], f[k], f[k + 1]]) { top[o++] = V[3 * v]; top[o++] = V[3 * v + 1]; top[o++] = V[3 * v + 2]; lvl[q++] = r.FT[i]; }
    for (let k = 0; k < n; k++) { const a = f[k], b = f[(k + 1) % n], key = a < b ? a * nV + b : b * nV + a; em.set(key, em.has(key) ? -1 : a * nV + b); } }
  const bd = []; for (const v of em.values()) if (v >= 0) bd.push(Math.floor(v / nV), v % nV);
  const side = new Float32Array(bd.length / 2 * 18); o = 0;
  for (let i = 0; i < bd.length; i += 2) { const a = bd[i], b = bd[i + 1], A = [V[3 * a], V[3 * a + 1], V[3 * a + 2]], B = [V[3 * b], V[3 * b + 1], V[3 * b + 2]], zA = Math.max(0, A[2] - TH), zB = Math.max(0, B[2] - TH);
    for (const p of [B, A, [A[0], A[1], zA], B, [A[0], A[1], zA], [B[0], B[1], zB]])   /* 侧面法线朝外 */ { side[o++] = p[0]; side[o++] = p[1]; side[o++] = p[2]; } }
  // 底面：顶面往下一个板厚（不低于地面），三角形反向，法线朝下。顶面 + 侧面 + 底面合成封闭的实体
  const bottom = new Float32Array(top.length); for (let i = 0; i < top.length; i += 9) for (const [d, sx] of [[0, 0], [3, 6], [6, 3]]) { bottom[i + d] = top[i + sx]; bottom[i + d + 1] = top[i + sx + 1]; bottom[i + d + 2] = Math.max(0, top[i + sx + 2] - TH); }
  return { top, side, bottom, lvl, quads: F.length, V, boundary: bd };
}
// 第 4 步的桥下柱按单层板顶标高立；多层结构里凡是会从坡道（或任何低于柱顶的板面）里穿出来的柱子去掉。
// top = deckMesh().top（三角形顶点），cols = [[x, y, 柱顶标高?]...]，返回 { keep, cut }
function columnsClear(top, cols, zTop, rad) {
  const C = 8, G = new Map(), R = rad == null ? 1.4 : rad;
  for (let i = 0; i < top.length; i += 9) { const x0 = Math.floor(Math.min(top[i], top[i + 3], top[i + 6]) / C), x1 = Math.floor(Math.max(top[i], top[i + 3], top[i + 6]) / C), y0 = Math.floor(Math.min(top[i + 1], top[i + 4], top[i + 7]) / C), y1 = Math.floor(Math.max(top[i + 1], top[i + 4], top[i + 7]) / C);
    for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) { const k = x * 100003 + y; let l = G.get(k); if (!l) G.set(k, l = []); l.push(i); } }
  const zLow = (x, y) => { let lo = Infinity; for (const i of G.get(Math.floor(x / C) * 100003 + Math.floor(y / C)) || []) { const ax = top[i], ay = top[i + 1], bx = top[i + 3], by = top[i + 4], cx = top[i + 6], cy = top[i + 7], d = (by - cy) * (ax - cx) + (cx - bx) * (ay - cy); if (Math.abs(d) < 1e-9) continue;
      const u = ((by - cy) * (x - cx) + (cx - bx) * (y - cy)) / d, v = ((cy - ay) * (x - cx) + (ax - cx) * (y - cy)) / d, w = 1 - u - v; if (u < -1e-6 || v < -1e-6 || w < -1e-6) continue; lo = Math.min(lo, u * top[i + 2] + v * top[i + 5] + w * top[i + 8]); } return lo; };
  const keep = [], cut = [];
  for (const c of cols) { const zt = c[2] != null ? c[2] : zTop; let hit = false; for (let k = 0; k < 9 && !hit; k++) { const a = k * Math.PI / 4, r = k === 8 ? 0 : R; if (zLow(c[0] + Math.cos(a) * r, c[1] + Math.sin(a) * r) < zt - 0.05) hit = true; } (hit ? cut : keep).push(c); }
  return { keep, cut };
}
const API = { LV, THICK, CLEAR, STOREY, HEAD, DEF, buildDeck, catmullClark, subdivide, deckMesh, columnsClear };
if (typeof module !== 'undefined' && module.exports) module.exports = API; else { root.SS = root.SS || {}; root.SS.deck = API; }
})(typeof self !== 'undefined' ? self : this);
