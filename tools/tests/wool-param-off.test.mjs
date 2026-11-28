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
test('the road knife greys out under #whole, and only then', () => {
  window.WHOLE_ = true; assert.match(P.byId('HALF_ROAD').off(), /existing roads do not cut the cells/);
  window.WHOLE_ = false; assert.equal(P.byId('HALF_ROAD').off(), '');
  assert.ok(read('index.html').includes("if (!/[#&]whole/.test(h)) add.push('whole&share');"), 'the page still opens with #whole');
});
test('the station radius greys out while "Within 3 km of the station" is × 1', () => {
  global.__nearF = '1'; assert.match(P.byId('NEAR_R').off(), /not × 1/);
  global.__nearF = '0.6'; assert.equal(P.byId('NEAR_R').off(), '');
});
test('step 5 says what the method does: towns cut the cells, roads are crossed and joined at step 12', () => {
  const e = read('explain.js');
  assert.ok(e.includes("t: W5 ? T('Towns are what the wool cannot cross', '城镇是毛线穿不过的地方')"));
  assert.ok(e.includes("第 12 步再让新路网并入这些路") && e.includes("W5 ? T('not used', '不起作用')"));
  const h = read('index.html'); assert.ok(h.includes('src="params.js?v=2"') && h.includes('src="explain.js?v=8"'));
});
test('the English name of "Within … km of the station" follows the radius', () => {
  global.NEAR_R = 3000; assert.deepEqual(P.byId('nearF').lab, ['Within 3 km of the station', '车站附近']);
  global.NEAR_R = 4500; assert.deepEqual(P.byId('nearF').lab, ['Within 4.5 km of the station', '车站附近']);
  delete global.NEAR_R;
});
