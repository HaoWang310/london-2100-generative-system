// The workspace map reads the London map's own scripts and data from incubator/google-map-live
// (shared/map-viewer/london-map.js). These tests guard that link: if the incubator app renames
// an export, a preset or an asset the workspace uses, CI fails here.
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { SCRIPTS, ASSETS, londonMapBase, SOURCE_PATH, PLANNING_KEYS, PLANNING_FILES, FOCUS70 } from '../map-viewer/london-map.js';
import { zh } from '../i18n/zh.js';
import { en } from '../i18n/en.js';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const SRC = ROOT + SOURCE_PATH;

test('every London map script the workspace loads exists and exports what it uses', async () => {
  for (const [key, [path, names]] of Object.entries(SCRIPTS)) {
    assert.ok(existsSync(SRC + path), `${key}: ${path} missing`);
    const mod = await import(pathToFileURL(SRC + path).href);
    for (const n of names) assert.ok(n in mod, `${path} no longer exports ${n}`);
  }
});

test('themes, lighting and weather the panel offers still exist', async () => {
  const themes = await import(pathToFileURL(SRC + SCRIPTS.themes[0]).href);
  for (const k of ['dark', 'default', 'faded', 'planning', 'ocean', 'warm', 'vivid']) assert.ok(themes.BASEMAP_THEMES[k], `theme ${k}`);
  const atm = await import(pathToFileURL(SRC + SCRIPTS.atmosphere[0]).href);
  for (const k of ['dawn', 'day', 'dusk', 'night']) assert.ok(atm.LIGHTING_PRESETS[k], `lighting ${k}`);
  for (const k of ['clear', 'fog', 'rain', 'snow']) assert.ok(atm.WEATHER_PRESETS[k], `weather ${k}`);
});

test('the analysis data is where the workspace reads it', () => {
  for (const p of [ASSETS.terrain, ASSETS.drainage, ASSETS.londonOutline, ASSETS.dem, ...PLANNING_FILES.map(ASSETS.planning)]) assert.ok(existsSync(SRC + p), p);
  for (const s of ['combined', 'surface_water', 'rivers_sea']) for (const rc of ['0-0', '0-1', '1-0', '1-1']) {
    const p = ASSETS.flood(s, rc);
    if (s === 'surface_water' && !existsSync(SRC + p)) continue;      // published by the incubator when available
    assert.ok(existsSync(SRC + p), p);
  }
});

// The workspace draws the planning layers with the incubator's own planning_layers.js. It needs only a map with a few
// methods to be made, so the link is checked here without a browser: the five layers, their settings and the calls
// the workspace makes (set, status, applyTheme, moveFills, moveLines, heightAt, insideCircle).
test('the planning layers the workspace shows are the incubator London map\'s own', async () => {
  const mod = await import(pathToFileURL(SRC + SCRIPTS.planning[0]).href);
  const map = { on() {}, getLayer: () => undefined, getSource: () => undefined, getStyle: () => ({ layers: [] }) };
  const planning = mod.createPlanningLayers({ map, maplibregl: { addProtocol() {} }, assetUrl: p => p,
    center: { lat: FOCUS70.lat, lng: FOCUS70.lng }, radius: FOCUS70.radius, getTheme: () => 'dark' });
  for (const k of PLANNING_KEYS) { assert.equal(planning.state[k]?.on, false, `planning layer ${k}`); assert.equal(planning.status(k), 'off'); }
  for (const k of ['opacity', 'top', 'ramp', 'shade']) assert.ok(k in planning.state.relief, `relief.${k}`);
  for (const k of ['fill', 'width']) { assert.ok(k in planning.state.greenBelt, `greenBelt.${k}`); assert.ok(k in planning.state.aonb, `aonb.${k}`); }
  for (const k of ['mode', 'width', 'kinds']) assert.ok(k in planning.state.rail, `rail.${k}`);
  for (const k of ['hs1', 'hs2', 'colour']) assert.ok(k in planning.state.highSpeed, `highSpeed.${k}`);
  for (const fn of ['set', 'status', 'applyTheme', 'moveFills', 'moveLines', 'heightAt', 'insideCircle']) assert.equal(typeof planning[fn], 'function', fn);
  assert.deepEqual(Object.keys(planning.state.rail.kinds).sort(), [...mod.RAIL_KINDS].sort());
  assert.ok(mod.RELIEF_RAMPS[planning.state.relief.ramp], 'the default colour ramp exists');
  assert.equal(mod.reliefStops(300).length, 20);
  for (const k of mod.RAIL_KINDS) { assert.ok(mod.RAIL_COLOURS[k], `rail colour ${k}`); assert.ok(`dp.railKind.${k}` in zh && `dp.railKind.${k}` in en, `rail name ${k}`); }
  for (const k of Object.keys(mod.RELIEF_RAMPS)) assert.ok(`dp.ramp.${k}` in zh && `dp.ramp.${k}` in en, `ramp name ${k}`);
  assert.equal(planning.insideCircle({ lng: FOCUS70.lng, lat: FOCUS70.lat }), true);
  assert.equal(planning.insideCircle({ lng: FOCUS70.lng + 2, lat: FOCUS70.lat }), false);
});

test('the terrain picture is cut to the study circle when the workspace gives the centre and radius', () => {
  const worker = readFileSync(SRC + 'scripts/terrain_worker.js', 'utf8');
  assert.match(worker, /config\.center/); assert.match(worker, /config\.radius/);
  const src = readFileSync(ROOT + 'shared/map-viewer/london-map.js', 'utf8');
  assert.match(src, /createTerrainLocalLoader\(\{[^}]*center, radius: FOCUS70\.radius/);
});

test('a frozen release reads the live incubator London map', () => {
  assert.equal(londonMapBase('https://x.io/site/shared/map-viewer/london-map.js?v=abc'), 'https://x.io/site/incubator/google-map-live/');
  assert.equal(londonMapBase('https://x.io/site/releases/0.1.0-abc/shared/map-viewer/london-map.js'), 'https://x.io/site/incubator/google-map-live/');
});

test('every t("key") in the map panel exists in both languages', () => {
  const missing = [];
  for (const f of ['shared/map-viewer/display-panel.js', 'shared/map-viewer/index.js', 'shared/map-viewer/london-map.js']) {
    const src = readFileSync(ROOT + f, 'utf8');
    for (const m of src.matchAll(/\bt\(['`]([\w.-]+)['`]/g)) if (!(m[1] in zh) || !(m[1] in en)) missing.push(`${f}: ${m[1]}`);
    for (const m of src.matchAll(/t\(`(dp\.[\w.]+)\.\$\{/g)) assert.ok(Object.keys(zh).some(k => k.startsWith(m[1] + '.')), m[1]);
  }
  assert.deepEqual(missing, []);
});
