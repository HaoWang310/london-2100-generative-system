// Standalone module preview: runs ONE module on sample input, on the shared
// map viewer, with its parameter panel. Used by modules/*/preview.html so each
// module can be developed and checked without the rest of the app.
//
//   import { mountPreview } from '../../shared/ui/preview.js?v=747feb5';
//   mountPreview({ module, input: () => sampleBundle });

import { createMapViewer } from '../map-viewer/index.js?v=747feb5';
import { validateBundle, defaultParams } from '../schemas/index.js?v=747feb5';
import { t, pick, toggleLang, getLang, applyI18n, onLangChange } from '../i18n/index.js?v=747feb5';
import { h, renderParams, renderStats, download } from './index.js?v=747feb5';

const CSS = `
.pv { display: grid; grid-template-columns: 1fr 300px; grid-template-rows: 48px 1fr; height: 100vh; }
.pv-top { grid-column: 1 / -1; display: flex; align-items: center; gap: 12px; padding: 0 16px; border-bottom: 1px solid var(--hairline); }
.pv-top b { font-weight: 600; } .pv-top .sp { flex: 1; }
.pv-map { position: relative; background: #0b0b0c; }
.pv-side { background: var(--surface-1); border-left: 1px solid var(--hairline); padding: 16px; overflow: auto; display: grid; gap: 14px; align-content: start; }
.pv-ok { color: var(--ok); } .pv-bad { color: var(--error); }
`;

export async function mountPreview({ module, input, sceneFor }) {
  document.head.append(h('style', {}, CSS));
  let params = defaultParams(module);
  let result = null;

  const status = h('p', { class: 'small' });
  const paramsEl = h('div');
  const statsEl = h('div');
  const mapEl = h('div', { style: 'position:absolute;inset:0' });
  const langBtn = h('button', { class: 'btn ghost', onclick: toggleLang });
  const title = h('b');
  const desc = h('p', { class: 'muted small' });

  document.body.append(h('div', { class: 'pv' },
    h('header', { class: 'pv-top' },
      h('span', { class: 'mono muted' }, `${module.id} · v${module.version}`), title,
      h('span', { class: 'sp' }), h('span', { class: 'muted small', 'data-i18n': 'preview.title' }), langBtn),
    h('main', { class: 'pv-map' }, mapEl),
    h('aside', { class: 'pv-side' },
      desc,
      h('div', { class: 'eyebrow', 'data-i18n': 'preview.input' }),
      h('div', { class: 'eyebrow', 'data-i18n': 'insp.params' }), paramsEl,
      h('button', { class: 'btn primary', 'data-i18n': 'preview.run', onclick: run }),
      status,
      h('div', { class: 'eyebrow', 'data-i18n': 'insp.result' }), statsEl,
      h('button', { class: 'btn', onclick: () => result && download(`${module.id}-result.json`, result) }, 'JSON ↓'))));

  const viewer = await createMapViewer(mapEl, { onSelect: () => {}, onEnter: () => {} });
  const base = await input();
  viewer.fit(base?.boundary);

  function paint() {
    title.textContent = pick(module.title);
    desc.textContent = pick(module.description);
    langBtn.textContent = getLang() === 'zh' ? 'EN' : '中';
    applyI18n(document);
    renderParams(paramsEl, module.params, params, (v, { committed }) => { params = { ...params, ...v }; if (committed) run(); });
    renderStats(statsEl, result?.stats || {});
  }

  async function run() {
    const started = performance.now();
    try {
      result = await module.run(base, params, {});
      const errors = validateBundle(result);
      status.className = 'small ' + (errors.length ? 'pv-bad' : 'pv-ok');
      status.textContent = errors.length ? t('preview.invalid', { msg: errors.join('; ') }) : `${t('preview.valid')} · ${Math.round(performance.now() - started)} ms`;
      const scene = sceneFor ? sceneFor(base, result) : {
        boundary: base?.boundary || result.boundary,
        children: result.children,
        roads: [...(base?.context?.parentRoads || []).map(r => ({ ...r, static: true })), ...result.roads],
        nodes: result.nodes
      };
      viewer.setScene(scene);
    } catch (e) {
      status.className = 'small pv-bad';
      status.textContent = String(e.message || e);
    }
    paint();
  }

  onLangChange(paint);
  paint();
  await run();
  if (!base) viewer.fit(result.boundary);
}
