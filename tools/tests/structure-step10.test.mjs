// 27 Nov 2026 · Structure Studio, step 10 「结构」 sometimes showed nothing (black) for 1–2 s on phone and desktop:
// the first 3D frame compiled every shader, uploaded the meshes and drew the shadow map (≈ 0.4–0.6 s) while the plan
// was already hidden. On a phone the view menu also covered the step title. These keep the three fixes.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = (p) => readFileSync(new URL('../../incubator/structure-studio/' + p, import.meta.url), 'utf8');
const h = read('index.html');
test('A · the 3D built during step 9 is warmed up: shaders compiled and one frame drawn before step 10', () => {
  assert.ok(h.includes('() => { if (sceneDirty) ensure3D(); }, () => warm3D()];'), 'prebuild3D warms up after building');
  assert.ok(/function warm3D\(\) \{ if \(!renderer \|\| sceneDirty \|\| !scene\) return; try \{ placeCam\(camS\); setLift\(\); renderer\.compile\(scene, camera\); renderer\.render\(scene, camera\);/.test(h));
});
test('B · switching to 3D keeps the plan on top until the first 3D frame of a built scene, then fades it out', () => {
  assert.ok(h.includes('#plan.hold{pointer-events:none}') && h.includes('#plan.fade{opacity:0;transition:opacity .3s ease}'));
  assert.ok(h.includes("function setMode(m) { const was = mode;"));
  assert.ok(h.includes("else if (was === '2d' && F && pl.style.display !== 'none') { HOLD = 1;"), 'the plan is held, not hidden');
  assert.ok(h.includes("if (m === '2d') { HOLD = 0; pl.classList.remove('hold', 'fade'); pl.style.display = 'block'; }"), 'back to 2D clears the hold');
  assert.ok(h.includes('renderer.render(scene, camera); drawAxis(); vpSync(); vpPlace(); if (HOLD === 1 && !sceneDirty) holdRelease(); }'), 'released only after a frame of a built scene');
  assert.ok(h.includes("if (HOLD !== 2) return; HOLD = 0; pl.classList.remove('hold', 'fade'); if (mode === '3d') pl.style.display = 'none';"));
  assert.ok(h.includes("bz.textContent = L('正在生成三维…', 'Building 3D…')") && h.includes('finally { bz.style.display = \'none\'; bz.textContent = bt; }'), 'not built yet: says so over the plan');
});
test('C · on a phone during the step-by-step demo the view menu sits under the step text', () => {
  assert.ok(h.includes("on = document.documentElement.classList.contains('l2phone') && document.body.classList.contains('demo-run')"));
  assert.ok(h.includes("k = Math.round(h.bottom + 10) + '|' + Math.round(n.left)"));
  const css = read('skin.css');
  assert.ok(css.includes('html.l2ui.l2phone body.demo-run #vp { top:var(--vpT,64px) !important; left:var(--vpL,14px) !important; }'));
  assert.ok(css.indexOf('html.l2ui.l2phone #vp {') < css.indexOf('html.l2ui.l2phone body.demo-run #vp {'), 'the demo rule comes after the general phone rule');
  assert.ok(h.includes('skin.css?v=5'));
});
