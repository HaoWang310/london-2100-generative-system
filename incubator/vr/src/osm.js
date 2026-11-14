// OpenStreetMap around a point → a VR scene handle (same shape as src/scene.js gives).
// Data: OpenFreeMap vector tiles (OpenMapTiles schema), the same source London map uses for its 3D city.
//   ground: land use, parks, water, waterways, roads and rail painted into one texture (canvas)
//   buildings: OSM footprints extruded to render_height / render_min_height (hide_3d respected)
// No libraries: a small Mapbox Vector Tile decoder and an ear-clipping triangulator live here.

const TILEJSON = 'https://tiles.openfreemap.org/planet', FALLBACK = 'https://tiles.openfreemap.org/planet/latest/{z}/{x}/{y}.pbf', Z = 14, R_EARTH = 6378137;

// ---------------------------------------------------------------- MVT decoder (spec 2.1)
export function decodeMVT(buf){
  const b = new Uint8Array(buf); let p = 0;
  const vint = () => { let r = 0, s = 0, c; do { c = b[p++]; r += (c & 0x7f) * 2 ** s; s += 7; } while (c & 0x80); return r; };
  const skip = w => { if (w === 0) vint(); else if (w === 1) p += 8; else if (w === 2) p += vint(); else if (w === 5) p += 4; };
  const str = (a, e) => new TextDecoder().decode(b.subarray(a, e));
  const layers = {};
  while (p < b.length){ const h = vint(), f = h >> 3, w = h & 7;
    if (f !== 3 || w !== 2){ skip(w); continue; }
    const end = vint() + p; let name = '', extent = 4096; const keys = [], vals = [], feats = [];
    while (p < end){ const h2 = vint(), f2 = h2 >> 3, w2 = h2 & 7;
      if (f2 === 1 && w2 === 2){ const l = vint(); name = str(p, p + l); p += l; }
      else if (f2 === 2 && w2 === 2){ const l = vint(); feats.push([p, p + l]); p += l; }
      else if (f2 === 3 && w2 === 2){ const l = vint(); keys.push(str(p, p + l)); p += l; }
      else if (f2 === 4 && w2 === 2){ const l = vint(), e = p + l; let v = null;
        while (p < e){ const h3 = vint(), f3 = h3 >> 3, w3 = h3 & 7;
          if (f3 === 1){ const l3 = vint(); v = str(p, p + l3); p += l3; }
          else if (f3 === 2){ v = new DataView(b.buffer, b.byteOffset + p, 4).getFloat32(0, true); p += 4; }
          else if (f3 === 3){ v = new DataView(b.buffer, b.byteOffset + p, 8).getFloat64(0, true); p += 8; }
          else if (f3 === 4 || f3 === 5){ v = vint(); }
          else if (f3 === 6){ const n = vint(); v = n % 2 ? -(n + 1) / 2 : n / 2; }
          else if (f3 === 7){ v = !!vint(); } else skip(w3); }
        vals.push(v); }
      else if (f2 === 5 && w2 === 0) extent = vint();
      else skip(w2); }
    p = end;
    layers[name] = feats.map(([a, e]) => { p = a; let type = 0, tags = [], geom = [];
      while (p < e){ const h4 = vint(), f4 = h4 >> 3, w4 = h4 & 7;
        if (f4 === 2 && w4 === 2){ const l = vint(), q = p + l; while (p < q) tags.push(vint()); }
        else if (f4 === 3 && w4 === 0) type = vint();
        else if (f4 === 4 && w4 === 2){ const l = vint(), q = p + l; while (p < q) geom.push(vint()); }
        else skip(w4); }
      const props = {}; for (let i = 0; i + 1 < tags.length; i += 2) props[keys[tags[i]]] = vals[tags[i + 1]];
      // geometry commands → parts of [x, y] in tile units
      const parts = []; let x = 0, y = 0, cur = null;
      for (let i = 0; i < geom.length;){ const c = geom[i++], id = c & 7, n = c >> 3;
        if (id === 7){ if (cur && cur.length) cur.push(cur[0].slice()); continue; }
        for (let k = 0; k < n; k++){ const dx = geom[i++], dy = geom[i++]; x += dx % 2 ? -(dx + 1) / 2 : dx / 2; y += dy % 2 ? -(dy + 1) / 2 : dy / 2;
          if (id === 1){ cur = [[x, y]]; parts.push(cur); } else cur.push([x, y]); } }
      return { type, props, parts, extent }; });
    p = end; }
  return layers;
}

// ---------------------------------------------------------------- polygons
const area2 = r => { let s = 0; for (let i = 0, n = r.length; i < n; i++){ const a = r[i], c = r[(i + 1) % n]; s += a[0] * c[1] - c[0] * a[1]; } return s; };
/** Ear clipping of one simple ring (no holes). Returns triangle index triples. */
export function earcut(ring){
  let pts = ring.slice(); if (pts.length > 3 && pts[0][0] === pts[pts.length - 1][0] && pts[0][1] === pts[pts.length - 1][1]) pts.pop();
  const n = pts.length; if (n < 3) return [];
  if (n > 250){ const out = []; for (let i = 1; i < n - 1; i++) out.push([0, i, i + 1]); return out; }   // very detailed outline: a fan, so one building cannot freeze the frame
  let idx = [...Array(n).keys()]; if (area2(pts) < 0) idx.reverse();   // counter-clockwise
  const out = [], cross = (a, b, c) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
  const inside = (p, a, b, c) => cross(a, b, p) >= 0 && cross(b, c, p) >= 0 && cross(c, a, p) >= 0;
  let guard = 0;
  while (idx.length > 3 && guard++ < n * n){ let cut = false;
    for (let i = 0; i < idx.length; i++){ const i0 = idx[(i + idx.length - 1) % idx.length], i1 = idx[i], i2 = idx[(i + 1) % idx.length], a = pts[i0], b = pts[i1], c = pts[i2];
      if (cross(a, b, c) <= 0) continue; let ok = true;
      for (const j of idx){ if (j === i0 || j === i1 || j === i2) continue; if (inside(pts[j], a, b, c)){ ok = false; break; } }
      if (!ok) continue; out.push([i0, i1, i2]); idx.splice(i, 1); cut = true; break; }
    if (!cut) break; }
  if (idx.length === 3) out.push([idx[0], idx[1], idx[2]]);
  return out;
}

// ---------------------------------------------------------------- building prisms
const WALL = [0.86, 0.84, 0.81], ROOF = [0.95, 0.94, 0.92];
/** list: [{ ring: [[x, y]…] closed, plan metres, y north; h: top; h0: base }] · cx, cy: plan point at the model centre · W, H: keep only centroids inside 0…W × 0…H
 *  Duplicates (a building cut by a tile edge arrives once per tile) are dropped. Returns { mesh: { v, i } in xr_view's layout, count }. */
export function buildingMesh(list, cx, cy, W, H, x0 = 0, y0 = 0, colour = null){
  const ROOFc = colour || ROOF, WALLc = colour ? colour.map(c => c * 0.86) : WALL;
  const v = [], idx = [], seen = new Set(); let count = 0;
  for (const it of list){ let ring = it.ring; if (ring.length < 4) continue;
    if (area2(ring) > 0) ring = ring.slice().reverse();   // walls below assume clockwise (y north)
    const h = Math.max(3, it.h || 8), h0 = Math.max(0, Math.min(h - 1, it.h0 || 0));
    let mx = 0, my = 0; for (const q of ring){ mx += q[0]; my += q[1]; } mx /= ring.length; my /= ring.length;
    if (mx < x0 || my < y0 || mx >= x0 + W || my >= y0 + H) continue;
    const key = Math.round(mx * 2) + ':' + Math.round(my * 2) + ':' + Math.round(h); if (seen.has(key)) continue; seen.add(key); count++;
    for (let i = 0; i < ring.length - 1; i++){ const a = ring[i], b = ring[i + 1], dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy); if (L < 0.05) continue;
      const n = [-dy / L, 0, -dx / L], o = v.length / 12, k = 0.92 + 0.08 * Math.abs(n[0]), col = WALLc.map(c => c * k);
      for (const [q, y] of [[a, h0], [b, h0], [a, h], [b, h]]) v.push(q[0] - cx, y, -(q[1] - cy), 0, 0, n[0], n[1], n[2], ...col, 0);
      idx.push(o, o + 1, o + 2, o + 1, o + 3, o + 2); }
    const o = v.length / 12, pts = ring.slice(0, -1);
    for (const q of pts) v.push(q[0] - cx, h, -(q[1] - cy), 0, 0, 0, 1, 0, ...ROOFc, 0);
    for (const [a, b, c] of earcut(pts)) idx.push(o + a, o + b, o + c); }
  return { mesh: { v: new Float32Array(v), i: new Uint32Array(idx) }, count };
}

// ---------------------------------------------------------------- styles (the map's soft "淡雅" look)
const GROUND = '#efece6';
const FILL = { water: '#b9d3dd', park: '#d7e4c9', wood: '#c9dbb8', grass: '#dce8cf', farmland: '#ebe8d9', residential: '#e9e5de', commercial: '#ebe2dc', industrial: '#e6e1d8', retail: '#ede0da', cemetery: '#d3dfc8', pitch: '#cfe2c2', sand: '#ede3c6', wetland: '#cfe0d6', railway: '#e2ded8' };
const ROAD = { motorway: [26, '#f4d49a'], trunk: [22, '#f6dfb1'], primary: [18, '#ffffff'], secondary: [15, '#ffffff'], tertiary: [12, '#ffffff'], minor: [8, '#ffffff'], service: [5, '#fbfaf8'], track: [3, '#e4ddcf'], path: [2, '#f3efe6'], rail: [3, '#b3afa8'], transit: [3, '#b3afa8'] };
const landClass = props => { const c = props.class || props.subclass; if (!c) return null;
  if (/park|garden|recreation|playground|nature_reserve|golf/.test(c)) return 'park';
  if (/wood|forest|scrub/.test(c)) return 'wood'; if (/grass|meadow|village_green|allotments/.test(c)) return 'grass';
  if (/farm/.test(c)) return 'farmland'; if (/wetland/.test(c)) return 'wetland'; if (/sand|beach/.test(c)) return 'sand';
  return FILL[c] ? c : null; };

/** Paints OSM ground layers of decoded tiles onto a 2D context. proj(tile, extent) → (q → [u, v] pixels); pxPerM scales line widths.
 *  Returns the building features [{ f, t }] (not painted). Tiles: [{ x, y, layers }]. */
export function paintLayers(g, tiles, proj, pxPerM){
  const fills = [], lines = [], bld = [];
  const path = (parts, P) => { g.beginPath(); for (const part of parts){ part.forEach((q, i) => { const [u, v] = P(q); i ? g.lineTo(u, v) : g.moveTo(u, v); }); } };
  for (const t of tiles){ const L = t.layers;
    for (const lname of ['landcover', 'landuse', 'park']) for (const f of L[lname] || []) if (f.type === 3){ const c = lname === 'park' ? 'park' : landClass(f.props); if (c) fills.push({ z: lname === 'landuse' ? 0 : 1, c: FILL[c], f, t }); }
    for (const f of L.water || []) if (f.type === 3) fills.push({ z: 3, c: FILL.water, f, t });
    for (const f of L.waterway || []) if (f.type === 2) lines.push({ z: 0, w: f.props.class === 'river' ? 14 : 4, c: FILL.water, f, t });
    for (const f of L.transportation || []){ if (f.type !== 2) continue; const st = ROAD[f.props.class]; if (!st) continue; if (f.props.brunnel === 'tunnel') continue;
      lines.push({ z: 1 + Object.keys(ROAD).length - Object.keys(ROAD).indexOf(f.props.class), w: st[0], c: st[1], f, t, casing: !/path|track|rail|transit/.test(f.props.class) }); }
    for (const f of L.building || []) if (f.type === 3 && !f.props.hide_3d) bld.push({ f, t }); }
  fills.sort((a, b) => a.z - b.z);
  for (const it of fills){ g.fillStyle = it.c; path(it.f.parts, proj(it.t, it.f.extent)); g.fill('evenodd'); }
  g.lineCap = g.lineJoin = 'round';
  lines.sort((a, b) => a.z - b.z);
  for (const it of lines) if (it.casing){ g.strokeStyle = '#d2cdc4'; g.lineWidth = Math.max(1, (it.w + 2.5) * pxPerM); path(it.f.parts, proj(it.t, it.f.extent)); g.stroke(); }
  for (const it of lines){ g.strokeStyle = it.c; g.lineWidth = Math.max(1, it.w * pxPerM); path(it.f.parts, proj(it.t, it.f.extent)); g.stroke(); }
  // country and region borders (what you see from far out), a fixed thin line
  g.setLineDash([6, 4]);
  for (const t of tiles) for (const f of t.layers.boundary || []){ if (f.type !== 2 || f.props.maritime || !(f.props.admin_level <= 4)) continue;
    g.strokeStyle = f.props.admin_level <= 2 ? '#8e8e96' : '#b4b4bb'; g.lineWidth = f.props.admin_level <= 2 ? 1.6 : 1; path(f.parts, proj(t, f.extent)); g.stroke(); }
  g.setLineDash([]);
  return bld;
}
export const GROUND_COLOUR = GROUND;

// ---------------------------------------------------------------- load
export async function tileTemplate(){
  try { const r = await fetch(TILEJSON); if (r.ok){ const j = await r.json(); if (j.tiles && j.tiles[0]) return j.tiles[0]; } } catch (e){}
  return FALLBACK;
}

/** OSM buildings inside a lon/lat box, straight from the z14 tiles (for when a map has not loaded any).
 *  plan([lon, lat]) → [x, y] metres. Returns [{ ring, h, h0 }] for buildingMesh. At most maxTiles tiles (the box's centre wins). */
export async function osmBuildingsIn(west, south, east, north, plan, opt = {}){
  const n = 2 ** Z, tx = lon => Math.floor((lon + 180) / 360 * n), ty = lat => { const r = lat * Math.PI / 180; return Math.floor((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2 * n); };
  let x0 = tx(west), x1 = tx(east), y0 = ty(north), y1 = ty(south); const max = opt.maxTiles || 16, side = Math.floor(Math.sqrt(max));
  if ((x1 - x0 + 1) * (y1 - y0 + 1) > max){ const cx = (x0 + x1) >> 1, cy = (y0 + y1) >> 1, a = Math.floor((side - 1) / 2); x0 = Math.max(x0, cx - a); x1 = Math.min(x1, x0 + side - 1); y0 = Math.max(y0, cy - a); y1 = Math.min(y1, y0 + side - 1); }
  const tpl = opt.tiles || await tileTemplate(), jobs = [];
  for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) jobs.push({ x, y });
  let done = 0; opt.onProgress?.(0, jobs.length);
  const toLL = (t, ext) => q => { const u = (t.x + q[0] / ext) / n, v = (t.y + q[1] / ext) / n; return [u * 360 - 180, Math.atan(Math.sinh(Math.PI * (1 - 2 * v))) * 180 / Math.PI]; };
  const out = [];
  await Promise.all(jobs.map(async t => { const res = await fetch(tpl.replace('{z}', Z).replace('{x}', t.x).replace('{y}', t.y)); if (!res.ok) throw new Error('OSM tile ' + t.x + '/' + t.y + ': HTTP ' + res.status);
    const L = decodeMVT(await res.arrayBuffer()); opt.onProgress?.(++done, jobs.length);
    for (const f of L.building || []){ if (f.type !== 3 || f.props.hide_3d) continue; const ll = toLL(t, f.extent), h = +f.props.render_height || +f.props.height || 8, h0 = +f.props.render_min_height || 0;
      for (const part of f.parts){ if (part.length < 4) continue; const ring = part.map(q => plan(ll(q))); if (area2(ring) >= 0) continue; out.push({ ring, h, h0 }); } } }));
  return { list: out, tiles: jobs.length, partial: (tx(east) - tx(west) + 1) * (ty(south) - ty(north) + 1) > jobs.length };
}

/** lat, lon: centre (WGS84) · r: half side in metres · opt.tiles: a tile URL template (tests) · opt.onProgress(text) */
export async function osmScene(lat, lon, r = 900, opt = {}){
  r = Math.max(200, Math.min(2500, r));
  const say = opt.onProgress || (() => {});
  const K = Math.cos(lat * Math.PI / 180), mx0 = R_EARTH * lon * Math.PI / 180, my0 = R_EARTH * Math.log(Math.tan(Math.PI / 4 + lat * Math.PI / 360));
  const half = r / K, world = 2 * Math.PI * R_EARTH, tileM = world / 2 ** Z;
  const tx = m => Math.floor((m + world / 2) / tileM), ty = m => Math.floor((world / 2 - m) / tileM);
  const x0 = tx(mx0 - half), x1 = tx(mx0 + half), y0 = ty(my0 + half), y1 = ty(my0 - half);
  const tpl = opt.tiles || await tileTemplate(), jobs = [];
  for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) jobs.push({ x, y, url: tpl.replace('{z}', Z).replace('{x}', x).replace('{y}', y) });
  let done = 0; say(`OSM 0 / ${jobs.length}`);
  const tiles = await Promise.all(jobs.map(async j => { const res = await fetch(j.url); if (!res.ok) throw new Error('OSM tile ' + j.x + '/' + j.y + ': HTTP ' + res.status);
    const t = { ...j, layers: decodeMVT(await res.arrayBuffer()) }; say(`OSM ${++done} / ${jobs.length}`); return t; }));

  // tile units → plan metres, 0 … 2r both ways, centre at (r, r), y north
  const S = 2 * r;
  const toPlan = (t, ext) => q => { const mx = (t.x + q[0] / ext) * tileM - world / 2, my = world / 2 - (t.y + q[1] / ext) * tileM; return [(mx - mx0) * K + r, (my - my0) * K + r]; };

  // ground texture
  const PX = opt.texture || 2048, cv = document.createElement('canvas'); cv.width = cv.height = PX; const g = cv.getContext('2d'), s = PX / S;
  g.fillStyle = GROUND; g.fillRect(0, 0, PX, PX);
  const bld = paintLayers(g, tiles, (t, ext) => { const plan = toPlan(t, ext); return q => { const [x, y] = plan(q); return [x * s, (S - y) * s]; }; }, s);
  // buildings → prisms (outer rings only; MVT outer rings have negative area once y points north)
  const list = [];
  for (const { f, t } of bld){ const plan = toPlan(t, f.extent), h = +f.props.render_height || +f.props.height || 8, h0 = +f.props.render_min_height || 0;
    for (const part of f.parts){ if (part.length < 4) continue; const ring = part.map(plan); if (area2(ring) >= 0) continue; list.push({ ring, h, h0 }); } }
  const B = buildingMesh(list, r, r, S, S);
  return {
    D: { landMask: null, fixed: { streets: [], bridges: [] } }, nx: 3, ny: 3, cell: r, ENV: null, FR: null, DR: null,
    ground: cv, extra: B.mesh, buildings: B.count,
    outlines: [], view: { exag: 1 }, streets: () => [], lines: () => [], finished: () => true,
    meta: { lat, lon, r, tiles: jobs.length }
  };
}
