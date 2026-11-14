// The workspace map reads the London map's own scripts and data from incubator/google-map-live
// (shared/map-viewer/london-map.js). These tests guard that link: if the incubator app renames
// an export, a preset or an asset the workspace uses, CI fails here.
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { SCRIPTS, ASSETS, londonMapBase, SOURCE_PATH } from '../map-viewer/london-map.js';
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
  for (const p of [ASSETS.terrain, ASSETS.drainage, ASSETS.londonOutline]) assert.ok(existsSync(SRC + p), p);
  for (const s of ['combined', 'surface_water', 'rivers_sea']) for (const rc of ['0-0', '0-1', '1-0', '1-1']) {
    const p = ASSETS.flood(s, rc);
    if (s === 'surface_water' && !existsSync(SRC + p)) continue;      // published by the incubator when available
    assert.ok(existsSync(SRC + p), p);
  }
});

test('a frozen release reads the live incubator London map', () => {
  assert.equal(londonMapBase('https://x.io/site/shared/map-viewer/london-map.js?v=abc'), 'https://x.io/site/incubator/google-map-live/');
  assert.equal(londonMapBase('https://x.io/site/releases/0.1.0-abc/shared/map-viewer/london-map.js'), 'https://x.io/site/incubator/google-map-live/');
});

test('every t("key") in the map panel exists in both languages', () => {
  const missing = [];
  for (const f of ['shared/map-viewer/display-panel.js', 'shared/map-viewer/index.js']) {
    const src = readFileSync(ROOT + f, 'utf8');
    for (const m of src.matchAll(/\bt\(['`]([\w.-]+)['`]/g)) if (!(m[1] in zh) || !(m[1] in en)) missing.push(`${f}: ${m[1]}`);
    for (const m of src.matchAll(/t\(`(dp\.[\w.]+)\.\$\{/g)) assert.ok(Object.keys(zh).some(k => k.startsWith(m[1] + '.')), m[1]);
  }
  assert.deepEqual(missing, []);
});
