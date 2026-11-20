// Catalogue screen: lists everything in incubator/catalogue.json.
// Adding an app needs no code change — add a folder in incubator/ and one
// entry in that JSON file.

import { t, pick, getLang, onLangChange } from '../shared/i18n/index.js';
import { h } from '../shared/ui/index.js';

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
    p.classList.remove('is-in'); setTimeout(() => p.remove(), 220);
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
    root.appendChild(panel); panelFor = cardEl;
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
  function hideSoon() { clearTimeout(hideTimer); hideTimer = setTimeout(closePanel, 180); }
  root.addEventListener('scroll', () => { if (panel && !panel.classList.contains('is-sheet')) closePanel(); }, { passive: true });
  addEventListener('resize', () => { if (panelFor) place(panelFor); });

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
        hasDetail ? h('span', { class: 'cat-info', role: 'button', tabindex: '0', 'aria-label': t('cat.detail.open'),
          onclick: e => { e.preventDefault(); e.stopPropagation(); panelFor === a ? closePanel() : openPanel(item, a, { touch: true }); },
          onkeydown: e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); openPanel(item, a, { touch: true }); } } }, 'i') : null,
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
    return a;
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
