// Catalogue screen: lists everything in incubator/catalogue.json.
// Adding an app needs no code change — add a folder in incubator/ and one
// entry in that JSON file.

import { t, pick, getLang, onLangChange } from '../shared/i18n/index.js?v=91e8109';
import { h } from '../shared/ui/index.js?v=91e8109';

const STATUS = ['ready', 'incubating', 'planned'];

export function createCatalogue(root, { onOpenWorkspace } = {}) {
  const grid = root.querySelector('.cat-grid');
  const filters = root.querySelector('.cat-filters');
  const count = root.querySelector('.cat-count');
  let items = [];
  let filter = 'all';
  let loaded = false;

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
    render();
  }

  function card(item, i) {
    const status = STATUS.includes(item.status) ? item.status : 'planned';
    const open = e => {
      if (item.href === '#workspace') { e.preventDefault(); onOpenWorkspace?.(); }
    };
    const a = h('a', {
      class: `cat-card is-${status}`, href: item.href || '#', style: `--i:${i}`,
      onclick: open, 'aria-label': pick(item.title)
    },
      h('div', { class: 'cat-cover' },
        item.cover ? h('img', { src: item.cover, alt: '', loading: i < 3 ? 'eager' : 'lazy', decoding: 'async' }) : h('div', { class: 'cat-cover-empty' }),
        h('span', { class: `cat-status s-${status}` }, t(`cat.status.${status}`)),
        h('span', { class: 'cat-go', 'aria-hidden': 'true' }, '→')),
      h('div', { class: 'cat-body' },
        h('div', { class: 'cat-meta' }, h('span', { class: 'mono' }, String(i + 1).padStart(2, '0')),
          item.owner ? h('span', {}, item.owner) : null),
        h('h3', {}, pick(item.title)),
        h('p', {}, pick(item.desc)),
        h('div', { class: 'cat-tags' }, (item.tags || []).map(tag => h('span', {}, pick(tag))))));
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
    show() {
      root.hidden = false;
      requestAnimationFrame(() => root.classList.add('is-in'));
      if (!loaded) load(); else render();
    },
    hide() {
      root.classList.remove('is-in');
      setTimeout(() => { if (!root.classList.contains('is-in')) root.hidden = true; }, 450);
    },
    get lang() { return getLang(); }
  };
}
