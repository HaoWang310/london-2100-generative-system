"""The opening film (scripts/intro.js), step 1 of 2: plan rasters of the London map's own data, on its shared
EPSG:3857 grid, cut to the 70 km circle. Every layer is an RGBA float array (N x N, 0..1), written to work/plan/*.png;
build.py turns them into the film's pictures (assets/intro/).

  python3 tools/intro/plates.py && python3 tools/intro/build.py      (from incubator/google-map-live; Pillow + numpy)

Read from the app's own assets/ (heights, drainage, flood risk, planning layers, the Greater London outline) and, for
the OpenStreetMap roads, three screenshots of the app's own dark basemap at the 70 km view (source/intro/roads_*.jpg,
27 Nov 2026; their corners in CSS px of a 2273 px wide capture are listed below)."""
import json, math, os
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

G = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..') + '/'
OUT = G + 'tools/intro/work/plan/'
os.makedirs(OUT, exist_ok=True)
R = 6378137.0
B = [-127813.8696191665, 6596204.025752107, 102461.98815442335, 6827041.923624865]   # west, south, east, north
N = 1800
LAT0, LON0 = 51.50733434456047, -0.12768375058439654


def merc(lon, lat):
    return lon * math.pi / 180 * R, R * math.log(math.tan(math.pi / 4 + lat * math.pi / 360))


def px(x, y):
    return (x - B[0]) / (B[2] - B[0]) * N, (B[3] - y) / (B[3] - B[1]) * N


CX, CY = px(*merc(LON0, LAT0))
RPX = 70000 / math.cos(LAT0 * math.pi / 180) / (B[2] - B[0]) * N
yy, xx = np.mgrid[0:N, 0:N]
# the true circle on the ground (haversine), as the map's workers cut it
lon = (B[0] + (xx + .5) / N * (B[2] - B[0])) / R * 180 / math.pi
lat = (2 * np.arctan(np.exp((B[3] - (yy + .5) / N * (B[3] - B[1])) / R)) - math.pi / 2) * 180 / math.pi
p1, p2 = math.radians(LAT0), np.radians(lat)
h = np.sin((p2 - p1) / 2) ** 2 + math.cos(p1) * np.cos(p2) * np.sin(np.radians(lon - LON0) / 2) ** 2
DIST = 2 * R * np.arcsin(np.sqrt(h))
INSIDE = DIST <= 70000


def save(name, rgba):
    a = np.clip(rgba, 0, 1)
    Image.fromarray((a * 255).astype(np.uint8), 'RGBA').save(OUT + name + '.png')


def hexc(h):
    h = h.lstrip('#'); return np.array([int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)])


def lonlat_px(c):
    return px(*merc(c[0], c[1]))


# ---------------------------------------------------------------- heights (OS Terrain 50, the map's 50 m DEM)
dem = np.asarray(Image.open(G + 'assets/drainage_area/dem50_log16.webp').convert('RGB')).astype(np.float64)
code = dem[..., 0] * 256 + dem[..., 1]
H = np.where(code > 0, -100 + (code - 1) * 0.1, np.nan)
Hn = np.asarray(Image.fromarray(np.nan_to_num(H, nan=0).astype(np.float32)).resize((N, N), Image.BILINEAR))
np.save(OUT + 'heights.npy', Hn)
cell = (B[2] - B[0]) / N * math.cos(math.radians(LAT0))
gy, gx = np.gradient(Hn, cell)
az, alt = math.radians(315), math.radians(42)
slope = np.arctan(np.hypot(gx, gy) * 2.2)
aspect = np.arctan2(-gx, gy)
shade = np.clip(np.sin(alt) * np.cos(slope) + np.cos(alt) * np.sin(slope) * np.cos(az - aspect), 0, 1)
np.save(OUT + 'shade.npy', shade)

# LiDAR layer drawn as a grey hillshade (the ground itself, no colour)
g = 0.10 + 0.62 * shade
lid = np.dstack([g, g, g * 1.02, INSIDE.astype(float)])
save('lidar', lid)

# colour by height: the map's classic ramp, top 300 m, steps closer near sea level, with hill shading
RAMP = ['#3d9be9', '#35c3f0', '#30e0e0', '#2fe6a8', '#2fe66f', '#4be64a', '#7bea3f', '#a6ee3c', '#cdf23a', '#f0f53a',
        '#ffe838', '#ffcf36', '#ffb234', '#ff9432', '#ff7030', '#ff4a30', '#ff5f5f', '#ff8f8f', '#ffc0c0', '#fff0f0']
stops = [-3 + 303 * (i / 19) ** 1.5 for i in range(20)]
idx = np.clip(np.searchsorted(stops, Hn) - 1, 0, 19)
col = np.array([hexc(c) for c in RAMP])[idx]
mult = 0.62 + 0.38 * shade[..., None] * 1.4
rel = np.dstack([np.clip(col * mult, 0, 1), INSIDE.astype(float)])
save('relief', rel)

# ---------------------------------------------------------------- drainage network (upstream area from OS Terrain 50)
ar = np.asarray(Image.open(G + 'assets/drainage_area/area_log16.webp').convert('RGB')).astype(np.float64)
c2 = ar[..., 0] * 256 + ar[..., 1]
A = np.where(c2 > 0, 0.0025 * np.exp((c2 - 1) / 65534 * math.log(20000 / 0.0025)), 0)
# keep the network at full resolution, then thicken by class and shrink with max-pooling
cls = np.zeros(A.shape, np.uint8)
for k, t in enumerate([1, 5, 25, 100]):
    cls[A >= t] = k + 1
im = Image.fromarray(cls)
big = np.asarray(im.filter(ImageFilter.MaxFilter(3)))
cls2 = np.where(cls >= 3, big, cls)
cls_n = np.asarray(Image.fromarray(cls2).resize((N, N), Image.NEAREST))
DCOL = {1: '#2398ff', 2: '#00b7e4', 3: '#00e0e6', 4: '#70fff1'}
dr = np.zeros((N, N, 4))
pool = np.asarray(Image.fromarray(cls2).filter(ImageFilter.MaxFilter(3)).resize((N, N), Image.NEAREST))
for k, c in DCOL.items():
    m = (pool == k) & INSIDE
    dr[m, :3] = hexc(c); dr[m, 3] = 0.55 + 0.11 * k
save('drainage', dr)

# ---------------------------------------------------------------- flood risk (EA, the higher of rivers and sea / surface water)
quads = {}
for rc in ['0-0', '0-1', '1-0', '1-1']:
    quads[rc] = Image.open(G + f'assets/flood_risk/flood_{rc}.webp').convert('RGBA')
w0, h0 = quads['0-0'].size
full = Image.new('RGBA', (w0 * 2, h0 * 2))
for rc, q in quads.items():
    r, c = map(int, rc.split('-')); full.paste(q, (c * w0, r * h0))
fl = np.asarray(full.resize((N, N), Image.NEAREST)).astype(float) / 255
fl[..., 3] *= INSIDE
save('flood', fl)

# ---------------------------------------------------------------- vectors, drawn 2x and reduced
S2 = 2


def poly_rings(geom):
    t = geom['type']; cs = geom['coordinates']
    if t == 'Polygon': return [cs]
    if t == 'MultiPolygon': return cs
    return []


def lines(geom):
    t = geom['type']; cs = geom['coordinates']
    if t == 'LineString': return [cs]
    if t == 'MultiLineString': return cs
    return []


def canvas():
    return Image.new('RGBA', (N * S2, N * S2), (0, 0, 0, 0))


def P(c):
    x, y = lonlat_px(c); return (x * S2, y * S2)


def finish(im, name, clip=True):
    a = np.asarray(im.resize((N, N), Image.LANCZOS)).astype(float) / 255
    if clip: a[..., 3] *= INSIDE
    save(name, a)
    return a


gb = json.load(open(G + 'assets/planning/green_belt.geojson'))
im = canvas(); d = ImageDraw.Draw(im)
for f in gb['features']:
    for poly in poly_rings(f['geometry']):
        d.polygon([P(c) for c in poly[0]], fill=(190, 190, 196, 80))       # AADRL: the Green Belt in grey-white (was olive)
        for hole in poly[1:]:
            d.polygon([P(c) for c in hole], fill=(0, 0, 0, 0))
for f in gb['features']:
    for poly in poly_rings(f['geometry']):
        for ring in poly:
            d.line([P(c) for c in ring], fill=(210, 210, 215, 255), width=2 * S2, joint='curve')
finish(im, 'greenbelt')

ao = json.load(open(G + 'assets/planning/aonb.geojson'))
im = canvas(); d = ImageDraw.Draw(im)
for f in ao['features']:
    for poly in poly_rings(f['geometry']):
        d.polygon([P(c) for c in poly[0]], fill=(150, 150, 158, 40))
for f in ao['features']:
    for poly in poly_rings(f['geometry']):
        for ring in poly:
            pts = [P(c) for c in ring]
            run = 0.0; on = True
            for a, b in zip(pts, pts[1:]):
                L = math.dist(a, b); run += L
                if on: d.line([a, b], fill=(160, 160, 168, 255), width=2 * S2)
                if run > 10 * S2: run = 0; on = not on
finish(im, 'aonb')

rail = json.load(open(G + 'assets/planning/rail.geojson'))
# AADRL: national rail white, every other line (Underground, Overground, Elizabeth, DLR, tram) one red, the 70 km
# circle's #E8463A (was each line's TfL colour)
RC = {'national': (225, 225, 228), 'overground': (232, 70, 58), 'elizabeth': (232, 70, 58), 'dlr': (232, 70, 58),
      'tram': (232, 70, 58), 'underground': (232, 70, 58)}
kinds = {}
for f in rail['features']:
    kinds[f['properties'].get('k')] = kinds.get(f['properties'].get('k'), 0) + 1
print('rail kinds', kinds)
im = canvas(); d = ImageDraw.Draw(im)
for order in ['national', 'underground', 'overground', 'elizabeth', 'dlr', 'tram']:
    for f in rail['features']:
        k = f['properties'].get('k')
        if k != order: continue
        wd = (2 if k == 'national' else 3) * S2
        for ln in lines(f['geometry']):
            d.line([P(c) for c in ln], fill=RC.get(k, (200, 200, 200)) + (255,), width=wd, joint='curve')
finish(im, 'rail')

hs = json.load(open(G + 'assets/planning/highspeed.geojson'))
print('hs props', [f['properties'] for f in hs['features']][:4])
im = canvas(); d = ImageDraw.Draw(im)
for f in hs['features']:
    tun = f['properties'].get('t') == 'tunnel'
    for ln in lines(f['geometry']):
        pts = [P(c) for c in ln]
        if tun:
            run = 0; on = True
            for a, b in zip(pts, pts[1:]):
                run += math.dist(a, b)
                if on: d.line([a, b], fill=(63, 224, 197, 255), width=3 * S2)
                if run > 9 * S2: run = 0; on = not on
        else:
            d.line(pts, fill=(63, 224, 197, 255), width=4 * S2, joint='curve')   # HS1 / HS2: cyan, the one cool accent (was magenta)
finish(im, 'highspeed', clip=False)

gl = json.load(open(G + 'assets/greater_london_outline.geojson'))
im = canvas(); d = ImageDraw.Draw(im)
for f in gl['features']:
    for ln in lines(f['geometry']):
        d.line([P(c) for c in ln], fill=(255, 255, 255, 230), width=2 * S2, joint='curve')
finish(im, 'london', clip=False)

# ---------------------------------------------------------------- OSM roads (the map's own basemap, read off three captures)
CAP = G + 'source/intro/'
caps = [('roads_n.jpg', (70.93, 22.25, 2230.91, 2187.50)), ('roads_c.jpg', (70.93, -521.55, 2230.91, 1643.70)),
        ('roads_s.jpg', (70.93, -1068.17, 2230.91, 1097.08))]
best = np.full((N, N), 1e9); road = np.zeros((N, N))
for fn, (ax, ay, bx, by) in caps:
    im = np.asarray(Image.open(CAP + fn).convert('L')).astype(float)
    sh, sw = im.shape; s = sw / 2273
    X = (ax + (xx + .5) / N * (bx - ax)) * s
    Y = (ay + (yy + .5) / N * (by - ay)) * s
    ok = (X >= 0) & (X < sw - 1) & (Y >= 0) & (Y < sh - 1)
    centre = np.abs(Y - sh / 2)
    use = ok & (centre < best)
    xi = np.clip(X, 0, sw - 1.001); yi = np.clip(Y, 0, sh - 1.001)
    x0 = xi.astype(int); y0 = yi.astype(int); fx = xi - x0; fy = yi - y0
    v = (im[y0, x0] * (1 - fx) * (1 - fy) + im[y0, x0 + 1] * fx * (1 - fy) + im[y0 + 1, x0] * (1 - fx) * fy + im[y0 + 1, x0 + 1] * fx * fy)
    road = np.where(use, 1 - v / 255, road); best = np.where(use, centre, best)
road = np.clip((road - 0.08) / 0.7, 0, 1) * INSIDE
save('roads', np.dstack([np.ones((N, N)) * .96, np.ones((N, N)) * .96, np.ones((N, N)), road]))

json.dump({'N': N, 'cx': CX, 'cy': CY, 'r': RPX}, open(OUT + 'meta.json', 'w'))
print('circle', CX, CY, RPX)
