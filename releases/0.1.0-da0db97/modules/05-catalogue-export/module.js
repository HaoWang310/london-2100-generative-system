// 05 · Catalogue & export — package results for GIS / Rhino / archive.
//
// toGeoJSON(): WGS84 GeoJSON (for QGIS, Google Earth, web maps), with the
// original EPSG:27700 coordinates kept in each feature's properties.bng.
// toBNGGeoJSON(): the same features in EPSG:27700 metres (for Rhino / CAD).
// The run() contract returns a catalogue summary bundle.

import { createBundle } from '../../shared/schemas/index.js?v=da0db97';
import { toWGS84 } from '../../shared/geo-core/index.js?v=da0db97';

const mod = {
  id: '05-catalogue-export',
  level: 'integration',
  version: '0.1.0',
  title: { zh: '方案目录与导出', en: 'Catalogue & export' },
  description: {
    zh: '导出 GeoJSON（WGS84 / EPSG:27700）与完整工作空间文件。',
    en: 'Export GeoJSON (WGS84 / EPSG:27700) and the full workspace file.'
  },
  params: [
    { key: 'crs', type: 'select', default: 'wgs84',
      options: [
        { value: 'wgs84', label: { zh: 'WGS84 经纬度', en: 'WGS84 lon/lat' } },
        { value: 'bng', label: { zh: 'EPSG:27700 米', en: 'EPSG:27700 metres' } }
      ],
      label: { zh: '坐标系', en: 'Coordinates' } }
  ],
  async run(input, params) {
    const geo = params.crs === 'bng' ? toBNGGeoJSON([input]) : toGeoJSON([input]);
    return createBundle({
      ...input,
      id: `export:${input.id}`,
      level: 'integration',
      parentId: input.id,
      scenario: { ...params },
      algorithm: { module: mod.id, id: 'geojson', version: mod.version },
      stats: { features: geo.features.length }
    });
  }
};

function features(bundles, project) {
  const out = [];
  for (const b of bundles) {
    const meta = { bundle: b.id, level: b.level, algorithm: `${b.algorithm.module}@${b.algorithm.version}` };
    const ring = b.boundary.concat([b.boundary[0]]);
    out.push({ type: 'Feature', properties: { ...meta, kind: 'boundary' },
      geometry: { type: 'Polygon', coordinates: [ring.map(project)] } });
    for (const r of b.roads || []) {
      out.push({ type: 'Feature', properties: { ...meta, kind: 'road', id: r.id, hierarchy: r.hierarchy },
        geometry: { type: 'LineString', coordinates: r.coords.map(project) } });
    }
    for (const n of b.nodes || []) {
      out.push({ type: 'Feature', properties: { ...meta, kind: 'node', id: n.id, nodeKind: n.kind },
        geometry: { type: 'Point', coordinates: project(n.xy) } });
    }
  }
  return out;
}

const round = (v, d) => Math.round(v * 10 ** d) / 10 ** d;

export function toGeoJSON(bundles) {
  return {
    type: 'FeatureCollection',
    features: features(bundles, p => toWGS84(p).map(v => round(v, 7)))
  };
}

export function toBNGGeoJSON(bundles) {
  return {
    type: 'FeatureCollection',
    crs: { type: 'name', properties: { name: 'urn:ogc:def:crs:EPSG::27700' } },
    features: features(bundles, p => [round(p[0], 2), round(p[1], 2)])
  };
}

export default mod;
