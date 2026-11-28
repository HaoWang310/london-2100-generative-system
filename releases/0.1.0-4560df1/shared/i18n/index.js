// Chinese / English switching. Default language: the device's — Chinese when its system language is Chinese (any
// variety), English for every other; once 中文 / EN is pressed, that choice is kept on the device and wins.
// The choice is the one language of the whole site: every incubator app reads and writes it too (shared/ui/lang.js).
// Static text: <span data-i18n="key"></span>, attributes: data-i18n-title="key", data-i18n-aria="key" (the spoken name).
// Module texts use {zh, en} objects resolved with pick().

import { zh } from './zh.js?v=4560df1';
import { en } from './en.js?v=4560df1';

const DICTS = { zh, en };
const STORAGE_KEY = 'l2100.lang';
const listeners = new Set();

function readStored() {
  try { return globalThis.localStorage?.getItem(STORAGE_KEY); } catch { return null; }
}

/** The device's system language as one of ours: zh for any Chinese, else en. Outside a browser (tests): zh. */
export function systemLang() {
  if (typeof document === 'undefined') return 'zh';
  const list = globalThis.navigator?.languages?.length ? navigator.languages : [globalThis.navigator?.language || ''];
  return /^zh\b/i.test(list[0] || '') ? 'zh' : 'en';
}

let lang = DICTS[readStored()] ? readStored() : systemLang();

export const getLang = () => lang;

export function setLang(next) {
  if (!DICTS[next] || next === lang) return;
  lang = next;
  try { globalThis.localStorage?.setItem(STORAGE_KEY, lang); } catch { /* private mode */ }
  if (globalThis.document) applyI18n(document);
  for (const fn of listeners) fn(lang);
}

export const toggleLang = () => setLang(lang === 'zh' ? 'en' : 'zh');

// (26 Nov 2026) one language for every app: an incubator app opened in its own tab writes its choice to the same place
// (shared/ui/lang.js). When that happens while this page is open, it follows at once.
if (typeof globalThis.addEventListener === 'function' && typeof document !== 'undefined') {
  globalThis.addEventListener('storage', e => { if (e.key === STORAGE_KEY && DICTS[e.newValue]) setLang(e.newValue); });
}
export const onLangChange = fn => (listeners.add(fn), () => listeners.delete(fn));

/** Translate a key; {name} placeholders are filled from vars. Falls back to English, then the key. */
export function t(key, vars = {}) {
  const s = DICTS[lang][key] ?? DICTS.en[key] ?? key;
  return s.replace(/\{(\w+)\}/g, (_, k) => (k in vars ? vars[k] : `{${k}}`));
}

/** Resolve a {zh, en} object (or plain string) for the current language. */
export const pick = obj => (obj && typeof obj === 'object' ? obj[lang] ?? obj.en ?? obj.zh : obj ?? '');

export function applyI18n(root) {
  root.documentElement && (root.documentElement.lang = lang === 'zh' ? 'zh-CN' : 'en');
  if (root.documentElement && DICTS[lang]['intro.title']) root.title = DICTS[lang]['intro.title'];      // (26 Nov 2026) the tab's name follows the language: it stayed Chinese in English
  root.querySelectorAll('[data-i18n]').forEach(el => { el.textContent = t(el.dataset.i18n); });
  root.querySelectorAll('[data-i18n-title]').forEach(el => { el.title = t(el.dataset.i18nTitle); });
  root.querySelectorAll('[data-i18n-placeholder]').forEach(el => { el.placeholder = t(el.dataset.i18nPlaceholder); });
  root.querySelectorAll('[data-i18n-aria]').forEach(el => { el.setAttribute('aria-label', t(el.dataset.i18nAria)); });
}

export const dictionaries = DICTS;
