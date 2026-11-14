// 01 · Growth simulator — city growth along the 412 km loop, 2025-2100, on 50 m parcels,
// drawn on the real OSM map at its true position.
//
// The simulator itself is the incubator app incubator/growth-simulator-dark
// (engine, controls, words, data); this module reads those files (source.js),
// so a change there reaches the workspace. See README.md.
//
// For the app: createGrowthTool(viewer, {onState}) builds the controller, the map
// overlay and the inspector panel. run() returns a ScaleBundle describing the loop
// (its stations as nodes), for export and for later modules.

import { createBundle } from '../../shared/schemas/index.js?v=13ac0d5';
import { createGrowth, YEARS } from './growth.js?v=13ac0d5';
import { createGrowthOverlay, PALETTE } from './overlay.js?v=13ac0d5';
import { createPanel, PANEL_CSS } from './panel.js?v=13ac0d5';
import { gridRing } from './georef.js?v=13ac0d5';

const mod = {
  id: '01-growth-simulator',
  level: 'london',
  version: '0.1.0',
  title: { zh: '城市生长模拟', en: 'Growth simulator' },
  description: {
    zh: '整条 412 km 环线 2025–2100 年的城市生长，50 m 地块，按真实位置叠加在 OSM 地图上。模拟器与孵化区「城市生长模拟」为同一份。',
    en: 'City growth along the whole 412 km loop, 2025–2100, on 50 m parcels, drawn on the OSM map at its true position. The same simulator as the incubator app.'
  },
  params: [],
  panel: true,
  palette: PALETTE,
  years: YEARS,
  async run(_input, _params, { growth } = {}) {
    const g = growth || createGrowth();
    await g.load();
    const { D, final } = g.state;
    return createBundle({
      id: 'growth:release',
      level: 'london',
      boundary: gridRing(D.meta),
      nodes: D.meta.NODES.map(n => ({ id: `g01:${n[0]}`, xy: [n[2], n[3]], kind: n[1] === 'A' ? 'absorbed-town' : n[1] === 'P' ? 'primary-station' : 'secondary-station' })),
      context: { source: 'incubator/growth-simulator-dark', grid: { xmin: D.meta.XMIN, ymax: D.meta.YMAX, cell: D.meta.C, nx: D.meta.NX, ny: D.meta.NY } },
      scenario: { ...g.state.P },
      algorithm: { module: mod.id, id: 'growth-variations', version: mod.version },
      stats: { pop2100: final.stats[YEARS].pop, builtKm2: +(final.stats[YEARS].km2.l + final.stats[YEARS].km2.m + final.stats[YEARS].km2.h).toFixed(1) }
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
 * The tool the app mounts. display: {show, rails, smooth, edges, opacity, background}.
 * onState(what) fires on 'loaded' | 'year' | 'mode' | 'params' | 'progress' | 'ran' | 'error'.
 */
export function createGrowthTool(viewer, { onState = () => {} } = {}) {
  injectCss();
  const display = { show: true, rails: true, smooth: true, edges: false, opacity: 0.9, background: true };
  let active = false, overlay = null, panel = null;
  const container = globalThis.document ? document.createElement('div') : null;

  const growth = createGrowth({
    onChange: (what) => {
      if (what === 'loaded') attachOverlay();
      panel?.update(what);
      if (overlay && (what === 'year' || what === 'mode' || what === 'ran')) viewer.redraw?.();
      onState(what);
    }
  });

  const visible = () => display.show && (active || display.background);
  function attachOverlay() {
    if (overlay || !viewer) return;
    const s = growth.state;
    overlay = createGrowthOverlay({
      meta: s.D.meta, rails: s.D.rails, stations: s.D.meta.NODES, opacity: display.opacity,
      get: () => ({ cells: growth.shown()?.cells || null, year: s.year, show: visible() })
    });
    overlay.set({ edges: display.edges, smooth: display.smooth, rails: display.rails, opacity: display.opacity });
    viewer.addOverlay?.(overlay);
  }

  if (container) panel = createPanel(container, growth, {
    display,
    onDisplay: change => { Object.assign(display, change); overlay?.set({ edges: display.edges, smooth: display.smooth, rails: display.rails, opacity: display.opacity }); viewer.redraw?.(); }
  });

  return {
    growth, display, container,
    get state() { return growth.state; },
    get active() { return active; },
    ring: () => (growth.state.loaded ? gridRing(growth.state.D.meta) : null),
    async open() {
      active = true;
      panel?.build();
      overlay?.sync(); viewer.redraw?.();
      await growth.load();
      return growth.state;
    },
    close() { active = false; overlay?.sync(); viewer.redraw?.(); },
    setYear: y => growth.setYear(y),
    relang: () => panel?.update('lang'),
    resize: () => panel?.resize()
  };
}
