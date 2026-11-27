// 27 Nov 2026 · Structure Studio step 10 on a phone (or a phone emulator): only the yellow roads showed (the standard
// material's shader needs dFdx, missing on WebGL1 without OES_standard_derivatives), the page froze for 10+ s while step 9
// built the 3D, and memory went past the phone limit (two 4096² road canvases). These keep the fixes D–G.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = (p) => readFileSync(new URL('../../incubator/structure-studio/' + p, import.meta.url), 'utf8');
const h = read('index.html');
test('D · without derivatives the standard materials fall back to Lambert, so the ground and the structure still draw', () => {
  assert.ok(h.includes("const gl3 = renderer.capabilities.isWebGL2 || renderer.extensions.has('OES_standard_derivatives'); if (gl3) return; LITE = true;"));
  assert.ok(h.includes('new THREE.MeshLambertMaterial({ color: m.color, vertexColors: m.vertexColors, side: m.side'));
  assert.ok(h.includes('for (const k in MAT) MAT[k] = Array.isArray(MAT[k]) ? MAT[k].map(to) : to(MAT[k]);'), 'the tower podium array too');
  assert.ok(h.indexOf('liteMats();') > h.indexOf('renderer = new THREE.WebGLRenderer') && h.indexOf('liteMats();') < h.indexOf('function buildScene'), 'swapped before any mesh is made');
});
test('E · a phone paints the 3D roads at 2048² and lets the scratch canvas go; a painted texture is not repainted', () => {
  assert.ok(h.includes('if (LOWMEM) ROAD3.size = 2048;'));
  assert.ok(h.includes('if (LOWMEM) { tmp.width = tmp.height = 0; paintRoads3.tmp = null; }'));
  assert.ok(h.includes('if (cv.__snap !== SNAP || cv.__sc !== SCHEME3 || cv.width !== ROAD3.size) paintRoads3();'));
});
test('F · a phone starts with deck subdivision 1 and no shadows (both can be turned back on)', () => {
  assert.ok(h.includes("if (!('sub' in st)) DKP.sub = 1;"));
  assert.ok(h.indexOf("if (!('sub' in st)) DKP.sub = 1;") > h.indexOf('const LOWMEM = '), 'after LOWMEM is defined');
  assert.ok(h.includes("if (LOWMEM) { $('c_shadow').checked = false; renderer.shadowMap.enabled = false; }"));
});
test('G · step 9 builds the 3D in slices (mesh parts, deck, roads, scene, warm-up) and stops if the structure changes', () => {
  const e = read('engine/structure.js');
  assert.ok(e.includes('function meshes(F, P) { const it = meshesIter(F, P); let r; while (!(r = it.next()).done); return r.value; }'));
  assert.equal((e.match(/^\s*yield '/gm) || []).length, 4, 'four pauses inside the mesh build');
  assert.ok(/const API = \{[^}]*meshesIter/.test(e));
  assert.ok(h.includes("it = it || SS.meshesIter(F, P); const r = it.next(); if (r.done) M = r.value; else return 'again';"));
  assert.ok(h.includes('if (i <= 3 && !(DEMO.on && F === F0 && sceneDirty)) { DEMO.building = false; return; }'));
  assert.ok(h.includes("() => { if (sceneDirty) ensure3D(); }, () => warm3D()];"));
});
