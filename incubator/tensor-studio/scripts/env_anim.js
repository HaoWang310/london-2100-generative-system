/* Tensor Studio · the analysis maps, animated (v8.9). Step 2 of the process mode plays each map as a short loop:
 *   Z  elevation   the water rises: contour after contour lights up from the lowest, lights run along the lit ones
 *   Q  runoff      rain falls on the land and runs downhill; where the drops meet, the runoff paths draw themselves
 *   V  summer air  the summer winds blow through, fast and bright where the air moves, slow behind the water and the slopes
 *   Cw winter cold the cold winds (north, north-east, east) push in, the map darkens where they bite
 *   C  comfort     the summer air and the winter cold cross-fade into the comfort map; the best places ring as plaza candidates
 * A classic script loaded after app.js (it reads the engine's globals: ENV, D, DIRS, view, X, Y, DPR, cv, THEME, …).
 * Only a drawing: nothing here changes the field or the streets. Respects prefers-reduced-motion (static maps). */
'use strict';
(() => {
if (typeof ENV === 'undefined' || !ENV) return;
const RM = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
const PERIOD = { Z: 6.5, Q: 7.5, V: 6, Cw: 6, C: 8.5 };
const COL = { dark: { Z: '#64d2ff', Q: '#64d2ff', V: '#30d158', Cw: '#b4a7ff', C: '#ff9f0a', ink: '#f5f5f7' },
              light: { Z: '#0071e3', Q: '#0a84ff', V: '#06652b', Cw: '#2b1d8f', C: '#ff9500', ink: '#1d1d1f' } };
const M = D.landMask, idx = (x, y) => { const c = Math.round(x / cell), r = Math.round(y / cell); return c < 0 || r < 0 || c >= nx || r >= ny ? -1 : r * nx + c; };
const onLand = i => i >= 0 && (!M || M[i]);
const smoothVec = (U, V, sg) => { const u = blur(U, sg), v = blur(V, sg); return [u, v]; };

/* ------------------------------------------------------------------ the fields the particles follow (built once, on first use) */
const F = {};
function runoffField(){ if (F.Q) return F.Q; const Fz = blur(ENV.F || ENV.Z, 1.2), U = new Float32Array(N), V = new Float32Array(N);
  for (let r = 0; r < ny; r++) for (let c = 0; c < nx; c++){ const i = r * nx + c; let best = 0, bu = 0, bv = 0;
    for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++){ if (!dr && !dc) continue; const rr = r + dr, cc = c + dc; if (rr < 0 || cc < 0 || rr >= ny || cc >= nx) continue;
      const L = Math.hypot(dr, dc), s = (Fz[i] - Fz[rr * nx + cc]) / L; if (s > best){ best = s; bu = dc / L; bv = dr / L; } }
    U[i] = bu; V[i] = bv; }
  const [u, v] = smoothVec(U, V, 1.0), Qs = blur(ENV.Q, 0.8);
  return (F.Q = { u, v, q: Qs }); }
function windField(k){ if (F[k]) return F[k]; const st = ENV.stats, e = k === 'V' ? st.summerEnergy : st.winterColdEnergy, U = new Float32Array(N), V = new Float32Array(N);
  for (let d = 0; d < 8; d++){ if (!(e[d] > 0)) continue; const [ux, uy] = toVec(DIRS[d].frm), S = DIRS[d].S; for (let i = 0; i < N; i++){ const w = e[d] * S[i]; U[i] += w * ux; V[i] += w * uy; } }
  const [u, v] = smoothVec(U, V, 2.5); let mx = 1e-9; for (let i = 0; i < N; i++) if (!M || M[i]) mx = Math.max(mx, Math.hypot(u[i], v[i]));
  const A = ENV[k]; let lo = Infinity, hi = -Infinity; for (let i = 0; i < N; i++) if (!M || M[i]){ lo = Math.min(lo, A[i]); hi = Math.max(hi, A[i]); }
  return (F[k] = { u, v, mx, a: A, lo, hi }); }
// the cells' distance to the nearest ground that is not land (the site's edge, water), in m: candidates keep 60 m from both
const EDGE_GAP = 60;
function edgeDist(){ if (F.ed) return F.ed; const d = new Float32Array(N).fill(1e9), q = [];
  for (let i = 0; i < N; i++) if (M && !M[i]){ d[i] = 0; q.push(i); }
  for (let h = 0; h < q.length; h++){ const k = q[h], r = (k / nx) | 0, c = k % nx; for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]]){ const rr = r + dr, cc = c + dc; if (rr < 0 || cc < 0 || rr >= ny || cc >= nx) continue; const j = rr * nx + cc; if (d[j] > d[k] + cell){ d[j] = d[k] + cell; q.push(j); } } }
  return (F.ed = d); }
// a peak among the allowed cells only (land, 60 m from the edge and the water)
function comfortPeaks(){ if (F.peaks) return F.peaks; const Cs = blur(ENV.C, 4), cand = [], ed = edgeDist();
  for (let r = 2; r < ny - 2; r++) for (let c = 2; c < nx - 2; c++){ const i = r * nx + c; if ((M && !M[i]) || ed[i] < EDGE_GAP) continue; let mx = true;
    for (let dr = -2; dr <= 2 && mx; dr++) for (let dc = -2; dc <= 2; dc++){ const j = (r + dr) * nx + c + dc; if ((dr || dc) && (!M || M[j]) && ed[j] >= EDGE_GAP && Cs[j] > Cs[i]){ mx = false; break; } } if (mx) cand.push([Cs[i], c * cell, r * cell]); }
  cand.sort((a, b) => b[0] - a[0]); const out = [];
  for (const p of cand){ if (out.every(q => Math.hypot(q[1] - p[1], q[2] - p[2]) > 380)) out.push(p); if (out.length === 3) break; }
  return (F.peaks = out); }
function contours(){ if (F.cont) return F.cont; const st = ENV.stats;
  const cs = (D.contours || []).map(c => { const p = c.p, s = [0]; for (let k = 1; k < p.length; k++) s.push(s[k - 1] + Math.hypot(p[k][0] - p[k - 1][0], p[k][1] - p[k - 1][1])); return { z: c.z, p, s, L: s[s.length - 1] }; }).filter(c => c.L > 40);
  cs.sort((a, b) => a.z - b.z); const z0 = Math.min(st.zMin, cs.length ? cs[0].z : st.zMin), z1 = Math.max(st.zMax, cs.length ? cs[cs.length - 1].z : st.zMax);
  return (F.cont = { cs, z0: Math.floor(z0) - 0.5, z1: Math.ceil(z1) + 0.5 }); }
const along = (c, s) => { const S = c.s; let a = 0, b = S.length - 1; while (b - a > 1){ const m = (a + b) >> 1; if (S[m] <= s) a = m; else b = m; } const t = (s - S[a]) / ((S[b] - S[a]) || 1), p = c.p[a], q = c.p[b]; return [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t]; };

/* ------------------------------------------------------------------ the layers: trails (the particles' streaks), a small copy for the glow */
const trail = document.createElement('canvas'), glow = document.createElement('canvas');
function fitCanvases(){ if (trail.width !== cv.width || trail.height !== cv.height){ trail.width = cv.width; trail.height = cv.height; glow.width = Math.max(1, cv.width >> 2); glow.height = Math.max(1, cv.height >> 2); return true; } return false; }
function clearTrail(){ const g = trail.getContext('2d'); g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, trail.width, trail.height); }

const EA = window.ENVANIM = { on: false, k: null, t0: 0, parts: [], lastView: '', cycle: 0, onCycle: null };
const rnd = Math.random;
function landSpot(){ for (let n = 0; n < 40; n++){ const x = rnd() * nx * cell, y = rnd() * ny * cell; if (onLand(idx(x, y))) return [x, y]; } return null; }
function spawn(k){
  if (k === 'Q'){ const p = landSpot(); return p ? { x: p[0], y: p[1], px: p[0], py: p[1], age: 0, life: 160 + rnd() * 220 } : null; }
  if (k === 'V' || k === 'Cw'){ const p = landSpot(); return p ? { x: p[0], y: p[1], px: p[0], py: p[1], age: 0, life: 50 + rnd() * 110, w: k } : null; }
  if (k === 'C'){ const p = landSpot(); return p ? { x: p[0], y: p[1], px: p[0], py: p[1], age: 0, life: 40 + rnd() * 80, w: rnd() < 0.5 ? 'V' : 'Cw' } : null; }
  return null; }
function counts(k){ const a = Math.min(1.6, Math.max(0.6, (cv.width * cv.height) / (2800 * 1800))); return Math.round({ Q: 2600, V: 1700, Cw: 1700, C: 1500, Z: 0 }[k] * a); }
function restart(now){ EA.t0 = now; EA.parts = []; EA.lights = []; clearTrail(); EA.cycle++; }

EA.start = function(k){ if (RM || !ENV || !k || k === 'off'){ EA.stop(); return; } EA.on = true; EA.k = k; EA.cycle = 0; restart(performance.now());
  if (k === 'Q') runoffField(); else if (k === 'V' || k === 'Cw') windField(k); else if (k === 'C'){ windField('V'); windField('Cw'); comfortPeaks(); } else if (k === 'Z') contours();
  baseDirty = true; };
EA.stop = function(){ if (!EA.on) return; EA.on = false; EA.k = null; EA.parts = []; clearTrail(); baseDirty = true; };
EA.period = k => PERIOD[k] || 6;

/* ------------------------------------------------------------------ a frame */
function stepWindParts(g, k, sx, col, alphaMax, keepSpawning){ const W = F;
  while (keepSpawning && EA.parts.length < counts(k)){ const p = spawn(k); if (!p) break; EA.parts.push(p); }
  g.lineCap = 'round';
  for (let n = EA.parts.length - 1; n >= 0; n--){ const p = EA.parts[n], f = W[p.w || k], i = idx(p.x, p.y);
    if (!onLand(i) || p.age++ > p.life){ EA.parts[n] = EA.parts[EA.parts.length - 1]; EA.parts.pop(); continue; }
    const m = Math.hypot(f.u[i], f.v[i]) / f.mx, sp = (0.9 + 3.6 * m) / sx, vx = f.u[i] / (Math.hypot(f.u[i], f.v[i]) || 1), vy = f.v[i] / (Math.hypot(f.u[i], f.v[i]) || 1);
    p.px = p.x; p.py = p.y; p.x += vx * sp; p.y += vy * sp;
    const fade = Math.min(1, p.age / 12, (p.life - p.age) / 16), b = clamp((f.a[i] - f.lo) / ((f.hi - f.lo) || 1), 0, 1);
    g.globalAlpha = alphaMax * fade * (0.25 + 0.75 * b); g.strokeStyle = typeof col === 'function' ? col(p) : col; g.lineWidth = 0.8 + 1.4 * b;
    g.beginPath(); g.moveTo(X(p.px), Y(p.py)); g.lineTo(X(p.x), Y(p.y)); g.stroke(); } }
function stepRain(g, sx, col, keepSpawning){ const f = F.Q;
  if (keepSpawning) for (let n = 0; n < 90 && EA.parts.length < counts('Q'); n++){ const p = spawn('Q'); if (p) EA.parts.push(p); }
  g.lineCap = 'round'; g.strokeStyle = col;
  for (let n = EA.parts.length - 1; n >= 0; n--){ const p = EA.parts[n], i = idx(p.x, p.y);
    if (!onLand(i) || p.age++ > p.life){ EA.parts[n] = EA.parts[EA.parts.length - 1]; EA.parts.pop(); continue; }
    const q = f.q[i], m = Math.hypot(f.u[i], f.v[i]); if (m < 0.05){ p.age += 3; continue; }
    const sp = (0.7 + 4.2 * q) / sx; p.px = p.x; p.py = p.y; p.x += f.u[i] / m * sp + (rnd() - 0.5) * 0.4 / sx; p.y += f.v[i] / m * sp + (rnd() - 0.5) * 0.4 / sx;
    const fade = Math.min(1, p.age / 10, (p.life - p.age) / 20);
    g.globalAlpha = fade * (0.18 + 0.82 * q * q); g.lineWidth = 0.7 + 2.2 * q;
    g.beginPath(); g.moveTo(X(p.px), Y(p.py)); g.lineTo(X(p.x), Y(p.y)); g.stroke(); } }
function drawStatic(ctx, k, a){ if (a <= 0.003) return; ctx.save(); ctx.setTransform(DPR, 0, 0, DPR, 0, 0); ctx.imageSmoothingEnabled = true; ctx.globalAlpha = a;
  ctx.drawImage(envImg(k), X(-cell / 2), Y((ny - 0.5) * cell), nx * cell * view.s, ny * cell * view.s); ctx.restore(); }
const ease = t => t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t), seg = (t, a, b) => ease((t - a) / (b - a));

EA.draw = function(ctx, now){ if (!EA.on) return; const k = EA.k, P = EA.period(k), dark = THEME === 'dark', C = COL[dark ? 'dark' : 'light'];
  const vk = view.x.toFixed(1) + ',' + view.y.toFixed(1) + ',' + view.s.toFixed(4); if (fitCanvases() || vk !== EA.lastView){ EA.lastView = vk; clearTrail(); }
  let t = (now - EA.t0) / 1000; if (t > P){ if (EA.onCycle) EA.onCycle(k, EA.cycle); restart(now); t = 0; }
  const g = trail.getContext('2d'); g.setTransform(1, 0, 0, 1, 0, 0);
  g.globalCompositeOperation = 'destination-out'; g.globalAlpha = 1; g.fillStyle = 'rgba(0,0,0,' + (k === 'Q' ? 0.06 : 0.11) + ')'; g.fillRect(0, 0, trail.width, trail.height);
  g.globalCompositeOperation = dark ? 'lighter' : 'source-over'; g.setTransform(DPR, 0, 0, DPR, 0, 0);
  const sx = view.s, endFade = 1 - seg(t, P - 0.6, P);   // everything eases out over the loop's last 0.6 s
  let base = 0;
  if (k === 'Q'){ base = 0.95 * seg(t, P * 0.45, P * 0.8) * endFade; stepRain(g, sx, C.Q, t < P * 0.62); }
  else if (k === 'V' || k === 'Cw'){ base = (dark ? (k === 'Cw' ? 0.9 : 0.78) : 0.5) * seg(t, 0.2, P * 0.55) * endFade; stepWindParts(g, k, sx, C[k], dark ? 0.85 : 0.95, t < P - 1.2); }
  else if (k === 'C'){ const sw = seg(t, 0, 0.4) * (1 - seg(t, 2.6, 3.4)), cw = seg(t, 1.4, 1.9) * (1 - seg(t, 3.4, 4.2));
    base = 0.82 * seg(t, 3.0, 4.6) * endFade;
    stepWindParts(g, 'C', sx, p => p.w === 'V' ? C.V : C.Cw, dark ? 0.8 : 0.7, t < 3.6 && (sw > 0.05 || cw > 0.05));
    // the two wind maps behind, cross-fading into comfort
    drawStatic(ctx, 'V', 0.55 * sw * endFade); drawStatic(ctx, 'Cw', 0.6 * cw * endFade); }
  else if (k === 'Z') base = 0.82 * seg(t, P * 0.12, P * 0.8) * endFade;
  drawStatic(ctx, k, base);
  // the trails, with a soft glow in the dark theme
  ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0);
  if (dark){ const gg = glow.getContext('2d'); gg.setTransform(1, 0, 0, 1, 0, 0); gg.clearRect(0, 0, glow.width, glow.height); gg.imageSmoothingEnabled = true; gg.drawImage(trail, 0, 0, glow.width, glow.height);
    ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.9; ctx.imageSmoothingEnabled = true; ctx.drawImage(glow, 0, 0, cv.width, cv.height); ctx.globalAlpha = 1; }
  ctx.drawImage(trail, 0, 0); ctx.restore();
  // elevation: the water level rises, contour by contour; lights run along the lit lines
  if (k === 'Z'){ const { cs, z0, z1 } = contours(), lev = z0 + (z1 - z0) * seg(t, 0.15, P * 0.78);
    ctx.save(); ctx.setTransform(DPR, 0, 0, DPR, 0, 0); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    // beyond the site the lit contours stay faint; within it the full effect (clipped to the land)
    ctx.globalAlpha = 0.16 * endFade; ctx.strokeStyle = C.Z; ctx.lineWidth = 0.8; for (const c of cs){ if (c.z > lev) break; pathLine(ctx, c.p); ctx.stroke(); }
    ctx.beginPath(); for (const pc of D.pieces){ pc.outer.forEach((q, n) => n ? ctx.lineTo(X(q[0]), Y(q[1])) : ctx.moveTo(X(q[0]), Y(q[1]))); ctx.closePath(); } ctx.clip();
    for (const c of cs){ if (c.z > lev) break; const fresh = clamp(1 - (lev - c.z) / 1.6, 0, 1);
      ctx.globalAlpha = (0.32 + 0.68 * fresh) * endFade; ctx.strokeStyle = fresh > 0.02 ? C.Z : C.ink; ctx.lineWidth = 0.8 + 2.4 * fresh;
      if (dark && fresh > 0.02){ ctx.shadowColor = C.Z; ctx.shadowBlur = 10 * fresh; } else ctx.shadowBlur = 0;
      pathLine(ctx, c.p); ctx.stroke();
      // the lights along it
      if (!c.lights){ c.lights = []; } if (c.lights.length < Math.min(14, Math.ceil(c.L / 160))) c.lights.push({ s: rnd() * c.L, v: (0.6 + rnd() * 0.8) * (rnd() < 0.5 ? -1 : 1) }); }
    ctx.shadowBlur = 0;
    g.globalAlpha = 0.9; g.fillStyle = C.Z;
    for (const c of cs){ if (c.z > lev || !c.lights) continue; for (const L_ of c.lights){ L_.s = (L_.s + L_.v * 2.2 / sx + c.L) % c.L; const [x, y] = along(c, L_.s); if (!onLand(idx(x, y))) continue; g.beginPath(); g.arc(X(x), Y(y), 1.6, 0, 2 * PI); g.fill(); } }
    ctx.globalAlpha = 0.85 * endFade; ctx.fillStyle = C.ink; ctx.font = '600 12px -apple-system, "SF Pro Text", "PingFang SC", sans-serif'; ctx.textAlign = 'left';
    const ins = window.__TS_INSETS ? window.__TS_INSETS() : { l: 0 }; ctx.fillText((TS_LANG === 'zh' ? '水位 ' : 'level ') + Math.min(lev, z1 - 0.5).toFixed(1) + ' m', ins.l + 24, 30);
    ctx.restore();
    if (t < 0.05) for (const c of cs) c.lights = null; }
  // comfort: the best places ring, as plaza candidates (a showing only, for now)
  if (k === 'C' && t > 4.4){ const pk = comfortPeaks(), u = t - 4.4; ctx.save(); ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    pk.forEach((p, n) => { const x = X(p[1]), y = Y(p[2]), tt = u - n * 0.35; if (tt < 0) return; const a = seg(tt, 0, 0.5) * endFade;
      for (let r = 0; r < 3; r++){ const ph = ((tt * 0.7 + r / 3) % 1), R = 10 + ph * 46; ctx.globalAlpha = a * (1 - ph) * 0.9; ctx.strokeStyle = C.C; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, y, R, 0, 2 * PI); ctx.stroke(); }
      ctx.globalAlpha = a; ctx.fillStyle = C.C; ctx.beginPath(); ctx.arc(x, y, 5, 0, 2 * PI); ctx.fill(); ctx.strokeStyle = dark ? '#000' : '#fff'; ctx.lineWidth = 1.5; ctx.stroke();
      ctx.font = '600 11.5px -apple-system, "SF Pro Text", "PingFang SC", sans-serif'; ctx.textAlign = 'left'; ctx.lineWidth = 3; ctx.strokeStyle = dark ? 'rgba(0,0,0,.75)' : 'rgba(255,255,255,.9)';
      const lab = (TS_LANG === 'zh' ? '广场候选 ' : 'plaza candidate ') + (n + 1); ctx.strokeText(lab, x + 12, y - 10); ctx.fillStyle = C.ink; ctx.fillText(lab, x + 12, y - 10); });
    ctx.restore(); }
};
})();
