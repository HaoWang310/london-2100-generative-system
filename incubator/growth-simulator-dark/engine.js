/* Growth variations: the engine (12 Nov 2026).
   The release run's rules, v3 build_all.py lines 300-566, ported to the page, with the sliders on top. Same grid
   (50 m, 3,000 x 2,460), same layers, same 32 streams, same clock, same two passes, same farming kernels.
   What differs, on purpose:
   - the lottery: each parcel holds one ticket per seed (a Gumbel number from a hash of cell and seed), so turning a
     slider moves only what that slider controls; the release drew fresh numbers each year from one random stream;
   - every number the release hard-codes and the catalogue turned is a setting (defaults = the release);
   - two farming settings are new: the pull of good soil on fields, and its pull near the line (off by default).   */
"use strict";
var GV = (function () {
  var M, NX, NY, N, C, XMIN, YMAX, CELL;
  var BITS, ZONE, CAT, SPUR, F8, V8, DRAIL;
  var B = { BUILD: 1, BEST: 2, G3A: 4, ORD: 8, GOLF: 16, INSIDE: 32, URBAN: 64, WATER: 128 };
  var DP, DS, DN;                          // static: metres to the nearest primary / secondary / growing node
  var seedCache = {};

  var DEFAULTS = {
    wP: 3.0, dP: 9000, wS: 1.5, dS: 6000, wR: 0.6, sR: 1500,
    fa: 0.72, fb: 0.55, va: 0.28, vb: 1.35, warp: 1.0,
    reach: 1.9, expo: 1.7, adjA: 0.55, adjB: 0.75, soil: 0.45, rcore: 700, rmed: 1700,
    farmSoil: 1.0, farmLineK: 0.0, farmLineS: 3000, vband: 1.0, seed: 42
  };

  function init(meta, arr) {
    M = meta; NX = meta.NX; NY = meta.NY; N = NX * NY; C = meta.C; XMIN = meta.XMIN; YMAX = meta.YMAX; CELL = meta.CELL;
    BITS = arr.BITS; ZONE = arr.ZONE; CAT = arr.CAT; SPUR = arr.SPUR; F8 = arr.FIELD; V8 = arr.VEIN;
    DRAIL = arr.DRAIL;
    DP = new Float32Array(N); DS = new Float32Array(N); DN = new Float32Array(N);
    M.ABSTOT = 0; Object.keys(M.ABSPOP).forEach(function (z) { M.ABSTOT += M.ABSPOP[z]; });
    var P = [], S = [], i, j, k, e, n, d, bp, bs;
    M.GROW.forEach(function (g) { (g[1] === "P" ? P : S).push([g[2], g[3]]); });
    for (i = 0; i < NY; i++) {
      n = YMAX - (i + 0.5) * C;
      for (j = 0; j < NX; j++) {
        e = XMIN + (j + 0.5) * C; bp = Infinity; bs = Infinity;
        for (k = 0; k < P.length; k++) { d = (e - P[k][0]) * (e - P[k][0]) + (n - P[k][1]) * (n - P[k][1]); if (d < bp) bp = d; }
        for (k = 0; k < S.length; k++) { d = (e - S[k][0]) * (e - S[k][0]) + (n - S[k][1]) * (n - S[k][1]); if (d < bs) bs = d; }
        var q = i * NX + j;
        DP[q] = Math.sqrt(bp); DS[q] = Math.sqrt(bs); DN[q] = Math.min(DP[q], DS[q]);
      }
    }
  }

  // ------------------------------------------------------------------ randomness, all from the seed
  function hash(x) {                           // a 32-bit integer finaliser
    x = Math.imul(x ^ (x >>> 16), 0x7feb352d); x = Math.imul(x ^ (x >>> 15), 0x846ca68b); return (x ^ (x >>> 16)) >>> 0;
  }
  function gumbel(seed, salt) {                 // one ticket per parcel
    var g = new Float32Array(N), s = hash(seed * 7919 + salt * 104729), i, u;
    for (i = 0; i < N; i++) { u = (hash(i ^ s) + 0.5) / 4294967296; g[i] = -Math.log(-Math.log(u)); }
    return g;
  }
  function prng(seed) {                         // mulberry32
    var a = seed >>> 0;
    return function () { a = (a + 0x6D2B79F5) | 0; var t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }
  function normals(seed) {
    var r = prng(seed), a = new Float32Array(N), i, u, v;
    for (i = 0; i < N; i += 2) {
      u = Math.max(1e-12, r()); v = r();
      var m = Math.sqrt(-2 * Math.log(u)); a[i] = m * Math.cos(6.283185307 * v); if (i + 1 < N) a[i + 1] = m * Math.sin(6.283185307 * v);
    }
    return a;
  }
  function boxBlur(a, r) {                      // separable mean over (2r+1)^2, edges clamped
    var t = new Float32Array(N), i, j, s, w = 2 * r + 1, row, lo, hi;
    for (i = 0; i < NY; i++) {
      row = i * NX; s = 0;
      for (j = -r; j <= r; j++) s += a[row + Math.min(NX - 1, Math.max(0, j))];
      for (j = 0; j < NX; j++) {
        t[row + j] = s / w;
        lo = Math.max(0, j - r); hi = Math.min(NX - 1, j + r + 1); s += a[row + hi] - a[row + lo];
      }
    }
    for (j = 0; j < NX; j++) {
      s = 0;
      for (i = -r; i <= r; i++) s += t[Math.min(NY - 1, Math.max(0, i)) * NX + j];
      for (i = 0; i < NY; i++) {
        a[i * NX + j] = s / w;
        lo = Math.max(0, i - r); hi = Math.min(NY - 1, i + r + 1); s += t[hi * NX + j] - t[lo * NX + j];
      }
    }
    return a;
  }
  function gauss(a, sigma) {                    // three boxes ~ a Gaussian of this sigma
    var wIdeal = Math.sqrt(12 * sigma * sigma / 3 + 1), wl = Math.floor(wIdeal); if (wl % 2 === 0) wl--;
    var m = Math.round((12 * sigma * sigma - 3 * wl * wl - 12 * wl - 9) / (-4 * wl - 4)), k;
    for (k = 0; k < 3; k++) boxBlur(a, ((k < m ? wl : wl + 2) - 1) / 2);
    return a;
  }
  function fields(seed) {
    if (seedCache[seed]) return seedCache[seed];
    var F = new Float32Array(N), V = new Float32Array(N), i;
    if (seed === 42) {                          // the release's own noise
      for (i = 0; i < N; i++) { F[i] = F8[i] / 255; V[i] = V8[i] / 255; }
    } else {                                    // the release's recipe, drawn again
      var f = boxBlur(normals(seed * 3 + 1), 10), mn = Infinity, mx = -Infinity;
      for (i = 0; i < N; i++) { if (f[i] < mn) mn = f[i]; if (f[i] > mx) mx = f[i]; }
      for (i = 0; i < N; i++) F[i] = (f[i] - mn) / (mx - mn + 1e-9);
      [[8, 2.2, 0.45], [19, 2.0, 0.35], [38, 1.8, 0.20]].forEach(function (o, oi) {
        var a = gauss(normals(seed * 3 + 2 + oi * 17), o[0]), s1 = 0, s2 = 0;
        for (i = 0; i < N; i++) { s1 += a[i]; s2 += a[i] * a[i]; }
        var mu = s1 / N, sd = Math.sqrt(Math.max(1e-12, s2 / N - mu * mu));
        for (i = 0; i < N; i++) V[i] += o[2] * Math.pow(Math.max(0, Math.min(1, 1 - Math.abs((a[i] - mu) / sd))), o[1]);
      });
      mx = 0; for (i = 0; i < N; i++) if (V[i] > mx) mx = V[i];
      for (i = 0; i < N; i++) V[i] /= (mx + 1e-9);
    }
    seedCache = {};                              // keep one seed in memory
    seedCache[seed] = { F: F, V: V, GU: gumbel(seed, 1), GVf: gumbel(seed, 2), GH: gumbel(seed, 3) };
    return seedCache[seed];
  }

  // ------------------------------------------------------------------ helpers
  function frac(y) { return M.FRAC[Math.max(0, Math.min(75, y - 2025))]; }
  function ramp(y, start, p) { if (start === null || start === undefined || y < start) return 0; return Math.min(1, Math.max(0, Math.pow((y - start) / (2100 - start), p))); }
  function landTarget(st, y) {
    if (y < st.gate) return 0;
    var f0 = frac(st.gate), t = Math.min(1, Math.max(0, (frac(y) - f0) / Math.max(1e-6, 1 - f0)));
    return Math.round(st.land * Math.pow(t, 0.62));
  }
  // top k of keys (largest), over idx[0..n); reorders idx in place, returns k
  function selectTop(idx, key, n, k) {
    if (k >= n) return n;
    var lo = 0, hi = n - 1;
    while (lo < hi) {
      var pv = key[idx[(lo + hi) >> 1]], i = lo, j = hi, t;
      while (i <= j) {
        while (key[idx[i]] > pv) i++;
        while (key[idx[j]] < pv) j--;
        if (i <= j) { t = idx[i]; idx[i] = idx[j]; idx[j] = t; i++; j--; }
      }
      if (k - 1 <= j) hi = j; else if (k - 1 >= i) lo = i; else break;
    }
    return k;
  }
  function edt(feature) {                        // metres to the nearest feature cell (Felzenszwalb)
    var INF = 1e20, f = new Float64Array(Math.max(NX, NY)), dd = new Float64Array(Math.max(NX, NY));
    var v = new Int32Array(Math.max(NX, NY)), z = new Float64Array(Math.max(NX, NY) + 1), g = new Float64Array(N), i, j;
    function dt1(len) {
      var k = 0, q, s; v[0] = 0; z[0] = -INF; z[1] = INF;
      for (q = 1; q < len; q++) {
        s = ((f[q] + q * q) - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
        while (s <= z[k]) { k--; s = ((f[q] + q * q) - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]); }
        k++; v[k] = q; z[k] = s; z[k + 1] = INF;
      }
      k = 0;
      for (q = 0; q < len; q++) { while (z[k + 1] < q) k++; dd[q] = (q - v[k]) * (q - v[k]) + f[v[k]]; }
    }
    for (j = 0; j < NX; j++) {
      for (i = 0; i < NY; i++) f[i] = feature[i * NX + j] ? 0 : INF;
      dt1(NY); for (i = 0; i < NY; i++) g[i * NX + j] = dd[i];
    }
    var out = new Float32Array(N);
    for (i = 0; i < NY; i++) {
      for (j = 0; j < NX; j++) f[j] = g[i * NX + j];
      dt1(NX); for (j = 0; j < NX; j++) out[i * NX + j] = Math.sqrt(dd[j]) * C;
    }
    return out;
  }
  function addWin(cnt, q, r) {                   // +1 over the (2r+1)^2 window round cell q
    var i0 = (q / NX) | 0, j0 = q - i0 * NX, i, j, a = Math.max(0, i0 - r), b = Math.min(NY - 1, i0 + r), c0 = Math.max(0, j0 - r), c1 = Math.min(NX - 1, j0 + r);
    for (i = a; i <= b; i++) { var row = i * NX; for (j = c0; j <= c1; j++) cnt[row + j]++; }
  }

  // ------------------------------------------------------------------ the magnet field, for drawing
  function score(p, F, V) {                      // U before the draw, as the release builds it
    var U = new Float32Array(N), i, u, b;
    for (i = 0; i < N; i++) {
      b = BITS[i]; if (!(b & B.BUILD)) continue;
      u = p.wP * Math.exp(-DP[i] / p.dP) + p.wS * Math.exp(-DS[i] / p.dS) + p.wR * Math.exp(-DRAIL[i] / p.sR);
      u *= (p.va + p.vb * V[i]) * (p.fa + p.fb * F[i]);
      if (b & B.ORD) u *= 1.35; if (b & B.GOLF) u *= 1.5; if (b & B.BEST) u *= p.soil;
      U[i] = u;
    }
    return U;
  }

  // ------------------------------------------------------------------ a run
  function run(params, onProgress, onYear) {     // onYear(pass, year, tier): every year of both passes, the live tiers (read only)
    var p = Object.assign({}, DEFAULTS, params || {});
    var T0 = performance.now(), timing = {};
    var FD = fields(p.seed), F = FD.F, V = FD.V, GU = FD.GU, GVf = FD.GVf, GH = FD.GH;
    timing.fields = performance.now() - T0;
    var U = score(p, F, V), LW = new Float32Array(N), i, j;
    for (i = 0; i < N; i++) LW[i] = U[i] > 0 ? p.expo * Math.log(U[i]) : -Infinity;
    U = null;
    var ADJ = new Float32Array(26); for (i = 0; i <= 25; i++) ADJ[i] = Math.log(Math.max(1e-6, p.adjA + p.adjB * i / 25));
    var JIT = new Float32Array(N), w = p.warp;
    for (i = 0; i < N; i++) JIT[i] = (1 - 0.30 * w + 0.60 * w * F[i]) * (1 - 0.20 * w + 0.40 * w * V[i]);

    // the 32 streams, with their own ground
    var GROWIX = {}; M.GROW.forEach(function (g, k) { GROWIX[g[0]] = k; });
    var streams = M.STREAMS.map(function (s, k) { return Object.assign({}, s, { id: k + 1 }); });
    var ribbonList = {}, spurList = {}, z;
    for (z = 1; z <= 6; z++) { ribbonList[z] = []; spurList[z] = []; }
    for (i = 0; i < N; i++) {
      if (!(BITS[i] & B.BUILD)) continue;
      z = ZONE[i];
      if (z && DRAIL[i] <= 2600) ribbonList[z].push(i);
      if (SPUR[i]) for (j = 1; j <= 6; j++) if (SPUR[i] & (1 << (j - 1))) spurList[j].push(i);
    }
    streams.forEach(function (st) {
      if (st.key in GROWIX) {
        var g = M.GROW[GROWIX[st.key]], ci = GROWIX[st.key];
        st.node = true; st.e = g[2]; st.n = g[3];
        st.reach = Math.sqrt(Math.max(st.land * CELL, 1) / Math.PI) * 1000 * p.reach; st.maskR = 1.7 * st.reach;
        var c0 = Math.max(0, Math.floor((st.e - st.maskR - XMIN) / C)), c1 = Math.min(NX - 1, Math.ceil((st.e + st.maskR - XMIN) / C));
        var r0 = Math.max(0, Math.floor((YMAX - st.n - st.maskR) / C)), r1 = Math.min(NY - 1, Math.ceil((YMAX - st.n + st.maskR) / C));
        var ids = [], ds = [], rr, cc, dd, q;
        for (rr = r0; rr <= r1; rr++) for (cc = c0; cc <= c1; cc++) {
          q = rr * NX + cc; if (!(BITS[q] & B.BUILD) || CAT[q] !== ci) continue;
          dd = Math.hypot(XMIN + (cc + 0.5) * C - st.e, YMAX - (rr + 0.5) * C - st.n);
          if (dd <= st.maskR) { ids.push(q); ds.push(dd); }
        }
        var ord = ids.map(function (_, k) { return k; }).sort(function (a, b) { return ds[a] - ds[b]; });
        st.list = Int32Array.from(ord.map(function (k) { return ids[k]; }));
        st.dist = Float32Array.from(ord.map(function (k) { return ds[k]; }));
      } else if (st.key === "ribbon") st.list = Int32Array.from(ribbonList[st.zone]);
      else if (st.key === "spur") st.list = Int32Array.from(spurList[st.zone]);
      else st.list = new Int32Array(0);         // farm_t: built for pass 2
    });
    ribbonList = spurList = null;
    timing.setup = performance.now() - T0;

    var tier = new Uint8Array(N), owner = new Uint8Array(N), nb5 = new Uint8Array(N), d15 = new Uint16Array(N), l21 = new Uint16Array(N);
    var KEY = new Float32Array(N), CAND = new Int32Array(N);
    var DFIN = null, DFINV = null, FARMOK = null, VL = null, HL = null, HP = null;
    var events = null, stats = null, cnt = null, urbanN = 0;

    function inMask(st, q) {
      if (!(BITS[q] & B.BUILD)) return false;
      if (st.node) {
        if (CAT[q] !== GROWIX[st.key]) return false;
        var rr = (q / NX) | 0, cc = q - rr * NX;
        return Math.hypot(XMIN + (cc + 0.5) * C - st.e, YMAX - (rr + 0.5) * C - st.n) <= st.maskR;
      }
      if (st.key === "ribbon") return ZONE[q] === st.zone && DRAIL[q] <= 2600;
      if (st.key === "spur") return (SPUR[q] & (1 << (st.zone - 1))) !== 0;
      return ZONE[q] === st.zone;
    }
    function put(q, cls, st) {                   // a parcel changes; recorded in pass 2
      var old = tier[q];
      if (old) cnt[old]--;
      tier[q] = cls; cnt[cls]++;
      if (events) { events.idx.push(q); events.cls.push(cls); }
      if (st) { owner[q] = st.id; st.cells.push(q); }
    }
    function disc(e, n, rad, st, fresh) {
      var c = (e - XMIN) / C - 0.5, r = (YMAX - n) / C - 0.5, rr = rad / C, got = 0, a, b;
      for (a = Math.max(0, Math.floor(r - rr - 2)); a < Math.min(NY, Math.floor(r + rr + 3)); a++)
        for (b = Math.max(0, Math.floor(c - rr - 2)); b < Math.min(NX, Math.floor(c + rr + 3)); b++) {
          var q = a * NX + b;
          if (Math.hypot(b - c, a - r) <= rr && tier[q] === 0 && inMask(st, q)) { put(q, 1, st); fresh.push(q); got++; }
        }
      return got;
    }
    function plant(st, fresh) {
      if (st.seed === "spine") { var got = 0; M.RIBBON_SEEDS[st.zone].forEach(function (pt) { got += disc(pt[0], pt[1], 170, st, fresh); }); return got; }
      if (st.seed === "stations") { var g2 = 0; (M.STATIONS[M.ZPRIM[st.zone]] || []).forEach(function (pt) { g2 += disc(pt[0], pt[1], 320, st, fresh); }); return g2; }
      if (st.seed === "band") return 0;
      return disc(st.e, st.n, 500, st, fresh);
    }
    function djit(st, q) { var rr = (q / NX) | 0, cc = q - rr * NX; return Math.hypot(XMIN + (cc + 0.5) * C - st.e, YMAX - (rr + 0.5) * C - st.n) * JIT[q]; }

    function* pass(doFarm) {
      tier.fill(0); owner.fill(0); nb5.fill(0); d15.fill(0); l21.fill(0); urbanN = 0;
      cnt = new Int32Array(6);
      streams.forEach(function (st) { st.got = 0; st.cells = []; });
      if (doFarm) { events = { idx: [], cls: [], off: [0] }; stats = []; } else { events = null; }
      var vHave = new Int32Array(7), y, k, n, st;
      for (y = 2025; y <= 2100; y++) {
        var urbAny = urbanN > 0, fresh = [];
        for (k = 0; k < streams.length; k++) {
          st = streams[k];
          if (y < st.gate) continue;
          if (st.key === "farm_t" && (!doFarm || !DFIN)) continue;
          var need = landTarget(st, y) - st.got;
          if (need <= 0) continue;
          if (st.seed !== "band" && st.got === 0) { st.got += plant(st, fresh); need = landTarget(st, y) - st.got; if (need <= 0) continue; }
          if (!urbAny) continue;                       // nothing is drawn until something stands
          var L = st.list, nc = 0, t, q, pos = 0;
          if (st.node) {
            t = Math.min(1, st.got / Math.max(1, st.land));
            var rr = st.reach * Math.max(0.18, Math.pow(t, 0.35)), wide = st.reach * 1.6;
            while (pos < L.length && st.dist[pos] <= rr) { q = L[pos++]; if (tier[q] === 0) CAND[nc++] = q; }
            if (nc < need) while (pos < L.length && st.dist[pos] <= wide) { q = L[pos++]; if (tier[q] === 0) CAND[nc++] = q; }
          } else if (st.key === "farm_t") {
            for (pos = 0; pos < L.length; pos++) { q = L[pos]; if (tier[q] === 0) CAND[nc++] = q; }
          } else {
            for (pos = 0; pos < L.length; pos++) { q = L[pos]; if (tier[q] === 0) CAND[nc++] = q; }
          }
          if (!nc) continue;
          for (n = 0; n < nc; n++) { q = CAND[n]; KEY[q] = LW[q] + ADJ[nb5[q]] + GU[q]; }
          var kk = selectTop(CAND, KEY, nc, Math.min(need, nc));
          for (n = 0; n < kk; n++) { q = CAND[n]; put(q, 1, st); fresh.push(q); }
          st.got += kk;
        }
        for (n = 0; n < fresh.length; n++) { q = fresh[n]; addWin(nb5, q, 2); addWin(d15, q, 7); if (doFarm) addWin(l21, q, 10); }
        urbanN += fresh.length;
        // density: only ever up, from the station outward (nodes) or where it is densest (line and spurs)
        for (k = 0; k < streams.length; k++) {
          st = streams[k]; var cells = st.cells; if (!cells.length) continue;
          var wantMH = Math.round((st.M + st.H) * ramp(y, st.m_start, 0.85)), haveMH = 0, haveH = 0;
          for (n = 0; n < cells.length; n++) { t = tier[cells[n]]; if (t === 2 || t === 3) haveMH++; if (t === 3) haveH++; }
          if (wantMH > haveMH) {
            nc = 0;
            if (st.node) { for (n = 0; n < cells.length; n++) { q = cells[n]; if (tier[q] === 1) { var dj = djit(st, q); if (dj >= p.rcore) { CAND[nc++] = q; KEY[q] = -dj; } } } }
            else { for (n = 0; n < cells.length; n++) { q = cells[n]; if (tier[q] === 1) { CAND[nc++] = q; KEY[q] = d15[q] / 225 * (0.4 + 1.2 * V[q]); } } }
            var km = selectTop(CAND, KEY, nc, Math.min(nc, wantMH - haveMH));
            for (n = 0; n < km; n++) put(CAND[n], 2, null);
          }
          if (st.h_start !== null && st.h_start !== undefined) {
            var wantH = Math.round(st.H * ramp(y, st.h_start, 0.95));
            if (wantH > haveH) {
              nc = 0;
              for (n = 0; n < cells.length; n++) { q = cells[n]; if (tier[q] === 2) { var d2 = djit(st, q); if (d2 >= p.rmed) { CAND[nc++] = q; KEY[q] = -d2; } } }
              var kh = selectTop(CAND, KEY, nc, Math.min(nc, wantH - haveH));
              for (n = 0; n < kh; n++) put(CAND[n], 3, null);
            }
          }
        }
        // farming, against the final edge of pass 1
        if (doFarm && DFIN) {
          for (z = 1; z <= 6; z++) {
            var fv = Math.round(M.FARM[z].fv * ramp(y, 2035, 0.80));
            if (fv > vHave[z]) {
              var vl = VL[z], ws = VL[z].w; nc = 0;
              for (n = 0; n < vl.length; n++) {
                q = vl[n]; if (tier[q] !== 0) continue;
                var wv = ws[n] * (1 - 0.85 * Math.min(1, l21[q] / 441 / 0.35));
                if (wv > 0.02) { CAND[nc++] = q; KEY[q] = 1.6 * Math.log(wv) + GVf[q]; }
              }
              var kv = selectTop(CAND, KEY, nc, Math.min(nc, fv - vHave[z]));
              for (n = 0; n < kv; n++) put(CAND[n], 5, null);
              vHave[z] += kv;
            }
            var fh = Math.round(M.FARM[z].fh * Math.min(1, frac(y) * 1.15)), hl = HL[z];
            var hHave = HL[z].have;
            while (fh > hHave && HP[z] < hl.length) { q = hl[HP[z]++]; if (tier[q] === 0) { put(q, 4, null); hHave++; } }
            HL[z].have = hHave;
          }
        }
        if (doFarm) {
          events.off.push(events.idx.length);
          var pop = (cnt[1] * M.PPK.L + cnt[2] * M.PPK.M + cnt[3] * M.PPK.H) * CELL + M.ABSTOT;
          stats.push({ y: y, pop: Math.round(pop), km2: { l: cnt[1] * CELL, m: cnt[2] * CELL, h: cnt[3] * CELL, fh: cnt[4] * CELL, fv: cnt[5] * CELL } });
        }
        if (onYear) onYear(doFarm ? 2 : 1, y, tier);
        yield { pass: doFarm ? 2 : 1, year: y };
      }
    }

    function prepareFarming() {
      var URB = new Uint8Array(N), URBV = new Uint8Array(N), spurIds = {}, i2, z2;
      streams.forEach(function (st) { if (st.key === "spur") spurIds[st.id] = 1; });
      for (i2 = 0; i2 < N; i2++) { var t2 = tier[i2]; if (t2 >= 1 && t2 <= 3) { URB[i2] = 1; if (!spurIds[owner[i2]]) URBV[i2] = 1; } }
      DFIN = edt(URB); DFINV = edt(URBV);
      FARMOK = new Uint8Array(N);
      for (i2 = 0; i2 < N; i2++) FARMOK[i2] = (BITS[i2] & B.BUILD) && !URB[i2] ? 1 : 0;
      // the farm band's housing: inside the zone, 800-2,300 m off the final edge
      streams.forEach(function (st) {
        if (st.key !== "farm_t") return;
        var a = [];
        for (var q = 0; q < N; q++) if ((BITS[q] & B.BUILD) && ZONE[q] === st.zone && DFIN[q] >= 800 && DFIN[q] <= 2300) a.push(q);
        st.list = Int32Array.from(a);
      });
      VL = {}; HL = {}; HP = {};
      var vlists = {}, vw = {}, hlists = {}, hk = {};
      for (z2 = 1; z2 <= 6; z2++) { vlists[z2] = []; vw[z2] = []; hlists[z2] = []; hk[z2] = []; }
      var vf = p.vband, sm = p.farmSoil;
      for (i2 = 0; i2 < N; i2++) {
        if (!FARMOK[i2]) continue;
        z2 = ZONE[i2]; if (!z2) continue;
        var b = BITS[i2], best = (b & B.BEST) ? 1 : 0, g3a = (b & B.G3A) ? 1 : 0, Fv = F[i2], Vv = V[i2];
        var VB = M.VBAND[z2], pk = VB[0] * vf, sg = VB[1] * vf, ta = Math.min(0.6, VB[2] * vf), tl = VB[3] * vf, dv = DFINV[i2];
        var wv = Math.exp(-Math.pow((dv - pk) / sg, 2)) + ta * Math.exp(-dv / tl);
        wv *= (0.55 + 0.9 * Vv) * (0.7 + 0.6 * Fv) * (best ? 0.5 : 1);
        if (wv > 0.02) { vlists[z2].push(i2); vw[z2].push(wv); }
        var D = DFIN[i2];
        var wh = Math.exp(-Math.pow((D - 2300) / 1750, 2)) + 0.34 * Math.exp(-Math.max(0, D - 180) / 4500)
          + 0.55 * sm * ((best || g3a) ? 1 : 0) * Math.exp(-Math.max(0, D - 500) / 7000) + 0.35 * Math.exp(-DN[i2] / 14000);
        wh *= Math.exp(-Math.max(0, D - 11000) / 3000);
        wh *= (0.30 + 2.9 * sm * best + 1.1 * sm * g3a);
        wh *= (1 + 0.9 * Math.exp(-DS[i2] / 9000));
        var inner = Math.min(1, Math.max(0, (DRAIL[i2] - 5000) / 15000));
        wh *= (1 - 0.92 * ((b & B.INSIDE) ? 1 : 0) * inner);
        wh *= (0.60 + 0.85 * Fv);
        if (p.farmLineK > 0 && (best || g3a)) wh *= 1 + p.farmLineK * Math.exp(-DRAIL[i2] / p.farmLineS);
        if (wh > 0.015) { hlists[z2].push(i2); hk[z2].push(1.4 * Math.log(wh) + GH[i2]); }
      }
      for (z2 = 1; z2 <= 6; z2++) {
        VL[z2] = Int32Array.from(vlists[z2]); VL[z2].w = Float32Array.from(vw[z2]);
        var ks = hk[z2], ids = hlists[z2], ord = ids.map(function (_, k2) { return k2; }).sort(function (a, b2) { return ks[b2] - ks[a]; });
        HL[z2] = Int32Array.from(ord.map(function (k2) { return ids[k2]; })); HL[z2].have = 0; HP[z2] = 0;
      }
    }

    // the driver: two passes, a year at a time, giving the page room to breathe
    return new Promise(function (resolve) {
      var it = pass(false), phase = 1, last;
      function step() {
        var t0 = performance.now(), r;
        while (performance.now() - t0 < 45) {
          r = it.next();
          if (r.done) {
            if (phase === 1) {
              timing.pass1 = performance.now() - T0;
              prepareFarming(); phase = 2; it = pass(true);
              timing.farmPrep = performance.now() - T0;
              continue;
            }
            timing.total = performance.now() - T0;
            resolve({ params: p, idx: Uint32Array.from(events.idx), cls: Uint8Array.from(events.cls), off: events.off, stats: stats, timing: timing });
            return;
          }
          last = r.value;
        }
        if (onProgress && last) onProgress(last);
        setTimeout(step, 0);
      }
      setTimeout(step, 0);
    });
  }

  return { init: init, run: run, DEFAULTS: DEFAULTS, score: score, fields: fields, B: B,
           get: function () { return { BITS: BITS, ZONE: ZONE, DRAIL: DRAIL, DP: DP, DN: DN, NX: NX, NY: NY, N: N, M: M }; } };
})();
