import test from 'node:test';
import assert from 'node:assert/strict';
import mod, { integrate } from '../module.js';
import { validateModule, validateBundle, defaultParams, createBundle } from '../../../shared/schemas/index.js';

const box = [[0, 0], [1000, 0], [1000, 1000], [0, 1000]].map(([x, y]) => [530000 + x, 180000 + y]);
const P = (x, y) => [530000 + x, 180000 + y];

test('contract', () => assert.deepEqual(validateModule(mod), []));
test('snaps near endpoints, repairs a dead end and counts crossings', () => {
  const roads = [
    { id: 'a', hierarchy: 'primary', coords: [P(0, 500), P(1000, 500)] },
    { id: 'b', hierarchy: 'local', coords: [P(500, 0), P(500, 1000)] },     // crosses a
    { id: 'c', hierarchy: 'local', coords: [P(200, 500.5), P(200, 900)] },  // starts on a (snaps), dead end at 900
    { id: 'd', hierarchy: 'local', coords: [P(170, 920), P(300, 920)] }     // c's end is 20 m from d
  ];
  const r = integrate(roads, box, { snapM: 6, repairM: 40 });
  assert.equal(r.stats.crossings, 1);
  assert.ok(r.stats.repaired >= 1);
});
test('run returns a valid bundle', async () => {
  const input = createBundle({ id: 'w', level: 'wool', boundary: box, roads: [{ id: 'a', hierarchy: 'primary', coords: [P(0, 500), P(1000, 500)] }],
    algorithm: { module: 'test', version: '1.0.0' } });
  assert.deepEqual(validateBundle(await mod.run(input, defaultParams(mod))), []);
});
