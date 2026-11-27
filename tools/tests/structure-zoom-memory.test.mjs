// 27 Nov 2026 · Structure Studio on an iPhone: pinching to look at details sent the page back to the catalogue. The page
// let Safari zoom the whole page (no touch-action, plan had no pinch), every 3D rebuild kept the old GPU buffers, and the
// end of the demo rebuilt the same 3D again (peak 505 MB). These keep the fixes H–K.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const h = readFileSync(new URL('../../incubator/structure-studio/index.html', import.meta.url), 'utf8');
test('H · the browser never zooms the page: canvases take the touches, iOS gesture events are stopped', () => {
  assert.ok(/#gl,#plan\{[^}]*touch-action:none/.test(h));
  assert.ok(h.includes("['gesturestart', 'gesturechange', 'gestureend'].forEach(t => document.addEventListener(t, e => e.preventDefault(), { passive: false }));"));
});
test('I · the plan zooms with two fingers around their midpoint, and one finger left over does not drag', () => {
  assert.ok(h.includes('if (pts.size === 2) { drag = null; pin = two(); return; }'));
  assert.ok(h.includes('PV.ox = mx - (mx - (PV.ox + q.x - pin.x)) * k; PV.oy = my - (my - (PV.oy + q.y - pin.y)) * k; PV.s *= k;'));
  assert.ok(h.includes("const lift = e => { pts.delete(e.pointerId); if (pts.size < 2) pin = null; if (pts.size) drag = null; };"));
  assert.ok(h.includes("cv.addEventListener('pointercancel', e => { lift(e); drag = null;"));
});
test('J · replacing the 3D frees the old buffers and the road texture (materials are shared and stay)', () => {
  assert.ok(h.includes('function dropOld() { const gs = new Set();') && h.includes('gs.forEach(g => g.dispose()); if (G.roadTex) { G.roadTex.dispose(); G.roadTex = null; } }'));
  assert.ok(h.includes('function buildScene() {\n  dropOld(); for (const k in G) if (G[k]) scene.remove(G[k]);'));
  assert.ok(h.includes('scene.remove(G.hi); G.hi.geometry.dispose(); G.hi = null;'));
  assert.ok(!/dropOld[^\n]*material\.dispose/.test(h));
});
test('K · the end of the demo keeps the 3D when the structure is the same object', () => {
  assert.ok(h.includes('if (sv && sv.F !== F) { F = sv.F; M = null; sceneDirty = true; } makePlanBase();'));
  assert.ok(h.includes('if (dirty) { if (F !== DEMO.FD) { F = DEMO.FD; M = null; sceneDirty = true; } FIT3D = fit;'));
});
