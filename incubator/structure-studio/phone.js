/* Structure Studio · the phone (23 Nov 2026): the one layout of ../../shared/ui/phone.
   The control panel is the sheet along the bottom: folded it shows the name, the site in hand, and the three buttons
   of the step-by-step run; the display panel opens from the Display button at the top left. The panel's own collapse
   button, its two width handles and the label down the right edge are not shown on a phone. Interface only. */
(function () {
  'use strict';
  if (!window.L2Phone || !L2Phone.is()) return;
  var $ = function (id) { return document.getElementById(id); };
  var panel = $('panel'), dp = document.querySelector('aside.displayPanel');
  if (!panel) return;
  var head = panel.querySelector('.ts-head'), titleBox = head ? head.firstElementChild : null, name = panel.querySelector('.ts-title');
  panel.classList.remove('collapsed');
  L2Phone.init({
    sheet: panel, display: dp,
    quick: [$('runBtn'), $('runPause'), $('runNow')],
    hide: [titleBox, $('tsCollapse'), $('rszL'), $('rszR'), $('hud'), $('tsResize')],
    zh: function () { var b = document.querySelector('#langSw button.active, #langSw button[aria-pressed="true"]'); return b ? b.dataset.language === 'zh' : /^zh/i.test(document.documentElement.lang || ''); },
    title: function () { return name ? name.textContent.trim() : 'Structure Studio'; },
    status: function () { var t = $('hud_t'), s = $('hud_s'); return ((t ? t.textContent : '') + (s && s.textContent ? ' · ' + s.textContent : '')).trim(); }
  });
})();
