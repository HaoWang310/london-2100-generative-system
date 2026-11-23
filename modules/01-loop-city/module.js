// 01 · Loop City step 1 — the whole loop, the slime mould and the city grown together,
// 2025-2100, drawn on the real OSM map at its true position.
//
// The model itself is the incubator app incubator/loop-city-mould-growth (engine.js
// opens that page and talks to its LoopCityEngine), so a change there reaches the
// workspace. See README.md.
//
// For the app: createLoopCityTool(viewer, {onState}) builds the engine, the map
// overlay and the inspector panel, with the same shape as the growth simulator's tool (modules/01-growth-simulator). run() returns
// a ScaleBundle describing the loop's frame, for export and for later modules.

import { createBundle } from '../../shared/schemas/index.js';
import { createEngine, SOURCE_PATH, YEARS } from './engine.js';
import { createLoopOverlay, USE_COLOUR } from './overlay.js';
import { createPanel, PANEL_CSS } from './panel.js';
import { FRAME, frameRing } from './georef.js';

const mod = {
  id: '01-loop-city',
  level: 'london',
  version: '0.1.0',
  title: { zh: 'Loop City · 黏菌与生长', en: 'Loop City · mould and growth' },
  description: {
    zh: '整条 412 km 环线上黏菌与城市共同生长，2025–2100 年；百年结束后从黏菌的干道读出单元。按真实位置叠加在 OSM 地图上。模型与孵化区「Loop City · 1 整环」为同一份。',
    en: 'The slime mould and the city grown together round the whole 412 km loop, 2025–2100; when the century ends the cells are read from the mould\'s highways. Drawn on the OSM map at its true position. The same model as the incubator app Loop City step 1.'
  },
  navHint: { zh: '整环 · 黏菌与单元', en: 'The whole loop · mould and cells' },
  source: { zh: `模型来自孵化区 ${SOURCE_PATH}`, en: `The model is the incubator app ${SOURCE_PATH}` },
  badges: ['EPSG:27700', '93 m · 70 m'],
  legend: [
    ['#ffffff', { zh: '黏菌与干道', en: 'Slime mould and highways' }],
    [USE_COLOUR.urban, { zh: '城市单元', en: 'Urban cells' }],
    [USE_COLOUR.agricultural, { zh: '农业单元', en: 'Agricultural cells' }],
    [USE_COLOUR.open, { zh: '开敞单元', en: 'Open cells' }]
  ],
  params: [],
  panel: true,
  years: YEARS,
  async run(_input, _params, { engine } = {}) {
    const s = engine?.state;
    const frame = s?.frame || FRAME;
    const stations = s?.base?.stations?.features || [];
    return createBundle({
      id: 'loop-city:step1',
      level: 'london',
      boundary: frameRing(frame),
      nodes: stations.map(f => ({ id: `lc01:${f.properties.id}`, xy: [f.geometry.coordinates[0], f.geometry.coordinates[1]],
        kind: f.properties.kind === 'primary' ? 'primary-station' : f.properties.kind === 'airport' ? 'absorbed-town' : 'secondary-station' })),
      context: { source: SOURCE_PATH, frame: { ...frame } },
      algorithm: { module: mod.id, id: 'mould-and-growth', version: mod.version },
      stats: { cells: s?.stats?.cells || 0, highwayKm: s?.stats?.highwayKm || 0 }
    });
  }
};

export default mod;

let cssDone = false;
function injectCss() {
  if (cssDone || !globalThis.document) return;
  const st = document.createElement('style'); st.dataset.module = mod.id; st.textContent = PANEL_CSS;
  document.head.append(st); cssDone = true;
}

/**
 * The tool the app mounts. display: {mould, growth, highways, cells, rails, opacity, background}.
 * onState(what) fires on 'loading' | 'loaded' | 'running' | 'year' | 'ran' | 'params' | 'error'.
 */
export function createLoopCityTool(viewer, { onState = () => {} } = {}) {
  injectCss();
  const display = { mould: true, growth: true, highways: true, cells: true, rails: true, opacity: 0.9, background: true };
  let active = false, suspended = false, overlay = null, panel = null;
  const container = globalThis.document ? document.createElement('div') : null;

  const engine = createEngine({
    onChange: what => {
      if (what === 'loaded') attachOverlay();
      panel?.update(what);
      if (overlay && what !== 'params') viewer.redraw?.();
      onState(what);
    }
  });
  const s = engine.state;
  const visible = () => !suspended && (active || display.background);

  function attachOverlay() {
    if (overlay || !viewer) return;
    overlay = createLoopOverlay({
      get: () => ({ show: visible(), frame: s.frame, growth: s.growth, mould: s.mould, version: s.version,
        vectors: s.vectors, vectorVersion: s.vectorVersion, base: s.base, on: display, opacity: display.opacity, final: s.year === YEARS })
    });
    viewer.addOverlay?.(overlay);
  }

  if (container) panel = createPanel(container, engine, {
    display,
    onDisplay: change => { Object.assign(display, change); viewer.redraw?.(); },
    onRun: () => { engine.run(); }
  });

  return {
    engine, display, container,
    get state() { return s; },
    get active() { return active; },
    get stepping() { return s.running; },
    ring: () => frameRing(s.frame || FRAME),
    async open() {
      active = true; suspended = false;
      panel?.build();
      viewer.redraw?.();
      await engine.load();
      viewer.redraw?.();
      return s;
    },
    close() { active = false; viewer.redraw?.(); },
    /** Another simulation is open on the map: keep out of its way until it closes (true), or come back (false). */
    suspend(on) { suspended = Boolean(on); viewer.redraw?.(); },
    setYear: y => engine.setYear(y),
    relang: () => panel?.update('lang'),
    resize: () => panel?.resize()
  };
}
