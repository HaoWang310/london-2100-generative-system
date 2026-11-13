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

const T = {
  zh: { title: '三维 · VR / MR', enterAR: '进入 MR（透视，放在桌上）', enterVR: '进入 VR', noXR: '这台设备的浏览器不支持 WebXR。请在 Meta Quest 浏览器中打开本页。', close: '关闭', flood: '洪水风险', existing: '现有街道', exag: '高程放大', walk: '1:1 漫游',
    hint: '拖动旋转 · 滚轮缩放 · 右键平移', streets: n => n + ' 条道路', grow: '道路还在生长：等它结束或按「显示结果」，三维会自动更新。', https: 'WebXR 需要 HTTPS（GitHub Pages 可以）。',
    hud: ['握持键 / 捏合：抓取模型', '双手：缩放与旋转', '右摇杆：旋转 · 缩放', 'A 洪水风险 · B 桌面 ↔ 1:1 漫游', 'X 现有街道 · Y 放回面前'] },
  en: { title: '3D · VR / MR', enterAR: 'Enter MR (passthrough, on your table)', enterVR: 'Enter VR', noXR: 'This browser has no WebXR. Open this page in the Meta Quest browser.', close: 'Close', flood: 'Flood risk', existing: 'Existing streets', exag: 'Height ×', walk: 'Walk 1:1',
    hint: 'drag to turn · wheel to zoom · right-drag to pan', streets: n => n + ' streets', grow: 'Streets are still growing: wait or press "Show result"; the 3D view follows.', https: 'WebXR needs HTTPS (GitHub Pages is fine).',
    hud: ['Grip / pinch: grab the model', 'Both hands: scale and turn', 'Right stick: turn · scale', 'A flood risk · B table ↔ walk 1:1', 'X existing streets · Y bring it back'] }
};

// ---------------------------------------------------------------- geometry (pure, testable in node)
const FLOODC = [null, [156, 221, 234], [247, 211, 89], [242, 157, 56], [215, 55, 49]], FLOODA = [0, 0.22, 0.42, 0.62, 0.78];
const LAND = [0.925, 0.918, 0.898], OFF = [0.30, 0.34, 0.37], PLINTH = [0.16, 0.16, 0.17];
const ROADC = { 1: [0.10, 0.10, 0.11], 2: [0.36, 0.36, 0.39], fixed: [0.62, 0.62, 0.64], bridge: [0.04, 0.52, 1.0] };
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
  const { nx, ny, cell } = S, H = heightSampler(S), step = Math.max(1, Math.ceil(Math.max(nx, ny) / (opt.res || 220)));
  const cx = (nx - 1) * cell / 2, cy = (ny - 1) * cell / 2, gx = Math.floor((nx - 1) / step) + 1, gy = Math.floor((ny - 1) / step) + 1;
  const exag = opt.exag || 3, depth = opt.depth || 60, flood = opt.flood && S.flood;
  const v = [], idx = [];
  const colAt = (c, r) => { const i = r * nx + c, land = !S.mask || S.mask[i]; let col = land ? LAND.slice() : OFF.slice();
    if (land && S.Z && H.hi > H.lo){ const t = (S.Z[i] - H.lo) / (H.hi - H.lo); for (let k = 0; k < 3; k++) col[k] *= 0.9 + 0.1 * t; }
    if (flood){ const f = S.flood[i]; if (f){ const a = FLOODA[f] * (land ? 1 : 0.5); for (let k = 0; k < 3; k++) col[k] = col[k] * (1 - a) + FLOODC[f][k] / 255 * a; } }
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
  return { v: new Float32Array(v), i: new Uint32Array(idx), size: Math.max(nx, ny) * cell, cx, cy, hi: H.hi - H.lo };
}

/** Streets as flat ribbons draped on the terrain. lines: [{ pts:[[x,y]…], w:[m…] | number, kind:1|2|'fixed'|'bridge' }] */
export function buildRibbons(S, lines, terrain){
  const H = heightSampler(S), v = [], idx = [], { cx, cy } = terrain;
  for (const l of lines){ const P = l.pts; if (!P || P.length < 2) continue; const col = ROADC[l.kind] || ROADC[2], kind = l.kind === 'fixed' ? 0.6 : l.kind === 'bridge' ? 1.4 : 1, o = v.length / STRIDE;
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
  const D = api.D, S = { nx: api.nx, ny: api.ny, cell: api.cell, Z: api.ENV ? api.ENV.Z : null, mask: D.landMask || null, flood: api.FR || null };
  const lines = [];
  try { for (const st of api.streets()) lines.push({ pts: st.pts, w: st.w, kind: st.level === 1 ? 1 : 2 }); }
  catch (e){ for (const l of api.lines()) if (!l.dead && l.level > 0) lines.push({ pts: l.pts, w: l.level === 1 ? 14 : 8, kind: l.level === 1 ? 1 : 2 }); }
  const fixed = (D.fixed?.streets || []).map(pts => ({ pts, w: 6, kind: 'fixed' }));
  const bridges = (D.fixed?.bridges || []).map(pts => ({ pts, w: 10, kind: 'bridge' }));
  return { S, lines, fixed, bridges };
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
const yawOf = (fx, fz) => Math.atan2(-fx, -fz);   // the yaw that turns (0,0,-1) onto (fx, ·, fz)
const rotY = (v, a) => { const c = Math.cos(a), s = Math.sin(a); return [v[0] * c + v[2] * s, v[1], -v[0] * s + v[2] * c]; };

// ---------------------------------------------------------------- renderer
const VS = `#version 300 es
in vec3 aPos; in vec2 aSide; in vec3 aNor; in vec3 aCol; in float aKind;
uniform mat4 uP, uV, uM; uniform float uExag, uWidth, uLift;
out vec3 vCol; out vec3 vN;
void main(){ vec3 p = aPos; p.y = p.y * uExag + aKind * uLift; p.xz += aSide * uWidth;
  gl_Position = uP * uV * uM * vec4(p, 1.0); vN = mat3(uM) * aNor; vCol = aCol; }`;
const FS = `#version 300 es
precision mediump float; in vec3 vCol; in vec3 vN; uniform float uAlpha; out vec4 o;
void main(){ vec3 n = normalize(vN); float l = 0.58 + 0.42 * max(dot(n, normalize(vec3(-0.45, 0.85, 0.35))), 0.0); o = vec4(vCol * l, uAlpha); }`;
const VT = `#version 300 es
in vec3 aPos; in vec2 aUV; uniform mat4 uP, uV, uM; out vec2 vUV; void main(){ vUV = aUV; gl_Position = uP * uV * uM * vec4(aPos, 1.0); }`;
const FT = `#version 300 es
precision mediump float; in vec2 vUV; uniform sampler2D uT; out vec4 o; void main(){ o = texture(uT, vUV); if (o.a < 0.02) discard; }`;

function program(gl, vs, fs){ const p = gl.createProgram();
  for (const [t, s] of [[gl.VERTEX_SHADER, vs], [gl.FRAGMENT_SHADER, fs]]){ const sh = gl.createShader(t); gl.shaderSource(sh, s); gl.compileShader(sh); if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(sh)); gl.attachShader(p, sh); }
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
  const css = `#tsXR{position:fixed;inset:0;z-index:9999;background:#111113;color:#f5f5f7;font:13px/1.4 -apple-system,BlinkMacSystemFont,'SF Pro Text','PingFang SC','Helvetica Neue',sans-serif}
#tsXR canvas{position:absolute;inset:0;width:100%;height:100%;touch-action:none}
#tsXR .bar{position:absolute;left:16px;top:16px;right:16px;display:flex;gap:8px;align-items:center;flex-wrap:wrap;pointer-events:none}
#tsXR .bar>*{pointer-events:auto}
#tsXR h3{margin:0 8px 0 0;font-size:15px;font-weight:600;letter-spacing:-.01em}
#tsXR button{font:inherit;border:1px solid rgba(255,255,255,.16);background:rgba(44,44,46,.82);color:#f5f5f7;border-radius:999px;padding:7px 14px;cursor:pointer;backdrop-filter:blur(18px)}
#tsXR button:hover{background:rgba(72,72,74,.9)}#tsXR button.on{background:#f5f5f7;color:#121214;border-color:#f5f5f7}
#tsXR button.go{background:#0a84ff;border-color:#0a84ff;font-weight:600}#tsXR button.go:hover{background:#409cff}
#tsXR .sp{flex:1}#tsXR .note{position:absolute;left:16px;bottom:14px;right:16px;color:rgba(235,235,245,.6);font-size:12px;pointer-events:none}
#tsXR label{display:flex;gap:6px;align-items:center;background:rgba(44,44,46,.82);border:1px solid rgba(255,255,255,.16);border-radius:999px;padding:5px 12px}
#tsXR input[type=range]{width:90px;accent-color:#f5f5f7}`;
  const root = document.createElement('div'); root.id = 'tsXR';
  root.innerHTML = `<style>${css}</style><canvas></canvas><div class="bar"><h3>${opt.title || L.title}</h3><span class="xrBtns"></span>
<button data-k="flood">${L.flood}</button><button data-k="fixed" class="on">${L.existing}</button><label>${L.exag} <input type="range" min="1" max="8" step="0.5" value="3"><b>3</b></label>
<span class="sp"></span>${opt.standalone ? '' : `<button data-k="close">${L.close} ✕</button>`}</div><div class="note"></div>`;
  document.body.append(root);
  const cv = root.querySelector('canvas'), note = root.querySelector('.note');
  const gl = cv.getContext('webgl2', { antialias: true, alpha: true, xrCompatible: true });
  if (!gl){ note.textContent = 'WebGL2 is not available.'; return null; }
  const prog = program(gl, VS, FS), tex = program(gl, VT, FT);

  // state
  const st = { flood: !!api.FR && api.floodShown?.() !== false, fixed: true, exag: 3, walk: false, sig: '', terrain: null };
  let snap = snapshot(api), terrain = buildTerrain(snap.S, { exag: st.exag, flood: st.flood });
  const tMesh = mesh(gl, prog, terrain), rMesh = mesh(gl, prog, buildRibbons(snap.S, snap.lines, terrain)), fMesh = mesh(gl, prog, buildRibbons(snap.S, snap.fixed.concat(snap.bridges), terrain));
  const status = () => { const n = snap.lines.length; note.textContent = L.streets(n) + ' · ' + L.hint + (api.finished() ? '' : ' · ' + L.grow); };
  const sigOf = () => { let dead = 0, pts = 0; for (const l of api.lines()){ if (l.dead) dead++; else pts += l.pts.length; } return api.lines().length + ':' + dead + ':' + pts + ':' + api.finished(); };
  st.sig = sigOf(); status();
  const refresh = (all) => { snap = snapshot(api); if (all){ terrain = buildTerrain(snap.S, { exag: st.exag, flood: st.flood }); tMesh.set(terrain); fMesh.set(buildRibbons(snap.S, snap.fixed.concat(snap.bridges), terrain)); } rMesh.set(buildRibbons(snap.S, snap.lines, terrain)); status(); };
  let lastCheck = 0; const follow = t => { if (t - lastCheck < 600) return; lastCheck = t; const s = sigOf(); if (s !== st.sig){ st.sig = s; refresh(false); } };

  // buttons
  const btn = k => root.querySelector(`button[data-k="${k}"]`);
  const sync = () => { btn('flood').classList.toggle('on', st.flood); btn('fixed').classList.toggle('on', st.fixed); btn('flood').hidden = !api.FR; };
  btn('flood').onclick = () => { st.flood = !st.flood; refresh(true); sync(); };
  btn('fixed').onclick = () => { st.fixed = !st.fixed; sync(); };
  const rng = root.querySelector('input[type=range]'); rng.oninput = () => { st.exag = +rng.value; rng.nextElementSibling.textContent = rng.value; refresh(true); };
  if (!(terrain.hi > 0.5)) rng.parentElement.hidden = true;
  sync();

  // drawing, shared by the page and the headset
  const unit = 1 / terrain.size;   // the model is 1 unit across in the page preview
  function drawScene(P, V, M, o){
    gl.enable(gl.DEPTH_TEST); gl.disable(gl.BLEND); gl.disable(gl.CULL_FACE);
    gl.useProgram(prog.p); gl.uniformMatrix4fv(prog.u.uP, false, P); gl.uniformMatrix4fv(prog.u.uV, false, V); gl.uniformMatrix4fv(prog.u.uM, false, M);
    gl.uniform1f(prog.u.uExag, o.exag); gl.uniform1f(prog.u.uAlpha, 1);
    gl.uniform1f(prog.u.uWidth, 0); gl.uniform1f(prog.u.uLift, 0); gl.bindVertexArray(tMesh.vao); gl.drawElements(gl.TRIANGLES, tMesh.n, gl.UNSIGNED_INT, 0);
    gl.uniform1f(prog.u.uWidth, o.width); gl.uniform1f(prog.u.uLift, o.lift);
    if (st.fixed && fMesh.n){ gl.bindVertexArray(fMesh.vao); gl.drawElements(gl.TRIANGLES, fMesh.n, gl.UNSIGNED_INT, 0); }
    if (rMesh.n){ gl.bindVertexArray(rMesh.vao); gl.drawElements(gl.TRIANGLES, rMesh.n, gl.UNSIGNED_INT, 0); }
    gl.bindVertexArray(null); }

  // ---- page preview: orbit camera
  const cam = { yaw: 0.55, pitch: 0.85, dist: 1.55, tx: 0, tz: 0 }; let drag = null, raf = 0, xrSession = null;
  cv.addEventListener('pointerdown', e => { drag = { x: e.clientX, y: e.clientY, b: e.button, c: { ...cam } }; cv.setPointerCapture(e.pointerId); });
  cv.addEventListener('pointermove', e => { if (!drag) return; const dx = (e.clientX - drag.x) / cv.clientWidth, dy = (e.clientY - drag.y) / cv.clientHeight;
    if (drag.b === 2 || e.shiftKey){ const r = rotY([-dx * cam.dist * 1.6, 0, -dy * cam.dist * 1.6], cam.yaw); cam.tx = drag.c.tx + r[0]; cam.tz = drag.c.tz + r[2]; }
    else { cam.yaw = drag.c.yaw - dx * 4; cam.pitch = Math.max(0.08, Math.min(1.52, drag.c.pitch + dy * 3)); } });
  cv.addEventListener('pointerup', () => { drag = null; }); cv.addEventListener('contextmenu', e => e.preventDefault());
  cv.addEventListener('wheel', e => { e.preventDefault(); cam.dist = Math.max(0.12, Math.min(5, cam.dist * Math.exp(e.deltaY * 0.001))); }, { passive: false });
  function frame(t){ raf = requestAnimationFrame(frame); if (xrSession) return; follow(t);
    const dpr = Math.min(2, devicePixelRatio || 1), w = Math.round(cv.clientWidth * dpr), h = Math.round(cv.clientHeight * dpr); if (cv.width !== w || cv.height !== h){ cv.width = w; cv.height = h; }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0, 0, w, h); gl.clearColor(0.067, 0.067, 0.075, 1); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    const eye = [cam.tx + cam.dist * Math.cos(cam.pitch) * Math.sin(cam.yaw), cam.dist * Math.sin(cam.pitch), cam.tz + cam.dist * Math.cos(cam.pitch) * Math.cos(cam.yaw)];
    drawScene(M4.persp(0.7, w / h, 0.01, 50), M4.look(eye, [cam.tx, 0, cam.tz]), M4.trs([0, 0, 0], 0, unit), { exag: st.exag, width: 1.6, lift: 0.0025 / unit }); }
  raf = requestAnimationFrame(frame);

  // ---- headset
  const xrBox = root.querySelector('.xrBtns');
  (async () => {
    if (!window.isSecureContext){ note.textContent = L.https; }
    if (!navigator.xr) { if (/OculusBrowser|Quest/i.test(navigator.userAgent)) note.textContent = L.noXR; return; }
    for (const [mode, label] of [['immersive-ar', L.enterAR], ['immersive-vr', L.enterVR]]){
      let ok = false; try { ok = await navigator.xr.isSessionSupported(mode); } catch (e){ ok = false; }
      if (!ok) continue; const b = document.createElement('button'); b.className = 'go'; b.textContent = label; b.onclick = () => startXR(mode); xrBox.append(b); }
  })();

  function hudTexture(){ const c = document.createElement('canvas'); c.width = 1024; c.height = 400; const g = c.getContext('2d');
    g.fillStyle = 'rgba(28,28,30,0.86)'; const r = 40; g.beginPath(); g.roundRect ? g.roundRect(0, 0, 1024, 400, r) : g.rect(0, 0, 1024, 400); g.fill();
    g.fillStyle = '#f5f5f7'; g.font = '600 44px -apple-system,"PingFang SC",sans-serif'; g.fillText('Tensor Studio · ' + L.streets(snap.lines.length), 44, 76);
    g.font = '34px -apple-system,"PingFang SC",sans-serif'; g.fillStyle = 'rgba(235,235,245,0.78)'; L.hud.forEach((s, i) => g.fillText(s, 44, 140 + i * 52));
    const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t); gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, c); gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE); return t; }
  function quad(){ const vao = gl.createVertexArray(); gl.bindVertexArray(vao); const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-0.5, -0.5, 0, 0, 0, 0.5, -0.5, 0, 1, 0, -0.5, 0.5, 0, 0, 1, 0.5, 0.5, 0, 1, 1]), gl.STATIC_DRAW);
    const a = gl.getAttribLocation(tex.p, 'aPos'), u = gl.getAttribLocation(tex.p, 'aUV'); gl.enableVertexAttribArray(a); gl.vertexAttribPointer(a, 3, gl.FLOAT, false, 20, 0); gl.enableVertexAttribArray(u); gl.vertexAttribPointer(u, 2, gl.FLOAT, false, 20, 12); gl.bindVertexArray(null); return vao; }
  const ray = mesh(gl, prog, { v: new Float32Array([0, 0, 0, 0, 0, 0, 1, 0, 1, 1, 1, 0, 0, 0, -0.6, 0, 0, 0, 1, 0, 1, 1, 1, 0]), i: new Uint32Array([0, 1]) });

  async function startXR(mode){
    let session; const AR = mode === 'immersive-ar';
    try { session = await navigator.xr.requestSession(mode, { requiredFeatures: ['local-floor'], optionalFeatures: ['hand-tracking'] }); }
    catch (e){ try { session = await navigator.xr.requestSession(mode, { optionalFeatures: ['local-floor', 'hand-tracking'] }); } catch (e2){ note.textContent = String(e2.message || e2); return; } }
    xrSession = session; await gl.makeXRCompatible();
    session.updateRenderState({ baseLayer: new XRWebGLLayer(session, gl, { alpha: AR, antialias: true }), depthNear: 0.02, depthFar: 8000 });
    let ref; try { ref = await session.requestReferenceSpace('local-floor'); } catch (e){ ref = await session.requestReferenceSpace('local'); }
    const tableScale = 0.9 / terrain.size;   // 90 cm across on the table
    const M = { pos: [0, 0.8, -0.7], yaw: 0, s: tableScale, placed: false };
    const grabs = new Map(); let base = null; const prevBtn = new Map(); let hud = hudTexture(), hudN = snap.lines.length; const hq = quad();
    let head = [0, 1.6, 0], headF = [0, 0, -1];
    const placeTable = () => { const f = [headF[0], 0, headF[2]], l = Math.hypot(f[0], f[2]) || 1; f[0] /= l; f[2] /= l;
      M.s = tableScale; M.yaw = yawOf(f[0], f[2]); M.pos = [head[0] + f[0] * 0.75, Math.max(0.7, head[1] - 0.5), head[2] + f[2] * 0.75]; st.walk = false; };
    const placeWalk = () => { const zc = heightSampler(snap.S).at(terrain.cx, terrain.cy); M.s = 1; M.pos = [head[0], -zc, head[2]]; st.walk = true; };
    const sources = () => [...grabs.keys()];
    const rebase = (frame) => { base = null; const ss = sources(); if (!ss.length) return; const P = ss.map(s => poseOf(frame, s)).filter(Boolean); if (P.length !== ss.length) return;
      if (P.length === 1) base = { one: true, h: P[0].p, hy: P[0].yaw, pos: M.pos.slice(), yaw: M.yaw, s: M.s };
      else { const a = P[0].p, b = P[1].p; base = { one: false, mid: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2], d: Math.hypot(a[0] - b[0], a[2] - b[2], a[1] - b[1]) || 1e-3, ang: yawOf(b[0] - a[0], b[2] - a[2]), pos: M.pos.slice(), yaw: M.yaw, s: M.s }; } };
    const poseOf = (frame, s) => { const sp = s.gripSpace || s.targetRaySpace; const p = sp && frame.getPose(sp, ref); if (!p) return null; const m = p.transform.matrix; return { p: [m[12], m[13], m[14]], yaw: yawOf(-m[8], -m[10]), m }; };
    const add = e => { grabs.set(e.inputSource, true); base = 'pending'; }, rem = e => { if (grabs.delete(e.inputSource)) base = 'pending'; };
    session.addEventListener('selectstart', add); session.addEventListener('squeezestart', add); session.addEventListener('selectend', rem); session.addEventListener('squeezeend', rem);
    session.addEventListener('end', () => { xrSession = null; status(); });
    let tPrev = 0;
    const onFrame = (t, frame) => { session.requestAnimationFrame(onFrame); const dt = Math.min(0.05, tPrev ? (t - tPrev) / 1000 : 0); tPrev = t; follow(t);
      const pose = frame.getViewerPose(ref); if (!pose) return; const hm = pose.transform.matrix; head = [hm[12], hm[13], hm[14]]; headF = [-hm[8], -hm[9], -hm[10]];
      if (!M.placed){ placeTable(); M.placed = true; }
      // buttons and sticks
      for (const s of session.inputSources){ const gp = s.gamepad; if (!gp) continue; const key = s.handedness, was = prevBtn.get(key) || [], now = gp.buttons.map(b => b.pressed); prevBtn.set(key, now);
        const hit = k => now[k] && !was[k], ax = gp.axes[2] || 0, ay = gp.axes[3] || 0, dz = q => Math.abs(q) > 0.15 ? q : 0;
        if (key === 'right'){ if (hit(4)){ st.flood = !st.flood; refresh(true); sync(); } if (hit(5)){ if (st.walk) placeTable(); else placeWalk(); grabs.clear(); base = null; }
          if (st.walk){ if (hit(2) || (Math.abs(ax) > 0.75 && !(prevBtn.get('rx') > 0.75))){ const a = (ax > 0 ? -1 : 1) * Math.PI / 6, r = rotY([M.pos[0] - head[0], 0, M.pos[2] - head[2]], a); M.pos = [head[0] + r[0], M.pos[1], head[2] + r[2]]; M.yaw += a; } prevBtn.set('rx', Math.abs(ax)); }
          else { if (dz(ax)){ const a = -dz(ax) * dt * 1.4, r = rotY([M.pos[0] - head[0], 0, M.pos[2] - head[2]], 0); void r; M.yaw += a; } if (dz(ay)){ const k = Math.exp(-dz(ay) * dt * 1.2); M.s = Math.max(tableScale * 0.15, Math.min(tableScale * 40, M.s * k)); } } }
        if (key === 'left'){ if (hit(4)){ st.fixed = !st.fixed; sync(); } if (hit(5)){ placeTable(); grabs.clear(); base = null; }
          if (st.walk){ const f = [headF[0], 0, headF[2]], l = Math.hypot(f[0], f[2]) || 1, sp = 9 * dt; M.pos[0] -= (f[0] / l * -dz(ay) + -f[2] / l * dz(ax)) * sp; M.pos[2] -= (f[2] / l * -dz(ay) + f[0] / l * dz(ax)) * sp; }
          else if (dz(ay)) M.pos[1] = Math.max(0.1, Math.min(2.2, M.pos[1] - dz(ay) * dt * 0.5)); } }
      // grabbing
      if (base === 'pending') rebase(frame);
      if (base && base !== 'pending'){ const P = sources().map(s => poseOf(frame, s)).filter(Boolean);
        if (base.one && P.length === 1){ const d = P[0].yaw - base.hy, r = rotY([base.pos[0] - base.h[0], base.pos[1] - base.h[1], base.pos[2] - base.h[2]], d); M.pos = [P[0].p[0] + r[0], P[0].p[1] + r[1], P[0].p[2] + r[2]]; M.yaw = base.yaw + d; }
        else if (!base.one && P.length === 2){ const a = P[0].p, b = P[1].p, mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2], k = Math.max(0.05, Math.min(40, (Math.hypot(a[0] - b[0], a[2] - b[2], a[1] - b[1]) || 1e-3) / base.d)), d = yawOf(b[0] - a[0], b[2] - a[2]) - base.ang;
          const r = rotY([base.pos[0] - base.mid[0], base.pos[1] - base.mid[1], base.pos[2] - base.mid[2]], d); M.s = base.s * k; M.pos = [mid[0] + r[0] * k, mid[1] + r[1] * k, mid[2] + r[2] * k]; M.yaw = base.yaw + d; } }
      // draw
      const layer = session.renderState.baseLayer; gl.bindFramebuffer(gl.FRAMEBUFFER, layer.framebuffer);
      if (AR && !st.walk) gl.clearColor(0, 0, 0, 0); else if (st.walk) gl.clearColor(0.78, 0.84, 0.9, 1); else gl.clearColor(0.07, 0.07, 0.08, 1);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      const Mm = M4.trs(M.pos, M.yaw, M.s), real = 1 / M.s;   // model metres per real metre
      const o = st.walk ? { exag: 1, width: 1, lift: 0.08 } : { exag: st.exag, width: Math.max(1, 1.6 * Math.min(1, tableScale / M.s * 2)), lift: Math.max(0.0015 * real, 0.05) };
      if (snap.lines.length !== hudN){ hudN = snap.lines.length; gl.deleteTexture(hud); hud = hudTexture(); }
      for (const view of pose.views){ const vp = layer.getViewport(view); gl.viewport(vp.x, vp.y, vp.width, vp.height); const P = view.projectionMatrix, V = view.transform.inverse.matrix;
        drawScene(P, V, Mm, o);
        // controller rays
        gl.useProgram(prog.p); gl.uniform1f(prog.u.uExag, 1); gl.uniform1f(prog.u.uWidth, 0); gl.uniform1f(prog.u.uLift, 0);
        for (const s of session.inputSources){ if (!s.targetRaySpace) continue; const rp = frame.getPose(s.targetRaySpace, ref); if (!rp) continue; gl.uniformMatrix4fv(prog.u.uM, false, rp.transform.matrix); gl.bindVertexArray(ray.vao); gl.drawElements(gl.LINES, 2, gl.UNSIGNED_INT, 0); }
        // help card above the left hand, turned to face you
        const left = [...session.inputSources].find(s => s.handedness === 'left'), lp = left && poseOf(frame, left);
        if (lp){ const p = [lp.p[0], lp.p[1] + 0.13, lp.p[2]], z = [head[0] - p[0], head[1] - p[1], head[2] - p[2]], zl = Math.hypot(...z) || 1; for (let k = 0; k < 3; k++) z[k] /= zl;
          const x = [z[2], 0, -z[0]], xl = Math.hypot(...x) || 1; for (let k = 0; k < 3; k++) x[k] /= xl; const y = [z[1] * x[2] - z[2] * x[1], z[2] * x[0] - z[0] * x[2], z[0] * x[1] - z[1] * x[0]];
          gl.useProgram(tex.p); gl.uniformMatrix4fv(tex.u.uP, false, P); gl.uniformMatrix4fv(tex.u.uV, false, V); gl.uniformMatrix4fv(tex.u.uM, false, M4.basis(x, y, z, p, [0.22, 0.086]));
          gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA); gl.disable(gl.CULL_FACE); gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, hud); gl.uniform1i(tex.u.uT, 0);
          gl.bindVertexArray(hq); gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4); gl.disable(gl.BLEND); }
        gl.bindVertexArray(null); } };
    session.requestAnimationFrame(onFrame);
  }

  const close = () => { cancelAnimationFrame(raf); if (xrSession) xrSession.end().catch(() => {}); root.remove(); OPEN = null; };
  if (btn('close')) btn('close').onclick = close; addEventListener('keydown', function esc(e){ if (e.key === 'Escape' && OPEN){ close(); removeEventListener('keydown', esc); } });
  OPEN = { close, state: st, refresh };
  return OPEN;
}
