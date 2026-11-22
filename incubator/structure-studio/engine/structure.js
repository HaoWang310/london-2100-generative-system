// 结构工作室 · Structure Studio —— 生成核心（纯函数，页面与 node 测试共用）
// 输入：张量场工作室导出的场地快照（道路、张量场、水体、吸引点）；输出：Linear Farm 种植工厂走廊网、室、两侧建筑与农田、三维网格。
// 流程：核心 + 疏密场 → 离路主线（顺张量场）→ 压缩空间里的松弛线网（Voronoi）→ 沿主方向拉扯 → 室内缩 + 按夹角五次曲线过渡 → 防细条 / 防跨水 → 两侧。
(function (root) {
'use strict';
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const unit = v => { const l = Math.hypot(v[0], v[1]) || 1e-9; return [v[0] / l, v[1] / l]; };
const rot = (v, deg) => { const a = deg * Math.PI / 180, c = Math.cos(a), s = Math.sin(a); return [v[0] * c - v[1] * s, v[0] * s + v[1] * c]; };
const add = (a, b) => [a[0] + b[0], a[1] + b[1]], sub = (a, b) => [a[0] - b[0], a[1] - b[1]], mul = (a, k) => [a[0] * k, a[1] * k];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1], crs = (a, b) => a[0] * b[1] - a[1] * b[0];
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
function arclen(P) { const s = [0]; for (let i = 1; i < P.length; i++) s.push(s[i - 1] + dist(P[i], P[i - 1])); return s; }
function resample(P, step) {
  const s = arclen(P), L = s[s.length - 1], out = []; let k = 0;
  for (let t = 0; t <= L + 1e-6; t += step) { while (k < s.length - 2 && s[k + 1] < t) k++; const f = (t - s[k]) / ((s[k + 1] - s[k]) || 1); out.push([P[k][0] + (P[k + 1][0] - P[k][0]) * f, P[k][1] + (P[k + 1][1] - P[k][1]) * f]); }
  if (dist(out[out.length - 1], P[P.length - 1]) > step * 0.3) out.push(P[P.length - 1].slice());
  return out;
}
function bez(p0, t0, p1, t1, a, b, n) {
  const L = dist(p0, p1), c0 = add(p0, mul(t0, L * a)), c1 = sub(p1, mul(t1, L * b)), out = [];
  for (let i = 0; i < n; i++) { const t = i / (n - 1), u = 1 - t; out.push([u * u * u * p0[0] + 3 * u * u * t * c0[0] + 3 * u * t * t * c1[0] + t * t * t * p1[0], u * u * u * p0[1] + 3 * u * u * t * c0[1] + 3 * u * t * t * c1[1] + t * t * t * p1[1]]); }
  return out;
}
function tangentsOf(P) { const n = P.length, T = []; for (let i = 0; i < n; i++) T.push(unit(sub(P[Math.min(n - 1, i + 1)], P[Math.max(0, i - 1)]))); return T; }

// ---------------------------------------------------------------- 栅格工具
function edt(mask, W, H) { // 到最近 true 像素的欧氏距离
  const INF = 1e20, g = new Float64Array(W * H), n = Math.max(W, H), f = new Float64Array(n), d = new Float64Array(n), v = new Int32Array(n), z = new Float64Array(n + 1);
  for (let i = 0; i < W * H; i++) g[i] = mask[i] ? 0 : INF;
  const pass = (len) => { let k = 0; v[0] = 0; z[0] = -INF; z[1] = INF;
    for (let q = 1; q < len; q++) { let s = ((f[q] + q * q) - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]); while (s <= z[k]) { k--; s = ((f[q] + q * q) - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]); } k++; v[k] = q; z[k] = s; z[k + 1] = INF; }
    k = 0; for (let q = 0; q < len; q++) { while (z[k + 1] < q) k++; d[q] = (q - v[k]) * (q - v[k]) + f[v[k]]; } };
  for (let x = 0; x < W; x++) { for (let y = 0; y < H; y++) f[y] = g[y * W + x]; pass(H); for (let y = 0; y < H; y++) g[y * W + x] = d[y]; }
  for (let y = 0; y < H; y++) { for (let x = 0; x < W; x++) f[x] = g[y * W + x]; pass(W); for (let x = 0; x < W; x++) g[y * W + x] = Math.sqrt(d[x]); }
  return g;
}
function blur(src, W, H, sig) {
  const r = Math.ceil(sig * 3), k = []; let ks = 0; for (let i = -r; i <= r; i++) { const w = Math.exp(-i * i / (2 * sig * sig)); k.push(w); ks += w; } for (let i = 0; i < k.length; i++) k[i] /= ks;
  const tmp = new Float32Array(W * H), out = new Float32Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { let s = 0; for (let i = -r; i <= r; i++) s += src[y * W + clamp(x + i, 0, W - 1)] * k[i + r]; tmp[y * W + x] = s; }
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { let s = 0; for (let i = -r; i <= r; i++) s += tmp[clamp(y + i, 0, H - 1) * W + x] * k[i + r]; out[y * W + x] = s; }
  return out;
}
function label4(mask, W, H) {
  const lab = new Int32Array(W * H), sizes = [0], stack = new Int32Array(W * H); let n = 0;
  for (let i = 0; i < W * H; i++) { if (!mask[i] || lab[i]) continue; n++; let sp = 0, cnt = 0; stack[sp++] = i; lab[i] = n;
    while (sp) { const p = stack[--sp]; cnt++; const x = p % W, y = (p / W) | 0;
      if (x > 0 && mask[p - 1] && !lab[p - 1]) { lab[p - 1] = n; stack[sp++] = p - 1; } if (x < W - 1 && mask[p + 1] && !lab[p + 1]) { lab[p + 1] = n; stack[sp++] = p + 1; }
      if (y > 0 && mask[p - W] && !lab[p - W]) { lab[p - W] = n; stack[sp++] = p - W; } if (y < H - 1 && mask[p + W] && !lab[p + W]) { lab[p + W] = n; stack[sp++] = p + W; } }
    sizes.push(cnt); }
  return { lab, n, sizes };
}
function morph(mask, W, H, it, erode) {
  let a = mask;
  for (let k = 0; k < it; k++) { const b = new Uint8Array(W * H);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const p = y * W + x, l = x > 0 ? a[p - 1] : 0, r = x < W - 1 ? a[p + 1] : 0, u = y > 0 ? a[p - W] : 0, d = y < H - 1 ? a[p + W] : 0;
      b[p] = erode ? (a[p] && l && r && u && d ? 1 : 0) : (a[p] || l || r || u || d ? 1 : 0); }
    a = b; }
  return a;
}
function fillPoly(grid, W, H, poly, val, mode) { // 扫描线填充（像素坐标）
  let y0 = Infinity, y1 = -Infinity; for (const p of poly) { y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]); }
  for (let y = Math.max(0, Math.floor(y0)); y <= Math.min(H - 1, Math.ceil(y1)); y++) { const yc = y + 0.5, xs = [];
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const a = poly[j], b = poly[i]; if ((a[1] > yc) !== (b[1] > yc)) xs.push(a[0] + (yc - a[1]) / (b[1] - a[1]) * (b[0] - a[0])); }
    xs.sort((a, b) => a - b);
    for (let k = 0; k + 1 < xs.length; k += 2) for (let x = Math.max(0, Math.ceil(xs[k] - 0.5)); x <= Math.min(W - 1, Math.floor(xs[k + 1] - 0.5)); x++) { const p = y * W + x; if (mode === 'max') grid[p] = Math.max(grid[p], val); else grid[p] = val; } }
}
function stampDisk(grid, W, H, cx, cy, r, val = 1) {
  const x0 = Math.max(0, Math.floor(cx - r - 1)), x1 = Math.min(W - 1, Math.ceil(cx + r + 1)), y0 = Math.max(0, Math.floor(cy - r - 1)), y1 = Math.min(H - 1, Math.ceil(cy + r + 1));
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy), c = clamp(r - d + 0.5, 0, 1) * val, p = y * W + x; if (c > grid[p]) grid[p] = c; }
}

// ---------------------------------------------------------------- 主生成
// ---------------------------------------------------------------- 主生成（v6：主线 + 疏密场 → 松弛线网 → 按夹角光滑过渡）
function clipHalfPlane(poly, m, nrm) { // 保留 (p - m)·nrm ≤ 0
  const out = []; for (let i = 0; i < poly.length; i++) { const a = poly[(i + poly.length - 1) % poly.length], b = poly[i], fa = dot(sub(a, m), nrm), fb = dot(sub(b, m), nrm);
    if (fb <= 0) { if (fa > 0) out.push(add(a, mul(sub(b, a), fa / (fa - fb)))); out.push(b); } else if (fa <= 0) out.push(add(a, mul(sub(b, a), fa / (fa - fb)))); }
  return out;
}
function clipConvex(subject, win) { // 任意多边形 ∩ 凸多边形窗口
  let out = subject; const n = win.length; let ar = 0; for (let i = 0; i < n; i++) { const a = win[i], b = win[(i + 1) % n]; ar += a[0] * b[1] - b[0] * a[1]; }
  for (let i = 0; i < n && out.length; i++) { const a = win[i], b = win[(i + 1) % n], e = sub(b, a), nrm = ar > 0 ? [e[1], -e[0]] : [-e[1], e[0]]; out = clipHalfPlane(out, a, nrm); }
  return out;
}
const polyArea = Pp => { let a = 0; for (let i = 0, j = Pp.length - 1; i < Pp.length; j = i++) a += Pp[j][0] * Pp[i][1] - Pp[i][0] * Pp[j][1]; return a / 2; };
function segDist(p, a, b) { const ab = sub(b, a), t = clamp(dot(sub(p, a), ab) / (dot(ab, ab) || 1), 0, 1); return dist(p, add(a, mul(ab, t))); }

// ---------------------------------------------------------------- 场地（张量场快照）
function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function inPoly(p, poly) { let c = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const a = poly[i], b = poly[j]; if ((a[1] > p[1]) !== (b[1] > p[1]) && p[0] < (b[0] - a[0]) * (p[1] - a[1]) / (b[1] - a[1]) + a[0]) c = !c; } return c; }
function decodeB64(s) { if (typeof atob === 'function') { const b = atob(s), u = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return u; } return new Uint8Array(Buffer.from(s, 'base64')); }

// 掩膜的外轮廓（Moore 追踪）→ 去台阶：Chaikin 三次 + 轻度平滑，得到光滑矢量轮廓（像素坐标）
function traceOutlines(M, W, H) {
  const seen = new Uint8Array(W * H), out = [], D8 = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]], fg = (x, y) => x >= 0 && y >= 0 && x < W && y < H && M[y * W + x];
  const L = label4(M, W, H);
  for (let i = 0; i < W * H; i++) { if (!M[i] || seen[L.lab[i]]) continue; seen[L.lab[i]] = 1; if (L.sizes[L.lab[i]] < 50) continue;
    const sx = i % W, sy = (i / W) | 0; let cx = sx, cy = sy, dir = 0, first = -1; const pts = [[cx + .5, cy + .5]];
    for (let it = 0; it < 8 * W * H; it++) { let moved = false;
      for (let q = 0; q < 8; q++) { const d = (dir + 6 + q) % 8, nx = cx + D8[d][0], ny = cy + D8[d][1]; if (!fg(nx, ny)) continue;
        if (first < 0) first = d; else if (cx === sx && cy === sy && d === first) { moved = null; break; }
        cx = nx; cy = ny; dir = d; moved = true; break; }
      if (!moved) break; pts.push([cx + .5, cy + .5]); }
    let P = pts; for (let k = 0; k < 3; k++) { const Q = []; for (let j = 0; j < P.length; j++) { const a = P[j], b = P[(j + 1) % P.length]; Q.push([a[0] * .75 + b[0] * .25, a[1] * .75 + b[1] * .25], [a[0] * .25 + b[0] * .75, a[1] * .25 + b[1] * .75]); } P = Q; }
    P = resample([...P, P[0]], 1.0); P.pop(); for (let k = 0; k < 3; k++) P = P.map((q, j) => { const a = P[(j - 1 + P.length) % P.length], b = P[(j + 1) % P.length]; return [q[0] * .5 + (a[0] + b[0]) * .25, q[1] * .5 + (a[1] + b[1]) * .25]; });
    out.push(P); }
  return out;
}
function prepareSite(snap, res) { // res：栅格精度（米），默认 2；拖动滑块时用 4 m 做快速预览
  // 张量场偶尔给出不到两个点（或有坏坐标）的路：没有长度，直接去掉（v0.9.32，伦敦全域检查发现；原来会在重采样时报错、整块地生成不了）
  if (snap.roads && snap.roads.some(r => !r.pts || r.pts.length < 2 || r.pts.some(p => !p || !isFinite(p[0]) || !isFinite(p[1])))) snap = Object.assign({}, snap, { roads: snap.roads.map(r => Object.assign({}, r, { pts: (r.pts || []).filter(p => p && isFinite(p[0]) && isFinite(p[1])) })).filter(r => r.pts.length >= 2) });
  const RES = res || 2, W = Math.ceil(snap.w / RES), H = Math.ceil(snap.h / RES), NN = W * H, xmin = 0, ymax = snap.h;
  const toPix = p => [(p[0] - xmin) / RES, (ymax - p[1]) / RES];
  const landM = new Uint8Array(NN), waterM = new Uint8Array(NN);
  for (const pc of snap.pieces) { fillPoly(landM, W, H, pc.outer.map(toPix), 1); for (const h of pc.holes || []) if (h.length > 2) fillPoly(landM, W, H, h.map(toPix), 0); }
  for (const w of snap.water || []) for (const ring of w) if (ring.length > 2) fillPoly(waterM, W, H, ring.map(toPix), 1);
  // 结构可跨越的范围：各块土地闭运算 40 m（越过铁路、道路缝隙和小洞，外轮廓不变）
  const dOut = edt(landM, W, H), dil = new Uint8Array(NN); for (let i = 0; i < NN; i++) dil[i] = dOut[i] * RES <= 40 ? 0 : 1;
  const dIn = edt(dil, W, H), siteM = new Uint8Array(NN); for (let i = 0; i < NN; i++) siteM[i] = dIn[i] * RES > 40 ? 1 : 0;
  // 结构的范围（足迹）= 场地外轮廓（含水面、铁路缝、洞）闭合后的整块 → 结构架在地面之上，只在这条外轮廓处切断
  const outerM = new Uint8Array(NN); for (const pc of snap.pieces) fillPoly(outerM, W, H, pc.outer.map(toPix), 1); for (let i = 0; i < NN; i++) if (waterM[i] && siteM[i]) outerM[i] = 1;
  { const dO = edt(outerM, W, H), dl = new Uint8Array(NN); for (let i = 0; i < NN; i++) dl[i] = dO[i] * RES <= 40 ? 0 : 1; const dI = edt(dl, W, H); for (let i = 0; i < NN; i++) siteM[i] = dI[i] * RES > 40 || outerM[i] ? 1 : 0; }
  { const bg = new Uint8Array(NN); for (let i = 0; i < NN; i++) bg[i] = siteM[i] ? 0 : 1; const L = label4(bg, W, H), edgeLab = new Set();
    for (let x = 0; x < W; x++) { edgeLab.add(L.lab[x]); edgeLab.add(L.lab[(H - 1) * W + x]); } for (let y = 0; y < H; y++) { edgeLab.add(L.lab[y * W]); edgeLab.add(L.lab[y * W + W - 1]); }
    for (let i = 0; i < NN; i++) if (bg[i] && !edgeLab.has(L.lab[i])) siteM[i] = 1; }
  const footPolys = traceOutlines(siteM, W, H).map(P => P.map(q => [xmin + q[0] * RES, ymax - q[1] * RES]));
  const nSite = new Uint8Array(NN); for (let i = 0; i < NN; i++) nSite[i] = siteM[i] ? 0 : 1;
  const bdG = edt(nSite, W, H); // 场内到场地边界的距离（像素）
  const F = snap.field, fu = decodeB64(F.data);
  const field = p => { const gx = p[0] / F.step, gy = p[1] / F.step, i = Math.floor(gx), j = Math.floor(gy); let cx = 0, cy = 0, w = 0;
    for (const [di, dj, ww] of [[0, 0, (1 - (gx - i)) * (1 - (gy - j))], [1, 0, (gx - i) * (1 - (gy - j))], [0, 1, (1 - (gx - i)) * (gy - j)], [1, 1, (gx - i) * (gy - j)]]) {
      const ii = i + di, jj = j + dj; if (ii < 0 || jj < 0 || ii >= F.nx || jj >= F.ny) continue; const v = fu[jj * F.nx + ii]; if (v === 255) continue; const a = v / 254 * Math.PI; cx += Math.cos(2 * a) * ww; cy += Math.sin(2 * a) * ww; w += ww; }
    if (w < 1e-6) return null; const a = 0.5 * Math.atan2(cy, cx); return [Math.cos(a), Math.sin(a)]; };
  const at = (M, p) => { const q = toPix(p), x = Math.floor(q[0]), y = Math.floor(q[1]); return x >= 0 && y >= 0 && x < W && y < H ? M[y * W + x] : 0; };
  const inSite = p => at(siteM, p) === 1, inWater = p => at(waterM, p) === 1;
  const bdist = p => { const q = toPix(p), x = Math.floor(q[0]), y = Math.floor(q[1]); return x >= 0 && y >= 0 && x < W && y < H ? bdG[y * W + x] * RES : 0; };
  // 主方向：场内倍角平均
  let cx = 0, cy = 0, n = 0, sx = 0, sy = 0;
  for (let j = 0; j < F.ny; j += 2) for (let i = 0; i < F.nx; i += 2) { const p = [i * F.step, j * F.step]; if (!inSite(p)) continue; const d = field(p); if (!d) continue; const a = Math.atan2(d[1], d[0]); cx += Math.cos(2 * a); cy += Math.sin(2 * a); n++; sx += p[0]; sy += p[1]; }
  const a0 = 0.5 * Math.atan2(cy, cx), cen = [sx / n, sy / n];
  const mainRoads = snap.roads.filter(r => r.grade === 'main').map(r => resample(r.pts, 8));
  const roadPts = []; for (const R of mainRoads) for (const q of R) roadPts.push(q);
  const roadHash = new Map(), RH = 40; roadPts.forEach(q => { const k = Math.floor(q[0] / RH) + ',' + Math.floor(q[1] / RH); if (!roadHash.has(k)) roadHash.set(k, []); roadHash.get(k).push(q); });
  const roadDist = p => { const gx = Math.floor(p[0] / RH), gy = Math.floor(p[1] / RH); let best = 1e9; for (let a = -2; a <= 2; a++) for (let b = -2; b <= 2; b++) { const l = roadHash.get((gx + a) + ',' + (gy + b)); if (l) for (const q of l) best = Math.min(best, dist(p, q)); } return best; };
  let lx0 = 1e9, ly0 = 1e9, lx1 = -1e9, ly1 = -1e9; for (const pc of snap.pieces) for (const p of pc.outer) { lx0 = Math.min(lx0, p[0]); ly0 = Math.min(ly0, p[1]); lx1 = Math.max(lx1, p[0]); ly1 = Math.max(ly1, p[1]); }
  // 三种吸引点（来自张量场）：主节点 = 核心；次节点 = 街区中心（局部加密 + 节点板 + 小种植塔）；边界节点 = 入口（入口主线 + 入口板）
  const strengthOf = a => clamp(a.pull != null ? a.pull / 2.4 : 1, 0.3, 1.5);
  const cores = snap.attractors.filter(a => a.kind === 'main').map(a => [a.x, a.y]).filter(inSite);
  const coreAtt = snap.attractors.filter(a => a.kind === 'main' && inSite([a.x, a.y])).map(a => ({ p: [a.x, a.y], reach: a.reach || 230, s: strengthOf(a) }));
  const secs = snap.attractors.filter(a => a.kind === 'sec' && inSite([a.x, a.y])).map(a => ({ p: [a.x, a.y], reach: a.reach || 140, s: strengthOf(a) }));
  const gates = snap.attractors.filter(a => a.kind === 'edge').map(a => ({ p: [a.x, a.y], reach: a.reach || 340, s: strengthOf(a) }));
  let landA = 0; for (let i = 0; i < NN; i++) landA += landM[i];
  // 路网尺度：主路 / 全部道路的距离场；平行路网里点到路的平均距离 = 间距 / 4，由此估主路间距 d1、次路间距 d2
  const rasterRoads = list => { const M = new Uint8Array(NN); for (const r of list) for (const q of resample(r.pts, RES * 0.5).map(toPix)) { const x = Math.floor(q[0]), y = Math.floor(q[1]); if (x >= 0 && y >= 0 && x < W && y < H) M[y * W + x] = 1; } return M; };
  const dMainG = edt(rasterRoads(snap.roads.filter(r => r.grade === 'main')), W, H), dAllG = edt(rasterRoads(snap.roads), W, H);
  let sMain = 0, sAll = 0, nR = 0; for (let i = 0; i < NN; i++) if (siteM[i] && landM[i] && !waterM[i]) { sMain += Math.min(dMainG[i] * RES, 400); sAll += Math.min(dAllG[i] * RES, 200); nR++; }
  let d1 = nR ? 4 * sMain / nR : 300; const d2 = nR ? 4 * sAll / nR : 115;
  // 场地里没有主干路（或主干路离得太远、距离大多被截到 400 m）时，"主路间距"测不准 → 先用主干 + 贯通路，再不行按 P2 的比例 2.6 × 次路间距；并限制在 1.6–3.5 × d2
  { let far = 0; for (let i = 0; i < NN; i++) if (siteM[i] && landM[i] && !waterM[i] && dMainG[i] * RES >= 399) far++;
    if (!nR || far / nR > 0.3) { const dT = edt(rasterRoads(snap.roads.filter(r => r.grade === 'main' || r.grade === 'through')), W, H); let sT = 0, fT = 0; for (let i = 0; i < NN; i++) if (siteM[i] && landM[i] && !waterM[i]) { sT += Math.min(dT[i] * RES, 400); if (dT[i] * RES >= 399) fT++; }
      d1 = nR && fT / nR <= 0.3 ? 4 * sT / nR : 2.6 * d2; }
    d1 = clamp(d1, 1.6 * d2, 3.5 * d2); }
  // 张量场道路的路面（按每条路的宽度）：走廊跨过路面的地方三维里要架空、留出净空
  const roadF = new Float32Array(NN); for (const r of snap.roads) { const rr = (r.width || 6.5) / 2 / RES; for (const q of resample(r.pts, RES).map(toPix)) stampDisk(roadF, W, H, q[0], q[1], rr); }
  const roadM = new Uint8Array(NN); for (let i = 0; i < NN; i++) roadM[i] = roadF[i] > 0.5 && siteM[i] ? 1 : 0;
  const roadDistAll = p => { const q = toPix(p), x = Math.floor(q[0]), y = Math.floor(q[1]); return x >= 0 && y >= 0 && x < W && y < H ? dAllG[y * W + x] * RES : 1e9; };
  // 重要路口（来自张量场路网）：场地内主干 × 主干、主干 × 贯通相交处；十字优先，主干越多越优先 → 小种植塔的候选
  const hubs = [], hubsT = []; { const dseg = (p, a, b) => { const dx = b[0] - a[0], dy = b[1] - a[1]; let t = ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (dx * dx + dy * dy || 1); t = Math.max(0, Math.min(1, t)); return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy); };
    for (const j of snap.junctions || []) { if (j.type === 'joint' || j.type === 'dead end') continue; const p = [j.x, j.y]; if (!inSite(p)) continue; let nm = 0, nt = 0;
      for (const r of snap.roads) { if (r.grade !== 'main' && r.grade !== 'through') continue; let hit = false; for (let i = 1; i < r.pts.length && !hit; i++) hit = dseg(p, r.pts[i - 1], r.pts[i]) < 4; if (hit) r.grade === 'main' ? nm++ : nt++; }
      if (nm >= 2 || (nm >= 1 && nt >= 1)) hubs.push({ p, type: j.type, rank: (j.type === 'X' ? 10 : 0) + nm * 2 + nt }); else if (nt >= 2) hubsT.push({ p, type: j.type, rank: (j.type === 'X' ? 10 : 0) + nt }); }
    if (!hubs.length) hubs.push(...hubsT); // 场地里没有主干路：贯通 × 贯通 的路口顶上
    hubs.sort((a, b) => b.rank - a.rank); }
  return { roadM, hubs, coreAtt, secs, gates, d1, d2, roadDistAll, snap, RES, W, H, NN, xmin, ymax, toPix, landM, waterM, siteM, footPolys, field, inSite, inWater, bdist, roadDist, mainRoads, t0: [Math.cos(a0), Math.sin(a0)], cen, bbox: [lx0, ly0, lx1, ly1], cores, landHa: landA * RES * RES / 1e4 };
}

// ---------------------------------------------------------------- 主生成
// 跨路：桥下净空至少 CLR；顶标高够高时带整层种植跨过去（层高 3.6 m），否则只留 1.2 m 桥面
const CLR = 5.0;
function roadSpan(deckZ) { const n = Math.floor((deckZ - CLR) / 3.6), T = n >= 1 ? 3.6 * n : 1.2; return { T, floors: Math.max(0, n), clear: deckZ - T, ok: deckZ - T >= CLR }; }
// 生成一次；塔座模式下塔脚没有全部落在塔所在的室里（离边 ≥ 1 m）时，把那个核心的环往外放大重来：按差多少放（至少 6 m），一直放到塔脚落进来，累计最多 30 m
// （拉扯很大时室被拉长，放太多会挤乱主线附近的走廊；放不够的部分由三层走廊环托住，见 plazaTiers 的 footClear）。车站 P2 一次就过
function buildStructure(site, P, EXCL) { let RX = null, F = null;
  for (let k = 0; k < 10; k++) { F = buildOnce(site, P, EXCL, RX); const bad = (F.plazas || []).filter(z => !z.ok && ((RX && RX[z.ti]) || 0) < 30); if (!bad.length) break;
    RX = F.rings.map((_, i) => { const z = bad.find(z => z.ti === i), r = (RX && RX[i]) || 0; return z ? Math.min(30, r + Math.max(6, Math.ceil(2 - z.gap))) : r; }); }
  F.ringExtra = RX; return F; }
function buildOnce(site, P, EXCL, RX) {
  if (P.wP < P.wS) P = { ...P, wP: P.wS }; // 主线走廊不比次级走廊窄
  const rnd = mulberry32(P.seed * 977 + 31), U = (a, b) => a + (b - a) * rnd();
  const { RES, W, H, NN, xmin, ymax, toPix, landM, waterM, siteM, inSite, inWater, bdist, roadDist, cen } = site;
  const field = p => { const d = site.field(p); return d ? rot(d, P.rotF) : rot(site.t0, P.rotF); };
  const [lx0, ly0, lx1, ly1] = site.bbox;
  const cores = site.cores, coreAtt = site.coreAtt || cores.map(p => ({ p, reach: 230, s: 1 })); // 核心 = 张量场的全部主吸引点（由上游决定，不在这里设）
  // 1 疏密场：到最近核心的距离
  const coreT = p => { let d = 1e9; for (const c of cores) d = Math.min(d, dist(p, c)); let t = clamp((d - 60) / P.coreR, 0, 1); return t * t * (3 - 2 * t); };
  const secs = site.secs || [], gates = site.gates || [];
  // 次节点（街区中心）：影响范围内局部加密，中心处间距减到约 (1 − 0.35·强度)
  const secK = p => { let k = 1; for (const a of secs) { const R = Math.max(220, a.reach * 1.6), d = dist(p, a.p); if (d < R) { const t = 1 - d / R; k = Math.min(k, 1 - 0.35 * a.s * t * t * (3 - 2 * t)); } } return k; };
  const spacing = p => (P.sCore + (P.sOut - P.sCore) * coreT(p)) * (secs.length ? secK(p) : 1);
  // 生成模式：v0 全局拉伸 · v1 局部场流线行 · v2 各向异性分格 · radial 放射蛛网 · dual 双向流线格网 · frei Frei Otto 湿毛线 · vein 叶脉生长 · slime 黏菌
  const MODE = P.mode || (P.logic === 'v1' || +P.v1 >= 0.5 ? 'v1' : 'v0');
  const V1 = MODE === 'v1' || MODE === 'dual';           // 流线行布点
  const WORLD = MODE !== 'v0' && MODE !== 'radial';       // 直接在场地坐标里布点（不经过压缩空间）
  const FAST = !!P.fast; // 拖动预览：曲线光顺用较粗的点距、较少轮数（松手后的精算不受影响）
  const TR = P.trace ? { cand: [], killed: [], seedRow: [] } : null; // 演示用：记录每一步的中间结果（平时不记）
  // v1 系统关联：次级走廊宽度随离核心的距离渐变（核心处 wCore，外围 wS）
  const wSecAt = p => V1 && P.wCore ? P.wCore + (P.wS - P.wCore) * coreT(p) : P.wS;

  // 2 主线（离路）：过核心附近、顺张量场的长流线；在垂直方向上平移，取离主干路最远的一条
  // 主线用大尺度张量场：在 ±P.primSmooth 范围内倍角平均，再与全场主方向混合（避开吸引点附近的环形场，主线保持长而顺）
  const primField = p => { let cx = 0, cy = 0; const R = P.primSmooth;
    for (let a = -2; a <= 2; a++) for (let b = -2; b <= 2; b++) { const d = site.field([p[0] + a * R / 2, p[1] + b * R / 2]); if (!d) continue; const t = Math.atan2(d[1], d[0]); cx += Math.cos(2 * t); cy += Math.sin(2 * t); }
    const g = Math.atan2(site.t0[1], site.t0[0]); cx += 6 * P.primStraight * Math.cos(2 * g); cy += 6 * P.primStraight * Math.sin(2 * g);
    const t = 0.5 * Math.atan2(cy, cx); return rot([Math.cos(t), Math.sin(t)], P.rotF); };
  const trace = (seed, sgnRot) => { const halves = [];
    for (const sg of [1, -1]) { let p = seed.slice(), d = mul(rot(primField(seed), sgnRot), sg); const pts = [];
      for (let it = 0; it < 900; it++) { let fd = rot(primField(p), sgnRot); if (dot(fd, d) < 0) fd = mul(fd, -1); d = unit(add(mul(d, 1 - P.primFollow), mul(fd, P.primFollow))); p = add(p, mul(d, 4)); pts.push(p.slice()); if (p[0] < lx0 - 60 || p[0] > lx1 + 60 || p[1] < ly0 - 60 || p[1] > ly1 + 60) break; }
      halves.push(pts); }
    return resample([...halves[1].slice().reverse(), seed, ...halves[0]], 4); };
  // 主线与种子无关：按相关参数缓存在场地上，拖动种子时不必重算
  const primKey = JSON.stringify([P.nPrim, P.primAng, P.primFollow, P.primSmooth, P.primStraight, P.primShift, P.offRoad, P.rotF, P.sCore]);
  site.primCache = site.primCache || new Map();
  let strands = TR ? null : site.primCache.get(primKey);
  if (!strands) {
  strands = [];
  cores.forEach((c, ci) => { for (let k = 0; k < P.nPrim; k++) {
    const step = P.nPrim >= 3 ? 180 / P.nPrim : P.primAng; // 3 条起在 180° 里均匀分布
    const ang = (k - (P.nPrim - 1) / 2) * step, d0 = rot(primField(c), ang), nn = [-d0[1], d0[0]]; let best = null;
    for (let o = -P.primShift; o <= P.primShift; o += 10) { const seed = add(c, mul(nn, o)); if (!inSite(seed)) continue; const S = trace(seed, ang), ds = [];
      for (let i = 0; i < S.length; i += 3) if (inSite(S[i])) ds.push(Math.min(roadDist(S[i]), 80)); if (ds.length < 20) continue;
      ds.sort((a, b) => a - b); const road = ds[Math.floor(ds.length * 0.15)] + 0.4 * ds.reduce((s, v) => s + v, 0) / ds.length;
      let sc = (P.offRoad < 0.5 ? -road : road) - 0.05 * Math.abs(o); // 贴路：取离主干路最近的；离核心的平移量两种情况都扣分
      // 重叠：核心附近（同一核心的主线本来就在这里交汇）不算；其余部分有超过 15% 的点贴近已有主线才算重叠
      const nearCore = q => cores.some(k => dist(q, k) < Math.max(220, P.sCore * 2.2));
      if (strands.some(T => { let n = 0, close = 0; for (let i = 0; i < S.length; i += 4) { if (nearCore(S[i]) || !inSite(S[i])) continue; n++; let m = 1e9; for (let j = 0; j < T.length; j += 3) m = Math.min(m, dist(S[i], T[j])); if (m < P.sCore * 0.8) close++; } return n > 0 && close / n > 0.15; })) sc -= 1000;
      if (TR) TR.cand.push({ core: ci, k, o, sc, S: S.filter((_, i) => i % 5 === 0) });
      if (!best || sc > best.sc) best = { sc, S }; }
    if (best && best.sc > -900) strands.push(best.S); } });
  if (!TR) site.primCache.set(primKey, strands); }
  // 边界节点（入口）：从场地边上的入口出发，顺大尺度张量场、逐渐被最近的核心吸过去，形成一条入口主线
  const entryStrands = [];
  for (const gt of gates) { if (!cores.length) break; let c = cores[0]; for (const k of cores) if (dist(k, gt.p) < dist(c, gt.p)) c = k;
    const D0 = dist(gt.p, c); if (D0 < 60) continue; let p = gt.p.slice(), d = unit(sub(c, p)); const pts = [sub(p, mul(d, 60)), p.slice()];
    for (let it = 0; it < 1200; it++) { const toC = unit(sub(c, p)), w = clamp(0.6 + 0.4 * (1 - dist(p, c) / D0), 0.6, 1); let fd = primField(p); if (dot(fd, toC) < 0) fd = mul(fd, -1);
      d = unit(add(mul(d, 0.75), mul(unit(add(mul(fd, 1 - w), mul(toC, w))), 0.25))); p = add(p, mul(d, 4)); pts.push(p.slice()); if (dist(p, c) < Math.max(30, P.sCore * 0.35)) break; }
    entryStrands.push(resample(pts, 4)); }
  if (entryStrands.length) strands = strands.concat(entryStrands);
  // 主节点（环形广场）：中心一个种子 + 外圈一圈均匀种子 → 分格后自然形成中心广场岛、环形走廊（主线宽）和向外放射的走廊
  // 环台（P.towerBase = 'plaza'，默认）：塔立在 7.2 m 的环台上，环台 = 塔所在的那个室。室的内边（走廊环）必须让开塔脚，
  // 所以环的半径至少 = 塔脚最远距离 + 0.8 个走廊宽（室边到环中线大约差这么多）+ 2 m；生成后再核对一次，不够再往外放（见 buildStructure）
  const PLAZA = towerBaseOf(P) === 'plaza', TSC = PLAZA ? towerScales(coreAtt.map(a => a.p), site) : null;
  const rings = coreAtt.map((a, i) => { const r0 = clamp(Math.max(0.32 * a.reach * a.s, 0.8 * P.sCore), 55, 130);
    const rNeed = PLAZA ? TOWER_MODEL.footR * TSC[i] + 0.8 * Math.max(P.wCore || 0, P.wP || 0) + 2 + ((RX && RX[i]) || 0) : 0;
    return { c: a.p, r: Math.max(r0, rNeed), w: P.wP, r0 }; });


  // 3 拉扯：v0 = 压缩空间 G 生成均匀绳网 → 沿全场主方向拉长；v1 = 直接在场地里沿局部张量场排流线行布点（格网随场连续变形）
  const t0 = unit(rot(site.t0, P.rotF)), n0 = [-t0[1], t0[0]], aS = 1 + 1.4 * P.pull, ctr = cores[0] || cen; // 拉伸是线性变换，中心只影响平移；没有主吸引点时用场地中心
  const A = WORLD ? (q => q) : (q => { const d = sub(q, ctr); return add(ctr, add(mul(t0, dot(d, t0) * aS), mul(n0, dot(d, n0)))); });
  const Ai = WORLD ? (q => q) : (q => { const d = sub(q, ctr); return add(ctr, add(mul(t0, dot(d, t0) / aS), mul(n0, dot(d, n0)))); });
  const SG = strands.map(S => resample(S.map(Ai), 6));
  const corners = [[lx0, ly0], [lx1, ly0], [lx1, ly1], [lx0, ly1]].map(Ai); let gx0 = 1e9, gy0 = 1e9, gx1 = -1e9, gy1 = -1e9; for (const p of corners) { gx0 = Math.min(gx0, p[0]); gy0 = Math.min(gy0, p[1]); gx1 = Math.max(gx1, p[0]); gy1 = Math.max(gy1, p[1]); }
  const spG = u => WORLD ? spacing(u) : spacing(A(u)) / Math.sqrt(aS);
  const PH = new Map(), PC = 30; SG.forEach((S, k) => S.forEach((q, i) => { if (i === S.length - 1) return; const key = Math.floor(q[0] / PC) + ',' + Math.floor(q[1] / PC); if (!PH.has(key)) PH.set(key, []); PH.get(key).push([k, i]); }));
  const primNearG = q => { const gx = Math.floor(q[0] / PC), gy = Math.floor(q[1] / PC); let best = 1e9, bt = [1, 0];
    for (let a = -4; a <= 4; a++) for (let b = -4; b <= 4; b++) { const l = PH.get((gx + a) + ',' + (gy + b)); if (l) for (const [k, i] of l) { const S = SG[k], d = segDist(q, S[i], S[i + 1]); if (d < best) { best = d; bt = unit(sub(S[i + 1], S[i])); } } }
    return { d: best, t: bt }; };
  let seeds = [], fixedS = [], WT = null, MET = null; const NET = [];
  if (V1) {
    // 行距（垂直场）= 间距 / √aS，行内种子距（顺场）= 间距 × √aS：格子沿局部场拉长，长宽比 = aS
    const hA = p => spacing(p) / Math.sqrt(aS), aL = p => spacing(p) * Math.sqrt(aS);
    const rowField = p => { let cx = 0, cy = 0; const R = 45; for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) { const d = site.field([p[0] + a * R, p[1] + b * R]); if (!d) continue; const t = Math.atan2(d[1], d[0]); cx += Math.cos(2 * t); cy += Math.sin(2 * t); }
      if (!cx && !cy) return field(p); const t = 0.5 * Math.atan2(cy, cx); return rot([Math.cos(t), Math.sin(t)], P.rotF); };
    const RHs = 30, RH = new Map(), rows = [];
    const hashRow = (R, id) => { for (const q of R) { const k = Math.floor(q[0] / RHs) + ',' + Math.floor(q[1] / RHs); if (!RH.has(k)) RH.set(k, []); RH.get(k).push([q, id]); } };
    const nearRow = (q, r, skip) => { const R_ = Math.ceil(r / RHs), gx = Math.floor(q[0] / RHs), gy = Math.floor(q[1] / RHs); let m = 1e9;
      for (let a = -R_; a <= R_; a++) for (let b = -R_; b <= R_; b++) { const l = RH.get((gx + a) + ',' + (gy + b)); if (l) for (const [p, id] of l) if (id !== skip) m = Math.min(m, dist(p, q)); } return m; };
    const inB = q => q[0] > lx0 - 120 && q[0] < lx1 + 120 && q[1] > ly0 - 120 && q[1] < ly1 + 120;
    // 主线两侧：贴主线的两行按同一弧长成对布点 → 主线成为分格边（与 v0 相同）
    const pairRows = [];
    strands.forEach(S => { const S6 = resample(S, 6), s = arclen(S6), L = s[s.length - 1], A1 = [], A2 = []; let t = U(0, 30), i = 0;
      for (let k = 0; k < S6.length; k++) { const p = S6[k], tg = unit(sub(S6[Math.min(k + 1, S6.length - 1)], S6[Math.max(0, k - 1)])), nn = [-tg[1], tg[0]], h = hA(p) / 2; A1.push(add(p, mul(nn, h))); A2.push(sub(p, mul(nn, h))); }
      pairRows.push(A1, A2);
      while (t < L) { while (i < S6.length - 2 && s[i + 1] < t) i++; const p = S6[i], tg = unit(sub(S6[i + 1], S6[Math.max(0, i - 1)])), nn = [-tg[1], tg[0]], h = hA(p) / 2;
        for (const sg of [1, -1]) { const q = add(p, mul(nn, h * sg)); if (inB(q) && primNearG(q).d > h * 0.8) { seeds.push(q); fixedS.push(true); if (TR) TR.seedRow.push(-1); } } t += aL(p); } });
    pairRows.forEach(R => { hashRow(R, rows.length); rows.push({ pts: R, paired: true }); });
    // 其余：等距流线（Jobard–Lefer）——从已有行往两侧各偏一个行距起笔，顺局部场追踪，离别的行太近就停
    const trace = q0 => { const halves = [];
      for (const sg of [1, -1]) { let p = q0, d = mul(rowField(q0), sg); const pts = [];
        for (let it = 0; it < 700; it++) { let fd = rowField(p); if (dot(fd, d) < 0) fd = mul(fd, -1); d = unit(add(mul(d, 0.6), mul(fd, 0.4))); const np = add(p, mul(d, 6));
          if (!inB(np) || nearRow(np, hA(np), -1) < hA(np) * 0.55 || primNearG(np).d < hA(np) * 0.35) break; p = np; pts.push(p); }
        halves.push(pts); }
      return [...halves[1].slice().reverse(), q0, ...halves[0]]; };
    const queue = []; const pushCands = R => { const R2 = resample(R, 1); for (let k = 0; k < R2.length; k += Math.max(1, Math.round(hA(R2[k]) / 1.2))) {
      const p = R2[k], tg = unit(sub(R2[Math.min(k + 1, R2.length - 1)], R2[Math.max(0, k - 1)])), nn = [-tg[1], tg[0]], h = hA(p); queue.push(add(p, mul(nn, h)), sub(p, mul(nn, h))); } };
    for (const R of pairRows) pushCands(R);
    if (!pairRows.length) queue.push(cores[0] || cen);
    let guard = 0;
    while (queue.length && rows.length < 900 && guard++ < 60000) { const q = queue.shift(); if (!inB(q)) continue; const h = hA(q); if (nearRow(q, h, -1) < h * 0.9 || primNearG(q).d < h * 0.5) continue;
      const R = trace(q); if (R.length < 3 || arclen(R).pop() < aL(q) * 0.8) continue; hashRow(R, rows.length); rows.push({ pts: R }); pushCands(R); }
    // 双向流线格网：再沿垂直方向追一组流线（间距 aL），行与它们的交点作种子 → 规整的弯曲四边形格子
    let minorHit = null;
    if (MODE === 'dual') { const MH = new Map(), mrows = [], perp = p => { const f = rowField(p); return [-f[1], f[0]]; };
      const nearM = (q, r) => { const R_ = Math.ceil(r / RHs), gx = Math.floor(q[0] / RHs), gy = Math.floor(q[1] / RHs); let m = 1e9; for (let a = -R_; a <= R_; a++) for (let b = -R_; b <= R_; b++) { const l = MH.get((gx + a) + ',' + (gy + b)); if (l) for (const p of l) m = Math.min(m, dist(p, q)); } return m; };
      const traceM = q0 => { const halves = []; for (const sg of [1, -1]) { let p = q0, d = mul(perp(q0), sg); const pts = [];
          for (let it = 0; it < 700; it++) { let fd = perp(p); if (dot(fd, d) < 0) fd = mul(fd, -1); d = unit(add(mul(d, 0.6), mul(fd, 0.4))); const np = add(p, mul(d, 6)); if (!inB(np) || nearM(np, aL(np)) < aL(np) * 0.55) break; p = np; pts.push(p); }
          halves.push(pts); } return [...halves[1].slice().reverse(), q0, ...halves[0]]; };
      const mq = [cores[0] || [(lx0 + lx1) / 2, (ly0 + ly1) / 2]]; let g2 = 0;
      while (mq.length && mrows.length < 600 && g2++ < 40000) { const q = mq.shift(); if (!inB(q) || nearM(q, aL(q)) < aL(q) * 0.9) continue; const R = traceM(q); if (R.length < 3) continue; mrows.push(R);
        for (const v of R) { const k = Math.floor(v[0] / RHs) + ',' + Math.floor(v[1] / RHs); if (!MH.has(k)) MH.set(k, []); MH.get(k).push(v); }
        const R2 = resample(R, 1); for (let k = 0; k < R2.length; k += Math.max(1, Math.round(aL(R2[k]) / 1.2))) { const p = R2[k], tg = unit(sub(R2[Math.min(k + 1, R2.length - 1)], R2[Math.max(0, k - 1)])), nn = [-tg[1], tg[0]]; mq.push(add(p, mul(nn, aL(p))), sub(p, mul(nn, aL(p)))); } }
      minorHit = q => nearM(q, 12) < 3.5; NET.push(...mrows.map(R => resample(R, 12))); }
    // 行内布点：顺场间距 aL，随机起点 + 轻微横向抖动；水里不布点
    if (MODE === 'dual') for (const r of rows) { if (r.paired) continue; const R = resample(r.pts, 2); let last = -1e9;
      for (let k = 0; k < R.length; k++) { const q = R[k]; if (!minorHit(q) || k - last < 6) continue; last = k; if (!(inSite(q) && inWater(q)) && primNearG(q).d > hA(q) * 0.7) { seeds.push(q); fixedS.push(false); if (TR) TR.seedRow.push(rows.indexOf(r)); } } }
    else for (const r of rows) { if (r.paired) continue; const R = resample(r.pts, 3), s = arclen(R), L = s[s.length - 1]; let t = U(0, aL(R[0])), i = 0;
      while (t < L) { while (i < R.length - 2 && s[i + 1] < t) i++; const p = R[i], tg = unit(sub(R[i + 1], R[Math.max(0, i - 1)])), nn = [-tg[1], tg[0]], q = add(p, mul(nn, U(-0.08, 0.08) * hA(p)));
        if (!(inSite(q) && inWater(q)) && primNearG(q).d > hA(q) * 0.7) { seeds.push(q); fixedS.push(false); if (TR) TR.seedRow.push(rows.indexOf(r)); } t += aL(p) * U(0.92, 1.08); } }
    if (TR) TR.rows = rows.map(r => ({ paired: !!r.paired, pts: resample(r.pts, 12) }));
    gx0 = lx0; gy0 = ly0; gx1 = lx1; gy1 = ly1;
  } else if (WORLD) {
    // v2 / frei / vein / slime：主线两侧成对布点（同 v1），其余按模式生成
    const hA = p => spacing(p) / Math.sqrt(aS), aL = p => spacing(p) * Math.sqrt(aS), inB = q => q[0] > lx0 - 120 && q[0] < lx1 + 120 && q[1] > ly0 - 120 && q[1] < ly1 + 120;
    strands.forEach(S => { const S6 = resample(S, 6), s = arclen(S6), L = s[s.length - 1]; let t = U(0, 30), i = 0;
      while (t < L) { while (i < S6.length - 2 && s[i + 1] < t) i++; const p = S6[i], tg = unit(sub(S6[i + 1], S6[Math.max(0, i - 1)])), nn = [-tg[1], tg[0]], h = hA(p) / 2;
        for (const sg of [1, -1]) { const q = add(p, mul(nn, h * sg)); if (inB(q) && primNearG(q).d > h * 0.8) { seeds.push(q); fixedS.push(true); if (TR) TR.seedRow.push(-1); } } t += aL(p); } });
    const nPair = seeds.length;
    const SH2 = new Map(), SC2 = 40, put = (q, i) => { const k = Math.floor(q[0] / SC2) + ',' + Math.floor(q[1] / SC2); if (!SH2.has(k)) SH2.set(k, []); SH2.get(k).push(i); };
    const near2 = (q, r, fn) => { const R_ = Math.ceil(r / SC2), gx = Math.floor(q[0] / SC2), gy = Math.floor(q[1] / SC2); for (let a = -R_; a <= R_; a++) for (let b = -R_; b <= R_; b++) { const l = SH2.get((gx + a) + ',' + (gy + b)); if (l) for (const j of l) if (fn(j)) return true; } return false; };
    seeds.forEach(put);
    const mt = p => { const f = field(p); return [f, [-f[1], f[0]]]; };
    const mdist = (a, b) => { const [t, n] = mt(mul(add(a, b), 0.5)), d = sub(b, a); return Math.sqrt(dot(d, t) ** 2 / aS + dot(d, n) ** 2 * aS); };
    if (MODE === 'v2') {
      // 各向异性分格：间距按当地张量场度量（顺场 × √aS、垂直 ÷ √aS），分格时两点的平分线也用这个度量
      const aD = Math.pow(aS, P.v2a != null ? P.v2a : 2), mdD = (a, b) => { const [t, n] = mt(mul(add(a, b), 0.5)), d = sub(b, a); return Math.sqrt(dot(d, t) ** 2 / aD + dot(d, n) ** 2 * aD); };
      for (let it = 0; it < 16000; it++) { const q = [U(lx0 - 110, lx1 + 110), U(ly0 - 110, ly1 + 110)]; if (inSite(q) && inWater(q)) continue; const sp = spacing(q);
        if (primNearG(q).d < hA(q) * 0.72) continue; if (near2(q, sp * Math.sqrt(aD), j => mdD(seeds[j], q) < sp * 0.92)) continue; seeds.push(q); fixedS.push(false); put(q, seeds.length - 1); if (TR) TR.seedRow.push(0); }
      // 分格用普通平分线（保证室之间严丝合缝）；拉长来自按场度量的布点
      const aB = Math.pow(aS, P.v2b != null ? P.v2b : 0); if (aB > 1.001) MET = (m, d) => { const [t, n] = mt(m); return add(mul(t, dot(d, t) / aB), mul(n, dot(d, n) * aB)); };
    } else {
      // 网络型（frei / vein / slime）：先在 8 m 栅格上模拟出一张网，网的孔洞 = 室；孔洞中心作种子、面积作权重（加权 Voronoi）
      // 模拟结果只取决于下面这些参数，按场地缓存（改走廊宽度、退线等不必重算）；模拟用独立的随机数，缓存与否结果一致
      const netKey = JSON.stringify([MODE, P.seed, P.sCore, P.sOut, P.coreR, P.pull, primKey, strands.length]); site.netCache = site.netCache || new Map();
      const cachedNet = TR ? null : site.netCache.get(netKey);
      if (cachedNet) { WT = seeds.map(q => (0.5 * spacing(q)) ** 2 * 0.5); for (const [q, w] of cachedNet.holes) { if (primNearG(q).d < hA(q) * 0.5) continue; seeds.push(q.slice()); fixedS.push(false); WT.push(w); } NET.push(...cachedNet.net); }
      else {
      const rnd2 = mulberry32(P.seed * 7919 + MODE.length * 131), U = (a, b) => a + (b - a) * rnd2(), rnd = rnd2;
      const R8 = 8, gx0_ = lx0 - 60, gy1_ = ly1 + 60, GW = Math.ceil((lx1 - lx0 + 120) / R8), GH = Math.ceil((ly1 - ly0 + 120) / R8);
      const gp = (x, y) => [gx0_ + (x + .5) * R8, gy1_ - (y + .5) * R8], gi = p => { const x = Math.floor((p[0] - gx0_) / R8), y = Math.floor((gy1_ - p[1]) / R8); return x >= 0 && y >= 0 && x < GW && y < GH ? y * GW + x : -1; };
      const inG = new Uint8Array(GW * GH); for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++) if (inSite(gp(x, y))) inG[y * GW + x] = 1;
      const net = new Uint8Array(GW * GH), stampLine = (a, b) => { const n = Math.ceil(dist(a, b) / (R8 * 0.5)) + 1; for (let k = 0; k <= n; k++) { const i = gi(add(a, mul(sub(b, a), k / n))); if (i >= 0) net[i] = 1; } };
      const bluePts = f => { const out = []; const H3 = new Map(), C3 = 40; for (let it = 0; it < 9000; it++) { const q = [U(lx0, lx1), U(ly0, ly1)]; if (!inSite(q) || inWater(q)) continue; const r = f(q), R_ = Math.ceil(r / C3), gx = Math.floor(q[0] / C3), gy = Math.floor(q[1] / C3); let ok = true;
          for (let a = -R_; a <= R_ && ok; a++) for (let b = -R_; b <= R_ && ok; b++) { const l = H3.get((gx + a) + ',' + (gy + b)); if (l) for (const p of l) if (dist(p, q) < r) { ok = false; break; } }
          if (ok) { out.push(q); const k = gx + ',' + gy; if (!H3.has(k)) H3.set(k, []); H3.get(k).push(q); } } return out; };
      for (const S of strands) for (let k = 1; k < S.length; k++) stampLine(S[k - 1], S[k]);
      if (MODE === 'frei') {
        // Frei Otto 湿毛线：场地边上两两连线（多 6% 长度），线与线相互吸引并拢，长度约束拉住；主线作为不动的线参与吸引
        const B = site.footPolys.slice().sort((a, b) => Math.abs(polyArea(b)) - Math.abs(polyArea(a)))[0], Bc = [...B, B[0]], cum = [0]; for (let k = 1; k < Bc.length; k++) cum.push(cum[k - 1] + dist(Bc[k], Bc[k - 1]));
        const bpt = u => { u = ((u % cum[cum.length - 1]) + cum[cum.length - 1]) % cum[cum.length - 1]; let k = 1; while (cum[k] < u) k++; const f = (u - cum[k - 1]) / (cum[k] - cum[k - 1] || 1); return add(Bc[k - 1], mul(sub(Bc[k], Bc[k - 1]), f)); };
        const diam = Math.hypot(lx1 - lx0, ly1 - ly0), meanSp = (P.sCore + P.sOut) / 2, nT = Math.round(clamp(cum[cum.length - 1] / (meanSp * 0.5), 30, 140)), TH = [];
        let guard = 0; while (TH.length < nT && guard++ < 4000) { const a = bpt(U(0, cum[cum.length - 1])), b = bpt(U(0, cum[cum.length - 1])); if (dist(a, b) < 0.35 * diam) continue; const n = 44, T = [], L0 = dist(a, b) * 1.06 / (n - 1);
          for (let k = 0; k < n; k++) { const q = add(a, mul(sub(b, a), k / (n - 1))); T.push(k && k < n - 1 ? add(q, [U(-6, 6), U(-6, 6)]) : q); } TH.push({ T, L0 }); }
        const fixedPts = []; for (const S of strands) for (const q of resample(S, 12)) if (inSite(q)) fixedPts.push(q);
        for (let it = 0; it < 60; it++) { const HH = new Map(), C4 = 30, all = []; TH.forEach((t, ti) => t.T.forEach((q, k) => all.push([q, ti, k]))); fixedPts.forEach(q => all.push([q, -1, 0]));
          all.forEach((e, idx) => { const k = Math.floor(e[0][0] / C4) * 65536 + Math.floor(e[0][1] / C4); let l = HH.get(k); if (!l) HH.set(k, l = []); l.push(idx); });
          const mv = TH.map(t => t.T.map(() => [0, 0, 0]));
          for (const [q, ti, k] of all) { if (ti < 0 || k === 0 || k === TH[ti].T.length - 1) continue; const r = 0.27 * spacing(q), R_ = Math.ceil(r / C4), gx = Math.floor(q[0] / C4), gy = Math.floor(q[1] / C4), m = mv[ti][k];
            for (let a = -R_; a <= R_; a++) for (let b = -R_; b <= R_; b++) { const l = HH.get((gx + a) * 65536 + (gy + b)); if (l) for (const j of l) { const [p, tj] = all[j]; if (tj === ti) continue; const d = dist(p, q); if (d < r) { const w = tj < 0 ? 2 : 1; m[0] += (p[0] - q[0]) * w; m[1] += (p[1] - q[1]) * w; m[2] += w; } } } }
          TH.forEach((t, ti) => { for (let k = 1; k < t.T.length - 1; k++) { const m = mv[ti][k]; if (m[2]) t.T[k] = add(t.T[k], mul([m[0], m[1]], 0.35 / m[2])); }
            for (let pass = 0; pass < 6; pass++) for (let k = 0; k < t.T.length - 1; k++) { const a = t.T[k], b = t.T[k + 1], d = dist(a, b); if (d <= t.L0) continue; const c = mul(sub(b, a), (d - t.L0) / d * 0.5); if (k > 0) t.T[k] = add(a, c); if (k + 1 < t.T.length - 1) t.T[k + 1] = sub(b, c); } }); }
        for (const t of TH) { for (let k = 1; k < t.T.length; k++) stampLine(t.T[k - 1], t.T[k]); NET.push(t.T.filter((_, k) => k % 2 === 0)); }
      } else if (MODE === 'vein') {
        // 叶脉生长（空间殖民）：从核心、次节点和主线出发，向养分点生长；末梢相互靠近处闭合成环
        const aux = bluePts(q => 0.42 * spacing(q)); let alive = aux.map(() => true);
        const VN = [], par = [], VH = new Map(), C5 = 40, addV = (p, pa) => { VN.push(p); par.push(pa); const k = Math.floor(p[0] / C5) + ',' + Math.floor(p[1] / C5); if (!VH.has(k)) VH.set(k, []); VH.get(k).push(VN.length - 1); };
        for (const c of cores) addV(c.slice(), -1); for (const a of secs) addV(a.p.slice(), -1);
        // 没有主吸引点：也从张量场的重要路口长出来
        if (!cores.length) for (const h of (site.hubs || []).slice(0, 24)) addV(h.p.slice(), -1);
        for (const S of strands) { let prev = -1; for (const q of resample(S, 24)) if (inSite(q)) { addV(q, prev); prev = VN.length - 1; } }
        const nearestV = (q, rmax) => { let best = -1, bd = rmax; const R_ = Math.ceil(rmax / C5), gx = Math.floor(q[0] / C5), gy = Math.floor(q[1] / C5); for (let a = -R_; a <= R_; a++) for (let b = -R_; b <= R_; b++) { const l = VH.get((gx + a) + ',' + (gy + b)); if (l) for (const j of l) { const d = dist(VN[j], q); if (d < bd) { bd = d; best = j; } } } return [best, bd]; };
        for (let it = 0; it < 420; it++) { const grow = new Map(); let any = false;
          aux.forEach((a, k) => { if (!alive[k]) return; const sp = spacing(a), [j, d] = nearestV(a, 2.4 * sp); if (j < 0) return; if (d < 0.42 * sp) { alive[k] = false; return; } any = true; const v = unit(sub(a, VN[j])); const g = grow.get(j) || [0, 0]; grow.set(j, [g[0] + v[0], g[1] + v[1]]); });
          if (!any) break; for (const [j, g] of grow) { const v = unit(g); addV(add(VN[j], mul(v, 10)), j); } }
        const deg = new Int32Array(VN.length); par.forEach(pa => { if (pa >= 0) deg[pa]++; });
        const segs = []; par.forEach((pa, k) => { if (pa >= 0) segs.push([VN[pa], VN[k]]); });
        const leaves = VN.map((_, k) => k).filter(k => deg[k] === 0 && par[k] >= 0);
        for (let a = 0; a < leaves.length; a++) { const p = VN[leaves[a]]; let best = -1, bd = 0.9 * spacing(p); for (let b = a + 1; b < leaves.length; b++) { const d = dist(p, VN[leaves[b]]); if (d < bd) { bd = d; best = b; } } if (best >= 0) segs.push([p, VN[leaves[best]]]); }
        for (const [a, b] of segs) stampLine(a, b); NET.push(...segs);
      } else {
        // 黏菌：智能体在场地里觅食，痕迹相互加强；食物 = 核心、次节点、入口、主线与地块中心
        const food = new Float32Array(GW * GH), addF = (p, v) => { const i = gi(p); if (i >= 0) food[i] = Math.max(food[i], v); };
        for (const c of cores) addF(c, 14); for (const a of secs) addF(a.p, 9); if (!cores.length) for (const h of (site.hubs || []).slice(0, 24)) addF(h.p, 9); for (const a of gates) addF(a.p, 9); for (const S of strands) for (const q of resample(S, 40)) addF(q, 3); for (const q of bluePts(q => 1.3 * spacing(q))) addF(q, 4);
        let trail = new Float32Array(GW * GH); const nAg = Math.min(26000, Math.round(inG.reduce((a, b) => a + b, 0) * 0.7)); const ax = new Float32Array(nAg), ay = new Float32Array(nAg), aa = new Float32Array(nAg);
        for (let k = 0; k < nAg; k++) { let x, y; do { x = U(0, GW); y = U(0, GH); } while (!inG[(y | 0) * GW + (x | 0)]); ax[k] = x; ay[k] = y; aa[k] = U(0, 2 * Math.PI); }
        const SA = Math.PI / 4, RA = Math.PI * 40 / 180, SD = 4, sense = (k, a) => { const x = (ax[k] + Math.cos(a) * SD) | 0, y = (ay[k] + Math.sin(a) * SD) | 0; if (x < 0 || y < 0 || x >= GW || y >= GH || !inG[y * GW + x]) return -1e9; return trail[y * GW + x]; };
        const tmp = new Float32Array(GW * GH);
        for (let it = 0; it < 170; it++) {
          for (let k = 0; k < nAg; k++) { const F = sense(k, aa[k]), Lf = sense(k, aa[k] + SA), Rt = sense(k, aa[k] - SA); if (Lf > F && Lf > Rt) aa[k] += RA; else if (Rt > F && Rt > Lf) aa[k] -= RA; aa[k] += (rnd() - 0.5) * 0.5;
            const nx = ax[k] + Math.cos(aa[k]), ny = ay[k] + Math.sin(aa[k]); if (nx < 0 || ny < 0 || nx >= GW || ny >= GH || !inG[(ny | 0) * GW + (nx | 0)]) { aa[k] += Math.PI; continue; } ax[k] = nx; ay[k] = ny; trail[(ny | 0) * GW + (nx | 0)] += 0.6; }
          for (let i = 0; i < GW * GH; i++) trail[i] += food[i] * 3;
          for (let y = 0; y < GH; y++) { const o = y * GW; for (let x = 0; x < GW; x++) tmp[o + x] = (trail[o + Math.max(0, x - 1)] + trail[o + x] + trail[o + Math.min(GW - 1, x + 1)]) / 3; }
          for (let y = 0; y < GH; y++) { const o = y * GW, u = Math.max(0, y - 1) * GW, d = Math.min(GH - 1, y + 1) * GW; for (let x = 0; x < GW; x++) trail[o + x] = (tmp[u + x] + tmp[o + x] + tmp[d + x]) / 3 * 0.92; } }
        const vals = []; for (let i = 0; i < GW * GH; i++) if (inG[i]) vals.push(trail[i]); vals.sort((a, b) => a - b); const thr = vals[Math.floor(vals.length * 0.8)] || 0;
        for (let i = 0; i < GW * GH; i++) if (inG[i] && trail[i] > thr) net[i] = 1;
        const NL = label4(net, GW, GH); for (let i = 0; i < GW * GH; i++) if (net[i] && NL.sizes[NL.lab[i]] < 15) net[i] = 0;
        if (TR) { const pts = []; for (let i = 0; i < GW * GH; i += 3) if (net[i]) pts.push(gp(i % GW, (i / GW) | 0)); TR.netPts = pts; }
      }
      // 孔洞 → 种子（中心）+ 权重（面积）；碰到栅格外框的大孔（场地外）不算
      const holes = new Uint8Array(GW * GH); for (let i = 0; i < GW * GH; i++) holes[i] = net[i] ? 0 : 1;
      const HL = label4(holes, GW, GH), sx = new Float64Array(HL.n + 1), sy = new Float64Array(HL.n + 1), inside = new Float64Array(HL.n + 1), edge = new Uint8Array(HL.n + 1);
      for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++) { const i = y * GW + x, k = HL.lab[i]; if (!k) continue; const p = gp(x, y); sx[k] += p[0]; sy[k] += p[1]; if (inG[i]) inside[k]++; if (x === 0 || y === 0 || x === GW - 1 || y === GH - 1) edge[k] = 1; }
      WT = seeds.map(q => (0.5 * spacing(q)) ** 2 * 0.5); const holesOut = [];
      // 失控的大孔洞（只在没有主吸引点时：没有主线和广场把空隙组织起来，场地内部分超过场地 12%）不只放一个大权重种子，而是在孔洞里按间距撒普通种子，免得一个室占几百公顷；正常的大孔（网的形态）不动
      let nInG = 0; for (let i = 0; i < GW * GH; i++) nInG += inG[i]; const bigPix = new Map(); for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++) { const i = y * GW + x, k = HL.lab[i]; if (!k || !inG[i]) continue; const n = HL.sizes[k]; if (n < 6) continue; if (cores.length || inside[k] <= 0.12 * nInG) continue; if (!bigPix.has(k)) bigPix.set(k, []); bigPix.get(k).push(i); }
      for (let k = 1; k <= HL.n; k++) { const n = HL.sizes[k]; if (n < 6) continue; const q = [sx[k] / n, sy[k] / n], w = n * R8 * R8 / Math.PI * 0.6; if (!bigPix.has(k) && (inside[k] < n * 0.3 || (edge[k] && n > GW * GH * 0.2))) continue;
        if (bigPix.has(k)) { const L = bigPix.get(k), acc = []; for (let t = L.length - 1; t > 0; t--) { const j = Math.floor(rnd() * (t + 1)); [L[t], L[j]] = [L[j], L[t]]; }
          for (const i of L) { const p = gp(i % GW, (i / GW) | 0); if (inWater(p) || primNearG(p).d < hA(p) * 0.5) continue; const sp2 = spacing(p); if (acc.some(r => dist(r, p) < 1.2 * sp2) || seeds.some(r => dist(r, p) < 0.9 * sp2)) continue; acc.push(p); const w2 = (0.5 * sp2) ** 2 * 0.5; holesOut.push([p, w2]); seeds.push(p); fixedS.push(false); WT.push(w2); if (TR) TR.seedRow.push(0); }
          continue; } holesOut.push([q, w]); if (primNearG(q).d < hA(q) * 0.5) continue;
        seeds.push(q); fixedS.push(false); WT.push(w); if (TR) TR.seedRow.push(0); }
      // 兜底：网太稀、孔洞太少（比如没有主吸引点、也就没有主线把场地切开，空隙连成一片通到场地外被丢掉）→ 按疏密场补普通种子
      // 只补空当：离已有种子都超过 1.3 个间距的地方才补（大孔通到场地外被丢掉的那片、网太稀的地方），不冲淡网本身的形态
      { const extra = bluePts(q => 0.9 * spacing(q)); for (const q of extra) { if (primNearG(q).d < hA(q) * 0.5) continue; if (seeds.some(r => dist(r, q) < 1.3 * spacing(q))) continue; seeds.push(q); fixedS.push(false); WT.push((0.5 * spacing(q)) ** 2 * 0.5); holesOut.push([q, (0.5 * spacing(q)) ** 2 * 0.5]); if (TR) TR.seedRow.push(0); } }
      if (!TR) { site.netCache.set(netKey, { holes: holesOut, net: NET.slice() }); if (site.netCache.size > 12) site.netCache.delete(site.netCache.keys().next().value); }
      }
    }
    gx0 = lx0; gy0 = ly0; gx1 = lx1; gy1 = ly1;
  } else {
  const inBox = q => q[0] > gx0 - 80 && q[0] < gx1 + 80 && q[1] > gy0 - 80 && q[1] < gy1 + 80;
  const nearSite = q => { const w = A(q); return w[0] > lx0 - 150 && w[0] < lx1 + 150 && w[1] > ly0 - 150 && w[1] < ly1 + 150; };
  SG.forEach(S => { const s = arclen(S), L = s[s.length - 1]; let t = U(0, 30), i = 0;
    while (t < L) { while (i < S.length - 2 && s[i + 1] < t) i++; const p = S[i], tg = unit(sub(S[i + 1], S[Math.max(0, i - 1)])), nn = [-tg[1], tg[0]], sp = spG(p), h = sp * 0.45;
      for (const sg of [1, -1]) { const q = add(p, mul(nn, h * sg)); if (inBox(q) && nearSite(q) && primNearG(q).d > h * 0.8) { seeds.push(q); fixedS.push(true); } }
      // 成对种子按场地里的距离排（原来按压缩空间排，拉伸后沿主线隔 √拉长 倍，外围一对隔 400–600 m，室边跟不上弯曲的主线）
      const f = Math.hypot(dot(tg, t0) * aS, dot(tg, n0)); t += (P.pairK || 0.7) * spacing(A(p)) * Math.pow(aS, 0.25) / f; } });
  const SH = new Map(), SC = 40, addSeedHash = (q, idx) => { const k = Math.floor(q[0] / SC) + ',' + Math.floor(q[1] / SC); if (!SH.has(k)) SH.set(k, []); SH.get(k).push(idx); };
  seeds.forEach(addSeedHash);
  const okSeed = q => { const sp = spG(q); if (primNearG(q).d < sp * 0.72) return false; const w = A(q); if (inSite(w) && inWater(w)) return false; const R = Math.ceil(sp / SC) + 1, gx = Math.floor(q[0] / SC), gy = Math.floor(q[1] / SC);
    for (let a = -R; a <= R; a++) for (let b = -R; b <= R; b++) { const l = SH.get((gx + a) + ',' + (gy + b)); if (l) for (const j of l) if (dist(seeds[j], q) < sp * 0.9) return false; } return true; };
  for (let it = 0; it < 14000; it++) { const q = [U(gx0 - 70, gx1 + 70), U(gy0 - 70, gy1 + 70)]; if (!nearSite(q)) continue; if (okSeed(q)) { seeds.push(q); fixedS.push(false); addSeedHash(q, seeds.length - 1); } }
  if (MODE === 'radial') for (const g of rings) {
    // 放射蛛网：核心周围一圈圈同心环种子（环距逐圈放大），往外过渡到普通网
    const Rw = clamp(0.9 * P.coreR, 260, 650), keep = seeds.map((q, i) => fixedS[i] || dist(A(q), g.c) > Rw); seeds = seeds.filter((_, i) => keep[i]); fixedS = fixedS.filter((_, i) => keep[i]); // 主线两侧的成对种子保留：主线成为蛛网的放射线
    let r0 = 2.3 * g.r, gap = Math.max(0.9 * spacing(g.c), 60), k = 0;
    while (r0 + gap / 2 < Rw) { const rm = r0 + gap / 2, n = Math.max(8, Math.round(2 * Math.PI * rm / (gap * 1.1))); for (let j = 0; j < n; j++) { const a = 2 * Math.PI * (j + (k % 2) * 0.5) / n, q = Ai(add(g.c, [rm * Math.cos(a), rm * Math.sin(a)])); if (primNearG(q).d < spG(q) * 0.6) continue; seeds.push(q); fixedS.push(true); }
      r0 += gap; gap *= 1.22; k++; } }

  }
  const plazaSeeds = new Set(); // 已放下的广场种子：相邻核心的清场不能把它们删掉
  for (const g of rings) { const R2 = 2 * g.r, n = Math.max(6, Math.round(2 * Math.PI * R2 / (1.3 * spacing(g.c)))), a0 = Math.atan2(field(g.c)[1], field(g.c)[0]);
    const keep = seeds.map(q => plazaSeeds.has(q) || dist(A(q), g.c) > R2 * 1.15); seeds = seeds.filter((_, i) => keep[i]); fixedS = fixedS.filter((_, i) => keep[i]); if (WT) WT = WT.filter((_, i) => keep[i]); if (TR) TR.seedRow = TR.seedRow.filter((_, i) => keep[i]);
    seeds.push(Ai(g.c)); plazaSeeds.add(seeds[seeds.length - 1]); fixedS.push(true); if (WT) WT.push((0.8 * g.r) ** 2); if (TR) TR.seedRow.push(-1);
    for (let k = 0; k < n; k++) { const a = a0 + 2 * Math.PI * (k + 0.5) / n; seeds.push(Ai(add(g.c, [R2 * Math.cos(a), R2 * Math.sin(a)]))); plazaSeeds.add(seeds[seeds.length - 1]); fixedS.push(true); if (WT) WT.push((0.8 * g.r) ** 2); if (TR) TR.seedRow.push(-1); } }
  if (TR) { TR.seedsG = seeds.map(q => q.slice()); TR.seedsW = seeds.map(A); TR.fixedS = fixedS.slice(); TR.v0 = WORLD ? null : { ctr, t0, aS }; TR.mode = MODE; TR.net = NET.map(L => L.map(q => q.slice())); }
  // 4 Voronoi（G）→ 拉回场地
  const BIG = [[gx0 - 3000, gy0 - 3000], [gx1 + 3000, gy0 - 3000], [gx1 + 3000, gy1 + 3000], [gx0 - 3000, gy1 + 3000]];
  // 分格：普通 Voronoi；v2 = 平分线按当地张量场度量（各向异性）；网络型 = 加权（功率）Voronoi，权重 = 孔洞面积
  const maxW = WT ? Math.max(...WT) : 0, reachK = MET ? Math.sqrt(aS) * 1.3 : 1;
  const voronoi = () => seeds.map((si, i) => { const order = seeds.map((sj, j) => [dist(si, sj), j]).filter(x => x[1] !== i).sort((a, b) => a[0] - b[0]); let c = BIG;
    for (const [dd, j] of order) { let rmax = 0; for (const p of c) rmax = Math.max(rmax, dist(p, si)); if (dd > 2 * rmax * reachK + (WT ? 2 * Math.sqrt(maxW) : 0)) break; const sj = seeds[j], d = sub(sj, si);
      let m = mul(add(si, sj), 0.5); if (WT) m = add(m, mul(d, (WT[i] - WT[j]) / (2 * dot(d, d))));
      c = clipHalfPlane(c, m, MET ? MET(m, d) : d); if (c.length < 3) break; }
    return c; });
  let vc = voronoi();
  const cellWorld = i => vc[i].length < 3 ? [] : vc[i].map(A);

  // 5 室：内缩（主线 / 次线半宽）→ 按夹角五次曲线过渡；防细条与防跨水
  const setbackOf = th => P.blendK * (th < 40 ? 12 : th < 60 ? 12 + (th - 40) / 20 * 4 : th < 90 ? 16 + (th - 60) / 30 * 16 : th < 120 ? 32 + (th - 90) / 30 * 20 : th < 150 ? 52 + (th - 120) / 30 * 16 : 68);
  const isPrimEdge = (a, b) => { const m = mul(add(a, b), 0.5); if (rings.some(g => Math.abs(dist(m, g.c) - g.r) < 0.22 * g.r)) return true; const pn = primNearG(Ai(m)), t = unit(sub(Ai(b), Ai(a))); return pn.d < spG(Ai(m)) * 0.16 + 3 && Math.abs(dot(pn.t, t)) > 0.8; };
  function insetPoly(P0, wk = 1) {
    const Pp = []; for (const q of P0) if (!Pp.length || dist(q, Pp[Pp.length - 1]) > 4) Pp.push(q); while (Pp.length > 3 && dist(Pp[0], Pp[Pp.length - 1]) <= 4) Pp.pop(); if (Pp.length < 3) return null;
    const n = Pp.length, sg = polyArea(Pp) > 0 ? 1 : -1, lines = [];
    for (let i = 0; i < n; i++) { const a = Pp[i], b = Pp[(i + 1) % n], L = dist(a, b); if (L < 1e-6) continue; const t = mul(sub(b, a), 1 / L), nn = mul([-t[1], t[0]], sg);
      const prim = isPrimEdge(a, b), h = (prim ? P.wP : wSecAt(mul(add(a, b), 0.5))) / 2 * wk; lines.push({ p: add(a, mul(nn, h)), t, kind: prim ? 'prim' : 'sec' }); }
    // 室是凸多边形：内缩 = 依次用每条边内移后的半平面去裁（精确；短边自然消失，不会裁掉一角留下尖刺）
    let Q = Pp.slice(); for (const L of lines) { const nIn = [-L.t[1] * sg, L.t[0] * sg]; Q = clipHalfPlane(Q, L.p, mul(nIn, -1)); if (Q.length < 3) return null; }
    const kept = Q.map(p => ({ p }));
    const ps = kept.map(o => o.p); if (polyArea(ps) * sg <= 0 || Math.abs(polyArea(ps)) < 600) return null;
    return kept;
  }
  function blendPoly(V0) {
    // 先合并相距 < 3 m 的顶点、去掉几乎共线的顶点（内缩留下的短边会让过渡退让为 0，形成折角）
    let V = V0.slice(); for (let pass = 0; pass < 3; pass++) { const out = []; for (const v of V) { if (out.length && dist(out[out.length - 1].p, v.p) < 3) { out[out.length - 1] = { p: mul(add(out[out.length - 1].p, v.p), 0.5) }; } else out.push(v); }
      if (out.length > 3 && dist(out[0].p, out[out.length - 1].p) < 3) { out[0] = { p: mul(add(out[0].p, out[out.length - 1].p), 0.5) }; out.pop(); } V = out; }
    V = V.filter((v, i) => { const a = V[(i - 1 + V.length) % V.length].p, c = V[(i + 1) % V.length].p, u = unit(sub(v.p, a)), w = unit(sub(c, v.p)); return Math.abs(crs(u, w)) > 0.02 || dot(u, w) < 0; });
    if (V.length < 3) V = V0;
    const n = V.length, res = [];
    for (let i = 0; i < n; i++) { const a = V[(i + n - 1) % n].p, b = V[i].p, c = V[(i + 1) % n].p;
      const u = unit(sub(b, a)), v = unit(sub(c, b)), th = Math.acos(clamp(-dot(u, v), -1, 1)) * 180 / Math.PI;
      const L = Math.min(setbackOf(th), 0.48 * dist(a, b), 0.48 * dist(b, c)); if (L < 0.5) { res.push(b); continue; }
      const p0 = sub(b, mul(u, L)), p5 = add(b, mul(v, L)), k = L * 0.26, C = [p0, add(p0, mul(u, k)), add(p0, mul(u, 2 * k)), sub(p5, mul(v, 2 * k)), sub(p5, mul(v, k)), p5];
      const nseg = Math.max(8, Math.ceil(L / 2));
      for (let s = 0; s <= nseg; s++) { const t = s / nseg, w = [1, 5, 10, 10, 5, 1].map((cf, j) => cf * (1 - t) ** (5 - j) * t ** j); res.push([C.reduce((acc, q, j) => acc + w[j] * q[0], 0), C.reduce((acc, q, j) => acc + w[j] * q[1], 0)]); } }
    return despike(res);
  }
  // 去尖刺 / 回折：反复删掉转角 > 50° 的点（内缩后近平行边留下的小凹口），再做两轮轻度平滑
  function despike(Q0) { let Q = resample([...Q0, Q0[0]], FAST ? 3 : 1.5); Q.pop();
    for (let it = 0; it < 60 && Q.length > 12; it++) { let worst = -1, wt = 100 * Math.PI / 180;
      for (let i = 0; i < Q.length; i++) { const a = Q[(i - 1 + Q.length) % Q.length], b = Q[i], c = Q[(i + 1) % Q.length], u = sub(b, a), v = sub(c, b), t = Math.abs(Math.atan2(crs(u, v), dot(u, v))); if (t > wt) { wt = t; worst = i; } }
      if (worst < 0) break; Q.splice(worst, 1); }
    for (let it = 0; it < 4; it++) Q = Q.map((q, i) => { const a = Q[(i - 1 + Q.length) % Q.length], b = Q[(i + 1) % Q.length]; return [q[0] * 0.5 + (a[0] + b[0]) * 0.25, q[1] * 0.5 + (a[1] + b[1]) * 0.25]; });
    // 兜底：重采样到 2 m，仍有 > 25° 的折点就只在它附近 ±6 个点内局部平滑，直到全部顺滑
    for (let round = 0; round < (FAST ? 1 : 3); round++) { Q = resample([...Q, Q[0]], FAST ? 3.5 : 2); Q.pop();
    for (let it = 0; it < (FAST ? 12 : 80); it++) { const n = Q.length, bad = [];
      for (let i = 0; i < n; i++) { const a = Q[(i - 1 + n) % n], b = Q[i], c = Q[(i + 1) % n], u = sub(b, a), v = sub(c, b); if (Math.abs(Math.atan2(crs(u, v), dot(u, v))) > 25 * Math.PI / 180) bad.push(i); }
      if (!bad.length) break; const mark = new Uint8Array(n); for (const i of bad) for (let k = -6; k <= 6; k++) mark[(i + k + n) % n] = 1;
      Q = Q.map((q, i) => { if (!mark[i]) return q; const a = Q[(i - 1 + n) % n], b = Q[(i + 1) % n]; return [q[0] * 0.5 + (a[0] + b[0]) * 0.25, q[1] * 0.5 + (a[1] + b[1]) * 0.25]; }); } }
    return Q; }
  const minWidth = Pp => { let best = 1e9; for (let i = 0; i < Pp.length; i++) { const a = Pp[i], b = Pp[(i + 1) % Pp.length], L = dist(a, b); if (L < 1) continue; const nn = [-(b[1] - a[1]) / L, (b[0] - a[0]) / L]; let m = 0; for (const q of Pp) m = Math.max(m, Math.abs(dot(sub(q, a), nn))); best = Math.min(best, m); } return best; };
  const siteFrac = c => { let n = 0, k = 0; const bb = [1e9, 1e9, -1e9, -1e9]; for (const p of c) { bb[0] = Math.min(bb[0], p[0]); bb[1] = Math.min(bb[1], p[1]); bb[2] = Math.max(bb[2], p[0]); bb[3] = Math.max(bb[3], p[1]); }
    for (let x = bb[0]; x <= bb[2]; x += 12) for (let y = bb[1]; y <= bb[3]; y += 12) { const q = [x, y]; if (!inPoly(q, c)) continue; n++; if (inSite(q)) k++; } return n ? k / n : 0; };
  // 入口主线贴着场地边的那一小段两侧的成对种子也允许合并（否则会夹出细条室）
  const nearGate = c => { if (!gates.length) return false; let x = 0, y = 0; for (const p of c) { x += p[0]; y += p[1]; } const m = [x / c.length, y / c.length]; return gates.some(g => dist(m, g.p) < 220); };
  let nRemoved = 0, nWaterCut = 0, cellPolys = [];
  for (let pass = 0; pass < 5; pass++) {
    cellPolys = []; const kill = new Set();
    // 室太窄 / 内缩失败：普通种子直接删（与邻室合并）；固定种子（主线两侧、环形广场）不能删，改删离它最近的普通种子，让它向外长大
    const killFor = i => { if (!fixedS[i]) { kill.add(i); return; } let j = -1, bd = 1e9; seeds.forEach((q, k) => { if (fixedS[k] || kill.has(k)) return; const d = dist(q, seeds[i]); if (d < bd) { bd = d; j = k; } }); if (j >= 0) kill.add(j); };
    seeds.forEach((s, i) => { const c = cellWorld(i); if (c.length < 3 || Math.abs(polyArea(c)) < 300) return;
      const V = insetPoly(c);
      if (!V) { if (P.debug) console.log('insetfail', i, fixedS[i], Math.round(polyArea(c)), siteFrac(c).toFixed(2)); if (Math.abs(polyArea(c)) > 2500 && siteFrac(c) > 0.3) killFor(i); return; }
      const wmin = minWidth(V.map(o => o.p)); if (wmin < P.minThick && siteFrac(c) > 0.5) { if (nearGate(c)) kill.add(i); else killFor(i); return; }
      cellPolys.push({ seed: i, raw: c, V }); }); // 折角平滑（较慢）等合并全部结束后再做，每个室只做一次
    // 防跨水：走廊（室之间的边）大半落在水里 → 删掉较小一侧的种子，让两室合并
    if (P.avoidWater) { const owner = new Map(); cellPolys.forEach(cp => { const c = cp.raw; for (let k = 0; k < c.length; k++) { const a = c[k], b = c[(k + 1) % c.length], key = Math.round(a[0] + b[0]) + ',' + Math.round(a[1] + b[1]); if (!owner.has(key)) owner.set(key, []); owner.get(key).push(cp); } });
      for (const [, cs] of owner) { if (cs.length !== 2) continue; const c = cs[0].raw; let a = null, b = null; for (let k = 0; k < c.length; k++) { const p = c[k], q = c[(k + 1) % c.length]; if (cs[1].raw.some(r => dist(r, p) < 1) && cs[1].raw.some(r => dist(r, q) < 1)) { a = p; b = q; } } if (!a) continue;
        let inW = 0, inS = 0; for (let t = 0.05; t < 1; t += 0.1) { const q = add(a, mul(sub(b, a), t)); if (inSite(q)) { inS++; if (inWater(q)) inW++; } }
        if (inS >= 3 && inW / inS > 0.4) { const cand = cs.filter(x => !fixedS[x.seed]).sort((x, y) => Math.abs(polyArea(x.raw)) - Math.abs(polyArea(y.raw))); if (cand.length) { kill.add(cand[0].seed); nWaterCut++; } } } }
    if (!kill.size || pass === 4) break;
    if (TR) for (const i of kill) TR.killed.push({ pass, p: A(seeds[i]) });
    seeds = seeds.filter((_, i) => !kill.has(i)); fixedS = fixedS.filter((_, i) => !kill.has(i)); if (WT) WT = WT.filter((_, i) => !kill.has(i)); nRemoved += kill.size; vc = voronoi();
  }
  cellPolys = cellPolys.map(cp => ({ ...cp, poly: blendPoly(cp.V) })).filter(cp => Math.abs(polyArea(cp.poly)) >= 400);
  // 兜底：仍内缩失败的室（多为场地边上的小室）用较窄的走廊再试，免得整块被走廊填满变成白块
  { const have = new Set(cellPolys.map(cp => cp.seed)); let nNarrow = 0;
    seeds.forEach((s, i) => { if (have.has(i)) return; const c = cellWorld(i); if (c.length < 3 || Math.abs(polyArea(c)) < 600 || siteFrac(c) < 0.3) return;
      for (const wk of [0.6, 0.35]) { const V = insetPoly(c, wk); if (!V) continue; const bp = blendPoly(V); if (Math.abs(polyArea(bp)) < 400) continue; cellPolys.push({ seed: i, raw: c, V, poly: bp, narrow: wk }); nNarrow++; break; } });
    var nNarrowCells = nNarrow; }

  // 6 走廊中心线（Voronoi 边 ∩ 场地）
  const nodeKey = new Map(), nodeP = [], fixed = [], edges = [], fibres = [], eKey = new Set();
  const nid = p => { const k = Math.round(p[0] * 2) + ',' + Math.round(p[1] * 2); if (!nodeKey.has(k)) { nodeKey.set(k, nodeP.length); nodeP.push(p.slice()); fixed.push(!inSite(p)); } return nodeKey.get(k); };
  for (const cp of cellPolys) { const c = cp.raw; for (let i = 0; i < c.length; i++) { const a = c[i], b = c[(i + 1) % c.length]; if (dist(a, b) < 1) continue; if (!inSite(mul(add(a, b), 0.5)) && !inSite(a) && !inSite(b)) continue;
    const ia = nid(a), ib = nid(b), key = Math.min(ia, ib) + '-' + Math.max(ia, ib); if (eKey.has(key)) continue; eKey.add(key);
    const prim = isPrimEdge(a, b); edges.push({ a: ia, b: ib, link: false, prim }); fibres.push({ P: resample([a, b], 2.0), a: ia, b: ib, link: false, prim, w: prim ? P.wP : wSecAt(mul(add(a, b), 0.5)) }); } }
  const deg = nodeP.map(() => 0); for (const e of edges) { deg[e.a]++; deg[e.b]++; }
  const inner = nodeP.map((_, k) => k).filter(k => !fixed[k] && deg[k] >= 3);

  // 种植塔：来自张量场的主吸引点，每个核心一座大塔
  const towers = []; for (const c of cores) { let best = null, bd = 1e9; for (const k of inner) { const d = dist(nodeP[k], c); if (d < bd) { bd = d; best = nodeP[k]; } } const p = rings.length ? c : best && bd < 80 ? best : c; towers.push([p[0], p[1], 24, 170]); }
  placeTowers(towers, site, strands, P);
  const plazas = PLAZA ? towers.map((t, ti) => makePlaza(t, ti, cellPolys, site, P)).filter(Boolean) : [];
  // 只有主吸引点放种植塔（每个核心一座大塔）。次吸引点仍然局部加密，重要路口仍然记录在 site.hubs 里，但都不再放塔。
  // 主节点：绕环形广场一圈环形节点板（同地面道路成环）；边界节点：场地边上一块半圆形入口板
  const gatePlates = gates.map(a => ({ c: a.p, r: clamp(0.15 * a.reach * a.s, 35, 60) }));

  // 7 栅格：由室多边形求有符号距离
  const inside = new Uint8Array(NN), Bd = 4.5, dB = new Float32Array(NN).fill(Bd), lab = new Int32Array(NN);
  cellPolys.forEach((cp, ci) => { const pp = resample([...cp.poly, cp.poly[0]].map(toPix), 1.2); pp.pop(); fillPoly(lab, W, H, pp, ci + 1);
    for (const q of pp) { const xa = Math.max(0, Math.floor(q[0] - Bd)), xb = Math.min(W - 1, Math.ceil(q[0] + Bd)), ya = Math.max(0, Math.floor(q[1] - Bd)), yb = Math.min(H - 1, Math.ceil(q[1] + Bd));
      for (let y = ya; y <= yb; y++) { const dy = y + .5 - q[1], row = y * W; for (let x = xa; x <= xb; x++) { const dx = x + .5 - q[0], d = Math.sqrt(dx * dx + dy * dy); if (d < dB[row + x]) dB[row + x] = d; } } } });
  // 跨水 / 跨铁路段：走廊落在非陆地（水面、铁路缝、洞）上的部分，三维里做成架空桥面，下面每隔 P.colStep 放一对柱子
  const solid = i => landM[i] && !waterM[i], columns = [], roadM = site.roadM || new Uint8Array(NN), RS = roadSpan(P.deckZ); let bridgeL = 0, nBridge = 0, roadL = 0, nRoad = 0; const roadSpansL = [];
  const onRoadP = q => { const t = toPix(q), x = Math.floor(t[0]), y = Math.floor(t[1]); return x >= 0 && y >= 0 && x < W && y < H && roadM[y * W + x] === 1; };
  for (const f of fibres) { const Q = resample(f.P, 2), on = Q.map(q => { const t = toPix(q), x = Math.floor(t[0]), y = Math.floor(t[1]); return !(x >= 0 && y >= 0 && x < W && y < H) || !siteM[y * W + x] ? 2 : !solid(y * W + x) ? 0 : roadM[y * W + x] ? 3 : 1; });
    // 跨路段：中心线落在路面上的连续段；柱子立在走廊两侧（长段按柱距加，落在路面上的柱子不放）
    { let k = 0; while (k < Q.length) { if (on[k] !== 3) { k++; continue; } let e = k; while (e < Q.length && on[e] === 3) e++; const L = (e - k) * 2;
      if (L >= 4) { nRoad++; roadL += L; roadSpansL.push(L); const w = (f.prim ? P.wP : wSecAt(Q[Math.floor((k + e) / 2)])) / 2 - 2, n = Math.max(1, Math.round(L / P.colStep)), at = []; // 两端的实心体就是桥墩：只有比柱距长的段才在中间加柱
        for (let c = 1; c < n; c++) at.push(k + Math.round(c * (e - k) / n));
        for (const idx of at) { const i2 = Math.min(Q.length - 2, Math.max(0, idx)), t = unit(sub(Q[i2 + 1], Q[i2])), nn = [-t[1], t[0]]; for (const sg of [1, -1]) { const q = add(Q[idx], mul(nn, w * sg)); if (!onRoadP(q)) columns.push([q[0], q[1], RS.clear]); } } }
      k = e; } }
    let k = 0; while (k < Q.length) { if (on[k] !== 0) { k++; continue; } let e = k; while (e < Q.length && on[e] === 0) e++; const L = (e - k) * 2;
      if (L >= 6) { nBridge++; bridgeL += L; const w = (f.prim ? P.wP : wSecAt(Q[Math.floor((k + e) / 2)])) / 2 - 2, n = Math.max(1, Math.round(L / P.colStep));
        for (let c = 0; c < n; c++) { const idx = Math.min(Q.length - 2, k + Math.round((c + 0.5) * (e - k) / n)), t = unit(sub(Q[idx + 1], Q[idx])), nn = [-t[1], t[0]]; columns.push(add(Q[idx], mul(nn, w)), sub(Q[idx], mul(nn, w))); } }
      k = e; } }
  const sdGrid = new Float32Array(NN), corrF = new Float32Array(NN), corr = new Uint8Array(NN), cellsM = new Uint8Array(NN);
  for (let i = 0; i < NN; i++) { inside[i] = lab[i] ? 1 : 0; sdGrid[i] = (inside[i] ? dB[i] : -dB[i]) * RES; }
  for (const t of towers) { const R = t[2] + 6 + 10, q = toPix(t), x0 = Math.max(0, Math.floor(q[0] - R / RES)), x1 = Math.min(W - 1, Math.ceil(q[0] + R / RES)), y0 = Math.max(0, Math.floor(q[1] - R / RES)), y1 = Math.min(H - 1, Math.ceil(q[1] + R / RES));
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { const dt = Math.hypot((x + .5 - q[0]) * RES, (y + .5 - q[1]) * RES) - (t[2] + 6), i = y * W + x; if (dt < sdGrid[i]) sdGrid[i] = dt; } }
  const stamp = (cx, R, fn) => { const q = toPix(cx), x0 = Math.max(0, Math.floor(q[0] - R / RES)), x1 = Math.min(W - 1, Math.ceil(q[0] + R / RES)), y0 = Math.max(0, Math.floor(q[1] - R / RES)), y1 = Math.min(H - 1, Math.ceil(q[1] + R / RES));
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { const dt = fn(Math.hypot((x + .5 - q[0]) * RES, (y + .5 - q[1]) * RES)), i = y * W + x; if (dt < sdGrid[i]) sdGrid[i] = dt; } };
  for (const g of gatePlates) stamp(g.c, g.r + 10, d => d - g.r);
  for (let i = 0; i < NN; i++) { const sd = sdGrid[i]; const cf = clamp(0.5 - sd / (1.5 * RES), 0, 1); corrF[i] = siteM[i] ? cf : 0; corr[i] = siteM[i] && corrF[i] > 0.5 ? 1 : 0; cellsM[i] = landM[i] && !corr[i] && !waterM[i] ? 1 : 0; }
  const CL = label4(cellsM, W, H); // 室编号

  // 8 两侧：建筑带（退线 / 进深 / 切段），其后农田（快速预览 P.quick 时只出农田，不排建筑）
  const dc = edt(corr, W, H), nonSolid = site.dNS ? null : new Uint8Array(NN); if (nonSolid) for (let i = 0; i < NN; i++) nonSolid[i] = landM[i] && !waterM[i] ? 0 : 1; const dNS = site.dNS || (site.dNS = edt(nonSolid, W, H)); // 到水面 / 铁路缝 / 场地边的距离（与种子无关，缓存在场地上）
  // 沿走廊弧长：最近中心线点（向量传播近似最近点）
  const sx = new Float32Array(NN).fill(1e9), sy = new Float32Array(NN).fill(1e9), sa = new Float32Array(NN);
  if (!P.quick) {
  let off = 0;
  for (const f of fibres) { const Q = resample(f.P, 2), s = arclen(Q); Q.forEach((p, i) => { const q = toPix(p), x = Math.floor(q[0]), y = Math.floor(q[1]); if (x < 0 || y < 0 || x >= W || y >= H) return; const k = y * W + x; sx[k] = q[0]; sy[k] = q[1]; sa[k] = s[i] + off; }); off += s[s.length - 1] + 1000; }
  const relax = (k, kk, x, y) => { if (sx[kk] > 1e8) return; const d1 = (sx[kk] - x) ** 2 + (sy[kk] - y) ** 2, d0 = (sx[k] - x) ** 2 + (sy[k] - y) ** 2; if (d1 < d0) { sx[k] = sx[kk]; sy[k] = sy[kk]; sa[k] = sa[kk]; } };
  for (let y = 0; y < H; y++) { for (let x = 0; x < W; x++) { const k = y * W + x, px = x + .5, py = y + .5; if (x > 0) relax(k, k - 1, px, py); if (y > 0) { relax(k, k - W, px, py); if (x > 0) relax(k, k - W - 1, px, py); if (x < W - 1) relax(k, k - W + 1, px, py); } } for (let x = W - 1; x >= 0; x--) { const k = y * W + x; if (x < W - 1) relax(k, k + 1, x + .5, y + .5); } }
  for (let y = H - 1; y >= 0; y--) { for (let x = W - 1; x >= 0; x--) { const k = y * W + x, px = x + .5, py = y + .5; if (x < W - 1) relax(k, k + 1, px, py); if (y < H - 1) { relax(k, k + W, px, py); if (x < W - 1) relax(k, k + W + 1, px, py); if (x > 0) relax(k, k + W - 1, px, py); } } for (let x = 0; x < W; x++) { const k = y * W + x; if (x > 0) relax(k, k - 1, x + .5, y + .5); } }
  }
  const innerP = inner.map(k => toPix(nodeP[k])), junG = new Map(), jc = 32;
  innerP.forEach(p => { const k = Math.floor(p[0] / jc) + ',' + Math.floor(p[1] / jc); if (!junG.has(k)) junG.set(k, []); junG.get(k).push(p); });
  const nearJ = (x, y) => { const gx = Math.floor(x / jc), gy = Math.floor(y / jc); for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) { const l = junG.get((gx + a) + ',' + (gy + b)); if (l) for (const p of l) if (Math.hypot(p[0] - x, p[1] - y) < 30 / RES) return true; } return false; };
  let bldM = new Uint8Array(NN);
  // 沿走廊建筑：P.buildings 打开时才排（界面暂时不排，之后单独做成一个功能）
  if (!P.quick && P.buildings) for (let i = 0; i < NN; i++) { if (!cellsM[i]) continue; const d = dc[i] * RES; if (d <= P.setback || d >= P.setback + P.depth || dNS[i] * RES < P.setback) continue;
    if (EXCL && EXCL.has(CL.lab[i])) continue;
    if (rings.length) { const wx = xmin + (i % W + .5) * RES, wy = ymax - (((i / W) | 0) + .5) * RES; if (rings.some(g => (wx - g.c[0]) ** 2 + (wy - g.c[1]) ** 2 < g.r * g.r)) continue; } // 环形广场岛：只留种植塔，不排建筑
    if (((sa[i] % P.segL) + P.segL) % P.segL < P.gap) continue; const x = i % W, y = (i / W) | 0; if (nearJ(x + .5, y + .5)) continue; bldM[i] = 1; }
  bldM = morph(morph(bldM, W, H, 2, true), W, H, 2, false);
  const BL = label4(bldM, W, H); const keep = new Uint8Array(BL.n + 1); for (let k = 1; k <= BL.n; k++) keep[k] = BL.sizes[k] > 260 / (RES * RES) ? 1 : 0;
  const hgt = new Float32Array(NN), bx = new Float64Array(BL.n + 1), by = new Float64Array(BL.n + 1);
  for (let i = 0; i < NN; i++) { const k = BL.lab[i]; if (!k || !keep[k]) { bldM[i] = 0; continue; } bx[k] += i % W; by[k] += (i / W) | 0; }
  const bh = new Float32Array(BL.n + 1); let nB = 0, bArea = 0;
  for (let k = 1; k <= BL.n; k++) { if (!keep[k]) continue; nB++; const c = [xmin + (bx[k] / BL.sizes[k] + .5) * RES, ymax - (by[k] / BL.sizes[k] + .5) * RES];
    const dt = towers.length ? Math.min(...towers.map(t => dist(t, c))) : 400; const h = 12 + 34 * Math.exp(-dt / 230) + U(-3, 6); bh[k] = 3.6 * Math.max(2, Math.round(h / 3.6)); }
  for (let i = 0; i < NN; i++) if (bldM[i]) { hgt[i] = bh[BL.lab[i]]; bArea++; }
  const d0 = field(cen), nrm = [-d0[1], d0[0]];
  const farm = new Uint8Array(NN), stripe = new Uint8Array(NN); let farmA = 0, corrA = 0;
  const pzCell = new Map(plazas.map(z => [z.cell + 1, z]));
  for (let i = 0; i < NN; i++) { const x = xmin + (i % W + .5) * RES, y = ymax - (((i / W) | 0) + .5) * RES; stripe[i] = ((((x - cen[0]) * nrm[0] + (y - cen[1]) * nrm[1]) % 9) + 9) % 9 < 6.5 ? 1 : 0;
    const pz = pzCell.get(lab[i]); if (pz && Math.hypot(x - pz.c[0], y - pz.c[1]) > pz.oc) { if (corr[i]) corrA++; continue; }   // 环台下面是道路和柱子，不算农田（天井里的地面岛仍是绿地）
    if (cellsM[i] && dc[i] * RES >= (P.buildings ? P.setback : 3) && dNS[i] * RES >= 3 && !bldM[i]) { farm[i] = 1; farmA++; } if (corr[i]) corrA++; }

  // 9 室信息（卡片）
  const cells = [];
  { const acc = []; for (let k = 0; k <= CL.n; k++) acc.push({ n: 0, sx: 0, sy: 0, sxx: 0, syy: 0, sxy: 0, x0: 1e9, y0: 1e9, x1: -1e9, y1: -1e9, b: new Set(), edge: false });
    for (let i = 0; i < NN; i++) { const k = CL.lab[i]; if (!k) continue; const a = acc[k], x = i % W, y = (i / W) | 0; a.n++; a.sx += x; a.sy += y; a.sxx += x * x; a.syy += y * y; a.sxy += x * y; a.x0 = Math.min(a.x0, x); a.y0 = Math.min(a.y0, y); a.x1 = Math.max(a.x1, x); a.y1 = Math.max(a.y1, y);
      if (!a.edge && (x === 0 || !landM[i - 1] || !landM[i + 1] || !landM[i - W] || !landM[i + W])) a.edge = true; }
    { const seen = new Uint8Array(BL.n + 1); for (let i = 0; i < NN; i++) { const b = BL.lab[i]; if (!b || !bldM[i] || seen[b]) continue; seen[b] = 1; const k = CL.lab[i]; if (k) acc[k].b.add(b); else { /* 建筑在室边缘外的像素上：找相邻室 */ const x = i % W, y = (i / W) | 0; for (const j of [i - 1, i + 1, i - W, i + W]) if (j >= 0 && j < NN && CL.lab[j]) { acc[CL.lab[j]].b.add(b); break; } } } }
    for (let k = 1; k <= CL.n; k++) { const a = acc[k]; if (a.n < 400) continue; const mx = a.sx / a.n, my = a.sy / a.n, cxx = a.sxx / a.n - mx * mx, cyy = a.syy / a.n - my * my, cxy = a.sxy / a.n - mx * my;
      const tr = cxx + cyy, de = Math.sqrt(Math.max(0, (cxx - cyy) ** 2 / 4 + cxy * cxy)), l1 = tr / 2 + de, l2 = Math.max(1e-6, tr / 2 - de), ang = 0.5 * Math.atan2(2 * cxy, cxx - cyy);
      // 偏度：沿长轴的三阶矩 → 一头圆一头尖
      cells.push({ id: k, area: a.n * RES * RES, c: [xmin + (mx + .5) * RES, ymax - (my + .5) * RES], bb: [a.x0, a.y0, a.x1, a.y1], ratio: Math.sqrt(l1 / l2), ang, mx, my, nb: a.b.size, edge: a.edge, skew: 0 }); }
    const byId = new Map(cells.map(c => [c.id, c])); const m3 = new Map();
    for (let i = 0; i < NN; i++) { const c = byId.get(CL.lab[i]); if (!c) continue; const u = ((i % W) - c.mx) * Math.cos(c.ang) + (((i / W) | 0) - c.my) * Math.sin(c.ang); const r = m3.get(c.id) || [0, 0]; r[0] += u * u * u; r[1] += u * u; m3.set(c.id, r); }
    for (const c of cells) { const r = m3.get(c.id), n = c.area / (RES * RES), v = r[1] / n; c.skew = r[0] / n / Math.pow(v, 1.5);
      c.kind = c.ratio < 1.45 ? '枕形' : Math.abs(c.skew) > 0.22 ? '水滴' : '梭形'; }
    cells.sort((a, b) => (a.edge - b.edge) || (b.area - a.area)); }

  // 走廊中心线长度（只计场内）；校验：中心线压在道路上（< 8 m）的比例、路网尺度
  let onL = 0, inL = 0; for (const f of fibres) for (let k = 1; k < f.P.length; k++) { const m = mul(add(f.P[k], f.P[k - 1]), 0.5); if (!inSite(m)) continue; const l = dist(f.P[k], f.P[k - 1]); inL += l; if (site.roadDistAll(m) < 8) onL += l; }
  const totL = inL;
  // 塔所在的室哪些边没有走廊（v0.9.33）：走廊板只做场内的连续段（从场内的节点做到红线，见 deck.js；中心线出了红线、板还有一部分在红线内时接着算，v0.9.35），两端节点都在红线外的走廊整条不做。
  // 沿室的边每 2 m 取一点，附近没有会做出来的走廊中心线（走道半宽 + 6 m）和场内的节点（走道宽 + 12 m） = 这一点外面没有走廊（z.free，塔座的臂不往那里伸）
  if (plazas.length) { const built = []; for (const f of fibres) { const a = nodeP[f.a], b = nodeP[f.b], L = dist(a, b); if (!a || !b || L < 1e-6) continue; const at = q => [a[0] + (b[0] - a[0]) * q / L, a[1] + (b[1] - a[1]) * q / L], okA = inSite(a), okB = inSite(b);
      let sB = -1, s0 = L + 1; if (okA) { sB = L; for (let q = 2; q <= L; q += 2) if (!inSite(at(q))) { sB = q - 2; break; } } if (okB) { s0 = 0; for (let q = L - 2; q >= 0; q -= 2) if (!inSite(at(q))) { s0 = q + 2; break; } }
      // 中心线出了红线，走廊板（中心线左右各半个走道宽）还有一部分在红线内时，板沿红线继续铺（v0.9.35，伦敦 Croydon 发现：原来只算到中心线出红线的地方，把沿红线还有走廊板的室边误判成没有走廊）
      const hw = (f.w || 20) / 2, nx = -(b[1] - a[1]) / L, ny = (b[0] - a[0]) / L, slab = q => { const c = at(q); for (const k of [-1, -0.5, 0.5, 1]) if (inSite([c[0] + nx * hw * k, c[1] + ny * hw * k])) return true; return false; };
      if (okA && sB < L) { let q = sB + 2; while (q <= L && slab(q)) q += 2; sB = q - 2; } if (okB && s0 > 0) { let q = s0 - 2; while (q >= 0 && slab(q)) q -= 2; s0 = q + 2; }
      for (let q = 0; q <= L; q += 2) if (q <= sB || q >= s0) { const p = at(q); built.push(p[0], p[1], (f.w || 20) / 2 + 6); }
      if (okA || s0 <= 2) built.push(a[0], a[1], (f.w || 20) + 12); if (okB || sB >= L - 2) built.push(b[0], b[1], (f.w || 20) + 12); }   // 红线外的节点：走廊板一直铺到它时，节点板也有一部分在红线内   // 场内的节点：节点板，室的圆角离走廊中心线远一些
    for (const z of plazas) { z.free = []; const xs = z.poly.map(p => p[0]), ys = z.poly.map(p => p[1]), bx0 = Math.min(...xs) - 60, bx1 = Math.max(...xs) + 60, by0 = Math.min(...ys) - 60, by1 = Math.max(...ys) + 60, nb = [];
      for (let k = 0; k < built.length; k += 3) if (built[k] > bx0 && built[k] < bx1 && built[k + 1] > by0 && built[k + 1] < by1) nb.push(built[k], built[k + 1], built[k + 2]);
      const S = []; let s0 = 0;   // 室边上的取样点，按周长顺序：[点, 周长位置, 外面没有走廊]
      for (let i = 0; i < z.poly.length; i++) { const a = z.poly[i], b = z.poly[(i + 1) % z.poly.length], L = dist(a, b); for (let q = 0; q < L; q += 2) { const p = [a[0] + (b[0] - a[0]) * q / L, a[1] + (b[1] - a[1]) * q / L];
        let ok = !inSite(p); for (let k = 0; k < nb.length && !ok; k += 3) ok = (nb[k] - p[0]) ** 2 + (nb[k + 1] - p[1]) ** 2 < nb[k + 2] ** 2; S.push([p, s0 + q, !ok]); } s0 += L; }
      // 只认连续 12 m 以上的一段（v0.9.34）：走廊转角处偶尔有一两个取样点离走廊稍远，那不是"这一侧没有走廊"（伦敦 Greenwich 默认参数下 2 m 的一点曾去掉了一条接得上走廊的臂）
      const n = S.length, st = S.findIndex(q => !q[2]); if (st < 0) { if (n) z.free = S.map(q => q[0]); }
      else { let run = []; const flush = () => { if (run.length) { const len = ((run[run.length - 1][1] - run[0][1]) % s0 + s0) % s0 + 2; if (len >= 12) for (const q of run) z.free.push(q[0]); } run = []; };
        for (let j = 1; j <= n; j++) { const q = S[(st + j) % n]; if (q[2]) run.push(q); else flush(); } flush(); } } }
  return { mode: MODE, rings, plazas, gatePlates, entryStrands, secs, gates, trace: TR, P, nRemoved, strands, nodeP, fixed, edges, fibres, inner, towers, cen, nrm,
    grid: { W, H, RES, xmin, ymax, landM, corrF, corr, cellsM, sd: sdGrid, cellLab: CL.lab, polyLab: lab, bldM, hgt, farm, stripe, dc },
    cells, cores, site, cellPolys, spacingAt: spacing, roadSpansL, nNarrow: nNarrowCells, nWaterCut, nBridge, bridgeL, nRoad, roadL, roadSpan: RS, columns, seedsN: seeds.length, stats: { onRoad: inL ? onL / inL : 0, d1: site.d1, d2: site.d2, mode: MODE, strands: strands.length, nodes: inner.length, primE: edges.filter(e => e.prim).length, waterCut: nWaterCut, cells: cells.length, bld: nB, totL, farmA: farmA * RES * RES, corrA: corrA * RES * RES, bldA: bArea * RES * RES } };
}


// ---------------------------------------------------------------- 平面底图（RGBA，深色）：场地、水、农田、建筑；走廊由页面按矢量叠加
function planImage(F, theme) {
  const g = F.grid, { W, H, landM, cellsM, bldM, hgt, farm, stripe, sd } = g, water = F.site.waterM, site = F.site.siteM, img = new Uint8ClampedArray(W * H * 4);
  for (let i = 0; i < W * H; i++) {
    let r = 10, gg = 10, b = 12;
    if (site[i]) { r = 24; gg = 24; b = 28; }
    if (landM[i]) { r = 34; gg = 35; b = 40; }
    if (farm[i]) { if (stripe[i]) { r = 88; gg = 118; b = 74; } else { r = 70; gg = 96; b = 60; } }
    if (cellsM[i] && sd[i] < 6.5) { const t = clamp(6.5 - sd[i], 0, 1) * 0.55; r = r * (1 - t) + 150 * t; gg = gg * (1 - t) + 150 * t; b = b * (1 - t) + 150 * t; }
    if (bldM[i]) { const h = clamp(hgt[i] / 60, 0, 1); r = gg = 128 + 70 * h; b = r + 4; }
    if (water[i]) { r = 22; gg = 52; b = 82; }
    img[i * 4] = r; img[i * 4 + 1] = gg; img[i * 4 + 2] = b; img[i * 4 + 3] = 255;
  }
  void theme; return img;
}
function ms(F, field, G2, zf, bottom, thr = 0.5) {
  const { W, H, RES, xmin, ymax } = F.grid, top = [], side = [], st = G2 / RES;
  const sample = (x, y) => { const xi = clamp(Math.floor(x), 0, W - 2), yi = clamp(Math.floor(y), 0, H - 2), fx = clamp(x - xi, 0, 1), fy = clamp(y - yi, 0, 1);
    return field[yi * W + xi] * (1 - fx) * (1 - fy) + field[yi * W + xi + 1] * fx * (1 - fy) + field[(yi + 1) * W + xi] * (1 - fx) * fy + field[(yi + 1) * W + xi + 1] * fx * fy; };
  const nx = Math.floor((W - 1) / st), ny = Math.floor((H - 1) / st), V = new Float32Array((nx + 1) * (ny + 1));
  for (let j = 0; j <= ny; j++) for (let i = 0; i <= nx; i++) V[j * (nx + 1) + i] = sample(i * st, j * st);
  const X = i => xmin + i * st * RES, Y = j => ymax - j * st * RES;
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    const c = [[X(i), Y(j), V[j * (nx + 1) + i]], [X(i + 1), Y(j), V[j * (nx + 1) + i + 1]], [X(i + 1), Y(j + 1), V[(j + 1) * (nx + 1) + i + 1]], [X(i), Y(j + 1), V[(j + 1) * (nx + 1) + i]]];
    if (c[0][2] < thr && c[1][2] < thr && c[2][2] < thr && c[3][2] < thr) continue;
    const poly = [], cr = [];
    for (let k = 0; k < 4; k++) { const p = c[k], q = c[(k + 1) % 4]; if (p[2] >= thr) poly.push([p[0], p[1]]); if ((p[2] >= thr) !== (q[2] >= thr)) { const t = (thr - p[2]) / (q[2] - p[2]), m = [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t]; poly.push(m); cr.push(m); } }
    if (poly.length < 3) continue;
    const Z = poly.map(p => zf(p[0], p[1]));
    for (let k = 1; k < poly.length - 1; k++) top.push(poly[0][0], poly[0][1], Z[0], poly[k + 1][0], poly[k + 1][1], Z[k + 1], poly[k][0], poly[k][1], Z[k]);
    for (let k = 0; k + 1 < cr.length; k += 2) { const A = cr[k], B = cr[k + 1], za = zf(A[0], A[1]), zb = zf(B[0], B[1]), ba = bottom(za, A[0], A[1]), bb = bottom(zb, B[0], B[1]);
      side.push(A[0], A[1], za, A[0], A[1], ba, B[0], B[1], bb, A[0], A[1], za, B[0], B[1], bb, B[0], B[1], zb); }
  }
  return { top: new Float32Array(top), side: new Float32Array(side) };
}
function meshes(F, P) {
  const g = F.grid, { W, H, RES, xmin, ymax } = g, NN = W * H;
  const deckZ = P.deckZ;
  const corrZ = (x, y) => { let z = deckZ; for (const t of F.towers) { const d = Math.hypot(x - t[0], y - t[1]) - t[2], up = t[2] > 20 ? 14.4 : 7.2; let s = clamp(1 - d / 110, 0, 1); s = s * s * (3 - 2 * s); z = Math.max(z, deckZ + up * s); } return z; };
  const solidAt = (x, y) => { const i = clamp(Math.floor((x - xmin) / RES), 0, W - 1), j = clamp(Math.floor((ymax - y) / RES), 0, H - 1), k = j * W + i; return F.site.landM[k] && !F.site.waterM[k]; };
  // 架空段比路面每边多伸出 3 m：端墙落在路缘外，桥下整条路面都是净空（不会在路缘上斜着伸进路面）
  const roadM0 = F.site.roadM || new Uint8Array(NN), dR = edt(roadM0, W, H), roadM = new Uint8Array(NN); for (let i = 0; i < NN; i++) roadM[i] = dR[i] * RES <= 3 ? 1 : 0;
  const RS = roadSpan(deckZ), onRoad = (x, y) => { const i = clamp(Math.floor((x - xmin) / RES), 0, W - 1), j = clamp(Math.floor((ymax - y) / RES), 0, H - 1); return roadM[j * W + i] === 1; };
  // 跨水 / 跨铁路段：1.2 m 厚的架空桥面；跨路段：按顶标高留出净空（见 roadSpan），带整层种植或只留桥面
  const corridor = ms(F, g.corrF, 2.0, corrZ, (z, x, y) => !solidAt(x, y) ? z - 1.2 : onRoad(x, y) ? z - RS.T : z > deckZ + 0.1 ? z - deckZ : 0);
  // 实心段在路面 / 水面边上的端墙：走廊足迹 ∩ 落地处 的轮廓侧面（否则从桥下能看进实心体里面）
  { const sm = new Float32Array(NN); for (let i = 0; i < NN; i++) sm[i] = F.site.landM[i] && !F.site.waterM[i] && !roadM[i] ? 1 : 0; const sb = blur(sm, W, H, 0.7), body = new Float32Array(NN); for (let i = 0; i < NN; i++) body[i] = g.corrF[i] * sb[i];
    const walls = ms(F, body, 2.0, (x, y) => corrZ(x, y) - 0.02, () => 0).side, cs = new Float32Array(corridor.side.length + walls.length); cs.set(corridor.side); cs.set(walls, corridor.side.length); corridor.side = cs; }
  const fs = new Float32Array(NN); for (let i = 0; i < NN; i++) fs[i] = g.farm[i] ? 1 : 0; // 三维里农田整片铺（条纹只在平面图上）
  for (const z of F.plazas || []) { const T = plazaTiers(z, F.site), q = T.grid, L1 = T.levels[0].mask;   // 塔座的缝底下是农田（L1 盖住的地方不是）
    for (let i = 0; i < NN; i++) { if (g.polyLab[i] !== z.cell + 1) continue; const x = xmin + (i % W + .5) * RES, y = ymax - (((i / W) | 0) + .5) * RES, a = Math.floor((x - q.x0) / q.res), b = Math.floor((y - q.y0) / q.res);
      if (a >= 0 && b >= 0 && a < q.W && b < q.H && !L1[b * q.W + a] && Math.hypot(x - z.c[0], y - z.c[1]) > z.oc + 2) fs[i] = 1; } }
  const farm = ms(F, blur(fs, W, H, 0.6), 4.0, () => 0.25, z => z - 0.2);
  const bS = new Float32Array(NN); for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { let m = 0; for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) { const xx = x + a, yy = y + b; if (xx >= 0 && yy >= 0 && xx < W && yy < H) m = Math.max(m, g.hgt[yy * W + xx]); } bS[y * W + x] = m; }
  const bf = new Float32Array(NN); for (let i = 0; i < NN; i++) bf[i] = g.bldM[i];
  const zb = (x, y) => { const i = clamp(Math.floor((x - xmin) / RES), 0, W - 1), j = clamp(Math.floor((ymax - y) / RES), 0, H - 1); return bS[j * W + i] || 7.2; };
  const bld = ms(F, blur(bf, W, H, 0.6), 2.0, zb, () => 0);
  const pm = (F.plazas || []).map(z => plazaMesh(z, F.site)), cat = (k, T) => { const n = pm.reduce((a, m) => a + m[k].length, 0), o = new T(n); let q = 0; for (const m of pm) { o.set(m[k], q); q += m[k].length; } return o; };
  const plaza = { top: cat('top', Float32Array), side: cat('side', Float32Array), bottom: cat('bottom', Float32Array), lvl: cat('lvl', Uint8Array), cols: (F.plazas || []).flatMap(z => plazaTiers(z, F.site).cols) };   // 三层塔座和它的柱子（[x, y, 柱顶, 柱脚]）
  return { corridor, farm, bld, plaza };
}

// 方案打分（与张量场工作室统一：5 组各 0–100 分，按权重加权；lin = 在"差"与"好"之间线性折算，band = 落在合理区间内满分）
const SCORE_W0 = { farm: 20, cells: 35, prim: 15, span: 15, eff: 15 };
const SCORE_B = { farm: [0.60, 0.68, 0.80, 0.90], cv: [0.75, 0.30], small: [10, 0], acute: [0.12, 0], cov: [0.55, 0.95], span: [0.32, 0.14], along: [0.10, 0.02], eff: [0.45, 0.22] };
function scoreStructure(F, w) { w = w || SCORE_W0; const site = F.site, g = F.grid, st = F.stats, B = SCORE_B;
  const lin = (x, bad, good) => clamp((x - bad) / (good - bad), 0, 1) * 100, band = (x, z0, lo, hi, z1) => x < lo ? lin(x, z0, lo) : x > hi ? lin(x, z1, hi) : 100;
  const raw = {}, G = {};
  raw.farmShare = st.farmA / (site.landHa * 1e4); G.farm = band(raw.farmShare, ...B.farm);
  { const r = [], sp = F.spacingAt || (() => 1); let small = 0;
    let acute = 0; const angAt = (V, i) => { const n = V.length, a = V[(i - 1 + n) % n], b = V[i], e = V[(i + 1) % n], u = sub(a, b), v = sub(e, b); return Math.acos(clamp(dot(u, v) / ((Math.hypot(u[0], u[1]) * Math.hypot(v[0], v[1])) || 1), -1, 1)); };
    for (const cp of F.cellPolys) { const Q = cp.poly; if (Q.filter(p => site.inSite(p)).length < Q.length * 0.8) continue; const c = Q.reduce((a, p) => [a[0] + p[0] / Q.length, a[1] + p[1] / Q.length], [0, 0]), s2 = sp(c) ** 2, a = Math.abs(polyArea(Q)); r.push(a / s2); if (a < 0.25 * s2) small++;
      const V = (cp.V || []).map(o => o.p); if (V.length >= 3 && V.some((_, i) => angAt(V, i) < 40 * Math.PI / 180)) acute++; }
    const m = r.reduce((a, b) => a + b, 0) / (r.length || 1), sd = Math.sqrt(r.reduce((a, b) => a + (b - m) ** 2, 0) / (r.length || 1)); raw.cellCV = r.length ? sd / m : 1; raw.small = small; raw.acute = acute; raw.acuteShare = r.length ? acute / r.length : 0;
    G.cells = (lin(raw.cellCV, ...B.cv) + lin(raw.small, ...B.small) + lin(raw.acuteShare, ...B.acute)) / 3; }
  { const pf = F.fibres.filter(f => f.prim); let n = 0, c = 0;
    const sd2 = (p, a, b) => { const dx = b[0] - a[0], dy = b[1] - a[1]; let t = ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (dx * dx + dy * dy || 1); t = clamp(t, 0, 1); return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy); };
    for (const S of F.strands) for (let i = 0; i < S.length; i += 5) { const p = S[i]; if (!site.inSite(p) || site.bdist(p) < 40 || F.rings.some(r => dist(p, r.c) < 2.6 * r.r)) continue; n++; let m = 1e9; for (const f of pf) for (let k = 1; k < f.P.length && m >= 8; k++) m = Math.min(m, sd2(p, f.P[k - 1], f.P[k])); if (m < 8) c++; }
    raw.primCover = n ? c / n : null; G.prim = n ? lin(raw.primCover, ...B.cov) : null; }
  { let L = 0; for (const f of F.fibres) for (let k = 1; k < f.P.length; k++) { const a = f.P[k - 1], b = f.P[k]; if (site.inSite(mul(add(a, b), 0.5))) L += dist(a, b); }
    raw.spanShare = (F.bridgeL + (F.roadL || 0)) / (L || 1); raw.alongStreet = (F.roadSpansL || []).filter(x => x > 30).reduce((a, b) => a + b, 0) / (L || 1);
    G.span = (lin(raw.spanShare, ...B.span) + lin(raw.alongStreet, ...B.along)) / 2; }
  raw.corrPerFarm = st.corrA / (st.farmA || 1); G.eff = lin(raw.corrPerFarm, ...B.eff);
  // 问题（对应张量场的"断头路"）：白块（离任何室都超过一个主线走廊宽的走廊面）；换了窄走廊的室只提示
  { const W = g.W, H = g.H, cm = new Uint8Array(W * H); for (let i = 0; i < W * H; i++) cm[i] = g.cellsM[i] ? 1 : 0; const d = edt(cm, W, H); let blob = 0; const lim = Math.max(F.P ? F.P.wP : 20, 20);
    for (let i = 0; i < W * H; i++) { if (!g.corr[i] || !site.landM[i] || site.waterM[i] || d[i] * g.RES <= lim) continue; const x = g.xmin + (i % W + .5) * g.RES, y = g.ymax - (((i / W) | 0) + .5) * g.RES; if (F.towers.some(t => Math.hypot(x - t[0], y - t[1]) < t[2] + 40) || (F.gatePlates || []).some(q => dist([x, y], q.c) < q.r + 20)) continue; blob++; }
    raw.blobHa = blob * g.RES * g.RES / 1e4; }
  const fail = raw.blobHa > 0.5 ? [{ k: 'blob', n: +raw.blobHa.toFixed(1) }] : [], warn = F.nNarrow ? [{ k: 'narrow', n: F.nNarrow }] : [];
  let tw = 0, ts = 0; for (const k in G) { if (G[k] == null) continue; tw += w[k] || 0; ts += (w[k] || 0) * G[k]; }
  return { total: tw ? ts / tw : 0, groups: G, raw, fail, warn }; }
// 方案缩略 / 预览用的轻量数据（能传给后台线程）：室多边形（抽稀）、主线、塔
function runSketch(F) { const simp = Q => { const o = []; for (let i = 0; i < Q.length; i += Math.max(1, Math.floor(Q.length / 28))) o.push([Math.round(Q[i][0] * 10) / 10, Math.round(Q[i][1] * 10) / 10]); return o; };
  return { cells: F.cellPolys.map(cp => simp(cp.poly)), towers: F.towers.map(t => [t[0], t[1], t[2], t[4] || '']), mode: F.mode }; }
// 走廊顶面标高（种植塔附近抬升），三维里画主线等需要贴在顶面上的东西时用
// 种植塔（台座 + 三片壳，模型见 assets/tower-model.json、engine/tower.js）的缩放和朝向。这里只用到模型的塔高和台座三个尖角的方向，
// 和 engine/tower.js 里的数据一致（测试会核对），这样 structure.js 不依赖别的文件。
// 缩放：最高一片塔放大到 170 m；塔所在的那块场地比最大的一块小时，按面积开平方等比缩小（台座和塔一起），最多缩到 80%。
// 朝向：台座的一个尖角对准离塔最近的那条主线的方向（取转得最少的那个尖角）。
// 塔 = [x, y, r, 塔尖离地高度, kind, s, rot, 塔脚高度]。塔脚高度看 P.towerBase：'plaza' 三层退台塔座，塔立在 L3 16.4 m（默认）、'podium' 台座 21.0 m、'plates' 三层平面 16.4 m、'none' 地面 0
const TOWER_MODEL = { h: 157.13, top: 21.0, target: 170, minRel: 0.8, corners: [-2.3562, -0.576, 1.9024], base: { plaza: 16.4, podium: 21.0, plates: 16.4, none: 0 },
  footR: 63.17, feet: [[[-25.8,28.2],[-7.8,29.4],[2.1,33.9],[-1.9,36.8],[-4.7,38.6],[-6.3,39.4],[-7.7,40],[-9.3,40.5],[-10.6,40.8],[-11.4,40.8],[-12.2,40.8],[-13,40.7],[-13.8,40.5],[-14.6,40.2],[-15.8,39.6],[-17.1,38.6],[-18.4,37.6],[-19.6,36.4],[-21.8,33.8],[-24.8,29.9]],[[31.1,-42.2],[36.4,-40.2],[39,-39],[41.6,-37.7],[42.8,-36.9],[44,-36],[45,-35],[45.9,-34],[46.6,-32.7],[47.1,-31.3],[47.3,-29.9],[47.2,-28.5],[47.1,-27],[46.8,-25.6],[46,-22.8],[45.1,-20.1],[42.9,-14.8],[39,-19.6],[38,-20.9],[35,-25.1],[33.1,-29.4],[31.2,-39.8]],[[-45.4,-35.5],[-45.3,-38.3],[-45.1,-40.4],[-44.9,-41.8],[-44.5,-43.1],[-44,-44.5],[-43.4,-45.7],[-42.7,-46.5],[-41.9,-47.2],[-40.7,-48],[-39.4,-48.5],[-38.1,-48.9],[-36.7,-49.1],[-35.3,-49.3],[-32.5,-49.5],[-28.2,-49.5],[-30.3,-41.4],[-33,-38.1],[-35,-36],[-45.3,-29.5]]] };   // feet：三片塔塔脚轮廓（模型坐标，隔点取自 engine/tower.js 的 MODEL.feet），footR：塔脚离中心最远的距离
const towerBaseOf = P => (P && P.towerBase) || 'plaza';
const inPolyS = (p, P) => { let c = false; for (let i = 0, j = P.length - 1; i < P.length; j = i++) if ((P[i][1] > p[1]) !== (P[j][1] > p[1]) && p[0] < (P[j][0] - P[i][0]) * (p[1] - P[i][1]) / (P[j][1] - P[i][1]) + P[i][0]) c = !c; return c; };
// 每座塔的缩放：最高一片放大到 170 m；所在那块场地比最大的一块小时按面积开平方缩小（最多到 80%）。分格之前就要用（塔区的室要按塔脚大小放大），所以单独算
function towerScales(pts, site) { const pieces = (site.snap && site.snap.pieces) || [], areaOf = P => { let a = 0; for (let i = 0, j = P.length - 1; i < P.length; j = i++) a += (P[j][0] + P[i][0]) * (P[j][1] - P[i][1]); return Math.abs(a) / 2; };
  const A = pts.map(t => { const pc = pieces.find(pc => inPolyS(t, pc.outer)); return pc ? areaOf(pc.outer) - (pc.holes || []).filter(h => h.length > 2).reduce((s, h) => s + areaOf(h), 0) : 0; });
  const Amax = Math.max(1, ...A), base = TOWER_MODEL.target / TOWER_MODEL.h; return A.map(a => base * (a > 0 ? clamp(Math.sqrt(a / Amax), TOWER_MODEL.minRel, 1) : 1)); }
function placeTowers(towers, site, strands, P) { const z0 = TOWER_MODEL.base[towerBaseOf(P)] ?? TOWER_MODEL.top, SC = towerScales(towers, site);
  towers.forEach((t, i) => { const sc = SC[i];
    let best = null; for (const S of strands || []) for (let k = 0; k < S.length; k++) { const d = dist(S[k], t); if (!best || d < best.d) best = { d, S, k }; }
    let rot = 0; if (best) { const a = best.S[Math.max(0, best.k - 5)], b = best.S[Math.min(best.S.length - 1, best.k + 5)], th = Math.atan2(b[1] - a[1], b[0] - a[0]); let m = Infinity;
      for (const c of TOWER_MODEL.corners) for (const d of [th, th + Math.PI]) { let r = d - c; r = Math.atan2(Math.sin(r), Math.cos(r)); if (Math.abs(r) < Math.abs(m)) m = r; } rot = m; }
    t[3] = +(z0 + TOWER_MODEL.h * sc).toFixed(1); t[4] = ''; t[5] = +sc.toFixed(4); t[6] = +rot.toFixed(4); t[7] = z0; });
}
// ---- 环台（塔下的一层广场）
// 张量场在主吸引点生成的环岛：一条首尾相接、离中心距离几乎不变、绕满一圈的路。返回 { r 中线半径, w 路宽 }，没有就 null
function findRoundabout(c, roads, rMax) { let best = null;
  for (const rd of roads || []) { const pts = (rd.pts || []).map(q => [q[0] ?? q.x, q[1] ?? q.y]); if (pts.length < 8) continue; const d = pts.map(q => Math.hypot(q[0] - c[0], q[1] - c[1]));
    const lo = Math.min(...d), hi = Math.max(...d), m = d.reduce((a, b) => a + b, 0) / d.length; if (hi - lo > Math.max(6, 0.12 * m) || m > rMax) continue;
    const ang = pts.map(q => Math.atan2(q[1] - c[1], q[0] - c[0])).sort((a, b) => a - b); let gap = 2 * Math.PI - (ang[ang.length - 1] - ang[0]); for (let i = 1; i < ang.length; i++) gap = Math.max(gap, ang[i] - ang[i - 1]);
    if (gap > Math.PI / 6) continue; if (!best || m < best.r) best = { r: m, w: rd.width || 12 }; }
  return best; }
const segD = (p, a, b) => { const dx = b[0] - a[0], dy = b[1] - a[1], l2 = dx * dx + dy * dy || 1, t = clamp(((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l2, 0, 1); return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy); };
const polyD = (p, P) => { let m = Infinity; for (let i = 0, j = P.length - 1; i < P.length; j = i++) m = Math.min(m, segD(p, P[j], P[i])); return m; };
// 塔脚轮廓（场地坐标）
function towerFeet(t) { const s = t[5] || 1, a = t[6] || 0, c = Math.cos(a), n = Math.sin(a); return TOWER_MODEL.feet.map(F => F.map(p => [t[0] + s * (c * p[0] - n * p[1]), t[1] + s * (n * p[0] + c * p[1])])); }
// 一座塔的塔座（轻的部分，生成时就算）：塔所在的室、天井（让开塔脚和环岛内沿各 4 m）、环岛、地面柱候选点（环岛内外各一圈、往外每 14 m 一圈，约 12 m 一根，
// 不立在任何道路上、不进天井）。ok = 塔脚全部落在室里、离边 ≥ 1 m。三层的形状在 plazaTiers 里按需算（较慢，方案比较时不算）
const PLAZA_Z = 7.2, PLAZA_T = 1.0;
function makePlaza(t, ti, cellPolys, site, P) { const cell = cellPolys.findIndex(cp => inPolyS(t, cp.poly)); if (cell < 0) return null;
  const poly = cellPolys[cell].poly, c = [t[0], t[1]], rr = poly.map(p => Math.hypot(p[0] - c[0], p[1] - c[1])), rIn = Math.min(...rr);
  const feet = towerFeet(t), fr = feet.flat().map(p => Math.hypot(p[0] - c[0], p[1] - c[1])), footMin = Math.min(...fr);
  const roads = (site.snap && site.snap.roads) || [], ring = findRoundabout(c, roads, rIn), oc = Math.max(10, Math.min(footMin - 4, ring ? ring.r - ring.w / 2 - 4 : Infinity));
  let gap = Infinity; for (const F of feet) for (const p of F) gap = Math.min(gap, inPolyS(p, poly) ? polyD(p, poly) : -polyD(p, poly));
  const RL = roads.map(rd => ({ w: rd.width || 6.5, pts: (rd.pts || []).map(q => [q[0] ?? q.x, q[1] ?? q.y]) })).filter(rd => rd.pts.some(q => Math.hypot(q[0] - c[0], q[1] - c[1]) < Math.max(...rr) + 20));
  const onRoad = p => RL.some(rd => { for (let k = 1; k < rd.pts.length; k++) if (segD(p, rd.pts[k - 1], rd.pts[k]) < rd.w / 2 + 1.5) return true; return false; });
  const radii = []; if (ring) { const a = ring.r - ring.w / 2 - 3; if (a > oc + 3) radii.push(a); radii.push(ring.r + ring.w / 2 + 3); } else radii.push(oc + 4);
  while (radii[radii.length - 1] + 14 < Math.max(...rr)) radii.push(radii[radii.length - 1] + 14);
  const cols = []; for (const R of radii) { const n = Math.max(6, Math.round(2 * Math.PI * R / 12)); for (let k = 0; k < n; k++) { const a = 2 * Math.PI * (k + 0.5 * (radii.indexOf(R) % 2)) / n, p = [c[0] + R * Math.cos(a), c[1] + R * Math.sin(a)];
    if (!inPolyS(p, poly) || polyD(p, poly) < 2.5 || Math.hypot(p[0] - c[0], p[1] - c[1]) < oc + 2 || onRoad(p)) continue; cols.push([p[0], p[1], PLAZA_Z - PLAZA_T]); } }
  return { ti, cell, poly, c, oc, ring, feet, cols, ringW: 0.8 * Math.max((P && P.wCore) || 20, (P && P.wP) || 20), z: PLAZA_Z, thick: PLAZA_T, area: Math.abs(polyArea(poly)) - Math.PI * oc * oc, gap, ok: gap >= 1 }; }
// ---- 三层退台塔座（v0.9.27）：塔所在的室里铺 L1 7.2 / L2 11.8 / L3 16.4 三层，塔立在 L3 上
// 规则（对每个生成结果都适用，在 0.5 m 网格上用距离场做，最后描成光滑轮廓）：
//  1 L3 = 三叶塔座：每片塔一片"叶"伸到走廊环；每两片塔之间一道向塔心凹进的圆弧（谷），弧的两端落在走廊环上、离塔脚 ≥ 3 m，
//    中段在"离塔脚 ≥ 3 m、离天井 ≥ 8 m"的前提下凹到最深；三道谷的大小由场地自己决定（不设上限）
//  2 L2 = L3 外放 8 m，L1 = L3 外放 16 m；离走廊环 40 m 以内台阶宽度平滑收到 0，三层的边相切地汇进走廊环
//  3 L1 另沿辐射路伸出"臂"（路宽 / 2 + 5 m，至少 10 m）接走廊环；L2、L3 靠三片叶接
//  4 圆滑：走廊环和天井当实体做闭运算（L3 12 m，各层 8 m）再做 4 m 开运算 → 没有缺口、窄条、尖角
//    塔脚外 3 m 一定在 L3 上（贴着走廊环的塔脚由三层走廊环托住）；辐射路 = 穿出塔所在的室、又伸到塔附近的路（不依赖张量场一定生成环岛）
//  5 开敞：层间只有板和柱子（地面柱 6.2 m 不立在路上；L1→L2、L2→L3 各一套约 12 m 的柱网）
//  7 断头的臂不做（v0.9.33）：辐射路穿出室的那条边外面没有走廊时（室贴着红线），L1 不沿这条路伸臂；塔座在那一侧沿室的边直切
//  6 红线：三层都只做到场地红线以内（v0.9.32），室伸出红线的部分不铺，在红线处平口截断，和走廊一样
const TIER = { z: [7.2, 11.8, 16.4], thick: 1.0, res: 0.5, step: 8, taper: 40, fr3: 12, frl: 8, open: 4, feetPad: 3, ocKeep: 8, padMax: 40, armMin: 10 };
function plazaTiers(z, site) { if (z._tiers) return z._tiers;
  const T = TIER, Q = T.res, c = z.c, poly = z.poly, roads = (site && site.snap && site.snap.roads) || [];
  let bx0 = Infinity, by0 = Infinity, bx1 = -Infinity, by1 = -Infinity; for (const p of [...poly, ...z.feet.flat()]) { bx0 = Math.min(bx0, p[0]); by0 = Math.min(by0, p[1]); bx1 = Math.max(bx1, p[0]); by1 = Math.max(by1, p[1]); }
  const x0 = bx0 - 8, y0 = by0 - 8, W = Math.ceil((bx1 - bx0 + 16) / Q), H = Math.ceil((by1 - by0 + 16) / Q), N = W * H, X = i => x0 + (i + 0.5) * Q, Y = j => y0 + (j + 0.5) * Q, pix = p => [(p[0] - x0) / Q, (p[1] - y0) / Q];
  const cell = new Uint8Array(N); fillPoly(cell, W, H, poly.map(pix), 1);
  const R = new Float32Array(N); for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) R[j * W + i] = Math.hypot(X(i) - c[0], Y(j) - c[1]);
  const feet = new Uint8Array(N); for (const f of z.feet) fillPoly(feet, W, H, f.map(pix), 1);
  const not = m => { const o = new Uint8Array(N); for (let i = 0; i < N; i++) o[i] = m[i] ? 0 : 1; return o; };
  const dil = (m, r) => { const d = edt(m, W, H), o = new Uint8Array(N); for (let i = 0; i < N; i++) o[i] = d[i] * Q <= r ? 1 : 0; return o; };
  const ero = (m, r) => { const d = edt(not(m), W, H), o = new Uint8Array(N); for (let i = 0; i < N; i++) o[i] = d[i] * Q > r ? 1 : 0; return o; };
  const closing = (m, r) => ero(dil(m, r), r), opening = (m, r) => dil(ero(m, r), r);
  // 场地红线（v0.9.32）：室被拉长、伸出红线时，塔座只做到红线（和走廊一样在红线处平口截断）。红线外当实体参与圆角，所以红线处是平口、不收圆
  const inS = new Uint8Array(N), FP = (site && site.footPolys) || []; if (FP.length) { for (const fp of FP) fillPoly(inS, W, H, fp.map(pix), 1); } else inS.fill(1);
  const inner = i => cell[i] && inS[i] && R[i] > z.oc, EXT = new Uint8Array(N); for (let i = 0; i < N; i++) EXT[i] = inner(i) ? 0 : 1;
  const smoothM = (m, rc, ro) => { const a = new Uint8Array(N); for (let i = 0; i < N; i++) a[i] = m[i] || EXT[i] ? 1 : 0; const b = opening(closing(a, rc), ro); for (let i = 0; i < N; i++) b[i] = b[i] && inner(i) ? 1 : 0; return b; };
  // 1 三道谷
  const rayE = a => { const d = [Math.cos(a), Math.sin(a)]; let best = Infinity;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const p = poly[j], q = poly[i], e = [q[0] - p[0], q[1] - p[1]], den = d[0] * e[1] - d[1] * e[0]; if (Math.abs(den) < 1e-12) continue;
      const w = [p[0] - c[0], p[1] - c[1]], s = (w[0] * e[1] - w[1] * e[0]) / den, u = (w[0] * d[1] - w[1] * d[0]) / den; if (s > 0 && u >= 0 && u <= 1) best = Math.min(best, s); } return best; };
  const fb = dil(feet, T.feetPad), fbPts = []; for (let i = 0; i < N; i++) if (fb[i]) fbPts.push(X(i % W), Y((i / W) | 0));
  const FT = z.feet.map(f => ({ f, a: Math.atan2(f.reduce((s, p) => s + p[1], 0) / f.length - c[1], f.reduce((s, p) => s + p[0], 0) / f.length - c[0]) })).sort((p, q) => p.a - q.a);
  const angs = (f, ref) => f.map(p => { let a = Math.atan2(p[1] - c[1], p[0] - c[0]) - ref; a = ((a + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI; return a + ref; });
  const valley = new Uint8Array(N), arcs = [];
  for (let k = 0; k < FT.length; k++) { const A = FT[k], B = FT[(k + 1) % FT.length]; let ai = A.a, aj = B.a; if (aj <= ai) aj += 2 * Math.PI;
    const e1 = Math.max(...angs(A.f, ai)), e2 = Math.min(...angs(B.f, aj)), mid = (e1 + e2) / 2; let best = null;
    for (let pad = 2; pad < T.padMax; pad++) { const a1 = e1 + pad / rayE(e1), a2 = e2 - pad / rayE(e2); if (a2 - a1 < 20 * Math.PI / 180) break;
      const E1 = [c[0] + rayE(a1) * Math.cos(a1), c[1] + rayE(a1) * Math.sin(a1)], E2 = [c[0] + rayE(a2) * Math.cos(a2), c[1] + rayE(a2) * Math.sin(a2)];
      for (let rap = z.oc + T.ocKeep; rap < 70; rap++) { const Ap = [c[0] + rap * Math.cos(mid), c[1] + rap * Math.sin(mid)];
        const a11 = E1[0] - Ap[0], a12 = E1[1] - Ap[1], a21 = E2[0] - Ap[0], a22 = E2[1] - Ap[1], det = a11 * a22 - a12 * a21; if (Math.abs(det) < 1e-9) continue;
        const b1 = 0.5 * (E1[0] ** 2 + E1[1] ** 2 - Ap[0] ** 2 - Ap[1] ** 2), b2 = 0.5 * (E2[0] ** 2 + E2[1] ** 2 - Ap[0] ** 2 - Ap[1] ** 2), C = [(b1 * a22 - a12 * b2) / det, (a11 * b2 - b1 * a21) / det], rc = Math.hypot(E1[0] - C[0], E1[1] - C[1]);
        let hit = false; for (let q = 0; q < fbPts.length; q += 2) if ((fbPts[q] - C[0]) ** 2 + (fbPts[q + 1] - C[1]) ** 2 < rc * rc) { hit = true; break; } if (hit) continue;
        const i0 = Math.max(0, Math.floor((C[0] - rc - x0) / Q)), i1 = Math.min(W - 1, Math.ceil((C[0] + rc - x0) / Q)), j0 = Math.max(0, Math.floor((C[1] - rc - y0) / Q)), j1 = Math.min(H - 1, Math.ceil((C[1] + rc - y0) / Q)); let area = 0;
        for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) if (cell[j * W + i] && (X(i) - C[0]) ** 2 + (Y(j) - C[1]) ** 2 < rc * rc) area++;
        if (!best || area > best.area) best = { area, C, rc, E1, E2, Ap }; break; } }
    if (!best) continue; arcs.push({ c: best.C, r: best.rc, ends: [best.E1, best.E2], apex: best.Ap, depth: Math.hypot(best.Ap[0] - c[0], best.Ap[1] - c[1]) });
    for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) if ((X(i) - best.C[0]) ** 2 + (Y(j) - best.C[1]) ** 2 < best.rc * best.rc) valley[j * W + i] = 1; }
  const base = new Uint8Array(N); for (let i = 0; i < N; i++) base[i] = inner(i) && !valley[i] ? 1 : 0;
  const L3 = smoothM(base, T.fr3, T.open);
  // 3 L1 的臂：沿辐射路
  const ring = z.ring, rMax = Math.max(...poly.map(p => Math.hypot(p[0] - c[0], p[1] - c[1]))), arms = new Uint8Array(N), spokes = []; let deadArms = 0;
  // 辐射路 = 穿出塔所在的室、又伸到塔附近的路：有环岛时"附近" = 环岛外沿，没有环岛时 = 室内最近半径的 75 %（不依赖张量场一定生成环岛）
  { const rIn = Math.min(...poly.map(p => Math.hypot(p[0] - c[0], p[1] - c[1]))), rOut = ring ? ring.r + ring.w / 2 : 0.75 * rIn - 2;
    for (const rd of roads) { const pts = (rd.pts || []).map(q => [q[0] ?? q.x, q[1] ?? q.y]), rr = pts.map(q => Math.hypot(q[0] - c[0], q[1] - c[1])); if (!pts.length) continue;
      const lo = Math.min(...rr), hi = Math.max(...rr); if (!(lo < rOut + 2 && hi > (ring ? rMax + 5 : rIn + 2) && hi - lo > 6)) continue; spokes.push({ w: rd.width || 6.5, pts });
      // 断头的臂不做（v0.9.33）：这条路穿出室的那条边外面没有走廊（室贴着红线，那一侧的走廊被红线切掉了），臂伸过去哪也不通
      if (z.free && z.free.length) { const lim = ((rd.width || 6.5) / 2 + 6) ** 2; let dead = false; for (let k = 1; k < pts.length && !dead; k++) { const a = pts[k - 1], b = pts[k], n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 2));
          for (let q = 0; q <= n && !dead; q++) { const x = a[0] + (b[0] - a[0]) * q / n, y = a[1] + (b[1] - a[1]) * q / n; for (const f of z.free) if ((f[0] - x) ** 2 + (f[1] - y) ** 2 < lim) { dead = true; break; } } }
        if (dead) { deadArms++; continue; } }
      const m = new Uint8Array(N); for (let k = 1; k < pts.length; k++) { const a = pts[k - 1], b = pts[k], L = Math.hypot(b[0] - a[0], b[1] - a[1]), n = Math.ceil(L / (Q / 2));
        for (let s = 0; s <= n; s++) { const x = a[0] + (b[0] - a[0]) * s / n, y = a[1] + (b[1] - a[1]) * s / n, i = Math.floor((x - x0) / Q), j = Math.floor((y - y0) / Q); if (i >= 0 && j >= 0 && i < W && j < H) m[j * W + i] = 1; } }
      const d = dil(m, Math.max(T.armMin, (rd.width || 6.5) / 2 + 5)); for (let i = 0; i < N; i++) if (d[i] && cell[i] && inS[i]) arms[i] = 1; } }
  // 2 三层：从 L3 往外放，靠走廊环处收窄
  const dB = edt(L3, W, H), dr = edt(not(cell), W, H), lv = [];
  for (let li = 0; li < 3; li++) { const w = T.step * (2 - li), m = new Uint8Array(N);
    for (let i = 0; i < N; i++) { const u = clamp(dr[i] * Q / T.taper, 0, 1), sm = u * u * (3 - 2 * u); m[i] = inner(i) && (L3[i] || dB[i] * Q <= w * sm || (li === 0 && arms[i])) ? 1 : 0; }
    lv.push(smoothM(m, T.frl, T.open)); }
  { const keep = dil(feet, T.feetPad), dr3 = edt(cell, W, H); for (let i = 0; i < N; i++) if (keep[i] && inS[i] && R[i] > z.oc && (cell[i] || dr3[i] * Q > z.ringW)) lv[2][i] = 1; }   // 塔脚外 3 m 一定有 L3：室里补上（圆角可能削掉一点）；室放大到上限还放不下的塔脚（拉扯很大时），伸出走廊环的部分也铺 L3 托住
  for (let i = 0; i < N; i++) { if (lv[2][i]) lv[1][i] = 1; if (lv[1][i]) lv[0][i] = 1; }
  // 校验：塔脚离 L3 边
  const dr2 = edt(cell, W, H), sup = new Uint8Array(N); for (let i = 0; i < N; i++) sup[i] = lv[2][i] || (!cell[i] && inS[i] && R[i] > z.oc && dr2[i] * Q <= z.ringW) ? 1 : 0;   // 塔脚的支撑 = L3 + 走廊环（走廊环一律三层，v0.9.28；宽度按 0.8 × 走廊宽算）
  const dIn = edt(not(sup), W, H); let footClear = Infinity; for (let i = 0; i < N; i++) if (feet[i]) footClear = Math.min(footClear, dIn[i] * Q);
  // 柱子（开敞：只有板和柱）。地面：makePlaza 的候选点里 L1 下面的（离 L1 边 ≥ 2.5 m）；L1→L2、L2→L3：12 m 柱网，离上层板边 ≥ 2.5 m
  const dE = lv.map(m => edt(not(m), W, H)), at = (p, li) => { const i = Math.floor((p[0] - x0) / Q), j = Math.floor((p[1] - y0) / Q); return i >= 0 && j >= 0 && i < W && j < H ? dE[li][j * W + i] * Q : 0; };
  const cols = z.cols.filter(p => at(p, 0) >= 2.5).map(p => [p[0], p[1], T.z[0] - T.thick, 0]);
  for (let li = 1; li < 3; li++) for (let r = z.oc + 6, ring_ = 0; r < rMax; r += 12, ring_++) { const n = Math.max(6, Math.round(2 * Math.PI * r / 12));
    for (let k = 0; k < n; k++) { const a = 2 * Math.PI * (k + 0.5 * (ring_ % 2)) / n, p = [c[0] + r * Math.cos(a), c[1] + r * Math.sin(a)]; if (at(p, li) >= 2.5) cols.push([p[0], p[1], T.z[li] - T.thick, T.z[li - 1]]); } }
  // 轮廓：碰到走廊环的地方往外多伸 1.5 m 藏进走廊板里（不留缝），再按符号距离场描边
  const levels = lv.map((m, li) => { const mx = new Uint8Array(N), dm = edt(m, W, H); for (let i = 0; i < N; i++) mx[i] = m[i] || (!cell[i] && inS[i] && R[i] > z.oc && dm[i] * Q <= 1.5) ? 1 : 0;
    for (const fill of [0, 1]) { const tgt = new Uint8Array(N); for (let i = 0; i < N; i++) tgt[i] = mx[i] === fill ? 1 : 0; const L = label4(tgt, W, H);   // 小于 30 m² 的碎片去掉、小洞填上
      for (let i = 0; i < N; i++) { const k = L.lab[i]; if (k && L.sizes[k] * Q * Q < 30) mx[i] = 1 - fill; } }
    const a = edt(not(mx), W, H), b = edt(mx, W, H), sd = new Float32Array(N); for (let i = 0; i < N; i++) sd[i] = (a[i] - b[i]) * Q;
    let area = 0; for (let i = 0; i < N; i++) if (m[i]) area += Q * Q;
    return { z: T.z[li], area, mask: m, sd: blur(sd, W, H, 1.2) }; });
  let voidA = 0; for (let i = 0; i < N; i++) if (inner(i) && !lv[0][i]) voidA += Q * Q;
  let clipA = 0; for (let i = 0; i < N; i++) if (cell[i] && R[i] > z.oc && !inS[i]) clipA += Q * Q;   // 室在红线外的面积（塔座不铺）
  return (z._tiers = { grid: { x0, y0, W, H, res: Q }, levels, arcs, spokes, deadArms, cols, footClear, voidArea: voidA, clipArea: clipA, cell, inSite: inS }); }
// 符号距离场（> 0 在里面）描轮廓：marching squares，里面在左手边，闭合成环；filled = 每个格子里的填充多边形（整行连续的整格合并成一个矩形）
function contourField(sd, W, H, x0, y0, Q) { const X = i => x0 + (i + 0.5) * Q, Y = j => y0 + (j + 0.5) * Q, v = (i, j) => (i < 0 || j < 0 || i >= W || j >= H) ? -1 : sd[j * W + i];
  const P = (i, j) => [X(i), Y(j)], lerp = (i0, j0, i1, j1) => { const a = v(i0, j0), b = v(i1, j1), t = a / (a - b); return [X(i0) + (X(i1) - X(i0)) * t, Y(j0) + (Y(j1) - Y(j0)) * t]; };
  const segs = [], polys = [], rects = [];
  for (let j = -1; j < H; j++) { let run = -1;
    for (let i = -1; i <= W; i++) { const a = v(i, j) > 0, b = v(i + 1, j) > 0, cc = v(i + 1, j + 1) > 0, d = v(i, j + 1) > 0, full = a && b && cc && d;
      if (full && i < W - 1) { if (run < 0) run = i; continue; } if (run >= 0) { rects.push([X(run), Y(j), X(i), Y(j + 1)]); run = -1; } if (i >= W) break;
      if (!(a || b || cc || d)) continue;
      // 格子四角：0 (i,j) 1 (i+1,j) 2 (i+1,j+1) 3 (i,j+1)；边：e0 下 e1 右 e2 上 e3 左
      const C = [[i, j], [i + 1, j], [i + 1, j + 1], [i, j + 1]], IN = [a, b, cc, d], E = k => { const p = C[k], q = C[(k + 1) % 4]; return lerp(p[0], p[1], q[0], q[1]); }, key = k => { const p = C[k], q = C[(k + 1) % 4]; return Math.min(p[0], q[0]) + ',' + Math.min(p[1], q[1]) + (p[1] === q[1] ? 'h' : 'v'); };
      // 填充多边形：沿四角走，里面的角取角点，内外交替处取边上的交点
      const poly = []; for (let k = 0; k < 4; k++) { if (IN[k]) poly.push(P(...C[k])); if (IN[k] !== IN[(k + 1) % 4]) poly.push(E(k)); }
      const sad = IN[0] === IN[2] && IN[1] === IN[3] && IN[0] !== IN[1], ctr = (v(i, j) + v(i + 1, j) + v(i + 1, j + 1) + v(i, j + 1)) / 4 > 0;
      if (sad && !ctr) { for (const k of [0, 1, 2, 3]) if (IN[k]) polys.push([P(...C[k]), E(k), E((k + 3) % 4)]); } else polys.push(poly);
      // 边界线段：从"进入里面"的边到"离开"的边（里面在左手边）
      const out = []; for (let k = 0; k < 4; k++) if (IN[k] && !IN[(k + 1) % 4]) out.push(k); const inn = []; for (let k = 0; k < 4; k++) if (!IN[k] && IN[(k + 1) % 4]) inn.push(k);
      if (out.length === 1) segs.push([key(inn[0]), E(inn[0]), key(out[0]), E(out[0])]);
      else if (out.length === 2) { const pair = sad && !ctr ? [[inn[0], out.find(k => (k + 1) % 4 === inn[0]) ?? out[0]], [inn[1], out.find(k => (k + 1) % 4 === inn[1]) ?? out[1]]] : [[inn[0], out.find(k => (k + 3) % 4 !== inn[0] && (k + 1) % 4 !== inn[0]) ?? out[1]], [inn[1], out.find(k => (k + 3) % 4 !== inn[1] && (k + 1) % 4 !== inn[1]) ?? out[0]]];
        for (const [p, q] of pair) segs.push([key(p), E(p), key(q), E(q)]); } } }
  // 线段连成环
  const next = new Map(); for (const s of segs) next.set(s[0], s); const used = new Set(), rings = [];
  for (const s0 of segs) { if (used.has(s0[0])) continue; const ring = []; let s = s0, guard = 0; while (s && !used.has(s[0]) && guard++ < 1e6) { used.add(s[0]); ring.push(s[1]); s = next.get(s[2]); } if (ring.length > 2) rings.push(ring); }
  return { segs, polys, rects, rings }; }
function simplifyRing(P, eps) { if (P.length < 8) return P; const keep = new Uint8Array(P.length); keep[0] = keep[P.length - 1] = 1;
  const st = [[0, P.length - 1]]; while (st.length) { const [a, b] = st.pop(); let m = -1, md = eps; const dx = P[b][0] - P[a][0], dy = P[b][1] - P[a][1], l = Math.hypot(dx, dy) || 1;
    for (let i = a + 1; i < b; i++) { const d = Math.abs((P[i][0] - P[a][0]) * dy - (P[i][1] - P[a][1]) * dx) / l; if (d > md) { md = d; m = i; } } if (m > 0) { keep[m] = 1; st.push([a, m], [m, b]); } }
  return P.filter((_, i) => keep[i]); }
// 塔座的轮廓（每层若干环，里面在左手边：外环逆时针、洞顺时针），平面图和导出用
function plazaOutline(z, site) { const T = plazaTiers(z, site), g = T.grid; if (T._rings) return T._rings;
  return (T._rings = T.levels.map(L => ({ z: L.z, rings: contourField(L.sd, g.W, g.H, g.x0, g.y0, g.res).rings.map(r => r.slice().reverse()).map(r => { const h = r.length >> 1; return [...simplifyRing(r.slice(0, h + 1), 0.08).slice(0, -1), ...simplifyRing([...r.slice(h), r[0]], 0.08).slice(0, -1)]; }).filter(r => r.length > 3) }))); }
// 塔座三层的网格：顶面（每层一张）、侧面（沿轮廓 1 m 高）、底面；lvl = 每个顶面三角形的层号（1–3），按走廊三层的明暗上色
function plazaMesh(z, site) { const T = plazaTiers(z, site), g = T.grid, top = [], side = [], bottom = [], lvl = [];
  T.levels.forEach((L, li) => { const zt = L.z - 0.02, zb = L.z - TIER.thick, cf = contourField(L.sd, g.W, g.H, g.x0, g.y0, g.res);
    const tri = (a, b, d) => { top.push(a[0], a[1], zt, b[0], b[1], zt, d[0], d[1], zt); bottom.push(a[0], a[1], zb, d[0], d[1], zb, b[0], b[1], zb); lvl.push(li + 1); };
    for (const [xa, ya, xb, yb] of cf.rects) { tri([xa, ya], [xb, ya], [xb, yb]); tri([xa, ya], [xb, yb], [xa, yb]); }
    for (const P of cf.polys) for (let k = 1; k < P.length - 1; k++) tri(P[0], P[k], P[k + 1]);
    for (const [, a, , b] of cf.segs) side.push(a[0], a[1], zt, a[0], a[1], zb, b[0], b[1], zb, a[0], a[1], zt, b[0], b[1], zb, b[0], b[1], zt); });
  return { top: new Float32Array(top), side: new Float32Array(side), bottom: new Float32Array(bottom), lvl: new Uint8Array(lvl) }; }
function deckHeight(F, deckZ) { return (x, y) => { let z = deckZ; for (const t of F.towers) { const d = Math.hypot(x - t[0], y - t[1]) - t[2], up = t[2] > 20 ? 14.4 : 7.2; let s = clamp(1 - d / 110, 0, 1); s = s * s * (3 - 2 * s); z = Math.max(z, deckZ + up * s); } return z; }; }
const API = { TOWER_MODEL, TIER, towerFeet, findRoundabout, plazaTiers, plazaOutline, plazaMesh, contourField, deckHeight, SCORE_W0, scoreStructure, runSketch, roadSpan, prepareSite, buildStructure, planImage, meshes, ms, util: { edt, blur, label4, resample, arclen } };
if (typeof module !== 'undefined') module.exports = API; else root.SS = API;
})(typeof self !== 'undefined' ? self : this);
