// Structure Studio · the opening film, scene 3: a small wet-wool-thread simulation (after Frei Otto's detour-optimised
// path systems). Threads tied across a ring, each 8 % slack; wetting makes neighbouring threads cling and merge.
// Writes intro/wool.json (16 frames; coordinates × 1000, flat [x, y, x, y, …] per thread). Deterministic (fixed seed).
// Run: node incubator/structure-studio/tools/build-intro-wool.mjs
import { writeFileSync } from 'node:fs';

let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const N = 24, M = 44, slack = 0.08;
const A = []; for (let i = 0; i < N; i++) { const t = i / N * Math.PI * 2 + 0.06 * (rnd() - .5); A.push([Math.cos(t), Math.sin(t)]); }
const threads = [];
for (let i = 0; i < N; i++) { const j = (i + Math.floor(N / 2) + Math.round((rnd() - .5) * 8) + N) % N; if (i === j) continue;
  const a = A[i], b = A[j], P = []; for (let k = 0; k <= M; k++) { const t = k / M; P.push([a[0] + (b[0] - a[0]) * t + (rnd() - .5) * .004, a[1] + (b[1] - a[1]) * t + (rnd() - .5) * .004]); }
  const L = Math.hypot(b[0] - a[0], b[1] - a[1]) * (1 + slack) / M; threads.push({ P, L }); }
const frames = []; const snap = () => frames.push(threads.map(t => t.P.map(p => [p[0], p[1]])));
snap();
const ITER = 900;
for (let it = 0; it < ITER; it++) {
  const r = 0.05 + 0.2 * Math.min(1, it / 600);   // capillary reach grows as the threads get wet
  const pts = []; threads.forEach((t, ti) => t.P.forEach((p, k) => { if (k > 0 && k < M) pts.push([ti, k, p]); }));
  // grid hash
  const G = new Map(), cs = r, h = (x, y) => Math.floor(x / cs) + ',' + Math.floor(y / cs);
  for (const q of pts) { const k = h(q[2][0], q[2][1]); (G.get(k) || G.set(k, []).get(k)).push(q); }
  const mv = new Map();
  for (const q of pts) { const [x, y] = q[2], cx = Math.floor(x / cs), cy = Math.floor(y / cs); let sx = 0, sy = 0, n = 0;
    for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) { const L = G.get((cx + dx) + ',' + (cy + dy)); if (!L) continue;
      for (const o of L) { if (o[0] === q[0]) continue; const d = Math.hypot(o[2][0] - x, o[2][1] - y); if (d < r && d > 1e-6) { const w = (1 - d / r); sx += (o[2][0] - x) * w; sy += (o[2][1] - y) * w; n += w; } } }
    if (n > 0) mv.set(q, [sx / n * 0.25, sy / n * 0.25]); }
  for (const [q, [dx, dy]] of mv) { q[2][0] += dx; q[2][1] += dy; }
  // rope constraint: segments cannot stretch beyond their rest length
  for (let rep = 0; rep < 12; rep++) for (const t of threads) for (let k = 0; k < M; k++) { const p = t.P[k], q = t.P[k + 1], d = Math.hypot(q[0] - p[0], q[1] - p[1]);
    if (d > t.L) { const e = (d - t.L) / d * 0.5, ex = (q[0] - p[0]) * e, ey = (q[1] - p[1]) * e; if (k > 0) { p[0] += ex; p[1] += ey; } else { q[0] -= ex; q[1] -= ey; } if (k + 1 < M) { q[0] -= ex; q[1] -= ey; } else { p[0] += ex; p[1] += ey; } } }
  if (it % 60 === 59) snap();
}
console.log('frames', frames.length, 'threads', threads.length);
const q = v => Math.round(v * 1000), out = { about: 'Structure Studio opening film, scene 3: wet wool threads (tools/build-intro-wool.mjs)', A: A.flatMap(p => p.map(q)), F: frames.map(f => f.map(t => t.flatMap(p => p.map(q)))) };
writeFileSync(new URL('../intro/wool.json', import.meta.url), JSON.stringify(out));
