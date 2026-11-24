/* Tensor Studio · the method film (24 Nov 2026).
   While the site loads, six short chapters show how the data become the tensor field: the question, where the method
   stands (McHarg, Chen et al.), the five layers and their reasons, how directions are added (as tensors), what the
   field says about itself (clarity, conflict) and the evidence (the same site grown with four sets of layers).
   Every picture and number is the app's own, made by tools/build-intro.py into intro/img and intro-data.js.

   Played when the page is opened on its own (not from the London map) and the address has no #nointro.
   It waits until its pictures are decoded (12 s at most, else it does not play), then runs by itself: the app's
   loading goes on underneath. Once the app has drawn, "Enter" appears; at the end the film hands over by itself,
   or, if the site is still loading, waits on the last chapter. Skip (or Esc) closes it at any time.
   Only opacity and transform move, so it plays on while the page is busy. window.TSIntro.replay() plays it again. */
(function () {
  'use strict';
  var B = window.__TS_BOOT || {}, H = location.hash || '', D = window.TS_INTRO_DATA;
  var host = null; try { if (window.parent !== window) host = window.parent.__TENSOR_SITE_INPUT__ || null; } catch (e) {}
  if (!D || B.fromMap || host || /[#&]nointro\b/.test(H)) return;      // a site handed in (the London map): straight to it
  var zh = (B.lang || 'zh') === 'zh';
  var small = Math.min(innerWidth, innerHeight) < 600 || innerWidth <= 760;
  var IMG = 'intro/img/' + (small ? 's/' : '');
  var T = [0, 4, 9, 17, 22, 26], END = 34;
  var L = function (a, b) { return zh ? a : b; };
  var f2 = function (v) { return (+v).toFixed(2); };
  var fmt = function (n) { return Number(n).toLocaleString(zh ? 'zh-CN' : 'en-GB'); };
  var esc = function (s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  var v = function (o) { return 'style="--o:' + o + 's"'; };

  // ---------------------------------------------------------------- the probe: the parts at one point, and their sum
  var COL = { terrain: '#F2F2F2', wind: '#68C8FF', summer: '#E8A33D', winter: '#9D7CFF', water: '#5FBF7A' };
  var NAME = { terrain: L('地形', 'Terrain'), wind: L('全年风', "The year's wind"), summer: L('夏季风', 'Summer air'), winter: L('冬季冷风', 'Winter cold'), water: L('水', 'Water') };
  var P = (D.probe && D.probe.parts) || [];
  var sc = 0, ss = 0, sw = 0, wmax = 0;
  P.forEach(function (p) { var t = p[1] * Math.PI / 90; sc += p[2] * Math.cos(t); ss += p[2] * Math.sin(t); sw += p[2]; wmax = Math.max(wmax, p[2]); });
  var theta = ((Math.atan2(ss, sc) * 90 / Math.PI) % 180 + 180) % 180;
  function probeSVG(t0) {
    var cx = 200, cy = 214, R = 150, o = '<svg viewBox="0 0 400 420" xmlns="http://www.w3.org/2000/svg">';
    o += '<g class="tsi-pl" style="--o:' + t0 + 's"><circle cx="' + cx + '" cy="' + cy + '" r="' + (R + 16) + '" fill="none" stroke="rgba(255,255,255,.12)"/>' +
         '<circle cx="' + cx + '" cy="' + cy + '" r="4" fill="#E8463A"/></g>';
    P.forEach(function (p, k) {
      var a = p[1] * Math.PI / 180, l = Math.max(9, R * p[2] / (wmax || 1)), dx = Math.cos(a) * l, dy = -Math.sin(a) * l;
      o += '<g class="tsi-pl" style="--o:' + (t0 + 0.5 + k * 0.32).toFixed(2) + 's"><line x1="' + (cx - dx).toFixed(1) + '" y1="' + (cy - dy).toFixed(1) + '" x2="' + (cx + dx).toFixed(1) + '" y2="' + (cy + dy).toFixed(1) +
           '" stroke="' + COL[p[0]] + '" stroke-width="3" stroke-linecap="round"/>' +
           '<text x="8" y="' + (22 + k * 17) + '" fill="' + COL[p[0]] + '" font-size="11">' + esc(NAME[p[0]]) + '  ' + Math.round(p[1]) + '°  ' + f2(p[2]) + '</text></g>';
    });
    var a = theta * Math.PI / 180, dx = Math.cos(a) * (R + 16), dy = -Math.sin(a) * (R + 16), t1 = t0 + 0.5 + P.length * 0.32 + 0.3;
    o += '<g class="tsi-pl" style="--o:' + t1.toFixed(2) + 's"><line x1="' + (cx - dx).toFixed(1) + '" y1="' + (cy - dy).toFixed(1) + '" x2="' + (cx + dx).toFixed(1) + '" y2="' + (cy + dy).toFixed(1) +
         '" stroke="#E8463A" stroke-width="1.8" stroke-dasharray="6 5"/>' +
         '<text x="' + cx + '" y="' + (cy + R + 44) + '" text-anchor="middle" fill="#E8463A" font-size="15">θ = ' + Math.round(theta) + '°</text>' +
         '<text x="' + cx + '" y="' + (cy + R + 62) + '" text-anchor="middle" fill="rgba(255,255,255,.5)" font-size="10.5">' +
         esc(L('app 在这一点：' + Math.round(D.probe.field) + '°（平滑 ' + D.grid.smooth_m + ' m）', 'the app here: ' + Math.round(D.probe.field) + '° (smoothed ' + D.grid.smooth_m + ' m)')) + '</text></g>';
    // the reason, small: two streets at 10° and 170° run almost the same way; their plain average, 90°, is square to both
    var ix = 300, iy = 34, ln = function (deg, len, col, w, dash) { var r = deg * Math.PI / 180; return '<line x1="' + (ix - Math.cos(r) * len).toFixed(1) + '" y1="' + (iy + Math.sin(r) * len).toFixed(1) +
      '" x2="' + (ix + Math.cos(r) * len).toFixed(1) + '" y2="' + (iy - Math.sin(r) * len).toFixed(1) + '" stroke="' + col + '" stroke-width="' + w + '"' + (dash ? ' stroke-dasharray="3 3"' : '') + '/>'; };
    o += '<g class="tsi-pl" style="--o:' + (t0 + 0.2).toFixed(2) + 's">' + ln(10, 44, '#F2F2F2', 2) + ln(170, 44, '#F2F2F2', 2) + ln(90, 26, '#E8463A', 1.6, true) +
         '<text x="' + ix + '" y="' + (iy + 40) + '" text-anchor="middle" fill="rgba(255,255,255,.55)" font-size="10">10° + 170° → 90° ✕</text></g>';
    return o + '</svg>';
  }

  // ---------------------------------------------------------------- II: three small diagrams of the precedents
  function precSVG(kind) {
    var o = '<svg viewBox="0 0 220 130" xmlns="http://www.w3.org/2000/svg">', pl = function (y, col, op) {
      return '<polygon points="30,' + (y + 18) + ' 110,' + y + ' 190,' + (y + 18) + ' 110,' + (y + 36) + '" fill="rgba(255,255,255,' + (op || 0.03) + ')" stroke="' + col + '" stroke-opacity=".7" stroke-width="1"/>'; };
    if (kind === 0) {               // McHarg: maps of how good the land is, laid over each other into one shade
      [6, 30, 54].forEach(function (y, k) { o += pl(y, 'rgba(255,255,255,.6)');
        o += '<ellipse cx="' + (80 + k * 22) + '" cy="' + (y + 18) + '" rx="' + (26 - k * 4) + '" ry="7" fill="rgba(255,255,255,' + (0.16 + k * 0.08) + ')"/>'; });
      o += pl(88, 'rgba(255,255,255,.9)', 0.05) + '<ellipse cx="102" cy="106" rx="36" ry="9" fill="rgba(255,255,255,.42)"/><ellipse cx="102" cy="106" rx="16" ry="4.5" fill="rgba(255,255,255,.75)"/>';
    } else if (kind === 1) {        // Chen et al.: geometric basis fields (a grid, a radial) blended into streets
      for (var i = 0; i < 5; i++) for (var j = 0; j < 4; j++) { var x = 22 + i * 16, y = 22 + j * 22; o += '<path d="M' + (x - 5) + ' ' + y + 'h10M' + x + ' ' + (y - 5) + 'v10" stroke="rgba(255,255,255,.55)" stroke-width="1"/>'; }
      for (var k = 0; k < 12; k++) { var a = k * Math.PI / 6; o += '<line x1="' + (176 + Math.cos(a) * 9).toFixed(1) + '" y1="' + (60 + Math.sin(a) * 9).toFixed(1) + '" x2="' + (176 + Math.cos(a) * 30).toFixed(1) + '" y2="' + (60 + Math.sin(a) * 30).toFixed(1) + '" stroke="rgba(255,255,255,.55)" stroke-width="1"/>'; }
      o += '<path d="M16 116 C 70 116, 110 112, 150 92 S 192 64, 206 30" fill="none" stroke="#fff" stroke-width="1.8"/><path d="M60 126 C 70 100, 74 70, 66 20" fill="none" stroke="#fff" stroke-width="1.4"/>';
    } else {                        // this study: directions from the environment, layer by layer, added into one field
      ['#F2F2F2', '#68C8FF', '#E8A33D', '#9D7CFF', '#5FBF7A'].forEach(function (c, k) { var y = 2 + k * 17; o += pl(y, c, 0.02);
        for (var n = 0; n < 7; n++) { var x = 62 + n * 16, t = (k * 37 + n * (k + 1) * 9) * Math.PI / 180, yy = y + 18 + ((n % 2) ? -4 : 4);
          o += '<line x1="' + (x - Math.cos(t) * 5).toFixed(1) + '" y1="' + (yy - Math.sin(t) * 2.5).toFixed(1) + '" x2="' + (x + Math.cos(t) * 5).toFixed(1) + '" y2="' + (yy + Math.sin(t) * 2.5).toFixed(1) + '" stroke="' + c + '" stroke-width="1.2"/>'; } });
      o += pl(92, '#E8463A', 0.05);
    }
    return o + '</svg>';
  }

  // ---------------------------------------------------------------- the chapters
  var E = D.evidence || {}, G = D.grid || {};
  var txt = function (k, kicker, title, body, more) {
    var o = T[k];
    return '<div class="tsi-txt"><div class="tsi-k tsi-mono tsi-r" ' + v(o + 0.15) + '>' + kicker + '</div><div class="tsi-t tsi-r" ' + v(o + 0.35) + '>' + title + '</div>' +
           (body ? '<div class="tsi-b tsi-r" ' + v(o + 0.6) + '>' + body + '</div>' : '') + (more || '') + '</div>';
  };
  var ch = function (k, inner) {
    var last = k === T.length - 1, e = last ? END : T[k + 1] - 0.5;
    return '<section class="tsi-ch' + (last ? ' tsi-last' : '') + '" style="--d:' + T[k] + 's;--e:' + e + 's">' + inner + '</section>';
  };
  var html = '';
  // I · the question
  html += ch(0, '<div class="tsi-art"><img class="tsi-plate tsi-drift" style="--d:0s" src="' + IMG + 'site.webp" alt=""></div>' +
    txt(0, 'I · QUESTION', L('能否把地形、气候和水，写进街道的方向？', 'Can terrain, climate and water be written into the direction of the streets?'),
      L('车站 P2 场地，' + G.ha + ' 公顷，切成 ' + G.cell_m + ' m 的网格，共 ' + fmt(G.land) + ' 个点。每个点都要回答同一个问题：<b>这里的路该朝哪个方向？</b>',
        'The site by station P2: ' + G.ha + ' ha on a ' + G.cell_m + ' m grid, ' + fmt(G.land) + ' points. Each answers one question: <b>which way should a street run here?</b>')));
  // II · where the method stands
  var prec = [['1969', 'McHarg · <i>Design with Nature</i>', L('叠加数值：土地好或坏', 'Values: good land or bad')],
              ['2008', L('Chen 等 · 张量场街道建模', 'Chen et al. · tensor-field streets'), L('叠加几何：网格、放射', 'Geometry: grids and radials')],
              [L('本研究', 'THIS STUDY'), L('张量场工作室', 'Tensor Studio'), L('叠加方向：地形、风、水', 'Directions: terrain, wind, water')]];
  html += ch(1, '<div class="tsi-art"><div class="tsi-prec">' + prec.map(function (p, k) {
      return '<div class="tsi-r' + (k === 2 ? ' me' : '') + '" ' + v(T[1] + 0.5 + k * 1.0) + '>' + precSVG(k) + '<div class="y tsi-mono">' + p[0] + '</div><div class="n">' + p[1] + '</div><div class="c">' + p[2] + '</div></div>';
    }).join('') + '</div></div>' +
    txt(1, 'II · POSITION', L('叠加的不是数值，而是方向', 'Not values laid over each other, but directions'),
      L('McHarg 把地形、水文等图层叠在一起，读出土地的好坏；Chen 等人用网格、放射这样的几何场生成街道。这里叠在一起的，是由环境数据得出的<b>方向</b>。',
        'McHarg laid maps over each other to read how good the land is; Chen et al. grew streets from geometric fields, grids and radials. Here the layers are <b>directions</b> taken from the environment.')));
  // III · the layers (their pictures are on the shared stage below)
  var RULES = [['terrain', L('地形', 'Terrain'), L('顺等高线：坡度平缓，利于步行和排水', 'along the contour: gentle gradients, for walking and drainage')],
               ['wind', L('全年风', "The year's wind"), L('温和的方向顺着，寒冷的方向横切', 'along the mild directions, across the cold ones')],
               ['summer', L('夏季风', 'Summer air'), L('顺风：通风廊道', 'along it: a ventilation corridor')],
               ['winter', L('冬季冷风', 'Winter cold'), L('横切：挡风', 'across it: shelter')],
               ['water', L('水', 'Water'), L('顺走廊和水流：滨水路，路面兼作排水', 'along corridors and the flow: waterside streets that drain')]];
  var lay = function (k) { return T[2] + 0.5 + k * 1.15; };
  html += ch(2, txt(2, 'III · LAYERS', L('五层数据，各自给出道路方向', 'Five layers, each with a direction for the street'), '',
    '<div class="tsi-rules">' + RULES.map(function (r, k) {
      return '<div class="tsi-r' + '" style="--c:' + COL[r[0]] + ';--o:' + lay(k).toFixed(2) + 's;--x:' + (lay(k + 1) - 0.45).toFixed(2) + 's"><b>' + r[1] + '</b>　' + r[2] + '</div>';
    }).join('') + '<div class="tsi-r end" style="--c:#E8463A;--o:' + (lay(5) + 0.3).toFixed(2) + 's"><b>' + L('红色', 'Red') + '</b>　' + L('五层之和：张量场', 'the five added up: the tensor field') + '</div></div>'));
  // IV · adding them up
  html += ch(3, '<div class="tsi-art"><div class="tsi-probe">' + probeSVG(T[3] + 1.5) + '</div></div>' +
    txt(3, 'IV · SUPERPOSITION', L('张量相加：方向没有正反', 'Adding tensors: a street has no arrow'),
      L('10° 和 170° 的两条路几乎同向，直接平均却得到 90°。所以每层在每个点写成一个张量再相加：主方向给主路，与它垂直的方向给次路。',
        'Streets at 10° and 170° run almost the same way, yet their average is 90°. So each layer becomes a tensor at every point and the tensors are added: the major direction gives the main streets, the one square to it the second streets.'),
      '<div class="tsi-eq tsi-mono tsi-r" ' + v(T[3] + 0.9) + '>T = Σ w<sub>i</sub>·[cos2θ<sub>i</sub>  sin2θ<sub>i</sub> ; sin2θ<sub>i</sub>  −cos2θ<sub>i</sub>]</div>'));
  // V · what the field says
  html += ch(4, '<div class="tsi-art"><div class="tsi-two"><img src="' + IMG + 'field.webp" alt=""><img class="tsi-f" ' + v(T[4] + 1.4) + ' src="' + IMG + 'conflict.webp" alt="">' +
      '<div class="tsi-chip tsi-f" ' + v(T[4] + 1.8) + '><span><i style="background:#9D7CFF"></i>' + L('流线：道路的方向', 'streamlines: where streets run') + '</span><span><i style="background:#C98A3A"></i>' + L('橙色：冲突', 'orange: conflict') + '</span></div></div></div>' +
    txt(4, 'V · READING', L('意见一致处平直，相左处转折', 'Where the layers agree, streets run straight; where they disagree, they turn'),
      L('清晰度 c = |ΣT| / Σw：1 表示各层同向，0 表示互相抵消。橙色是地形与气候相左的地方，道路在那里转弯。',
        'Clarity c = |ΣT| / Σw: 1 when the layers agree, 0 when they cancel out. Orange is where terrain and climate disagree; the streets turn there.')));
  // VI · the evidence
  var VAR = [['A', L('只用地形', 'Terrain only')], ['B', L('只用气候', 'Climate only')], ['C', L('地形 + 水', 'Terrain and water')], ['D', L('全部（默认）', 'Everything (default)')]];
  var ev = function (k) { return E[k] || {}; };
  html += ch(5, '<div class="tsi-art"><div class="tsi-four">' + VAR.map(function (x, k) {
      var e = ev(x[0]);
      return '<div class="tsi-r" ' + v(T[5] + 0.4 + k * 0.6) + '><img src="' + IMG + 'net-' + x[0] + '.webp" alt=""><div class="l"><em class="tsi-mono">' + x[0] + '</em>' + x[1] + '</div>' +
             '<div class="m">c <span>' + f2(e.clarity) + '</span> · ' + e.streets + L(' 条道路', ' streets') + '</div></div>';
    }).join('') + '</div></div>' +
    txt(5, 'VI · EVIDENCE', L('输入不同，路网不同', 'Different inputs, different networks'),
      L('同一块地，其余参数不变，跑四次。每加一层，平均清晰度下降（' + f2(ev('A').clarity) + ' → ' + f2(ev('C').clarity) + ' → ' + f2(ev('D').clarity) + '），冲突上升（' + f2(ev('A').conflict) + ' → ' + f2(ev('C').conflict) + ' → ' + f2(ev('D').conflict) + '）：<b>街道的走向可以追溯到环境数据。</b>',
        'The same site, everything else unchanged, grown four times. Each layer added lowers the mean clarity (' + f2(ev('A').clarity) + ' → ' + f2(ev('C').clarity) + ' → ' + f2(ev('D').clarity) + ') and raises the conflict (' + f2(ev('A').conflict) + ' → ' + f2(ev('C').conflict) + ' → ' + f2(ev('D').conflict) + '): <b>each street’s direction can be traced to the environment.</b>'),
      '<div class="tsi-n tsi-r" ' + v(T[5] + 3.2) + '>' + L('一块场地，每组运行一次；各层权重是设计判断，可以在 app 里调整。', 'One site, one run each; the weights are design judgements, set in the app.') + '</div>'));
  // the shared stage: the layer stack rises through III and falls into one in IV
  var LW = (small ? D.layers_s : D.layers) || { w: 1100, h: 450 }, gap = 0.4, extra = 0.22, SH = 1 + 5 * gap + extra, ar = LW.w / (LW.h * SH);
  var fieldTop = (5 * gap + extra) / SH, drop = T[3] + 0.15;
  var stack = ['terrain', 'wind', 'summer', 'winter', 'water'].map(function (key, k) {
    var top = k * gap / SH, dy = ((fieldTop - top) * SH * 100).toFixed(1);
    return '<div class="tsi-L" style="--top:' + (top * 100).toFixed(2) + '%;--h:' + (100 / SH).toFixed(2) + '%;--o:' + lay(k).toFixed(2) + 's;--x:' + (drop + k * 0.08).toFixed(2) + 's;--dy:' + dy + '%;--c:' + COL[key] + '">' +
           '<img src="' + IMG + 'layer-' + key + '.webp" alt=""><span>' + NAME[key] + '</span></div>';
  }).join('') + '<div class="tsi-L sum" style="--top:' + (fieldTop * 100).toFixed(2) + '%;--h:' + (100 / SH).toFixed(2) + '%;--o:' + lay(5).toFixed(2) + 's;--c:#E8463A">' +
     '<img src="' + IMG + 'layer-field.webp" alt=""><span>' + L('张量场', 'The field') + '</span></div>';
  html += '<section class="tsi-stage" style="--d:' + T[2] + 's;--e:' + (T[3] + 1.4) + 's"><div class="tsi-art"><div class="tsi-stack" style="--ar:' + ar.toFixed(4) + '">' + stack + '</div></div></section>';

  var pips = T.map(function (t, k) { var e = k < T.length - 1 ? T[k + 1] : END; return '<i><b style="--d:' + t + 's;--len:' + (e - t) + 's"></b></i>'; }).join('');
  var root = document.createElement('div');
  root.id = 'tsIntro'; root.className = 'tsi-wait'; root.setAttribute('lang', zh ? 'zh-CN' : 'en'); root.setAttribute('aria-label', L('原理短片', 'How it works: a short film'));
  html = html.replace(/<img /g, '<img fetchpriority="high" decoding="async" ');
  root.innerHTML = '<div class="tsi-head tsi-mono">TENSOR STUDIO · METHOD</div><div class="tsi-pips">' + pips + '</div>' +
    '<button type="button" class="tsi-skip">' + L('跳过', 'Skip') + '</button><div class="tsi-film">' + html + '</div>' +
    '<button type="button" class="tsi-enter">' + L('进入 ›', 'Enter ›') + '</button><div class="tsi-load"><i></i>' + L('正在载入场地…', 'Loading the site…') + '</div>';

  // ---------------------------------------------------------------- playing it
  var de = document.documentElement, started = false, ended = false, closed = false, t0 = 0, timers = [];
  var ready = function () { return !de.classList.contains('ts-boot'); };
  function close() {
    if (closed) return; closed = true; timers.forEach(clearTimeout);
    root.classList.add('tsi-out'); document.removeEventListener('keydown', onKey, true);
    setTimeout(function () { if (root.parentNode) root.parentNode.removeChild(root); }, 750);
  }
  function onReady() { if (!ready() || closed) return; root.classList.add('tsi-ready'); if (ended) close(); }
  function onKey(e) { if (e.key === 'Escape') close(); else if (e.key === 'Enter' && ready()) close(); }
  root.querySelector('.tsi-skip').onclick = close;
  root.querySelector('.tsi-enter').onclick = close;
  function begin() {
    if (started || closed) return; started = true; t0 = performance.now();
    root.classList.remove('tsi-wait'); root.classList.add('tsi-play');
    timers.push(setTimeout(function () { ended = true; root.classList.add('tsi-hold'); if (ready()) close(); }, END * 1000 + 300));
  }
  function mount() {
    (document.body || de).appendChild(root);
    document.addEventListener('keydown', onKey, true);
    new MutationObserver(onReady).observe(de, { attributes: true, attributeFilter: ['class'] }); onReady();
    var imgs = [].slice.call(root.querySelectorAll('img')), left = imgs.length;
    var one = function () { if (--left <= 0) begin(); };
    imgs.forEach(function (im) { var p = im.decode ? im.decode() : null; if (p) p.then(one, one); else if (im.complete) one(); else { im.onload = im.onerror = one; } });
    timers.push(setTimeout(function () { if (!started) close(); }, 12000));   // the pictures did not come in time (a very slow line): the app's own loading mark stays
  }
  if (document.body) mount(); else document.addEventListener('DOMContentLoaded', mount);
  window.TSIntro = { replay: function () { location.reload(); }, get open() { return !closed; }, get started() { return started; }, get ready() { return ready(); } };
})();
