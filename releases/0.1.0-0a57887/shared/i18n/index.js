// Chinese / English switching. Default language: the device's — Chinese when its system language is Chinese (any
// variety), English for every other; once 中文 / EN is pressed, that choice is kept on the device and wins.
// Static text: <span data-i18n="key"></span>, attributes: data-i18n-title="key".
// Module texts use {zh, en} objects resolved with pick().

import { zh } from './zh.js?v=0a57887';
import { en } from './en.js?v=0a57887';

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
  root.querySelectorAll('[data-i18n]').forEach(el => { el.textContent = t(el.dataset.i18n); });
  root.querySelectorAll('[data-i18n-title]').forEach(el => { el.title = t(el.dataset.i18nTitle); });
  root.querySelectorAll('[data-i18n-placeholder]').forEach(el => { el.placeholder = t(el.dataset.i18nPlaceholder); });
}

export const dictionaries = DICTS;
