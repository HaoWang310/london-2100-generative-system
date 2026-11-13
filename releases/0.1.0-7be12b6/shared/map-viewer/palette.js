// Low-saturation visual palette shared by the map viewer, legends and exports.
// Monochrome UI; colour is reserved for data.

export const ROAD_STYLE = {
  'region-link': { color: '#8e9aa6', width: 1.4, dash: [2, 2] },
  primary:       { color: '#d9c4a3', width: 3.2 },
  branch:        { color: '#b5a28a', width: 2.2 },
  secondary:     { color: '#a3bccc', width: 1.8 },
  local:         { color: '#7f939e', width: 1.0 },
  integrated:    { color: '#c9a7b6', width: 1.6, dash: [1, 1] }
};

export const AREA_STYLE = {
  boundary: '#f5f5f7',
  childFill: 'rgba(245,245,247,0.035)',
  childLine: '#6e6e73',
  childHoverFill: 'rgba(245,245,247,0.09)',
  selectedFill: 'rgba(217,196,163,0.16)',
  selectedLine: '#d9c4a3',
  ghost: '#48484a',
  node: '#f5f5f7'
};

export const HIERARCHY_ORDER = ['region-link', 'primary', 'branch', 'secondary', 'local', 'integrated'];

// Dark monochrome restyle for any OpenMapTiles-based style (e.g. liberty).
// Only paint colours change; layers, sources and data stay as they are.
const BASE = {
  background: '#0b0b0c', water: '#15171a', waterLine: '#1c1f23',
  land: '#0f0f10', green: '#121413', building: '#1a1a1c', buildingLine: '#222225',
  roadMinor: '#1f1f22', roadMajor: '#2c2c2f', rail: '#26262a', boundary: '#3a3a3d',
  text: '#7c7c82', textHalo: '#0b0b0c'
};

function pick(id, type) {
  if (type === 'background') return { 'background-color': BASE.background };
  if (/water|ocean|river/.test(id)) {
    if (type === 'fill') return { 'fill-color': BASE.water, 'fill-outline-color': BASE.water };
    if (type === 'line') return { 'line-color': BASE.waterLine };
  }
  if (/building/.test(id)) {
    if (type === 'fill') return { 'fill-color': BASE.building, 'fill-outline-color': BASE.buildingLine };
    if (type === 'fill-extrusion') return { 'fill-extrusion-color': BASE.building };
  }
  if (/park|wood|forest|grass|landcover|landuse|vegetation|farmland|scrub/.test(id) && type === 'fill') {
    return { 'fill-color': /park|wood|forest|grass|vegetation|scrub/.test(id) ? BASE.green : BASE.land, 'fill-outline-color': BASE.land };
  }
  if (type === 'fill') return { 'fill-color': BASE.land, 'fill-outline-color': BASE.land };
  if (type === 'line') {
    if (/boundary|admin/.test(id)) return { 'line-color': BASE.boundary };
    if (/rail|transit/.test(id)) return { 'line-color': BASE.rail };
    if (/motorway|trunk|primary|major/.test(id)) return { 'line-color': BASE.roadMajor };
    return { 'line-color': BASE.roadMinor };
  }
  if (type === 'symbol') return { 'text-color': BASE.text, 'text-halo-color': BASE.textHalo, 'icon-opacity': 0.5 };
  if (type === 'hillshade') return { 'hillshade-shadow-color': '#000', 'hillshade-highlight-color': '#1c1c1e', 'hillshade-accent-color': '#000' };
  return null;
}

export function restyleDark(map) {
  for (const layer of map.getStyle().layers) {
    const paint = pick(layer.id, layer.type);
    if (!paint) continue;
    for (const [k, v] of Object.entries(paint)) {
      try { map.setPaintProperty(layer.id, k, v); } catch { /* property not valid for this layer */ }
    }
  }
}
