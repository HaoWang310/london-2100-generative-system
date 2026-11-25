// The wool page (incubator/loop-city-wool) keeps its site inputs beside it (site/) and the example's step 1 ready
// made (example/). Both carry a fingerprint of what they were made from; these checks fail when one went out of date.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const DIR = fileURLToPath(new URL('../../incubator/loop-city-wool/', import.meta.url));
const page = readFileSync(join(DIR, 'index.html'), 'utf8');
const siteLine = page.split('\n').find(l => l.startsWith('<script>const SITE = '));
const SITE = siteLine ? JSON.parse(siteLine.slice('<script>const SITE = '.length, -1)) : null;

test('the wool page no longer carries the site data in it', () => {
  assert.ok(SITE, 'the SITE line is missing');
  assert.ok(page.length < 3e6, `index.html is ${(page.length / 1e6).toFixed(1)} MB; the site data belongs in site/`);
});

test('SITE.v is the fingerprint of the files in site/', () => {
  const files = ['site/alc.png', 'site/vectors.js', ...readdirSync(join(DIR, 'site/ground')).map(f => 'site/ground/' + f)].sort();
  const h = createHash('sha256');
  for (const f of files) h.update(Buffer.concat([Buffer.from(f), Buffer.from([0]), createHash('sha256').update(readFileSync(join(DIR, f))).digest()]));
  assert.equal(SITE.v, h.digest('hex').slice(0, 12), 'site/ changed: set SITE.v in index.html to the new fingerprint');
  for (const name of SITE.ground) assert.ok(existsSync(join(DIR, 'site/ground', name + '.png')), `ground tile ${name} is missing`);
  assert.equal(SITE.ground.length, files.length - 2, 'site/ground has tiles SITE.ground does not list');
});

// the same hash the page takes (fnv-1a over the text's UTF-16 code units, base 36)
const fnv = s => { let x = 2166136261; for (let i = 0; i < s.length; i++) { x ^= s.charCodeAt(i); x = Math.imul(x, 16777619); } return (x >>> 0).toString(36); };

test('example/ was made from this page, this site and this example (else run source/make-example.cjs)', async () => {
  const j = JSON.parse(readFileSync(join(DIR, 'example/step1.json'), 'utf8'));
  // the bake's script: the <script> that starts with the SITE line, as the browser reads its text
  const a = page.indexOf('<script>const SITE = ') + '<script>'.length, b = page.indexOf('</script>', a);
  assert.equal(j.guard.bake, fnv(page.slice(a, b)), 'the bake or the site changed: example/ is out of date');
  const { runInNewContext } = await import('node:vm');
  const ctx = { window: {} }; runInNewContext(readFileSync(join(DIR, 'sample-cells.js'), 'utf8'), ctx);
  const pkg = ctx.window.__PKG_INLINE__;
  assert.ok(pkg, 'sample-cells.js did not set window.__PKG_INLINE__');
  assert.equal(j.guard.pkg, fnv(JSON.stringify(pkg)), 'the example (sample-cells.js) changed: example/ is out of date');
  for (const f of Object.values(j.img)) assert.ok(existsSync(join(DIR, 'example', f)), `example/${f} is missing`);
});

test('the page asks early for the example files that example/ holds (EXV)', () => {
  const j = JSON.parse(readFileSync(join(DIR, 'example/step1.json'), 'utf8'));
  const m = /\/\*EXV\*\/'([^':]*):([^']*)'\/\*EXV\*\//.exec(page);
  assert.ok(m, 'EXV is missing from index.html');
  assert.equal(m[1], j.guard.bake, 'EXV names another bake than example/step1.json: run source/make-example.cjs');
  assert.deepEqual(m[2].split(','), ['step1.json', ...Object.values(j.img)]);
});
