// The wording of the apps, checked in both languages (26 Nov 2026): node --test tools/tests/wording.test.mjs
// A check of all seven apps found text shown in the wrong language, pairs that did not say the same thing, and one
// word written two ways. These tests hold what was put right.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
const root = new URL('../../', import.meta.url), read = p => readFileSync(new URL(p, root), 'utf8');
const HAN = /[㐀-鿿]/;
const zhDict = (file, start) => { const s = read(file), i = s.indexOf(start), j = s.indexOf('\n', i); return JSON.parse(s.slice(i + 'const ZH = '.length, j).replace(/;\s*$/, '')); };
const catalogue = JSON.parse(read('incubator/catalogue.json'));
const pairs = []; (function walk(o, path) { if (!o || typeof o !== 'object') return; if (typeof o.zh === 'string' && typeof o.en === 'string') pairs.push([o.zh, o.en, path]); for (const k in o) walk(o[k], path + '.' + k); })(catalogue.items, 'items');

test('one word for one thing in Chinese: 毛线 (not 羊毛), Loop City (not 环城), 范例 (not 示例), 张量场 (not Tensor)', async () => {
  const shown = { wool: read('incubator/loop-city-wool/index.html'), step1: read('incubator/loop-city-mould-growth/index.html'), tensor: read('incubator/tensor-studio/index.html') + read('incubator/tensor-studio/app.js'),
    structure: read('incubator/structure-studio/index.html'), main: read('shared/i18n/zh.js'), modules: read('modules/03-wool-network/module.js') + read('modules/04-tensor-roads/module.js') };
  // 示例数据 (sample data, for a module's own preview page) is another thing and keeps its word
  for (const k in shown) for (const w of ['羊毛', '环城', '示例']) assert.ok(!shown[k].replace(/示例数据/g, '').includes(w), k + ' writes ' + w);
  const zh = (await import(new URL('shared/i18n/zh.js', root))).default;
  for (const k in zh) assert.ok(!/\b(Wool|Tensor)\b/.test(zh[k]), 'the main program, ' + k + ': ' + zh[k]);
  for (const [z, , path] of pairs) assert.ok(!/\b(Wool|Tensor)\b/.test(z) && !/羊毛|环城|示例/.test(z), 'catalogue ' + path + ': ' + z.slice(0, 60));
});

test('drainage is 排水网络 in the catalogue and in VR, as on the London map', () => {
  for (const [z, e, path] of pairs) if (/drainage/i.test(e)) assert.ok(!z.includes('汇水网络'), path);
  assert.ok(read('incubator/vr/src/xr_view.js').includes("drain: '排水网络'"));
});

test('Structure Studio in English: step 6 and the 3D viewport menu are translated', () => {
  const s = read('incubator/structure-studio/index.html'), i = s.indexOf('const EN = {'), EN = JSON.parse(s.slice(i + 'const EN = '.length, s.indexOf('\n', i)).replace(/;\s*$/, ''));
  const texts = html => html.replace(/<(kbd|output)[^>]*>[\s\S]*?<\/\1>/g, '').split(/<[^>]+>/).map(t => t.replace(/\s+/g, ' ').trim()).filter(t => HAN.test(t));
  const step6 = s.slice(s.indexOf('<li class="pmStep" data-k="6">'), s.indexOf('</ol>', s.indexOf('<li class="pmStep" data-k="6">')));
  const menu = s.slice(s.indexOf('<div id="vp">'), s.indexOf('<canvas id="axis"'));
  assert.ok(texts(step6).length >= 8 && texts(menu).length >= 25);
  for (const t of [...texts(step6), ...texts(menu)]) assert.ok(EN[t], 'no English for: ' + t.slice(0, 40));
  assert.ok(/const roots = \[[^\]]*\$\('vp'\)[^\]]*\$\('rszL'\), \$\('rszR'\)\]/.test(s), 'the menu and the two handles are among the parts that are translated');
  // step 1's note says in English all the Chinese says: the three kinds of attractor, and the 220 m
  const note = Object.keys(EN).find(k => k.startsWith('三种吸引点都来自张量场'));
  for (const w of ['main ones', 'secondary ones', 'on the edge', '220 m']) assert.ok(EN[note].includes(w), w);
});

test('Tensor Studio in Chinese: the opening film\'s headings and the tooltips', () => {
  const intro = read('incubator/tensor-studio/intro/intro.js'), html = read('incubator/tensor-studio/index.html');
  for (const [zh, en] of [['I · 问题', 'I · QUESTION'], ['II · 立场', 'II · POSITION'], ['III · 图层', 'III · LAYERS'], ['IV · 叠加', 'IV · SUPERPOSITION'], ['V · 读图', 'V · READING'], ['VI · 依据', 'VI · EVIDENCE'], ['张量场工作室 · 方法', 'TENSOR STUDIO · METHOD']])
    assert.ok(intro.includes("L('" + zh + "', '" + en + "')"), en);
  assert.ok(/intro\/intro\.js\?v=6/.test(html));
  const i = html.indexOf('window.TS_ATTR='), ATTR = JSON.parse(html.slice(i + 'window.TS_ATTR='.length, html.indexOf('\n', i)).replace(/;\s*$/, ''));
  for (const k of ['Collapse / expand', 'Drag to resize · double-click to reset', 'Drag to resize the control panel', 'Display', 'Palette', 'play', 'timeline']) assert.ok(HAN.test(ATTR[k] || ''), k);
  assert.ok(html.includes('title="Collapse / expand"') && html.includes("h.title = 'Drag to resize · double-click to reset'"), 'the words the table is keyed by');
  assert.ok(html.includes("e.textContent=TS_LANG==='zh'?e.dataset.zh:e.dataset.en);\n  TS_ATTRS();"), 'applied on every change of language');
});

test('the London map in Chinese: the paragraph on the site\'s streets is translated', async () => {
  const p = /<p>(Site streets \(Tensor Studio\):[\s\S]*?)<\/p>/.exec(read('incubator/google-map-live/index.html'))[1].replace(/\s+/g, ' ').trim();
  const { CHINESE_UI } = await import(new URL('incubator/google-map-live/scripts/ui_chinese_dictionary.js', root));
  assert.ok(HAN.test(CHINESE_UI[p] || ''));
});

test('the wool bands: 17 steps everywhere, the waiting screen in one language, nothing left of the former step 3', () => {
  const html = read('incubator/loop-city-wool/index.html'), ZH = zhDict('incubator/loop-city-wool/index.html', 'const ZH = {"local road (in the base map)"');
  assert.ok(read('incubator/loop-city-wool/explain.js').includes("T('Step ' + shown(k) + ' of 17', '第 ' + shown(k) + ' / 17 步')"));
  assert.ok(read('incubator/loop-city-wool/flow.js').includes("' / 17'"));
  assert.ok(pairs.find(p => p[2] === 'items.3.desc')[1].includes('17 steps'));
  assert.ok(/explain\.js\?v=[6-9]/.test(html));
  const wait = html.slice(html.indexOf('<div id="liveStart"'), html.indexOf('</div>\n</div>', html.indexOf('<div id="liveStart"')));
  assert.ok(!HAN.test(wait), 'the markup is English; the dictionary gives the Chinese');
  for (const a of [.../<a [^>]*>([^<]*)<\/a>/g[Symbol.matchAll](wait)].map(m => m[1])) assert.ok(HAN.test(ZH[a] || ''), 'no Chinese for the link: ' + a);
  assert.equal(ZH['Loop City · live'], 'Loop City · 实时');
  for (const k in ZH) assert.ok(!/base for the tensor field|base page did not/.test(k) && !ZH[k].includes('张量场底图'), k.slice(0, 50));
  assert.ok(html.includes("zh: '范例：C67 · P2 和相邻两个单元。") && !html.includes('四个单元'));
  assert.ok(!existsSync(new URL('incubator/loop-city-wool/previews', root)), 'the four old pictures are gone');
});

test('the browser tab is named in the language in use', () => {
  assert.ok(read('shared/i18n/index.js').includes("if (root.documentElement && DICTS[lang]['intro.title']) root.title = DICTS[lang]['intro.title'];"));
  assert.equal(zhDict('incubator/loop-city-wool/index.html', 'const ZH = {"local road (in the base map)"')['Loop City - wool'], 'Loop City · 毛线带');
  const m = read('incubator/loop-city-mould-growth/index.html'), ZH = zhDict('incubator/loop-city-mould-growth/index.html', 'const ZH = {"This run"');
  assert.ok(m.includes('document.title = "Loop City · 1 The whole loop: mould and growth";') && !m.includes('Loop City live v17 · the mould'));
  assert.equal(ZH['Loop City · 1 The whole loop: mould and growth'], 'Loop City · 1 整环：黏菌与生长');
  assert.equal(ZH.Collapse, '收起');
  assert.ok(read('incubator/vr/map.html').includes("if (l === 'en') { document.title = 'London map · VR';"));
});

test('the catalogue: the two languages say the same about Tensor Studio and Structure Studio', () => {
  const t = catalogue.items.find(i => i.id === 'tensor-studio'), s = JSON.stringify(catalogue.items.find(i => i.id === 'structure-studio'));
  assert.ok(t.desc.en.includes('three grades (main, through and local)') && t.desc.zh.includes('主干路 / 次干路 / 支路三级'));
  assert.ok(read('incubator/tensor-studio/index.html').includes('"three grades: main, through, local (a real city\'s)"'), 'the names Tensor Studio itself uses');
  assert.ok(!s.includes('第 8 步') && s.includes('张量场工作室的最终结果'));
});

test('the catalogue\'s first card says what the main program shows now, not the hidden road chain', async () => {
  // (26 Nov 2026) it described London → regions → wool → tensor → integration, but those five steps are hidden
  // (ROAD_CHAIN is false: 02–04 are placeholders); what shows is the London map and step 1's whole loop
  const w = catalogue.items[0], { ROAD_CHAIN } = await import(new URL('app/registry.js', root));
  assert.equal(w.id, 'workspace');
  if (!ROAD_CHAIN) {
    for (const l of ['zh', 'en']) assert.ok(!/区域划分|毛线|张量场|regions|Wool|Tensor|integration/i.test(w.desc[l]), l + ': ' + w.desc[l]);
    assert.ok(w.desc.zh.includes('第 1 步整环') && w.desc.en.includes('step 1\'s whole loop'));
    assert.deepEqual(w.tags.map(t => t.zh), ['伦敦全域', '黏菌', '整环']);
    assert.ok(read('README.md').includes('伦敦地图 → 第 1 步 整环：黏菌与生长 → 第 2 步 毛线带 → 张量场工作室 → 结构工作室 → VR'));
  }
});
