// Paints VR ground tiles with the London map app's own look.
//
// A second, hidden MapLibre map is made inside the map page (same MapLibre module, same realm), with a copy of
// the app map's current style: theme colours, labels, every layer that is on. For each z14 tile it is moved so the
// tile fills its 1024 × 1024 canvas exactly (zoom 15, 512-px tiles), waits until drawn, and the picture is copied.
// Extrusions are hidden there (VR extrudes the buildings itself), and the app's building colour is reported so the
// VR prisms match. The app map itself is only read (getStyle), never changed.

import { mapLib } from './map_bridge.js?v=0.12';

const PX = 1024, Z = 15;

/** CSS colour → [r, g, b] 0…1, or null */
function rgb(c){
  if (typeof c !== 'string') return null;
  const g = document.createElement('canvas').getContext('2d'); g.fillStyle = '#010203'; g.fillStyle = c;
  const v = g.fillStyle; if (v === '#010203' && !/^#010203$/i.test(c)) return null;
  if (v[0] === '#') return [1, 3, 5].map(i => parseInt(v.slice(i, i + 2), 16) / 255);
  const m = v.match(/[\d.]+/g); return m ? m.slice(0, 3).map(x => +x / 255) : null;
}

export async function mapPainter(map, frame){
  const win = frame.contentWindow, lib = await mapLib(frame), style = map.getStyle();
  // the app's building colour (first extrusion layer with a plain colour)
  let building = null;
  for (const L of style.layers || []) if (L.type === 'fill-extrusion'){ building = rgb(L.paint?.['fill-extrusion-color']); if (building) break; }
  // a copy of the style without extrusions or custom layers
  const copy = { ...style, layers: (style.layers || []).filter(L => L.type !== 'custom').map(L => L.type === 'fill-extrusion' ? { ...L, layout: { ...(L.layout || {}), visibility: 'none' } } : L) };
  delete copy.terrain;
  const div = win.document.createElement('div');
  div.style.cssText = `position:fixed;left:-${PX + 64}px;top:0;width:${PX}px;height:${PX}px;pointer-events:none;visibility:visible`;
  win.document.body.append(div);
  const MapC = lib.Map || lib.default.Map;
  const m = new MapC({ container: div, style: copy, interactive: false, attributionControl: false, pixelRatio: 1, preserveDrawingBuffer: true,
    fadeDuration: 0, center: map.getCenter(), zoom: Z, pitch: 0, bearing: 0, renderWorldCopies: false });
  await new Promise(res => { if (m.loaded()) res(); else { m.once('load', res); setTimeout(res, 15000); } });

  let chain = Promise.resolve(), gone = false;
  const idle = ms => new Promise(res => { let d = false; const f = () => { if (!d){ d = true; res(); } }; m.once('idle', f); setTimeout(f, ms); m.triggerRepaint(); });
  /** z14 tile x, y → a canvas with the app's look, or null if skipped. alive(): still wanted? */
  function render(x, y, alive = () => true){
    const job = chain.then(async () => {
      if (gone || !alive()) return null;
      const n = 2 ** 14, lon = (x + 0.5) / n * 360 - 180, lat = Math.atan(Math.sinh(Math.PI * (1 - 2 * (y + 0.5) / n))) * 180 / Math.PI;
      m.jumpTo({ center: [lon, lat], zoom: Z, pitch: 0, bearing: 0 });
      await idle(10000);
      if (gone) return null;
      const src = m.getCanvas(), c = document.createElement('canvas'); c.width = c.height = PX;
      c.getContext('2d').drawImage(src, 0, 0, src.width, src.height, 0, 0, PX, PX);
      return c;
    });
    chain = job.catch(() => null);
    return job;
  }
  return { render, building, dispose(){ gone = true; try { m.remove(); } catch (e){} div.remove(); } };
}
