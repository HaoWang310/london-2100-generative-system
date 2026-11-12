import test from 'node:test';
import assert from 'node:assert/strict';
import mod from '../module.js';
import { validateModule, validateBundle, defaultParams } from '../../../shared/schemas/index.js';
import { londonFixture } from '../../../shared/schemas/fixtures.js';
import { pointInPolygon } from '../../../shared/geo-core/index.js';

test('contract', () => assert.deepEqual(validateModule(mod), []));
test('regions cover the study area with unique ids and links between neighbours', async () => {
  const input = londonFixture();
  const b = await mod.run(input, defaultParams(mod));
  assert.deepEqual(validateBundle(b), []);
  assert.ok(b.children.length > 30, `${b.children.length} regions`);
  assert.ok(b.roads.length > b.children.length, 'adjacency links');
  for (const c of b.children) assert.ok(pointInPolygon(c.centre, input.boundary));
});
test('larger cells -> fewer regions', async () => {
  const small = await mod.run(londonFixture(), { ...defaultParams(mod), cellKm: 10 });
  const large = await mod.run(londonFixture(), { ...defaultParams(mod), cellKm: 25 });
  assert.ok(small.children.length > large.children.length);
});
