// One language for every app (shared/ui/lang.js, 26 Nov 2026): node --test tools/tests/lang.test.mjs
// The home page, the whole system and VR keep the language in localStorage 'l2100.lang'. Each incubator app has a key
// of its own; the script gives the app the shared language before it starts, takes the app's own change back to the
// shared place, and presses the app's own button when the shared language changes in another tab.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const root = new URL('../../', import.meta.url), read = p => readFileSync(new URL(p, root), 'utf8');
const SRC = read('shared/ui/lang.js');

// a page with the script on it: its storage, the device's language, the app's own key and button
function page({ stored = {}, device = 'en-GB', key = 'app.lang', button = '#sw button[data-l="{lang}"]', onClick, htmlLang } = {}) {
  const store = new Map(Object.entries(stored)), on = {}, clicks = [];
  const win = { navigator: { languages: [device], language: device },
    localStorage: { getItem: k => (store.has(k) ? store.get(k) : null), setItem: (k, v) => { store.set(k, String(v)); } },
    setInterval() {}, setTimeout(f) { f(); }, addEventListener(t, f) { on[t] = f; } };
  // the app as the script sees it: <html lang> follows the app's language, and its button changes both
  const document = { currentScript: { getAttribute: n => (n === 'data-key' ? key : n === 'data-button' ? button : null) }, addEventListener() {}, readyState: 'complete',
    documentElement: { lang: htmlLang || '' },
    querySelector(sel) { return { click() { clicks.push(sel); document.documentElement.lang = /zh/.test(sel) ? 'zh-CN' : 'en'; if (onClick) onClick(sel, store); } }; } };
  win.window = win; win.document = document; vm.runInNewContext(SRC, win);
  return { store, clicks, document, L: win.L2Lang, storage: (k, v) => on.storage && on.storage({ key: k, newValue: v }) };
}

test('nothing chosen anywhere: the app starts in the device’s language, and nothing is written as a choice', () => {
  const zh = page({ device: 'zh-CN' }); assert.equal(zh.store.get('app.lang'), 'zh'); assert.equal(zh.store.has('l2100.lang'), false);
  const hk = page({ device: 'zh-Hant-HK' }); assert.equal(hk.store.get('app.lang'), 'zh');
  const en = page({ device: 'en-GB' }); assert.equal(en.store.get('app.lang'), 'en');
  const fr = page({ device: 'fr-FR' }); assert.equal(fr.store.get('app.lang'), 'en', 'every other language is English, as in shared/i18n');
});

test('the shared language wins over what the app kept for itself and over the device', () => {
  const p = page({ stored: { 'l2100.lang': 'zh', 'app.lang': 'en' }, device: 'en-GB' }); assert.equal(p.store.get('app.lang'), 'zh');
  const q = page({ stored: { 'l2100.lang': 'en', 'app.lang': 'zh' }, device: 'zh-CN' }); assert.equal(q.store.get('app.lang'), 'en');
  const odd = page({ stored: { 'l2100.lang': 'de' }, device: 'zh-CN' }); assert.equal(odd.store.get('app.lang'), 'zh', 'a value that is not ours is as good as none');
});

test('a language chosen in the app becomes the shared one', () => {
  const p = page({ stored: { 'l2100.lang': 'en' } });
  p.store.set('app.lang', 'zh'); p.L.check(); assert.equal(p.store.get('l2100.lang'), 'zh');
  p.store.set('app.lang', 'en'); p.L.check(); assert.equal(p.store.get('l2100.lang'), 'en');
  const first = page({ device: 'en-GB' }); first.store.set('app.lang', 'zh'); first.L.check(); assert.equal(first.store.get('l2100.lang'), 'zh', 'the first choice anywhere is kept for all');
});

test('a change made in another tab presses the app’s own button, once, and is not taken for a new choice', () => {
  const p = page({ stored: { 'l2100.lang': 'en' }, htmlLang: 'en', onClick: (sel, store) => store.set('app.lang', /zh/.test(sel) ? 'zh' : 'en') });
  p.store.set('l2100.lang', 'zh'); p.storage('l2100.lang', 'zh');
  assert.deepEqual(p.clicks, ['#sw button[data-l="zh"]']); assert.equal(p.store.get('app.lang'), 'zh');
  p.L.check(); assert.equal(p.store.get('l2100.lang'), 'zh');
  p.storage('l2100.lang', 'zh'); assert.equal(p.clicks.length, 1, 'already in that language: nothing is pressed');
  p.storage('some.other.key', 'en'); p.storage('l2100.lang', 'de'); assert.equal(p.clicks.length, 1);
});

test('two apps on one key (the mould and the wool): the page that did not write the key still changes', () => {
  // the other tab has followed first and written the key they share; this page still shows English
  const p = page({ stored: { 'l2100.lang': 'en' }, htmlLang: 'en' });
  p.store.set('l2100.lang', 'zh'); p.store.set('app.lang', 'zh'); p.storage('l2100.lang', 'zh');
  assert.deepEqual(p.clicks, ['#sw button[data-l="zh"]'], 'what the page shows decides, not the key');
  // and if the notice is missed altogether, the next look puts it right
  const q = page({ stored: { 'l2100.lang': 'en' }, htmlLang: 'en' });
  q.store.set('l2100.lang', 'zh'); q.store.set('app.lang', 'zh'); q.L.check(); assert.equal(q.clicks.length, 1); assert.equal(q.document.documentElement.lang, 'zh-CN');
  q.L.check(); assert.equal(q.clicks.length, 1, 'once it shows the language, nothing more is pressed');
});

test('every catalogue app with a language of its own loads the script first, with the catalogue’s own key and button', () => {
  const items = JSON.parse(read('incubator/catalogue.json')).items.filter(i => i.embed && i.embed.langStorageKey);
  assert.deepEqual(items.map(i => i.id), ['google-map-live', 'loop-city-mould-growth', 'loop-city-wool', 'tensor-studio', 'structure-studio']);
  for (const it of items) { const html = read(it.href + 'index.html');
    const m = /<script src="\.\.\/\.\.\/shared\/ui\/lang\.js\?v=\d+" data-key="([^"]+)" data-button='([^']+)'><\/script>/.exec(html); assert.ok(m, it.id + ': the script line');
    assert.equal(m[1], it.embed.langStorageKey, it.id + ': the key'); assert.equal(m[2], it.embed.langButton, it.id + ': the button');
    assert.ok(html.slice(0, m.index).indexOf('<script') < 0, it.id + ': it is the first script of the page, so the app reads its key after it'); }
});

test('the home page follows a change made in an app’s own tab, and VR reads the same place', () => {
  const i18n = read('shared/i18n/index.js');
  assert.ok(i18n.includes("const STORAGE_KEY = 'l2100.lang'")); assert.ok(i18n.includes("addEventListener('storage', e => { if (e.key === STORAGE_KEY && DICTS[e.newValue]) setLang(e.newValue); })"));
  assert.ok(SRC.includes("var SHARED = 'l2100.lang'"));
  for (const p of ['incubator/vr/index.html', 'incubator/vr/map.html']) assert.ok(read(p).includes("localStorage.getItem('l2100.lang')"), p);
});
