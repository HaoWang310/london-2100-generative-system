// OpenStreetMap that loads as you move, like a web map: z14 tiles (≈ 1.5 km in London) near the point you look at
// are fetched, painted and extruded; tiles that drift out of range are dropped. xr_view asks for tiles and draws them.
//
// Plan metres: x east, y north, (0, 0) at the starting point; Web Mercator × cos(start latitude).
// Model space (as in xr_view): x = plan x, y up, z = −plan y.

import { decodeMVT, paintLayers, buildingMesh, tileTemplate, GROUND_COLOUR } from './osm.js?v=0.8';

const Z = 14, R = 6378137, WORLD = 2 * Math.PI * R, TILE = WORLD / 2 ** Z;

export function osmStream(lat, lon, opt = {}){
  const K = Math.cos(lat * Math.PI / 180), mx0 = R * lon * Math.PI / 180, my0 = R * Math.log(Math.tan(Math.PI / 4 + lat * Math.PI / 360));
  const PX = opt.texture || 512;
  let tpl = opt.tiles || null;
  // tile ↔ plan
  const tileX = px => Math.floor((px / K + mx0 + WORLD / 2) / TILE), tileY = py => Math.floor((WORLD / 2 - (py / K + my0)) / TILE);
  const planOf = (tx, ty) => [((tx * TILE - WORLD / 2) - mx0) * K, ((WORLD / 2 - ty * TILE) - my0) * K];   // north-west corner of a tile
  const sizeM = TILE * K;

  return {
    origin: { lat, lon }, tileSize: sizeM,
    /** plan metres → { lat, lng } */
    toLatLng(px, py){ const mx = px / K + mx0, my = py / K + my0; return { lng: mx / R * 180 / Math.PI, lat: (2 * Math.atan(Math.exp(my / R)) - Math.PI / 2) * 180 / Math.PI }; },
    /** keys of tiles whose square touches the circle (px, py, r) in plan metres, nearest first */
    near(px, py, r){
      const out = [];
      for (let x = tileX(px - r); x <= tileX(px + r); x++) for (let y = tileY(py + r); y <= tileY(py - r); y++){
        const [x0, y1] = planOf(x, y), x1 = x0 + sizeM, y0 = y1 - sizeM;
        const dx = Math.max(x0 - px, 0, px - x1), dy = Math.max(y0 - py, 0, py - y1), d = Math.hypot(dx, dy);
        if (d <= r) out.push({ key: x + '/' + y, d: Math.hypot((x0 + x1) / 2 - px, (y0 + y1) / 2 - py) }); }
      return out.sort((a, b) => a.d - b.d).map(o => o.key);
    },
    /** one tile → { canvas, quad: [x0, y0, x1, y1] plan metres, mesh: { v, i } model space, count } */
    async load(key){
      const [x, y] = key.split('/').map(Number);
      if (!tpl) tpl = await tileTemplate();
      const ac = new AbortController(), timer = setTimeout(() => ac.abort(), 20000);
      let res; try { res = await fetch(tpl.replace('{z}', Z).replace('{x}', x).replace('{y}', y), { signal: ac.signal }); } catch (e){ throw new Error(e.name === 'AbortError' ? 'timeout' : (e.message || 'network')); } finally { clearTimeout(timer); }
      if (!res.ok) throw new Error('OSM tile ' + key + ': HTTP ' + res.status);
      let buf = new Uint8Array(await res.arrayBuffer());
      if (buf[0] === 0x1f && buf[1] === 0x8b && typeof DecompressionStream !== 'undefined')   // gzip body without a Content-Encoding header
        buf = new Uint8Array(await new Response(new Blob([buf]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer());
      const t = { x, y, layers: decodeMVT(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength)) };
      // ground, tile-local: tile units → pixels (y down in both)
      const cv = document.createElement('canvas'); cv.width = cv.height = PX; const g = cv.getContext('2d');
      g.fillStyle = GROUND_COLOUR; g.fillRect(0, 0, PX, PX);
      const bld = paintLayers(g, [t], (tt, ext) => q => [q[0] / ext * PX, q[1] / ext * PX], PX / sizeM);
      // buildings: keep those whose centroid is inside this tile, so neighbours never draw one twice
      const [x0, y1] = planOf(x, y), plan = ext => q => [x0 + q[0] / ext * sizeM, y1 - q[1] / ext * sizeM], list = [];
      for (const { f } of bld){ const P = plan(f.extent), h = +f.props.render_height || +f.props.height || 8, h0 = +f.props.render_min_height || 0;
        for (const part of f.parts){ if (part.length < 4) continue; list.push({ ring: part.map(P), h, h0, outer: true }); } }
      const B = buildingMesh(list.filter(o => area(o.ring) < 0), 0, 0, sizeM, sizeM, x0, y1 - sizeM);
      return { canvas: cv, quad: [x0, y1 - sizeM, x0 + sizeM, y1], mesh: B.mesh, count: B.count };
    }
  };
}
const area = r => { let s = 0; for (let i = 0, n = r.length; i < n; i++){ const a = r[i], c = r[(i + 1) % n]; s += a[0] * c[1] - c[0] * a[1]; } return s; };

/** A viewer handle for xr_view: no fixed model, only the tile stream. */
export function streamApi(lat, lon, opt = {}){
  return { D: { landMask: null, fixed: { streets: [], bridges: [] } }, nx: 3, ny: 3, cell: 1500, ENV: null, FR: null, DR: null,
    stream: osmStream(lat, lon, opt), view: { exag: 1 }, outlines: [], streets: () => [], lines: () => [], finished: () => true };
}
