// The London map's display features, on the workspace's map.
//
// The features themselves are the incubator app incubator/google-map-live: this
// file loads its own scripts at run time (search, colour themes, lighting and
// weather, building shadows, trees, street vehicles, local terrain tiles, flood
// risk detail, the drainage network) and its own data (assets/), so a change
// made there reaches the workspace. Only the wiring is here; it follows
// google-map-live's index.html (initOSM, ensureCityBuildings, syncCityView,
// updateFloodLayer, updateNetworkLayer, ensureOsmFocus70, ...).
//
// Never calls map.setStyle(): themes are paint-only, analysis layers keep their state.

export const SOURCE_PATH = 'incubator/google-map-live/';

/** Absolute URL of the incubator London map. Frozen releases (/releases/<id>/) read the live one. */
export function londonMapBase(from = import.meta.url) {
  const u = new URL(`../../${SOURCE_PATH}`, from);
  u.pathname = u.pathname.replace(/\/releases\/[^/]+\//, '/');
  u.search = ''; u.hash = '';
  return u.href;
}

// The scripts read from the incubator, and what each must export (checked by shared/tests).
export const SCRIPTS = {
  themes: ['scripts/osm_basemap_themes.js', ['createBasemapThemeController', 'normaliseBasemapTheme', 'tintPalette', 'BASEMAP_THEMES']],
  atmosphere: ['scripts/map_atmosphere.js', ['createAtmosphere', 'LIGHTING_PRESETS', 'WEATHER_PRESETS']],
  shadows: ['scripts/building_shadows.js', ['createBuildingShadowLayer']],
  trees: ['scripts/urban_trees.js', ['createUrbanTrees']],
  treeRenderer: ['scripts/tree_renderer.js', ['createTreeRenderer']],
  traffic: ['scripts/street_traffic.js', ['createStreetTraffic']],
  search: ['scripts/place_search.js', ['createPlaceSearch']],
  terrain: ['scripts/terrain_local.js', ['createTerrainLocalLoader', 'TERRAIN_MIN_ZOOM', 'TERRAIN_MAX_ZOOM', 'TERRAIN_TILE_SIZE']],
  drainage: ['scripts/drainage_display.js', ['createDrainageDisplayLoader', 'AREA_MIN_ZOOM', 'AREA_MAX_ZOOM', 'AREA_TILE_SIZE']],
  flood: ['scripts/flood_detail.js', ['createFloodDetailLoader', 'DETAIL_MIN_ZOOM', 'DETAIL_MAX_ZOOM', 'DETAIL_TILE_SIZE']]
};
export const ASSETS = {
  terrain: 'assets/terrain/overview.webp',
  drainage: 'assets/drainage_area/area_log16.webp',
  londonOutline: 'assets/greater_london_outline.geojson',
  flood: (source, rc) => `assets/flood_risk/${source === 'combined' ? 'flood' : source}_${rc}.webp`
};

// The shared hydrology grid in EPSG:3857 (google-map-live index.html, DRAINAGE_3857) and the 70 km study area.
export const DRAINAGE_3857 = { left: -127813.8696191665, right: 102461.98815442335, bottom: 6596204.025752107, top: 6827041.923624865, baseWidth50m: 2868, baseHeight50m: 2875 };
export const FOCUS70 = { lat: 51.50733434456047, lng: -0.12768375058439654, radius: 70000 };
export const BOUNDS70 = { west: -1.1478120391692022, south: 50.858309108610484, east: 0.9210948646196429, north: 52.14838885409756 };
export const LONDON = { center: [-0.1278, 51.5074], zoom: 10 };

const m3857 = (x, y) => { const R = 6378137; return [x / R * 180 / Math.PI, (2 * Math.atan(Math.exp(y / R)) - Math.PI / 2) * 180 / Math.PI]; };
const D = DRAINAGE_3857;
const hydroNW = m3857(D.left, D.top), hydroSE = m3857(D.right, D.bottom);
const hydroBounds = [hydroNW[0], hydroSE[1], hydroSE[0], hydroNW[1]];
function floodTileCoords(row, col, n = 2) {
  const x0 = D.left + (D.right - D.left) * col / n, x1 = D.left + (D.right - D.left) * (col + 1) / n;
  const yT = D.top - (D.top - D.bottom) * row / n, yB = D.top - (D.top - D.bottom) * (row + 1) / n;
  return [m3857(x0, yT), m3857(x1, yT), m3857(x1, yB), m3857(x0, yB)];
}
function circle({ lat, lng, radius }, steps = 180) {
  const R = 6378137, la = lat * Math.PI / 180, lo = lng * Math.PI / 180, d = radius / R, c = [];
  for (let i = 0; i <= steps; i++) {
    const b = 2 * Math.PI * i / steps;
    const la2 = Math.asin(Math.sin(la) * Math.cos(d) + Math.cos(la) * Math.sin(d) * Math.cos(b));
    const lo2 = lo + Math.atan2(Math.sin(b) * Math.sin(d) * Math.cos(la), Math.cos(d) - Math.sin(la) * Math.sin(la2));
    c.push([lo2 * 180 / Math.PI, la2 * 180 / Math.PI]);
  }
  return { type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [c] } };
}

const ID = {
  citySrc: 'lm-city-buildings', cityDriver: 'lm-city-buildings-driver', city3D: 'lm-city-buildings-3d', city2D: 'lm-city-buildings-2d',
  terrainSrc: 'lm-terrain', terrain: 'lm-terrain-layer',
  floodSrc: rc => `lm-flood-${rc}`, flood: rc => `lm-flood-layer-${rc}`, floodDetailSrc: 'lm-flood-detail', floodDetail: 'lm-flood-detail-layer',
  networkSrc: 'lm-network', network: 'lm-network-layer',
  focusSrc: 'lm-focus70', focusFill: 'lm-focus70-fill', focusLine: 'lm-focus70-line',
  outlineSrc: 'lm-london-outline', outline: 'lm-london-outline-line'
};
const RCS = ['0-0', '0-1', '1-0', '1-1'];

/**
 * Load the London map features onto `map`. Call right after the style loads and
 * BEFORE adding any other layer (the colour themes capture the basemap's own layers).
 * analysisBefore(): the layer id analysis rasters go under (the workspace's overlays).
 */
export async function loadLondonMap({ map, maplibregl, base = londonMapBase(), version = '', analysisBefore = () => undefined, theme = 'dark', onChange = () => {} }) {
  const v = version ? `?${version.replace(/^\?/, '')}` : '';
  const url = p => base + p + v;
  const mods = {};
  await Promise.all(['themes', 'atmosphere', 'search', 'terrain', 'drainage', 'flood'].map(async k => { mods[k] = await import(url(SCRIPTS[k][0])); }));
  const lazy = k => (mods[k] ? Promise.resolve(mods[k]) : import(url(SCRIPTS[k][0])).then(m => (mods[k] = m)));

  const firstSymbol = () => (map.getStyle()?.layers || []).find(l => l.type === 'symbol')?.id;
  const st = {
    theme: mods.themes.normaliseBasemapTheme(theme), tints: [],
    lighting: 'day', weather: 'clear', labels: true, vehicles: false, shadows: true, trees: false, view3D: false,
    terrain: { on: false, opacity: 0.42, status: '' },
    flood: { on: false, opacity: 0.7, source: 'combined', mode: 'nearest', status: '' },
    network: { on: false, opacity: 0.9, threshold: 1, status: '' },
    focus70: { on: false }
  };
  const emit = what => onChange(what, st);

  // ------------------------------------------------------------ colour themes (paint-only)
  const themes = mods.themes.createBasemapThemeController(map);
  themes.capture();
  const cityColour = () => mods.themes.tintPalette({ building: (mods.themes.BASEMAP_THEMES[st.theme] || mods.themes.BASEMAP_THEMES.planning).extrusion }, st.tints).building;
  function applyTheme() {
    themes.setTint(st.tints); themes.apply(st.theme);
    const c = cityColour();
    if (map.getLayer(ID.city3D)) map.setPaintProperty(ID.city3D, 'fill-extrusion-color', c);
    if (map.getLayer(ID.city2D)) map.setPaintProperty(ID.city2D, 'fill-color', c);
  }
  applyTheme();

  // ------------------------------------------------------------ labels / POIs (base symbol layers only)
  const labelVis = new Map();
  function syncLabels() {
    for (const l of map.getStyle()?.layers || []) {
      if (!themes.isBaseLayer(l.id)) continue;
      const sl = String(l['source-layer'] || '').toLowerCase(), id = l.id.toLowerCase();
      const isLabel = l.type === 'symbol' || (l.type === 'circle' && /poi|label|station|stop|transit|bus|subway|railway/.test(id + sl));
      if (!isLabel) continue;
      if (!labelVis.has(l.id)) labelVis.set(l.id, map.getLayoutProperty(l.id, 'visibility') || 'visible');
      const want = st.labels ? labelVis.get(l.id) : 'none';
      if (map.getLayoutProperty(l.id, 'visibility') !== want) map.setLayoutProperty(l.id, 'visibility', want);
    }
  }

  // ------------------------------------------------------------ 3D city (ensureCityBuildings / syncCityView)
  const sources = map.getStyle()?.sources || {};
  const roadSource = sources.openmaptiles ? 'openmaptiles' : Object.keys(sources).find(id => sources[id].type === 'vector') || ID.citySrc;
  // Same as the incubator London map v3.40.0: the buildings read the basemap's own dated tile address (one download per
  // shared tile, not two), near tiles stay z14 and the far part of a low camera uses z13. ?lod=old: as before; ?lod=12.6: far aim.
  const LATEST = 'https://tiles.openfreemap.org/planet/latest/{z}/{x}/{y}.pbf';
  const LOD = (() => { const v = new URLSearchParams(location.search).get('lod'); return v === 'old' ? 'old' : (v && Number.isFinite(+v) ? Math.max(12.2, Math.min(14, +v)) : 12.8); })();
  const baseTiles = () => {
    if (LOD === 'old') return LATEST;
    for (const id of Object.keys(map.getStyle()?.sources || {})) {
      if (id === ID.citySrc) continue;
      const s = map.getSource(id);
      if (s?.type === 'vector' && /tiles\.openfreemap\.org\/planet/.test(String(s.url || '')) && s.tiles?.[0]) return s.tiles[0];
    }
    return LATEST;
  };
  map.addSource(ID.citySrc, { type: 'vector', tiles: [baseTiles()], minzoom: 13, maxzoom: 14,
    attribution: 'OpenFreeMap © OpenMapTiles © OpenStreetMap contributors' });
  const keep = ['!', ['boolean', ['get', 'hide_3d'], false]];
  map.addLayer({ id: ID.cityDriver, type: 'fill', source: ID.citySrc, 'source-layer': 'building', minzoom: 13, filter: keep, paint: { 'fill-color': '#000', 'fill-opacity': 0 } }, firstSymbol());
  map.addLayer({ id: ID.city3D, type: 'fill-extrusion', source: ID.citySrc, 'source-layer': 'building', minzoom: 13, filter: keep, layout: { visibility: 'none' },
    paint: { 'fill-extrusion-color': cityColour(), 'fill-extrusion-height': ['max', 0, ['to-number', ['get', 'render_height'], 5]],
      'fill-extrusion-base': ['max', 0, ['to-number', ['get', 'render_min_height'], 0]], 'fill-extrusion-opacity': 1, 'fill-extrusion-vertical-gradient': false } }, firstSymbol());
  map.addLayer({ id: ID.city2D, type: 'fill', source: ID.citySrc, 'source-layer': 'building', minzoom: 13, filter: keep, layout: { visibility: 'none' },
    paint: { 'fill-color': cityColour(), 'fill-opacity': 0.96 } }, firstSymbol());
  let lodKey = '';
  function tuneCity() {
    const src = map.getSource(ID.citySrc); if (!src) return;
    if (LOD === 'old') { if (!lodKey) { lodKey = 'old'; try { map.setSourceTileLodParams?.(1, 8, ID.citySrc); } catch { /* older MapLibre */ } } return; }
    const url = baseTiles();   // the basemap's address may arrive after the source was made
    if (url !== LATEST && src.tiles?.[0] !== url && typeof src.setTiles === 'function') { try { src.setTiles([url]); } catch { /* keep latest */ } }
    // levels follow the zoom so the far edge aims at about z12.8 → z13 tiles (never z12, where buildings have no tiles)
    const levels = Math.max(1, Math.min(6, 1 + Math.round((map.getZoom() - LOD) * 4) / 4)), key = String(levels);
    if (key === lodKey) return;
    try { map.setSourceTileLodParams?.(levels, 8, ID.citySrc); lodKey = key; } catch { /* older MapLibre */ }
  }
  tuneCity();
  const setVis = (id, vis) => { if (map.getLayer(id) && map.getLayoutProperty(id, 'visibility') !== vis) map.setLayoutProperty(id, 'visibility', vis); };
  let lastPitch3D = null;
  function syncCity() {
    // one 3D building source only: hide the basemap's own building extrusions
    for (const l of map.getStyle()?.layers || []) {
      if (l.type !== 'fill-extrusion' || l.id.startsWith('lm-')) continue;
      if (/building/i.test(`${l.id} ${l['source-layer'] || ''}`)) setVis(l.id, 'none');
    }
    const is3D = map.getPitch() > 0.5;
    setVis(ID.city3D, is3D ? 'visible' : 'none');
    setVis(ID.city2D, is3D ? 'none' : 'visible');
    if (lastPitch3D !== is3D) { lastPitch3D = is3D; traffic?.syncView(); trees?.syncView(); st.view3D = is3D; emit('view'); }
  }

  // ------------------------------------------------------------ lighting, weather, shadows, trees (initAtmosphere / initUrbanTrees)
  let shadows = null, trees = null, traffic = null, trafficLoading = null, lastSun = null;
  const cityBefore = () => (map.getLayer(ID.city3D) ? ID.city3D : undefined);
  function onTint(t) {
    st.tints = Array.isArray(t) ? t : [];
    applyTheme(); traffic?.setTint?.(st.tints); trees?.setTint(st.tints);
  }
  const atmosphere = mods.atmosphere.createAtmosphere(map, {
    onTint,
    onChange: s => { st.lighting = s.lighting; st.weather = s.weather; st.sun = s.sun; emit('atmosphere'); },
    onSun: sun => { lastSun = sun; trees?.setSun(sun); if (shadows) { shadows.setSun(sun); shadows.setStrength(sun.strength); } }
  });
  lazy('shadows').then(m => {
    shadows = m.createBuildingShadowLayer(map, maplibregl, { sourceId: ID.citySrc, extraFootprints: () => trees?.shadowFootprints() || [], beforeId: cityBefore });
    shadows.setEnabled(st.shadows); if (lastSun) { shadows.setSun(lastSun); shadows.setStrength(lastSun.strength); }
  }).catch(e => console.warn('Building shadows unavailable', e));
  function ensureTrees() {
    if (trees) return Promise.resolve(trees);
    return Promise.all([lazy('trees'), lazy('treeRenderer')]).then(([t, r]) => {
      if (trees) return trees;
      trees = t.createUrbanTrees(map, { sourceId: roadSource, createRenderer: () => r.createTreeRenderer(map, maplibregl, { beforeId: cityBefore }), onChange: () => shadows?.refresh() });
      trees.setTint(st.tints); if (lastSun) trees.setSun(lastSun);
      return trees;
    });
  }
  function ensureTraffic() {
    if (traffic) return Promise.resolve(traffic);
    trafficLoading = trafficLoading || lazy('traffic').then(m => {
      traffic = m.createStreetTraffic(map, { roadSourceId: roadSource, beforeLayerId: firstSymbol });
      traffic.setTint?.(st.tints); return traffic;
    });
    return trafficLoading;
  }

  // ------------------------------------------------------------ overview outline of Greater London (ensureOverviewLayers, outline only)
  map.addSource(ID.outlineSrc, { type: 'geojson', data: url(ASSETS.londonOutline), attribution: '© OpenStreetMap contributors' });
  map.addLayer({ id: ID.outline, type: 'line', source: ID.outlineSrc, maxzoom: 11.3, layout: { 'line-join': 'round' },
    paint: { 'line-color': '#8e8e93', 'line-width': ['interpolate', ['linear'], ['zoom'], 7, 1.2, 11, 2.2],
      'line-opacity': ['interpolate', ['linear'], ['zoom'], 10.2, 0.7, 11.2, 0] } }, firstSymbol());

  // ------------------------------------------------------------ analysis layers (the same protocols as google-map-live's initOSM)
  const flood = mods.flood, drainage = mods.drainage, terrain = mods.terrain;
  const center = { lat: FOCUS70.lat, lng: FOCUS70.lng };
  let floodDetailSeen = false;
  const protocol = (name, fn) => { try { maplibregl.removeProtocol?.(name); } catch { /* none yet */ } maplibregl.addProtocol(name, fn); };
  const floodLoader = flood.createFloodDetailLoader({ center, radius: FOCUS70.radius, bounds: D, assetUrl: p => url(p) });
  protocol('ea-flood', async (req, ctl) => { const r = await floodLoader(req, ctl); floodDetailSeen = true; return r; });
  const hydroLoader = drainage.createDrainageDisplayLoader({ sourceUrl: url(ASSETS.drainage), width: D.baseWidth50m, height: D.baseHeight50m, center, radius: FOCUS70.radius, bounds: D });
  protocol('drainage-network', hydroLoader);
  const terrainLoader = terrain.createTerrainLocalLoader({ imageUrl: url(ASSETS.terrain), bounds: D, tileSize: terrain.TERRAIN_TILE_SIZE });
  protocol('ea-terrain-local', terrainLoader);

  const under = () => analysisBefore() || firstSymbol();
  function syncTerrain() {
    const t = st.terrain;
    if (!t.on) { setVis(ID.terrain, 'none'); t.status = 'off'; return; }
    if (!map.getSource(ID.terrainSrc)) {
      map.addSource(ID.terrainSrc, { type: 'raster', tiles: ['ea-terrain-local://tiles/{z}/{x}/{y}'], tileSize: terrain.TERRAIN_TILE_SIZE,
        minzoom: terrain.TERRAIN_MIN_ZOOM, maxzoom: terrain.TERRAIN_MAX_ZOOM, bounds: hydroBounds, attribution: '© Environment Agency 2022 · Open Government Licence' });
      map.addLayer({ id: ID.terrain, type: 'raster', source: ID.terrainSrc, paint: { 'raster-opacity': t.opacity, 'raster-fade-duration': 0, 'raster-resampling': 'linear' } }, under());
    }
    setVis(ID.terrain, 'visible'); map.setPaintProperty(ID.terrain, 'raster-opacity', t.opacity);
    t.status = map.isSourceLoaded(ID.terrainSrc) ? 'visible' : 'loading';
    stack();
  }
  const floodUrls = new Map();
  let floodReq = 0;
  async function floodImages(source) {
    return Promise.all(RCS.map(async rc => {
      const key = `${source}:${rc}`;
      if (floodUrls.has(key)) return floodUrls.get(key);
      const r = await fetch(url(ASSETS.flood(source, rc)), { cache: 'force-cache' });
      if (!r.ok) throw new Error(`flood ${source} ${rc}: ${r.status}`);
      const u = URL.createObjectURL(await r.blob()); floodUrls.set(key, u); return u;
    }));
  }
  function removeFlood() {
    for (const id of [ID.floodDetail, ...RCS.map(ID.flood)]) if (map.getLayer(id)) map.removeLayer(id);
    for (const id of [ID.floodDetailSrc, ...RCS.map(ID.floodSrc)]) if (map.getSource(id)) map.removeSource(id);
    floodDetailSeen = false;
  }
  async function syncFlood(rebuild = false) {
    const f = st.flood, req = ++floodReq;
    if (!f.on) { removeFlood(); f.status = 'off'; emit('layers'); return; }
    if (rebuild) removeFlood();
    f.status = 'loading'; emit('layers');
    try {
      const urls = await floodImages(f.source);
      if (req !== floodReq || !f.on) return;
      RCS.forEach((rc, i) => {
        const [row, col] = rc.split('-').map(Number);
        if (!map.getSource(ID.floodSrc(rc))) map.addSource(ID.floodSrc(rc), { type: 'image', url: urls[i], coordinates: floodTileCoords(row, col) });
        if (!map.getLayer(ID.flood(rc))) map.addLayer({ id: ID.flood(rc), type: 'raster', source: ID.floodSrc(rc), paint: { 'raster-opacity': f.opacity, 'raster-fade-duration': 120, 'raster-resampling': f.mode } }, under());
      });
      if (f.source === 'combined' && !map.getSource(ID.floodDetailSrc)) {
        map.addSource(ID.floodDetailSrc, { type: 'raster', tiles: ['ea-flood://tiles/{z}/{x}/{y}'], tileSize: flood.DETAIL_TILE_SIZE,
          minzoom: flood.DETAIL_MIN_ZOOM, maxzoom: flood.DETAIL_MAX_ZOOM, bounds: hydroBounds, attribution: '© Environment Agency · Open Government Licence v3.0' });
        map.addLayer({ id: ID.floodDetail, type: 'raster', source: ID.floodDetailSrc, minzoom: flood.DETAIL_MIN_ZOOM,
          paint: { 'raster-opacity': 0, 'raster-fade-duration': 120, 'raster-resampling': f.mode } }, under());
      }
      stack(); syncFloodView();
    } catch (e) { if (req === floodReq) { removeFlood(); f.status = 'error'; f.error = e.message; emit('layers'); } }
  }
  function syncFloodView() {
    const f = st.flood;
    if (!f.on || !map.getLayer(ID.flood('0-0'))) return;
    const close = f.source === 'combined' && map.getZoom() >= flood.DETAIL_MIN_ZOOM;
    const ready = close && floodDetailSeen && map.getSource(ID.floodDetailSrc) && map.isSourceLoaded(ID.floodDetailSrc);
    for (const rc of RCS) { map.setPaintProperty(ID.flood(rc), 'raster-opacity', ready ? 0 : f.opacity); map.setPaintProperty(ID.flood(rc), 'raster-resampling', f.mode); }
    if (map.getLayer(ID.floodDetail)) { map.setPaintProperty(ID.floodDetail, 'raster-opacity', ready ? f.opacity : 0); map.setPaintProperty(ID.floodDetail, 'raster-resampling', f.mode); }
    const next = ready ? 'detail' : close ? 'loading' : 'overview';
    if (next !== f.status) { f.status = next; emit('layers'); }
  }
  let netTimer = null;
  function syncNetwork() {
    const n = st.network;
    if (!n.on) { setVis(ID.network, 'none'); n.status = 'off'; return; }
    const tiles = [`drainage-network://tiles/${Math.min(50, Math.max(0, n.threshold)).toFixed(3)}/{z}/{x}/{y}`];
    if (map.getSource(ID.networkSrc)) map.getSource(ID.networkSrc).setTiles(tiles);
    else map.addSource(ID.networkSrc, { type: 'raster', tiles, tileSize: drainage.AREA_TILE_SIZE, minzoom: drainage.AREA_MIN_ZOOM, maxzoom: drainage.AREA_MAX_ZOOM,
      bounds: hydroBounds, attribution: 'Terrain-derived drainage network · upper Thames 50 m contributing area' });
    if (!map.getLayer(ID.network)) map.addLayer({ id: ID.network, type: 'raster', source: ID.networkSrc, minzoom: drainage.AREA_MIN_ZOOM,
      paint: { 'raster-opacity': n.opacity, 'raster-fade-duration': 0, 'raster-resampling': 'linear' } }, under());
    setVis(ID.network, 'visible'); map.setPaintProperty(ID.network, 'raster-opacity', n.opacity);
    n.status = 'visible'; stack();
  }
  // Order, bottom to top: terrain, flood, network (google-map-live keepDrainageAboveTerrain), all under the workspace's overlays.
  function stack() {
    const top = under();
    for (const id of [ID.terrain, ID.floodDetail, ...RCS.map(ID.flood), ID.network]) if (map.getLayer(id) && top && id !== top) { try { map.moveLayer(id, top); } catch { /* fine */ } }
    // terrain lowest: move it again under the first flood / network layer present
    const first = [ID.floodDetail, ...RCS.map(ID.flood), ID.network].find(id => map.getLayer(id));
    if (first && map.getLayer(ID.terrain)) try { map.moveLayer(ID.terrain, first); } catch { /* fine */ }
    for (const rc of RCS) if (map.getLayer(ID.flood(rc)) && map.getLayer(ID.floodDetail)) try { map.moveLayer(ID.flood(rc), ID.floodDetail); } catch { /* fine */ }
  }
  function syncFocus() {
    if (!map.getSource(ID.focusSrc)) {
      map.addSource(ID.focusSrc, { type: 'geojson', data: circle(FOCUS70) });
      map.addLayer({ id: ID.focusFill, type: 'fill', source: ID.focusSrc, paint: { 'fill-color': '#e5332a', 'fill-opacity': 0.05 } });
      map.addLayer({ id: ID.focusLine, type: 'line', source: ID.focusSrc, paint: { 'line-color': '#e5332a', 'line-width': 2.5, 'line-opacity': 0.95 } });
    }
    const vis = st.focus70.on ? 'visible' : 'none';
    setVis(ID.focusFill, vis); setVis(ID.focusLine, vis);
    map.setMaxBounds(st.focus70.on ? [[BOUNDS70.west, BOUNDS70.south], [BOUNDS70.east, BOUNDS70.north]] : null);
    if (st.focus70.on) fit70();
  }
  const fit70 = () => map.fitBounds([[BOUNDS70.west, BOUNDS70.south], [BOUNDS70.east, BOUNDS70.north]], { padding: 20, duration: 450 });

  // ------------------------------------------------------------ search (runPlaceSearch / goToPlace)
  const searchPlaces = mods.search.createPlaceSearch();
  let marker = null;
  function goToPlace(place) {
    if (st.focus70.on && (place.lng < BOUNDS70.west || place.lng > BOUNDS70.east || place.lat < BOUNDS70.south || place.lat > BOUNDS70.north)) { st.focus70.on = false; syncFocus(); emit('layers'); }
    let zoom = 16.5;
    if (place.bounds) { const cam = map.cameraForBounds(place.bounds, { padding: 40, maxZoom: 16.5 }); if (cam && Number.isFinite(cam.zoom)) zoom = cam.zoom; }
    map.flyTo({ center: [place.lng, place.lat], zoom, pitch: map.getPitch(), bearing: map.getBearing(), duration: 1100 });
    marker?.remove();
    marker = new maplibregl.Marker({ color: '#f97316' }).setLngLat([place.lng, place.lat]).setPopup(new maplibregl.Popup({ offset: 25 }).setText(place.name)).addTo(map);
  }

  // ------------------------------------------------------------ camera events
  map.on('sourcedata', e => {
    if (e.sourceId === ID.citySrc) syncCity();
    if (e.sourceId === ID.citySrc || e.sourceId === roadSource) tuneCity();
    if (e.sourceId === ID.floodDetailSrc) syncFloodView();
    if (e.sourceId === ID.terrainSrc && st.terrain.on && st.terrain.status !== 'visible' && map.isSourceLoaded(ID.terrainSrc)) { st.terrain.status = 'visible'; emit('layers'); }
    if (!st.labels) syncLabels();
  });
  for (const ev of ['pitch', 'rotate', 'zoom', 'moveend']) map.on(ev, () => { if (ev === 'zoom') tuneCity(); syncCity(); if (ev !== 'pitch') syncFloodView(); });
  syncCity(); syncLabels(); syncFocus();

  return {
    state: st,
    themes: mods.themes.BASEMAP_THEMES,
    buildingLayer: ID.city3D,
    setTheme(id) { st.theme = mods.themes.normaliseBasemapTheme(id); applyTheme(); emit('theme'); },
    setLighting(l) { atmosphere.setLighting(l); },
    setWeather(w) { atmosphere.setWeather(w); },
    setLabels(on) { st.labels = Boolean(on); syncLabels(); emit('display'); },
    setShadows(on) { st.shadows = Boolean(on); shadows?.setEnabled(st.shadows); emit('display'); },
    setTrees(on) { st.trees = Boolean(on); ensureTrees().then(t => t.setEnabled(st.trees)).catch(e => console.warn('Trees unavailable', e)); emit('display'); },
    setVehicles(on) { st.vehicles = Boolean(on); ensureTraffic().then(t => t.setEnabled(st.vehicles)).catch(e => console.warn('Vehicles unavailable', e)); emit('display'); },
    setCityView(is3D) {
      map.easeTo(is3D ? { zoom: Math.max(map.getZoom(), 15.5), pitch: 55, bearing: map.getBearing() || -20, duration: 700 } : { pitch: 0, bearing: 0, duration: 450 });
    },
    setLayer(key, patch) {
      Object.assign(st[key], patch);
      if (key === 'terrain') syncTerrain();
      if (key === 'flood') syncFlood(Boolean(patch.source));
      if (key === 'network') { if ('threshold' in patch) { clearTimeout(netTimer); netTimer = setTimeout(syncNetwork, 70); } else syncNetwork(); }
      if (key === 'focus70') syncFocus();
      emit('layers');
    },
    restack: stack,
    async search(query, { signal } = {}) {
      const b = map.getBounds();
      return searchPlaces(query, { signal, viewbox: [b.getWest(), b.getNorth(), b.getEast(), b.getSouth()] });
    },
    goToPlace,
    jump(where) {
      if (where === '70km') fit70();
      if (where === 'london') map.flyTo({ center: LONDON.center, zoom: LONDON.zoom, duration: 900 });
      if (where === 'reset') { map.easeTo({ center: LONDON.center, zoom: 8.2, pitch: 0, bearing: 0, duration: 700 }); marker?.remove(); marker = null; }
      if (where === 'locate') {
        if (!navigator.geolocation) throw new Error('geolocation unavailable');
        return new Promise((res, rej) => navigator.geolocation.getCurrentPosition(p => {
          map.flyTo({ center: [p.coords.longitude, p.coords.latitude], zoom: 15, duration: 1000 }); res(p);
        }, rej, { enableHighAccuracy: true, timeout: 10000 }));
      }
    }
  };
}
