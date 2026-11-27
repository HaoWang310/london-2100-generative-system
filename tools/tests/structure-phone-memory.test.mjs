// 27 Nov 2026 · Structure Studio on a phone: the page was reloaded (back to the catalogue) after the opening film or
// Skip — 21 plan canvases at 2682 × 2634 (482 MB) went past the phone browser's canvas limit. These keep the fixes.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = (p) => readFileSync(new URL('../../incubator/structure-studio/' + p, import.meta.url), 'utf8');
test('a phone draws the plan at 1×, keeps one scheme, drops the mask cache, caps the screen canvas and the 3D', () => {
  const h = read('index.html');
  assert.ok(/const LOWMEM = .*matchMedia\('\(pointer: coarse\)'\)/.test(h) && h.includes('PLAN_SC = LOWMEM ? 1 : 2'));
  assert.ok(h.includes('const g = F.grid, SC = PLAN_SC,') && h.includes('function makeTsBase() { const S = SITE, SC = PLAN_SC,'));
  assert.ok(h.includes('x0 * PLAN_SC, y0 * PLAN_SC, w * PLAN_SC, h * PLAN_SC'), 'the card thumbnails follow the plan scale');
  assert.ok(h.includes('while (FC.size > (LOWMEM ? 1 : 4))') && h.includes('function prewarm(id) { if (LOWMEM ||'));
  assert.ok(h.includes('if (LOWMEM) F._pb = null;'));
  assert.ok(h.includes("pr = Math.min(LOWMEM ? 2 : 4, devicePixelRatio || 1)"));
  assert.ok(h.includes('antialias: !LOWMEM') && h.includes('sun.shadow.mapSize.set(LOWMEM ? 2048 : 4096'));
});
test('the film lets go before the page goes on, and nothing crashes when canvases run out', () => {
  const i = read('intro/intro.js'), h = read('index.html'), s5 = read('intro/scene5.js');
  const c = i.slice(i.indexOf('me.close = function'), i.indexOf('// the snapshot never came'));
  assert.ok(c.indexOf("root.classList.add('ssi-out')") < c.indexOf('setTimeout(') && c.indexOf('s5.dispose()') < c.indexOf('cb(true)') && c.indexOf('worker.terminate()') < c.indexOf('cb(true)'), 'release, then hand over');
  assert.ok(i.includes("cvGL.addEventListener('webglcontextlost'"));
  assert.ok(s5.includes("antialias: !low, powerPreference: low ? 'default' : 'high-performance'"));
  assert.ok(h.includes("if (!ctx) throw new Error('canvas memory');") && h.includes('try { await demoPrepare(v1 != null ? v1 : P.mode); }'));
});
