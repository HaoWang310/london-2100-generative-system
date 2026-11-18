// Opening screen: three video panels — London 2100 / Housing / Agriculture.
//
// Footage: Mixkit, "Mixkit Stock Video Free License" (commercial and personal
// use, no attribution required). Short loops cut from the clips and compressed for
// the web live in assets/intro/ (1280 px and an 854 px version for phones, with a
// small poster each); Mixkit's own file is only a fallback if ours fails. To use your
// own footage, replace the files in assets/intro/. See docs/CREDITS.md.

import { t, onLangChange } from '../shared/i18n/index.js?v=cb34aed';
import { isPhone } from '../shared/ui/index.js?v=cb34aed';

const MIXKIT = id => `https://assets.mixkit.co/videos/${id}/${id}-720.mp4`;
const CLIP = (key, id) => ({ key, src: `./assets/intro/${key}.mp4`, small: `./assets/intro/${key}-480.mp4`, poster: `./assets/intro/${key}.webp`,
  fallback: MIXKIT(id), page: `https://mixkit.co/free-stock-video/${id}/` });

export const INTRO_PANELS = [
  CLIP('london', 4265),        // Buildings in the City of London (time-lapse zoom out)
  CLIP('housing', 4010),       // Buildings under construction, aerial view (London)
  CLIP('agriculture', 824)     // Aerial view of a greenhouse field
];

// Touch screens (iPad, iPhone): the three loops load one after another — the first plays
// as soon as it can, then the next starts loading — instead of all three sharing the
// connection at once. Phones and slow or data-saving connections take the smaller files.
// Computers: all three load and play together, as before.
const TOUCH = (() => { try { return matchMedia('(pointer: coarse)').matches; } catch { return false; } })();
const SMALL = (() => { try { const c = navigator.connection; return isPhone() || !!(c && (c.saveData || /(^|-)2g|3g/.test(c.effectiveType || ''))); } catch { return false; } })();

const reducedMotion = () => globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

export function createIntro(root, { onEnter } = {}) {
  const panels = root.querySelector('.intro-panels');
  const videos = [];

  INTRO_PANELS.forEach((p, i) => {
    const panel = document.createElement('article');
    panel.className = 'intro-panel';
    panel.style.setProperty('--i', i);
    panel.tabIndex = 0;
    panel.dataset.key = p.key;

    const video = document.createElement('video');
    video.muted = true; video.loop = true; video.playsInline = true;
    video.preload = i === 0 ? 'auto' : TOUCH ? 'none' : 'metadata';
    video.poster = p.poster;
    video.setAttribute('aria-hidden', 'true');
    video.src = SMALL ? p.small : p.src;
    video.addEventListener('playing', () => panel.classList.add('is-playing'), { once: true });
    // our file failed: try Mixkit's once, then give up (the panel keeps its poster and gradient)
    video.addEventListener('error', () => { if (!video.dataset.fallback){ video.dataset.fallback = '1'; video.src = p.fallback; if (open) video.play().catch(() => {}); return; } panel.classList.add('is-failed'); });
    videos.push(video);

    const label = document.createElement('h2');
    label.className = 'intro-label';
    const sub = document.createElement('p');
    sub.className = 'intro-sub';

    panel.append(video, label, sub);
    panel.addEventListener('click', () => enter());
    panel.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); enter(); } });
    panels.append(panel);
  });

  const paintText = () => {
    root.querySelectorAll('.intro-panel').forEach(panel => {
      panel.querySelector('.intro-label').textContent = t(`intro.${panel.dataset.key}`);
      panel.querySelector('.intro-sub').textContent = t(`intro.${panel.dataset.key}.sub`);
    });
  };
  paintText();
  onLangChange(paintText);

  const play = () => {
    if (reducedMotion()) return;
    if (!TOUCH) { videos.forEach(v => v.play().catch(() => { /* autoplay blocked: poster stays */ })); return; }
    // one after another: the next starts when this one can play through (or gives up)
    const chain = k => { const v = videos[k]; if (!v || !open) return; let went = false; const next = () => { if (!went) { went = true; chain(k + 1); } };
      v.preload = 'auto'; v.play().catch(next);
      if (v.readyState >= 4) next(); else { v.addEventListener('canplaythrough', next, { once: true }); v.addEventListener('error', next, { once: true }); setTimeout(next, 6000); } };
    chain(0);
  };
  const pause = () => videos.forEach(v => v.pause());

  let open = false;
  function show() {
    open = true;
    root.hidden = false;
    root.classList.remove('is-leaving');
    requestAnimationFrame(() => root.classList.add('is-in'));
    play();
    function hide() {
    open = false;
    root.classList.remove('is-in', 'is-leaving');
    root.hidden = true;
    pause();
  }

  root.querySelector('.intro-enter')?.focus({ preventScroll: true });
  }
  function enter() {
    if (!open) return;
    open = false;
    root.classList.add('is-leaving');
    root.classList.remove('is-in');
    const done = () => { root.hidden = true; pause(); };
    reducedMotion() ? done() : setTimeout(done, 700);
    onEnter?.();
  }

  function hide() {
    open = false;
    root.classList.remove('is-in', 'is-leaving');
    root.hidden = true;
    pause();
  }

  root.querySelector('.intro-enter').addEventListener('click', e => { e.stopPropagation(); enter(); });
  document.addEventListener('keydown', e => {
    if (!open) return;
    if (e.key === 'Enter' || e.key === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); enter(); }
  }, true);
  document.addEventListener('visibilitychange', () => {
    if (!open) return;
    document.visibilityState === 'visible' ? play() : pause();
  });

  return { show, hide, enter, get open() { return open; } };
}
