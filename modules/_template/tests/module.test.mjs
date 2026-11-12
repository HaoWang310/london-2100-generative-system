import test from 'node:test';
import assert from 'node:assert/strict';
import mod from '../module.js';
import { validateModule, validateBundle, defaultParams } from '../../../shared/schemas/index.js';
import { woolChildFixture } from '../../../shared/schemas/fixtures.js';

test('contract', () => assert.deepEqual(validateModule(mod), []));
test('returns a valid bundle', async () => {
  assert.deepEqual(validateBundle(await mod.run(woolChildFixture(), defaultParams(mod))), []);
});
