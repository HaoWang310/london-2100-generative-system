// The chain row (shared/ui/chain.js): one line under an app's title, the same in every catalogue app.
// node --test tools/tests/chain.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, statSync } from 'node:fs';
import vm from 'node:vm';

const root = new URL('../../', import.meta.url), read = p => readFileSync(new URL(p, root), 'utf8'), there = p => existsSync(new URL(p, root));
// (26 Nov 2026) the real map (incubator/loop-city-real-map) is removed: the London map has its layers.
const CATALOGUE = JSON.parse(read('incubator/catalogue.json')).items.map(i => i.id);
const win = { parent: null, document: { documentElement: { lang: 'en' } }, setInterval() {}, location: {} }; win.parent = win; win.window = win;
vm.runInNewContext(read('shared/ui/chain.js'), win);
const C = win.L2Chain;

test('the research line, and the two apps beside it', () => {
  assert.deepEqual([...C.line], ['google-map-live', 'loop-city-mould-growth', 'loop-city-wool', 'tensor-studio', 'structure-studio', 'vr']);      // six since 26 Nov 2026: the wool hands its parcels straight to Tensor Studio
  const walk = []; for (let id = 'google-map-live'; id !== 'catalogue'; id = C.next(id)) walk.push(id);
  assert.deepEqual(walk, [...C.line], 'Next walks the whole line and ends at the catalogue');
  assert.equal(C.next('vr'), 'catalogue'); assert.equal(C.prev('google-map-live'), 'catalogue');
  assert.equal(C.prev('structure-studio'), 'tensor-studio'); assert.equal(C.prev('loop-city-wool'), 'loop-city-mould-growth');
  assert.equal(C.next('loop-city-wool'), 'tensor-studio'); assert.equal(C.prev('tensor-studio'), 'loop-city-wool');
  assert.equal(C.next('workspace'), 'google-map-live');
  assert.equal(C.prev('workspace'), 'catalogue');
});

test('every app on the line is in the catalogue, and has a name', () => {
  const ids = CATALOGUE;
  for (const id of [...C.line, 'workspace']) { assert.ok(ids.includes(id), id + ' is a catalogue item'); assert.ok(C.name(id), id + ' has a name'); }
});

test('each catalogue app loads the row and mounts it under its own id', () => {
  const pages = { 'workspace': ['index.html'], 'google-map-live': ['incubator/google-map-live/index.html'], 'loop-city-mould-growth': ['incubator/loop-city-mould-growth/index.html', 'incubator/loop-city-mould-growth/skin.js'],
    'loop-city-wool': ['incubator/loop-city-wool/index.html', 'incubator/loop-city-wool/skin.js'],
    'tensor-studio': ['incubator/tensor-studio/index.html', 'incubator/tensor-studio/app.js'], 'structure-studio': ['incubator/structure-studio/index.html'], 'vr': ['incubator/vr/map.html'] };
  assert.deepEqual(Object.keys(pages).sort(), CATALOGUE.slice().sort(), 'every catalogue app, and no other: the six of the line and the whole system');
  for (const [id, files] of Object.entries(pages)) { const html = read(files[0]), all = files.map(read).join('\n');
    assert.ok(/shared\/ui\/chain\.js/.test(html), id + ': chain.js'); assert.ok(/shared\/ui\/chain\.css/.test(html), id + ': chain.css');
    assert.ok(all.includes("id: '" + id + "'"), id + ': mounted under its id'); }
  assert.ok(read('incubator/vr/index.html').includes("id: 'vr'"), 'the VR scenes page too');
});

test('the steps that hand a result on say when they are ready and use the app’s own hand-over', () => {
  const mould = read('incubator/loop-city-mould-growth/skin.js'), wool = read('incubator/loop-city-wool/skin.js'), woolPage = read('incubator/loop-city-wool/index.html'), tsPage = read('incubator/tensor-studio/index.html'), ts = read('incubator/tensor-studio/app.js'), ss = read('incubator/structure-studio/index.html');
  assert.ok(mould.includes('MULTI.open(picked())')); assert.ok(wool.includes('go: function () { bdSend(); }'));
  // the wool leaves its parcel package under Tensor Studio's own key and opens it on the site; Tensor Studio reads the package as a site
  assert.ok(woolPage.includes("KEY: 'tensorStudio.siteFile'") && woolPage.includes("PAGE: '../tensor-studio/index.html#site'"), 'the wool opens Tensor Studio on the parcels');
  assert.ok(tsPage.includes("SITE_KEY = 'tensorStudio.siteFile'") && tsPage.includes('siteFromParcelPackage(f, bngToWGS84)'), 'Tensor Studio reads the package under the same key');
  assert.ok(wool.includes('bpWhy(bpCheck(Lp))'), 'Next is grey, with the reason, while Tensor Studio cannot take the site');
  assert.ok(!there('incubator/loop-city-tensor-base'), 'the page that stood between them is gone');
  assert.ok(ts.includes("'../structure-studio/index.html#from=tensor&t='"), 'Tensor Studio opens Structure Studio with the network');
  assert.ok(ss.includes('async function takeFromOpener()') && ss.includes('await addInput(snapshotFrom(w), \'ts\')'), 'Structure Studio reads it from the window that opened it');
  assert.ok(ss.includes("$('tsBtn').onclick"), 'Take the result from Tensor Studio is still there');
});

test('the row hides when another app frames the page, and goes through the catalogue when it frames it', () => {
  const js = read('shared/ui/chain.js');
  assert.ok(js.includes("p.document.getElementById('appview') && p.document.getElementById('catalogue')"));
  assert.ok(js.includes("if (framedByApp()) { el.hidden = true; return; }"));
  assert.ok(js.includes("'index.html#app/' + id"));
});

test('"See the example": the next app is asked for the example of the line, once for a tab, and a tab open already hears of it', () => {
  const js = read('shared/ui/chain.js'), store = new Map(), sess = new Map(), on = {};
  const st = m => ({ getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => { m.set(k, String(v)); }, removeItem: k => { m.delete(k); } });
  const w = { parent: null, document: { documentElement: { lang: 'en' } }, setInterval() {}, location: {}, localStorage: st(store), sessionStorage: st(sess), addEventListener(t, f) { on[t] = f; } }; w.parent = w; w.window = w;
  vm.runInNewContext(js, w); const X = w.L2Chain;
  assert.equal(X.wantsExample('tensor-studio'), false, 'nothing asked');
  store.set('l2100.example', 'tensor-studio|' + Date.now());
  assert.equal(X.wantsExample('structure-studio'), false, 'asked of another app');
  assert.equal(X.wantsExample('tensor-studio'), true); assert.equal(X.wantsExample('tensor-studio'), false, 'a reload of the same tab opens as usual');
  assert.ok(store.has('l2100.example'), 'the note stays for the page the link may load again');
  store.set('l2100.example', 'tensor-studio|' + (Date.now() - 120000)); sess.clear(); assert.equal(X.wantsExample('tensor-studio'), false, 'an old note is not followed');
  let heard = 0; X.onExample('structure-studio', () => { heard++; });
  store.set('l2100.example', 'structure-studio|' + Date.now()); on.storage({ key: 'l2100.example', newValue: store.get('l2100.example') }); assert.equal(heard, 1);
  on.storage({ key: 'something.else', newValue: 'x' }); store.set('l2100.example', 'tensor-studio|' + Date.now()); on.storage({ key: 'l2100.example', newValue: store.get('l2100.example') }); assert.equal(heard, 1);
  assert.ok(js.includes("if (what === 'example') { askExample(nx);"), 'the link leaves the note before it opens the app');
  // the two apps that have such an example read it
  const ts = read('incubator/tensor-studio/index.html'), ta = read('incubator/tensor-studio/app.js'), ss = read('incubator/structure-studio/index.html');
  assert.ok(ts.includes("window.L2Chain.wantsExample('tensor-studio')") && ta.includes("window.L2Chain.onExample('tensor-studio'"));
  assert.ok(ss.includes("window.L2Chain.wantsExample('structure-studio')") && ss.includes("window.L2Chain.onExample('structure-studio'"));
});

test('the terrain Tensor Studio reads for a Loop City site file is where it looks for it', () => {
  // Tensor Studio (on parcels from the wool bands) and the whole system's contours both read the London map's 50 m terrain raster.
  // Moved or renamed there, both lose their terrain: this says so first.
  const html = read('incubator/tensor-studio/index.html'), m = /fetch\('\.\.\/(google-map-live\/assets\/[^']+dem50_log16\.webp)'/.exec(html);
  assert.ok(m, 'Tensor Studio names the London map\u2019s terrain raster'); const file = 'incubator/' + m[1];
  assert.ok(there(file), file + ' is there'); assert.ok(statSync(new URL(file, root)).size > 1e6, 'and is the raster, not a stub');
  const wh = /W = (\d+), H = (\d+), B = \[([^\]]+)\]/.exec(html); assert.ok(wh, 'its size and bounds are written in the page');
  const meta = JSON.parse(read('incubator/google-map-live/assets/drainage_area/metadata.json')), txt = JSON.stringify(meta);
  assert.ok(txt.includes(wh[1]) && txt.includes(wh[2]), 'the size in the page (' + wh[1] + ' × ' + wh[2] + ') is the size the London map records');
});
