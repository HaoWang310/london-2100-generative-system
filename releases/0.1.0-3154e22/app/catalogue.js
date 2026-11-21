// Catalogue screen: lists everything in incubator/catalogue.json.
// Adding an app needs no code change — add a folder in incubator/ and one
// entry in that JSON file.

import { t, pick, getLang, onLangChange } from '../shared/i18n/index.js?v=3154e22';
import { h } from '../shared/ui/index.js?v=3154e22';

const STATUS = ['ready', 'incubating', 'planned'];
const DWELL_MS = 3000;   // a mouse resting this long on a card with a "detail" shows its introduction

/** "**bold**" in the catalogue's text → <strong> */
const rich = text => String(text || '').split('**').map((part, i) => i % 2 ? h('strong', {}, part) : part);

/** Apps hosted inside this site open in the pop-out viewer; external links open normally. */
export const isInternalApp = item => typeof item.href === 'string' && /^(\.\/)?incubator\//.test(item.href);

export function createCatalogue(root, { onOpenWorkspace, onOpenApp } = {}) {
  const grid = root.querySelector('.cat-grid');
  const filters = root.querySelector('.cat-filters');
  const count = root.querySelector('.cat-count');
  let items = [];
  let filter = 'all';
  let loaded = false;

  // ---------------------------------------------------------------- the introduction panel
  // A mouse: rest on a card for 3 s (a line along the card's foot fills meanwhile). A finger: the ⓘ on the cover.
  // One panel for the whole screen, placed beside the card (right, else left, else over it); a phone gets a sheet.
  let panel = null, panelFor = null, dwellTimer = 0, hideTimer = 0;
  function closePanel() {
    clearTimeout(hideTimer); hideTimer = 0;
    if (!panel) return;
    const p = panel; panel = null; panelFor = null;
    p.classList.remove('is-in'); setTimeout(() => p.remove(), 260);
    root.classList.remove('story-open');
    document.removeEventListener('keydown', onKey); document.removeEventListener('pointerdown', onOutside, true);
  }
  const onKey = e => { if (e.key === 'Escape') closePanel(); };
  const onOutside = e => { if (panel && !panel.contains(e.target) && !e.target.closest?.('.cat-info')) closePanel(); };
  function openPanel(item, cardEl, { touch = false } = {}) {
    if (panelFor === cardEl) return;
    closePanel();
    const d = item.detail;
    panel = h('aside', { class: `cat-detail${touch ? ' is-touch' : ''}`, role: 'dialog', 'aria-label': pick(item.title) },
      h('header', {},
        h('div', { class: 'cd-title' }, h('h3', {}, pick(item.title)), d.subtitle ? h('p', { class: 'cd-sub' }, d.subtitle) : null),
        h('button', { type: 'button', class: 'cd-close', 'aria-label': t('cat.detail.close'), onclick: closePanel }, '×')),
      h('div', { class: 'cd-body' }, (d.sections || []).map(sec => h('section', {},
        h('h4', {}, pick(sec.h)),
        (sec.body || []).map(b => b.list ? h('ul', {}, b.list.map(li => h('li', {}, rich(pick(li))))) : h('p', {}, rich(pick(b.p))))))));
    panel.addEventListener('pointerenter', () => { clearTimeout(hideTimer); hideTimer = 0; });
    panel.addEventListener('pointerleave', e => { if (e.pointerType === 'mouse') hideSoon(); });
    document.body.appendChild(panel); panelFor = cardEl;   // the page's top level: a fixed layer inside the scrolling catalogue is mis-placed by Safari
    place(cardEl);
    requestAnimationFrame(() => panel?.classList.add('is-in'));
    document.addEventListener('keydown', onKey);
    if (touch) setTimeout(() => document.addEventListener('pointerdown', onOutside, true), 0);
  }
  function place(cardEl) {
    if (!panel) return;
    if (matchMedia('(max-width: 760px)').matches) { panel.classList.add('is-sheet'); return; }   // phones: a sheet from the bottom (CSS)
    const r = cardEl.getBoundingClientRect(), W = innerWidth, H = innerHeight, gap = 16;
    const w = Math.min(400, W - 32); panel.style.width = `${w}px`;
    const ph = Math.min(panel.offsetHeight, H - 32);
    let left;
    if (r.right + gap + w <= W - 16) left = r.right + gap;           // beside it, on the right
    else if (r.left - gap - w >= 16) left = r.left - gap - w;        // or on the left
    else left = Math.max(16, Math.min(W - w - 16, r.left + (r.width - w) / 2));   // or over the card
    panel.style.left = `${Math.round(left)}px`;
    panel.style.top = `${Math.round(Math.max(16, Math.min(H - ph - 16, r.top)))}px`;
  }
  // A finger (the ⓘ): the introduction as pages, one section per screen — a progress bar along the top, swipe or
  // ← / → to turn, × to close; on the last page "next" becomes "open the app". Each page shows the cover, framed a
  // little differently, under the section's lead (its large heading; the section name when there is none).
  function openStory(item, cardEl, num) {
    closePanel();
    const secs = item.detail.sections, n = secs.length;
    const frames = [[1, 50, 50], [1.35, 28, 45], [1.35, 72, 55], [1.6, 50, 35]];
    let at = 0;
    const bars = secs.map(() => h('i'));
    const count = h('span', { class: 'cs-count' });
    const prev = h('button', { type: 'button', class: 'cs-prev', onclick: () => go(at - 1) }, '← ' + t('cat.story.prev'));
    const next = h('button', { type: 'button', class: 'cs-next', onclick: () => at < n - 1 ? go(at + 1) : (closePanel(), cardEl.click()) });
    const track = h('div', { class: 'cs-track' }, secs.map((sec, k) => {
      const [z, x, y] = frames[k % frames.length];
      return h('section', { class: 'cs-page', 'aria-label': pick(sec.h) }, h('div', { class: 'cs-inner' },
        h('div', { class: 'cs-kicker' }, `${num} · ${pick(item.title).split(' · ')[0]} / ${String(k + 1).padStart(2, '0')} ${pick(sec.h)}`),
        h('h2', {}, pick(sec.lead) || pick(sec.h)),
        item.cover ? h('figure', {}, h('img', { src: pick(item.cover), alt: '', style: `transform:scale(${z});transform-origin:${x}% ${y}%` })) : null,
        (sec.body || []).map(b => b.list ? h('ul', {}, b.list.map(li => h('li', {}, rich(pick(li))))) : h('p', {}, rich(pick(b.p))))));
    }));
    const show = k => {
      at = k;
      bars.forEach((b, j) => b.classList.toggle('on', j <= k));
      count.textContent = `${k + 1} / ${n}`;
      prev.disabled = k === 0;
      next.textContent = k < n - 1 ? t('cat.story.next') + ' →' : t('cat.story.open') + ' →';
      next.classList.toggle('is-open', k === n - 1);
    };
    const go = k => { k = Math.max(0, Math.min(n - 1, k)); track.scrollTo({ left: k * track.clientWidth, behavior: 'smooth' }); show(k); };
    let tick = 0;
    track.addEventListener('scroll', () => { cancelAnimationFrame(tick); tick = requestAnimationFrame(() => { const k = Math.round(track.scrollLeft / Math.max(1, track.clientWidth)); if (k !== at) show(k); }); }, { passive: true });
    panel = h('div', { class: 'cat-story', role: 'dialog', 'aria-modal': 'true', 'aria-label': pick(item.title) },
      h('div', { class: 'cs-top' }, h('div', { class: 'cs-bars' }, bars),
        h('button', { type: 'button', class: 'cs-close', 'aria-label': t('cat.detail.close'), onclick: closePanel }, '×')),
      track,
      h('div', { class: 'cs-foot' }, prev, count, next));
    panel.addEventListener('keydown', e => { if (e.key === 'ArrowRight') go(at + 1); if (e.key === 'ArrowLeft') go(at - 1); });
    document.body.appendChild(panel); panelFor = cardEl; root.classList.add('story-open');   // top level, as above
    show(0);
    requestAnimationFrame(() => { panel?.classList.add('is-in'); panel?.querySelector('.cs-close')?.focus({ preventScroll: true }); });
    document.addEventListener('keydown', onKey);
  }
  function hideSoon() { clearTimeout(hideTimer); hideTimer = setTimeout(closePanel, 180); }
  root.addEventListener('scroll', () => { if (panel && panel.classList.contains('cat-detail') && !panel.classList.contains('is-sheet')) closePanel(); }, { passive: true });
  addEventListener('resize', () => { if (panelFor && panel?.classList.contains('cat-detail')) place(panelFor); });

  let readyResolve;
  const ready = new Promise(r => { readyResolve = r; });

  async function load() {
    try {
      const res = await fetch('./incubator/catalogue.json', { cache: 'no-cache' });
      if (!res.ok) throw new Error(res.status);
      items = (await res.json()).items || [];
    } catch (e) {
      console.warn('catalogue.json could not be loaded', e);
      items = [{ id: 'workspace', href: '#workspace', status: 'ready', cover: 'assets/catalogue/workspace.webp',
        title: { zh: '多尺度城市生成系统', en: 'Multi-scale generative system' }, desc: { zh: '', en: '' }, tags: [] }];
    }
    loaded = true;
    readyResolve(items);
    render();
  }

  function card(item, i) {
    const status = STATUS.includes(item.status) ? item.status : 'planned';
    const open = e => {
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.button === 1) return;   // let ⌘/Ctrl-click open a new tab
      if (item.href === '#workspace') { e.preventDefault(); onOpenWorkspace?.(); }
      else if (isInternalApp(item)) { e.preventDefault(); onOpenApp?.(item, e.currentTarget.querySelector('.cat-cover')); }
    };
    const hasDetail = Boolean(item.detail?.sections?.length);
    const a = h('a', {
      class: `cat-card is-${status}${hasDetail ? ' has-detail' : ''}`, href: item.href || '#', style: `--i:${i}`,
      onclick: e => { closePanel(); open(e); }, 'aria-label': pick(item.title)
    },
      h('div', { class: 'cat-cover' },
        item.cover ? h('img', { src: pick(item.cover), alt: '', loading: i < 3 ? 'eager' : 'lazy', decoding: 'async' }) : h('div', { class: 'cat-cover-empty' }),
        h('span', { class: `cat-status s-${status}` }, t(`cat.status.${status}`)),
        h('span', { class: 'cat-go', 'aria-hidden': 'true' }, '→'),
        hasDetail ? h('span', { class: 'cat-dwell', 'aria-hidden': 'true' }) : null),
      h('div', { class: 'cat-body' },
        // the card's number only: who looks after an app stays in catalogue.json ("owner") but is not shown
        h('div', { class: 'cat-meta' }, h('span', { class: 'mono' }, String(i + 1).padStart(2, '0'))),
        h('h3', {}, pick(item.title)),
        h('p', {}, pick(item.desc)),
        h('div', { class: 'cat-tags' }, (item.tags || []).map(tag => h('span', {}, pick(tag))))));
    if (hasDetail) {
      a.addEventListener('pointerenter', e => {
        if (e.pointerType !== 'mouse') return;
        clearTimeout(hideTimer); hideTimer = 0;
        if (panelFor === a) return;
        clearTimeout(dwellTimer); a.classList.add('is-dwelling');
        dwellTimer = setTimeout(() => { a.classList.remove('is-dwelling'); openPanel(item, a); }, DWELL_MS);
      });
      a.addEventListener('pointerleave', e => {
        if (e.pointerType !== 'mouse') return;
        clearTimeout(dwellTimer); a.classList.remove('is-dwelling');
        if (panelFor === a) hideSoon();
      });
    }
    if (!hasDetail) return a;
    // the ⓘ (touch screens) is a button of its own beside the link, over the cover's corner — not inside the link,
    // where Safari may not hand it the tap
    const info = h('button', { type: 'button', class: 'cat-info', 'aria-label': t('cat.detail.open'),
      onclick: e => { e.preventDefault(); e.stopPropagation(); openStory(item, a, String(i + 1).padStart(2, '0')); } }, 'i');
    return h('div', { class: 'cat-item', style: `--i:${i}` }, a, info);
  }

  function slot(i) {
    return h('a', { class: 'cat-card cat-slot', href: 'https://github.com/HaoWang310/london-2100-generative-system/tree/main/incubator',
      target: '_blank', rel: 'noopener', style: `--i:${i}` },
      h('div', { class: 'cat-cover' }, h('div', { class: 'cat-plus', 'aria-hidden': 'true' }, '+')),
      h('div', { class: 'cat-body' },
        h('div', { class: 'cat-meta' }, h('span', { class: 'mono' }, '··')),
        h('h3', {}, t('cat.slot.title')),
        h('p', {}, t('cat.slot.desc'))));
  }

  function render() {
    if (!loaded) return;
    closePanel(); clearTimeout(dwellTimer);
    filters.replaceChildren(...['all', ...STATUS].map(key => {
      const n = key === 'all' ? items.length : items.filter(x => x.status === key).length;
      if (key !== 'all' && !n) return null;
      return h('button', { 'aria-pressed': String(filter === key), onclick: () => { filter = key; render(); } },
        t(`cat.filter.${key}`), h('span', { class: 'n' }, String(n)));
    }).filter(Boolean));
    const shown = items.filter(x => filter === 'all' || x.status === filter);
    grid.replaceChildren(...shown.map(card), ...(filter === 'all' ? [slot(shown.length)] : []));
    count.textContent = t('cat.count', { n: items.length });
    // restart the staggered reveal
    grid.classList.remove('is-revealed');
    requestAnimationFrame(() => requestAnimationFrame(() => grid.classList.add('is-revealed')));
  }

  onLangChange(render);

  return {
    /** Resolves with the items once catalogue.json is loaded (loads it if needed). */
    async item(id) { if (!loaded) load(); return (await ready).find(x => x.id === id) || null; },
    /** Resolves with all items once catalogue.json is loaded. */
    async items() { if (!loaded) load(); return ready; },
    coverOf(id) {
      const i = items.findIndex(x => x.id === id);
      return i >= 0 ? grid.querySelectorAll('.cat-card')[i]?.querySelector('.cat-cover') || null : null;
    },
    show() {
      if (!root.hidden && root.classList.contains('is-in')) return;   // already showing: keep cards (and their positions) as they are
      root.hidden = false;
      requestAnimationFrame(() => root.classList.add('is-in'));
      if (!loaded) load(); else render();
    },
    hide() {
      closePanel();
      root.classList.remove('is-in');
      setTimeout(() => { if (!root.classList.contains('is-in')) root.hidden = true; }, 450);
    },
    get lang() { return getLang(); }
  };
}
