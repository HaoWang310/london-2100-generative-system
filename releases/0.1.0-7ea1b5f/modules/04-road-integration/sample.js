// Sample input for the standalone preview: fixture roads plus a few
// deliberately imperfect streets (near-miss ends, a dead end) to repair.
import { createBundle } from '../../shared/schemas/index.js?v=7ea1b5f';
export { woolChildFixture } from '../../shared/schemas/fixtures.js?v=7ea1b5f';

export function createBundleWithRoads(f) {
  const [e, n] = f.context.centre;
  const roads = [
    ...f.context.parentRoads,
    { id: 's1', hierarchy: 'local', coords: [[e - 597, n - 200], [e + 600, n - 200]] },
    { id: 's2', hierarchy: 'local', coords: [[e - 100, n - 603], [e - 100, n + 420]] },
    { id: 's3', hierarchy: 'local', coords: [[e + 200, n - 596], [e + 200, n + 300]] },
    { id: 's4', hierarchy: 'secondary', coords: [[e - 600, n + 330], [e + 180, n + 330]] }
  ];
  return createBundle({ ...f, id: 'integration-sample', roads });
}
