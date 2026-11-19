// 结构工作室 · 第 6 步：多层走道结构（SubD）
// 输入：第 5 步的结果 F（节点、走廊中心线、室多边形 = 走廊轮廓、塔、道路 / 水面）。
// 输出：控制网格（四边面为主）→ Catmull–Clark 细分 → 一张连续曲面。规则见 docs/DESIGN.md「第 6 步」。
(function (root) {
'use strict';
const LV = [0, 7.2, 10.8, 14.4];            // 地面、L1、L2、L3 顶面标高（层高 3.6 m，整体抬高一层）
const DEF = { r3: 200, entrySlope: 5, rampSlope: 7, plat: 12, seg: 10, sub: 2, thick: 0.9, avoidEdge: true };
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

// ---------------------------------------------------------------- 规则 → 控制网格
function buildDeck(F, opt) {
  const D = Object.assign({}, DEF, opt || {}), site = F.site, N = F.nodeP, towers = F.towers;
  const OI = outlineIndex(F.cellPolys.map(c => c.poly), 40);
  const inSite = p => site.inSite(p), inWater = p => site.inWater(p), roadD = p => site.roadDistAll ? site.roadDistAll(p) : 1e9;
  const dTow = N.map(p => { let d = 1e9; for (const t of towers) d = Math.min(d, Math.hypot(p[0] - t[0], p[1] - t[1])); return d; });
  const big = towers.filter(t => !t[4]);                        // 大塔 = 主吸引点上的塔（方案甲：只有它们带 L3）
  // ---- 分支：节点之间的直线段，按场地红线裁剪；两端各退出一段节点板
  const PCS = [];
  F.fibres.forEach((f, fi) => { const a = N[f.a], b = N[f.b], L = Math.hypot(b[0] - a[0], b[1] - a[1]); if (L < 6) return;
    const t = [(b[0] - a[0]) / L, (b[1] - a[1]) / L], nrm = [-t[1], t[0]], at = s => [a[0] + t[0] * s, a[1] + t[1] * s];
    let sA = 0, sB = L; const okA = inSite(a), okB = inSite(b);                       // 场内的连续段
    if (okA) { sB = L; for (let s = 2; s <= L; s += 2) if (!inSite(at(s))) { sB = s - 2; break; } }
    const runs = []; if (okA && sB >= L - 1e-6 && okB) runs.push([0, L, f.a, f.b]);
    else { if (okA && sB > 12) runs.push([0, sB, f.a, -1]); if (okB) { let s0 = 0; for (let s = L - 2; s >= 0; s -= 2) if (!inSite(at(s))) { s0 = s + 2; break; } if (L - s0 > 12 && !(okA && sB >= s0)) runs.push([s0, L, -1, f.b]); } }
    for (const [r0, r1, na, nb] of runs) { const w = f.w, mA = na >= 0 ? Math.min(1.25 * w, 0.36 * (r1 - r0)) : 0, mB = nb >= 0 ? Math.min(1.25 * w, 0.36 * (r1 - r0)) : 0, u0 = r0 + mA, u1 = r1 - mB, n = Math.max(1, Math.round((u1 - u0) / D.seg)), seg = (u1 - u0) / n;
      const P = [], hl = [], hr = [], hitL = [], hitR = [], fl = [];
      for (let k = 0; k <= n; k++) { const p = at(u0 + seg * k); P.push(p);
        const L_ = OI.ray(p, nrm, 1.6 * w), R_ = OI.ray(p, [-nrm[0], -nrm[1]], 1.6 * w);
        hl.push(L_ ? Math.max(L_.t, 0.25 * w) : 0.5 * w); hr.push(R_ ? Math.max(R_.t, 0.25 * w) : 0.5 * w); hitL.push(L_); hitR.push(R_);
        let flag = 0; for (let o = -seg / 2; o <= seg / 2 + 1e-6 && !flag; o += 2) { const q = at(clamp(u0 + seg * k + o, r0, r1)); flag = inWater(q) ? 1 : roadD(q) <= w / 2 + 3 ? 3 : 0; } fl.push(flag); }   // 站点前后半段内有水 / 路都算
      PCS.push({ id: PCS.length, fi, a: na, b: nb, prim: !!f.prim, w, n, seg, P, N: nrm, T: t, hl, hr, hitL, hitR, fl, len: u1 - u0, land: null, ld: 0 }); } });
  // ---- 第三层：大塔 r3 内的节点，避开水面和场地边缘；板边放不下坡时往外推
  const in3 = N.map(p => big.some(t => Math.hypot(p[0] - t[0], p[1] - t[1]) < D.r3));
  if (D.avoidEdge) { const cut = new Set(); for (const pc of PCS) { if (pc.a < 0 && pc.b >= 0 && pc.len < 60) cut.add(pc.b); if (pc.b < 0 && pc.a >= 0 && pc.len < 60) cut.add(pc.a);
      const k = Math.min(pc.n, Math.ceil(40 / pc.seg)); for (let i = 0; i <= k; i++) { if (pc.a >= 0 && pc.fl[i] === 1) cut.add(pc.a); if (pc.b >= 0 && pc.fl[pc.n - i] === 1) cut.add(pc.b); } }
    for (const j of cut) in3[j] = false; }
  const nSeg = (len, pc) => Math.max(2, Math.round(len / pc.seg)), nPlat = pc => Math.max(1, Math.round(D.plat / pc.seg));
  const mLvl = pc => nSeg(3.6 * D.rampSlope, pc), mEnt = pc => nSeg(7.2 * D.entrySlope, pc);
  const mode = pc => { const za = pc.a >= 0 && in3[pc.a], zb = pc.b >= 0 && in3[pc.b]; return za && zb ? 'full' : za ? 'A' : zb ? 'B' : null; };
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
  const edgeP = (pc, k, c) => c === 1 ? pc.P[k] : c === 0 ? [pc.P[k][0] + pc.N[0] * pc.hl[k], pc.P[k][1] + pc.N[1] * pc.hl[k]] : [pc.P[k][0] - pc.N[0] * pc.hr[k], pc.P[k][1] - pc.N[1] * pc.hr[k]];
  const pv = (pc, l, k, c) => { const p = edgeP(pc, k, c); return vert(pc.id + '_' + l + '_' + k + '_' + c, p[0], p[1], LV[l]); };
  const add = (f, lv) => { FC.push(f); FT.push(lv); }, dedupe = q => q.filter((x, i) => q.indexOf(x) === i);
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
      else if (i === us.length - 1) row.push([pv(pc, hi, ks[ks.length - 1], r.side), pv(pc, hi, ks[ks.length - 1], 1), tp ? pv(pc, hi, ks[ks.length - 1], oth) : -1]);
      else { const g = tp ? 0 : 0.22 * ws * Math.sin(Math.PI * u / m), wf = wo * Math.pow(u / m, 1.25);
        row.push([vert('r' + ri + '_' + i + '_0', px + nx * ws, py + ny * ws, z), vert('r' + ri + '_' + i + '_1', px + nx * g, py + ny * g, z), tp ? vert('r' + ri + '_' + i + '_2', px - nx * wf, py - ny * wf, z) : -1]); } });
    if (tp) for (let i = 0; i < us.length - 1; i++) { const q = dedupe([row[i][1], row[i][2] < 0 ? row[i][1] : row[i][2], row[i + 1][2], row[i + 1][1]]); if (q.length >= 3) add(q, hi); }
    for (let i = 0; i < us.length - 1; i++) add([row[i][0], row[i][1], row[i + 1][1], row[i + 1][0]], hi);
    // 被坡打断的走道沿坡逐渐收窄成尖
    const Jn = Math.max(1, Math.min(m, Math.round(0.6 * m))), mate = (a, lv) => ramps.some(q => q !== r && q.pc === pc && q.side === r.side && q.kind[a] === lv && Math.abs(q.ka - r.ka) < 1);
    const taper = (lv, seq, tag) => { const E = [pv(pc, lv, seq[0], r.side)];
      for (let j = 1; j <= Jn; j++) { const k = seq[j]; if (j === Jn) E.push(pv(pc, lv, k, 1)); else { const w = hwS(k) * Math.pow(1 - j / Jn, 1.25); E.push(vert(tag + ri + '_' + j, pc.P[k][0] + pc.N[0] * sg * w, pc.P[k][1] + pc.N[1] * sg * w, LV[lv])); } }
      for (let j = 0; j < Jn; j++) { const q = dedupe([pv(pc, lv, seq[j], 1), E[j], E[j + 1], pv(pc, lv, seq[j + 1], 1)]); if (q.length >= 3) add(q, lv); } };
    if (!tp && !mate(0, hi)) taper(hi, ks, 'th');
    if (lo > 0 && !mate(1, lo)) taper(lo, ks.slice().reverse(), 'tl'); });
  // ---- 节点板：把相邻两条分支之间的走廊轮廓（第 5 步的过渡曲线）取成板边
  const inc = new Map(); for (const pc of PCS) { if (pc.a >= 0) { if (!inc.has(pc.a)) inc.set(pc.a, []); inc.get(pc.a).push([pc, 0]); } if (pc.b >= 0) { if (!inc.has(pc.b)) inc.set(pc.b, []); inc.get(pc.b).push([pc, 1]); } }
  let gapOn = 0, gapOff = 0;
  for (const [j, lst] of inc) { const pj = N[j], endK = x => x[1] === 0 ? 0 : x[0].n, ang = x => { const p = x[0].P[endK(x)]; return Math.atan2(p[1] - pj[1], p[0] - pj[0]); };
    lst.sort((p, q) => ang(p) - ang(q));
    // 逆时针绕节点：每条分支的端面按 右 → 中 → 左 的顺序；相邻分支之间插入轮廓上的点
    const ring = []; for (let i = 0; i < lst.length; i++) { const x = lst[i], y = lst[(i + 1) % lst.length], k = endK(x), fwd = x[1] === 0;      // fwd：分支方向背离节点
      ring.push({ pc: x[0], k, c: fwd ? 2 : 0 }, { pc: x[0], k, c: 1 }, { pc: x[0], k, c: fwd ? 0 : 2 });
      if (lst.length < 2) continue; const hx = fwd ? x[0].hitL[k] : x[0].hitR[k], ky = endK(y), hy = y[1] === 0 ? y[0].hitR[ky] : y[0].hitL[ky];
      if (hx && hy && hx.pi === hy.pi) { const wk = walkOutline(F.cellPolys[hx.pi].poly, hx, hy, 0.8 * D.seg); if (wk.len < 6 * x[0].w) { wk.pts.forEach((p, gi) => ring.push({ g: j + '_' + i + '_' + gi, p })); gapOn++; } else gapOff++; } else gapOff++; }
    if (ring.length < 3) continue;
    for (let l = 1; l <= 3; l++) { if (l === 3 && !in3[j]) continue; add(ring.map(q => q.pc ? pv(q.pc, l, q.k, q.c) : vert('g' + q.g + '_' + l, q.p[0], q.p[1], LV[l])), l); } }
  const cnt = k => ramps.filter(r => r.kind[0] === k).length, edge3 = PCS.filter(pc => pc.land).length;
  const stats = { nodes: inc.size, branches: PCS.length, l3nodes: [...inc.keys()].filter(j => in3[j]).length, l3branches: PCS.filter(pc => mode(pc) === 'full').length, entries: cnt(0), r12: cnt(1), r23: cnt(2), edges3: edge3, steep: PCS.filter(pc => pc.steep).length, grown,
    noEntryShort: PCS.filter(pc => pc.noEntry === 'short').length, noEntryRoad: PCS.filter(pc => pc.noEntry === 'road').length, gapOn, gapOff, ctrlF: FC.length, ctrlV: V.length / 3,
    lenKm: PCS.reduce((s, pc) => s + pc.len, 0) / 1000 };
  return { V: new Float64Array(V), F: FC, FT, stats, in3, outline: OI, params: D,
    ramps: ramps.map(r => ({ kind: r.kind, a: r.pc.P[r.up > 0 ? r.ka : r.ka + r.m], b: r.pc.P[r.up > 0 ? r.ka + r.m : r.ka], side: r.side })) };
}

// ---------------------------------------------------------------- Catmull–Clark（边界按三次 B 样条，角点与非流形点不动）
function catmullClark(V, F, FT) {
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
    if (fc[v] === 0 || (bc[v] !== 0 && bc[v] !== 2)) out[3 * v + d] = p; else if (bc[v] === 2) out[3 * v + d] = (6 * p + bs[3 * v + d]) / 8; else { const n = fc[v]; out[3 * v + d] = (fs[3 * v + d] / n + 2 * ms[3 * v + d] / mc[v] + (n - 3) * p) / n; } }
  out.set(fp, nV * 3); const nF2 = [], nT = [];
  for (let i = 0; i < nF; i++) { const f = F[i], n = f.length, ids = fe[i]; for (let k = 0; k < n; k++) { nF2.push([f[k], nV + nF + ids[k], nV + i, nV + nF + ids[(k + n - 1) % n]]); nT.push(FT[i]); } }
  return { V: out, F: nF2, FT: nT };
}
function subdivide(deck, levels) { let r = { V: deck.V, F: deck.F, FT: deck.FT }; for (let i = 0; i < levels; i++) r = catmullClark(r.V, r.F, r.FT); return r; }

// ---------------------------------------------------------------- 三角网：顶面（带标高）+ 侧面（板厚）；boundary = 板边的线段（校验用）
function deckMesh(deck, levels, thick) {
  const r = subdivide(deck, levels == null ? deck.params.sub : levels), V = r.V, F = r.F, TH = thick == null ? deck.params.thick : thick, nV = V.length / 3;
  let nt = 0; for (const f of F) nt += f.length - 2; const top = new Float32Array(nt * 9), lvl = new Uint8Array(nt * 3); let o = 0, q = 0; const em = new Map();
  for (let i = 0; i < F.length; i++) { const f = F[i], n = f.length; for (let k = 1; k < n - 1; k++) for (const v of [f[0], f[k], f[k + 1]]) { top[o++] = V[3 * v]; top[o++] = V[3 * v + 1]; top[o++] = V[3 * v + 2]; lvl[q++] = r.FT[i]; }
    for (let k = 0; k < n; k++) { const a = f[k], b = f[(k + 1) % n], key = a < b ? a * nV + b : b * nV + a; em.set(key, em.has(key) ? -1 : a * nV + b); } }
  const bd = []; for (const v of em.values()) if (v >= 0) bd.push(Math.floor(v / nV), v % nV);
  const side = new Float32Array(bd.length / 2 * 18); o = 0;
  for (let i = 0; i < bd.length; i += 2) { const a = bd[i], b = bd[i + 1], A = [V[3 * a], V[3 * a + 1], V[3 * a + 2]], B = [V[3 * b], V[3 * b + 1], V[3 * b + 2]], zA = Math.max(0, A[2] - TH), zB = Math.max(0, B[2] - TH);
    for (const p of [A, B, [B[0], B[1], zB], A, [B[0], B[1], zB], [A[0], A[1], zA]]) { side[o++] = p[0]; side[o++] = p[1]; side[o++] = p[2]; } }
  return { top, side, lvl, quads: F.length, V, boundary: bd };
}
const API = { LV, DEF, buildDeck, catmullClark, subdivide, deckMesh };
if (typeof module !== 'undefined' && module.exports) module.exports = API; else { root.SS = root.SS || {}; root.SS.deck = API; }
})(typeof self !== 'undefined' ? self : this);
