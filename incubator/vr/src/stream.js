// OpenStreetMap that loads as you move, like a web map: tiles near the point you look at, at the zoom that suits how far
// you see (z14 ≈ 1.5 km in London with buildings … z0 the whole world), are fetched, painted and (z13–14) extruded; tiles that drift out of range are dropped. xr_view asks for tiles and draws them.
//
// Plan metres: x east, y north, (0, 0) at the starting point; Web Mercator × cos(start latitude).
// Model space (as in xr_view): x = plan x, y up, z = −plan y.

import { decodeMVT, paintLayers, buildingMesh, tileTemplate, GROUND_COLOUR } from './osm.js?v=0.16';

const ZMAX = 14, R = 6378137, WORLD = 2 * Math.PI * R;
const tileM = z => WORLD / 2 ** z;   // Web Mercator metres per tile side at zoom z

export function osmStream(lat, lon, opt = {}){
  const K = Math.cos(lat * Math.PI / 180), mx0 = R * lon * Math.PI / 180, my0 = R * Math.log(Math.tan(Math.PI / 4 + lat * Math.PI / 360));
  const PX = opt.texture || 512;
  let tpl = opt.tiles || null;
  // tile ↔ plan, at zoom z
  const tileX = (z, px) => Math.floor((px / K + mx0 + WORLD / 2) / tileM(z)), tileY = (z, py) => Math.floor((WORLD / 2 - (py / K + my0)) / tileM(z));
  const planOf = (z, tx, ty) => [((tx * tileM(z) - WORLD / 2) - mx0) * K, ((WORLD / 2 - ty * tileM(z)) - my0) * K];   // north-west corner of a tile
  const sizeOf = z => tileM(z) * K;
  const parse = key => key.split('/').map(Number);

  return {
    origin: { lat, lon }, tileSize: sizeOf(ZMAX), painter: opt.painter || null,
    /** plan metres → { lat, lng } */
    toLatLng(px, py){ const mx = px / K + mx0, my = py / K + my0; return { lng: mx / R * 180 / Math.PI, lat: (2 * Math.atan(Math.exp(my / R)) - Math.PI / 2) * 180 / Math.PI }; },
    /** the zoom that puts about three tiles across a circle of radius r (14 = streets with buildings … 0 = the world) */
    zoomFor(r){ return Math.max(0, Math.min(ZMAX, Math.round(Math.log2(3 * sizeOf(0) / (2 * r))))); },
    /** keys "z/x/y" of tiles whose square touches the circle (px, py, r) in plan metres, nearest first */
    near(px, py, r, z = this.zoomFor(r)){
      const out = [], n = 2 ** z, size = sizeOf(z);
      const xa = Math.max(0, tileX(z, px - r)), xb = Math.min(n - 1, tileX(z, px + r)), ya = Math.max(0, tileY(z, py + r)), yb = Math.min(n - 1, tileY(z, py - r));
      for (let x = xa; x <= xb; x++) for (let y = ya; y <= yb; y++){
        const [x0, y1] = planOf(z, x, y), x1 = x0 + size, y0 = y1 - size;
        const dx = Math.max(x0 - px, 0, px - x1), dy = Math.max(y0 - py, 0, py - y1), d = Math.hypot(dx, dy);
        if (d <= r) out.push({ key: z + '/' + x + '/' + y, d: Math.hypot((x0 + x1) / 2 - px, (y0 + y1) / 2 - py) }); }
      return out.sort((a, b) => a.d - b.d).map(o => o.key);
    },
    zOf(key){ return parse(key)[0]; },
    /** the same tile drawn again in the app's (new) look */
    repaint(key, alive){ if (!opt.painter) return Promise.resolve(null); const [z, x, y] = parse(key); return opt.painter.render(z, x, y, alive); },
    /** one tile → { canvas, quad: [x0, y0, x1, y1] plan metres, mesh: { v, i } model space, count } */
    async load(key, alive = () => true){
      const [z, x, y] = parse(key), size = sizeOf(z);
      if (!tpl) tpl = await tileTemplate();
      const ac = new AbortController(), timer = setTimeout(() => ac.abort(), 20000);
      let res; try { res = await fetch(tpl.replace('{z}', z).replace('{x}', x).replace('{y}', y), { signal: ac.signal }); } catch (e){ throw new Error(e.name === 'AbortError' ? 'timeout' : (e.message || 'network')); } finally { clearTimeout(timer); }
      if (!res.ok) throw new Error('OSM tile ' + key + ': HTTP ' + res.status);
      let buf = new Uint8Array(await res.arrayBuffer());
      if (buf[0] === 0x1f && buf[1] === 0x8b && typeof DecompressionStream !== 'undefined')   // gzip body without a Content-Encoding header
        buf = new Uint8Array(await new Response(new Blob([buf]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer());
      const t = { x, y, layers: decodeMVT(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength)) };
      // ground, tile-local: tile units → pixels (y down in both); line widths in metres, at least a pixel
      const cv = document.createElement('canvas'); cv.width = cv.height = PX; const g = cv.getContext('2d');
      g.fillStyle = GROUND_COLOUR; g.fillRect(0, 0, PX, PX);   // land; seas come as water polygons at every zoom
      const bld = paintLayers(g, [t], (tt, ext) => q => [q[0] / ext * PX, q[1] / ext * PX], PX / size);
      // buildings (z13–14 only): keep those whose centroid is inside this tile, so neighbours never draw one twice
      let B = { mesh: null, count: 0 };
      if (z >= 13){ const [x0, y1] = planOf(z, x, y), plan = ext => q => [x0 + q[0] / ext * size, y1 - q[1] / ext * size], list = [];
        for (const { f } of bld){ const P = plan(f.extent), h = +f.props.render_height || +f.props.height || 8, h0 = +f.props.render_min_height || 0;
          for (const part of f.parts){ if (part.length < 4) continue; list.push({ ring: part.map(P), h, h0 }); } }
        B = buildingMesh(list.filter(o => area(o.ring) < 0), 0, 0, size, size, x0, y1 - size, [1, 1, 1]); }   // white; xr_view tints them with the app's building colour
      // with the map app at hand: the same tile in the app's own look follows when it is drawn
      const upgrade = opt.painter ? opt.painter.render(z, x, y, alive) : null;
      const [x0, y1] = planOf(z, x, y);
      return { z, canvas: cv, quad: [x0, y1 - size, x0 + size, y1], mesh: B.mesh, count: B.count, upgrade };
    }
  };
}
const area = r => { let s = 0; for (let i = 0, n = r.length; i < n; i++){ const a = r[i], c = r[(i + 1) % n]; s += a[0] * c[1] - c[0] * a[1]; } return s; };

/** A viewer handle for xr_view: no fixed model, only the tile stream. */
export function streamApi(lat, lon, opt = {}){
  return { D: { landMask: null, fixed: { streets: [], bridges: [] } }, nx: 3, ny: 3, cell: 1500, ENV: null, FR: null, DR: null,
    stream: osmStream(lat, lon, opt), view: { exag: 1 }, outlines: [], streets: () => [], lines: () => [], finished: () => true };
}
