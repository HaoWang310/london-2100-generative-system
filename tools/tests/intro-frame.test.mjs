// 27 Nov 2026 · the three openings share one frame (the Loop City mould's): a top row with one 44 px button,
// moved below the catalogue's language switch on a phone, and a foot with the marks and a status
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = (p) => readFileSync(new URL('../../' + p, import.meta.url), 'utf8');
const A = [
  ['loop-city-mould-growth/intro.css', 'loop-city-mould-growth/intro.js', '.lci-skip', 'lci-foot', /html\.l2-shell-lang \.lci-top\s*\{\s*padding-top:68px/],
  ['structure-studio/intro/intro.css', 'structure-studio/intro/intro.js', '#ssIntro .ssi-skip', 'ssi-foot', /html\.l2-shell-lang #ssIntro \.ssi-bar\{padding-top:68px\}/],
  ['tensor-studio/intro/intro.css', 'tensor-studio/intro/intro.js', '#tsIntro .tsi-skip', 'tsi-foot', /html\.l2-shell-lang #tsIntro \.tsi-bar\{padding-top:68px\}/]];
test('the openings share the mould\'s frame: one 44 px button, below the catalogue\'s switch on a phone, a foot', () => {
  for (const [css, js, btn, foot, shell] of A) {
    const c = read('incubator/' + css), j = read('incubator/' + js);
    const i = c.indexOf(btn + '{') >= 0 ? c.indexOf(btn + '{') : c.indexOf(btn + ' {');
    assert.ok(i >= 0 && /height:\s*44px/.test(c.slice(i, c.indexOf('}', i))), css + ': button 44 px');
    assert.ok(shell.test(c), css + ': below the switch');
    assert.ok(j.includes(foot), js + ': foot');
  }
  for (const f of ['structure-studio/intro/intro.js', 'tensor-studio/intro/intro.js']) assert.ok(!/class="(ssi|tsi)-enter"/.test(read('incubator/' + f)), f + ': one button only');
  assert.ok(!read('incubator/structure-studio/intro/draw.js').includes('caption(o.waiting ? T[2] + 1 : t); pips(t);'), 'no progress line drawn in the film');
});
test('Structure\'s film follows a language change mid-film, folds long titles, and its cards wait for the plan picture', () => {
  const d = read('incubator/structure-studio/intro/draw.js'), w = read('incubator/structure-studio/intro/worker.js'), i = read('incubator/structure-studio/intro/intro.js'), p = read('incubator/structure-studio/index.html');
  assert.ok(/const setLang = \(l, nm\)/.test(d) && d.includes('setWool, setLang,'), 'draw.js setLang');
  assert.ok(read('incubator/structure-studio/intro/scene5.js').includes('dispose, setLang }'), 'scene5 setLang');
  assert.ok(w.includes("m.type === 'lang'") && i.includes("type: 'lang'"), 'the worker hears it');
  assert.ok(d.includes('const tl = wrap(tt, maxW, ts, 600)'), 'titles fold');
  assert.ok(p.includes('if (!planBase) { setTimeout(step, 250); return; }'), 'card pictures wait');
  for (const f of ['structure-studio/intro/intro.js', 'tensor-studio/intro/intro.js']) assert.ok(/foot" aria-hidden="true"/.test(read('incubator/' + f)), f + ': foot hidden from screen readers');
});
