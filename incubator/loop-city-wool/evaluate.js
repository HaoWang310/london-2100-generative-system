/* Loop City step 2 · chapter 5, the evaluation (25 Nov 2026).
   After the road hierarchy (step 16) and before the parcels are taken (17): six measures of the network the method made,
   each marked good, fair or to change, with the step whose setting moves it; and a comparison of three settings of the
   surplus (4, 8 and 12 %), each worked out in full (relaxation, network, hierarchy, junctions) beside the one on show.
   It reads the page's state (S, BD, DATA, FLOOD, P) and its functions; it changes nothing in it except, on "Use this",
   the surplus slider. The card itself is drawn by explain.js (step 28). */
(function () {
  'use strict';
  var W5 = window.Wool5 = { cmp: null, busy: false, msg: '' };
  var zh = function () { return /^zh/i.test(document.documentElement.lang || ''); };
  var T = function (en, cn) { return zh() ? cn : en; };
  var f = function (v, d) { return Number(v).toLocaleString('en-GB', { minimumFractionDigits: d || 0, maximumFractionDigits: d || 0 }); };
  var RANK = { H: 4, 60: 3, 48: 2, 30: 1, 24: 0 };

  // ---------------------------------------------------------------- the measures, on a network R and its wool
  function detour(relaxed, jobs) {                       // each thread over the shortest way round the voids
    var g = [];
    (relaxed || []).forEach(function (ls, k) { var job = jobs && jobs[k]; if (!ls || !job) return;
      ls.forEach(function (L, t) { var l = 0; for (var i = 2; i < L.length; i += 2) l += Math.hypot(L[i] - L[i - 2], L[i + 1] - L[i - 1]);
        var c = Math.hypot(L[L.length - 2] - L[0], L[L.length - 1] - L[1]); if (c < 1) return; g.push(l / (job.rest ? Math.max(c, job.rest[t] / job.f) : c)); }); });
    g.sort(function (a, b) { return a - b; });
    return g.length ? { med: g[g.length >> 1], max: g[g.length - 1] } : null;
  }
  function circuity(R) {                                 // the way along the roads over the straight line, between junctions 2 km and more apart
    var adj = new Map(), pos = new Map();
    R.edges.forEach(function (e) { var q = e.pts, n = q.length / 2; if (n < 2) return; var l = 0; for (var i = 2; i < q.length; i += 2) l += Math.hypot(q[i] - q[i - 2], q[i + 1] - q[i - 1]);
      [[e.a, e.b], [e.b, e.a]].forEach(function (p) { if (!adj.has(p[0])) adj.set(p[0], []); adj.get(p[0]).push([p[1], l]); });
      if (!pos.has(e.a)) pos.set(e.a, [q[0], q[1]]); if (!pos.has(e.b)) pos.set(e.b, [q[2 * n - 2], q[2 * n - 1]]); });
    var nodes = Array.from(adj.keys()).sort(function (a, b) { return a - b; }), out = [], step = Math.max(1, Math.floor(nodes.length / 36));
    for (var s = 0; s < nodes.length; s += step) {
      var src = nodes[s], dist = new Map([[src, 0]]), heap = [[0, src]];
      while (heap.length) { var bi = 0; for (var h = 1; h < heap.length; h++) if (heap[h][0] < heap[bi][0]) bi = h;
        var top = heap.splice(bi, 1)[0], d = top[0], u = top[1]; if (d > dist.get(u)) continue;
        (adj.get(u) || []).forEach(function (vl) { var nd = d + vl[1]; if (!dist.has(vl[0]) || nd < dist.get(vl[0])) { dist.set(vl[0], nd); heap.push([nd, vl[0]]); } }); }
      var ps = pos.get(src);
      for (var t = 0; t < nodes.length; t += 7) { var pt = pos.get(nodes[t]), e2 = Math.hypot(pt[0] - ps[0], pt[1] - ps[1]); if (e2 > 2000 && dist.has(nodes[t])) out.push(dist.get(nodes[t]) / e2); }
    }
    out.sort(function (a, b) { return a - b; });
    return out.length ? { med: out[out.length >> 1], p90: out[Math.floor(out.length * 0.9)] } : null;
  }
  function junctions(R) {                                // the new junctions: T, Y, four ways, and how many meet at a skew
    var arm = function (q, end) { var n = q.length / 2, i0 = end ? n - 1 : 0, s = 0, k = i0, st = end ? -1 : 1;
      while (k + st >= 0 && k + st < n && s < 60) { s += Math.hypot(q[2 * (k + st)] - q[2 * k], q[2 * (k + st) + 1] - q[2 * k + 1]); k += st; }
      return Math.atan2(q[2 * k + 1] - q[2 * i0 + 1], q[2 * k] - q[2 * i0]); };
    var at = new Map(), rb = (R.jx && R.jx.jx || []).filter(function (j) { return j.r > 0; });
    R.edges.forEach(function (e) { if (e.pts.length < 4) return; var ex = (e.on && !e.draw) || e.rim || e.cl === 'H';
      [[e.a, 0], [e.b, 1]].forEach(function (p) { if (!at.has(p[0])) at.set(p[0], []); var q = e.pts, n = q.length / 2;
        at.get(p[0]).push({ a: arm(q, p[1]), ex: ex, cl: e.cl, x: p[1] ? q[2 * n - 2] : q[0], y: p[1] ? q[2 * n - 1] : q[1] }); }); });
    var c = { T: 0, Y: 0, X: 0, skew: 0, n3: 0, round: 0 };
    at.forEach(function (arms) {
      if (arms.length < 3 || arms.some(function (o) { return o.ex; })) return;
      if (rb.some(function (j) { return Math.hypot(j.x - arms[0].x, j.y - arms[0].y) < 5; })) { c.round++; return; }
      if (arms.length >= 4) { c.X++; return; }
      var A = arms.map(function (o) { return o.a; }).sort(function (a, b) { return a - b; }), big = 0;
      for (var i = 0; i < 3; i++) big = Math.max(big, (i < 2 ? A[i + 1] : A[0] + 2 * Math.PI) - A[i]);
      if (big * 180 / Math.PI >= 160) c.T++; else c.Y++;
      var best = null; for (var p = 0; p < 3; p++) for (var q = p + 1; q < 3; q++) { var g = Math.abs(arms[p].a - arms[q].a); g = Math.min(g, 2 * Math.PI - g); var w = g + 0.001 * ((RANK[arms[p].cl] || 0) + (RANK[arms[q].cl] || 0)); if (!best || w > best.w) best = { w: w, p: p, q: q }; }
      var k = 3 - best.p - best.q, u1 = [Math.cos(arms[best.p].a), Math.sin(arms[best.p].a)], u2 = [Math.cos(arms[best.q].a), Math.sin(arms[best.q].a)], t = [u1[0] - u2[0], u1[1] - u2[1]], tn = Math.hypot(t[0], t[1]) || 1;
      var ang = Math.acos(Math.min(1, Math.abs((t[0] * Math.cos(arms[k].a) + t[1] * Math.sin(arms[k].a)) / tn))) * 180 / Math.PI;
      var main = arms.some(function (o) { return o.cl === '60' || o.cl === '48'; }); c.n3++; if (ang < (main ? 75 : 60)) c.skew++;
    });
    var tot = c.T + c.Y + c.X; c.tPct = tot ? 100 * c.T / tot : 0; c.skewPct = c.n3 ? 100 * c.skew / c.n3 : 0; return c;
  }
  function flood(R) {                                    // the roads' share of length in the flood corridors, over the corridors' share of the land
    var F = typeof FLOOD !== 'undefined' && FLOOD ? FLOOD : (typeof floodOf === 'function' ? floodOf(true) : null); if (!F) return null;
    var inC = 0, wet = 0; for (var i = 0; i < F.inC.length; i++) if (F.inC[i]) { inC++; if (F.corr[i]) wet++; }
    var L = 0, Lw = 0; R.edges.forEach(function (e) { if (!e.draw && e.on) return; var q = e.pts; for (var j = 2; j < q.length; j += 2) { var l = Math.hypot(q[j] - q[j - 2], q[j + 1] - q[j - 1]); L += l;
      var x = (q[j] + q[j - 2]) / 2, y = (q[j + 1] + q[j - 1]) / 2, c = Math.floor((x - F.x0) / F.step), r = Math.floor((F.y1 - y) / F.step); if (c >= 0 && r >= 0 && c < F.w && r < F.h && F.corr[r * F.w + c]) Lw += l; } });
    var land = wet / Math.max(1, inC), road = Lw / Math.max(1, L); return { land: land, road: road, ratio: land ? road / land : 0 };
  }
  function farmland(R) {                                 // grade 1-2 farmland between the roads: the pieces it is cut into
    if (typeof soilAt !== 'function' || !R.stages || !R.stages.final) return null;
    var W = R.W, H = R.H, px = R.px, x0 = R.box[0], y1 = R.box[3], road = R.stages.final, m = new Uint8Array(W * H), lab = new Int32Array(W * H), st = [], sizes = [], cellM = typeof bdMaskOf === 'function' ? bdMaskOf(R, DATA.cells.map(function (c) { return c.ring; }), false) : null;
    for (var r = 0; r < H; r++) for (var c = 0; c < W; c++) { var i = r * W + c; if (road[i] || (cellM && !cellM[i])) continue; var g = soilAt(x0 + (c + 0.5) * px, y1 - (r + 0.5) * px); if (g === 0 || g === 1) m[i] = 1; }
    var n = 0; for (var s = 0; s < m.length; s++) { if (!m[s] || lab[s]) continue; n++; var cnt = 0; st.push(s); lab[s] = n;
      while (st.length) { var u = st.pop(), x = u % W; cnt++; [x > 0 ? u - 1 : -1, x < W - 1 ? u + 1 : -1, u - W, u + W].forEach(function (v) { if (v >= 0 && v < m.length && m[v] && !lab[v]) { lab[v] = n; st.push(v); } }); }
      sizes.push(cnt * px * px / 1e4); }
    sizes = sizes.filter(function (a) { return a >= 1; }).sort(function (a, b) { return a - b; });
    var tot = sizes.reduce(function (a, b) { return a + b; }, 0), big = sizes.filter(function (a) { return a >= 50; }).reduce(function (a, b) { return a + b; }, 0);
    return sizes.length ? { pieces: sizes.length, med: sizes[sizes.length >> 1], bigShare: tot ? big / tot : 0 } : null;
  }
  function measures(R, relaxed, jobs, over) {
    var h = R.hier && R.hier.out, o2 = h && h['60'], o3 = h && h['48'];
    return { detour: detour(relaxed, jobs), over: over, circ: circuity(R), reach: o2 ? o2['land within reach %'] : null, reachA: o3 ? o3['land within reach %'] : null,
             farm: farmland(R), flood: flood(R), junc: junctions(R), km: R.hier ? Object.values(R.hier.km).reduce(function (a, b) { return a + b; }, 0) : null, blocks: R.blocks ? R.blocks.n : null };
  }
  W5.measures = measures;

  // ---------------------------------------------------------------- the six rows, marked
  function rows(m) {
    var mark = function (v, good, fair, lower) { if (v === null || v === undefined || isNaN(v)) return 'na'; return lower ? (v <= good ? 'good' : v <= fair ? 'fair' : 'fix') : (v >= good ? 'good' : v >= fair ? 'fair' : 'fix'); };
    var d = m.detour, c = m.circ, fa = m.farm, fl = m.flood, j = m.junc, lim = 1 + (m.over || 0) / 100;
    return [
      { k: T('Detour of the threads', '毛线绕路'), v: d ? f(d.med, 3) + ' · ' + T('longest ', '最长 ') + f(d.max, 3) : '–', st: d ? (d.max <= lim + 0.005 ? 'good' : d.max <= lim + 0.05 ? 'fair' : 'fix') : 'na', to: 10,
        how: T('length over the shortest way round the towns; the surplus allows ', '线长 ÷ 绕开城镇的最短路；余长允许 ') + f(lim, 2) },
      { k: T('Circuity of the network', '路网迂回度'), v: c ? f(c.med, 2) + ' · 90% ' + f(c.p90, 2) : '–', st: c ? mark(c.med, 1.3, 1.45, true) : 'na', to: 26,
        how: T('the way along the roads over the straight line, junctions 2 km and more apart; road networks average about 1.2 (main roads only here)', '沿路最短距离 ÷ 直线距离（相距 2 km 以上的路口）；一般路网平均约 1.2（这里只有主路网）') },
      { k: T('Reach of the main roads', '主路覆盖'), v: m.reach !== null ? f(m.reach, 1) + ' % · A ' + f(m.reachA || 0, 1) + ' %' : '–', st: m.reach !== null ? (m.reach >= 99 && (m.reachA || 0) >= 95 ? 'good' : m.reach >= 95 ? 'fair' : 'fix') : 'na', to: 26,
        how: T('land within 2.5 km of a primary road, 1.25 km of an A road', '离一级路 2.5 km、A 级路 1.25 km 以内的用地') },
      { k: T('Good farmland kept whole', '良田完整度'), v: fa ? f(fa.med, 0) + ' ha · ' + f(100 * fa.bigShare, 0) + T(' % in pieces of 50 ha+', ' % 在 50 ha 以上的整块里') : '–', st: fa ? mark(fa.bigShare * 100, 70, 50) : 'na', to: 8,
        how: T('grade 1-2 land between the roads: the median piece, and the share in large pieces', '道路之间的一、二级耕地：中位块面积，以及大块所占比例') },
      { k: T('Roads in the flood corridors', '洪泛暴露'), v: fl ? f(fl.ratio, 2) + ' ×' : '–', st: fl ? mark(fl.ratio, 1, 1.3, true) : 'na', to: 5,
        how: T('the share of road length in a corridor over the corridors’ share of the land; under 1, the roads keep out of the water', '路网落在走廊里的长度比例 ÷ 走廊占地比例；小于 1 说明路避开了水') },
      { k: T('Junctions', '路口'), v: j ? 'T ' + f(j.tPct, 0) + ' % · ' + T('skewed ', '斜交 ') + f(j.skewPct, 1) + ' %' : '–', st: j ? mark(j.skewPct, 5, 15, true) : 'na', to: 26,
        how: T('new junctions: T (a road straight through), Y (the wool’s), four ways; skewed: under 75° with a main road, 60° between B roads', '新路口：T（一条路直穿）、Y（毛线的）、四岔；斜交：有主路时小于 75°，B 级路之间小于 60°') }
    ];
  }
  W5.rows = rows;

  // ---------------------------------------------------------------- the comparison: the same cells, three surpluses
  function relaxWith(over) {                             // the page's jobs, the surplus changed, in workers
    var js = S.jobs; return Promise.all(js.map(function (job) {
      if (!job) return Promise.resolve(null);
      return new Promise(function (ok) { var w = new Worker(SOLVER_URL), prm = Object.assign({}, job.params, { over: over });
        w.onmessage = function (e) { var d = e.data; if (!d || d.kind !== 'done') return; w.terminate(); ok(threadsOf(job, d.positions).map(function (L) { return P.smooth > 0 ? smoothThread(L, P.smooth) : L; })); };
        w.postMessage({ cmd: 'headless', S: job.S, anchors: job.anchors, threads: job.threads, boundary: job.boundary, voids: job.voids, rest: job.rest, positions: job.start, water: job.water, params: prm, iter: 0 }); }); }));
  }
  function networkOf(relaxed) {                          // steps 11 to 16 on that wool, as the page does them
    var keep = S.relaxed; S.relaxed = relaxed; var input; try { input = bdInput(); } finally { S.relaxed = keep; }
    var R = Bands.run(input, bdParams()); R.edges.forEach(function (e) { e.pts0 = Float64Array.from(e.pts); });
    var o = { r2: BD.p.r2 * 1000, r3: BD.p.r3 * 1000, exfirst: !!BD.p.exfirst, line: BD.p.line, wet: FLOOD ? 200 : 0, pinA: typeof JUNC !== 'undefined' ? JUNC : true };
    bhHierarchy(R, o); R.jx = typeof JUNC !== 'undefined' && JUNC ? bhJunctions(R) : null; return R;
  }
  function thumb(R) {                                    // a small picture of the network: the roads by class
    var x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    DATA.cells.forEach(function (c) { for (var i = 0; i < c.ring.length; i += 2) { x0 = Math.min(x0, c.ring[i]); x1 = Math.max(x1, c.ring[i]); y0 = Math.min(y0, c.ring[i + 1]); y1 = Math.max(y1, c.ring[i + 1]); } });
    var w = 360, s = w / (x1 - x0), h = Math.round((y1 - y0) * s), cv = document.createElement('canvas'); cv.width = w; cv.height = h; var g = cv.getContext('2d');
    g.fillStyle = '#000'; g.fillRect(0, 0, w, h); g.lineJoin = 'round'; g.lineCap = 'round';
    var C = typeof LK === 'function' ? LK() : null, css = function (a, al) { return 'rgba(' + a[0] + ',' + a[1] + ',' + a[2] + ',' + al + ')'; };
    [['24', 0.6, 0.35], ['30', 0.8, 0.45], ['48', 1.4, 0.85], ['60', 2.2, 1], ['H', 1.8, 0.7]].forEach(function (k) {
      g.strokeStyle = k[0] === '60' && C ? css(C.main, 1) : k[0] === '48' ? 'rgba(255,255,255,' + k[2] + ')' : k[0] === 'H' ? 'rgba(160,175,190,0.8)' : 'rgba(170,170,176,' + k[2] + ')'; g.lineWidth = k[1];
      g.beginPath(); R.edges.forEach(function (e) { if (e.cl !== k[0]) return; var q = e.pts; g.moveTo((q[0] - x0) * s, (y1 - q[1]) * s); for (var i = 2; i < q.length; i += 2) g.lineTo((q[i] - x0) * s, (y1 - q[i + 1]) * s); }); g.stroke(); });
    if (R.jx) { g.strokeStyle = 'rgba(255,255,255,0.9)'; g.lineWidth = 1; R.jx.jx.forEach(function (j) { if (!j.r) return; g.beginPath(); g.arc((j.x - x0) * s, (y1 - j.y) * s, 2.2, 0, 7); g.stroke(); }); }
    return cv.toDataURL('image/png');
  }
  W5.compare = function (overs) {
    if (W5.busy || !S.jobs || !window.Bands) return; overs = overs || [4, 8, 12];
    W5.busy = true; W5.cmp = { overs: overs, res: [] }; var redraw = function () { if (window.__lcCard) window.__lcCard(); };
    var i = 0, next = function () {
      if (i >= overs.length) { W5.busy = false; W5.msg = ''; redraw(); return; }
      var o = overs[i++]; W5.msg = T('Working out surplus ', '正在计算余长 ') + o + ' %…'; redraw();
      relaxWith(o).then(function (relaxed) { return new Promise(function (ok) { setTimeout(function () { var R = networkOf(relaxed); W5.cmp.res.push({ over: o, m: measures(R, relaxed, S.jobs, o), pic: thumb(R) }); ok(); }, 30); }); })
        .then(next, function (e) { console.error(e); W5.busy = false; W5.msg = String(e && e.message || e); redraw(); });
    };
    next();
  };
  W5.use = function (o) { var el = document.getElementById('over'); if (!el) return; el.value = o; el.dispatchEvent(new Event('input')); if (typeof setStep === 'function') setStep(10); };

  // ---------------------------------------------------------------- the card (explain.js asks for it at step 28)
  var cache = { key: null, m: null };
  W5.info = function () {
    var R = typeof BD !== 'undefined' && BD.res; if (!R || !R.hier) return { t: T('How good is the network?', '这张路网好不好？'), did: T('Work out the roads first (steps 11 to 16).', '先算出道路（第 11–16 步）。'), why: '', prm: [], res: [], leg: 0 };
    var key = BD.key + '|' + BD.hk + '|' + (S.relaxId || 0);
    if (cache.key !== key) { cache.key = key; cache.m = measures(R, S.relaxed, S.jobs, P.over); }
    var m = cache.m, rs = rows(m), lab = { good: T('good', '好'), fair: T('fair', '一般'), fix: T('to change', '要改'), na: '–' };
    var h = '<div class="ev">' + rs.map(function (r) { return '<div class="evr ' + r.st + '" data-to="' + r.to + '"><div class="evh"><span>' + r.k + '</span><i>' + lab[r.st] + '</i></div><b>' + r.v + '</b><p>' + r.how + '</p></div>'; }).join('') + '</div>';
    h += '<div class="l">' + T('Three surpluses side by side', '三组余长并排比较') + '</div>';
    if (W5.cmp && W5.cmp.res.length) {
      h += '<div class="evc">' + W5.cmp.res.map(function (c) { var r = rows(c.m);
        return '<div class="evk' + (c.over === P.over ? ' on' : '') + '"><img src="' + c.pic + '" alt=""><div class="evt">' + T('Surplus ', '余长 ') + c.over + ' %</div>'
          + r.map(function (x) { return '<div class="evm ' + x.st + '"><span>' + x.k + '</span><b>' + x.v + '</b></div>'; }).join('')
          + (c.over === P.over ? '<div class="evu">' + T('on show', '当前') + '</div>' : '<button type="button" class="evgo" data-over="' + c.over + '">' + T('Use this', '用这一组') + '</button>') + '</div>'; }).join('') + '</div>';
    }
    if (W5.busy) h += '<p class="wait">' + W5.msg + '</p>';
    else h += '<button type="button" class="evrun">' + (W5.cmp ? T('▶ Work them out again', '▶ 重新计算') : T('▶ Compare surplus 4, 8 and 12 %', '▶ 比较余长 4、8、12%')) + '</button><p class="m">' + T('Each is relaxed and traced in full, about half a minute.', '每一组都完整地松弛、描路、分级，约半分钟。') + '</p>';
    return { t: T('How good is the network?', '这张路网好不好？'),
      did: T('Six measures of the network on show, each marked, with the step whose setting moves it (click a row to go there).', '对当前路网量 6 个指标，各自标出好坏，并指向能改变它的那一步（点一行即可跳过去）。'),
      why: T('A method that only goes forward cannot say whether what it made is any good. Measured, and set beside other settings, it can be argued for, and changed.', '只往前算的方法说不出结果好不好。量出来、和别的设置并排比较，才能论证，也才能改进。'),
      prm: [], res: [], leg: 0, extra: h,
      after: function (el) {
        [].forEach.call(el.querySelectorAll('.evr[data-to]'), function (d) { d.onclick = function () { var b = document.querySelector('[data-step="' + d.dataset.to + '"]'); if (b) b.click(); }; });
        var b = el.querySelector('.evrun'); if (b) b.onclick = function () { W5.compare(); };
        [].forEach.call(el.querySelectorAll('.evgo'), function (g) { g.onclick = function () { W5.use(+g.dataset.over); }; });
      } };
  };
})();
