import test from 'node:test';
import assert from 'node:assert/strict';
import { createBundle, validateBundle, childInput } from '../schemas/index.js';
import { londonFixture } from '../schemas/fixtures.js';
import { createWorkspaceStore } from '../state/index.js';

test('fixtures are valid bundles', () => {
  assert.deepEqual(validateBundle(londonFixture()), []);
});

test('validator catches lon/lat passed instead of EPSG:27700', () => {
  const b = createBundle({ id: 'x', level: 'region', boundary: [[-0.1, 51.5], [-0.09, 51.5], [-0.09, 51.51]],
    algorithm: { module: 'm', version: '1' } });
  assert.ok(validateBundle(b).some(e => e.includes('EPSG:27700')));
});

test('childInput carries parent roads as constraints', () => {
  const parent = createBundle({ ...londonFixture(), level: 'region', roads: [{ id: 'r', hierarchy: 'region-link', coords: [[530000, 180000], [531000, 180000]] }],
    children: [{ id: 'c1', label: 'C1', boundary: [[530000, 180000], [531000, 180000], [531000, 181000]], centre: [530600, 180300] }] });
  const input = childInput(parent, 'c1');
  assert.equal(input.parentId, parent.id);
  assert.equal(input.context.parentRoads.length, 1);
});

function memoryStorage() { const m = new Map(); return { getItem: k => m.get(k) ?? null, setItem: (k, v) => m.set(k, v) }; }

test('navigating up and down keeps every level\'s params and results', () => {
  const storage = memoryStorage();
  const s = createWorkspaceStore({ storage });
  s.enter('london', null, { radiusKm: 70 });
  s.setResult('london', 'root', londonFixture());
  s.enter('region', { id: 'london:study-area' }, { cellKm: 16 });
  s.setParams('region', 'london:study-area', { cellKm: 20 });
  s.back();
  assert.equal(s.current().level, 'london');
  assert.ok(s.current().result, 'london result kept');
  s.enter('region', { id: 'london:study-area' }, { cellKm: 16 });
  assert.equal(s.current().params.cellKm, 20, 'region params restored, not reset to defaults');

  const restored = createWorkspaceStore({ storage });
  assert.equal(restored.current().level, 'region', 'state survives a page reload');
});

test('regenerating a parent marks children stale instead of deleting them', () => {
  const s = createWorkspaceStore();
  s.enter('region', { id: 'L' });
  const r1 = { ...londonFixture(), level: 'region', createdAt: 't1', children: [{ id: 'c1', boundary: [], centre: [0, 0] }] };
  s.setResult('region', 'L', r1);
  s.enter('wool', { id: 'c1' }, {}, 't1');
  s.setResult('wool', 'c1', { ...londonFixture(), createdAt: 'w1', children: [] });
  s.back();
  s.setResult('region', 'L', { ...r1, createdAt: 't2' });
  const child = s.entry('wool', 'c1');
  assert.ok(child.result, 'child result still there');
  assert.equal(child.stale, true);
});
