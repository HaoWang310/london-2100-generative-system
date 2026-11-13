import test from 'node:test';
import assert from 'node:assert/strict';
import { zh } from '../i18n/zh.js';
import { en } from '../i18n/en.js';

test('Chinese and English dictionaries have the same keys', () => {
  assert.deepEqual(Object.keys(zh).sort(), Object.keys(en).sort());
});

import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

test('every literal t("key") used by the app exists in both dictionaries', () => {
  const root = fileURLToPath(new URL('../../', import.meta.url));
  const files = ['app/main.js', 'app/updates.js', 'app/intro.js', 'shared/ui/index.js', 'shared/ui/preview.js']
    .filter(f => { try { readFileSync(root + f); return true; } catch { return false; } });
  const missing = [];
  for (const f of files) {
    for (const m of readFileSync(root + f, 'utf8').matchAll(/\bt\('([\w.-]+)'/g)) {
      if (!(m[1] in zh) || !(m[1] in en)) missing.push(`${f}: ${m[1]}`);
    }
  }
  assert.deepEqual(missing, []);
});
