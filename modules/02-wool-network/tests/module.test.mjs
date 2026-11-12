import test from 'node:test';
import assert from 'node:assert/strict';
import mod from '../module.js';
import { validateModule, validateBundle, defaultParams } from '../../../shared/schemas/index.js';
import { regionChildFixture } from '../../../shared/schemas/fixtures.js';

test('contract', () => assert.deepEqual(validateModule(mod), []));
test('produces primaries, inherits region links, and unique local areas', async () => {
  const input = regionChildFixture();
  const b = await mod.run(input, defaultParams(mod));
  assert.deepEqual(validateBundle(b), []);
  assert.equal(b.roads.filter(r => r.id.startsWith('spoke-')).length, 6);
  assert.ok(b.roads.some(r => r.inheritedFrom === 'link-a'), 'region link continues through the region');
  assert.ok(b.children.length >= 9);
  assert.ok(b.children.every(c => c.id.startsWith(input.id + '/')), 'child ids are namespaced by region');
});
