/* The London map · the opening film (27 Nov 2026).

   While the page downloads MapLibre, its basemap and its 3D city, a cover tells what this map is and what it is for,
   in the same layout as the other openings (Loop City step 1 above all): a top row with the tag and one button,
   the picture in the middle, a centred caption under it, chapter marks and a status at the foot.
     0 the cover: the map's own 3D city
     1 scope: the 70 km circle round Charing Cross, its 15,388 km², Greater London inside it
     2 the stack: eleven layers from seven open sources, in one circle
     3 the ground: ridge lines of the heights, the Chilterns, the North Downs, the Thames valley
     4 water: the drainage network in three classes, the flood-risk bands, the check at Kingston
     5 limits and links: Green Belt and AONB, rail, HS1 and HS2
     6 the role: every later app of the chain built on this map's data
   It ends on the map's own opening view: the circle of chapter 1 comes back and moves onto the map's 70 km circle,
   then the cover clears.

   Pictures: assets/intro/ (l: a computer, s: a phone), made from the map's own data by tools/intro/ (plates.py, then
   build.py, which also writes intro_data.js: where each picture sits in the 1000 x 1000 frame). Words: English here,
   shown in Chinese by the page's own language layer (ui_language.js, ui_chinese_dictionary.js).

   - Every visit, the whole film; it waits on chapter 6 until the map is ready, then hands over by itself.
     "Skip" at any time (Enter / Esc too), a white "Enter ›" once the map is ready.
   - "▶ Opening" in the panel plays it again. `#nointro` in the address never plays it; `#introat=18` starts it 18 s in
     (`#introat=18&introhold` stops it there: for checking one moment).
   - Not with `#noskin`, nor with `?embed=1`, nor inside the VR page (which frames this map).
   - "Reduce motion": the still last chapter, until the map is ready.
   Only opacity and transform are animated, with delays set once (intro.css): the browser's compositor keeps them
   moving while the page builds the map on the same thread. */
(function () {
  'use strict';
  var root = document.documentElement, D = window.LM_INTRO_DATA;
  var href = location.href;
  var inVR = false;
  try { inVR = window.parent !== window && /\/vr\//.test(window.parent.location.pathname); } catch (e) { inVR = false; }
  var off = !root.classList.contains('l2ui') || /[?&]embed=1\b/.test(location.search || '') || /[#&]nointro\b/.test(location.hash || '') ||
    inVR || !D || !document.body || /[#&?]noskin\b/.test(href);
  var calm = false; try { calm = matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { /* older browsers */ }
  var small = false; try { small = Math.min(innerWidth, innerHeight) < 600 || matchMedia('(pointer: coarse)').matches && Math.min(screen.width, screen.height) < 600; } catch (e) { small = false; }
  var DIR = 'assets/intro/' + (small ? 's' : 'l') + '/';
  /* the pictures carry this script's own ?v=, so a phone never shows new legends over cached old pictures */
  var IV = ((document.currentScript && /[?&]v=([^&]+)/.exec(document.currentScript.src)) || [])[1] || '';
  var CAT = '../../assets/catalogue/';

  /* when each chapter begins, in seconds; the cover is chapter 0 */
  var T = [0, 2.5, 7, 12, 16.5, 21.5, 26], END = 31;
  var TEXT = [
    ['London map · real data', 'Real geographic data within 70 km of Charing Cross: the ground the whole research chain stands on.'],
    ['Study area: a 70 km radius', 'Centred on Charing Cross, 15,388 km²; Greater London is about a tenth of it. Every layer inside the circle is real, open and aligned to one grid.'],
    ['Eleven layers, seven open data sources', 'OpenStreetMap, the Environment Agency, Ordnance Survey, open elevation tiles, the housing ministry, Natural England and HS2 Ltd, stacked in one circle.'],
    ['The ground decides where water goes', 'EA LiDAR 1 m bare-earth heights, height colours, contours and 3D relief: the Chiltern Hills to the north and the North Downs to the south, with the Thames valley between.'],
    ['Where the rain falls, where the water goes', 'The drainage network is derived from OS Terrain 50 and comes within 0.09% of the gauged catchment at Kingston; flood risk is the Environment Agency’s four bands.'],
    ['Where not to build, and how to get there', 'The Green Belt, 5,065 km², rings London and five landscapes are protected; 7,093 km of railway inside the circle, HS1 to Paris and HS2 to Birmingham.'],
    ['The whole research chain stands on this map', 'The main app, both Loop City steps, Tensor Studio, Structure Studio and VR are built on this map’s data: terrain, water, railways or the site.']
  ];
  var STACK = [['EA LIDAR DTM 1 M', 'Bare-earth heights · Environment Agency'],
    ['HEIGHT · 3D RELIEF', 'Height colours and 3D relief · open elevation tiles'],
    ['DRAINAGE NETWORK', 'Drainage network · from OS Terrain 50'],
    ['EA FLOOD RISK', 'Flood risk in four bands · Environment Agency'],
    ['GREEN BELT · AONB', 'Green Belt · protected landscapes'],
    ['RAIL · HS1 · HS2', 'Rail by service · the high-speed lines'],
    ['OSM BASEMAP · 3D CITY', 'Basemap and 3D buildings · OpenStreetMap']];
  var NODES = [['01', 'Main app', 'The same layer scripts and data', 'workspace.webp'],
    ['03', 'Loop City · 1 The whole loop', 'Rail · high-speed lines', 'loop-city-mould-growth-v2.webp'],
    ['04', 'Loop City · 2 Wool bands', 'Flood risk', 'loop-city-wool-v2.webp'],
    ['05', 'Tensor Studio', 'The site · 50 m heights', 'tensor-studio-v2.webp'],
    ['06', 'Structure Studio', 'Streets, through Tensor Studio', 'structure-studio-v2.webp', true],
    ['07', 'VR · Quest 3S', 'Terrain · flood · drainage', 'vr.webp']];

  var NS = 'http://www.w3.org/2000/svg', F = D ? D.frame : 1000, RC = D ? D.radius : 450;
  function mk(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  function sv(tag, attrs) { var e = document.createElementNS(NS, tag); for (var k in attrs) e.setAttribute(k, attrs[k]); return e; }
  function pct(v) { return (v / F * 100).toFixed(3) + '%'; }
  /* `#introat=18` in the address starts the film 18 s in (for checking one chapter) */
  var SEEK = +((/[#&]introat=([\d.]+)/.exec(location.hash || '') || [])[1] || 0), HOLD = SEEK > 0 && /[#&]introhold\b/.test(location.hash || '');
  function delay(e, d, o) { e.style.setProperty('--d', (d - SEEK).toFixed(2) + 's'); if (o !== undefined) e.style.setProperty('--o', (o - SEEK).toFixed(2) + 's'); return e; }
  function plate(name, anim, d) {
    var b = D.plates[name], im = mk('img', 'lmi-pl lmi-' + (anim || 'in'));
    im.alt = ''; im.decoding = 'async'; im.draggable = false; im.src = DIR + name + '.webp' + (IV ? '?v=' + IV : '');
    im.style.left = pct(b[0]); im.style.top = pct(b[1]); im.style.width = pct(b[2]); im.style.height = pct(b[3]);
    return delay(im, d);
  }
  function svg(cls, d) { var s = sv('svg', { viewBox: '0 0 ' + F + ' ' + F, 'class': 'lmi-svg ' + (cls || 'lmi-in'), 'aria-hidden': 'true' }); return delay(s, d); }
  function circlePath(cx, cy, r) { return 'M' + (cx + r) + ' ' + cy + ' A' + r + ' ' + r + ' 0 1 1 ' + (cx - r) + ' ' + cy + ' A' + r + ' ' + r + ' 0 1 1 ' + (cx + r) + ' ' + cy; }
  /* a label at a point of the frame: its words stay their size, the frame does not scale them */
  function label(p, cls, d, side) {
    var e = mk('div', 'lmi-lab ' + (cls || '') + ' lmi-s' + (side || 'r'));
    e.style.left = pct(p[0]); e.style.top = pct(p[1]);
    return delay(e, d);
  }
  function note(where, d) { return delay(mk('div', 'lmi-note lmi-note' + where), d); }
  function line2(e, a, b) { var x = mk('b', null, a); e.appendChild(x); if (b) e.appendChild(mk('span', null, b)); return e; }

  var live = null;
  function open(story, again) {
    if (live) live.remove();
    var done = false, started = false, storyOver = !story, t0 = 0, readyAt = 0, timer = 0, opened = performance.now();
    var box = mk('div', 'lmi-wait'); box.id = 'lmIntro'; box.setAttribute('role', 'dialog'); box.setAttribute('aria-modal', 'true');
    box.setAttribute('aria-label', 'London map · opening');
    var top = mk('div', 'lmi-top'), tag = mk('div', 'lmi-tag', 'London map · opening'), skip = mk('button', 'lmi-skip', 'Skip');
    skip.type = 'button'; top.appendChild(tag); top.appendChild(skip);
    var map = mk('div', 'lmi-map'), stage = mk('div', 'lmi-stage');

    /* 0 · the cover, the whole width of the picture's room */
    var cover = delay(mk('div', 'lmi-ch lmi-ch0'), T[0], T[1] - 0.4), cimg = mk('img', 'lmi-cover');
    cimg.alt = ''; cimg.decoding = 'async'; cimg.src = DIR + 'cover.webp'; cover.appendChild(cimg); map.appendChild(cover);

    var ch = [];
    for (var i = 1; i <= 6; i++) { ch[i] = delay(mk('div', 'lmi-ch'), T[i], i < 6 ? T[i + 1] - 0.4 : undefined); if (i === 6) ch[i].classList.add('lmi-last'); }

    /* 1 · scope */
    var c = ch[1], t = T[1], s;
    c.appendChild(plate('c1-roads', 'in', t + 0.5));
    s = svg('lmi-in', t + 0.9);
    for (var km = 10; km < 70; km += 10) {
      var rr = RC * km / 70; s.appendChild(sv('circle', { cx: 500, cy: 500, r: rr, fill: 'none', stroke: '#3c3c40', 'stroke-width': 1, 'vector-effect': 'non-scaling-stroke' }));
      var kt = sv('text', { x: 500 + rr * 0.7071 + 5, y: 500 - rr * 0.7071 - 5, 'class': 'lmi-km' }); kt.textContent = km; s.appendChild(kt);
    }
    c.appendChild(s);
    c.appendChild(plate('c1-london', 'in', t + 1.4));
    s = svg('lmi-sweep', t + 0.15); s.appendChild(sv('path', { d: circlePath(500, 500, RC), fill: 'none', stroke: '#E8463A', 'stroke-width': 1.6, 'stroke-dasharray': '4 4', 'vector-effect': 'non-scaling-stroke' })); c.appendChild(s);
    var rad = delay(mk('i', 'lmi-radius'), t + 1.5); rad.style.left = '50%'; rad.style.top = '50%'; rad.style.width = pct(RC); c.appendChild(rad);
    var cross = delay(mk('i', 'lmi-cross'), t + 0.1); cross.style.left = '50%'; cross.style.top = '50%'; c.appendChild(cross);
    c.appendChild(line2(label([500, 500], 'lmi-mono lmi-cc', t + 0.3, 'u'), 'CHARING CROSS'));
    c.appendChild(line2(label([500 + RC * 0.55, 500], 'lmi-mono lmi-red', t + 2.1, 'd'), '70 KM'));
    var n1 = note('R', t + 2.2); n1.appendChild(mk('b', 'lmi-big', '15,388 km²')); n1.appendChild(mk('span', null, 'Greater London is about a tenth of it')); c.appendChild(n1);

    /* 2 · the stack: the slabs come up one by one, the ground first */
    c = ch[2]; t = T[2];
    s = svg('lmi-in', t + 0.6);
    var p1 = D.pts['c2-1'], p7 = D.pts['c2-7'], sx = 290, half = p1[0] - sx;
    [sx - half, sx + half].forEach(function (x) { s.appendChild(sv('line', { x1: x, y1: p7[1], x2: x, y2: p1[1], stroke: '#46464a', 'stroke-width': 1, 'vector-effect': 'non-scaling-stroke' })); });
    s.appendChild(sv('line', { x1: sx, y1: p7[1] - 40, x2: sx, y2: p1[1], stroke: '#E8463A', 'stroke-width': 1, 'stroke-dasharray': '4 4', 'vector-effect': 'non-scaling-stroke' }));
    c.appendChild(s);
    STACK.forEach(function (st, k) {
      var tk = t + 0.25 + k * 0.42, p = D.pts['c2-' + (k + 1)];
      c.appendChild(plate('c2-' + (k + 1), 'rise', tk));
      var ls = svg('lmi-in', tk + 0.3); ls.appendChild(sv('line', { x1: p[0] - 60, y1: p[1] + 4, x2: 590, y2: p[1], stroke: '#6a6a6e', 'stroke-width': 1, 'vector-effect': 'non-scaling-stroke' }));
      ls.appendChild(sv('circle', { cx: p[0] - 60, cy: p[1] + 4, r: 3, fill: '#f5f5f7' })); c.appendChild(ls);
      var lab = label([600, p[1]], 'lmi-stack', tk + 0.3); var m = mk('b', 'lmi-mono', '0' + (k + 1) + '  ' + st[0]); m.setAttribute('data-no-translate', '');
      lab.appendChild(m); lab.appendChild(mk('span', null, st[1])); c.appendChild(lab);
    });

    /* 3 · the ground: ridge lines, back to front */
    c = ch[3]; t = T[3];
    for (var b3 = 1; b3 <= 8; b3++) c.appendChild(plate('c3-' + b3, 'rise', t + 0.2 + (b3 - 1) * 0.3));
    [['chilterns', 'Chiltern Hills', 'u'], ['downs', 'North Downs', 'd'], ['thames', 'Thames valley', 'u']].forEach(function (q) {
      var e = label(D.pts[q[0]], 'lmi-place', t + 2.8, q[2]); e.appendChild(mk('i', 'lmi-dot')); e.appendChild(mk('b', null, q[1])); c.appendChild(e);
    });
    var n3 = note('R', t + 0.5); n3.appendChild(mk('i', 'lmi-ramp')); var rl = mk('div', 'lmi-ends'); rl.appendChild(mk('span', null, '−3 m')); rl.appendChild(mk('span', null, '300 m'));
    n3.appendChild(rl); n3.appendChild(mk('span', null, 'Heights × 3, raised inside the 70 km circle only')); c.appendChild(n3);

    /* 4 · water */
    c = ch[4]; t = T[4];
    c.appendChild(plate('c4-ground', 'in', t + 0.1));
    c.appendChild(plate('c4-flood', 'in', t + 2.3));
    for (var d4 = 1; d4 <= 3; d4++) c.appendChild(plate('c4-dr' + d4, 'in', t + 0.6 + (d4 - 1) * 0.5));
    s = svg('lmi-in', t + 0.2); s.appendChild(sv('circle', { cx: 500, cy: 500, r: RC, fill: 'none', stroke: '#78787e', 'stroke-width': 1, 'stroke-dasharray': '2 3', 'vector-effect': 'non-scaling-stroke' })); c.appendChild(s);
    var kg = label(D.pts.kingston, 'lmi-place lmi-ring', t + 3.3, 'l'); kg.appendChild(mk('i', 'lmi-dot')); kg.appendChild(mk('b', null, 'Kingston')); c.appendChild(kg);
    var n4 = note('L', t + 3.3), m4 = mk('b', 'lmi-mono', 'THAMES AT KINGSTON · NRFA 39001'); m4.setAttribute('data-no-translate', ''); n4.appendChild(m4);
    n4.appendChild(mk('strong', 'lmi-cyan', 'Model 9,957 km²')); n4.appendChild(mk('span', null, 'Gauged 9,948 km² · 0.09% apart')); c.appendChild(n4);
    var k4 = note('R', t + 0.8); k4.appendChild(mk('b', null, 'Drainage · catchment area'));
    [['#70fff1', '≥100 km²'], ['#00e0e6', '25–100 km²'], ['#00b7e4', '5–25 km²']].forEach(function (q) { var r = mk('div', 'lmi-key'); var sw = mk('i', 'lmi-kl'); sw.style.background = q[0]; r.appendChild(sw); r.appendChild(mk('span', null, q[1])); k4.appendChild(r); });
    var f4 = mk('b', 'lmi-gap', 'Flood risk · chance a year'); k4.appendChild(f4);
    [['#9cddea', 'Very low <0.1%'], ['#f7d359', 'Low 0.1–1%'], ['#f29d38', 'Medium 1–3.3%'], ['#d73731', 'High ≥3.3%']].forEach(function (q) { var r = mk('div', 'lmi-key'); var sw = mk('i', 'lmi-kb'); sw.style.background = q[0]; r.appendChild(sw); r.appendChild(mk('span', null, q[1])); k4.appendChild(r); });
    c.appendChild(k4);

    /* 5 · limits and links */
    c = ch[5]; t = T[5];
    c.appendChild(plate('c5-belt', 'in', t + 0.1));
    c.appendChild(plate('c5-aonb', 'in', t + 0.8));
    c.appendChild(plate('c5-rail', 'grow', t + 1.1));
    c.appendChild(plate('c5-hs', 'grow', t + 2.3));
    s = svg('lmi-sweep', t + 0.1); s.appendChild(sv('path', { d: circlePath(500, 500, RC), fill: 'none', stroke: '#E8463A', 'stroke-width': 1.3, 'stroke-dasharray': '4 4', 'vector-effect': 'non-scaling-stroke' })); c.appendChild(s);
    [['hs2', '→ Birmingham', 'HS2', 'l'], ['hs1', '→ Paris · Brussels', 'HS1', 'r']].forEach(function (q) {
      var e = label(D.pts[q[0]], 'lmi-hs', t + 3.3, q[3]); e.appendChild(mk('b', null, q[1])); var m = mk('span', 'lmi-mono', q[2]); m.setAttribute('data-no-translate', ''); e.appendChild(m); c.appendChild(e);
    });
    var n5 = note('R', t + 0.5);
    [['#c8c8cd', 'Green Belt 5,065 km²', 'l'], ['#96969e', 'AONB · 5 landscapes', 'd'], ['#e1e1e4', 'National Rail', 'l'], ['#E8463A', 'Underground and other lines', 'l'], ['#3fe0c5', 'HS1 · HS2', 'l']].forEach(function (q) {
      var r = mk('div', 'lmi-key'), sw = mk('i', 'lmi-kl' + (q[2] === 'd' ? ' lmi-kd' : '')); sw.style.color = q[0]; sw.style.background = q[2] === 'd' ? 'none' : q[0];
      r.appendChild(sw); r.appendChild(mk('span', null, q[1])); n5.appendChild(r);
    });
    c.appendChild(n5);

    /* 6 · the role: the map's data, under every later app */
    c = ch[6]; t = T[6];
    for (var j = 1; j <= 3; j++) c.appendChild(plate('c6-' + j, 'rise', t + 0.1 + (j - 1) * 0.25));
    var nm = label([170, 700], 'lmi-name', t + 0.8, 'c'); nm.appendChild(mk('b', null, 'London map')); var m6 = mk('span', 'lmi-mono lmi-red', '02 · REAL DATA'); m6.setAttribute('data-no-translate', ''); nm.appendChild(m6); c.appendChild(nm);
    var srcX = 300, srcY = 500, nx = 410, n0 = 135, nh = 146;
    var dot = delay(mk('i', 'lmi-src'), t + 1.1); dot.style.left = pct(srcX); dot.style.top = pct(srcY); c.appendChild(dot);
    NODES.forEach(function (q, k) {
      var y = n0 + k * nh, tk = t + 1.2 + k * 0.28, cs = svg('lmi-in', tk);
      if (q[4]) cs.appendChild(sv('path', { d: 'M' + (nx - 14) + ' ' + (y - nh + 16) + ' V' + y + ' H' + (nx - 4), fill: 'none', stroke: '#96969c', 'stroke-width': 1, 'stroke-dasharray': '3 3', 'vector-effect': 'non-scaling-stroke' }));
      else cs.appendChild(sv('path', { d: 'M' + srcX + ' ' + srcY + ' C' + (srcX + 50) + ' ' + srcY + ' ' + (nx - 60) + ' ' + y + ' ' + (nx - 6) + ' ' + y, fill: 'none', stroke: '#96969c', 'stroke-width': 1, 'vector-effect': 'non-scaling-stroke' }));
      cs.appendChild(sv('path', { d: 'M' + (nx - 4) + ' ' + y + ' l-8 -4 v8 z', fill: '#c8c8cc' }));
      c.appendChild(cs);
      var e = delay(mk('div', 'lmi-node'), tk + 0.4); e.style.left = pct(nx); e.style.top = pct(y);
      var th = mk('img', 'lmi-thumb'); th.alt = ''; th.decoding = 'async'; th.src = CAT + q[3]; e.appendChild(th);
      var tx = mk('div', 'lmi-nt'), no = mk('em', 'lmi-mono lmi-red', q[0]); no.setAttribute('data-no-translate', '');
      tx.appendChild(no); tx.appendChild(mk('b', null, q[1])); tx.appendChild(mk('span', null, q[2])); e.appendChild(tx); c.appendChild(e);
    });

    /* (28 Nov 2026) chapter 6 on a narrow screen: the chain as a list over the whole width, the map's three slabs at its
       head. In the square frame the six rows had a frame's sixth each, too little on a phone: their lines ran into
       each other and off the screen. */
    var rn = delay(mk('div', 'lmi-ch lmi-last lmi-roleN'), T[6]), hd = mk('div', 'lmi-rnh'), st = mk('div', 'lmi-rns');
    var ub = [1e9, 1e9, -1e9, -1e9];
    [1, 2, 3].forEach(function (j) { var q = D.plates['c6-' + j]; ub = [Math.min(ub[0], q[0]), Math.min(ub[1], q[1]), Math.max(ub[2], q[0] + q[2]), Math.max(ub[3], q[1] + q[3])]; });
    st.style.aspectRatio = ((ub[2] - ub[0]) / (ub[3] - ub[1])).toFixed(3);
    [1, 2, 3].forEach(function (j) {
      var q = D.plates['c6-' + j], im = delay(mk('img', 'lmi-rise'), T[6] + 0.1 + (j - 1) * 0.25); im.alt = ''; im.decoding = 'async'; im.src = DIR + 'c6-' + j + '.webp';
      im.style.left = ((q[0] - ub[0]) / (ub[2] - ub[0]) * 100).toFixed(2) + '%'; im.style.top = ((q[1] - ub[1]) / (ub[3] - ub[1]) * 100).toFixed(2) + '%';
      im.style.width = (q[2] / (ub[2] - ub[0]) * 100).toFixed(2) + '%'; im.style.height = (q[3] / (ub[3] - ub[1]) * 100).toFixed(2) + '%'; st.appendChild(im);
    });
    var hn = delay(mk('div', 'lmi-rnn lmi-in'), T[6] + 0.8); hn.appendChild(mk('b', null, 'London map')); var m6n = mk('span', 'lmi-mono lmi-red', '02 · REAL DATA'); m6n.setAttribute('data-no-translate', ''); hn.appendChild(m6n);
    hd.appendChild(st); hd.appendChild(hn); rn.appendChild(hd);
    var ls = mk('div', 'lmi-rnl');
    NODES.forEach(function (q, k) {
      var r = delay(mk('div', 'lmi-nr' + (q[4] ? ' lmi-nrv' : '')), T[6] + 1.2 + k * 0.28);
      var th = mk('img', 'lmi-thumb'); th.alt = ''; th.decoding = 'async'; th.src = CAT + q[3]; r.appendChild(th);
      var tx = mk('div', 'lmi-nt'), l1 = mk('div', 'lmi-nt1'), no = mk('em', 'lmi-mono lmi-red', q[0]); no.setAttribute('data-no-translate', '');
      l1.appendChild(no); l1.appendChild(mk('b', null, q[1])); tx.appendChild(l1); tx.appendChild(mk('span', null, q[2])); r.appendChild(tx); ls.appendChild(r);
    });
    rn.appendChild(ls); map.appendChild(rn);

    for (i = 1; i <= 6; i++) stage.appendChild(ch[i]);
    /* the hand-over: chapter 1's circle again, which moves onto the map's own 70 km circle */
    var hand = mk('div', 'lmi-handc');
    hand.appendChild(plate('c1-roads', 'still', 0)); hand.appendChild(plate('c1-london', 'still', 0));
    s = svg('lmi-still', 0); s.appendChild(sv('path', { d: circlePath(500, 500, RC), fill: 'none', stroke: '#E8463A', 'stroke-width': 1.6, 'stroke-dasharray': '4 4', 'vector-effect': 'non-scaling-stroke' })); hand.appendChild(s);
    stage.appendChild(hand);
    map.appendChild(stage);

    /* the captions, and six marks under them (the cover has none) */
    var caps = mk('div', 'lmi-caps'), foot = mk('div', 'lmi-foot'), pips = mk('div', 'lmi-pips'), prog = mk('span', 'lmi-prog');
    TEXT.forEach(function (q, k) {
      var cp = delay(mk('div', 'lmi-cap' + (k === 6 ? ' lmi-last' : '')), T[k] + 0.15, k < 6 ? T[k + 1] - 0.4 : undefined);
      cp.appendChild(mk('h2', null, q[0])); cp.appendChild(mk('p', null, q[1])); caps.appendChild(cp);
      if (k) pips.appendChild(delay(mk('i'), T[k] + 0.3));
    });
    foot.appendChild(pips); foot.appendChild(prog);
    box.appendChild(top); box.appendChild(map); box.appendChild(caps); box.appendChild(foot);

    function ready() { try { return !!(window.londonMapIntro && window.londonMapIntro.ready); } catch (e) { return false; } }
    var lastStatus = '';
    function status() {
      var r = ready();
      var label_ = (r || again) ? 'Enter ›' : 'Skip';
      if (skip.dataset.src !== label_) { skip.textContent = label_; skip.dataset.src = label_; }
      skip.classList.toggle('lmi-go', r || again);
      var t_ = again ? '' : r ? 'The map is ready' : 'Loading the map…';
      if (t_ !== lastStatus) { prog.textContent = t_; lastStatus = t_; }
    }
    /* the square frame, as large as its room allows; on a narrow screen it stands at the top, its notes under it */
    function fit() {
      var r = map.getBoundingClientRect(); if (!(r.width > 0 && r.height > 0)) return;
      /* (28 Nov 2026) a phone on its side: the caption has its own column (intro.css), the notes go under it */
      var sidev = false; try { sidev = matchMedia('(orientation: landscape) and (max-height: 500px)').matches; } catch (e) { sidev = false; }
      box.classList.toggle('lmi-sidev', sidev);
      var narrow = !sidev && r.width < 760, side = narrow || sidev ? 0 : 230, room = 140;
      /* a narrow screen: the notes run the whole width under the frame (not just the frame's width), and the frame leaves
         room for the tallest of them, so a legend never runs into the caption on a short phone */
      if (narrow) {
        box.style.setProperty('--nw', r.width + 'px'); var nh = 0;
        box.querySelectorAll('.lmi-note').forEach(function (n) { nh = Math.max(nh, n.offsetHeight); });
        room = Math.max(120, nh + 14);
      }
      var w = Math.max(120, Math.min(r.width - 2 * side, narrow ? r.height - room - 10 : r.height, narrow ? r.width : 1e9));
      stage.style.width = w + 'px'; stage.style.height = w + 'px';
      stage.style.left = (r.width - w) / 2 + 'px'; stage.style.top = (narrow ? Math.max(0, (r.height - w - room) / 2) : (r.height - w) / 2) + 'px';
      if (narrow) box.style.setProperty('--nx', -(r.width - w) / 2 + 'px');
      box.classList.toggle('lmi-narrow', narrow); box.classList.toggle('lmi-small', w < 480);
      box.classList.toggle('lmi-flat', r.height < 420);   // (28 Nov 2026) a phone on its side: chapter 6 as a list in two columns
    }

    function close() {
      if (done) return; done = true;
      clearInterval(timer); removeEventListener('resize', fit); document.removeEventListener('keydown', key, true);
      var to = null;
      try { to = !calm && ready() && window.londonMapIntro.circle ? window.londonMapIntro.circle() : null; } catch (e) { to = null; }
      var wait = 0;
      if (to && to.w > 0) {
        var r = stage.getBoundingClientRect(), k = to.w / (r.width * 2 * RC / F);
        if (k > 0.2 && k < 6) {
          box.classList.add('lmi-hand');
          var dx = to.x + to.w / 2 - (r.left + k * r.width / 2), dy = to.y + to.h / 2 - (r.top + k * r.height / 2);
          setTimeout(function () { stage.style.transform = 'translate(' + dx.toFixed(1) + 'px,' + dy.toFixed(1) + 'px) scale(' + k.toFixed(4) + ')'; }, 420);
          wait = 420 + 950;
        }
      }
      setTimeout(function () {
        box.classList.add('lmi-out');
        setTimeout(function () { box.remove(); if (live === box) live = null; }, calm ? 0 : 650);
      }, wait);
    }
    function key(e) {
      if (done) return;
      if (e.key === 'Enter' || e.key === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); close(); }
    }
    function begin(asStory) {
      if (started || done) return; started = true;
      if (!asStory) { story = false; storyOver = true; }
      box.classList.remove('lmi-wait'); box.classList.add(story ? 'lmi-story' : 'lmi-still');
      if (HOLD) box.classList.add('lmi-hold');
      t0 = performance.now() - SEEK * 1000; fit();
    }
    function tick() {
      status();
      if (!started || HOLD) return;
      var now = performance.now(), el = (now - t0) / 1000;
      if (!storyOver && el >= END) storyOver = true;
      if (again) { if (storyOver && el >= END + 2.5) close(); return; }
      if (ready()) {
        if (!readyAt) readyAt = now;
        if (!story) { if (now - readyAt >= 1200) close(); return; }
        if (storyOver && now - readyAt >= 1200 && el >= END + 1.2) close();
      }
    }

    skip.onclick = close;
    document.body.appendChild(box); live = box;
    fit(); status();
    addEventListener('resize', fit);
    document.addEventListener('keydown', key, true);
    timer = setInterval(tick, 250);
    /* the film starts once its first pictures are in and the page has chosen its language (so the words do not change
       in the first second); a film still waiting after a few seconds is shown as its still last chapter */
    var first = [cimg, ch[1].querySelector('img')];
    var inN = 0; first.forEach(function (im) { (im.decode ? im.decode() : Promise.resolve()).then(function () { inN++; }, function () { inN++; }); });
    var waited = setInterval(function () {
      var w = (performance.now() - opened) / 1000;
      if (started || done) { clearInterval(waited); return; }
      var lang = !!root.dataset.uiLanguage;
      if (inN >= first.length && (lang || w > 1.5)) { clearInterval(waited); begin(true); }
      else if (w > (story ? 8 : 1.5)) { clearInterval(waited); begin(false); }
    }, 80);
  }

  window.LMIntro = {
    /* the whole film again, over the map as it stands */
    replay: function () { if (D && document.body) open(!calm, true); },
    get open() { return !!live; }
  };
  /* the replay button in the panel: wired here, as the panel is in the page by the time it is clicked */
  document.addEventListener('click', function (e) {
    var b = e.target && e.target.closest && e.target.closest('#introReplay');
    if (b) { e.preventDefault(); window.LMIntro.replay(); }
  });
  if (off) return;
  open(!calm, false);
})();
