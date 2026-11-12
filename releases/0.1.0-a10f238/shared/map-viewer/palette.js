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
