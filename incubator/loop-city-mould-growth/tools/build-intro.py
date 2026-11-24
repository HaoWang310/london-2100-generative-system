#!/usr/bin/env python3
"""Loop City step 1 · the opening story's map and drawing (24 Nov 2026, second version: on the real base map).

Writes, from what the page itself holds, so that the story shows the same map and the same lines as the page:

  img/intro/base.webp     the page's dark base map (img/base_dark.webp) with the loop taken out of it: the orbital,
                          the high-speed loop and the six radials are part of that picture, and the story draws them
                          itself one at a time. Each pixel under them is rebuilt from the map's own layers (img/*.webp:
                          water, roads, built-up area, the Green Belt's edge, ...): it is given the colour of nearby
                          pixels that have the same layers under them. 1600 px across, the whole frame.
  img/intro/centre.webp   the same, at full size, for the middle of London only, where the story moves in close.
  intro-data.js           the lines (HW_RAIL), the 17 stations (CFG.map.nodes) and the Green Belt (traced from
                          img/half/greenbelt.webp), in one 1000 x 820 frame that covers CFG.map.extentBNG, so the
                          story's frame and the map's sheet are the same rectangle; and, for the labels:
                            - each radial's London end, named by the OpenStreetMap station there;
                            - for each of the 17 stations, the nearest National Rail station in OpenStreetMap, which
                              way the Loop City station lies from it and how far (as the labels say it,
                              "Braintree SW 8.2 km": 8.2 km south-west of Braintree).
                          The stations come from ../loop-city-real-map/assets/stations.geojson (OpenStreetMap
                          contributors, ODbL, fetched 21 Nov 2026), less a few heritage and works stations that the
                          data files as national (below).

Run again when the rail, the stations, the dark base map or the layers change:

    python3 tools/build-intro.py            (numpy, scipy, Pillow, opencv-python; about a minute)
"""
import json, math, os, re
import numpy as np, cv2
from PIL import Image
from scipy.spatial import cKDTree
Image.MAX_IMAGE_PIXELS = None

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
OSM = os.path.join(ROOT, '..', 'loop-city-real-map', 'assets')
W, H = 1000.0, 820.0
LAYERS = ['aonb', 'greenbelt', 'greenbelt_edge', 'greenspace', 'nationalparks', 'rail', 'roads_local', 'roads_national',
          'roads_regional', 'urban', 'water', 'woodland']
# filed as national in the OSM extract, but heritage lines or works sidings with no National Rail service
NOT_NATIONAL = {'Quainton Road', 'Golding Spring Central', 'Stonehenge Works', 'Central Terminal', 'Wallingford', 'Chinnor',
                'Holycombe Junction'}
ZOOM_KM = 36.0          # the width of the close view of the middle of London, in km

s = open(os.path.join(ROOT, 'index.html'), encoding='utf-8').read()
i = s.find('const HW_RAIL = '); j = s.find('};', i)
RAIL = json.loads(s[i + len('const HW_RAIL = '):j + 1])
cfg = s[s.find('const CFG = '):][:400000]
NODES = json.loads(re.search(r'"nodes":(\[.*?\])', cfg, re.S).group(1))
EX = json.loads(re.search(r'"extentBNG":(\{.*?\})', cfg, re.S).group(1))
PROPOSED = json.loads(re.search(r'proposedRadials:\s*(\[[^\]]*\])', s).group(1))

def xy(E, N):
    return ((E - EX['e0']) / (EX['e1'] - EX['e0']) * W, (EX['n1'] - N) / (EX['n1'] - EX['n0']) * H)
KM = W / ((EX['e1'] - EX['e0']) / 1000)          # frame units to a kilometre

# ------------------------------------------------------------------ WGS84 -> British National Grid (as tools/realign-radials.py)
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
    s_, c, t = math.sin(lat), math.cos(lat), math.tan(lat)
    nu = a * F0 / math.sqrt(1 - e2 * s_ * s_); rho = a * F0 * (1 - e2) / (1 - e2 * s_ * s_) ** 1.5; eta2 = nu / rho - 1
    M = b * F0 * ((1 + n + 5 / 4 * n ** 2 + 5 / 4 * n ** 3) * (lat - lat0) - (3 * n + 3 * n ** 2 + 21 / 8 * n ** 3) * math.sin(lat - lat0) * math.cos(lat + lat0)
                  + (15 / 8 * n ** 2 + 15 / 8 * n ** 3) * math.sin(2 * (lat - lat0)) * math.cos(2 * (lat + lat0))
                  - (35 / 24 * n ** 3) * math.sin(3 * (lat - lat0)) * math.cos(3 * (lat + lat0)))
    I = M + N0; II = nu / 2 * s_ * c; III = nu / 24 * s_ * c ** 3 * (5 - t * t + 9 * eta2); IIIA = nu / 720 * s_ * c ** 5 * (61 - 58 * t * t + t ** 4)
    IV = nu * c; V = nu / 6 * c ** 3 * (nu / rho - t * t); VI = nu / 120 * c ** 5 * (5 - 18 * t * t + t ** 4 + 14 * eta2 - 58 * t * t * eta2)
    dl = lon - lon0
    return E0 + IV * dl + V * dl ** 3 + VI * dl ** 5, I + II * dl ** 2 + III * dl ** 4 + IIIA * dl ** 6

# ------------------------------------------------------------------ 1. the base map without the loop
def clean_base():
    im = np.array(Image.open(os.path.join(ROOT, 'img', 'base_dark.webp')).convert('RGB')); Hh, Ww = im.shape[:2]
    F = np.stack([np.array(Image.open(os.path.join(ROOT, 'img', n + '.webp')))[..., 3] for n in LAYERS], -1)
    sh = 4                                                   # draw with 1/16 px precision
    def P(q): return [int(round(((q[0] - EX['e0']) / (EX['e1'] - EX['e0']) * Ww) * 16)), int(round(((EX['n1'] - q[1]) / (EX['n1'] - EX['n0']) * Hh) * 16))]
    core = np.zeros((Hh, Ww), np.uint8); halo = np.zeros((Hh, Ww), np.uint8)
    # how far each kind of line reaches out from its centre in the picture, in full-size pixels
    for lines, r in ((RAIL['orbital'], 7.5), (RAIL['high_speed'], 5.5), (RAIL['radials'], 4.8)):
        for l in lines:
            pts = np.array([P(q) for q in l], np.int32).reshape(-1, 1, 2)
            cv2.polylines(core, [pts], False, 1, int(round(2 * r + 1)), cv2.LINE_8, sh)
            cv2.polylines(halo, [pts], False, 1, int(round(2 * (r + 3) + 1)), cv2.LINE_8, sh)
    g = im.astype(np.int16); grey = (np.ptp(g, axis=2) < 8) & (g.mean(axis=2) > 110)
    m = core.astype(bool) | (halo.astype(bool) & grey)
    donor = ~cv2.dilate(halo, np.ones((5, 5), np.uint8)).astype(bool)
    out = im.copy(); T, M = 320, 96
    yy, xx = np.mgrid[0:Hh, 0:Ww]
    for y0 in range(0, Hh, T):
        for x0 in range(0, Ww, T):
            y1, x1 = min(Hh, y0 + T), min(Ww, x0 + T)
            mt = m[y0:y1, x0:x1]
            if not mt.any(): continue
            Y0, Y1, X0, X1 = max(0, y0 - M), min(Hh, y1 + M), max(0, x0 - M), min(Ww, x1 + M)
            dm = donor[Y0:Y1, X0:X1]
            f = F[Y0:Y1, X0:X1].astype(np.float32) / 255 * 4
            sp = np.stack([xx[Y0:Y1, X0:X1], yy[Y0:Y1, X0:X1]], -1).astype(np.float32) / 60
            tree = cKDTree(np.hstack([f[dm], sp[dm]]))
            sel = np.zeros(dm.shape, bool); sel[y0 - Y0:y1 - Y0, x0 - X0:x1 - X0] = mt
            _, nb = tree.query(np.hstack([f[sel], sp[sel]]), k=5)
            out[Y0:Y1, X0:X1][sel] = np.median(im[Y0:Y1, X0:X1][dm][nb], axis=1).round().astype(np.uint8)
    return out

def save_images(clean, zoom):
    os.makedirs(os.path.join(ROOT, 'img', 'intro'), exist_ok=True)
    Hh, Ww = clean.shape[:2]
    small = cv2.resize(clean, (1600, int(round(1600 * Hh / Ww))), interpolation=cv2.INTER_AREA)
    Image.fromarray(small).save(os.path.join(ROOT, 'img', 'intro', 'base.webp'), 'WEBP', quality=78, method=6)
    # the middle of London at full size: the close view and a margin round it
    bw = ZOOM_KM * 1.25 * KM; bh = bw * H / W
    box = [zoom['x'] - bw / 2, zoom['y'] - bh / 2, bw, bh]
    px = [int(round(box[0] / W * Ww)), int(round(box[1] / H * Hh)), int(round(box[2] / W * Ww)), int(round(box[3] / H * Hh))]
    crop = clean[px[1]:px[1] + px[3], px[0]:px[0] + px[2]]
    Image.fromarray(crop).save(os.path.join(ROOT, 'img', 'intro', 'centre.webp'), 'WEBP', quality=80, method=6)
    # the box as drawn: whole pixels of the full-size picture, in the frame's units
    return [round(px[0] / Ww * W, 3), round(px[1] / Hh * H, 3), round(px[2] / Ww * W, 3), round(px[3] / Hh * H, 3)]

# ------------------------------------------------------------------ 2. the drawing
def simp(pts, eps):
    a = np.array(pts, dtype=np.float32).reshape(-1, 1, 2)
    return cv2.approxPolyDP(a, eps, False).reshape(-1, 2)

def d_of(a, closed=False, nd=1):
    f = '%%.%df' % nd
    return 'M' + ' '.join((f + ' ' + f) % (x, y) for x, y in a) + ('Z' if closed else '')

def piece(pts, eps=0.25, pad=6):
    a = simp(pts, eps)
    x0, y0 = a.min(axis=0) - pad; x1, y1 = a.max(axis=0) + pad
    return {'box': [round(float(x0), 1), round(float(y0), 1), round(float(x1 - x0), 1), round(float(y1 - y0), 1)],
            'd': d_of(a, nd=2), 'a': [round(float(a[0][0]), 2), round(float(a[0][1]), 2)]}

def mask(name, blur, thr, minarea, eps, maxn):
    a = np.array(Image.open(os.path.join(ROOT, 'img', 'half', name + '.webp')).convert('RGBA'))[..., 3]
    m = cv2.resize((a > 40).astype(np.float32), (int(W), int(H)), interpolation=cv2.INTER_AREA)
    m = cv2.GaussianBlur(m, (0, 0), blur)
    cs, _ = cv2.findContours((m > thr).astype(np.uint8), cv2.RETR_CCOMP, cv2.CHAIN_APPROX_SIMPLE)
    out = []
    for c in sorted(cs, key=cv2.contourArea, reverse=True)[:maxn]:
        if cv2.contourArea(c) < minarea: continue
        out.append(d_of(cv2.approxPolyDP(c, eps, True).reshape(-1, 2), True, 0))
    return ' '.join(out)

def nearest(line, p):
    return min(range(len(line)), key=lambda k: (line[k][0] - p[0]) ** 2 + (line[k][1] - p[1]) ** 2)

def ring_pieces(line_bng, stops):
    """A closed line cut at the stations it passes, in the order it passes them, starting at the first stop."""
    line = [xy(*q) for q in line_bng]
    if math.dist(line[0], line[-1]) < 1e-6: line = line[:-1]
    at = sorted(((nearest(line, xy(n['E'], n['N'])), n['id']) for n in stops))
    k0 = next(k for k, (_, sid) in enumerate(at) if sid == stops[0]['id'])
    at = at[k0:] + at[:k0]
    out = []
    for k, (i0, sid) in enumerate(at):
        i1 = at[(k + 1) % len(at)][0]
        seg = line[i0:i1 + 1] if i1 > i0 else line[i0:] + line[:i1 + 1]
        p = piece(seg, 0.6); p['from'] = sid; p['to'] = at[(k + 1) % len(at)][1]
        out.append(p)
    return out

def along(line, d):
    """The point d frame units along a polyline, and the line's direction there."""
    for a, b in zip(line, line[1:]):
        L = math.dist(a, b)
        if d <= L and L > 0:
            t = d / L; return (a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t), ((b[0] - a[0]) / L, (b[1] - a[1]) / L)
        d -= L
    a, b = line[-2], line[-1]; L = math.dist(a, b) or 1
    return b, ((b[0] - a[0]) / L, (b[1] - a[1]) / L)

# the National Rail stations of OpenStreetMap, in grid metres
STN = []
for f in json.load(open(os.path.join(OSM, 'stations.geojson')))['features']:
    p = f['properties']
    if p.get('k') != 'national' or p['n'] in NOT_NATIONAL: continue
    E, N = wgs84_to_bng(f['geometry']['coordinates'][1], f['geometry']['coordinates'][0]); STN.append((p['n'], E, N))

def near_station(E, N):
    n, e, nn = min(STN, key=lambda q: (q[1] - E) ** 2 + (q[2] - N) ** 2)
    d = math.hypot(E - e, N - nn)
    bearing = (math.degrees(math.atan2(E - e, N - nn)) + 360) % 360       # from the station to the point, clockwise from north
    return {'n': n, 'km': round(d / 1000, 1), 'c': int(((bearing + 22.5) % 360) // 45)}   # c: 0 N, 1 NE, ... 7 NW

P = [n for n in NODES if n['t'] == 'P']
radials = []
for L in RAIL['radials']:
    ends = [L[0], L[-1]]
    best = min(P, key=lambda n: min(math.dist((n['E'], n['N']), e) for e in ends))
    # drawn from the London end outwards
    if math.dist((best['E'], best['N']), L[0]) < math.dist((best['E'], best['N']), L[-1]): L = L[::-1]
    pts = [xy(*q) for q in L]
    p = piece(pts); p['node'] = best['id']; p['proposed'] = best['id'] in PROPOSED
    # the National Rail station at its London end: a London terminus if there is one within 700 m (the extract also
    # files "Euston Square" and "King's Cross St Pancras", on the Underground, as national, a few steps from the termini)
    E0, N0 = L[0]; by = sorted(STN, key=lambda q: (q[1] - E0) ** 2 + (q[2] - N0) ** 2)
    term = [q for q in by if math.hypot(q[1] - E0, q[2] - N0) < 700 and q[0].startswith('London ')]
    p['london'] = (term or by)[0][0]
    at, dirn = along(pts, 9 * KM)                              # where the line's name is written, 9 km out
    p['lab'] = [round(at[0], 2), round(at[1], 2)]; p['dir'] = [round(dirn[0], 3), round(dirn[1], 3)]
    radials.append(p)
order = {n['id']: k for k, n in enumerate(P)}
radials.sort(key=lambda r: order[r['node']])

orbital = ring_pieces(RAIL['orbital'][0], NODES)
high = ring_pieces(RAIL['high_speed'][0], P)
reach = {orbital[0]['from']: 0}
for k, seg in enumerate(orbital): reach.setdefault(seg['to'], k + 1)

# the close view: the middle of the six London ends, ZOOM_KM across
ends = [r['a'] for r in radials]
zoom = {'x': round(sum(e[0] for e in ends) / len(ends), 2), 'y': round(sum(e[1] for e in ends) / len(ends), 2),
        'k': round(W / (ZOOM_KM * KM), 3)}

if __name__ == '__main__':
    import sys
    if '--data-only' not in sys.argv:
        centre = save_images(clean_base(), zoom)
    else:
        centre = json.loads(re.search(r'"centre":(\[[^\]]*\])', open(os.path.join(ROOT, 'intro-data.js')).read()).group(1))
    lon = {n['id']: (n['E'], n['N']) for n in NODES}
    data = {
        'W': W, 'H': H, 'zoom': zoom, 'centre': centre,
        'greenbelt': mask('greenbelt', 11, 0.42, 4000, 3.0, 3),
        'radials': radials, 'highSpeed': high, 'orbital': orbital,
        'stations': [{'id': n['id'], 't': n['t'], 'x': round(xy(n['E'], n['N'])[0], 2), 'y': round(xy(n['E'], n['N'])[1], 2),
                      'k': reach.get(n['id'], 0), 'near': near_station(*lon[n['id']])} for n in NODES],
        'km': {'orbital': round(sum(math.dist(a, b) for a, b in zip(RAIL['orbital'][0], RAIL['orbital'][0][1:])) / 1000),
               'highSpeed': round(sum(math.dist(a, b) for a, b in zip(RAIL['high_speed'][0], RAIL['high_speed'][0][1:])) / 1000)},
    }
    out = os.path.join(ROOT, 'intro-data.js')
    with open(out, 'w', encoding='utf-8') as f:
        f.write('/* Loop City step 1 · the opening story\'s drawing. Made by tools/build-intro.py from this page\'s own rail,\n'
                '   stations and layers, and the OpenStreetMap stations: do not edit by hand, run the tool again.\n'
                '   One 1000 x 820 frame = CFG.map.extentBNG. */\n')
        f.write('window.LC_INTRO_DATA = ' + json.dumps(data, ensure_ascii=False, separators=(',', ':')) + ';\n')
    print(out, os.path.getsize(out), 'bytes; zoom', zoom, '; centre', centre)
    for r in radials: print(' ', r['node'], 'London end:', r['london'], '; proposed' if r['proposed'] else '')
    for n in data['stations']: print(' ', n['id'], n['near'])
    for f in ('base', 'centre'):
        p = os.path.join(ROOT, 'img', 'intro', f + '.webp'); print(' ', p, os.path.getsize(p) // 1024, 'KB', Image.open(p).size)
