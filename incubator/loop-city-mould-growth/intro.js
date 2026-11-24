/* Loop City step 1 · the opening story (24 Nov 2026).

   While the page downloads its map and prepares its growth model (some 16 s on a desk, a minute on a slow phone),
   a cover tells where the picture the page opens on comes from, in five scenes of about four seconds each:
     1 London today, inside its Green Belt        2 six radial railways out of the centre (two of them new)
     3 six primary stations and the high-speed loop that joins them
     4 the 412 km orbital through all 17 stations 5 the stations, where the mould is released
   The fifth scene is the page's own opening picture, so the cover ends by sliding its frame onto the map's sheet
   and clearing. The lines are the page's own (intro-data.js, made by tools/build-intro.py).

   - First visit: the whole story; it waits on scene 5 until the model is ready, "Skip" at any time (Enter / Esc too).
   - Later visits: the still fifth scene until the map is on the screen, then the page as before.
   - "Watch the introduction" in the left panel plays it again. `#intro` in the address plays it, `#nointro` never does.
   - Not shown with `#noskin`, nor in the frame the workspace keeps out of sight (`?embed=1`).
   Nothing in the model is touched: this is a cover over the page. See intro.css for why it is built of small boxes. */
(function () {
  'use strict';
  var root = document.documentElement, D = window.LC_INTRO_DATA;
  var hash = location.hash || '';
  var off = !root.classList.contains('lcskin') || /[?&]embed=1\b/.test(location.search || '') || /[#&]nointro\b/.test(hash) || !D || !document.body;
  var KEY = 'loopCity1.introSeen';
  var seen = false; try { seen = localStorage.getItem(KEY) === '1'; } catch (e) { /* private mode: the story each time */ }
  var calm = false; try { calm = matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { /* older browsers */ }

  /* when each scene begins, in seconds */
  var T = [0, 4, 9, 14, 20], END = 21.5;
  var TEXT = [
    ['London today', 'The built-up city, ringed by its Green Belt.',
     '今天的伦敦', '建成区，被绿带环绕。'],
    ['Six radial railways', 'Out from the centre. Four follow lines that exist today; two are new.',
     '六条放射铁路', '从市中心向外。四条沿现有线路，两条新建。'],
    ['The high-speed loop · {hs} km', 'Six primary stations stand where the radials end. A loop in tunnel joins them.',
     '高速环线 · {hs} km', '放射线的尽头是六个一级站。一条隧道里的环线把它们连成一圈。'],
    ['The orbital · {orb} km', 'Above ground, at medium speed, through all 17 stations: 6 primary, 8 secondary, 3 at airports.',
     '环线 · {orb} km', '地面中速，串起全部 17 个车站：6 个一级站、8 个二级站、3 个机场站。'],
    ['Growth starts at the stations', 'The slime mould is released at these 17 stations and grows with the city, 2025 to 2100.',
     '从车站开始生长', '黏菌从这 17 个车站出发，和城市一起生长，2025 至 2100 年。']
  ];
  /* the page's language: its own once it has chosen (LANG), and before that by the page's own rule
     (`#lang=` in the address, else the choice it stored, else English), so the words do not change mid-story */
  function isZh() {
    try { if (document.readyState !== 'loading' && typeof LANG === 'string') return LANG === 'zh'; } catch (e) { /* not declared yet */ }   // eslint-disable-line no-undef
    var h = /lang=(en|zh)/.exec(location.hash || ''); if (h) return h[1] === 'zh';
    try { return localStorage.getItem('woolAppsLang') === 'zh'; } catch (e) { return false; }
  }
  function fill(s) { return s.replace('{hs}', D.km.highSpeed).replace('{orb}', D.km.orbital); }
  function mk(tag, cls) { var e = document.createElement(tag); if (cls) e.className = cls; e.setAttribute('translate', 'no'); return e; }
  var NS = 'http://www.w3.org/2000/svg';
  function pct(v, of) { return (v / of * 100).toFixed(3) + '%'; }
  /* one piece of line in its own small <svg>, placed by its box */
  function line(p, cls, width, dash) {
    var s = document.createElementNS(NS, 'svg'), b = p.box;
    s.setAttribute('viewBox', b.join(' ')); s.setAttribute('class', cls); s.setAttribute('aria-hidden', 'true');
    s.style.left = pct(b[0], D.W); s.style.top = pct(b[1], D.H); s.style.width = pct(b[2], D.W); s.style.height = pct(b[3], D.H);
    var q = document.createElementNS(NS, 'path');
    q.setAttribute('d', p.d); q.setAttribute('fill', 'none'); q.setAttribute('stroke', '#fff'); q.setAttribute('stroke-width', width);
    q.setAttribute('stroke-linecap', 'round'); q.setAttribute('stroke-linejoin', 'round'); q.setAttribute('vector-effect', 'non-scaling-stroke');
    if (dash) q.setAttribute('stroke-dasharray', dash);
    s.appendChild(q);
    return s;
  }
  function delay(e, d, o) { e.style.setProperty('--d', d.toFixed(2) + 's'); if (o !== undefined) e.style.setProperty('--o', o.toFixed(2) + 's'); return e; }

  var live = null;   // the cover on the screen, if any

  function open(story, again) {
    if (live) return;
    var zh = isZh(), t0 = performance.now(), done = false, storyOver = !story, readyAt = 0, timer = 0;
    var box = mk('div', story ? 'lci-story' : 'lci-still'); box.id = 'lcIntro';
    box.setAttribute('role', 'dialog'); box.setAttribute('aria-modal', 'true');

    /* top: where we are, and the way out */
    var top = mk('div', 'lci-top'), tag = mk('div', 'lci-tag'), skip = mk('button', 'lci-skip'); skip.type = 'button';
    top.appendChild(tag); top.appendChild(skip);

    /* the frame: one 1000 x 820 picture of the map's extent */
    var map = mk('div', 'lci-map'), stage = mk('div', 'lci-stage');
    var gBase = delay(mk('div', 'lci-g lci-dimA'), T[1]);
    var base = document.createElementNS(NS, 'svg');
    base.setAttribute('viewBox', '0 0 ' + D.W + ' ' + D.H); base.setAttribute('class', 'lci-base'); base.setAttribute('aria-hidden', 'true');
    base.innerHTML = '<path d="' + D.greenbelt + '" fill="#9EBE7A" fill-opacity=".3" fill-rule="evenodd"/><path d="' + D.urban + '" fill="#fff" fill-opacity=".26"/>';
    gBase.appendChild(delay(base, 0.15));

    var gRad = delay(mk('div', 'lci-g lci-dimB'), T[2]);
    D.radials.forEach(function (r, i) {
      var s = line(r, 'lci-grow', 1.6, r.proposed ? '1.5 5' : '');
      s.style.transformOrigin = pct(r.a[0] - r.box[0], r.box[2]) + ' ' + pct(r.a[1] - r.box[1], r.box[3]);   // grown out of its London end
      gRad.appendChild(delay(s, T[1] + 0.3 + i * 0.32));
    });

    var gHigh = delay(mk('div', 'lci-g lci-dimB'), T[3]);
    D.highSpeed.forEach(function (p, i) { gHigh.appendChild(delay(line(p, 'lci-seg', 1.5, '7 5'), T[2] + 1.3 + i * 0.42)); });

    var gOrb = mk('div', 'lci-g');
    D.orbital.forEach(function (p, i) { gOrb.appendChild(delay(line(p, 'lci-seg', 2.4, ''), T[3] + 0.5 + i * 0.22)); });

    var gDot = mk('div', 'lci-g');
    var nP = 0;
    D.stations.forEach(function (n, i) {
      var d = mk('div', 'lci-dot ' + (n.t === 'P' ? 'lci-p' : 'lci-s'));
      d.style.left = pct(n.x, D.W); d.style.top = pct(n.y, D.H);
      d.appendChild(mk('b')); d.appendChild(mk('i'));
      /* a primary station comes with the high-speed loop; the others as the orbital reaches them */
      var at = n.t === 'P' ? T[2] + 0.35 + (nP++) * 0.14 : T[3] + 0.5 + n.k * 0.22;
      gDot.appendChild(delay(d, at, T[4] + (i % 5) * 0.28));
    });
    [gBase, gRad, gHigh, gOrb, gDot].forEach(function (g) { stage.appendChild(g); });
    map.appendChild(stage);

    /* the five captions, and the five marks under them */
    var caps = mk('div', 'lci-caps'), foot = mk('div', 'lci-foot'), pips = mk('div', 'lci-pips'), prog = mk('span');
    var capEls = TEXT.map(function (t, i) {
      var c = mk('div', 'lci-cap' + (i === TEXT.length - 1 ? ' lci-last' : '')), h = mk('h2'), p = mk('p');
      c.appendChild(h); c.appendChild(p); caps.appendChild(delay(c, T[i] + 0.3, i < 4 ? T[i + 1] - 0.15 : 0));
      pips.appendChild(delay(mk('i'), T[i] + 0.3));
      return [h, p];
    });
    foot.appendChild(pips); foot.appendChild(prog);
    box.appendChild(top); box.appendChild(map); box.appendChild(caps); box.appendChild(foot);

    function words() {
      zh = isZh();
      tag.textContent = zh ? 'Loop City · 第 1 步 · 环线从哪里来' : 'Loop City · step 1 · where the loop comes from';
      box.setAttribute('aria-label', tag.textContent);
      capEls.forEach(function (c, i) { c[0].textContent = fill(TEXT[i][zh ? 2 : 0]); c[1].textContent = fill(TEXT[i][zh ? 3 : 1]); });
      label();
    }
    function ready() { try { return !!(window.__LC_READY__ || (window.LoopCityEngine && window.LoopCityEngine.ready)); } catch (e) { return false; } }
    function mapShown() { var l = document.getElementById('loading'); return !l || l.style.display === 'none'; }
    function label() {
      var r = ready();
      skip.textContent = again ? (zh ? '关闭' : 'Close') : (r ? (zh ? '进入地图' : 'Open the map') : (zh ? '跳过' : 'Skip'));
      skip.classList.toggle('lci-go', r && !again);
      var prep = document.getElementById('lcPrep'), t = '';
      if (again) t = '';
      else if (r) t = zh ? '地图已准备好' : 'The map is ready';
      else if (prep && prep.textContent) t = prep.textContent;
      else t = zh ? '正在载入地图…' : 'Loading the map…';
      if (prog.textContent !== t) prog.textContent = t;
    }

    /* the frame is fitted to the room it has, by hand: one 1000 x 820 rectangle, never stretched */
    function fit() {
      var r = map.getBoundingClientRect(); if (!(r.width > 0 && r.height > 0)) return;
      var w = Math.min(r.width, r.height * D.W / D.H), h = w * D.H / D.W;
      stage.style.width = w + 'px'; stage.style.height = h + 'px';
      stage.style.left = (r.width - w) / 2 + 'px'; stage.style.top = (r.height - h) / 2 + 'px';
    }

    /* where the map's sheet is on the screen now (the page's own view), or null before it is fitted */
    function sheet() {
      try {
        var wrap = document.getElementById('canvasWrap'); if (!wrap || !mapShown()) return null;
        if (typeof S === 'undefined' || !S.mapW || !S.view || !(S.view.k > 0)) return null;   // eslint-disable-line no-undef
        var dpr = Math.min(2, window.devicePixelRatio || 1), r = wrap.getBoundingClientRect();
        return { x: r.left + S.view.x / dpr, y: r.top + S.view.y / dpr, w: S.mapW * S.view.k / dpr, h: S.mapH * S.view.k / dpr };   // eslint-disable-line no-undef
      } catch (e) { return null; }
    }

    function close() {
      if (done) return; done = true;
      clearInterval(timer); removeEventListener('resize', fit); document.removeEventListener('keydown', key, true);
      if (!again) { try { localStorage.setItem(KEY, '1'); } catch (e) { /* private mode */ } }
      var to = calm ? null : sheet(), wait = 0;
      if (to) {
        var r = stage.getBoundingClientRect(), k = to.w / r.width;
        if (k > 0.2 && k < 5) {
          box.classList.add('lci-hand');
          stage.style.transform = 'translate(' + (to.x - r.left) + 'px,' + (to.y - r.top) + 'px) scale(' + k + ')';
          wait = 900;
        }
      }
      setTimeout(function () {
        box.classList.add('lci-out');
        setTimeout(function () { box.remove(); if (live === box) live = null; }, calm ? 0 : 650);
      }, wait);
    }
    function key(e) {
      if (done) return;
      if (e.key === 'Enter' || e.key === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); close(); }
      else if (e.key === ' ' || e.key === 'Spacebar') { e.preventDefault(); e.stopImmediatePropagation(); }   // not the page's free mould, under a cover
    }
    function tick() {
      var now = performance.now(), el = (now - t0) / 1000;
      if (isZh() !== zh) words(); else label();
      if (!storyOver && el >= END) storyOver = true;
      if (again) { if (storyOver && el >= END + 2.5) close(); return; }
      if (!story) { if (mapShown() && el >= 1.4) close(); return; }           // a later visit: only until the map is there
      if (ready()) { if (!readyAt) readyAt = now; if (storyOver && now - readyAt >= 1200 && el >= END + 1.2) close(); }
    }

    skip.onclick = close;
    document.body.appendChild(box); live = box;
    words(); fit();
    addEventListener('resize', fit);
    document.addEventListener('keydown', key, true);
    timer = setInterval(tick, 250);
  }

  window.LCIntro = {
    /* the whole story again, over the page as it stands */
    replay: function () { if (D && document.body && !calm) open(true, true); else if (D && document.body) open(false, true); },
    get open() { return !!live; }
  };
  if (off) return;
  var force = /[#&]intro\b/.test(hash);
  open((force || !seen) && !calm, false);
})();
