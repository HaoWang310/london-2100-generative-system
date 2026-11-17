// London 2100 unified app shell.
// London → Region → Wool → Tensor, with 05 integration / 06 export tools,
// and 01 Growth simulator beside the chain (open at any level, a background elsewhere).
//
// Rules this shell guarantees:
//  - Zooming/panning the map never touches the workspace (no clearing, no regeneration).
//  - Going back up a level keeps every level's parameters and results.
//  - A module runs only when the user enters a level for the first time, changes
//    a parameter, or presses Regenerate.

import { SCALES, TOOLS, SIMULATIONS, exporters } from './registry.js?v=444f5c1';
import { createWorkspaceStore, SCALE_ORDER } from '../shared/state/index.js?v=444f5c1';
import { childInput, createBundle, validateBundle, defaultParams } from '../shared/schemas/index.js?v=444f5c1';
import { createMapViewer, ROAD_STYLE, HIERARCHY_ORDER } from '../shared/map-viewer/index.js?v=444f5c1';
import { t, pick, toggleLang, getLang, applyI18n, onLangChange } from '../shared/i18n/index.js?v=444f5c1';
import { h, renderParams, renderStats, toast, download, mountLangSwitch } from '../shared/ui/index.js?v=444f5c1';
import { createIntro } from './intro.js?v=444f5c1';
import { createCatalogue } from './catalogue.js?v=444f5c1';
import { createAppView } from './appview.js?v=444f5c1';
import { watchForUpdates, fetchReleases, latestUrl, releaseUrl, versionLabel, describeBuild, BUILD } from './updates.js?v=444f5c1';

const $ = id => document.getElementById(id);
const scaleOf = level => SCALES.find(s => s.level === level);
// The next level the user can enter from `level` (none while that part of the chain is hidden).
const nextScale = level => { const n = SCALES[SCALES.findIndex(s => s.level === level) + 1]; return n && !n.hidden ? n : null; };
const shownTools = () => TOOLS.filter(x => !x.hidden);
const storage = (() => { try { localStorage.setItem('l2100.t', '1'); return localStorage; } catch { return null; } })();
const store = createWorkspaceStore({ storage, key: BUILD.releasePath ? `l2100.workspace@${BUILD.releasePath}` : 'l2100.workspace' });

let viewer = null;
let activeTool = null;          // null | 'integration' | 'export' | 'growth'
let growthTool = null;          // created the first time 01 is opened
let progress = 1;               // timeline position for the current result
let playing = null;             // requestAnimationFrame id
let runToken = 0;
let view3D = false;

// ------------------------------------------------------------------ helpers

const keyOf = e => `${e.level}|${e.inputId}`;
const levelIndex = level => SCALE_ORDER.indexOf(level);

function crumbLabel(entry) {
  if (entry.level === 'london') return t('scale.london');
  if (entry.level === 'region') return t('scale.region');
  const label = entry.input?.context?.label || '';
  return `${label} · ${t(`scale.${entry.level}`)}`;
}

function woolEntry() {
  return store.getState().path.map(p => store.entry(p.level, p.inputId)).find(e => e.level === 'wool') || null;
}

function toolAvailable() {
  const w = woolEntry();
  return Boolean(w && w.result);
}

// ------------------------------------------------------------------ running

async function runEntry(entry, { animate = true } = {}) {
  const scale = scaleOf(entry.level);
  const token = ++runToken;
  const started = performance.now();
  store.setStatus(entry.level, entry.inputId, 'running');
  renderChrome();
  try {
    const result = await scale.module.run(entry.input, entry.params, {
      onProgress: p => token === runToken && store.setProgress(entry.level, entry.inputId, p)
    });
    if (token !== runToken) return;               // a newer run superseded this one
    const errors = validateBundle(result);
    if (errors.length) throw new Error(errors.join('; '));
    result.stats = { ...result.stats, ms: Math.round(performance.now() - started) };
    store.setResult(entry.level, entry.inputId, result);
    if (animate) play(0); else progress = 1;
    render();
  } catch (err) {
    console.error(err);
    store.setStatus(entry.level, entry.inputId, 'error', { error: String(err.message || err) });
    toast(t('run.failed', { msg: err.message || err }), { kind: 'error' });
    render();
  }
}

function enterLevel(level, input) {
  leaveGrowth();
  const parent = store.current();
  const scale = scaleOf(level);
  const entry = store.enter(level, input, defaultParams(scale.module), parent?.result?.createdAt ?? null);
  activeTool = null;
  progress = 1;
  viewer?.fit(input?.boundary || entry.result?.boundary);
  render();
  if (!entry.result) runEntry(entry);
}

function enterNext(childId) {
  const cur = store.current();
  if (!cur?.result) return;
  const next = nextScale(cur.level);
  if (!next) return;
  if (next.needsSelection) {
    const id = childId ?? cur.selectedChildId;
    if (!id) { toast(t('hint.selectFirst')); return; }
    if (id !== cur.selectedChildId) store.select(cur.level, cur.inputId, id);
    enterLevel(next.level, childInput(cur.result, id));
  } else {
    enterLevel(next.level, cur.result);
  }
}

function goTo(index) {
  stop();
  leaveGrowth();
  activeTool = null;
  const e = store.goTo(index);
  progress = 1;
  if (e) viewer?.fit(e.input?.boundary || e.result?.boundary);
  render();
}

function goBack() {
  if (activeTool) { leaveGrowth(); activeTool = null; progress = 1; render(); return; }
  const path = store.getState().path;
  if (path.length > 1) goTo(path.length - 2);
}

// ------------------------------------------------------------------ tools

function integrationInput() {
  const w = woolEntry();
  const tensors = store.descendants('wool', w.inputId).filter(e => e.result);
  const roads = [
    ...w.result.roads.map(r => ({ ...r, id: `w:${r.id}` })),
    ...tensors.flatMap(e => e.result.roads.map(r => ({ ...r, id: `${e.inputId}:${r.id}` })))
  ];
  return createBundle({
    id: w.result.id,
    level: 'wool',
    boundary: w.result.boundary,
    roads,
    context: { tensorCount: tensors.length },
    algorithm: { module: 'app', id: 'integration-input', version: BUILD.version }
  });
}

function openTool(key) {
  if (!shownTools().some(x => x.key === key)) return;
  if (!toolAvailable()) { toast(t('hint.needWool')); return; }
  stop();
  leaveGrowth();
  activeTool = key;
  progress = 1;
  if (key === 'integration') {
    const input = integrationInput();
    const tool = TOOLS.find(x => x.key === key);
    const entry = store.upsert('integration', input, defaultParams(tool.module));
    viewer?.fit(input.boundary);
    render();
    if (!entry.result) runTool(entry);
  } else render();
}

async function runTool(entry) {
  const tool = TOOLS.find(x => x.key === 'integration');
  const input = integrationInput();                     // always use the latest roads
  store.upsert('integration', input);
  store.setStatus('integration', entry.inputId, 'running');
  try {
    const started = performance.now();
    const result = await tool.module.run(input, store.entry('integration', entry.inputId).params);
    result.stats = { ...result.stats, ms: Math.round(performance.now() - started) };
    store.setResult('integration', entry.inputId, result);
  } catch (err) {
    store.setStatus('integration', entry.inputId, 'error', { error: String(err.message || err) });
    toast(t('run.failed', { msg: err.message || err }), { kind: 'error' });
  }
  render();
}

// ------------------------------------------------------------------ 01 growth simulator

const GROWTH = SIMULATIONS.find(x => x.key === 'growth');
const isSim = key => SIMULATIONS.some(x => x.key === key);
const GROWTH_PLAY_MS = 75 / 7 * 1000;           // the incubator's normal speed: 7 years a second

function openGrowth() {
  if (!viewer) return;
  stop();
  const first = !growthTool;
  if (first) {
    growthTool = GROWTH.create(viewer, { onState: what => {
      if (what === 'loaded') { if (activeTool === 'growth') { viewer.fit(growthTool.ring()); setProgress(growthTool.state.year / GROWTH.module.years); } render(); }
      if (what === 'ran' && activeTool === 'growth' && growthTool.state.variation && !growthTool.stepping) play(0);   // as the incubator: a new variation plays from 2025 (the steps play their own)
      if (what === 'mode' || what === 'error') renderChrome();
      // the panel's 生成流程 moves the year itself: keep the timeline with it
      if (what === 'year' && activeTool === 'growth' && Math.round(progress * GROWTH.module.years) !== growthTool.state.year) setProgress(growthTool.state.year / GROWTH.module.years);
    } });
  }
  activeTool = 'growth';
  growthTool.open().catch(err => toast(t('run.failed', { msg: err.message || err }), { kind: 'error' }));
  if (growthTool.state.loaded) viewer.fit(growthTool.ring());
  setProgress((growthTool.state.year || 0) / GROWTH.module.years);
  render();
}

function leaveGrowth() { if (activeTool === 'growth') growthTool?.close(); }

// ------------------------------------------------------------------ scene

function sceneFor(entry) {
  if (activeTool === 'integration') {
    const w = woolEntry();
    const ie = store.entry('integration', w.result.id);
    const r = ie?.result;
    return { boundary: w.result.boundary, roads: r?.roads || [], nodes: (r?.nodes || []).filter(n => n.kind !== 'joint') };
  }
  if (activeTool === 'export') {
    const w = woolEntry();
    const ie = store.entry('integration', w.result.id);
    return { boundary: w.result.boundary, roads: (ie?.result || w.result).roads };
  }
  const r = entry.result;
  const input = entry.input;
  switch (entry.level) {
    case 'london':
      return { boundary: r?.boundary };
    case 'region':
      return { boundary: input.boundary, children: r?.children, roads: r?.roads, nodes: r?.nodes, selectedId: entry.selectedChildId };
    case 'wool': {
      // Keep finished Tensor areas visible in the region (results persist across scales).
      const done = store.descendants('wool', entry.inputId).filter(e => e.result);
      const tensorRoads = done.flatMap(e => e.result.roads.map(x => ({ ...x, static: true })));
      return {
        boundary: input.boundary, children: r?.children, selectedId: entry.selectedChildId,
        roads: [...tensorRoads, ...(r?.roads || [])], nodes: r?.nodes
      };
    }
    case 'tensor': {
      const parent = (input.context?.parentRoads || []).map(x => ({ ...x, static: true }));
      return { boundary: input.boundary, roads: [...parent, ...(r?.roads || [])] };
    }
  }
  return {};
}

// ------------------------------------------------------------------ timeline

function setProgress(p) {
  progress = Math.max(0, Math.min(1, p));
  $('scrub').value = Math.round(progress * 1000);
  if (activeTool === 'growth') {               // the timeline is the years 2025-2100
    const y = Math.round(progress * GROWTH.module.years);
    if (growthTool && growthTool.state.year !== y) growthTool.setYear(y);
    $('tlLabel').textContent = t('tl.year', { y: 2025 + y });
    return;
  }
  viewer?.setProgress(progress);
  $('tlLabel').textContent = t('tl.growth', { pct: Math.round(progress * 100) });
}

function play(from = progress >= 1 ? 0 : progress) {
  stop();
  const duration = activeTool === 'growth' ? GROWTH_PLAY_MS : 2400;
  const t0 = performance.now() - from * duration;
  const step = now => {
    const p = (now - t0) / duration;
    setProgress(p);
    playing = p < 1 ? requestAnimationFrame(step) : null;
    renderPlayButton();
  };
  playing = requestAnimationFrame(step);
  renderPlayButton();
}

function stop() {
  if (playing) cancelAnimationFrame(playing);
  playing = null;
  renderPlayButton();
}

function renderPlayButton() {
  $('playButton').textContent = playing ? '❚❚' : '▶';
  $('playButton').setAttribute('aria-label', playing ? t('tl.pause') : t('tl.play'));
}

// ------------------------------------------------------------------ rendering

function render() {
  renderChrome();
  const entry = store.current();
  if (entry && viewer) {
    viewer.setScene(sceneFor(entry));
    viewer.setProgress(activeTool === 'growth' ? 1 : progress);
    viewer.setPanelDocked?.(activeTool === 'growth');      // in 01 the map display panel hugs the map's right edge
  }
}

function renderChrome() {
  const entry = store.current();
  if (!entry) return;
  const path = store.getState().path.map(p => store.entry(p.level, p.inputId));

  // breadcrumbs
  const crumbs = $('crumbs');
  crumbs.replaceChildren();
  path.forEach((e, i) => {
    if (i) crumbs.append(h('span', { class: 'sep', 'aria-hidden': 'true' }, '›'));
    crumbs.append(h('button', { 'aria-current': i === path.length - 1 && !activeTool ? 'page' : null, onclick: () => goTo(i) }, crumbLabel(e)));
  });
  if (activeTool) {
    crumbs.append(h('span', { class: 'sep' }, '›'),
      h('button', { 'aria-current': 'page' }, pick([...TOOLS, ...SIMULATIONS].find(x => x.key === activeTool).module.title)));
  }

  // left navigation
  const scaleList = $('scaleList');
  scaleList.replaceChildren();
  SCALES.forEach((s, i) => {
    if (s.hidden) return;
    const inPath = i < path.length;
    const e = inPath ? path[i] : null;
    const isNext = i === path.length;
    const cur = path[path.length - 1];
    const canEnter = isNext && cur?.result && (!s.needsSelection || cur.selectedChildId);
    const status = e ? (e.stale ? 'stale' : e.status === 'done' ? 'done' : e.status) : '';
    scaleList.append(h('li', {}, h('button', {
      class: 'mod', disabled: !(inPath || canEnter),
      'aria-current': inPath && i === path.length - 1 && !activeTool ? 'true' : 'false',
      onclick: () => (inPath ? goTo(i) : enterNext())
    },
      h('span', { class: 'num' }, s.module.id.slice(0, 2)),
      h('span', {}, h('span', { class: 'name' }, pick(s.module.title)), h('span', { class: 'sub' }, e ? crumbLabel(e) : t(`nav.hint.${s.level}`))),
      h('span', { class: `dot ${status}` }))));
    if (i === 0) {
      // 01 sits right after London: the workspace's first simulation, open at any level.
      for (const sim of SIMULATIONS) {
        const st = sim.key === 'growth' && growthTool ? (growthTool.state.running ? 'running' : growthTool.state.loaded ? 'done' : '') : '';
        scaleList.append(h('li', {}, h('button', {
          class: 'mod', disabled: !viewer, 'aria-current': activeTool === sim.key ? 'true' : 'false',
          onclick: () => openGrowth()
        },
          h('span', { class: 'num' }, sim.module.id.slice(0, 2)),
          h('span', {}, h('span', { class: 'name' }, pick(sim.module.title)), h('span', { class: 'sub' }, t(`nav.hint.${sim.key}`))),
          h('span', { class: `dot ${st}` }))));
      }
    }
  });
  const toolList = $('toolList');
  toolList.replaceChildren();
  $('toolTitle').hidden = !shownTools().length;
  for (const tool of shownTools()) {
    toolList.append(h('li', {}, h('button', {
      class: 'mod', disabled: !toolAvailable(), 'aria-current': activeTool === tool.key ? 'true' : 'false',
      onclick: () => openTool(tool.key)
    }, h('span', { class: 'num' }, tool.module.id.slice(0, 2)),
      h('span', {}, h('span', { class: 'name' }, pick(tool.module.title)), h('span', { class: 'sub' }, t(`nav.hint.${tool.key}`))),
      h('span', { class: 'dot' }))));
  }

  if (activeTool === 'growth') renderGrowthInspector();
  else if (activeTool) renderToolInspector(); else renderScaleInspector(entry);

  // map hint + timeline status
  const hint = $('mapHint');
  const next = nextScale(entry.level);
  hint.hidden = Boolean(activeTool) || !(next?.needsSelection && entry.result);
  hint.textContent = t(`hint.select.${entry.level}`);
  $('tlStatus').textContent = activeTool ? '' : statusText(entry);
  $('tlLabel').textContent = activeTool === 'growth'
    ? t('tl.year', { y: 2025 + Math.round(progress * GROWTH.module.years) })
    : t('tl.growth', { pct: Math.round(progress * 100) });
}

function statusText(entry) {
  if (entry.status === 'running') return t('status.running');
  if (entry.status === 'error') return t('status.error');
  if (entry.stale) return t('status.stale');
  if (entry.result) return t('status.done', { ms: entry.result.stats?.ms ?? '–' });
  return t('status.idle');
}

function renderScaleInspector(entry) {
  const scale = scaleOf(entry.level);
  const mod = scale.module;
  const next = nextScale(entry.level);
  const last = levelIndex(entry.level) === SCALES.length - 1;
  $('inspCode').textContent = `${mod.id} · v${mod.version}`;
  $('inspTitle').textContent = pick(mod.title);
  $('inspDesc').textContent = pick(mod.description);
  const badges = $('inspBadges');
  badges.replaceChildren();
  if (mod.placeholder) badges.append(h('span', { class: 'badge warn' }, t('badge.placeholder')));
  if (entry.stale) badges.append(h('span', { class: 'badge warn' }, t('badge.stale')));
  badges.append(h('span', { class: 'badge' }, 'EPSG:27700'));

  const actions = $('inspActions');
  actions.replaceChildren();
  if (next) {
    const sel = entry.result?.children?.find(c => c.id === entry.selectedChildId);
    const label = next.needsSelection
      ? (sel ? t('act.enterSel', { name: sel.label, scale: pick(next.module.title) }) : t('act.selectToEnter'))
      : t('act.enter', { scale: pick(next.module.title) });
    actions.append(h('button', { class: 'btn primary', disabled: !entry.result || (next.needsSelection && !sel), onclick: () => enterNext() }, label));
  } else if (last && shownTools().some(x => x.key === 'integration')) {
    actions.append(h('button', { class: 'btn primary', disabled: !toolAvailable(), onclick: () => openTool('integration') }, t('act.integrate')));
  }
  actions.append(h('div', { class: 'row' },
    h('button', { class: 'btn', disabled: entry.status === 'running', onclick: () => runEntry(store.current()) }, t('act.regenerate')),
    store.getState().path.length > 1 ? h('button', { class: 'btn', onclick: goBack }, t('act.back')) : null));

  renderParams($('inspParams'), mod.params, entry.params, (values, { committed }) => {
    const e = store.current();
    store.setParams(e.level, e.inputId, values);
    if (committed) runEntry(store.current());
  });
  renderStats($('inspStats'), entry.result ? entry.result.stats : {});
  $('inspAlgo').textContent = entry.result
    ? `${entry.result.algorithm.id} · ${entry.result.algorithm.module}@${entry.result.algorithm.version}`
    : '';
  renderLegend(sceneFor(entry));
}

function renderGrowthInspector() {
  const mod = GROWTH.module;
  $('inspCode').textContent = `${mod.id} · v${mod.version}`;
  $('inspTitle').textContent = pick(mod.title);
  $('inspDesc').textContent = pick(mod.description);
  $('inspBadges').replaceChildren(h('span', { class: 'badge' }, 'EPSG:27700'), h('span', { class: 'badge' }, '50 m'));
  $('inspActions').replaceChildren(h('button', { class: 'btn', onclick: goBack }, t('act.backToScale')));
  const host = $('inspParams');
  if (growthTool && host.firstChild !== growthTool.container) host.replaceChildren(growthTool.container);
  $('inspStats').replaceChildren();
  $('inspAlgo').textContent = t('growth.source');
  const el = $('legend');
  el.replaceChildren(...[3, 2, 1, 4, 5].map(k => h('div', { class: 'legend-row' },
    h('i', { style: `border-top-width:8px;border-top-color:${mod.palette[k]}` }), t(`growth.legend.${k}`))));
}

function renderToolInspector() {
  const tool = TOOLS.find(x => x.key === activeTool);
  const mod = tool.module;
  const w = woolEntry();
  $('inspCode').textContent = `${mod.id} · v${mod.version}`;
  $('inspTitle').textContent = pick(mod.title);
  $('inspDesc').textContent = pick(mod.description);
  $('inspBadges').replaceChildren(h('span', { class: 'badge' }, `${w.input.context?.label || ''} · ${t('scale.wool')}`));
  const actions = $('inspActions');
  actions.replaceChildren();
  const ie = store.entry('integration', w.result.id);

  if (activeTool === 'integration') {
    actions.append(h('button', { class: 'btn primary', disabled: ie?.status === 'running', onclick: () => runTool(ie) }, t('act.runIntegration')));
    actions.append(h('button', { class: 'btn', onclick: goBack }, t('act.backToScale')));
    renderParams($('inspParams'), mod.params, ie?.params || defaultParams(mod), values => {
      store.setParams('integration', w.result.id, values);
      runTool(store.entry('integration', w.result.id));
    });
    renderStats($('inspStats'), ie?.result?.stats || {});
    const tensors = store.descendants('wool', w.inputId).filter(e => e.result).length;
    $('inspAlgo').textContent = t('tool.integrationScope', { n: tensors });
  } else {
    const bundles = [w.result, ...(ie?.result ? [ie.result] : [])];
    const name = (w.input.context?.label || 'region').replace(/\W+/g, '_');
    actions.append(
      h('button', { class: 'btn primary', onclick: () => download(`london2100_${name}_wgs84.geojson`, exporters.toGeoJSON(bundles), 'application/geo+json') }, t('act.exportWGS')),
      h('button', { class: 'btn', onclick: () => download(`london2100_${name}_epsg27700.geojson`, exporters.toBNGGeoJSON(bundles), 'application/geo+json') }, t('act.exportBNG')),
      h('button', { class: 'btn', onclick: exportWorkspace }, t('ws.save')),
      h('button', { class: 'btn', onclick: goBack }, t('act.backToScale')));
    $('inspParams').replaceChildren(h('p', { class: 'muted' }, ie?.result ? t('tool.exportIncludes') : t('tool.exportNoIntegration')));
    renderStats($('inspStats'), { roads: bundles.reduce((s, b) => s + b.roads.length, 0) });
    $('inspAlgo').textContent = '';
  }
  renderLegend(sceneFor(store.current()));
}

function renderLegend(scene) {
  const present = new Set((scene.roads || []).map(r => r.hierarchy));
  const el = $('legend');
  el.replaceChildren();
  for (const hname of HIERARCHY_ORDER) {
    if (!present.has(hname)) continue;
    const s = ROAD_STYLE[hname];
    el.append(h('div', { class: 'legend-row' },
      h('i', { style: `border-top-width:${Math.max(2, s.width)}px;border-top-color:${s.color};${s.dash ? 'border-top-style:dashed' : ''}` }),
      t(`road.${hname}`)));
  }
  if (!el.children.length) el.append(h('p', { class: 'muted small' }, t('legend.empty')));
}

// ------------------------------------------------------------------ workspace files

function exportWorkspace() {
  download(`london2100_workspace_${new Date().toISOString().slice(0, 10)}.json`, {
    app: 'london-2100-generative-system', build: BUILD, workspace: store.exportJSON()
  });
}

$('importWorkspace').addEventListener('change', async e => {
  const file = e.target.files[0];
  if (!file) return;
  try {
    const data = JSON.parse(await file.text());
    store.importJSON(data.workspace || data);
    leaveGrowth();
    activeTool = null;
    const cur = store.current();
    viewer?.fit(cur?.input?.boundary || cur?.result?.boundary);
    render();
    toast(t('ws.opened'));
  } catch (err) {
    toast(t('ws.openFailed', { msg: err.message }), { kind: 'error' });
  }
  e.target.value = '';
});
$('exportWorkspace').addEventListener('click', exportWorkspace);

// ------------------------------------------------------------------ versions

async function toggleVersionMenu() {
  const menu = $('versionMenu');
  const btn = $('versionButton');
  if (!menu.hidden) { menu.hidden = true; btn.setAttribute('aria-expanded', 'false'); return; }
  btn.setAttribute('aria-expanded', 'true');
  menu.hidden = false;
  menu.replaceChildren(h('h3', {}, t('ver.title')), h('p', { class: 'muted small' }, t('ver.current', { v: describeBuild(BUILD) })));
  const releases = await fetchReleases();
  if (BUILD.releasePath) menu.append(h('a', { class: 'rel current', href: latestUrl() }, t('ver.backToLatest'), h('span', {}, '→')));
  if (!releases.length) { menu.append(h('p', { class: 'muted small' }, t('ver.none'))); return; }
  menu.append(h('div', { class: 'eyebrow', style: 'margin:10px 8px 4px' }, t('ver.history')));
  for (const rel of releases) {
    const current = rel.commit === BUILD.commit;
    menu.append(h('a', { class: `rel ${current ? 'current' : ''}`, href: releaseUrl(rel) },
      h('span', {}, `v${rel.version} · ${String(rel.commit).slice(0, 7)}`),
      h('span', { class: 'muted' }, current ? t('ver.thisOne') : new Date(rel.builtAt).toLocaleDateString())));
  }
}
$('versionButton').addEventListener('click', toggleVersionMenu);
document.addEventListener('click', e => {
  if (!$('versionMenu').hidden && !e.target.closest('#versionMenu, #versionButton')) $('versionMenu').hidden = true;
});

// ------------------------------------------------------------------ wiring

onLangChange(() => { render(); growthTool?.relang(); });
$('playButton').addEventListener('click', () => (playing ? stop() : play()));
$('scrub').addEventListener('input', e => { stop(); setProgress(e.target.value / 1000); });
for (const [id, on] of [['view2d', false], ['view3d', true]]) {
  $(id).addEventListener('click', () => {
    view3D = on;
    $('view2d').setAttribute('aria-pressed', String(!on));
    $('view3d').setAttribute('aria-pressed', String(on));
    viewer?.setView3D(on);
  });
}
document.addEventListener('keydown', e => {
  if (!$('intro').hidden || !$('catalogue').hidden || !$('appview').hidden) return;   // shortcuts belong to the workspace only
  if (e.target.closest('input, select, textarea')) return;
  if (e.key === 'Escape') goBack();
  if (e.key === 'Enter' && activeTool !== 'growth') enterNext();
  if (e.key === ' ') { e.preventDefault(); playing ? stop() : play(); }
});

async function boot() {
  applyI18n(document);
  $('versionButton').textContent = versionLabel();
  renderPlayButton();

  if (!store.current()) {
    store.enter('london', null, defaultParams(SCALES[0].module));
  }
  // A saved workspace may stand on a level that is hidden now: open it at the London map.
  if (scaleOf(store.current().level)?.hidden) store.goTo(0);
  render();

  // Screens: '' = opening video, #catalogue = catalogue, #workspace = this app.
  // The workspace stays mounted underneath, so its map loads while the
  // opening screen and catalogue are shown.
  const intro = createIntro($('intro'), { onEnter: () => { location.hash = 'catalogue'; } });
  // The catalogue list lets the viewer recognise an app opened inside another (Tensor Studio inside the map).
  const appview = createAppView($('appview'), { items: () => catalogue.items() });
  let pendingOrigin = null;
  const catalogue = createCatalogue($('catalogue'), {
    onOpenWorkspace: () => { location.hash = 'workspace'; },
    onOpenApp: (item, cover) => { pendingOrigin = cover; location.hash = `app/${item.id}`; }
  });
  $('appviewBack').addEventListener('click', () => { location.hash = 'catalogue'; });
  // One language switch design everywhere; all of them drive the same setting.
  for (const id of ['langToggle', 'introLang', 'catLang', 'appLang']) mountLangSwitch($(id));
  $('catHome').addEventListener('click', () => { location.hash = ''; });
  const toCatalogue = () => { stop(); location.hash = 'catalogue'; };
  $('brandHome').addEventListener('click', toCatalogue);
  $('brandHome').addEventListener('keydown', e => { if (e.key === 'Enter') toCatalogue(); });
  $('brandHome').dataset.i18nTitle = 'cat.back';

  const route = async () => {
    const screen = location.hash.replace('#', '') || (new URLSearchParams(location.search).has('nointro') ? 'workspace' : 'intro');
    if (screen.startsWith('app/')) {
      // An incubator app, popped out over the catalogue.
      const item = await catalogue.item(screen.slice(4));
      if (!item) { location.hash = 'catalogue'; return; }
      intro.hide(); catalogue.show();
      appview.open(item, pendingOrigin || catalogue.coverOf(item.id));
      pendingOrigin = null;
      return;
    }
    if (appview.openId) { appview.setOrigin(catalogue.coverOf(appview.openId)); appview.close(); }
    if (screen === 'intro') { catalogue.hide(); intro.show(); }
    else if (screen === 'catalogue') { if (intro.open) intro.enter(); else intro.hide(); catalogue.show(); }
    else { intro.hide(); catalogue.hide(); setTimeout(() => viewer?.resize(), 60); }
  };
  window.addEventListener('hashchange', route);
  route();
  document.documentElement.dataset.ready = '1';   // tells the safety net in index.html we started
  applyI18n(document);

  viewer = await createMapViewer($('map'), {
    theme: 'dark',
    onSelect: id => {
      const e = store.current();
      if (activeTool || !e?.result?.children?.some(c => c.id === id)) return;
      store.select(e.level, e.inputId, e.selectedChildId === id ? null : id);
      render();
    },
    onEnter: id => { if (!activeTool) enterNext(id); },
    onFallback: () => { $('mapBadge').hidden = false; $('mapBadge').textContent = t('map.offline'); },
    onView3D: on => { view3D = on; $('view2d').setAttribute('aria-pressed', String(!on)); $('view3d').setAttribute('aria-pressed', String(on)); }
  });
  $('mapLoading').classList.add('done');
  const cur = store.current();
  viewer.fit(cur.input?.boundary || cur.result?.boundary, { animate: false });
  if (!cur.result) await runEntry(cur, { animate: false });
  if (!cur.input && store.current().result) viewer.fit(store.current().result.boundary, { animate: false });
  render();

  if (store.persistWarning === 'storage-full') toast(t('ws.storageFull'), { kind: 'error' });
  if (BUILD.releasePath) toast(t('ver.viewingOld', { v: BUILD.version }), { action: t('ver.backToLatest'), onAction: () => (location.href = latestUrl()), timeout: 0 });

  watchForUpdates(latest => {
    $('versionButton').classList.add('has-update');
    toast(t('ver.updateAvailable', { v: latest.version }), { action: t('ver.reload'), onAction: () => (location.href = latestUrl()), timeout: 0 });
  });
}

boot();
