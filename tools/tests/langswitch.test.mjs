// The language switch looks the same in every app (26 Nov 2026): node --test tools/tests/langswitch.test.mjs
// On a computer it stands at the right of the panel's title; on a phone at the top right, level with Display, 44 px
// high. Everywhere it reads 中文 then EN. Tensor Studio kept it in the sheet along the bottom on a phone, smaller, and
// wrote "English"; the wool and step 1 wrote EN first.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const root = new URL('../../', import.meta.url), read = p => readFileSync(new URL(p, root), 'utf8');
const items = JSON.parse(read('incubator/catalogue.json')).items;

test('every app writes the two languages the same way: 中文 and EN', () => {
  const pages = { 'google-map-live': 'data-language', 'loop-city-mould-growth': 'data-lang', 'loop-city-wool': 'data-lang', 'tensor-studio': 'data-language', 'structure-studio': 'data-language' };
  for (const id in pages) { const html = read('incubator/' + id + '/index.html'), a = pages[id];
    if (id === 'google-map-live') {      // its markup says ZH; its language script writes 中文 on the button as the page starts
      assert.ok(/<button[^>]*data-language="en"[^>]*>\s*EN\s*<\/button>/.test(html), id + ': EN');
      assert.ok(read('incubator/google-map-live/scripts/ui_language.js').includes("const SWITCH_LABELS = { zh: '中文', en: 'EN' };"), id + ': 中文'); continue; }
    assert.ok(new RegExp('<button[^>]*' + a + '="zh"[^>]*>\\s*中文\\s*</button>').test(html), id + ': 中文');
    assert.ok(new RegExp('<button[^>]*' + a + '="en"[^>]*>\\s*EN\\s*</button>').test(html), id + ': EN'); }
});

test('中文 stands first: in the markup, or by the skin where the markup has EN first', () => {
  for (const [id, a] of [['google-map-live', 'data-language'], ['tensor-studio', 'data-language'], ['structure-studio', 'data-language']]) { const html = read('incubator/' + id + '/index.html');
    assert.ok(html.indexOf(a + '="zh"') < html.indexOf(a + '="en"'), id); }
  assert.ok(read('incubator/loop-city-wool/skin.css').includes('html.l2ui #langbar button[data-lang="zh"] { order:-1; }'));
  assert.ok(read('incubator/loop-city-mould-growth/skin.css').includes('html.lcskin #langbar button[data-lang="zh"] { order:-1; }'));
  assert.ok(read('shared/ui/phone.css').includes('.l2ph-lang button[data-lang="zh"], .l2ph-lang button[data-language="zh"] { order:-1; }'), 'and on a phone, for every app');
});

test('Tensor Studio on a phone: the switch goes to the top right with the shared look', () => {
  const html = read('incubator/tensor-studio/index.html'), js = read('incubator/tensor-studio/phone.js');
  assert.ok(html.includes('<link rel="stylesheet" href="../../shared/ui/phone.css?v='), 'the shared look is loaded');
  assert.ok(js.includes("var sw = document.querySelector('.language-switch'); if (sw) { sw.classList.add('l2ph-lang'); document.body.appendChild(sw); r.classList.add('l2ph-lang-top'); }"));
  assert.equal((html.match(/class="language-switch"/g) || []).length, 1, 'one switch in the page, so it is found wherever it stands');
  const e = items.find(i => i.id === 'tensor-studio').embed;
  assert.equal(e.langButton, '.language-switch button[data-language="{lang}"]', 'found by the catalogue and by shared/ui/lang.js after it has left the panel');
  assert.deepEqual(e.hide, ['.language-switch'], 'and hidden there, where the catalogue shows its own');
  assert.ok(/phone\.js\?v=2/.test(html));
});

test('on a computer the switch is one size in every app: buttons 26 px high, at least 34 px wide, 11 px letters', () => {
  // (26 Nov 2026) the wool and step 1 were a size larger (about 90 × 41 px), the catalogue wider and lower (94 × 30)
  const same = css => { for (const k of ['min-width:34px', 'height:26px', 'padding:0 7px', 'border-radius:9px', 'font-size:11px', 'font-weight:600']) assert.ok(css.replace(/:\s+/g, ':').includes(k), k + ' in ' + css.slice(0, 60)); };
  const rule = (file, sel) => { const s = read(file), i = s.indexOf(sel + '{') >= 0 ? s.indexOf(sel + '{') : s.indexOf(sel + ' {'); assert.ok(i >= 0, sel + ' in ' + file); return s.slice(i, s.indexOf('}', i)); };
  same(rule('incubator/loop-city-wool/skin.css', 'html.l2ui #langbar button'));
  same(rule('incubator/loop-city-mould-growth/skin.css', 'html.lcskin #langbar button'));
  same(rule('shared/ui/theme.css', '  .lang-seg button'));
  same(rule('incubator/tensor-studio/index.html', '#panel .language-switch button').replace('min-height', 'height'));
  same(rule('incubator/structure-studio/index.html', '#panel .language-switch button').replace('min-height', 'height'));
  // the frame: 2 px inside, 2 px between the two buttons
  for (const [f, sel] of [['incubator/loop-city-wool/skin.css', 'html.l2ui #langbar, html.l2ui body.light #langbar'], ['incubator/loop-city-mould-growth/skin.css', 'html.lcskin #langbar, html.lcskin #hud #langbar']]) { const r = rule(f, sel);
    assert.ok(r.includes('padding:2px') && r.includes('gap:2px'), f); }
  // a phone keeps its own, larger switch: the catalogue's rule is for a mouse or a trackpad only
  assert.ok(read('shared/ui/theme.css').includes('@media not all and (pointer: coarse) {'));
  assert.ok(read('incubator/loop-city-wool/skin.css').includes('html.l2ui:not(.l2phone) #langbar button[data-lang="zh"] { width:36px; padding:0; }'));
});
