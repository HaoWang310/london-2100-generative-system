// London 2100 · VR — the exhibition hall around the map table (v0.22). WebGL2, no libraries.
//
// In VR the London disc sits on a table in a fluid, Zaha-Hadid-style gallery:
//   · one continuous white shell: the wall rises, leans in and twists into the ceiling, around a round skylight
//   · the table grows out of the floor (a lathe), the map disc sits in its top
//   · a suspended "vortex" canopy over the table, glowing from inside, like water drawn towards the map
//   · floor lines that flow around the table, curved free-standing screens with the project boards
//   · four "Bench by Zaha Hadid" (assets/zaha-bench.glb, a 3D Warehouse model) placed around it
//   · v0.22: a lowered soffit with a cove-light line all round, model plinths (v0.25: no columns, no totems)
// Three moods: day (white), night (cyan light lines), violet (the gallery lit in purple).
// All glow is painted in textures (no real lights), so it costs almost nothing on a Quest.
//
// Hall space: metres, y up, the table centre at (0, 0, 0); +z is the open side where you start, facing −z.

const GLOW = { day: [0.87, 0.96, 1.0], night: [0.39, 0.82, 1.0], violet: [0.77, 0.61, 1.0] };
const MOOD = {
  day:    { amb: 0.60, dif: 0.38, light: [1, 1, 1],          pool: 0.18, sky: [0.93, 0.96, 1.0],  clear: [0.80, 0.82, 0.85] },
  night:  { amb: 0.24, dif: 0.10, light: [0.85, 0.92, 1.0],  pool: 0.95, sky: [0.04, 0.06, 0.10], clear: [0.02, 0.025, 0.035] },
  violet: { amb: 0.26, dif: 0.12, light: [0.86, 0.78, 1.0],  pool: 0.85, sky: [0.71, 0.55, 1.0],  clear: [0.05, 0.03, 0.09] },
};
export const HALL_MOODS = Object.keys(MOOD);

// ---------------------------------------------------------------- the shape (pure, testable in node)
export const SHELL = { H: 6.2, oculus: 0.28, twist: 0.35 };
export const shellR = t => 7.2 + 0.8 * Math.sin(2 * t + 0.5) + 0.3 * Math.sin(3 * t - 1.0);   // plan: an uneven oval
const prof = s => SHELL.oculus + (1 - SHELL.oculus) * Math.pow(Math.cos(s * Math.PI / 2), 0.75); // section: wall rolls into ceiling
const profY = s => SHELL.H * Math.pow(Math.sin(s * Math.PI / 2), 0.85);
export function shellPoint(u, s){ const t = u * Math.PI * 2, r = shellR(t) * prof(s), a = t + SHELL.twist * s; return [r * Math.cos(a), profY(s), r * Math.sin(a)]; }
/** height of the shell's inside surface above a plan point (for hanging things from it) */
export function shellYAt(x, z){ const r = Math.hypot(x, z), ang = Math.atan2(z, x);
  for (let s = 0; s <= 1; s += 0.004){ if (shellR(ang - SHELL.twist * s) * prof(s) <= r) return profY(s); } return SHELL.H; }

export const CANOPY = { ri: 1.2, yi: 3.2, twist: 0.6, p: 2.5 };
const ss = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const canRo = t => 3.8 + 0.7 * Math.sin(3 * t + 0.4) + 0.2 * Math.sin(5 * t);   // three petals
const canYo = t => 4.3 + 0.4 * Math.sin(3 * t + 1.6);
export function canopyPoint(u, v){ const t = u * Math.PI * 2, C = CANOPY, r = C.ri + (canRo(t) - C.ri) * v;
  let y = C.yi + (canYo(t) - C.yi) * (1 - Math.pow(1 - v, C.p));            // steep at the centre, flat outside: a funnel
  y -= 0.35 * ss(0.82, 1, v) * (1 + Math.sin(3 * t + 0.4)) / 2;              // the petal edges curl down
  const a = t + C.twist * v; return [r * Math.cos(a), y, r * Math.sin(a)]; }

/** benches: [angle°, radius m, extra yaw°] around the table */
export const BENCH_SLOTS = [[212, 3.15, 6], [328, 3.15, -6]];   // v0.32: two benches, at the sides
export const SCREEN = { R: 4.5, w: 2.4, h: 1.35, y: 1.6, at: [236, 270, 304], boards: [0, 4, 6] };   // v0.32: three screens behind the table (hydrology · 2100 floods · the multi-scale system)
// v0.22 · the gallery around the table (after the Winton Gallery): a lowered soffit with cove light, and model plinths on the floor
export const SOFFIT = { y: 3.0, depth: 0.95, fascia: 0.18 };
export const soffitY = t => SOFFIT.y + 0.3 * Math.sin(2 * t + 1.1) + 0.12 * Math.sin(5 * t);
/** radius of the shell's inside at plan angle t and height y */
export function wallR(t, y){ const s = Math.asin(Math.min(1, Math.pow(Math.max(0, y) / SHELL.H, 1 / 0.85))) * 2 / Math.PI; return shellR(t - SHELL.twist * s) * prof(s); }
/** model plinths [angle°, radius m] */
export const PLINTHS = [[146, 3.85], [34, 3.85]];
function quad(g, a, b, c, d, uv = [[0, 0], [1, 0], [1, 1], [0, 1]], col){ const k = [a, b, c, d].map((p, j) => vert(g, p, uv[j], col)); g.i.push(k[0], k[1], k[2], k[0], k[2], k[3]); }
/** a box turned by yaw about its own centre; front (+z local) face gets frontUV if given */
function box(cx, cy, cz, w, h, d, yaw, col, frontUV){ const g = geo(), c = Math.cos(yaw), s = Math.sin(yaw);
  const P = (x, y, z) => [cx + x * c + z * s, cy + y, cz - x * s + z * c], W = w / 2, D = d / 2;
  const v = [P(-W, 0, D), P(W, 0, D), P(W, h, D), P(-W, h, D), P(-W, 0, -D), P(W, 0, -D), P(W, h, -D), P(-W, h, -D)];
  quad(g, v[0], v[1], v[2], v[3], frontUV, col); quad(g, v[5], v[4], v[7], v[6], undefined, col); quad(g, v[1], v[5], v[6], v[2], undefined, col);
  quad(g, v[4], v[0], v[3], v[7], undefined, col); quad(g, v[3], v[2], v[6], v[7], undefined, col); quad(g, v[4], v[5], v[1], v[0], undefined, col);
  for (let o = 0; o < g.v.length; o += F){ g.v[o + 3] = g.v[o + 4] = g.v[o + 5] = 0; } return normals(g); }

// geometry: v = [x y z  nx ny nz  u v  r g b] (11 floats), i = indices
const F = 11;
function geo(){ return { v: [], i: [] }; }
function vert(g, p, uv = [0, 0], c = [1, 1, 1]){ g.v.push(p[0], p[1], p[2], 0, 0, 0, uv[0], uv[1], c[0], c[1], c[2]); return g.v.length / F - 1; }
/** grid surface: f(u, v) → point, U × V cells; closedU joins the seam by position only */
export function surface(f, U, V, c){ const g = geo();
  for (let j = 0; j <= V; j++) for (let i = 0; i <= U; i++) vert(g, f(i / U, j / V), [i / U, j / V], c);
  for (let j = 0; j < V; j++) for (let i = 0; i < U; i++){ const a = j * (U + 1) + i, b = a + 1, cc = a + U + 1, d = cc + 1; g.i.push(a, b, cc, b, d, cc); }
  return normals(g); }
/** face normals summed onto vertices, following the winding */
export function normals(g){ const v = g.v;
  for (let k = 0; k < g.i.length; k += 3){ const a = g.i[k] * F, b = g.i[k + 1] * F, c = g.i[k + 2] * F;
    const ux = v[b] - v[a], uy = v[b + 1] - v[a + 1], uz = v[b + 2] - v[a + 2], wx = v[c] - v[a], wy = v[c + 1] - v[a + 1], wz = v[c + 2] - v[a + 2];
    const nx = uy * wz - uz * wy, ny = uz * wx - ux * wz, nz = ux * wy - uy * wx;
    for (const o of [a, b, c]){ v[o + 3] += nx; v[o + 4] += ny; v[o + 5] += nz; } }
  for (let o = 0; o < v.length; o += F){ const l = Math.hypot(v[o + 3], v[o + 4], v[o + 5]) || 1; v[o + 3] /= l; v[o + 4] /= l; v[o + 5] /= l; }
  return g; }
function merge(...gs){ const g = geo(); for (const h of gs){ const o = g.v.length / F; g.v.push(...h.v); for (const k of h.i) g.i.push(k + o); } return g; }
/** a lathe: profile [[r, y]…] turned about y */
export function lathe(pts, N, c){ return surface((u, j) => { const k = Math.round(j * (pts.length - 1)), [r, y] = pts[k], a = u * Math.PI * 2; return [r * Math.cos(a), y, r * Math.sin(a)]; }, N, pts.length - 1, c); }
/** a tube along points (closed loop or open), radius r */
function tube(pts, r, sides, closed, c){ const n = pts.length, g = geo();
  for (let k = 0; k < n; k++){ const p = pts[k], q = pts[closed ? (k + 1) % n : Math.min(n - 1, k + 1)], o = pts[closed ? (k - 1 + n) % n : Math.max(0, k - 1)];
    let t = [q[0] - o[0], q[1] - o[1], q[2] - o[2]]; const tl = Math.hypot(...t) || 1; t = t.map(x => x / tl);
    let a = Math.abs(t[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0]; let b = [t[1] * a[2] - t[2] * a[1], t[2] * a[0] - t[0] * a[2], t[0] * a[1] - t[1] * a[0]]; const bl = Math.hypot(...b); b = b.map(x => x / bl);
    a = [b[1] * t[2] - b[2] * t[1], b[2] * t[0] - b[0] * t[2], b[0] * t[1] - b[1] * t[0]];
    for (let s = 0; s <= sides; s++){ const w = s / sides * Math.PI * 2, cs = Math.cos(w), sn = Math.sin(w); vert(g, [p[0] + (a[0] * cs + b[0] * sn) * r, p[1] + (a[1] * cs + b[1] * sn) * r, p[2] + (a[2] * cs + b[2] * sn) * r], [k / n, s / sides], c); } }
  const segs = closed ? n : n - 1;
  for (let k = 0; k < segs; k++) for (let s = 0; s < sides; s++){ const a0 = k * (sides + 1) + s, a1 = ((k + 1) % n) * (sides + 1) + s; g.i.push(a0, a1, a0 + 1, a0 + 1, a1, a1 + 1); }
  return normals(g); }
function disc(r, y, N, c, down){ const g = geo(); vert(g, [0, y, 0], [0.5, 0.5], c);
  for (let k = 0; k <= N; k++){ const a = k / N * Math.PI * 2; vert(g, [r * Math.cos(a), y, r * Math.sin(a)], [0.5 + Math.cos(a) / 2, 0.5 + Math.sin(a) / 2], c); }
  for (let k = 1; k <= N; k++) down ? g.i.push(0, k, k + 1) : g.i.push(0, k + 1, k);
  return normals(g); }
/** a vertical band of a cylinder, seen from inside (texture reads correctly from the centre) */
function band(R, y0, y1, th0, len, N, c){ return surface((u, v) => { const a = th0 + u * len; return [R * Math.sin(a), y0 + (y1 - y0) * v, R * Math.cos(a)]; }, N, 1, c); }
function flipU(g){ for (let o = 0; o < g.v.length; o += F) g.v[o + 6] = 1 - g.v[o + 6]; return g; }
function bez(p0, p1, p2, p3, n){ const out = []; for (let k = 0; k <= n; k++){ const t = k / n, u = 1 - t;
  out.push([0, 1].map(j => u * u * u * p0[j] + 3 * u * u * t * p1[j] + 3 * u * t * t * p2[j] + t * t * t * p3[j])); } return out; }

/** the table: a white body flared out of the floor; the map sits on its top at tableH */
export function tableProfile(mapR, h){ const R2 = mapR + 0.1, foot = mapR + 0.55;
  const pts = bez([foot, 0], [mapR * 0.72 + 0.02, 0], [mapR * 0.42 + 0.05, h * 0.72], [R2, h], 48);
  pts.push([R2 + 0.005, h + 0.012], [R2 - 0.01, h + 0.025], [mapR + 0.02, h + 0.02], [mapR + 0.015, h]);
  return { pts, R2, foot }; }

// ---------------------------------------------------------------- textures (canvas)
function canvas(w, h, draw){ const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); return c; }
let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const rr = (g, x, y, w, h, r) => { g.beginPath(); g.roundRect ? g.roundRect(x, y, w, h, r) : g.rect(x, y, w, h); };
function stripes(g, w, h, N, step, col, lw){ g.strokeStyle = col; g.lineWidth = lw;
  for (let k = 0; k < N; k += step){ g.beginPath(); for (let y = 0; y <= h; y += 8){ const v = 1 - y / h, x = (k / N + 0.012 * Math.sin(v * 6.3 + k * 0.3)) * w; y ? g.lineTo(x, y) : g.moveTo(x, y); } g.stroke(); } }
const shellMapC = () => canvas(2048, 512, (g, w, h) => { g.fillStyle = '#f2f2f0'; g.fillRect(0, 0, w, h); stripes(g, w, h, 72, 1, 'rgba(160,168,178,.55)', 3); });
const shellEmiC = () => canvas(2048, 512, (g, w, h) => { g.fillStyle = '#000'; g.fillRect(0, 0, w, h); stripes(g, w, h, 72, 3, '#fff', 2);
  const grd = g.createLinearGradient(0, h, 0, h - 26); grd.addColorStop(0, 'rgba(255,255,255,.95)'); grd.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = grd; g.fillRect(0, h - 26, w, 26); });
const FLOOR_E = 9.5;
const floorMapC = (shadows) => canvas(1024, 1024, (g, S) => { g.fillStyle = '#d4d4d3'; g.fillRect(0, 0, S, S); const C = v => (v / FLOOR_E + 1) / 2 * S;
  for (const [x, z, rx, rz, ang, a] of shadows){ g.save(); g.translate(C(x), C(z)); g.rotate(ang); g.scale(1, rz / rx);
    const gr = g.createRadialGradient(0, 0, 0, 0, 0, rx / FLOOR_E / 2 * S); gr.addColorStop(0, `rgba(60,60,66,${a})`); gr.addColorStop(1, 'rgba(60,60,66,0)'); g.fillStyle = gr; g.beginPath(); g.arc(0, 0, rx / FLOOR_E / 2 * S, 0, 7); g.fill(); g.restore(); } });
const floorEmiC = (keepOut) => canvas(2048, 2048, (g, S) => { g.fillStyle = '#000'; g.fillRect(0, 0, S, S); const C = v => (v / FLOOR_E + 1) / 2 * S; g.lineCap = 'round';
  for (let k = 0; k < 220; k++){ const r0 = keepOut + 0.15 + rnd() * 5.5, a0 = rnd() * Math.PI * 2; let x = Math.cos(a0) * r0, z = Math.sin(a0) * r0;
    g.strokeStyle = `rgba(255,255,255,${0.25 + rnd() * 0.5})`; g.lineWidth = 1.5 + rnd() * 2; g.beginPath(); g.moveTo(C(x), C(z));
    for (let st = 0; st < 220; st++){ const r = Math.hypot(x, z), th = Math.atan2(z, x); if (r < keepOut || r > shellR(th) * 0.97) break;
      const ang = th + Math.PI / 2 + 0.45 * Math.sin(0.55 * x + 0.35 * z) + 0.25 * Math.cos(0.4 * z - 0.2 * x); x += Math.cos(ang) * 0.06; z += Math.sin(ang) * 0.06; g.lineTo(C(x), C(z)); }
    g.stroke(); } });
const canopyMapC = () => canvas(2048, 256, (g, w, h) => { g.fillStyle = '#f7f7f5'; g.fillRect(0, 0, w, h); g.strokeStyle = 'rgba(150,150,160,.35)'; g.lineWidth = 2;
  for (let k = 0; k < 96; k++){ const x = k / 96 * w; g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke(); } });
const canopyEmiC = () => canvas(2048, 256, (g, w, h) => { const grd = g.createLinearGradient(0, h, 0, 0);   // canvas bottom = inner ring
  grd.addColorStop(0, '#fff'); grd.addColorStop(0.45, 'rgba(255,255,255,.55)'); grd.addColorStop(1, 'rgba(255,255,255,.12)'); g.fillStyle = '#000'; g.fillRect(0, 0, w, h); g.fillStyle = grd; g.fillRect(0, 0, w, h);
  g.strokeStyle = '#fff'; g.lineWidth = 2; for (let k = 0; k < 96; k += 4){ const x = k / 96 * w; g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke(); } });
const soffitEmiC = () => canvas(16, 256, (g, w, h) => { const grd = g.createLinearGradient(0, h, 0, 0);   // canvas bottom = inner edge
  grd.addColorStop(0, '#fff'); grd.addColorStop(0.18, 'rgba(255,255,255,.55)'); grd.addColorStop(1, 'rgba(255,255,255,.05)'); g.fillStyle = '#000'; g.fillRect(0, 0, w, h); g.fillStyle = grd; g.fillRect(0, 0, w, h); });
export const BOARDS = {
  zh: [['01', '水文基底', 'Hydrology · EA LiDAR / 洪水风险', 'contour'], ['02', '生产性景观', 'Productive Landscape', 'dots'], ['03', '张量场街道', 'Tensor-field Streets', 'tensor'],
    ['04', '垂直农业塔', 'Vertical Farming', 'bars'], ['05', '2100 洪水情景', 'Flood Scenario 2100', 'waves'], ['06', 'OSM 城市数据', 'OpenStreetMap · 移动加载', 'network'], ['07', '多尺度生成系统', 'London → Region → Wool → Tensor', 'rings']],
  en: [['01', 'Hydrology', 'EA LiDAR · flood risk', 'contour'], ['02', 'Productive Landscape', 'food · water · energy', 'dots'], ['03', 'Tensor-field Streets', 'street generation', 'tensor'],
    ['04', 'Vertical Farming', 'towers', 'bars'], ['05', 'Flood Scenario 2100', 'sea level · rainfall', 'waves'], ['06', 'OSM City Data', 'OpenStreetMap · streaming', 'network'], ['07', 'Multi-scale System', 'London → Region → Wool → Tensor', 'rings']] };
const boardC = ([no, title, sub, kind]) => canvas(1400, 800, (g, w, h) => {
  const bg = g.createLinearGradient(0, 0, w, h); bg.addColorStop(0, '#0d1118'); bg.addColorStop(1, '#151b26'); g.fillStyle = bg; g.fillRect(0, 0, w, h);
  const font = (wt, px) => `${wt} ${px}px -apple-system,"PingFang SC","Helvetica Neue",sans-serif`;
  g.fillStyle = '#64d2ff'; g.font = font(600, 28); g.fillText(no, 64, 84); g.fillStyle = '#f5f5f7'; g.font = font(600, 56); g.fillText(title, 64, 156); g.fillStyle = '#8e9aa8'; g.font = font(400, 26); g.fillText(sub, 64, 200);
  const X = 64, Y = 240, Wd = w - 128, Hd = h - 300; g.save(); rr(g, X, Y, Wd, Hd, 22); g.clip(); g.fillStyle = 'rgba(255,255,255,.04)'; g.fillRect(X, Y, Wd, Hd); g.lineWidth = 2;
  if (kind === 'contour') for (let i = 0; i < 22; i++){ g.strokeStyle = `rgba(100,210,255,${0.15 + i / 30})`; g.beginPath(); for (let x = 0; x <= Wd; x += 10){ const y = Y + 30 + i * 20 + Math.sin(x / 90 + i * .5) * 18 + Math.sin(x / 31) * 4; x ? g.lineTo(X + x, y) : g.moveTo(X + x, y); } g.stroke(); }
  if (kind === 'dots') for (let i = 0; i < 900; i++){ g.fillStyle = rnd() < .7 ? 'rgba(126,224,161,.85)' : 'rgba(255,214,10,.8)'; g.beginPath(); g.arc(X + rnd() * Wd, Y + rnd() * Hd, 2 + rnd() * 6, 0, 7); g.fill(); }
  if (kind === 'tensor'){ g.strokeStyle = 'rgba(245,245,247,.7)'; g.lineWidth = 1.5; for (let i = -10; i < 30; i++){ g.beginPath(); for (let t = 0; t <= 1; t += .02){ const x = X + t * Wd, y = Y + i * 28 + Math.sin(t * 4 + i * .2) * 50; t ? g.lineTo(x, y) : g.moveTo(x, y); } g.stroke(); g.beginPath(); for (let t = 0; t <= 1; t += .02){ const y = Y + t * Hd, x = X + i * 44 + Math.cos(t * 3 + i * .3) * 40; t ? g.lineTo(x, y) : g.moveTo(x, y); } g.stroke(); } }
  if (kind === 'bars') for (let i = 0; i < 18; i++){ const bh = 60 + rnd() * (Hd - 100); g.fillStyle = i % 3 ? 'rgba(126,224,161,.55)' : '#7ee0a1'; rr(g, X + 30 + i * (Wd - 60) / 18, Y + Hd - 20 - bh, (Wd - 60) / 18 - 14, bh, 6); g.fill(); }
  if (kind === 'waves') for (let i = 0; i < 9; i++){ g.fillStyle = `rgba(100,210,255,${0.06 + i * 0.06})`; g.beginPath(); g.moveTo(X, Y + Hd); for (let x = 0; x <= Wd; x += 12) g.lineTo(X + x, Y + Hd - 30 - i * 40 - Math.sin(x / 70 + i) * 14); g.lineTo(X + Wd, Y + Hd); g.fill(); }
  if (kind === 'network'){ const pts = Array.from({ length: 70 }, () => [X + rnd() * Wd, Y + rnd() * Hd]); g.strokeStyle = 'rgba(245,245,247,.25)'; pts.forEach((a, i) => pts.slice(i + 1).forEach(b => { if (Math.hypot(a[0] - b[0], a[1] - b[1]) < 130){ g.beginPath(); g.moveTo(...a); g.lineTo(...b); g.stroke(); } })); g.fillStyle = '#ff9f0a'; pts.forEach(p => { g.beginPath(); g.arc(p[0], p[1], 5, 0, 7); g.fill(); }); }
  if (kind === 'rings'){ const cx = X + Wd / 2, cy = Y + Hd / 2; ['#f5f5f7', '#64d2ff', '#7ee0a1', '#ffd60a', '#ff9f0a'].forEach((c, i) => { g.strokeStyle = c; g.lineWidth = 4; g.beginPath(); g.arc(cx, cy, 36 + i * 40, 0, 7); g.stroke(); }); }
  g.restore(); });

// ---------------------------------------------------------------- the bench model (a minimal .glb reader: one mesh, POSITION / NORMAL / indices)
export function parseGLB(buf){ const dv = new DataView(buf);
  if (dv.getUint32(0, true) !== 0x46546C67) throw new Error('not a .glb');
  const jl = dv.getUint32(12, true), json = JSON.parse(new TextDecoder().decode(new Uint8Array(buf, 20, jl))), bin = 20 + jl + 8;
  const acc = k => { const a = json.accessors[k], bv = json.bufferViews[a.bufferView], off = bin + (bv.byteOffset || 0) + (a.byteOffset || 0), n = a.count * ({ SCALAR: 1, VEC2: 2, VEC3: 3 }[a.type]);
    const T = { 5126: Float32Array, 5123: Uint16Array, 5125: Uint32Array }[a.componentType]; return new T(buf.slice(off, off + n * T.BYTES_PER_ELEMENT)); };
  const pr = json.meshes[0].primitives[0]; return { pos: acc(pr.attributes.POSITION), nor: acc(pr.attributes.NORMAL), idx: acc(pr.indices) }; }
/** copies of a mesh, each turned by yaw and moved, merged into one geometry */
export function placeCopies(m, slots, c){ const g = geo();
  for (const [deg, R0, yaw] of slots){ const th = deg * Math.PI / 180, ry = -(th + Math.PI / 2) + yaw * Math.PI / 180, cs = Math.cos(ry), sn = Math.sin(ry), px = Math.cos(th) * R0, pz = Math.sin(th) * R0, o = g.v.length / F;
    for (let k = 0; k < m.pos.length; k += 3){ const x = m.pos[k], y = m.pos[k + 1], z = m.pos[k + 2], nx = m.nor[k], ny = m.nor[k + 1], nz = m.nor[k + 2];
      g.v.push(px + x * cs + z * sn, y, pz - x * sn + z * cs, nx * cs + nz * sn, ny, -nx * sn + nz * cs, 0, 0, c[0], c[1], c[2]); }
    for (const k of m.idx) g.i.push(k + o); }
  return g; }

// ---------------------------------------------------------------- renderer
const VS = `#version 300 es
in vec3 aPos; in vec3 aNor; in vec2 aUV; in vec3 aCol; uniform mat4 uP, uV, uM;
out vec3 vN; out vec2 vUV; out vec3 vCol; out vec3 vL;
void main(){ vL = aPos; vN = aNor; vUV = aUV; vCol = aCol; gl_Position = uP * uV * uM * vec4(aPos, 1.0); }`;
const FS = `#version 300 es
precision highp float; in vec3 vN; in vec2 vUV; in vec3 vCol; in vec3 vL;
uniform sampler2D uMap, uEmi; uniform float uHasMap, uHasEmi, uUnlit, uEmiI, uAmb, uDif, uPool, uPoolR;
uniform vec3 uEmiCol, uLight, uLightCol; out vec4 o;
void main(){
  vec3 e = uEmiCol * uEmiI * (uHasEmi > 0.5 ? texture(uEmi, vUV).rgb : vec3(1.0));
  if (uUnlit > 0.5){ o = vec4(e, 1.0); return; }
  vec3 base = vCol * (uHasMap > 0.5 ? texture(uMap, vUV).rgb : vec3(1.0));
  vec3 n = normalize(gl_FrontFacing ? vN : -vN);
  float l = uAmb + uDif * max(dot(n, uLight), 0.0);
  l += uPool * (1.0 - smoothstep(uPoolR * 0.55, uPoolR * 1.6, length(vL.xz))) * max(n.y, 0.0) * (1.0 - smoothstep(1.4, 3.2, vL.y));   // the light from the canopy onto the table
  o = vec4(base * l * uLightCol + e, 1.0); }`;

function program(gl){ const p = gl.createProgram();
  for (const [t, s] of [[gl.VERTEX_SHADER, VS], [gl.FRAGMENT_SHADER, FS]]){ const sh = gl.createShader(t); gl.shaderSource(sh, s); gl.compileShader(sh); if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(sh)); gl.attachShader(p, sh); }
  gl.bindAttribLocation(p, 0, 'aPos'); gl.linkProgram(p); if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
  const u = {}; for (let i = 0, n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS); i < n; i++){ const a = gl.getActiveUniform(p, i); u[a.name] = gl.getUniformLocation(p, a.name); }
  return { p, u }; }

/**
 * createHall(gl, { mapR, tableH, lang }) → { tableTop, draw(P, V, M, mood), clearColour(mood), dispose() }
 * mapR: radius of the map disc on the table (m); M: hall space → world (the table centre on the floor).
 */
export function createHall(gl, opt = {}){
  const mapR = opt.mapR || 0.7, tableH = opt.tableH || 0.9, lang = opt.lang === 'en' ? 'en' : 'zh';
  const prog = program(gl), parts = [], textures = [], buffers = [];
  const tex = (cv, repeat) => { const t = gl.createTexture(); textures.push(t); gl.bindTexture(gl.TEXTURE_2D, t); gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, cv); gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false); gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, repeat ? gl.REPEAT : gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    const an = gl.getExtension('EXT_texture_filter_anisotropic'); if (an) gl.texParameterf(gl.TEXTURE_2D, an.TEXTURE_MAX_ANISOTROPY_EXT, Math.min(8, gl.getParameter(an.MAX_TEXTURE_MAX_ANISOTROPY_EXT))); return t; };
  const upload = g => { const vao = gl.createVertexArray(); gl.bindVertexArray(vao);
    const vb = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, vb); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(g.v), gl.STATIC_DRAW);
    const ib = gl.createBuffer(); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ib); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint32Array(g.i), gl.STATIC_DRAW); buffers.push(vb, ib);
    const at = (name, n, off) => { const l = gl.getAttribLocation(prog.p, name); if (l < 0) return; gl.enableVertexAttribArray(l); gl.vertexAttribPointer(l, n, gl.FLOAT, false, F * 4, off * 4); };
    at('aPos', 3, 0); at('aNor', 3, 3); at('aUV', 2, 6); at('aCol', 3, 8); gl.bindVertexArray(null); return { vao, n: g.i.length }; };
  /** m: { map, emi, glow: { day, night, violet } strength, tint: 'glow' | 'white' | 'sky' | [r,g,b] per mood, unlit } */
  const add = (g, m = {}) => { const p = { ...upload(g), ...m }; parts.push(p); return p; };
  const WHITE = [0.96, 0.96, 0.95];

  // the shell, the floor, the skylight
  add(surface(shellPoint, 160, 40, [1, 1, 1]), { map: tex(shellMapC(), true), emi: tex(shellEmiC(), true), glow: { day: 0.35, night: 1.5, violet: 1.2 }, tint: { day: GLOW.day, night: GLOW.day, violet: [0.85, 0.65, 1.0] } });
  const { pts, R2, foot } = tableProfile(mapR, tableH);
  const pol = (deg, r) => { const t = deg * Math.PI / 180; return [Math.cos(t) * r, Math.sin(t) * r]; };
  const shadows = [[0, 0, foot + 0.5, foot + 0.5, 0, 0.32]]
    .concat(PLINTHS.map(([d, r]) => [...pol(d, r), 0.7, 0.7, 0, 0.2])).concat(BENCH_SLOTS.map(([d, r, y]) => { const th = d * Math.PI / 180; return [Math.cos(th) * r, Math.sin(th) * r, 1.15, 0.38, th + Math.PI / 2 - y * Math.PI / 180, 0.26]; }));
  const floor = surface((u, j) => { const t = u * Math.PI * 2, r = shellR(t) * j; return [r * Math.cos(t), 0, r * Math.sin(t)]; }, 128, 24, [1, 1, 1]);
  for (let o = 0; o < floor.v.length; o += F){ floor.v[o + 6] = (floor.v[o] / FLOOR_E + 1) / 2; floor.v[o + 7] = 1 - (floor.v[o + 2] / FLOOR_E + 1) / 2; floor.v[o + 3] = 0; floor.v[o + 4] = 1; floor.v[o + 5] = 0; }
  add(floor, { map: tex(floorMapC(shadows)), emi: tex(floorEmiC(foot + 0.1)), glow: { day: 0.07, night: 0.85, violet: 0.75 }, tint: { day: GLOW.day, night: GLOW.day, violet: [0.88, 0.72, 1.0] } });
  add(disc(3.2, SHELL.H + 0.25, 64, [1, 1, 1], true), { unlit: true, glow: { day: 1, night: 1, violet: 1 }, tint: 'sky' });
  const ocPts = []; for (let k = 0; k < 160; k++) ocPts.push(shellPoint(k / 160, 1));
  const glowLines = [tube(ocPts, 0.035, 6, true)];

  // the table: body, a dark cap under the disc, a light ring on the rim and on the floor
  add(lathe(pts, 96, WHITE), {});
  // the cap under the map: dark, or opt.capImage (an image or canvas, north up, the disc's full width) — e.g. a still of the place
  // opt.capRelief(x, z) → metres: the cap becomes a relief (a still for a cover; the app's own map lies on top of the cap)
  if (opt.capImage && opt.capRelief){ const r = mapR + 0.02;
    const cap = surface((u, j) => { const t = u * Math.PI * 2, x = r * j * Math.cos(t), z = r * j * Math.sin(t); return [x, tableH - 0.002 + opt.capRelief(x, z) * (1 - ss(0.86, 1, j)), z]; }, 192, 72, [1, 1, 1]);
    for (let o = 0; o < cap.v.length; o += F){ cap.v[o + 6] = 0.5 + cap.v[o] / (2 * r); cap.v[o + 7] = 0.5 - cap.v[o + 2] / (2 * r); }
    add(cap, { map: tex(opt.capImage) }); }
  else if (opt.capImage){ const cap = disc(mapR + 0.02, tableH - 0.002, 96, [1, 1, 1]), r = mapR + 0.02;
    for (let o = 0; o < cap.v.length; o += F){ cap.v[o + 6] = 0.5 + cap.v[o] / (2 * r); cap.v[o + 7] = 0.5 - cap.v[o + 2] / (2 * r); }   // north (−z) at the top
    add(cap, { map: tex(opt.capImage) }); }
  else add(disc(mapR + 0.02, tableH - 0.002, 64, [0.84, 0.84, 0.83]), {});   // v0.34: light, like the model's base (was dark)
  const ring = (r, y, n) => { const p = []; for (let k = 0; k < n; k++){ const a = k / n * Math.PI * 2; p.push([r * Math.cos(a), y, r * Math.sin(a)]); } return p; };
  glowLines.push(tube(ring(R2 - 0.004, tableH + 0.026, 160), 0.005, 6, true), tube(ring(foot + 0.02, 0.004, 160), 0.012, 4, true));

  // the vortex canopy over the table, its glowing rims, and the cables it hangs from
  add(surface(canopyPoint, 160, 36, [1, 1, 1]), { map: tex(canopyMapC(), true), emi: tex(canopyEmiC(), true), glow: { day: 0.55, night: 0.8, violet: 1.4 }, tint: { day: [1, 1, 1], night: [0.62, 0.89, 1.0], violet: [0.78, 0.49, 1.0] } });
  const rim = v => { const p = []; for (let k = 0; k < 200; k++) p.push(canopyPoint(k / 200, v)); return p; };
  glowLines.push(tube(rim(1), 0.045, 6, true), tube(rim(0), 0.03, 6, true));
  const cables = [], CABLE = [0.6, 0.62, 0.66];
  for (let k = 0; k < 3; k++){ const p = canopyPoint(k / 3 + 0.05, 0); cables.push(tube([p, [p[0], SHELL.H + 0.25, p[2]]], 0.004, 4, false, CABLE)); }
  for (let k = 0; k < 3; k++){ const u = ((Math.PI / 2 - 0.4) / 3) / (Math.PI * 2) + k / 3, p = canopyPoint(u, 0.97); cables.push(tube([p, [p[0], shellYAt(p[0], p[2]) - 0.02, p[2]]], 0.004, 4, false, CABLE)); }
  add(merge(...cables), {});

  // the curved screens (one texture each) and their white frames and feet (one mesh)
  const frames = [], boards = BOARDS[lang];
  const boardTex = [], screens = [];
  SCREEN.at.forEach((deg, k) => { const a = deg * Math.PI / 180, len = SCREEN.w / SCREEN.R, th0 = Math.PI / 2 - a - len / 2, { R, h, y } = SCREEN;
    const b = boards[SCREEN.boards[k]]; boardTex[k] = tex(boardC(b));
    // for pointing at it: the chord's centre, the way it faces (to the table), its width and height (hall space)
    screens.push({ k, c: [R * Math.cos(a), y, R * Math.sin(a)], n: [-Math.cos(a), 0, -Math.sin(a)], u: [-Math.sin(a), 0, Math.cos(a)], w: SCREEN.w, h, title: b[1] });
    add(flipU(band(R, y - h / 2, y + h / 2, th0, len, 24, [1, 1, 1])), { map: boardTex[k], emiSelf: true, glow: { day: 0.35, night: 0.9, violet: 0.8 }, tint: 'white', screen: k });
    const pad = 0.1 / R, fl = 0.2 / R;
    frames.push(band(R + 0.03, y - h / 2 - 0.08, y + h / 2 + 0.08, th0 - pad, len + 2 * pad, 24, WHITE), band(R + 0.03, 0, y - h / 2 - 0.08, Math.PI / 2 - a - fl / 2, fl, 8, WHITE)); });
  add(merge(...frames), {});

  // the lowered soffit: a band that follows the wall all the way round, its height in waves, a light line along its edge
  { const N = 220, under = surface((u, v) => { const t = u * Math.PI * 2, y = soffitY(t), rw = wallR(t, y) + 0.05, r = rw - SOFFIT.depth * (1 - v); return [r * Math.cos(t), y, r * Math.sin(t)]; }, N, 6, [0.97, 0.97, 0.96]);
    add(under, { emi: tex(soffitEmiC()), glow: { day: 0.3, night: 1.1, violet: 1.2 }, tint: { day: GLOW.day, night: GLOW.night, violet: [0.8, 0.6, 1.0] } });
    add(surface((u, v) => { const t = u * Math.PI * 2, y = soffitY(t), r = wallR(t, y) + 0.05 - SOFFIT.depth; return [r * Math.cos(t), y + SOFFIT.fascia * v, r * Math.sin(t)]; }, N, 1, WHITE), {});
    const edge = []; for (let k = 0; k < N; k++){ const t = k / N * Math.PI * 2, y = soffitY(t) - 0.01, r = wallR(t, y) + 0.05 - SOFFIT.depth + 0.03; edge.push([r * Math.cos(t), y, r * Math.sin(t)]); }
    glowLines.push(tube(edge, 0.02, 6, true)); }

  // model plinths with little white massing models (v0.25: the columns and the info totems are gone)
  { const bodies = [];
    PLINTHS.forEach(([d, r], k) => { const t = d * Math.PI / 180, x = Math.cos(t) * r, z = Math.sin(t) * r;
      bodies.push(box(x, 0, z, 0.9, 0.95, 0.9, t, [0.93, 0.93, 0.92]));
      for (let i = 0; i < 22; i++){ const h = 0.03 + rnd() ** 2 * (k ? 0.32 : 0.18); bodies.push(box(x + (rnd() - 0.5) * 0.66, 0.95, z + (rnd() - 0.5) * 0.66, 0.05 + rnd() * 0.07, h, 0.05 + rnd() * 0.07, t, WHITE)); } });
    add(merge(...bodies), {}); }
  add(merge(...glowLines), { unlit: true, glow: { day: 1, night: 1, violet: 1 }, tint: 'glow' });

  // the benches, once the model is in
  const benchURL = opt.benchURL || new URL('../assets/zaha-bench.glb', import.meta.url).href;
  fetch(benchURL).then(r => { if (!r.ok) throw new Error(r.status); return r.arrayBuffer(); })
    .then(buf => { add(placeCopies(parseGLB(buf), BENCH_SLOTS, WHITE), {}); })
    .catch(e => console.warn('hall: bench model', e));

  let hot = -1;   // the screen being pointed at glows brighter
  const tintOf = (p, mood) => p.tint === 'glow' ? GLOW[mood] : p.tint === 'sky' ? MOOD[mood].sky : p.tint === 'white' ? [1, 1, 1] : p.tint ? p.tint[mood] : [0, 0, 0];
  function draw(P, V, M, mood = 'day'){
    const md = MOOD[mood] || MOOD.day; mood = MOOD[mood] ? mood : 'day';
    gl.enable(gl.DEPTH_TEST); gl.disable(gl.BLEND); gl.disable(gl.CULL_FACE);
    gl.useProgram(prog.p); const u = prog.u;
    gl.uniformMatrix4fv(u.uP, false, P); gl.uniformMatrix4fv(u.uV, false, V); gl.uniformMatrix4fv(u.uM, false, M);
    const L = [0.2, 1, 0.15], ll = Math.hypot(...L); gl.uniform3f(u.uLight, L[0] / ll, L[1] / ll, L[2] / ll);
    gl.uniform3fv(u.uLightCol, md.light); gl.uniform1f(u.uAmb, md.amb); gl.uniform1f(u.uDif, md.dif); gl.uniform1f(u.uPool, md.pool); gl.uniform1f(u.uPoolR, R2 + 0.3);
    gl.uniform1i(u.uMap, 0); gl.uniform1i(u.uEmi, 1);
    for (const p of parts){
      const map = p.map || null, emi = p.emiSelf ? p.map : p.emi || null;
      gl.uniform1f(u.uHasMap, map ? 1 : 0); gl.uniform1f(u.uHasEmi, emi ? 1 : 0); gl.uniform1f(u.uUnlit, p.unlit ? 1 : 0);
      gl.uniform1f(u.uEmiI, (p.glow ? p.glow[mood] : 0) + (p.screen != null && p.screen === hot ? 0.55 : 0)); gl.uniform3fv(u.uEmiCol, tintOf(p, mood));
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, map); gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, emi);
      gl.bindVertexArray(p.vao); gl.drawElements(gl.TRIANGLES, p.n, gl.UNSIGNED_INT, 0); }
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, null); gl.activeTexture(gl.TEXTURE0); gl.bindVertexArray(null); }
  function dispose(){ for (const t of textures) gl.deleteTexture(t); for (const b of buffers) gl.deleteBuffer(b); for (const p of parts) gl.deleteVertexArray(p.vao); gl.deleteProgram(prog.p); parts.length = 0; }
  return { tableTop: tableH, tableR: R2, mapR, standAt: R2 + 0.55, draw, dispose, screens, boardTexture: k => boardTex[k], setHot(k){ hot = k == null ? -1 : k; },
    /** where you may walk: outside the table, inside the screens */ walkR: [R2 + 0.2, SCREEN.R - 0.45], clearColour: mood => (MOOD[mood] || MOOD.day).clear, triangles: () => parts.reduce((s, p) => s + p.n / 3, 0) };
}
