/* Reference hook: open Tensor Studio from the London map (incubator/google-map-live).
 *
 * NOT wired in yet: copy it into google-map-live/scripts/ when you connect the two apps.
 * It needs nothing from Tensor Studio's code; the two talk only through
 *   window.__TENSOR_SITE_INPUT__ = {ring, features, elevation, lang, close, fail}
 * set on the map page before it frames ../tensor-studio/index.html (same origin).
 * Tensor Studio builds its own data from that (scripts/site_builder.js).
 *
 * What it collects from the map that is already open:
 *   · streets, rail, water, watercourses, buildings: the loaded OpenFreeMap vector tiles
 *     (OpenMapTiles schema: transportation, water, waterway, building);
 *   · terrain: the OS Terrain 50 raster (50 m) the flood and parcel tools use, as a sampler.
 *
 * Wiring (as tried on 13 Nov, v3.34.5):
 *   index.html, site card:  <button id="tensorStudioOpen" ...>Tensor Studio · Street growth</button>
 *                           (and add #tensorStudioEntry to the CSS rule that hides the card's other rows)
 *   index.html, createLocalFloodUI({... onOpenTensorStudio: ({polygon}) =>
 *       import('./scripts/tensor_studio_site.js').then(m => m.openTensorStudio({map: osmMap, polygon, assetUrl,
 *         demBounds: DRAINAGE_3857, demWidth: DRAINAGE_3857.baseWidth50m, demHeight: DRAINAGE_3857.baseHeight50m, say})) })
 *   local_flood_ui.js: enable 'tensorStudioOpen' with the parcel button; on click call
 *       onOpenTensorStudio({polygon}) once the boundary is confirmed and prepared.
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
let overlay = null, frame = null, session = null;
const lang = () => String(document.documentElement.lang || 'zh').toLowerCase().startsWith('en') ? 'en' : 'zh';
function ensureOverlay(){
  if (overlay) return;
  overlay = document.createElement('div');
  overlay.id = 'tensorStudioOverlay';
  overlay.style.cssText = 'position:fixed;inset:0;z-index:4000;background:#000;display:flex;align-items:center;justify-content:center;color:#98989d;font:13px -apple-system,BlinkMacSystemFont,"PingFang SC","Microsoft YaHei",sans-serif';
  overlay.innerHTML = '<div id="tensorStudioWait" role="status" aria-live="polite">Preparing the Tensor Studio site…</div>';
  document.body.append(overlay);
  document.addEventListener('keydown', onKey);
}
function onKey(event){ if (event.key === 'Escape' && overlay) closeTensorStudio(); }
export function closeTensorStudio(){
  document.removeEventListener('keydown', onKey);
  overlay?.remove(); overlay = null; frame = null;
  try { delete window.__TENSOR_SITE_INPUT__; } catch (error){ window.__TENSOR_SITE_INPUT__ = undefined; }
}
function showFrame(){
  const wait = overlay.querySelector('#tensorStudioWait'); if (wait) wait.remove();
  if (!frame){
    frame = document.createElement('iframe');
    frame.title = 'Tensor Studio';
    frame.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;border:0;background:#000';
    frame.src = new URL('../../tensor-studio/index.html', import.meta.url).href;   // from google-map-live/scripts/
    overlay.append(frame);
    frame.addEventListener('load', () => { try { frame.contentWindow.addEventListener('keydown', onKey); } catch (error){} });
  }
}

function fail(error){
  console.error('Tensor Studio failed', error);
  session?.say?.('Tensor Studio could not open this site: ' + (error?.message || error), true);
  closeTensorStudio();
}

export async function openTensorStudio({map, polygon, assetUrl, demBounds, demWidth, demHeight, say}){
  const ring = polygon?.[0];
  if (!ring || ring.length < 4) throw new Error('Close the red site boundary first');
  ensureOverlay();
  try {
    const features = collectSiteFeatures(map, ring);
    const elevation = await demSampler({url: new URL(assetUrl('assets/drainage_area/dem50_log16.webp'), location.href).href,
      bounds: demBounds, width: demWidth, height: demHeight}).catch(error => { console.warn('Tensor Studio: no elevation', error); return null; });
    session = {say};
    window.__TENSOR_SITE_INPUT__ = {ring, features, elevation, lang: lang(), close: closeTensorStudio, fail};
    showFrame();
  } catch (error){ session = {say}; fail(error); }
}
