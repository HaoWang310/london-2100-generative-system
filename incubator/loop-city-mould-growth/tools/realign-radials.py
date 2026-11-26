#!/usr/bin/env python3
"""Loop City step 1 · two radials put on the real track (24 Nov 2026).

The radials at P4 (High Speed 1) and P6 (South West Main Line) in HW_RAIL had been drawn by hand: P6 ran 150-300 m
beside its track the whole way from Waterloo, and P4 left High Speed 1 between Rainham and Purfleet and crossed Rainham
Marshes, up to 1.3 km from the line. This tool traces both along the OpenStreetMap track the repository already holds
(reference/osm, fetched 21 Nov 2026) and

  1. writes the two new lines into HW_RAIL in index.html (British National Grid metres, the outer end first, as before),
     each ending with a short straight piece from the track to its station (P6 stands about 300 m off the line, P4
     about 100 m): the stations are inputs to the model and do not move;
  2. paints the change into the two dark base maps (img/base_dark.webp, lossless, and img/half/base_dark.webp), where
     the radials are part of the picture: the pixels under the old line are rebuilt from the map's own layers (img/*.webp),
     only inside its own corridor and never on the orbital, the high-speed loop or another radial, and the new one is drawn with the
     profile measured from the radials already in the picture.

What it does not touch: the light sheet the model classifies (img/base_light_sheet.webp) already shows the real track
where it is, and nothing in the model reads HW_RAIL, so a century run gives the same result as before. The other four
radials are left as they are (P1 and P2 already follow their track, HS2's route and the East Coast Main Line, to within about a pixel: median
8 m and 4 m, at most 38 m and 28 m; P3 and P5 are new lines).

    python3 tools/realign-radials.py            (numpy, scipy, Pillow, opencv-python)

Run once: a second run finds the lines already on the track and stops.
"""
import heapq, json, math, os, re, sys
from collections import defaultdict
import numpy as np, cv2
from scipy.spatial import cKDTree
from PIL import Image

Image.MAX_IMAGE_PIXELS = None
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
OSM = os.path.join(ROOT, 'reference', 'osm')   # this app's own copy of the OpenStreetMap extract (21 Nov 2026)
PAGE = os.path.join(ROOT, 'index.html')
LAYERS = ['aonb', 'greenbelt', 'greenbelt_edge', 'greenspace', 'nationalparks', 'rail', 'roads_local', 'roads_national',
          'roads_regional', 'urban', 'water', 'woodland']          # img/<name>.webp, the map's layers at full size

# ------------------------------------------------------------------ WGS84 -> British National Grid (OSGB36), about 5 m
def wgs84_to_bng(lat, lon):
    a2, b2 = 6378137.0, 6356752.3141; e22 = 1 - (b2 * b2) / (a2 * a2)
    la, lo = math.radians(lat), math.radians(lon); nu = a2 / math.sqrt(1 - e22 * math.sin(la) ** 2)
    x = nu * math.cos(la) * math.cos(lo); y = nu * math.cos(la) * math.sin(lo); z = (1 - e22) * nu * math.sin(la)
    tx, ty, tz = -446.448, 125.157, -542.060; sc = 20.4894e-6
    rx, ry, rz = [-math.radians(v / 3600) for v in (0.1502, 0.2470, 0.8421)]
    x2 = tx + (1 + sc) * x - rz * y + ry * z; y2 = ty + rz * x + (1 + sc) * y - rx * z; z2 = tz - ry * x + rx * y + (1 + sc) * z
    a, b = 6377563.396, 6356256.909; e2 = 1 - (b * b) / (a * a); p = math.hypot(x2, y2); lat = math.atan2(z2, p * (1 - e2))
    for _ in range(10):
        nu = a / math.sqrt(1 - e2 * math.sin(lat) ** 2); lat = math.atan2(z2 + e2 * nu * math.sin(lat), p)
    lon = math.atan2(y2, x2)
    F0 = 0.9996012717; lat0 = math.radians(49); lon0 = math.radians(-2); N0, E0 = -100000, 400000; n = (a - b) / (a + b)
    s, c, t = math.sin(lat), math.cos(lat), math.tan(lat)
    nu = a * F0 / math.sqrt(1 - e2 * s * s); rho = a * F0 * (1 - e2) / (1 - e2 * s * s) ** 1.5; eta2 = nu / rho - 1
    M = b * F0 * ((1 + n + 5 / 4 * n ** 2 + 5 / 4 * n ** 3) * (lat - lat0) - (3 * n + 3 * n ** 2 + 21 / 8 * n ** 3) * math.sin(lat - lat0) * math.cos(lat + lat0)
                  + (15 / 8 * n ** 2 + 15 / 8 * n ** 3) * math.sin(2 * (lat - lat0)) * math.cos(2 * (lat + lat0))
                  - (35 / 24 * n ** 3) * math.sin(3 * (lat - lat0)) * math.cos(3 * (lat + lat0)))
    I = M + N0; II = nu / 2 * s * c; III = nu / 24 * s * c ** 3 * (5 - t * t + 9 * eta2); IIIA = nu / 720 * s * c ** 5 * (61 - 58 * t * t + t ** 4)
    IV = nu * c; V = nu / 6 * c ** 3 * (nu / rho - t * t); VI = nu / 120 * c ** 5 * (5 - 18 * t * t + t ** 4 + 14 * eta2 - 58 * t * t * eta2)
    dl = lon - lon0
    return E0 + IV * dl + V * dl ** 3 + VI * dl ** 5, I + II * dl ** 2 + III * dl ** 4 + IIIA * dl ** 6

# ------------------------------------------------------------------ the page
html = open(PAGE, encoding='utf-8').read()
i = html.find('const HW_RAIL = '); j = html.find('};', i) + 1
RAIL = json.loads(html[i + len('const HW_RAIL = '):j])
cfg = html[html.find('const CFG = '):][:400000]
EX = json.loads(re.search(r'"extentBNG":(\{.*?\})', cfg, re.S).group(1))
NODES = {n['id']: n for n in json.loads(re.search(r'"nodes":(\[.*?\])', cfg, re.S).group(1))}

def radial_index(pid):
    n = NODES[pid]
    return min(range(len(RAIL['radials'])), key=lambda k: min(math.dist((n['E'], n['N']), RAIL['radials'][k][0]),
                                                                math.dist((n['E'], n['N']), RAIL['radials'][k][-1])))

# ------------------------------------------------------------------ the OSM track, as a graph in grid metres
def lines(path, keep):
    out = []
    for f in json.load(open(path))['features']:
        if not keep(f['properties']): continue
        g = f['geometry']; parts = g['coordinates'] if g['type'] == 'MultiLineString' else [g['coordinates']]
        out += [[wgs84_to_bng(q[1], q[0]) for q in part] for part in parts]
    return out

def graph(ls, snap=25.0):
    pts, G, grid = [], defaultdict(dict), defaultdict(list)
    def node(p):
        gx, gy = int(p[0] // snap), int(p[1] // snap)
        for dx in (-1, 0, 1):
            for dy in (-1, 0, 1):
                for k in grid[(gx + dx, gy + dy)]:
                    if math.dist(pts[k], p) <= snap: return k
        pts.append(p); grid[(gx, gy)].append(len(pts) - 1); return len(pts) - 1
    for l in ls:
        prev = None
        for p in l:
            k = node(p)
            if prev is not None and prev != k:
                d = math.dist(pts[prev], pts[k]); G[prev][k] = G[k][prev] = min(d, G[prev].get(k, 9e18))
            prev = k
    return pts, G

def route(pts, G, a, b):
    D, prev, h = {a: 0}, {}, [(0, a)]
    while h:
        d, u = heapq.heappop(h)
        if u == b: break
        if d > D[u]: continue
        for v, w in G[u].items():
            if d + w < D.get(v, 9e18): D[v] = d + w; prev[v] = u; heapq.heappush(h, (d + w, v))
    path = [b]
    while path[-1] != a: path.append(prev[path[-1]])
    return D[b], [pts[k] for k in path[::-1]]

def simplify(p, tol):
    a = np.array(p, np.float64).reshape(-1, 1, 2)
    return [tuple(q) for q in cv2.approxPolyDP(a.astype(np.float32), tol, False).reshape(-1, 2)]

stations = {f['properties']['n']: wgs84_to_bng(f['geometry']['coordinates'][1], f['geometry']['coordinates'][0])
            for f in json.load(open(os.path.join(OSM, 'stations.geojson')))['features']}
TRACKS = {
    'P4': ('High Speed 1', lambda: lines(os.path.join(OSM, 'highspeed.geojson'), lambda p: p['k'] == 'hs1'), 'Stratford International'),
    'P6': ('South West Main Line', lambda: lines(os.path.join(OSM, 'rail.geojson'), lambda p: p.get('k') == 'national'), 'London Waterloo'),
}

new, old, report = {}, {}, []
for pid, (name, load, start) in TRACKS.items():
    pts, G = graph(load())
    node = (NODES[pid]['E'], NODES[pid]['N'])
    near = lambda p: min(range(len(pts)), key=lambda k: math.dist(pts[k], p))
    a, b = near(stations[start]), near(node)
    length, path = route(pts, G, a, b)
    line = simplify(path, 4.0)
    if math.dist(line[-1], node) > 5: line.append(node)                      # the short piece from the track to the station
    line = [[int(round(x)), int(round(y))] for x, y in line[::-1]]           # outer end first, as HW_RAIL has them
    k = radial_index(pid)
    if [list(q) for q in RAIL['radials'][k]] == line:
        print(pid, 'already on the track'); continue
    old[pid] = [tuple(q) for q in RAIL['radials'][k]]
    new[pid] = line; RAIL['radials'][k] = line
    report.append(f"{pid} {name}: {start} -> track nearest {pid}, {length / 1000:.2f} km along the track, "
                  f"{math.dist(path[-1], node):.0f} m from the track to the station; {len(line)} points (was {len(old[pid])})")
if not new: sys.exit(0)

# ------------------------------------------------------------------ 1. HW_RAIL
text = json.dumps(RAIL, separators=(',', ':'))
html = html[:i + len('const HW_RAIL = ')] + text + html[j:]
open(PAGE, 'w', encoding='utf-8').write(html)

# ------------------------------------------------------------------ 2. the dark base maps
def seg_dist(xs, ys, line):
    """Distance in pixels from each (x, y) to a polyline given in pixels."""
    d = np.full(xs.shape, 1e9, np.float32)
    for (x0, y0), (x1, y1) in zip(line, line[1:]):
        dx, dy = x1 - x0, y1 - y0; L2 = dx * dx + dy * dy or 1.0
        t = np.clip(((xs - x0) * dx + (ys - y0) * dy) / L2, 0, 1)
        d = np.minimum(d, np.hypot(xs - x0 - t * dx, ys - y0 - t * dy))
    return d

def paint(path, lossless):
    im = np.array(Image.open(path).convert('RGB')); H, W = im.shape[:2]
    px = lambda q: ((q[0] - EX['e0']) / (EX['e1'] - EX['e0']) * W, (EX['n1'] - q[1]) / (EX['n1'] - EX['n0']) * H)
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32); xx += 0.5; yy += 0.5
    k = W / 4286.0                                                    # 1 at full size, 0.5 for the half-size copy
    # the radial's profile, measured from one the picture already has (P2's): value by distance from its centre
    ref = [px(q) for q in RAIL['radials'][radial_index('P2')]]
    box = lambda l, pad: (max(0, int(min(p[0] for p in l) - pad)), min(W, int(max(p[0] for p in l) + pad) + 1),
                          max(0, int(min(p[1] for p in l) - pad)), min(H, int(max(p[1] for p in l) + pad) + 1))
    x0, x1, y0, y1 = box(ref, 8)
    dref = seg_dist(xx[y0:y1, x0:x1], yy[y0:y1, x0:x1], ref); g = im[y0:y1, x0:x1].mean(axis=2)
    steps = np.arange(0, 6 * k + 0.01, 0.25 * k)
    prof = np.array([np.median(g[(dref >= s - 0.125 * k) & (dref < s + 0.125 * k)]) if ((dref >= s - 0.125 * k) & (dref < s + 0.125 * k)).any() else 0 for s in steps])
    bg, top = prof[-1], prof[0]
    alpha = np.clip((prof - bg) / max(1.0, top - bg), 0, 1); alpha[-1] = 0
    reach = steps[np.nonzero(alpha > 0.02)[0][-1]] + 0.25 * k
    # the other lines (the orbital, the high-speed loop, the radials that stay): distance to the nearest of them
    others = [RAIL['orbital'][0], RAIL['high_speed'][0]] + [RAIL['radials'][m] for m in range(len(RAIL['radials'])) if m not in [radial_index(p) for p in new]]
    dother = np.full((H, W), 1e9, np.float32)
    for l in others:
        lp = [px(q) for q in l]; bx0, bx1, by0, by1 = box(lp, 12)
        dother[by0:by1, bx0:bx1] = np.minimum(dother[by0:by1, bx0:bx1], seg_dist(xx[by0:by1, bx0:bx1], yy[by0:by1, bx0:bx1], lp))
    # the map's own layers, on the same grid: what lies under a pixel (water, roads, built-up area, the Green Belt's
    # edge, ...) says what colour it is in the dark base map, so a pixel under the old line is given the colour of
    # nearby pixels that have the same layers under them. Rebuilding it this way keeps boundary lines and road edges
    # sharp where filling in from the surroundings would smear them.
    F = np.stack([np.array(Image.open(os.path.join(ROOT, 'img', n + '.webp')))[..., 3] for n in LAYERS], -1)
    if F.shape[:2] != (H, W): F = np.stack([cv2.resize(F[..., c], (W, H), interpolation=cv2.INTER_AREA) for c in range(F.shape[-1])], -1)
    out = im.copy()
    # 1) rebuild the pixels under the old line
    for pid in new:
        lp = [px(q) for q in old[pid]]; lq = [px(q) for q in new[pid]]; bx0, bx1, by0, by1 = box(lp, 60 * k)
        X, Y = xx[by0:by1, bx0:bx1], yy[by0:by1, bx0:bx1]
        d = seg_dist(X, Y, lp); dn = seg_dist(X, Y, lq); do = dother[by0:by1, bx0:bx1]
        sub = out[by0:by1, bx0:bx1]
        g = sub.astype(np.int16); grey = (np.ptp(g, axis=2) < 8) & (g.mean(axis=2) > 120)
        # the whole soft edge (the line fades out over about 4 px at full size), and any of its bright grey a little
        # further out where the picture's line sits a fraction of a pixel off its coordinates; never the core of
        # another line, nor any pixel nearer another line than this one (where they cross or meet)
        m = (d <= 4.5 * k + 0.5) | ((d <= 7 * k) & grey)
        m = cv2.dilate(m.astype(np.uint8), np.ones((3, 3), np.uint8)).astype(bool) & (d <= 7 * k)
        m &= (do > 2.5 * k) & (do >= d)
        donor = ~m & (d > 7 * k) & (dn > 7 * k) & (do > 7 * k)
        f = F[by0:by1, bx0:bx1].astype(np.float32) / 255 * 4
        sp = np.stack([X, Y], -1) / (60 * k)
        tree = cKDTree(np.hstack([f[donor], sp[donor]]))
        _, nb = tree.query(np.hstack([f[m], sp[m]]), k=5)
        sub[m] = np.median(sub[donor][nb], axis=1).round().astype(np.uint8)
    # 2) draw the new one with that profile, over whatever is there (as the radials are drawn over the map)
    for pid in new:
        lp = [px(q) for q in new[pid]]; bx0, bx1, by0, by1 = box(lp, reach + 2)
        d = seg_dist(xx[by0:by1, bx0:bx1], yy[by0:by1, bx0:bx1], lp)
        a = np.interp(d, steps, alpha, right=0)[..., None]
        m = a[..., 0] > 0.002
        sub = out[by0:by1, bx0:bx1].astype(np.float32)
        sub = sub * (1 - a) + top * a
        out[by0:by1, bx0:bx1][m] = np.clip(np.round(sub[m]), 0, 255).astype(np.uint8)
    diff = np.any(out != im, axis=2)
    changed = np.zeros((H, W), bool)
    for l in list(old.values()) + list(new.values()):
        lp = [px(q) for q in l]; bx0, bx1, by0, by1 = box(lp, 12)
        changed[by0:by1, bx0:bx1] |= seg_dist(xx[by0:by1, bx0:bx1], yy[by0:by1, bx0:bx1], lp) <= 8 * k + 1
    Image.fromarray(out).save(path, 'WEBP', lossless=True, quality=100, method=6) if lossless else \
        Image.fromarray(out).save(path, 'WEBP', quality=90, method=6)   # the half-size copy is lossy, about q90
    return int(diff.sum()), int((diff & ~changed).sum()), round(float(reach), 2)

for f, lossless in (('img/base_dark.webp', True), ('img/half/base_dark.webp', False)):
    n, outside, reach = paint(os.path.join(ROOT, f), lossless)
    report.append(f"{f}: {n} pixels changed, {outside} more than 8 px (full size) from the old or new line (line reach {reach} px)")
print('\n'.join(report))
