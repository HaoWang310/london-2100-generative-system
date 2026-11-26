/* Tensor Studio · the phone (23 Nov 2026): what the one phone layout asks that this app did not do.
   (v8.52.1, 26 Nov 2026) The language switch stood in the sheet along the bottom, small (36 × 26 px a button), while
   every other app has it at the top right, level with Display. Here it is moved there and given the shared look
   (../../shared/ui/phone.css, .l2ph-lang): 44 px high, 中文 first, the same on every app.
   Opening the sheet folds the display panel, and showing the display panel folds the sheet, so the two never lie over
   each other, and the Display button carries the same mark as on the other apps. The sheet and the button are the
   app's own (v8.47); the button's place is in skin.css. */
(function () {
  'use strict';
  var r = document.documentElement, p = document.getElementById('panel'), b = document.getElementById('tsCollapse'), t = document.getElementById('dpToggle');
  if (!r.classList.contains('phoneUi') || !p || !t) return;
  var sw = document.querySelector('.language-switch'); if (sw) { sw.classList.add('l2ph-lang'); document.body.appendChild(sw); r.classList.add('l2ph-lang-top'); }
  t.insertAdjacentHTML('afterbegin', '<svg aria-hidden="true" width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M9 2 2 5.6 9 9.2l7-3.6L9 2Z"></path><path d="m2 9.2 7 3.6 7-3.6"></path><path d="m2 12.6 7 3.6 7-3.6"></path></svg>');   // the same mark as on the other apps' Display button
  new MutationObserver(function () { if (!p.classList.contains('collapsed') && !r.classList.contains('dpHidden')) t.click(); })
    .observe(p, { attributes: true, attributeFilter: ['class'] });
  t.addEventListener('click', function () { if (!r.classList.contains('dpHidden') && !p.classList.contains('collapsed') && b) b.click(); });
})();
