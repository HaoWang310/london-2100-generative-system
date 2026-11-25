/* Loop City step 2 · the steps as processes (25 Nov 2026).
   Each step is shown changing from the picture before to the picture after, the way the method changes it: the mould
   grows out from the stations along its own veins, the centrelines are drawn along the veins, the roads come in by
   class, a scan reads the soil, the anchors drop in order, the threads tie outwards from the station, the bands widen
   with the threads, the parcels take their use one class at a time, the roads widen by class.
   How: the two pictures are the page's own drawings (cv) of the step before and the step after, in the same view. A
   "field" gives every pixel the moment it changes (0 to 1); a WebGL shader mixes the two pictures by it, with a light
   front in the chapter's colour where the picture is changing. The fields are made from the step's own data (the
   centrelines, the roads, the soil grid, the anchors, the threads, the parcels), once per step, on a grid half the
   canvas. Only the look: nothing here changes the method or its numbers. */
(function () {
  'use strict';
  var A = window.__lcAnim = {};
  var CHC = A.CH = { 0: '#FFFFFF', 1: '#5FF2FF', 2: '#C6F432', 3: '#B08CFF', 4: '#FF8A3D' };
  A.chapter = function (k) { return k === 0 ? 0 : k <= 4 ? 1 : k <= 7 ? 2 : k <= 10 ? 3 : 4; };
  var rgb = function (h) { return [parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255]; };

  // ---------------------------------------------------------------- the overlay and its shader
  var ov = null, gl = null, prog = null, tex = {}, U = {}, mode2d = false, shown = null;
  var VS = '#version 300 es\nin vec2 p; out vec2 uv; void main(){ uv = vec2(p.x * .5 + .5, .5 - p.y * .5); gl_Position = vec4(p, 0., 1.); }';
  var FS = '#version 300 es\nprecision highp float; in vec2 uv; out vec4 o;\n' +
    'uniform sampler2D uB, uA, uF, uM; uniform float t, w, gs, ge, glowK, pulse, focus, hasM, hasF; uniform vec3 glow;\n' +
    'void main(){ vec4 b = texture(uB, uv), a = texture(uA, uv); vec2 f = hasF > .5 ? texture(uF, uv).rg : vec2(0.);\n' +
    ' float def = clamp(f.g, 0., 1.), v = def > .002 ? f.r / f.g : 0.;\n' +
    ' float m = mix(smoothstep(gs, ge, t), smoothstep(v, v + w, t), smoothstep(0., .6, def));\n' +
    ' vec3 c = mix(b.rgb, a.rgb, m); float d = length(a.rgb - b.rgb);\n' +
    ' float fr = def > .002 ? max(0., 1. - abs(t - v - w * .5) / (w * .9)) : 0.;\n' +
    ' c += glow * (fr * glowK * smoothstep(.03, .25, d) + pulse * smoothstep(.05, .3, d));\n' +
    ' if (hasM > .5) { float fm = texture(uM, uv).r; c = mix(c, c * mix(.3, 1., fm), focus); }\n' +
    ' o = vec4(c, 1.); }';
  function canvasEl() { return document.getElementById('map'); }
  function place() {
    var c = canvasEl(); if (!ov || !c) return;
    ov.width = c.width; ov.height = c.height;
    ov.style.cssText = 'position:absolute;left:' + c.offsetLeft + 'px;top:' + c.offsetTop + 'px;width:' + c.clientWidth + 'px;height:' + c.clientHeight + 'px;pointer-events:none;z-index:3';
  }
  function init() {
    if (ov) { place(); return; }
    var c = canvasEl(); ov = document.createElement('canvas'); ov.id = 'lcAnim'; c.parentNode.appendChild(ov); place(); ov.style.display = 'none';
    try { gl = ov.getContext('webgl2', { premultipliedAlpha: false, preserveDrawingBuffer: true }); } catch (e) { gl = null; }
    if (!gl) { mode2d = true; return; }
    var sh = function (type, src) { var s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; };
    try { prog = gl.createProgram(); gl.attachShader(prog, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FS)); gl.linkProgram(prog);
      if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog)); } catch (e) { console.error(e); gl = null; mode2d = true; return; }
    gl.useProgram(prog);
    var b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    var loc = gl.getAttribLocation(prog, 'p'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    ['uB', 'uA', 'uF', 'uM', 't', 'w', 'gs', 'ge', 'glowK', 'pulse', 'focus', 'hasM', 'hasF', 'glow'].forEach(function (n) { U[n] = gl.getUniformLocation(prog, n); });
    ['B', 'A', 'F', 'M'].forEach(function (n, i) { var t = gl.createTexture(); gl.activeTexture(gl.TEXTURE0 + i); gl.bindTexture(gl.TEXTURE_2D, t);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      tex[n] = t; gl.uniform1i(U['u' + n], i); });
  }
  function upImg(n, img) { gl.activeTexture(gl.TEXTURE0 + 'BAFM'.indexOf(n)); gl.bindTexture(gl.TEXTURE_2D, tex[n]); gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img); }
  function render(u) {
    if (mode2d) { var g = ov.getContext('2d'); g.globalAlpha = 1; g.drawImage(shown.b, 0, 0); g.globalAlpha = Math.max(0, Math.min(1, u.t)); g.drawImage(shown.a, 0, 0); g.globalAlpha = 1; return; }
    gl.viewport(0, 0, ov.width, ov.height);
    gl.uniform1f(U.t, u.t); gl.uniform1f(U.w, u.w); gl.uniform1f(U.gs, u.gs); gl.uniform1f(U.ge, u.ge); gl.uniform1f(U.glowK, u.glowK); gl.uniform1f(U.pulse, u.pulse || 0);
    gl.uniform1f(U.focus, u.focus || 0); gl.uniform1f(U.hasM, u.hasM ? 1 : 0); gl.uniform1f(U.hasF, u.hasF ? 1 : 0); gl.uniform3fv(U.glow, u.glow);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }
  // a still picture over the map (while the next step is worked out), or none
  A.cover = function (img) { init(); place(); shown = { b: img, a: img }; ov.style.display = '';
    if (mode2d) { render({ t: 0 }); return; } upImg('B', img); upImg('A', img); render({ t: 0, w: .1, gs: 0, ge: 1, glowK: 0, glow: [1, 1, 1] }); };
  A.hide = function () { if (ov) ov.style.display = 'none'; shown = null; };
  A.showing = function () { return !!(ov && ov.style.display !== 'none' && shown); };
  A.picture = function () { return shown ? shown.a : null; };

  // ---------------------------------------------------------------- fields
  // a field on a grid half the canvas: R the moment (premultiplied by G), G how sure (0 where the pixel just fades)
  function Field() { var c = canvasEl(), s = 0.5; this.W = Math.max(1, Math.round(c.width * s)); this.H = Math.max(1, Math.round(c.height * s));
    this.k = DPR * s; this.R = new Float32Array(this.W * this.H); this.G = new Float32Array(this.W * this.H); this.mpp = S.view.mpp / this.k; }
  Field.prototype.canvas = function () { var c = document.createElement('canvas'); c.width = this.W; c.height = this.H; var g = c.getContext('2d', { willReadFrequently: true });
    g.setTransform(this.k, 0, 0, this.k, 0, 0); g.lineCap = 'round'; g.lineJoin = 'round'; return [c, g]; };
  var enc = function (v) { v = Math.max(0, Math.min(1, v)); var q = Math.round(v * 65535); return 'rgb(' + (q >> 8) + ',' + (q & 255) + ',0)'; };
  Field.prototype.take = function (g) {                // what was drawn in moments (colours), into the field where it is surer
    var d = g.getImageData(0, 0, this.W, this.H).data;
    for (var i = 0, n = this.W * this.H; i < n; i++) { var a = d[4 * i + 3] / 255; if (a <= 0 || a <= this.G[i]) continue; var v = (d[4 * i] * 256 + d[4 * i + 1]) / 65535; this.R[i] = v * a; this.G[i] = a; }
  };
  // polylines, each drawn from v0 to v1 along its length
  Field.prototype.lines = function (items) {
    var cg = this.canvas(), g = cg[1];
    items.forEach(function (it) { var p = it.p, L = 0, i; for (i = 2; i < p.length; i += 2) L += Math.hypot(p[i] - p[i - 2], p[i + 1] - p[i - 1]); if (!L) return; var acc = 0;
      g.lineWidth = it.w || 10;
      for (i = 2; i < p.length; i += 2) { var d = Math.hypot(p[i] - p[i - 2], p[i + 1] - p[i - 1]); g.strokeStyle = enc(it.v0 + (it.v1 - it.v0) * (acc + d / 2) / L); acc += d;
        g.beginPath(); g.moveTo(sx(p[i - 2]), sy(p[i - 1])); g.lineTo(sx(p[i]), sy(p[i + 1])); g.stroke(); } });
    this.take(g);
  };
  Field.prototype.shapes = function (fn) { var cg = this.canvas(); fn(cg[1], enc); this.take(cg[1]); };
  // a value for every pixel from its world place (null: leave it)
  Field.prototype.world = function (fn) {
    for (var j = 0; j < this.H; j++) { var y = wy((j + 0.5) / this.k);
      for (var i = 0; i < this.W; i++) { var v = fn(wx((i + 0.5) / this.k), y); if (v === null || v === undefined) continue; var k = j * this.W + i; this.R[k] = v; this.G[k] = 1; } }
  };
  // the distance (metres) of every pixel from what is drawn white; and which pixels are inside a drawn shape
  Field.prototype.mask = function (draw) { var cg = this.canvas(), g = cg[1]; g.fillStyle = g.strokeStyle = '#fff'; draw(g); var d = g.getImageData(0, 0, this.W, this.H).data, m = new Uint8Array(this.W * this.H);
    for (var i = 0; i < m.length; i++) m[i] = d[4 * i + 3] > 100 ? 1 : 0; return m; };
  Field.prototype.dist = function (feat) { var e = bdEDT(feat, this.W, this.H, false), o = new Float32Array(e.length); for (var i = 0; i < e.length; i++) o[i] = Math.sqrt(e[i]) * this.mpp; return o; };
  Field.prototype.fill = function (inside, fn) { for (var i = 0; i < inside.length; i++) if (inside[i]) { var v = fn(i); if (v === null) continue; this.R[i] = v; this.G[i] = 1; } };
  Field.prototype.data = function () { var o = new Float32Array(this.W * this.H * 2); for (var i = 0; i < this.R.length; i++) { o[2 * i] = this.R[i]; o[2 * i + 1] = this.G[i]; } return o; };
  var cellsDraw = function (g) { g.beginPath(); DATA.cells.forEach(function (c) { path(g, c.ring, true); }); g.fill(); };
  var notIn = function (m) { var o = new Uint8Array(m.length); for (var i = 0; i < m.length; i++) o[i] = m[i] ? 0 : 1; return o; };

  // the slime mould's time to reach each place from the stations, along its veins (cheap where the mould is strong)
  var GEO = null;
  function geodesic() {
    if (GEO) return GEO;
    pxGrid(); var F0 = pxField('mould'), s = 2, W2 = Math.ceil(PX.W / s), H2 = Math.ceil(PX.H / s), n = W2 * H2, F = new Float32Array(n), D = new Float64Array(n).fill(Infinity), i, j;
    for (j = 0; j < H2; j++) for (i = 0; i < W2; i++) { var a = 0, c = 0; for (var dj = 0; dj < s; dj++) for (var di = 0; di < s; di++) { var x = i * s + di, y = j * s + dj; if (x < PX.W && y < PX.H) { a += F0[y * PX.W + x]; c++; } } F[j * W2 + i] = c ? a / c : 0; }
    var heap = [], push = function (d, k) { heap.push([d, k]); var q = heap.length - 1; while (q > 0) { var p = (q - 1) >> 1; if (heap[p][0] <= heap[q][0]) break; var t = heap[p]; heap[p] = heap[q]; heap[q] = t; q = p; } },
      pop = function () { var top = heap[0], l = heap.pop(); if (heap.length) { heap[0] = l; var q = 0; for (;;) { var a = 2 * q + 1, b = a + 1, m = q; if (a < heap.length && heap[a][0] < heap[m][0]) m = a; if (b < heap.length && heap[b][0] < heap[m][0]) m = b; if (m === q) break; var t = heap[m]; heap[m] = heap[q]; heap[q] = t; q = m; } } return top; };
    var cost = function (v) { return 1 / (0.04 + Math.pow(v, 1.6)); }, m2 = PX.m * s;
    DATA.stations.forEach(function (st) { var ci = Math.floor(st.x / m2), cj = Math.floor((DATA.size[1] - st.y) / m2), best = -1, bv = -1;
      for (var dj = -6; dj <= 6; dj++) for (var di = -6; di <= 6; di++) { var x = ci + di, y = cj + dj; if (x < 0 || y < 0 || x >= W2 || y >= H2) continue; var q = y * W2 + x; if (F[q] > bv) { bv = F[q]; best = q; } }
      if (best >= 0) { D[best] = 0; push(0, best); } });
    while (heap.length) { var top = pop(), d = top[0], k = top[1]; if (d > D[k]) continue; var x = k % W2, ck = cost(F[k]);
      var nb = [x > 0 ? k - 1 : -1, x < W2 - 1 ? k + 1 : -1, k - W2, k + W2];
      for (var q = 0; q < 4; q++) { var m = nb[q]; if (m < 0 || m >= n) continue; var nd = d + (ck + cost(F[m])) / 2; if (nd < D[m]) { D[m] = nd; push(nd, m); } } }
    var vals = []; for (i = 0; i < n; i += 3) if (F[i] > 0.12 && isFinite(D[i])) vals.push(D[i]); vals.sort(function (a, b) { return a - b; });
    GEO = { D: D, W: W2, H: H2, m: m2, q: vals.length ? vals[Math.floor(0.97 * (vals.length - 1))] : 1 };
    return GEO;
  }
  A.warm = function () { try { geodesic(); } catch (e) {} };

  // ---------------------------------------------------------------- each step: its field, how long, its extras
  var cellsBox = function () { var a = 1e9, b = -1e9; DATA.cells.forEach(function (c) { for (var i = 0; i < c.ring.length; i += 2) { a = Math.min(a, c.ring[i]); b = Math.max(b, c.ring[i]); } }); return [sx(a), sx(b)]; };
  var rank = function (n) { return function (i) { return n > 1 ? i / (n - 1) : 0; }; };
  var hash = function (k) { var x = Math.sin(k * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
  A.spec = function (k) {
    var f = new Field(), o = { k: k, dur: 3.5, gs: 0, ge: 0.35, w: 0.07, glowK: 0.9, glow: rgb(CHC[A.chapter(k)]), hasF: true };
    var M = function (v) { return Math.max(0, Math.min(1, v)); };
    if (k === 0) {                         // the site: the cells traced, then the loop, then the stations
      o.dur = 4.6; o.gs = 0; o.ge = 0.3;
      f.lines(DATA.cells.map(function (c) { return { p: c.ring.concat(c.ring.slice(0, 2)), v0: 0.03, v1: 0.4, w: 14 }; }));
      var orb = DATA.rail.filter(function (r) { return r.kind === 'orbital'; }), oth = DATA.rail.filter(function (r) { return r.kind !== 'orbital'; });
      f.lines(orb.map(function (r) { return { p: r.p, v0: 0.46, v1: 0.74, w: 18 }; })); f.lines(oth.map(function (r) { return { p: r.p, v0: 0.6, v1: 0.86, w: 12 }; }));
      f.shapes(function (g, e) { (DATA.cellLabels || []).forEach(function (l) { g.fillStyle = e(0.42); g.fillRect(sx(l.x) - 110, sy(l.y) - 22, 220, 44); });
        DATA.stations.forEach(function (s) { g.fillStyle = e(0.88); g.beginPath(); g.arc(sx(s.x), sy(s.y), 30, 0, 7); g.fill(); g.fillRect(sx(s.x), sy(s.y) - 40, 140, 36); });
        g.fillStyle = e(0.8); g.fillRect(0, 0, 0, 0); });
      o.label = true;
    } else if (k === 1) {                  // the mould grows from the stations along its veins
      o.dur = 5.2; var G = geodesic();
      f.world(function (x, y) { var i = Math.floor(x / G.m), j = Math.floor((DATA.size[1] - y) / G.m); if (i < 0 || j < 0 || i >= G.W || j >= G.H) return 0.95; var d = G.D[j * G.W + i]; return isFinite(d) ? 0.03 + 0.86 * M(d / G.q) : 0.95; });
    } else if (k === 2) {                  // the centrelines drawn along the veins, the veins fading
      o.dur = 4; o.gs = 0; o.ge = 0.85;
      f.lines(DATA.centrelines.map(function (c) { return { p: c.p, v0: 0.05, v1: 0.85, w: 10 }; }));
    } else if (k === 3) {                  // the cells filled from their edge in
      o.dur = 3; o.ge = 0.4; var inC = f.mask(cellsDraw), d3 = f.dist(notIn(inC)), mx = 0, i3;
      for (i3 = 0; i3 < d3.length; i3++) if (inC[i3] && d3[i3] > mx) mx = d3[i3];
      f.fill(inC, function (i) { return 0.04 + 0.86 * M(d3[i] / (mx || 1)); });
    } else if (k === 4) {                  // the roads by class, then their names
      o.dur = 6; o.ge = 0.3; var cl = { M: [0.04, 0.3, 18], A: [0.3, 0.6, 13], B: [0.58, 0.86, 9] };
      ['B', 'A', 'M'].forEach(function (c) { f.lines(DATA.roads.filter(function (r) { return r.c === c; }).map(function (r) { return { p: r.p, v0: cl[c][0], v1: cl[c][1], w: cl[c][2] }; })); });
      var names = typeof roadNames === 'function' ? roadNames() : [];
      f.shapes(function (g, e) { names.forEach(function (q) { g.fillStyle = e(cl[q.c][1] + 0.02); g.fillRect(sx(q.x) - 50, sy(q.y) - 16, 100, 32); }); });
      o.leg = 4;
    } else if (k === 5) {                  // the roads and towns cut into the cells
      o.dur = 4; var in5 = f.mask(cellsDraw), cut = f.mask(function (g) { g.lineWidth = 3; g.beginPath(); DATA.roads.forEach(function (r) { path(g, r.p, false); }); g.stroke(); g.beginPath(); DATA.towns.forEach(function (t) { path(g, t, true); }); g.fill(); }), d5 = f.dist(cut);
      f.fill(in5, function (i) { return 0.04 + 0.86 * M(d5[i] / 2600); });
    } else if (k === 6) {                  // a scan reads the soil, then Grade 1 and Grade 2 are shown
      o.dur = 8.5; var in6 = f.mask(cellsDraw), xs = cellsBox();
      f.fill(in6, function (i) { return 0.04 + 0.86 * M(((i % f.W) / f.k - xs[0]) / (xs[1] - xs[0])); });
      o.soil = true; o.leg = 6;
    } else if (k === 7) {                  // farming land first, then the land to build on
      o.dur = 3.6; ['farm', 'build'].forEach(function (kind, z) { var m = f.mask(function (g) { DATA.zones.filter(function (q) { return q.kind === kind; }).forEach(function (q) { g.beginPath(); q.rings.forEach(function (r) { path(g, r, true); }); g.fill('evenodd'); }); });
        var d = f.dist(notIn(m)), mx = 0, i; for (i = 0; i < d.length; i++) if (m[i] && d[i] > mx) mx = d[i];
        f.fill(m, function (i) { return (z ? 0.5 : 0.04) + 0.38 * M(d[i] / (mx || 1)); }); });
      var sm = f.mask(function (g) { DATA.small.forEach(function (r) { g.beginPath(); path(g, r, true); g.fill(); }); }); f.fill(sm, function () { return 0.9; });
    } else if (k === 8) {                  // the anchors, on the roads first, then between
      o.dur = 3.6; o.ge = 0.2; var seen = {}, road = [], btw = [];
      (S.per || []).forEach(function (l) { l.forEach(function (q) { if (seen[q.id]) return; seen[q.id] = 1; (q.kind === 'between' ? btw : road).push(q); }); });
      var P2 = DATA.stations.find(function (s) { return s.id === DATA.pick; }) || DATA.stations[0], byD = function (a, b) { return Math.hypot(a.x - P2.x, a.y - P2.y) - Math.hypot(b.x - P2.x, b.y - P2.y); };
      road.sort(byD); btw.sort(byD); var r1 = rank(road.length), r2 = rank(btw.length);
      f.shapes(function (g, e) { road.forEach(function (q, i) { g.fillStyle = e(0.04 + 0.4 * r1(i)); g.beginPath(); g.arc(sx(q.x), sy(q.y), 18, 0, 7); g.fill(); });
        btw.forEach(function (q, i) { g.fillStyle = e(0.5 + 0.38 * r2(i)); g.beginPath(); g.arc(sx(q.x), sy(q.y), 15, 0, 7); g.fill(); }); });
    } else if (k === 9) {                  // the threads tied, from the station outwards
      o.dur = 4; o.ge = 0.2; var P = DATA.stations.find(function (s) { return s.id === DATA.pick; }) || DATA.stations[0], all = [];
      (S.straight || []).forEach(function (l) { (l || []).forEach(function (t) { all.push(t); }); });
      var dm = function (t) { return Math.hypot((t[0] + t[2]) / 2 - P.x, (t[1] + t[3]) / 2 - P.y); }; all.sort(function (a, b) { return dm(a) - dm(b); }); var r9 = rank(all.length);
      f.lines(all.map(function (t, i) { var near = Math.hypot(t[0] - P.x, t[1] - P.y) < Math.hypot(t[2] - P.x, t[3] - P.y), p = near ? [t[0], t[1], t[2], t[3]] : [t[2], t[3], t[0], t[1]], b = 0.04 + 0.78 * r9(i);
        var q = [p[0], p[1]]; for (var s = 1; s <= 6; s++) q.push(p[0] + (p[2] - p[0]) * s / 6, p[1] + (p[3] - p[1]) * s / 6); return { p: q, v0: b, v1: b + 0.08, w: 6 }; }));
    } else if (k === 10) {                 // (when the wool is relaxed already) the straight threads ease into bundles
      o.dur = 2.4; o.hasF = false; o.gs = 0.05; o.ge = 0.95; o.glowK = 0;
    } else if (k === 21) {                 // the bands widen with the threads
      o.dur = 4; var th = f.mask(function (g) { g.lineWidth = 1.5; g.beginPath(); (S.relaxed || []).forEach(function (l) { (l || []).forEach(function (t) { path(g, t, false); }); }); g.stroke(); }), d21 = f.dist(th);
      f.fill(new Uint8Array(d21.length).fill(1), function (i) { return 0.04 + 0.86 * M(d21[i] / 360); });
    } else if (k === 22) {                 // the existing roads join in
      o.dur = 3.2; var in22 = f.mask(cellsDraw), rd = f.mask(function (g) { g.lineWidth = 2; g.beginPath(); DATA.roads.forEach(function (r) { path(g, r.p, false); }); g.stroke(); }), d22 = f.dist(rd);
      f.fill(in22, function (i) { return 0.04 + 0.86 * M(d22[i] / 2200); });
    } else if (k === 23 || k === 24) {     // what changed flashes, then settles
      o.dur = 3.4; o.hasF = false; o.gs = 0.3; o.ge = 0.8; o.glowK = 0; o.pulseAt = [0.05, 0.6];
    } else if (k === 25) {                 // the parcels take their use: urban, then farming, then parks and the rest
      o.dur = 4.2; var R = BD.res;
      if (R) { var lab = R.blocks.label, cls = R.blocks.cls, base = { 1: [0.04, 0.26], 2: [0.34, 0.26], 3: [0.64, 0.22], 4: [0.64, 0.22], 5: [0.64, 0.22] };
        f.world(function (x, y) { var i = Math.floor((x - R.box[0]) / R.px), j = Math.floor((R.box[3] - y) / R.px); if (i < 0 || j < 0 || i >= R.W || j >= R.H) return null; var L = lab[j * R.W + i], b = base[cls[L]];
          return b ? b[0] + b[1] * hash(L) : 0.92; }); }
    } else if (k === 26) {                 // the roads widen by class, the widest first
      o.dur = 4.2; o.ge = 0.25; var E = (BD.res && BD.res.edges || []).filter(function (e) { return e.pts && e.pts.length >= 4; }).slice().sort(function (a, b) { return (b.w || 0) - (a.w || 0); }), r26 = rank(E.length);
      f.lines(E.map(function (e, i) { var v = 0.04 + 0.82 * r26(i); return { p: e.pts, v0: v, v1: v + 0.04, w: Math.max(8, (e.w || 20) / S.view.mpp + 6) }; }));
    }
    o.field = o.hasF ? f : null; return o;
  };

  // ---------------------------------------------------------------- play one: before to after, by the field
  // ctl: { paused, skip, speed }; tick(u) may give uniforms (focus, pulse) and show extras
  A.run = function (before, after, o, ctl, tick) {
    init(); place(); shown = { b: before, a: after }; ov.style.display = '';
    if (!mode2d) { upImg('B', before); upImg('A', after);
      if (o.field) { gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, tex.F); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RG16F, o.field.W, o.field.H, 0, gl.RG, gl.FLOAT, o.field.data()); }
      if (o.focus) { gl.activeTexture(gl.TEXTURE3); gl.bindTexture(gl.TEXTURE_2D, tex.M); gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1); gl.texImage2D(gl.TEXTURE_2D, 0, gl.R8, o.focus.W, o.focus.H, 0, gl.RED, gl.UNSIGNED_BYTE, o.focus.m); } }
    var ease = function (u) { return u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2; };
    return new Promise(function (done) {
      var u = 0, last = performance.now();
      var frame = function (now) {
        if (ctl.dead) { done(false); return; }
        var dt = now - last; last = now; if (!ctl.paused) u += dt / (o.dur * 1000 / (ctl.speed || 1));
        if (ctl.skip) u = 1; u = Math.min(1, u);
        var x = tick ? tick(u) || {} : {}, tt = x.t !== undefined ? x.t : ease(u);
        render({ t: tt, w: o.w, gs: o.gs, ge: o.ge, glowK: o.glowK, glow: o.glow, hasF: !!o.field, pulse: x.pulse || 0, focus: x.focus || 0, hasM: !!o.focus });
        if (u >= 1) { done(true); return; }
        requestAnimationFrame(frame);
      };
      requestAnimationFrame(frame);
    });
  };
  A.focusMask = function (o, inside) { o.focus = inside; };
  A.Field = Field;
})();
