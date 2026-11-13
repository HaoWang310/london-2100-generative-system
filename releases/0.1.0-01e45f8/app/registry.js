// The app is the only place that imports several modules. Modules never
// import each other (enforced by tools/check-isolation.mjs).
import london from '../modules/00-london-map/module.js?v=01e45f8';
import region from '../modules/01-region-planning/module.js?v=01e45f8';
import wool from '../modules/02-wool-network/module.js?v=01e45f8';
import tensor from '../modules/03-tensor-roads/module.js?v=01e45f8';
import integration from '../modules/04-road-integration/module.js?v=01e45f8';
import exporter, { toGeoJSON, toBNGGeoJSON } from '../modules/05-catalogue-export/module.js?v=01e45f8';

// Scale levels, in order. Each level's module consumes the previous level's result.
export const SCALES = [
  { level: 'london', module: london, needsSelection: false },
  { level: 'region', module: region, needsSelection: false }, // runs on the whole study area
  { level: 'wool', module: wool, needsSelection: true },      // runs inside one selected region
  { level: 'tensor', module: tensor, needsSelection: true }   // runs inside one selected local area
];

// Tools act on the current Wool region (and everything generated inside it).
export const TOOLS = [
  { key: 'integration', module: integration },
  { key: 'export', module: exporter }
];

export const exporters = { toGeoJSON, toBNGGeoJSON };
