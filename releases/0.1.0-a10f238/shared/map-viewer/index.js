// Shared map viewer. Scenes are given in EPSG:27700 and converted to WGS84
// once per scene, so camera moves never touch the model.
//
// createMapViewer() tries MapLibre (OpenFreeMap tiles). If MapLibre or the
// tiles can't load (offline, single-HTML file, blocked CDN) it falls back to
// a canvas vector view drawn directly in EPSG:27700, with the same API.
//
// API:
//   viewer.setScene({ boundary, children, selectedId, roads, nodes, ghosts })
//                              roads with static:true are context and never animate
//   viewer.setProgress(0..1)   growth animation driven by the timeline
//   viewer.fit(ring)           only called on scale changes, never on zoom
//   viewer.setView3D(bool)
//   viewer.kind                'maplibre' | 'canvas'

import { toWGS84, truncatePolyline, bbox, centroid, pointInPolygon } from '../geo-core/index.js?v=a10f238';
import { ROAD_STYLE, AREA_STYLE, HIERARCHY_ORDER } from './palette.js?v=a10f238';
import { PROVIDERS, DEFAULT_PROVIDER } from './providers.js?v=a10f238';

// Same version and loading method as google-map-live (verified in production).
const MAPLIBRE_VERSION = '6.13.0';
const MAPLIBRE_CDNS = [
  `https://unpkg.com/maplibre-gl@${MAPLIBRE_VERSION}/dist`,
  `https://cdn.jsdelivr.net/npm/maplibre-gl@${MAPLIBRE_VERSION}/dist`
];

const withTimeout = (p, ms) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), ms))]);

async function loadMapLibre(timeoutMs) {
  if (globalThis.maplibregl) return globalThis.maplibregl;
  for (const base of MAPLIBRE_CDNS) {
    try {
      const mod = await withTimeout(import(`${base}/maplibre-gl.mjs`), timeoutMs);
      const css = document.createElement('link');
      css.rel = 'stylesheet'; css.href = `${base}/maplibre-gl.css`;
      document.head.appendChild(css);
      return mod.default && mod.default.Map ? mod.default : mod;
    } catch (e) { console.warn('MapLibre CDN unavailable:', base, e.message); }
  }
  throw new Error('MapLibre could not be loaded');
}

// ---------------------------------------------------------------- scene prep

function toLL(scene) {
  const ring = r => r.map(toWGS84);
  const close = r => (r.length ? r.concat([r[0]]) : r);
  return {
    boundary: scene.boundary ? close(ring(scene.boundary)) : null,
    children: (scene.children || []).map(c => ({ ...c, ll: close(ring(c.boundary)), llCentre: toWGS84(c.centre || centroid(c.boundary)) })),
    roads: (scene.roads || []).map(r => ({ ...r, ll: ring(r.coords) })),
    nodes: (scene.nodes || []).map(n => ({ ...n, ll: toWGS84(n.xy) })),
    ghosts: (scene.ghosts || []).map(g => ({
      boundary: g.boundary ? close(ring(g.boundary)) : null,
      roads: (g.roads || []).map(r => ring(r.coords))
    })),
    selectedId: scene.selectedId || null
  };
}

const fc = features => ({ type: 'FeatureCollection', features });

// ---------------------------------------------------------------- MapLibre

async function createMapLibreViewer(el, opts) {
  const maplibregl = await loadMapLibre(opts.timeoutMs ?? 8000);
  const provider = PROVIDERS[opts.provider || DEFAULT_PROVIDER];
  const map = new maplibregl.Map({
    container: el,
    style: provider.style(opts.theme),
    center: [-0.1278, 51.5074],
    zoom: 8.2,
    attributionControl: { compact: true },
    maxPitch: 75
  });
  map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'bottom-right');
  map.addControl(new maplibregl.ScaleControl({ unit: 'metric' }), 'bottom-left');

  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('basemap style timeout')), opts.timeoutMs ?? 8000);
    map.once('load', () => { clearTimeout(timer); resolve(); });
    map.once('error', e => { if (!map.isStyleLoaded()) { clearTimeout(timer); reject(e.error || new Error('style error')); } });
  });

  // Mute the basemap so data layers carry the colour.
  for (const layer of map.getStyle().layers) {
    if (layer.type === 'symbol' && /poi|housenum/.test(layer.id)) map.setLayoutProperty(layer.id, 'visibility', 'none');
  }

  const empty = fc([]);
  for (const id of ['ghost', 'children', 'boundary', 'roads', 'nodes', 'labels']) map.addSource(`l2100-${id}`, { type: 'geojson', data: empty });

  const firstSymbol = map.getStyle().layers.find(l => l.type === 'symbol')?.id;
  const hasBuildings = map.getStyle().sources.openmaptiles;
  if (hasBuildings) {
    map.addLayer({
      id: 'l2100-buildings', type: 'fill-extrusion', source: 'openmaptiles', 'source-layer': 'building', minzoom: 13,
      layout: { visibility: 'none' },
      paint: {
        'fill-extrusion-color': '#3a3a3c',
        'fill-extrusion-height': ['coalesce', ['get', 'render_height'], 8],
        'fill-extrusion-base': ['coalesce', ['get', 'render_min_height'], 0],
        'fill-extrusion-opacity': 0.75
      }
    }, firstSymbol);
  }
  map.addLayer({ id: 'l2100-ghost-line', type: 'line', source: 'l2100-ghost', paint: { 'line-color': AREA_STYLE.ghost, 'line-width': 1 } });
  map.addLayer({ id: 'l2100-children-fill', type: 'fill', source: 'l2100-children', paint: {
    'fill-color': ['case', ['get', 'selected'], AREA_STYLE.selectedFill,
      ['boolean', ['feature-state', 'hover'], false], AREA_STYLE.childHoverFill, AREA_STYLE.childFill]
  } });
  map.addLayer({ id: 'l2100-children-line', type: 'line', source: 'l2100-children', paint: {
    'line-color': ['case', ['get', 'selected'], AREA_STYLE.selectedLine, AREA_STYLE.childLine],
    'line-width': ['case', ['get', 'selected'], 2, 0.8]
  } });
  map.addLayer({ id: 'l2100-boundary', type: 'line', source: 'l2100-boundary', paint: {
    'line-color': AREA_STYLE.boundary, 'line-width': 1.2, 'line-dasharray': [3, 2], 'line-opacity': 0.8
  } });
  for (const h of HIERARCHY_ORDER) {
    const s = ROAD_STYLE[h];
    map.addLayer({ id: `l2100-road-${h}`, type: 'line', source: 'l2100-roads', filter: ['==', ['get', 'h'], h],
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': s.color, 'line-width': ['interpolate', ['linear'], ['zoom'], 9, s.width * 0.6, 15, s.width * 1.6],
        ...(s.dash ? { 'line-dasharray': s.dash } : {}) } });
  }
  map.addLayer({ id: 'l2100-nodes', type: 'circle', source: 'l2100-nodes', paint: {
    'circle-radius': 2.6, 'circle-color': AREA_STYLE.node, 'circle-opacity': 0.85
  } });
  map.addLayer({ id: 'l2100-labels', type: 'symbol', source: 'l2100-labels', layout: {
    'text-field': ['get', 'label'], 'text-size': 11, 'text-font': ['Noto Sans Regular'], 'text-allow-overlap': false
  }, paint: { 'text-color': '#d1d1d6', 'text-halo-color': '#000', 'text-halo-width': 1 } });

  let ll = toLL({});
  let progress = 1;
  let hoverId = null;

  const renderRoads = () => {
    map.getSource('l2100-roads').setData(fc(ll.roads.map(r => ({
      type: 'Feature', properties: { h: r.hierarchy, id: r.id },
      geometry: { type: 'LineString', coordinates: progress >= 1 || r.static ? r.ll : truncatePolyline(r.ll, progress) }
    }))));
  };

  map.on('mousemove', 'l2100-children-fill', e => {
    map.getCanvas().style.cursor = 'pointer';
    const id = e.features[0]?.id;
    if (hoverId !== null && hoverId !== id) map.setFeatureState({ source: 'l2100-children', id: hoverId }, { hover: false });
    hoverId = id;
    if (id !== undefined) map.setFeatureState({ source: 'l2100-children', id }, { hover: true });
  });
  map.on('mouseleave', 'l2100-children-fill', () => {
    map.getCanvas().style.cursor = '';
    if (hoverId !== null) map.setFeatureState({ source: 'l2100-children', id: hoverId }, { hover: false });
    hoverId = null;
  });
  map.on('click', 'l2100-children-fill', e => opts.onSelect?.(e.features[0].properties.cid));
  map.on('dblclick', 'l2100-children-fill', e => { e.preventDefault(); opts.onEnter?.(e.features[0].properties.cid); });

  return {
    kind: 'maplibre',
    map,
    setScene(scene) {
      ll = toLL(scene);
      map.getSource('l2100-boundary').setData(fc(ll.boundary ? [{ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: ll.boundary } }] : []));
      map.getSource('l2100-children').setData(fc(ll.children.map((c, i) => ({
        type: 'Feature', id: i, properties: { cid: c.id, label: c.label, selected: c.id === ll.selectedId },
        geometry: { type: 'Polygon', coordinates: [c.ll] }
      }))));
      map.getSource('l2100-labels').setData(fc(ll.children.map(c => ({
        type: 'Feature', properties: { label: c.label || '' }, geometry: { type: 'Point', coordinates: c.llCentre }
      }))));
      map.getSource('l2100-nodes').setData(fc(ll.nodes.map(n => ({
        type: 'Feature', properties: { kind: n.kind }, geometry: { type: 'Point', coordinates: n.ll }
      }))));
      map.getSource('l2100-ghost').setData(fc(ll.ghosts.flatMap(g => [
        ...(g.boundary ? [{ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: g.boundary } }] : []),
        ...g.roads.map(c => ({ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: c } }))
      ])));
      renderRoads();
    },
    setProgress(t) { progress = t; renderRoads(); },
    fit(ring, { animate = true } = {}) {
      if (!ring || ring.length < 3) return;
      const [x0, y0, x1, y1] = bbox(ring.map(toWGS84));
      map.fitBounds([[x0, y0], [x1, y1]], { padding: 48, duration: animate ? 900 : 0, pitch: map.getPitch() });
    },
    setView3D(on) {
      if (hasBuildings) map.setLayoutProperty('l2100-buildings', 'visibility', on ? 'visible' : 'none');
      map.easeTo({ pitch: on ? 58 : 0, bearing: on ? -18 : 0, duration: 700 });
    },
    resize() { map.resize(); },
    destroy() { map.remove(); }
  };
}

// ---------------------------------------------------------------- canvas fallback

function createCanvasViewer(el, opts) {
  const canvas = document.createElement('canvas');
  canvas.className = 'l2100-canvas-map';
  canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;touch-action:none';
  el.appendChild(canvas);
  const ctx = canvas.getContext('2d');
  let scene = {}, progress = 1;
  // view: metres per pixel and centre in EPSG:27700
  let view = { cx: 530034, cy: 180381, mpp: 180 };
  let hover = null;

  const toPx = ([e, n]) => [canvas.clientWidth / 2 + (e - view.cx) / view.mpp, canvas.clientHeight / 2 - (n - view.cy) / view.mpp];
  const toBNGpx = (x, y) => [view.cx + (x - canvas.clientWidth / 2) * view.mpp, view.cy - (y - canvas.clientHeight / 2) * view.mpp];

  const path = (pts, closed) => {
    ctx.beginPath();
    pts.forEach((p, i) => { const [x, y] = toPx(p); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); });
    if (closed) ctx.closePath();
  };

  function draw() {
    const dpr = globalThis.devicePixelRatio || 1;
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (canvas.width !== w * dpr) { canvas.width = w * dpr; canvas.height = h * dpr; }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#0b0b0c'; ctx.fillRect(0, 0, w, h);
    // 1 km / 10 km reference grid in EPSG:27700
    const step = view.mpp > 60 ? 10000 : 1000;
    const [e0, n1] = toBNGpx(0, 0), [e1, n0] = toBNGpx(w, h);
    ctx.strokeStyle = '#1c1c1e'; ctx.lineWidth = 1;
    for (let e = Math.floor(e0 / step) * step; e < e1; e += step) { const [x] = toPx([e, 0]); ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke(); }
    for (let n = Math.floor(n0 / step) * step; n < n1; n += step) { const [, y] = toPx([0, n]); ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }

    ctx.strokeStyle = AREA_STYLE.ghost; ctx.lineWidth = 1; ctx.setLineDash([]);
    for (const g of scene.ghosts || []) {
      if (g.boundary) { path(g.boundary, true); ctx.stroke(); }
      for (const r of g.roads || []) { path(r.coords, false); ctx.stroke(); }
    }
    for (const c of scene.children || []) {
      const sel = c.id === scene.selectedId;
      path(c.boundary, true);
      ctx.fillStyle = sel ? AREA_STYLE.selectedFill : c.id === hover ? AREA_STYLE.childHoverFill : AREA_STYLE.childFill;
      ctx.fill();
      ctx.strokeStyle = sel ? AREA_STYLE.selectedLine : AREA_STYLE.childLine; ctx.lineWidth = sel ? 2 : 0.8; ctx.stroke();
    }
    if (scene.boundary) {
      ctx.setLineDash([6, 4]); ctx.strokeStyle = AREA_STYLE.boundary; ctx.lineWidth = 1.2;
      path(scene.boundary, true); ctx.stroke(); ctx.setLineDash([]);
    }
    for (const hname of HIERARCHY_ORDER) {
      const s = ROAD_STYLE[hname];
      ctx.strokeStyle = s.color; ctx.lineWidth = s.width; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      ctx.setLineDash(s.dash ? s.dash.map(d => d * s.width * 2) : []);
      for (const r of scene.roads || []) {
        if (r.hierarchy !== hname) continue;
        path(progress >= 1 || r.static ? r.coords : truncatePolyline(r.coords, progress), false); ctx.stroke();
      }
    }
    ctx.setLineDash([]);
    ctx.fillStyle = AREA_STYLE.node;
    for (const n of scene.nodes || []) { const [x, y] = toPx(n.xy); ctx.beginPath(); ctx.arc(x, y, 2.4, 0, Math.PI * 2); ctx.fill(); }
    ctx.fillStyle = '#d1d1d6'; ctx.font = '11px -apple-system, "SF Pro Text", "PingFang SC", sans-serif'; ctx.textAlign = 'center';
    for (const c of scene.children || []) if (c.label) { const [x, y] = toPx(c.centre || centroid(c.boundary)); ctx.fillText(c.label, x, y + 4); }
  }

  const hit = (x, y) => {
    const p = toBNGpx(x, y);
    return (scene.children || []).find(c => pointInPolygon(p, c.boundary))?.id ?? null;
  };

  let drag = null;
  canvas.addEventListener('pointerdown', e => { drag = { x: e.clientX, y: e.clientY, moved: false }; canvas.setPointerCapture(e.pointerId); });
  canvas.addEventListener('pointermove', e => {
    const r = canvas.getBoundingClientRect();
    if (drag) {
      const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
      if (Math.abs(dx) + Math.abs(dy) > 2) drag.moved = true;
      view.cx -= dx * view.mpp; view.cy += dy * view.mpp;
      drag.x = e.clientX; drag.y = e.clientY; draw();
    } else {
      const id = hit(e.clientX - r.left, e.clientY - r.top);
      if (id !== hover) { hover = id; canvas.style.cursor = id ? 'pointer' : ''; draw(); }
    }
  });
  canvas.addEventListener('pointerup', e => {
    const r = canvas.getBoundingClientRect();
    if (drag && !drag.moved) { const id = hit(e.clientX - r.left, e.clientY - r.top); if (id) opts.onSelect?.(id); }
    drag = null;
  });
  canvas.addEventListener('dblclick', e => {
    const r = canvas.getBoundingClientRect();
    const id = hit(e.clientX - r.left, e.clientY - r.top); if (id) opts.onEnter?.(id);
  });
  canvas.addEventListener('wheel', e => {
    e.preventDefault();
    const r = canvas.getBoundingClientRect();
    const before = toBNGpx(e.clientX - r.left, e.clientY - r.top);
    view.mpp = Math.min(800, Math.max(0.5, view.mpp * Math.exp(e.deltaY * 0.0015)));
    const after = toBNGpx(e.clientX - r.left, e.clientY - r.top);
    view.cx += before[0] - after[0]; view.cy += before[1] - after[1];
    draw();
  }, { passive: false });
  new ResizeObserver(draw).observe(el);

  return {
    kind: 'canvas',
    setScene(s) { scene = s; draw(); },
    setProgress(t) { progress = t; draw(); },
    fit(ring) {
      if (!ring || ring.length < 3) return;
      const [x0, y0, x1, y1] = bbox(ring);
      view = { cx: (x0 + x1) / 2, cy: (y0 + y1) / 2,
        mpp: Math.max((x1 - x0) / Math.max(1, canvas.clientWidth - 96), (y1 - y0) / Math.max(1, canvas.clientHeight - 96)) };
      draw();
    },
    setView3D() { /* 3D needs MapLibre */ },
    resize: draw,
    destroy() { canvas.remove(); }
  };
}

export async function createMapViewer(el, opts = {}) {
  if (opts.forceCanvas || new URLSearchParams(location.search).has('offline')) {
    return createCanvasViewer(el, opts);
  }
  try {
    return await createMapLibreViewer(el, opts);
  } catch (e) {
    console.warn('Falling back to offline vector view:', e.message);
    el.querySelectorAll('.maplibregl-canvas-container, .maplibregl-control-container').forEach(n => n.remove());
    opts.onFallback?.(e);
    return createCanvasViewer(el, opts);
  }
}

export { ROAD_STYLE, AREA_STYLE, HIERARCHY_ORDER } from './palette.js?v=a10f238';
