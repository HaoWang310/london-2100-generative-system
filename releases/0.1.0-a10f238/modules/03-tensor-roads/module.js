// 03 · Tensor roads — local streets inside one Wool local area.
//
// P0 PLACEHOLDER: a uniform (grid) or radial field whose streamlines are
// straight lines / rings, aligned to the parent Wool roads and snapped onto
// them so local streets connect to the primaries. P4 replaces field() and
// trace() with google-map-live's tensor field (hydro_tensor_*.js) kept in
// legacy/, using Wool roads, terrain, water and obstacles as constraints.

import { createBundle } from '../../shared/schemas/index.js?v=a10f238';
import {
  clipPolylineToPolygon, closestOnPolyline, centroid, bbox, polylineLength, dist
} from '../../shared/geo-core/index.js?v=a10f238';

const mod = {
  id: '03-tensor-roads',
  level: 'tensor',
  version: '0.1.0',
  placeholder: true,
  title: { zh: 'Tensor 张量场道路', en: 'Tensor roads' },
  description: {
    zh: '占位算法：网格 / 放射场流线，并吸附到上一级 Wool 主路。P4 将接入原有张量场算法。',
    en: 'Placeholder: grid / radial streamlines snapped to the parent Wool roads. P4 plugs in the existing tensor field.'
  },
  params: [
    { key: 'pattern', type: 'select', default: 'grid',
      options: [
        { value: 'grid', label: { zh: '网格', en: 'Grid' } },
        { value: 'radial', label: { zh: '环形 + 放射', en: 'Ring + radial' } }
      ],
      label: { zh: '空间组织', en: 'Pattern' } },
    { key: 'spacingM', type: 'range', min: 40, max: 300, step: 10, default: 110,
      label: { zh: '道路间距', en: 'Street spacing' }, unit: 'm' },
    { key: 'alignToParent', type: 'toggle', default: true,
      label: { zh: '对齐上级主路', en: 'Align to parent roads' } },
    { key: 'angle', type: 'range', min: 0, max: 90, step: 1, default: 0,
      label: { zh: '手动角度', en: 'Manual angle' }, unit: '°' },
    { key: 'snapM', type: 'range', min: 0, max: 200, step: 5, default: 60,
      label: { zh: '连接吸附距离', en: 'Connection snap' }, unit: 'm' }
  ],
  async run(input, params, ctx = {}) {
    const parentRoads = input.context?.parentRoads || [];
    const angle = params.alignToParent ? dominantAngle(input.boundary, parentRoads) ?? params.angle : params.angle;
    const lines = params.pattern === 'radial'
      ? radialLines(input.boundary, params.spacingM)
      : gridLines(input.boundary, params.spacingM, angle);
    let connections = 0;
    const roads = [];
    lines.forEach((l, i) => {
      for (const piece of clipPolylineToPolygon(l.coords, input.boundary, Math.min(10, params.spacingM / 6))) {
        if (polylineLength(piece) < params.spacingM * 0.3) continue;
        const snapped = snapEnds(piece, parentRoads, params.snapM);
        connections += snapped.connections;
        roads.push({ id: `t-${i}-${roads.length}`, hierarchy: l.major ? 'secondary' : 'local', coords: snapped.coords });
      }
    });
    ctx.onProgress?.(1);
    return createBundle({
      id: `tensor:${input.id}`,
      level: 'tensor',
      parentId: input.id,
      boundary: input.boundary,
      roads,
      context: { parentRoads },
      scenario: { ...params, resolvedAngle: angle },
      algorithm: { module: mod.id, id: `${params.pattern}-placeholder`, version: mod.version },
      stats: {
        roads: roads.length, connections,
        lengthKm: +(roads.reduce((s, r) => s + polylineLength(r.coords), 0) / 1000).toFixed(2)
      }
    });
  }
};

/** Direction (degrees, 0-180) of the longest parent road segment near the area. */
export function dominantAngle(boundary, parentRoads) {
  const c = centroid(boundary);
  const [x0, y0, x1, y1] = bbox(boundary);
  const reach = Math.hypot(x1 - x0, y1 - y0);
  let best = null, bestScore = 0;
  for (const r of parentRoads) {
    for (let i = 1; i < r.coords.length; i++) {
      const a = r.coords[i - 1], b = r.coords[i];
      const near = closestOnPolyline(c, [a, b]).d;
      if (near > reach) continue;
      const score = dist(a, b) / (1 + near / 100);
      if (score > bestScore) { bestScore = score; best = (Math.atan2(b[1] - a[1], b[0] - a[0]) * 180) / Math.PI; }
    }
  }
  return best === null ? null : ((best % 180) + 180) % 180;
}

export function gridLines(boundary, spacing, angleDeg) {
  const c = centroid(boundary);
  const [x0, y0, x1, y1] = bbox(boundary);
  const half = Math.hypot(x1 - x0, y1 - y0) / 2 + spacing;
  const lines = [];
  for (const offsetDeg of [0, 90]) {
    const a = ((angleDeg + offsetDeg) * Math.PI) / 180;
    const d = [Math.cos(a), Math.sin(a)], nrm = [-d[1], d[0]];
    const n = Math.ceil(half / spacing);
    for (let k = -n; k <= n; k++) {
      const o = [c[0] + nrm[0] * k * spacing, c[1] + nrm[1] * k * spacing];
      lines.push({ major: k % 3 === 0, coords: [[o[0] - d[0] * half, o[1] - d[1] * half], [o[0] + d[0] * half, o[1] + d[1] * half]] });
    }
  }
  return lines;
}

export function radialLines(boundary, spacing) {
  const c = centroid(boundary);
  const [x0, y0, x1, y1] = bbox(boundary);
  const half = Math.hypot(x1 - x0, y1 - y0) / 2;
  const lines = [];
  for (let r = spacing; r <= half; r += spacing) {
    const steps = Math.max(24, Math.round((2 * Math.PI * r) / 15));
    const ring = Array.from({ length: steps + 1 }, (_, i) => {
      const a = (i / steps) * Math.PI * 2;
      return [c[0] + r * Math.cos(a), c[1] + r * Math.sin(a)];
    });
    lines.push({ major: Math.round(r / spacing) % 3 === 0, coords: ring });
  }
  const rays = Math.max(6, Math.round((2 * Math.PI * half) / (spacing * 4)));
  for (let k = 0; k < rays; k++) {
    const a = (k / rays) * Math.PI * 2;
    lines.push({ major: k % 2 === 0, coords: [c, [c[0] + half * Math.cos(a), c[1] + half * Math.sin(a)]] });
  }
  return lines;
}

/** Extend line ends onto the nearest parent road within snap distance. */
export function snapEnds(coords, parentRoads, snap) {
  let connections = 0;
  const out = coords.slice();
  for (const atStart of [false, true]) {   // tail first, so unshift can't shift the tail index
    const end = atStart ? 0 : out.length - 1;
    let best = null;
    for (const r of parentRoads) {
      const h = closestOnPolyline(out[end], r.coords);
      if (h.d <= snap && (!best || h.d < best.d)) best = h;
    }
    if (best) {
      connections++;
      if (best.d > 0.01) atStart ? out.unshift(best.point) : out.push(best.point);
    }
  }
  return { coords: out, connections };
}

export default mod;
