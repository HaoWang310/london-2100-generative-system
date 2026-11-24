/* Structure Studio · the opening film (24 Nov 2026).
   About 31 s, in five scenes, on the site the page opens (every number and line is that site's own, computed by
   intro/data.js from the snapshot, step 5 and step 6):
     1 the ground: the streets the tensor field grew, and their junctions (mostly T)
     2 the problem: made into 20 m corridors, the main and through streets give street blocks — a wider street
     3 the precedent: Frei Otto's wet wool threads merge into three-way nodes (a small simulation, intro/wool.json)
     4 the rule: one field, two nets (an exploded axonometric: field, ground net, raised net, farmland)
     5 standing up: the step-6 structure in WebGL — the net rises, its levels are pulled apart and woven by the ramps,
       the camera closes in on a tower, the levels close up again, and the plan fades in: the app's first picture
   It covers the page's own loading (three.js, the snapshot, the tower model, building the structure). Scenes 1–4 are
   drawn in a worker (intro/worker.js, OffscreenCanvas) so they keep moving while the page builds; scene 5 is drawn
   here with the page's three.js once the page is idle. If the structure is not ready by the end of scene 3, the film
   holds there. "Skip" (or Esc) closes it at any time; "Enter" (or Enter) once the structure is ready. At the end the
   page goes straight on to its own opening picture, the tensor field, without replaying it.
   Every visit, when the page is opened on its own. Not with #nointro, #noskin, ?embed=1, nor with the system's
   "reduce motion". "▶ 开场" in the process panel plays it again (SSIntro.replay()). */
(function () {
  'use strict';
  var de = document.documentElement, H = location.hash || '', Q = location.search || '';
  var calm = false; try { calm = matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) {}
  var framed = false; try { framed = window.parent !== window; } catch (e) { framed = true; }
  var off = !de.classList.contains('l2ui') || /[#&]nointro\b/.test(H) || /[?&]embed=1\b/.test(Q) || framed || calm;
  var canMove = typeof OffscreenCanvas !== 'undefined' && typeof Worker !== 'undefined' && !!(window.HTMLCanvasElement && HTMLCanvasElement.prototype.transferControlToOffscreen);
  var V = (document.currentScript && /\?v=([^&]+)/.exec(document.currentScript.src) || [])[1] || '';
  var lang = function () { try { if (typeof LANG !== 'undefined') return LANG; } catch (e) {} try { var s = localStorage.getItem('structureStudio.uiLanguage') || localStorage.getItem('l2100.lang') || ''; if (s) return /^en/.test(s) ? 'en' : 'zh'; } catch (e) {} return /^zh/i.test(navigator.language || 'zh') ? 'zh' : 'en'; };
  var now = function () { return performance.timeOrigin + performance.now(); };
  var cur = null;

  function Film(opts) {
    var me = this, zh = lang() !== 'en', L = function (a, b) { return zh ? a : b; };
    var Dr = null, T = [0, 4.5, 9.5, 14.5, 19.5], END = 30.8, XF = 0.6;   // draw.js comes later in the page: read when the snapshot arrives
    me.closed = false; me.replay = !!opts.replay; me.cb = null; me.skippedEarly = false; me.structure = false;
    var root = document.createElement('div'); root.id = 'ssIntro'; root.setAttribute('lang', zh ? 'zh-CN' : 'en'); root.setAttribute('role', 'dialog'); root.setAttribute('aria-label', L('开场：结构工作室在做什么', 'Opening: what Structure Studio does'));
    root.innerHTML = '<canvas class="ssi-gl"></canvas><canvas class="ssi-film"></canvas><canvas class="ssi-top"></canvas>' +
      '<div class="ssi-card"><b>' + L('结构工作室', 'Structure Studio') + '</b><span>' + L('Linear Farm 走廊 · 在张量场的街道之上', 'Linear Farm corridors · above the tensor-field streets') + '</span><i></i><em>' + L('正在载入场地…', 'Loading the site…') + '</em></div>' +
      '<button type="button" class="ssi-skip">' + L('跳过', 'Skip') + '</button><button type="button" class="ssi-enter">' + L('进入 ›', 'Enter ›') + '</button>';
    (document.body || de).appendChild(root); de.classList.add('ssi-on');
    var cvGL = root.querySelector('.ssi-gl'), cvFilm = root.querySelector('.ssi-film'), cvTop = root.querySelector('.ssi-top'), ctxTop = cvTop.getContext('2d');
    var W = innerWidth, Hh = innerHeight, dpr = Math.min(2, devicePixelRatio || 1), low = Math.min(W, Hh) < 600 || (navigator.maxTouchPoints || 0) > 0;
    var worker = null, film = null, top = null, s5 = null, t0 = 0, hold = 0, holdAt = null, started = false, raf = 0, data = null, deck = null, name = opts.name || '';
    me.root = root;
    function size() { W = innerWidth; Hh = innerHeight; dpr = Math.min(2, devicePixelRatio || 1);
      if (worker) worker.postMessage({ type: 'size', w: W, h: Hh, dpr: dpr }); if (film) film.resize(W, Hh, dpr); if (top) top.resize(W, Hh, dpr); if (s5) s5.resize(W, Hh, dpr); }
    var rsT = 0; function onResize() { clearTimeout(rsT); rsT = setTimeout(size, 120); }
    function onKey(e) { if (e.key === 'Escape') { e.preventDefault(); me.close(); } else if (e.key === 'Enter' && me.structure && started) { e.preventDefault(); me.close(); } }
    addEventListener('resize', onResize); document.addEventListener('keydown', onKey, true);
    root.querySelector('.ssi-skip').onclick = function () { me.close(); };
    root.querySelector('.ssi-enter').onclick = function () { me.close(); };
    // ---------------------------------------------------------------- the ground (snapshot) → the worker, or drawn here
    me.snap = function (snap, nm) { if (me.closed || me.hasSnap) return; me.hasSnap = true; name = nm || name; zh = lang() !== 'en';
      Dr = window.SSIntroDraw; if (!Dr || !window.SSIntroData) { me.close(); return; } T = Dr.T; END = Dr.END; XF = Dr.XF;
      if (canMove) {
        try { var off = cvFilm.transferControlToOffscreen(); worker = new Worker('intro/worker.js' + (V ? '?v=' + V : ''));
          worker.onmessage = function (e) { var m = e.data; if (m.type === 'ready') begin(); else if (m.type === 'hold') hold = m.hold; else if (m.type === 'snap') { data = Object.assign(data || {}, m.data); top && top.setSnap(m.data); } };
          worker.onerror = function () { me.close(); };
          worker.postMessage({ type: 'init', canvas: off, w: W, h: Hh, dpr: dpr, lang: zh ? 'zh' : 'en', name: name }, [off]);
          worker.postMessage({ type: 'snap', snap: snap }); } catch (e) { worker = null; }
      }
      top = Dr.create(ctxTop, { lang: zh ? 'zh' : 'en', name: name }); top.resize(W, Hh, dpr);
      if (!worker) {                       // older browsers: everything drawn here (it stops while the page builds)
        film = Dr.create(cvFilm.getContext('2d'), { lang: zh ? 'zh' : 'en', name: name }); film.resize(W, Hh, dpr);
        var A = SSIntroData.fromSnap(snap); data = Object.assign(data || {}, A); film.setSnap(A); top.setSnap(A);
        fetch('intro/wool.json' + (V ? '?v=' + V : '')).then(function (r) { return r.json(); }).then(function (w) { film.setWool(w); begin(); }, function () { begin(); });
      }
    };
    // ---------------------------------------------------------------- the corridor net and the structure (F, step 6) → the film; scene 5 built here
    me.structureReady = function (F, SITE, P, DKP) {
      var B = SSIntroData.fromStructure(F, SITE, P), DK = null;
      try { if (typeof DECK !== 'undefined' && DECK && DECKF === F) DK = DECK; else { DK = SS.deck.buildDeck(F, DKP || {}); try { DECK = DK; DECKF = F; } catch (e) {} } } catch (e) { DK = null; }
      deck = DK ? SSIntroData.fromDeck(DK, F) : null;
      data = Object.assign(data || {}, B);
      if (worker) worker.postMessage({ type: 'structure', data: B, deck: deck }); if (film) { film.setStructure(B); if (deck) film.setDeck(deck); }
      top.setStructure(B); if (deck) top.setDeck(deck);
      if (started) { var tn = (now() - t0) / 1000 - hold; if (tn > Dr.HOLD) hold += tn - Dr.HOLD; }   // the worker held at the end of scene 3 for as long
      me.structure = true; root.classList.add('ssi-ready');
      // scene 5: built a moment later, so the worker keeps the screen moving meanwhile
      setTimeout(function () { if (me.closed || !DK) return; try { build5(F, SITE, DK); } catch (e) { console.warn('opening film, scene 5', e); s5 = null; } }, 60);
    };
    function waitTower(cb, n) { try { if (typeof TOWER3 !== 'undefined' && TOWER3) return cb(TOWER3); } catch (e) {} if (n <= 0) return cb(null); setTimeout(function () { waitTower(cb, n - 1); }, 250); }
    function build5(F, SITE, DK) {
      if (!window.THREE || !window.SSIntroScene5 || !data || !data.outline) return;
      var dm = SS.deck.deckMesh(DK, low ? 1 : 2);
      var bases = (F.plazas || []).map(function (z) { try { return SS.plazaOutline(z, SITE); } catch (e) { return []; } });
      var anchor = null; if (bases[0] && bases[0][2] && bases[0][2].rings[0]) { var r = bases[0][2].rings[0]; anchor = r[Math.floor(r.length * 0.3)]; }
      waitTower(function (T3) {
        if (me.closed) return;
        var towers = (T3 && SS.tower) ? F.towers.filter(function (t) { return t[5]; }).map(function (t) { return { xf: SS.tower.xf(t, -1), z0: t[7] != null ? t[7] : SS.tower.BASE.podium }; }) : [];
        s5 = SSIntroScene5.create({ canvas: cvGL, ctx: ctxTop, draw: top, data: data, deckMesh: dm, bases: bases, towers: towers, shells: T3 ? T3.towers.map(function (w) { return w.mesh; }) : [],
          ramps: deck ? deck.ramps : [], towerAt: F.towers[0] ? [F.towers[0][0], F.towers[0][1]] : null, towerTip: F.towers[0] ? Math.round(F.towers[0][3]) : null, baseAnchor: anchor, lang: zh ? 'zh' : 'en', low: low });
        s5.resize(W, Hh, dpr);
      }, 40);
    }
    // ---------------------------------------------------------------- the clock
    function begin() { if (started || me.closed) return; started = true; t0 = now(); root.classList.add('ssi-play'); if (worker) worker.postMessage({ type: 'start', t0: t0 }); raf = requestAnimationFrame(tick); }
    function tick() { if (me.closed) return; raf = requestAnimationFrame(tick);
      var t = (now() - t0) / 1000 - hold, waiting = false;
      if (!worker) { if (!me.structure && t >= Dr.HOLD) { if (holdAt == null) holdAt = now(); t = Dr.HOLD; waiting = true; } else if (holdAt != null) { hold += (now() - holdAt) / 1000; holdAt = null; t = (now() - t0) / 1000 - hold; } film.frame(Math.min(t, END), { waiting: waiting }); }
      var five = t >= T[4] && me.structure, lt = t - T[4];
      ctxTop.setTransform(1, 0, 0, 1, 0, 0); ctxTop.clearRect(0, 0, cvTop.width, cvTop.height); ctxTop.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (five) {
        var out = Dr.seg(lt, 9.8, 10.8);
        if (s5) { cvGL.style.opacity = String(Dr.ease(lt / XF) * (1 - out)); s5.update(Math.min(lt, END - T[4])); top.h.use(); s5.labels(lt); }
        else { cvGL.style.opacity = '0'; top.endPlan(Dr.ease(lt / XF)); }
        if (out > 0) top.endPlan(out);
        top.caption(Math.min(t, END)); top.pips(Math.min(t, END));
      } else cvGL.style.opacity = '0';
      if (t >= END + 0.2) me.close();
    }
    // ---------------------------------------------------------------- the end (Skip, Enter, Esc or the last frame): the page goes on
    me.onDone = function (cb) { me.cb = cb; };
    me.close = function () { if (me.closed) return; me.closed = true; cancelAnimationFrame(raf);
      if (!me.structure) me.skippedEarly = true;
      if (worker) { try { worker.postMessage({ type: 'stop' }); } catch (e) {} setTimeout(function () { try { worker.terminate(); } catch (e) {} }, 700); }
      removeEventListener('resize', onResize); document.removeEventListener('keydown', onKey, true);
      var cb = me.cb; me.cb = null; if (cb) try { cb(true); } catch (e) { console.warn(e); }
      root.classList.add('ssi-out'); de.classList.remove('ssi-on');
      setTimeout(function () { if (s5) s5.dispose(); s5 = null; if (root.parentNode) root.parentNode.removeChild(root); }, 650);
      if (cur === me) cur = null; };
    // nothing to show after 20 s (the snapshot never came): leave the page alone
    setTimeout(function () { if (!started) me.close(); }, 20000);
  }

  window.SSIntro = {
    active: function () { return !!(cur && !cur.closed); },
    // the page has its snapshot (loadSnap): the first one starts the film
    onSnap: function (snap, name) { if (cur && !cur.closed && !cur.hasSnap) try { cur.snap(snap, name); } catch (e) { console.warn('opening film', e); cur.close(); } },
    // the page has built its structure (solve, on opening): true = the film will hand over to `go` (go(true): skip the replay of the tensor field)
    onStructure: function (go) { if (!cur || cur.closed || cur.replay) return false;
      try { cur.structureReady(F, SITE, P, typeof DKP !== 'undefined' ? DKP : {}); } catch (e) { console.warn('opening film', e); cur.close(); return false; }
      cur.onDone(go); return true; },
    replay: function () { if ((cur && !cur.closed) || typeof SNAP === 'undefined' || !SNAP || typeof F === 'undefined' || !F) return;
      var sel = document.getElementById('srcSel'), nm = sel && sel.selectedOptions && sel.selectedOptions[0] ? sel.selectedOptions[0].textContent.replace(/^.*·\s*/, '') : '';
      cur = new Film({ replay: true, name: nm }); cur.snap(SNAP, nm); try { cur.structureReady(F, SITE, P, typeof DKP !== 'undefined' ? DKP : {}); } catch (e) { cur.close(); } }
  };
  if (!off) cur = new Film({});
})();
