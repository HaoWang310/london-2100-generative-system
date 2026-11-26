// Tensor Studio · a parcel package from the Loop City wool bands, read as a site (v8.51, 26 Nov 2026).
//
// The wool bands (incubator/loop-city-wool, step 17) hand on a "loop-city-parcel-package": the urban parcels taken,
// the parks taken with them, the roads of the wool hierarchy round them, the junction stubs on the site's edge, all in
// British National Grid metres. Tensor Studio reads a site as a "tensor-site-input": the ring and the features in WGS84
// longitude and latitude (scripts/site_builder.js, buildTensorSite). This is the step between the two.
//
// Until v8.50 a page of its own did this (Loop City step 3, the base for the tensor field, removed 26 Nov 2026). The
// reading is that page's, unchanged: the same classes, the same ring, the same parks. A site made here is the site that
// page saved, so an older site file and a new package of the same parcels open as the same site.
//
//   siteFromParcelPackage(pkg, bngToWGS84)  ->  { type: 'tensor-site-input', ring, features, bng, size, run, ... }
//   packageCheck(pkg)                       ->  { side, area, pieces, ok, why }   (metres, square metres)
//
// bngToWGS84 is passed in (site_builder.js has it), so this file imports nothing and runs in Node as it is.

export const PACKAGE_TYPE = 'loop-city-parcel-package', SITE_TYPE = 'tensor-site-input';
export const MAX_SIDE_M = 3600, MIN_AREA_M2 = 20000;      // as in site_builder.js: up to 3.6 km across, at least 2 ha

// the wool's road classes as the OpenMapTiles classes Tensor Studio reads; an existing road listed apart (older packages)
const WOOL_CLS = { M: 'trunk', A: 'primary', B: 'secondary', C: 'tertiary' }, EX_CLS = { M: 'motorway', A: 'primary', B: 'secondary' };
const closeRing = r => (r.length && (r[0][0] !== r[r.length - 1][0] || r[0][1] !== r[r.length - 1][1]) ? r.concat([r[0].slice()]) : r);
const boxOf = pts => { let a = Infinity, b = Infinity, c = -Infinity, d = -Infinity; pts.forEach(q => { a = Math.min(a, q[0]); b = Math.min(b, q[1]); c = Math.max(c, q[0]); d = Math.max(d, q[1]); }); return [a, b, c, d]; };
const areaOf = r => { let s = 0; for (let i = 0, j = r.length - 1; i < r.length; j = i++) s += r[j][0] * r[i][1] - r[i][0] * r[j][1]; return Math.abs(s / 2); };

export const isParcelPackage = p => !!(p && p.type === PACKAGE_TYPE && Array.isArray(p.parcels) && p.parcels.length);
const siteRing = pkg => (pkg.site && pkg.site.rings && pkg.site.rings[0]) || pkg.parcels[0].outline;

// How large the site is, and whether Tensor Studio can take it. The site is the urban parcels only, as one outline; when
// the parcels do not all touch there are several pieces, and only the largest is the site.
export function packageCheck(pkg) {
  const ring = siteRing(pkg), b = boxOf(ring), side = Math.max(b[2] - b[0], b[3] - b[1]), area = areaOf(ring);
  const pieces = (pkg.site && pkg.site.rings && pkg.site.rings.length) || 1;
  const why = side > MAX_SIDE_M ? 'wide' : area < MIN_AREA_M2 ? 'small' : null;
  return { side, area, pieces, ok: !why, why };
}

export function siteFromParcelPackage(pkg, bngToWGS84) {
  if (!isParcelPackage(pkg)) throw new Error('not a parcel package from the wool bands');
  const ring = siteRing(pkg), ex = pkg.existing || {}, site = pkg.site || {};
  const ll = p => p.map(q => { const v = bngToWGS84(q[0], q[1]); return [+v[0].toFixed(7), +v[1].toFixed(7)]; });
  const roads = [];
  (pkg.roads || []).forEach(r => roads.push({ coords: ll(r.p), cls: WOOL_CLS[r.cls] || 'minor', brunnel: null, wool: r.cls, width_m: r.width }));
  (site.junctions || []).forEach(j => roads.push({ coords: ll(j.stub), cls: WOOL_CLS[j.cls] || 'secondary', brunnel: null, wool: 'junction ' + j.cls }));
  if (!pkg.existing_in_roads) (ex.roads || []).forEach(r => roads.push({ coords: ll(r.p), cls: EX_CLS[r.c] || 'minor', brunnel: null, wool: 'existing', name: r.n || '' }));      // wool bands: the existing roads are already in pkg.roads, each with its class
  const features = { roads, rails: (ex.rail || []).map(r => ({ coords: ll(r.p), brunnel: null, kind: r.kind })),
                     waters: (ex.water || []).map(w => [ll(closeRing(w))]), waterways: [], buildings: [],
                     parks: (pkg.parks || []).map(d => [ll(closeRing(d.outline))]) };      // a park stays a park: the tensor field must not run on it
  const C = packageCheck(pkg), shape = d => ({ id: d.id, ha: d.ha, outline: closeRing(d.outline), holes: (d.holes || []).map(closeRing) });
  return { type: SITE_TYPE, version: 1, made: pkg.made || new Date().toISOString(), from: 'Tensor Studio · read from a Loop City parcel package (wool bands, step 17)',
    crs: 'ring and features: WGS84 longitude, latitude (as Tensor Studio reads them); bng: the same in British National Grid metres (EPSG:27700)',
    notes: ['Roads: cls is the OpenMapTiles class Tensor Studio reads (wool M trunk, A primary, B secondary, C tertiary; existing M motorway); wool says where each came from.',
            'The short "junction" roads cross the site edge at the wool junctions, so Tensor Studio anchors its main streets there.',
            'Parks: features.parks and bng.parks list the parks taken with the parcels. A park stays a park: the tensor field must not run on it. The site ring is the urban parcels only.',
            'No elevation or buildings here: the wool has none at this scale. Tensor Studio takes its own terrain, or runs flat.',
            'run and cell_keys say which century of step 1 the parcels come from. Only cells of one run fit together: sites with different run.id must not be joined.'],
    run: pkg.run || null, cells: pkg.cells || [], cell_keys: pkg.cell_keys || {},
    parcels: pkg.parcels.map(d => d.id), pieces: C.pieces, size: { across_m: Math.round(C.side), area_ha: Math.round(C.area / 100) / 100 },
    ring: ll(closeRing(ring)), features,
    bng: { ring: closeRing(ring), window: pkg.window, parcels: pkg.parcels.map(shape), parks: (pkg.parks || []).map(shape), junctions: site.junctions || [] } };
}
