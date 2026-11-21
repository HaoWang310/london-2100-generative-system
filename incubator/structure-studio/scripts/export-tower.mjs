// 结构工作室 · 种植塔模型导出
// 用法：node incubator/structure-studio/scripts/export-tower.mjs <Rhino 导出的 .dae> [三片塔的 .stl]
// 读 Rhino 8 导出的 COLLADA（4 片退台板 + 3 片塔身 + 3 片外皮，1 个单位按 1 米读），写出两份文件：
//   assets/tower-model.json  三维网格（坐标按厘米存成 16 位整数，再转 base64），页面打开三维时加载
//   engine/tower.js          台座四层的平面轮廓、尖角方向、塔高等数据和放置函数（页面与测试共用）
// 塔用 .stl（只有三片塔）；没给 .stl 就用 .dae 里的塔身。.dae 里的"外皮"是塔身内侧那一面的重复，不导出。
// Usage: node export-tower.mjs model.dae — writes assets/tower-model.json and engine/tower.js.
import { readFileSync, writeFileSync } from 'node:fs';
const src = process.argv[2], stl = process.argv[3]; if (!src) { console.error('usage: node export-tower.mjs model.dae [towers.stl]'); process.exit(1); }
const dir = new URL('..', import.meta.url), xml = readFileSync(src, 'utf8'), BINS = 180;

// ---- 读网格：geometry id → 顶点 + 三角形；按场景里 node 的顺序取实例
const geos = new Map();
for (const g of xml.matchAll(/<geometry id="([^"]+)"[\s\S]*?<\/geometry>/g)) {
  const body = g[0], arrays = {};
  for (const s of body.matchAll(/<source id="([^"]+)"[\s\S]*?<float_array[^>]*>([^<]*)<\/float_array>/g)) arrays[s[1]] = s[2].trim().split(/\s+/).map(Number);
  const pos = arrays[body.match(/<vertices[\s\S]*?semantic="POSITION" source="#([^"]+)"/)[1]];
  const tri = body.match(/<triangles[\s\S]*?<\/triangles>/)[0], inputs = [...tri.matchAll(/<input\b[^>]*>/g)].map(m => ({ sem: m[0].match(/semantic="(\w+)"/)[1], off: +m[0].match(/offset="(\d+)"/)[1] }));
  const stride = Math.max(...inputs.map(i => i.off)) + 1, vo = inputs.find(i => i.sem === 'VERTEX').off;
  const p = tri.match(/<p>([^<]*)<\/p>/)[1].trim().split(/\s+/).map(Number), idx = [];
  for (let i = 0; i < p.length; i += stride) idx.push(p[i + vo]);
  geos.set(g[1], { V: pos, I: idx });
}
const parts = [...xml.matchAll(/<instance_geometry url="#([^"]+)"/g)].map(m => geos.get(m[1]));
const zr = m => { let a = 1e9, b = -1e9; for (let i = 2; i < m.V.length; i += 3) { a = Math.min(a, m.V[i]); b = Math.max(b, m.V[i]); } return [a, b]; };
const openEdges = m => { const e = new Map(), key = (a, b) => a < b ? a + ',' + b : b + ',' + a, q = i => m.V.slice(3 * i, 3 * i + 3).map(v => v.toFixed(3)).join();
  for (let t = 0; t < m.I.length; t += 3) for (let k = 0; k < 3; k++) { const s = key(q(m.I[t + k]), q(m.I[t + (k + 1) % 3])); e.set(s, (e.get(s) || 0) + 1); }
  let n = 0; for (const c of e.values()) if (c === 1) n++; return n; };
const tiers = parts.filter(m => zr(m)[1] < 0.5).sort((a, b) => zr(a)[0] - zr(b)[0]);
const tall = parts.filter(m => zr(m)[1] >= 0.5), shells = tall.filter(m => openEdges(m) === 0 || openEdges(m) < 10), skins = tall.filter(m => !shells.includes(m));
if (tiers.length !== 4 || shells.length !== 3 || skins.length !== 3) throw new Error(`expected 4 tiers, 3 shells, 3 skins; got ${tiers.length}/${shells.length}/${skins.length}`);
const cxy = m => { let x = 0, y = 0; const n = m.V.length / 3; for (let i = 0; i < m.V.length; i += 3) { x += m.V[i]; y += m.V[i + 1]; } return [x / n, y / n]; };
shells.sort((a, b) => zr(b)[1] - zr(a)[1]);
const skinOf = shells.map(s => { const c = cxy(s); return skins.reduce((b, k) => { const d = Math.hypot(cxy(k)[0] - c[0], cxy(k)[1] - c[1]); return !b || d < b.d ? { k, d } : b; }, null).k; });

// ---- 原点：最下面一片板的外接框中心；台座四层板的 z 原样记下（页面里再改成 7.2 / 11.8 / 16.4 / 21.0 m）
let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9; for (let i = 0; i < tiers[0].V.length; i += 3) { x0 = Math.min(x0, tiers[0].V[i]); x1 = Math.max(x1, tiers[0].V[i]); y0 = Math.min(y0, tiers[0].V[i + 1]); y1 = Math.max(y1, tiers[0].V[i + 1]); }
const C = [(x0 + x1) / 2, (y0 + y1) / 2];
const local = m => { const V = new Float64Array(m.V.length); for (let i = 0; i < V.length; i += 3) { V[i] = m.V[i] - C[0]; V[i + 1] = m.V[i + 1] - C[1]; V[i + 2] = m.V[i + 2]; } return { V, I: m.I }; };

// ---- 台座每层的平面轮廓：绕原点按角度分 180 份，每份取最远的点（台座各层都是围着原点的圆角形，这样取就是外轮廓）
const outline = m => { const r = new Float64Array(BINS).fill(-1);
  for (let i = 0; i < m.V.length; i += 3) { const a = Math.atan2(m.V[i + 1], m.V[i]), k = Math.floor(((a + Math.PI) / (2 * Math.PI)) * BINS) % BINS, d = Math.hypot(m.V[i], m.V[i + 1]); if (d > r[k]) r[k] = d; }
  for (let k = 0; k < BINS; k++) if (r[k] < 0) { let a = k, b = k; while (r[(a + BINS) % BINS] < 0) a--; while (r[b % BINS] < 0) b++; const ra = r[(a + BINS) % BINS], rb = r[b % BINS]; r[k] = ra + (rb - ra) * (k - a) / (b - a); }
  return r; };
// 台座每层的平面轮廓：在板厚中间横切一刀，把切出来的线段连成环，取最长的那个环（再抽稀到 0.3 m）
function section(m, z) { const V = m.V, seg = [];
  for (let t = 0; t < m.I.length; t += 3) { const p = [0, 1, 2].map(k => [V[3 * m.I[t + k]], V[3 * m.I[t + k] + 1], V[3 * m.I[t + k] + 2]]), pts = [];
    for (const [a, b] of [[0, 1], [1, 2], [2, 0]]) if ((p[a][2] > z) !== (p[b][2] > z)) { const f = (z - p[a][2]) / (p[b][2] - p[a][2]); pts.push([p[a][0] + f * (p[b][0] - p[a][0]), p[a][1] + f * (p[b][1] - p[a][1])]); }
    if (pts.length === 2) seg.push(pts); }
  const k = q => q[0].toFixed(3) + ',' + q[1].toFixed(3), adj = new Map(); for (const [a, b] of seg) { for (const [u, v] of [[a, b], [b, a]]) { if (!adj.has(k(u))) adj.set(k(u), { p: u, n: [] }); adj.get(k(u)).n.push(k(v)); } }
  const seen = new Set(), loops = []; for (const [s0] of adj) { if (seen.has(s0)) continue; const loop = []; let cur = s0, prev = null;
    while (cur && !seen.has(cur)) { seen.add(cur); loop.push(adj.get(cur).p); const nx = adj.get(cur).n.find(q => q !== prev && !seen.has(q)); prev = cur; cur = nx; } loops.push(loop); }
  const per = L => L.reduce((s, p, i) => s + Math.hypot(p[0] - L[(i + 1) % L.length][0], p[1] - L[(i + 1) % L.length][1]), 0), best = loops.sort((a, b) => per(b) - per(a))[0], out = [best[0]];
  for (const p of best) if (Math.hypot(p[0] - out[out.length - 1][0], p[1] - out[out.length - 1][1]) > 0.3) out.push(p); return out; }
const L = tiers.map(local), R = L.map(outline), SEC = L.map((m, i) => { const [a, b] = zr(tiers[i]); return section(m, (a + b) / 2).map(p => [+p[0].toFixed(2), +p[1].toFixed(2)]); });
const poly = r => [...r].map((d, k) => { const a = -Math.PI + (k + 0.5) / BINS * 2 * Math.PI; return [+(d * Math.cos(a)).toFixed(2), +(d * Math.sin(a)).toFixed(2)]; });
// 尖角：最下面一层轮廓（先平滑）上最远的三个峰，彼此至少隔 60°
const sm = Array.from(R[0]).map((_, k) => { let s = 0; for (let j = -4; j <= 4; j++) s += R[0][(k + j + BINS) % BINS]; return s / 9; });
const peaks = sm.map((d, k) => ({ d, k })).filter(p => p.d >= sm[(p.k + 1) % BINS] && p.d >= sm[(p.k - 1 + BINS) % BINS]).sort((a, b) => b.d - a.d), corners = [];
for (const p of peaks) if (corners.every(q => Math.min(Math.abs(q - p.k), BINS - Math.abs(q - p.k)) >= BINS / 6)) { corners.push(p.k); if (corners.length === 3) break; }
const cornerAng = corners.map(k => +(-Math.PI + (k + 0.5) / BINS * 2 * Math.PI).toFixed(4)).sort((a, b) => a - b);

// ---- 塔：.dae 里每片塔有"塔身"和"外皮"两个网格，但外皮其实就是塔身内侧那一面（两者重合，不是另一层表皮），所以只用塔身。
// 给了 .stl（只有三片塔、网格更细）就用 .stl：按顶点焊成三个连通块，按位置对应到 A / B / C
function readStl(file) { const b = readFileSync(file), n = b.readUInt32LE(80), key = new Map(), V = [], I = [];
  for (let t = 0; t < n; t++) for (let k = 0; k < 3; k++) { const o = 84 + 50 * t + 12 + 12 * k, x = b.readFloatLE(o), y = b.readFloatLE(o + 4), z = b.readFloatLE(o + 8), h = `${x.toFixed(3)},${y.toFixed(3)},${z.toFixed(3)}`;
    let id = key.get(h); if (id === undefined) { id = V.length / 3; key.set(h, id); V.push(x, y, z); } I.push(id); }
  const par = Int32Array.from({ length: V.length / 3 }, (_, i) => i), find = a => { while (par[a] !== a) { par[a] = par[par[a]]; a = par[a]; } return a; };
  for (let t = 0; t < I.length; t += 3) { const a = find(I[t]), b2 = find(I[t + 1]), c = find(I[t + 2]); par[b2] = a; par[find(c)] = a; }
  const groups = new Map(); for (let t = 0; t < I.length; t += 3) { const r = find(I[t]); if (!groups.has(r)) groups.set(r, []); groups.get(r).push(I[t], I[t + 1], I[t + 2]); }
  return [...groups.values()].filter(g => g.length > 300).map(g => { const map = new Map(), VV = [], II = []; for (const v of g) { if (!map.has(v)) { map.set(v, VV.length / 3); VV.push(V[3 * v], V[3 * v + 1], V[3 * v + 2]); } II.push(map.get(v)); } return { V: VV, I: II }; }); }
let towerMeshes = shells;
if (stl) { const parts = readStl(stl); if (parts.length !== 3) throw new Error('expected 3 towers in the STL, got ' + parts.length);
  towerMeshes = shells.map(s => { const c = cxy(s); return parts.reduce((b, k) => { const d = Math.hypot(cxy(k)[0] - c[0], cxy(k)[1] - c[1]); return !b || d < b.d ? { k, d } : b; }, null).k; }); }
const T = towerMeshes.map((m, i) => ({ id: 'ABC'[i], mesh: local(m), h: +zr(m)[1].toFixed(2) }));
// 塔脚轮廓（离底 1.5 m 以内的点取凸包），给"三层平面"用来保证塔脚下面有板
const hull = P => { P = P.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]); const cr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]), lo = [], up = [];
  for (const p of P) { while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], p) <= 0) lo.pop(); lo.push(p); }
  for (const p of P.reverse()) { while (up.length >= 2 && cr(up[up.length - 2], up[up.length - 1], p) <= 0) up.pop(); up.push(p); } return lo.slice(0, -1).concat(up.slice(0, -1)); };
const feet = T.map(t => { const P = []; for (let i = 0; i < t.mesh.V.length; i += 3) if (t.mesh.V[i + 2] < 1.5) P.push([t.mesh.V[i], t.mesh.V[i + 1]]); return hull(P).map(p => [+p[0].toFixed(2), +p[1].toFixed(2)]); });
for (const t of T) console.log(`tower ${t.id}: height ${t.h} m, ${t.mesh.I.length / 3} triangles`);

// ---- 写网格：厘米存成 16 位整数，索引存成 16 位
const pack = m => { const q = new Int16Array(m.V.length); for (let i = 0; i < q.length; i++) { const v = Math.round(m.V[i] * 100); if (Math.abs(v) > 32767) throw new Error('coordinate out of range'); q[i] = v; }
  const ix = new Uint16Array(m.I); return { n: q.length / 3, v: Buffer.from(q.buffer).toString('base64'), i: Buffer.from(ix.buffer).toString('base64') }; };
const hTop = T[0].h;
const model = { format: 'structure-studio/tower@2', unit: 'm (cm in the packed arrays)', source: 'Rhino 8: ' + [src, stl].filter(Boolean).map(f => f.split('/').pop()).join(' + '), exported: new Date().toISOString(),
  tiers: L.map((m, i) => ({ z: zr(tiers[i]).map(v => +v.toFixed(2)), ...pack(m) })), towers: T.map(t => ({ id: t.id, h: t.h, mesh: pack(t.mesh) })) };
writeFileSync(new URL('assets/tower-model.json', dir), JSON.stringify(model));

// ---- engine/tower.js
const js = `// 结构工作室 · 种植塔（台座 + 三片壳）——由 scripts/export-tower.mjs 从 Rhino 模型生成，不要手改数据部分
// 模型：4 层退台的台座 + 3 片向中间倾的弯曲壳（每片外面再贴一层外皮）。1 个单位 = 1 m，原点在台座中心。
// 放进场地时：平面按 s 缩放、按 rot 旋转（由 structure.js 定：塔 A 放大到 170 m，小一块场地按面积开平方缩小，台座一个尖角对准主线方向）；
// 台座四层的顶面不跟着缩放，固定对齐走廊：7.2 / 11.8 / 16.4 / 21.0 m；塔立在 21.0 m 的台面上，高度按 s 缩放。
(function (root) {
'use strict';
const MODEL = ${JSON.stringify({ hTop, corners: cornerAng, tiers: SEC, feet })};
const TOPS = [7.2, 11.8, 16.4, 21.0], BOTS = [0, 7.2, 11.8, 16.4];
const inPoly = (p, P) => { let c = false; for (let i = 0, j = P.length - 1; i < P.length; j = i++) if ((P[i][1] > p[1]) !== (P[j][1] > p[1]) && p[0] < (P[j][0] - P[i][0]) * (p[1] - P[i][1]) / (P[j][1] - P[i][1]) + P[i][0]) c = !c; return c; };
// 塔 t = [x, y, r, h, kind, s, rot]：返回台座四层在场地坐标里的轮廓
function place(t) { const s = t[5] || 1, a = t[6] || 0, c = Math.cos(a), n = Math.sin(a);
  return MODEL.tiers.map(P => P.map(p => [t[0] + s * (c * p[0] - n * p[1]), t[1] + s * (n * p[0] + c * p[1])])); }
// 塔底座四种做法（t[7] = 塔脚高度）：'plaza' 塔所在的室铺成三层退台塔座（默认，见 structure.js 的 plazaTiers），塔立在 L3 16.4 m 上；'podium' 原模型的 4 层台座，塔立在 21.0 m；'plates' 环廊里面的空地按走廊三层铺满平面，塔立在第三层 16.4 m；'none' 塔直接立在地面
const BASE = { plaza: 16.4, podium: 21.0, plates: 16.4, none: 0 };
// 模型坐标 → 场地坐标（三维网格用）：k = 台座第几层（0–3），塔传 -1
function xf(t, k) { const s = t[5] || 1, a = t[6] || 0, c = Math.cos(a), n = Math.sin(a), z0 = t[7] != null ? t[7] : TOPS[3];
  return (x, y, z, zr) => [t[0] + s * (c * x - n * y), t[1] + s * (n * x + c * y), k >= 0 ? BOTS[k] + (z - zr[0]) / (zr[1] - zr[0]) * (TOPS[k] - BOTS[k]) : z0 + s * Math.max(0, z)]; }
// 走廊三角形落在台座里面（在某层轮廓内、又不高于那层台面）就去掉。只对 'podium' 做。arr 每 9 个数一个三角形；返回保留下来的三角形序号
function keepOutside(arr, towers) { const L = towers.filter(t => t[5] && (t[7] == null || t[7] === BASE.podium)).map(place), keep = [];
  for (let i = 0, k = 0; i < arr.length; i += 9, k++) { const p = [(arr[i] + arr[i + 3] + arr[i + 6]) / 3, (arr[i + 1] + arr[i + 4] + arr[i + 7]) / 3], z = (arr[i + 2] + arr[i + 5] + arr[i + 8]) / 3;
    let out = true; for (const T of L) for (let j = 0; j < 4 && out; j++) if (z <= TOPS[j] + 0.6 && inPoly(p, T[j])) out = false; if (out) keep.push(k); }
  return keep; }
// ---- 'plates'：塔下的三层平面。在塔周围 R 米内按 RES 米一格：
// 1) 每层把走廊板（顶面在这层附近的三角形）画进格子；2) 从塔中心往外漫，第一层没被板占的连通空地 = 环廊里面那块地（漫到边界说明没有闭合的环，就只取塔脚附近）；
// 3) 这块地再并上塔脚外扩 3 m（塔脚有一部分踩在环廊上）；4) 每层减去这一层的板，剩下的就是要补的平面：描边、抽稀、切三角形，再加 1 m 厚的侧边。
const LEVELS = [7.2, 11.8, 16.4];
function plates(t, top, o) { o = Object.assign({ R: 130, res: 0.5, foot: 3, thick: 1, col: 15 }, o); const N = Math.ceil(2 * o.R / o.res), x0 = t[0] - o.R, y0 = t[1] - o.R, idx = (i, j) => j * N + i;
  const raster = (pred) => { const g = new Uint8Array(N * N); for (let q = 0; q < top.length; q += 9) { const zs = [top[q + 2], top[q + 5], top[q + 8]]; if (!pred(Math.min(...zs), Math.max(...zs))) continue;
      const P = [[top[q], top[q + 1]], [top[q + 3], top[q + 4]], [top[q + 6], top[q + 7]]]; if (P.every(p => Math.abs(p[0] - t[0]) > o.R + 5 || Math.abs(p[1] - t[1]) > o.R + 5)) continue;
      const i0 = Math.max(0, Math.floor((Math.min(P[0][0], P[1][0], P[2][0]) - x0) / o.res)), i1 = Math.min(N - 1, Math.ceil((Math.max(P[0][0], P[1][0], P[2][0]) - x0) / o.res));
      const j0 = Math.max(0, Math.floor((Math.min(P[0][1], P[1][1], P[2][1]) - y0) / o.res)), j1 = Math.min(N - 1, Math.ceil((Math.max(P[0][1], P[1][1], P[2][1]) - y0) / o.res));
      for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) { const x = x0 + (i + .5) * o.res, y = y0 + (j + .5) * o.res, d1 = (x - P[1][0]) * (P[0][1] - P[1][1]) - (P[0][0] - P[1][0]) * (y - P[1][1]), d2 = (x - P[2][0]) * (P[1][1] - P[2][1]) - (P[1][0] - P[2][0]) * (y - P[2][1]), d3 = (x - P[0][0]) * (P[2][1] - P[0][1]) - (P[2][0] - P[0][0]) * (y - P[0][1]);
        if (!((d1 < 0 || d2 < 0 || d3 < 0) && (d1 > 0 || d2 > 0 || d3 > 0))) g[idx(i, j)] = 1; } }
    return g; };
  const occ = LEVELS.map(L => raster((zmin, zmax) => zmax > L - 1.2 && zmin < L + 0.2));
  // 环廊里面的空地
  const hole = new Uint8Array(N * N), st = [idx(N >> 1, N >> 1)]; let leak = false; hole[st[0]] = 1;
  while (st.length) { const c = st.pop(), i = c % N, j = (c / N) | 0; if (i === 0 || j === 0 || i === N - 1 || j === N - 1) leak = true;
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const a = i + di, b = j + dj; if (a < 0 || b < 0 || a >= N || b >= N) continue; const k = idx(a, b); if (!hole[k] && !occ[0][k]) { hole[k] = 1; st.push(k); } } }
  // 塔脚（三片塔的脚，平面上外扩 o.foot 米）
  const s = t[5] || 1, a = t[6] || 0, ca = Math.cos(a), sa = Math.sin(a), feet = MODEL.feet.map(F => F.map(p => [t[0] + s * (ca * p[0] - sa * p[1]), t[1] + s * (sa * p[0] + ca * p[1])]));
  const nearFoot = (x, y) => feet.some(F => { if (inPoly([x, y], F)) return true; for (let i = 0; i < F.length; i++) { const p = F[i], q = F[(i + 1) % F.length], dx = q[0] - p[0], dy = q[1] - p[1], l = dx * dx + dy * dy || 1, u = Math.max(0, Math.min(1, ((x - p[0]) * dx + (y - p[1]) * dy) / l)); if (Math.hypot(x - p[0] - u * dx, y - p[1] - u * dy) < o.foot) return true; } return false; });
  const region = new Uint8Array(N * N); for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) { const k = idx(i, j), x = x0 + (i + .5) * o.res, y = y0 + (j + .5) * o.res;
    if ((hole[k] && !leak) || nearFoot(x, y)) region[k] = 1; }
  const out = { top: [], side: [], lvl: [], area: [], cols: [], leak };
  LEVELS.forEach((L, li) => { const g = new Uint8Array(N * N); for (let k = 0; k < g.length; k++) g[k] = region[k] && !occ[li][k] ? 1 : 0;
    // 去掉零碎：先缩一格再放一格
    const er = new Uint8Array(N * N); for (let j = 1; j < N - 1; j++) for (let i = 1; i < N - 1; i++) { const k = idx(i, j); er[k] = g[k] && g[k - 1] && g[k + 1] && g[k - N] && g[k + N] ? 1 : 0; }
    const op = new Uint8Array(N * N); for (let j = 1; j < N - 1; j++) for (let i = 1; i < N - 1; i++) { const k = idx(i, j); op[k] = g[k] && (er[k] || er[k - 1] || er[k + 1] || er[k - N] || er[k + N]) ? 1 : 0; }
    let A = 0; for (const v of op) A += v; out.area.push(A * o.res * o.res);
    for (const P of contours(op, N, o.res, x0, y0)) { const Q = simplify(P, 0.35); if (Q.length < 3 || Math.abs(polyArea(Q)) < 20) continue;
      if (polyArea(Q) < 0) { out.holes = (out.holes || 0) + 1; continue; }   // 顺时针的是内圈（板里面的洞）：外圈的三角形不会盖住它以外的地方，这里先跳过并记下来
      for (const tri of earClip(Q)) { out.top.push(tri[0][0], tri[0][1], L, tri[1][0], tri[1][1], L, tri[2][0], tri[2][1], L); out.lvl.push(li + 1, li + 1, li + 1); }
      for (let i = 0; i < Q.length; i++) { const p = Q[i], q = Q[(i + 1) % Q.length], b = L - o.thick; out.side.push(p[0], p[1], L, q[0], q[1], L, q[0], q[1], b, p[0], p[1], L, q[0], q[1], b, p[0], p[1], b); } } });
  // 柱子：空地里按 o.col 米一格，从地面立到第三层板底
  for (let y = t[1] - o.R; y <= t[1] + o.R; y += o.col) for (let x = t[0] - o.R; x <= t[0] + o.R; x += o.col) { const i = Math.floor((x - x0) / o.res), j = Math.floor((y - y0) / o.res); if (i < 0 || j < 0 || i >= N || j >= N) continue;
    const k = idx(i, j); if (region[k] && !occ[0][k] && !occ[1][k] && !occ[2][k] && !nearFoot(x, y)) out.cols.push([x, y, LEVELS[2] - o.thick]); }
  return { top: new Float32Array(out.top), side: new Float32Array(out.side), lvl: new Float32Array(out.lvl), area: out.area, cols: out.cols, leak, holes: out.holes || 0 }; }
const polyArea = P => { let a = 0; for (let i = 0, j = P.length - 1; i < P.length; j = i++) a += (P[j][0] + P[i][0]) * (P[j][1] - P[i][1]); return -a / 2; };
// 格子的外边界：沿着格子边走一圈（每个连通块的外圈，逆时针），格子边的中点连成多边形
function contours(g, N, res, x0, y0) { const seen = new Uint8Array(N * N), out = [], at = (i, j) => i >= 0 && j >= 0 && i < N && j < N && g[j * N + i];
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) { if (!at(i, j) || at(i, j - 1) || seen[j * N + i]) continue;
    // 从这个格子的下边开始，沿边界走（左手扶墙）
    const P = []; let ci = i, cj = j, dir = 0; const D = [[1, 0], [0, 1], [-1, 0], [0, -1]], start = [ci, cj, dir]; let guard = 0;
    do { seen[cj * N + ci] = 1; const c = [x0 + (ci + .5) * res, y0 + (cj + .5) * res]; if (!P.length || P[P.length - 1][0] !== c[0] || P[P.length - 1][1] !== c[1]) P.push(c);
      let turned = false; for (const r of [3, 0, 1, 2]) { const nd = (dir + r) % 4, ni = ci + D[nd][0], nj = cj + D[nd][1]; if (at(ni, nj)) { dir = nd; ci = ni; cj = nj; turned = true; break; } }
      if (!turned) break; } while (!(ci === start[0] && cj === start[1]) && ++guard < 4 * N * N);   // 回到起点就停（开运算已去掉一格宽的细条，起点不会被经过两次）
    if (P.length > 2) out.push(P); }
  return out; }
function simplify(P, eps) { if (P.length < 4) return P; const keep = new Uint8Array(P.length); keep[0] = keep[P.length - 1] = 1;
  const rec = (a, b) => { let m = -1, md = eps; const dx = P[b][0] - P[a][0], dy = P[b][1] - P[a][1], l = Math.hypot(dx, dy) || 1;
    for (let i = a + 1; i < b; i++) { const d = Math.abs((P[i][0] - P[a][0]) * dy - (P[i][1] - P[a][1]) * dx) / l; if (d > md) { md = d; m = i; } } if (m > 0) { keep[m] = 1; rec(a, m); rec(m, b); } };
  rec(0, P.length - 1); return P.filter((_, i) => keep[i]); }
function earClip(P) { P = polyArea(P) < 0 ? P.slice().reverse() : P.slice(); const idx = P.map((_, i) => i), tris = [], cr = (a, b, c) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
  let guard = 0; while (idx.length > 3 && guard++ < 20000) { let cut = false;
    for (let k = 0; k < idx.length; k++) { const a = P[idx[(k + idx.length - 1) % idx.length]], b = P[idx[k]], c = P[idx[(k + 1) % idx.length]]; if (cr(a, b, c) <= 1e-9) continue;
      let bad = false; for (const j of idx) { const p = P[j]; if (p === a || p === b || p === c) continue; if (cr(a, b, p) > 0 && cr(b, c, p) > 0 && cr(c, a, p) > 0) { bad = true; break; } }
      if (bad) continue; tris.push([a, b, c]); idx.splice(k, 1); cut = true; break; }
    if (!cut) idx.splice(0, 1); }
  if (idx.length === 3) tris.push(idx.map(i => P[i])); return tris; }
// 三片塔的塔脚轮廓（场地坐标），平面图用
function feet(t) { const s = t[5] || 1, a = t[6] || 0, c = Math.cos(a), n = Math.sin(a); return MODEL.feet.map(F => F.map(p => [t[0] + s * (c * p[0] - n * p[1]), t[1] + s * (n * p[0] + c * p[1])])); }
const API = { MODEL, TOPS, BOTS, BASE, LEVELS, inPoly, place, feet, xf, keepOutside, plates };
if (typeof module !== 'undefined' && module.exports) module.exports = API; else { root.SS = root.SS || {}; root.SS.tower = API; }
})(typeof self !== 'undefined' ? self : this);
`;
writeFileSync(new URL('engine/tower.js', dir), js);
console.log('corners (deg)', cornerAng.map(a => (a * 180 / Math.PI).toFixed(1)).join(' '), '· tier widths', R.map(r => (Math.max(...r.map((d, k) => d * Math.cos(-Math.PI + (k + .5) / BINS * 2 * Math.PI))) - Math.min(...r.map((d, k) => d * Math.cos(-Math.PI + (k + .5) / BINS * 2 * Math.PI)))).toFixed(1)).join(' / '));
