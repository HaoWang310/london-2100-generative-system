// Trees and street vehicles for a streamed tile, from the tile's own OSM data. Pure geometry, no GL.
//
//   trees: points scattered inside parks, woods and grass (a visual impression, like the app's, not a tree survey);
//          each tree is a four-sided trunk and an eight-faced crown, in xr_view's vertex layout
//   cars:  paths along the larger streets; xr_view moves a small box along each one every frame
// Everything is repeatable: the scatter comes from a generator seeded by the tile's x / y.

const STRIDE = 12;
function rng(seed){ let a = seed >>> 0 || 1; return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const inRings = (rings, x, y) => { let c = false; for (const r of rings) for (let i = 0, j = r.length - 1; i < r.length; j = i++){ const a = r[i], b = r[j]; if ((a[1] > y) !== (b[1] > y) && x < (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]) + a[0]) c = !c; } return c; };

const GREEN = { park: 1 / 900, wood: 1 / 260, grass: 1 / 1600, cemetery: 1 / 1200 };   // trees per m²
const greenClass = (layer, props) => { const c = props.class || props.subclass || '';
  if (/wood|forest/.test(c)) return 'wood'; if (layer === 'park' || /park|garden|nature_reserve|recreation/.test(c)) return 'park';
  if (/cemetery/.test(c)) return 'cemetery'; if (/grass|meadow|village_green|scrub/.test(c)) return 'grass'; return null; };

/** layers: decoded tile · plan(ext): q → [x, y] plan metres · size: tile side in metres · x, y: tile numbers. Returns { v, i, count }. */
export function treesForTile(layers, plan, size, x, y, max = 2200){
  const rnd = rng(x * 73856093 ^ y * 19349663), v = [], idx = []; let count = 0;
  const areas = [];
  for (const lname of ['park', 'landcover', 'landuse']) for (const f of layers[lname] || []){ if (f.type !== 3) continue; const k = greenClass(lname, f.props); if (!k) continue;
    const m = size / f.extent, rings = f.parts; let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    for (const r of rings) for (const q of r){ if (q[0] < x0) x0 = q[0]; if (q[0] > x1) x1 = q[0]; if (q[1] < y0) y0 = q[1]; if (q[1] > y1) y1 = q[1]; }
    x0 = Math.max(0, x0); y0 = Math.max(0, y0); x1 = Math.min(f.extent, x1); y1 = Math.min(f.extent, y1); if (x1 <= x0 || y1 <= y0) continue;
    areas.push({ rings, P: plan(f.extent), x0, y0, w: x1 - x0, h: y1 - y0, want: (x1 - x0) * (y1 - y0) * m * m * GREEN[k] }); }
  const total = areas.reduce((s, a) => s + a.want, 0), scale = total > max ? max / total : 1;
  for (const a of areas){ const n = Math.round(a.want * scale * 1.25);   // the box is bigger than the shape: ask for a few more
    for (let k = 0; k < n && count < max; k++){ const tx = a.x0 + rnd() * a.w, ty = a.y0 + rnd() * a.h; if (!inRings(a.rings, tx, ty)) continue;
      const [px, py] = a.P([tx, ty]); tree(v, idx, px, py, rnd); count++; } }
  return { v: new Float32Array(v), i: new Uint32Array(idx), count };
}
function tree(v, idx, px, py, rnd){
  const H = 7 + rnd() * 8, r = 2.2 + rnd() * 2.4, th = H * 0.32, tr = 0.28 + rnd() * 0.15, g = 0.8 + rnd() * 0.35;
  const crown = [0.33 * g, 0.47 * g, 0.29 * g], trunk = [0.36, 0.29, 0.23], X = px, Z = -py;
  let o = v.length / STRIDE;
  // trunk: four sides
  for (let k = 0; k < 4; k++){ const a0 = k * Math.PI / 2, a1 = (k + 1) * Math.PI / 2, n = [Math.cos((a0 + a1) / 2), 0, Math.sin((a0 + a1) / 2)], b = v.length / STRIDE;
    for (const [a, yy] of [[a0, 0], [a1, 0], [a0, th], [a1, th]]) v.push(X + Math.cos(a) * tr, yy, Z + Math.sin(a) * tr, 0, 0, n[0], 0, n[2], ...trunk, 0);
    idx.push(b, b + 2, b + 1, b + 1, b + 2, b + 3); }
  // crown: an octahedron stretched upwards, normals pointing out
  o = v.length / STRIDE; const cy = th + (H - th) * 0.5, ry = (H - th) * 0.5 + 0.6;
  const pts = [[0, ry, 0], [r, 0, 0], [0, 0, r], [-r, 0, 0], [0, 0, -r], [0, -ry * 0.75, 0]];
  for (const p of pts){ const l = Math.hypot(p[0] / r, p[1] / ry, p[2] / r) || 1; v.push(X + p[0], cy + p[1], Z + p[2], 0, 0, p[0] / r / l, p[1] / ry / l, p[2] / r / l, ...crown, 0); }
  for (const [a, b, c] of [[0, 1, 2], [0, 2, 3], [0, 3, 4], [0, 4, 1], [5, 2, 1], [5, 3, 2], [5, 4, 3], [5, 1, 4]]) idx.push(o + a, o + b, o + c);
}

const CAR_ROADS = { motorway: 4, trunk: 4, primary: 3, secondary: 2.4, tertiary: 1.6, minor: 0.7 };   // vehicles per km
const CAR_COLOURS = [[0.93, 0.93, 0.94], [0.72, 0.74, 0.77], [0.25, 0.27, 0.30], [0.10, 0.10, 0.12], [0.72, 0.16, 0.14], [0.16, 0.34, 0.62], [0.86, 0.80, 0.62]];
/** Paths with vehicles on them: [{ pts: [[x, y]…] plan metres, cum: [0, …, length], cars: [{ s, speed, dir, colour, len }] }] */
export function carsForTile(layers, plan, size, x, y, max = 70){
  const rnd = rng(x * 83492791 ^ y * 2971215073 | 0), out = []; let total = 0;
  for (const f of layers.transportation || []){ if (f.type !== 2 || total >= max) continue; const per = CAR_ROADS[f.props.class]; if (!per || f.props.brunnel === 'tunnel') continue;
    const P = plan(f.extent);
    for (const part of f.parts){ if (part.length < 2 || total >= max) continue; const pts = part.map(P), cum = [0];
      for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
      const len = cum[cum.length - 1]; if (len < 40) continue;
      const n = Math.min(max - total, Math.floor(len / 1000 * per + rnd())); if (!n) continue; const cars = [];
      for (let k = 0; k < n; k++) cars.push({ s: rnd() * len, speed: 7 + rnd() * 7, dir: rnd() < 0.5 ? 1 : -1, colour: CAR_COLOURS[Math.floor(rnd() * CAR_COLOURS.length)], len: rnd() < 0.12 ? 9 : 4.4 });
      out.push({ pts, cum, len, cars }); total += n; } }
  return { paths: out, count: total };
}

/** Where a vehicle is at time t (seconds): position, heading (unit vector), in plan metres. It bounces between the path's ends. */
export function carAt(path, car, t){
  const L = path.len; let s = (car.s + car.dir * car.speed * t) % (2 * L); if (s < 0) s += 2 * L; let fwd = 1; if (s > L){ s = 2 * L - s; fwd = -1; }
  const cum = path.cum; let lo = 0, hi = cum.length - 1; while (hi - lo > 1){ const m = (lo + hi) >> 1; if (cum[m] <= s) lo = m; else hi = m; }
  const a = path.pts[lo], b = path.pts[hi], seg = cum[hi] - cum[lo] || 1, u = (s - cum[lo]) / seg, dx = (b[0] - a[0]) / seg * fwd, dy = (b[1] - a[1]) / seg * fwd;
  return { x: a[0] + (b[0] - a[0]) * u + dy * 1.7, y: a[1] + (b[1] - a[1]) * u - dx * 1.7, dx, dy };   // keep to the left of the centre line (UK)
}

/** Boxes for vehicles: fills a Float32Array (24 vertices each) and returns how many vertices were written. scale: size multiplier. */
export function writeCars(out, paths, t, scale){
  let n = 0;
  for (const p of paths) for (const c of p.cars){ if (n + 24 * STRIDE > out.length) return n / STRIDE;
    const q = carAt(p, c, t), hl = c.len * scale / 2, hw = 0.9 * scale, h = (c.len > 6 ? 3 : 1.45) * scale, fx = q.dx, fz = -q.dy, rx = -fz, rz = fx, X = q.x, Z = -q.y;
    const corner = (a, b, yy) => [X + fx * hl * a + rx * hw * b, yy, Z + fz * hl * a + rz * hw * b];
    const faces = [[[0, 1, 0], [[-1, -1, h], [1, -1, h], [-1, 1, h], [1, 1, h]]], [[fx, 0, fz], [[1, -1, 0], [1, 1, 0], [1, -1, h], [1, 1, h]]], [[-fx, 0, -fz], [[-1, 1, 0], [-1, -1, 0], [-1, 1, h], [-1, -1, h]]],
      [[rx, 0, rz], [[1, 1, 0], [-1, 1, 0], [1, 1, h], [-1, 1, h]]], [[-rx, 0, -rz], [[-1, -1, 0], [1, -1, 0], [-1, -1, h], [1, -1, h]]], [[0, -1, 0], [[-1, -1, 0], [-1, 1, 0], [1, -1, 0], [1, 1, 0]]]];
    for (const [nr, cs] of faces) for (const [a, b, yy] of cs){ const P = corner(a, b, yy); out[n++] = P[0]; out[n++] = P[1]; out[n++] = P[2]; out[n++] = 0; out[n++] = 0; out[n++] = nr[0]; out[n++] = nr[1]; out[n++] = nr[2]; out[n++] = c.colour[0]; out[n++] = c.colour[1]; out[n++] = c.colour[2]; out[n++] = 0; } }
  return n / STRIDE;
}
