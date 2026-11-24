/* Tensor Studio · the method film, moving (24 Nov 2026): everything that moves is drawn here, in a worker, on an
   OffscreenCanvas, so it keeps moving while the page's main thread is busy reading the site.
   intro.js sends the canvas, the size and the places to draw in (rectangles measured from its own layout, CSS px);
   this reads intro/motion.json (the app's fields on a 30 m grid, made by tools/build-intro.py) and draws by the clock
   intro.js starts. Chapters (s): I 0–4 the site and its grid · II 4–9 three precedents · III 9–19 the five layers,
   first what the data do (wind blowing, water running down, contours), then the street direction each gives ·
   IV 19–24 adding them at one point (×2, tip to tail, ÷2) · V 24–28 particles in the summed field, by clarity ·
   VI 28–36 the four networks growing as they grew in the app. */
'use strict';
let cv, g, W = 0, H = 0, DPR = 1, R = {}, D = null, S = {}, t0abs = 0, running = false, phone = false, last = 0;
const C = { terrain: '#F2F2F2', wind: '#68C8FF', summer: '#E8A33D', winter: '#9D7CFF', water: '#5FBF7A', field: '#E8463A', lilac: '#B9A4FF', amber: '#E8A33D', ink: 'rgba(255,255,255,' };
const LAYERS = ['terrain', 'wind', 'summer', 'winter', 'water'];
const T = [0, 4, 9, 19, 24, 28], END = 36;
const now = () => performance.timeOrigin + performance.now();
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const ease = x => { x = clamp(x, 0, 1); return x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; };
const win = (t, a, b, f = .45) => clamp(Math.min((t - a) / f, (b - t) / f), 0, 1);       // 0..1 inside [a, b], with fades
const rnd = (() => { let s = 7; return () => (s = (s * 16807) % 2147483647) / 2147483647; })();
const off = (w, h) => { const c = new OffscreenCanvas(Math.max(1, Math.ceil(w)), Math.max(1, Math.ceil(h))); return c; };

self.onmessage = async e => {
  const m = e.data;
  if (m.type === 'init') {
    cv = m.canvas; g = cv.getContext('2d'); phone = m.phone; S = m.strings || {};
    setSize(m);
    try {
      const r = await fetch(m.data); if (!r.ok) throw new Error('motion.json ' + r.status);
      prep(await r.json()); layout();
      postMessage({ type: 'ready' });
    } catch (err) { postMessage({ type: 'error', message: String(err && err.message || err) }); }
  } else if (m.type === 'start') { t0abs = m.t0; running = true; loop(); }
  else if (m.type === 'size') { setSize(m); if (D) layout(); }
  else if (m.type === 'stop') { running = false; }
};
function setSize(m) { W = m.w; H = m.h; DPR = m.dpr; R = m.rects; cv.width = Math.round(W * DPR); cv.height = Math.round(H * DPR); }
const raf = self.requestAnimationFrame ? f => self.requestAnimationFrame(f) : f => setTimeout(() => f(performance.now()), phone ? 33 : 16);
function loop() {
  if (!running) return;
  const t = (now() - t0abs) / 1000, dt = clamp(t - last, 0, 0.1); last = t;
  try { frame(t, dt || 1 / 60); } catch (err) { postMessage({ type: 'error', message: String(err && err.message || err) }); running = false; return; }
  S.frames = (S.frames || 0) + 1; if (t > END && !S.told) { S.told = 1; postMessage({ type: 'stats', frames: S.frames, t }); }
  if (t < END + 30) raf(loop);
}

// ------------------------------------------------------------------ the data: a 30 m grid of fields
function prep(J) {
  const col = n => J.cols.indexOf(n); let gx = 0, gy = 0;
  for (const c of J.cells) { gx = Math.max(gx, c[0] + 1); gy = Math.max(gy, c[1] + 1); }
  const N = gx * gy, A = () => new Float32Array(N), F = { mask: new Uint8Array(N) };
  for (const k of LAYERS) { F[k + 'C'] = A(); F[k + 'S'] = A(); }
  for (const k of ['fieldC', 'fieldS', 'clar', 'z', 'eY', 'eS', 'eW']) F[k] = A();
  for (const c of J.cells) {
    const i = c[1] * gx + c[0]; F.mask[i] = 1;
    LAYERS.forEach((k, j) => { F[k + 'C'][i] = c[2 + 2 * j]; F[k + 'S'][i] = c[3 + 2 * j]; });
    const f = c[col('field')], cl = c[col('clarity')]; F.fieldC[i] = Math.cos(2 * f) * (0.2 + cl); F.fieldS[i] = Math.sin(2 * f) * (0.2 + cl); F.clar[i] = cl;
    F.z[i] = c[col('z')]; F.eY[i] = c[col('expYear')]; F.eS[i] = c[col('expSummer')]; F.eW[i] = c[col('expWinter')];
  }
  const mx = {}; for (const k of LAYERS) { let m = 0; for (let i = 0; i < N; i++) m = Math.max(m, Math.hypot(F[k + 'C'][i], F[k + 'S'][i])); mx[k] = m || 1; }
  D = { J, F, gx, gy, st: J.step_m, mx, size: J.size, cells: J.cells.length };
  // the downhill direction (water running), from the ground's height
  F.dx = A(); F.dy = A();
  for (let y = 0; y < gy; y++) for (let x = 0; x < gx; x++) { const i = y * gx + x; if (!F.mask[i]) continue;
    const zz = (a, b) => { const j = b * gx + a; return a >= 0 && b >= 0 && a < gx && b < gy && F.mask[j] ? F.z[j] : F.z[i]; };
    F.dx[i] = -(zz(x + 1, y) - zz(x - 1, y)); F.dy[i] = -(zz(x, y + 1) - zz(x, y - 1)); }
  // the wind's travel direction (from where it blows towards where it goes), in site coordinates (x east, y north)
  const to = frm => { const a = (90 - (frm + 180)) * Math.PI / 180; return [Math.cos(a), Math.sin(a)]; };
  D.wind = { year: to(J.winds.year), summer: to(J.winds.summer), winter: to(J.winds.winter) };
  D.land = J.cells.length;
}
// bilinear: [value, weight] of one grid, or the tensor's axis
function at(arr, x, y) {
  const { F, gx, gy, st } = D, fx = x / st, fy = y / st, c = Math.floor(fx), r = Math.floor(fy), u = fx - c, v = fy - r; let s = 0, w = 0;
  for (const [dc, dr, k] of [[0, 0, (1 - u) * (1 - v)], [1, 0, u * (1 - v)], [0, 1, (1 - u) * v], [1, 1, u * v]]) {
    const cc = c + dc, rr = r + dr; if (cc < 0 || rr < 0 || cc >= gx || rr >= gy) continue; const i = rr * gx + cc; if (!F.mask[i]) continue; s += arr[i] * k; w += k; }
  return w > 0.3 ? s / w : null;
}
function axis(key, x, y) { const c = at(D.F[key + 'C'], x, y), s = at(D.F[key + 'S'], x, y); if (c === null) return null; return [0.5 * Math.atan2(s, c), Math.hypot(c, s)]; }
const inLand = (x, y) => { const { F, gx, gy, st } = D, c = Math.round(x / st), r = Math.round(y / st); return c >= 0 && r >= 0 && c < gx && r < gy && F.mask[r * gx + c] === 1; };
function seed() { const c = D.J.cells[Math.floor(rnd() * D.J.cells.length)]; return [(c[0] + rnd() - .5) * D.st, (c[1] + rnd() - .5) * D.st]; }

// ------------------------------------------------------------------ fitting the site into a rectangle (plan) or a stack (axonometric)
function planFit(r, pad = 0.04) {
  const [sw, sh] = D.size, k = Math.min(r.w * (1 - 2 * pad) / sw, r.h * (1 - 2 * pad) / sh), ox = r.x + (r.w - sw * k) / 2, oy = r.y + (r.h + sh * k) / 2;
  return { k, P: (x, y) => [ox + x * k, oy - y * k] };
}
const AX = -32 * Math.PI / 180, CA = Math.cos(AX), SA = Math.sin(AX);
function axonFit(r) {
  const [sw, sh] = D.size, cx = sw / 2, cy = sh / 2; let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
  const pr = (x, y) => { const u = (x - cx) * CA - (y - cy) * SA, v = (x - cx) * SA + (y - cy) * CA; return [u, -v * 0.5]; };
  for (const ring of D.J.rings) for (const q of ring) { const p = pr(q[0], q[1]); x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]); }
  const lw = x1 - x0, lh = y1 - y0, gap = 0.42, extra = 0.25, SH = lh * (1 + 5 * gap + extra), lab = phone ? 0 : 0.0;
  const k = Math.min(r.w / lw, r.h / SH) * 0.98, ox = r.x + (r.w - lw * k) / 2 - x0 * k, top = r.y + (r.h - SH * k) / 2 - y0 * k;
  return { k, lh: lh * k, lw: lw * k, x0: ox + x0 * k, ytop: top + y0 * k, gap: gap * lh * k, sumY: (5 * gap + extra) * lh * k, P: (x, y) => { const p = pr(x, y); return [ox + p[0] * k, top + p[1] * k]; }, D: (a) => { const dx = Math.cos(a), dy = Math.sin(a), u = dx * CA - dy * SA, v = dx * SA + dy * CA; const X = u, Y = -v * 0.5, L = Math.hypot(X, Y) || 1; return [X / L, Y / L]; } };
}

// ------------------------------------------------------------------ layout: built once, again on a resize
let L = {};
function layout() {
  const a = R.art; L = {};
  L.plan = planFit(a); L.axon = axonFit(a);
  // the trail canvases (device pixels): one for the plan, one per layer of the stack, one per precedent
  L.trailPlan = off(W * DPR, H * DPR);
  L.layerCv = LAYERS.concat(['field']).map(() => off(W * DPR, (L.axon.lh + 40) * DPR));
  L.prec = (R.prec || []).map(r => ({ r, cv: off(r.w * DPR, r.h * DPR), parts: null }));
  L.base = off(W * DPR, H * DPR); drawBase(L.base.getContext('2d'));
  L.parts = {}; L.made = true;
}
function path(c, ring, P) { ring.forEach((q, i) => { const p = P(q[0], q[1]); i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1]); }); c.closePath(); }
function drawBase(c) {   // the site in plan, the dark ground (chapters I and V)
  c.setTransform(DPR, 0, 0, DPR, 0, 0); c.clearRect(0, 0, W, H);
  c.beginPath(); for (const ring of D.J.rings) path(c, ring, L.plan.P); c.fillStyle = '#100d1c'; c.fill('evenodd');
  c.strokeStyle = 'rgba(255,255,255,.07)'; c.lineWidth = 0.8;
  for (const k of D.J.contours) { c.beginPath(); k.p.forEach((q, i) => { const p = L.plan.P(q[0], q[1]); i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1]); }); c.stroke(); }
}

// ------------------------------------------------------------------ particles
function swarm(n) { const P = []; for (let i = 0; i < n; i++) { const s = seed(); P.push({ x: s[0], y: s[1], vx: 0, vy: 0, life: rnd() * 2.5 }); } return P; }
// move one particle along a direction field; dir(x, y, p) gives [ux, uy, speed] (an axis is signed to keep the particle going)
function step(p, dir, dt, sp) {
  const d = dir(p.x, p.y, p); p.life -= dt;
  if (!d || p.life <= 0 || !inLand(p.x, p.y)) { const s = seed(); p.x = s[0]; p.y = s[1]; p.vx = p.vy = 0; p.life = 1.5 + rnd() * 2.5; p.fresh = true; return false; }
  let [ux, uy, v] = d; if (p.vx * ux + p.vy * uy < 0) { ux = -ux; uy = -uy; }
  if (!p.vx && !p.vy && rnd() < .5) { ux = -ux; uy = -uy; }
  p.px = p.x; p.py = p.y; p.vx = ux; p.vy = uy; p.x += ux * v * sp * dt; p.y += uy * v * sp * dt; p.fresh = false; return true;
}
function fade(c, a) { c.globalCompositeOperation = 'destination-out'; c.fillStyle = 'rgba(0,0,0,' + a + ')'; c.fillRect(0, 0, c.canvas.width, c.canvas.height); c.globalCompositeOperation = 'source-over'; }

// ------------------------------------------------------------------ one frame
function frame(t, dt) {
  g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, cv.width, cv.height);
  if (!L.made) return;
  const a1 = win(t, T[0], T[1] + .1), a2 = win(t, T[1] + .2, T[2] + .1), a3 = win(t, T[2], T[3] + 1.6, .5), a4 = win(t, T[3] + .9, T[4] + .1), a5 = win(t, T[4], T[5] + .1), a6 = clamp((t - T[5]) / .5, 0, 1);
  if (a1 > 0) chI(t, a1);
  if (a2 > 0) chII(t, dt, a2);
  if (a3 > 0) chIII(t, dt, a3);
  if (a4 > 0) chIV(t, a4);
  if (a5 > 0) chV(t, dt, a5);
  if (a6 > 0) chVI(t, a6);
}
const fmt = n => Math.round(n).toLocaleString(S.zh ? 'zh-CN' : 'en-GB');

// I · the site drawn, its anchors, and the 10 m grid sweeping over it
function chI(t, al) {
  g.setTransform(DPR, 0, 0, DPR, 0, 0); g.globalAlpha = al;
  g.globalAlpha = al * ease(t / .8); g.drawImage(L.base, 0, 0, W, H); g.globalAlpha = al;
  const P = L.plan.P, draw = ease((t - .2) / 1.6);
  g.strokeStyle = '#CFC6F5'; g.lineWidth = 1.4;
  for (const ring of D.J.rings) { let len = 0; for (let i = 1; i < ring.length; i++) len += Math.hypot(ring[i][0] - ring[i - 1][0], ring[i][1] - ring[i - 1][1]);
    let left = len * draw; g.beginPath(); let p0 = P(ring[0][0], ring[0][1]); g.moveTo(p0[0], p0[1]);
    for (let i = 1; i < ring.length && left > 0; i++) { const s = Math.hypot(ring[i][0] - ring[i - 1][0], ring[i][1] - ring[i - 1][1]), f = Math.min(1, left / s);
      const q = P(ring[i - 1][0] + (ring[i][0] - ring[i - 1][0]) * f, ring[i - 1][1] + (ring[i][1] - ring[i - 1][1]) * f); g.lineTo(q[0], q[1]); left -= s; }
    g.stroke(); }
  D.J.anchors.forEach((q, i) => { const a = ease((t - 1.0 - i * .03) / .3); if (a <= 0) return; const p = P(q[0], q[1]);
    g.fillStyle = 'rgba(245,245,247,' + a + ')'; g.beginPath(); g.arc(p[0], p[1], 2.6 + 2 * (1 - a), 0, 7); g.fill(); });
  // the grid: a sweep from west to east, 10 m lines behind it (drawn every 30 m, lighter, so they stay readable)
  const sw = ease((t - 1.6) / 2.0); if (sw > 0) {
    const r = R.art, [sx] = P(0, 0), [ex] = P(D.size[0], 0), X = sx + (ex - sx) * sw, k = L.plan.k, stepPx = 10 * k * (k * 10 < 3 ? 3 : 1);
    g.save(); g.beginPath(); for (const ring of D.J.rings) path(g, ring, P); g.clip('evenodd');
    g.strokeStyle = 'rgba(232,163,61,.2)'; g.lineWidth = .6; g.beginPath();
    for (let x = sx; x < X; x += stepPx) { g.moveTo(x, r.y); g.lineTo(x, r.y + r.h); }
    const [, ty] = P(0, D.size[1]), [, by] = P(0, 0); for (let y = ty; y < by; y += stepPx) { g.moveTo(sx, y); g.lineTo(X, y); } g.stroke(); g.restore();
    if (sw < 1) { g.strokeStyle = '#E8A33D'; g.lineWidth = 1.6; g.beginPath(); g.moveTo(X, r.y + r.h * .04); g.lineTo(X, r.y + r.h * .96); g.stroke(); }
    g.font = "500 12px 'DM Mono', ui-monospace, Menlo, monospace"; g.fillStyle = '#E8A33D'; g.textAlign = 'left';
    g.fillText(fmt((S.land || D.land * 9) * sw) + (S.zh ? ' 个点 · 10 m' : ' points · 10 m'), Math.min(X + 8, r.x + r.w - 150), r.y + 16);
  }
  g.globalAlpha = 1;
}

// II · three small precedents, each a loop of about three seconds
function chII(t, dt, al) {
  (L.prec || []).forEach((s, k) => {
    const r = s.r, c = s.cv.getContext('2d'), u = ((t - T[1] - .5 - k * .9) % 3.2 + 3.2) % 3.2, on = ease((t - T[1] - .4 - k * .9) / .5);
    if (on <= 0) return;
    c.setTransform(DPR, 0, 0, DPR, 0, 0);
    const w = r.w, h = r.h, pl = (y, col, fill) => { c.beginPath(); c.moveTo(w * .12, y + h * .13); c.lineTo(w * .5, y); c.lineTo(w * .88, y + h * .13); c.lineTo(w * .5, y + h * .26); c.closePath(); c.fillStyle = fill || 'rgba(255,255,255,.03)'; c.fill(); c.strokeStyle = col; c.lineWidth = 1; c.stroke(); };
    if (k === 0) {            // overlay analysis: three grey maps fall and add up to one shade
      c.clearRect(0, 0, w, h);
      for (let j = 0; j < 3; j++) { const d = ease((u - j * .45) / .7), y = h * .02 + j * h * .2 * (1 - d) + h * .55 * d;
        pl(y, 'rgba(255,255,255,' + (.65 - .3 * d) + ')'); c.fillStyle = 'rgba(255,255,255,' + (.18 + j * .08) + ')'; c.beginPath(); c.ellipse(w * (.38 + j * .1), y + h * .13, w * (.12 - j * .02), h * .045, 0, 0, 7); c.fill(); }
      const m = ease((u - 1.6) / .6); if (m > 0) { c.fillStyle = 'rgba(255,255,255,' + .55 * m + ')'; c.beginPath(); c.ellipse(w * .46, h * .68, w * .16, h * .06, 0, 0, 7); c.fill(); }
    } else {                  // streets from geometric fields: particles follow a grid, then a radial field bends them into streets; this study: five coloured flows join into one
      fade(c, phone ? .1 : .07);
      if (!s.parts) s.parts = Array.from({ length: phone ? 34 : 60 }, () => ({ x: rnd() * w, y: rnd() * h, c: k === 2 ? Math.floor(rnd() * 5) : 0 }));
      const cx = w * .72, cy = h * .5;
      for (const p of s.parts) {
        let ux, uy;
        if (k === 1) { const dx = p.x - cx, dy = p.y - cy, d = Math.hypot(dx, dy) || 1, b = clamp(1.4 - d / (w * .35), 0, 1);
          ux = (1 - b) * 1 + b * (-dy / d); uy = b * (dx / d); }
        else { const lane = (p.c - 2) * h * .13, target = h * .5 + lane * clamp(1 - p.x / (w * .8), 0, 1); ux = 1; uy = (target - p.y) * .04; }
        const l = Math.hypot(ux, uy) || 1, nx = p.x + ux / l * 40 * dt, ny = p.y + uy / l * 40 * dt;
        const col = k === 1 ? 'rgba(245,245,247,.9)' : (p.x > w * .8 ? C.field : C[LAYERS[p.c]]);
        c.strokeStyle = col; c.lineWidth = 1.7; c.beginPath(); c.moveTo(p.x, p.y); c.lineTo(nx, ny); c.stroke();
        p.x = nx; p.y = ny; if (p.x > w || p.y < 0 || p.y > h || p.x < 0) { p.x = rnd() * w * .15; p.y = rnd() * h; }
      }
      if (k === 1) { c.fillStyle = 'rgba(255,255,255,.9)'; c.beginPath(); c.arc(cx, cy, 2.2, 0, 7); c.fill(); }
    }
    g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = al * on; g.drawImage(s.cv, r.x * DPR, r.y * DPR); g.globalAlpha = 1;
  });
}

// III · the stack: each layer first shows what its data do, then the direction it gives a street
const LT = k => T[2] + .4 + k * 1.6;     // when layer k rises
function phenomenon(key, x, y) {
  const F = D.F, w = D.wind;
  if (key === 'terrain') { const a = axis('terrain', x, y); return a && [Math.cos(a[0]), Math.sin(a[0]), .4 + a[1] / D.mx.terrain]; }
  if (key === 'water') { const dx = at(F.dx, x, y), dy = at(F.dy, x, y); if (dx === null) return null; const l = Math.hypot(dx, dy); return l < 1e-3 ? null : [dx / l, dy / l, .5 + Math.min(1, l / 3)]; }
  const v = key === 'wind' ? w.year : key === 'summer' ? w.summer : w.winter, e = at(key === 'wind' ? F.eY : key === 'summer' ? F.eS : F.eW, x, y);
  return e === null ? null : [v[0], v[1], .45 + .8 * Math.min(1, e)];
}
function chIII(t, dt, al) {
  const A = L.axon, n = phone ? 220 : 520;
  if (!L.parts.stack) L.parts.stack = LAYERS.concat(['field']).map(() => swarm(n));
  const collapse = ease((t - T[3] - .1) / 1.1);
  LAYERS.concat(['field']).forEach((key, k) => {
    const t0 = k < 5 ? LT(k) : LT(5) - .2, rise = ease((t - t0) / .7); if (rise <= 0) return;
    const cv2 = L.layerCv[k], c = cv2.getContext('2d'), oy = (k < 5 ? k * A.gap : A.sumY), local = t - t0;
    // the particles, in the layer's own canvas (y measured from the layer's top)
    c.setTransform(DPR, 0, 0, DPR, 0, 0); fade(c, phone ? .12 : .08);
    const mixT = key === 'field' ? 1 : ease((local - 1.0) / .7), col = key === 'field' ? C.field : C[key];
    const dir = (x, y) => {
      if (key === 'field') { const a = axis('field', x, y); return a && [Math.cos(a[0]), Math.sin(a[0]), .35 + a[1]]; }
      const ph = mixT < 1 ? phenomenon(key, x, y) : null, ax = mixT > 0 ? axis(key, x, y) : null;
      if (mixT <= 0) return ph;
      if (!ax || ax[1] < D.mx[key] * .04) return mixT >= 1 ? null : ph;
      let ux = Math.cos(ax[0]), uy = Math.sin(ax[0]); const sp = .4 + ax[1] / D.mx[key];
      if (!ph) return [ux, uy, sp];
      if (ux * ph[0] + uy * ph[1] < 0) { ux = -ux; uy = -uy; }
      const mx = ph[0] * (1 - mixT) + ux * mixT, my = ph[1] * (1 - mixT) + uy * mixT, l = Math.hypot(mx, my) || 1;
      return [mx / l, my / l, ph[2] * (1 - mixT) + sp * mixT];
    };
    c.strokeStyle = col; c.lineWidth = phone ? 1.3 : 1.5; c.globalAlpha = 1; c.beginPath();
    const y0 = A.ytop - 20;
    for (const p of L.parts.stack[k]) { if (step(p, dir, dt, 60 / A.k)) { const a = A.P(p.px, p.py), b = A.P(p.x, p.y); c.moveTo(a[0], a[1] - y0); c.lineTo(b[0], b[1] - y0); } }
    c.stroke(); c.globalAlpha = 1;
    // where it goes on the screen: risen into place, then (IV) dropped onto the field
    const lift = (1 - rise) * 16, drop = k < 5 ? collapse * (A.sumY - oy) : 0, a = al * rise * (k < 5 ? 1 - collapse : 1);
    if (a <= 0.01) return;
    const yOff = oy + lift + drop;
    g.setTransform(DPR, 0, 0, DPR, 0, yOff * DPR);
    g.globalAlpha = a;
    g.beginPath(); for (const ring of D.J.rings) path(g, ring, A.P); g.fillStyle = 'rgba(255,255,255,.035)'; g.fill('evenodd');
    g.strokeStyle = col; g.globalAlpha = a * (key === 'field' ? .8 : .45); g.lineWidth = 1; g.stroke(); g.globalAlpha = a;
    // the terrain's own data: its contours, drawn in as the layer rises
    if (key === 'terrain') { const dr = ease((local - .1) / .9), fadeC = 1 - .6 * ease((local - 1.2) / .6); if (dr > 0) {
      g.save(); g.beginPath(); for (const ring of D.J.rings) path(g, ring, A.P); g.clip('evenodd');
      g.strokeStyle = 'rgba(245,245,247,' + (.5 * fadeC) + ')'; g.lineWidth = .8;
      for (const kk of D.J.contours) { const m = Math.max(2, Math.floor(kk.p.length * dr)); g.beginPath(); for (let i = 0; i < m; i++) { const p = A.P(kk.p[i][0], kk.p[i][1]); i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]); } g.stroke(); } g.restore(); } }
    g.setTransform(1, 0, 0, 1, 0, (yOff + y0) * DPR); g.drawImage(cv2, 0, 0);
    // the label, and what this layer shows at the moment: its data, or the street direction
    g.setTransform(DPR, 0, 0, DPR, 0, 0); g.globalAlpha = a;
    const ly = A.ytop + yOff + A.lh * .12, lx = phone ? A.x0 : Math.max(4, A.x0 - 6);
    g.font = "600 " + (phone ? 10.5 : 12.5) + "px 'DM Sans', system-ui, sans-serif"; g.fillStyle = col; g.textAlign = 'left'; g.fillText((S.layers || {})[key] || key, lx, ly);
    if (key !== 'field') { g.font = "500 " + (phone ? 9 : 10.5) + "px 'DM Mono', ui-monospace, Menlo, monospace"; g.fillStyle = 'rgba(255,255,255,.5)';
      g.fillText(mixT < .5 ? ((S.data || {})[key] || '') : (S.street || ''), lx, ly + (phone ? 13 : 16)); }
    g.globalAlpha = 1;
  });
}

// IV · adding at one point: the parts, each angle doubled, tip to tail, the sum halved
function chIV(t, al) {
  const r = R.art, s = Math.min(r.w, r.h), cx = r.x + r.w / 2, cy = r.y + r.h * .52, Rr = s * .36, u = t - T[3] - 0.8;
  const P = (D.J.probeParts || S.probe || []), wm = Math.max(...P.map(p => p[2]), .01), sc = Rr / wm;
  g.setTransform(DPR, 0, 0, DPR, 0, 0); g.globalAlpha = al;
  g.strokeStyle = 'rgba(255,255,255,.12)'; g.lineWidth = 1; g.beginPath(); g.arc(cx, cy, Rr * 1.08, 0, 7); g.stroke();
  const st = [ease(u / .6), ease((u - .7) / .7), ease((u - 1.5) / .7), ease((u - 2.3) / .4), ease((u - 2.8) / .6)];
  // the sum, tip to tail, in the doubled angles
  let ex = 0, ey = 0; const chain = P.map(p => { const a = 2 * p[1] * Math.PI / 180, x0 = ex, y0 = ey; ex += Math.cos(a) * p[2] * sc * .9; ey += Math.sin(a) * p[2] * sc * .9; return [x0, y0]; });
  const ox = cx - ex / 2, oy = cy + ey / 2;          // where the chain starts so it sits in the middle
  P.forEach((p, i) => {
    const th = p[1] * Math.PI / 180, ang = th + th * st[1], L0 = p[2] * sc, col = C[p[0]] || '#fff', a = clamp(st[0] * 1.4 - i * .12, 0, 1);
    if (a <= 0) return;
    const fade4 = 1 - .65 * st[4];
    g.strokeStyle = col; g.fillStyle = col; g.globalAlpha = al * a * fade4; g.lineWidth = 2.6; g.lineCap = 'round';
    const mx = cx + (ox + chain[i][0] - cx) * st[2], my = cy + (oy - chain[i][1] - cy) * st[2];       // the start: the centre, then its place in the chain
    const half = 1 - st[1];                                                                          // a line through the point becomes an arrow from it
    const dx = Math.cos(ang) * L0 * (st[2] ? .9 : 1), dy = -Math.sin(ang) * L0 * (st[2] ? .9 : 1);
    g.beginPath(); g.moveTo(mx - dx * half, my - dy * half); g.lineTo(mx + dx, my + dy); g.stroke();
    if (st[1] > .5) { const hl = 7, ha = Math.atan2(dy, dx); g.beginPath(); g.moveTo(mx + dx, my + dy); g.lineTo(mx + dx - hl * Math.cos(ha - .45), my + dy - hl * Math.sin(ha - .45)); g.lineTo(mx + dx - hl * Math.cos(ha + .45), my + dy - hl * Math.sin(ha + .45)); g.closePath(); g.fill(); }
  });
  g.globalAlpha = al;
  if (st[3] > 0) {           // the sum: from the chain's start to its end; then halved, through the point, with its square
    const sx = ox, sy = oy, tx = ox + ex, ty = oy - ey, A2 = Math.atan2(ey, ex), th = A2 / 2, Lf = Rr * 1.08;
    const k4 = st[4], mxA = A2 + (th - A2) * k4;
    if (k4 < 1) { g.globalAlpha = al * st[3] * (1 - k4); g.strokeStyle = C.field; g.lineWidth = 2.4; g.setLineDash([6, 5]); g.beginPath(); g.moveTo(sx, sy); g.lineTo(tx, ty); g.stroke(); g.setLineDash([]); }
    if (k4 > 0) { g.globalAlpha = al * k4; g.strokeStyle = C.field; g.lineWidth = 3; g.beginPath(); g.moveTo(cx - Math.cos(mxA) * Lf, cy + Math.sin(mxA) * Lf); g.lineTo(cx + Math.cos(mxA) * Lf, cy - Math.sin(mxA) * Lf); g.stroke();
      const q = mxA + Math.PI / 2; g.strokeStyle = C.winter; g.lineWidth = 1.8; g.beginPath(); g.moveTo(cx - Math.cos(q) * Lf * .5, cy + Math.sin(q) * Lf * .5); g.lineTo(cx + Math.cos(q) * Lf * .5, cy - Math.sin(q) * Lf * .5); g.stroke();
      g.font = "500 " + (phone ? 13 : 15) + "px 'DM Mono', ui-monospace, Menlo, monospace"; g.fillStyle = C.field; g.textAlign = 'center';
      g.fillText('θ = ' + Math.round(((th * 180 / Math.PI) % 180 + 180) % 180) + '°', cx, cy + Rr * 1.08 + 26); }
  }
  g.fillStyle = 'rgba(255,255,255,.95)'; g.globalAlpha = al; g.beginPath(); g.arc(cx, cy, 3.5, 0, 7); g.fill();
  // the steps, named as they happen
  const steps = S.steps || ['', '', '', ''], cur = u < .7 ? 0 : u < 1.5 ? 1 : u < 2.8 ? 2 : 3;
  g.font = "500 " + (phone ? 10 : 11.5) + "px 'DM Mono', ui-monospace, Menlo, monospace"; g.textAlign = 'left';
  steps.forEach((txt, i) => { g.fillStyle = i === cur ? '#E8A33D' : 'rgba(255,255,255,.32)'; g.fillText((i ? '›  ' : '') + txt, r.x + (phone ? 0 : 4) + i * (phone ? r.w / 4 : Math.min(150, r.w / 4)), r.y + 14); });
  // the parts' values, small, down the side
  g.font = "500 " + (phone ? 9.5 : 11) + "px 'DM Mono', ui-monospace, Menlo, monospace";
  P.forEach((p, i) => { g.globalAlpha = al * clamp(st[0] * 1.4 - i * .12, 0, 1); g.fillStyle = C[p[0]] || '#fff'; g.fillText(((S.layers || {})[p[0]] || p[0]) + '  ' + Math.round(p[1]) + '°  ' + p[2].toFixed(2), r.x + 4, r.y + 40 + i * (phone ? 13 : 16)); });
  g.globalAlpha = 1;
}

// V · the summed field: fast, white and straight where the layers agree; slow, amber and turning where they do not
function chV(t, dt, al) {
  const c = L.trailPlan.getContext('2d'), n = phone ? 900 : 2400;
  if (!L.parts.plan) L.parts.plan = swarm(n);
  c.setTransform(DPR, 0, 0, DPR, 0, 0); fade(c, phone ? .09 : .06);
  const P = L.plan.P, cols = ['rgba(232,163,61,1)', 'rgba(185,164,255,1)', 'rgba(245,245,247,1)'];
  const dir = (x, y) => { const a = axis('field', x, y); if (!a) return null; const cl = at(D.F.clar, x, y) || 0; return [Math.cos(a[0]), Math.sin(a[0]), .25 + 1.1 * cl]; };
  const bins = [[], [], []];
  for (const p of L.parts.plan) { if (step(p, dir, dt, 70 / L.plan.k)) { const cl = at(D.F.clar, p.x, p.y) || 0; bins[cl > .45 ? 2 : cl > .22 ? 1 : 0].push(p); } }
  c.lineWidth = phone ? 1.4 : 1.6;
  bins.forEach((b, j) => { c.strokeStyle = cols[j]; c.beginPath(); for (const p of b) { const a = P(p.px, p.py), q = P(p.x, p.y); c.moveTo(a[0], a[1]); c.lineTo(q[0], q[1]); } c.stroke(); });
  g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = al; g.drawImage(L.base, 0, 0);
  g.drawImage(L.trailPlan, 0, 0);
  g.setTransform(DPR, 0, 0, DPR, 0, 0); g.strokeStyle = 'rgba(207,198,245,.55)'; g.lineWidth = 1; g.beginPath(); for (const ring of D.J.rings) path(g, ring, P); g.stroke();
  g.globalAlpha = 1;
}

// VI · the four networks, growing street by street in the order the app grew them
function chVI(t, al) {
  const order = ['A', 'B', 'C', 'D'], grow = ease((t - T[5] - .5) / 5.0);
  (R.four || []).forEach((r, k) => {
    const G = (D.J.growth || {})[order[k]]; if (!G) return;
    const on = ease((t - T[5] - .1 - k * .15) / .5); if (on <= 0) return;
    const F = planFit(r, .02), P = F.P;
    g.setTransform(DPR, 0, 0, DPR, 0, 0); g.globalAlpha = al * on;
    g.beginPath(); for (const ring of D.J.rings) path(g, ring, P); g.fillStyle = '#100d1c'; g.fill('evenodd'); g.strokeStyle = 'rgba(207,198,245,.5)'; g.lineWidth = .9; g.stroke();
    if (!G.len) { G.len = 0; G.cum = G.streets.map(s => { let l = 0; for (let i = 2; i < s.length; i++) l += Math.hypot(s[i][0] - s[i - 1][0], s[i][1] - s[i - 1][1]); G.len += l; return l; }); }
    let left = G.len * grow;
    G.streets.forEach((s, j) => {
      if (left <= 0) return; const main = s[0] === 1; let l = 0;
      g.strokeStyle = main ? 'rgba(245,245,247,.95)' : 'rgba(185,164,255,.75)'; g.lineWidth = main ? (phone ? 1.4 : 1.8) : (phone ? .7 : .9); g.lineCap = 'round';
      g.beginPath(); let p = P(s[1][0], s[1][1]); g.moveTo(p[0], p[1]);
      for (let i = 2; i < s.length && left > 0; i++) { const d = Math.hypot(s[i][0] - s[i - 1][0], s[i][1] - s[i - 1][1]), f = Math.min(1, left / (d || 1));
        p = P(s[i - 1][0] + (s[i][0] - s[i - 1][0]) * f, s[i - 1][1] + (s[i][1] - s[i - 1][1]) * f); g.lineTo(p[0], p[1]); left -= d; }
      g.stroke();
    });
    for (const a of G.attractors || []) { const p = P(a[0], a[1]); g.fillStyle = a[2] === 'main' ? '#0a84ff' : 'rgba(232,163,61,.9)'; g.beginPath(); g.arc(p[0], p[1], a[2] === 'main' ? 3.6 : 2.4, 0, 7); g.fill(); }
    g.globalAlpha = 1;
  });
}
