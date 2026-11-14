// 00 · London map — the study area and real geographic base.
// P0: defines the EPSG:27700 study circle. The basemap (OSM / OpenFreeMap)
// is drawn by shared/map-viewer. P1 migrates google-map-live's terrain,
// flood risk, contributing area and drainage layers into legacy/.

import { createBundle } from '../../shared/schemas/index.js?v=7b31591';
import { circleRing, area, LONDON_CENTRE_BNG } from '../../shared/geo-core/index.js?v=7b31591';

const mod = {
  id: '00-london-map',
  level: 'london',
  version: '0.1.0',
  title: { zh: '伦敦地图', en: 'London map' },
  description: {
    zh: '伦敦真实地理底图与研究范围（EPSG:27700）。',
    en: 'Real London base map and study area (EPSG:27700).'
  },
  params: [
    { key: 'radiusKm', type: 'range', min: 10, max: 70, step: 5, default: 70,
      label: { zh: '研究范围半径', en: 'Study radius' }, unit: 'km' }
  ],
  async run(_input, params) {
    const radius = (params.radiusKm ?? 70) * 1000;
    const boundary = circleRing(LONDON_CENTRE_BNG, radius, 128);
    return createBundle({
      id: 'london:study-area',
      level: 'london',
      boundary,
      context: { centre: LONDON_CENTRE_BNG },
      scenario: { ...params },
      algorithm: { module: mod.id, id: 'study-circle', version: mod.version },
      stats: { areaKm2: Math.round(area(boundary) / 1e6) }
    });
  }
};

export default mod;
