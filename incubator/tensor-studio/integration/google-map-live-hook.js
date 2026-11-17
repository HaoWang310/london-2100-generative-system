/* Reference copy of google-map-live/scripts/tensor_studio_site.js (wired in since v3.37): opens Tensor Studio over
 * the London map. The two apps talk only through window.__TENSOR_SITE_INPUT__ = {ring, features, elevation, lang,
 * close, fail, view, mapTheme}: Tensor Studio builds its site from that (scripts/site_builder.js) and calls view({lng, lat,
 * zoom, bearing}) whenever its view moves so the map underneath follows (view(null) when it shows its own basemap).
 * Keep the two files the same.
 */
const R = 6378137;
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
const merc = (lon, lat) => [R * lon * Math.PI / 180, R * Math.log(Math.tan(Math.PI / 4 + clamp(lat, -85, 85) * Math.PI / 360))];

let demCache = null;

/* ---------------------------------------------------------------- OS Terrain 50, as parcel_generator_worker.js decodes it */
async function demSampler({url, bounds, width, height}){
  if (demCache?.url === url) return demCache.sample;
  const response = await fetch(url, {cache: 'force-cache'});
  if (!response.ok) throw new Error('Elevation raster read failed HTTP ' + response.status);
  const image = await createImageBitmap(await response.blob());
  if (image.width !== width || image.height !== height) throw new Error('Elevation raster size does not match its registered extent');
  const canvas = new OffscreenCanvas(width, height), ctx = canvas.getContext('2d', {willReadFrequently: true});
  ctx.drawImage(image, 0, 0); image.close();
  const rgba = ctx.getImageData(0, 0, width, height).data, codes = new Uint16Array(width * height);
  for (let i = 0; i < codes.length; i++) codes[i] = (rgba[i * 4] << 8) | rgba[i * 4 + 1];
  const b = bounds;
  const sample = (lng, lat) => {
    const [x, y] = merc(lng, lat);
    if (x < b.left || x > b.right || y < b.bottom || y > b.top) return NaN;
    const sx = (x - b.left) / (b.right - b.left) * width - .5, sy = (b.top - y) / (b.top - b.bottom) * height - .5;
    const x0 = clamp(Math.floor(sx), 0, width - 1), x1 = clamp(x0 + 1, 0, width - 1), y0 = clamp(Math.floor(sy), 0, height - 1), y1 = clamp(y0 + 1, 0, height - 1);
    const tx = clamp(sx - Math.floor(sx), 0, 1), ty = clamp(sy - Math.floor(sy), 0, 1);
    const at = (c, r) => { const v = codes[r * width + c]; return v ? -100 + (v - 1) * .1 : NaN; };
    const v = [at(x0, y0), at(x1, y0), at(x0, y1), at(x1, y1)], good = v.filter(Number.isFinite);
    if (!good.length) return NaN;
    for (let i = 0; i < 4; i++) if (!Number.isFinite(v[i])) v[i] = good[0];
    return (v[0] * (1 - tx) + v[1] * tx) * (1 - ty) + (v[2] * (1 - tx) + v[3] * tx) * ty;
  };
  demCache = {url, sample};
  return sample;
}

/* ---------------------------------------------------------------- the map's own vector tiles round the site */
const linesOf = g => g.type === 'LineString' ? [g.coordinates] : g.type === 'MultiLineString' ? g.coordinates : [];
const polysOf = g => g.type === 'Polygon' ? [g.coordinates] : g.type === 'MultiPolygon' ? g.coordinates : [];
function geomBox(g){ let w = Infinity, s = Infinity, e = -Infinity, n = -Infinity;
  const walk = c => { if (typeof c[0] === 'number'){ w = Math.min(w, c[0]); e = Math.max(e, c[0]); s = Math.min(s, c[1]); n = Math.max(n, c[1]); } else for (const x of c) walk(x); };
  walk(g.coordinates); return [w, s, e, n]; }

export function collectSiteFeatures(map, ring, padM = 450){
  const lats = ring.map(p => p[1]), lngs = ring.map(p => p[0]), lat = (Math.min(...lats) + Math.max(...lats)) / 2;
  const dLat = padM / 111320, dLng = padM / (111320 * Math.max(.15, Math.cos(lat * Math.PI / 180)));
  const box = [Math.min(...lngs) - dLng, Math.min(...lats) - dLat, Math.max(...lngs) + dLng, Math.max(...lats) + dLat];
  const hit = b => b[0] <= box[2] && b[2] >= box[0] && b[1] <= box[3] && b[3] >= box[1];
  const out = {roads: [], rails: [], waters: [], waterways: [], buildings: []}, seen = new Set();
  const sources = Object.entries(map.getStyle()?.sources || {}).filter(([, s]) => s.type === 'vector').map(([id]) => id);
  for (const source of sources) for (const layer of ['transportation', 'water', 'waterway', 'building']){
    let items = [];
    try { items = map.querySourceFeatures(source, {sourceLayer: layer}) || []; } catch (error){ continue; }
    for (const f of items){
      const g = f.geometry; if (!g?.coordinates || !hit(geomBox(g))) continue;
      const head = JSON.stringify(g.coordinates).slice(0, 160), key = layer + '|' + g.type + '|' + head + '|' + JSON.stringify(g.coordinates).length;
      if (seen.has(key)) continue; seen.add(key);
      const p = f.properties || {}, cls = String(p.class || '').toLowerCase(), sub = String(p.subclass || '').toLowerCase(), brunnel = String(p.brunnel || '').toLowerCase();
      if (layer === 'transportation'){
        if (/ferry|aerialway|transit|pier/.test(cls)) continue;
        for (const coords of linesOf(g)){
          if (cls === 'rail'){ if (!/tram/.test(sub)) out.rails.push({coords, cls: sub || 'rail', brunnel}); }
          else out.roads.push({coords, cls, brunnel});
        }
      } else if (layer === 'waterway'){
        for (const coords of linesOf(g)) out.waterways.push({coords, cls, brunnel});
      } else if (layer === 'water'){
        if (brunnel === 'tunnel') continue;
        out.waters.push(...polysOf(g));
      } else {
        const h = p.hide_3d; if (h === true || h === 'true' || h === 1) continue;
        out.buildings.push(...polysOf(g));
      }
    }
  }
  return out;
}

/* ---------------------------------------------------------------- the overlay */
let overlay = null, frame = null, session = null, onCloseCb = null, camera = null, hiddenLayers = [];
const lang = () => String(document.documentElement.lang || 'zh').toLowerCase().startsWith('en') ? 'en' : 'zh';
function ensureOverlay(){
  if (overlay) return;
  overlay = document.createElement('div');
  overlay.id = 'tensorStudioOverlay';
  overlay.style.cssText = 'position:fixed;inset:0;z-index:4000;background:rgba(0,0,0,.55);display:flex;align-items:center;justify-content:center;color:#98989d;font:13px -apple-system,BlinkMacSystemFont,"PingFang SC","Microsoft YaHei",sans-serif';
  overlay.innerHTML = '<div id="tensorStudioWait" role="status" aria-live="polite">' + 'Preparing the Tensor Studio site…' + '</div>';
  document.body.append(overlay);
  document.addEventListener('keydown', onKey);
  // (v3.39.0) only the map itself shows through Tensor Studio's transparent page: the map page's own panels, controls
  // and badges are hidden while it is open (visibility, so nothing moves), and come back on close
  if (!document.getElementById('tensorStudioHideUI')){
    const st = document.createElement('style'); st.id = 'tensorStudioHideUI';
    st.textContent = 'body.tensorStudioOpen > :not(#osmMap):not(#googleMap):not(#tensorStudioOverlay):not(script):not(style){visibility:hidden!important}' +
      'body.tensorStudioOpen #osmMap .maplibregl-control-container{visibility:hidden!important}';
    document.head.append(st);
  }
  document.body.classList.add('tensorStudioOpen');
}
function onKey(event){ if (event.key === 'Escape' && overlay) closeTensorStudio(); }
export function closeTensorStudio(){
  const was = !!overlay;
  document.removeEventListener('keydown', onKey);
  overlay?.remove(); overlay = null; frame = null;
  document.body.classList.remove('tensorStudioOpen');
  restoreMap();
  try { delete window.__TENSOR_SITE_INPUT__; } catch (error){ window.__TENSOR_SITE_INPUT__ = undefined; }
  const cb = onCloseCb; onCloseCb = null; if (was && cb) cb();
}
export const tensorStudioOpen = () => !!overlay;

/* ---------------------------------------------------------------- (v3.38) the map under Tensor Studio follows its view */
let hostMap = null;
function takeMap(map){   // remember where the map was and hide the red selection while Tensor Studio is open
  hostMap = map;
  if (camera) return;
  camera = {center: map.getCenter(), zoom: map.getZoom(), bearing: map.getBearing(), pitch: map.getPitch()};
  hiddenLayers = (map.getStyle()?.layers || []).map(l => l.id).filter(id => id.startsWith('site-selection-'));
  for (const id of hiddenLayers){ try { map.setLayoutProperty(id, 'visibility', 'none'); } catch (error){} }
}
function followView(v){
  if (!hostMap) return;
  if (!v){ if (camera){ try { hostMap.jumpTo(camera); } catch (error){} } return; }   // Tensor Studio shows its own basemap: the map rests where it was
  try { hostMap.jumpTo({center: [v.lng, v.lat], zoom: Math.max(0, Math.min(22, v.zoom)), bearing: v.bearing, pitch: 0}); } catch (error){}
}
function restoreMap(){
  if (!hostMap || !camera) return;
  for (const id of hiddenLayers){ try { hostMap.setLayoutProperty(id, 'visibility', 'visible'); } catch (error){} }
  hiddenLayers = [];
  try { hostMap.jumpTo(camera); } catch (error){}
  camera = null;
}
/* (v3.39.0) the map only holds the vector tiles of its current view, so before the site's streets, water and buildings
 * are read, the view is set to the site and its 450 m surround at a zoom that carries buildings (14+), and the tiles
 * are given a moment to arrive */
function loadedAround(map, ring, padM = 450){
  return new Promise(resolve => {
    const lats = ring.map(p => p[1]), lngs = ring.map(p => p[0]), lat = (Math.min(...lats) + Math.max(...lats)) / 2;
    const dLat = padM / 111320, dLng = padM / (111320 * Math.max(.15, Math.cos(lat * Math.PI / 180)));
    try {
      map.fitBounds([[Math.min(...lngs) - dLng, Math.min(...lats) - dLat], [Math.max(...lngs) + dLng, Math.max(...lats) + dLat]], {padding: 20, duration: 0, bearing: 0, pitch: 0});
      if (map.getZoom() < 14) map.jumpTo({zoom: 14});
    } catch (error){ resolve(); return; }
    let done = false; const finish = () => { if (!done){ done = true; resolve(); } };
    const timer = setTimeout(finish, 8000);
    const check = () => { if (map.loaded() && map.areTilesLoaded()){ clearTimeout(timer); finish(); } else if (!done) map.once('idle', check); };
    map.once('idle', check);
  });
}
function showFrame(){
  const wait = overlay.querySelector('#tensorStudioWait'); if (wait) wait.remove();
  if (!frame){
    frame = document.createElement('iframe');
    frame.title = 'Tensor Studio';
    frame.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;border:0;background:transparent';
    overlay.style.background = 'transparent';   // (v3.38) the London map shows through: Tensor Studio paints only the site and its panels
    frame.src = new URL('../../tensor-studio/index.html?r=' + Date.now(), import.meta.url).href;   // from google-map-live/scripts/; ?r= defeats the Pages cache so a new Tensor Studio arrives at once
    overlay.append(frame);
    frame.addEventListener('load', () => { try { frame.contentWindow.addEventListener('keydown', onKey); } catch (error){} });
  }
}

function fail(error){
  console.error('Tensor Studio failed', error);
  session?.say?.('Tensor Studio could not open this site: ' + (error?.message || error), true);
  closeTensorStudio();
}

export async function openTensorStudio({map, polygon, assetUrl, demBounds, demWidth, demHeight, say, onClose, mapTheme}){
  onCloseCb = onClose || null;
  const ring = polygon?.[0];
  if (!ring || ring.length < 4) throw new Error('Close the red site boundary first');
  ensureOverlay();
  try {
    takeMap(map);
    await loadedAround(map, ring);
    const features = collectSiteFeatures(map, ring);
    const elevation = await demSampler({url: new URL(assetUrl('assets/drainage_area/dem50_log16.webp'), location.href).href,
      bounds: demBounds, width: demWidth, height: demHeight}).catch(error => { console.warn('Tensor Studio: no elevation', error); return null; });
    session = {say};
    if (!frame && overlay && !overlay.isConnected) ensureOverlay();
    window.__TENSOR_SITE_INPUT__ = {ring, features, elevation, lang: lang(), close: closeTensorStudio, fail, view: followView, mapTheme: mapTheme || null};
    showFrame();
  } catch (error){ session = {say}; fail(error); }
}
