// The app is the only place that imports several modules. Modules never
// import each other (enforced by tools/check-isolation.mjs).
import london from '../modules/00-london-map/module.js?v=418c519';
import growth, { createGrowthTool } from '../modules/01-growth-simulator/module.js?v=418c519';
import region from '../modules/02-region-planning/module.js?v=418c519';
import wool from '../modules/03-wool-network/module.js?v=418c519';
import tensor from '../modules/04-tensor-roads/module.js?v=418c519';
import integration from '../modules/05-road-integration/module.js?v=418c519';
import exporter, { toGeoJSON, toBNGGeoJSON } from '../modules/06-catalogue-export/module.js?v=418c519';

// The road chain (02 region planning -> 03 Wool -> 04 Tensor -> 05 integration / 06 export) is hidden
// from the workspace until the Wool algorithm is ready. The modules stay in the repo and keep their
// tests; set ROAD_CHAIN to true to bring the whole chain back.
export const ROAD_CHAIN = false;
const hidden = !ROAD_CHAIN;

// Scale levels, in order. Each level's module consumes the previous level's result.
export const SCALES = [
  { level: 'london', module: london, needsSelection: false },
  { level: 'region', module: region, needsSelection: false, hidden }, // runs on the whole study area
  { level: 'wool', module: wool, needsSelection: true, hidden },      // runs inside one selected region
  { level: 'tensor', module: tensor, needsSelection: true, hidden }   // runs inside one selected local area
];

// Tools act on the current Wool region (and everything generated inside it).
export const TOOLS = [
  { key: 'integration', module: integration, hidden },
  { key: 'export', module: exporter, hidden }
];

// Simulations that stand beside the scale chain: open at any level, drawn on the map,
// kept as a background while working at other levels. Listed after London in the nav.
export const SIMULATIONS = [
  { key: 'growth', module: growth, create: createGrowthTool }
];

export const exporters = { toGeoJSON, toBNGGeoJSON };
