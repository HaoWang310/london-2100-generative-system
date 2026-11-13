// Standard data interface between modules: the ScaleBundle.
//
// Every module receives a ScaleBundle (or null for the root) and returns one.
// A bundle's `children` are the selectable sub-areas that become the input
// of the next, smaller scale. All coordinates are EPSG:27700 metres [E, N].
//
// {
//   schema: 'l2100.scale-bundle', schemaVersion: 1,
//   id: 'region:r-03-04',            unique id of this result
//   level: 'london' | 'region' | 'wool' | 'tensor' | 'integration',
//   parentId: 'london:study-area',   id of the input bundle (null at root)
//   crs: 'EPSG:27700',
//   boundary: [[E,N], ...],          working boundary (ring, not closed)
//   roads: [{ id, hierarchy, coords: [[E,N], ...] }],
//   nodes: [{ id, xy: [E,N], kind }],
//   edges: [{ id, from, to, roadId }],
//   children: [{ id, label, boundary, centre }],
//   context: { parentRoads: [...] },  constraints inherited from the parent
//   scenario: { ...params },          parameters used to generate it
//   algorithm: { module, id, version },
//   stats: { ... },
//   createdAt: ISO string
// }

export const SCHEMA = 'l2100.scale-bundle';
export const SCHEMA_VERSION = 1;
export const CRS = 'EPSG:27700';

export const LEVELS = ['london', 'region', 'wool', 'tensor', 'integration'];

export const ROAD_HIERARCHY = [
  'region-link',   // connections between planning regions (01)
  'primary',       // Wool regional skeleton (02)
  'branch',        // Wool branches (02)
  'secondary',     // Tensor major streamlines (03)
  'local',         // Tensor minor streamlines (03)
  'integrated'     // repaired/merged output (04)
];

const isPoint = p => Array.isArray(p) && p.length >= 2 && Number.isFinite(p[0]) && Number.isFinite(p[1]);
const isRing = r => Array.isArray(r) && r.length >= 3 && r.every(isPoint);
const isLine = l => Array.isArray(l) && l.length >= 2 && l.every(isPoint);

// EPSG:27700 sanity range for Great Britain (with margin).
const inBNG = ([e, n]) => e >= 0 && e <= 700000 && n >= 0 && n <= 1300000 &&
  !(Math.abs(e) <= 180 && Math.abs(n) <= 90); // looks like lon/lat degrees

export function createBundle(fields) {
  return {
    schema: SCHEMA,
    schemaVersion: SCHEMA_VERSION,
    crs: CRS,
    parentId: null,
    boundary: [],
    roads: [],
    nodes: [],
    edges: [],
    children: [],
    context: {},
    scenario: {},
    stats: {},
    createdAt: new Date().toISOString(),
    ...fields
  };
}

/** Returns a list of human-readable problems; empty list means valid. */
export function validateBundle(b) {
  const errors = [];
  if (!b || typeof b !== 'object') return ['bundle is not an object'];
  if (b.schema !== SCHEMA) errors.push(`schema must be "${SCHEMA}"`);
  if (b.schemaVersion !== SCHEMA_VERSION) errors.push(`schemaVersion must be ${SCHEMA_VERSION}`);
  if (b.crs !== CRS) errors.push(`crs must be ${CRS}`);
  if (typeof b.id !== 'string' || !b.id) errors.push('id is required');
  if (!LEVELS.includes(b.level)) errors.push(`level must be one of ${LEVELS.join(', ')}`);
  if (!isRing(b.boundary)) errors.push('boundary must be a ring of at least 3 [E,N] points');
  else if (!b.boundary.every(inBNG)) errors.push('boundary is outside the EPSG:27700 range (lon/lat passed by mistake?)');
  if (!b.algorithm || !b.algorithm.module || !b.algorithm.version) errors.push('algorithm {module, version} is required');

  const roadIds = new Set();
  (b.roads || []).forEach((r, i) => {
    if (!r.id) errors.push(`roads[${i}].id missing`);
    if (roadIds.has(r.id)) errors.push(`roads[${i}].id "${r.id}" duplicated`);
    roadIds.add(r.id);
    if (!ROAD_HIERARCHY.includes(r.hierarchy)) errors.push(`roads[${i}].hierarchy "${r.hierarchy}" unknown`);
    if (!isLine(r.coords)) errors.push(`roads[${i}].coords must have at least 2 points`);
  });
  const nodeIds = new Set((b.nodes || []).map(n => n.id));
  (b.nodes || []).forEach((n, i) => { if (!isPoint(n.xy)) errors.push(`nodes[${i}].xy invalid`); });
  (b.edges || []).forEach((e, i) => {
    if (!nodeIds.has(e.from) || !nodeIds.has(e.to)) errors.push(`edges[${i}] references unknown node`);
  });
  const childIds = new Set();
  (b.children || []).forEach((c, i) => {
    if (!c.id) errors.push(`children[${i}].id missing`);
    if (childIds.has(c.id)) errors.push(`children[${i}].id "${c.id}" duplicated`);
    childIds.add(c.id);
    if (!isRing(c.boundary)) errors.push(`children[${i}].boundary invalid`);
  });
  return errors;
}

export function assertBundle(b, where = 'bundle') {
  const errors = validateBundle(b);
  if (errors.length) throw new Error(`${where}: invalid ScaleBundle\n- ${errors.join('\n- ')}`);
  return b;
}

/**
 * Builds the input bundle for the next scale from a selected child.
 * The child's boundary becomes the working boundary and the parent's roads
 * become constraints, so lower scales connect to higher-scale roads.
 */
export function childInput(parent, childId) {
  const child = (parent.children || []).find(c => c.id === childId);
  if (!child) throw new Error(`child "${childId}" not found in ${parent.id}`);
  return createBundle({
    id: child.id,
    level: parent.level,
    parentId: parent.id,
    boundary: child.boundary,
    context: {
      label: child.label,
      centre: child.centre,
      parentRoads: parent.roads || [],
      parentNodes: parent.nodes || []
    },
    algorithm: { module: 'shared/schemas', id: 'child-input', version: String(SCHEMA_VERSION) }
  });
}

// ---- module contract ------------------------------------------------------

const PARAM_TYPES = ['range', 'select', 'toggle'];

export function validateModule(m) {
  const errors = [];
  if (!m || typeof m !== 'object') return ['module is not an object'];
  if (!/^\d\d-[a-z0-9-]+$/.test(m.id || '')) errors.push('id must look like "02-wool-network"');
  if (!/^\d+\.\d+\.\d+/.test(m.version || '')) errors.push('version must be semver');
  if (!m.title || !m.title.zh || !m.title.en) errors.push('title {zh, en} required');
  if (typeof m.run !== 'function') errors.push('run(input, params, ctx) required');
  (m.params || []).forEach((p, i) => {
    if (!p.key) errors.push(`params[${i}].key missing`);
    if (!PARAM_TYPES.includes(p.type)) errors.push(`params[${i}].type must be ${PARAM_TYPES.join('/')}`);
    if (!p.label || !p.label.zh || !p.label.en) errors.push(`params[${i}].label {zh, en} required`);
    if (!('default' in p)) errors.push(`params[${i}].default missing`);
  });
  return errors;
}

export function defaultParams(m) {
  return Object.fromEntries((m.params || []).map(p => [p.key, p.default]));
}
