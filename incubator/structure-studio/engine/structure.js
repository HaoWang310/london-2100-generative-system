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
  const RES = res || 2, W = Math.ceil(snap.w / RES), H = Math.ceil(snap.h / RES), NN = W * H, xmin = 0, ymax = snap.h;
  const toPix = p => [(p[0] - xmin) / RES, (ymax - p[1]) / RES];
  const landM = new Uint8Array(NN), waterM = new Uint8Array(NN);
  for (const pc of snap.pieces) { fillPoly(landM, W, H, pc.outer.map(toPix), 1); for (const h of pc.holes || []) if (h.length > 2) fillPoly(landM, W, H, h.map(toPix), 0); }
  for (const w of snap.water || []) for (const ring of w) if (ring.length > 2) fillPoly(waterM, W, H, ring.map(toPix), 1);
  // 结构可跨越的范围：各块土地闭运算 25 m（越过铁路、道路缝隙和小洞，外轮廓不变）
  const r = Math.round(25 / RES), dOut = edt(landM, W, H), dil = new Uint8Array(NN); for (let i = 0; i < NN; i++) dil[i] = dOut[i] * RES <= 40 ? 0 : 1;
  const dIn = edt(dil, W, H), siteM = new Uint8Array(NN); for (let i = 0; i < NN; i++) siteM[i] = dIn[i] * RES > 40 ? 1 : 0; void r;
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
  const cores = snap.attractors.filter(a => a.kind === 'main').map(a => [a.x, a.y]).filter(inSite);
  let landA = 0; for (let i = 0; i < NN; i++) landA += landM[i];
  // 路网尺度：主路 / 全部道路的距离场；平行路网里点到路的平均距离 = 间距 / 4，由此估主路间距 d1、次路间距 d2
  const rasterRoads = list => { const M = new Uint8Array(NN); for (const r of list) for (const q of resample(r.pts, RES * 0.5).map(toPix)) { const x = Math.floor(q[0]), y = Math.floor(q[1]); if (x >= 0 && y >= 0 && x < W && y < H) M[y * W + x] = 1; } return M; };
  const dMainG = edt(rasterRoads(snap.roads.filter(r => r.grade === 'main')), W, H), dAllG = edt(rasterRoads(snap.roads), W, H);
  let sMain = 0, sAll = 0, nR = 0; for (let i = 0; i < NN; i++) if (siteM[i] && landM[i] && !waterM[i]) { sMain += Math.min(dMainG[i] * RES, 400); sAll += Math.min(dAllG[i] * RES, 200); nR++; }
  const d1 = nR ? 4 * sMain / nR : 300, d2 = nR ? 4 * sAll / nR : 115;
  const roadDistAll = p => { const q = toPix(p), x = Math.floor(q[0]), y = Math.floor(q[1]); return x >= 0 && y >= 0 && x < W && y < H ? dAllG[y * W + x] * RES : 1e9; };
  return { d1, d2, roadDistAll, snap, RES, W, H, NN, xmin, ymax, toPix, landM, waterM, siteM, footPolys, field, inSite, inWater, bdist, roadDist, mainRoads, t0: [Math.cos(a0), Math.sin(a0)], cen, bbox: [lx0, ly0, lx1, ly1], cores: cores.length ? cores : [cen], landHa: landA * RES * RES / 1e4 };
}

// ---------------------------------------------------------------- 主生成
function buildStructure(site, P, EXCL) {
  const rnd = mulberry32(P.seed * 977 + 31), U = (a, b) => a + (b - a) * rnd();
  const { RES, W, H, NN, xmin, ymax, toPix, landM, waterM, siteM, inSite, inWater, bdist, roadDist, cen } = site;
  const field = p => { const d = site.field(p); return d ? rot(d, P.rotF) : rot(site.t0, P.rotF); };
  const [lx0, ly0, lx1, ly1] = site.bbox;
  const cores = site.cores; // 核心 = 张量场的全部主吸引点（由上游决定，不在这里设）
  // 1 疏密场：到最近核心的距离
  const coreT = p => { let d = 1e9; for (const c of cores) d = Math.min(d, dist(p, c)); let t = clamp((d - 60) / P.coreR, 0, 1); return t * t * (3 - 2 * t); };
  const spacing = p => P.sCore + (P.sOut - P.sCore) * coreT(p);
  const V1 = P.logic === 'v1' || +P.v1 >= 0.5;
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
  const primKey = JSON.stringify([P.nCore, P.nPrim, P.primAng, P.primFollow, P.primSmooth, P.primStraight, P.primShift, P.offRoad, P.rotF, P.sCore]);
  site.primCache = site.primCache || new Map();
  let strands = TR ? null : site.primCache.get(primKey);
  if (!strands) {
  strands = [];
  cores.forEach((c, ci) => { for (let k = 0; k < P.nPrim; k++) {
    const ang = (k - (P.nPrim - 1) / 2) * P.primAng, d0 = rot(primField(c), ang), nn = [-d0[1], d0[0]]; let best = null;
    for (let o = -P.primShift; o <= P.primShift; o += 10) { const seed = add(c, mul(nn, o)); if (!inSite(seed)) continue; const S = trace(seed, ang), ds = [];
      for (let i = 0; i < S.length; i += 3) if (inSite(S[i])) ds.push(Math.min(roadDist(S[i]), 80)); if (ds.length < 20) continue;
      ds.sort((a, b) => a - b); let sc = ds[Math.floor(ds.length * 0.15)] + 0.4 * ds.reduce((s, v) => s + v, 0) / ds.length - 0.05 * Math.abs(o);
      if (P.offRoad < 0.5) sc = -sc; // 贴路：取离主干路最近的
      if (strands.some(T => { let m = 1e9; for (let i = 0; i < S.length; i += 6) for (let j = 0; j < T.length; j += 6) m = Math.min(m, dist(S[i], T[j])); return m < P.sCore * 0.8; })) sc -= 1000;
      if (TR) TR.cand.push({ core: ci, k, o, sc, S: S.filter((_, i) => i % 5 === 0) });
      if (!best || sc > best.sc) best = { sc, S }; }
    if (best && best.sc > -900) strands.push(best.S); } });
  if (!TR) site.primCache.set(primKey, strands); }

  // 3 拉扯：v0 = 压缩空间 G 生成均匀绳网 → 沿全场主方向拉长；v1 = 直接在场地里沿局部张量场排流线行布点（格网随场连续变形）
  const t0 = unit(rot(site.t0, P.rotF)), n0 = [-t0[1], t0[0]], aS = 1 + 1.4 * P.pull, ctr = cores[0];
  const A = V1 ? (q => q) : (q => { const d = sub(q, ctr); return add(ctr, add(mul(t0, dot(d, t0) * aS), mul(n0, dot(d, n0)))); });
  const Ai = V1 ? (q => q) : (q => { const d = sub(q, ctr); return add(ctr, add(mul(t0, dot(d, t0) / aS), mul(n0, dot(d, n0)))); });
  const SG = strands.map(S => resample(S.map(Ai), 6));
  const corners = [[lx0, ly0], [lx1, ly0], [lx1, ly1], [lx0, ly1]].map(Ai); let gx0 = 1e9, gy0 = 1e9, gx1 = -1e9, gy1 = -1e9; for (const p of corners) { gx0 = Math.min(gx0, p[0]); gy0 = Math.min(gy0, p[1]); gx1 = Math.max(gx1, p[0]); gy1 = Math.max(gy1, p[1]); }
  const spG = u => V1 ? spacing(u) : spacing(A(u)) / Math.sqrt(aS);
  const PH = new Map(), PC = 30; SG.forEach((S, k) => S.forEach((q, i) => { if (i === S.length - 1) return; const key = Math.floor(q[0] / PC) + ',' + Math.floor(q[1] / PC); if (!PH.has(key)) PH.set(key, []); PH.get(key).push([k, i]); }));
  const primNearG = q => { const gx = Math.floor(q[0] / PC), gy = Math.floor(q[1] / PC); let best = 1e9, bt = [1, 0];
    for (let a = -4; a <= 4; a++) for (let b = -4; b <= 4; b++) { const l = PH.get((gx + a) + ',' + (gy + b)); if (l) for (const [k, i] of l) { const S = SG[k], d = segDist(q, S[i], S[i + 1]); if (d < best) { best = d; bt = unit(sub(S[i + 1], S[i])); } } }
    return { d: best, t: bt }; };
  let seeds = [], fixedS = [];
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
    if (!pairRows.length) queue.push(cores[0]);
    let guard = 0;
    while (queue.length && rows.length < 900 && guard++ < 60000) { const q = queue.shift(); if (!inB(q)) continue; const h = hA(q); if (nearRow(q, h, -1) < h * 0.9 || primNearG(q).d < h * 0.5) continue;
      const R = trace(q); if (R.length < 3 || arclen(R).pop() < aL(q) * 0.8) continue; hashRow(R, rows.length); rows.push({ pts: R }); pushCands(R); }
    // 行内布点：顺场间距 aL，随机起点 + 轻微横向抖动；水里不布点
    for (const r of rows) { if (r.paired) continue; const R = resample(r.pts, 3), s = arclen(R), L = s[s.length - 1]; let t = U(0, aL(R[0])), i = 0;
      while (t < L) { while (i < R.length - 2 && s[i + 1] < t) i++; const p = R[i], tg = unit(sub(R[i + 1], R[Math.max(0, i - 1)])), nn = [-tg[1], tg[0]], q = add(p, mul(nn, U(-0.08, 0.08) * hA(p)));
        if (!(inSite(q) && inWater(q)) && primNearG(q).d > hA(q) * 0.7) { seeds.push(q); fixedS.push(false); if (TR) TR.seedRow.push(rows.indexOf(r)); } t += aL(p) * U(0.92, 1.08); } }
    if (TR) TR.rows = rows.map(r => ({ paired: !!r.paired, pts: resample(r.pts, 12) }));
    gx0 = lx0; gy0 = ly0; gx1 = lx1; gy1 = ly1;
  } else {
  const inBox = q => q[0] > gx0 - 80 && q[0] < gx1 + 80 && q[1] > gy0 - 80 && q[1] < gy1 + 80;
  const nearSite = q => { const w = A(q); return w[0] > lx0 - 150 && w[0] < lx1 + 150 && w[1] > ly0 - 150 && w[1] < ly1 + 150; };
  SG.forEach(S => { const s = arclen(S), L = s[s.length - 1]; let t = U(0, 30), i = 0;
    while (t < L) { while (i < S.length - 2 && s[i + 1] < t) i++; const p = S[i], tg = unit(sub(S[i + 1], S[Math.max(0, i - 1)])), nn = [-tg[1], tg[0]], sp = spG(p), h = sp * 0.45;
      for (const sg of [1, -1]) { const q = add(p, mul(nn, h * sg)); if (inBox(q) && nearSite(q) && primNearG(q).d > h * 0.8) { seeds.push(q); fixedS.push(true); } }
      t += sp * 1.25; } });
  const SH = new Map(), SC = 40, addSeedHash = (q, idx) => { const k = Math.floor(q[0] / SC) + ',' + Math.floor(q[1] / SC); if (!SH.has(k)) SH.set(k, []); SH.get(k).push(idx); };
  seeds.forEach(addSeedHash);
  const okSeed = q => { const sp = spG(q); if (primNearG(q).d < sp * 0.72) return false; const w = A(q); if (inSite(w) && inWater(w)) return false; const R = Math.ceil(sp / SC) + 1, gx = Math.floor(q[0] / SC), gy = Math.floor(q[1] / SC);
    for (let a = -R; a <= R; a++) for (let b = -R; b <= R; b++) { const l = SH.get((gx + a) + ',' + (gy + b)); if (l) for (const j of l) if (dist(seeds[j], q) < sp * 0.9) return false; } return true; };
  for (let it = 0; it < 14000; it++) { const q = [U(gx0 - 70, gx1 + 70), U(gy0 - 70, gy1 + 70)]; if (!nearSite(q)) continue; if (okSeed(q)) { seeds.push(q); fixedS.push(false); addSeedHash(q, seeds.length - 1); } }

  }
  if (TR) { TR.seedsG = seeds.map(q => q.slice()); TR.seedsW = seeds.map(A); TR.fixedS = fixedS.slice(); TR.v0 = V1 ? null : { ctr, t0, aS }; }
  // 4 Voronoi（G）→ 拉回场地
  const BIG = [[gx0 - 3000, gy0 - 3000], [gx1 + 3000, gy0 - 3000], [gx1 + 3000, gy1 + 3000], [gx0 - 3000, gy1 + 3000]];
  const voronoi = () => seeds.map((si, i) => { const order = seeds.map((sj, j) => [dist(si, sj), j]).filter(x => x[1] !== i).sort((a, b) => a[0] - b[0]); let c = BIG;
    for (const [dd, j] of order) { let rmax = 0; for (const p of c) rmax = Math.max(rmax, dist(p, si)); if (dd > 2 * rmax) break; const sj = seeds[j]; c = clipHalfPlane(c, mul(add(si, sj), 0.5), sub(sj, si)); if (c.length < 3) break; }
    return c; });
  let vc = voronoi();
  const cellWorld = i => vc[i].length < 3 ? [] : vc[i].map(A);

  // 5 室：内缩（主线 / 次线半宽）→ 按夹角五次曲线过渡；防细条与防跨水
  const setbackOf = th => P.blendK * (th < 40 ? 12 : th < 60 ? 12 + (th - 40) / 20 * 4 : th < 90 ? 16 + (th - 60) / 30 * 16 : th < 120 ? 32 + (th - 90) / 30 * 20 : th < 150 ? 52 + (th - 120) / 30 * 16 : 68);
  const isPrimEdge = (a, b) => { const m = mul(add(a, b), 0.5), pn = primNearG(Ai(m)), t = unit(sub(Ai(b), Ai(a))); return pn.d < spG(Ai(m)) * 0.16 + 3 && Math.abs(dot(pn.t, t)) > 0.8; };
  function insetPoly(P0) {
    const Pp = []; for (const q of P0) if (!Pp.length || dist(q, Pp[Pp.length - 1]) > 4) Pp.push(q); while (Pp.length > 3 && dist(Pp[0], Pp[Pp.length - 1]) <= 4) Pp.pop(); if (Pp.length < 3) return null;
    const n = Pp.length, sg = polyArea(Pp) > 0 ? 1 : -1, lines = [];
    for (let i = 0; i < n; i++) { const a = Pp[i], b = Pp[(i + 1) % n], L = dist(a, b); if (L < 1e-6) continue; const t = mul(sub(b, a), 1 / L), nn = mul([-t[1], t[0]], sg);
      const prim = isPrimEdge(a, b), h = (prim ? P.wP : wSecAt(mul(add(a, b), 0.5))) / 2; lines.push({ p: add(a, mul(nn, h)), t, kind: prim ? 'prim' : 'sec' }); }
    const out = [];
    for (let i = 0; i < lines.length; i++) { const A_ = lines[(i + lines.length - 1) % lines.length], B = lines[i], den = A_.t[0] * B.t[1] - A_.t[1] * B.t[0];
      if (Math.abs(den) < 0.15) { out.push({ p: B.p }); continue; }
      const dp = sub(B.p, A_.p), s = (dp[0] * B.t[1] - dp[1] * B.t[0]) / den; out.push({ p: add(A_.p, mul(A_.t, s)) }); }
    const kept = out.filter(o => inPoly(o.p, Pp)); if (kept.length < 3) return null;
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
  let nRemoved = 0, nWaterCut = 0, cellPolys = [];
  for (let pass = 0; pass < 5; pass++) {
    cellPolys = []; const kill = new Set();
    seeds.forEach((s, i) => { const c = cellWorld(i); if (c.length < 3 || Math.abs(polyArea(c)) < 300) return;
      const V = insetPoly(c);
      if (!V) { if (P.debug) console.log('insetfail', i, fixedS[i], Math.round(polyArea(c)), siteFrac(c).toFixed(2)); if (!fixedS[i] && Math.abs(polyArea(c)) > 2500) kill.add(i); return; }
      const wmin = minWidth(V.map(o => o.p)); if (wmin < P.minThick && !fixedS[i] && siteFrac(c) > 0.5) { kill.add(i); return; }
      const bp = blendPoly(V); if (Math.abs(polyArea(bp)) < 400) return; cellPolys.push({ seed: i, raw: c, V, poly: bp }); });
    // 防跨水：走廊（室之间的边）大半落在水里 → 删掉较小一侧的种子，让两室合并
    if (P.avoidWater) { const owner = new Map(); cellPolys.forEach(cp => { const c = cp.raw; for (let k = 0; k < c.length; k++) { const a = c[k], b = c[(k + 1) % c.length], key = Math.round(a[0] + b[0]) + ',' + Math.round(a[1] + b[1]); if (!owner.has(key)) owner.set(key, []); owner.get(key).push(cp); } });
      for (const [, cs] of owner) { if (cs.length !== 2) continue; const c = cs[0].raw; let a = null, b = null; for (let k = 0; k < c.length; k++) { const p = c[k], q = c[(k + 1) % c.length]; if (cs[1].raw.some(r => dist(r, p) < 1) && cs[1].raw.some(r => dist(r, q) < 1)) { a = p; b = q; } } if (!a) continue;
        let inW = 0, inS = 0; for (let t = 0.05; t < 1; t += 0.1) { const q = add(a, mul(sub(b, a), t)); if (inSite(q)) { inS++; if (inWater(q)) inW++; } }
        if (inS >= 3 && inW / inS > 0.4) { const cand = cs.filter(x => !fixedS[x.seed]).sort((x, y) => Math.abs(polyArea(x.raw)) - Math.abs(polyArea(y.raw))); if (cand.length) { kill.add(cand[0].seed); nWaterCut++; } } } }
    if (!kill.size || pass === 4) break;
    if (TR) for (const i of kill) TR.killed.push({ pass, p: A(seeds[i]) });
    seeds = seeds.filter((_, i) => !kill.has(i)); fixedS = fixedS.filter((_, i) => !kill.has(i)); nRemoved += kill.size; vc = voronoi();
  }

  // 6 走廊中心线（Voronoi 边 ∩ 场地）
  const nodeKey = new Map(), nodeP = [], fixed = [], edges = [], fibres = [], eKey = new Set();
  const nid = p => { const k = Math.round(p[0] * 2) + ',' + Math.round(p[1] * 2); if (!nodeKey.has(k)) { nodeKey.set(k, nodeP.length); nodeP.push(p.slice()); fixed.push(!inSite(p)); } return nodeKey.get(k); };
  for (const cp of cellPolys) { const c = cp.raw; for (let i = 0; i < c.length; i++) { const a = c[i], b = c[(i + 1) % c.length]; if (dist(a, b) < 1) continue; if (!inSite(mul(add(a, b), 0.5)) && !inSite(a) && !inSite(b)) continue;
    const ia = nid(a), ib = nid(b), key = Math.min(ia, ib) + '-' + Math.max(ia, ib); if (eKey.has(key)) continue; eKey.add(key);
    const prim = isPrimEdge(a, b); edges.push({ a: ia, b: ib, link: false, prim }); fibres.push({ P: resample([a, b], 2.0), a: ia, b: ib, link: false, prim }); } }
  const deg = nodeP.map(() => 0); for (const e of edges) { deg[e.a]++; deg[e.b]++; }
  const inner = nodeP.map((_, k) => k).filter(k => !fixed[k] && deg[k] >= 3);

  // 种植塔：核心处大塔，其余靠核心的节点小塔
  const towers = []; for (const c of cores) { let best = null, bd = 1e9; for (const k of inner) { const d = dist(nodeP[k], c); if (d < bd) { bd = d; best = nodeP[k]; } } const p = best && bd < 80 ? best : c; towers.push([p[0], p[1], 24, 170]); }
  for (const k of inner.slice().sort((a, b) => Math.min(...cores.map(c => dist(nodeP[a], c))) - Math.min(...cores.map(c => dist(nodeP[b], c))))) { if (towers.length >= P.nTower) break; const p = nodeP[k]; if (bdist(p) < 50 || inWater(p)) continue; if (towers.every(t => dist(p, t) > 260)) towers.push([p[0], p[1], 12, 80]); }
  towers.length = Math.min(towers.length, P.nTower);

  // 7 栅格：由室多边形求有符号距离
  const inside = new Uint8Array(NN), Bd = 4.5, dB = new Float32Array(NN).fill(Bd), lab = new Int32Array(NN);
  cellPolys.forEach((cp, ci) => { const pp = resample([...cp.poly, cp.poly[0]].map(toPix), 1.2); pp.pop(); fillPoly(lab, W, H, pp, ci + 1);
    for (const q of pp) { const xa = Math.max(0, Math.floor(q[0] - Bd)), xb = Math.min(W - 1, Math.ceil(q[0] + Bd)), ya = Math.max(0, Math.floor(q[1] - Bd)), yb = Math.min(H - 1, Math.ceil(q[1] + Bd));
      for (let y = ya; y <= yb; y++) { const dy = y + .5 - q[1], row = y * W; for (let x = xa; x <= xb; x++) { const dx = x + .5 - q[0], d = Math.sqrt(dx * dx + dy * dy); if (d < dB[row + x]) dB[row + x] = d; } } } });
  // 跨水 / 跨铁路段：走廊落在非陆地（水面、铁路缝、洞）上的部分，三维里做成架空桥面，下面每隔 P.colStep 放一对柱子
  const solid = i => landM[i] && !waterM[i], columns = []; let bridgeL = 0, nBridge = 0;
  for (const f of fibres) { const Q = resample(f.P, 2), on = Q.map(q => { const t = toPix(q), x = Math.floor(t[0]), y = Math.floor(t[1]); return !(x >= 0 && y >= 0 && x < W && y < H) || !siteM[y * W + x] ? 2 : solid(y * W + x) ? 1 : 0; });
    let k = 0; while (k < Q.length) { if (on[k] !== 0) { k++; continue; } let e = k; while (e < Q.length && on[e] === 0) e++; const L = (e - k) * 2;
      if (L >= 6) { nBridge++; bridgeL += L; const w = (f.prim ? P.wP : P.wS) / 2 - 2, n = Math.max(1, Math.round(L / P.colStep));
        for (let c = 0; c < n; c++) { const idx = Math.min(Q.length - 2, k + Math.round((c + 0.5) * (e - k) / n)), t = unit(sub(Q[idx + 1], Q[idx])), nn = [-t[1], t[0]]; columns.push(add(Q[idx], mul(nn, w)), sub(Q[idx], mul(nn, w))); } }
      k = e; } }
  const sdGrid = new Float32Array(NN), corrF = new Float32Array(NN), corr = new Uint8Array(NN), cellsM = new Uint8Array(NN);
  for (let i = 0; i < NN; i++) { inside[i] = lab[i] ? 1 : 0; sdGrid[i] = (inside[i] ? dB[i] : -dB[i]) * RES; }
  for (const t of towers) { const R = t[2] + 6 + 10, q = toPix(t), x0 = Math.max(0, Math.floor(q[0] - R / RES)), x1 = Math.min(W - 1, Math.ceil(q[0] + R / RES)), y0 = Math.max(0, Math.floor(q[1] - R / RES)), y1 = Math.min(H - 1, Math.ceil(q[1] + R / RES));
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { const dt = Math.hypot((x + .5 - q[0]) * RES, (y + .5 - q[1]) * RES) - (t[2] + 6), i = y * W + x; if (dt < sdGrid[i]) sdGrid[i] = dt; } }
  for (let i = 0; i < NN; i++) { const sd = sdGrid[i]; const cf = clamp(0.5 - sd / (1.5 * RES), 0, 1); corrF[i] = siteM[i] ? cf : 0; corr[i] = siteM[i] && corrF[i] > 0.5 ? 1 : 0; cellsM[i] = landM[i] && !corr[i] && !waterM[i] ? 1 : 0; }
  const GP = { nTail: cellPolys.length }, chains = [], merged = new Set(), nSplit = 0, nWeb = 0, nCtrl = 0, mergeAng = 0, FA = P.primAng, coreP = cores[0], nTail = GP.nTail; void nTail;
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
  if (!P.quick) for (let i = 0; i < NN; i++) { if (!cellsM[i]) continue; const d = dc[i] * RES; if (d <= P.setback || d >= P.setback + P.depth || dNS[i] * RES < P.setback) continue;
    if (EXCL && EXCL.has(CL.lab[i])) continue;
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
  for (let i = 0; i < NN; i++) { const x = xmin + (i % W + .5) * RES, y = ymax - (((i / W) | 0) + .5) * RES; stripe[i] = ((((x - cen[0]) * nrm[0] + (y - cen[1]) * nrm[1]) % 9) + 9) % 9 < 6.5 ? 1 : 0;
    if (cellsM[i] && dc[i] * RES >= P.setback && dNS[i] * RES >= 3 && !bldM[i]) { farm[i] = 1; farmA++; } if (corr[i]) corrA++; }

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

  let totL = 0; for (const f of fibres) totL += arclen(f.P).slice(-1)[0];
  // 校验：走廊中心线压在道路上（< 8 m）的比例（只计场内）、路网尺度
  let onL = 0, inL = 0; for (const f of fibres) for (let k = 1; k < f.P.length; k++) { const m = mul(add(f.P[k], f.P[k - 1]), 0.5); if (!inSite(m)) continue; const l = dist(f.P[k], f.P[k - 1]); inL += l; if (site.roadDistAll(m) < 8) onL += l; }
  return { trace: TR, nTail: GP.nTail, nRemoved, nCtrl, chains, strands, nodeP, fixed, edges, fibres, inner, merged, nSplit, nWeb, towers, mergeAng, FA, cen, nrm,
    grid: { W, H, RES, xmin, ymax, landM, corrF, corr, cellsM, sd: sdGrid, cellLab: CL.lab, polyLab: lab, bldM, hgt, farm, stripe, dc },
    cells, coreP, cores, site, cellPolys, nWaterCut, nBridge, bridgeL, columns, seedsN: seeds.length, stats: { onRoad: inL ? onL / inL : 0, d1: site.d1, d2: site.d2, logic: V1 ? 'v1' : 'v0', strands: strands.length, nodes: inner.length, primE: edges.filter(e => e.prim).length, waterCut: nWaterCut, merged: merged.size, split: nSplit, cells: cells.length, bld: nB, totL, farmA: farmA * RES * RES, corrA: corrA * RES * RES, bldA: bArea * RES * RES } };
}

// 并排拉链：对每条纤维的点，若有另一条纤维平行且中心距 < dz，则二者向中线靠拢；靠拢后的段宽度加大（两股 → 一束）

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
  const corridor = ms(F, g.corrF, 2.0, corrZ, (z, x, y) => !solidAt(x, y) ? z - 1.2 : z > deckZ + 0.1 ? z - deckZ : 0); // 跨水 / 跨铁路段：1.2 m 厚的架空桥面
  const fs = new Float32Array(NN); for (let i = 0; i < NN; i++) fs[i] = g.farm[i] ? 1 : 0; // 三维里农田整片铺（条纹只在平面图上）
  const farm = ms(F, blur(fs, W, H, 0.6), 4.0, () => 0.25, z => z - 0.2);
  const bS = new Float32Array(NN); for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { let m = 0; for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) { const xx = x + a, yy = y + b; if (xx >= 0 && yy >= 0 && xx < W && yy < H) m = Math.max(m, g.hgt[yy * W + xx]); } bS[y * W + x] = m; }
  const bf = new Float32Array(NN); for (let i = 0; i < NN; i++) bf[i] = g.bldM[i];
  const zb = (x, y) => { const i = clamp(Math.floor((x - xmin) / RES), 0, W - 1), j = clamp(Math.floor((ymax - y) / RES), 0, H - 1); return bS[j * W + i] || 7.2; };
  const bld = ms(F, blur(bf, W, H, 0.6), 2.0, zb, () => 0);
  return { corridor, farm, bld };
}

const API = { prepareSite, buildStructure, planImage, meshes, ms, util: { edt, blur, label4, resample, arclen } };
if (typeof module !== 'undefined') module.exports = API; else root.SS = API;
})(typeof self !== 'undefined' ? self : this);
