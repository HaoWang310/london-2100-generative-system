// The map's display panel: a floating, collapsible panel at the map's top right,
// resizable by dragging its left and bottom edges. It drives the London map
// features (london-map.js): search, jumps, lighting, weather, colour theme,
// labels / vehicles / shadows / trees, and the analysis layers.

import { h } from '../ui/index.js?v=3ba4288';
import { t, onLangChange } from '../i18n/index.js?v=3ba4288';

const KEY = 'l2100.displayPanel';
const CSS = `
.dp { position: absolute; top: 12px; right: 12px; z-index: 6; width: 292px; max-height: calc(100% - 24px); display: flex; flex-direction: column;
  background: rgba(17,17,19,.94); border: 1px solid var(--hairline-strong); border-radius: 18px; box-shadow: 0 14px 40px rgba(0,0,0,.5);
  -webkit-backdrop-filter: blur(16px); backdrop-filter: blur(16px); color: var(--text); overflow: hidden; }
.dp.collapsed { height: auto !important; }
.dp-head { display: flex; align-items: center; justify-content: space-between; padding: 10px 10px 8px 16px; }
.dp-head b { font-size: 14px; }
.dp-head .btn { width: 30px; padding: 0; font-size: 16px; }
.dp-body { overflow-y: auto; padding: 0 14px 14px 16px; scrollbar-width: thin; min-height: 0; flex: 1; }
.dp.collapsed .dp-body, .dp.collapsed .dp-rz-y { display: none; }
.dp-sec { padding: 10px 0; border-top: 1px solid var(--hairline); }
.dp-sec:first-child { border-top: 0; padding-top: 0; }
.dp-t { font-size: 11px; color: var(--text-3); letter-spacing: .06em; margin-bottom: 7px; }
.dp-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; }
.dp-tile { height: 34px; border-radius: 10px; border: 1px solid var(--hairline-strong); background: var(--surface-2); color: var(--text-2); cursor: pointer;
  font: inherit; font-size: 12.5px; display: flex; align-items: center; justify-content: center; gap: 6px; }
.dp-tile:hover { color: var(--text); } .dp-tile[aria-pressed="true"] { border-color: var(--text); color: var(--text); background: var(--surface-3); }
.dp-tile.wide { grid-column: 1 / -1; }
.dp-tile .dots { display: inline-flex; gap: 2px; } .dp-tile .dots i { width: 7px; height: 7px; border-radius: 50%; display: block; }
.dp-theme { height: 46px; flex-direction: column; gap: 3px; }
.dp-row { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 5px 0; font-size: 12.5px; }
.dp-search { display: flex; gap: 6px; } .dp-search input { flex: 1; min-width: 0; height: 32px; border-radius: 10px; border: 1px solid var(--hairline-strong);
  background: var(--surface-2); color: var(--text); padding: 0 10px; font: inherit; }
.dp-status { font-size: 11.5px; color: var(--text-2); margin-top: 6px; line-height: 1.4; } .dp-status.err { color: var(--error); }
.dp-results { display: grid; gap: 4px; margin-top: 6px; } .dp-results button { text-align: left; font-size: 11.5px; line-height: 1.35; padding: 6px 8px;
  border-radius: 8px; border: 1px solid var(--hairline); background: var(--surface-1); color: var(--text-2); cursor: pointer; }
.dp-results button[aria-pressed="true"] { color: var(--text); border-color: var(--hairline-strong); }
.dp-layer { padding: 8px 0; border-bottom: 1px solid var(--hairline); } .dp-layer:last-child { border-bottom: 0; }
.dp-layer .name { font-size: 12.5px; } .dp-layer small { display: block; color: var(--text-3); font-size: 11px; margin-top: 1px; }
.dp-range { display: flex; align-items: center; gap: 8px; font-size: 11.5px; color: var(--text-2); margin-top: 6px; }
.dp-range input[type=range] { flex: 1; accent-color: var(--text); } .dp-range .v { width: 54px; text-align: right; font-variant-numeric: tabular-nums; }
.dp-range select { flex: 1; min-width: 0; height: 26px; border-radius: 7px; background: var(--surface-2); color: var(--text); border: 1px solid var(--hairline-strong); font: inherit; font-size: 11.5px; }
.dp-legend { display: flex; flex-wrap: wrap; gap: 4px 10px; font-size: 10.5px; color: var(--text-2); margin-top: 6px; }
.dp-legend i { display: inline-block; width: 9px; height: 9px; border-radius: 2px; margin-right: 4px; vertical-align: -1px; }
.dp-lstatus { font-size: 10.5px; color: var(--text-3); margin-top: 4px; } .dp-lstatus.err { color: var(--error); }
.dp-src { font-size: 10.5px; color: var(--text-3); margin-top: 8px; line-height: 1.4; }
.dp-rz { position: absolute; z-index: 2; } .dp-rz-x { left: -1px; top: 18px; bottom: 18px; width: 10px; cursor: ew-resize; }
.dp-rz-y { bottom: -1px; left: 18px; right: 18px; height: 10px; cursor: ns-resize; }
.dp-rz::after { content: ""; position: absolute; border-radius: 3px; background: var(--text-3); opacity: 0; transition: opacity .15s; }
.dp-rz-x::after { left: 3px; top: 50%; width: 4px; height: 40px; margin-top: -20px; } .dp-rz-y::after { top: 3px; left: 50%; height: 4px; width: 40px; margin-left: -20px; }
.dp:hover .dp-rz::after { opacity: .5; } .dp-rz:hover::after, .dp-rz.on::after { opacity: 1; background: var(--text); }
body.dp-resizing, body.dp-resizing * { user-select: none !important; }
@media (max-width: 720px) { .dp { width: calc(100% - 24px) !important; max-height: 55%; } .dp-rz { display: none; } }
`;

const LIGHTING = ['dawn', 'day', 'dusk', 'night', 'live'];
const WEATHER = ['clear', 'fog', 'rain', 'snow'];
const THEMES = ['dark', 'default', 'faded', 'planning', 'ocean', 'warm', 'vivid'];

export function mountDisplayPanel(host, lm, { source = '' } = {}) {
  if (!document.querySelector('style[data-dp]')) document.head.append(h('style', { 'data-dp': '1' }, CSS));
  let saved = {};
  try { saved = JSON.parse(localStorage.getItem(KEY) || '{}'); } catch { /* private mode */ }
  const panel = h('div', { class: `dp ${saved.collapsed ? 'collapsed' : ''}` });
  const apply = () => {
    panel.style.width = saved.w ? `${saved.w}px` : '';
    panel.style.height = saved.h ? `${saved.h}px` : '';
  };
  const store = () => { try { localStorage.setItem(KEY, JSON.stringify(saved)); } catch { /* private mode */ } };
  apply();
  host.append(panel);

  // ---------------------------------------------------------- resize by the left and bottom edges
  const handle = ax => {
    const el = h('div', { class: `dp-rz dp-rz-${ax}`, title: t('dp.resize') });
    el.addEventListener('pointerdown', e => {
      if (e.button !== 0) return; e.preventDefault(); e.stopPropagation();
      const r0 = panel.getBoundingClientRect(), hr = host.getBoundingClientRect(), x0 = e.clientX, y0 = e.clientY;
      el.setPointerCapture(e.pointerId); el.classList.add('on'); document.body.classList.add('dp-resizing');
      const mv = ev => {
        if (ax === 'x') saved.w = Math.round(Math.max(240, Math.min(hr.width - 24, 640, r0.width - (ev.clientX - x0))));
        else saved.h = Math.round(Math.max(160, Math.min(hr.height - 24, r0.height + ev.clientY - y0)));
        apply();
      };
      const up = () => { el.removeEventListener('pointermove', mv); el.removeEventListener('pointerup', up); el.classList.remove('on'); document.body.classList.remove('dp-resizing'); store(); };
      el.addEventListener('pointermove', mv); el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
    });
    el.addEventListener('dblclick', () => { if (ax === 'x') delete saved.w; else delete saved.h; apply(); store(); });
    return el;
  };

  // ---------------------------------------------------------- content
  let searchCtl = null, results = [];
  const st = () => lm.state;
  function build() {
    const S = st();
    const tile = (label, pressed, onclick, cls = '') => h('button', { type: 'button', class: `dp-tile ${cls}`, 'aria-pressed': String(pressed), onclick }, label);
    const sw = (on, onchange) => { const i = h('input', { type: 'checkbox', role: 'switch', checked: on }); i.addEventListener('change', () => onchange(i.checked)); return h('label', { class: 'switch' }, i, h('span')); };
    const range = (label, value, min, max, step, fmt, oninput) => {
      const v = h('span', { class: 'v' }, fmt(value)), i = h('input', { type: 'range', min, max, step, value });
      i.addEventListener('input', () => { v.textContent = fmt(+i.value); oninput(+i.value); });
      return h('div', { class: 'dp-range' }, h('span', {}, label), i, v);
    };
    const select = (label, value, options, onchange) => {
      const s = h('select', {}, options.map(([k, l]) => h('option', { value: k, selected: k === value }, l)));
      s.addEventListener('change', () => onchange(s.value));
      return h('div', { class: 'dp-range' }, h('span', {}, label), s);
    };
    const pct = v => `${Math.round(v * 100)}%`;
    const lstatus = s => h('div', { class: `dp-lstatus ${s.status === 'error' ? 'err' : ''}` }, t(`dp.status.${s.status || 'off'}`) + (s.error ? ` ${s.error}` : ''));

    // search
    const input = h('input', { type: 'search', placeholder: t('dp.searchPlaceholder'), 'aria-label': t('dp.search') });
    const status = h('div', { class: 'dp-status' });
    const list = h('div', { class: 'dp-results' });
    const run = async () => {
      const q = input.value.trim();
      if (!q) { status.textContent = t('dp.searchEmpty'); status.className = 'dp-status err'; return; }
      searchCtl?.abort(); searchCtl = new AbortController();
      const ctl = searchCtl, timer = setTimeout(() => ctl.abort(), 18000);
      status.textContent = t('dp.searching'); status.className = 'dp-status'; list.replaceChildren();
      try {
        results = await lm.search(q, { signal: ctl.signal });
        if (ctl !== searchCtl) return;
        if (!results.length) { status.textContent = t('dp.noResults'); status.className = 'dp-status err'; return; }
        const buttons = results.map(p => h('button', { type: 'button', 'aria-pressed': 'false', onclick: e => pick(p, e.currentTarget) }, p.name));
        list.replaceChildren(...buttons); pick(results[0], buttons[0]);
      } catch (e) {
        if (ctl !== searchCtl) return;
        status.textContent = e.name === 'AbortError' ? t('dp.searchTimeout') : (e.message || t('dp.searchFailed')); status.className = 'dp-status err';
      } finally { clearTimeout(timer); }
    };
    const pick = (p, btn) => { lm.goToPlace(p); for (const b of list.children) b.setAttribute('aria-pressed', String(b === btn)); status.textContent = `${t('dp.located')} ${p.name}`; status.className = 'dp-status'; };
    input.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); run(); } e.stopPropagation(); });

    const T = lm.themes;
    const body = h('div', { class: 'dp-body' },
      h('div', { class: 'dp-sec' }, h('div', { class: 'dp-search' }, input, h('button', { class: 'btn primary', onclick: run }, t('dp.search'))), status, list),
      h('div', { class: 'dp-sec' }, h('div', { class: 'dp-t' }, t('dp.jump')), h('div', { class: 'dp-grid' },
        tile(t('dp.jump70'), false, () => lm.jump('70km'), 'wide'), tile(t('dp.london'), false, () => lm.jump('london')),
        tile(t('dp.locate'), false, () => Promise.resolve(lm.jump('locate')).catch(() => { status.textContent = t('dp.locateFailed'); status.className = 'dp-status err'; })),
        tile(t('dp.reset'), false, () => lm.jump('reset'), 'wide'))),
      h('div', { class: 'dp-sec' }, h('div', { class: 'dp-t' }, t('dp.lighting')), h('div', { class: 'dp-grid' },
        LIGHTING.map(k => tile(t(`dp.light.${k}`), S.lighting === k, () => lm.setLighting(k), k === 'live' ? 'wide' : '')))),
      h('div', { class: 'dp-sec' }, h('div', { class: 'dp-t' }, t('dp.weather')), h('div', { class: 'dp-grid' },
        WEATHER.map(k => tile(t(`dp.weather.${k}`), S.weather === k, () => lm.setWeather(k))))),
      h('div', { class: 'dp-sec' }, h('div', { class: 'dp-t' }, t('dp.theme')), h('div', { class: 'dp-grid' },
        THEMES.filter(k => T[k]).map(k => tile([h('span', { class: 'dots' }, (T[k].dots || []).map(c => h('i', { style: `background:${c}` }))), t(`dp.themeName.${k}`)],
          S.theme === k, () => lm.setTheme(k), 'dp-theme')))),
      h('div', { class: 'dp-sec' }, h('div', { class: 'dp-t' }, t('dp.display')),
        h('div', { class: 'dp-row' }, t('dp.labels'), sw(S.labels, v => lm.setLabels(v))),
        h('div', { class: 'dp-row' }, t('dp.vehicles'), sw(S.vehicles, v => lm.setVehicles(v))),
        h('div', { class: 'dp-row' }, t('dp.shadows'), sw(S.shadows, v => lm.setShadows(v))),
        h('div', { class: 'dp-row' }, t('dp.trees'), sw(S.trees, v => lm.setTrees(v)))),
      h('div', { class: 'dp-sec' }, h('div', { class: 'dp-t' }, t('dp.layers')),
        h('div', { class: 'dp-layer' },
          h('div', { class: 'dp-row' }, h('span', {}, h('span', { class: 'name' }, t('dp.terrain')), h('small', {}, t('dp.terrainSub'))), sw(S.terrain.on, v => lm.setLayer('terrain', { on: v }))),
          range(t('dp.opacity'), S.terrain.opacity, 0, 1, 0.05, pct, v => lm.setLayer('terrain', { opacity: v })), lstatus(S.terrain)),
        h('div', { class: 'dp-layer' },
          h('div', { class: 'dp-row' }, h('span', {}, h('span', { class: 'name' }, t('dp.flood')), h('small', {}, t('dp.floodSub'))), sw(S.flood.on, v => lm.setLayer('flood', { on: v }))),
          select(t('dp.floodSource'), S.flood.source, [['combined', t('dp.floodCombined')], ['surface_water', t('dp.floodSurface')], ['rivers_sea', t('dp.floodRivers')]], v => lm.setLayer('flood', { source: v })),
          select(t('dp.floodMode'), S.flood.mode, [['nearest', t('dp.floodNearest')], ['linear', t('dp.floodLinear')]], v => lm.setLayer('flood', { mode: v })),
          range(t('dp.opacity'), S.flood.opacity, 0, 1, 0.05, pct, v => lm.setLayer('flood', { opacity: v })),
          h('div', { class: 'dp-legend' }, [['#9cddea', 'dp.floodVeryLow'], ['#f7d359', 'dp.floodLow'], ['#f29d38', 'dp.floodMedium'], ['#d73731', 'dp.floodHigh'], ['#999c9e', 'dp.floodNA']]
            .map(([c, k]) => h('span', {}, h('i', { style: `background:${c}` }), t(k)))), lstatus(S.flood)),
        h('div', { class: 'dp-layer' },
          h('div', { class: 'dp-row' }, h('span', {}, h('span', { class: 'name' }, t('dp.network')), h('small', {}, t('dp.networkSub'))), sw(S.network.on, v => lm.setLayer('network', { on: v }))),
          range(t('dp.opacity'), S.network.opacity, 0, 1, 0.05, pct, v => lm.setLayer('network', { opacity: v })),
          range(t('dp.threshold'), S.network.threshold, 0, 50, 0.25, v => `${v.toFixed(2)} km²`, v => lm.setLayer('network', { threshold: v })),
          h('div', { class: 'dp-legend' }, [['#4ba9ff', '0.25–1'], ['#2398ff', '1–5'], ['#00b7e4', '5–25'], ['#00e0e6', '25–100'], ['#70fff1', '≥100 km²']]
            .map(([c, l]) => h('span', {}, h('i', { style: `background:${c}` }), l))), lstatus(S.network)),
        h('div', { class: 'dp-layer' },
          h('div', { class: 'dp-row' }, h('span', {}, h('span', { class: 'name' }, t('dp.focus70')), h('small', {}, t('dp.focus70Sub'))), sw(S.focus70.on, v => lm.setLayer('focus70', { on: v }))))),
      h('p', { class: 'dp-src' }, source));
    const collapse = h('button', { class: 'btn ghost', title: t('dp.collapse'), onclick: () => { saved.collapsed = !panel.classList.toggle('collapsed') ? false : true; collapse.textContent = saved.collapsed ? '+' : '–'; store(); } }, saved.collapsed ? '+' : '–');
    const scroll = panel.querySelector('.dp-body')?.scrollTop || 0;
    panel.replaceChildren(handle('x'), handle('y'), h('div', { class: 'dp-head' }, h('b', {}, t('dp.title')), collapse), body);
    body.scrollTop = scroll;
  }
  build();
  let pending = 0;
  const refresh = () => { cancelAnimationFrame(pending); pending = requestAnimationFrame(build); };
  onLangChange(refresh);
  // keep the switches and statuses in step with the map, but never rebuild while a slider or field is in use
  return {
    update(what) { if (what === 'layers' || what === 'atmosphere' || what === 'theme' || what === 'display') { if (!panel.contains(document.activeElement) || document.activeElement.type === 'checkbox' || document.activeElement.tagName === 'BUTTON') refresh(); } },
    element: panel
  };
}
