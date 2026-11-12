import test from 'node:test';
import assert from 'node:assert/strict';
import mod from '../module.js';
import { validateModule, validateBundle, defaultParams } from '../../../shared/schemas/index.js';

test('contract', () => assert.deepEqual(validateModule(mod), []));
test('study circle is a valid EPSG:27700 bundle of ~15,400 km²', async () => {
  const b = await mod.run(null, defaultParams(mod));
  assert.deepEqual(validateBundle(b), []);
  assert.ok(Math.abs(b.stats.areaKm2 - Math.PI * 70 * 70) < 30, String(b.stats.areaKm2));
});
