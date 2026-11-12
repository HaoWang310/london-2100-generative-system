import test from 'node:test';
import assert from 'node:assert/strict';
import mod, { toGeoJSON, toBNGGeoJSON } from '../module.js';
import { validateModule } from '../../../shared/schemas/index.js';
import { woolChildFixture } from '../../../shared/schemas/fixtures.js';

test('contract', () => assert.deepEqual(validateModule(mod), []));
test('GeoJSON is in lon/lat around London; BNG copy keeps metres', () => {
  const f = woolChildFixture();
  const g = toGeoJSON([f]);
  const [lon, lat] = g.features[0].geometry.coordinates[0][0];
  assert.ok(lon > -1 && lon < 1 && lat > 51 && lat < 52, `${lon},${lat}`);
  const b = toBNGGeoJSON([f]);
  assert.ok(b.features[0].geometry.coordinates[0][0][0] > 500000);
});
