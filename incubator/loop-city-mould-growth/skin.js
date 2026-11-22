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
  function relabel() { T.forEach(function (t) { t[0].textContent = isZh() ? t[2] : t[1]; }); }
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

  var top = el('div');
  add(top,
    el('div', 'lc-lead', 'The city and its roads grown together round the whole loop, 2025 to 2100. When the century ends the cells are read from the mould’s highways, and one of them goes on to step 2.', '城市与道路在整条环线上共同生长，2025 至 2100 年。百年结束后，从黏菌的干道读出单元，选一个送往第 2 步。'),
    el('div', 'lc-badge', 'Loop City · step 1 · the 412 km loop', 'Loop City · 第 1 步 · 412 km 环线'),
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

  var adv = el('div', 'lc-adv'), advBtn = el('button', 'lc-advbtn'), advBody = el('div', 'lc-advbody');
  advBtn.type = 'button';
  var ac = el('span', 'lc-chev'); ac.textContent = '›';
  add(advBtn, ac, el('span', '', 'All settings', '全部参数'));
  advBtn.onclick = function () { adv.classList.toggle('open'); };
  add(advBody, el('p', 'lc-advnote', 'Every slider and switch of the two models and of the older methods. Moving one that changes a run means running the century again.', '两个模型和旧方法的全部滑块与开关。改动会影响运行的参数后，需要重新运行百年。'));
  leftRest.forEach(function (d) { d.open = false; advBody.appendChild(d); });
  rightRest.forEach(function (d) { if (d.tagName === 'DETAILS') d.open = false; advBody.appendChild(d); });
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
    var running = $('btnRun').classList.contains('running'), sel = !$('btnLiveOpen').disabled;
    big.textContent = (txt('cRoad1') || '0') + ' km';
    vBuilt.textContent = (txt('cBuilt') || '0') + ' km²'; vFarm.textContent = (txt('cFarm') || '0') + ' km²';
    vCells.textContent = cells ? String(cells) : '–';
    var yr = txt('vYear') || '2025', zh = isZh();
    pill.textContent = running ? (zh ? '正在生长 · ' : 'Growing · ') + yr
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
  }
  openOnly(0);
  if (window.innerWidth <= 600) { PR.classList.add('lc-col'); var cb = hr.querySelector('.lc-icon'); if (cb) cb.textContent = '+'; }
  setInterval(tick, 400); tick();

  /* ------------------------------------------------------------------ language */
  var old = window.setLang;
  if (typeof old === 'function') window.setLang = function () { var r = old.apply(this, arguments); relabel(); return r; };
  if ($('langbar')) $('langbar').addEventListener('click', function () { setTimeout(relabel, 0); setTimeout(relabel, 300); });
  relabel(); setTimeout(relabel, 800);
  try { window.dispatchEvent(new Event('resize')); } catch (e) { /* the map re-fits itself */ }
})();
