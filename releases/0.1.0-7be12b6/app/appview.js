// Pop-out viewer for incubator apps. The app opens in a full-screen frame
// that grows out of the catalogue card it was clicked from, and shrinks back
// into it on close. The app itself is untouched — it runs exactly as it does
// at its own URL, just framed.

import { pick, getLang, onLangChange } from '../shared/i18n/index.js?v=7be12b6';

// Language bridge for framed apps. Configured per app in catalogue.json:
//   "embed": {
//     "langStorageKey": "key the app reads its language from",
//     "langButton": "CSS selector of the app's own zh/en button, with {lang}",
//     "hide": ["selectors hidden while framed, e.g. the app's own switch"]
//   }
// Every framed app is also sent postMessage({ type: 'l2100:lang', lang }).
// The app's own files are never modified; standalone it keeps its own switch.
function prepareLanguage(item) {
  const key = item.embed?.langStorageKey;
  if (key) try { localStorage.setItem(key, getLang()); } catch { /* private mode */ }
}

function embed(frame, item) {
  let doc;
  try { doc = frame.contentDocument; } catch { return; }
  if (!doc?.head || doc.getElementById('l2100-embed')) return;
  const hide = item.embed?.hide || [];
  if (hide.length) {
    const style = doc.createElement('style');
    style.id = 'l2100-embed';
    style.textContent = `${hide.join(',')} { display: none !important; }`;
    doc.head.append(style);
  }
}

function pushLanguage(frame, item) {
  if (!frame) return;
  const lang = getLang();
  try { frame.contentWindow?.postMessage({ type: 'l2100:lang', lang }, location.origin); } catch { /* ignore */ }
  const sel = item?.embed?.langButton;
  if (!sel) return;
  try {
    const doc = frame.contentDocument;
    if (doc?.documentElement?.dataset.uiLanguage === lang) return;
    doc?.querySelector(sel.replace('{lang}', lang))?.click();
  } catch { /* not ready / cross-origin */ }
}

const reducedMotion = () => globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
const EASE = 'cubic-bezier(.16,1,.3,1)';

function insetFrom(el) {
  if (!el) return null;
  const r = el.getBoundingClientRect();
  if (!r.width || !r.height) return null;
  const W = innerWidth, H = innerHeight;
  return `inset(${r.top}px ${W - r.right}px ${H - r.bottom}px ${r.left}px round 14px)`;
}

export function createAppView(root) {
  const frameWrap = root.querySelector('.appview-frame');
  const title = root.querySelector('.appview-title');
  const external = root.querySelector('.appview-external');
  const loading = root.querySelector('.appview-loading');
  let current = null;       // catalogue item
  let origin = null;        // cover element it opened from
  let iframe = null;
  let anim = null;
  let generation = 0;       // bumps on every open/close, so a late close never hides a newer open

  onLangChange(() => {
    if (!current) return;
    title.textContent = pick(current.title);
    pushLanguage(iframe, current);
  });

  function animate(from, to, duration) {
    anim?.cancel();
    if (reducedMotion() || !from) { root.style.clipPath = ''; return Promise.resolve(); }
    anim = root.animate([{ clipPath: from }, { clipPath: to }], { duration, easing: EASE, fill: 'forwards' });
    return anim.finished.catch(() => {});
  }

  return {
    get openId() { return current?.id ?? null; },

    async open(item, coverEl) {
      if (current?.id === item.id && !root.hidden && root.classList.contains('is-open')) return;
      const gen = ++generation;
      current = item; origin = coverEl || null;
      title.textContent = pick(item.title);
      external.href = item.href;

      // Fresh frame each time: heavy apps (live traffic, 3D) shouldn't keep running once closed.
      iframe?.remove();
      iframe = document.createElement('iframe');
      iframe.title = pick(item.title);
      iframe.allow = 'fullscreen; clipboard-write; geolocation';
      prepareLanguage(item);   // the app starts in the shell's language
      iframe.src = item.href;
      loading.classList.remove('done');
      // Reveal as soon as the app starts rendering. Waiting for the frame's
      // `load` event is not enough: an app whose module script awaits a CDN
      // download (google-map-live awaits MapLibre) delays `load` until that
      // finishes, and a slow CDN would leave the loader up indefinitely.
      const frame = iframe;
      let revealed = false;
      const reveal = () => {
        if (revealed || frame !== iframe) return;
        revealed = true;
        embed(frame, item);
        pushLanguage(frame, item);
        loading.classList.add('done');
        frame.classList.add('is-loaded');
      };
      frame.addEventListener('load', () => { reveal(); embed(frame, item); pushLanguage(frame, item); }, { once: true });
      const started = performance.now();
      const poll = () => {
        if (revealed || frame !== iframe) return;
        let state = '';
        try { state = frame.contentDocument?.readyState || ''; } catch { /* cross-origin: rely on load/timeout */ }
        const hasBody = (() => { try { return frame.contentDocument?.body?.childElementCount > 0; } catch { return false; } })();
        if ((state === 'interactive' || state === 'complete') && hasBody) setTimeout(reveal, 150);
        else if (performance.now() - started > 2500) reveal();
        else setTimeout(poll, 100);
      };
      frameWrap.append(iframe);
      setTimeout(poll, 100);

      root.hidden = false;
      root.classList.add('is-open');
      await animate(insetFrom(origin), 'inset(0px 0px 0px 0px round 0px)', 620);
      if (gen !== generation) return;
      root.style.clipPath = '';
      iframe?.focus?.();
    },

    async close() {
      if (root.hidden) return;
      const gen = ++generation;
      const target = insetFrom(origin);
      root.classList.remove('is-open');
      if (target) await animate('inset(0px 0px 0px 0px round 0px)', target, 460);
      if (gen !== generation) return;   // reopened while closing: leave the new view alone
      root.hidden = true;
      anim?.cancel(); anim = null;
      root.style.clipPath = '';
      iframe?.remove(); iframe = null;
      current = null;
    },

    /** The catalogue re-renders, so the cover to shrink back into is looked up again on close. */
    setOrigin(el) { origin = el || origin; }
  };
}
