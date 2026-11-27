// Makes places.js: what the page needs to say where a site is (27 Nov 2026).
//   · the national rail stations in the site window, by name, in British National Grid metres (EPSG:27700): the page
//     names towns after the stations that stand in them, and says how far a station of the run is from the nearest one
//   · the towns of site/vectors.js, simplified (2 km² and up): which stations stand in a town, and the key plan's context
//   · the six radials of Loop City step 1 (its intro data), in BNG: the key plan's context
// Sources, all in this repository: incubator/loop-city-mould-growth/reference/osm/stations.geojson (OpenStreetMap,
// checked against National Rail names on 24 Nov 2026) and intro-data.js; site/vectors.js. The radials are drawn in
// the intro's own frame: they are placed in BNG by the three stations both pages know (P2, A3, S2, from the example
// package) and the fit is checked on all seventeen stations (each within 0.5 km of the distance step 1 states).
// Run from the repository's root:  node incubator/loop-city-wool/source/make-places.cjs
const fs = require('fs'), path = require('path'), zlib = require('zlib'), vm = require('vm');
const W = path.join(__dirname, '..'), M = path.join(W, '..', 'loop-city-mould-growth');
// ---- WGS84 longitude/latitude to OSGB36 National Grid (Helmert, then Transverse Mercator; a few metres)
function toBNG(lon, lat) {
  const rad = d => d * Math.PI / 180; let a = 6378137, b = 6356752.3142, e2 = 1 - b * b / (a * a);
  let p = rad(lat), l = rad(lon), nu = a / Math.sqrt(1 - e2 * Math.sin(p) ** 2);
  const x = nu * Math.cos(p) * Math.cos(l), y = nu * Math.cos(p) * Math.sin(l), z = (1 - e2) * nu * Math.sin(p);
  const tx = -446.448, ty = 125.157, tz = -542.060, s = 20.4894e-6, rx = rad(-0.1502 / 3600), ry = rad(-0.2470 / 3600), rz = rad(-0.8421 / 3600);
  const x2 = tx + (1 + s) * x - rz * y + ry * z, y2 = ty + rz * x + (1 + s) * y - rx * z, z2 = tz - ry * x + rx * y + (1 + s) * z;
  a = 6377563.396; b = 6356256.909; e2 = 1 - b * b / (a * a);
  const pp = Math.hypot(x2, y2); let phi = Math.atan2(z2, pp * (1 - e2));
  for (let i = 0; i < 10; i++) { nu = a / Math.sqrt(1 - e2 * Math.sin(phi) ** 2); phi = Math.atan2(z2 + e2 * nu * Math.sin(phi), pp); }
  const lam = Math.atan2(y2, x2), F0 = 0.9996012717, phi0 = rad(49), lam0 = rad(-2), N0 = -100000, E0 = 400000, n = (a - b) / (a + b);
  nu = a * F0 / Math.sqrt(1 - e2 * Math.sin(phi) ** 2); const rho = a * F0 * (1 - e2) / (1 - e2 * Math.sin(phi) ** 2) ** 1.5, eta2 = nu / rho - 1;
  const Ma = (1 + n + 1.25 * n * n + 1.25 * n ** 3) * (phi - phi0), Mb = (3 * n + 3 * n * n + 21 / 8 * n ** 3) * Math.sin(phi - phi0) * Math.cos(phi + phi0);
  const Mc = (15 / 8 * n * n + 15 / 8 * n ** 3) * Math.sin(2 * (phi - phi0)) * Math.cos(2 * (phi + phi0)), Md = 35 / 24 * n ** 3 * Math.sin(3 * (phi - phi0)) * Math.cos(3 * (phi + phi0));
  const Mm = b * F0 * (Ma - Mb + Mc - Md), c = Math.cos(phi), sn = Math.sin(phi), t = Math.tan(phi);
  const I = Mm + N0, II = nu / 2 * sn * c, III = nu / 24 * sn * c ** 3 * (5 - t * t + 9 * eta2), IIIA = nu / 720 * sn * c ** 5 * (61 - 58 * t * t + t ** 4);
  const IV = nu * c, V = nu / 6 * c ** 3 * (nu / rho - t * t), VI = nu / 120 * c ** 5 * (5 - 18 * t * t + t ** 4 + 14 * eta2 - 58 * t * t * eta2), dl = lam - lam0;
  return [E0 + IV * dl + V * dl ** 3 + VI * dl ** 5, I + II * dl * dl + III * dl ** 4 + IIIA * dl ** 6];
}
const R = v => Math.round(v / 10) * 10;
const SITE = JSON.parse(/<script>const SITE = (\{.*?\});/.exec(fs.readFileSync(path.join(W, 'index.html'), 'utf8'))[1]), X = SITE.ext;   // [E0, N0, E1, N1]
const inside = (e, n, pad) => e > X[0] - pad && e < X[2] + pad && n > X[1] - pad && n < X[3] + pad;
// stations
const st = JSON.parse(fs.readFileSync(path.join(M, 'reference/osm/stations.geojson'), 'utf8')).features
  .map(f => [f.properties.n, ...toBNG(...f.geometry.coordinates)]).filter(s => inside(s[1], s[2], 5000)).map(s => [s[0], R(s[1]), R(s[2])]);
// towns (Douglas–Peucker to 150 m, 2 km² and up)
const vec = JSON.parse(zlib.gunzipSync(Buffer.from(/"(.*)"/.exec(fs.readFileSync(path.join(W, 'site/vectors.js'), 'utf8'))[1], 'base64')).toString());
// Douglas–Peucker; a closed ring has its first point last: distances from that point until the first split
function dp(p, tol) { const pts = []; for (let i = 0; i < p.length; i += 2) pts.push([p[i], p[i + 1]]); const keep = new Uint8Array(pts.length); keep[0] = keep[pts.length - 1] = 1;
  const st2 = [[0, pts.length - 1]]; while (st2.length) { const [a, b] = st2.pop(); let md = 0, mi = -1; const [x1, y1] = pts[a], [x2, y2] = pts[b], L = Math.hypot(x2 - x1, y2 - y1);
    for (let i = a + 1; i < b; i++) { const d = L < 1e-6 ? Math.hypot(pts[i][0] - x1, pts[i][1] - y1) : Math.abs((x2 - x1) * (y1 - pts[i][1]) - (x1 - pts[i][0]) * (y2 - y1)) / L; if (d > md) { md = d; mi = i; } }
    if (md > tol) { keep[mi] = 1; st2.push([a, mi], [mi, b]); } }
  const o = []; pts.forEach((q, i) => { if (keep[i]) o.push(R(q[0]), R(q[1])); }); return o; }
const towns = vec.towns.filter(t => t.a >= 2).sort((a, b) => b.a - a.a).map(t => [Math.round(t.a * 10) / 10, dp(t.p, 150)]).filter(t => t[1].length >= 6);
// the radials, from step 1's intro, placed in BNG by P2, A3 and S2
const ctx = { window: {} }; vm.runInNewContext(fs.readFileSync(path.join(M, 'intro-data.js'), 'utf8'), ctx); const I = ctx.window.LC_INTRO_DATA;
ctx.window = {}; vm.runInNewContext(fs.readFileSync(path.join(W, 'sample-cells.js'), 'utf8'), ctx); const pkg = ctx.window.__PKG_INLINE__;
const B = Object.fromEntries(pkg.stations_in_tile.map(s => [s.id, [s.E, s.N]])), P = Object.fromEntries(I.stations.map(s => [s.id, [s.x, s.y]])), ids = ['P2', 'A3', 'S2'];
function solve3(A, b) { const d = m => m[0][0] * (m[1][1] * m[2][2] - m[1][2] * m[2][1]) - m[0][1] * (m[1][0] * m[2][2] - m[1][2] * m[2][0]) + m[0][2] * (m[1][0] * m[2][1] - m[1][1] * m[2][0]);
  const D = d(A); return [0, 1, 2].map(k => d(A.map((r, i) => r.map((v, j) => j === k ? b[i] : v))) / D); }
const A = ids.map(i => [P[i][0], P[i][1], 1]), cx = solve3(A, ids.map(i => B[i][0])), cy = solve3(A, ids.map(i => B[i][1]));
const F = (x, y) => [cx[0] * x + cx[1] * y + cx[2], cy[0] * x + cy[1] * y + cy[2]];
for (const s of I.stations) { const [e, n] = F(s.x, s.y), q = st.find(t => t[0] === s.near.n || t[0].startsWith(s.near.n.split(' (')[0]));
  if (q) { const km = Math.hypot(e - q[1], n - q[2]) / 1000; if (Math.abs(km - s.near.km) > 0.6) throw new Error('the fit is off at ' + s.id + ': ' + km.toFixed(1) + ' km, step 1 says ' + s.near.km); } }
const pathOf = d => { const v = (d.match(/-?\d+\.?\d*/g) || []).map(Number), o = []; for (let i = 0; i < v.length; i += 2) o.push(...F(v[i], v[i + 1]).map(R)); return o; };
const out = { made: new Date().toISOString().slice(0, 10), crs: 'EPSG:27700', charingCross: [530047, 180422], stations: st, towns, radials: I.radials.map(r => pathOf(r.d)) };
fs.writeFileSync(path.join(W, 'places.js'), '/* made by source/make-places.cjs: stations, towns and the radials, in British National Grid metres */\nwindow.__WOOL_PLACES__ = ' + JSON.stringify(out) + ';\n');
console.log('places.js:', st.length, 'stations,', towns.length, 'towns,', out.radials.length, 'radials,', (fs.statSync(path.join(W, 'places.js')).size / 1024).toFixed(0), 'KB');
