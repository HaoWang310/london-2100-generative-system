// The chain row (shared/ui/chain.js): one line under an app's title, the same in every catalogue app.
// node --test tools/tests/chain.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const root = new URL('../../', import.meta.url), read = p => readFileSync(new URL(p, root), 'utf8');
const win = { parent: null, document: { documentElement: { lang: 'en' } }, setInterval() {}, location: {} }; win.parent = win; win.window = win;
vm.runInNewContext(read('shared/ui/chain.js'), win);
const C = win.L2Chain;

test('the research line, and the two apps beside it', () => {
  assert.deepEqual([...C.line], ['google-map-live', 'loop-city-mould-growth', 'loop-city-wool', 'loop-city-tensor-base', 'tensor-studio', 'structure-studio', 'vr']);
  const walk = []; for (let id = 'google-map-live'; id !== 'catalogue'; id = C.next(id)) walk.push(id);
  assert.deepEqual(walk, [...C.line], 'Next walks the whole line and ends at the catalogue');
  assert.equal(C.next('vr'), 'catalogue'); assert.equal(C.prev('google-map-live'), 'catalogue');
  assert.equal(C.prev('structure-studio'), 'tensor-studio'); assert.equal(C.prev('loop-city-wool'), 'loop-city-mould-growth');
  assert.equal(C.next('workspace'), 'google-map-live'); assert.equal(C.next('loop-city-real-map'), 'loop-city-mould-growth');
  assert.equal(C.prev('workspace'), 'catalogue'); assert.equal(C.prev('loop-city-real-map'), 'catalogue');
});

test('every app on the line is in the catalogue, and has a name', () => {
  const ids = JSON.parse(read('incubator/catalogue.json')).items.map(i => i.id);
  for (const id of [...C.line, 'workspace', 'loop-city-real-map']) { assert.ok(ids.includes(id), id + ' is a catalogue item'); assert.ok(C.name(id), id + ' has a name'); }
});

test('each of the nine apps loads the row and mounts it under its own id', () => {
  const pages = { 'workspace': ['index.html'], 'google-map-live': ['incubator/google-map-live/index.html'], 'loop-city-mould-growth': ['incubator/loop-city-mould-growth/index.html', 'incubator/loop-city-mould-growth/skin.js'],
    'loop-city-wool': ['incubator/loop-city-wool/index.html', 'incubator/loop-city-wool/skin.js'], 'loop-city-tensor-base': ['incubator/loop-city-tensor-base/index.html', 'incubator/loop-city-tensor-base/skin.js'],
    'tensor-studio': ['incubator/tensor-studio/index.html', 'incubator/tensor-studio/app.js'], 'structure-studio': ['incubator/structure-studio/index.html'], 'vr': ['incubator/vr/map.html'], 'loop-city-real-map': ['incubator/loop-city-real-map/index.html'] };
  for (const [id, files] of Object.entries(pages)) { const html = read(files[0]), all = files.map(read).join('\n');
    assert.ok(/shared\/ui\/chain\.js/.test(html), id + ': chain.js'); assert.ok(/shared\/ui\/chain\.css/.test(html), id + ': chain.css');
    assert.ok(all.includes("id: '" + id + "'"), id + ': mounted under its id'); }
  assert.ok(read('incubator/vr/index.html').includes("id: 'vr'"), 'the VR scenes page too');
});

test('the steps that hand a result on say when they are ready and use the app’s own hand-over', () => {
  const mould = read('incubator/loop-city-mould-growth/skin.js'), wool = read('incubator/loop-city-wool/skin.js'), base = read('incubator/loop-city-tensor-base/skin.js'), ts = read('incubator/tensor-studio/app.js'), ss = read('incubator/structure-studio/index.html');
  assert.ok(mould.includes('MULTI.open(picked())')); assert.ok(wool.includes('go: function () { bdSend(); }')); assert.ok(base.includes("$('openTS').click()"));
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
