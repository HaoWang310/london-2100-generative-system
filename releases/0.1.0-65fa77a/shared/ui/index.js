// Shared UI helpers: parameter panel generated from a module's `params`,
// statistics grid, toasts. No framework; plain DOM.

import { pick, t, getLang as _getLang, setLang as _setLang, onLangChange as _onLangChange } from '../i18n/index.js?v=65fa77a';

export const h = (tag, attrs = {}, ...children) => {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === null || v === false) continue;
    if (k.startsWith('on')) el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'class') el.className = v;
    else if (k === 'dataset') Object.assign(el.dataset, v);
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of children.flat()) if (c !== null && c !== undefined && c !== false) el.append(c.nodeType ? c : String(c));
  return el;
};

const fmt = (p, v) => {
  if (p.type === 'toggle') return '';
  if (typeof v === 'number') {
    const decimals = p.step && p.step < 1 ? String(p.step).split('.')[1].length : 0;
    return v.toFixed(decimals) + (p.unit ? ` ${p.unit}` : '');
  }
  return '';
};

/**
 * Render controls for module.params into `container`.
 * onChange(values, {committed}) fires with committed=false while dragging.
 */
export function renderParams(container, params, values, onChange) {
  container.replaceChildren();
  if (!params?.length) { container.append(h('p', { class: 'muted' }, t('params.none'))); return; }
  for (const p of params) {
    const value = values[p.key] ?? p.default;
    const id = `param-${p.key}`;
    const valueEl = h('span', { class: 'param-value' }, fmt(p, value));
    let control;
    if (p.type === 'range') {
      control = h('input', { id, type: 'range', min: p.min, max: p.max, step: p.step, value });
      control.addEventListener('input', () => { valueEl.textContent = fmt(p, +control.value); onChange({ [p.key]: +control.value }, { committed: false }); });
      control.addEventListener('change', () => onChange({ [p.key]: +control.value }, { committed: true }));
    } else if (p.type === 'select') {
      control = h('select', { id }, p.options.map(o => h('option', { value: o.value, selected: o.value === value }, pick(o.label))));
      control.addEventListener('change', () => onChange({ [p.key]: control.value }, { committed: true }));
    } else if (p.type === 'toggle') {
      const input = h('input', { id, type: 'checkbox', role: 'switch', checked: Boolean(value) });
      input.addEventListener('change', () => onChange({ [p.key]: input.checked }, { committed: true }));
      control = h('label', { class: 'switch' }, input, h('span'));
    }
    container.append(h('div', { class: 'param' },
      h('div', { class: 'param-head' },
        h('label', { class: 'param-label', for: id }, pick(p.label)),
        p.type === 'toggle' ? control : valueEl),
      p.type === 'toggle' ? null : control));
  }
}

export function renderStats(container, stats = {}) {
  container.replaceChildren();
  const entries = Object.entries(stats);
  if (!entries.length) return;
  container.append(h('div', { class: 'stats' }, entries.map(([k, v]) =>
    h('div', { class: 'stat' }, h('b', {}, typeof v === 'number' ? v.toLocaleString() : String(v)), h('span', {}, t(`stat.${k}`))))));
}

let toastHost = null;
export function toast(message, { action, onAction, kind = 'info', timeout = 6000 } = {}) {
  if (!toastHost) { toastHost = h('div', { class: 'toasts', role: 'status', 'aria-live': 'polite' }); document.body.append(toastHost); }
  const el = h('div', { class: `toast ${kind}` }, h('span', {}, message));
  if (action) el.append(h('button', { class: 'btn primary', onclick: () => { onAction?.(); el.remove(); } }, action));
  el.append(h('button', { class: 'btn ghost', 'aria-label': t('common.close'), onclick: () => el.remove() }, '✕'));
  toastHost.append(el);
  if (timeout) setTimeout(() => el.remove(), timeout);
  return el;
}

export function download(filename, data, type = 'application/json') {
  const blob = new Blob([typeof data === 'string' ? data : JSON.stringify(data, null, 2)], { type });
  const a = h('a', { href: URL.createObjectURL(blob), download: filename });
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

/**
 * The one language switch used everywhere (中文 | EN segmented control).
 * Call with an empty container; it keeps itself in sync with the current language.
 */
export function mountLangSwitch(container) {
  container.classList.add('seg', 'lang-seg');
  container.setAttribute('role', 'group');
  const buttons = [['zh', '中文'], ['en', 'EN']].map(([code, label]) => {
    const b = h('button', { type: 'button', lang: code === 'zh' ? 'zh-CN' : 'en', onclick: () => _setLang(code) }, label);
    b.dataset.lang = code;
    return b;
  });
  container.replaceChildren(...buttons);
  const sync = () => {
    container.setAttribute('aria-label', _getLang() === 'zh' ? '界面语言' : 'Interface language');
    for (const b of buttons) b.setAttribute('aria-pressed', String(b.dataset.lang === _getLang()));
  };
  sync();
  _onLangChange(sync);
  return container;
}
