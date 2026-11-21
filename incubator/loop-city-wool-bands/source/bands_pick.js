// ================================================================ step 17 (27 inside the page): the parcels taken for the tensor field
// Rules (the user, 21 Nov 2026):
//   - the tensor field runs on URBAN parcels only: those are the ones to take
//   - a PARK (a small parcel between the roads) can be taken with them. It is carried along, drawn solid in the base,
//     and the tensor field never runs on it: a park stays a park
//   - FARMING, PROTECTED and OPEN parcels cannot be taken: they stay as they are
// A parcel is taken as the roads leave it at their true widths, corners rounded: the same picture as step 16, worked
// out on a fine grid round the parcel and traced as an outline. Everything that leaves the page is in British
// National Grid metres, in the package the base for the tensor field already reads.
const BP = { sel: new Map(), of: null, cache: new Map(), boxes: null, wait: 0, zoomT: 0, hov: null, hovT: 0 };
const BP_CLS = { H: 'M', 60: 'A', 48: 'B', 30: 'C', 24: 'C' };       // the letters the base page reads: boundary highway, primary road, A road, B road
const BP_NAME = { H: 'boundary highway', 60: 'primary road', 48: 'A road', 30: 'B road', 24: 'B road' }, BP_USE = [null, 'urban', 'farming', 'park', 'open', 'protected'];
const BP_NO = { 2: 'A farming parcel stays a farm parcel: it is not taken for the tensor field.', 4: 'This parcel is left open: it is not taken for the tensor field.', 5: 'Protected landscape is kept open: it is not taken for the tensor field.' };

function bpFresh() {                             // what was taken belongs to one network: a new network, a new road width, and it is dropped
  const R = BD.res, k = R ? [BD.key, R.hkey, R.ukey, BD.p.wB, BD.p.wA, BD.p.wP, BD.p.wH, BD.p.fillet].join('|') : '';
  if (BP.of !== k) { BP.sel = new Map(); BP.cache = new Map(); BP.boxes = null; BP.hov = null; BP.of = k; }
}
function bpBoxes(R) {                            // for every parcel of the 28 m grid: first and last column and row
  if (BP.boxes && BP.boxes.R === R) return BP.boxes.b;
  const BL = R.blocks, n = BL.n, b = new Int32Array(4 * (n + 1)), lab = BL.label;
  for (let t = 0; t <= n; t++) { b[4 * t] = 1e9; b[4 * t + 1] = 1e9; b[4 * t + 2] = -1; b[4 * t + 3] = -1; }
  for (let r = 0; r < R.H; r++) for (let c = 0; c < R.W; c++) { const t = lab[r * R.W + c]; if (!t) continue; const o = 4 * t; if (c < b[o]) b[o] = c; if (r < b[o + 1]) b[o + 1] = r; if (c > b[o + 2]) b[o + 2] = c; if (r > b[o + 3]) b[o + 3] = r; }
  BP.boxes = { R, b }; return b;
}
function bpAt(x, y) {                            // the parcel at a place; on a road, the parcel beside it
  const R = BD.res; if (!R) return 0;
  const c0 = Math.floor((x - R.box[0]) / R.px), r0 = Math.floor((R.box[3] - y) / R.px), lab = R.blocks.label;
  for (let d = 0; d <= 3; d++) { let best = 0, bd = 1e9;
    for (let r = r0 - d; r <= r0 + d; r++) for (let c = c0 - d; c <= c0 + d; c++) { if (c < 0 || r < 0 || c >= R.W || r >= R.H) continue; const t = lab[r * R.W + c]; if (!t) continue; const q = (c - c0) * (c - c0) + (r - r0) * (r - r0); if (q < bd) { bd = q; best = t; } }
    if (best) return best; }
  return 0;
}
function bpData(t) {                             // one parcel as the roads leave it: outline, holes, the roads along it
  if (BP.cache.has(t)) return BP.cache.get(t);
  const R = BD.res, BL = R.blocks, bb = bpBoxes(R), px = R.px, pad = 170;
  const x0 = R.box[0] + bb[4 * t] * px - pad, x1 = R.box[0] + (bb[4 * t + 2] + 1) * px + pad, y1 = R.box[3] - bb[4 * t + 1] * px + pad, y0 = R.box[3] - (bb[4 * t + 3] + 1) * px - pad;
  const g = Math.max(3, Math.max(x1 - x0, y1 - y0) / 900), w = Math.ceil((x1 - x0) / g), h = Math.ceil((y1 - y0) / g);
  const T = bdRaster(x0, y1, w, h, g, 1), F = new Float32Array(w * h);
  for (let i = 0; i < F.length; i++) { const b = T.lab[i]; if (!b || T.of[b] !== t) continue; if (T.rad[b] > 1e8) { F[i] = 1; continue; } const v = 0.5 + T.rad[b] - Math.sqrt(T.d2[i]); F[i] = v <= 0 ? 0 : v >= 1 ? 1 : v; }
  const rings = G.contours(F, w, h, 0.5).map(r => { const o = []; for (let i = 0; i < r.length; i += 2) o.push(x0 + (r[i] + 0.5) * g, y1 - (r[i + 1] + 0.5) * g); return smoothClosed(o, 1); })
    .filter(r => Math.abs(pkArea(r)) > 600).sort((a, b) => Math.abs(pkArea(b)) - Math.abs(pkArea(a)));
  if (!rings.length) { BP.cache.set(t, null); return null; }
  const out = [rings[0]], holes = [];
  rings.slice(1).forEach(q => (inRing(rings[0], q[0], q[1]) ? holes : out).push(q));
  const bbs = out.map(q => pkBox(q, 120)), near = (x, y, lim) => out.some((q, k) => x >= bbs[k][0] && x <= bbs[k][2] && y >= bbs[k][1] && y <= bbs[k][3] && pkDist(q, x, y) <= lim);
  const roads = [], add = (cl, p, name) => {     // the stretches of road that run along the parcel (40 m or more)
    const eb = pkBox(p, 0); if (!bbs.some(b => eb[0] <= b[2] && eb[2] >= b[0] && eb[1] <= b[3] && eb[3] >= b[1])) return;
    const d = pkDense(p, 10), lim = bdW(cl) / 2 + 30; let run = [];
    const flush = () => { if (run.length >= 10) roads.push({ cls: BP_CLS[cl], cl, name: name || '', p: run }); run = []; };
    for (let k = 0; k < d.length; k += 2) { if (near(d[k], d[k + 1], lim)) run.push(d[k], d[k + 1]); else flush(); }
    flush(); };
  for (const e of R.edges) if (e.draw && e.cl) add(e.cl, e.pts);
  for (const x of (R.X || [])) add(x.wk, x.P, x.n);
  let area = 0; out.forEach(q => { area += Math.abs(pkArea(q)); }); holes.forEach(q => { area -= Math.abs(pkArea(q)); });
  const b0 = pkBox(out[0], 0), mx = (b0[0] + b0[2]) / 2, my = (b0[1] + b0[3]) / 2;
  let cell = DATA.cells.find(c => inRing(c.ring, mx, my)) || DATA.cells.find(c => inRing(c.ring, out[0][0], out[0][1]));
  if (!cell) { let m = Infinity; for (const c of DATA.cells) { const d = pkDist(c.ring, mx, my); if (d < m) { m = d; cell = c; } } }
  const d = { t, id: (cell ? cell.id : 'C') + '.' + t, cell: cell ? cell.id : '', use: BP_USE[BL.cls[t]] || 'urban', ha: area / 1e4, out, holes, roads, stops: [], perim: pkRing(out[0]), roadM: roads.reduce((s, q) => s + pkLine(q.p), 0) };
  BP.cache.set(t, d); return d;
}
function bpList() { bpFresh(); return [...BP.sel.values()]; }

// ---------------------------------------------------------------- picking: click one, shift-click for more, double-click to open them
function bdPickAt(px, py, add, dbl) {
  bpFresh(); clearTimeout(BP.wait); clearTimeout(BP.zoomT);
  const R = BD.res; if (!R) { setStatus('The network is not traced yet.'); return; }
  const t = bpAt(wx(px), wy(py)), u = t ? R.blocks.cls[t] : 0;
  if (!t || !u) { if (!add && !dbl && BP.sel.size) { BP.sel = new Map(); nums(); schedule(); } return; }
  if (u !== 1 && u !== 3) { setStatus(BP_NO[u] || 'This parcel is not taken for the tensor field.'); return; }
  const take = () => { if (!BP.sel.has(t)) { const d = bpData(t); if (d) BP.sel.set(t, d); } return BP.sel.get(t); };
  if (dbl) { take(); nums(); schedule(); bdSend(); return; }
  if (add) { if (BP.sel.has(t)) BP.sel.delete(t); else take(); }
  else if (BP.sel.size > 1 && BP.sel.has(t)) {    // perhaps the first half of a double-click: wait before keeping only this one
    const d = BP.sel.get(t);
    BP.wait = setTimeout(() => { BP.sel = new Map([[t, d]]); nums(); schedule(); pickZoom(d); }, PICK.DELAY); return;
  } else { const d = BP.sel.get(t) || bpData(t); if (!d) return; BP.sel = new Map([[t, d]]); BP.zoomT = setTimeout(() => pickZoom(d), PICK.DELAY); }
  const L = [...BP.sel.values()], nu = L.filter(d => d.use === 'urban').length, np = L.length - nu;
  setStatus(L.length ? `Taken: ${nu} urban parcel${nu === 1 ? '' : 's'}${np ? ` and ${np} park${np === 1 ? '' : 's'} (parks stay parks)` : ''}. Shift-click for more, double-click to open them.` : 'Nothing taken.');
  nums(); schedule();
}
function bdPickHover(e) {                        // the parcel under the pointer shows its outline before the click
  if (S.step !== 27 || S.edit || !BD.res) { if (BP.hov) { BP.hov = null; schedule(); } return; }
  const r = cv.getBoundingClientRect(), x = wx(e.clientX - r.left), y = wy(e.clientY - r.top);
  clearTimeout(BP.hovT);
  BP.hovT = setTimeout(() => { if (S.step !== 27 || !BD.res || S.drag) return; bpFresh();
    const t = bpAt(x, y), u = t ? BD.res.blocks.cls[t] : 0, ok = u === 1 || u === 3;
    cv.style.cursor = ok || !u ? 'crosshair' : 'not-allowed';
    const d = ok ? bpData(t) : null; if (d !== BP.hov) { BP.hov = d; schedule(); } }, 80);
}
function bdStepUI(n) {
  const el = $('bdExtract'); if (el) el.hidden = n !== 27;
  if (n !== 27) { BP.hov = null; clearTimeout(BP.hovT); }
}
function bdPickLayer() {
  const L = bpList(), c = PICK.col(), light = V.theme === 'light', pc = bdC().use[3];
  cx.save(); cx.lineJoin = 'round'; cx.lineCap = 'round';
  if (BP.hov && !BP.sel.has(BP.hov.t)) { cx.beginPath(); BP.hov.out.concat(BP.hov.holes).forEach(q => path(cx, q, true)); cx.strokeStyle = c; cx.lineWidth = 1.6; cx.stroke(); }
  for (const d of L) {
    cx.beginPath(); d.out.concat(d.holes).forEach(q => path(cx, q, true));
    if (d.use === 'park') { cx.fillStyle = pc; cx.fill('evenodd'); cx.setLineDash([6, 4]); cx.strokeStyle = c; cx.lineWidth = 2.2; cx.stroke(); cx.setLineDash([]); }      // a park stays solid: the tensor field does not run on it
    else { cx.fillStyle = c + '2E'; cx.fill('evenodd'); cx.strokeStyle = c; cx.lineWidth = 4; cx.stroke(); }
  }
  cx.font = "600 11px 'DM Sans',system-ui,sans-serif"; cx.textAlign = 'center'; cx.textBaseline = 'middle';
  for (const d of L) {
    const b = pkBox(d.out[0], 0), X = sx((b[0] + b[2]) / 2), Y = sy((b[1] + b[3]) / 2), s = d.id + ' · ' + fmt(d.ha, 1) + ' ha' + (d.use === 'park' ? ' · park' : ''), w = cx.measureText(s).width + 10;
    cx.fillStyle = light ? 'rgba(255,255,255,.85)' : 'rgba(0,0,0,.72)'; cx.fillRect(X - w / 2, Y - 9, w, 18);
    cx.fillStyle = c; cx.fillText(s, X, Y);
  }
  cx.restore();
}
function bdPickNums() {
  const L = bpList(), U = L.filter(d => d.use === 'urban'), K = L.filter(d => d.use === 'park'), rows = [['Parcels taken', L.length ? fmt(L.length) : '–']], sum = a => a.reduce((s, d) => s + d.ha, 0);
  if (L.length) {
    rows.push(['Urban, for the tensor field', `${U.length} · ${fmt(sum(U), 1)} ha`]);
    if (K.length) rows.push(['Parks, they stay parks', `${K.length} · ${fmt(sum(K), 1)} ha`]);
    rows.push(['Roads along them', fmt(L.reduce((s, d) => s + d.roadM, 0) / 1000, 1) + ' km']);
    L.slice(0, 12).forEach(d => rows.push([d.id + (d.use === 'park' ? ' (park)' : ''), fmt(d.ha, 1) + ' ha · ' + fmt(d.perim / 1000, 2) + ' km round']));
    if (L.length > 12) rows.push(['…', '+ ' + (L.length - 12)]);
  }
  const R = BD.res; if (R && R.useN) rows.push(['Urban parcels in all', `${R.useN[1]}`], ['Parks in all', `${R.useN[3]}`]);
  $('nums').innerHTML = rows.map(r => `<tr><td>${trc(r[0])}</td><td>${r[1]}</td></tr>`).join('');
}

// ---------------------------------------------------------------- the package for the base for the tensor field
function bpJunctions(rings) {                    // where three or more roads meet on the site's edge: a short stub across the edge, so the tensor app anchors a street there
  const R = BD.res, deg = new Map(), rk = { H: 4, 60: 3, 48: 2, 30: 1, 24: 1 }, out = [];
  for (const e of R.edges) { if (!e.cl) continue; const q = e.pts, n = q.length;
    [[e.a, q[0], q[1]], [e.b, q[n - 2], q[n - 1]]].forEach(([id, x, y]) => { const v = deg.get(id) || { x, y, n: 0, cl: e.cl }; v.n++; if (rk[e.cl] > rk[v.cl]) v.cl = e.cl; deg.set(id, v); }); }
  deg.forEach(v => {
    if (v.n < 3) return; let best = null;
    rings.forEach(q => { const p = pkNear(q, v.x, v.y); if (!best || p[2] < best[2]) best = p; });
    if (!best || best[2] > bdW(v.cl) / 2 + 40 || best[2] < 1) return;
    const ux = (best[0] - v.x) / best[2], uy = (best[1] - v.y) / best[2];
    out.push({ x: v.x, y: v.y, ex: best[0], ey: best[1], ix: best[0] + ux * 30, iy: best[1] + uy * 30, cls: BP_CLS[v.cl] });
  });
  return out;
}
function bdParcelPackage(L0) {
  const R = BD.res, o = DATA.origin, R1 = v => Math.round(v * 10) / 10, P = (x, y) => [R1(x + o[0]), R1(y + o[1])];
  const pts = p => { const c = []; for (let i = 0; i < p.length; i += 2) c.push(P(p[i], p[i + 1])); return c; };
  const U = L0.filter(d => d.use === 'urban'), K = L0.filter(d => d.use === 'park'), L = U.concat(K);
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  L.forEach(d => d.out.forEach(q => { const b = pkBox(q, 0); x0 = Math.min(x0, b[0]); y0 = Math.min(y0, b[1]); x1 = Math.max(x1, b[2]); y1 = Math.max(y1, b[3]); }));
  const M = 500; x0 -= M; y0 -= M; x1 += M; y1 += M;
  const inW = p => { const b = pkBox(p, 0); return b[0] <= x1 && b[2] >= x0 && b[1] <= y1 && b[3] >= y0; };
  const rings = siteRings(U, [x0, y0, x1, y1]), J = bpJunctions(rings);        // the site is the urban parcels only: the tensor field does not run on a park
  let ground = null;
  try {
    const im = IMG.ground, Wm = DATA.size[0], Hm = DATA.size[1], kx = im.naturalWidth / Wm, ky = im.naturalHeight / Hm;
    const a = Math.max(0, x0 * kx), b = Math.max(0, (Hm - y1) * ky), sw = Math.min(im.naturalWidth, x1 * kx) - a, sh = Math.min(im.naturalHeight, (Hm - y0) * ky) - b;
    if (sw > 2 && sh > 2) {
      const c = document.createElement('canvas'); c.width = Math.round(sw); c.height = Math.round(sh);
      c.getContext('2d').drawImage(im, a, b, sw, sh, 0, 0, c.width, c.height);
      ground = { url: c.toDataURL('image/png'), box: [R1(a / kx + o[0]), R1(Hm - (b + sh) / ky + o[1]), R1((a + sw) / kx + o[0]), R1(Hm - b / ky + o[1])] };
    }
  } catch (err) { ground = null; }
  const roads = [];                             // every road of the hierarchy in the window, with its class and true width; an existing road on its real line
  for (const e of R.edges) if (e.draw && e.cl && inW(e.pts)) roads.push({ cls: BP_CLS[e.cl], width: bdW(e.cl), name: BP_NAME[e.cl], p: pts(e.pts) });
  for (const x of (R.X || [])) if (inW(x.P)) roads.push({ cls: BP_CLS[x.wk], width: bdW(x.wk), name: BP_NAME[x.wk], existing: x.n || true, p: pts(x.P) });
  let surface = [];                             // the roads as they are drawn at step 16, at their true widths, as outlines
  try {
    const g = Math.max(4, Math.max(x1 - x0, y1 - y0) / 1500), w = Math.ceil((x1 - x0) / g), h = Math.ceil((y1 - y0) / g), T = bdRaster(x0, y1, w, h, g, 1), F = new Float32Array(w * h);
    for (let i = 0; i < F.length; i++) { const b = T.lab[i]; F[i] = b && T.d2[i] <= T.rad[b] * T.rad[b] + 0.5 ? 0 : 1; }
    const rs = G.contours(G.blur(F, w, h, 1), w, h, 0.5).map(r => { const q = []; for (let i = 0; i < r.length; i += 2) q.push(x0 + (r[i] + 0.5) * g, y1 - (r[i + 1] + 0.5) * g); return pts(smoothClosed(q, 1)); });
    if (rs.length) surface = [{ cell: [...new Set(L.map(d => d.cell))].join(' '), rings: rs }];
  } catch (err) { surface = []; }
  const K0 = DATA.key, parcel = d => ({ id: d.id, cell: d.cell, use: d.use, ha: Math.round(d.ha * 100) / 100, perimeter_m: Math.round(d.perim),
    outline: pts(d.out[0]), more: d.out.slice(1).map(pts), holes: d.holes.map(pts), roads: d.roads.map(q => ({ cls: q.cls, width: bdW(q.cl), name: BP_NAME[q.cl], p: pts(q.p) })), stops: [] });
  return {
    type: 'loop-city-parcel-package', version: 2, made: new Date().toISOString(), from: 'Loop City wool bands v3 · step 17, Extract parcels',
    crs: 'EPSG:27700', units: 'metres, British National Grid',
    rules: ['The tensor field runs on the urban parcels only: site.rings is their outline.', 'A park stays a park: it is listed in parks, drawn solid, and the tensor field must not run on it.',
            'Farming, protected and open parcels are not taken: they stay as they are.', 'Road classes: M boundary highway (the cell edge), A primary road, B A road, C B road; width is the true width in metres.'],
    window: [R1(x0 + o[0]), R1(y0 + o[1]), R1(x1 + o[0]), R1(y1 + o[1])],
    cells: [...new Set(L.map(d => d.cell))],
    stations: DATA.stations.filter(s => s.x >= x0 - 3000 && s.x <= x1 + 3000 && s.y >= y0 - 3000 && s.y <= y1 + 3000).map(s => ({ id: s.id, at: P(s.x, s.y) })),
    parcels: U.map(parcel), parks: K.map(parcel),
    site: { rings: rings.map(pts), junctions: J.map(j => ({ cls: j.cls, at: P(j.x, j.y), edge: P(j.ex, j.ey), stub: [P(j.x, j.y), P(j.ix, j.iy)] })) },
    roads, stops: [], surface, existing_in_roads: true,
    existing: { roads: (DATA.roads || []).filter(r => inW(r.p)).map(r => ({ c: r.c, n: r.n, p: pts(r.p) })),
                rail: (DATA.rail || []).filter(r => inW(r.p)).map(r => ({ kind: r.kind, p: pts(r.p) })),
                water: (DATA.water || []).filter(w => inW(w.p)).map(w => pts(w.p)),
                towns: (DATA.townsAll || []).filter(t => inW(t.p)).map(t => pts(t.p)) },
    ground,
    key: DATA.img && DATA.img.key && K0 ? { url: DATA.img.key, w: K0.w, h: K0.h, box: [R1(K0.box[0] + o[0]), R1(K0.box[1] + o[1]), R1(K0.box[2] + o[0]), R1(K0.box[3] + o[1])] } : null };
}
function bpReady() {
  const L = bpList();
  if (!L.length) { setStatus('Click an urban parcel first.'); return null; }
  if (!L.some(d => d.use === 'urban')) { setStatus('Take at least one urban parcel: the tensor field does not run on parks.'); return null; }
  return L;
}
function bpName(L) { const ids = L.map(d => d.id); return ids.length <= 4 ? ids.join(' ') : ids.length + ' parcels in ' + [...new Set(L.map(d => d.cell))].join(' '); }
function bdSend() {
  const L = bpReady(); if (!L) return;
  BASE.pkg = bdParcelPackage(L);
  BASE.win = window.open(BASE.PAGE, BASE.NAME);
  if (!BASE.win) { setStatus('The browser blocked the new window. Allow pop-ups for this page, then try again.'); return; }
  setStatus('Opening the parcels in the base for the tensor field…');
  clearTimeout(BASE.waitT);
  BASE.waitT = setTimeout(() => setStatus('The base page did not answer. It should sit beside this page. Save the parcels (file) and open them there instead.'), 8000);
}
function bdSavePkg() { const L = bpReady(); if (L) download('Parcel package - ' + bpName(L) + '.json', new Blob([JSON.stringify(bdParcelPackage(L))], { type: 'application/json' })); }
function bdSaveDxf() { const L = bpReady(); if (L) download('Wool parcels - ' + bpName(L) + ' (BNG metres).dxf', new Blob([pickDXF(L)], { type: 'application/dxf' })); }
function bdSaveGeo() {
  const L = bpReady(); if (!L) return;
  const o = DATA.origin, P = (x, y) => [+(x + o[0]).toFixed(2), +(y + o[1]).toFixed(2)], line = p => { const c = []; for (let i = 0; i < p.length; i += 2) c.push(P(p[i], p[i + 1])); return c; }, ring = r => { const c = line(r); c.push(c[0].slice()); return c; }, F = [];
  L.forEach(d => {
    const polys = d.out.map((q, k) => (k ? [ring(q)] : [ring(q), ...d.holes.map(ring)]));
    F.push({ type: 'Feature', properties: { layer: d.use === 'park' ? 'park (stays a park)' : 'parcel', id: d.id, cell: d.cell, use: d.use, ha: Math.round(d.ha * 100) / 100, perimeter_m: Math.round(d.perim) }, geometry: polys.length === 1 ? { type: 'Polygon', coordinates: polys[0] } : { type: 'MultiPolygon', coordinates: polys } });
    d.roads.forEach(q => F.push({ type: 'Feature', properties: { layer: 'road', class: BP_NAME[q.cl], width_m: bdW(q.cl), existing: q.name || '', parcel: d.id }, geometry: { type: 'LineString', coordinates: line(q.p) } }));
  });
  download('Wool parcels - ' + bpName(L) + ' (BNG metres).geojson', new Blob([JSON.stringify({ type: 'FeatureCollection', name: 'Loop City wool parcels', crs: { type: 'name', properties: { name: 'urn:ogc:def:crs:EPSG::27700' } }, features: F })], { type: 'application/geo+json' }));
}
