/* One language for every app (26 Nov 2026).

   The home page, the whole system and VR keep the language in one place: localStorage 'l2100.lang' ('zh' | 'en';
   shared/i18n/index.js). Each incubator app kept its own (londonMap.uiLanguage, woolAppsLang, tensorStudio.uiLanguage,
   structureStudio.uiLanguage), so a language chosen in one app was not known to the next, and two apps opened in
   English whatever the device spoke. This script joins an app to the one place without touching the app's own code:

     <script src="../../shared/ui/lang.js?v=1" data-key="the app's own key" data-button='its zh/en button, with {lang}'></script>

   as the first script of the page, before the app reads its key. The two values are the app's entry in
   incubator/catalogue.json (embed.langStorageKey, embed.langButton), which the catalogue already uses.

   1 At once: the app's own key is set to the shared language, so the app starts in it. Nothing chosen anywhere yet:
     the device's language (any Chinese is zh, every other en), the rule of shared/i18n.
   2 When the app's language changes (its own switch, or anything else that writes its key): the shared language takes
     the new value. Looked at twice a second and after every click: no hooks in the app.
   3 When the shared language changes in another tab or frame: the app's own button is pressed, so this page follows
     at once. Without the button (not there yet), the app's key is set and the page follows the next time it opens.
     Whether the page is already in that language is read from <html lang>, which every app keeps in step.

   Inside the catalogue the shell does 1 and 3 itself (app/appview.js); both write the same value, so they agree. */
(function () {
  'use strict';
  var SHARED = 'l2100.lang', me = document.currentScript, KEY = me && me.getAttribute('data-key'), BTN = me && me.getAttribute('data-button');
  var ok = function (v) { return v === 'zh' || v === 'en'; };
  function get(k) { try { return window.localStorage.getItem(k); } catch (e) { return null; } }
  function set(k, v) { try { if (window.localStorage.getItem(k) !== v) window.localStorage.setItem(k, v); } catch (e) { /* a private window */ } }
  function system() { try { var n = window.navigator, f = (n.languages && n.languages[0]) || n.language || ''; return /^zh\b/i.test(f) ? 'zh' : 'en'; } catch (e) { return 'en'; } }
  function shared() { var v = get(SHARED); return ok(v) ? v : system(); }

  var api = { key: KEY, shared: shared, system: system, check: function () {}, follow: function () {} };
  window.L2Lang = api;
  if (!KEY) return;

  // 1 the app starts in the shared language
  var last = shared();
  set(KEY, last);

  // The language the page shows now: every app keeps <html lang> in step with its own switch. (Not the app's key: two
  // apps may share one key, and then the key changes when the other one's tab writes it, while this page has not moved.)
  function showing() { return /^zh/i.test(document.documentElement.lang || '') ? 'zh' : 'en'; }
  function press(v) { var b = null; try { b = BTN ? document.querySelector(BTN.replace('{lang}', v)) : null; } catch (e) { b = null; } if (b) b.click(); return !!b; }

  // 2 the app's own change is the shared one from then on
  api.check = function () {
    var v = get(KEY);
    if (ok(v) && v !== last) { last = v; if (get(SHARED) !== v) set(SHARED, v); }
    // and the other way, for a page that missed it: the shared language says one thing and the page shows another
    var s = get(SHARED); if (ok(s) && document.readyState === 'complete' && get(KEY) === s && showing() !== s) api.follow(s);
  };
  window.setInterval(api.check, 500);
  document.addEventListener('click', function () { window.setTimeout(api.check, 0); }, true);

  // 3 a change made elsewhere reaches this page
  api.follow = function (v) {
    if (!ok(v)) return;
    last = v;                                   // what follows is the shared language arriving, not a new choice
    if (showing() !== v) press(v);
    set(KEY, v);
  };
  window.addEventListener('storage', function (e) { if (e.key === SHARED && ok(e.newValue)) api.follow(e.newValue); });
})();
