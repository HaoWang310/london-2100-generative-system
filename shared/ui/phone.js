/* London 2100 · the one phone layout (23 Nov 2026): the sheet and the Display button, built from what an app hands over.
   See phone.css for the layout. A classic script, no imports: an app loads it after its own interface script and calls

     L2Phone.init({
       sheet:   element,              // the app's working panel: becomes the sheet along the bottom
       title:   () => string,         // the app's name, in the language of the moment
       status:  () => string,         // one line: where the app stands (may be empty)
       quick:   [elements],           // its main action(s): moved to the folded sheet, their handlers untouched
       narrow:  [elements],           // those of quick that stay narrow (a Reset beside a Run)
       display: element,              // the app's display panel: opens across the top
       lang:    element,              // the app's own language switch: floats at the top right, level with Display
       hide:    [elements]            // what the phone layout replaces (the app's own title, its collapse buttons)
     })

   Nothing is cloned: the app's own controls are moved, with their ids and their handlers. Without html.l2phone
   (a computer, an iPad) init does nothing and returns null. */
(function () {
  'use strict';
  var root = document.documentElement;
  function zh() { return /^zh/i.test(root.lang || '') || /^zh/i.test((document.body && document.body.lang) || ''); }
  function mk(tag, cls) { var e = document.createElement(tag); if (cls) e.className = cls; e.setAttribute('translate', 'no'); return e; }
  /* The sheet follows the finger (24 Nov 2026), as the sheets of the iPhone's own apps do. A finger can take it by the
     handle or by the whole head (the name and the status line; the head's own buttons stay buttons). While it moves the
     sheet's height is the finger's, with the panel's contents shown underneath; on release it settles, open or folded,
     by the way it was flicked or, when it was let go slowly, by how far it was pulled (a quarter of the way is enough). A tap on the handle or the head opens or
     folds it, as before, and so does + / –; both glide. Everything is set on the elements themselves, so an app with a
     sheet of its own (Loop City step 1) can use it too:

       L2Phone.drag({ sheet, body, grips: [elements], isOpen: () => bool, set: open => {…} })   →   { to(open) }

     body is the part that shows only when the sheet is open; set(open) is the app's own open / fold (its classes, its
     labels). The open sheet stands as high as its contents need, at most 72 % of the screen. */
  function drag(o) {
    var sheet = o.sheet, body = o.body, grips = (o.grips || []).filter(Boolean), d = null, timer = 0, ends = null;
    var calm = false; try { calm = matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { /* older browsers */ }
    if (!sheet || !body) return null;
    function screenH() { return (window.visualViewport && window.visualViewport.height) || window.innerHeight; }
    function hgt(v) {
      if (v == null) { sheet.style.removeProperty('height'); sheet.style.removeProperty('max-height'); return; }
      sheet.style.setProperty('height', Math.round(v) + 'px', 'important'); sheet.style.setProperty('max-height', 'none', 'important');
    }
    function showBody(v) { if (v) body.style.setProperty('display', 'block', 'important'); else body.style.removeProperty('display'); }
    function glide(v) { sheet.style.setProperty('transition', v ? 'height .32s cubic-bezier(.2,.8,.2,1)' : 'none', 'important'); }
    function now() { return sheet.getBoundingClientRect().height; }
    /* call with the sheet's height fixed and its contents shown: the folded height, and the open one */
    function folded() { return now() - body.getBoundingClientRect().height; }
    function opened(f) { return Math.max(f, Math.min(screenH() * 0.72, f + body.scrollHeight)); }
    function finish() {
      clearTimeout(timer); timer = 0; if (ends) { sheet.removeEventListener('transitionend', ends); ends = null; }
      sheet.style.removeProperty('transition'); hgt(null); showBody(false);
    }
    /* to(open): glide from wherever the sheet stands to open or folded */
    function to(open) {
      if (d) return;
      var from = now();
      finish(); hgt(from); showBody(true);
      var f = folded(), target = open ? opened(f) : f;
      o.set(!!open);                                     // the app's own state first: its classes, its labels
      if (calm || Math.abs(target - from) < 2) { finish(); return; }
      glide(false); void sheet.offsetHeight;
      glide(true); hgt(target);
      ends = function (e) { if (e.target === sheet && e.propertyName === 'height') finish(); };
      sheet.addEventListener('transitionend', ends);
      timer = setTimeout(finish, 420);                   // in case the transition never reports its end
    }
    function down(ev) {
      if (d || (ev.button != null && ev.button > 0)) return;
      var b = ev.target.closest && ev.target.closest('button, a, input, select, textarea, label, [role="button"], [role="tab"]');
      if (b && grips.indexOf(b) < 0) return;             // the head's own buttons (+ / –) are not handles
      d = { id: ev.pointerId, grip: ev.currentTarget, y0: ev.clientY, y: ev.clientY, t: performance.now(), v: 0, moved: false };
      try { d.grip.setPointerCapture(ev.pointerId); } catch (e) { /* older browsers */ }
    }
    function move(ev) {
      if (!d || ev.pointerId !== d.id) return;
      var dy = ev.clientY - d.y0;
      if (!d.moved) {
        if (Math.abs(dy) < 6) return;
        d.moved = true; d.h0 = now();
        finish(); hgt(d.h0); showBody(true); glide(false);
        d.f = folded(); d.max = opened(d.f);
      }
      var h = d.h0 - dy;
      if (h > d.max) h = d.max + (h - d.max) * 0.25;     // a little give past either end, as on the iPhone
      if (h < d.f) h = Math.max(d.f - 40, d.f - (d.f - h) * 0.25);
      hgt(h);
      var t = performance.now(), dt = t - d.t;
      if (dt > 0) d.v = 0.7 * ((ev.clientY - d.y) / dt) + 0.3 * d.v;   // px per ms, downward positive
      d.y = ev.clientY; d.t = t;
      ev.preventDefault();
    }
    function up(ev) {
      if (!d || ev.pointerId !== d.id) return;
      var g = d; d = null;
      try { g.grip.releasePointerCapture(ev.pointerId); } catch (e) { /* already released */ }
      if (!g.moved) { if (ev.type === 'pointerup') to(!o.isOpen()); return; }
      if (performance.now() - g.t > 120) g.v = 0;        // held still before letting go: no flick
      /* let go slowly: a quarter of the way in the direction it was pulled is enough to go there */
      var span = Math.max(1, g.max - g.f), was = o.isOpen(), cur = now();
      var open = g.v < -0.35 ? true : g.v > 0.35 ? false : was ? cur > g.max - span * 0.25 : cur > g.f + span * 0.25;
      to(open);
    }
    grips.forEach(function (g) {
      g.style.touchAction = 'none'; g.style.cursor = 'grab';
      g.addEventListener('pointerdown', down);
      g.addEventListener('pointermove', move);
      g.addEventListener('pointerup', up);
      g.addEventListener('pointercancel', up);
    });
    return { to: to };
  }

  function init(o) {
    if (!root.classList.contains('l2phone') || !o || !o.sheet) return null;
    var sheet = o.sheet, isZh = o.zh || zh;
    (o.hide || []).forEach(function (e) { if (e) e.classList.add('l2ph-hide'); });

    /* the sheet: handle, head, the main action, and everything the panel held, scrolling */
    var body = mk('div', 'l2ph-body');
    while (sheet.firstChild) body.appendChild(sheet.firstChild);
    var handle = mk('button', 'l2ph-handle'); handle.type = 'button';
    var head = mk('div', 'l2ph-head'), tw = mk('div', 'l2ph-title'), name = mk('div', 'l2ph-name'), status = mk('div', 'l2ph-status');
    var fold = mk('button', 'l2ph-fold'); fold.type = 'button';
    tw.appendChild(name); tw.appendChild(status); head.appendChild(tw); head.appendChild(fold);
    var quick = mk('div', 'l2ph-quick');
    (o.quick || []).forEach(function (e) { if (e) quick.appendChild(e); });
    (o.narrow || []).forEach(function (e) { if (e) e.classList.add('l2ph-narrow'); });
    sheet.appendChild(handle); sheet.appendChild(head); sheet.appendChild(quick); sheet.appendChild(body);
    sheet.classList.add('l2ph-sheet');

    /* the language switch (24 Nov 2026): at the top right, level with Display, as the shell's own switch stands when the
       app is opened from the catalogue (the shell then hides this one). Moved, not cloned: its handlers stay. The class
       on <html> tells the app to keep that corner free (its north symbol, its zoom buttons go below). */
    if (o.lang) { o.lang.classList.add('l2ph-lang'); document.body.appendChild(o.lang); root.classList.add('l2ph-lang-top'); }

    /* Display */
    var db = null, dbt = null;
    if (o.display) {
      o.display.classList.add('l2ph-panel');
      db = mk('button', 'l2ph-disp'); db.type = 'button';
      db.innerHTML = '<svg aria-hidden="true" width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M9 2 2 5.6 9 9.2l7-3.6L9 2Z"></path><path d="m2 9.2 7 3.6 7-3.6"></path><path d="m2 12.6 7 3.6 7-3.6"></path></svg>';
      dbt = mk('span'); db.appendChild(dbt);
      document.body.appendChild(db);
      db.onclick = function () { showDisplay(!root.classList.contains('l2ph-disp-open')); };
    }
    function open(v) {
      root.classList.toggle('l2ph-open', !!v);
      if (v) showDisplay(false, true);
      label();
      if (o.onChange) { try { o.onChange(); } catch (e) { /* the app's own */ } }
    }
    function showDisplay(v, quiet) {
      root.classList.toggle('l2ph-disp-open', !!v);
      if (db) db.setAttribute('aria-expanded', v ? 'true' : 'false');
      if (v) root.classList.remove('l2ph-open');
      if (!quiet) label();
    }
    function label() {
      var z = isZh(), isOpen = root.classList.contains('l2ph-open');
      var t = isOpen ? (z ? '收起功能面板' : 'Fold the panel') : (z ? '展开功能面板' : 'Open the panel');
      fold.textContent = isOpen ? '–' : '+'; fold.title = t; fold.setAttribute('aria-label', t); handle.setAttribute('aria-label', t);
      if (dbt) { var d = z ? '显示' : 'Display'; if (dbt.textContent !== d) dbt.textContent = d; }
      var n = '', s = '';
      try { n = o.title ? String(o.title() || '') : ''; } catch (e) { n = ''; }
      try { s = o.status ? String(o.status() || '') : ''; } catch (e) { s = ''; }
      if (name.textContent !== n) name.textContent = n;
      if (status.textContent !== s) status.textContent = s;
    }
    /* the handle and the whole head take the finger; the sheet follows it (drag above) */
    var pull = drag({ sheet: sheet, body: body, grips: [handle, head], isOpen: function () { return root.classList.contains('l2ph-open'); }, set: open });
    fold.onclick = function () { var v = !root.classList.contains('l2ph-open'); if (pull) pull.to(v); else open(v); };
    open(false); showDisplay(false);
    setInterval(label, 500);
    return { open: open, display: showDisplay, body: body, quick: quick, head: head };
  }
  window.L2Phone = { is: function () { return root.classList.contains('l2phone'); }, init: init, drag: drag };
})();
