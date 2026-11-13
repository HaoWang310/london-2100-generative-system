// Sample bundles so each module can be previewed and tested on its own,
// without importing any other module. Coordinates are real EPSG:27700
// positions around central London.

import { createBundle } from './index.js?v=4c7f92e';

const CENTRE = [530034, 180381]; // Charing Cross

function circle(c, r, n = 96) {
  return Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2;
    return [c[0] + r * Math.cos(a), c[1] + r * Math.sin(a)];
  });
}

export function londonFixture(radiusM = 70000) {
  return createBundle({
    id: 'london:study-area',
    level: 'london',
    boundary: circle(CENTRE, radiusM),
    context: { centre: CENTRE },
    algorithm: { module: 'fixture', id: 'london', version: '1.0.0' }
  });
}

/** A 15 km square region with one inherited region-link road crossing it. */
export function regionChildFixture() {
  const [e, n] = CENTRE, h = 7500;
  return createBundle({
    id: 'region:fixture',
    level: 'region',
    parentId: 'region:fixture-parent',
    boundary: [[e - h, n - h], [e + h, n - h], [e + h, n + h], [e - h, n + h]],
    context: {
      label: 'R-fixture',
      centre: [e, n],
      parentRoads: [{ id: 'link-a', hierarchy: 'region-link', coords: [[e - 20000, n - 3000], [e + 20000, n + 2000]] }]
    },
    algorithm: { module: 'fixture', id: 'region-child', version: '1.0.0' }
  });
}

/** A 1.2 km local area with Wool primary roads along two of its edges. */
export function woolChildFixture() {
  const [e, n] = CENTRE, h = 600;
  return createBundle({
    id: 'wool:fixture',
    level: 'wool',
    parentId: 'wool:fixture-parent',
    boundary: [[e - h, n - h], [e + h, n - h], [e + h, n + h], [e - h, n + h]],
    context: {
      label: 'L-fixture',
      centre: [e, n],
      parentRoads: [
        { id: 'p1', hierarchy: 'primary', coords: [[e - 3000, n - h], [e + 3000, n - h]] },
        { id: 'p2', hierarchy: 'primary', coords: [[e - h, n - 3000], [e - h, n + 3000]] }
      ]
    },
    algorithm: { module: 'fixture', id: 'wool-child', version: '1.0.0' }
  });
}
