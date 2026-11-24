/* Loop City step 1 · the opening story (24 Nov 2026; second version, on the real base map).

   While the page downloads its map and prepares its growth model (some 16 s on a desk, a minute on a slow phone),
   a cover tells where the picture the page opens on comes from, on the page's own dark map with the loop taken out
   of it (img/intro/, made by tools/build-intro.py), in five scenes:
     1 London today, inside its Green Belt
     2 close in on the middle of London: six radial railways out of it, each with its line's official name, its London
       station and the line's stations on the way out (the main interchanges named)
     3 back out: the six primary stations where the radials meet the loop, and the high-speed loop that joins them
     4 the 412 km orbital through all 17 stations, each placed by its nearest National Rail station
     5 the stations, where the mould is released: the map turns into the page's own, lines and all
   The fifth scene is the page's own opening picture, so the cover ends by sliding its frame onto the map's sheet
   and clearing. Lines, stations and labels are the page's own and OpenStreetMap's (intro-data.js).

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
  /* the dark base map the page itself will draw: half size on a touch device, as the page decides (LITE in index.html) */
  var lite = false;
  try {
    lite = /[#&]lite\b/.test(hash) ? true : /[#&]nolite\b/.test(hash) ? false
      : ((navigator.maxTouchPoints || 0) > 0 && matchMedia('(pointer: coarse)').matches);
  } catch (e) { lite = false; }
  var DARK = lite ? 'img/half/base_dark.webp' : 'img/base_dark.webp';
  /* the Green Belt as the page itself draws it (its own layer, the file the page loads), to light up in scene 1 */
  var BELT = lite ? 'img/half/greenbelt.webp' : 'img/greenbelt.webp';
  /* the story's map: a smaller copy on a phone, whose frame is a third as wide (the head of index.html asks for the same
     file first, ahead of the page's own large images) */
  var BASE = root.classList.contains('lcphone') ? 'img/intro/base-s.webp' : 'img/intro/base.webp';

  /* when each scene begins, in seconds */
  var T = [0, 4, 10, 15.5, 21.5], END = 23.5;
  var TEXT = [
    ['London today', 'The built-up city, ringed by its Green Belt.',
     '今天的伦敦', '建成区，被绿带环绕。'],
    ['Six radial railways', 'Three follow main lines that run today and one HS2, now being built. Two are new, at P3 and P5: they fill the north-east and the south.',
     '六条放射铁路', '三条沿现有干线，一条沿在建的 HS2；P3、P5 两条新建，补齐东北和南面两个方向。'],
    ['Six primary stations · the high-speed loop, {hs} km', 'Four stand where those main lines meet the loop, two at the ends of the new lines. A loop in tunnel joins the six.',
     '六个一级站 · 高速环线 {hs} km', '四个设在这些干线与环线的交点，两个在新线的尽头。一条隧道里的高速环线把六站连成一圈。'],
    ['The orbital · {orb} km', 'Above ground, at medium speed, through all 17 stations: 6 primary, 8 secondary and 3 for London’s airports, Stansted, Gatwick and Luton.',
     '环线 · {orb} km', '地面中速，串起全部 17 个车站：6 个一级站、8 个二级站，和伦敦三座机场（Stansted、Gatwick、Luton）的 3 个机场站。'],
    ['Growth starts at the stations', 'The slime mould is released at these 17 stations and grows with the city, 2025 to 2100.',
     '从车站开始生长', '黏菌从这 17 个车站出发，和城市一起生长，2025 至 2100 年。']
  ];
  /* the lines the radials follow and their stations carry their official names (reference/radials.json): the
     line's own name in both languages, with a Chinese gloss under it in Chinese */
  var DIR = [['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'], ['北', '东北', '东', '东南', '南', '西南', '西', '西北']];
  /* "8.3 km SW of Braintree" / "Braintree 西南 8.3 km": where the Loop City station is, from the nearest National Rail station */
  function where(n, zh) {
    if (n.km < 0.3) return zh ? n.n + ' 站旁' : 'at ' + n.n;
    return zh ? n.n + ' ' + DIR[1][n.c] + ' ' + n.km.toFixed(1) + ' km' : n.km.toFixed(1) + ' km ' + DIR[0][n.c] + ' of ' + n.n;
  }

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
  function line(p, cls, width, dash, colour) {
    var s = document.createElementNS(NS, 'svg'), b = p.box;
    s.setAttribute('viewBox', b.join(' ')); s.setAttribute('class', cls); s.setAttribute('aria-hidden', 'true');
    s.style.left = pct(b[0], D.W); s.style.top = pct(b[1], D.H); s.style.width = pct(b[2], D.W); s.style.height = pct(b[3], D.H);
    var q = document.createElementNS(NS, 'path');
    q.setAttribute('d', p.d); q.setAttribute('fill', 'none'); q.setAttribute('stroke', colour || '#fff'); q.setAttribute('stroke-width', width);
    q.setAttribute('stroke-linecap', 'round'); q.setAttribute('stroke-linejoin', 'round'); q.setAttribute('vector-effect', 'non-scaling-stroke');
    if (dash) q.setAttribute('stroke-dasharray', dash);
    s.appendChild(q);
    return s;
  }
  function delay(e, d, o) { e.style.setProperty('--d', d.toFixed(2) + 's'); if (o !== undefined) e.style.setProperty('--o', o.toFixed(2) + 's'); return e; }
  /* a point of the frame, where it is on the stage: as it is, or in the close view of scene 2 */
  var Z = D.zoom;
  function at(x, y, close) {
    if (close) { x = (x - Z.x) * Z.k + D.W / 2; y = (y - Z.y) * Z.k + D.H / 2; }
    return [x, y];
  }
  function place(e, p) { e.style.left = pct(p[0], D.W); e.style.top = pct(p[1], D.H); return e; }
  /* a label: which side of its point it sits on (r, l, u, d) can be turned round by fit() if it would leave the frame */
  function label(p, side, cls) { var e = place(mk('div', 'lci-lab lci-s' + side + (cls ? ' ' + cls : '')), p); e.dataset.side = side; return e; }
  var NEW = '#E3B47B';   // the two new radials, in the warm tone the page uses for growth

  var live = null;   // the cover on the screen, if any
  var covering = false;   // the cover hides the page entirely (not handing over): the page need not draw its map

  function open(story, again) {
    if (live) return;
    var zh = isZh(), opened = performance.now(), t0 = opened, done = false, storyOver = !story, readyAt = 0, timer = 0, swapped = false, started = false;
    /* the cover waits, black, until its map has come: the story is told on the map, never on an empty frame */
    var box = mk('div', 'lci-wait'); box.id = 'lcIntro';
    box.setAttribute('role', 'dialog'); box.setAttribute('aria-modal', 'true');

    /* top: where we are, and the way out */
    var top = mk('div', 'lci-top'), tag = mk('div', 'lci-tag'), skip = mk('button', 'lci-skip'); skip.type = 'button';
    top.appendChild(tag); top.appendChild(skip);

    /* the frame: one 1000 x 820 picture of the map's extent; inside it a camera that moves in for scene 2 */
    var map = mk('div', 'lci-map'), stage = mk('div', 'lci-stage'), cam = mk('div', 'lci-cam');
    cam.style.setProperty('--zx', ((0.5 - Z.x / D.W * Z.k) * 100).toFixed(3) + '%');
    cam.style.setProperty('--zy', ((0.5 - Z.y / D.H * Z.k) * 100).toFixed(3) + '%');
    cam.style.setProperty('--zk', String(Z.k));
    delay(cam, T[1]); cam.style.setProperty('--o', T[2].toFixed(2) + 's');

    var gBase = delay(mk('div', 'lci-g lci-base lci-dimA'), T[1] + 1.4);
    var img = mk('img', 'lci-img'); img.alt = ''; img.decoding = 'async'; img.setAttribute('fetchpriority', 'high'); img.src = BASE;
    /* the middle of London at full size is wanted only for scene 2: asked for once the map has come */
    var ctr = mk('img', 'lci-img'); ctr.alt = ''; ctr.decoding = 'async';
    place(ctr, [D.centre[0], D.centre[1]]); ctr.style.width = pct(D.centre[2], D.W); ctr.style.height = pct(D.centre[3], D.H);
    gBase.appendChild(delay(img, 0.1)); gBase.appendChild(delay(ctr, 0.1));
    /* the Green Belt: the page's own layer used as a mask over a flat green, so its edge is the map's edge */
    var gb = mk('div', 'lci-gb'), belt = new Image(), beltReady = false;
    belt.onload = function () { beltReady = true; var u = 'url("' + BELT + '")'; gb.style.webkitMaskImage = u; gb.style.maskImage = u; };
    belt.onerror = function () { beltReady = true; gb.style.display = 'none'; };
    belt.src = BELT;
    gBase.appendChild(delay(gb, 0.7, T[1] + 0.2));
    /* the page's own dark map, lines and all, for the last scene (the same file the page loads, so it comes once) */
    var dark = mk('img', 'lci-img lci-dark'); dark.alt = ''; dark.decoding = 'async';
    var darkReady = false; dark.onload = function () { darkReady = true; }; dark.src = DARK;

    var gLines = mk('div', 'lci-g lci-lines');
    /* the radials twice: drawn fine for the close view of scene 2 (a line inside the camera is enlarged with it), and
       at their own width once the camera is back out; the one hands over to the other as the camera arrives */
    var gRadZ = mk('div', 'lci-g lci-zr'), gRad = delay(mk('div', 'lci-g lci-dimB'), T[2] + 2.0);
    D.radials.forEach(function (r, i) {
      var w = r.proposed ? 1.8 : 1.6, dash = r.proposed ? '1.5 5' : '', c = r.proposed ? NEW : '';
      var z = line(r, 'lci-grow', w * 1.6 / Z.k, dash ? (1.5 * 1.6 / Z.k).toFixed(2) + ' ' + (5 * 1.6 / Z.k).toFixed(2) : '', c);
      z.style.transformOrigin = pct(r.a[0] - r.box[0], r.box[2]) + ' ' + pct(r.a[1] - r.box[1], r.box[3]);   // grown out of its London end
      gRadZ.appendChild(delay(z, T[1] + 1.0 + i * 0.35, T[2] + 1.2));
      gRad.appendChild(delay(line(r, 'lci-seg', w, dash, c), T[2] + 1.0));
    });
    var gHigh = delay(mk('div', 'lci-g lci-dimB'), T[3] + 0.1);
    D.highSpeed.forEach(function (p, i) { gHigh.appendChild(delay(line(p, 'lci-seg', 1.5, '7 5'), T[2] + 2.0 + i * 0.4)); });
    var gOrb = mk('div', 'lci-g');
    D.orbital.forEach(function (p, i) { gOrb.appendChild(delay(line(p, 'lci-seg', 2.4, ''), T[3] + 0.5 + i * 0.22)); });
    [gRadZ, gRad, gHigh, gOrb].forEach(function (g) { gLines.appendChild(g); });

    var gDot = mk('div', 'lci-g');
    var nP = 0;
    D.stations.forEach(function (n, i) {
      var d = place(mk('div', 'lci-dot ' + (n.t === 'P' ? 'lci-p' : 'lci-s')), [n.x, n.y]);
      d.appendChild(mk('b')); d.appendChild(mk('i'));
      /* a primary station comes when the camera is back out; the others as the orbital reaches them */
      n._at = n.t === 'P' ? T[2] + 1.5 + (nP++) * 0.12 : T[3] + 0.5 + n.k * 0.22;
      gDot.appendChild(delay(d, n._at, T[4] + (i % 5) * 0.28));
    });
    [gBase, dark, gLines, gDot].forEach(function (g) { cam.appendChild(g); });

    /* the labels, over the camera and not moved by it: the words stay their size in the close view */
    var gLab = mk('div', 'lci-g lci-labs'), labs = [];
    D.radials.forEach(function (r, i) {
      var t = T[1] + 1.2 + i * 0.35;
      var end = place(mk('div', 'lci-end'), at(r.a[0], r.a[1], true)); end.appendChild(mk('b'));
      gLab.appendChild(delay(end, t, T[2] - 0.4));
      /* the line's other stations, where the close view shows them: they light up one after another outwards from
         London once the line has grown (a wave down the line), and go out the other way, outermost first, before the
         camera pulls back */
      var vis = r.stops.filter(function (st) { var q = at(st.x, st.y, true); return q[0] >= 4 && q[1] >= 4 && q[0] <= D.W - 4 && q[1] <= D.H - 4; });
      var grown = T[1] + 1.0 + i * 0.35 + 1.1;
      vis.forEach(function (st, k) {
        st._t = grown + k * 0.06; st._o = T[2] - 0.45 - (vis.length - 1 - k) * 0.03;
        var d = place(mk('div', 'lci-stop' + (st.key ? ' lci-x' : '') + (r.proposed ? ' lci-new' : '')), at(st.x, st.y, true));
        if (st.key) d.appendChild(mk('b'));
        gLab.appendChild(delay(d, st._t, st._o));
      });
      var dx = r.dir[0], dy = r.dir[1];
      var side = Math.abs(dx) > 0.8 ? 'd' : Math.abs(dy) > 0.8 ? 'r' : (dx < 0 ? 'l' : 'r');
      var e = label(at(r.lab[0], r.lab[1], true), side, 'lci-lr' + (r.proposed ? ' lci-new' : '')); e.dataset.group = 'r';
      var nm = e.appendChild(mk('b')), gl = e.appendChild(mk('i')), lo = e.appendChild(mk('span')), tm = r.terminus ? e.appendChild(mk('em')) : null;
      gLab.appendChild(delay(e, t + 0.5, T[2] - 0.4));
      labs.push([e, function (z) {
        var L = r.line, isNew = L.status === 'proposed', building = L.status === 'building';
        nm.textContent = isNew ? (z ? '新线' : 'New line') : L.en;
        gl.textContent = isNew ? '' : z ? L.zh + (building ? '（在建）' : '') : (building ? 'under construction' : '');
        lo.textContent = '';
        if (tm) tm.textContent = z ? L.abbr + ' 伦敦终点 ' + r.terminus : L.abbr + ' London terminus: ' + r.terminus;
      }]);
    });
    /* every station in the close view, named: the London end at its own dot, then the main interchanges, then the
       rest where there is room (a name that would cover another is left out) */
    D.radials.forEach(function (r, i) {
      var t = T[1] + 1.4 + i * 0.35;
      var e0 = label(at(r.a[0], r.a[1], true), 'r', 'lci-lt'); e0.dataset.group = 'r'; e0.textContent = r.london;
      gLab.appendChild(delay(e0, t + 0.15, T[2] - 0.4)); labs.push([e0, function () {}]);
    });
    [true, false].forEach(function (keyPass) {
      D.radials.forEach(function (r, i) {
        r.stops.forEach(function (st) {
          if (!!st.key !== keyPass) return;
          var q = at(st.x, st.y, true);
          if (q[0] < 4 || q[1] < 4 || q[0] > D.W - 4 || q[1] > D.H - 4) return;
          var e = label(q, 'r', keyPass ? 'lci-lk' : 'lci-lo'); e.dataset.group = 'r'; e.textContent = st.n;
          if (!keyPass) e.dataset.opt = '1';
          gLab.appendChild(delay(e, (st._t || T[1] + 1.9 + i * 0.35) + 0.08, st._o || T[2] - 0.4)); labs.push([e, function () {}]);
        });
      });
    });
    var cx = 0, cy = 0; D.stations.forEach(function (n) { cx += n.x / D.stations.length; cy += n.y / D.stations.length; });
    /* the named stations first, so the secondary stations' numbers make room for them rather than the other way round */
    D.stations.filter(function (n) { return n.t !== 'S'; }).concat(D.stations.filter(function (n) { return n.t === 'S'; })).forEach(function (n) {
      var side = n.x < cx - 60 ? 'l' : n.x > cx + 60 ? 'r' : (n.y < cy ? 'u' : 'd');
      /* on a phone a named station's label is two short lines, above or below it where the ring runs across */
      var small = n.t === 'S' ? side : n.y < cy - 150 ? 'u' : n.y > cy + 150 ? 'd' : side;
      var e = label([n.x, n.y], side, 'lci-ls lci-t' + n.t);
      e.dataset.small = small; e.dataset.group = n.t === 'P' ? 'P' : 'SA';
      e.appendChild(mk('b')); e.appendChild(mk('span'));
      var from = n.t === 'P' ? n._at + 0.3 : n._at + 0.25, to = n.t === 'P' ? T[3] - 0.3 : T[4] - 0.2;
      gLab.appendChild(delay(e, from, to));
      labs.push([e, function (z) { e.firstChild.textContent = n.id; e.lastChild.textContent = where(n.near, z); }]);
    });
    [cam, gLab].forEach(function (g) { stage.appendChild(g); });
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
      labs.forEach(function (l) { l[1](zh); });
      status(); turn();
    }
    function ready() { try { return !!(window.__LC_READY__ || (window.LoopCityEngine && window.LoopCityEngine.ready)); } catch (e) { return false; } }
    function mapShown() { var l = document.getElementById('loading'); return !l || l.style.display === 'none'; }
    function status() {
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
      box.classList.toggle('lci-small', w < 560);
      turn();
    }
    /* each label on the side of its point it asks for, unless it would leave the frame or cover a label shown with it:
       then the other side, then above or below (a label above or below may be slid sideways to stay in the frame) */
    var OPP = { l: 'r', r: 'l', u: 'd', d: 'u' };
    function turn() {
      var s = stage.getBoundingClientRect(); if (!(s.width > 0)) return;
      var small = box.classList.contains('lci-small'), placed = {};
      /* how much a box covers the labels already placed with it, and whether it leaves the frame */
      function cost(b, list) {
        var c = (b.left < s.left + 1 || b.right > s.right - 1 || b.top < s.top + 1 || b.bottom > s.bottom - 1) ? 1e9 : 0;
        list.forEach(function (r) {
          var w = Math.min(b.right, r.right + 3) - Math.max(b.left, r.left - 3), h = Math.min(b.bottom, r.bottom + 2) - Math.max(b.top, r.top - 2);
          if (w > 0 && h > 0) c += w * h;
        });
        return c;
      }
      labs.forEach(function (l) {
        var e = l[0], g = e.dataset.group, want = (small && e.dataset.small) || e.dataset.side, list = placed[g] || (placed[g] = []);
        var tries = [want, OPP[want]].concat(['u', 'd', 'r', 'l'].filter(function (c) { return c !== want && c !== OPP[want]; }));
        function put(c) {
          e.classList.remove('lci-sl', 'lci-sr', 'lci-su', 'lci-sd'); e.classList.add('lci-s' + c); e.style.removeProperty('--sx');
          var b = e.getBoundingClientRect();
          if ((c === 'u' || c === 'd') && b.width > 0) {
            var dx = b.left < s.left + 2 ? s.left + 2 - b.left : b.right > s.right - 2 ? s.right - 2 - b.right : 0;
            if (dx) { e.style.setProperty('--sx', dx.toFixed(1) + 'px'); b = e.getBoundingClientRect(); }
          }
          return b;
        }
        var best = null, bestCost = Infinity, b;
        for (var k = 0; k < tries.length; k++) {
          b = put(tries[k]); if (!(b.width > 0)) return;
          var c = cost(b, list);
          if (c < bestCost) { best = tries[k]; bestCost = c; }
          if (c === 0) break;
        }
        b = put(best);
        if ((e.dataset.opt || (small && e.classList.contains('lci-lk'))) && bestCost > 0) { e.style.visibility = 'hidden'; return; }
        e.style.visibility = '';
        list.push(b);
      });
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
      /* the page has drawn its map only now and then under the cover (frame() in index.html, LCIntro.covering):
         ask it for a fresh frame, and hand over once that frame has had time to be drawn */
      covering = false;
      try { if (typeof S !== 'undefined' && S) S._prepAt = 0; } catch (e) { /* no page underneath */ }   // eslint-disable-line no-undef
      var handed = false;
      function hand() { if (handed) return; handed = true; handOver(); }
      requestAnimationFrame(function () { requestAnimationFrame(hand); });
      setTimeout(hand, 400);                    // a page that is not being shown gets no frames
    }
    function handOver() {
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
    /* the story starts only once its map is on the screen: the base map decoded and the Green Belt's layer in. A story
       still waiting after WAIT seconds is not told: the still last picture is shown instead, as on a later visit */
    var WAIT = 12;
    function begin(asStory) {
      if (started || done) return; started = true;
      if (!asStory) { story = false; storyOver = true; }
      box.classList.remove('lci-wait'); box.classList.add(story ? 'lci-story' : 'lci-still');
      if (!ctr.src) ctr.src = 'img/intro/centre.webp';
      t0 = performance.now(); turn();
    }
    function tick() {
      if (!started) { status(); return; }
      var now = performance.now(), el = (now - t0) / 1000;
      if (isZh() !== zh) words(); else status();
      /* the last scene: the page's own map, with its lines, takes over from the drawing once it has come */
      if (!swapped && darkReady && (!story || el >= T[4])) { swapped = true; box.classList.add('lci-swap'); }
      if (!storyOver && el >= END) storyOver = true;
      if (again) { if (storyOver && el >= END + 2.5) close(); return; }
      if (!story) { if (mapShown() && el >= 1.4) close(); return; }           // a later visit: only until the map is there
      if (ready()) { if (!readyAt) readyAt = now; if (storyOver && now - readyAt >= 1200 && el >= END + 1.2) close(); }
    }

    skip.onclick = close;
    document.body.appendChild(box); live = box; covering = true;
    fit(); words();
    addEventListener('resize', fit);
    document.addEventListener('keydown', key, true);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { if (!done) turn(); });
    timer = setInterval(tick, 250);
    var mapIn = false;
    (img.decode ? img.decode() : new Promise(function (ok, no) { img.onload = ok; img.onerror = no; }))
      .then(function () { mapIn = true; }, function () { mapIn = true; });
    var waited = setInterval(function () {
      var w = (performance.now() - opened) / 1000;
      if (started || done) { clearInterval(waited); return; }
      if (mapIn && (beltReady || w > 4)) { clearInterval(waited); begin(true); }
      else if (w > (story ? WAIT : 2)) { clearInterval(waited); begin(false); }
    }, 100);
  }

  window.LCIntro = {
    /* the whole story again, over the page as it stands */
    replay: function () { if (D && document.body && !calm) open(true, true); else if (D && document.body) open(false, true); },
    get open() { return !!live; },
    /* read by the page's frame(): while true the map is drawn only now and then */
    get covering() { return covering && !!live; }
  };
  if (off) return;
  var force = /[#&]intro\b/.test(hash);
  open((force || !seen) && !calm, false);
})();
