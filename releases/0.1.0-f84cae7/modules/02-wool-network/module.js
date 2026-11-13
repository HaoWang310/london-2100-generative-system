// 02 · Wool network — regional road skeleton inside one planning region.
//
// P0 PLACEHOLDER: radial spokes from the region centre, an inner ring, and the
// inherited region-link roads clipped to the region (so the network connects
// to neighbouring regions). P3 replaces skeleton() with google-map-live's Wool
// solver (parcel_wool_solver.js + global_warped_weave.js) kept in legacy/,
// adapted to take the region boundary, attractors and connection nodes.

import { createBundle } from '../../shared/schemas/index.js?v=f84cae7';
import {
  clipSegmentConvex, clipPolylineToPolygon, clipPolygonConvex,
  centroid, area, lerp, polylineLength
} from '../../shared/geo-core/index.js?v=f84cae7';

const mod = {
  id: '02-wool-network',
  level: 'wool',
  version: '0.1.0',
  placeholder: true,
  title: { zh: 'Wool 羊毛路网', en: 'Wool network' },
  description: {
    zh: '占位算法：放射主路 + 内环。P3 将接入原有 Wool 羊毛算法。',
    en: 'Placeholder: radial primaries + inner ring. P3 plugs in the existing Wool solver.'
  },
  params: [
    { key: 'spokes', type: 'range', min: 3, max: 12, step: 1, default: 6,
      label: { zh: '主路数量', en: 'Primary roads' } },
    { key: 'ringRatio', type: 'range', min: 0, max: 0.8, step: 0.05, default: 0.45,
      label: { zh: '内环位置', en: 'Ring position' } },
    { key: 'phase', type: 'range', min: 0, max: 60, step: 1, default: 15,
      label: { zh: '方向偏转', en: 'Orientation' }, unit: '°' },
    { key: 'localCellM', type: 'range', min: 600, max: 4000, step: 100, default: 2000,
      label: { zh: '局部区域尺度', en: 'Local area size' }, unit: 'm' }
  ],
  async run(input, params, ctx = {}) {
    const net = skeleton(input, params);
    ctx.onProgress?.(1);
    return createBundle({
      id: `wool:${input.id}`,
      level: 'wool',
      parentId: input.id,
      boundary: input.boundary,
      roads: net.roads,
      nodes: net.nodes,
      edges: net.edges,
      children: localAreas(input.boundary, net.centre, params.localCellM ?? 2000, input.id),
      scenario: { ...params },
      algorithm: { module: mod.id, id: 'radial-placeholder', version: mod.version },
      stats: {
        roads: net.roads.length,
        lengthKm: +(net.roads.reduce((s, r) => s + polylineLength(r.coords), 0) / 1000).toFixed(2)
      }
    });
  }
};

export function skeleton(input, { spokes = 6, ringRatio = 0.45, phase = 15 } = {}) {
  const ring = input.boundary;
  const centre = centroid(ring);
  const far = 1e6;
  const roads = [], nodes = [{ id: 'c', xy: centre, kind: 'centre' }], edges = [];
  const ringPts = [];
  for (let k = 0; k < spokes; k++) {
    const a = ((phase + (360 * k) / spokes) * Math.PI) / 180;
    const seg = clipSegmentConvex(centre, [centre[0] + far * Math.cos(a), centre[1] + far * Math.sin(a)], ring);
    if (!seg) continue;
    const end = seg[1];
    roads.push({ id: `spoke-${k}`, hierarchy: 'primary', coords: [centre, end] });
    nodes.push({ id: `gate-${k}`, xy: end, kind: 'gate' });
    edges.push({ id: `e-spoke-${k}`, from: 'c', to: `gate-${k}`, roadId: `spoke-${k}` });
    if (ringRatio > 0) ringPts.push({ k, xy: lerp(centre, end, ringRatio) });
  }
  if (ringPts.length >= 3) {
    ringPts.forEach((p, i) => {
      const q = ringPts[(i + 1) % ringPts.length];
      nodes.push({ id: `ring-${p.k}`, xy: p.xy, kind: 'junction' });
      roads.push({ id: `ring-${p.k}`, hierarchy: 'branch', coords: [p.xy, q.xy] });
    });
    ringPts.forEach((p, i) => {
      const q = ringPts[(i + 1) % ringPts.length];
      edges.push({ id: `e-ring-${p.k}`, from: `ring-${p.k}`, to: `ring-${q.k}`, roadId: `ring-${p.k}` });
    });
  }
  // Inherit higher-scale connections so this region joins its neighbours.
  (input.context?.parentRoads || []).forEach((r, i) => {
    clipPolylineToPolygon(r.coords, ring, 25).forEach((piece, j) => {
      if (polylineLength(piece) > 50) roads.push({ id: `inherit-${i}-${j}`, hierarchy: 'primary', coords: piece, inheritedFrom: r.id });
    });
  });
  return { centre, roads, nodes, edges };
}

export function localAreas(boundary, centre, cell, prefix = 'wool') {
  const out = [];
  let reach = 0;
  for (const p of boundary) reach = Math.max(reach, Math.abs(p[0] - centre[0]), Math.abs(p[1] - centre[1]));
  const n = Math.ceil(reach / cell);
  for (let i = -n; i < n; i++) for (let j = -n; j < n; j++) {
    const x = centre[0] + i * cell, y = centre[1] + j * cell;
    const ring = clipPolygonConvex([[x, y], [x + cell, y], [x + cell, y + cell], [x, y + cell]], boundary);
    if (ring.length && area(ring) > 0.25 * cell * cell) {
      out.push({ id: `${prefix}/local:${i + n}-${j + n}`, label: `L${out.length + 1}`, boundary: ring, centre: centroid(ring) });
    }
  }
  return out;
}

export default mod;
