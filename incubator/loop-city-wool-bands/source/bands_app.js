// ================================================================ the wool bands: steps 11 to 16 of this copy (21 Nov 2026)
// The relaxed wool is read as bands (the mass of the threads), joined to the existing roads and the cell edge, tidied,
// its small parcels merged, the parcels coloured by use, and the roads drawn at their true widths. The maths is in
// bands.js (window.Bands); this part holds the settings, the sliders and the drawing. Steps are numbered 21 to 26
// inside the page so nothing of the older steps 11 to 16 runs.
const BD = { res: null, key: '', busy: false, tv: null, tvTimer: 0, useImg: null, useKey: '', cache: new Map(),
  p: { thread: 3, close1: 3, attract: 1, reach: 250, rim: 7, rmax: 4, narrow: 3, ends: 1, sigma: 90, small: 12, smallMax: 30, park: 25, farm: 50,
       wB: 24, wA: 48, wH: 90, fillet: 110, oppw: 2, useFrom: 1, r2: 2.5, r3: 1.25, exfirst: 1, wP: 60, line: 320 },
  col: { light: { band: '#965632', bandA: 0.26, edge: '#965632', B: '#8A5A2B', 48: '#1F5FA8', 60: '#C22A22', H: '#4D4D4D', core: '#111111', use: [null, '#E4BBA1', '#C2CDAB', '#DDE5CF', '#EFE6D3', '#EAF1DE'], town: '#C5BDB3', townEdge: '#605C59' },
         dark: { band: '#FFFFFF', bandA: 0.34, edge: '#E8E8E8', B: '#C9996A', 48: '#4AA3FF', 60: '#FF4B3A', H: '#D2D2D2', core: '#FFFFFF', use: [null, '#6B4636', '#3A4724', '#617343', '#4A4032', '#2C3A33'], town: '#2A2725', townEdge: '#3B3734' } } };
if (V.bdK === undefined) V.bdK = 2;
if (V.bdMode === undefined) V.bdMode = 'true';
// road colours: one family a choice, the hierarchy read by thickness and by tone (boundary, primary, A road, B road), then the centre line of an existing road
BD.pal = { dark: [{ n: 'Shades of grey', c: ['#FFFFFF', '#DEDEDE', '#B2B2B2', '#878787'], core: '#000000' }, { n: 'Shades of yellow', c: ['#FFF6C7', '#FFD83D', '#D9A82E', '#A8884A'], core: '#000000' },
                   { n: 'Cream to copper', c: ['#FFF1E0', '#F2C9A0', '#D9A27E', '#A87B5C'], core: '#000000' }, { n: 'Ice', c: ['#FFFFFF', '#CFE6F5', '#93BFDD', '#6593B5'], core: '#000000' },
                   { n: 'Grey, red, blue, copper', c: ['#D2D2D2', '#FF4B3A', '#4AA3FF', '#C9996A'], core: '#FFFFFF' }],
           light: [{ n: 'Dark greys', c: ['#141414', '#333333', '#555555', '#7C7C7C'], core: '#FFFFFF' }, { n: 'Shades of brown', c: ['#2E1F16', '#5A3A22', '#8A5A2B', '#B07F4C'], core: '#FFFFFF' },
                   { n: 'Charcoal boundary, grey-brown roads', c: ['#1A1A1A', '#4A3F36', '#6F6258', '#9A8B7D'], core: '#FFFFFF' }, { n: 'Grey-brown', c: ['#2B2622', '#4E443C', '#776A5F', '#A39484'], core: '#FFFFFF' },
                   { n: 'Grey, red, blue, brown', c: ['#4D4D4D', '#C22A22', '#1F5FA8', '#8A5A2B'], core: '#111111' }] };      // chosen 21 Nov: grey in dark mode, dark greys in light mode (the first of each)
if (!V.bdPal || typeof V.bdPal !== 'object' || V.bdPalV !== 2) { V.bdPal = { dark: 0, light: 0 }; V.bdPalV = 2; }      // v2: the list changed, so an older stored choice is dropped
const bdTheme = () => (V.theme === 'light' ? 'light' : 'dark');
const bdC = () => { const t = bdTheme(), q = BD.pal[t][V.bdPal[t]] || BD.pal[t][0]; return Object.assign({}, BD.col[t], { H: q.c[0], 60: q.c[1], 48: q.c[2], B: q.c[3], core: q.core }); };
function bdPalSync() { const t = bdTheme(); document.querySelectorAll('#bdPal [data-bdp]').forEach(b => { const q = BD.pal[t][+b.dataset.bdp]; b.classList.toggle('on', +b.dataset.bdp === (V.bdPal[t] || 0)); b.title = q.n; b.style.background = `linear-gradient(90deg, ${q.c[0]} 0 25%, ${q.c[1]} 25% 50%, ${q.c[2]} 50% 75%, ${q.c[3]} 75%)`; });
  const el = document.getElementById('bdPalName'); if (el) el.textContent = (BD.pal[t][V.bdPal[t]] || BD.pal[t][0]).n + ': boundary, primary, A road, B road.'; }
const bdRGB = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const bdStage = () => ({ 21: 'bands', 22: 'integrated' }[S.step] || 'final');

STEP_LAYERS[21] = { towns: 1, roads: 1, rail: 1, threads: 1, edge: 1, bdband: 1 }; STEP_LAYERS[22] = { towns: 1, roads: 1, rail: 1, bdband: 1 };
STEP_LAYERS[23] = { towns: 1, roads: 1, rail: 1, bdband: 1 }; STEP_LAYERS[24] = { towns: 1, roads: 1, rail: 1, bdband: 1 }; STEP_LAYERS[25] = { rail: 1, bduse: 1, bdtown: 1, bdband: 1 };
STEP_LAYERS[26] = { rail: 1, bduse: 1, bdtown: 1, bdroad: 1, bdex: 1 }; STEP_LAYERS[27] = { rail: 1, bduse: 1, bdtown: 1, bdroad: 1, bdex: 1, bdpick: 1 };
STEP_HINT[27] = 'The last step, always at true road widths: the parcels that go on to the tensor field. Click an urban parcel, shift-click for more, double-click to open them in the base for the tensor field. Parks can be taken with them and stay parks. Farming and protected land is not taken.';
const bdOp = k => (V.op[k] === undefined ? 100 : V.op[k]) / 100;
STEP_HINT[21] = 'The relaxed wool read as one mass: every thread is a band, wider where more threads run together, and where bands meet the corner is rounded. The band is the road; its two edges are the double line.';
STEP_HINT[22] = 'The same mass with the existing roads and the cell edge in it. A new band that runs beside an existing road, in its direction, is pulled onto it, so the two merge.';
STEP_HINT[23] = 'Fine tuning: wide masses where many bands meet are rebuilt as the roads that run through them, blocks too narrow to be parcels are closed, and every open end is carried straight on to the next road.';
STEP_HINT[24] = 'Small blocks that sit next to each other are merged into bigger parcels. Never across an existing road or the cell edge.';
STEP_HINT[25] = 'The parcels by use, read from the growth result: urban where over half is built, farming where over half is farming, a park where the parcel is small, kept open inside a protected landscape. Built-up area today on top.';
STEP_HINT[26] = 'The road hierarchy in four classes, at true widths. The cell edge is the boundary highway. Every existing road keeps one class from end to end, and a whole existing road is raised before a new road is made. On the right, draw the roads wider than true to read them from afar.';

function bdParams() {
  const p = BD.p;
  return { px: 28, outlineAlign: 'pixel', threadPx: p.thread, close1: p.close1, attract: { on: !!p.attract, reach: p.reach, angle: 30, minLen: 300 }, rim: p.rim, rmax: p.rmax, narrow: p.narrow,
           closeEnds: !!p.ends, sigma: p.sigma, small: S.step >= 24 ? p.small : 0, smallMax: p.smallMax, parkHa: p.park, farmShare: p.farm / 100 };
}
function bdInput() {
  let x0 = 1e18, y0 = 1e18, x1 = -1e18, y1 = -1e18;
  for (const c of DATA.cells) for (let i = 0; i + 1 < c.ring.length; i += 2) { x0 = Math.min(x0, c.ring[i]); x1 = Math.max(x1, c.ring[i]); y0 = Math.min(y0, c.ring[i + 1]); y1 = Math.max(y1, c.ring[i + 1]); }
  const near = p => { for (let i = 0; i + 1 < p.length; i += 2) if (p[i] > x0 - 3000 && p[i] < x1 + 3000 && p[i + 1] > y0 - 3000 && p[i + 1] < y1 + 3000) return true; return false; };
  const threads = []; (S.relaxed || []).forEach(a => (a || []).forEach(l => threads.push(Array.from(l))));
  return { cells: DATA.cells.map(c => ({ id: c.id, ring: Array.from(c.ring) })), towns: (DATA.towns || []).filter(near).map(t => Array.from(t)),
           farm: (DATA.zones || []).filter(z => z.kind === 'farm').map(z => Array.from(z.rings[0])),
           existing: (typeof EXIST !== 'undefined' ? EXIST : []).filter(q => near(q.p)).map(q => ({ c: EX_CLS[q.c] || q.c, p: Array.from(q.p) })),
           threads, marks: null };
}
function bdEnsure() {
  if (!S.relaxed || !window.Bands || BD.busy) return;
  const pr = bdParams(), key = JSON.stringify(pr) + '|' + (S.relaxId || 0);
  if (key === BD.key) return;
  if (BD.cache.has(key)) { BD.res = BD.cache.get(key); bdHierarchy(BD.res); bdUse(BD.res); BD.key = key; BD.tv = null; BD.useImg = null; legend(); nums(); schedule(); return; }   // steps 11 to 13 and 14 to 16 differ only by the merge: both are kept
  BD.busy = true; setStatus('Tracing the network from the wool…');
  setTimeout(() => {
    const t0 = performance.now();
    try { BD.res = Bands.run(bdInput(), pr); for (const e of BD.res.edges) e.pts0 = Float64Array.from(e.pts); bdHierarchy(BD.res); bdUse(BD.res);
      setStatus(`Network traced in ${fmt((performance.now() - t0) / 1000, 1)} s.`); }
    catch (err) { console.error(err); BD.res = null; setStatus('The network could not be traced: ' + err.message); }
    if (BD.res) { if (BD.cache.size > 3) BD.cache.delete(BD.cache.keys().next().value); BD.cache.set(key, BD.res); }
    BD.key = key; BD.tv = null; BD.useImg = null; BD.busy = false; legend(); nums(); schedule();
    if (JSON.stringify(bdParams()) + '|' + (S.relaxId || 0) !== BD.key) bdEnsure();
  }, 40);
}
let bdLater = 0;
function bdChanged() { clearTimeout(bdLater); bdLater = setTimeout(() => { if (S.step > 20) bdEnsure(); }, 260); }

// ---------------------------------------------------------------- the hierarchy: the rule itself is in bands_hier.js (bhHierarchy)
function bdStrokes(E) {
  const at = new Map(), par = E.map((_, i) => i), find = i => { while (par[i] !== i) { par[i] = par[par[i]]; i = par[i]; } return i; };
  const arm = (node, i, x0, y0, x1, y1) => { const dx = x1 - x0, dy = y1 - y0, L = Math.hypot(dx, dy) || 1e-9; if (!at.has(node)) at.set(node, []); at.get(node).push([i, dx / L, dy / L]); };
  E.forEach((e, i) => { const q = e.pts, n = q.length / 2, k = Math.min(n - 1, 8); arm(e.a, i, q[0], q[1], q[2 * k], q[2 * k + 1]); arm(e.b, i, q[2 * n - 2], q[2 * n - 1], q[2 * (n - 1 - k)], q[2 * (n - 1 - k) + 1]); });
  for (const arms of at.values()) {
    const pairs = []; for (let a = 0; a < arms.length; a++) for (let b = a + 1; b < arms.length; b++) pairs.push([arms[a][1] * arms[b][1] + arms[a][2] * arms[b][2], arms[a][0], arms[b][0]]);
    pairs.sort((u, v) => u[0] - v[0]); const used = new Set();
    for (const [dot, i, j] of pairs) { if (dot > -0.6) break; if (used.has(i) || used.has(j) || i === j || !!E[i].rim !== !!E[j].rim) continue; used.add(i); used.add(j); par[find(i)] = find(j); }
  }
  return E.map((_, i) => find(i));
}
function bdHierarchy(R) {                        // worked out again only when its own settings change
  const o = { r2: BD.p.r2 * 1000, r3: BD.p.r3 * 1000, exfirst: !!BD.p.exfirst, line: BD.p.line }, key = JSON.stringify(o);
  if (R.hkey === key) return; bhHierarchy(R, o); R.hkey = key; BD.hk = (BD.hk || 0) + 1;
}
let bdRh = 0;
function bdRehier() {
  clearTimeout(bdRh); bdRh = setTimeout(() => { if (!BD.res) return; setStatus('Working out the road hierarchy…');
    setTimeout(() => { try { bdHierarchy(BD.res); setStatus(`Road hierarchy worked out in ${fmt(BD.res.hier.ms / 1000, 1)} s.`); } catch (e) { console.error(e); setStatus('The road hierarchy failed: ' + e.message); }
      BD.tv = null; legend(); nums(); schedule(); }, 30); }, 300);
}

// ---------------------------------------------------------------- parcel use
// From the Growth Simulator (when the cell package carries its result): a parcel is farming where over half of it is
// farming in the growth result, urban where over half is built (built-up today counts as built). Where neither is over
// half the larger decides; where the growth result gives no use the parcel is left open; a parcel over half inside a
// protected landscape is kept open; a parcel under the park size is a park. Without growth data, or when "from the
// soil" is chosen, the use comes from the soil as before (bands.js).
function bdMaskOf(R, rings, toLocal) {            // polygons painted on the grid of the result
  const c = document.createElement('canvas'); c.width = R.W; c.height = R.H; const g = c.getContext('2d', { willReadFrequently: true }), [x0, , , y1] = R.box; g.fillStyle = '#fff';
  for (const r of rings) { g.beginPath(); for (let i = 0; i < r.length; i += 2) { const x = toLocal ? r[i] - DATA.origin[0] : r[i], y = toLocal ? r[i + 1] - DATA.origin[1] : r[i + 1]; g[i ? 'lineTo' : 'moveTo']((x - x0) / R.px, (y1 - y) / R.px); } g.closePath(); g.fill(); }      // each outline on its own: a town listed by two cells must not cancel itself out
  const d = g.getImageData(0, 0, R.W, R.H).data, m = new Uint8Array(R.W * R.H); for (let i = 0; i < m.length; i++) m[i] = d[4 * i + 3] > 100 ? 1 : 0; return m;
}
function bdUse(R) {
  const BL = R.blocks, n = BL.n, pk = window.__BD_PKG__ || {}, G = pk.growth, key = [BD.p.useFrom, BD.p.park, BD.p.farm, G ? 1 : 0].join('|');
  if (R.ukey === key) return; if (!BL.cls0) BL.cls0 = Uint8Array.from(BL.cls);
  const lab = BL.label, W = R.W, H = R.H, px = R.px, [x0, , , y1] = R.box, cnt = new Float64Array(n + 1), kmN = [0, 0, 0, 0, 0, 0], nN = [0, 0, 0, 0, 0, 0], cell = bdMaskOf(R, DATA.cells.map(c => c.ring), false), inc = new Float64Array(n + 1);
  if (!BL.terr) { const feat = new Uint8Array(lab.length); for (let i = 0; i < lab.length; i++) feat[i] = lab[i] ? 1 : 0; const e = bdEDT(feat, W, H, true), t = new Int32Array(lab.length);
    for (let i = 0; i < lab.length; i++) t[i] = lab[i] || (e.idx[i] >= 0 ? lab[e.idx[i]] : 0); BL.terr = t; }      // every square of road goes to the parcel nearest to it
  const terr = BL.terr;
  for (let i = 0; i < terr.length; i++) { cnt[terr[i]]++; if (cell[i]) inc[terr[i]]++; }
  if (G && BD.p.useFrom) {
    if (!BD.gr) { const raw = atob(G.data), a = new Uint8Array(raw.length); for (let i = 0; i < raw.length; i++) a[i] = raw.charCodeAt(i); BD.gr = a; }
    const gr = BD.gr, town = bdMaskOf(R, DATA.towns, false), prot = bdMaskOf(R, pk.protected || window.__BD_PROT__ || [], true), o = DATA.origin, built = new Float64Array(n + 1), green = new Float64Array(n + 1), tw = new Float64Array(n + 1), ao = new Float64Array(n + 1);
    for (let r = 0; r < H; r++) { const N_ = y1 - (r + 0.5) * px + o[1], gy = Math.floor((G.n1 - N_) / G.cell);
      for (let c = 0; c < W; c++) { const i = r * W + c, l = terr[i]; if (!l) continue; const gx = Math.floor((x0 + (c + 0.5) * px + o[0] - G.e0) / G.cell), v = gx >= 0 && gy >= 0 && gx < G.w && gy < G.h ? gr[gy * G.w + gx] : 0;
        if (town[i]) { tw[l]++; built[l]++; } else if (v >= 1 && v <= 3) built[l]++; else if (v === 4 || v === 5) green[l]++; if (prot[i]) ao[l]++; } }
    for (let l = 1; l <= n; l++) { const t = Math.max(1, cnt[l]), u = built[l] / t, f = green[l] / t, ha = cnt[l] * px * px / 1e4;
      BL.cls[l] = inc[l] / t < 0.5 || ha > 500000 ? 0 : tw[l] / t > 0.5 ? 1 : ao[l] / t > 0.5 ? 5 : ha < BD.p.park ? 3 : f > 0.5 ? 2 : u > 0.5 ? 1 : f + u < 0.1 ? 4 : f >= u ? 2 : 1; }
    R.useFrom = 'growth';
  } else { BL.cls.set(BL.cls0); R.useFrom = 'soil'; }
  for (let i = 0; i < terr.length; i++) if (cell[i]) kmN[BL.cls[terr[i]]] += px * px / 1e6;
  for (let l = 1; l <= n; l++) nN[BL.cls[l]]++;
  R.useKm = kmN; R.useN = nN; R.ukey = key;
}

// ---------------------------------------------------------------- widths
function bdW(c) {                                // metres, by class
  const p = BD.p; return c === 'H' ? p.wH : c === '60' ? p.wP : c === '48' ? p.wA : c === '30' ? p.wB * 1.25 : p.wB;
}
const bdK = () => (S.step === 27 ? 1 : V.bdMode === 'wide' ? Math.max(1, V.bdK) : 1);      // the last step is always at true widths: a parcel is taken as the true roads leave it

// ---------------------------------------------------------------- drawing
function bdTowns() {
  const c = bdC(); cx.beginPath(); for (const t of DATA.towns) path(cx, t, true);
  cx.fillStyle = c.town; cx.fill('nonzero'); cx.strokeStyle = c.townEdge; cx.lineWidth = 0.5; cx.stroke();      // nonzero: a town listed by two cells is still filled
}
function bdUseCanvas() {
  const R = BD.res, key = V.theme + BD.key;
  if (BD.useImg && BD.useKey === key + R.ukey) return BD.useImg;
  const c = document.createElement('canvas'); c.width = R.W; c.height = R.H;
  const g = c.getContext('2d'), im = g.createImageData(R.W, R.H), d = im.data, col = bdC().use.map(h => (h ? bdRGB(h) : null)), lab = R.blocks.label, cls = R.blocks.cls;
  for (let i = 0; i < lab.length; i++) { const q = col[cls[lab[i]]]; if (q) { d[4 * i] = q[0]; d[4 * i + 1] = q[1]; d[4 * i + 2] = q[2]; d[4 * i + 3] = 255; } }
  g.putImageData(im, 0, 0); BD.useImg = c; BD.useKey = key + R.ukey; return c;
}
function bdUnder() {                             // under the towns: the parcels by use
  const R = BD.res, L = S.layers || {}; if (!R) return;
  if (L.bduse) { cx.globalAlpha = bdOp('bduse');
    if (L.bdroad) { const t = bdTrue(); if (t) cx.drawImage(t.under, t.x, t.y, t.w, t.h); }       // with the roads at their widths: the parcels as the roads leave them
    else { const c = bdUseCanvas(); cx.imageSmoothingEnabled = false; cx.drawImage(c, sx(R.box[0]), sy(R.box[3]), R.W * R.px / S.view.mpp, R.H * R.px / S.view.mpp); cx.imageSmoothingEnabled = true; }
    cx.globalAlpha = 1; }
  if (L.bdtown) { cx.globalAlpha = bdOp('bdtown'); bdTowns(); cx.globalAlpha = 1; }
}
function bdExisting() {                          // the roads that exist today: a core line along the real road, and its number
  const R = BD.res; if (!R || !R.X) return; const c = bdC(), k = bdK(), mpp = S.view.mpp, vx0 = wx(0), vx1 = wx(W), vy1 = wy(0), vy0 = wy(Hh), best = new Map();
  cx.strokeStyle = c.core; cx.lineJoin = 'round'; cx.lineCap = 'round';
  for (const x of R.X) {
    if (x.bb[2] < vx0 || x.bb[0] > vx1 || x.bb[3] < vy0 || x.bb[1] > vy1) continue;
    cx.lineWidth = Math.max(1.2, Math.min(3.4, 0.42 * bdW(x.wk) * k / mpp)); cx.beginPath(); cx.moveTo(sx(x.P[0]), sy(x.P[1])); for (let i = 2; i < x.P.length; i += 2) cx.lineTo(sx(x.P[i]), sy(x.P[i + 1])); cx.stroke();
    if (x.n && x.L > 1200 && (!best.has(x.n) || x.L > best.get(x.n).L)) best.set(x.n, x);
  }
  if (BD.noNums) return;
  cx.font = "700 11px 'DM Sans',system-ui,sans-serif"; cx.textAlign = 'center'; cx.textBaseline = 'middle';
  for (const [n, x] of best) { const m = (x.P.length >> 2) * 2, px_ = sx(x.P[m]), py_ = sy(x.P[m + 1]); cx.lineWidth = 3; cx.strokeStyle = TH().halo; cx.strokeText(n, px_, py_); cx.fillStyle = TH().ink; cx.fillText(n, px_, py_); }
}
function bdOver() {                              // over the towns: the bands, or the roads at their widths
  const R = BD.res, L = S.layers || {}; if (!R) return;
  if (L.bdband) { const loops = R.outlines[bdStage()] || [], c = bdC(); cx.globalAlpha = bdOp('bdband');
    cx.beginPath();
    for (const l of loops) { cx.moveTo(sx(l[0]), sy(l[1])); for (let i = 2; i < l.length; i += 2) cx.lineTo(sx(l[i]), sy(l[i + 1])); cx.closePath(); }
    cx.fillStyle = c.band; cx.globalAlpha = bdOp('bdband') * c.bandA; cx.fill('evenodd');      // the trace is a see-through ribbon: one band reads as one road, not as two lines
    cx.globalAlpha = bdOp('bdband') * 0.85; cx.strokeStyle = c.edge; cx.lineWidth = 0.9; cx.lineJoin = 'round'; cx.stroke(); cx.globalAlpha = 1; }
  if (L.bdroad) { const t = bdTrue(); if (t) { cx.globalAlpha = bdOp('bdroad'); cx.drawImage(t.over, t.x, t.y, t.w, t.h); cx.globalAlpha = 1; } }
  if (L.bdex) { cx.globalAlpha = bdOp('bdex'); bdExisting(); cx.globalAlpha = 1; }
  if (L.bdpick && S.step === 27) bdPickLayer();
}

// the roads at true width (times k) for the view on screen: strokes, then every block corner rounded (the block opened
// by a radius that follows its size), the roads coloured by class and the blocks by use. Worked out when the view rests.
function bdEDT(feat, w, h, wantIdx) {            // squared distance, in pixels, to the nearest feature pixel (and which one)
  const INF = 1e20, n = w * h, f = new Float64Array(n), nr = wantIdx ? new Int32Array(n) : null;
  for (let x = 0; x < w; x++) {
    let last = -1e9;
    for (let y = 0; y < h; y++) { const i = y * w + x; if (feat[i]) last = y; const d = y - last; f[i] = d > 1e8 ? INF : d * d; if (nr) nr[i] = d > 1e8 ? -1 : last; }
    last = 1e9;
    for (let y = h - 1; y >= 0; y--) { const i = y * w + x; if (feat[i]) last = y; const d = last - y; if (d < 1e8 && d * d < f[i]) { f[i] = d * d; if (nr) nr[i] = last; } }
  }
  const out = new Float32Array(n), idx = wantIdx ? new Int32Array(n) : null, v = new Int32Array(w), z = new Float64Array(w + 1);
  for (let y = 0; y < h; y++) {
    const o = y * w; let k = 0; v[0] = 0; z[0] = -INF; z[1] = INF;
    for (let q = 1; q < w; q++) {
      let s = ((f[o + q] + q * q) - (f[o + v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
      while (s <= z[k]) { k--; s = ((f[o + q] + q * q) - (f[o + v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]); }
      k++; v[k] = q; z[k] = s; z[k + 1] = INF;
    }
    k = 0;
    for (let q = 0; q < w; q++) { while (z[k + 1] < q) k++; const dx = q - v[k]; out[o + q] = dx * dx + f[o + v[k]]; if (idx) idx[o + q] = nr[o + v[k]] < 0 ? -1 : nr[o + v[k]] * w + v[k]; }
  }
  return wantIdx ? { d: out, idx } : out;
}
function bdRaster(ox, oy, w, h, g, k) {         // on a grid of g metres a square whose top left corner is (ox, oy): the roads, the blocks, and how far each block is rounded
  const R = BD.res, KF = 0.40, RFm = BD.p.fillet * Math.min(k, 2.5), n = w * h;
  const cv2 = document.createElement('canvas'); cv2.width = w; cv2.height = h; const g2 = cv2.getContext('2d', { willReadFrequently: true });
  const road = new Uint8Array(n), kind = new Uint8Array(n), vx0 = ox - 200, vx1 = ox + w * g + 200, vy1 = oy + 200, vy0 = oy - h * g - 200;
  const line = (q, wm) => { g2.lineWidth = Math.max(1.3, wm * k / g); g2.beginPath(); g2.moveTo((q[0] - ox) / g, (oy - q[1]) / g); for (let i = 2; i < q.length; i += 2) g2.lineTo((q[i] - ox) / g, (oy - q[i + 1]) / g); g2.stroke(); };
  const hit = bb => !(bb[2] < vx0 || bb[0] > vx1 || bb[3] < vy0 || bb[1] > vy1);
  [['24', '30'], ['48'], ['60'], ['H']].forEach((cl, di) => {             // the lower classes first: a bigger road is drawn over a smaller one
    g2.clearRect(0, 0, w, h); g2.strokeStyle = '#fff'; g2.lineJoin = 'round'; g2.lineCap = 'round';
    for (const e of R.edges) if (e.draw && cl.includes(e.cl) && hit(e.bb)) line(e.pts, bdW(e.cl));
    for (const x of (R.X || [])) if (cl.includes(x.wk) && hit(x.bb)) line(x.P, bdW(x.wk));      // the existing roads, on their real lines
    const a = g2.getImageData(0, 0, w, h).data;
    for (let i = 0; i < n; i++) if (a[4 * i + 3] > 100) { road[i] = 1; kind[i] = di + 1; }
  });
  // the blocks between the roads, each with the parcel it is part of (use, size)
  const lab = new Int32Array(n), stack = new Int32Array(n); let nb = 0;
  for (let s = 0; s < n; s++) {
    if (road[s] || lab[s]) continue;
    nb++; let top = 0; stack[top++] = s; lab[s] = nb;
    while (top) { const i = stack[--top], x = i % w; if (x > 0 && !road[i - 1] && !lab[i - 1]) { lab[i - 1] = nb; stack[top++] = i - 1; } if (x < w - 1 && !road[i + 1] && !lab[i + 1]) { lab[i + 1] = nb; stack[top++] = i + 1; }
      if (i >= w && !road[i - w] && !lab[i - w]) { lab[i - w] = nb; stack[top++] = i - w; } if (i < n - w && !road[i + w] && !lab[i + w]) { lab[i + w] = nb; stack[top++] = i + w; } }
  }
  const votes = new Array(nb + 1), size = new Int32Array(nb + 1), BL = R.blocks, bx0 = R.box[0], by1 = R.box[3];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const b = lab[y * w + x]; if (!b) continue; size[b]++;
    if ((x & 3) || (y & 3)) continue;
    const col = Math.floor((ox + (x + 0.5) * g - bx0) / R.px), row = Math.floor((by1 - (oy - (y + 0.5) * g)) / R.px);
    if (col < 0 || row < 0 || col >= R.W || row >= R.H) continue;
    const t = BL.label[row * R.W + col]; if (!t) continue; const m = votes[b] || (votes[b] = new Map()); m.set(t, (m.get(t) || 0) + 1);
  }
  const use = new Uint8Array(nb + 1), rad = new Float32Array(nb + 1), of = new Int32Array(nb + 1);
  for (let b = 1; b <= nb; b++) {
    let best = 0, bn = 0; if (votes[b]) for (const [t, v] of votes[b]) if (v > bn) { bn = v; best = t; }
    of[b] = best;
    use[b] = best ? BL.cls[best] : 0; const inr = best ? BL.inradius[best] : 400;
    rad[b] = size[b] * g * g < 400 ? 1e9 : Math.max(14, Math.min(RFm, KF * Math.max(20, inr - 18 * k))) / g;       // pixels
  }
  // every block opened by its radius: what the opening takes off the block's corners becomes road
  const e1 = bdEDT(road, w, h, true), seed = new Uint8Array(n);
  for (let i = 0; i < n; i++) if (lab[i] && e1.d[i] > rad[lab[i]] * rad[lab[i]]) seed[i] = 1;
  const d2 = bdEDT(seed, w, h, false);
  return { road, kind, lab, nb, use, rad, of, e1, d2 };
}
function bdTrueBuild() {
  const k = bdK(), mpp = S.view.mpp, c = bdC();
  const sc = Math.min(1, Math.sqrt(1.5e6 / (W * Hh))), g = mpp / sc, RFm = BD.p.fillet * Math.min(k, 2.5);
  const pad = Math.min(140, Math.ceil(RFm / g) + 2), w = Math.ceil(W * sc) + 2 * pad, h = Math.ceil(Hh * sc) + 2 * pad, ox = wx(0) - pad * g, oy = wy(0) + pad * g, n = w * h;
  const { kind, lab, use, rad, e1, d2 } = bdRaster(ox, oy, w, h, g, k);
  const under = new ImageData(w, h), over = new ImageData(w, h), U = under.data, O = over.data, uc = c.use.map(q => (q ? bdRGB(q) : null)), rc = [null, bdRGB(c.B), bdRGB(c[48]), bdRGB(c[60]), bdRGB(c.H)];
  for (let i = 0; i < n; i++) {
    const b = lab[i];
    if (b && d2[i] <= rad[b] * rad[b] + 0.5) { const q = uc[use[b]]; if (q) { U[4 * i] = q[0]; U[4 * i + 1] = q[1]; U[4 * i + 2] = q[2]; U[4 * i + 3] = 255; } continue; }
    const j = b ? e1.idx[i] : i, q = rc[(j >= 0 && kind[j]) || 1]; O[4 * i] = q[0]; O[4 * i + 1] = q[1]; O[4 * i + 2] = q[2]; O[4 * i + 3] = 255;
    if (b) { const u = uc[use[b]]; if (u) { U[4 * i] = u[0]; U[4 * i + 1] = u[1]; U[4 * i + 2] = u[2]; U[4 * i + 3] = 255; } }
  }
  const mk = im => { const cc = document.createElement('canvas'); cc.width = w; cc.height = h; cc.getContext('2d').putImageData(im, 0, 0); return cc; };
  return { under: mk(under), over: mk(over), ox, oy, g, wpx: w, hpx: h, key: bdTrueKey() };
}
const bdTrueKey = () => [S.view.cx, S.view.cy, S.view.mpp, W, Hh, bdK(), V.theme, BD.key, BD.p.wB, BD.p.wA, BD.p.wH, BD.p.fillet, BD.p.wP, BD.hk, V.bdPal.dark, V.bdPal.light, BD.p.useFrom, BD.p.park, BD.p.farm].join('|');
function bdTrue() {                              // the picture for this view; while the view moves, the last one, moved with it
  if (!BD.res) return null;
  if (!BD.tv || BD.tv.key !== bdTrueKey()) {
    clearTimeout(BD.tvTimer);
    if (!BD.tv) { try { BD.tv = bdTrueBuild(); } catch (e) { console.error(e); return null; } }
    else BD.tvTimer = setTimeout(() => { try { BD.tv = bdTrueBuild(); } catch (e) { console.error(e); } schedule(); }, 140);
  }
  const t = BD.tv; return { under: t.under, over: t.over, x: sx(t.ox), y: sy(t.oy), w: t.wpx * t.g / S.view.mpp, h: t.hpx * t.g / S.view.mpp };
}

// ---------------------------------------------------------------- legend and numbers
function bdLegend() {
  bdPalSync();
  const c = bdC(), T0 = TH(), st = S.step, L = S.layers || {}, rows = [], LEGD = [], sw = (a, b, d) => { LEGD.push([a, b, d]); return swatch(a, b, d); };
  if (st === 27) rows.push([sw('line', PICK.col(), 4), 'taken for the tensor field'], [sw('box', c.use[1]), 'urban parcels can be taken; parks with them, and they stay parks']);
  if (L.bdband && st <= 24) rows.push([sw('box', c.band), st === 21 ? 'the wool as bands: wider where more threads run together' : 'main roads: the bands, the existing roads and the cell edge'], [sw('line', c.edge, 2), 'road edge']);
  if (st === 21) rows.push([sw('line', threadHex(), Math.max(1, V.tw)), 'thread']);
  if (L.bduse) { const gr = BD.res && BD.res.useFrom === 'growth', U_ = (BD.res && BD.res.useN) || {};
    rows.push([sw('box', c.use[1]), gr ? 'urban parcels (over half built in the growth result)' : 'urban parcels'], [sw('box', c.use[2]), gr ? 'farming parcels (over half farming in the growth result)' : 'farming parcels (on the good farm soil)'], [sw('box', c.use[3]), 'parks (the small parcels left between the roads)']);
    if (U_[5]) rows.push([sw('box', c.use[5]), 'protected landscape, kept open']); if (U_[4]) rows.push([sw('box', c.use[4]), 'left open (no use in the growth result)']); }
  if (L.bdband && st >= 25) rows.push([sw('box', c.band), 'main roads (bands)']);
  if (L.bdroad) { const k = bdK(), t = k > 1 ? `, drawn ${k} times wider` : '', p = BD.p;
    rows.push([sw('line', c.H, 6), `1 boundary highway: ${p.wH} m${t}`], [sw('line', c[60], 4), `2 primary road: ${p.wP} m${t}`], [sw('line', c[48], 3), `3 A road: ${p.wA} m${t}`], [sw('line', c.B, 2), `4 B road: ${p.wB} to ${Math.round(p.wB * 1.25)} m${t}`],
      ); if (L.bdex) rows.push([sw('line', c.core, 2), 'centre line and number: the road exists today, one class from end to end']); }
  rows.push([sw('box', L.bdtown ? c.town : (V.theme === 'light' ? '#D6D6D6' : '#2A2A2A')), 'built-up area today']);
  rows.push([sw('railo', '', 0), 'rail: orbital'], [sw('railh', '', 0), 'rail: high speed'], [sw('railr', '', 0), 'rail: radial'], [sw('dot', T0.station, 8), 'station']);
  $('legend').innerHTML = rows.map(r => `<div>${r[0]}<span>${trc(r[1])}</span></div>`).join(''); S.legData = LEGD;
}
function bdNums() {
  if (S.step === 27 && BD.res) return bdPickNums();
  const R = BD.res, rows = [];
  if (!S.relaxed) rows.push(['The wool', 'not relaxed yet: step 10, Run']);
  else if (!R) rows.push(['The network', BD.busy ? 'being traced…' : 'not traced']);
  else {
    const N = R.numbers || {}, H = R.hier;
    if (H) { let all = 0; for (const k in H.km) all += H.km[k]; rows.push(['Main roads', `${fmt(all, 0)} km`]); for (const k of Object.keys(H.km).sort()) rows.push([k, `${fmt(H.km[k], 0)} km`]);
      if (S.step >= 26) for (const lv of ['60', '48']) { const o = H.out[lv]; if (!o) continue;
        rows.push([lv === '60' ? 'Existing, raised whole to primary' : 'Existing, raised whole to A road', o.raised.length ? o.raised.join(', ') : 'none'], [lv === '60' ? 'New primary roads' : 'New A roads', `${o['new roads']}`], [`Land within ${fmt(o['reach m'] / 1000, 2)} km`, `${o['land within reach %']} %`]); } }
    if (N.blocks !== undefined) rows.push(['Blocks', `${N.blocks}`]);
    if (S.step >= 25 && R.useN) { const nm = [null, 'Urban parcels', 'Farming parcels', 'Parks', 'Left open', 'Protected landscape']; for (const c of [1, 2, 3, 5, 4]) if (R.useN[c]) rows.push([nm[c], `${R.useN[c]} · ${fmt(R.useKm[c], 1)} km²`]);
      rows.push(['Parcel use from', R.useFrom === 'growth' ? 'the Growth Simulator' : 'the soil']); }
    if (N.junctions && N.junctions['open ends'] !== undefined) rows.push(['Open ends', `${N.junctions['open ends']}`]);
  }
  $('nums').innerHTML = rows.map(r => `<tr><td>${trc(r[0])}</td><td>${r[1]}</td></tr>`).join('');
}

// ---------------------------------------------------------------- the panels
(function bdPanels() {
  const zh = { 'The net': '基础网', 'Opposite': '对边', 'Alternate': '交替', 'Ties per anchor': '每个锚点的连线数', 'The network, from the wool': '由毛线生成的路网',
    '11 Network mass': '11 路网团块', '12 With existing roads': '12 并入现有道路', '13 Fine tuning': '13 微调', '14 Bigger parcels': '14 合并小地块', '15 Parcels by use': '15 地块用途', '16 True widths': '16 真实宽度',
    'Band of one thread': '单根线的带宽', 'Rounding where bands meet': '带交汇处的圆角', 'New roads merge into existing roads nearby': '新路并入附近的现有道路', 'Reach': '范围', 'Cell edge as a road': '单元边界作为道路',
    'Widest band, each side': '最宽的带（每侧）', 'Close blocks narrower than': '闭合窄于此的街区', 'Open ends carried on to the next road': '断头路延伸至下一条路', 'Smoothing along a road': '沿路平滑',
    'Merge neighbouring blocks under': '合并小于此的相邻街区', 'A merged parcel is never over': '合并后的地块不超过', 'A park is a parcel under': '小于此的地块为公园', 'Farming when this share is on good soil': '良田占比达到此值即为农业',
    'B roads from': 'B 级道路起始宽度', 'A roads from': 'A 级道路起始宽度', 'Highways': '高速路', 'Largest corner radius': '最大转角半径', 'Share of main roads that are 60 m': '60 米主干路所占比例', 'Highways and 60 m roads, smoothed over': '高速路与 60 米道路的平滑范围', 'Road widths': '道路宽度', 'True': '真实', 'Wider': '加宽', 'Wider, times true': '加宽倍数',
    'Main roads': '主干路', 'Blocks': '街区', 'Open ends': '断头路', 'urban parcels': '城市地块', 'farming parcels (on the good farm soil)': '农业地块（位于良田上）', 'parks (the small parcels left between the roads)': '公园（道路之间留下的小地块）',
    'built-up area today': '现状建成区', 'road edge': '道路边线', 'thread': '线' };
  const zh2 = { 'Opposite: each anchor is tied to the anchors across the cell. Alternate: every second anchor to every other one.': '对边：每个锚点与单元对面的锚点相连。交替：每隔一个锚点与其余锚点相连。',
    '16 Road hierarchy': '16 道路等级', '17 Extract parcels': '17 提取地块', 'True widths': '真实宽度', 'From the Growth Simulator': '依据增长模拟', 'From the soil': '依据土壤',
    'No place further from a primary road than': '任何位置距一级道路不超过', 'Where land is further than this from a boundary highway or a primary road, a road is raised or made.': '若用地距边界高速路或一级道路超过此值，则提升一条现有道路或新建一条道路。',
    'No place further from an A road than': '任何位置距 A 级道路不超过', 'Existing roads first: a whole existing road is raised before a new road is made': '现有道路优先：先整条提升现有道路，再新建道路',
    'Main roads smoothed over': '主干路平滑范围', 'A roads': 'A 级道路', 'Primary roads': '一级道路', 'Boundary highways': '边界高速路', 'off': '关',
    'Step 16. True: every road at its real width. Wider: the same roads drawn this many times wider, to read the network from afar.': '第 16 步。真实：每条道路按真实宽度绘制。加宽：同样的道路按此倍数加宽，便于远观路网。',
    'Road colours': '道路颜色', 'Shades of grey': '灰色系', 'Shades of yellow': '黄色系', 'Cream to copper': '米色至铜色', 'Ice': '冰蓝', 'Grey, red, blue, copper': '灰、红、蓝、铜', 'Dark greys': '深灰色系', 'Shades of brown': '棕色系',
    'Charcoal boundary, grey-brown roads': '炭黑边界，灰棕道路', 'Grey-brown': '灰棕色系', 'Grey, red, blue, brown': '灰、红、蓝、棕',
    'Parcels by use': '地块用途', 'Built-up area today': '现状建成区', 'Network mass (bands)': '路网团块（带）', 'Roads at their widths, by class': '按等级和宽度绘制的道路', 'Existing roads: centre line and number': '现有道路：中心线与编号', 'Parcels taken': '已选取的地块',
    'Save GeoJSON': '保存 GeoJSON',
    'Click an urban parcel: it turns red and the map closes in. Shift-click for more. Double-click one to open them all in the base for the tensor field. Parks can be taken too: they are carried along and stay parks. Farming and protected land is not taken.': '点击一个城市地块：它变为红色，地图随之拉近。按住 Shift 点击可多选。双击其中一个，即可在张量场底图中打开全部所选地块。公园也可一并选取：它们随地块一起传递，并保持为公园。农业用地和受保护用地不可选取。',
    'The relaxed wool read as one mass: every thread is a band, wider where more threads run together, and where bands meet the corner is rounded. The band is the road; its two edges are the double line.': '松弛后的毛线被读作一个整体：每根线是一条带，多根线并行处更宽，带与带相交处转角被倒圆。带即道路，其两条边线即双线。',
    'The same mass with the existing roads and the cell edge in it. A new band that runs beside an existing road, in its direction, is pulled onto it, so the two merge.': '同一团块，加入现有道路和单元边界。与现有道路并行且方向一致的新带被拉到该道路上，两者合而为一。',
    'Fine tuning: wide masses where many bands meet are rebuilt as the roads that run through them, blocks too narrow to be parcels are closed, and every open end is carried straight on to the next road.': '微调：多条带交汇形成的宽团块被重建为穿过其中的道路，过窄而不能成为地块的街区被闭合，每个断头都沿直线延伸至下一条道路。',
    'Small blocks that sit next to each other are merged into bigger parcels. Never across an existing road or the cell edge.': '相邻的小街区合并为更大的地块。绝不跨越现有道路或单元边界。',
    'The parcels by use, read from the growth result: urban where over half is built, farming where over half is farming, a park where the parcel is small, kept open inside a protected landscape. Built-up area today on top.': '由增长结果读出的地块用途：过半为建设用地则为城市地块，过半为农业则为农业地块，小地块为公园，位于受保护景观内则保持开敞。现状建成区叠加在上。',
    'The road hierarchy in four classes, at true widths. The cell edge is the boundary highway. Every existing road keeps one class from end to end, and a whole existing road is raised before a new road is made. On the right, draw the roads wider than true to read them from afar.': '道路分为四个等级，按真实宽度绘制。单元边界即边界高速路。每条现有道路从头到尾保持同一等级，并且先整条提升现有道路，再新建道路。右侧可将道路加宽绘制，便于远观。',
    'The last step, always at true road widths: the parcels that go on to the tensor field. Click an urban parcel, shift-click for more, double-click to open them in the base for the tensor field. Parks can be taken with them and stay parks. Farming and protected land is not taken.': '最后一步，始终按道路真实宽度：选取进入张量场的地块。点击一个城市地块，按住 Shift 点击可多选，双击即可在张量场底图中打开。公园可一并选取并保持为公园。农业用地和受保护用地不可选取。',
    'the wool as bands: wider where more threads run together': '毛线读作带：多根线并行处更宽', 'main roads: the bands, the existing roads and the cell edge': '主干路：带、现有道路和单元边界',
    'urban parcels (over half built in the growth result)': '城市地块（增长结果中过半为建设用地）', 'farming parcels (over half farming in the growth result)': '农业地块（增长结果中过半为农业）', 'protected landscape, kept open': '受保护景观，保持开敞',
    'left open (no use in the growth result)': '留空（增长结果中无用途）', 'main roads (bands)': '主干路（带）', 'centre line and number: the road exists today, one class from end to end': '中心线与编号：该道路现已存在，全程同一等级',
    'taken for the tensor field': '已选取，进入张量场', 'urban parcels can be taken; parks with them, and they stay parks': '可选取城市地块；公园可一并选取，并保持为公园',
    'The wool': '毛线', 'not relaxed yet: step 10, Run': '尚未松弛：第 10 步，运行', 'The network': '路网', 'being traced…': '描绘中…', 'not traced': '未描绘',
    '1 Boundary highway': '1 边界高速路', '2 Primary, existing': '2 一级道路，现有', '2 Primary, new': '2 一级道路，新建', '3 A road, existing': '3 A 级道路，现有', '3 A road, new': '3 A 级道路，新建', '4 B road, existing': '4 B 级道路，现有', '4 B road, new': '4 B 级道路，新建',
    'Existing, raised whole to primary': '整条提升为一级道路的现有道路', 'Existing, raised whole to A road': '整条提升为 A 级道路的现有道路', 'New primary roads': '新建一级道路', 'New A roads': '新建 A 级道路', 'none': '无',
    'Urban parcels': '城市地块', 'Farming parcels': '农业地块', 'Parks': '公园', 'Left open': '留空', 'Protected landscape': '受保护景观', 'Parcel use from': '地块用途依据', 'the Growth Simulator': '增长模拟', 'the soil': '土壤',
    'Urban, for the tensor field': '城市地块，进入张量场', 'Parks, they stay parks': '公园，保持为公园', 'Roads along them': '沿地块的道路', 'Urban parcels in all': '城市地块总数', 'Parks in all': '公园总数',
    'Tracing the network from the wool…': '正在由毛线描绘路网…', 'Working out the road hierarchy…': '正在计算道路等级…', 'The network is not traced yet.': '路网尚未描绘。', 'Nothing taken.': '未选取任何地块。',
    'A farming parcel stays a farm parcel: it is not taken for the tensor field.': '农业地块保持为农业地块：不进入张量场。', 'This parcel is left open: it is not taken for the tensor field.': '该地块留空：不进入张量场。',
    'Protected landscape is kept open: it is not taken for the tensor field.': '受保护景观保持开敞：不进入张量场。', 'This parcel is not taken for the tensor field.': '该地块不进入张量场。',
    'Loop City · the wool bands': 'Loop City · 毛线带', 'rail: orbital': '铁路：环线', 'rail: high speed': '铁路：高速',
    'The inside corner where two roads meet, rounded to this radius (steps 12 and 13); the parcels keep the same corners (step 14).': '两条道路相交处的内转角按此半径倒圆（第 12、13 步）；地块保持相同的转角（第 14 步）。',
    'Sources: the Loop City slime mould simulation, whole-loop run (16 Nov). Roads, towns and buildings: OS Open Zoomstack (OGL v3). Soil: Agricultural Land Classification (Natural England). Rail: the Loop City railway.': '数据来源：Loop City 黏菌模拟，整环运行（11 月 16 日）。道路、城镇与建筑：OS Open Zoomstack（OGL v3）。土壤：农业用地分级（Natural England）。铁路：Loop City 铁路。',
    'Click an urban parcel first.': '请先点击一个城市地块。', 'Take at least one urban parcel: the tensor field does not run on parks.': '请至少选取一个城市地块：张量场不在公园上生成。' };
  const rx2 = [[/^Network traced in ([\d.,]+) s\.$/, '路网已描绘，用时 $1 秒。'], [/^Road hierarchy worked out in ([\d.,]+) s\.$/, '道路等级已计算，用时 $1 秒。'], [/^Land within ([\d.,]+) km$/, '距离 $1 公里以内的用地'],
    [/^(.+): boundary, primary, A road, B road\.$/, '{{$1}}：边界、一级、A 级、B 级。'],
    [/^1 boundary highway: (\d+) m$/, '1 边界高速路：$1 米'], [/^1 boundary highway: (\d+) m, drawn ([\d.]+) times wider$/, '1 边界高速路：$1 米，按 $2 倍加宽绘制'],
    [/^2 primary road: (\d+) m$/, '2 一级道路：$1 米'], [/^2 primary road: (\d+) m, drawn ([\d.]+) times wider$/, '2 一级道路：$1 米，按 $2 倍加宽绘制'],
    [/^3 A road: (\d+) m$/, '3 A 级道路：$1 米'], [/^3 A road: (\d+) m, drawn ([\d.]+) times wider$/, '3 A 级道路：$1 米，按 $2 倍加宽绘制'],
    [/^4 B road: (\d+) to (\d+) m$/, '4 B 级道路：$1 至 $2 米'], [/^4 B road: (\d+) to (\d+) m, drawn ([\d.]+) times wider$/, '4 B 级道路：$1 至 $2 米，按 $3 倍加宽绘制'],
    [/^Taken: (\d+) urban parcels? and (\d+) parks? \(parks stay parks\)\. Shift-click for more, double-click to open them\.$/, '已选取：$1 个城市地块和 $2 个公园（公园保持为公园）。按住 Shift 点击可多选，双击打开。'],
    [/^Taken: (\d+) urban parcels?\. Shift-click for more, double-click to open them\.$/, '已选取：$1 个城市地块。按住 Shift 点击可多选，双击打开。'], [/^(C\d+\.\d+) \(park\)$/, '$1（公园）']];
  (function reg(n) {                              // the page's dictionary may not be there yet: wait for it, then translate what is already on the page
    if (!window.__ZH || !window.__ZH_RX) { if (n < 200) setTimeout(() => reg(n + 1), 150); return; }      // the builder lets the page's language part show its dictionary as window.__ZH
    try { Object.assign(window.__ZH, zh, zh2); for (const q of rx2) window.__ZH_RX.push(q); if (typeof LANG !== 'undefined' && LANG === 'zh' && window.__zhWalk) window.__zhWalk(document.body); } catch (e) { console.error(e); }
  })(0);
  const hs = [...document.querySelectorAll('#left h2')], hOld = hs.find(e => /road hierarchy/i.test(e.textContent)), hNum = hs.find(e => /^Numbers$/i.test(e.textContent.trim())), hWool = hs.find(e => /^The wool$/i.test(e.textContent.trim()));
  if (hOld && hNum) for (let el = hOld; el && el !== hNum; el = el.nextElementSibling) el.hidden = true;
  if ($('roadsBtn')) $('roadsBtn').hidden = true;
  const row = (id, lab, min, max, step, note) => `<div class="row"><div class="lab"><span>${lab}</span><span id="${id}V"></span></div><input type="range" id="${id}" min="${min}" max="${max}" step="${step}">${note ? `<div class="note">${note}</div>` : ''}</div>`;
  const chk = (id, lab) => `<label class="check"><input type="checkbox" id="${id}">${lab}</label>`, sub = t => `<div class="t" style="margin:10px 0 4px;font-weight:600">${t}</div>`;
  if (hWool) { const d = document.createElement('div'); d.innerHTML = `<h2>The net</h2><div class="seg" id="bdNet"><button data-net="opp">Opposite</button><button data-net="alt">Alternate</button></div>` + row('bd_oppw', 'Ties per anchor', 1, 4, 1, 'Opposite: each anchor is tied to the anchors across the cell. Alternate: every second anchor to every other one.'); hWool.parentNode.insertBefore(d, hWool); }
  const sec = document.createElement('div'); sec.id = 'bdPanel';
  sec.innerHTML = '<h2>The network, from the wool</h2>'
    + sub('11 Network mass') + row('bd_thread', 'Band of one thread', 2, 5, 1) + row('bd_close1', 'Rounding where bands meet', 0, 5, 1)
    + sub('12 With existing roads') + chk('bd_attract', 'New roads merge into existing roads nearby') + row('bd_reach', 'Reach', 0, 500, 25) + row('bd_rim', 'Cell edge as a road', 3, 9, 1)
    + sub('13 Fine tuning') + row('bd_rmax', 'Widest band, each side', 2, 6, 1) + row('bd_narrow', 'Close blocks narrower than', 0, 6, 0.5) + chk('bd_ends', 'Open ends carried on to the next road') + row('bd_sigma', 'Smoothing along a road', 0, 200, 10)
    + sub('14 Bigger parcels') + row('bd_small', 'Merge neighbouring blocks under', 0, 30, 1) + row('bd_smallMax', 'A merged parcel is never over', 10, 80, 5)
    + sub('15 Parcels by use') + `<div class="seg" id="bdUseFrom"><button data-uf="1">From the Growth Simulator</button><button data-uf="0">From the soil</button></div>` + row('bd_park', 'A park is a parcel under', 0, 60, 1) + row('bd_farm', 'Farming when this share is on good soil', 20, 90, 5)
    + sub('16 Road hierarchy') + row('bd_r2', 'No place further from a primary road than', 1.5, 4, 0.25, 'Where land is further than this from a boundary highway or a primary road, a road is raised or made.') + row('bd_r3', 'No place further from an A road than', 0.75, 2, 0.125) + chk('bd_exfirst', 'Existing roads first: a whole existing road is raised before a new road is made') + row('bd_line', 'Main roads smoothed over', 0, 500, 20) + sub('True widths') + row('bd_wB', 'B roads from', 12, 36, 2) + row('bd_wA', 'A roads', 36, 72, 4) + row('bd_wP', 'Primary roads', 48, 80, 4) + row('bd_wH', 'Boundary highways', 60, 120, 5) + row('bd_fillet', 'Largest corner radius', 0, 200, 10);
  if (hNum) hNum.parentNode.insertBefore(sec, hNum);
  const m28 = v => `${Math.round(v * 28)} m`, ha = v => (v ? `${v} ha` : 'off'), mm = v => `${v} m`;
  const F = { thread: m28, close1: m28, reach: mm, rim: m28, rmax: m28, narrow: v => (v ? m28(v) : 'off'), sigma: mm, small: ha, smallMax: ha, park: ha, farm: v => `${v} %`, wB: mm, wA: mm, wH: mm, fillet: mm, r2: v => `${v} km`, r3: v => `${v} km`, wP: mm, line: mm, oppw: v => `${2 * v + 1}` };
  for (const k in F) { const el = $('bd_' + k), out = $('bd_' + k + 'V'); if (!el) continue; el.value = BD.p[k]; out.textContent = F[k](BD.p[k]);
    el.oninput = () => { BD.p[k] = +el.value; out.textContent = F[k](BD.p[k]);
      if (k === 'oppw') { window.BD_OPPW = BD.p.oppw; rebuildNet(); buttons(); }
      else if (k === 'r2' || k === 'r3' || k === 'line') bdRehier();
      else if (['wB', 'wA', 'wP', 'wH', 'fillet'].includes(k)) { legend(); schedule(); } else bdChanged(); }; }
  for (const k of ['attract', 'ends']) { const el = $('bd_' + k); if (!el) continue; el.checked = !!BD.p[k]; el.onchange = () => { BD.p[k] = el.checked ? 1 : 0; bdChanged(); }; }
  { const el = $('bd_exfirst'); if (el) { el.checked = !!BD.p.exfirst; el.onchange = () => { BD.p.exfirst = el.checked ? 1 : 0; bdRehier(); }; } }
  { const sync = () => document.querySelectorAll('#bdUseFrom [data-uf]').forEach(b => b.classList.toggle('on', +b.dataset.uf === BD.p.useFrom));
    document.querySelectorAll('#bdUseFrom [data-uf]').forEach(b => b.onclick = () => { BD.p.useFrom = +b.dataset.uf; sync(); if (BD.res) { BD.res.ukey = ''; bdUse(BD.res); BD.tv = null; BD.useImg = null; legend(); nums(); schedule(); } }); sync(); }
  { const lays = document.querySelector('.lays');                                   // the layers of this method, on / off and opacity, beside the older ones
    if (lays) { for (const k of ['hier', 'surf', 'parcels', 'transit']) { const el = lays.querySelector(`[data-layer="${k}"]`); if (el && el.closest('.lay')) el.closest('.lay').style.display = 'none'; }
      const ref = lays.querySelector('#refCircles'), before = ref ? ref.closest('.lay') : null;
      for (const [k, t] of [['bduse', 'Parcels by use'], ['bdtown', 'Built-up area today'], ['bdband', 'Network mass (bands)'], ['bdroad', 'Roads at their widths, by class'], ['bdex', 'Existing roads: centre line and number'], ['bdpick', 'Parcels taken']]) {
        const d = document.createElement('div'); d.className = 'lay'; d.innerHTML = `<label><input type="checkbox" data-layer="${k}">${t}</label><input type="range" data-op="${k}" min="0" max="100" step="5">`; lays.insertBefore(d, before);
        const cb = d.querySelector('[data-layer]'), sl = d.querySelector('[data-op]'); sl.value = V.op[k] === undefined ? 100 : V.op[k];
        cb.addEventListener('change', () => { S.layers[k] = cb.checked; legend(); schedule(); }); sl.addEventListener('input', () => { V.op[k] = +sl.value; saveLook(); schedule(); }); } }
    const ex = $('extract');
    if (ex) { const d = document.createElement('div'); d.id = 'bdExtract'; d.hidden = true;
      d.innerHTML = `<p class="hint">Click an urban parcel: it turns red and the map closes in. Shift-click for more. Double-click one to open them all in the base for the tensor field. Parks can be taken too: they are carried along and stay parks. Farming and protected land is not taken.</p>`
        + `<div class="btns"><button class="btn" id="bdSend" style="border-color:#FFD84A;color:#FFD84A">Open in the base for the tensor field</button><button class="btn" id="bdPkg">Save the parcels (file)</button><button class="btn" id="bdGeo">Save GeoJSON</button><button class="btn" id="bdDxf">Save DXF (Rhino)</button><button class="btn" id="bdClear">Clear</button></div>`;
      ex.parentNode.insertBefore(d, ex.nextSibling);
      $('bdSend').onclick = () => bdSend(); $('bdPkg').onclick = () => bdSavePkg(); $('bdGeo').onclick = () => bdSaveGeo(); $('bdDxf').onclick = () => bdSaveDxf(); $('bdClear').onclick = () => { BP.sel = new Map(); nums(); schedule(); }; } }
  window.BD_OPPW = BD.p.oppw;
  const netSync = () => document.querySelectorAll('#bdNet [data-net]').forEach(b => b.classList.toggle('on', (b.dataset.net === 'opp') === !!OPP));
  document.querySelectorAll('#bdNet [data-net]').forEach(b => b.onclick = () => { OPP = b.dataset.net === 'opp'; netSync(); rebuildNet(); buttons(); }); netSync();
  // the right side: true widths, or wider
  const hr = [...document.querySelectorAll('#right h2')].find(e => /^Threads$/i.test(e.textContent.trim()));
  if (hr) { const d = document.createElement('div');
    d.innerHTML = `<h2>Road widths</h2><div class="seg" id="bdMode"><button data-bdm="true">True</button><button data-bdm="wide">Wider</button></div>` + row('bdK', 'Wider, times true', 1.5, 5, 0.5, 'Step 16. True: every road at its real width. Wider: the same roads drawn this many times wider, to read the network from afar.');
    d.innerHTML += `<h2>Road colours</h2><div class="chips" id="bdPal">` + [0, 1, 2, 3, 4].map(i => `<button class="chip" data-bdp="${i}" style="width:44px"></button>`).join('') + `</div><div class="row note" id="bdPalName"></div>`;
    hr.parentNode.insertBefore(d, hr);
    document.querySelectorAll('#bdPal [data-bdp]').forEach(b => b.onclick = () => { V.bdPal[bdTheme()] = +b.dataset.bdp; saveLook(); BD.tv = null; legend(); schedule(); });
    const ms = () => document.querySelectorAll('#bdMode [data-bdm]').forEach(b => b.classList.toggle('on', b.dataset.bdm === V.bdMode));
    document.querySelectorAll('#bdMode [data-bdm]').forEach(b => b.onclick = () => { V.bdMode = b.dataset.bdm; ms(); saveLook(); legend(); schedule(); }); ms();
    const el = $('bdK'), out = $('bdKV'); el.value = V.bdK; out.textContent = `${V.bdK} ×`; el.oninput = () => { V.bdK = +el.value; out.textContent = `${V.bdK} ×`; saveLook(); legend(); schedule(); };
  }
})();

// ---------------------------------------------------------------- a test hook, asleep unless the address ends in #...bdtest
// Run with #run&sync&bdtest: relaxes in the page, walks steps 11 to 16, and leaves the numbers and a picture of each in
// a hidden box (textarea#bdout) for a headless check. It changes nothing in a normal session.
if (/[#&]bdtest/.test(HASH)) (async () => {
  const wait = ms => new Promise(r => setTimeout(r, ms)), idle = async () => { await wait(120); while (BD.busy) await wait(60); await wait(60); };
  const out = { steps: {}, err: null };
  try {
    let n = 0; while (!S.relaxed && n++ < 4000) await wait(100);
    for (const k of [21, 22, 23, 24, 25, 26]) {   /* step 27 below */ setStep(k, true); await idle(); if (k === 26) { BD.tv = null; draw(); await wait(400); } draw(); out.steps[k] = { status: $('status').textContent, nums: $('nums').innerText, pic: cv.toDataURL('image/jpeg', 0.82) }; }
    V.bdMode = 'wide'; BD.tv = null; draw(); await wait(400); draw(); out.steps['26 wide'] = { pic: cv.toDataURL('image/jpeg', 0.82) };
    const st = DATA.stations.find(s => s.id === 'P2') || DATA.stations[0]; V.bdMode = 'true'; S.view = { cx: st.x, cy: st.y, mpp: 4 }; BD.tv = null; draw(); await wait(400); draw(); out.steps['26 close'] = { pic: cv.toDataURL('image/jpeg', 0.82) };
    fit(); V.bdMode = 'wide'; BD.tv = null; draw(); await wait(400); draw(); out.steps['26 fitted, wider'] = { pic: cv.toDataURL('image/jpeg', 0.82) };
    V.theme = 'light'; BD.tv = null; BD.useImg = null; legend(); draw(); await wait(400); draw(); out.steps['26 light'] = { pic: cv.toDataURL('image/jpeg', 0.82) };
    setStep(25, true); await idle(); draw(); out.steps['25 light'] = { pic: cv.toDataURL('image/jpeg', 0.82) }; V.theme = 'dark'; BD.tv = null; BD.useImg = null;
    V.bdMode = 'true'; setStep(27, true); await idle(); fit(); BD.tv = null; draw(); await wait(400);
    { const R = BD.res, BL = R.blocks, bb = bpBoxes(R), st2 = DATA.stations.find(s => s.id === 'P2') || DATA.stations[0], cand = [];
      for (let t = 1; t <= BL.n; t++) { if (BL.cls[t] !== 1 && BL.cls[t] !== 3) continue; const ha = BL.ha ? BL.ha[t] : 0, x = R.box[0] + (bb[4 * t] + bb[4 * t + 2]) / 2 * R.px, y = R.box[3] - (bb[4 * t + 1] + bb[4 * t + 3]) / 2 * R.px; cand.push({ t, u: BL.cls[t], d: Math.hypot(x - st2.x, y - st2.y), x, y }); }
      cand.sort((a, b) => a.d - b.d); const urb = cand.filter(q => q.u === 1).slice(0, 3), park = cand.filter(q => q.u === 3)[0], T0 = performance.now();
      for (const q of urb.concat(park ? [park] : [])) { const d = bpData(q.t); if (d) BP.sel.set(q.t, d); }
      const L = [...BP.sel.values()], b0 = L.length ? pkBox(L[0].out[0], 0) : null; if (b0) { let a = b0.slice(); for (const d of L) { const b = pkBox(d.out[0], 0); a = [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[2], b[2]), Math.max(a[3], b[3])]; }
        S.view = { cx: (a[0] + a[2]) / 2, cy: (a[1] + a[3]) / 2, mpp: Math.max((a[2] - a[0] + 900) / W, (a[3] - a[1] + 900) / Hh) }; }
      BD.tv = null; nums(); draw(); await wait(500); draw(); out.steps['27'] = { status: $('status').textContent, nums: $('nums').innerText, pic: cv.toDataURL('image/jpeg', 0.85) };
      const pk = L.length ? bdParcelPackage(L) : null; out.pick = { ms: Math.round(performance.now() - T0), parcels: L.map(d => ({ id: d.id, use: d.use, ha: +d.ha.toFixed(1), rings: d.out.length, holes: d.holes.length, pts: d.out[0].length / 2, roads: d.roads.length })),
        site: pk && pk.site.rings.map(r => r.length), junctions: pk && pk.site.junctions.length, roads: pk && pk.roads.length, surface: pk && pk.surface.map(q => q.rings.length), window: pk && pk.window, bytes: pk && JSON.stringify(pk).length };
      if (pk && /[#&]bdpkg/.test(HASH)) out.pkg = pk;
      V.theme = 'light'; BD.tv = null; legend(); draw(); await wait(500); draw(); out.steps['27 light'] = { pic: cv.toDataURL('image/jpeg', 0.85) }; V.theme = 'dark'; }
    out.numbers = BD.res && BD.res.numbers; out.edges = BD.res && BD.res.edges.length; out.hier = BD.res && BD.res.hier; out.existing = BD.res && BD.res.X && BD.res.X.length;
  } catch (e) { out.err = String(e && e.stack || e); }
  const ta = document.createElement('textarea'); ta.id = 'bdout'; ta.style.display = 'none'; ta.textContent = JSON.stringify(out); document.body.appendChild(ta); document.body.dataset.bd = 'done';
})();

// ---------------------------------------------------------------- the whole loop baked: asleep unless the address has #...bdall
// Run with #run&sync&bdall on a page that holds every cell: relaxes the wool, traces the network and the hierarchy once,
// then draws the whole area tile by tile at a fixed scale (light and dark) and leaves the tiles, the roads and the
// numbers in a hidden box (textarea#bdout) for a headless run to pick up. It changes nothing in a normal session.
if (/[#&]bdall/.test(HASH)) (async () => {
  const wait = ms => new Promise(r => setTimeout(r, ms)), idle = async () => { await wait(150); while (BD.busy) await wait(100); await wait(100); };
  const out = { err: null, tiles: {}, log: [] }, T0 = Date.now(), mark = t => out.log.push([t, Math.round((Date.now() - T0) / 1000)]);
  try {
    let n = 0; while (!S.relaxed && n++ < 30000) await wait(200);
    mark('relaxed'); setStep(26, true); await idle(); mark('traced');
    const R = BD.res; if (!R) throw new Error('no network: ' + $('status').textContent);
    out.nums = $('nums').innerText; out.hier = R.hier; out.numbers = R.numbers; out.edges = R.edges.length; out.useN = R.useN; out.useKm = R.useKm; out.useFrom = R.useFrom; out.box = R.box; out.origin = DATA.origin; out.cells = DATA.cells.length; out.grid28 = [R.W, R.H];
    out.stations = DATA.stations.map(s => ({ id: s.id, x: s.x, y: s.y, kind: s.kind }));
    const best = new Map(); for (const x of (R.X || [])) if (x.n && x.L > 1500 && (!best.has(x.n) || x.L > best.get(x.n).L)) best.set(x.n, x);
    out.roadnums = [...best].map(([nm, x]) => { const m = (x.P.length >> 2) * 2; return [nm, Math.round(x.P[m]), Math.round(x.P[m + 1]), x.wk, Math.round(x.L)]; });
    if (/[#&]bdroads/.test(HASH)) { const rd = p => Array.from(p, v => Math.round(v)); out.roads = R.edges.filter(e => e.draw && e.cl).map(e => ({ c: e.cl, p: rd(e.pts) })).concat((R.X || []).map(x => ({ c: x.wk, n: x.n || '', p: rd(x.P) }))); }
    out.cellRings = DATA.cells.map(c => ({ id: c.id, ring: Array.from(c.ring, v => Math.round(v)) }));
    if (/[#&]bdbake/.test(HASH)) {             // the result as data, for a page that only shows it: each parcel's use and size on the 28 m grid, the towns, the rail
      const BL = R.blocks, c = document.createElement('canvas'); c.width = R.W; c.height = R.H; const g = c.getContext('2d'), im = g.createImageData(R.W, R.H), d = im.data, lab = BL.label, rd = p => Array.from(p, v => Math.round(v));
      for (let i = 0; i < lab.length; i++) { const t = lab[i]; d[4 * i] = BL.cls[t] * 40; d[4 * i + 1] = Math.min(255, Math.round((BL.inradius[t] || 0) / 8)); d[4 * i + 3] = 255; }
      g.putImageData(im, 0, 0); out.useGrid = { url: c.toDataURL('image/png'), w: R.W, h: R.H, px: R.px, box: R.box, clsStep: 40, inrStep: 8 };
      const seen = new Set(); out.towns = []; for (const t of DATA.towns) { const k = t.length + '|' + Math.round(t[0]) + '|' + Math.round(t[1]); if (seen.has(k)) continue; seen.add(k); out.towns.push(rd(t)); }
      out.rail = DATA.rail.map(r => ({ kind: r.kind, p: rd(r.p) })); out.widths = { H: bdW('H'), 60: bdW('60'), 48: bdW('48'), 30: bdW('30'), 24: bdW('24') }; out.fillet = BD.p.fillet; mark('baked');
    }
    const mpp = +((/[#&]mpp=([\d.]+)/.exec(HASH) || [0, 14])[1]), TS = 1200, pad = 1200, x0 = R.box[0] - pad, y1 = R.box[3] + pad, nx = Math.ceil((R.box[2] + pad - x0) / (TS * mpp)), ny = Math.ceil((y1 - (R.box[1] - pad)) / (TS * mpp));
    out.grid = { x0, y1, mpp, TS, nx, ny };
    furniture = function () {}; const ST0 = DATA.stations; DATA.stations = []; BD.noNums = true;
    V.rO *= 2.4; V.rH *= 2.4; V.rR *= 2.4; V.bdMode = /[#&]truew/.test(HASH) ? 'true' : 'wide'; V.bdK = 2;
    cv.width = off.width = TS; cv.height = off.height = TS; W = TS; Hh = TS; DPR = 1;
    for (const th of (/[#&]notiles/.test(HASH) ? [] : /[#&]onlylight/.test(HASH) ? ['light'] : ['light', 'dark'])) {
      V.theme = th; BD.useImg = null; BD.tv = null; legend(); let k = 0;
      for (let ty = 0; ty < ny; ty++) for (let tx = 0; tx < nx; tx++) {
        S.view = { cx: x0 + (tx + 0.5) * TS * mpp, cy: y1 - (ty + 0.5) * TS * mpp, mpp }; BD.tv = null; draw();
        out.tiles[th + '_' + ty + '_' + tx] = cv.toDataURL('image/png'); if (++k % 4 === 0) await wait(5);
      }
      mark('tiles ' + th);
    }
    DATA.stations = ST0;
  } catch (e) { out.err = String(e && e.stack || e); }
  out.s = Math.round((Date.now() - T0) / 1000);
  const ta = document.createElement('textarea'); ta.id = 'bdout'; ta.style.display = 'none'; ta.textContent = JSON.stringify(out); document.body.appendChild(ta); document.body.dataset.bd = 'done';
})();

// ---------------------------------------------------------------- frames for a film: asleep unless the address has #...bdfilm
// Run with #run&sync&bdfilm: walks the steps at a fixed frame size and leaves a picture and the step's own note for each
// in a hidden box (textarea#bdout). Shows the alternate and the opposite net before the wool is relaxed again.
if (/[#&]bdfilm/.test(HASH)) (async () => {
  const wait = ms => new Promise(r => setTimeout(r, ms)), idle = async () => { await wait(150); while (BD.busy) await wait(80); await wait(80); };
  const out = { frames: [], err: null }, grab = (key, extra) => { draw(); out.frames.push(Object.assign({ key, step: S.step, hint: STEP_HINT[S.step] || '', nums: $('nums').innerText, pic: cv.toDataURL('image/jpeg', 0.9) }, extra || {})); };
  try {
    let n = 0; while (!S.relaxed && n++ < 6000) await wait(100);
    const FW = 1440, FH = 1080; cv.width = off.width = FW; cv.height = off.height = FH; W = FW; Hh = FH; DPR = 1; V.theme = 'dark'; V.bdMode = 'true'; fit();
    for (const k of [3, 5, 7, 8]) { setStep(k, true); await wait(200); grab('s' + k); }
    OPP = false; rebuildNet(); setStep(9, true); await wait(300); grab('alt');
    OPP = true; rebuildNet(); setStep(9, true); await wait(300); grab('opp');
    relaxSync(); n = 0; while (!S.relaxed && n++ < 6000) await wait(100);
    setStep(10, true); await wait(300); grab('relaxed');
    for (const k of [21, 22, 23, 24, 25, 26]) { setStep(k, true); await idle(); BD.tv = null; draw(); await wait(350); grab('s' + k); }
    const st = DATA.stations.find(s => s.id === 'P2') || DATA.stations[0]; S.view = { cx: st.x, cy: st.y, mpp: 5 }; BD.tv = null; draw(); await wait(450); grab('close');
    setStep(27, true); await idle(); fit();
    const R = BD.res, BL = R.blocks, bb = bpBoxes(R), cand = [];
    for (let t = 1; t <= BL.n; t++) { if (BL.cls[t] !== 1 && BL.cls[t] !== 3) continue; const x = R.box[0] + (bb[4 * t] + bb[4 * t + 2]) / 2 * R.px, y = R.box[3] - (bb[4 * t + 1] + bb[4 * t + 3]) / 2 * R.px; cand.push({ t, u: BL.cls[t], d: Math.hypot(x - st.x, y - st.y) }); }
    cand.sort((a, b) => a.d - b.d); const urb = cand.filter(q => q.u === 1).slice(0, 3), park = cand.filter(q => q.u === 3)[0];
    for (const q of urb.concat(park ? [park] : [])) { const d = bpData(q.t); if (d) BP.sel.set(q.t, d); }
    const L = [...BP.sel.values()]; if (L.length) { let a = pkBox(L[0].out[0], 0); for (const d of L) { const b = pkBox(d.out[0], 0); a = [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[2], b[2]), Math.max(a[3], b[3])]; }
      S.view = { cx: (a[0] + a[2]) / 2, cy: (a[1] + a[3]) / 2, mpp: Math.max((a[2] - a[0] + 1400) / W, (a[3] - a[1] + 1400) / Hh) }; }
    BD.tv = null; nums(); draw(); await wait(500); grab('pick'); if (L.length) out.pkg = bdParcelPackage(L);
    out.useN = R.useN; out.useKm = R.useKm; out.hier = R.hier && R.hier.out;
  } catch (e) { out.err = String(e && e.stack || e); }
  const ta = document.createElement('textarea'); ta.id = 'bdout'; ta.style.display = 'none'; ta.textContent = JSON.stringify(out); document.body.appendChild(ta); document.body.dataset.bd = 'done';
})();
