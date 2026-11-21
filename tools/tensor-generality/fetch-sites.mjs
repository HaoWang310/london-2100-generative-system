// Reads each site's OSM streets, rail, water and buildings from the same vector tiles the London map shows
// (OpenFreeMap, zoom 14), within the site and a 450 m surround, filtered exactly as the map's collectSiteFeatures.
// Also measures the existing street fabric in the surround (outside the site) for the spacing comparison.
import fs from 'node:fs'; import zlib from 'node:zlib';
import { VectorTile } from '@mapbox/vector-tile'; import Pbf from 'pbf';
import { SITES, ringOf } from './sites.mjs';
const Z = 14, PAD = 450, OUT = new URL('./sites/', import.meta.url);
fs.mkdirSync(OUT, { recursive: true });
const tx = lng => Math.floor((lng + 180) / 360 * 2 ** Z), ty = lat => Math.floor((1 - Math.log(Math.tan(lat * Math.PI / 180) + 1 / Math.cos(lat * Math.PI / 180)) / Math.PI) / 2 * 2 ** Z);
const linesOf = g => g.type === 'LineString' ? [g.coordinates] : g.type === 'MultiLineString' ? g.coordinates : [];
const polysOf = g => g.type === 'Polygon' ? [g.coordinates] : g.type === 'MultiPolygon' ? g.coordinates : [];
function geomBox(g){ let w = Infinity, s = Infinity, e = -Infinity, n = -Infinity; const walk = c => { if (typeof c[0] === 'number'){ w = Math.min(w, c[0]); e = Math.max(e, c[0]); s = Math.min(s, c[1]); n = Math.max(n, c[1]); } else for (const x of c) walk(x); }; walk(g.coordinates); return [w, s, e, n]; }
const cache = new Map();
async function tile(x, y){ const k = x + '/' + y; if (cache.has(k)) return cache.get(k);
  let buf; for (let t = 0; t < 4; t++){ try { const r = await fetch(`https://tiles.openfreemap.org/planet/latest/${Z}/${x}/${y}.pbf`); if (r.status === 204 || r.status === 404){ buf = null; break; } if (!r.ok) throw new Error('HTTP ' + r.status); buf = Buffer.from(await r.arrayBuffer()); break; } catch (e){ if (t === 3) throw e; await new Promise(r => setTimeout(r, 1500)); } }
  if (buf && buf[0] === 0x1f && buf[1] === 0x8b) buf = zlib.gunzipSync(buf);
  const vt = buf ? new VectorTile(new Pbf(buf)) : null; cache.set(k, vt); return vt; }
const inRing = (p, r) => { let ins = false; for (let i = 0, j = r.length - 1; i < r.length; j = i++){ const a = r[i], b = r[j]; if ((a[1] > p[1]) !== (b[1] > p[1]) && p[0] < (b[0] - a[0]) * (p[1] - a[1]) / (b[1] - a[1]) + a[0]) ins = !ins; } return ins; };
for (const s of SITES){
  const ring = ringOf(s), lats = ring.map(p => p[1]), lngs = ring.map(p => p[0]), lat = (Math.min(...lats) + Math.max(...lats)) / 2;
  const dLat = PAD / 111320, dLng = PAD / (111320 * Math.cos(lat * Math.PI / 180));
  const box = [Math.min(...lngs) - dLng, Math.min(...lats) - dLat, Math.max(...lngs) + dLng, Math.max(...lats) + dLat];
  const hit = b => b[0] <= box[2] && b[2] >= box[0] && b[1] <= box[3] && b[3] >= box[1];
  const out = { roads: [], rails: [], waters: [], waterways: [], buildings: [] }, seen = new Set();
  for (let x = tx(box[0]); x <= tx(box[2]); x++) for (let y = ty(box[3]); y <= ty(box[1]); y++){
    const vt = await tile(x, y); if (!vt) continue;
    for (const layer of ['transportation', 'water', 'waterway', 'building']){ const L = vt.layers[layer]; if (!L) continue;
      for (let i = 0; i < L.length; i++){ const f = L.feature(i), gj = f.toGeoJSON(x, y, Z), g = gj.geometry; if (!g?.coordinates || !hit(geomBox(g))) continue;
        const head = JSON.stringify(g.coordinates).slice(0, 160), key = layer + '|' + g.type + '|' + head + '|' + JSON.stringify(g.coordinates).length; if (seen.has(key)) continue; seen.add(key);
        const p = f.properties || {}, cls = String(p.class || '').toLowerCase(), sub = String(p.subclass || '').toLowerCase(), brunnel = String(p.brunnel || '').toLowerCase();
        if (layer === 'transportation'){ if (/ferry|aerialway|transit|pier/.test(cls)) continue;
          for (const coords of linesOf(g)){ if (cls === 'rail'){ if (!/tram/.test(sub)) out.rails.push({ coords, cls: sub || 'rail', brunnel }); } else out.roads.push({ coords, cls, brunnel }); } }
        else if (layer === 'waterway'){ for (const coords of linesOf(g)) out.waterways.push({ coords, cls, brunnel }); }
        else if (layer === 'water'){ if (brunnel === 'tunnel') continue; out.waters.push(...polysOf(g)); }
        else { const h = p.hide_3d; if (h === true || h === 'true' || h === 1) continue; out.buildings.push(...polysOf(g)); } } } }
  // the existing fabric in the surround (outside the site): street km per km² of land, as the generated net is measured
  const STREET = /^(motorway|trunk|primary|secondary|tertiary|minor|residential|unclassified|living_street|service)$/, MAIN = /^(motorway|trunk|primary|secondary|tertiary)$/;
  const mLng = 111320 * Math.cos(lat * Math.PI / 180), mLat = 111320, inBox = p => p[0] >= box[0] && p[0] <= box[2] && p[1] >= box[1] && p[1] <= box[3];
  let km = 0, kmMain = 0; const segSeen = new Set();
  for (const r of out.roads){ if (!STREET.test(r.cls) || r.brunnel === 'tunnel' || r.cls === 'service') continue;
    for (let i = 1; i < r.coords.length; i++){ const a = r.coords[i - 1], b = r.coords[i], m = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]; if (!inBox(m) || inRing(m, ring)) continue;
      const k = [a, b].map(p => p.map(v => v.toFixed(6)).join(',')).sort().join('|'); if (segSeen.has(k)) continue; segSeen.add(k);
      const L = Math.hypot((b[0] - a[0]) * mLng, (b[1] - a[1]) * mLat) / 1000; km += L; if (MAIN.test(r.cls)) kmMain += L; } }
  const boxKm2 = (box[2] - box[0]) * mLng * (box[3] - box[1]) * mLat / 1e6, siteKm2 = s.side * s.side / 1e6, ringKm2 = boxKm2 - siteKm2;
  const context = { streetKmPerKm2: +(km / ringKm2).toFixed(2), mainKmPerKm2: +(kmMain / ringKm2).toFixed(2), blockM: +(2000 / (km / ringKm2)).toFixed(0) };
  fs.writeFileSync(new URL(s.id + '.json', OUT), JSON.stringify({ site: s, ring, features: out, context }));
  console.log(s.id, Object.fromEntries(Object.entries(out).map(([k, v]) => [k, v.length])), context);
}
