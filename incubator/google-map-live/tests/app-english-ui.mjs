/* London Map English interface regression.
   The historical Chinese-key translation dictionary is intentionally excluded:
   its keys are internal lookup data, not displayed UI. */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const paths=[
 'index.html',
 'styles/app.css',
 'scripts/app.js',
 'scripts/map_core.js',
 'scripts/flood_detail.js',
 'scripts/place_search.js',
 'scripts/drainage_display.js',
 'scripts/drainage_worker.js',
 'scripts/terrain_local.js',
 'scripts/terrain_worker.js',
 'scripts/osm_basemap_themes.js',
 'scripts/street_traffic.js',
 'scripts/map_atmosphere.js',
 'scripts/building_shadows.js',
 'scripts/urban_trees.js',
 'scripts/tree_renderer.js',
 'scripts/tensor_site_ui.js',
 'scripts/tensor_studio_site.js'
];
const chinese=/[\u3400-\u9fff]/;
for(const path of paths){
 const source=readFileSync(path,'utf8');
 const offending=source.split('\n').map((line,i)=>({line,i:i+1}))
  .filter(({line})=>chinese.test(line));
 assert.equal(offending.length,0,
  path+' contains untranslated Chinese at lines: '+offending.map(x=>x.i).join(','));
}
const html=readFileSync('index.html','utf8'),app=readFileSync('scripts/app.js','utf8');   // v3.39.1: the page's code lives in scripts/app.js
assert.match(html,/<html\s+lang="en"/i,'HTML document language must be English');
assert.match(app,/APP_VERSION='3\.43\.4-english'/,'page must use English module build');
assert.match(html,/scripts\/app\.js\?v=3\.43\.4-english/,'page must load its code with the current build id');
assert.match(html,/ui_language\.js\?v=3\.43\.4-english/,
 'bidirectional language layer must use current version');
console.log('PASS English London Map: '+paths.length+' active HTML/JS files; no visible Chinese source strings');
