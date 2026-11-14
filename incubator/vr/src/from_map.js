// The London map (incubator/google-map-live) → VR, in the same page, so nothing in the map is lost.
//   1. the camera turns north-up and flat for a moment, the map's own canvas is captured
//      (whatever is on: theme, lighting, flood, drainage, terrain, roads, labels, the site boundary …)
//   2. OSM buildings already loaded by the map are extruded from render_height / render_min_height
//   3. the camera goes back exactly as it was, and the VR view opens over the map
// Closing the view (or leaving the headset) returns to the map as it was. Call: openFromMap(map, 'zh' | 'en').

import { open } from './xr_view.js?v=0.12';
import { buildingMesh, osmBuildingsIn } from './osm.js?v=0.12';

const R = 6378137, MAX_TEX = 4096, MIN_ZOOM = 15;
const merc = ([lon, lat]) => [R * lon * Math.PI / 180, R * Math.log(Math.tan(Math.PI / 4 + lat * Math.PI / 360))];
const wait = (ms) => new Promise(r => setTimeout(r, ms));
const idle = (map, ms) => new Promise(res => { let done = false; const fin = () => { if (!done){ done = true; res(); } }; map.once('idle', fin); setTimeout(fin, ms); map.triggerRepaint(); });

function busy(lang){
  const d = document.createElement('div');
  d.style.cssText = 'position:fixed;inset:0;z-index:9998;display:grid;place-items:center;background:rgba(10,10,12,.55);color:#f5f5f7;font:14px -apple-system,"PingFang SC",sans-serif;backdrop-filter:blur(6px)';
  d.textContent = lang === 'zh' ? '正在把当前地图带进 VR…' : 'Taking this map into VR…'; document.body.append(d); return d;
}

/** Captures the map's canvas right after a frame is drawn (no preserveDrawingBuffer needed). */
function capture(map){
  return new Promise(res => { map.once('render', () => { const src = map.getCanvas(), k = Math.min(1, MAX_TEX / Math.max(src.width, src.height)),
    c = document.createElement('canvas'); c.width = Math.round(src.width * k); c.height = Math.round(src.height * k); c.getContext('2d').drawImage(src, 0, 0, c.width, c.height); res(c); }); map.triggerRepaint(); });
}

/** Building footprints the map has loaded, from every vector source that carries a 'building' layer. */
function buildingFeatures(map){
  const out = [];
  for (const [id, src] of Object.entries(map.getStyle().sources || {})){ if (src.type !== 'vector') continue;
    try { out.push(...map.querySourceFeatures(id, { sourceLayer: 'building' })); } catch (e){} }
  return out;
}

export async function openFromMap(map, lang = 'zh', viewOpt = {}){
  const note = busy(lang), cam = { center: map.getCenter(), zoom: map.getZoom(), pitch: map.getPitch(), bearing: map.getBearing() };
  let shot, bounds, feats;
  try {
    map.jumpTo({ pitch: 0, bearing: 0, zoom: Math.max(cam.zoom, MIN_ZOOM) });   // zoomed far out, buildings would be dust on a table
    await idle(map, 12000); await wait(80);
    shot = await capture(map); bounds = map.getBounds(); feats = buildingFeatures(map);
  } finally { map.jumpTo(cam); note.remove(); }

  // plan metres: x east, y north, (0, 0) at the south-west corner; Web Mercator × cos(lat) is true distance at this scale
  const sw = merc([bounds.getWest(), bounds.getSouth()]), ne = merc([bounds.getEast(), bounds.getNorth()]);
  const K = Math.cos(map.getCenter().lat * Math.PI / 180), W = (ne[0] - sw[0]) * K, H = (ne[1] - sw[1]) * K;
  const plan = q => { const m = merc(q); return [(m[0] - sw[0]) * K, (m[1] - sw[1]) * K]; };
  const list = [];
  for (const f of feats){ const g = f.geometry, p = f.properties || {}; if (!g || p.hide_3d) continue;
    const polys = g.type === 'Polygon' ? [g.coordinates] : g.type === 'MultiPolygon' ? g.coordinates : [];
    for (const poly of polys) if (poly[0] && poly[0].length > 3) list.push({ ring: poly[0].map(plan), h: +p.render_height || +p.height || 8, h0: +p.render_min_height || 0 }); }
  // the map loads buildings only from zoom 13 up: when it has none here, read them from the OSM tiles directly
  let B = buildingMesh(list, W / 2, H / 2, W, H), extraNote = '';
  if (B.count < 20){
    const n2 = busy(lang);
    try {
      const r = await osmBuildingsIn(bounds.getWest(), bounds.getSouth(), bounds.getEast(), bounds.getNorth(), plan,
        { maxTiles: 9, onProgress: (d, n) => { n2.textContent = (lang === 'zh' ? '正在读取 OSM 建筑… ' : 'Reading OSM buildings… ') + d + ' / ' + n; } });
      B = buildingMesh(r.list, W / 2, H / 2, W, H);
      if (r.partial) extraNote = lang === 'zh' ? '范围太大，只显示中心约 4 公里内的建筑；放大地图再按 VR 可以看到当前范围全部建筑' : 'The view is large: buildings only within about 4 km of the centre; zoom in for all of them';
    } catch (e){ console.error(e); extraNote = (lang === 'zh' ? '没能读取 OSM 建筑：' : 'Could not read OSM buildings: ') + (e.message || e); }
    finally { n2.remove(); }
  }
  const cell = W / 40, nx = 41, ny = Math.max(2, Math.round(H / cell) + 1);

  const api = {
    D: { landMask: null, fixed: { streets: [], bridges: [] } }, nx, ny, cell, ENV: null, FR: null, DR: null,
    ground: shot, groundHalf: [W / 2, H / 2], extra: B.count ? B.mesh : null, buildings: B.count,
    outlines: [], view: { exag: 1 }, streets: () => [], lines: () => [], finished: () => true
  };
  const c = map.getCenter(), km = (Math.max(W, H) / 1000).toFixed(1);
  if (cam.zoom < MIN_ZOOM) extraNote = (lang === 'zh' ? `地图缩得太远（${cam.zoom.toFixed(1)} 级），VR 按 ${MIN_ZOOM} 级、当前中心生成` : `The map was far out (zoom ${cam.zoom.toFixed(1)}); VR uses zoom ${MIN_ZOOM} at the same centre`) + (extraNote ? ' · ' + extraNote : '');
  api.note = extraNote;
  return open(api, lang, { ...viewOpt, title: (lang === 'zh' ? '伦敦地图 → VR · ' : 'London map → VR · ') + c.lat.toFixed(4) + ', ' + c.lng.toFixed(4) + ' · ' + km + ' km' });
}
