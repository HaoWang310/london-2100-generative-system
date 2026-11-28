// 28 Nov 2026 · Wool: two settings could not change anything. The road knife (step 5) is never drawn in the method the
// page opens with (#whole: towns cut the cells, existing roads do not); the station radius (step 8) only acts when
// "Within 3 km of the station" is not × 1. Both now grey out with the reason, as the farming share does.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = (p) => readFileSync(new URL('../../incubator/loop-city-wool/' + p, import.meta.url), 'utf8');
global.window = {}; global.document = { documentElement: { lang: 'en' }, getElementById: (id) => (id === 'nearF' ? { value: global.__nearF } : null) };
new Function(read('params.js'))();
const P = window.__lcParams;
test('the road knife greys out while existing roads do not cut the cells, and only then', () => {
  window.__WOOL_K__ = { ROADCUT: 'none' }; assert.match(P.byId('HALF_ROAD').off(), /only towns cut them/);
  window.__WOOL_K__.ROADCUT = 'MA'; assert.equal(P.byId('HALF_ROAD').off(), '');
  window.__WOOL_K__.ROADCUT = 'all'; assert.equal(P.byId('HALF_ROAD').off(), '');
  assert.ok(read('index.html').includes("if (!/[#&]whole/.test(h)) add.push('whole&share');"), 'the page still opens with #whole');
});
test('step 5 has the choice: which existing roads cut the cells (no by default, M · A, all), and the knife follows it', () => {
  const q = P.byId('ROADCUT'); assert.equal(q.step, 5); assert.equal(q.def, 'none'); assert.deepEqual(q.opts.map(o => o[0]), ['none', 'MA', 'all']); assert.equal(q.how, 'bake'); assert.equal(q.stage, 5);
  const h = read('index.html');
  assert.ok(h.includes("ROADCUT: window.WHOLE_ ? 'none' : 'all',"), 'a link without #whole keeps the old method');
  assert.ok(h.includes("for (const r of (KP.ROADCUT === 'none' ? [] : KP.ROADCUT === 'MA' ? kRoads.filter(r => r.c !== 'B') : kRoads))"));
});
test('the station radius greys out while "Within 3 km of the station" is × 1', () => {
  global.__nearF = '1'; assert.match(P.byId('NEAR_R').off(), /not × 1/);
  global.__nearF = '0.6'; assert.equal(P.byId('NEAR_R').off(), '');
});
test('step 5 says what the method does: towns cut the cells, roads are crossed and joined at step 12', () => {
  const e = read('explain.js');
  assert.ok(e.includes("t: W5 ? T('Towns are what the wool cannot cross', '城镇是毛线穿不过的地方') : M5 ? T('Towns, motorways and A roads are what the wool cannot cross'"));
  assert.ok(e.includes("第 12 步再让新路网并入这些路") && e.includes("W5 ? T('not used', '不起作用')"));
  const h = read('index.html'); assert.ok(h.includes('src="params.js?v=3"') && h.includes('src="explain.js?v=9"'));
});
test('the English name of "Within … km of the station" follows the radius', () => {
  global.NEAR_R = 3000; assert.deepEqual(P.byId('nearF').lab, ['Within 3 km of the station', '车站附近']);
  global.NEAR_R = 4500; assert.deepEqual(P.byId('nearF').lab, ['Within 4.5 km of the station', '车站附近']);
  delete global.NEAR_R;
});
