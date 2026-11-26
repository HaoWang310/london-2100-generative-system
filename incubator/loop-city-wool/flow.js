/* Loop City step 2 · the flow (25 Nov 2026).
   The left panel becomes the method, step by step, as in Structure Studio: at the top ▶ Play the steps, Pause and
   Finish now, the speed, the full-screen demo and "stop after each step"; under it a card for each step (the site,
   then sixteen steps in four chapters). Playing, each step is worked out, the camera goes where it happens, and the
   step is shown as a process (anim.js); its card opens with what it did, why, its settings (each opens its slider)
   and what came out; done, the card closes with a tick and its key number. With "stop after each step" on, the page
   waits after each, its Next button lit, so a viewer is led one step at a time. Colour marks only the chapter:
   reading the ground cyan, cutting lime, weaving violet, making roads orange; the rest is black and white.
   It replaces the demo bar, the explanation card's place and the right panel's playback; the method is untouched. */
(function () {
  'use strict';
  var H = document.documentElement, $ = function (id) { return document.getElementById(id); };
  var zh = function () { return /^zh/i.test(H.lang || ''); }, T = function (en, cn) { return zh() ? cn : en; };
  var esc = function (s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  var AN = window.__lcAnim, CHC = AN.CH;
  var SEQ = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 21, 22, 23, 24, 25, 26];
  var shown = function (k) { return k > 20 ? k - 10 : k; };
  // (25 Nov 2026) a cell that is already a town: steps 8 to 15 are not made (explain.js says which); Next, Back and
  // the player pass over them, and their cards are grey
  var isOff = function (k) { try { return !!(window.__lcOff && window.__lcOff(k)); } catch (e) { return false; } };
  var nextK = function (k) { var i = SEQ.indexOf(k); if (i < 0) return undefined; for (i++; i < SEQ.length; i++) if (!isOff(SEQ[i])) return SEQ[i]; return undefined; };
  var prevK = function (k) { var i = SEQ.indexOf(k); if (i < 0) return undefined; for (i--; i >= 0; i--) if (!isOff(SEQ[i])) return SEQ[i]; return undefined; };
  var quietRelax = async function () { await window.__woolUpTo(8); relax(); await until(function () { return S.relaxed && !S.busy; }, 600000); };
  var chOf = AN.chapter;
  var CHN = { 0: ['Prologue · the site', '序章 · 场地'], 1: ['Reading the ground', '读地'], 2: ['Cutting', '切分'], 3: ['Weaving', '编织'], 4: ['Making roads', '成路'] };
  var NAME = { 0: ['The site and the loop', '场地与环线'], 1: ['The slime mould', '黏菌'], 2: ['Veins, centrelines', '菌脉与中心线'], 3: ['The cells', '单元'], 4: ['Existing roads', '现有道路'],
    5: ['Primary cells', '主单元'], 6: ['Soil grades', '土壤等级'], 7: ['Good land kept for farming', '好地留给耕种'], 8: ['Anchors', '锚点'], 9: ['Base net', '基础网'], 10: ['The wool relaxing', '毛线松弛'],
    21: ['Road bands', '道路带'], 22: ['With the existing roads', '并入现状道路'], 23: ['Fine tuning', '微调'], 24: ['Bigger parcels', '并成大地块'], 25: ['Parcels by use', '地块用途'], 26: ['Road hierarchy', '道路等级'], 27: ['On to the tensor field', '交给张量场'], 28: ['Evaluation', '评价'] };      // 28: chapter 5, the evaluation
  var nm = function (k) { return T(NAME[k][0], NAME[k][1]); };
  var ok = function () { return typeof DATA !== 'undefined' && DATA && typeof S !== 'undefined' && S && S.view; };
  var info = function (k) {
    if (k === 0) { var km = DATA.nums && DATA.nums.cells ? Object.keys(DATA.nums.cells).reduce(function (s, c) { return s + DATA.nums.cells[c]; }, 0) : 0;
      return { t: T('First the site: three cells and the loop', '先认识场地：三个单元和交通环线'),
        did: T('White lines trace the three cells (' + DATA.cells.map(function (c) { return c.id; }).join(', ') + '); the rail loop runs through them, stations ' + DATA.stations.map(function (s) { return s.id; }).join(' and ') + ' on it; the dashed lines are the radials and the high-speed line.',
          '白线勾出三个单元（' + DATA.cells.map(function (c) { return c.id; }).join('、') + '）；轨道环线 Loop 穿过场地，车站 ' + DATA.stations.map(function (s) { return s.id; }).join('、') + ' 在环上；虚线是放射线和高铁。'),
        why: T('The new town grows along the loop and round its stations: first the shape of the site and its transport, then how the mould grows on it.', '新城沿着环线、围绕车站生长：先看清场地的形状和交通，再看黏菌怎么在上面长。'),
        prm: [], res: [[DATA.cells.length, T('cells', '个单元')], [km ? km.toFixed(0) : '–', 'km²'], [DATA.stations.length, T('stations', '个车站')]], leg: 0 }; }
    return window.__lcInfo ? window.__lcInfo(k) : null;
  };
  var keyResult = function (k) { var x = null; try { x = info(k); } catch (e) {}
    if (x && x.note && (!x.res || !x.res.length || k === 25)) return k === 5 ? T('kept as it is', '保留现状') : k === 25 ? T('no urban parcel', '没有城市地块') : '';
    return x && x.res && x.res[0] ? x.res[0][0] + ' ' + x.res[0][1] : ''; };

  // ---------------------------------------------------------------- state
  var P = window.__lcFlow = { prev: {}, more: {}, busyParam: 0, on: false, paused: false, k: null, done: {}, ms: {}, total: 0, speed: 1, stopEach: false, wait: false, full: false, open: {}, phase: '', ctl: null };
  try { var sv = JSON.parse(localStorage.getItem('lcFlow') || '{}'); if (sv.speed) P.speed = sv.speed; if (sv.stopEach !== undefined) P.stopEach = sv.stopEach; } catch (e) {}
  var save = function () { try { localStorage.setItem('lcFlow', JSON.stringify({ speed: P.speed, stopEach: P.stopEach })); } catch (e) {} };

  // ---------------------------------------------------------------- the panel
  var box = null, fs = null, mleg = null, mco = null;
  function build() {
    var L = $('left'); if (!L || box) return;
    H.classList.add('lcflow');
    box = document.createElement('div'); box.id = 'lcFlow'; box.setAttribute('translate', 'no');
    var card = $('lcCard'), head = L.querySelector('.l2-head'), pb = L.querySelector('.l2ph-body');      // on a phone the panel is the sheet's body
    if (card && card.parentNode && (!pb || pb.contains(card))) card.parentNode.insertBefore(box, card);
    else if (pb) pb.insertBefore(box, pb.firstChild);
    else if (head && head.parentNode === L) L.insertBefore(box, head.nextSibling); else L.insertBefore(box, L.firstChild);
    var chn = L.querySelector('.l2chain'); if (chn && box.parentNode) box.parentNode.insertBefore(chn, box);      // (26 Nov 2026) the chain row stays right under the title, above the steps
    box.addEventListener('click', onClick);
    box.addEventListener('input', function (e) { if (e.target.id === 'lcSpeed') { P.speed = +e.target.value; save(); render(); return; }
      var id = e.target.dataset && e.target.dataset.p; if (id) { var p = PR.byId(id), o = box.querySelector('[data-out="' + id + '"]'); if (p && o) o.textContent = PR.show(p, +e.target.value); } });
    box.addEventListener('change', function (e) { var id = e.target.dataset && e.target.dataset.p; if (id) { var p = PR.byId(id); if (p) apply([[p, +e.target.value]]); } });
    box.addEventListener('pointerdown', function (e) { if (e.target.dataset && e.target.dataset.p) P.drag = true; });
    var up = function () { if (!P.drag) return; P.drag = false; if (P.later) { P.later = false; setTimeout(render, 0); } };
    document.addEventListener('pointerup', up, true); document.addEventListener('pointercancel', up, true);
    // the right panel's playback is hidden by skin.css: the flow plays
    // full screen: the map alone, the step and a bar
    fs = document.createElement('div'); fs.id = 'lcFS'; fs.setAttribute('translate', 'no'); $('wrap').appendChild(fs); fs.addEventListener('click', onClick);
    mleg = document.createElement('div'); mleg.id = 'lcMapLeg'; mleg.setAttribute('translate', 'no'); $('wrap').appendChild(mleg);
    mco = document.createElement('div'); mco.id = 'lcCallout'; mco.setAttribute('translate', 'no'); $('wrap').appendChild(mco);
    new MutationObserver(render).observe(H, { attributes: true, attributeFilter: ['lang'] });
    document.addEventListener('keydown', onKey);
    var wrapEl = $('wrap');
    ['pointerdown', 'wheel'].forEach(function (ev) { wrapEl.addEventListener(ev, function (e) { if (e.target.closest && e.target.closest('#lcFS,#lcMapLeg')) return; mapTouched(ev); }, { capture: true, passive: true }); });
    document.addEventListener('input', function (e) { if (P.on && !(e.target.closest && e.target.closest('#lcFlow,#lcFS,#langbar'))) stop(); }, true);
    document.addEventListener('click', function (e) { var b = e.target.closest && e.target.closest('[data-step]'); if (b && P.on && !e.target.closest('#lcFlow,#lcFS')) stop(); }, true);
    // after each drawing: the map's legend and the soil labels follow the view
    var d0 = window.draw; if (typeof d0 === 'function' && !d0.__lc) { window.draw = function () { var r = d0.apply(this, arguments); try { mapExtras(); } catch (e) {} return r; }; window.draw.__lc = true; }
    // on a phone the folded sheet's Previous / Next play the steps too
    var qb = L.querySelectorAll('.l2ph-quick button'); if (qb.length === 2) { // (26 Nov 2026) and they reach step 17, the way out, which stands after the sixteen steps they play: Next at step 16
    // goes on to it (as the card's own "On to the tensor field" does), Previous at step 17 comes back to step 16, and
    // Next at step 17 is the hand-over to Tensor Studio (skin.js). Before, both buttons did nothing there.
    qb[0].onclick = function () { if (S.step === 27) { stop(); setStep(26); P.k = null; render(); return; } back(); };
    qb[1].onclick = function () { if (window.__lcHandOver && window.__lcHandOver()) return;
      if (S.step === 26 && nextK(cur()) === undefined && !(P.wait && P.release) && !(typeof WS !== 'undefined' && WS.stop())) { stop(); setStep(27); P.k = null; render(); return; }
      next(); }; }
    setTimeout(function () { AN.warm(); }, 2500);
  }
  var segs = function (cur) {             // the seventeen marks, each in its chapter's colour
    var h = '', last = -1; SEQ.forEach(function (k) { var c = chOf(k); if (last >= 0 && c !== last) h += '<s></s>'; last = c;
      var st = isOff(k) ? 'opacity:.28' : P.done[k] ? 'background:' + CHC[c] : k === cur ? 'background:' + CHC[c] + ';box-shadow:0 0 8px ' + CHC[c] : '';
      h += '<i data-go="' + k + '" title="' + esc((k ? shown(k) + ' ' : '') + nm(k)) + '" style="' + st + '"></i>'; }); return h; };
  function card(k) {
    // (26 Nov 2026) 28, the evaluation: chapter 5, after step 16, in white
    var c = k === 28 ? 5 : chOf(k), col = k === 28 ? '#F5F5F7' : CHC[c], cur = P.k === k || (P.k === null && S.step === (k === 0 ? -1 : k)), done = P.done[k], open = cur || P.open[k] || P.all;
    var off = isOff(k);
    if (off) { var xo = null; try { xo = info(k); } catch (e) {}
      return '<div class="fc off" data-k="' + k + '" style="--c:' + col + '"><button type="button" class="fh" data-open="' + k + '"><span class="n">' + shown(k) + '</span><b>' + esc(nm(k)) + '</b><span class="fl">' + T('Built up · not woven', '已建成 · 不编织') + '</span></button>' +
        (P.open[k] || P.all ? '<div class="fb"><p>' + esc(xo ? xo.did : '') + '</p></div>' : '') + '</div>'; }
    var cls = 'fc' + (cur ? ' cur' : '') + (done ? ' done' : '') + (!cur && !done ? ' todo' : '');
    var num = done && !cur ? '✓' : (k === 0 ? '0' : k === 28 ? '–' : shown(k));
    var nchg = PR ? PR.of(k).filter(function (p) { return PR.changed(p); }).length : 0;
    var flag = cur && P.phase ? P.phase : nchg && (cur || done) ? T(nchg + ' changed', '已改 ' + nchg + ' 项') : done ? keyResult(k) : '';
    var h = '<div class="' + cls + '" data-k="' + k + '" style="--c:' + col + '"><button type="button" class="fh" data-open="' + k + '"><span class="n">' + num + '</span><b>' + esc(nm(k)) + '</b><span class="fl' + (nchg && !(cur && P.phase) && (cur || done) ? ' chg' : '') + '">' + esc(flag) + '</span></button>';
    if (open) { var x = null; try { x = info(k); } catch (e) {}
      if (x) { h += '<div class="fb">';
        if (cur) h += '<div class="pg"><i style="width:' + Math.round((P.prog || 0) * 100) + '%"></i></div>';
        h += '<h4>' + esc(x.t) + '</h4><p>' + esc(x.did) + '</p>' + (x.why ? '<div class="l">' + T('Why', '为什么') + '</div><p class="why">' + esc(x.why) + '</p>' : '');
        if (window.__lcNote) h += window.__lcNote(x);
        var ps = PR ? PR.of(k) : [];
        if (ps.length) h += paramsBlock(k, ps, cur || done);
        else if (x.prm && x.prm.length) { h += '<div class="prm">'; x.prm.forEach(function (p) { h += '<div><span>' + esc(p[0]) + '</span><b>' + esc(p[1]) + '</b></div>'; }); h += '</div>'; }
        if (k >= 1 && k <= 3) h += '<a class="up" href="../loop-city-mould-growth/index.html" target="_blank" rel="noopener">' + T('These come from the slime mould app (step 1): change them there ›', '这些来自上一步「黏菌生长」app：到那里修改 ›') + '</a>';
        if (x.res && x.res.length) { var pr0 = P.prev[k]; h += '<div class="res">'; x.res.forEach(function (r, j) { var d = pr0 ? delta(pr0[j], r[0]) : ''; h += '<div><b>' + esc(r[0]) + '</b><span>' + esc(r[1]) + (d ? ' <em class="' + (d[0] === '−' ? 'dn' : 'up') + '">' + d + '</em>' : '') + '</span></div>'; }); h += '</div>'; }
        var lg = $('legend'); if (cur && lg && x.leg) { var rows = [].slice.call(lg.children, 0, x.leg); if (rows.length) h += '<div class="lg">' + rows.map(function (r) { return '<div>' + r.innerHTML + '</div>'; }).join('') + '</div>'; }
        var nx = nextK(k);
        var pv = prevK(k);
        var nch = ps.filter(function (p) { return PR.changed(p); }).length;
        if (cur || done) h += '<div class="ftn">' + (nch ? T(nch + ' changed · ', '已改 ' + nch + ' 项 · ') + '<button type="button" class="ra" data-resetall="' + k + '">' + T('All back to the defaults', '全部恢复默认') + '</button>'
            : ps.length ? T('Left alone, the defaults are used', '不调就用默认值') : '') + '</div><div class="ft">' +
          (pv !== undefined ? '<button type="button" class="pv" data-back="' + k + '" style="--c:' + CHC[chOf(pv)] + '">‹ ' + T('Back', '上一步') + '</button>' : '') +
          (nx !== undefined ? '<button type="button" class="nx' + (P.wait && cur ? ' lit' : '') + '" data-go="' + nx + '" style="--c:' + CHC[chOf(nx)] + '">' + T('Next: ', '下一步：') + shown(nx) + ' ' + esc(nm(nx)) + ' ›</button>'
            : k === 27 && typeof WS !== 'undefined' && WS.stop() ? '' : '<button type="button" class="nx" data-way="1" style="--c:#fff">' + T('On to the tensor field ›', '交给张量场 ›') + '</button>') + '</div>';
        h += '</div>'; } }
    return h + '</div>';
  }
  function render() {
    if (!box || !ok()) return;
    if (P.drag) { P.later = true; return; }                // a slider held in a card is never taken from under the finger
    var k = P.k !== null ? P.k : S.step, c = chOf(k === 27 ? 26 : k), x = '';
    var st = P.on ? (P.paused ? T('Paused', '已暂停') : P.wait ? T('Waiting for you', '等你点下一步') : T('Playing', '播放中')) : '';
    x += '<div class="fhd"><h2>' + T('The method, step by step', '生成流程') + '</h2><button type="button" class="all" data-all="1">' + (P.all ? T('Fold', '全部收起') : T('Open all', '全部展开')) + '</button></div>';
    x += '<div class="run"><div class="b3"><button type="button" class="bk" data-back="cur" title="' + T('Back one step', '上一步') + '"' + (idxOf(cur()) > 0 ? '' : ' disabled') + '>‹</button><button type="button" class="pri" data-play="1">' + (P.on && !P.paused && !P.wait ? '❚❚ ' + T('Playing', '播放中') : P.on ? '▶ ' + T('Carry on', '继续') : '▶ ' + T('Play the steps', '逐步生成')) + '</button>' +
      '<button type="button" data-pause="1"' + (P.on ? '' : ' disabled') + '>' + T('Pause', '暂停') + '</button><button type="button" data-now="1">' + T('Finish now', '立即完成') + '</button></div>' +
      '<div class="sp"><label for="lcSpeed">' + T('Speed', '演示速度') + '</label><input type="range" id="lcSpeed" min="0.5" max="2" step="0.25" value="' + P.speed + '"><output>' + P.speed + '×</output></div>' +
      '<div class="b2"><button type="button" data-full="1">' + T('Full-screen demo', '全屏演示') + '</button><button type="button" data-each="1" class="' + (P.stopEach ? 'on' : '') + '">' + T('Stop after each step', '每步停') + ' · ' + (P.stopEach ? T('on', '开') : T('off', '关')) + '</button></div>' +
      '<div class="stt">' + (k === 0 ? T('Prologue', '序章') : k === 28 ? T('After step 16', '第 16 步之后') : T('Step ' + shown(k) + ' / 17', '第 ' + String(shown(k)).padStart(2, '0') + ' / 17 步')) + ' · <b style="color:' + CHC[c] + '">' + esc(nm(k === 27 ? 27 : k)) + '</b>' +
      (st ? ' · ' + st : '') + (P.total ? ' · ' + T('worked out in ', '计算共 ') + (P.total / 1000).toFixed(1) + T(' s', ' 秒') : '') + '</div><div class="sg">' + segs(k) + '</div></div>';
    var last = -1;
    SEQ.forEach(function (q) { var cc = chOf(q); if (cc !== last) { x += '<div class="chh" style="color:' + CHC[cc] + '">' + (cc ? T('Chapter ' + cc + ' · ', '第 ' + cc + ' 章 · ') : '') + T(CHN[cc][0], CHN[cc][1]) + '</div>'; last = cc; } x += card(q); });
    // (26 Nov 2026) chapter 5, the evaluation (evaluate.js): it had no card, only a mark in the chapter bar. After step 16, before the way out;
    // the player passes it (it works out three whole networks), a click opens it
    x += '<div class="chh" style="color:#F5F5F7">' + T('Chapter 5 · Evaluation', '第 5 章 · 评价') + '</div>' + card(28);
    x += '<div class="chh" style="color:#8A8A8A">' + T('The way out', '出口') + '</div>' + card(27);
    var hd = $('left').querySelector('.l2-head'); box.style.setProperty('--hh', (hd && getComputedStyle(hd).position === 'sticky' ? hd.offsetHeight : 0) + 'px');
    box.innerHTML = x;
    renderFS(); mapExtras();
    var cc = box.querySelector('.fc.cur'); if (cc && P.on && P.follow !== P.k) { P.follow = P.k; cc.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); }
  }
  function renderFS() {
    if (!fs) return; fs.hidden = !P.full; if (!P.full) return;
    var k = P.k !== null ? P.k : S.step, c = chOf(k === 27 ? 26 : k), x = null; try { x = info(k); } catch (e) {}
    var res = x && x.res && x.res.length ? x.res.slice(0, 3).map(function (r) { return r[0] + ' ' + r[1]; }).join(' · ') : '';
    fs.innerHTML = '<div class="bd"><div class="nb" style="color:' + CHC[c] + '">' + (k === 0 ? '00' : String(shown(k)).padStart(2, '0')) + '</div><div><div class="cl">' + (c ? T('Chapter ' + c + ' · ', '第 ' + c + ' 章 · ') : '') + T(CHN[c][0], CHN[c][1]) + '</div><div class="tt">' + esc(nm(k)) + '</div>' +
      (x ? '<div class="ds">' + esc(x.t) + '</div>' : '') + (res && P.done[k] ? '<div class="rp" style="border-color:' + CHC[c] + ';color:' + CHC[c] + '">' + esc(res) + '</div>' : '') + '</div></div>' +
      '<div class="br"><button type="button" data-prev="1">‹</button><button type="button" class="pp" data-play="1">' + (P.on && !P.paused && !P.wait ? '❚❚' : '▶') + '</button><button type="button" data-next="1">›</button><div class="sg">' + segs(k) + '</div>' +
      '<button type="button" data-spd="1">' + P.speed + '×</button><button type="button" data-each="1" class="' + (P.stopEach ? 'on' : '') + '">' + T('Stop each step', '每步停') + '</button><button type="button" data-full="1">' + T('Exit', '退出演示') + '</button></div>';
  }
  // the map's legend (steps 4 and 6) and, on step 6, where Grade 1 and Grade 2 are
  function mapExtras() {
    if (!mleg || !ok()) return;
    var k = P.k !== null ? P.k : S.step, show = (k === 4 || k === 6) && S.step === k && !(P.on && P.phase && P.k === k && P.prog < 0.45);
    if (!show) { mleg.hidden = true; mleg.innerHTML = ''; mco.innerHTML = ''; return; }
    var lg = $('legend'), n = k === 4 ? 4 : 8, rows = lg ? [].slice.call(lg.children, 0, n) : [];
    var h = '<div class="mh">' + (k === 4 ? T('The roads there are, by class', '现有道路的等级') : T('Agricultural land classification', '农地等级')) + '<span>' + (k === 4 ? 'OS Open Zoomstack' : T('Natural England ALC · inside the cells', 'Natural England ALC · 三个单元内')) + '</span></div>';
    h += rows.map(function (r) { return '<div class="mr">' + r.innerHTML + '</div>'; }).join('');
    if (k === 6 && PX.soilKm) { var g1 = PX.soilKm[0], g2 = PX.soilKm[1];
      if (g1 < 0.5) h += '<div class="mn">' + T('There is no Grade 1 land in these cells; the best is Grade 2.', '场地内没有一级农地，最好的是二级。') + '</div>';
    }
    mleg.innerHTML = h; mleg.hidden = false; mco.innerHTML = k === 6 && PX.soilKm ? soilCallouts(PX.soilKm[0], PX.soilKm[1]) : '';
  }
  var SC = null;
  function soilDepth() {                  // for Grade 1 and Grade 2: how deep inside the grade each place is (a label goes deep, where it is seen)
    if (SC && SC.g === PX.soilG) return SC; var G = PX.soilG; if (!G) return null; var out = [];
    [0, 1].forEach(function (q) { var feat = new Uint8Array(G.length), any = 0; for (var i = 0; i < G.length; i++) { feat[i] = G[i] === q ? 0 : 1; if (!feat[i]) any = 1; }
      out.push(any ? bdEDT(feat, PX.W, PX.H, false) : null); });
    SC = { g: G, e: out }; return SC;
  }
  function soilCallouts(g1, g2) {         // the label at the deepest place of its grade that is on screen and clear of the legend
    var sd = soilDepth(); if (!sd) return ''; var w = $('wrap').getBoundingClientRect(), r = mleg.getBoundingClientRect(), h = '', taken = [];
    var L = r.left - w.left - 190, T0 = r.top - w.top - 60, R = r.right - w.left + 10, B = r.bottom - w.top + 60;
    [[0, T('Grade 1', '一级'), g1], [1, T('Grade 2', '二级'), g2]].forEach(function (a) { var e = sd.e[a[0]]; if (!e || a[2] < 0.5) return; var best = 0, bx = 0, by = 0;
      for (var i = 0; i < e.length; i++) { if (e[i] <= best) continue; var x = sx(((i % PX.W) + 0.5) * PX.m), y = sy(DATA.size[1] - (Math.floor(i / PX.W) + 0.5) * PX.m);
        if (x < 30 || y < 70 || x > w.width - 230 || y > w.height - 40 || (x > L && x < R && y > T0 && y < B)) continue;
        if (taken.some(function (t) { return Math.abs(t[0] - x) < 220 && Math.abs(t[1] - y) < 60; })) continue; best = e[i]; bx = x; by = y; }
      if (!best) return; taken.push([bx, by]);
      h += '<div class="co" style="left:' + bx + 'px;top:' + by + 'px"><i></i><span>' + a[1] + ' · ' + a[2].toFixed(1) + ' km²</span></div>'; });
    return h;
  }

  // ---------------------------------------------------------------- each step's settings (params.js)
  var PR = window.__lcParams;
  function prow(p) {
    var v = PR.val(p), ch = PR.changed(p), off = p.off ? p.off() : '', id = p.id;
    var h = '<div class="pr' + (ch ? ' ch' : '') + (off ? ' off' : '') + '"><div class="a"><span>' + esc(PR.lab(p)) + (ch ? '<em>● ' + T('changed', '已改') + '</em>' : '') + '</span><span><b data-out="' + id + '">' + esc(PR.show(p, v)) + '</b>' +
      (ch ? '<button type="button" class="rs" data-reset="' + id + '" title="' + T('Back to the default: ', '恢复默认：') + esc(PR.show(p, p.def)) + '">↺</button>' : '') + '</span></div>';
    if (p.kind === 'range') { var q = Math.max(0, Math.min(1, (p.def - p.min) / (p.max - p.min)));
      h += '<div class="tr"><input type="range" data-p="' + id + '" min="' + p.min + '" max="' + p.max + '" step="' + p.st + '" value="' + v + '"' + (off ? ' disabled' : '') + ' aria-label="' + esc(PR.lab(p)) + '"><i class="dt" style="left:calc(8px + (100% - 16px) * ' + q.toFixed(4) + ')" title="' + T('default', '默认') + '"></i></div>'; }
    else if (p.kind === 'seg') { h += '<div class="sg2">' + p.opts.map(function (o) { return '<button type="button" data-pset="' + id + '" data-v="' + o[0] + '" class="' + (String(o[0]) === String(v) ? 'on' : '') + (String(o[0]) === String(p.def) ? ' df' : '') + '">' + esc(T(o[1][0], o[1][1])) + '</button>'; }).join('') + '</div>'; }
    else if (p.kind === 'chk') { h += '<div class="sg2"><button type="button" data-pset="' + id + '" data-v="1" class="' + (v ? 'on' : '') + (p.def ? ' df' : '') + '">' + T('on', '开') + '</button><button type="button" data-pset="' + id + '" data-v="0" class="' + (v ? '' : 'on') + (p.def ? '' : ' df') + '">' + T('off', '关') + '</button></div>'; }
    if (off) h += '<div class="nt">' + esc(off) + '</div>'; else if (p.note && ch) h += '<div class="nt">' + esc(T(p.note[0], p.note[1])) + '</div>';
    return h + '</div>';
  }
  function paramsBlock(k, ps, live) {
    var main = ps.filter(function (p) { return !p.more; }), more = ps.filter(function (p) { return p.more; }), h = '<div class="prm2">';
    if (!live) return '<div class="prm">' + ps.filter(function (p) { return !p.more || PR.changed(p); }).map(function (p) { return '<div><span>' + esc(PR.lab(p)) + '</span><b>' + esc(PR.show(p)) + '</b></div>'; }).join('') + '</div>';
    h += main.map(prow).join('');
    if (more.length) { var mc = more.filter(function (p) { return PR.changed(p); }).length;
      h += '<button type="button" class="mo" data-more="' + k + '"><span>' + T('More settings', '更多参数') + '（' + more.length + '）' + (mc ? ' · <em>' + T(mc + ' changed', '已改 ' + mc + ' 项') + '</em>' : ' · ' + esc(more.slice(0, 2).map(function (p) { return PR.lab(p); }).join('、')) + '…') + '</span><i>' + (P.more[k] ? '⌄' : '›') + '</i></button>';
      if (P.more[k]) h += '<div class="mb">' + more.map(prow).join('') + '</div>'; }
    if (k === 8 && $('edit')) { var on = typeof S !== 'undefined' && S.edit;
      h += '<div class="hand"><span>' + T('Anchors by hand, on the map', '在地图上手动加减锚点') + '</span><button type="button" data-edit="edit" class="' + (on ? 'on' : '') + '">' + (on ? T('Done', '完成') : T('Start ›', '开始 ›')) + '</button>' +
        ($('resetEdits') ? '<button type="button" data-edit="resetEdits">' + T('Undo mine', '撤销') + '</button>' : '') + '</div>' + (on ? '<div class="nt">' + T('Click a primary cell’s edge to add an anchor, an anchor to take it away.', '点一级单元边界加锚点，点锚点删掉。') + '</div>' : ''); }
    return h + '</div>';
  }
  var numOf = function (v) { var m = /-?\d[\d,]*(\.\d+)?/.exec(String(v)); return m ? { n: +m[0].replace(/,/g, ''), d: (m[1] || '').length - (m[1] ? 1 : 0) } : null; };
  function delta(a, b) { var x = numOf(a), y = numOf(b); if (!x || !y || x.n === y.n) return ''; var d = y.n - x.n, k = Math.max(x.d, y.d);
    return (d > 0 ? '+' : '−') + Math.abs(d).toFixed(k); }
  var hierKey = function () { return JSON.stringify({ r2: BD.p.r2 * 1000, r3: BD.p.r3 * 1000, exfirst: !!BD.p.exfirst, line: BD.p.line }); };
  // a change: the method worked out again from where it acts; the steps after this one are to be made again
  var applying = Promise.resolve();
  function apply(pairs) {
    pairs = pairs.filter(function (a) { return a[0] && !(String(PR.val(a[0])) === String(a[1])); }); if (!pairs.length) { render(); return; }
    var k = pairs[0][0].step;
    if (P.on && !P.wait) stop();
    P.busyParam = (P.busyParam || 0) + 1;
    applying = applying.then(async function () {
      try {
        var x0 = null; try { x0 = info(k); } catch (e) {} if (x0 && x0.res) P.prev[k] = x0.res.map(function (r) { return r[0]; });
        var i = idxOf(k); SEQ.forEach(function (q, j) { if (j > i) delete P.done[q]; }); P.done[k] = 0;
        if (!P.on) P.k = k;
        var st = null, relaxIt = false;
        if (S.step !== k && k > 0) { AN.hide(); setStep(k, true); }      // a done step's setting changed from a later step: back to it
        pairs.forEach(function (a) { var p = a[0]; p.set(a[1]); if (p.how === 'bake') st = st === null ? p.stage : Math.min(st, p.stage); if (p.relax) relaxIt = true; });
        if (st !== null) { P.phase = T('working out step ' + shown(k) + ' again…', '重算第 ' + shown(k) + ' 步…'); render(); await frame();
          var t0 = performance.now(); await window.__woolRedo(st, stage(k)); setStep(k, true);
          P.phase = T('worked out in ', '重算 ') + ((performance.now() - t0) / 1000).toFixed(1) + T(' s', ' 秒'); }
        else if (relaxIt) { if (S.step !== 10) setStep(10, true); var t1 = performance.now(), tick = setInterval(function () { P.phase = T('relaxing… ', '毛线松弛中 · ') + ((performance.now() - t1) / 1000).toFixed(1) + T(' s', ' 秒'); renderFlag(); }, 200);
          relax(); try { await untilP(function () { return S.relaxed && !S.busy; }); } finally { clearInterval(tick); }
          P.phase = T('relaxed in ', '松弛 ') + ((performance.now() - t1) / 1000).toFixed(1) + T(' s', ' 秒'); }
        else if (k > 20) { P.phase = T('tracing again…', '重新描路中…'); render(); var t2 = performance.now(); await wait(350);
          await untilP(function () { return typeof BD !== 'undefined' && !BD.busy && bdDone() && BD.res && BD.res.hkey === hierKey(); });
          P.phase = T('worked out in ', '重算 ') + ((performance.now() - t2) / 1000).toFixed(1) + T(' s', ' 秒'); }
        P.done[k] = 1; crisp();
      } catch (e) { console.error(e); P.phase = ''; }
      P.busyParam--; render();
      setTimeout(function () { if (!P.busyParam && !P.on) { P.phase = ''; render(); } }, 4000);
    });
    render();
  }
  var untilP = async function (okf) { var t0 = performance.now(); while (!okf()) { if (performance.now() - t0 > 600000) throw new Error('timed out'); await wait(120); } };
  function renderFlag() { var f = box && box.querySelector('.fc.cur .fl'); if (f) f.textContent = P.phase; }
  var settled = async function () { while (P.busyParam) await wait(100); };

  // ---------------------------------------------------------------- the player
  var wait = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };
  var frame = function () { return new Promise(function (r) { requestAnimationFrame(function () { setTimeout(r, 0); }); }); };
  var snap = function () { var c = document.createElement('canvas'); c.width = cv.width; c.height = cv.height; c.getContext('2d').drawImage(cv, 0, 0); return c; };
  var crisp = function () { if (typeof FC !== 'undefined') FC.pic = null; draw(); };
  var bdDone = function () { return typeof BD !== 'undefined' && !BD.busy && (BD.res === null || BD.key === JSON.stringify(bdParams()) + '|' + (S.relaxId || 0)); };
  var until = async function (okf, ms) { var t0 = performance.now(); while (!okf()) { if (!P.on && !P.single) throw new Error('stopped'); if (performance.now() - t0 > ms) throw new Error('timed out'); await wait(120); } };
  function viewFor(k) {                    // where each step happens
    var bb = function (cells) { var a = [1e9, 1e9, -1e9, -1e9]; cells.forEach(function (c) { for (var i = 0; i < c.ring.length; i += 2) { a[0] = Math.min(a[0], c.ring[i]); a[2] = Math.max(a[2], c.ring[i]); a[1] = Math.min(a[1], c.ring[i + 1]); a[3] = Math.max(a[3], c.ring[i + 1]); } }); return a; };
    if (k <= 3) { var Wm = DATA.size[0], Hm = DATA.size[1]; return { cx: Wm / 2, cy: Hm / 2, mpp: Math.max(Wm / (W * 0.96), Hm / (Hh * 0.92)) }; }
    var cells = DATA.cells;
    if (k >= 8 && k <= 10) { var st = DATA.stations.find(function (s) { return s.id === DATA.pick; }) || DATA.stations[0], c1 = DATA.cells.filter(function (c) { return st && c.id === st.cell; }); if (c1.length) cells = c1; }
    var b = bb(cells), padB = P.full ? 230 : 70;
    return { cx: (b[0] + b[2]) / 2, cy: (b[1] + b[3]) / 2 - (padB - 40) / 2 * Math.max((b[2] - b[0]) / (W * 0.84), (b[3] - b[1]) / ((Hh - padB) * 0.84)), mpp: Math.max((b[2] - b[0]) / (W * 0.84), (b[3] - b[1]) / ((Hh - padB) * 0.84)) };
  }
  async function camera(to) {
    var fr = { cx: S.view.cx, cy: S.view.cy, mpp: S.view.mpp };
    if (Math.abs(fr.cx - to.cx) < to.mpp * 2 && Math.abs(fr.cy - to.cy) < to.mpp * 2 && Math.abs(Math.log(fr.mpp / to.mpp)) < 0.01) return;
    AN.hide(); var t0 = performance.now(), ms = 800 / P.speed, e = function (u) { return u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2; };
    for (;;) { var u = Math.min(1, (performance.now() - t0) / ms), q = e(u);
      S.view.cx = fr.cx + (to.cx - fr.cx) * q; S.view.cy = fr.cy + (to.cy - fr.cy) * q; S.view.mpp = Math.exp(Math.log(fr.mpp) + (Math.log(to.mpp) - Math.log(fr.mpp)) * q);
      draw(); if (u >= 1) break; await frame(); if (P.ctl && P.ctl.dead) return; }
  }
  var stage = function (k) { return k <= 3 ? 1 : k <= 8 ? k : 8; };
  async function compute(k) {             // the step worked out (timed) and set
    var B = window.__WOOL_BAKER__, t0 = performance.now(), worked = false;
    if (k <= 10 && B && !B.done.has(stage(k))) { P.phase = T('working it out…', '计算中…'); render(); await frame(); await window.__woolUpTo(stage(k)); worked = true; }
    if (k > 20) { if (!S.relaxed) throw new Error('relax first'); P.phase = T('tracing the roads…', '描出道路中…'); render(); await frame(); setStep(k, true); worked = !bdDone(); await until(bdDone, 600000); }
    else setStep(k === 0 ? 1 : k, true);
    var ms = performance.now() - t0; if (worked) { P.ms[k] = ms; P.total += ms; }
    P.phase = worked ? T('worked out in ', '计算 ') + (ms / 1000).toFixed(1) + T(' s', ' 秒') : ''; render();
  }
  // the site, drawn over the ground: the cells traced, the loop on a dark casing (it must read over the mould), names on dark pills
  function sitePicture(base) {
    var c = document.createElement('canvas'); c.width = base.width; c.height = base.height; var g = c.getContext('2d'); g.drawImage(base, 0, 0); g.setTransform(DPR, 0, 0, DPR, 0, 0); g.lineJoin = g.lineCap = 'round';
    var cas = function (lines, w) { g.save(); g.strokeStyle = 'rgba(0,0,0,.88)'; g.filter = 'blur(2px)'; g.lineWidth = w * 3 + 6; g.beginPath(); lines.forEach(function (p) { path(g, p, false); }); g.stroke(); g.filter = 'none'; g.lineWidth = w + 4; g.stroke(); g.restore(); };
    var line = function (lines, col, w, dash) { g.save(); g.setLineDash(dash || []); g.strokeStyle = col; g.lineWidth = w; g.beginPath(); lines.forEach(function (p) { path(g, p, false); }); g.stroke(); g.restore(); };
    var pill = function (x, y, t, size, center) { g.save(); g.font = '700 ' + size + "px 'DM Sans','Noto Sans CJK SC',system-ui,sans-serif"; var w = g.measureText(t).width + 20, h = size + 12, x0 = center ? x - w / 2 : x;
      g.fillStyle = 'rgba(8,8,10,.88)'; g.beginPath(); g.roundRect(x0, y - h / 2, w, h, h / 2); g.fill(); g.strokeStyle = 'rgba(255,255,255,.45)'; g.lineWidth = 1; g.stroke(); g.fillStyle = '#fff'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(t, x0 + w / 2, y + 0.5); g.restore(); };
    var rings = DATA.cells.map(function (q) { return q.ring.concat(q.ring.slice(0, 2)); });
    cas(rings, 2); g.save(); g.shadowColor = 'rgba(255,255,255,.7)'; g.shadowBlur = 8; line(rings, '#fff', 2); g.restore();
    var orb = DATA.rail.filter(function (r) { return r.kind === 'orbital'; }).map(function (r) { return r.p; }), oth = DATA.rail.filter(function (r) { return r.kind !== 'orbital'; }).map(function (r) { return r.p; });
    cas(oth, 1.6); line(oth, 'rgba(255,255,255,.85)', 1.6, [10, 6]); cas(orb, 4); line(orb, '#fff', 4); line(orb, '#000', 2, [2, 10]);
    (DATA.cellLabels || []).forEach(function (l) { pill(sx(l.x), sy(l.y), String(l.name).replace(/\s+/g, ' ') + '  ' + (l.km2 || ''), 13, true); });
    DATA.stations.forEach(function (s) { var x = sx(s.x), y = sy(s.y); g.fillStyle = '#000'; g.beginPath(); g.arc(x, y, 9, 0, 7); g.fill(); g.fillStyle = '#fff'; g.beginPath(); g.arc(x, y, 5, 0, 7); g.fill();
      g.strokeStyle = '#fff'; g.lineWidth = 2; g.beginPath(); g.arc(x, y, 9, 0, 7); g.stroke(); pill(x + 14, y - 16, T('Station ', '车站 ') + s.id, 13); });
    if (orb[0]) { var p = orb[0], m = Math.floor(p.length * 0.62 / 2) * 2; pill(sx(p[m]) + 14, sy(p[m + 1]) + 26, T('The loop (rail)', '交通环线 Loop（轨道）'), 12); }
    return c;
  }
  function soilFocus(o) {                 // Grade 1 and Grade 2 as masks on the field's grid
    var G = PX.soilG; if (!G) return null; var f = new AN.Field(), m = [new Uint8Array(f.W * f.H), new Uint8Array(f.W * f.H)];
    for (var j = 0; j < f.H; j++) { var y = wy((j + 0.5) / f.k), gj = Math.floor((DATA.size[1] - y) / PX.m);
      for (var i = 0; i < f.W; i++) { var x = wx((i + 0.5) / f.k), gi = Math.floor(x / PX.m); if (gi < 0 || gj < 0 || gi >= PX.W || gj >= PX.H) continue; var q = G[gj * PX.W + gi]; if (q === 0) m[0][j * f.W + i] = 255; else if (q === 1) m[1][j * f.W + i] = 255; } }
    return { W: f.W, H: f.H, m: m };
  }
  async function playOne(k, before) {
    P.k = k; P.prog = 0; P.phase = ''; delete P.prev[k]; render();
    var ctl = P.ctl = { paused: P.paused, skip: false, speed: P.speed, dead: false };
    await camera(viewFor(k)); if (ctl.dead) return false;
    if (!before) { crisp(); before = AN.showing() ? AN.picture() : snap(); }
    AN.cover(before);
    if (k === 10) {                       // the wool: the real relaxation, live
      await compute(10); AN.hide();
      if (!S.relaxed) { P.phase = T('relaxing, live…', '毛线实时松弛中…'); render(); var t0 = performance.now(); relax(); await until(function () { return S.relaxed && !S.busy; }, 600000);
        var ms = performance.now() - t0; P.ms[10] = ms; P.total += ms; P.phase = T('relaxed in ', '松弛 ') + (ms / 1000).toFixed(1) + T(' s', ' 秒'); P.prog = 1; render(); return true; }
      crisp(); var after10 = snap(); var o10 = AN.spec(10); await AN.run(before, after10, o10, ctl, function (u) { P.prog = u; progress(); }); AN.hide(); return !ctl.dead;
    }
    var o0 = null;
    if (k === 0) { var op0 = Object.assign({}, V.op); await compute(0); V.op = Object.assign({}, op0, { mould: 0, rail: 0 }); crisp(); var base = snap(); V.op = op0; var after = sitePicture(base); }
    else { await compute(k); crisp(); await frame(); crisp(); after = snap(); }
    if (ctl.dead) { AN.hide(); return false; }
    var o = AN.spec(k);
    if (k === 0) AN.cover(base), before = base;
    var soil = k === 6 ? soilFocus(o) : null, g1 = PX.soilKm ? PX.soilKm[0] : 0;
    var tick = function (u) { P.prog = u; progress();
      if (k === 6 && soil) {                // the scan, then Grade 1 (or a note), then Grade 2, lit in turn
        var t = Math.min(1, u / 0.42), x = { t: t < 1 ? (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2) : 1 };
        var fz = function (a, b) { return u < a || u > b ? 0 : Math.min(1, (u - a) / 0.05, (b - u) / 0.05); };
        var f1 = g1 >= 0.5 ? fz(0.45, 0.7) : 0, f2 = fz(g1 >= 0.5 ? 0.72 : 0.5, 0.96);
        var want = f2 > 0 ? 1 : f1 > 0 ? 0 : -1; if (want !== o.__fm) { o.__fm = want; if (want >= 0) setFocus(o, soil, want); }
        x.focus = Math.max(f1, f2); return x; }
      if (o.pulseAt) { var a = o.pulseAt; return { pulse: u > a[0] && u < a[1] ? Math.sin(Math.PI * (u - a[0]) / (a[1] - a[0])) * 0.9 : 0 }; }
      return null; };
    if (soil) { setFocus(o, soil, 1); }
    var ok1 = await AN.run(before, after, o, ctl, tick);
    if (k !== 0) AN.hide();
    P.prog = 1; return ok1 && !ctl.dead;
  }
  function setFocus(o, soil, q) { o.focus = { W: soil.W, H: soil.H, m: soil.m[q] }; try { var gl = document.getElementById('lcAnim').getContext('webgl2'); if (gl) { gl.activeTexture(gl.TEXTURE3); gl.texImage2D(gl.TEXTURE_2D, 0, gl.R8, soil.W, soil.H, 0, gl.RED, gl.UNSIGNED_BYTE, soil.m[q]); } } catch (e) {} }
  var progress = function () { var i = box && box.querySelector('.fc.cur .pg i'); if (i) i.style.width = Math.round(P.prog * 100) + '%'; if (P.k === 6) mapExtras(); };
  async function play(from, only) {        // from: an index of SEQ; only: just that step
    if (P.running) return; P.running = true; P.on = true; P.paused = false; P.wait = false; P.single = !!only; render();
    try {
      for (var i = from; i < SEQ.length; i++) {
        var k = SEQ[i]; if (!P.on) break;
        if (isOff(k)) { if (only) break; continue; }
        if (k > 20 && !S.relaxed) { if (isOff(10)) await quietRelax(); else { await playOne(10); P.done[10] = 1; } }
        var ok1 = await playOne(k); if (!ok1 && !P.on) break;
        P.done[k] = 1; P.phase = P.ms[k] ? T('worked out in ', '计算 ') + (P.ms[k] / 1000).toFixed(1) + T(' s', ' 秒') : ''; P.prog = 1; render();
        if (only || i === SEQ.length - 1) break;
        if (P.stopEach) { P.wait = true; render(); await new Promise(function (r) { P.release = r; }); P.wait = false; P.release = null; if (!P.on) break; }
        else { var t0 = performance.now(); while (performance.now() - t0 < 1300 / P.speed) { await wait(60); if (!P.on) break; while (P.paused && P.on) await wait(100); } }
      }
    } catch (e) { if (String(e.message) !== 'stopped') console.error(e); }
    P.running = false; P.on = false; P.paused = false; P.wait = false; P.single = false; P.phase = ''; render();
  }
  function stop() { P.on = false; P.single = false; P.paused = false; if (P.ctl) { P.ctl.skip = true; P.ctl.dead = true; } if (P.release) P.release(); AN.hide(); render(); }
  function idxOf(k) { var i = SEQ.indexOf(k); return i < 0 ? 0 : i; }
  async function goTo(k, only) {          // a card or Next: the step before set at once, then this one played
    await settled();
    if (isOff(k)) { var nk = nextK(k); if (nk === undefined) return; k = nk; }
    if (P.running) { if (P.wait && P.release && nextK(P.k) === k) { P.release(); return; } stop(); var t0 = performance.now(); while (P.running && performance.now() - t0 < 8000) await wait(50); }
    if (P.prep) return; P.prep = true;              // one step being made ready at a time
    var i = idxOf(k), prev = prevK(k);
    try { if (prev !== undefined && prev !== 0 && S.step !== prev) { P.on = true; P.single = true; P.phase = T('working it out…', '计算中…'); P.k = k; render();
        if (prev > 20 && !S.relaxed) { await window.__woolUpTo(8); setStep(10, true); relax(); await until(function () { return S.relaxed && !S.busy; }, 600000); }
        if (prev <= 10) { var B = window.__WOOL_BAKER__; if (B && !B.done.has(stage(prev))) await window.__woolUpTo(stage(prev)); }
        setStep(prev, true); if (prev > 20) await until(bdDone, 600000); crisp(); }
      else if (prev === 0 || k === 0) { AN.hide(); if (k === 1) { var op0 = Object.assign({}, V.op); setStep(1, true); await camera(viewFor(0)); V.op = Object.assign({}, op0, { mould: 0, rail: 0 }); crisp(); var b0 = sitePicture(snap()); V.op = op0; crisp(); AN.cover(b0); } }
    } catch (e) { P.prep = false; if (String(e.message) !== 'stopped') console.error(e); P.on = false; render(); return; }
    P.prep = false; P.on = false; play(i, only);
  }
  async function back(from) {
    if (P.backing) return; var c = from !== null && from !== undefined ? from : cur(), i = idxOf(c), t = prevK(c); if (t === undefined) return;
    P.backing = true;
    if (P.running || P.on) { stop(); var t0 = performance.now(); while ((P.running || P.prep) && performance.now() - t0 < 8000) await wait(50); }
    try {
      SEQ.forEach(function (q, j) { if (j >= i) delete P.done[q]; }); P.done[t] = 1; P.open = {};
      if (t === 0) { var op0 = Object.assign({}, V.op); setStep(1, true); await camera(viewFor(0)); V.op = Object.assign({}, op0, { mould: 0, rail: 0 }); crisp(); var b0 = sitePicture(snap()); V.op = op0; crisp(); AN.cover(b0); }
      else { AN.hide();
        if (t > 20 && !S.relaxed) { P.on = true; P.single = true; P.k = t; P.phase = T('working it out…', '计算中…'); render(); await window.__woolUpTo(8); setStep(10, true); relax(); await until(function () { return S.relaxed && !S.busy; }, 600000); }
        setStep(t, true); if (t > 20) { P.on = true; P.single = true; await until(bdDone, 600000); }
        else if (window.__WOOL_BAKER__ && !window.__WOOL_BAKER__.done.has(stage(t))) { P.on = true; P.single = true; await until(function () { return S.step === t; }, 600000); }
        await camera(viewFor(t)); crisp(); }
    } catch (e) { if (String(e.message) !== 'stopped') console.error(e); }
    P.on = false; P.single = false; P.phase = ''; P.k = t; P.prog = 1; P.follow = null; P.backing = false; render();
    var cd = box && box.querySelector('.fc.cur'); if (cd) cd.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }
  async function finishNow() {
    stop(); var t0 = performance.now(); while (P.running && performance.now() - t0 < 8000) await wait(50);
    P.on = true; P.single = true; P.phase = T('working it all out…', '全部计算中…'); P.k = 26; render();
    try { var B = window.__WOOL_BAKER__; if (B && window.__woolUpTo) await window.__woolUpTo(8);
      if (!S.relaxed) { setStep(10, true); relax(); await until(function () { return S.relaxed && !S.busy; }, 600000); }
      setStep(26, true); await until(bdDone, 600000); SEQ.forEach(function (k) { if (!isOff(k)) P.done[k] = 1; }); crisp(); } catch (e) { console.error(e); }
    P.on = false; P.single = false; P.phase = ''; P.k = null; render();
  }
  function toggleFull() {
    P.full = !P.full; H.classList.toggle('lcfull', P.full);
    setTimeout(function () { resize(); if (ok()) { var v = viewFor(P.k !== null ? P.k : S.step); S.view.cx = v.cx; S.view.cy = v.cy; S.view.mpp = v.mpp; } AN.hide(); crisp();
      if (P.k === 0 && !P.running && ok()) { var op0 = Object.assign({}, V.op); V.op = Object.assign({}, op0, { mould: 0, rail: 0 }); crisp(); var b0 = sitePicture(snap()); V.op = op0; crisp(); AN.cover(b0); }      // the site stays shown
      render(); var cd = box && box.querySelector('.fc.cur'); if (cd && !P.full) cd.scrollIntoView({ block: 'nearest' }); }, 30);
  }
  function mapTouched(ev) { if (P.ctl && !P.ctl.dead && AN.showing()) { P.ctl.skip = true; } if (ev === 'wheel' || (!P.on && AN.showing())) AN.hide(); }
  function onKey(e) {
    if (e.metaKey || e.ctrlKey || e.altKey || (e.target && /INPUT|TEXTAREA|SELECT/.test(e.target.tagName) && e.target.type !== 'range')) return;
    if (e.key === 'Escape' && P.full) { toggleFull(); e.preventDefault(); return; }
    if (!P.full && !(e.target === document.body || (e.target.closest && e.target.closest('#lcFlow,#lcFS,#wrap')))) return;
    if (e.key === ' ') { e.preventDefault(); playPause(); }
    else if (e.key === 'ArrowRight') { e.preventDefault(); next(); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); back(); }
  }
  function cur() { return P.k !== null ? P.k : (S.step === 1 && !P.done[1] ? 0 : S.step); }
  function next() { var n = nextK(cur()); if (P.wait && P.release) { settled().then(function () { if (P.release) P.release(); }); return; } if (n !== undefined) goTo(n, P.stopEach || !P.on); }
  function playPause() {
    if (P.on && P.wait) { P.release(); return; }
    if (P.on) { P.paused = !P.paused; if (P.ctl) P.ctl.paused = P.paused; render(); return; }
    var c = cur(), i = idxOf(c); if (P.done[26] || (c === 26 && P.done[c])) { P.done = {}; P.total = 0; P.ms = {}; i = 0; } else if (P.done[c]) { var nc = nextK(c); i = nc === undefined ? SEQ.length - 1 : idxOf(nc); }
    if (i === 0) goTo(0); else goTo(SEQ[i]);
  }
  function onClick(e) {
    var t = e.target.closest('button,[data-go],[data-set]'); if (!t) return;
    var d = t.dataset;
    if (d.play) playPause();
    else if (d.pause) { if (P.on) { P.paused = !P.paused; if (P.ctl) P.ctl.paused = P.paused; render(); } }
    else if (d.now) finishNow();
    else if (d.full) toggleFull();
    else if (d.each) { P.stopEach = !P.stopEach; save(); render(); }
    else if (d.spd) { var s = [0.5, 1, 1.5, 2], j = (s.indexOf(P.speed) + 1) % s.length; P.speed = s[j < 0 ? 1 : j]; if (P.ctl) P.ctl.speed = P.speed; save(); render(); }
    else if (d.all) { P.all = !P.all; render(); }
    else if (d.prev || d.back) back(d.back && d.back !== 'cur' ? +d.back : null);
    else if (d.next) next();
    else if (d.way) { stop(); setStep(27); P.k = null; render(); }
    else if (d.more) { P.more[d.more] = !P.more[d.more]; render(); }
    else if (d.reset) { var p0 = PR.byId(d.reset); if (p0) apply([[p0, p0.def]]); }
    else if (d.resetall) { apply(PR.of(+d.resetall).filter(function (p) { return PR.changed(p); }).map(function (p) { return [p, p.def]; })); }
    else if (d.pset) { var p1 = PR.byId(d.pset); if (p1) apply([[p1, p1.kind === 'seg' && typeof p1.def === 'number' ? +d.v : p1.kind === 'chk' ? +d.v : d.v]]); }
    else if (d.edit) { var eb = $(d.edit); if (eb) eb.click(); render(); }
    else if (d.open !== undefined) { var k = +d.open; if (k === 27) { stop(); setStep(27); P.k = null; render(); return; }
      if (k === 28) { stop(); if (typeof BD !== 'undefined' && BD.res && BD.res.hier && !BD.busy) { setStep(28); P.k = null; } else P.open[28] = !P.open[28]; render(); return; }      // with no roads yet (steps 11–16) it only says so (evaluate.js)
      if (isOff(k)) { P.open[k] = !P.open[k]; render(); return; }               // a step passed over only says why
      if (P.done[k] && !P.on) { P.open[k] = !P.open[k]; render(); return; }     // a step done opens or folds; one not yet done is played
      goTo(k, true); }
    else if (d.go !== undefined) { var g = +d.go; if (P.wait && P.release && nextK(P.k) === g) { P.release(); return; } goTo(g, P.stopEach || !P.on || true); }
    if (P.ctl) P.ctl.speed = P.speed;
  }
  // the page's own hooks: a step set elsewhere, a stage being worked out
  window.__lcRender = function () { if (!P.running && !P.on && !P.backing && P.k !== (S.step === 1 && P.k === 0 ? 0 : S.step)) { P.k = null; } render(); };
  window.__lcBusy = function (st) { if (P.running) return; P.phase = st ? T('working it out…', '计算中…') : ''; render(); };
  window.__lcDemo = function () { if (!H.classList.contains('l2ui')) return; build(); render(); if (/[#&]demo\b/.test(location.hash)) setTimeout(function () { goTo(0); }, 400); };
  var boot = function () { if (!H.classList.contains('l2ui')) return; if (ok() && $('left')) { build(); render(); } else setTimeout(boot, 300); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
