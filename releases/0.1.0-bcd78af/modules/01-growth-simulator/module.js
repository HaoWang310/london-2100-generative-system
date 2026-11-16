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

import { createBundle } from '../../shared/schemas/index.js?v=bcd78af';
import { createGrowth, YEARS } from './growth.js?v=bcd78af';
import { createGrowthOverlay, PALETTE } from './overlay.js?v=bcd78af';
import { createPanel, PANEL_CSS } from './panel.js?v=bcd78af';
import { gridRing } from './georef.js?v=bcd78af';
import { groundImage, magnetImage, edgeImage } from './step-images.js?v=bcd78af';

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
 * The tool the app mounts. display: {show, rails, grain, fill, edges, opacity, background}.
 * onState(what) fires on 'loaded' | 'year' | 'mode' | 'params' | 'progress' | 'ran' | 'error'.
 */
export function createGrowthTool(viewer, { onState = () => {} } = {}) {
  injectCss();
  const display = { show: true, rails: true, grain: true, fill: true, edges: false, opacity: 0.9, background: true };
  let active = false, overlay = null, panel = null;
  // the step of 生成流程 open in the panel (null: none), and what it shows on the map
  let magnetT = 0, step = null, pass1Cells = null, ground = null, magnet = null, magnetKey = '', edgeFor = null, edge = null;
  const container = globalThis.document ? document.createElement('div') : null;

  const growth = createGrowth({
    onChange: (what) => {
      if (what === 'loaded') attachOverlay();
      panel?.update(what);
      if (overlay && (what === 'year' || what === 'mode' || what === 'ran')) viewer.redraw?.();
      if (step && (what === 'mode' || what === 'ran')) showStep();
      if (step && what === 'params' && step.show.includes('magnet')) { clearTimeout(magnetT); magnetT = setTimeout(showStep, 300); }   // the field follows the sliders
      onState(what);
    }
  });

  const visible = () => display.show && (active || display.background);
  function attachOverlay() {
    if (overlay || !viewer) return;
    const s = growth.state;
    overlay = createGrowthOverlay({
      meta: s.D.meta, rails: s.D.rails, stations: s.D.meta.NODES, opacity: display.opacity,
      get: () => {
        if (!step || !active) return { cells: growth.shown()?.cells || null, year: s.year, show: visible() };
        const sh = step.show, p1 = sh.includes('pass1');
        return { cells: p1 ? pass1Cells : sh.includes('growth') ? growth.shown()?.cells || null : null, year: s.year, show: visible(),
          rails: sh.includes('rail'), stations: sh.includes('stations'), names: sh.includes('names'), zones: sh.includes('zones') };
      }
    });
    overlay.set({ edges: display.edges, grain: display.grain, rails: display.rails, opacity: display.opacity, fill: display.fill });
    viewer.addOverlay?.(overlay);
    // the illustrative fill up to the 70 km circle (small; the overlay draws without it until it arrives)
    const v = new URL(import.meta.url).search;
    fetch(new URL(`./data/fill-strips.z${v}`, import.meta.url))
      .then(r => { if (!r.ok) throw new Error(`fill ${r.status}`); return new Response(r.body.pipeThrough(new DecompressionStream('deflate'))).arrayBuffer(); })
      .then(b => { overlay.setFill(new Uint8Array(b)); viewer.redraw?.(); })
      .catch(e => console.warn('Growth fill unavailable:', e.message || e));
  }

  // ------------------------------------------------------------ the steps on the map
  const variationShown = () => growth.state.mode === 'variation' && Boolean(growth.state.variation);
  async function firstPass() {
    const v = growth.state.variation;
    return variationShown() && v.pass1 ? v.pass1 : growth.loadPass1();
  }
  let stepSeq = 0;
  async function showStep() {
    if (!overlay) return;
    const seq = ++stepSeq, sh = step && active ? step.show : [], s = growth.state;
    const keep = () => seq === stepSeq;
    let img = null;
    try {
      if (sh.includes('pass1') || step?.id === 'farm') { const c = await firstPass(); if (!keep()) return; pass1Cells = c; }
      if (sh.includes('aonb')) { ground ||= await groundImage(s.D, new URL(s.base, location.href)); img = ground; }
      else if (sh.includes('magnet')) {
        const key = JSON.stringify(s.P);
        if (magnetKey !== key) { const b = await growth.magnet(); if (!keep()) return; magnet = magnetImage(s.D.meta, b); magnetKey = key; }
        img = magnet;
      } else if (sh.includes('edge') && pass1Cells) {
        if (edgeFor !== pass1Cells) { edge = edgeImage(s.D.meta, pass1Cells, YEARS); edgeFor = pass1Cells; }
        img = edge;
      }
    } catch (e) { console.warn('Growth step view:', e.message || e); }
    if (!keep()) return;
    overlay.setImage(img?.canvas || null, img?.rect, { alpha: sh.includes('magnet') ? 0.9 : 1, top: img === edge });
    overlay.sync(); viewer.redraw?.();
  }

  if (container) panel = createPanel(container, growth, {
    onStep: st => { step = st; showStep(); },
    display,
    onDisplay: change => { Object.assign(display, change); overlay?.set({ edges: display.edges, grain: display.grain, fill: display.fill, rails: display.rails, opacity: display.opacity }); viewer.redraw?.(); }
  });

  return {
    growth, display, container,
    get state() { return growth.state; },
    get active() { return active; },
    /** True while the panel's 生成流程 drives the year itself. */
    get stepping() { return Boolean(panel?.stepping?.()); },
    ring: () => (growth.state.loaded ? gridRing(growth.state.D.meta) : null),
    async open() {
      active = true;
      panel?.build();
      overlay?.sync(); viewer.redraw?.();
      await growth.load();
      growth.prepare();                // the ground grids, in the background, for a quick first run
      return growth.state;
    },
    close() { active = false; showStep(); },
    setYear: y => growth.setYear(y),
    relang: () => panel?.update('lang'),
    resize: () => panel?.resize()
  };
}
