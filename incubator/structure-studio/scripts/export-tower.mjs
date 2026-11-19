// 结构工作室 · 种植塔模型导出
// 用法：node incubator/structure-studio/scripts/export-tower.mjs <Rhino 导出的 .dae>
// 读 Rhino 8 导出的 COLLADA（4 片退台板 + 3 片塔身 + 3 片外皮，1 个单位按 1 米读），写出两份文件：
//   assets/tower-model.json  三维网格（坐标按厘米存成 16 位整数，再转 base64），页面打开三维时加载
//   engine/tower.js          台座四层的平面轮廓、尖角方向、塔高等数据和放置函数（页面与测试共用）
// 外皮离塔身原来只有 0.6–0.8 m，远看会和塔身互相闪：导出时把外皮沿离开塔身的方向推开，保证至少 GAP 米（再按塔的缩放比例变化）。
// Usage: node export-tower.mjs model.dae — writes assets/tower-model.json and engine/tower.js.
import { readFileSync, writeFileSync } from 'node:fs';
const src = process.argv[2]; if (!src) { console.error('usage: node export-tower.mjs model.dae'); process.exit(1); }
const dir = new URL('..', import.meta.url), xml = readFileSync(src, 'utf8'), GAP = 2.5, BINS = 180;

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
const L = tiers.map(local), R = L.map(outline);
const poly = r => [...r].map((d, k) => { const a = -Math.PI + (k + 0.5) / BINS * 2 * Math.PI; return [+(d * Math.cos(a)).toFixed(2), +(d * Math.sin(a)).toFixed(2)]; });
// 尖角：最下面一层轮廓（先平滑）上最远的三个峰，彼此至少隔 60°
const sm = Array.from(R[0]).map((_, k) => { let s = 0; for (let j = -4; j <= 4; j++) s += R[0][(k + j + BINS) % BINS]; return s / 9; });
const peaks = sm.map((d, k) => ({ d, k })).filter(p => p.d >= sm[(p.k + 1) % BINS] && p.d >= sm[(p.k - 1 + BINS) % BINS]).sort((a, b) => b.d - a.d), corners = [];
for (const p of peaks) if (corners.every(q => Math.min(Math.abs(q - p.k), BINS - Math.abs(q - p.k)) >= BINS / 6)) { corners.push(p.k); if (corners.length === 3) break; }
const cornerAng = corners.map(k => +(-Math.PI + (k + 0.5) / BINS * 2 * Math.PI).toFixed(4)).sort((a, b) => a - b);

// ---- 外皮推开：外皮几乎贴在塔身外表面上（大部分不到 0.3 m）。每个外皮顶点找最近的塔身顶点，沿塔身在那里的朝外法线，
// 把它放到离塔身表面 GAP 米处——相当于把外皮整体外移到一个和塔身平行的面上，图案形状不变；再把位移平滑两遍去掉毛刺
function vnormals(m, flip) { const V = m.V, N = new Float64Array(V.length);
  for (let t = 0; t < m.I.length; t += 3) { const a = 3 * m.I[t], b = 3 * m.I[t + 1], c = 3 * m.I[t + 2], ux = V[b] - V[a], uy = V[b + 1] - V[a + 1], uz = V[b + 2] - V[a + 2], vx = V[c] - V[a], vy = V[c + 1] - V[a + 1], vz = V[c + 2] - V[a + 2];
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx; for (const k of [a, b, c]) { N[k] += nx; N[k + 1] += ny; N[k + 2] += nz; } }
  for (let i = 0; i < N.length; i += 3) { const l = Math.hypot(N[i], N[i + 1], N[i + 2]) * (flip ? -1 : 1) || 1; N[i] /= l; N[i + 1] /= l; N[i + 2] /= l; } return N; }
function volume(m) { const V = m.V; let v = 0; for (let t = 0; t < m.I.length; t += 3) { const a = 3 * m.I[t], b = 3 * m.I[t + 1], c = 3 * m.I[t + 2];
  v += V[a] * (V[b + 1] * V[c + 2] - V[b + 2] * V[c + 1]) - V[a + 1] * (V[b] * V[c + 2] - V[b + 2] * V[c]) + V[a + 2] * (V[b] * V[c + 1] - V[b + 1] * V[c]); } return v / 6; }
function pushSkin(skin, shell) {
  const V = skin.V, S = shell.V, n = V.length / 3, m = S.length / 3, N = vnormals(shell, volume(shell) < 0), D = new Float64Array(V.length);
  const nb = Array.from({ length: n }, () => new Set()); for (let t = 0; t < skin.I.length; t += 3) for (let k = 0; k < 3; k++) { const a = skin.I[t + k], b = skin.I[t + (k + 1) % 3]; nb[a].add(b); nb[b].add(a); }
  const near = (x, y, z) => { let best = 1e18, bi = 0; for (let j = 0; j < m; j++) { const dx = x - S[3 * j], dy = y - S[3 * j + 1], dz = z - S[3 * j + 2], d = dx * dx + dy * dy + dz * dz; if (d < best) { best = d; bi = j; } } return bi; };
  for (let i = 0; i < n; i++) { const j = near(V[3 * i], V[3 * i + 1], V[3 * i + 2]), nx = N[3 * j], ny = N[3 * j + 1], nz = N[3 * j + 2];
    const h = (V[3 * i] - S[3 * j]) * nx + (V[3 * i + 1] - S[3 * j + 1]) * ny + (V[3 * i + 2] - S[3 * j + 2]) * nz, g = GAP - h;   // h：现在离塔身多远（朝外为正）
    D[3 * i] = nx * g; D[3 * i + 1] = ny * g; D[3 * i + 2] = nz * g; }
  for (let it = 0; it < 2; it++) { const E = new Float64Array(D.length); for (let i = 0; i < n; i++) { let c = 1; for (let k = 0; k < 3; k++) E[3 * i + k] = D[3 * i + k];
    for (const j of nb[i]) { for (let k = 0; k < 3; k++) E[3 * i + k] += D[3 * j + k]; c++; } for (let k = 0; k < 3; k++) E[3 * i + k] /= c; } D.set(E); }
  for (let i = 0; i < V.length; i++) V[i] += D[i];
  // 少数顶点在壳的边缘（墙头、塔尖）附近，按法线推完还离另一面太近：沿离开最近点的方向再补推几轮
  for (let round = 0; round < 4; round++) for (let i = 0; i < n; i++) { const j = near(V[3 * i], V[3 * i + 1], V[3 * i + 2]); let ux = V[3 * i] - S[3 * j], uy = V[3 * i + 1] - S[3 * j + 1], uz = V[3 * i + 2] - S[3 * j + 2]; const d = Math.hypot(ux, uy, uz);
    if (d >= 0.9 * GAP) continue; if (d < 1e-6) { ux = N[3 * j]; uy = N[3 * j + 1]; uz = N[3 * j + 2]; } else { ux /= d; uy /= d; uz /= d; } const g = 0.9 * GAP - d + 0.05; V[3 * i] += ux * g; V[3 * i + 1] += uy * g; V[3 * i + 2] += uz * g; }
  let mn = 1e9; for (let i = 0; i < n; i++) { const j = near(V[3 * i], V[3 * i + 1], V[3 * i + 2]); mn = Math.min(mn, Math.hypot(V[3 * i] - S[3 * j], V[3 * i + 1] - S[3 * j + 1], V[3 * i + 2] - S[3 * j + 2])); } return mn;
}
const T = shells.map((s, i) => ({ id: 'ABC'[i], shell: local(s), skin: local(skinOf[i]) }));
for (const t of T) { const g = pushSkin(t.skin, t.shell); t.gap = +g.toFixed(2); console.log(`tower ${t.id}: height ${zr(shells['ABC'.indexOf(t.id)])[1].toFixed(2)} m, skin gap after push ≥ ${t.gap} m`); }

// ---- 写网格：厘米存成 16 位整数，索引存成 16 位
const pack = m => { const q = new Int16Array(m.V.length); for (let i = 0; i < q.length; i++) { const v = Math.round(m.V[i] * 100); if (Math.abs(v) > 32767) throw new Error('coordinate out of range'); q[i] = v; }
  const ix = new Uint16Array(m.I); return { n: q.length / 3, v: Buffer.from(q.buffer).toString('base64'), i: Buffer.from(ix.buffer).toString('base64') }; };
const hTop = +zr(shells[0])[1].toFixed(2);
const model = { format: 'structure-studio/tower@1', unit: 'm (cm in the packed arrays)', source: 'Rhino 8 COLLADA, ' + src.split('/').pop(), exported: new Date().toISOString(),
  tiers: L.map((m, i) => ({ z: zr(tiers[i]).map(v => +v.toFixed(2)), ...pack(m) })), towers: T.map(t => ({ id: t.id, h: +zr(shells['ABC'.indexOf(t.id)])[1].toFixed(2), skinGap: t.gap, shell: pack(t.shell), skin: pack(t.skin) })) };
writeFileSync(new URL('assets/tower-model.json', dir), JSON.stringify(model));

// ---- engine/tower.js
const js = `// 结构工作室 · 种植塔（台座 + 三片壳）——由 scripts/export-tower.mjs 从 Rhino 模型生成，不要手改数据部分
// 模型：4 层退台的台座 + 3 片向中间倾的弯曲壳（每片外面再贴一层外皮）。1 个单位 = 1 m，原点在台座中心。
// 放进场地时：平面按 s 缩放、按 rot 旋转（由 structure.js 定：塔 A 放大到 170 m，小一块场地按面积开平方缩小，台座一个尖角对准主线方向）；
// 台座四层的顶面不跟着缩放，固定对齐走廊：7.2 / 11.8 / 16.4 / 21.0 m；塔立在 21.0 m 的台面上，高度按 s 缩放。
(function (root) {
'use strict';
const MODEL = ${JSON.stringify({ hTop, corners: cornerAng, tiers: R.map(poly) })};
const TOPS = [7.2, 11.8, 16.4, 21.0], BOTS = [0, 7.2, 11.8, 16.4];
const inPoly = (p, P) => { let c = false; for (let i = 0, j = P.length - 1; i < P.length; j = i++) if ((P[i][1] > p[1]) !== (P[j][1] > p[1]) && p[0] < (P[j][0] - P[i][0]) * (p[1] - P[i][1]) / (P[j][1] - P[i][1]) + P[i][0]) c = !c; return c; };
// 塔 t = [x, y, r, h, kind, s, rot]：返回台座四层在场地坐标里的轮廓
function place(t) { const s = t[5] || 1, a = t[6] || 0, c = Math.cos(a), n = Math.sin(a);
  return MODEL.tiers.map(P => P.map(p => [t[0] + s * (c * p[0] - n * p[1]), t[1] + s * (n * p[0] + c * p[1])])); }
// 模型坐标 → 场地坐标（三维网格用）：k = 台座第几层（0–3），塔身外皮传 -1
function xf(t, k) { const s = t[5] || 1, a = t[6] || 0, c = Math.cos(a), n = Math.sin(a), z0 = k >= 0 ? null : TOPS[3];
  return (x, y, z, zr) => [t[0] + s * (c * x - n * y), t[1] + s * (n * x + c * y), k >= 0 ? BOTS[k] + (z - zr[0]) / (zr[1] - zr[0]) * (TOPS[k] - BOTS[k]) : z0 + s * Math.max(0, z)]; }
// 走廊三角形落在台座里面（在某层轮廓内、又不高于那层台面）就去掉。arr 每 9 个数一个三角形；返回保留下来的三角形序号
function keepOutside(arr, towers) { const L = towers.filter(t => t[5]).map(place), keep = [];
  for (let i = 0, k = 0; i < arr.length; i += 9, k++) { const p = [(arr[i] + arr[i + 3] + arr[i + 6]) / 3, (arr[i + 1] + arr[i + 4] + arr[i + 7]) / 3], z = (arr[i + 2] + arr[i + 5] + arr[i + 8]) / 3;
    let out = true; for (const T of L) for (let j = 0; j < 4 && out; j++) if (z <= TOPS[j] + 0.6 && inPoly(p, T[j])) out = false; if (out) keep.push(k); }
  return keep; }
const API = { MODEL, TOPS, BOTS, inPoly, place, xf, keepOutside };
if (typeof module !== 'undefined' && module.exports) module.exports = API; else { root.SS = root.SS || {}; root.SS.tower = API; }
})(typeof self !== 'undefined' ? self : this);
`;
writeFileSync(new URL('engine/tower.js', dir), js);
console.log('corners (deg)', cornerAng.map(a => (a * 180 / Math.PI).toFixed(1)).join(' '), '· tier widths', R.map(r => (Math.max(...r.map((d, k) => d * Math.cos(-Math.PI + (k + .5) / BINS * 2 * Math.PI))) - Math.min(...r.map((d, k) => d * Math.cos(-Math.PI + (k + .5) / BINS * 2 * Math.PI)))).toFixed(1)).join(' / '));
