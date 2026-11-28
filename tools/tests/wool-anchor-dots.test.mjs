// 28 Nov 2026 · Wool, step 8 on: the anchors were soft glows (a 0.5 px core, additive, the colour of the roads and the
// edges they sit on) and could hardly be seen. They are solid dots ringed in the page colour now.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const h = readFileSync(new URL('../../incubator/loop-city-wool/index.html', import.meta.url), 'utf8');
const fn = h.slice(h.indexOf('function anchorDots() {'), h.indexOf('function existingLines()'));
test('anchors: solid on the roads, hollow between, cyan for yours, an open diamond for the gateways', () => {
  assert.ok(fn.includes('ancDots(road, C.main, 3.6 * k, false); ancDots(between, C.node, 2.8 * k, true); ancDots(mine, pxRGB(TH().manual), 3.6 * k, false);'));
  assert.ok(fn.includes('if (gates.length) ancGates(gates, 3.2 * k);'));
  assert.ok(!fn.includes('pxStars('), 'no soft glows for anchors any more');
});
test('each dot is ringed in the page colour, bigger on step 8, sized with the zoom, still under the size slider', () => {
  assert.ok(fn.includes('cx.beginPath(); cx.arc(X, Y, r + 1.8, 0, 7); cx.fillStyle = bg; cx.fill();'));
  assert.ok(fn.includes('const z = Math.max(0.6, Math.min(1.15, Math.sqrt(32 / S.view.mpp))), k = V.ancS * (S.edit ? 1.4 : 1) * (S.step === 8 ? 1.2 : 1) * z;'));
});
