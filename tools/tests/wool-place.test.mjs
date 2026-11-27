// 27 Nov 2026 · Loop City step 2 (wool): where the site is — place names, the card, the key plan (place.js, places.js)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
const read = (p) => readFileSync(new URL('../../incubator/loop-city-wool/' + p, import.meta.url), 'utf8');
function load(lang) {
  const ctx = { window: {}, document: { documentElement: { lang, classList: { contains: () => false } }, getElementById: () => null }, MutationObserver: class { observe() {} }, console };
  ctx.window = ctx; vm.createContext(ctx); vm.runInContext(read('places.js'), ctx); vm.runInContext(read('place.js'), ctx); return ctx.__lcPlace;
}
test('places.js: stations, towns and the radials in British National Grid metres', () => {
  const ctx = { window: {} }; vm.runInNewContext(read('places.js'), ctx); const P = ctx.window.__WOOL_PLACES__;
  assert.equal(P.crs, 'EPSG:27700'); assert.ok(P.stations.length > 500 && P.towns.length > 100 && P.radials.length === 6);
  assert.ok(P.towns[0][0] > 1000, 'the largest town (London) first');
  const a = P.stations.find(s => s[0] === 'Arlesey'); assert.ok(a && Math.hypot(a[1] - 518953, a[2] - 237672) < 400, 'Arlesey station is by P2');
});
test('place.js: coordinates, grid reference and the words for where a station is', () => {
  const zh = load('zh'), en = load('en');
  const t = zh.toBNG(-0.1280, 51.5080); assert.ok(Math.hypot(t[0] - 530013, t[1] - 180446) < 30, 'Trafalgar Square');
  const ll = zh.toLL(518952.8, 237672.1); assert.ok(Math.abs(ll[1] - 52.0247) < 0.0005 && Math.abs(ll[0] + 0.2677) < 0.0005, 'P2 in latitude and longitude');
  assert.equal(zh.gridRef(518952.8, 237672.1), 'TL 18 37');
  assert.equal(zh.whereStation(518952.8, 237672.1), 'Arlesey');
  assert.equal(zh.whereStation(511486, 225496.1), 'Luton 东北偏北 4.5 km'); assert.equal(en.whereStation(511486, 225496.1), '4.5 km NNE of Luton');
  assert.equal(zh.fromLondon(518952.8, 237672.1), '伦敦市中心以北 58 km'); assert.equal(en.fromLondon(518952.8, 237672.1), '58 km N of central London');
});
test('the page uses it: map labels, the key plan (computer: London context, phone: linework) and its click', () => {
  const h = read('index.html'), p = read('place.js');
  assert.ok(h.includes('__lcPlace.map(main)') && h.includes('__lcPlace.mini(c, pxCss(LK().main))') && h.includes('__lcPlace.pick(ev)'));
  assert.ok(/<script src="places\.js\?v=1"><\/script><script src="place\.js\?v=1"><\/script>/.test(h));
  assert.ok(p.includes("var phone = H.classList.contains('l2phone')") && p.includes('// linework') && p.includes('// London context'));
  assert.ok(/<script>const SITE = /.test(h), 'the baked script is untouched by this (example/ stays valid)');
});
