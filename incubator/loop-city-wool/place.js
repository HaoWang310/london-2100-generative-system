/* Loop City step 2 · where the site is (27 Nov 2026).
   The page's coordinates are British National Grid metres (EPSG:27700) from DATA.origin, so every point can be named:
   · on the map, the towns are named after the rail stations that stand in them (places.js, made by
     source/make-places.cjs: a station inside a town of 2 km² or more, none named Parkway, Airport or Terminal, names
     3 km apart; a town with no station is not named, nothing is guessed), and each station of the run says where it
     is: the nearest national rail station, or how far and which way from it;
   · a card above the zoom buttons (on a phone under the Display button) says where the picked station is: its name,
     how far and which way from central London (Charing Cross), latitude and longitude, and the OS grid reference;
   · the key plan in the display panel is drawn again from the mould page's picture: on a computer in its London
     context (the towns, London the largest, the radials, the site boxed and named), on a phone as linework (the ring's
     outline, the urban cells hatched, London dashed). The view's box follows the map.
   All the words follow the page's language. index.html calls __lcPlace.map, .mini and .pick; nothing else changes. */
(function () {
  'use strict';
  var PL = window.__WOOL_PLACES__; if (!PL) return;
  var H = document.documentElement, zh = function () { return /^zh/i.test(H.lang || ''); };
  var SANS = "'DM Sans','PingFang SC','Noto Sans CJK SC',system-ui,sans-serif", MONO = "'DM Mono','SF Mono',ui-monospace,Menlo,monospace";
  var ok = function () { return typeof DATA !== 'undefined' && DATA && DATA.origin && DATA.stations; };

  // ---------------------------------------------------------------- OSGB36 National Grid <-> WGS84 (a few metres)
  var rad = function (d) { return d * Math.PI / 180; };
  function toBNG(lon, lat) {
    var a = 6378137, b = 6356752.3142, e2 = 1 - b * b / (a * a), p = rad(lat), l = rad(lon), nu = a / Math.sqrt(1 - e2 * Math.pow(Math.sin(p), 2));
    var x = nu * Math.cos(p) * Math.cos(l), y = nu * Math.cos(p) * Math.sin(l), z = (1 - e2) * nu * Math.sin(p);
    var s = 20.4894e-6, rx = rad(-0.1502 / 3600), ry = rad(-0.2470 / 3600), rz = rad(-0.8421 / 3600);
    var x2 = -446.448 + (1 + s) * x - rz * y + ry * z, y2 = 125.157 + rz * x + (1 + s) * y - rx * z, z2 = -542.060 - ry * x + rx * y + (1 + s) * z;
    a = 6377563.396; b = 6356256.909; e2 = 1 - b * b / (a * a);
    var pp = Math.hypot(x2, y2), phi = Math.atan2(z2, pp * (1 - e2));
    for (var i = 0; i < 10; i++) { nu = a / Math.sqrt(1 - e2 * Math.pow(Math.sin(phi), 2)); phi = Math.atan2(z2 + e2 * nu * Math.sin(phi), pp); }
    var lam = Math.atan2(y2, x2), F0 = 0.9996012717, phi0 = rad(49), lam0 = rad(-2), n = (a - b) / (a + b);
    nu = a * F0 / Math.sqrt(1 - e2 * Math.pow(Math.sin(phi), 2)); var rho = a * F0 * (1 - e2) / Math.pow(1 - e2 * Math.pow(Math.sin(phi), 2), 1.5), eta2 = nu / rho - 1;
    var Ma = (1 + n + 1.25 * n * n + 1.25 * n * n * n) * (phi - phi0), Mb = (3 * n + 3 * n * n + 21 / 8 * n * n * n) * Math.sin(phi - phi0) * Math.cos(phi + phi0);
    var Mc = (15 / 8 * n * n + 15 / 8 * n * n * n) * Math.sin(2 * (phi - phi0)) * Math.cos(2 * (phi + phi0)), Md = 35 / 24 * n * n * n * Math.sin(3 * (phi - phi0)) * Math.cos(3 * (phi + phi0));
    var M = b * F0 * (Ma - Mb + Mc - Md), c = Math.cos(phi), sn = Math.sin(phi), t = Math.tan(phi);
    var I = M - 100000, II = nu / 2 * sn * c, III = nu / 24 * sn * Math.pow(c, 3) * (5 - t * t + 9 * eta2), IIIA = nu / 720 * sn * Math.pow(c, 5) * (61 - 58 * t * t + Math.pow(t, 4));
    var IV = nu * c, V = nu / 6 * Math.pow(c, 3) * (nu / rho - t * t), VI = nu / 120 * Math.pow(c, 5) * (5 - 18 * t * t + Math.pow(t, 4) + 14 * eta2 - 58 * t * t * eta2), dl = lam - lam0;
    return [400000 + IV * dl + V * Math.pow(dl, 3) + VI * Math.pow(dl, 5), I + II * dl * dl + III * Math.pow(dl, 4) + IIIA * Math.pow(dl, 6)];
  }
  function toLL(E, N) {                                  // by Newton's method on toBNG
    var lon = -2 + (E - 400000) / 70000, lat = 49 + (N + 100000) / 111000;
    for (var i = 0; i < 30; i++) { var f = toBNG(lon, lat), d = 1e-5, fx = toBNG(lon + d, lat), fy = toBNG(lon, lat + d);
      var j00 = (fx[0] - f[0]) / d, j01 = (fy[0] - f[0]) / d, j10 = (fx[1] - f[1]) / d, j11 = (fy[1] - f[1]) / d, det = j00 * j11 - j01 * j10, dx = E - f[0], dy = N - f[1];
      lon += (j11 * dx - j01 * dy) / det; lat += (-j10 * dx + j00 * dy) / det; if (Math.abs(dx) < 0.01 && Math.abs(dy) < 0.01) break; }
    return [lon, lat];
  }
  function gridRef(E, N) {                               // e.g. TL 18 37 (1 km)
    var e100 = Math.floor(E / 100000), n100 = Math.floor(N / 100000), l1 = (19 - n100) - (19 - n100) % 5 + Math.floor((e100 + 10) / 5), l2 = (19 - n100) * 5 % 25 + e100 % 5;
    if (l1 > 7) l1++; if (l2 > 7) l2++;
    var two = function (v) { return ('0' + Math.floor((v % 100000) / 1000)).slice(-2); };
    return String.fromCharCode(65 + l1) + String.fromCharCode(65 + l2) + ' ' + two(E) + ' ' + two(N);
  }
  var D16 = { en: ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'],
    zh: ['北', '东北偏北', '东北', '东北偏东', '东', '东南偏东', '东南', '东南偏南', '南', '西南偏南', '西南', '西南偏西', '西', '西北偏西', '西北', '西北偏北'] };
  var bearing = function (dx, dy) { return (Math.atan2(dx, dy) * 180 / Math.PI + 360) % 360; };
  var km = function (m) { return (m / 1000).toFixed(m < 10000 ? 1 : 0); };
  function near(E, N) {                                  // the nearest national rail station (not an airport's terminal stop)
    var best = null, bd = 1e18; PL.stations.forEach(function (s) { if (/Terminal/.test(s[0])) return; var d = (s[1] - E) * (s[1] - E) + (s[2] - N) * (s[2] - N); if (d < bd) { bd = d; best = s; } });
    return { n: best[0], m: Math.sqrt(bd), b: bearing(E - best[1], N - best[2]) };
  }
  function whereStation(E, N) {                          // "Arlesey", or "Luton 东北偏北 4.5 km" / "4.5 km NNE of Luton"
    var q = near(E, N); if (q.m <= 1000) return q.n;
    var k = Math.round(q.b / 22.5) % 16; return zh() ? q.n + ' ' + D16.zh[k] + ' ' + km(q.m) + ' km' : km(q.m) + ' km ' + D16.en[k] + ' of ' + q.n;
  }
  function fromLondon(E, N) {                            // "伦敦市中心以北 58 km" / "58 km N of central London"
    var c = PL.charingCross, m = Math.hypot(E - c[0], N - c[1]), k = Math.round(bearing(E - c[0], N - c[1]) / 45) % 8;
    return zh() ? '伦敦市中心' + ['以北', '东北', '以东', '东南', '以南', '西南', '以西', '西北'][k] + ' ' + km(m) + ' km' : km(m) + ' km ' + ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'][k] + ' of central London';
  }

  // ---------------------------------------------------------------- the towns named after their stations
  function pip(x, y, p) { var c = false, n = p.length / 2; for (var i = 0, j = n - 1; i < n; j = i++) { var xi = p[2 * i], yi = p[2 * i + 1], xj = p[2 * j], yj = p[2 * j + 1];
    if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c; } return c; }
  var townBox = PL.towns.map(function (t) { var p = t[1], a = [1e9, 1e9, -1e9, -1e9]; for (var i = 0; i < p.length; i += 2) { a[0] = Math.min(a[0], p[i]); a[2] = Math.max(a[2], p[i]); a[1] = Math.min(a[1], p[i + 1]); a[3] = Math.max(a[3], p[i + 1]); } return a; });
  var NAMES = null, NKEY = '';
  function names() {
    var o = DATA.origin, sz = DATA.size || [40000, 30000], key = o.join(',') + '|' + sz.join(','); if (NAMES && NKEY === key) return NAMES;
    var out = [];
    PL.stations.slice().sort(function (a, b) { return a[0] < b[0] ? -1 : 1; }).forEach(function (s) {
      var E = s[1], N = s[2]; if (E < o[0] || N < o[1] || E > o[0] + sz[0] || N > o[1] + sz[1] || /Parkway|Airport|Terminal/.test(s[0])) return;
      var a = 0; PL.towns.forEach(function (t, i) { var b = townBox[i]; if (E >= b[0] && E <= b[2] && N >= b[1] && N <= b[3] && pip(E, N, t[1])) a = Math.max(a, t[0]); });
      if (!a || out.some(function (q) { return Math.hypot(E - q.E, N - q.N) < 3000; })) return;
      out.push({ n: s[0], E: E, N: N, a: a });
    });
    NKEY = key; return (NAMES = out);
  }
  function label(g, s, x, y, o) {
    g.save(); g.font = (o.w || 400) + ' ' + o.size + 'px ' + (o.mono ? MONO : SANS); g.textAlign = o.align || 'left'; g.textBaseline = o.base || 'middle';
    try { if (o.ls) g.letterSpacing = o.ls + 'px'; } catch (e) {}
    if (o.halo !== false) { g.lineJoin = 'round'; g.strokeStyle = 'rgba(0,0,0,.8)'; g.lineWidth = o.halo || 2.4; g.strokeText(s, x, y); }
    g.fillStyle = o.col; g.fillText(s, x, y); g.restore();
  }
  // on the map, after the stations: town names while the whole site is in view; each station's place, left of its dot
  // Nothing is written over another label: the stations' and the cells' names are kept clear first, then each
  // station's place (left of its dot, or right below it where the left has no room), then the towns
  // (27 Nov 2026, second pass) legible on a 1x screen and drawn like a plan: town names 12 px (13 px for a town of 20 km²
  // or more), weight 500, 84% white, over a small dot where the station is; each station's place in a black pill with a
  // hairline edge, 12 px. (The first pass, 10.5 px at 46%, blurred to grey; the cell codes now step back, index.html.)
  var Y = { tw: 500, ts: 12, big: 13, tc: 'rgba(255,255,255,.84)', pw: 500, ps: 12, pc: '#fff', halo: 3 };
  function map(g) {
    if (!ok()) return; var o = DATA.origin, taken = [], step = S.step;
    var box = function (x, y, w, h) { return [x - 2, y - h / 2 - 1, x + w + 2, y + h / 2 + 1]; }, hit = function (b) { return taken.some(function (t) { return b[0] < t[2] && b[2] > t[0] && b[1] < t[3] && b[3] > t[1]; }); };
    var width = function (t, size, wt, ls) { g.save(); g.font = (wt || 400) + ' ' + size + 'px ' + SANS; try { if (ls) g.letterSpacing = ls + 'px'; } catch (e) {} var w = g.measureText(t).width; g.restore(); return w; };
    DATA.stations.forEach(function (s) { var x = sx(s.x), y = sy(s.y); taken.push([x - 6, y - 6, x + 6, y + 6], box(x + 8, y - 8, width(s.id, 12) + 2, 14)); });
    if (step <= 3) (DATA.otherLabels || []).forEach(function (c) { var w = c.id.length * 6.2; taken.push(box(sx(c.x) - w / 2, sy(c.y), w, 11)); });
    if (step === 3) (DATA.cellLabels || []).forEach(function (c) { var w = width(c.name, 17); taken.push(box(sx(c.x) - w / 2, sy(c.y), w, 34)); });
    if (step === 5) (DATA.primary || []).forEach(function (q) { var w = width(q.id, 14) + 10; taken.push(box(sx(q.lx) - w / 2, sy(q.ly) + 7, w, 34)); });
    DATA.stations.forEach(function (s) { if (s.kind === 'airport') return; var x = sx(s.x), y = sy(s.y); if (x < 0 || y < 0 || x > W || y > Hh) return;
      var t = whereStation(s.x + o[0], s.y + o[1]), w = width(t, Y.ps, Y.pw) + 14, at = null;
      var iw = width(s.id, 12) * 1.1;
      [[x - 9 - w, y + 1], [x + 14 + iw, y - 8], [x - 9 - w, y + 14], [x + 8, y + 10], [x - w / 2, y + 16], [x - w / 2, y - 22]].some(function (q) {     // left, after the id, below left, below right, below, above
        var b = box(q[0], q[1], w, 13); if (q[0] < 6 || q[0] + w > W - 6 || hit(b)) return false; at = q; taken.push(b); return true; });
      if (!at) { at = x - 9 - w > 6 ? [x - 9 - w, y + 1] : [x + 8, y + 10]; taken.push(box(at[0], at[1], w, 13)); }
      g.save(); g.fillStyle = 'rgba(0,0,0,.82)'; g.strokeStyle = 'rgba(255,255,255,.32)'; g.lineWidth = 1; g.beginPath(); g.roundRect(at[0], at[1] - 9, w, 18, 9); g.fill(); g.stroke(); g.restore();
      label(g, t, at[0] + 7, at[1] + 0.5, { size: Y.ps, w: Y.pw, col: Y.pc, halo: false }); });
    // the towns while the ground is read (steps 1 to 4, and the prologue): later the cells and the roads fill the map
    if (S.view.mpp >= 12 && step <= 4) names().forEach(function (q) { var x = sx(q.E - o[0]), y = sy(q.N - o[1]), size = (q.a >= 20 ? Y.big : Y.ts) - (W < 600 ? 1 : 0), txt = q.n, ls = 0.3;
      var w = width(txt, size, Y.tw, ls), yy = y - 10, b = box(x - w / 2, yy, w, size + 2);
      if (x - w / 2 < 6 || x + w / 2 > W - 6 || y < 20 || y > Hh - 20 || hit(b)) return; taken.push(b);
      g.save(); g.fillStyle = Y.tc; g.beginPath(); g.arc(x, y, 1.6, 0, 7); g.fill(); g.restore();
      label(g, txt, x, yy, { size: size, w: Y.tw, col: Y.tc, align: 'center', ls: ls, halo: Y.halo }); });
    card();
  }

  // ---------------------------------------------------------------- the card: where the picked station is
  var el = null, elKey = '';
  function card() {
    if (!ok()) return; var wrap = document.getElementById('wrap'); if (!wrap) return;
    if (!el) { el = document.createElement('div'); el.id = 'lcWhere'; el.setAttribute('translate', 'no'); el.innerHTML = '<b></b><span></span>'; wrap.appendChild(el);
      var st = document.createElement('style'); st.textContent =
        '#lcWhere{position:absolute;left:16px;bottom:112px;z-index:4;max-width:min(360px,calc(100% - 32px));padding:9px 13px 10px;border:1px solid rgba(255,255,255,.14);border-radius:12px;background:rgba(0,0,0,.62);-webkit-backdrop-filter:blur(10px);backdrop-filter:blur(10px);pointer-events:none;color:#fff}' +
        '#lcWhere b{display:block;font:400 12.5px/1.35 ' + SANS + ';letter-spacing:.01em}' +
        '#lcWhere span{display:block;margin-top:3px;font:400 10.5px/1.3 ' + MONO + ';color:rgba(255,255,255,.55);letter-spacing:.02em}' +
        'html.l2phone #lcWhere{left:12px;bottom:auto;top:66px;padding:7px 11px 8px}' +
        'html.l2phone #lcWhere b{font-size:11.5px}html.l2phone #lcWhere span{font-size:10px}';
      document.head.appendChild(st); }
    var s = DATA.stations.find(function (q) { return q.id === DATA.pick; }) || DATA.stations[0]; if (!s) return;
    var E = s.x + DATA.origin[0], N = s.y + DATA.origin[1], key = E + ',' + N + '|' + H.lang; if (key === elKey) return; elKey = key;
    var ll = toLL(E, N);
    el.firstChild.textContent = whereStation(E, N) + ' · ' + fromLondon(E, N);
    el.lastChild.textContent = ll[1].toFixed(3) + '°N  ' + Math.abs(ll[0]).toFixed(3) + '°' + (ll[0] < 0 ? 'W' : 'E') + '  ·  OS ' + gridRef(E, N);
  }

  // ---------------------------------------------------------------- the key plan
  var MK = null;                                         // the mould page's picture, read once: the ring, its urban cells, its outline
  function masks(img) {
    if (MK && MK.src === img.src) return MK;
    var w = img.naturalWidth * 2, h = img.naturalHeight * 2, c = document.createElement('canvas'); c.width = w; c.height = h; var q = c.getContext('2d', { willReadFrequently: true });
    q.drawImage(img, 0, 0, w, h); var a = q.getImageData(0, 0, w, h).data, n = w * h, band = new Float32Array(n), urb = new Float32Array(n);
    for (var i = 0; i < n; i++) { var r = a[4 * i], g = a[4 * i + 1], b = a[4 * i + 2], lum = (r + g + b) / 3, sat = Math.max(r, g, b) - Math.min(r, g, b);
      var u = r - g > 8 && lum > 45 && lum < 200, f = g - r > 4 && lum > 40 && lum < 190, e = sat < 14 && lum > 70; band[i] = u || f || e ? 1 : 0; urb[i] = u ? 1 : 0; }
    var blur = function (src, R) { var t = new Float32Array(n), o = new Float32Array(n), x, y, k, s;
      for (y = 0; y < h; y++) for (x = 0; x < w; x++) { s = 0; for (k = -R; k <= R; k++) s += src[y * w + Math.min(w - 1, Math.max(0, x + k))]; t[y * w + x] = s / (2 * R + 1); }
      for (y = 0; y < h; y++) for (x = 0; x < w; x++) { s = 0; for (k = -R; k <= R; k++) s += t[Math.min(h - 1, Math.max(0, y + k)) * w + x]; o[y * w + x] = s / (2 * R + 1); } return o; };
    var B = blur(band, 2), U = blur(urb, 2), out = function (fn) { var c2 = document.createElement('canvas'); c2.width = w; c2.height = h; var g2 = c2.getContext('2d'), d = g2.createImageData(w, h);
      for (var i = 0; i < n; i++) { d.data[4 * i] = d.data[4 * i + 1] = d.data[4 * i + 2] = 255; d.data[4 * i + 3] = fn(i) ? 255 : 0; } g2.putImageData(d, 0, 0); return c2; };
    var inB = function (i) { return B[i] > 0.5; }, cover = 0; for (i = 0; i < n; i++) if (inB(i)) cover++;
    MK = { src: img.src, ok: cover / n > 0.05 && cover / n < 0.7, band: out(inB), urban: out(function (i) { return U[i] > 0.5 && inB(i); }),
      edge: out(function (i) { if (!inB(i)) return false; var x = i % w, y = (i - x) / w; return x < 1 || y < 1 || x >= w - 1 || y >= h - 1 || !inB(i - 1) || !inB(i + 1) || !inB(i - w) || !inB(i + w); }) };
    return MK;
  }
  var FR = null;                                         // the last frame drawn, for a click
  function frame(w, h, pad, kb, v) {
    var g = [kb[0] - (kb[2] - kb[0]) * 0.2, kb[1] - (kb[3] - kb[1]) * 0.2, kb[2] + (kb[2] - kb[0]) * 0.2, kb[3] + (kb[3] - kb[1]) * 0.2];
    var b = [Math.min(kb[0], Math.max(g[0], v[0])), Math.min(kb[1], Math.max(g[1], v[3])), Math.max(kb[2], Math.min(g[2], v[2])), Math.max(kb[3], Math.min(g[3], v[1])) + 4000];
    var s = Math.min((w - 2 * pad) / (b[2] - b[0]), (h - 2 * pad) / (b[3] - b[1])), cx = (b[0] + b[2]) / 2, cy = (b[1] + b[3]) / 2;
    return { s: s, cx: cx, cy: cy, w: w, h: h, X: function (e) { return w / 2 + (e - cx) * s; }, Y: function (n) { return h / 2 - (n - cy) * s; } };
  }
  function poly(g, F, p, dx, dy, close) { g.moveTo(F.X(p[0] - dx), F.Y(p[1] - dy)); for (var i = 2; i < p.length; i += 2) g.lineTo(F.X(p[i] - dx), F.Y(p[i + 1] - dy)); if (close) g.closePath(); }
  function tint(g, F, cnv, col, alpha) { var kb = DATA.key.box, x0 = F.X(kb[0]), y0 = F.Y(kb[3]), x1 = F.X(kb[2]), y1 = F.Y(kb[1]);
    var c = document.createElement('canvas'); c.width = Math.max(1, Math.ceil((x1 - x0) * 3)); c.height = Math.max(1, Math.ceil((y1 - y0) * 3)); var q = c.getContext('2d');
    q.drawImage(cnv, 0, 0, c.width, c.height); q.globalCompositeOperation = 'source-in'; q.fillStyle = col; q.fillRect(0, 0, c.width, c.height);
    g.save(); g.globalAlpha = alpha; g.drawImage(c, x0, y0, x1 - x0, y1 - y0); g.restore(); }
  function cells(g, F, fill, stroke, lw) { g.save(); DATA.cells.forEach(function (c) { var r = c.ring || c.p; if (!r) return; g.beginPath(); poly(g, F, r, 0, 0, true); if (fill) { g.fillStyle = fill; g.fill(); } if (stroke) { g.strokeStyle = stroke; g.lineWidth = lw || 1; g.stroke(); } }); g.restore(); }
  function scaleBar(g, F, x, y) { var K = 25000 * F.s >= 30 ? 25 : 50, L = K * 1000 * F.s, col = 'rgba(255,255,255,.5)'; g.save(); g.strokeStyle = col; g.lineWidth = 0.8; g.beginPath(); g.moveTo(x, y - 3); g.lineTo(x, y); g.lineTo(x + L, y); g.lineTo(x + L, y - 3); g.stroke(); g.restore();
    label(g, '0', x, y - 7, { size: 7, mono: 1, col: col, halo: false }); label(g, K + ' km', x + L, y - 7, { size: 7, mono: 1, col: col, align: 'right', halo: false }); }
  function viewBox(g, F, v, col, brackets) { var x0 = F.X(v[0]), y0 = F.Y(v[1]), x1 = F.X(v[2]), y1 = F.Y(v[3]), w = x1 - x0, h = y1 - y0; g.save(); g.strokeStyle = col; g.lineWidth = 1;
    if (brackets) { var k = Math.max(4, Math.min(w, h) * 0.3); g.beginPath(); [[x0, y0, 1, 1], [x1, y0, -1, 1], [x0, y1, 1, -1], [x1, y1, -1, -1]].forEach(function (c) { g.moveTo(c[0] + c[2] * k, c[1]); g.lineTo(c[0], c[1]); g.lineTo(c[0], c[1] + c[3] * k); }); g.stroke(); }
    else g.strokeRect(x0, y0, w, h); g.restore(); }
  function london() { return PL.towns[0]; }             // the largest town is London
  function mini(c, acc) {
    if (!ok() || !DATA.key || !IMG.key || !IMG.key.naturalWidth) return false;
    var m = masks(IMG.key); if (!m.ok) return false;     // not the mould page's picture: the page draws its own
    var phone = H.classList.contains('l2phone'), w = c.clientWidth, h = 168, d = window.devicePixelRatio || 1;
    if (c.width !== Math.round(w * d) || c.height !== Math.round(h * d)) { c.width = Math.round(w * d); c.height = Math.round(h * d); c.style.height = h + 'px'; }
    var g = c.getContext('2d'); g.setTransform(d, 0, 0, d, 0, 0); g.clearRect(0, 0, w, h); g.fillStyle = '#000'; g.fillRect(0, 0, w, h);
    var o = DATA.origin, v = [wx(0), wy(0), wx(W), wy(Hh)], F = FR = frame(w, h, 10, DATA.key.box, v), Ldn = london(), lc = [F.X(PL.charingCross[0] - o[0]), F.Y(PL.charingCross[1] - o[1])];
    if (phone) {                                         // linework
      g.save(); g.beginPath(); poly(g, F, Ldn[1], o[0], o[1], true); g.setLineDash([2, 2]); g.strokeStyle = 'rgba(255,255,255,.26)'; g.lineWidth = 0.6; g.stroke(); g.restore();
      label(g, zh() ? '伦敦' : 'LONDON', lc[0], lc[1], { size: 7.5, mono: !zh(), col: 'rgba(255,255,255,.45)', align: 'center', ls: zh() ? 0 : 1.5, halo: false });
      tint(g, F, m.band, '#fff', 0.07); tint(g, F, m.edge, '#fff', 0.5);
      var hc = document.createElement('canvas'); hc.width = w * 3; hc.height = h * 3; var q = hc.getContext('2d'); q.scale(3, 3); q.strokeStyle = 'rgba(255,255,255,.5)'; q.lineWidth = 0.5; q.beginPath();
      for (var x = -h; x < w; x += 2.6) { q.moveTo(x, h); q.lineTo(x + h, 0); } q.stroke(); q.globalCompositeOperation = 'destination-in'; tint(q, F, m.urban, '#fff', 1); g.drawImage(hc, 0, 0, w, h);
      cells(g, F, '#fff', '#000', 0.5); viewBox(g, F, v, acc, true); scaleBar(g, F, 10, h - 9);
      g.save(); g.strokeStyle = 'rgba(255,255,255,.55)'; g.lineWidth = 0.8; g.beginPath(); g.moveTo(w - 12, 20); g.lineTo(w - 12, 11); g.moveTo(w - 14.5, 14); g.lineTo(w - 12, 11); g.lineTo(w - 9.5, 14); g.stroke(); g.restore();
      label(g, 'N', w - 12, 7, { size: 7, mono: 1, col: 'rgba(255,255,255,.55)', align: 'center', halo: false });
      label(g, zh() ? '总平面' : 'KEY PLAN', 10, 13, { size: 7.5, mono: !zh(), col: 'rgba(255,255,255,.5)', ls: zh() ? 0.5 : 1, halo: false });
    } else {                                             // London context
      g.save(); PL.towns.forEach(function (t, i) { var b = townBox[i]; if (F.X(b[2] - o[0]) < 0 || F.X(b[0] - o[0]) > w || F.Y(b[1] - o[1]) < 0 || F.Y(b[3] - o[1]) > h) return;
        g.beginPath(); poly(g, F, t[1], o[0], o[1], true); g.fillStyle = i === 0 ? '#353535' : '#242424'; g.fill(); }); g.restore();
      g.save(); g.strokeStyle = 'rgba(255,255,255,.2)'; g.lineWidth = 0.5; PL.radials.forEach(function (p) { g.beginPath(); poly(g, F, p, o[0], o[1], false); g.stroke(); }); g.restore();
      tint(g, F, m.edge, '#fff', 0.38);
      label(g, zh() ? '伦敦' : 'LONDON', lc[0], lc[1], { size: 8, col: 'rgba(255,255,255,.75)', align: 'center', ls: zh() ? 0 : 1.2, halo: false });
      cells(g, F, null, acc, 1);
      var sz = DATA.size || [0, 0], x0 = F.X(0), y0 = F.Y(sz[1]), x1 = F.X(sz[0]), y1 = F.Y(0), ly = Math.max(20, y0 + 6);
      g.save(); g.strokeStyle = acc; g.lineWidth = 0.8; g.strokeRect(x0, y0, x1 - x0, y1 - y0); g.beginPath(); g.moveTo(x1, ly); g.lineTo(w - 8, ly); g.stroke(); g.restore();
      var s = DATA.stations.find(function (q) { return q.id === DATA.pick; }) || DATA.stations[0];
      if (s) { var E = s.x + o[0], N = s.y + o[1], nm = near(E, N);
        label(g, nm.m <= 1000 ? nm.n : (zh() ? nm.n + ' 附近' : 'near ' + nm.n), w - 8, ly - 5, { size: 8, col: '#fff', align: 'right' });
        label(g, fromLondon(E, N), w - 8, ly + 6, { size: 7, col: 'rgba(255,255,255,.6)', align: 'right' }); }
      viewBox(g, F, v, 'rgba(255,255,255,.85)', false); scaleBar(g, F, 10, h - 9);
    }
    return true;
  }
  function pick(ev) {                                    // a click on the key plan: that point, in the page's metres
    if (!FR || !MK || !MK.ok) return null; var r = ev.currentTarget.getBoundingClientRect(), x = ev.clientX - r.left, y = ev.clientY - r.top;
    return [FR.cx + (x - FR.w / 2) / FR.s, FR.cy - (y - FR.h / 2) / FR.s];
  }
  new MutationObserver(function () { elKey = ''; card(); }).observe(H, { attributes: true, attributeFilter: ['lang'] });
  window.__lcPlace = { map: map, mini: mini, pick: pick, card: card, toLL: toLL, toBNG: toBNG, gridRef: gridRef, whereStation: whereStation, fromLondon: fromLondon, names: names };
})();
