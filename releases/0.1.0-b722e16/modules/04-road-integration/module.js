// 04 · Road integration — merge all scales into one continuous network.
//
// Input: a ScaleBundle whose `roads` holds every road to integrate (the app
// gathers the Wool result plus all Tensor results under it). Output: the same
// roads with snapped endpoints, a topology graph (nodes/edges), repaired dead
// ends and a topology report. This is real topology code, not a placeholder;
// block (street-block) extraction is added in P5.

import { createBundle } from '../../shared/schemas/index.js?v=b722e16';
import {
  dist, segmentIntersection, closestOnPolyline, polylineLength, pointInPolygon
} from '../../shared/geo-core/index.js?v=b722e16';

const mod = {
  id: '04-road-integration',
  level: 'integration',
  version: '0.1.0',
  title: { zh: '路网整合', en: 'Road integration' },
  description: {
    zh: '端点吸附、交叉口识别、断头路修复与拓扑检查。',
    en: 'Endpoint snapping, junction detection, dead-end repair and topology checks.'
  },
  params: [
    { key: 'snapM', type: 'range', min: 0, max: 30, step: 1, default: 6,
      label: { zh: '端点合并距离', en: 'Endpoint merge' }, unit: 'm' },
    { key: 'repairM', type: 'range', min: 0, max: 200, step: 5, default: 40,
      label: { zh: '断头路修复距离', en: 'Dead-end repair' }, unit: 'm' }
  ],
  async run(input, params) {
    const report = integrate(input.roads, input.boundary, params);
    return createBundle({
      id: `integration:${input.id}`,
      level: 'integration',
      parentId: input.id,
      boundary: input.boundary,
      roads: report.roads,
      nodes: report.nodes,
      edges: report.edges,
      scenario: { ...params },
      algorithm: { module: mod.id, id: 'snap-repair-topology', version: mod.version },
      stats: report.stats
    });
  }
};

// Spatial hash over segments for near-linear intersection tests.
function segmentIndex(roads, cell) {
  const grid = new Map();
  const key = (x, y) => `${Math.floor(x / cell)},${Math.floor(y / cell)}`;
  roads.forEach((r, ri) => {
    for (let i = 1; i < r.coords.length; i++) {
      const a = r.coords[i - 1], b = r.coords[i];
      const x0 = Math.floor(Math.min(a[0], b[0]) / cell), x1 = Math.floor(Math.max(a[0], b[0]) / cell);
      const y0 = Math.floor(Math.min(a[1], b[1]) / cell), y1 = Math.floor(Math.max(a[1], b[1]) / cell);
      for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) {
        const k = `${x},${y}`;
        if (!grid.has(k)) grid.set(k, []);
        grid.get(k).push([ri, i]);
      }
    }
  });
  return { grid, key };
}

export function integrate(inputRoads, boundary, { snapM = 6, repairM = 40 } = {}) {
  const roads = inputRoads.map(r => ({ ...r, coords: r.coords.map(p => [p[0], p[1]]) }));

  // 1. Snap endpoints into shared nodes.
  const nodes = [];
  const nodeFor = p => {
    for (const n of nodes) if (dist(n.xy, p) <= snapM) return n;
    const n = { id: `n${nodes.length}`, xy: [p[0], p[1]], kind: 'end', degree: 0 };
    nodes.push(n); return n;
  };
  const edges = [];
  roads.forEach(r => {
    const a = nodeFor(r.coords[0]), b = nodeFor(r.coords[r.coords.length - 1]);
    r.coords[0] = a.xy; r.coords[r.coords.length - 1] = b.xy;
    a.degree++; b.degree++;
    edges.push({ id: `e-${r.id}`, from: a.id, to: b.id, roadId: r.id });
  });

  // 2. Repair dead ends: extend onto the nearest other road within repairM.
  //    Ends on the working boundary are open connections, not dead ends.
  const onBoundary = p => {
    let best = Infinity;
    for (let i = 0; i < boundary.length; i++) {
      const h = closestOnPolyline(p, [boundary[i], boundary[(i + 1) % boundary.length]]);
      best = Math.min(best, h.d);
    }
    return best <= Math.max(snapM, 15);
  };
  let repaired = 0;
  for (const n of nodes) {
    if (n.degree !== 1 || onBoundary(n.xy)) continue;
    let best = null;
    roads.forEach(r => {
      const own = edges.find(e => e.roadId === r.id && (e.from === n.id || e.to === n.id));
      if (own) return;
      const h = closestOnPolyline(n.xy, r.coords);
      if (h.d > 0 && h.d <= repairM && (!best || h.d < best.d)) best = h;
    });
    if (best) {
      const id = `repair-${repaired++}`;
      roads.push({ id, hierarchy: 'integrated', coords: [n.xy, best.point] });
      const m = nodeFor(best.point);
      m.degree++; n.degree++;
      edges.push({ id: `e-${id}`, from: n.id, to: m.id, roadId: id });
    }
  }

  // 3. Count crossings between roads (junctions not yet split into nodes).
  const { grid } = segmentIndex(roads, 200);
  const seen = new Set();
  let crossings = 0;
  for (const bucket of grid.values()) {
    for (let x = 0; x < bucket.length; x++) for (let y = x + 1; y < bucket.length; y++) {
      const [ra, ia] = bucket[x], [rb, ib] = bucket[y];
      if (ra === rb) continue;
      const k = ra < rb ? `${ra}:${ia}|${rb}:${ib}` : `${rb}:${ib}|${ra}:${ia}`;
      if (seen.has(k)) continue;
      seen.add(k);
      const A = roads[ra].coords, B = roads[rb].coords;
      if (segmentIntersection(A[ia - 1], A[ia], B[ib - 1], B[ib])) crossings++;
    }
  }

  for (const n of nodes) n.kind = n.degree >= 3 ? 'junction' : n.degree === 2 ? 'joint' : onBoundary(n.xy) ? 'gate' : 'dead-end';
  const deadEnds = nodes.filter(n => n.kind === 'dead-end').length;
  const outside = roads.filter(r => !r.coords.some(p => pointInPolygon(p, boundary))).length;

  return {
    roads,
    nodes: nodes.map(({ degree, ...n }) => ({ ...n, degree })),
    edges,
    stats: {
      roads: roads.length,
      nodes: nodes.length,
      junctions: nodes.filter(n => n.kind === 'junction').length,
      crossings,
      deadEnds,
      repaired,
      roadsOutside: outside,
      lengthKm: +(roads.reduce((s, r) => s + polylineLength(r.coords), 0) / 1000).toFixed(2)
    }
  };
}

export default mod;
