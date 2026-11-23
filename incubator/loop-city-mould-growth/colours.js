/* Loop City step 1 · colour modes for the slime mould (22 Nov 2026).

   Five looks beside the page's own (Frost, Grey, White, Warm white, Violet, Sparkle, Brown):
     Electric cyan #00E5FF · Acid lime #C6FF00 · Deep violet #5B2EFF · Infrared magenta #FF2D8F,
     and "Four colours": the mould coloured by how strong its trail is, violet at its faintest, then magenta, cyan,
     and lime on the trunks.
   Added the way the page adds its own brown look: an ink in INKS, a look in LOOKS.LIST, a button in the row.

   A switch under the looks, off by default: "City and cells take the mould's colours". With it on, and one of
   the five looks chosen, the city (high, mid, low rise), the farming, and the cells' fill and outline are drawn
   in the colours paired with that look; the key and the readout swatches follow. The light map keeps its own
   colours, and so do the page's other looks.

   The page opens on Frost every time, with the switch off: the look is no longer remembered between visits.

   Cell palettes (23 Nov 2026). A second row, "Cell palette": C Productive territory (what the page opens on), A Research
   core, B Hydrological field, D Adaptive network, and Original (the orange and green the page had). Each is two colours
   from the studio's board, urban and rural: the urban cells, and the city in three tints of it (low rise the colour
   itself, then lighter); the rural cells, and the farming in a darker and a lighter tint. Cells that are neither stay
   grey. The mould keeps its own look. With the switch above on and one of the five colour looks chosen, that pairing
   wins. The light map keeps its own colours. Not remembered between visits.

   View only. The run, the cells and the figures handed to step 2 are the same under every look. */
(function () {
  'use strict';
  if (typeof LOOKS === 'undefined' || typeof INKS === 'undefined' || !LOOKS.el || typeof fabricInk !== 'function') return;
  var $ = function (id) { return document.getElementById(id); };
  var isZh = function () { return (window.LANG || 'en') === 'zh'; };

  var NEW = [
    { key: 'cyan',     en: 'Electric cyan',    zh: '电光青',   c: [0, 229, 255],  w: 1.15, g: 1.45, sw: '#00E5FF' },
    { key: 'lime',     en: 'Acid lime',        zh: '酸性柠绿', c: [198, 255, 0],  w: 1.05, g: 1.55, sw: '#C6FF00' },
    { key: 'uv',       en: 'Deep violet',      zh: '深紫',     c: [91, 46, 255],  w: 1.60, g: 1.15, sw: '#5B2EFF' },
    { key: 'magenta',  en: 'Infrared magenta', zh: '红外洋红', c: [255, 45, 143], w: 1.20, g: 1.40, sw: '#FF2D8F' },
    { key: 'spectrum', en: 'Four colours',     zh: '四色渐变', c: [198, 255, 0],  w: 1.50, g: 1.25, spectrum: true,
      sw: 'linear-gradient(90deg,#5B2EFF,#FF2D8F,#00E5FF,#C6FF00)' }
  ];
  /* the colours that go with each look: the city from dense to light, the farming (ground, vertical) */
  var PAIR = {
    cyan:     { city: ['#FF2D8F', '#FF6FB0', '#FFB3D4'], farm: ['#6E8F00', '#C6FF00'] },
    lime:     { city: ['#8B6BFF', '#B19CFF', '#D8CEFF'], farm: ['#087F8E', '#00E5FF'] },
    uv:       { city: ['#C6FF00', '#DAFF66', '#ECFFB0'], farm: ['#087F8E', '#00E5FF'] },
    magenta:  { city: ['#00E5FF', '#66EFFF', '#B3F7FF'], farm: ['#6E8F00', '#C6FF00'] },
    spectrum: { city: ['#FFFFFF', '#C8C8C8', '#8E8E8E'], farm: ['#4A4A4A', '#7A7A7A'] }
  };
  /* the cell palettes: [urban, rural] */
  var CELLS = [
    { key: 'C',    en: 'C · Productive territory', zh: 'C · 生产领地', u: '#E3B47B', r: '#9EBE7A' },
    { key: 'A',    en: 'A · Research core',        zh: 'A · 研究核心', u: '#A89CE6', r: '#8FBFAE' },
    { key: 'B',    en: 'B · Hydrological field',   zh: 'B · 水文场',   u: '#7EB6FF', r: '#5EC7B7' },
    { key: 'D',    en: 'D · Adaptive network',     zh: 'D · 适应网络', u: '#D6A4FF', r: '#6CC2C4' },
    { key: 'orig', en: 'Original',                 zh: '原始',         u: '#E8684A', r: '#7A965C', orig: true }
  ];
  var cellKey = 'C', cellRow = null;
  var mix = function (c, t, f) { return [0, 1, 2].map(function (i) { return Math.round(c[i] + (t[i] - c[i]) * f); }); };
  var hx = function (h) { return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]; };
  var rgba = function (h, a) { var c = hx(h); return 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + a + ')'; };

  /* ---- the looks */
  var row = document.querySelector('.lookRow');
  NEW.forEach(function (L) {
    if (!INKS.some(function (x) { return x.n === L.en; })) INKS.push({ n: L.en, c: L.c, spectrum: !!L.spectrum });
    if (LOOKS.LIST.some(function (l) { return l.key === L.key; })) return;
    LOOKS.LIST.push({ key: L.key, name: L.en, ink: L.en, w: L.w, g: L.g, sw: L.sw });
    try { if (typeof ZH !== 'undefined' && !ZH[L.en]) ZH[L.en] = L.zh; } catch (e) { /* the page's own dictionary */ }
    if (!row) return;
    var b = document.createElement('button'), i = document.createElement('i'), s = document.createElement('span');
    b.type = 'button'; b.className = 'lookBtn'; b.dataset.key = L.key;
    i.style.background = L.sw; s.setAttribute('translate', 'no'); s.dataset.en = L.en; s.dataset.zh = L.zh; s.textContent = isZh() ? L.zh : L.en;
    b.appendChild(i); b.appendChild(s);
    b.onclick = function () { LOOKS.set(L.key); };
    row.appendChild(b);
  });
  LOOKS.el.col.max = String(INKS.length - 1);

  /* ---- "Four colours": the page paints the smoke as it always does (so its own rules, the quiet ring at P4 among
     them, still hold); then each drawn pixel takes its colour from the strength of the trail there. */
  var STOPS = [0.168, 0.482, 0.765];                  // the trail's 45th, 75th and 93rd percentile at 2100
  var RAMP = [[91, 46, 255], [255, 45, 143], [0, 229, 255], [198, 255, 0]];
  var paint0 = window.paintTrail;
  if (typeof paint0 === 'function') {
    window.paintTrail = function () {
      var r = paint0.apply(this, arguments);
      var ink = INKS[parseInt(LOOKS.el.col.value, 10)];
      if (!ink || !ink.spectrum || !S.trail || !S.trailImg) return r;
      var T = S.trail, d = S.trailImg.data, t0 = STOPS[0], t1 = STOPS[1], t2 = STOPS[2];
      for (var i = 0, k = 0; i < T.length; i++, k += 4) {
        if (!d[k + 3]) continue;
        var x = T[i], a, b, u;
        if (x < t0) { a = RAMP[0]; b = RAMP[1]; u = x / t0; }
        else if (x < t1) { a = RAMP[1]; b = RAMP[2]; u = (x - t0) / (t1 - t0); }
        else { a = RAMP[2]; b = RAMP[3]; u = (x - t1) / (t2 - t1); if (u > 1) u = 1; }
        d[k] = a[0] + (b[0] - a[0]) * u; d[k + 1] = a[1] + (b[1] - a[1]) * u; d[k + 2] = a[2] + (b[2] - a[2]) * u;
      }
      S.trailCx.putImageData(S.trailImg, 0, 0);
      return r;
    };
  }

  /* ---- the city and the cells in the paired colours */
  var sw = null, base = null;
  function darkInk() {                                   // the dark map's own table, never the light map's
    var light = window.RV2 && RV2.light;
    if (light) RV2.light = false;
    var F = fabricInk();
    if (light) RV2.light = true;
    return F;
  }
  function keep() {
    if (base) return;
    var F = darkInk();
    base = { F: {}, fill: {}, line: {} };
    for (var k in F) base.F[k] = F[k].slice();
    if (typeof V5 !== 'undefined' && V5.FILL && V5.LINE) {
      for (var a in V5.FILL) base.fill[a] = V5.FILL[a];
      for (var b in V5.LINE) base.line[b] = V5.LINE[b];
    }
  }
  function apply() {
    keep();
    var light = !!(window.RV2 && RV2.light);
    var F = darkInk(), on = !!(sw && sw.checked) && !light, P = on ? PAIR[LOOKS.cur] : null, k;
    var Q = light ? null : CELLS.filter(function (c) { return c.key === cellKey; })[0];
    if (Q && Q.orig) Q = null;
    for (k in base.F) F[k] = base.F[k].slice();
    if (typeof V5 !== 'undefined' && V5.FILL && V5.LINE) {
      for (k in base.fill) V5.FILL[k] = base.fill[k];
      for (k in base.line) V5.LINE[k] = base.line[k];
    }
    if (Q) {                                              // the cell palette; a pairing, below, goes over it
      var u = hx(Q.u), r0 = hx(Q.r), W = [255, 255, 255], K = [0, 0, 0];
      F[1] = u; F[2] = mix(u, W, 0.32); F[3] = mix(u, W, 0.62); F[4] = mix(r0, K, 0.38); F[5] = mix(r0, W, 0.22);
      if (typeof V5 !== 'undefined' && V5.FILL && V5.LINE) {
        V5.FILL.urban = rgba(Q.u, 0.40); V5.LINE.urban = Q.u;
        V5.FILL.agricultural = rgba(Q.r, 0.36); V5.LINE.agricultural = Q.r;
      }
    }
    if (P) {
      F[3] = hx(P.city[0]); F[2] = hx(P.city[1]); F[1] = hx(P.city[2]); F[4] = hx(P.farm[0]); F[5] = hx(P.farm[1]);
      if (typeof V5 !== 'undefined' && V5.FILL && V5.LINE) {
        V5.FILL.urban = rgba(P.city[0], 0.30); V5.LINE.urban = P.city[0];
        V5.FILL.agricultural = rgba(P.farm[1], 0.30); V5.LINE.agricultural = P.farm[1];
      }
    }
    S.growthY = null; S.growthBuiltFor = null; S.dirty = true;
    /* the key and the readout say the same as the map */
    var city = P ? P.city[0] : Q ? Q.u : null, farm = P ? P.farm[1] : Q ? Q.r : null;
    var lg = document.querySelectorAll('.v5legend i');
    if (lg[0]) lg[0].style.background = city ? rgba(city, 0.75) : String(base.fill.urban || '').replace('.30', '.75');
    if (lg[1]) lg[1].style.background = farm ? rgba(farm, 0.8) : String(base.fill.agricultural || '').replace('.34', '.8');
    name();
    var rd = document.querySelectorAll('.lc-tab .lc-sw');
    if (rd[0]) rd[0].style.background = P ? P.city[1] : Q ? Q.u : '#EFA65C';
    if (rd[1]) rd[1].style.background = P ? P.farm[1] : Q ? Q.r : '#A9B57F';
    if (cellRow) [].forEach.call(cellRow.children, function (b) { b.classList.toggle('on', b.dataset.cell === cellKey); });   // LOOKS.set clears every .lookBtn
  }

  /* the ink's name beside its slider, in the page's language */
  function name() {
    var L = NEW.filter(function (x) { return x.key === LOOKS.cur; })[0], f = LOOKS.el.col.closest('.f'), v = f && f.querySelector('.lab span:last-child');
    if (L && v) { v.setAttribute('translate', 'no'); v.textContent = isZh() ? L.zh : L.en; }
  }
  if (row) {
    var lab = document.createElement('label'), tx = document.createElement('span'), inp = document.createElement('input'), knob = document.createElement('i');
    lab.className = 'tg'; lab.id = 'lcPairRow';
    tx.setAttribute('translate', 'no'); tx.dataset.en = 'City and cells take the mould’s colours'; tx.dataset.zh = '城市与单元随黏菌配色';
    tx.textContent = isZh() ? tx.dataset.zh : tx.dataset.en;
    inp.type = 'checkbox'; inp.id = 'lcPair';
    lab.appendChild(tx); lab.appendChild(inp); lab.appendChild(knob);
    row.after(lab);
    var note = document.createElement('p');
    note.className = 'hint'; note.setAttribute('translate', 'no');
    note.dataset.en = 'For the five colour looks, on the dark map. Off: the city and the cells take the cell palette below.';
    note.dataset.zh = '对五种彩色外观、在深色地图上生效。关闭时城市与单元用下面选的单元配色。';
    note.textContent = isZh() ? note.dataset.zh : note.dataset.en;
    lab.after(note);
    sw = inp;
    sw.addEventListener('change', apply);

    /* ---- the cell palettes */
    var ch = document.createElement('div'), cn = document.createElement('p');
    ch.className = 'lc-h2'; ch.id = 'lcCellHead'; ch.setAttribute('translate', 'no'); ch.dataset.en = 'Cell palette'; ch.dataset.zh = '单元配色';
    ch.textContent = isZh() ? ch.dataset.zh : ch.dataset.en;
    cellRow = document.createElement('div'); cellRow.className = 'lookRow'; cellRow.id = 'lcCellRow';
    CELLS.forEach(function (c) {
      var b = document.createElement('button'), i = document.createElement('i'), s = document.createElement('span');
      b.type = 'button'; b.className = 'lookBtn'; b.dataset.cell = c.key;
      i.style.background = 'linear-gradient(90deg,' + c.u + ' 50%,' + c.r + ' 50%)';
      s.setAttribute('translate', 'no'); s.dataset.en = c.en; s.dataset.zh = c.zh; s.textContent = isZh() ? c.zh : c.en;
      b.appendChild(i); b.appendChild(s);
      b.onclick = function () { cellKey = c.key; apply(); };
      cellRow.appendChild(b);
    });
    cn.className = 'hint'; cn.id = 'lcCellNote'; cn.setAttribute('translate', 'no');
    cn.dataset.en = 'Urban and rural: the cells, the city and the farming. Cells that are neither stay grey. On the dark map.';
    cn.dataset.zh = '城市与乡村两色：单元、城市生长和农田一起换。两者都不是的单元保持灰色。在深色地图上生效。';
    cn.textContent = isZh() ? cn.dataset.zh : cn.dataset.en;
    note.after(ch); ch.after(cellRow); cellRow.after(cn);
  }

  /* ---- every visit starts on Frost, with the switch off; the look is not remembered */
  var set0 = LOOKS.set;
  LOOKS.set = function () {
    var r = set0.apply(this, arguments);
    try { localStorage.removeItem('loopCityLook'); } catch (e) { /* private mode */ }
    apply();
    return r;
  };
  if (window.RV2 && typeof RV2.setLight === 'function') {
    var light0 = RV2.setLight;
    RV2.setLight = function () { var r = light0.apply(this, arguments); apply(); return r; };
  }
  if (!(window.RV2 && RV2.light)) LOOKS.set('frost'); else if (window.RV2) RV2.prevLook = 'frost';

  function relabel() {
    document.querySelectorAll('.lookBtn span[data-en], #lcPairRow span[data-en], #lcPairRow + p[data-en], #lcCellHead, #lcCellNote').forEach(function (e) {
      var s = isZh() ? e.dataset.zh : e.dataset.en; if (e.textContent !== s) e.textContent = s;
    });
    name();
  }
  var lang0 = window.setLang;
  if (typeof lang0 === 'function') window.setLang = function () { var r = lang0.apply(this, arguments); relabel(); return r; };
  if ($('langbar')) $('langbar').addEventListener('click', function () { setTimeout(relabel, 0); setTimeout(relabel, 300); });
  relabel(); setTimeout(function () { relabel(); apply(); }, 900);
  window.LC_COLOURS = { apply: apply, PAIR: PAIR, CELLS: CELLS, cell: function (k) { if (k && CELLS.some(function (c) { return c.key === k; })) { cellKey = k; apply(); } return cellKey; } };
})();
