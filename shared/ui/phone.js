/* London 2100 · the one phone layout (23 Nov 2026): the sheet and the Display button, built from what an app hands over.
   See phone.css for the layout. A classic script, no imports: an app loads it after its own interface script and calls

     L2Phone.init({
       sheet:   element,              // the app's working panel: becomes the sheet along the bottom
       title:   () => string,         // the app's name, in the language of the moment
       status:  () => string,         // one line: where the app stands (may be empty)
       quick:   [elements],           // its main action(s): moved to the folded sheet, their handlers untouched
       narrow:  [elements],           // those of quick that stay narrow (a Reset beside a Run)
       display: element,              // the app's display panel: opens across the top
       hide:    [elements]            // what the phone layout replaces (the app's own title, its collapse buttons)
     })

   Nothing is cloned: the app's own controls are moved, with their ids and their handlers. Without html.l2phone
   (a computer, an iPad) init does nothing and returns null. */
(function () {
  'use strict';
  var root = document.documentElement;
  function zh() { return /^zh/i.test(root.lang || '') || /^zh/i.test((document.body && document.body.lang) || ''); }
  function mk(tag, cls) { var e = document.createElement(tag); if (cls) e.className = cls; e.setAttribute('translate', 'no'); return e; }
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
    fold.onclick = function () { open(!root.classList.contains('l2ph-open')); };
    var drag = null;
    handle.addEventListener('pointerdown', function (ev) { drag = { id: ev.pointerId, y: ev.clientY }; try { handle.setPointerCapture(ev.pointerId); } catch (e) { /* older browsers */ } });
    handle.addEventListener('pointerup', function (ev) {
      if (!drag || ev.pointerId !== drag.id) return;
      var dy = ev.clientY - drag.y; drag = null;
      if (Math.abs(dy) < 8) open(!root.classList.contains('l2ph-open'));        // a tap
      else open(dy < 0);                                                         // dragged up: open; down: fold
    });
    handle.addEventListener('pointercancel', function () { drag = null; });
    open(false); showDisplay(false);
    setInterval(label, 500);
    return { open: open, display: showDisplay, body: body, quick: quick, head: head };
  }
  window.L2Phone = { is: function () { return root.classList.contains('l2phone'); }, init: init };
})();
