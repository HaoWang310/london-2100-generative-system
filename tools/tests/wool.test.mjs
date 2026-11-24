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
