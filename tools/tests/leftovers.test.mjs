// The leftovers found in a check of the whole repository (26 Nov 2026): node --test tools/tests/leftovers.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
const root = new URL('../../', import.meta.url), read = p => readFileSync(new URL(p, root), 'utf8'), there = p => existsSync(new URL(p, root));

test('Tensor Studio applies the language as it is when it starts, not as it was when the page began', () => {
  // applying the old one wrote it back to tensorStudio.uiLanguage, and shared/ui/lang.js took that for a choice: every tab went back
  const html = read('incubator/tensor-studio/index.html'), app = read('incubator/tensor-studio/app.js');
  assert.ok(html.includes("window.__TS_NOWLANG = () => { if (host?.lang) return host.lang; try { const s = localStorage.getItem(KEY); if (s === 'en' || s === 'zh') return s; } catch (e) {} return lang0; };"));
  assert.ok(html.includes(" setInterfaceLanguage((window.__TS_NOWLANG && window.__TS_NOWLANG()) || window.__TS_LANG0 || 'zh');"));
  assert.ok(app.includes('window.setInterfaceLanguage((window.__TS_NOWLANG && window.__TS_NOWLANG()) || T.lang);') && !app.includes('window.setInterfaceLanguage(T.lang);'));
});

test('the loading screens follow a language changed while they show', () => {
  assert.ok(read('incubator/tensor-studio/intro/intro.js').includes("zh = l === 'zh'; close(); if (root.parentNode) root.parentNode.removeChild(root); film();"), 'the film starts again in the new language');
  const ss = read('incubator/structure-studio/intro/intro.js');
  assert.ok(ss.includes('function relabel()') && ss.includes("me.hasSnap = true; name = nm || name; relabel();"), 'the opening card');
  assert.ok(read('incubator/loop-city-mould-growth/index.html').includes('note.textContent = (zhNow() ? "正在准备生长模型 "'), 'step 1\'s progress line');
  const vr = read('incubator/vr/map.html');
  assert.ok(vr.includes("addEventListener('storage', function (e) { if (e.key === 'l2100.lang') relabel(e.newValue); });"), 'VR\'s loading line and tab name');
  const main = read('app/main.js');
  assert.ok(main.includes("$('mapBadge').dataset.i18nKey = 'map.offline'") && main.includes('if (mb && !mb.hidden && mb.dataset.i18nKey) mb.textContent = t(mb.dataset.i18nKey);'), 'the main program\'s basemap note');
});

test('the wool bands: the evaluation has a card between step 16 and the way out, and the player passes it', () => {
  const flow = read('incubator/loop-city-wool/flow.js'), ex = read('incubator/loop-city-wool/explain.js'), html = read('incubator/loop-city-wool/index.html');
  const seq = /var SEQ = \[([^\]]*)\]/.exec(flow)[1].split(',').map(Number);
  assert.ok(!seq.includes(28), 'not in the player\'s order');
  const i = flow.indexOf("x += '<div class=\"chh\" style=\"color:#F5F5F7\">' + T('Chapter 5 · Evaluation', '第 5 章 · 评价') + '</div>' + card(28);"), j = flow.indexOf("T('The way out', '出口') + '</div>' + card(27);");
  assert.ok(i > 0 && j > i, 'its card stands before the way out');
  assert.ok(flow.includes('if (k === 28) { stop(); if (typeof BD !== \'undefined\' && BD.res && BD.res.hier && !BD.busy) { setStep(28); P.k = null; } else P.open[28] = !P.open[28]; render(); return; }'));
  assert.ok(ex.includes("s === 28 ? T('After step 16 · Evaluation', '第 16 步之后 · 评价')"), 'the chapter bar no longer calls it 18');
  assert.ok(/flow\.js\?v=7/.test(html) && /explain\.js\?v=7/.test(html));
});

test('the parked folders: loop-city-live without its copies; the growth simulator removed with its module', () => {
  const live = readdirSync(new URL('incubator/loop-city-live/', root));
  assert.ok(!live.some(f => f.includes('(copy)')), live.join(', '));
  const cat = JSON.parse(read('incubator/catalogue.json'));
  assert.deepEqual(cat.parked.map(p => p.id), ['loop-city-live']);
  assert.ok(!JSON.stringify(cat).includes('loop-city-wool-bands'));
  for (const p of ['incubator/growth-simulator-dark', 'modules/01-growth-simulator', 'assets/catalogue/growth-simulator-dark.webp']) assert.ok(!there(p), p);
  assert.ok(!read('tools/build-site.mjs').includes('growth-simulator'));
  for (const f of ['shared/i18n/zh.js', 'shared/i18n/en.js']) assert.ok(!/'(growth\.source|growth\.legend\.\d|nav\.hint\.growth)'/.test(read(f)), f);
  assert.ok(!read('app/main.js').includes('growth.legend') && !read('app/main.js').includes("t('growth.source')"));
});

test('the London map: tests that run, no leftovers from its first repository, the version without "-english"', () => {
  for (const f of ['scripts/release_version.test.mjs', 'scripts/ui_language.test.mjs', 'tests/building-shadows.test.mjs', 'tests/map-atmosphere.test.mjs', 'tests/street-traffic.test.mjs', 'tests/urban-trees.test.mjs'])
    assert.ok(there('incubator/google-map-live/' + f), f);
  for (const f of ['scripts/test_basemap_themes.mjs', 'tests/app-english-ui.mjs', 'tests/ui-language.mjs', '.github', 'google-style-3d.html', 'assets/terrain_b64'])
    assert.ok(!there('incubator/google-map-live/' + f), f);
  for (const f of ['env_fields.test.mjs', 'site_builder.test.mjs']) assert.ok(there('incubator/tensor-studio/scripts/' + f), f);
  assert.ok(read('incubator/google-map-live/index.html').includes('id="appVersionLabel">OpenStreetMap / OpenFreeMap · v3.45.0<'));
  assert.ok(!read('incubator/google-map-live/scripts/app.js').includes('-english'));
});

test('the architecture document says how things stand', () => {
  const s = read('docs/ARCHITECTURE.md');
  assert.ok(s.includes('ROAD_CHAIN = false') && s.includes('伦敦地图 → 第 1 步 整环：黏菌与生长 → 第 2 步 毛线带 → 张量场工作室 → 结构工作室 → VR'));
  assert.ok(!s.includes('01-growth-simulator'));
});
