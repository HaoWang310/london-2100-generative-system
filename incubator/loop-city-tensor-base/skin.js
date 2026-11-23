/* Loop City step 3 · the interface, one with the other apps (22 Nov 2026).
   Title, language and collapse in a fixed head; where the step stands in the chain; a head for the display panel.
   Every control keeps its id and handlers. `#noskin` in the address shows the page as it was. */
(function () {
  'use strict';
  var H = document.documentElement;
  if (!H.classList.contains('l2ui')) return;
  var $ = function (id) { return document.getElementById(id); };
  var L = $('left'), R = $('right');
  if (!L || !R) { H.classList.remove('l2ui'); return; }
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
  var hl = el('div', 'l2-head'), hb = el('div', 'l2-hb'), h1 = L.querySelector('h1');
  if (h1) hl.appendChild(h1);
  if ($('langbar')) hb.appendChild($('langbar'));
  hb.appendChild(colBtn(L)); hl.appendChild(hb);
  L.insertBefore(hl, L.firstChild);

  var meta = el('div');
  meta.appendChild(el('div', 'l2-badge', 'Loop City · step 3 · base for the tensor field', 'Loop City · 第 3 步 · 张量场底图'));
  var row = el('div'), back = el('a', 'l2-back', '← Step 2, the wool bands', '← 第 2 步：毛线带');
  back.href = '../loop-city-wool/'; row.appendChild(back);
  if ($('openAgain')) { $('openAgain').classList.add('l2-back'); $('openAgain').classList.remove('btn'); row.appendChild($('openAgain')); }
  meta.appendChild(row);
  var after = $('cellsLine') || hl;
  after.parentNode.insertBefore(meta, after.nextSibling);

  var hr = el('div', 'l2-head'), colR = colBtn(R);
  hr.appendChild(el('span', 'rh', 'Display', '显示')); hr.appendChild(colR);
  R.insertBefore(hr, R.firstChild);
  if (window.innerWidth <= 600) { R.classList.add('l2-col'); colR.textContent = '+'; }

  new MutationObserver(relabel).observe(H, { attributes: true, attributeFilter: ['lang'] });
  relabel(); setTimeout(relabel, 1000);
  /* ---- the phone (23 Nov 2026): the one layout of shared/ui/phone. The site panel is the sheet along the bottom:
     folded it shows the name, the cells in hand, and the main action (save the site for the tensor field); the
     display panel opens from the Display button at the top left. */
  if (window.L2Phone && L2Phone.is()) {
    L.classList.remove('l2-col'); R.classList.remove('l2-col');
    L2Phone.init({
      sheet: L, display: R, quick: [$('saveSite')], hide: [h1, hb.querySelector('.l2-icon'), colR, hr], zh: isZh,
      title: function () { return h1 ? h1.textContent.replace(/\s+/g, ' ').trim() : 'Loop City'; },
      status: function () { var c = $('cellsLine'); return c ? c.textContent.replace(/\s+/g, ' ').trim() : ''; }
    });
  }
  try { window.dispatchEvent(new Event('resize')); } catch (e) { /* the map re-fits itself */ }
})();
