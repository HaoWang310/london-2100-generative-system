// 01 · Loop City step 1 — the whole loop, the slime mould and the city grown together,
// 2025-2100, drawn on the real OSM map at its true position.
//
// The model itself is the incubator app incubator/loop-city-mould-growth (engine.js
// opens that page and talks to its LoopCityEngine), so a change there reaches the
// workspace. What opens, though, is a published result (result.js): one run grown on
// a desk and stored small, so that looking costs no arithmetic on any device. The
// engine is loaded when Run is pressed. See README.md.
//
// For the app: createLoopCityTool(viewer, {onState}) builds the engine, the map
// overlay and the inspector panel, with the same shape as the former growth simulator's tool (modules/01-growth-simulator, removed 26 Nov 2026). run() returns
// a ScaleBundle describing the loop's frame, for export and for later modules.

import { createBundle } from '../../shared/schemas/index.js?v=c944487';
import { createEngine, SOURCE_PATH, YEARS } from './engine.js?v=c944487';
import { createResult } from './result.js?v=c944487';
import { createLoopOverlay, USE_COLOUR } from './overlay.js?v=c944487';
import { createPanel, PANEL_CSS } from './panel.js?v=c944487';
import { FRAME, frameRing } from './georef.js?v=c944487';

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
 * onState(what) fires on 'loading' | 'loaded' | 'running' | 'year' | 'ran' | 'params' | 'mode' | 'error'.
 *
 * Two sources share one shape. The published result (result.js) is what opens: a few megabytes, no
 * arithmetic. The engine (engine.js, the whole incubator page) is loaded when Run is pressed, or when
 * the settings are asked for, and takes over the map while its own century is on show.
 */
export function createLoopCityTool(viewer, { onState = () => {} } = {}) {
  injectCss();
  const display = { mould: true, growth: true, highways: true, cells: true, rails: true, opacity: 0.9, background: true };
  let active = false, suspended = false, overlay = null, panel = null, src = null, wantRun = false;
  const container = globalThis.document ? document.createElement('div') : null;

  const changed = (from, what) => {
    if (what === 'loaded' && from === src) attachOverlay();
    panel?.update(what);
    if (from !== src) { if (what === 'loaded' || what === 'loading' || what === 'error') onState('mode'); return; }   // the source not on show: the panel only
    if (overlay && what !== 'params') viewer.redraw?.();
    onState(what);
  };
  const result = createResult({ onChange: what => changed(result, what) });
  const engine = createEngine({ onChange: what => changed(engine, what) });
  src = result;
  const s = () => src.state;
  const visible = () => !suspended && (active || display.background);
  const show = which => {                      // put a source on the map
    if (src === which) return;
    src = which;
    attachOverlay(); viewer.redraw?.();
    panel?.update('mode'); onState('year'); onState('mode');
  };

  function attachOverlay() {
    if (overlay || !viewer || !s().frame) return;
    overlay = createLoopOverlay({
      get: () => { const st = s(), k = src === result ? 'r' : 'e';
        return { show: visible(), frame: st.frame, growth: st.growth, mould: st.mould, version: k + st.version,
          vectors: st.vectors, vectorVersion: k + st.vectorVersion, base: st.base, on: display, opacity: display.opacity, final: st.year === YEARS }; }
    });
    viewer.addOverlay?.(overlay);
  }

  /** Load the engine if it is not here yet. The published result stays on the map meanwhile. */
  async function needEngine() {
    await engine.load();
    return engine;
  }
  /** Grow a century with the engine: load it first if need be, then put it on the map and run. */
  async function run() {
    if (engine.state.running || wantRun) return false;
    wantRun = true; panel?.update('mode');
    try {
      await needEngine();
      show(engine);
      return engine.run();
    } catch (e) { return false; } finally { wantRun = false; panel?.update('mode'); }
  }

  if (container) panel = createPanel(container, {
    engine, result,
    source: () => (src === result ? 'result' : 'engine'),
    starting: () => wantRun,
    run, loadEngine: () => needEngine().catch(() => {}),
    showPublished: () => { if (!engine.state.running && result.state.loaded) show(result); }
  }, {
    display,
    onDisplay: change => { Object.assign(display, change); viewer.redraw?.(); }
  });

  return {
    engine, result, display, container,
    get state() { return s(); },
    get source() { return src === result ? 'result' : 'engine'; },
    get active() { return active; },
    get stepping() { return s().running; },
    ring: () => frameRing(s().frame || FRAME),
    async open() {
      active = true; suspended = false;
      panel?.build();
      viewer.redraw?.();
      if (src === result && !result.state.loaded) {
        try { await result.load(); }
        catch (e) {                                  // nothing published, or a browser that cannot open it: the engine, as before
          console.warn('Loop City: the published result could not be opened, loading the engine instead:', e.message || e);
          show(engine);
          await engine.load();
        }
      } else if (src === engine) await engine.load();
      viewer.redraw?.();
      return s();
    },
    close() { active = false; viewer.redraw?.(); },
    /** Another simulation is open on the map: keep out of its way until it closes (true), or come back (false). */
    suspend(on) { suspended = Boolean(on); viewer.redraw?.(); },
    setYear: y => src.setYear(y),
    run,
    relang: () => panel?.update('lang'),
    resize: () => panel?.resize()
  };
}
