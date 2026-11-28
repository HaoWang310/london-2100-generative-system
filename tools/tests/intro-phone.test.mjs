// 28 Nov 2026 · phone opening screen: the three words stay on the videos and the bottom bar
// (title + Enter) never covers the last one — on a computer nothing changes
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const css = readFileSync(new URL('../../app/intro.css', import.meta.url), 'utf8');
const phone = css.slice(css.indexOf('@media (max-width: 760px)'), css.indexOf('@media (prefers-reduced-motion'));

test('phone opening: bar is one row over a fade, tagline hidden, last word lifted', () => {
  assert.ok(phone.length > 0, 'phone block found');
  assert.match(phone, /\.intro-bar \{[^}]*flex-wrap: nowrap/);
  assert.match(phone, /\.intro-bar \{[^}]*linear-gradient/);
  assert.match(phone, /\.intro-bar p \{ display: none; \}/);
  assert.match(phone, /\.intro-panel:last-child \.intro-label[^{]*\{ bottom: calc\(50% \+ 30px\); \}/);
  assert.doesNotMatch(phone, /\.intro-bar \{[^}]*position: relative/, 'the bar still floats on the video');
});

test('computer opening is unchanged: tagline shown, label at 22%', () => {
  const desk = css.slice(0, css.indexOf('@media (max-width: 760px)'));
  assert.match(desk, /\.intro-bar p \{ margin: 2px 0 0;/);
  assert.match(desk, /\.intro-label \{[^}]*bottom: 22%/);
});
