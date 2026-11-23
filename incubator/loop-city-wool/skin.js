/* Loop City step 2 · the interface, one with the other apps (22 Nov 2026).
   It keeps every control of the page, with its id and its handlers, and only moves a few of them:
   the title and the language switch into a fixed head, Previous / Next under the seventeen steps, the sliders into
   one fold, the numbers and the saving into the display panel. `#noskin` in the address shows the page as it was. */
(function () {
  'use strict';
  var H = document.documentElement;
  if (!H.classList.contains('l2ui')) return;
  var $ = function (id) { return document.getElementById(id); };
  var L = $('left'), R = $('right'), steps = L && L.querySelector('.steps');
  if (!L || !R || !steps || !$('run')) { H.classList.remove('l2ui'); return; }

  var T = [];
  function isZh() { return /^zh/i.test(H.lang || ''); }
  function el(tag, cls, en, zh) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    e.setAttribute('translate', 'no');
    if (en !== undefined) { T.push([e, en, zh]); e.textContent = isZh() ? zh : en; }
    return e;
  }
  function relabel() { T.forEach(function (t) { var s = isZh() ? t[2] : t[1]; if (t[0].textContent !== s) t[0].textContent = s; }); }
  function colBtn(panel) {
    var b = el('button', 'l2-icon'); b.type = 'button'; b.textContent = '–';
    b.onclick = function () { panel.classList.toggle('l2-col'); b.textContent = panel.classList.contains('l2-col') ? '+' : '–'; };
    return b;
  }
  function h2Before(node) { var p = node && node.previousElementSibling; return p && p.tagName === 'H2' ? p : null; }

  /* ---- left head: title, language, collapse */
  var hl = el('div', 'l2-head'), hbL = el('div', 'l2-hb');
  var h1 = L.querySelector('h1');
  if (h1) hl.appendChild(h1);
  if ($('langbar')) hbL.appendChild($('langbar'));
  var colL = colBtn(L); hbL.appendChild(colL); hl.appendChild(hbL);
  L.insertBefore(hl, L.firstChild);

  /* ---- where this step stands in the chain */
  var about = L.querySelector('p.about');
  var meta = el('div');
  meta.appendChild(el('div', 'l2-badge', 'Loop City · step 2 · the wool bands', 'Loop City · 第 2 步 · 毛线带'));
  var back = el('a', 'l2-back', '← Step 1, the whole loop', '← 第 1 步：整环'); back.href = '../loop-city-mould-growth/';
  var navrow = el('div'); navrow.appendChild(back); if ($('liveAgain')) navrow.appendChild($('liveAgain')); meta.appendChild(navrow);
  if (about) about.parentNode.insertBefore(meta, about.nextSibling);

  /* ---- previous / next under the seventeen steps */
  var list = [].slice.call(steps.querySelectorAll('button[data-step]'));
  var nav = el('div', 'l2-nav'), bp = el('button', '', '‹ Previous', '‹ 上一步'), bn = el('button', 'nx', 'Next ›', '下一步 ›');
  bp.type = bn.type = 'button';
  function cur() { for (var i = 0; i < list.length; i++) if (list[i].classList.contains('on')) return i; return -1; }
  bp.onclick = function () { var i = cur(); if (i > 0) list[i - 1].click(); };
  bn.onclick = function () { var i = cur(); if (i < list.length - 1) list[i + 1].click(); };
  nav.appendChild(bp); nav.appendChild(bn);
  steps.parentNode.insertBefore(nav, steps.nextSibling);
  function navState() { var i = cur(); bp.disabled = i <= 0; bn.disabled = i < 0 || i >= list.length - 1; }

  /* ---- every slider in one fold. The page builds one of its groups (#bdPanel) later and puts it before the
     numbers, so the fold takes whatever stands between the anchors heading and the sources line, whenever it arrives. */
  var first = $('edit') ? h2Before($('edit').parentElement) : null;
  var adv = el('div', 'l2-adv'), ab = el('button', 'l2-advbtn'), body = el('div', 'l2-advbody');
  ab.type = 'button';
  var ch = el('span', 'ch'); ch.textContent = '›';
  ab.appendChild(ch); ab.appendChild(el('span', '', 'All settings', '全部参数'));
  ab.onclick = function () { adv.classList.toggle('open'); };
  adv.appendChild(ab); adv.appendChild(body);
  if (first) first.parentNode.insertBefore(adv, first);
  function gather() {
    if (!first) return;
    var n = adv.nextElementSibling, nx;
    while (n && !n.classList.contains('src')) { nx = n.nextElementSibling; body.appendChild(n); n = nx; }
    var late = $('bdPanel');
    if (late && late.parentNode !== body) body.appendChild(late);
  }

  /* ---- right: display. Head, then the numbers; the saving at the end */
  var hr = el('div', 'l2-head');
  hr.appendChild(el('span', 'rh', 'Display', '显示'));
  var colR = colBtn(R); hr.appendChild(colR);
  R.insertBefore(hr, R.firstChild);
  /* The page finds its own "Numbers" heading in the left panel when a package starts, and builds #bdPanel before it.
     So the numbers, the saving and the fold are moved only once that has happened. */
  var moved = false;
  function late() {
    if (moved || !$('bdPanel')) return;
    moved = true;
    var nums = $('nums'), numsH = h2Before(nums), anchor = hr.nextSibling;
    if (nums && numsH) { R.insertBefore(numsH, anchor); R.insertBefore(nums, anchor); numsH.classList.add('l2-first'); }
    var png = $('png'), saveBox = png && png.parentElement, saveH = h2Before(saveBox);
    if (saveBox && saveH) { R.appendChild(saveH); R.appendChild(saveBox); }
    gather(); relabel();
  }
  adv.style.display = 'none';
  new MutationObserver(function () { late(); if (moved) { adv.style.display = ''; gather(); } }).observe(L, { childList: true, subtree: true });
  late(); if (moved) adv.style.display = '';

  if (window.innerWidth <= 600) { R.classList.add('l2-col'); colR.textContent = '+'; }

  /* ---- keep in step with the page */
  new MutationObserver(function () { relabel(); }).observe(H, { attributes: true, attributeFilter: ['lang'] });
  new MutationObserver(navState).observe(steps, { attributes: true, subtree: true, attributeFilter: ['class'] });
  relabel(); navState(); setTimeout(function () { relabel(); navState(); }, 1200);
  /* ---- the phone (23 Nov 2026): the one layout of shared/ui/phone. The steps panel is the sheet along the bottom:
     folded it shows the name, the step the page is on, and Previous / Next; the display panel opens from the
     Display button at the top left. */
  if (window.L2Phone && L2Phone.is()) {
    L.classList.remove('l2-col'); R.classList.remove('l2-col');
    L2Phone.init({
      sheet: L, display: R, quick: [bp, bn], hide: [h1, colL, colR, hr, nav], zh: isZh,
      title: function () { return h1 ? h1.textContent.replace(/\s+/g, ' ').trim() : 'Loop City'; },
      status: function () { var i = cur(); return i >= 0 ? list[i].textContent.replace(/\s+/g, ' ').trim() : ''; }
    });
  }
  try { window.dispatchEvent(new Event('resize')); } catch (e) { /* the map re-fits itself */ }
})();
