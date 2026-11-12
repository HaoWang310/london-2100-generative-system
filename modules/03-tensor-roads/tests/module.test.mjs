import test from 'node:test';
import assert from 'node:assert/strict';
import mod, { dominantAngle } from '../module.js';
import { validateModule, validateBundle, defaultParams } from '../../../shared/schemas/index.js';
import { woolChildFixture } from '../../../shared/schemas/fixtures.js';

test('contract', () => assert.deepEqual(validateModule(mod), []));
test('grid streets connect to the parent Wool roads', async () => {
  const b = await mod.run(woolChildFixture(), defaultParams(mod));
  assert.deepEqual(validateBundle(b), []);
  assert.ok(b.roads.length > 10);
  assert.ok(b.stats.connections > 5, `${b.stats.connections} connections`);
});
test('radial pattern', async () => {
  const b = await mod.run(woolChildFixture(), { ...defaultParams(mod), pattern: 'radial' });
  assert.deepEqual(validateBundle(b), []);
  assert.ok(b.roads.length > 5);
});
test('aligns with parent road direction', () => {
  const f = woolChildFixture();
  const a = dominantAngle(f.boundary, f.context.parentRoads);
  assert.ok(a === 0 || a === 90, String(a));
});
