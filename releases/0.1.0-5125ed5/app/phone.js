// The workspace on a phone (24 Nov 2026): the one phone layout of ../shared/ui/phone, as every app has it.
//
//   the top bar    London 2100 · the scale in use ▾ (a menu of the scales and tools) · ⋯ (save, open, the build)
//   over the map   Display at the top left, the language switch at the top right
//   the map        the whole screen under the top bar
//   the sheet      folded: the scale's name, a line of status, the time bar, its main actions;
//                  opened: the description, the parameters, the figures
//   Display        2D / 3D, the map's own display panel (search, light, weather, colours, layers), the legend
//
// Nothing is cloned: the inspector, the time bar, the 2D / 3D switch, the language switch, the map's display panel and
// the legend are moved with their ids and their handlers, so main.js and the modules work on them as before.
// A phone is decided in index.html's head (html.l2phone), as in the apps; a narrow window on a computer keeps the
// stacked layout of app.css.
import { h } from '../shared/ui/index.js?v=5125ed5';
import { getLang } from '../shared/i18n/index.js?v=5125ed5';

const $ = id => document.getElementById(id);
const zh = () => getLang() === 'zh';
const L = (z, e) => (zh() ? z : e);

export const isPhoneWorkspace = () => document.documentElement.classList.contains('l2phone') && Boolean(window.L2Phone);

/** Builds the phone workspace once. onMore(button) opens the ⋯ menu (save, open, the build). */
export function mountPhoneWorkspace({ onMore } = {}) {
  if (!isPhoneWorkspace()) return null;
  const root = document.documentElement;
  root.style.setProperty('--l2ph-top', '48px');

  // ---- Display: 2D / 3D, then the map's display panel (moved in when the map is made), then the legend
  const viewTitle = h('div', { class: 'eyebrow' });
  const viewSec = h('section', { class: 'ws-dsec' }, viewTitle, document.querySelector('.top-actions .seg'));
  const mapSlot = h('div', { class: 'ws-dmap' });
  const legendSec = $('legend')?.closest('.insp-section');
  const display = h('div', { id: 'wsDisplay' }, viewSec, mapSlot, legendSec || '');
  document.body.append(display);

  // ---- the sheet: the inspector
  const quickExtra = [];          // a simulation's own main actions ([data-phone-quick] in its panel), borrowed while it is open
  const ph = window.L2Phone.init({
    sheet: $('inspector'), display, lang: $('langToggle'),
    quick: [$('inspActions')],
    hide: [$('phoneScales'), $('inspTitle'), $('inspCode')],
    zh,
    title: () => $('inspTitle')?.textContent.trim() || 'London 2100',
    status: () => [$('tlLabel')?.textContent.trim(), $('tlStatus')?.textContent.trim()].filter(Boolean).join(' · ')
  });
  if (!ph) return null;
  const timeline = document.querySelector('.timeline');
  ph.head.after(timeline);

  // ---- the top bar: the scale in use, as a menu, and ⋯
  const scaleBtn = h('button', { type: 'button', class: 'ws-scale', 'aria-haspopup': 'true', onclick: e => { e.stopPropagation(); toggleScales(scaleBtn); } });
  const more = h('button', { type: 'button', class: 'ws-more', 'aria-haspopup': 'true', onclick: e => { e.stopPropagation(); onMore?.(more); } }, '⋯');
  $('brandHome').after(scaleBtn);
  document.querySelector('.topbar').append(more);

  // ---- how much of the screen the folded sheet takes: the map's own buttons and notes stand above it
  const measure = () => {
    if (root.classList.contains('l2ph-open')) return;
    const top = $('inspector').getBoundingClientRect().top;
    if (top > 0 && top < innerHeight) root.style.setProperty('--ws-fold', `${Math.round(innerHeight - top)}px`);
  };
  addEventListener('resize', () => requestAnimationFrame(measure));

  function borrow(el) {           // move an element into the folded sheet, leaving a mark where it stood
    if (!el || el.__wsMark) return el;
    el.__wsMark = document.createComment('phone');
    el.before(el.__wsMark);
    return el;
  }
  function giveBack(el) { if (el?.__wsMark?.isConnected) el.__wsMark.replaceWith(el); if (el) delete el.__wsMark; }

  // a simulation's panel rebuilds itself (a new language, a new state): its main actions are borrowed again
  let watched = null, sim = null;
  const watcher = new MutationObserver(() => { if (sim) syncQuick(sim); });
  function syncQuick(container) {
    // in the panel's own order: its [data-phone-quick] elements, and the marks of those already borrowed (so that moving
    // one out, which the watcher sees, does not read as its having gone)
    const want = [];
    if (container) {
      const marks = new Map(quickExtra.map(el => [el.__wsMark, el]));
      const walk = document.createTreeWalker(container, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_COMMENT);
      for (let n = walk.nextNode(); n; n = walk.nextNode()) {
        if (n.nodeType === Node.COMMENT_NODE) { if (marks.has(n)) want.push(marks.get(n)); }
        else if (n.hasAttribute('data-phone-quick')) want.push(n);
      }
    }
    const kids = [...ph.quick.children];
    if (want.length === quickExtra.length && want.every((el, i) => el === quickExtra[i])
      && kids.length === want.length + 1 && want.every((el, i) => kids[i] === el) && kids[want.length] === $('inspActions')) return;
    for (const el of quickExtra.splice(0)) if (!want.includes(el)) giveBack(el);
    for (const el of want) quickExtra.push(borrow(el));
    ph.quick.replaceChildren(...quickExtra, $('inspActions'));
    requestAnimationFrame(measure);
  }

  function update({ simContainer = null } = {}) {
    // the scale in use
    const cur = document.querySelector('#scaleList .mod[aria-current="true"], #toolList .mod[aria-current="true"]');
    const num = cur?.querySelector('.num')?.textContent.trim() || '', name = cur?.querySelector('.name')?.textContent.trim() || '';
    const label = `${num} ${name}`.trim() || 'London 2100';
    if (scaleBtn.dataset.label !== label) { scaleBtn.dataset.label = label; scaleBtn.replaceChildren(h('span', {}, label), h('i', { 'aria-hidden': 'true' }, '▾')); }
    scaleBtn.setAttribute('aria-label', L(`尺度：${label}`, `Scale: ${label}`));
    viewTitle.textContent = L('视图', 'View');
    // the main actions: a simulation's own (Run the century, Back to the published result), then the inspector's
    sim = simContainer;
    if (watched !== simContainer) { watcher.disconnect(); watched = simContainer; if (simContainer) watcher.observe(simContainer, { childList: true, subtree: true }); }
    syncQuick(simContainer);
  }

  /** The map's display panel (shared/map-viewer) goes under Display; called once the map is made. */
  function adoptMapPanel() {
    const dp = $('map')?.querySelector('.dp');
    if (dp && dp.parentElement !== mapSlot) mapSlot.append(dp);
  }

  function toggleScales(btn) {
    let menu = $('wsScaleMenu');
    if (menu) { menu.remove(); return; }
    const close = () => { menu?.remove(); document.removeEventListener('pointerdown', outside, true); };
    const outside = e => { if (!e.target.closest('#wsScaleMenu, .ws-scale')) close(); };
    const item = m => h('button', {
      type: 'button', role: 'menuitemradio', disabled: m.disabled, 'aria-checked': m.getAttribute('aria-current') === 'true' ? 'true' : 'false',
      onclick: () => { close(); m.click(); }
    }, h('span', { class: 'num' }, m.querySelector('.num')?.textContent || ''), h('span', {}, m.querySelector('.name')?.textContent || ''));
    const scales = [...document.querySelectorAll('#scaleList .mod')], tools = [...document.querySelectorAll('#toolList .mod')];
    menu = h('div', { id: 'wsScaleMenu', class: 'phone-menu ws-scale-menu', role: 'menu' },
      ...scales.map(item), tools.length ? h('div', { class: 'ws-menu-sep' }) : '', ...tools.map(item));
    document.body.append(menu);
    const r = btn.getBoundingClientRect();
    menu.style.left = `${Math.max(8, Math.min(innerWidth - menu.offsetWidth - 8, r.left))}px`;
    menu.style.top = `${r.bottom + 6}px`;
    document.addEventListener('pointerdown', outside, true);
  }

  /** What covers the map: the Display row above (12 + 44 px into it), the folded sheet below. */
  function inset() {
    measure();
    const fold = parseFloat(getComputedStyle(root).getPropertyValue('--ws-fold')) || 0;
    return { top: 56, bottom: fold };
  }

  update();
  return { update, adoptMapPanel, inset, open: ph.open };
}
