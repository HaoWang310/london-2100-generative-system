// incubator/catalogue.json lists every incubator app, and the main app
// (app/catalogue.js) reads it. These checks stop a broken entry from reaching main.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const STATUS = ['ready', 'incubating', 'planned'];

let catalogue, parseError;
try { catalogue = JSON.parse(readFileSync(join(ROOT, 'incubator/catalogue.json'), 'utf8')); }
catch (e) { parseError = e; }
const items = catalogue?.items ?? [];

test('catalogue.json is valid JSON with an items list', () => {
  assert.equal(parseError, undefined, `incubator/catalogue.json does not parse: ${parseError?.message}`);
  assert.ok(Array.isArray(catalogue.items), '"items" must be an array');
  assert.ok(items.length > 0, '"items" is empty');
});

test('the workspace entry (main program) is still listed', () => {
  const ws = items.find(i => i.id === 'workspace');
  assert.ok(ws, 'the "workspace" entry was removed');
  assert.equal(ws.href, '#workspace');
});

test('ids are unique', () => {
  const ids = items.map(i => i.id);
  const dup = ids.filter((id, k) => ids.indexOf(id) !== k);
  assert.deepEqual(dup, [], `duplicate ids: ${dup.join(', ')}`);
});

for (const item of items) {
  test(`entry "${item.id}" is complete and points at real files`, () => {
    assert.match(String(item.id ?? ''), /^[a-z0-9][a-z0-9-]*$/, 'id must be lower-case letters, digits and dashes');
    assert.equal(typeof item.href, 'string', 'href missing');
    for (const k of ['zh', 'en']) {
      assert.equal(typeof item.title?.[k], 'string', `title.${k} missing`);
      assert.ok(item.title[k].trim(), `title.${k} is empty`);
    }
    // the phone's bar shows "short" when there is one: both languages, and short (about as long as "Tensor Studio")
    if (item.short !== undefined) for (const k of ['zh', 'en']) {
      assert.equal(typeof item.short?.[k], 'string', `short.${k} missing`);
      assert.ok(item.short[k].trim(), `short.${k} is empty`);
      assert.ok([...item.short[k]].length <= 18, `short.${k} "${item.short[k]}" is longer than 18 characters`);
    }
    assert.ok(STATUS.includes(item.status), `status must be one of ${STATUS.join(', ')}`);
    if (item.desc !== undefined) for (const k of ['zh', 'en'])
      assert.equal(typeof item.desc[k], 'string', `desc.${k} must be text`);
    if (item.tags !== undefined) {
      assert.ok(Array.isArray(item.tags), 'tags must be a list');
      for (const tag of item.tags) assert.ok(typeof tag?.zh === 'string' && typeof tag?.en === 'string', 'each tag needs zh and en');
    }
    if (/^(\.\/)?incubator\//.test(item.href)) {
      const dir = item.href.replace(/^\.\//, '');
      assert.ok(existsSync(join(ROOT, dir, 'index.html')), `${dir}index.html does not exist`);
    }
    // a cover is one path, or { zh, en } like the title (one image per language)
    if (item.cover){ const covers = typeof item.cover === 'string' ? [item.cover] : Object.values(item.cover);
      assert.ok(covers.length && covers.every(c => typeof c === 'string'), `cover of ${item.id} must be a path or { zh, en }`);
      for (const c of covers) assert.ok(existsSync(join(ROOT, c)), `cover ${c} does not exist`); }
    if (item.embed?.hide !== undefined) assert.ok(Array.isArray(item.embed.hide), 'embed.hide must be a list');
  });
}
