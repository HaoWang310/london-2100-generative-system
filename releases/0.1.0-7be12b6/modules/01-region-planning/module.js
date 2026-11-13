// 01 · Region planning — divide the London study area into planning regions.
//
// P0 PLACEHOLDER: a rotated square grid clipped to the study area, with
// centre nodes and adjacency links. It produces a correct ScaleBundle so the
// whole pipeline can run. P2 replaces partition() with the weighted
// rainfall / terrain / catchment / flood-risk / connectivity algorithm while
// keeping the same output contract.

import { createBundle } from '../../shared/schemas/index.js?v=7be12b6';
import { clipPolygonConvex, centroid, area } from '../../shared/geo-core/index.js?v=7be12b6';

const mod = {
  id: '01-region-planning',
  level: 'region',
  version: '0.1.0',
  placeholder: true,
  title: { zh: '大区域划分', en: 'Region planning' },
  description: {
    zh: '占位算法：旋转网格划分。P2 将替换为降雨、地形、汇水、洪涝与连接度加权划分。',
    en: 'Placeholder: rotated grid partition. P2 replaces it with weighted rainfall, terrain, catchment, flood and connectivity zoning.'
  },
  params: [
    { key: 'cellKm', type: 'range', min: 8, max: 30, step: 1, default: 16,
      label: { zh: '区域尺度', en: 'Region size' }, unit: 'km' },
    { key: 'rotation', type: 'range', min: 0, max: 45, step: 1, default: 12,
      label: { zh: '网格旋转', en: 'Grid rotation' }, unit: '°' },
    { key: 'minCoverage', type: 'range', min: 0.1, max: 0.9, step: 0.05, default: 0.35,
      label: { zh: '最小覆盖率', en: 'Min. coverage' } }
  ],
  async run(input, params) {
    const { regions, links } = partition(input.boundary, input.context.centre, params);
    const nodes = regions.map(r => ({ id: `n-${r.key}`, xy: r.centre, kind: 'region-centre' }));
    const roads = links.map(([a, b]) => ({
      id: `link-${a.key}-${b.key}`, hierarchy: 'region-link', coords: [a.centre, b.centre]
    }));
    const edges = links.map(([a, b]) => ({ id: `e-${a.key}-${b.key}`, from: `n-${a.key}`, to: `n-${b.key}`, roadId: `link-${a.key}-${b.key}` }));
    return createBundle({
      id: `region:${input.id}`,
      level: 'region',
      parentId: input.id,
      boundary: input.boundary,
      roads, nodes, edges,
      children: regions.map((r, i) => ({
        id: `region:${r.key}`, label: `R${String(i + 1).padStart(2, '0')}`,
        boundary: r.ring, centre: r.centre
      })),
      scenario: { ...params },
      algorithm: { module: mod.id, id: 'grid-partition-placeholder', version: mod.version },
      stats: { regions: regions.length, links: links.length }
    });
  }
};

export function partition(boundary, centre, { cellKm = 16, rotation = 12, minCoverage = 0.35 } = {}) {
  const size = cellKm * 1000;
  const a = (rotation * Math.PI) / 180, cos = Math.cos(a), sin = Math.sin(a);
  const toWorld = ([u, v]) => [centre[0] + u * cos - v * sin, centre[1] + u * sin + v * cos];
  let reach = 0;
  for (const p of boundary) reach = Math.max(reach, Math.hypot(p[0] - centre[0], p[1] - centre[1]));
  const n = Math.ceil(reach / size) + 1;
  const regions = [];
  const byKey = new Map();
  for (let i = -n; i < n; i++) {
    for (let j = -n; j < n; j++) {
      const square = [[i, j], [i + 1, j], [i + 1, j + 1], [i, j + 1]].map(([u, v]) => toWorld([u * size, v * size]));
      const ring = clipPolygonConvex(square, boundary);
      if (!ring.length || area(ring) < minCoverage * size * size) continue;
      const r = { key: `${i + n}-${j + n}`, i, j, ring, centre: centroid(ring) };
      regions.push(r); byKey.set(`${i},${j}`, r);
    }
  }
  const links = [];
  for (const r of regions) {
    for (const [di, dj] of [[1, 0], [0, 1]]) {
      const nb = byKey.get(`${r.i + di},${r.j + dj}`);
      if (nb) links.push([r, nb]);
    }
  }
  return { regions, links };
}

export default mod;
