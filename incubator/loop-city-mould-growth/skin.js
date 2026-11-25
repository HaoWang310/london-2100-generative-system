/* Loop City step 1 · the interface, after the Growth Simulator (22 Nov 2026).
   It moves the page's own controls into two floating panels: four step cards and a fold with every setting on
   the left; playback, readout, view and layers on the right. Every control keeps its id and its handlers; nothing
   in the engine is touched. `#noskin` in the address shows the page as it was. */
(function () {
  'use strict';
  if (!document.documentElement.classList.contains('lcskin')) return;
  var $ = function (id) { return document.getElementById(id); };
  var PL = $('panelL'), PR = $('panel'), L = $('panelScrollL'), R = $('panelScroll');
  if (!PL || !PR || !L || !R || !$('btnRun') || !$('btnLiveOpen')) { document.documentElement.classList.remove('lcskin'); return; }

  var T = [];
  function isZh() { return (window.LANG || 'en') === 'zh'; }
  function el(tag, cls, en, zh) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    e.setAttribute('translate', 'no');
    if (en !== undefined) { T.push([e, en, zh]); e.textContent = isZh() ? zh : en; }
    return e;
  }
  var rzTips = null;
  function relabel() { T.forEach(function (t) { t[0].textContent = isZh() ? t[2] : t[1]; }); if (rzTips) rzTips(); }
  function add(p) { for (var i = 1; i < arguments.length; i++) if (arguments[i]) p.appendChild(arguments[i]); return p; }
  function row() { var r = el('div', 'row'); for (var i = 0; i < arguments.length; i++) if (arguments[i]) r.appendChild(arguments[i]); return r; }
  function colBtn(panel) {
    var b = el('button', 'lc-icon'); b.type = 'button'; b.textContent = '–'; b.title = 'Collapse';
    b.onclick = function () { panel.classList.toggle('lc-col'); b.textContent = panel.classList.contains('lc-col') ? '+' : '–'; };
    return b;
  }

  /* ------------------------------------------------------------------ what is there now */
  var gRun = $('btnRun').closest('details'), gCell = $('btnLiveOpen').closest('details');
  var gExp = $('btnDXF') ? $('btnDXF').closest('details') : null;
  var leftRest = [].slice.call(L.children).filter(function (c) { return c.tagName === 'DETAILS' && c !== gRun && c !== gCell && c !== gExp; });
  var oldHeadL = L.firstElementChild && L.firstElementChild.tagName === 'DIV' ? L.firstElementChild : null;
  var view = $('rv2View'), layers = R.querySelector('details.v5lay'), c8 = $('c8Group');
  var look = [].slice.call(R.children).filter(function (c) { return c.tagName === 'DETAILS' && c !== layers && c !== c8 && c.querySelector('[id^="rv"], .rv2sw, button') && c.classList.contains('rv2hl'); })[0] || null;
  var rightRest = [].slice.call(R.children).filter(function (c) { return c !== view && c !== layers && c !== look && c !== c8; });

  /* ------------------------------------------------------------------ left: title, steps, every setting */
  var hl = el('div', 'lc-head');
  add(hl, el('h1', '', 'The whole loop', '整环 · 黏菌与生长'), add(el('div', 'lc-hb'), $('langbar'), colBtn(PL)));
  PL.insertBefore(hl, L);
  if (oldHeadL) oldHeadL.style.display = 'none';

  /* 24 Nov 2026: the opening story (intro.js) can be played again from here */
  function introLink() {
    if (!window.LCIntro) return null;
    var b = el('button', 'lc-introlink', 'Where the loop comes from: watch the introduction', '环线从哪里来：重看介绍'); b.type = 'button';
    b.onclick = function () { window.LCIntro.replay(); };
    return b;
  }
  var top = el('div');
  add(top,
    el('div', 'lc-lead', 'The city and its roads grown together round the whole loop, 2025 to 2100. When the century ends the cells are read from the mould’s highways, and one of them goes on to step 2.', '城市与道路在整条环线上共同生长，2025 至 2100 年。百年结束后，从黏菌的干道读出单元，选一个送往第 2 步。'),
    el('div', 'lc-badge', 'Loop City · step 1 · the 412 km loop', 'Loop City · 第 1 步 · 412 km 环线'),
    introLink(),
    el('div', 'lc-h2', 'How the cells are made', '生成流程'));

  var steps = [];
  function step(n, en, zh, sen, szh) {
    var s = el('div', 'lc-step'), sh = el('button', 'lc-sh'), ck = el('span', 'lc-ck'), st = el('span', 'lc-st'), sb = el('div', 'lc-sb');
    sh.type = 'button'; ck.textContent = n;
    add(st, el('b', '', en, zh), el('span', 'lc-ss', sen, szh));
    var chev = el('span', 'lc-chev'); chev.textContent = '›';
    add(sh, ck, st, chev); add(s, sh, sb);
    sh.onclick = function () { s.classList.toggle('open'); };
    steps.push(s); top.appendChild(s);
    return sb;
  }
  function openOnly(i) { steps.forEach(function (s, k) { s.classList.toggle('open', k === i); }); }

  var s1 = step(1, 'Run the century', '运行百年', 'Slime mould · city growth · the existing roads', '黏菌 · 城市生长 · 现有道路');
  add(s1, gRun.querySelector('p.v5sub'), $('btnRun').parentElement);
  var s2 = step(2, 'Read the cells', '提取单元', 'Closed by the mould’s highways, then cleaned', '由黏菌干道围合，自动整理');
  add(s2, $('btnHwExtract') && $('btnHwExtract').parentElement, $('iHwAuto') && $('iHwAuto').closest('label'), $('hwNote'), c8);
  var s3 = step(3, 'Choose a cell', '选单元', 'Click one; shift-click its neighbours', '点选，按住 Shift 加选相邻单元');
  add(s3, gCell.querySelector('p.v5sub'), $('hwCellInfo'), $('btnHwBack') && row($('btnHwBack')));
  var s4 = step(4, 'On to step 2, the wool bands', '送往第 2 步 · 毛线带', 'Or save the cells as a file', '或保存单元文件');
  add(s4, row($('btnLiveOpen'), $('btnHwSend')), $('btnHwGeo') && $('btnHwGeo').parentElement, gCell.querySelector('details.why'));
  gRun.style.display = 'none'; gCell.style.display = 'none';
  if (c8) c8.open = false;
  /* four sliders of the older parcel method that sat in The network: kept on the page, not shown */
  ['iBridge', 'iNetSimp', 'iLineSmooth', 'iRoadW'].forEach(function (id) { var r = $(id) && $(id).closest('.f, .sw, label.tg'); if (r) r.classList.add('lc-old'); });

  var adv = el('div', 'lc-adv'), advBtn = el('button', 'lc-advbtn'), advBody = el('div', 'lc-advbody');
  advBtn.type = 'button';
  var ac = el('span', 'lc-chev'); ac.textContent = '›';
  add(advBtn, ac, el('span', '', 'All settings', '全部参数'));
  advBtn.onclick = function () { adv.classList.toggle('open'); };
  add(advBody, el('p', 'lc-advnote', 'The sliders and switches of the two models. Moving one that changes a run means running the century again.', '两个模型的滑块与开关。改动会影响运行的参数后，需要重新运行百年。'));
  leftRest.forEach(function (d) { d.open = false; advBody.appendChild(d); });
  rightRest.forEach(function (d) { if (d.tagName === 'DETAILS') d.open = false; advBody.appendChild(d); });
  /* (25 Nov 2026) the seed of the century, first among the settings */
  if ($('seedRow')) { var sh = el('div', 'panelHead', 'Seed', '种子'); var nt = advBody.querySelector('.lc-advnote'); advBody.insertBefore($('seedRow'), nt ? nt.nextSibling : advBody.firstChild); advBody.insertBefore(sh, $('seedRow')); }
  if ($('chips')) add(advBody, el('div', 'panelHead', 'Run figures', '运行数据'), $('chips'));
  add(adv, advBtn, advBody);
  top.appendChild(adv);
  L.insertBefore(top, L.firstChild);

  /* ------------------------------------------------------------------ right: display */
  var hr = el('div', 'lc-head');
  add(hr, el('span', 'rh', 'Display', '显示'), colBtn(PR));
  PR.insertBefore(hr, R);

  var rt = el('div');
  var secP = el('div', 'lc-sec');
  var spd = el('div', 'lc-spd');
  [].slice.call(document.querySelectorAll('#yearbar button.spd')).forEach(function (b) { spd.appendChild(b); });
  add(secP, el('div', 'lc-h2', 'Playback', '播放'), add(el('div', 'lc-play'), $('btnPlay'), $('btnRewind')), add(el('div', 'lc-yrow'), $('iYear')), spd);
  var secD = el('div', 'lc-sec');
  var big = el('div', 'lc-big'), tab = el('table', 'lc-tab');
  function tr(col, en, zh) {
    var r = document.createElement('tr'), a = document.createElement('td'), b = document.createElement('td');
    if (col) { var sw = el('i', 'lc-sw'); sw.style.background = col; a.appendChild(sw); }
    a.appendChild(el('span', '', en, zh)); r.appendChild(a); r.appendChild(b); tab.appendChild(r); return b;
  }
  var vBuilt = tr('#EFA65C', 'Built', '建成'), vFarm = tr('#A9B57F', 'Farmed', '农田'), vCells = tr('', 'Cells', '单元');
  add(secD, el('div', 'lc-h2', 'Readout', '数据'), $('vYear'), big, el('div', 'lc-sub', 'of road drawn by the mould', '黏菌道路'), tab);
  var secV = el('div', 'lc-sec');
  add(secV, el('div', 'lc-h2', 'View', '视图'), view);
  add(rt, secP, secD, secV);
  R.insertBefore(rt, R.firstChild);
  if (layers) R.appendChild(layers);
  if (look) { look.open = false; R.appendChild(look); }
  if (gExp) { gExp.open = false; R.appendChild(gExp); }

  var pill = el('div'); pill.id = 'lcPill';
  document.body.appendChild(pill);
  if ($('yearNote')) advBody.appendChild($('yearNote'));

  /* ------------------------------------------------------------------ keeping the readout and the steps in step */
  function txt(id) { var e = $(id); return e ? e.textContent : ''; }
  var was = { running: false, ran: false, cells: 0, sel: false };
  function tick() {
    var cells = 0; try { cells = (typeof HW !== 'undefined' && HW.cells || []).length; } catch (e) { cells = 0; }
    /* 23 Nov 2026: a century in progress is the Run button held after the model is ready. The class this read
       before is only set by the loose mould, so through a century the note went on saying "press Run". */
    var running = $('btnRun').classList.contains('running') || !!(window.__LC_READY__ === true && $('btnRun').disabled && !(typeof S !== 'undefined' && S.prepBusy));
    var sel = !$('btnLiveOpen').disabled;
    big.textContent = (txt('cRoad1') || '0') + ' km';
    vBuilt.textContent = (txt('cBuilt') || '0') + ' km²'; vFarm.textContent = (txt('cFarm') || '0') + ' km²';
    /* 23 Nov 2026: the cells are of the year the century ended (HW.shown in the page). At an earlier year, and through
       a replay, they are not on the map, so they are not counted here either and the note says why. */
    var playing = false, hid = false, endY = 2100;
    try { playing = !!S.playing; hid = cells > 0 && typeof HW.shown === 'function' && !HW.shown(); if (S.year != null) endY = S.year; } catch (e) { playing = hid = false; }
    vCells.textContent = cells && !hid ? String(cells) : '–';
    var yr = txt('vYear') || '2025', zh = isZh();
    var egg = window.LCEGG && window.LCEGG.text ? window.LCEGG.text(zh) : '';
    var reading = false; try { reading = typeof HW !== 'undefined' && !!HW.busy; } catch (e) { reading = false; }
    pill.textContent = egg ? egg : reading ? (zh ? '正在提取单元…' : 'Reading the cells…') : running ? (zh ? '正在生长 · ' : 'Growing · ') + yr
      : playing ? (zh ? '正在回放 · ' : 'Replaying · ') + yr
      : hid ? yr + (zh ? ' · 单元在 ' + endY + ' 年' : ' · the cells are at ' + endY)
      : cells ? yr + (zh ? ' · ' + cells + ' 个单元' : ' · ' + cells + ' cells')
      : (zh ? yr + ' · 点「运行百年」开始' : yr + ' · press Run the century');
    if (was.running && !running) was.ran = true;
    if (running && !was.running) { was.ran = false; openOnly(0); }
    steps[0].classList.toggle('done', was.ran || cells > 0);
    steps[1].classList.toggle('done', cells > 0);
    steps[2].classList.toggle('done', sel);
    if (cells > 0 && !was.cells) openOnly(2);
    else if (was.ran && !cells && was.running && !running) openOnly(1);
    if (sel && !was.sel) openOnly(3);
    if (!cells && was.cells) openOnly(0);
    was.running = running; was.cells = cells; was.sel = sel;
    if (phStatus) phStatus.textContent = pill.textContent;      // the phone's sheet says where the page is
  }
  var phStatus = null;
  openOnly(0);
  if (window.innerWidth <= 600) { PR.classList.add('lc-col'); var cb = hr.querySelector('.lc-icon'); if (cb) cb.textContent = '+'; }
  setInterval(tick, 400); tick();
  /* the note keeps the year of the big figure, through a run and a replay (it was up to one tick, a year at 2x, behind) */
  if (typeof window.showYear === 'function') { var sy0 = window.showYear; window.showYear = function () { var r = sy0.apply(this, arguments); try { tick(); } catch (e) { /* next tick */ } return r; }; }

  /* ------------------------------------------------------------------ the panels' width, by dragging (23 Nov 2026)
     A handle on the inner edge of each panel: drag it (mouse, pen or finger) to make the panel wider or narrower,
     double-click it to go back to the width the page opens with; the arrow keys move it too. The two widths are
     kept for the next visit. Not on narrow screens, where the panels sit above and below the map.
     The map: if it was fitted to its frame it stays fitted as the frame changes; if you had zoomed or moved it,
     it stays where it is on the screen and the panel slides over it. View only: nothing in a run changes. */
  (function () {
    var root = document.documentElement, KEY = 'loopCityPanelW';
    var DEF = { l: 372, r: 316 }, MIN = { l: 280, r: 240 }, MAX = 720, MAP = 360;   // MAP: what is always left for the map
    var want = { l: DEF.l, r: DEF.r }, W = { l: DEF.l, r: DEF.r };                  // what was asked for; what fits now
    try { var sv = JSON.parse(localStorage.getItem(KEY) || 'null'); if (sv) { if (sv.l > 0) want.l = +sv.l; if (sv.r > 0) want.r = +sv.r; } } catch (e) { /* no storage: the widths last for this visit */ }
    function room() { return window.innerWidth - 40 - MAP; }                        // both panels together
    function fit() {                                                                // a small window: both give way, in proportion
      var l = Math.max(MIN.l, Math.min(MAX, want.l)), r = Math.max(MIN.r, Math.min(MAX, want.r)), over = l + r - room();
      if (over > 0) {
        var gl = l - MIN.l, gr = r - MIN.r, g = gl + gr, k = g > 0 ? Math.min(1, over / g) : 0;
        l -= gl * k; r -= gr * k;
      }
      W.l = Math.round(l); W.r = Math.round(r);
    }
    function most(side) { return Math.max(MIN[side], Math.min(MAX, room() - (side === 'l' ? W.r : W.l))); }
    function put() {
      root.style.setProperty('--lc-wl', W.l + 'px'); root.style.setProperty('--lc-wr', W.r + 'px');
      hs.forEach(function (h) {
        h.e.setAttribute('aria-valuenow', W[h.side]); h.e.setAttribute('aria-valuemin', MIN[h.side]); h.e.setAttribute('aria-valuemax', most(h.side));
      });
    }
    function set(side, v) {                                                         // by hand: the other panel keeps the width it shows
      want.l = W.l; want.r = W.r;
      want[side] = Math.round(Math.max(MIN[side], Math.min(most(side), v)));
      follow(); fit(); put();
    }
    function keep() { try { localStorage.setItem(KEY, JSON.stringify(want)); } catch (e) { /* as above */ } }

    /* the map under a moving frame */
    var cv = $('view'), wrap = cv && cv.parentElement, F = null, Ft = 0;
    function mapOk() { return wrap && typeof S !== 'undefined' && S && S.view && S.mapW > 0 && typeof fitView === 'function' && cv.width > 0; }
    function follow() {
      clearTimeout(Ft); Ft = setTimeout(function () { F = null; }, 400);
      if (F) return;
      try {
        if (!mapOk()) return;
        var w = cv.width, h = cv.height, k = Math.min(w / S.mapW, h / S.mapH) * 0.94, v = S.view;
        var fitted = Math.abs(v.k - k) < 1e-4 * k && Math.abs(v.x - (w - S.mapW * k) / 2) < 1.5 && Math.abs(v.y - (h - S.mapH * k) / 2) < 1.5;
        F = { fitted: fitted, left: wrap.getBoundingClientRect().left };
      } catch (e) { F = null; }
    }
    if (wrap && window.ResizeObserver) new ResizeObserver(function () {          // made after the page's own, so it runs after resize()
      if (!F) return;
      try {
        if (!mapOk()) return;
        var left = wrap.getBoundingClientRect().left;
        if (F.fitted) fitView();
        else { var r = wrap.clientWidth > 0 ? cv.width / wrap.clientWidth : 1; S.view.x -= (left - F.left) * r; }
        F.left = left;
      } catch (e) { /* the map keeps the page's own behaviour */ }
    }).observe(wrap);

    var hs = [];
    function handle(side, panel) {
      var h = document.createElement('div');
      h.className = 'lc-rz lc-rz-' + side; h.tabIndex = 0;
      h.setAttribute('role', 'separator'); h.setAttribute('aria-orientation', 'vertical'); h.setAttribute('translate', 'no');
      h.appendChild(document.createElement('i'));
      if (side === 'l') panel.after(h); else panel.before(h);
      var x0 = 0, w0 = 0, on = false;
      h.addEventListener('pointerdown', function (ev) {
        if (ev.button > 0) return;
        on = true; x0 = ev.clientX; w0 = W[side];
        try { h.setPointerCapture(ev.pointerId); } catch (e) { /* older browsers */ }
        h.classList.add('on'); root.classList.add('lc-rzing'); ev.preventDefault();
      });
      h.addEventListener('pointermove', function (ev) {
        if (!on) return;
        var d = ev.clientX - x0;
        set(side, w0 + (side === 'l' ? d : -d));
      });
      function end() { if (!on) return; on = false; h.classList.remove('on'); root.classList.remove('lc-rzing'); keep(); }
      h.addEventListener('pointerup', end); h.addEventListener('pointercancel', end); h.addEventListener('lostpointercapture', end);
      h.addEventListener('dblclick', function () { set(side, DEF[side]); keep(); });
      h.addEventListener('keydown', function (ev) {
        var k = ev.key, d = k === 'ArrowLeft' ? -16 : k === 'ArrowRight' ? 16 : 0;
        if (!d) return;
        set(side, W[side] + (side === 'l' ? d : -d)); keep(); ev.preventDefault();
      });
      hs.push({ e: h, side: side });
    }
    handle('l', PL); handle('r', PR);
    rzTips = function () {
      var t = isZh() ? '拖动调整宽度 · 双击复原' : 'Drag to resize · double-click to reset';
      hs.forEach(function (h) { h.e.title = t; h.e.setAttribute('aria-label', t); });
    };
    fit(); put(); rzTips();
    window.addEventListener('resize', function () { var l = W.l, r = W.r; fit(); if (l !== W.l || r !== W.r) put(); });
  })();

  /* ------------------------------------------------------------------ Layers, tidied (23 Nov 2026)
     Every switch and slider in Layers was flipped in turn, in each view, and the map compared before and after.
     1. Six switches (and three sliders) never changed a pixel: they draw the older parcel method, whose buttons this
        interface does not show, so their data is never made. They stay on the page, not shown (`#noskin` has them).
     2. "Colour by use" and its key colour the cells of the highways, so they sit under that row now.
     3. The two shortcuts set the layers of the method in use: "Show everything" is the Everything view with the base
        map and its usual layers; "Roads and mould only" is the mould, its highways, links and spurs, and the existing
        roads and rail, with the cells, the growth and the base picture off.
     4. The base picture already holds some of the single layers, so a line says what the switches below it do, and
        the ones that do nothing (light map, base on) are greyed. View only: nothing in a run changes. */
  (function () {
    if (!layers) return;
    var RV = window.RV2 || null;
    function rowOf(id) { var e = $(id); return e ? (e.closest('.v5l') || e.closest('.sw')) : null; }

    /* 1 */
    ['iShowRoad1', 'iShowJunctions', 'iShowUnbound', 'iShowRoad2', 'iShowCells', 'iCellLabels'].forEach(function (id) { var r = rowOf(id); if (r) r.classList.add('lc-old'); });
    var net = rowOf('iShowNet'), h = net;
    while (h && !(h.classList && h.classList.contains('v5h'))) h = h.previousElementSibling;
    if (h) { h.setAttribute('translate', 'no'); T.push([h, 'The slime mould', '黏菌']); }

    /* 2 */
    var cellsCb = RV && RV.hwCb && RV.hwCb.cells, cellsRow = cellsCb ? cellsCb.closest('.v5l') : null;
    var useRow = rowOf('iV5ByUse'), key = layers.querySelector('.v5legend');
    if (cellsRow && useRow) { cellsRow.after(useRow); if (key) useRow.after(key); }

    /* 3 */
    function base(fn) {
      if (typeof BASE_LAYERS === 'undefined' || typeof buildBaseLayerPanel !== 'function') return;
      var light = !!(RV && RV.light && RV.layersDone && RV.LIGHT_OFF);
      BASE_LAYERS.forEach(function (L) {
        var v = !!fn(L, light);
        if (light && RV.LIGHT_OFF.indexOf(L.id) >= 0) { RV.savedLayers = RV.savedLayers || {}; RV.savedLayers[L.id] = !!fn(L, false); }
        L.on = v;
      });
      buildBaseLayerPanel();
    }
    function done() { try { S.growthY = null; S.dirty = true; if (typeof draw === 'function') draw(); } catch (e) { /* drawn on the next frame */ } baseState(); }
    var bAll = $('btnAllOn'), bSolo = $('btnSolo');
    if (RV && bAll) bAll.onclick = function () {
      RV.setMode('all');
      RV.setCb('iMouldOn', true); RV.setCb('iBakedBase', true);
      base(function (L, light) { return typeof DEFAULT_ON !== 'undefined' && DEFAULT_ON.indexOf(L.id) >= 0 && !(light && RV.LIGHT_OFF.indexOf(L.id) >= 0); });
      done();
    };
    if (RV && bSolo) bSolo.onclick = function () {
      RV.setCb('iMouldOn', true); RV.setCb('iShowNet', true);
      ['hw', 'link', 'spur'].forEach(function (k) { RV.setHw(k, true); }); RV.setHw('cells', false);
      ['iShowBuilt', 'iShowFarm', 'iShowEdge', 'iBakedBase'].forEach(function (id) { RV.setCb(id, false); });
      base(function (L) { return L.id.indexOf('roads') === 0 || L.id === 'rail'; });
      done();
    };

    /* 4 */
    var bl = $('baseLayers'), note = document.createElement('p');
    note.className = 'hint lc-basenote'; note.setAttribute('translate', 'no');
    if (bl && bl.parentNode === layers) layers.insertBefore(note, bl);
    function baseState() {
      if (!bl || typeof BASE_LAYERS === 'undefined') return;
      var zh = isZh(), on = !RV || !RV.baseOn || RV.baseOn(), any = false;
      BASE_LAYERS.forEach(function (L) {
        var cb = $('bl_' + L.id), r = $('bl_' + L.id + '_op'), row = cb ? cb.closest('#baseLayers > div') : null;
        if (!row) return;
        var na = !!(RV && RV.skipLayer && RV.skipLayer(L.id));
        if (na) any = true;
        row.classList.toggle('lc-na', na);
        if (cb.disabled !== na) cb.disabled = na;
        if (r && r.disabled !== na) r.disabled = na;
      });
      var t = !on ? (zh ? '底图已关闭：下面每一层都是独立图层。' : 'The base map is off: each layer below stands on its own.')
        : any ? (zh ? '浅色底图里已经画有变灰的几层，关掉「底图（一张图）」后才能单独开关；其余各层叠加在底图之上。'
                    : 'The light base map already holds the greyed layers; turn "Base map (one picture)" off to switch them one by one. The others are drawn over the base.')
        : (zh ? '底图这张图已含城区、水体、绿带边界、主要道路和铁路；下面的开关只是在它上面再叠一层着色。要单独开关，先关掉「底图（一张图）」。'
              : 'The base picture already holds the built-up area, the water, the green belt edge, the main roads and the rail; the switches below only draw a tint over it. To switch them one by one, turn "Base map (one picture)" off first.');
      if (note.textContent !== t) note.textContent = t;
    }
    baseState(); setInterval(baseState, 400);
  })();

  /* ------------------------------------------------------------------ the free mould, kept as a find (23 Nov 2026)
     The page still had the loose mould of the app it grew from: a click left a release point, and Space set the
     mould going from it with no years and no city. Under this interface that was a trap, not a feature. A click
     left a dot that Run then threw away; Space rewrote the Run button, and pressed in the middle of a century it
     added steps to the run without a word. It is kept, as something to find, and kept apart from the century:
       Space      before a run (or after Reset): the mould grows from the stations, free. Space again: pause, go on.
       a click    while it is on: one more release point (shift-click takes the nearest away and starts over).
       Escape     clears it and leaves. Run and Reset clear it too.
     During a century, and with a century's result on the screen, Space does nothing. While it is on the cells
     cannot be read from it (it is not a century). It stops by itself after three minutes. The growth model is
     not touched, so the first pass kept for the first Run still holds. index.html asks window.LCEGG what a
     click and Space mean; without this file (#noskin) the page is as it was. */
  (function () {
    var CAP = 40, LIMIT = 180000;                                // release points in all; ms of running before it pauses
    var E = window.LCEGG = { on: false };
    var result = false;                                          // a century has been started and not reset
    var hint = '', hintTill = 0, ranMs = 0, last = 0, auto = false, sw = null;
    function say(zh, en, ms) { hint = [zh, en]; hintTill = performance.now() + (ms || 2600); }
    function ready() { return window.__LC_READY__ === true && !S.prepBusy && S.trail && !$('btnRun').disabled; }
    function smoke(on) {                                         // the mould has to be on show while it plays
      var RV = window.RV2;
      if (on) {
        sw = { m: $('iMouldOn') ? $('iMouldOn').checked : true, n: $('iShowNet') ? $('iShowNet').checked : true };
        if (RV) { RV.setCb('iMouldOn', true); RV.setCb('iShowNet', true); }
      } else if (sw) {
        if (RV) { RV.setCb('iMouldOn', sw.m); RV.setCb('iShowNet', sw.n); }
        sw = null;
      }
    }
    function wipe() {
      S.running = false; S.n = 0; S.seeds = []; S.step = 0;
      if (S.trail) S.trail.fill(0);
      if (S.next) S.next.fill(0);
      S.dirty = true;
      try { if (typeof updateChips === 'function') updateChips(); } catch (e) { /* the figures follow on the next step */ }
    }
    E.enter = function () {
      if (E.on) return true;
      if (!ready()) return false;
      if (result) { say('自由黏菌：先点「重置」', 'Free mould: press Reset first'); return false; }
      wipe(); smoke(true);
      if (typeof seedNodes === 'function') seedNodes();
      E.on = true; S.running = true; ranMs = 0; last = performance.now(); auto = false;
      return true;
    };
    E.exit = function (keep) {                                   // keep: Run or Reset is about to clear the sheet itself
      if (!E.on) return;
      E.on = false; S.running = false;
      if (!keep) wipe();
      smoke(false); hintTill = 0;
    };
    /* which control holds the focus because it was clicked or touched (the browser's own :focus-visible turns true
       for a clicked button as soon as any key goes down, so it cannot tell the two apart here) */
    var ptrAt = -1e9, byPointer = null;
    document.addEventListener('pointerdown', function () { ptrAt = performance.now(); }, true);
    document.addEventListener('focusin', function (ev) { byPointer = (performance.now() - ptrAt < 700) ? ev.target : null; }, true);
    /* Space. True when the key was taken (the page then stops the browser's own use of it). A button reached with
       the keyboard keeps Space for itself; one that only holds the focus because it was clicked gives it up. */
    E.space = function (ev) {
      var a = document.activeElement;
      if (a && a !== document.body && a.tagName !== 'INPUT') {
        if (a !== byPointer) return false;
        if (a.blur) a.blur();
      }
      if (!E.on) { E.enter(); return true; }
      S.running = !S.running; auto = false; last = performance.now();
      return true;
    };
    E.click = function (mx, my, shift) {
      if (!E.on) return;
      if (shift) { if (typeof removeNearestSeed === 'function') removeNearestSeed(mx, my); return; }
      if (S.seeds.length >= CAP) { say('种子点已满（' + CAP + ' 个）', 'No more release points (' + CAP + ')'); return; }
      if (typeof addSeed === 'function') addSeed(mx, my);
    };
    E.text = function (zh) {
      var now = performance.now();
      if (E.on && S.running) { ranMs += now - last; if (ranMs > LIMIT) { S.running = false; auto = true; ranMs = 0; } }
      last = now;
      if (now < hintTill) return zh ? hint[0] : hint[1];
      if (!E.on) return '';
      if (S.running) return zh ? '自由黏菌 · 空格暂停 · Esc 退出' : 'Free mould · Space pause · Esc exit';
      return auto ? (zh ? '已自动暂停 · 空格继续 · Esc 退出' : 'Paused itself · Space · Esc exit')
                  : (zh ? '已暂停 · 空格继续 · Esc 退出' : 'Paused · Space resume · Esc exit');
    };

    /* the century and Reset clear the sheet themselves; the free mould only has to step aside first */
    var run0 = window.runCentury, reset0 = window.resetSim;
    if (typeof run0 === 'function') window.runCentury = function () { E.exit(true); result = true; return run0.apply(this, arguments); };
    if (typeof reset0 === 'function') {
      /* Reset, after a century, used to clear the mould and the cells and leave the rest: the year still read 2100,
         the city of 2100 stayed on the map, the figures kept the last run's, and step 1 stayed ticked. With no
         century in progress it now also clears what the run made (the page's own clearRunState, as Run does
         before it starts) and shows 2025, so the page is where it was when it opened. */
      window.resetSim = function () {
        E.exit(true);
        var r = reset0.apply(this, arguments);
        if (ready()) {
          result = false;
          try {
            if (S.year != null) {
              if (typeof clearRunState === 'function') clearRunState();
              if (typeof REPLAY !== 'undefined' && REPLAY) { REPLAY.snaps = {}; REPLAY.last = null; }   // the last run's mould, year by year
              S.year = null;
              if (typeof showYear === 'function' && typeof YEAR0 !== 'undefined') showYear(YEAR0);
              if (typeof updateChips === 'function') updateChips();
              if ($('yearNote')) $('yearNote').textContent = '';
            }
            was.ran = false;
          } catch (e) { /* the page's own reset has been done */ }
        }
        return r;
      };
      if ($('btnReset')) $('btnReset').onclick = function () { window.resetSim(); };   // the page had bound the function itself
    }
    /* the cells are read from a century's trail, never from this */
    if (typeof HW !== 'undefined' && HW && typeof HW.extract === 'function') {
      var ex0 = HW.extract;
      HW.extract = function () {
        if (E.on) { say('自由黏菌里不能提取单元', 'No cells from the free mould'); return; }
        var r = ex0.apply(this, arguments);
        try { tick(); } catch (e) { /* the note follows on the next tick */ }      // "Reading the cells" at once
        return r;
      };
    }
  })();

  /* ------------------------------------------------------------------ the phone (23 Nov 2026)
     One layout for every app on a phone, after the London map's: the map fills the screen; Display is a button at the
     top left that opens the display panel across the top half; the working panel is a sheet along the bottom.
     Folded, the sheet shows the title, where the page is, and Run and Reset; its handle (tap, or drag up and down) or
     the + opens it over at most 72 % of the height, the steps scrolling inside. Opening one folds the other. The
     zoom buttons stand at the top right. Heights follow the screen (dvh), so the small iPhones get the same layout
     with less of each panel showing and the rest scrolling inside it; nothing is made smaller than 44 px.
     A phone is a touch screen whose short side is under 600 px (as the London map decides it); #phone and #nophone
     in the address force it. iPads and computers keep the two floating panels. Interface only. */
  (function () {
    var root = document.documentElement, FOLDED = 141;
    if (!root.classList.contains('lcphone')) return;      // decided in the page's head, before anything is laid out
    PL.classList.remove('lc-col'); PR.classList.remove('lc-col');

    /* the sheet */
    var handle = el('button', 'lcph-handle'); handle.type = 'button';
    PL.insertBefore(handle, PL.firstChild);
    var h1 = hl.querySelector('h1'), tw = el('div', 'lcph-title');
    phStatus = el('div', 'lcph-status');
    hl.insertBefore(tw, hl.firstChild); if (h1) tw.appendChild(h1); tw.appendChild(phStatus);
    var quick = el('div', 'lcph-quick'), runRow = $('btnRun').parentElement;
    quick.appendChild(runRow); PL.insertBefore(quick, L);
    var fold = hl.querySelector('.lc-icon');
    function sheet(open) {
      root.classList.toggle('lcph-open', !!open);
      if (open) display(false);
      if (fold) { fold.textContent = open ? '–' : '+'; }
      tips();
    }
    /* 24 Nov 2026: the sheet follows the finger, by the handle or the whole head, and glides open or folded (the one
       sheet of the other apps, ../../shared/ui/phone.js L2Phone.drag); a tap, and + / –, open or fold it as before */
    var pull = window.L2Phone && window.L2Phone.drag ? window.L2Phone.drag({
      sheet: PL, body: $('panelScrollL'), grips: [handle, hl],
      isOpen: function () { return root.classList.contains('lcph-open'); }, set: sheet
    }) : null;
    if (fold) fold.onclick = function () { var v = !root.classList.contains('lcph-open'); if (pull) pull.to(v); else sheet(v); };
    if (!pull) handle.onclick = function () { sheet(!root.classList.contains('lcph-open')); };

    /* Display */
    /* the language switch (24 Nov 2026): at the top right, level with Display, as in the other apps
       (../../shared/ui/phone.css, .l2ph-lang); the zoom buttons go below it (skin.css) */
    if ($('langbar')) { $('langbar').classList.add('l2ph-lang'); document.body.appendChild($('langbar')); root.classList.add('l2ph-lang-top'); }
    var db = el('button', 'lcph-disp'); db.type = 'button';
    db.innerHTML = '<svg aria-hidden="true" width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M9 2 2 5.6 9 9.2l7-3.6L9 2Z"></path><path d="m2 9.2 7 3.6 7-3.6"></path><path d="m2 12.6 7 3.6 7-3.6"></path></svg>';
    var dbt = el('span', '', 'Display', '显示'); db.appendChild(dbt);
    document.body.appendChild(db);
    function display(open) {
      root.classList.toggle('lcph-disp-open', !!open);
      db.setAttribute('aria-expanded', open ? 'true' : 'false');
      if (open) { root.classList.remove('lcph-open'); if (fold) fold.textContent = '+'; tips(); }
    }
    db.onclick = function () { display(!root.classList.contains('lcph-disp-open')); };
    function tips() {
      var zh = isZh(), open = root.classList.contains('lcph-open');
      var t = open ? (zh ? '收起功能面板' : 'Fold the panel') : (zh ? '展开功能面板' : 'Open the panel');
      handle.setAttribute('aria-label', t); if (fold) { fold.title = t; fold.setAttribute('aria-label', t); }
    }
    var rz0 = rzTips; rzTips = function () { if (rz0) rz0(); tips(); };      // relabel() calls this when the language changes
    sheet(false); display(false);

    /* the map is fitted to the part of the screen above the folded sheet */
    var fit0 = window.fitView;
    if (typeof fit0 === 'function') window.fitView = function () {
      var r = fit0.apply(this, arguments);
      try { if (r && typeof S !== 'undefined' && S.view) S.view.y -= Math.round(FOLDED / 2 * Math.min(2, window.devicePixelRatio || 1)) - Math.round(28 * Math.min(2, window.devicePixelRatio || 1)); } catch (e) { /* fitted as the page fits it */ }
      return r;
    };
    /* the page may have fitted the map before this file ran: once more, now the sheet is known */
    try { if (typeof S !== 'undefined' && S.mapW && S._fitted && typeof resize === 'function') { resize(); window.fitView(); } } catch (e) { /* fitted when the map arrives */ }
  })();

  /* ------------------------------------------------------------------ language */
  var old = window.setLang;
  if (typeof old === 'function') window.setLang = function () { var r = old.apply(this, arguments); relabel(); return r; };
  if ($('langbar')) $('langbar').addEventListener('click', function () { setTimeout(relabel, 0); setTimeout(relabel, 300); });
  relabel(); setTimeout(relabel, 800);
  try { window.dispatchEvent(new Event('resize')); } catch (e) { /* the map re-fits itself */ }
})();
