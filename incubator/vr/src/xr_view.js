// London 2100 · VR / MR viewer — for Meta Quest (Quest 3 / 3S browser), WebXR + WebGL2, no libraries.
//
// The generated streets, the terrain and the flood risk become a 3D model:
//   · on the desktop: a 3D preview in the page (drag to turn, wheel to zoom);
//   · on a Quest: "Enter MR" puts the model on your real table (passthrough, immersive-ar),
//     or in a dark room (immersive-vr) where passthrough is not offered;
//   · "walk" mode puts you inside it at 1 : 1, standing in the streets.
// Reads a scene (docs/SCENE-FORMAT.md) through src/scene.js, or a live engine with the same shape; read-only.
//
// Controllers: grip (or trigger) = grab and move / turn the model; both grips = scale.
//   right stick: turn / scale · left stick: raise / lower (in walk mode: move, right stick = snap turn)
//   A = flood risk on / off · B = table ↔ walk 1 : 1 · X = existing streets · Y = put it back in front of me
// Hands: pinch = grab, two pinches = scale.
// VR and MR (v0.27): the map stands on a table in an exhibition hall (src/hall.js, v0.21); opt.hall = 'auto' | 'day' | 'night' | 'violet', '0' = no hall.

import { defaultEnv } from './app_state.js?v=0.20';
import { writeCars } from './features.js?v=0.20';
import { createHall } from './hall.js?v=0.48';

const T = {
  zh: { title: '三维 · VR / MR', enterAR: '进入 MR', enterVR: '进入 VR', noXR: '这台设备的浏览器不支持 WebXR。请在 Meta Quest 浏览器中打开本页。', close: '关闭', flood: '洪水风险', drain: '汇水网络', outline: '边界', buildings: '建筑', existing: '现有街道', exag: '高程放大', walk: '1:1 漫游',
    sub: '多尺度城市生成系统', crumb: '伦敦地图', here: 'VR / MR', back: '返回地图', eyebrow: '进入头显', h1: '把伦敦放进房间', lead: '选一种方式，点一下就进入。', lead1: '戴上 Quest，点一下就进入展厅。',
    vrT: 'VR · 展厅', vrD: '地图放在流线展厅的展桌上，圆盘 2.6 m，四周是项目展板。', vrDplain: '在暗色空间里看三维模型。', rec: '推荐', arT: 'MR · 透视', arD: '用 MR 模式进入同一个展厅：展桌、长凳和屏幕都在，圆盘 2.6 m。',
    quest: '在 Quest 上打开', questD: '这台设备不能进入 VR。戴上 Meta Quest，用它的浏览器打开这个链接：', copy: '复制链接', copied: '已复制',
    mood: '展厅氛围', moods: [['auto', '跟随光照'], ['night', '夜间'], ['violet', '紫光']], model: '模型', keys: '手柄',
    keyList: [['L', '左摇杆：走动'], ['R', '右摇杆：左右转身 · 上下抬头低头 · 按下回正'], ['A', '洪水风险'], ['B', '桌面 ↔ 1:1 漫游'], ['X', '{x}'], ['Y', '放回桌上'], ['L3', '打开 / 收起面板']], settings: '地图设置', hideSet: '收起设置', showSet: '设置',
    exit: '退出 VR', exitAR: '退出 MR',
    hint: '拖动旋转 · 滚轮缩放 · 右键平移', streets: n => n + ' 条道路', grow: '道路还在生长：等它结束或按「显示结果」，三维会自动更新。', https: 'WebXR 需要 HTTPS（GitHub Pages 可以）。',
    hud: ['左摇杆：走动 · 右摇杆：左右转身 · 上下抬头低头（按下回正）', '指着屏幕按扳机：放大看 · 握住地图 + 右摇杆：旋转 · 缩放', 'A 洪水风险 · B 桌面 ↔ 1:1 漫游', 'X {x} · Y 地图复位', '左摇杆按下 / 点「面板」：打开控制面板'],
    hudPlain: ['左摇杆：在展厅里走动 · 指着屏幕按扳机：放大看', '握持键：拖动地图 · 右摇杆：旋转 · 缩放', 'A 洪水风险 · B 桌面 ↔ 1:1 漫游', 'X {x} · Y 地图复位', '左摇杆按下 / 点「面板」：打开控制面板'] },
  en: { title: '3D · VR / MR', enterAR: 'Enter MR', enterVR: 'Enter VR', noXR: 'This browser has no WebXR. Open this page in the Meta Quest browser.', close: 'Close', flood: 'Flood risk', drain: 'Drainage', outline: 'Boundaries', buildings: 'Buildings', existing: 'Existing streets', exag: 'Height ×', walk: 'Walk 1:1',
    sub: 'Multi-scale generative city', crumb: 'London map', here: 'VR / MR', back: 'Back to map', eyebrow: 'Headset', h1: 'Put London in the room', lead: 'Pick one; a single click takes you in.', lead1: 'Put on the Quest; one click takes you into the gallery.',
    vrT: 'VR · Gallery', vrD: 'The map stands on a table in a fluid gallery: a 2.6 m disc among the project boards.', vrDplain: 'The 3D model in a dark room.', rec: 'Best', arT: 'MR · Passthrough', arD: 'The same gallery in MR mode: the table, benches and screens around you, a 2.6 m disc.',
    quest: 'Open on the Quest', questD: 'This device cannot enter VR. Put on the Meta Quest and open this link in its browser:', copy: 'Copy link', copied: 'Copied',
    mood: 'Gallery mood', moods: [['auto', 'Follow light'], ['night', 'Night'], ['violet', 'Violet']], model: 'Model', keys: 'Controllers',
    keyList: [['L', 'Left stick: walk'], ['R', 'Right stick: turn · look up / down · click: level'], ['A', 'Flood risk'], ['B', 'Table ↔ walk 1:1'], ['X', '{x}'], ['Y', 'Back on the table'], ['L3', 'Show / hide the panel']], settings: 'Map settings', hideSet: 'Hide settings', showSet: 'Settings',
    exit: 'Exit VR', exitAR: 'Exit MR',
    hint: 'drag to turn · wheel to zoom · right-drag to pan', streets: n => n + ' streets', grow: 'Streets are still growing: wait or press "Show result"; the 3D view follows.', https: 'WebXR needs HTTPS (GitHub Pages is fine).',
    hud: ['Left stick: walk · right stick: turn · look up and down (click: level)', 'Point + trigger: open a screen · hold the map + right stick: turn · scale', 'A flood risk · B table ↔ walk 1:1', 'X {x} · Y reset the map', 'Left stick click / “Panel”: the controls'],
    hudPlain: ['Left stick: walk the hall · point + trigger: open a screen', 'Grip: slide the map · right stick: turn · scale', 'A flood risk · B table ↔ walk 1:1', 'X {x} · Y reset the map', 'Left stick click / “Panel”: the controls'] }
};

// ---------------------------------------------------------------- geometry (pure, testable in node)
const FLOODC = [null, [156, 221, 234], [247, 211, 89], [242, 157, 56], [215, 55, 49]], FLOODA = [0, 0.22, 0.42, 0.62, 0.78];
const LAND = [0.925, 0.918, 0.898], OFF = [0.30, 0.34, 0.37], PLINTH = [0.16, 0.16, 0.17];
const ROADC = { 1: [0.10, 0.10, 0.11], 2: [0.36, 0.36, 0.39], fixed: [0.62, 0.62, 0.64], bridge: [0.04, 0.52, 1.0], outline: [0.08, 0.08, 0.09] };
const DRAINC = [0.04, 0.45, 0.95], DRAINA = [0, 0.16, 0.42, 0.72, 0.92];   // ≥ 1 · 10 · 100 · 1000 km² upstream
export const STRIDE = 12;   // pos 3 · side 2 · normal 3 · colour 3 · kind 1

/** Heights on the site grid, bilinear, in metres above the lowest land (0 where there is no terrain). */
export function heightSampler(S){
  const { nx, ny, cell } = S, Z = S.Z;
  if (!Z) return { at: () => 0, lo: 0, hi: 0 };
  let lo = Infinity, hi = -Infinity; for (let i = 0; i < Z.length; i++){ const z = Z[i]; if (!Number.isFinite(z) || (S.mask && !S.mask[i])) continue; if (z < lo) lo = z; if (z > hi) hi = z; }
  if (!Number.isFinite(lo)){ lo = 0; hi = 0; }
  const at = (x, y) => { const fx = Math.max(0, Math.min(nx - 1.001, x / cell)), fy = Math.max(0, Math.min(ny - 1.001, y / cell)), c = Math.floor(fx), r = Math.floor(fy), u = fx - c, v = fy - r;
    const g = (cc, rr) => { const z = Z[rr * nx + cc]; return Number.isFinite(z) ? Math.max(0, z - lo) : 0; };
    return (g(c, r) * (1 - u) + g(c + 1, r) * u) * (1 - v) + (g(c, r + 1) * (1 - u) + g(c + 1, r + 1) * u) * v; };
  return { at, lo, hi };
}

/** The terrain with its plinth. Model space: x east, y up (metres above the lowest land), z south; centred on the grid. */
export function buildTerrain(S, opt = {}){
  const { nx, ny, cell } = S, H = heightSampler(S), step = Math.max(1, Math.ceil(Math.max(nx, ny) / (opt.res || 600)));
  const cx = (nx - 1) * cell / 2, cy = (ny - 1) * cell / 2, gx = Math.floor((nx - 1) / step) + 1, gy = Math.floor((ny - 1) / step) + 1;
  const exag = opt.exag || 3, depth = opt.depth || Math.max(40, Math.max(nx, ny) * cell * 0.012), flood = opt.flood && S.flood, drain = opt.drain && S.drain;
  const v = [], idx = [];
  const colAt = (c, r) => { const i = r * nx + c, land = !S.mask || S.mask[i]; let col = land ? LAND.slice() : OFF.slice();
    if (land && S.Z && H.hi > H.lo){ const t = (S.Z[i] - H.lo) / (H.hi - H.lo); for (let k = 0; k < 3; k++) col[k] *= 0.84 + 0.16 * t; }
    if (flood){ const f = S.flood[i]; if (f){ const a = FLOODA[f] * (land ? 1 : 0.5); for (let k = 0; k < 3; k++) col[k] = col[k] * (1 - a) + FLOODC[f][k] / 255 * a; } }
    if (drain){ const d = S.drain[i]; if (d){ const a = DRAINA[d]; for (let k = 0; k < 3; k++) col[k] = col[k] * (1 - a) + DRAINC[k] * a; } }
    return col; };
  for (let j = 0; j < gy; j++) for (let k = 0; k < gx; k++){
    const c = Math.min(nx - 1, k * step), r = Math.min(ny - 1, j * step), x = c * cell, y = r * cell, h = H.at(x, y);
    const d = step * cell, hx = (H.at(x + d, y) - H.at(x - d, y)) * exag / (2 * d), hy = (H.at(x, y + d) - H.at(x, y - d)) * exag / (2 * d);
    let n = [-hx, 1, hy]; const L = Math.hypot(...n); n = n.map(q => q / L);
    v.push(x - cx, h, -(y - cy), 0, 0, n[0], n[1], n[2], ...colAt(c, r), 0); }
  for (let j = 0; j < gy - 1; j++) for (let k = 0; k < gx - 1; k++){ const a = j * gx + k, b = a + 1, c = a + gx, d = c + 1; idx.push(a, b, c, b, d, c); }
  // plinth: four walls down to -depth (in exaggerated metres, so divide) and a floor
  const base = v.length / STRIDE, ring = [];
  for (let k = 0; k < gx; k++) ring.push(k); for (let j = 1; j < gy; j++) ring.push(j * gx + gx - 1);
  for (let k = gx - 2; k >= 0; k--) ring.push((gy - 1) * gx + k); for (let j = gy - 2; j > 0; j--) ring.push(j * gx);
  for (let q = 0; q < ring.length; q++){ const a = ring[q], b = ring[(q + 1) % ring.length], pa = v.slice(a * STRIDE, a * STRIDE + 3), pb = v.slice(b * STRIDE, b * STRIDE + 3);
    let n = [pb[2] - pa[2], 0, -(pb[0] - pa[0])]; const L = Math.hypot(...n) || 1; n = n.map(x => x / L); const o = v.length / STRIDE;
    for (const [p, y] of [[pa, pa[1]], [pb, pb[1]], [pa, -depth / exag], [pb, -depth / exag]]) v.push(p[0], y, p[2], 0, 0, ...n, ...PLINTH, 0);
    idx.push(o, o + 2, o + 1, o + 1, o + 2, o + 3); }
  const o = v.length / STRIDE, w = cx, h = cy;
  for (const [x, z] of [[-w, -h], [w, -h], [-w, h], [w, h]]) v.push(x, -depth / exag, z, 0, 0, 0, -1, 0, ...PLINTH, 0);
  idx.push(o, o + 1, o + 2, o + 1, o + 3, o + 2);
  void base;
  return { v: new Float32Array(v), i: new Uint32Array(idx), size: (Math.max(nx, ny) - 1) * cell, cx, cy, hi: H.hi - H.lo };
}

/** Streets as flat ribbons draped on the terrain. lines: [{ pts:[[x,y]…], w:[m…] | number, kind:1|2|'fixed'|'bridge' }] */
export function buildRibbons(S, lines, terrain){
  const H = heightSampler(S), v = [], idx = [], { cx, cy } = terrain;
  for (const l of lines){ const P = l.pts; if (!P || P.length < 2) continue; const col = ROADC[l.kind] || ROADC[2], kind = l.kind === 'fixed' ? 0.6 : l.kind === 'bridge' || l.kind === 'outline' ? 1.4 : 1, o = v.length / STRIDE;
    for (let i = 0; i < P.length; i++){ const a = P[Math.max(0, i - 1)], b = P[Math.min(P.length - 1, i + 1)]; let tx = b[0] - a[0], ty = b[1] - a[1]; const L = Math.hypot(tx, ty) || 1; tx /= L; ty /= L;
      const w = (Array.isArray(l.w) ? l.w[i] : l.w) || 8, nx_ = -ty * w / 2, ny_ = tx * w / 2, p = P[i], h = H.at(p[0], p[1]);
      // side vector in model x / z (z is south, so the plan's y flips)
      v.push(p[0] - cx, h, -(p[1] - cy), nx_, -ny_, 0, 1, 0, ...col, kind);
      v.push(p[0] - cx, h, -(p[1] - cy), -nx_, ny_, 0, 1, 0, ...col, kind); }
    for (let i = 0; i < P.length - 1; i++){ const a = o + 2 * i; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); } }
  return { v: new Float32Array(v), i: new Uint32Array(idx) };
}

/** What the engine has now, as plain data. */
export function snapshot(api){
  const D = api.D, S = { nx: api.nx, ny: api.ny, cell: api.cell, Z: api.ENV ? api.ENV.Z : null, mask: D.landMask || null, flood: api.FR || null, drain: api.DR || null };
  const lines = [];
  try { for (const st of api.streets()) lines.push({ pts: st.pts, w: st.w, kind: st.level === 1 ? 1 : 2 }); }
  catch (e){ for (const l of api.lines()) if (!l.dead && l.level > 0) lines.push({ pts: l.pts, w: l.level === 1 ? 14 : 8, kind: l.level === 1 ? 1 : 2 }); }
  const fixed = (D.fixed?.streets || []).map(pts => ({ pts, w: 6, kind: 'fixed' }));
  const bridges = (D.fixed?.bridges || []).map(pts => ({ pts, w: 10, kind: 'bridge' }));
  const outlines = (api.outlines || []).map(o => ({ pts: o.pts, w: o.w || 200, kind: 'outline' }));
  return { S, lines, fixed, bridges: bridges.concat(outlines), hasFixed: fixed.length > 0, hasOutline: outlines.length > 0 };
}

// ---------------------------------------------------------------- small matrix kit (column-major)
const M4 = {
  id: () => { const m = new Float32Array(16); m[0] = m[5] = m[10] = m[15] = 1; return m; },
  mul(a, b){ const o = new Float32Array(16); for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++){ let s = 0; for (let k = 0; k < 4; k++) s += a[k * 4 + r] * b[c * 4 + k]; o[c * 4 + r] = s; } return o; },
  trs(p, yaw, s){ const m = M4.id(), c = Math.cos(yaw), n = Math.sin(yaw); m[0] = c * s; m[2] = -n * s; m[8] = n * s; m[10] = c * s; m[5] = s; m[12] = p[0]; m[13] = p[1]; m[14] = p[2]; return m; },
  persp(fovy, asp, near, far){ const f = 1 / Math.tan(fovy / 2), m = new Float32Array(16); m[0] = f / asp; m[5] = f; m[10] = (far + near) / (near - far); m[11] = -1; m[14] = 2 * far * near / (near - far); return m; },
  look(eye, at, up = [0, 1, 0]){ const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], nrm = a => { const l = Math.hypot(...a) || 1; return a.map(x => x / l); }, cr = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]], dt = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
    const z = nrm(sub(eye, at)), x = nrm(cr(up, z)), y = cr(z, x); return new Float32Array([x[0], y[0], z[0], 0, x[1], y[1], z[1], 0, x[2], y[2], z[2], 0, -dt(x, eye), -dt(y, eye), -dt(z, eye), 1]); },
  basis(x, y, z, p, s){ return new Float32Array([x[0] * s[0], x[1] * s[0], x[2] * s[0], 0, y[0] * s[1], y[1] * s[1], y[2] * s[1], 0, z[0], z[1], z[2], 0, p[0], p[1], p[2], 1]); }
};
const ENV0 = defaultEnv();
const R_WORLD = 2.2e7;   // the widest view, in metres: the whole world on the table
const yawOf = (fx, fz) => Math.atan2(-fx, -fz);   // the yaw that turns (0,0,-1) onto (fx, ·, fz)
const rotY = (v, a) => { const c = Math.cos(a), s = Math.sin(a); return [v[0] * c + v[2] * s, v[1], -v[0] * s + v[2] * c]; };

// ---------------------------------------------------------------- renderer
const VS = `#version 300 es
in vec3 aPos; in vec2 aSide; in vec3 aNor; in vec3 aCol; in float aKind;
uniform mat4 uP, uV, uM; uniform float uExag, uWidth, uLift; uniform vec3 uTint;
out vec3 vCol; out vec3 vN; out vec2 vMP; out vec3 vP;
void main(){ vec3 p = aPos; p.y = p.y * uExag + aKind * uLift; p.xz += aSide * uWidth;
  gl_Position = uP * uV * uM * vec4(p, 1.0); vN = aNor; vCol = aCol * uTint; vMP = p.xz; vP = p; }`;   // normals stay in model space: the sun is fixed to the map's north
const FS = `#version 300 es
precision highp float; in vec3 vCol; in vec3 vN; in vec2 vMP; in vec3 vP; uniform float uAlpha, uAmb, uDif; uniform vec3 uClip, uLight, uLightCol, uEye; uniform vec4 uFog; uniform vec2 uFogR; out vec4 o;
void main(){ if (uClip.z > 0.0 && distance(vMP, uClip.xy) > uClip.z) discard; vec3 n = normalize(vN); float l = uAmb + uDif * max(dot(n, uLight), 0.0);
  float f = uFog.a * clamp((distance(vP, uEye) - uFogR.x) / max(uFogR.y - uFogR.x, 0.001), 0.0, 1.0); o = vec4(mix(vCol * l * uLightCol, uFog.rgb, f), uAlpha); }`;
const VT = `#version 300 es
in vec3 aPos; in vec2 aUV; uniform mat4 uP, uV, uM; out vec2 vUV; out vec2 vMP; out vec3 vP; void main(){ vUV = aUV; vMP = aPos.xz; vP = aPos; gl_Position = uP * uV * uM * vec4(aPos, 1.0); }`;
const FT = `#version 300 es
precision highp float; in vec2 vUV; in vec2 vMP; in vec3 vP; uniform sampler2D uT; uniform vec3 uClip, uEye; uniform vec4 uFog; uniform vec2 uFogR; out vec4 o;
void main(){ if (uClip.z > 0.0 && distance(vMP, uClip.xy) > uClip.z) discard; o = texture(uT, vUV); if (o.a < 0.02) discard;
  float f = uFog.a * clamp((distance(vP, uEye) - uFogR.x) / max(uFogR.y - uFogR.x, 0.001), 0.0, 1.0); o.rgb = mix(o.rgb, uFog.rgb, f); }`;
// building shadows: every vertex slides along the sun's direction down to the ground; the stencil keeps overlaps from doubling
const VSH = `#version 300 es
in vec3 aPos; uniform mat4 uP, uV, uM; uniform vec2 uSh; out vec2 vMP;
void main(){ vec3 p = aPos; p.xz -= uSh * p.y; p.y = 0.0; vMP = p.xz; gl_Position = uP * uV * uM * vec4(p, 1.0); }`;
const FSH = `#version 300 es
precision highp float; in vec2 vMP; uniform vec3 uClip; uniform float uA; out vec4 o;
void main(){ if (uClip.z > 0.0 && distance(vMP, uClip.xy) > uClip.z) discard; o = vec4(0.0, 0.0, 0.0, uA); }`;
// rain and snow: world-space points and short lines
const VPT = `#version 300 es
in vec3 aPos; uniform mat4 uP, uV; uniform float uPt; void main(){ gl_Position = uP * uV * vec4(aPos, 1.0); gl_PointSize = max(1.5, uPt / max(gl_Position.w, 0.001)); }`;
const FPT = `#version 300 es
precision highp float; uniform vec4 uCol; uniform float uRound; out vec4 o;
void main(){ if (uRound > 0.5){ vec2 d = gl_PointCoord - 0.5; if (dot(d, d) > 0.25) discard; } o = uCol; }`;

function program(gl, vs, fs){ const p = gl.createProgram();
  for (const [t, s] of [[gl.VERTEX_SHADER, vs], [gl.FRAGMENT_SHADER, fs]]){ const sh = gl.createShader(t); gl.shaderSource(sh, s); gl.compileShader(sh); if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(sh)); gl.attachShader(p, sh); }
  gl.bindAttribLocation(p, 0, 'aPos');
  gl.linkProgram(p); if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
  const u = {}; for (let i = 0, n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS); i < n; i++){ const a = gl.getActiveUniform(p, i); u[a.name] = gl.getUniformLocation(p, a.name); }
  return { p, u }; }

function mesh(gl, prog, data, mode){ const vao = gl.createVertexArray(); gl.bindVertexArray(vao);
  const vb = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, vb); gl.bufferData(gl.ARRAY_BUFFER, data.v, gl.DYNAMIC_DRAW);
  const ib = gl.createBuffer(); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ib); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, data.i, gl.DYNAMIC_DRAW);
  const at = (name, n, off) => { const l = gl.getAttribLocation(prog.p, name); if (l < 0) return; gl.enableVertexAttribArray(l); gl.vertexAttribPointer(l, n, gl.FLOAT, false, STRIDE * 4, off * 4); };
  at('aPos', 3, 0); at('aSide', 2, 3); at('aNor', 3, 5); at('aCol', 3, 8); at('aKind', 1, 11); gl.bindVertexArray(null);
  return { vao, vb, ib, n: data.i.length, mode: mode ?? gl.TRIANGLES,
    set(d){ gl.bindBuffer(gl.ARRAY_BUFFER, vb); gl.bufferData(gl.ARRAY_BUFFER, d.v, gl.DYNAMIC_DRAW); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ib); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, d.i, gl.DYNAMIC_DRAW); this.n = d.i.length; } }; }

// ---------------------------------------------------------------- the view
let OPEN = null;

export function open(api, lang = 'zh', opt = {}){
  if (OPEN) return OPEN;
  const L = T[lang] || T.zh;
  const VW = api.view || {};
  // the hall: in VR the disc is bigger (radius TR) and stands on the hall's table; in MR / without the hall it stays 0.45 m
  const hallOn = !!opt.hall && !['0', 'off', 'false'].includes(String(opt.hall)); let TR = 0.45;
  let hall = null, hallPose = null;
  const st = { bld: true, flood: !!api.FR && (VW.flood ?? api.floodShown?.() !== false), drain: !!api.DR && VW.drain !== false, fixed: true, exag: VW.exag || 3, walk: false, sig: '', terrain: null };
  const tOpt = () => ({ exag: st.exag, flood: st.flood, drain: st.drain, res: VW.res });
  let snap = snapshot(api), terrain = buildTerrain(snap.S, tOpt());
  const fixedLabel = snap.hasFixed ? L.existing : L.outline, xLabel = api.DR ? L.drain : (api.extra || api.stream) ? null : fixedLabel;   // v0.46: X no longer hides the buildings
  // v0.24 · the page looks like the rest of London 2100 (shared/ui/theme.css): black / graphite, one warm sand accent,
  // top bar · "into the headset" on the left · the live view · the map settings on the right · a status bar
  const css = `#tsXR{position:fixed;inset:0;z-index:9999;background:#000;color:#f5f5f7;font:13px/1.45 -apple-system,BlinkMacSystemFont,'SF Pro Text','PingFang SC','Helvetica Neue',sans-serif;-webkit-font-smoothing:antialiased;
  display:grid;grid-template-columns:340px minmax(0,1fr) 340px;grid-template-rows:56px minmax(0,1fr) 44px;grid-template-areas:"top top top" "side stage insp" "foot foot foot"}
#tsXR *{box-sizing:border-box}#tsXR [hidden]{display:none!important}
#tsXR button{font:inherit;color:inherit;cursor:pointer}
#tsXR .top{grid-area:top;display:flex;align-items:center;gap:14px;padding:0 14px 0 20px;border-bottom:1px solid rgba(255,255,255,.08);background:rgba(0,0,0,.85);min-width:0}
#tsXR .brand{display:flex;align-items:baseline;gap:8px;white-space:nowrap}#tsXR .mark{width:10px;height:10px;border-radius:3px;background:#f5f5f7;align-self:center}
#tsXR .brand b{font-weight:600;letter-spacing:-.01em}#tsXR .brand span{color:#8e8e93;font-size:12px}
#tsXR .crumbs{display:flex;align-items:center;gap:6px;min-width:0;color:#a1a1a6;white-space:nowrap;overflow:hidden}#tsXR .crumbs .sep{color:#6e6e73}#tsXR .crumbs b{color:#f5f5f7;font-weight:600}
#tsXR .loc{font:11px ui-monospace,'SF Mono',Menlo,monospace;color:#8e8e93;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0}
#tsXR .sp{flex:1}
#tsXR .btn{height:32px;display:inline-flex;align-items:center;gap:6px;padding:0 12px;border-radius:8px;border:1px solid rgba(255,255,255,.14);background:#1c1c1e;white-space:nowrap}
#tsXR .btn:hover{background:#2c2c2e}#tsXR .btn.exit{background:#f5f5f7;border-color:#f5f5f7;color:#1c1c1e;font-weight:600}
#tsXR .side{grid-area:side;background:#111113;border-right:1px solid rgba(255,255,255,.08);padding:20px 16px;display:flex;flex-direction:column;gap:14px;overflow:auto}
#tsXR .eyebrow{font-size:11px;letter-spacing:.06em;text-transform:uppercase;color:#8e8e93}
#tsXR h1{margin:6px 0 0;font-size:26px;line-height:1.15;font-weight:600;letter-spacing:-.02em}#tsXR .lead{margin:6px 0 0;color:#a1a1a6}
#tsXR .modes{display:flex;flex-direction:column;gap:10px}
#tsXR .mode{text-align:left;padding:14px;border-radius:14px;border:1px solid rgba(255,255,255,.08);background:#161618;display:flex;flex-direction:column;gap:8px;transition:background .15s,border-color .15s}
#tsXR .mode:hover{background:#1c1c1e;border-color:rgba(255,255,255,.2)}#tsXR .mode.primary{border-color:#f5f5f7;background:#1c1c1e}
#tsXR .mode .mh{display:flex;align-items:center;gap:10px}#tsXR .mode b{font-size:15px;font-weight:600;flex:1}#tsXR .mode .md{color:#a1a1a6}
#tsXR .mode .tag{font-size:11px;padding:2px 8px;border-radius:999px;background:#f5f5f7;color:#1c1c1e;font-weight:600}
#tsXR .mode .go{display:flex;align-items:center;gap:6px;color:#f5f5f7;font-weight:600;font-size:12px}
#tsXR .card{padding:12px;border-radius:12px;background:#1c1c1e;border:1px solid rgba(255,255,255,.08);display:flex;flex-direction:column;gap:8px}
#tsXR .url{font:11px ui-monospace,'SF Mono',Menlo,monospace;color:#f5f5f7;word-break:break-all}
#tsXR .chips{display:flex;gap:6px;flex-wrap:wrap}#tsXR .chips button{height:28px;padding:0 10px;border-radius:999px;border:1px solid rgba(255,255,255,.14);background:transparent;color:#a1a1a6;font-size:12px}
#tsXR .chips button.on{background:#2c2c2e;border-color:#f5f5f7;color:#f5f5f7}   /* v0.47: selected = white, as in the app */
#tsXR .rows{display:flex;flex-direction:column}
#tsXR .tog{display:flex;align-items:center;justify-content:space-between;height:36px;border:0;border-bottom:1px solid rgba(255,255,255,.08);background:none;padding:0;text-align:left}
#tsXR .tog::after{content:"";width:36px;height:22px;border-radius:11px;background:#2c2c2e;flex:none;box-shadow:inset 0 0 0 9px #2c2c2e;transition:background .15s}
#tsXR .tog{position:relative}#tsXR .tog::before{content:"";position:absolute;right:16px;top:9px;width:18px;height:18px;border-radius:50%;background:#fff;transition:right .15s;z-index:1}
#tsXR .tog.on::after{background:#8fb59a;box-shadow:none}#tsXR .tog.on::before{right:2px}
#tsXR .exagRow{display:flex;align-items:center;gap:10px;height:40px}#tsXR .exagRow span{flex:1}#tsXR .exagRow input{width:110px;accent-color:#f5f5f7}#tsXR .exagRow b{font:12px ui-monospace,'SF Mono',Menlo,monospace;color:#a1a1a6;min-width:24px;text-align:right}
#tsXR .keys{display:grid;grid-template-columns:34px 1fr;row-gap:6px;column-gap:8px;align-items:center;color:#a1a1a6;font-size:12px}
#tsXR .keys i{font-style:normal;height:22px;border-radius:6px;background:#2c2c2e;color:#f5f5f7;font:11px ui-monospace,'SF Mono',Menlo,monospace;display:flex;align-items:center;justify-content:center}
#tsXR .stage{grid-area:stage;position:relative;min-width:0;min-height:0;background:#0a0a0b}
#tsXR canvas.view{position:absolute;inset:0;width:100%;height:100%;touch-action:none;display:block}
#tsXR .showSet{position:absolute;right:16px;top:16px}
#tsXR .insp{grid-area:insp;background:#111113;border-left:1px solid rgba(255,255,255,.08);display:flex;flex-direction:column;min-height:0}
#tsXR .insp header{display:flex;align-items:center;justify-content:space-between;padding:14px 16px 4px}#tsXR .insp header b{font-size:15px;font-weight:600}
#tsXR .insp .icon{width:30px;height:30px;border-radius:8px;border:0;background:transparent;color:#a1a1a6;display:flex;align-items:center;justify-content:center}#tsXR .insp .icon:hover{background:#1c1c1e;color:#f5f5f7}
#tsXR .appPanel{overflow:auto;padding:0 2px 12px}#tsXR .appPanel canvas{display:block;width:100%;height:auto}
#tsXR.noInsp{grid-template-columns:340px minmax(0,1fr) 0}#tsXR.noInsp .insp{display:none}
#tsXR .foot{grid-area:foot;display:flex;align-items:center;gap:10px;padding:0 20px;border-top:1px solid rgba(255,255,255,.08);background:#0a0a0b;min-width:0}
#tsXR .dot{width:8px;height:8px;border-radius:50%;background:#8fb59a;flex:none}#tsXR .note{font:12px ui-monospace,'SF Mono',Menlo,monospace;color:#a1a1a6;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#tsXR.immersive{display:block;background:transparent;pointer-events:none}
#tsXR.immersive .side,#tsXR.immersive .insp,#tsXR.immersive .showSet,#tsXR.immersive .brand,#tsXR.immersive .crumbs,#tsXR.immersive .loc{display:none}
#tsXR.immersive .stage{position:fixed;inset:0;background:transparent}
#tsXR.immersive .top{position:fixed;top:0;left:0;right:0;z-index:2;height:auto;padding:16px;background:transparent;border:0;pointer-events:none}
#tsXR.immersive .top .btn{pointer-events:auto;border-radius:999px;backdrop-filter:blur(18px);background:rgba(44,44,46,.82)}#tsXR.immersive .top .btn.exit{background:#f5f5f7}
#tsXR.immersive .foot{position:fixed;left:16px;bottom:14px;z-index:2;height:auto;max-width:calc(100% - 32px);padding:6px 12px;border:0;border-radius:999px;background:rgba(28,28,30,.82);backdrop-filter:blur(12px)}
@media (max-width:900px){#tsXR{display:flex;flex-direction:column;overflow:auto}#tsXR .stage{min-height:56vh;flex:none}#tsXR .top{flex:none;height:56px}#tsXR .foot{flex:none;height:44px}#tsXR .insp{min-height:auto}}`;
  const ic = { vr: '<svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9a9 4 0 0 0 18 0"/><path d="M3 9a9 4 0 0 1 18 0"/><path d="M9 13l-1 8h8l-1-8"/></svg>',
    ar: '<svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="6" width="18" height="12" rx="6"/><circle cx="8.5" cy="12" r="2"/><circle cx="15.5" cy="12" r="2"/></svg>',
    back: '<svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>',
    go: '<svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="M13 6l6 6-6 6"/></svg>',
    fold: '<svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l6 6-6 6"/></svg>' };
  const esc = x => String(x).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const root = document.createElement('div'); root.id = 'tsXR';
  root.innerHTML = `<style>${css}</style>
<header class="top"><div class="brand"><span class="mark" aria-hidden="true"></span><b>London 2100</b><span>${L.sub}</span></div>
  <nav class="crumbs" aria-label="${lang === 'zh' ? '位置' : 'Location'}"><span>${esc(opt.crumb || (opt.standalone ? 'London 2100' : L.crumb))}</span><span class="sep" aria-hidden="true">›</span><b>${hallOn ? 'VR' : L.here}</b></nav>
  <span class="loc">${esc(opt.title || L.title)}</span><span class="sp"></span><span class="exitSlot"></span>
  ${opt.standalone ? '' : `<button class="btn" data-k="close">${ic.back}${esc(opt.closeLabel && opt.closeLabel !== (lang === 'zh' ? '地图' : 'Map') ? opt.closeLabel : L.back)}</button>`}</header>
<aside class="side" aria-label="${L.eyebrow}">
  <div><div class="eyebrow">${L.eyebrow}</div><h1>${L.h1}</h1><p class="lead">${hallOn ? L.lead1 : L.lead}</p></div>
  <div class="modes xrBtns"></div>
  <div class="card noxr" hidden><b>${L.quest}</b><span class="lead" style="margin:0">${L.questD}</span><span class="url"></span><button class="btn copy" type="button">${L.copy}</button></div>
  <div class="hallGrp" hidden><div class="eyebrow" style="margin-bottom:8px">${L.mood}</div><div class="chips mood" role="group" aria-label="${L.mood}">${L.moods.map(([k, t]) => `<button type="button" data-mood="${k}">${t}</button>`).join('')}</div></div>
  <div class="modelGrp"><div class="eyebrow" style="margin-bottom:4px">${L.model}</div><div class="rows">
    <button class="tog" type="button" data-k="flood">${L.flood}</button><button class="tog" type="button" data-k="drain">${L.drain}</button>
    <button class="tog on" type="button" data-k="fixed">${fixedLabel}</button>
    <label class="exagRow"><span>${L.exag}</span><input type="range" min="1" max="${VW.exagMax || 8}" step="0.5" value="${st.exag}"><b>${st.exag}</b></label></div></div>
  <div style="margin-top:auto"><div class="eyebrow" style="margin-bottom:8px">${L.keys}</div><div class="keys">${L.keyList.filter(([k]) => !(k === 'X' && !xLabel) && !(k === 'A' && !api.FR) && !((k === 'L' || k === 'R') && !hallOn)).map(([k, t]) => `<i>${k}</i><span>${t.replace('{x}', xLabel)}</span>`).join('')}</div></div>
</aside>
<main class="stage"><canvas class="view"></canvas>
  <button class="btn showSet" type="button" hidden>${L.showSet}</button></main>
<aside class="insp" aria-label="${L.settings}"><header><b>${L.settings}</b><button class="icon hideSet" type="button" aria-label="${L.hideSet}">${ic.fold}</button></header></aside>
<footer class="foot"><span class="dot" aria-hidden="true"></span><span class="note"></span></footer>`;
  document.body.append(root);
  // the app's control panel (opt.panel, src/app_panel.js): on the left hand in the headset; the page shows opt.deskPanel (one column) in its side bar
  const panel = opt.panel || null, deskPanel = opt.deskPanel || panel; let panelOn = false;
  // where the panel is in the headset (kept between sessions): on the left hand, placed in the room (c, facing you), or hidden; w = width in metres
  const pm = { mode: 'off', prev: 'hand', c: null, w: 0.36, grab: null };   // v0.23: hidden until you call it up
  const showPanel = () => { if (!panel) return; pm.mode = pm.prev === 'world' && pm.c ? 'world' : 'hand'; if (pm.mode === 'hand') pm.w = 0.36; panelOn = true; };
  const hidePanel = () => { if (pm.mode !== 'off') pm.prev = pm.mode; pm.mode = 'off'; pm.grab = null; panelOn = false; };
  window.__vrPanel = pm;   // for checking from the console / tests
  const insp = root.querySelector('.insp'), showSet = root.querySelector('.showSet');
  if (deskPanel){ const box = document.createElement('div'); box.className = 'appPanel'; box.append(deskPanel.canvas); insp.append(box);
    const uv = e => { const r = deskPanel.canvas.getBoundingClientRect(); return [(e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height]; };
    deskPanel.canvas.addEventListener('pointermove', e => { deskPanel.setHover(deskPanel.hitAt(...uv(e))); deskPanel.canvas.style.cursor = deskPanel.hitAt(...uv(e)) != null ? 'pointer' : 'default'; });
    deskPanel.canvas.addEventListener('pointerleave', () => deskPanel.setHover(null));
    deskPanel.canvas.addEventListener('click', e => { const i = deskPanel.hitAt(...uv(e)); if (i != null) deskPanel.press(i); }); }
  else root.classList.add('noInsp');
  const setInsp = on => { root.classList.toggle('noInsp', !on || !deskPanel); showSet.hidden = on || !deskPanel; };
  root.querySelector('.hideSet').onclick = () => setInsp(false); showSet.onclick = () => setInsp(true);
  const cv = root.querySelector('canvas.view'), note = root.querySelector('.note');
  const gl = cv.getContext('webgl2', { antialias: true, alpha: true, stencil: true, xrCompatible: true });
  if (!gl){ note.textContent = 'WebGL2 is not available.'; return null; }
  const prog = program(gl, VS, FS), tex = program(gl, VT, FT), shProg = program(gl, VSH, FSH), ptProg = program(gl, VPT, FPT);
  // lighting, weather and switches: from the app (opt.env) or plain daylight
  const envFn = opt.env || (() => ENV0); let env = envFn();
  /** fog: e = eye / centre in model space, r0…r1 the distances over which it thickens, a its full strength */
  let fogSet = { e: [0, 0, 0], r0: 0, r1: 1, a: 0, c: [1, 1, 1] };
  function setEnvUniforms(){
    gl.useProgram(prog.p); gl.uniform3fv(prog.u.uLight, env.dir); gl.uniform3fv(prog.u.uLightCol, env.lightColour); gl.uniform1f(prog.u.uAmb, env.ambient); gl.uniform1f(prog.u.uDif, env.diffuse);
    for (const pr of [prog, tex]){ gl.useProgram(pr.p); gl.uniform3fv(pr.u.uEye, fogSet.e); gl.uniform2f(pr.u.uFogR, fogSet.r0, fogSet.r1); gl.uniform4f(pr.u.uFog, fogSet.c[0], fogSet.c[1], fogSet.c[2], fogSet.a); } }
  const noFog = pr => { gl.useProgram(pr.p); gl.uniform4f(pr.u.uFog, 0, 0, 0, 0); };

  // state
  const tiles = new Map(); let loadingN = 0, lastUpd = -1e9, clip = [0, 0, -1];
  let failN = 0, lastErr = '', curZ = 14, zSet = false, stylingN = 0;
  const streamInfo = () => { let n = 0, c = 0, st2 = 0; for (const T of tiles.values()) if (T.ready){ n++; c += T.count; if (T.styled) st2++; } return { tiles: n, count: c, styled: st2, loading: loadingN + stylingN, failed: failN, err: lastErr }; };
  const xMesh = api.extra ? mesh(gl, prog, api.extra) : null, gTex = api.ground ? groundTexture(api.ground) : null, gQuad = api.ground ? groundQuad() : null;
  const tMesh = mesh(gl, prog, terrain), rMesh = mesh(gl, prog, buildRibbons(snap.S, snap.lines, terrain)), fMesh = mesh(gl, prog, buildRibbons(snap.S, snap.fixed.concat(snap.bridges), terrain));
  const streamLine = () => { const i = streamInfo(); return lang === 'zh'
      ? `移动加载 · 层级 ${curZ} · 已加载 ${i.tiles} 块` + (i.styled ? `（${i.styled} 块已用 app 样式）` : '') + ` · ${i.count} 栋建筑` + (i.loading ? ` · 正在加载 ${i.loading} 块` : '') + (i.failed ? ` · 失败 ${i.failed} 次：${i.err}` : '') + (pe() ? ` · app 样式报错 ${pe().n} 次：${pe().first}` : '')
      : `streaming · zoom ${curZ} · ${i.tiles} tiles` + (i.styled ? ` (${i.styled} in the app's look)` : '') + ` · ${i.count} buildings` + (i.loading ? ` · loading ${i.loading}` : '') + (i.failed ? ` · ${i.failed} failed: ${i.err}` : '') + (pe() ? ` · map style errors ${pe().n}: ${pe().first}` : ''); };
  const pe = () => { const e = api.stream?.painter?.errors; return e && e.n ? e : null; };
  const status = () => { const n = snap.lines.length; note.textContent = (n ? L.streets(n) + ' · ' : '') + (api.stream ? streamLine() + ' · ' : api.buildings ? api.buildings + (lang === 'zh' ? ' 栋建筑 · ' : ' buildings · ') : '') + (api.note ? api.note + ' · ' : '') + L.hint + (api.finished() ? '' : ' · ' + L.grow); };
  const sigOf = () => { let dead = 0, pts = 0; for (const l of api.lines()){ if (l.dead) dead++; else pts += l.pts.length; } return api.lines().length + ':' + dead + ':' + pts + ':' + api.finished(); };
  st.sig = sigOf(); status();
  if (panel && api.stream) panel.setFooter(() => streamLine());
  let panelT = 0; const panelTick = t => { if (t - panelT > 400){ panelT = t; panel?.draw(); if (deskPanel && deskPanel !== panel) deskPanel.draw(); } };
  const refresh = (all) => { snap = snapshot(api); if (all){ terrain = buildTerrain(snap.S, tOpt()); tMesh.set(terrain); fMesh.set(buildRibbons(snap.S, snap.fixed.concat(snap.bridges), terrain)); } rMesh.set(buildRibbons(snap.S, snap.lines, terrain)); status(); };
  let lastCheck = 0; const follow = t => { if (t - lastCheck < 600) return; lastCheck = t; const s = sigOf(); if (s !== st.sig){ st.sig = s; refresh(false); } };

  // buttons
  const btn = k => root.querySelector(`button[data-k="${k}"]`);
  const sync = () => { btn('flood').classList.toggle('on', st.flood); btn('drain').classList.toggle('on', st.drain); btn('fixed').classList.toggle('on', st.fixed);
    btn('flood').hidden = !api.FR; btn('drain').hidden = !api.DR; btn('fixed').hidden = !snap.hasFixed && !snap.hasOutline;
    // v0.46: 3D buildings are always shown (no switch); the 'Model' group goes when nothing in it is left to set
    const mg = root.querySelector('.modelGrp'); if (mg) mg.hidden = ![...mg.querySelectorAll('.rows > *')].some(el => !el.hidden && getComputedStyle(el).display !== 'none'); };
  btn('flood').onclick = () => { st.flood = !st.flood; refresh(true); sync(); };
  btn('drain').onclick = () => { st.drain = !st.drain; refresh(true); sync(); };
  btn('fixed').onclick = () => { st.fixed = !st.fixed; sync(); };
  const rng = root.querySelector('input[type=range]'); rng.oninput = () => { st.exag = +rng.value; rng.nextElementSibling.textContent = rng.value; refresh(true); };
  if (!(terrain.hi > 0.5)) rng.parentElement.hidden = true;
  sync();

  function groundTexture(canvas){ const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t); gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, canvas); gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false); gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    const an = gl.getExtension('EXT_texture_filter_anisotropic'); if (an) gl.texParameterf(gl.TEXTURE_2D, an.TEXTURE_MAX_ANISOTROPY_EXT, Math.min(8, gl.getParameter(an.MAX_TEXTURE_MAX_ANISOTROPY_EXT)));
    return t; }
  function groundQuad(){ const x = api.groundHalf ? api.groundHalf[0] : terrain.cx, z = api.groundHalf ? api.groundHalf[1] : terrain.cy, vao = gl.createVertexArray(); gl.bindVertexArray(vao); const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-x, 0, z, 0, 0, x, 0, z, 1, 0, -x, 0, -z, 0, 1, x, 0, -z, 1, 1]), gl.STATIC_DRAW);
    const a = gl.getAttribLocation(tex.p, 'aPos'), u = gl.getAttribLocation(tex.p, 'aUV'); gl.enableVertexAttribArray(a); gl.vertexAttribPointer(a, 3, gl.FLOAT, false, 20, 0); gl.enableVertexAttribArray(u); gl.vertexAttribPointer(u, 2, gl.FLOAT, false, 20, 12); gl.bindVertexArray(null); return vao; }

  // ---- streaming tiles (api.stream): load near the focus, drop far ones, clip to a circle
  function tileQuad(q){ const [x0, y0, x1, y1] = q, vao = gl.createVertexArray(); gl.bindVertexArray(vao); const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([x0, 0, -y0, 0, 0, x1, 0, -y0, 1, 0, x0, 0, -y1, 0, 1, x1, 0, -y1, 1, 1]), gl.STATIC_DRAW);
    const a = gl.getAttribLocation(tex.p, 'aPos'), u = gl.getAttribLocation(tex.p, 'aUV'); gl.enableVertexAttribArray(a); gl.vertexAttribPointer(a, 3, gl.FLOAT, false, 20, 0); gl.enableVertexAttribArray(u); gl.vertexAttribPointer(u, 2, gl.FLOAT, false, 20, 12); gl.bindVertexArray(null); return { vao, b }; }
  function freeTile(T){   // also for a tile dropped half-built (waiting for its picture)
    if (T.tex){ gl.deleteTexture(T.tex); T.tex = null; } if (T.quad){ gl.deleteVertexArray(T.quad.vao); gl.deleteBuffer(T.quad.b); T.quad = null; }
    if (T.mesh){ gl.deleteVertexArray(T.mesh.vao); gl.deleteBuffer(T.mesh.vb); gl.deleteBuffer(T.mesh.ib); T.mesh = null; }
    if (T.treeMesh){ gl.deleteVertexArray(T.treeMesh.vao); gl.deleteBuffer(T.treeMesh.vb); gl.deleteBuffer(T.treeMesh.ib); T.treeMesh = null; } T.ready = false; }
  /** fx, fy: focus in plan metres; r: radius in metres */
  function updateTiles(t, fx, fy, r){
    clip = [fx, -fy, r];
    if (!api.stream || t - lastUpd < 250) return; lastUpd = t;
    // the zoom level follows how far you see; the previous level stays underneath until the new one is in
    // hysteresis: change level only well past the half-way mark, so resting near it does not flip back and forth
    let z = curZ;
    if (api.stream.zoomExact){ const zf = api.stream.zoomExact(r); if (!zSet || Math.abs(zf - curZ) > 0.75) z = Math.max(0, Math.min(14, Math.round(zf))); }
    else z = api.stream.zoomFor ? api.stream.zoomFor(r) : 14;
    curZ = z; zSet = true;
    const want = api.stream.near(fx, fy, r, z), keep = new Set(api.stream.near(fx, fy, r * 1.35 + 200, z));
    const allIn = want.every(k => tiles.get(k)?.ready);
    let freed = 0;
    for (const [k, T] of tiles){ const same = T.z === z;
      if ((same && !keep.has(k)) || (!same && (allIn || !T.ready || t - (T.left ||= t) > 25000))){ freeTile(T); tiles.delete(k); freed++; } else if (same) T.left = 0; }
    if (freed) status();
    let mine = 0; for (const T of tiles.values()) if (T.z === z) mine++;
    for (const k of want){ if (tiles.has(k)) continue; if (loadingN >= 8 || mine >= 40) break;   // v0.36: 8 downloads at once (was 4)
      const T = { ready: false, count: 0, z: api.stream.zOf ? api.stream.zOf(k) : 14 }; tiles.set(k, T); loadingN++; mine++; status();
      api.stream.load(k, () => tiles.get(k) === T).then(d => { loadingN--; if (tiles.get(k) !== T) return;
        T.quad = tileQuad(d.quad); T.mesh = d.count ? mesh(gl, prog, d.mesh) : null; T.count = d.count;
        T.treeData = d.trees && d.trees.count ? d.trees : null; T.cars = d.cars && d.cars.count ? d.cars.paths : null;   // built on the GPU only when their switch is on
        // with the app's look coming, wait a moment for it (no plain-then-styled flash); v0.36: after 1.2 s (was 10 s) the plain
        // paint shows and the app's picture replaces it when it arrives, so the table fills while the styled tiles catch up
        if (!d.upgrade){ T.tex = groundTexture(d.canvas); T.ready = true; status(); return; }
        let settled = false; stylingN++; status();
        const settle = cv => { if (settled) return; settled = true; stylingN--; if (tiles.get(k) !== T){ freeTile(T); status(); return; }
          T.tex = groundTexture(cv || d.canvas); T.styled = !!cv; T.ready = true; status(); };
        const late = setTimeout(() => settle(null), 1200);
        d.upgrade.then(cv => { clearTimeout(late); if (settled){ if (cv && tiles.get(k) === T){ gl.deleteTexture(T.tex); T.tex = groundTexture(cv); T.styled = true; status(); } return; } settle(cv); })
          .catch(e => { clearTimeout(late); console.warn('map style tile', e); settle(null); }); })
        .catch(e => { loadingN--; failN++; lastErr = String(e.message || e).slice(0, 80); console.warn(e); status();
          setTimeout(() => { if (tiles.get(k) === T) tiles.delete(k); }, 4000); }); }
  }
  // the plain disc under the tiles: a square just around the visible circle, rebuilt as the circle moves
  // (one huge fixed quad lost depth precision and showed through the map)
  const baseV = new Float32Array(4 * STRIDE), baseMesh = api.stream ? mesh(gl, prog, { v: baseV, i: new Uint32Array([0, 1, 2, 1, 3, 2]) }) : null;
  let baseKey = '';
  function updateBase(){ const [cx, cz, r] = clip, key = cx.toFixed(1) + ',' + cz.toFixed(1) + ',' + r.toFixed(1); if (key === baseKey) return; baseKey = key;
    const E = r * 1.05, c = [0.90, 0.89, 0.86]; let k = 0;
    for (const [x, z] of [[cx - E, cz + E], [cx + E, cz + E], [cx - E, cz - E], [cx + E, cz - E]]){ baseV.set([x, 0, z, 0, 0, 0, 1, 0, ...c, 0], k); k += STRIDE; }
    gl.bindBuffer(gl.ARRAY_BUFFER, baseMesh.vb); gl.bufferSubData(gl.ARRAY_BUFFER, 0, baseV); }
  function drawTiles(P, V, M){
    gl.useProgram(prog.p); gl.uniform1f(prog.u.uWidth, 0); gl.uniform1f(prog.u.uLift, 0); gl.uniform1f(prog.u.uExag, 1);
    updateBase(); gl.enable(gl.POLYGON_OFFSET_FILL); gl.polygonOffset(4, 8); gl.bindVertexArray(baseMesh.vao); gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_INT, 0); gl.disable(gl.POLYGON_OFFSET_FILL);
    gl.useProgram(tex.p); gl.uniformMatrix4fv(tex.u.uP, false, P); gl.uniformMatrix4fv(tex.u.uV, false, V); gl.uniformMatrix4fv(tex.u.uM, false, M); gl.uniform3fv(tex.u.uClip, clip);
    gl.activeTexture(gl.TEXTURE0); gl.uniform1i(tex.u.uT, 0);
    gl.enable(gl.POLYGON_OFFSET_FILL); gl.polygonOffset(2, 4);   // a level being replaced sits just under the new one
    for (const T of tiles.values()) if (T.ready && T.z !== curZ){ gl.bindTexture(gl.TEXTURE_2D, T.tex); gl.bindVertexArray(T.quad.vao); gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4); }
    gl.disable(gl.POLYGON_OFFSET_FILL);
    for (const T of tiles.values()) if (T.ready && T.z === curZ){ gl.bindTexture(gl.TEXTURE_2D, T.tex); gl.bindVertexArray(T.quad.vao); gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4); }
    // building shadows on the ground: the same meshes, flattened along the sun's direction, each pixel darkened once
    if (st.bld && env.shadow > 0){ const ly = Math.max(env.dir[1], 0.14);
      gl.useProgram(shProg.p); gl.uniformMatrix4fv(shProg.u.uP, false, P); gl.uniformMatrix4fv(shProg.u.uV, false, V); gl.uniformMatrix4fv(shProg.u.uM, false, M);
      gl.uniform3fv(shProg.u.uClip, clip); gl.uniform2f(shProg.u.uSh, env.dir[0] / ly, env.dir[2] / ly); gl.uniform1f(shProg.u.uA, env.shadow);
      gl.enable(gl.BLEND); gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ZERO, gl.ONE); gl.depthMask(false);
      gl.enable(gl.POLYGON_OFFSET_FILL); gl.polygonOffset(-2, -4); gl.enable(gl.STENCIL_TEST); gl.stencilFunc(gl.EQUAL, 0, 0xff); gl.stencilOp(gl.KEEP, gl.KEEP, gl.INCR);
      for (const T of tiles.values()) if (T.ready && T.mesh && T.z === curZ){ gl.bindVertexArray(T.mesh.vao); gl.drawElements(gl.TRIANGLES, T.mesh.n, gl.UNSIGNED_INT, 0); }
      gl.disable(gl.STENCIL_TEST); gl.disable(gl.POLYGON_OFFSET_FILL); gl.depthMask(true); gl.disable(gl.BLEND); }
    gl.useProgram(prog.p); gl.uniform1f(prog.u.uWidth, 0); gl.uniform1f(prog.u.uLift, 0); gl.uniform1f(prog.u.uExag, 1);
    gl.uniform3fv(prog.u.uTint, api.stream.painter?.building || [0.95, 0.94, 0.92]);
    if (st.bld) for (const T of tiles.values()) if (T.ready && T.mesh){ gl.bindVertexArray(T.mesh.vao); gl.drawElements(gl.TRIANGLES, T.mesh.n, gl.UNSIGNED_INT, 0); }
    // trees and vehicles are not in the app's style, so night and weather darken them here
    const k = 1 - 0.62 * env.night; gl.uniform3f(prog.u.uTint, k * (1 - 0.25 * env.night), k * (1 - 0.15 * env.night), k);
    if (env.trees) for (const T of tiles.values()) if (T.ready && T.treeData && T.z === curZ){
      if (!T.treeMesh) T.treeMesh = mesh(gl, prog, T.treeData);
      gl.bindVertexArray(T.treeMesh.vao); gl.drawElements(gl.TRIANGLES, T.treeMesh.n, gl.UNSIGNED_INT, 0); }
    if (env.cars){ const now = performance.now();
      if (now - carT > 12){ carT = now; const paths = []; for (const T of tiles.values()) if (T.ready && T.cars && T.z === curZ) paths.push(...T.cars);
        carN = writeCars(carBuf, paths, now / 1000, carScale); gl.bindBuffer(gl.ARRAY_BUFFER, carMesh.vb); gl.bufferSubData(gl.ARRAY_BUFFER, 0, carBuf, 0, carN * STRIDE); }
      if (carN){ gl.bindVertexArray(carMesh.vao); gl.drawElements(gl.TRIANGLES, carN / 4 * 6, gl.UNSIGNED_INT, 0); } }
    gl.uniform3fv(prog.u.uTint, [1, 1, 1]); gl.bindVertexArray(null); }
  // vehicles: one buffer rewritten every frame (24 vertices a box)
  const CAR_MAX = 700, carBuf = new Float32Array(CAR_MAX * 24 * STRIDE);
  const carMesh = mesh(gl, prog, { v: carBuf, i: (() => { const a = new Uint32Array(CAR_MAX * 36); for (let c = 0, k = 0; c < CAR_MAX * 6; c++){ const b = c * 4; a[k++] = b; a[k++] = b + 2; a[k++] = b + 1; a[k++] = b + 1; a[k++] = b + 2; a[k++] = b + 3; } return a; })() });
  let carT = 0, carN = 0, carScale = 1;
  // rain and snow: particles in a cylinder (centre c, radius rw, height hw, world space) that loop from top to bottom
  const PN = 1100, pSeed = new Float32Array(PN * 4); for (let i = 0; i < PN * 4; i++) pSeed[i] = Math.random();
  const pBuf = new Float32Array(PN * 6), pVao = gl.createVertexArray(), pVb = gl.createBuffer();
  gl.bindVertexArray(pVao); gl.bindBuffer(gl.ARRAY_BUFFER, pVb); gl.bufferData(gl.ARRAY_BUFFER, pBuf, gl.DYNAMIC_DRAW); gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 12, 0); gl.bindVertexArray(null);
  function drawWeather(P, V, c, rw, hw, vpH, yaw = 0){
    const rain = env.weather === 'rain', snow = env.weather === 'snow'; if (!rain && !snow) return;
    const t = performance.now() / 1000, fall = rain ? 2.6 : 0.22, len = hw * 0.07; let n = 0;
    for (let i = 0; i < PN; i++){ const a = pSeed[i * 4] * 6.2832, rr = Math.sqrt(pSeed[i * 4 + 1]) * rw, ph = (pSeed[i * 4 + 2] + t * fall * (0.7 + 0.6 * pSeed[i * 4 + 3])) % 1;
      let x = c[0] + Math.cos(a) * rr, z = c[2] + Math.sin(a) * rr; const y = c[1] + hw * (1 - ph);
      if (snow){ x += Math.sin(t * 0.9 + i) * rw * 0.02; z += Math.cos(t * 0.7 + i * 1.7) * rw * 0.02; pBuf[n++] = x; pBuf[n++] = y; pBuf[n++] = z; }
      else { pBuf[n++] = x; pBuf[n++] = y; pBuf[n++] = z; pBuf[n++] = x + len * 0.12; pBuf[n++] = y + len; pBuf[n++] = z; } }
    gl.useProgram(ptProg.p); gl.uniformMatrix4fv(ptProg.u.uP, false, P); gl.uniformMatrix4fv(ptProg.u.uV, false, V);
    gl.uniform1f(ptProg.u.uPt, rw * 0.011 * vpH * P[5] * 0.5); gl.uniform1f(ptProg.u.uRound, snow ? 1 : 0);
    const dim = 1 - 0.45 * env.night; gl.uniform4f(ptProg.u.uCol, (snow ? 1 : 0.78) * dim, (snow ? 1 : 0.84) * dim, (snow ? 1 : 0.94) * dim, snow ? 0.92 : 0.5);
    gl.bindVertexArray(pVao); gl.bindBuffer(gl.ARRAY_BUFFER, pVb); gl.bufferSubData(gl.ARRAY_BUFFER, 0, pBuf, 0, n);
    gl.enable(gl.BLEND); gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA); gl.depthMask(false);
    gl.drawArrays(snow ? gl.POINTS : gl.LINES, 0, n / 3);
    gl.depthMask(true); gl.disable(gl.BLEND); gl.bindVertexArray(null); }
  /** after the app's look changed: draw every loaded tile again */
  function repaintTiles(){ if (!api.stream?.repaint) return; let n = 0;
    for (const [k, T] of tiles) if (T.ready){ n++; T.styled = false; api.stream.repaint(k, () => tiles.get(k) === T).then(cv => { if (!cv || tiles.get(k) !== T) return; gl.deleteTexture(T.tex); T.tex = groundTexture(cv); T.styled = true; status(); }).catch(() => {}); }
    status(); return n; }

  // drawing, shared by the page and the headset
  const unit = 1 / terrain.size;   // the model is 1 unit across in the page preview
  function drawScene(P, V, M, o){
    gl.enable(gl.DEPTH_TEST); gl.disable(gl.BLEND); gl.disable(gl.CULL_FACE);
    setEnvUniforms();
    gl.useProgram(prog.p); gl.uniformMatrix4fv(prog.u.uP, false, P); gl.uniformMatrix4fv(prog.u.uV, false, V); gl.uniformMatrix4fv(prog.u.uM, false, M);
    gl.uniform1f(prog.u.uExag, o.exag); gl.uniform1f(prog.u.uAlpha, 1); gl.uniform3fv(prog.u.uClip, api.stream ? clip : sceneClip); gl.uniform3fv(prog.u.uTint, [1, 1, 1]);
    if (api.stream){ drawTiles(P, V, M); return; }
    gl.uniform1f(prog.u.uWidth, 0); gl.uniform1f(prog.u.uLift, 0);
    if (gTex){ gl.enable(gl.POLYGON_OFFSET_FILL); gl.polygonOffset(2, 4); }
    gl.bindVertexArray(tMesh.vao); gl.drawElements(gl.TRIANGLES, tMesh.n, gl.UNSIGNED_INT, 0); gl.disable(gl.POLYGON_OFFSET_FILL);
    if (xMesh && st.bld){ gl.bindVertexArray(xMesh.vao); gl.drawElements(gl.TRIANGLES, xMesh.n, gl.UNSIGNED_INT, 0); }
    if (gTex){ gl.useProgram(tex.p); gl.uniformMatrix4fv(tex.u.uP, false, P); gl.uniformMatrix4fv(tex.u.uV, false, V); gl.uniformMatrix4fv(tex.u.uM, false, M); gl.uniform3fv(tex.u.uClip, sceneClip);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, gTex); gl.uniform1i(tex.u.uT, 0); gl.bindVertexArray(gQuad); gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4); gl.useProgram(prog.p); }
    gl.uniform1f(prog.u.uWidth, o.width); gl.uniform1f(prog.u.uLift, o.lift);
    if (st.fixed && fMesh.n){ gl.bindVertexArray(fMesh.vao); gl.drawElements(gl.TRIANGLES, fMesh.n, gl.UNSIGNED_INT, 0); }
    if (rMesh.n){ gl.bindVertexArray(rMesh.vao); gl.drawElements(gl.TRIANGLES, rMesh.n, gl.UNSIGNED_INT, 0); }
    gl.bindVertexArray(null); }

  // ---- page preview: orbit camera; with the hall, a second camera stands in the gallery (metres, the table at the centre)
  const cam = { yaw: 0.55, pitch: 0.85, dist: api.stream ? 1.25 : 1.55, tx: 0, tz: 0 }; let drag = null, raf = 0, xrSession = null;
  if (hallOn){ try { hall = createHall(gl, { mapR: 1.3, lang }); } catch (e){ console.warn('hall', e); } }
  let hallSel = ['night', 'violet'].includes(opt.hall) ? opt.hall : 'auto';   // v0.37: no separate 'day' (following the light is already day by day)
  const hallMood = () => hallSel !== 'auto' ? hallSel : env.night > 0.5 ? 'night' : 'day';
  // v0.34 · a still model fills the hall's table: the disc spans its Greater London outline (or its smallest outline) with a margin,
  // cut round at the table's edge (the square plinth goes too); without outlines the whole square fits as before
  const fitR = (() => { const os = (api.outlines || []).filter(o => o.pts && o.pts.length > 2); if (!os.length) return terrain.size / Math.SQRT2;
    const r = o => Math.max(...o.pts.map(p => Math.hypot(p[0] - terrain.cx, p[1] - terrain.cy)));
    const gl_ = os.find(o => /greater london|大伦敦/i.test(o.label || '')) || os.slice().sort((a, b) => r(a) - r(b))[0];
    return Math.min(terrain.size / Math.SQRT2, r(gl_) * 1.15); })();
  let sceneClip = [0, 0, -1];   // model space: x, z, radius (−1 = none)
  const hcam = { yaw: 0, pitch: 0.36, dist: 4.4 }, deskR = 1.3,   // v0.48: a 2.6 m table (v0.44: 2 m) in a larger gallery
   deskS = () => api.stream ? 2 * deskR / terrain.size : deskR / fitR;
  const pv = hall ? 'hall' : 'map';   // v0.35: the preview is always the hall (the map-only switch is gone); 'map' only when the hall is off
  if (hall){ root.querySelector('.hallGrp').hidden = false;
    const moods = root.querySelector('.mood'), syncMood = () => moods.querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.mood === hallSel)); syncMood();
    moods.onclick = e => { const b = e.target.closest('button'); if (b){ hallSel = b.dataset.mood; syncMood(); } }; }
  cv.addEventListener('pointerdown', e => { drag = { x: e.clientX, y: e.clientY, b: e.button, c: { ...cam }, h: { ...hcam } }; cv.setPointerCapture(e.pointerId); });
  cv.addEventListener('pointermove', e => { if (!drag) return; const dx = (e.clientX - drag.x) / cv.clientWidth, dy = (e.clientY - drag.y) / cv.clientHeight;
    if (pv === 'hall'){ hcam.yaw = drag.h.yaw - dx * 4; hcam.pitch = Math.max(0.04, Math.min(0.45, drag.h.pitch + dy * 2)); return; }
    if (drag.b === 2 || e.shiftKey){ const r = rotY([-dx * cam.dist * 1.6, 0, -dy * cam.dist * 1.6], cam.yaw); cam.tx = drag.c.tx + r[0]; cam.tz = drag.c.tz + r[2]; }
    else { cam.yaw = drag.c.yaw - dx * 4; cam.pitch = Math.max(0.08, Math.min(1.52, drag.c.pitch + dy * 3)); } });
  cv.addEventListener('pointerup', () => { drag = null; }); cv.addEventListener('contextmenu', e => e.preventDefault());
  cv.addEventListener('wheel', e => { e.preventDefault(); if (pv === 'hall'){ hcam.dist = Math.max(1.8, Math.min(6, hcam.dist * Math.exp(e.deltaY * 0.001))); return; } cam.dist = Math.max(0.12, Math.min(api.stream ? 2e4 : 5, cam.dist * Math.exp(e.deltaY * 0.001))); }, { passive: false });
  function frame(t){ raf = requestAnimationFrame(frame); panelTick(t); if (xrSession) return; follow(t);
    const dpr = Math.min(2, devicePixelRatio || 1), w = Math.round(cv.clientWidth * dpr), h = Math.round(cv.clientHeight * dpr); if (cv.width !== w || cv.height !== h){ cv.width = w; cv.height = h; }
    env = envFn(); const sky = skyColour();
    if (pv === 'hall' && hall){ previewHall(t, w, h); return; }
    sceneClip = [0, 0, -1];
    gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0, 0, w, h); if (api.stream) gl.clearColor(sky[0], sky[1], sky[2], 1); else gl.clearColor(0.067, 0.067, 0.075, 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT | gl.STENCIL_BUFFER_BIT);
    const eye = [cam.tx + cam.dist * Math.cos(cam.pitch) * Math.sin(cam.yaw), cam.dist * Math.sin(cam.pitch), cam.tz + cam.dist * Math.cos(cam.pitch) * Math.cos(cam.yaw)];
    if (api.stream) updateTiles(t, cam.tx / unit, -cam.tz / unit, Math.max(400, Math.min(R_WORLD, cam.dist / unit * 0.55)));
    // haze thickens from the middle of the disc to its rim
    fogSet = api.stream ? { e: [clip[0], 0, clip[1]], r0: clip[2] * 0.3, r1: clip[2] * 1.05, a: env.haze, c: env.fog } : { e: [0, 0, 0], r0: 0, r1: 1, a: 0, c: env.fog };
    carScale = Math.max(1, clip[2] / 600);
    const Pm = M4.persp(0.7, w / h, Math.max(0.002, cam.dist * 0.01), cam.dist * 20 + 50), Vm = M4.look(eye, [cam.tx, 0, cam.tz]);
    drawScene(Pm, Vm, M4.trs([0, 0, 0], 0, unit), { exag: st.exag, width: 1.6, lift: 0.0025 / unit });
    if (api.stream){ const rw = clip[2] * unit; drawWeather(Pm, Vm, [cam.tx, 0, cam.tz], rw, rw * 0.8, h); } }
  // the gallery on the page: the hall, and the map on its table as it will be in VR
  function previewHall(t, w, h){
    const mood = hallMood(), c = hall.clearColour(mood), y0 = hall.tableTop, ms = deskS();
    gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0, 0, w, h); gl.clearColor(c[0], c[1], c[2], 1); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT | gl.STENCIL_BUFFER_BIT);
    const eye = [hcam.dist * Math.cos(hcam.pitch) * Math.sin(hcam.yaw), y0 + 0.25 + hcam.dist * Math.sin(hcam.pitch), hcam.dist * Math.cos(hcam.pitch) * Math.cos(hcam.yaw)];
    const Pm = M4.persp(0.95, w / h, 0.03, 60), Vm = M4.look(eye, [0, y0 + 0.05, 0]);
    if (api.stream) updateTiles(t, 0, 0, Math.max(300, Math.min(R_WORLD, deskR / ms)));
    fogSet = api.stream ? { e: [clip[0], 0, clip[1]], r0: clip[2] * 0.3, r1: clip[2] * 1.05, a: env.haze, c: env.fog } : { e: [0, 0, 0], r0: 0, r1: 1, a: 0, c: env.fog };
    carScale = Math.max(1, clip[2] / 600);
    hall.draw(Pm, Vm, M4.id(), mood);
    sceneClip = api.stream ? [0, 0, -1] : [0, 0, deskR / ms];
    drawScene(Pm, Vm, M4.trs([0, y0 + 0.004, 0], 0, ms), { exag: st.exag, width: 1.6, lift: Math.max(0.0015 / ms, 0.05) });
    if (api.stream) drawWeather(Pm, Vm, [0, y0, 0], deskR, deskR * 0.93, h); }
  // the sky behind the model: the app's sky colour, greyed by the weather
  function skyColour(){ const a = Math.min(1, env.haze * 1.3); return [0, 1, 2].map(k => (env.sky[k] * (1 - a) + env.fog[k] * a) * (env.weather === 'rain' ? 0.7 : 1)); }
  raf = requestAnimationFrame(frame);

  // ---- headset
  const xrBox = root.querySelector('.xrBtns');
  // one card per way in: a click starts the session at once (the browser needs that click on this page)
  const noxr = root.querySelector('.noxr');
  const showNoXR = () => { noxr.hidden = false; noxr.querySelector('.url').textContent = location.href;
    const cp = noxr.querySelector('.copy'); cp.onclick = () => navigator.clipboard?.writeText(location.href).then(() => { cp.textContent = L.copied; setTimeout(() => cp.textContent = L.copy, 1600); }).catch(() => {}); };
  (async () => {
    if (!window.isSecureContext){ note.textContent = L.https; }
    if (!navigator.xr){ showNoXR(); return; }
    let n = 0;
    // v0.38: with the hall, one way in (VR · Gallery); MR showed the same hall, so its card is gone. Without the hall MR stays (the model on your real table)
    for (const mode of hallOn ? ['immersive-vr'] : ['immersive-vr', 'immersive-ar']){
      let ok = false; try { ok = await navigator.xr.isSessionSupported(mode); } catch (e){ ok = false; }
      if (!ok) continue; n++;
      const vr = mode === 'immersive-vr', b = document.createElement('button'); b.type = 'button'; b.className = 'mode' + (vr ? ' primary' : '');
      b.innerHTML = `<span class="mh">${vr ? ic.vr : ic.ar}<b>${vr ? L.vrT : L.arT}</b>${vr && !hallOn ? `<span class="tag">${L.rec}</span>` : ''}</span><span class="md">${vr ? (hallOn ? L.vrD : L.vrDplain) : L.arD}</span><span class="go">${vr ? L.enterVR : L.enterAR}${ic.go}</span>`;
      b.onclick = () => startXR(mode); xrBox.append(b); }
    if (!n) showNoXR();
  })();

  function hudTexture(){ const c = document.createElement('canvas'); c.width = 1024; c.height = 470; const g = c.getContext('2d');
    g.fillStyle = 'rgba(28,28,30,0.86)'; const r = 40; g.beginPath(); g.roundRect ? g.roundRect(0, 0, 1024, 470, r) : g.rect(0, 0, 1024, 470); g.fill();
    g.fillStyle = '#f5f5f7'; g.font = '600 44px -apple-system,"PingFang SC",sans-serif'; g.fillText((opt.title || 'Tensor Studio') .split(' · ').slice(-2).join(' · ') + (snap.lines.length ? ' · ' + L.streets(snap.lines.length) : ''), 44, 76);
    g.font = '34px -apple-system,"PingFang SC",sans-serif'; g.fillStyle = 'rgba(235,235,245,0.78)'; (hallOn ? L.hud : L.hudPlain).map(s => xLabel ? s.replace('{x}', xLabel) : s.replace(/X \{x\} · /, '')).map(s => api.FR ? s : s.replace(/^A [^·]+ · /, '')).forEach((s, i) => g.fillText(s, 44, 140 + i * 52));
    if (api.stream){ g.fillStyle = streamInfo().failed ? '#ff9f8a' : '#8fd18a'; g.font = '30px -apple-system,"PingFang SC",sans-serif'; g.fillText(streamLine().slice(0, 52), 44, 438); }
    const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t); gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, c); gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE); return t; }
  function quad(){ const vao = gl.createVertexArray(); gl.bindVertexArray(vao); const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-0.5, -0.5, 0, 0, 0, 0.5, -0.5, 0, 1, 0, -0.5, 0.5, 0, 0, 1, 0.5, 0.5, 0, 1, 1]), gl.STATIC_DRAW);
    const a = gl.getAttribLocation(tex.p, 'aPos'), u = gl.getAttribLocation(tex.p, 'aUV'); gl.enableVertexAttribArray(a); gl.vertexAttribPointer(a, 3, gl.FLOAT, false, 20, 0); gl.enableVertexAttribArray(u); gl.vertexAttribPointer(u, 2, gl.FLOAT, false, 20, 12); gl.bindVertexArray(null); return vao; }
  const ray = mesh(gl, prog, { v: new Float32Array([0, 0, 0, 0, 0, 0, 1, 0, 1, 1, 1, 0, 0, 0, -0.6, 0, 0, 0, 1, 0, 1, 1, 1, 0]), i: new Uint32Array([0, 1]) });

  /** a small pointable button: idle (dark) and hot (blue) */
  function chipTexture(text){ const make = hot => { const c = document.createElement('canvas'); c.width = 400; c.height = 100; const g = c.getContext('2d');
      g.fillStyle = hot ? '#0a84ff' : 'rgba(28,28,30,0.9)'; g.beginPath(); g.roundRect ? g.roundRect(2, 2, 396, 96, 48) : g.rect(2, 2, 396, 96); g.fill();
      g.strokeStyle = 'rgba(255,255,255,0.35)'; g.lineWidth = 3; g.stroke();
      g.fillStyle = '#fff'; g.font = '600 46px -apple-system,"PingFang SC",sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, 200, 52);
      const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t); gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, c); gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE); return t; };
    return { idle: make(false), hot: make(true) }; }
  function pillTexture(){ const make = a => { const c = document.createElement('canvas'); c.width = 256; c.height = 48; const g = c.getContext('2d');
      g.fillStyle = `rgba(245,245,247,${a})`; g.beginPath(); g.roundRect ? g.roundRect(4, 8, 248, 32, 16) : g.rect(4, 8, 248, 32); g.fill();
      const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t); gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, c); gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE); return t; };
    return { idle: make(0.55), hot: make(0.98) }; }

  async function startXR(mode){
    let session; const AR = mode === 'immersive-ar';
    try { session = await navigator.xr.requestSession(mode, { requiredFeatures: ['local-floor'], optionalFeatures: ['hand-tracking'] }); }
    catch (e){ try { session = await navigator.xr.requestSession(mode, { optionalFeatures: ['local-floor', 'hand-tracking'] }); } catch (e2){ note.textContent = String(e2.message || e2); return; } }
    xrSession = session; await gl.makeXRCompatible();
    hallPose = null;   // a new session has a new floor origin
    if (hallOn && !hall){ try { hall = createHall(gl, { mapR: 1.3, lang }); } catch (e){ console.warn('hall', e); } }
    const H = hallOn ? hall : null; TR = H ? H.mapR : 0.45;   // this session's hall: in VR and, since v0.27, in MR too
    const hallShown = () => H && !st.walk && hallPose;
    // an emulator on a desktop shows the headset picture behind this page layer: make it see-through while immersive
    root.classList.add('immersive'); const exitB = document.createElement('button'); exitB.className = 'btn exit'; exitB.textContent = AR ? L.exitAR : L.exit;
    exitB.onclick = () => session.end().catch(() => {}); root.querySelector('.exitSlot').append(exitB);
    const xr = { frames: 0, views: 0, err: '', mode };
    session.updateRenderState({ baseLayer: new XRWebGLLayer(session, gl, { alpha: AR, antialias: true, stencil: true }), depthNear: 0.02, depthFar: 100 });
    const farFor = walk => session.updateRenderState({ depthNear: walk ? 0.1 : 0.02, depthFar: walk ? Math.min(150000, terrain.size * 1.5) : 100 });
    let ref; try { ref = await session.requestReferenceSpace('local-floor'); } catch (e){ ref = await session.requestReferenceSpace('local'); }
    // walking in the hall (v0.30): the left stick moves the hall, the map and anything placed in the room the other way, so you
    // walk through it (moving the world, not the reference space, works the same in every browser and emulator)
    const keys = new Set();
    const onKey = e => { if (!xrSession) return; const k = e.key.toLowerCase(); if (!['w', 'a', 's', 'd', 'q', 'e', 'r', 'f', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k)) return; e.type === 'keydown' ? keys.add(k) : keys.delete(k); e.preventDefault(); };
    addEventListener('keydown', onKey, true); addEventListener('keyup', onKey, true); session.addEventListener('end', () => { keys.clear(); removeEventListener('keydown', onKey, true); removeEventListener('keyup', onKey, true); });
    const keyAxes = () => [(keys.has('d') || keys.has('arrowright') ? 1 : 0) - (keys.has('a') || keys.has('arrowleft') ? 1 : 0), (keys.has('s') || keys.has('arrowdown') ? 1 : 0) - (keys.has('w') || keys.has('arrowup') ? 1 : 0)];
    const walkHall = (ax, ay, dt) => { const f = [headF[0], 0, headF[2]], l = Math.hypot(f[0], f[2]) || 1; f[0] /= l; f[2] /= l;
      const sp = 2.2 * dt,   // v0.44: a little quicker in the larger gallery (was 1.8 m/s)
       d = [(f[0] * -ay + -f[2] * ax) * sp, (f[2] * -ay + f[0] * ax) * sp];
      // stay between the table and the screens (hall space: undo the hall's turn about its centre)
      const c = hallPose.c, cs = Math.cos(hallPose.yaw), sn = Math.sin(hallPose.yaw), wx = head[0] + d[0] - c[0], wz = head[2] + d[1] - c[2];
      const lx = wx * cs - wz * sn, lz = wx * sn + wz * cs, r = Math.hypot(lx, lz) || 1e-6, [r0, r1] = H.walkR, rc = Math.max(r0, Math.min(r1, r)), k = rc / r;
      const tx = c[0] + (lx * k) * cs + (lz * k) * sn, tz = c[2] - (lx * k) * sn + (lz * k) * cs, mx = head[0] - tx, mz = head[2] - tz;
      const shift = p => { if (p){ p[0] += mx; p[2] += mz; } };
      shift(hallPose.c); hallPose.m = M4.trs(hallPose.c, hallPose.yaw, 1); shift(M.pos); shift(M.anchor);
      if (pm.mode === 'world') shift(pm.c); if (detail?.pose) shift(detail.pose.c); };
    // v0.49 · turning in the hall: the hall, the map and anything placed in the room turn about you (seated, or in an emulator);
    // standing, you can simply turn round. a > 0 turns you to the right
    const TURN_MAX = Math.PI / 2; let turnVel = 0, turnIn = 0;   // v0.50: up to 90°/s
    // v0.51 · looking up and down with the right stick: every pose the headset reports (the eyes and the controllers) is turned
    // about your eyes' left-right axis, so the hall tilts in view and pointing still lands where you see it
    const PITCH_MAX = Math.PI / 3, PITCH_RATE = Math.PI / 3; let pitch = 0, pitchVel = 0, pitchIn = 0, levelling = false;
    const rigidInv = m => { const o = new Float32Array(16); for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) o[c * 4 + r] = m[r * 4 + c];
      for (let r = 0; r < 3; r++) o[12 + r] = -(o[r] * m[12] + o[4 + r] * m[13] + o[8 + r] * m[14]); o[15] = 1; return o; };
    const pitched = frame => { if (!pitch) return frame;
      const raw = frame.getViewerPose(ref); if (!raw) return frame; const hm = raw.transform.matrix, h = [hm[12], hm[13], hm[14]];
      let ux = hm[0], uz = hm[2]; const ul = Math.hypot(ux, uz) || 1; ux /= ul; uz /= ul;   // the eyes' right, level
      const c = Math.cos(pitch), sn = Math.sin(pitch), t = 1 - c, R = [t * ux * ux + c, -sn * uz, t * ux * uz, sn * uz, c, -sn * ux, t * ux * uz, sn * ux, t * uz * uz + c];
      const W = M4.id(); W[0] = R[0]; W[1] = R[3]; W[2] = R[6]; W[4] = R[1]; W[5] = R[4]; W[6] = R[7]; W[8] = R[2]; W[9] = R[5]; W[10] = R[8];
      for (let k = 0; k < 3; k++) W[12 + k] = h[k] - (W[k] * h[0] + W[4 + k] * h[1] + W[8 + k] * h[2]);
      const tf = tr => { const m = M4.mul(W, tr.matrix || rigidInv(tr.inverse.matrix)); return { matrix: m, position: { x: m[12], y: m[13], z: m[14] }, inverse: { matrix: rigidInv(m) } }; };
      return { session: frame.session,
        getViewerPose: r => { const p = r === ref ? raw : frame.getViewerPose(r); return p && { transform: tf(p.transform), views: p.views.map(v => ({ __orig: v, eye: v.eye, projectionMatrix: v.projectionMatrix, transform: tf(v.transform) })) }; },
        getPose: (sp, r) => { const p = frame.getPose(sp, r); return p && { transform: tf(p.transform) }; } }; };
    window.__vrPitch = () => pitch;
    const turnHall = a => { const o = [head[0], 0, head[2]], rp = p => { if (!p) return; const r = rotY([p[0] - o[0], 0, p[2] - o[2]], a); p[0] = o[0] + r[0]; p[2] = o[2] + r[2]; };
      rp(hallPose.c); hallPose.yaw += a; hallPose.m = M4.trs(hallPose.c, hallPose.yaw, 1); rp(M.pos); rp(M.anchor); M.yaw += a;
      if (pm.mode === 'world') rp(pm.c); if (detail?.pose){ rp(detail.pose.c); detail.pose.x = rotY(detail.pose.x, a); detail.pose.z = rotY(detail.pose.z, a); }
      if (grabs.size) base = 'pending'; };
    window.__vrTurn = a => { if (hallPose) turnHall(a); return hallPose && { hall: hallPose.c.slice(), yaw: hallPose.yaw }; };
    window.__vrWalk = () => ({ hall: hallPose && hallPose.c.slice(), map: M.pos.slice() });   // for checking from the console / tests
    const tableScale = H ? (api.stream ? 2 * TR / terrain.size : TR / fitR) : 0.9 / terrain.size;   // 90 cm across on the table; in the hall the 2 m disc is filled
    const M = { pos: [0, 0.8, -0.7], yaw: 0, s: tableScale, placed: false };
    const grabs = new Map(); let base = null; const prevBtn = new Map(); let hud = hudTexture(), hudN = '', hudT = 0; const hq = quad();
    const chipTex = { show: chipTexture(lang === 'zh' ? '☰  面板' : '☰  Panel'), hide: chipTexture(lang === 'zh' ? '收起' : 'Hide') };
    let head = [0, 1.6, 0], headF = [0, 0, -1], hold = 0, Hs = null, Hg = null;
    const placeTable = (keep) => { const f = [headF[0], 0, headF[2]], l = Math.hypot(f[0], f[2]) || 1; f[0] /= l; f[2] /= l;
      M.s = tableScale;
      if (H){   // the hall is set once per session, its table just in front of you; the map goes back onto that table
        if (!hallPose){ const d = Math.max(H.standAt + 0.2, 2.9); /* v0.48: 2.9 m for the 2.6 m table (1.5 m from its edge). start a couple of steps back: room to walk up to the table */ hallPose = { c: [head[0] + f[0] * d, 0, head[2] + f[2] * d], yaw: yawOf(f[0], f[2]) }; hallPose.m = M4.trs(hallPose.c, hallPose.yaw, 1); }
        M.yaw = hallPose.yaw; M.pos = [hallPose.c[0], H.tableTop + 0.004, hallPose.c[2]]; }
      else { M.yaw = yawOf(f[0], f[2]); M.pos = [head[0] + f[0] * 0.75, Math.max(0.7, head[1] - 0.5), head[2] + f[2] * 0.75]; }
      M.anchor = M.pos.slice();
      if (api.stream && keep){ const r = rotY([keep[0] * M.s, 0, keep[1] * M.s], M.yaw); M.pos = [M.anchor[0] - r[0], M.pos[1], M.anchor[2] - r[2]]; }   // keep looking at the same place
      if (st.walk) farFor(false); st.walk = false; };
    const focusModel = at => { const d = rotY([at[0] - M.pos[0], 0, at[2] - M.pos[2]], -M.yaw); return [d[0] / M.s, d[2] / M.s]; };
    const placeWalk = () => {
      if (api.stream){ const fm = focusModel(M.anchor || head), r = rotY([fm[0], 0, fm[1]], M.yaw); M.s = 1; M.pos = [head[0] - r[0], 0, head[2] - r[2]]; st.walk = true; farFor(true); return; }
      const zc = heightSampler(snap.S).at(terrain.cx, terrain.cy); M.s = 1; M.pos = [head[0], -zc, head[2]]; st.walk = true; farFor(true); };
    const sources = () => [...grabs.keys()];
    const rebase = (frame) => { base = null; const ss = sources(); if (!ss.length) return; const P = ss.map(s => poseOf(frame, s)).filter(Boolean); if (P.length !== ss.length) return;
      if (P.length === 1) base = { one: true, h: P[0].p, hy: P[0].yaw, pos: M.pos.slice(), yaw: M.yaw, s: M.s };
      else { const a = P[0].p, b = P[1].p; base = { one: false, mid: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2], d: Math.hypot(a[0] - b[0], a[2] - b[2], a[1] - b[1]) || 1e-3, ang: yawOf(b[0] - a[0], b[2] - a[2]), pos: M.pos.slice(), yaw: M.yaw, s: M.s }; } };
    const poseOf = (frame, s) => { const sp = s.gripSpace || s.targetRaySpace; const p = sp && frame.getPose(sp, ref); if (!p) return null; const m = p.transform.matrix; return { p: [m[12], m[13], m[14]], yaw: yawOf(-m[8], -m[10]), m }; };
    const rayHit = new Map(), rayLen = new Map(), barHit = new Map();   // input source → panel item under its ray · distance to the panel · point on the drag bar
    const chipHit = new Map(); let chips = [];
    const screenHit = new Map(); let detail = null;   // the screen under each ray · the screen opened large in front of you   // the little 「面板」 / 「收起」 buttons: input source → the one under its ray
    hidePanel();   // each session starts with the panel put away
    // the panel: on the left hand, or placed anywhere in the room (drag its bar); pm.w = width in metres
    pm.grab = null;
    const add = (e, select) => { const src = e.inputSource;
      if (select && chipHit.has(src)){ chipHit.get(src).act(); return; }
      if (select && screenHit.has(src)){ const k = screenHit.get(src).k; detail = detail && detail.k === k ? null : { k, pose: null }; return; }
      if (select && detail && !rayLen.has(src)){ detail = null; return; }
      // drag the panel by its bar (trigger, grip or pinch), or by its face with the grip
      const g = barHit.get(src) || (!select && rayLen.has(src) && rayHit.has(src) ? src.__panelLocal : null);
      if (pm.mode !== 'off' && g){ pm.grab = { src, t0: g.t, lu: g.lx, lv: g.ly }; return; }
      if (select && pm.mode !== 'off' && rayHit.get(src) != null){ panel.press(rayHit.get(src)); return; }
      grabs.set(src, true); base = 'pending'; },
      rem = e => { if (pm.grab && pm.grab.src === e.inputSource){ pm.grab = null; return; } if (grabs.delete(e.inputSource)) base = 'pending'; };
    let panelPose = null, panelTex = null, panelVer = -1, barTex = null;
    session.addEventListener('selectstart', e => add(e, true)); session.addEventListener('squeezestart', e => add(e, false)); session.addEventListener('selectend', rem); session.addEventListener('squeezeend', rem);
    session.addEventListener('end', () => { xrSession = null; root.classList.remove('immersive'); exitB.remove(); status(); });
    const xrNote = () => { note.textContent = (lang === 'zh' ? `${mode === 'immersive-ar' ? 'MR' : 'VR'} 运行中 · 第 ${xr.frames} 帧 · ${xr.views} 个视图` : `${mode} · frame ${xr.frames} · ${xr.views} views`)
      + (api.stream ? ' · ' + streamLine() : '') + (xr.err ? (lang === 'zh' ? ' · 出错：' : ' · error: ') + xr.err : ''); };
    let tPrev = 0;
    const onFrame = (t, frame) => { session.requestAnimationFrame(onFrame);
      try { frameBody(t, pitched(frame)); xr.frames++; } catch (e){ if (!xr.err){ xr.err = String(e.message || e).slice(0, 120); console.error(e); } }
      if (xr.frames % 30 === 1 || xr.err) xrNote(); };
    const frameBody = (t, frame) => { const dt = Math.min(0.05, tPrev ? (t - tPrev) / 1000 : 0); tPrev = t; follow(t);
      const pose = frame.getViewerPose(ref); if (!pose){ xr.views = 0; return; } xr.views = pose.views.length; const hm = pose.transform.matrix; head = [hm[12], hm[13], hm[14]]; headF = [-hm[8], -hm[9], -hm[10]];
      if (!M.placed){ placeTable(); M.placed = true; }
      // buttons and sticks
      turnIn = 0; pitchIn = 0;
      for (const s of session.inputSources){ const gp = s.gamepad; if (!gp) continue; const key = s.handedness, was = prevBtn.get(key) || [], now = gp.buttons.map(b => b.pressed); prevBtn.set(key, now);
        const hit = k => now[k] && !was[k], ax = gp.axes[2] || gp.axes[0] || 0, ay = gp.axes[3] || gp.axes[1] || 0, dz = q => Math.abs(q) > 0.15 ? q : 0;
        if (pm.grab && s === pm.grab.src){   // while dragging the panel: stick up / down = further / nearer, left / right = smaller / bigger
          if (dz(ay)) pm.grab.t0 = Math.max(0.25, Math.min(4, pm.grab.t0 * Math.exp(-dz(ay) * dt * 1.6)));
          if (dz(ax)){ const w1 = Math.max(0.18, Math.min(1.4, pm.w * Math.exp(dz(ax) * dt * 1.2))); pm.grab.lu *= w1 / pm.w; pm.grab.lv *= w1 / pm.w; pm.w = w1; }
          continue; }
        if (key === 'right'){ if (hit(4)){ st.flood = !st.flood; refresh(true); sync(); } if (hit(5)){ if (st.walk) placeTable(api.stream ? focusModel(head) : null); else placeWalk(); grabs.clear(); base = null; }
          if (st.walk){ if (hit(2) || (Math.abs(ax) > 0.75 && !(prevBtn.get('rx') > 0.75))){ const a = (ax > 0 ? 1 : -1) * Math.PI / 6   /* v0.49: pushing right turns you right (was the other way) */, r = rotY([M.pos[0] - head[0], 0, M.pos[2] - head[2]], a); M.pos = [head[0] + r[0], M.pos[1], head[2] + r[2]]; M.yaw += a; } prevBtn.set('rx', Math.abs(ax)); }
          else if (hallShown() && !grabs.has(s)){   // in the hall the right stick turns you (v0.50) and looks up and down (v0.51); click: level again
            const tx = Math.abs(ax) >= Math.abs(ay) * 0.6 ? dz(ax) : 0, ty = Math.abs(ay) >= Math.abs(ax) * 0.6 ? dz(ay) : 0, curve = q => Math.sign(q) * Math.pow((Math.abs(q) - 0.15) / 0.85, 1.4);
            if (tx) turnIn += curve(tx);   // a light push turns slowly, full tilt about 90°/s
            if (ty){ pitchIn -= curve(ty); levelling = false; }   // stick forward (−1) looks up
            if (hit(3)) levelling = true; }
          else {   // turn and scale about the table centre (the anchor), so the place under it stays put; in the hall while holding the map
            const c = M.anchor || M.pos; if (grabs.has(s)) base = 'pending';
            if (dz(ax)){ const a = -dz(ax) * dt * 1.4, r = rotY([M.pos[0] - c[0], 0, M.pos[2] - c[2]], a); M.pos = [c[0] + r[0], M.pos[1], c[2] + r[2]]; M.yaw += a; }
            if (dz(ay)){ const k0 = Math.exp(-dz(ay) * dt * 1.2), s1 = Math.max(api.stream ? TR / R_WORLD : tableScale * 0.15, Math.min(tableScale * 40, M.s * k0)), k = s1 / M.s;
              M.pos = [c[0] + (M.pos[0] - c[0]) * k, M.pos[1], c[2] + (M.pos[2] - c[2]) * k]; M.s = s1; } } }
        // left stick click: show / hide the panel (it comes back where it was: on the hand, or where you placed it)
        if (key === 'left' && panel && hit(3)){ if (pm.mode === 'off') showPanel(); else hidePanel(); }
        if (key === 'left'){ if (hit(4)){ if (api.DR){ st.drain = !st.drain; refresh(true); } else if (!api.extra && !api.stream) st.fixed = !st.fixed; sync(); } if (hit(5)){ placeTable(api.stream ? focusModel(M.anchor) : null); grabs.clear(); base = null; }
          const moving = st.walk && (dz(ax) || dz(ay)); hold = moving ? hold + dt : 0;   // walk, then faster the longer the stick is held
          if (st.walk){ const f = [headF[0], 0, headF[2]], l = Math.hypot(f[0], f[2]) || 1, sp = Math.min(6 * (1 + hold * hold * 3), Math.max(6, terrain.size / 120)) * dt; M.pos[0] -= (f[0] / l * -dz(ay) + -f[2] / l * dz(ax)) * sp; M.pos[2] -= (f[2] / l * -dz(ay) + f[0] / l * dz(ax)) * sp; }
          else if (hallShown() && (dz(ax) || dz(ay))) walkHall(dz(ax), dz(ay), dt);   // in the hall the map stays on its table
          else if (!hallShown() && dz(ay)) M.pos[1] = Math.max(0.1, Math.min(2.2, M.pos[1] - dz(ay) * dt * 0.5)); } }
      if (keys.size && hallShown()){ const [kx, ky] = keyAxes(); if (kx || ky) walkHall(kx, ky, dt); turnIn += (keys.has('e') ? 1 : 0) - (keys.has('q') ? 1 : 0); const kp = (keys.has('r') ? 1 : 0) - (keys.has('f') ? 1 : 0); if (kp){ pitchIn += kp; levelling = false; } }   // Q / E: turn · R / F: look up / down
      // v0.50 · smooth turning: the turn speed eases towards the stick (or Q / E) over about 0.15 s, so it starts and stops softly
      if (hallShown()){ const tgt = Math.max(-1, Math.min(1, turnIn)) * TURN_MAX; turnVel += (tgt - turnVel) * Math.min(1, dt / 0.15);
        if (Math.abs(turnVel) > 0.002) turnHall(turnVel * dt); else turnVel = 0;
        // v0.51 · looking up and down: the same easing, up to 60° either way; clicking the stick levels the view again
        pitchVel += (Math.max(-1, Math.min(1, pitchIn)) * PITCH_RATE - pitchVel) * Math.min(1, dt / 0.15);
        if (levelling){ pitch += (0 - pitch) * Math.min(1, dt * 5); pitchVel = 0; if (Math.abs(pitch) < 0.003){ pitch = 0; levelling = false; } }
        else pitch = Math.max(-PITCH_MAX, Math.min(PITCH_MAX, pitch + pitchVel * dt)); }
      else { pitch = 0; pitchVel = 0; }
      // walk: keep the ground under your feet
      if (st.walk && !grabs.size){ const d = rotY([head[0] - M.pos[0], 0, head[2] - M.pos[2]], -M.yaw), x = d[0] / M.s + terrain.cx, y = -d[2] / M.s + terrain.cy;
        if (Hs !== snap.S){ Hs = snap.S; Hg = heightSampler(Hs); } M.pos[1] = -Hg.at(x, y) * M.s; }
      // grabbing
      if (base === 'pending') rebase(frame);
      if (base && base !== 'pending'){ const P = sources().map(s => poseOf(frame, s)).filter(Boolean);
        if (base.one && P.length === 1){ const d = P[0].yaw - base.hy, r = rotY([base.pos[0] - base.h[0], base.pos[1] - base.h[1], base.pos[2] - base.h[2]], d); M.pos = [P[0].p[0] + r[0], P[0].p[1] + r[1], P[0].p[2] + r[2]]; M.yaw = base.yaw + d; }
        else if (!base.one && P.length === 2){ const a = P[0].p, b = P[1].p, mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2], k = Math.max(0.05, Math.min(40, (Math.hypot(a[0] - b[0], a[2] - b[2], a[1] - b[1]) || 1e-3) / base.d)), d = yawOf(b[0] - a[0], b[2] - a[2]) - base.ang;
          const r = rotY([base.pos[0] - base.mid[0], base.pos[1] - base.mid[1], base.pos[2] - base.mid[2]], d); M.s = base.s * k; M.pos = [mid[0] + r[0] * k, mid[1] + r[1] * k, mid[2] + r[2] * k]; M.yaw = base.yaw + d; }
        // in the hall the map never leaves its table: a grab slides and turns the London map under the disc (a still model just turns)
        if (hallShown()){ M.pos[1] = H.tableTop + 0.004; if (!api.stream){ M.pos[0] = M.anchor[0]; M.pos[2] = M.anchor[2]; } } }
      // draw
      const layer = session.renderState.baseLayer; gl.bindFramebuffer(gl.FRAMEBUFFER, layer.framebuffer);
      env = envFn(); const sky = skyColour();
      if (hallShown()){ const c = H.clearColour(hallMood()); gl.clearColor(c[0], c[1], c[2], 1); } else if (AR && !st.walk) gl.clearColor(0, 0, 0, 0); else if (st.walk || api.stream) gl.clearColor(sky[0], sky[1], sky[2], 1); else gl.clearColor(0.07, 0.07, 0.08, 1);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT | gl.STENCIL_BUFFER_BIT);
      if (api.stream){ const at = st.walk ? head : M.anchor, d = rotY([at[0] - M.pos[0], 0, at[2] - M.pos[2]], -M.yaw);
        updateTiles(t, d[0] / M.s, -d[2] / M.s, st.walk ? 1500 : Math.max(300, Math.min(R_WORLD, TR / M.s))); }
      const Mm = M4.trs(M.pos, M.yaw, M.s), real = 1 / M.s;   // model metres per real metre
      const o = st.walk ? { exag: 1, width: 1, lift: 0.08 } : { exag: st.exag, width: Math.max(1, 1.6 * Math.min(1, tableScale / M.s * 2)), lift: Math.max(0.0015 * real, 0.05) };
      // haze: on the table it thickens towards the rim; walking, the far edge of what is loaded fades into the sky
      if (api.stream && st.walk){ const hm = focusModel(head), hz = env.haze;
        fogSet = { e: [hm[0], 1.6, hm[1]], r0: 150 * (1 - 0.7 * hz), r1: 1450, a: Math.max(0.92, hz), c: [0, 1, 2].map(k => env.horizon[k] * (1 - hz) + env.fog[k] * hz) }; carScale = 1; }
      else if (api.stream){ fogSet = { e: [clip[0], 0, clip[1]], r0: clip[2] * 0.3, r1: clip[2] * 1.05, a: env.haze, c: env.fog }; carScale = Math.max(1, clip[2] / 600); }
      else fogSet = { e: [0, 0, 0], r0: 0, r1: 1, a: 0, c: env.fog };
      // the app panel: above the left hand, turned to you; rays from the other hands point at it
      panelTick(t); panelPose = null; rayHit.clear(); rayLen.clear(); barHit.clear();
      const leftS = [...session.inputSources].find(s => s.handedness === 'left'), lpp = leftS && poseOf(frame, leftS);
      const facing = c => { const z = [head[0] - c[0], head[1] - c[1], head[2] - c[2]], zl = Math.hypot(...z) || 1; for (let k = 0; k < 3; k++) z[k] /= zl;
        const x = [z[2], 0, -z[0]], xl = Math.hypot(...x) || 1; for (let k = 0; k < 3; k++) x[k] /= xl; return { x, y: [z[1] * x[2] - z[2] * x[1], z[2] * x[0] - z[0] * x[2], z[0] * x[1] - z[1] * x[0]], z }; };
      const rayOf = s => { const rp = s.targetRaySpace && frame.getPose(s.targetRaySpace, ref); if (!rp) return null; const m = rp.transform.matrix; return { o: [m[12], m[13], m[14]], d: [-m[8], -m[9], -m[10]] }; };
      if (panel && pm.mode !== 'off'){
        const sx = pm.w, sy = sx * panel.aspect(); let c = null;
        if (pm.grab){ const r = rayOf(pm.grab.src);   // dragged: the grabbed point stays on the ray, the panel keeps facing you
          if (r){ const gp = [r.o[0] + r.d[0] * pm.grab.t0, r.o[1] + r.d[1] * pm.grab.t0, r.o[2] + r.d[2] * pm.grab.t0];
            c = pm.c || gp; for (let it = 0; it < 2; it++){ const B = facing(c); c = [0, 1, 2].map(k => gp[k] - B.x[k] * pm.grab.lu - B.y[k] * pm.grab.lv); }
            pm.mode = 'world'; pm.c = c; } }
        if (!c) c = pm.mode === 'world' && pm.c ? pm.c : lpp ? [lpp.p[0], lpp.p[1] + 0.06 + sy / 2, lpp.p[2]] : null;
        if (c){ const { x, y, z } = facing(c), barY = -(sy / 2 + 0.035);
          panelPose = { c, x, y, z, sx, sy, barY };
          let hov = null;
          for (const s of session.inputSources){ if ((pm.mode === 'hand' && s === leftS) || !s.targetRaySpace) continue; const r = rayOf(s); if (!r) continue;
            const den = r.d[0] * z[0] + r.d[1] * z[1] + r.d[2] * z[2]; if (Math.abs(den) < 1e-4) continue;
            const tt = ((c[0] - r.o[0]) * z[0] + (c[1] - r.o[1]) * z[1] + (c[2] - r.o[2]) * z[2]) / den; if (tt <= 0 || tt > 6) continue;
            const q = [r.o[0] + r.d[0] * tt - c[0], r.o[1] + r.d[1] * tt - c[1], r.o[2] + r.d[2] * tt - c[2]], lx = q[0] * x[0] + q[1] * x[1] + q[2] * x[2], ly = q[0] * y[0] + q[1] * y[1] + q[2] * y[2];
            if (Math.abs(lx) <= 0.08 && Math.abs(ly - barY) <= 0.022){ barHit.set(s, { t: tt, lx, ly }); rayLen.set(s, tt); continue; }   // the drag bar
            if (Math.abs(lx) > sx / 2 || Math.abs(ly) > sy / 2) continue;
            const i = panel.hitAt(lx / sx + 0.5, 0.5 - ly / sy); rayLen.set(s, tt); s.__panelLocal = { t: tt, lx, ly };
            if (i != null){ rayHit.set(s, i); hov = i; } else rayHit.set(s, null); }
          panel.setHover(hov);
          if (panel.version !== panelVer){ panelVer = panel.version; if (!panelTex) panelTex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, panelTex); gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, panel.canvas); gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false); gl.generateMipmap(gl.TEXTURE_2D);   // sharper from a distance
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
            const an = gl.getExtension('EXT_texture_filter_anisotropic'); if (an) gl.texParameterf(gl.TEXTURE_2D, an.TEXTURE_MAX_ANISOTROPY_EXT, Math.min(8, gl.getParameter(an.MAX_TEXTURE_MAX_ANISOTROPY_EXT))); }
          if (!barTex) barTex = pillTexture(); } }
      // the chips: 「面板」 under the help card while the panel is away, 「收起」 beside the panel's drag bar
      chips = []; chipHit.clear();
      if (panel && !pm.grab){
        if (pm.mode === 'off' && lpp){ const c = [lpp.p[0], lpp.p[1] + 0.058, lpp.p[2]]; chips.push({ c, ...facing(c), w: 0.11, h: 0.0275, tex: chipTex.show, onHand: true, act: showPanel }); }
        else if (panelPose){ const { c, x, y, barY } = panelPose, k = 0.13 / 2 + 0.05, cc = [0, 1, 2].map(j => c[j] + y[j] * barY + x[j] * k); chips.push({ c: cc, ...facing(cc), w: 0.07, h: 0.0175, tex: chipTex.hide, onHand: pm.mode === 'hand', act: hidePanel }); }
        for (const ch of chips) for (const s of session.inputSources){ if ((ch.onHand && s === leftS) || !s.targetRaySpace) continue; const r = rayOf(s); if (!r) continue;
          const { c, x, y, z } = ch, den = r.d[0] * z[0] + r.d[1] * z[1] + r.d[2] * z[2]; if (Math.abs(den) < 1e-4) continue;
          const tt = ((c[0] - r.o[0]) * z[0] + (c[1] - r.o[1]) * z[1] + (c[2] - r.o[2]) * z[2]) / den; if (tt <= 0 || tt > 6) continue;
          const q = [0, 1, 2].map(j => r.o[j] + r.d[j] * tt - c[j]), lx = q[0] * x[0] + q[1] * x[1] + q[2] * x[2], ly = q[0] * y[0] + q[1] * y[1] + q[2] * y[2];
          if (Math.abs(lx) <= ch.w / 2 && Math.abs(ly) <= ch.h / 2 * 1.4){ chipHit.set(s, ch); ch.hot = true; rayLen.set(s, tt); rayHit.delete(s); barHit.delete(s); } } }
      // the hall's screens: rays that meet nothing else may point at one (hall space: undo the hall's turn)
      screenHit.clear(); let hotK = null;
      if (hallShown()){ const c = hallPose.c, cs = Math.cos(hallPose.yaw), sn = Math.sin(hallPose.yaw), toL = v => [v[0] * cs - v[2] * sn, v[1], v[0] * sn + v[2] * cs];
        for (const s of session.inputSources){ if (rayLen.has(s) || !s.targetRaySpace || (pm.mode === 'hand' && s === leftS)) continue; const r = rayOf(s); if (!r) continue;
          const o = toL([r.o[0] - c[0], r.o[1] - c[1], r.o[2] - c[2]]), dl = toL(r.d); let best = null;
          for (const sc of H.screens){ const den = dl[0] * sc.n[0] + dl[2] * sc.n[2]; if (den > -1e-4) continue;
            const tt = ((sc.c[0] - o[0]) * sc.n[0] + (sc.c[2] - o[2]) * sc.n[2]) / den; if (tt <= 0 || tt > 12 || (best && tt > best.t)) continue;
            const q = [o[0] + dl[0] * tt - sc.c[0], o[1] + dl[1] * tt - sc.c[1], o[2] + dl[2] * tt - sc.c[2]];
            if (Math.abs(q[0] * sc.u[0] + q[2] * sc.u[2]) <= sc.w / 2 && Math.abs(q[1]) <= sc.h / 2) best = { t: tt, k: sc.k }; }
          if (best){ screenHit.set(s, best); rayLen.set(s, best.t); hotK = best.k; } }
        // the opened screen: 1.2 m in front of you, at eye height, turned to you
        if (detail && !detail.pose){ const f = [headF[0], 0, headF[2]], l = Math.hypot(f[0], f[2]) || 1, pc = [head[0] + f[0] / l * 1.2, head[1] - 0.08, head[2] + f[2] / l * 1.2]; detail.pose = { c: pc, ...facing(pc) }; } }
      else detail = null;
      H?.setHot(hotK);
      const hudKey = snap.lines.length + (api.stream ? '|' + streamLine() : '');
      if (hudKey !== hudN && t - hudT > 500){ hudN = hudKey; hudT = t; gl.deleteTexture(hud); hud = hudTexture(); }
      for (const view of pose.views){ const vp = layer.getViewport(view.__orig || view); gl.viewport(vp.x, vp.y, vp.width, vp.height); const P = view.projectionMatrix, V = view.transform.inverse.matrix;
        if (hallShown()) H.draw(P, V, hallPose.m, hallMood());
        sceneClip = hallShown() && !api.stream ? [0, 0, TR / M.s] : [0, 0, -1];   // the table's edge, whatever the zoom
        drawScene(P, V, Mm, o);
        if (api.stream){ if (st.walk) drawWeather(P, V, [head[0], 0, head[2]], 14, 16, vp.height); else if (M.anchor) drawWeather(P, V, [M.anchor[0], M.pos[1], M.anchor[2]], TR, TR * 0.93, vp.height); }
        // controller rays
        noFog(prog); noFog(tex); gl.useProgram(prog.p); gl.uniform3fv(prog.u.uClip, [0, 0, -1]); gl.uniform3fv(prog.u.uTint, [1, 1, 1]); gl.uniform1f(prog.u.uExag, 1); gl.uniform1f(prog.u.uWidth, 0); gl.uniform1f(prog.u.uLift, 0);
        for (const s of session.inputSources){ if (!s.targetRaySpace) continue; const rp = frame.getPose(s.targetRaySpace, ref); if (!rp) continue;
          const len = rayLen.has(s) ? rayLen.get(s) / 0.6 : 1, sc = M4.id(); sc[10] = len;   // a ray that meets the panel ends on it
          gl.uniformMatrix4fv(prog.u.uM, false, M4.mul(rp.transform.matrix, sc)); gl.bindVertexArray(ray.vao); gl.drawElements(gl.LINES, 2, gl.UNSIGNED_INT, 0); }
        // help card above the left hand, turned to face you
        const left = [...session.inputSources].find(s => s.handedness === 'left'), lp = left && poseOf(frame, left);
        if (panelPose && panelTex){ const { c, x, y, z, sx, sy, barY } = panelPose;
          gl.useProgram(tex.p); gl.uniform3fv(tex.u.uClip, [0, 0, -1]); gl.uniformMatrix4fv(tex.u.uP, false, P); gl.uniformMatrix4fv(tex.u.uV, false, V); gl.uniformMatrix4fv(tex.u.uM, false, M4.basis(x, y, z, c, [sx, sy]));
          gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA); gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, panelTex); gl.uniform1i(tex.u.uT, 0);
          gl.bindVertexArray(hq); gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
          // the drag bar under it, brighter while pointed at or held
          const hot = pm.grab || barHit.size, bc = [c[0] + y[0] * barY, c[1] + y[1] * barY, c[2] + y[2] * barY], bw = hot ? 0.15 : 0.13;
          gl.uniformMatrix4fv(tex.u.uM, false, M4.basis(x, y, z, bc, [bw, bw * 48 / 256])); gl.bindTexture(gl.TEXTURE_2D, hot ? barTex.hot : barTex.idle); gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
          gl.disable(gl.BLEND); }
        else if (lp && (xr.frames < 900 || lp.p[1] > head[1] - 0.05)){ const p = [lp.p[0], lp.p[1] + 0.13, lp.p[2]],   // v0.49: the help card for the first ~10 s, then when you raise your left hand
           z = [head[0] - p[0], head[1] - p[1], head[2] - p[2]], zl = Math.hypot(...z) || 1; for (let k = 0; k < 3; k++) z[k] /= zl;
          const x = [z[2], 0, -z[0]], xl = Math.hypot(...x) || 1; for (let k = 0; k < 3; k++) x[k] /= xl; const y = [z[1] * x[2] - z[2] * x[1], z[2] * x[0] - z[0] * x[2], z[0] * x[1] - z[1] * x[0]];
          gl.useProgram(tex.p); gl.uniform3fv(tex.u.uClip, [0, 0, -1]); gl.uniformMatrix4fv(tex.u.uP, false, P); gl.uniformMatrix4fv(tex.u.uV, false, V); gl.uniformMatrix4fv(tex.u.uM, false, M4.basis(x, y, z, p, [0.22, 0.101]));
          gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA); gl.disable(gl.CULL_FACE); gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, hud); gl.uniform1i(tex.u.uT, 0);
          gl.bindVertexArray(hq); gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4); gl.disable(gl.BLEND); }
        if (detail && detail.pose){ const { c, x, y, z } = detail.pose;
          gl.useProgram(tex.p); gl.uniform3fv(tex.u.uClip, [0, 0, -1]); gl.uniformMatrix4fv(tex.u.uP, false, P); gl.uniformMatrix4fv(tex.u.uV, false, V); gl.uniformMatrix4fv(tex.u.uM, false, M4.basis(x, y, z, c, [1.4, 0.8]));
          gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, H.boardTexture(detail.k)); gl.uniform1i(tex.u.uT, 0); gl.bindVertexArray(hq); gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4); }
        if (chips.length){ gl.useProgram(tex.p); gl.uniform3fv(tex.u.uClip, [0, 0, -1]); gl.uniformMatrix4fv(tex.u.uP, false, P); gl.uniformMatrix4fv(tex.u.uV, false, V);
          gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA); gl.activeTexture(gl.TEXTURE0); gl.uniform1i(tex.u.uT, 0); gl.bindVertexArray(hq);
          for (const ch of chips){ const sc = ch.hot ? 1.08 : 1; gl.uniformMatrix4fv(tex.u.uM, false, M4.basis(ch.x, ch.y, ch.z, ch.c, [ch.w * sc, ch.h * sc])); gl.bindTexture(gl.TEXTURE_2D, ch.hot ? ch.tex.hot : ch.tex.idle); gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4); }
          gl.disable(gl.BLEND); }
        gl.bindVertexArray(null); } };
    session.requestAnimationFrame(onFrame);
  }

  const close = () => { cancelAnimationFrame(raf); if (xrSession) xrSession.end().catch(() => {}); hall?.dispose(); hall = null; root.remove(); OPEN = null; for (const T of tiles.values()) freeTile(T); tiles.clear(); opt.onClose?.({ focus: api.stream && clip[2] > 0 ? [clip[0], -clip[1]] : null }); };
  if (btn('close')) btn('close').onclick = close; addEventListener('keydown', function esc(e){ if (e.key === 'Escape' && OPEN){ close(); removeEventListener('keydown', esc); } });
  OPEN = { close, state: st, refresh, repaintTiles };
  return OPEN;
}
