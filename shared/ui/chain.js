/* The chain row (26 Nov 2026). One line under an app's title, the same in every catalogue app:
     [ ‹ the step before ]  [ Next · the step after › ]
     what goes with it, or what is still missing
   above them seven marks for the research line: London map → 1 mould → 2 wool → 3 base → Tensor Studio →
   Structure Studio → VR. The whole system stands beside the line; it has no marks.

   An app mounts it once:
     L2Chain.mount({ id, into, before?, base?, lang?, light?, state?, go? })
       id      the app's catalogue id
       into    the element (or selector) the row goes into; before: put it before this child, else at the end
       base    the way to the incubator folder from this page ('../' from an app, 'incubator/' from the root page)
       lang    () => 'zh' | 'en'; by default the page's <html lang>
       light   true, or () => true while the panel is light; left out, it is read from the panel's own ground
       shellSelf  true on the root page, which is the catalogue itself
       state   () => ({ ready, carry: [en, zh], need: [en, zh] }) for a step that hands its result on; without it the
               next step is simply opened
       go      () => {…} the app's own hand-over, called when the result is ready
   The row is drawn again whenever its state or the language changes (looked at twice a second: no hooks in the app).

   Rules: Next opens the next app in a new tab, so this page stays and can hand over again. The step before opens in
   this page, with nothing carried. Framed by another app (Tensor Studio inside the London map or inside Structure
   Studio) the row is not shown: that app has its own way back. Framed by the catalogue, the ways go through it. */
(function () {
  'use strict';
  var NAME = {
    'catalogue': ['Catalogue', '目录'],
    'workspace': ['The whole system', '多尺度系统'],
    'google-map-live': ['London map', '伦敦地图'],
    'loop-city-mould-growth': ['1 Mould', '1 黏菌'],
    'loop-city-wool': ['2 Wool bands', '2 毛线带'],
    'loop-city-tensor-base': ['3 Tensor base', '3 张量场底图'],
    'tensor-studio': ['Tensor Studio', '张量场工作室'],
    'structure-studio': ['Structure Studio', '结构工作室'],
    'vr': ['VR', 'VR']
  };
  var LINE = ['google-map-live', 'loop-city-mould-growth', 'loop-city-wool', 'loop-city-tensor-base', 'tensor-studio', 'structure-studio', 'vr'];
  var BESIDE = { 'workspace': 'google-map-live' };     // beside the line: where each goes next
  function prevOf(id) { var i = LINE.indexOf(id); return i > 0 ? LINE[i - 1] : 'catalogue'; }
  function nextOf(id) { var i = LINE.indexOf(id); return i >= 0 ? (LINE[i + 1] || 'catalogue') : (BESIDE[id] || 'catalogue'); }

  // the catalogue's own window, when this page is the app it shows (never another app that frames this one)
  function shell() { try { var p = window.parent; if (p !== window && p.document.getElementById('appview') && p.document.getElementById('catalogue')) return p; } catch (e) {} return null; }
  function framedByApp() { if (window.parent === window) return false; return !shell(); }

  var M = null;
  function lang() { try { var l = M && M.lang ? M.lang() : document.documentElement.lang; return /^zh/i.test(l || '') ? 'zh' : 'en'; } catch (e) { return 'en'; } }
  function T(pair) { return !pair ? '' : typeof pair === 'string' ? pair : pair[lang() === 'zh' ? 1 : 0]; }
  function root() { return (M.base || '../') + '../'; }                              // the repository's root page, from here
  function inCatalogue() { return !!(M.shellSelf || shell()); }
  function hrefOf(id, inShell) {
    if (id === 'catalogue') return root() + 'index.html#catalogue';
    if (id === 'workspace') return root() + 'index.html#workspace';
    return inShell ? root() + 'index.html#app/' + id : (M.base || '../') + id + '/';
  }
  function toPrev(id) {                                                              // in this page, nothing carried
    var sh = shell() || (M.shellSelf ? window : null); if (sh) { sh.location.hash = id === 'catalogue' ? 'catalogue' : id === 'workspace' ? 'workspace' : 'app/' + id; return; }
    location.href = hrefOf(id, false);
  }
  function openNext(id) {                                                            // a new tab; inside the catalogue, the catalogue showing that app
    if (id === 'catalogue') { toPrev('catalogue'); return true; }
    var w = window.open(hrefOf(id, inCatalogue()), 'l2100-' + id); return !!w;
  }

  function state() { var s = null; try { s = M.state ? M.state() : null; } catch (e) { s = { ready: false, need: ['Not ready yet.', '还没有准备好。'] }; } return s; }
  // a light panel: said by the app, or read from the panel itself (the first ground behind the row that is not see-through)
  function light() { try { if (M.light != null) return !!(typeof M.light === 'function' ? M.light() : M.light);
      for (var n = M.el.parentNode; n && n.nodeType === 1; n = n.parentNode) { var c = getComputedStyle(n).backgroundColor, m = /rgba?\(([\d.]+)[, ]+([\d.]+)[, ]+([\d.]+)(?:[,/ ]+([\d.]+))?/.exec(c || '');
        if (m && (m[4] === undefined || +m[4] > 0.5)) return (0.2126 * m[1] + 0.7152 * m[2] + 0.0722 * m[3]) / 255 > 0.6; }
    } catch (e) {} return false; }
  function key() { var s = state(); return [lang(), light() ? 'L' : '', framedByApp() ? 'f' : '', s ? (s.ready ? 1 : 0) + '|' + T(s.carry) + '|' + T(s.need) : 'open'].join('~'); }

  function draw() {
    if (!M || !M.el) return; var el = M.el, id = M.id, zh = lang() === 'zh';
    if (framedByApp()) { el.hidden = true; return; } el.hidden = false; el.classList.toggle('light', light()); el.classList.toggle('narrow', el.clientWidth > 0 && el.clientWidth < 270);
    var pv = prevOf(id), nx = nextOf(id), s = state(), i = LINE.indexOf(id), h = '';
    if (i >= 0) { h += '<div class="l2c-dots" aria-hidden="true">'; for (var k = 0; k < LINE.length; k++) h += '<i class="' + (k < i ? 'done' : k === i ? 'on' : '') + '"></i>'; h += '</div>'; }
    var off = !!(s && !s.ready), end = nx === 'catalogue';
    h += '<div class="l2c-row"><button type="button" class="l2c-bk" data-l2c="prev">‹ ' + esc(T(NAME[pv])) + '</button>' +
      '<button type="button" class="l2c-nx' + (off ? ' off' : '') + '" data-l2c="next"' + (off ? ' aria-disabled="true"' : '') + '>' +
      (end ? (zh ? '回到目录' : 'Back to the catalogue') : (zh ? '下一步 · ' : 'Next · ') + esc(T(NAME[nx]))) + ' ›</button></div>';
    var hint;
    if (end) hint = zh ? '主线的最后一站。' : 'The last stop on the line.';
    else if (!s) hint = zh ? '打开「' + T(NAME[nx]) + '」；这一步不带数据。' : 'Opens ' + T(NAME[nx]) + '; nothing is carried on this step.';
    else if (s.ready) hint = (zh ? '带上：' : 'Carries: ') + esc(T(s.carry));
    else hint = esc(T(s.need)) + ' <a data-l2c="example">' + (zh ? '去看「' + T(NAME[nx]) + '」的范例 ›' : 'See the example in ' + T(NAME[nx]) + ' ›') + '</a>';
    h += '<div class="l2c-hint' + (s && s.ready ? ' carry' : '') + '" data-l2c-hint>' + hint + '</div>';
    el.innerHTML = h; M.key = key();
  }
  function esc(t) { return String(t == null ? '' : t).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function say(pair) { var h = M.el.querySelector('[data-l2c-hint]'); if (h) { h.className = 'l2c-hint'; h.textContent = T(pair); } }
  function click(e) {
    var b = e.target.closest ? e.target.closest('[data-l2c]') : null; if (!b || !M) return; var what = b.getAttribute('data-l2c'), nx = nextOf(M.id);
    if (what === 'prev') { toPrev(prevOf(M.id)); return; }
    if (what === 'example') { if (!openNext(nx)) say(['The browser blocked the new tab. Allow pop-ups for this page, then try again.', '浏览器拦截了新标签页。请允许本页面弹出窗口后再试。']); return; }
    var s = state(); if (s && !s.ready) return;                                     // grey: the line under it says what is missing
    if (s && M.go) { try { M.go(); } catch (err) { say(['The hand-over did not work: ' + (err.message || err), '交接没有成功：' + (err.message || err)]); } return; }
    if (!openNext(nx)) say(['The browser blocked the new tab. Allow pop-ups for this page, then try again.', '浏览器拦截了新标签页。请允许本页面弹出窗口后再试。']);
  }
  function mount(o) {
    var into = typeof o.into === 'string' ? document.querySelector(o.into) : o.into; if (!into || !NAME[o.id]) return null;
    var el = document.createElement('nav'); el.className = 'l2chain'; el.setAttribute('translate', 'no'); el.setAttribute('aria-label', 'Research line');
    var before = typeof o.before === 'string' ? into.querySelector(o.before) : o.before;
    if (before && before.parentNode) before.parentNode.insertBefore(el, before); else into.appendChild(el);
    M = { id: o.id, el: el, base: o.base, lang: o.lang, light: o.light, state: o.state, go: o.go, shellSelf: !!o.shellSelf, key: '' };
    el.addEventListener('click', click); draw();
    setInterval(function () { try { if (M.key !== key()) draw(); } catch (e) {} }, 500);
    return el;
  }
  window.L2Chain = { mount: mount, refresh: function () { try { draw(); } catch (e) {} }, line: LINE.slice(), name: function (id) { return T(NAME[id]); }, next: nextOf, prev: prevOf, open: function (id) { return openNext(id); } };
})();
