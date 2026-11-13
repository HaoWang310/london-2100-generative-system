// Opening screen: three video panels — London 2100 / Housing / Agriculture.
//
// Footage: Mixkit, "Mixkit Stock Video Free License" (commercial and personal
// use, no attribution required). Files are streamed from Mixkit's CDN; to use
// your own footage, put an .mp4 in assets/intro/ and change `src` below —
// nothing else needs to change. See docs/CREDITS.md.

import { t, onLangChange } from '../shared/i18n/index.js?v=22b1548';

const MIXKIT = id => ({
  src: `https://assets.mixkit.co/videos/${id}/${id}-720.mp4`,
  poster: `https://assets.mixkit.co/videos/${id}/${id}-thumb-720-0.jpg`,
  page: `https://mixkit.co/free-stock-video/${id}/`
});

export const INTRO_PANELS = [
  { key: 'london', ...MIXKIT(4265) },      // Buildings in the City of London (time-lapse zoom out)
  { key: 'housing', ...MIXKIT(4010) },     // Buildings under construction, aerial view (London)
  { key: 'agriculture', ...MIXKIT(824) }   // Aerial view of a greenhouse field
];

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
    video.preload = i === 0 ? 'auto' : 'metadata';
    video.poster = p.poster;
    video.setAttribute('aria-hidden', 'true');
    video.src = p.src;
    video.addEventListener('playing', () => panel.classList.add('is-playing'), { once: true });
    video.addEventListener('error', () => panel.classList.add('is-failed'), { once: true });
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
    videos.forEach(v => v.play().catch(() => { /* autoplay blocked: poster stays */ }));
  };
  const pause = () => videos.forEach(v => v.pause());

  let open = false;
  function show() {
    open = true;
    root.hidden = false;
    root.classList.remove('is-leaving');
    requestAnimationFrame(() => root.classList.add('is-in'));
    play();
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

  root.querySelector('.intro-enter').addEventListener('click', e => { e.stopPropagation(); enter(); });
  document.addEventListener('keydown', e => {
    if (!open) return;
    if (e.key === 'Enter' || e.key === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); enter(); }
  }, true);
  document.addEventListener('visibilitychange', () => {
    if (!open) return;
    document.visibilityState === 'visible' ? play() : pause();
  });

  return { show, enter, get open() { return open; } };
}
