// The wool bands under a finger (26 Nov 2026): node --test tools/tests/phone.test.mjs
// On a phone the map heard the mouse only, one parcel could be taken (no Shift), and the folded sheet's buttons did
// nothing at steps 16 and 17. These hold the wiring that put it right; the gestures themselves are checked in a browser.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const root = new URL('../../', import.meta.url), read = p => readFileSync(new URL(p, root), 'utf8');
const page = read('incubator/loop-city-wool/index.html'), skin = read('incubator/loop-city-wool/skin.js'), flow = read('incubator/loop-city-wool/flow.js');

test('the map takes fingers: one moves it, two zoom it, a tap is a click', () => {
  for (const ev of ['touchstart', 'touchmove', 'touchend', 'touchcancel']) assert.ok(page.includes("cv.addEventListener('" + ev + "'"), ev);
  assert.ok(page.includes("cv.style.touchAction = 'none';"), 'two fingers zoom the map, not the page');
  assert.ok((page.match(/\{ passive: false \}\);/g) || []).length >= 3, 'the page may stop the browser’s own scroll and zoom');
  assert.ok(page.includes('S.view.mpp = Math.min(80, Math.max(0.08, T.mpp * T.d /'), 'the pinch keeps the limits of the wheel');
  assert.ok(page.includes('cv.onmousedown = e => {') && page.includes('cv.onwheel = e => {'), 'the mouse is as it was');
});

test('a tap at step 17 adds a parcel or drops it, and the words speak of taps', () => {
  assert.ok(page.includes('else if (S.step === 27) bdPickAt(d.x, d.y, true, false, true);'));
  assert.ok(page.includes('function bdPickAt(px, py, add, dbl, touch) {'));
  assert.ok(page.includes("touch ? 'Tap another to add it, tap one again to drop it.' : 'Shift-click for more, double-click to open them.'"));
  assert.ok(/var TOUCH = \(function \(\) \{ try \{ return \(navigator\.maxTouchPoints \|\| 0\) > 0 && !!window\.matchMedia && matchMedia\('\(pointer: coarse\)'\)\.matches;/.test(page));
  assert.ok(page.includes("if (TOUCH) STEP_HINT[27] = 'The last step") && page.includes("if (TOUCH) d.querySelector('p.hint').textContent = 'Tap an urban parcel"));
  // each new English line has its Chinese
  for (const en of ['Tap an urban parcel to take it: it turns red.', 'then press Next · Tensor Studio.']) { const i = page.indexOf(en + ' ') >= 0 ? page.indexOf(en) : page.indexOf(en); assert.ok(i > 0, en); }
  assert.ok(page.includes('再点别的可以加选，再点一次已选的可以取消。'));
});

test('the folded sheet: Next reaches step 17, and at step 17 it is the hand-over', () => {
  assert.ok(skin.includes("window.__lcHandOver = function () { if (!PHONE || cur() !== list.length - 1) return false; try { bdSend(); } catch (e) {} return true; };"));
  assert.ok(skin.includes("bnT[1] = end ? 'Next · Tensor Studio ›' : 'Next ›'; bnT[2] = end ? '下一步 · 张量场工作室 ›' : '下一步 ›';"));
  assert.ok(skin.includes('bn.disabled = end ? !h.ready : (i < 0 || i >= list.length - 1);'), 'grey until Tensor Studio can take the parcels');
  assert.ok(skin.includes('state: handOver,'), 'the chain row and the folded Next read one state');
  assert.ok(flow.includes('if (window.__lcHandOver && window.__lcHandOver()) return;'));
  assert.ok(flow.includes("if (S.step === 27) { stop(); setStep(26); P.k = null; render(); return; } back();"), 'Previous leaves step 17');
  assert.ok(flow.includes('if (S.step === 26 && nextK(cur()) === undefined'), 'Next goes on from step 16');
  // the step buttons the sheet counts: step 17 (27) is the last of them
  const order = [...page.matchAll(/<button[^>]*data-step="(\d+)"/g)].map(m => +m[1]); if (order.length) assert.equal(order[order.length - 1], 27);
});

test('the chain row’s buttons are a thumb high under a finger, in every app', () => {
  const css = read('shared/ui/chain.css'); assert.ok(css.includes('@media (pointer: coarse) { .l2chain .l2c-bk, .l2chain .l2c-nx { min-height:44px !important; } }'));
  for (const p of ['index.html', 'incubator/vr/index.html', 'incubator/vr/map.html', 'incubator/loop-city-wool/index.html', 'incubator/google-map-live/index.html', 'incubator/loop-city-mould-growth/index.html', 'incubator/structure-studio/index.html', 'incubator/tensor-studio/index.html'])
    assert.ok(read(p).includes('chain.css?v=2'), p + ' loads the new sheet');
});
