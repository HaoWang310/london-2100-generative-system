// Pop-out viewer for incubator apps. The app opens in a full-screen frame
// that grows out of the catalogue card it was clicked from, and shrinks back
// into it on close. The app itself is untouched — it runs exactly as it does
// at its own URL, just framed.

import { pick, onLangChange } from '../shared/i18n/index.js';

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

  onLangChange(() => { if (current) title.textContent = pick(current.title); });

  function animate(from, to, duration) {
    anim?.cancel();
    if (reducedMotion() || !from) { root.style.clipPath = ''; return Promise.resolve(); }
    anim = root.animate([{ clipPath: from }, { clipPath: to }], { duration, easing: EASE, fill: 'forwards' });
    return anim.finished.catch(() => {});
  }

  return {
    get openId() { return current?.id ?? null; },

    async open(item, coverEl) {
      if (current?.id === item.id && !root.hidden) return;
      current = item; origin = coverEl || null;
      title.textContent = pick(item.title);
      external.href = item.href;

      // Fresh frame each time: heavy apps (live traffic, 3D) shouldn't keep running once closed.
      iframe?.remove();
      iframe = document.createElement('iframe');
      iframe.title = pick(item.title);
      iframe.allow = 'fullscreen; clipboard-write; geolocation';
      iframe.src = item.href;
      loading.classList.remove('done');
      iframe.addEventListener('load', () => { loading.classList.add('done'); iframe.classList.add('is-loaded'); }, { once: true });
      frameWrap.append(iframe);

      root.hidden = false;
      root.classList.add('is-open');
      await animate(insetFrom(origin), 'inset(0px 0px 0px 0px round 0px)', 620);
      root.style.clipPath = '';
      iframe.focus?.();
    },

    async close() {
      if (root.hidden) return;
      const target = insetFrom(origin);
      root.classList.remove('is-open');
      if (target) await animate('inset(0px 0px 0px 0px round 0px)', target, 460);
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
