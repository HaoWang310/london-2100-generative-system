// London Map build-version contract: prevents stale labels or worker module caches.
// Run with: node scripts/test_release_version.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = path => fs.readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const index=read('index.html'), app=read('scripts/app.js');   // v3.39.1: the page's own code moved from index.html to scripts/app.js
const label=index.match(/id="appVersionLabel">OpenStreetMap \/ OpenFreeMap · v([^<]+)</);
const runtime=app.match(/const APP_VERSION='([^']+)'/);
assert.ok(label, 'Visible application version label must exist');
assert.ok(runtime, 'APP_VERSION must exist');
const v=runtime[1];
assert.equal(label[1],v,'Header release label must match runtime APP_VERSION');
assert.ok(app.includes("getElementById('appVersionLabel').textContent='OpenStreetMap / OpenFreeMap · v'+APP_VERSION"),
  'Header must derive the displayed version from the runtime constant');
// the files the page loads now (the v3.2x flood / parcel / tensor modules listed here before are no longer in this copy)
for(const [source,dependency] of [
  ['index.html','scripts/ui_language.js'],
  ['index.html','scripts/app.js'],
  ['scripts/app.js','map_core.js'],
  ['scripts/app.js','flood_detail.js'],
  ['scripts/app.js','place_search.js'],
  ['scripts/app.js','drainage_display.js'],
  ['scripts/app.js','terrain_local.js'],
  ['scripts/app.js','osm_basemap_themes.js'],
  ['scripts/app.js','tensor_site_ui.js'],
  ['scripts/app.js','planning_layers.js'],
  ['scripts/planning_layers.js','relief_local.js'],
  ['scripts/relief_local.js','relief_worker.js'],
  ['scripts/terrain_local.js','terrain_worker.js'],
  ['scripts/ui_language.js','ui_chinese_dictionary.js'],
  ['scripts/ui_language.js','ui_english_dictionary.js'],
  ['scripts/tensor_site_ui.js','tensor_studio_site.js']]){
 const text=read(source);
 assert.ok(text.includes(dependency+'?v='+v),
    source+' must import '+dependency+' using the displayed release build id');
}
console.log('PASS matching UI, runtime, exported site data, nested modules and worker cache IDs:',v);
