// 28 Nov 2026 · London map opening: on a short phone the chapter-4 legend ran into the caption, the HS2 label ran off
// the left edge, and chapter 5 used five competing colours. These keep the fixes and the AADRL colours.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = (p) => readFileSync(new URL('../../incubator/google-map-live/' + p, import.meta.url), 'utf8');
const js = read('scripts/intro.js'), css = read('styles/intro.css'), py = read('tools/intro/plates.py');
test('phone: the frame leaves room for the tallest note, and the notes span the screen', () => {
  assert.ok(js.includes("box.querySelectorAll('.lmi-note').forEach(function (n) { nh = Math.max(nh, n.offsetHeight); });"));
  assert.ok(js.includes('room = Math.max(120, nh + 14);') && js.includes("narrow ? r.height - room - 10 : r.height"));
  assert.ok(js.includes("if (narrow) box.style.setProperty('--nx', -(r.width - w) / 2 + 'px');"));
  assert.ok(css.includes('#lmIntro.lmi-narrow .lmi-noteR { left:var(--nx,0px); width:var(--nw,100%); }'));
  assert.ok(css.includes('#lmIntro.lmi-small .lmi-hs.lmi-sl { transform:translate(4px, 45%); }'), 'HS2 inside the screen');
});
test('chapter 5 in AADRL colours: grey-white ground, red city lines, cyan high speed', () => {
  assert.ok(js.includes("[['#c8c8cd', 'Green Belt 5,065 km²', 'l'], ['#96969e', 'AONB · 5 landscapes', 'd'], ['#e1e1e4', 'National Rail', 'l'], ['#E8463A', 'Underground and other lines', 'l'], ['#3fe0c5', 'HS1 · HS2'"));
  assert.ok(css.includes('.lmi-hs b { color:#3fe0c5;'));
  assert.ok(!/255, 45, 149|132, 148, 116|227, 32, 23/.test(py), 'the old magenta, olive and TfL red are gone from the plates');
  assert.ok(py.includes("'underground': (232, 70, 58)") && py.includes('fill=(63, 224, 197, 255)'));
  assert.ok(read('scripts/ui_chinese_dictionary.js').includes('"Underground and other lines": "地铁及其他城市线路"'));
});
test('the pictures carry the script version, so new legends never sit on cached old pictures', () => {
  assert.ok(js.includes("im.src = DIR + name + '.webp' + (IV ? '?v=' + IV : '');"));
  assert.ok(read('index.html').includes('scripts/intro.js?v=3.46.1'));
});
