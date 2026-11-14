// The app is the only place that imports several modules. Modules never
// import each other (enforced by tools/check-isolation.mjs).
import london from '../modules/00-london-map/module.js?v=78fb3a7';
import growth, { createGrowthTool } from '../modules/01-growth-simulator/module.js?v=78fb3a7';
import region from '../modules/02-region-planning/module.js?v=78fb3a7';
import wool from '../modules/03-wool-network/module.js?v=78fb3a7';
import tensor from '../modules/04-tensor-roads/module.js?v=78fb3a7';
import integration from '../modules/05-road-integration/module.js?v=78fb3a7';
import exporter, { toGeoJSON, toBNGGeoJSON } from '../modules/06-catalogue-export/module.js?v=78fb3a7';

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

// Simulations that stand beside the scale chain: open at any level, drawn on the map,
// kept as a background while working at other levels. Listed after London in the nav.
export const SIMULATIONS = [
  { key: 'growth', module: growth, create: createGrowthTool }
];

export const exporters = { toGeoJSON, toBNGGeoJSON };
