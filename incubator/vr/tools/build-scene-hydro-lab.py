#!/usr/bin/env python3
"""London map · Hydro Lab (incubator/google-map-live) → a VR scene (docs/SCENE-FORMAT.md).

Reads the app's own display assets, nothing from the network:
  · terrain      assets/drainage_area/dem50_log16.webp   (OS Terrain 50, 50 m)
  · drainage     assets/drainage_area/area_log16.webp    (contributing area, km²)
  · flood risk   assets/flood_risk/flood_{r}-{c}.webp     (EA RoFRS / RoFSW higher band, 25 m)
  · outline      assets/greater_london_outline.geojson
and writes data/hydro-lab-70km.scene.json on a coarser grid (FACTOR × the 50 m base cells).

Coordinates: the assets share one EPSG:3857 grid. Local metres are Web Mercator metres × cos(51.507°),
which is true ground distance to within about 1 % across the 70 km circle (good for a model, not for survey).
Flood and drainage are display aggregations: a coarse cell takes a flood band only where at least
FLOOD_SHARE of its fine cells reach that band, and the largest upstream area inside it.

  python3 tools/build-scene-hydro-lab.py [FACTOR]      (run inside incubator/vr; needs numpy + Pillow)
"""
import json, math, sys
from pathlib import Path
import numpy as np
from PIL import Image

HERE = Path(__file__).resolve().parent.parent
APP = HERE.parent / 'google-map-live' / 'assets'
OUT = HERE / 'data' / 'hydro-lab-70km.scene.json'
FACTOR = int(sys.argv[1]) if len(sys.argv) > 1 else 6
FLOOD_SHARE = 0.25
LAT0, LON0, RADIUS = 51.50733434456047, -0.12768375058439654, 70000.0   # the app's study circle

meta = json.loads((APP / 'drainage_area' / 'metadata.json').read_text())
x0, y0, x1, y1 = meta['web_grid']['bounds_m']
W, H = meta['web_grid']['width'], meta['web_grid']['height']
K = math.cos(math.radians(LAT0))
px = (x1 - x0) / W                     # Web Mercator metres per base pixel (≈ 80.3)

def code16(path):
    a = np.asarray(Image.open(path).convert('RGB'), dtype=np.int32)
    return a[..., 0] * 256 + a[..., 1]

# terrain (m) and upstream area (km²), NaN where there is no data
enc = meta['terrain_dem_asset']['encoding']
c = code16(APP / 'drainage_area' / 'dem50_log16.webp')
Z = np.where(c > 0, enc['minimum_elevation_m'] + (c - 1) * enc['step_m'], np.nan)
c = code16(APP / 'drainage_area' / 'area_log16.webp')
A = np.where(c > 0, 0.0025 * np.exp((c - 1) / 65534 * math.log(20000 / 0.0025)), np.nan)

# flood classes on the 2× grid
fm = json.loads((APP / 'london_flood_risk_metadata.json').read_text())
rgb2c = {tuple(k['rgba'][:3]): k['code'] for k in fm['classes'] if k['code'] in (1, 2, 3, 4)}
F = np.zeros((H * 2, W * 2), np.uint8)
for p in fm['products']:
    im = np.asarray(Image.open(HERE.parent / 'google-map-live' / p['path']).convert('RGBA'))
    cls = np.zeros(im.shape[:2], np.uint8)
    for col, k in rgb2c.items():
        cls[(im[..., 0] == col[0]) & (im[..., 1] == col[1]) & (im[..., 2] == col[2]) & (im[..., 3] > 0)] = k
    F[p['row'] * p['height']:(p['row'] + 1) * p['height'], p['col'] * p['width']:(p['col'] + 1) * p['width']] = cls

# coarse grid; image row 0 is north, scene row 0 is south
nx, ny = W // FACTOR, H // FACTOR
def blocks(a, f):
    return a[:ny * f, :nx * f].reshape(ny, f, nx, f).swapaxes(1, 2).reshape(ny, nx, f * f)
with np.errstate(all='ignore'):
    Zc = np.nanmean(blocks(Z, FACTOR), axis=2)
    Ac = np.nanmax(blocks(A, FACTOR), axis=2)
Fb = blocks(F, FACTOR * 2)
Fc = np.zeros((ny, nx), np.uint8)
for k in (1, 2, 3, 4):
    Fc[(Fb >= k).mean(axis=2) >= FLOOD_SHARE] = k
Zc, Ac, Fc = Zc[::-1], Ac[::-1], Fc[::-1]

# study circle on the coarse cell centres (spherical distance, R = 6378137 as in the app)
R = 6378137.0
cxm = x0 + (np.arange(nx) + 0.5) * FACTOR * px
yb = y1 - ny * FACTOR * px                                 # south edge of the rows kept (the crop drops the southmost row)
cym = yb + (np.arange(ny) + 0.5) * FACTOR * px            # row 0 = south after the flip
lon = np.degrees(cxm / R)[None, :]
lat = np.degrees(2 * np.arctan(np.exp(cym / R)) - math.pi / 2)[:, None]
p1, p2 = math.radians(LAT0), np.radians(lat)
d = 2 * R * np.arcsin(np.sqrt(np.sin((p2 - p1) / 2) ** 2 + math.cos(p1) * np.cos(p2) * np.sin(np.radians(lon - LON0) / 2) ** 2))
land = (d <= RADIUS) & np.isfinite(Zc)

# drainage classes: ≥ 1, 10, 100, 1000 km² upstream
D = np.zeros((ny, nx), np.uint8)
for i, t in enumerate((1, 10, 100, 1000), 1):
    D[np.nan_to_num(Ac) >= t] = i
D[~land] = 0
Fc[~land] = 0

cell = FACTOR * px * K
def local(lonlat):
    X = R * math.radians(lonlat[0]); Y = R * math.log(math.tan(math.pi / 4 + math.radians(lonlat[1]) / 2))
    return [round((X - x0) * K - cell / 2, 1), round((Y - yb) * K - cell / 2, 1)]

outline = json.loads((APP / 'greater_london_outline.geojson').read_text())
lines = []
for f in outline['features']:
    g = f['geometry']; parts = [g['coordinates']] if g['type'] == 'LineString' else g['coordinates'] if g['type'] in ('MultiLineString', 'Polygon') else [r for poly in g['coordinates'] for r in poly]
    lines += [[local(q) for q in part] for part in parts]
circle = []
for i in range(181):
    b = 2 * math.pi * i / 180; dr = RADIUS / R
    la = math.asin(math.sin(p1) * math.cos(dr) + math.cos(p1) * math.sin(dr) * math.cos(b))
    lo = math.radians(LON0) + math.atan2(math.sin(b) * math.sin(dr) * math.cos(p1), math.cos(dr) - math.sin(p1) * math.sin(la))
    circle.append(local([math.degrees(lo), math.degrees(la)]))

Zs = [None if not math.isfinite(v) else round(float(v), 1) for v in Zc.ravel()]
scene = {
    'format': 'london-2100-vr/scene', 'version': 1,
    'source': 'London map · Hydro Lab · 70 km study circle (OS Terrain 50, EA flood risk, contributing area)',
    'title': {'zh': 'Hydro Lab · 伦敦 70 公里', 'en': 'Hydro Lab · London 70 km'},
    'crs': 'EPSG:3857 × cos(51.507°)', 'origin': [x0, yb], 'note': 'local metres = (Web Mercator − origin) × cos(51.507°) − cell / 2',
    'grid': {'nx': int(nx), 'ny': int(ny), 'cell': round(cell, 3)},
    'Z': Zs, 'land': land.astype(np.uint8).ravel().tolist(), 'flood': Fc.ravel().tolist(), 'drain': D.ravel().tolist(),
    'streets': [], 'fixed': [], 'bridges': [],
    'outlines': [{'pts': l, 'w': 260, 'label': 'Greater London'} for l in lines] + [{'pts': circle, 'w': 200, 'label': '70 km'}],
    'view': {'exag': 12, 'exagMax': 40, 'flood': False, 'drain': True},
}
OUT.write_text(json.dumps(scene, separators=(',', ':')))
print(f'{OUT.name}: {nx}×{ny} cells of {cell:.0f} m, relief {np.nanmin(Zc[land]):.0f}–{np.nanmax(Zc[land]):.0f} m, '
      f'{OUT.stat().st_size / 1e6:.1f} MB, flood cells {int((Fc > 0).sum())}, drainage cells {int((D > 0).sum())}')
