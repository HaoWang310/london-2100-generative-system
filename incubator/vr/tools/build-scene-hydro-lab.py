#!/usr/bin/env python3
"""London map · Hydro Lab (incubator/google-map-live) → a VR scene (docs/SCENE-FORMAT.md).

Reads the app's own display assets, nothing from the network:
  · terrain      assets/drainage_area/dem50_log16.webp   (OS Terrain 50, 50 m)
  · drainage     assets/drainage_area/area_log16.webp    (contributing area, km²)
  · flood risk   assets/flood_risk/flood_{r}-{c}.webp     (EA RoFRS / RoFSW higher band, 25 m)
  · outline      assets/greater_london_outline.geojson
and writes data/hydro-lab-70km.scene.json on a coarser grid (FACTOR × the 50 m base cells).

Coordinates (v0.52): the scene grid is laid on the British National Grid (EPSG:27700), like every other app here —
local metres = National Grid − origin, cell centres at whole multiples of the cell. The assets share one EPSG:3857 grid;
each scene cell reads the FACTOR × FACTOR base pixels around the point where its centre falls on that grid.
The National Grid formulas below are a numpy copy of src/epsg27700.js (Helmert + OS Transverse Mercator).
Flood and drainage are display aggregations: a coarse cell takes a flood band only where at least
FLOOD_SHARE of its fine cells reach that band, and the largest upstream area inside it.

  python3 tools/build-scene-hydro-lab.py [FACTOR]      (run inside incubator/vr; needs numpy + Pillow)
"""
import json, math, sys
from pathlib import Path
import numpy as np
from PIL import Image

# ---- EPSG:27700, numpy copy of src/epsg27700.js (same constants, same steps) ----
DEG, ARCSEC = math.pi / 180, math.pi / 180 / 3600
AIRY, WGS = (6377563.396, 6356256.909), (6378137.0, 6356752.314245)
F0, LAT0G, LON0G, N0G, E0G = 0.9996012717, 49 * DEG, -2 * DEG, -100000.0, 400000.0
TO_OSGB = (-446.448, 125.157, -542.060, 20.4894e-6, -0.1502 * ARCSEC, -0.2470 * ARCSEC, -0.8421 * ARCSEC)
TO_WGS = (446.448, -125.157, 542.060, -20.4894e-6, 0.1502 * ARCSEC, 0.2470 * ARCSEC, 0.8421 * ARCSEC)

def _cart(lat, lon, ell):
    a, b = ell; e2 = 1 - b * b / (a * a); nu = a / np.sqrt(1 - e2 * np.sin(lat) ** 2)
    return nu * np.cos(lat) * np.cos(lon), nu * np.cos(lat) * np.sin(lon), nu * (1 - e2) * np.sin(lat)

def _uncart(x, y, z, ell):
    a, b = ell; e2 = 1 - b * b / (a * a); p = np.hypot(x, y); lat = np.arctan2(z, p * (1 - e2))
    for _ in range(10):
        nu = a / np.sqrt(1 - e2 * np.sin(lat) ** 2); lat = np.arctan2(z + e2 * nu * np.sin(lat), p)
    return lat, np.arctan2(y, x)

def _helmert(x, y, z, t):
    tx, ty, tz, sc, rx, ry, rz = t; s1 = 1 + sc
    return tx + s1 * x - rz * y + ry * z, ty + rz * x + s1 * y - rx * z, tz - ry * x + rx * y + s1 * z

def _arc(lat):
    a, b = AIRY; n = (a - b) / (a + b); n2, n3 = n * n, n ** 3; dl, sl = lat - LAT0G, lat + LAT0G
    return b * F0 * ((1 + n + 1.25 * n2 + 1.25 * n3) * dl - (3 * n + 3 * n2 + 2.625 * n3) * np.sin(dl) * np.cos(sl)
                     + (1.875 * n2 + 1.875 * n3) * np.sin(2 * dl) * np.cos(2 * sl) - (35 / 24) * n3 * np.sin(3 * dl) * np.cos(3 * sl))

def to_bng(lon, lat):
    """WGS84 degrees → EPSG:27700 metres (arrays or scalars)"""
    lat, lam = _uncart(*_helmert(*_cart(np.radians(lat), np.radians(lon), WGS), TO_OSGB), AIRY)
    a, b = AIRY; e2 = 1 - b * b / (a * a); sn, cs, tn = np.sin(lat), np.cos(lat), np.tan(lat)
    nu = a * F0 / np.sqrt(1 - e2 * sn * sn); rho = a * F0 * (1 - e2) / (1 - e2 * sn * sn) ** 1.5; eta2 = nu / rho - 1
    I = _arc(lat) + N0G; II = nu / 2 * sn * cs; III = nu / 24 * sn * cs ** 3 * (5 - tn ** 2 + 9 * eta2); IIIA = nu / 720 * sn * cs ** 5 * (61 - 58 * tn ** 2 + tn ** 4)
    IV = nu * cs; V = nu / 6 * cs ** 3 * (nu / rho - tn ** 2); VI = nu / 120 * cs ** 5 * (5 - 18 * tn ** 2 + tn ** 4 + 14 * eta2 - 58 * tn ** 2 * eta2)
    dL = lam - LON0G
    return E0G + IV * dL + V * dL ** 3 + VI * dL ** 5, I + II * dL ** 2 + III * dL ** 4 + IIIA * dL ** 6

def to_wgs(E, N):
    """EPSG:27700 metres → WGS84 degrees, refined so to_bng(to_wgs(p)) == p (as src/epsg27700.js)"""
    E, N = np.asarray(E, float), np.asarray(N, float); a, b = AIRY; e2 = 1 - b * b / (a * a)
    lat = np.full(E.shape, LAT0G); M = np.zeros(E.shape)
    for _ in range(30):
        lat = (N - N0G - M) / (a * F0) + lat; M = _arc(lat)
        if np.all(np.abs(N - N0G - M) < 1e-5): break
    sn, cs, tn = np.sin(lat), np.cos(lat), np.tan(lat)
    nu = a * F0 / np.sqrt(1 - e2 * sn * sn); rho = a * F0 * (1 - e2) / (1 - e2 * sn * sn) ** 1.5; eta2 = nu / rho - 1; sec = 1 / cs
    VII = tn / (2 * rho * nu); VIII = tn / (24 * rho * nu ** 3) * (5 + 3 * tn ** 2 + eta2 - 9 * tn ** 2 * eta2); IX = tn / (720 * rho * nu ** 5) * (61 + 90 * tn ** 2 + 45 * tn ** 4)
    X = sec / nu; XI = sec / (6 * nu ** 3) * (nu / rho + 2 * tn ** 2); XII = sec / (120 * nu ** 5) * (5 + 28 * tn ** 2 + 24 * tn ** 4)
    XIIA = sec / (5040 * nu ** 7) * (61 + 662 * tn ** 2 + 1320 * tn ** 4 + 720 * tn ** 6); dE = E - E0G
    phi = lat - VII * dE ** 2 + VIII * dE ** 4 - IX * dE ** 6; lam = LON0G + X * dE - XI * dE ** 3 + XII * dE ** 5 - XIIA * dE ** 7
    la, lo = _uncart(*_helmert(*_cart(phi, lam, AIRY), TO_WGS), WGS); lon, lat = np.degrees(lo), np.degrees(la)
    for _ in range(4):
        e, n = to_bng(lon, lat); lon = lon + (E - e) / (111320 * np.cos(np.radians(lat))); lat = lat + (N - n) / 111132
    return lon, lat

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

# scene grid on the National Grid: cells of FACTOR base pixels (≈ 300 m, rounded to whole metres), centred on the study centre
R = 6378137.0
cell = float(round(FACTOR * px * K))
Ec, Nc = to_bng(LON0, LAT0)
nx = ny = int(math.ceil(2 * (RADIUS + 2 * cell) / cell)) | 1
OE, ON = round(float(Ec) - (nx - 1) / 2 * cell), round(float(Nc) - (ny - 1) / 2 * cell)   # origin: centre of cell (0, 0), whole metres
gE = OE + np.arange(nx)[None, :] * cell + np.zeros((ny, 1)); gN = ON + np.arange(ny)[:, None] * cell + np.zeros((1, nx))   # row 0 = south
lon, lat = to_wgs(gE, gN)
# where each cell centre falls on the assets' Web Mercator grid (image row 0 is north) → the FACTOR × FACTOR base pixels around it
fx = (R * np.radians(lon) - x0) / px; fy = (y1 - R * np.log(np.tan(math.pi / 4 + np.radians(lat) / 2))) / px
ix0 = np.rint(fx - FACTOR / 2).astype(int); iy0 = np.rint(fy - FACTOR / 2).astype(int)
ok = (ix0 >= 0) & (iy0 >= 0) & (ix0 + FACTOR <= W) & (iy0 + FACTOR <= H)
o = np.arange(FACTOR)
def gather(a, f, sx, sy):
    """a[sy + i, sx + j] for i, j < f, per cell → (ny, nx, f * f); cells off the picture read row / column 0"""
    yy = np.where(ok, sy, 0)[..., None, None] + np.arange(f)[:, None]; xx = np.where(ok, sx, 0)[..., None, None] + np.arange(f)[None, :]
    return a[yy, xx].reshape(ny, nx, f * f)
with np.errstate(all='ignore'):
    Zc = np.where(ok, np.nanmean(gather(Z, FACTOR, ix0, iy0), axis=2), np.nan)
    Ac = np.where(ok, np.nanmax(gather(A, FACTOR, ix0, iy0), axis=2), np.nan)
Fb = gather(F, FACTOR * 2, ix0 * 2, iy0 * 2)
Fc = np.zeros((ny, nx), np.uint8)
for k in (1, 2, 3, 4):
    Fc[((Fb >= k).mean(axis=2) >= FLOOD_SHARE) & ok] = k

# study circle on the cell centres (spherical distance, R = 6378137 as in the app)
p1, p2 = math.radians(LAT0), np.radians(lat)
d = 2 * R * np.arcsin(np.sqrt(np.sin((p2 - p1) / 2) ** 2 + math.cos(p1) * np.cos(p2) * np.sin(np.radians(lon - LON0) / 2) ** 2))
land = (d <= RADIUS) & np.isfinite(Zc)

# drainage classes: ≥ 1, 10, 100, 1000 km² upstream
D = np.zeros((ny, nx), np.uint8)
for i, t in enumerate((1, 10, 100, 1000), 1):
    D[np.nan_to_num(Ac) >= t] = i
D[~land] = 0
Fc[~land] = 0

def local(lonlat):
    e, n = to_bng(lonlat[0], lonlat[1])
    return [round(float(e) - OE, 1), round(float(n) - ON, 1)]

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
    'crs': 'EPSG:27700', 'origin': [OE, ON], 'note': 'National Grid = origin + local metres; cell (i, j) centre at origin + [i, j] × cell',
    'grid': {'nx': int(nx), 'ny': int(ny), 'cell': round(cell, 3)},
    'Z': Zs, 'land': land.astype(np.uint8).ravel().tolist(), 'flood': Fc.ravel().tolist(), 'drain': D.ravel().tolist(),
    'streets': [], 'fixed': [], 'bridges': [],
    'outlines': [{'pts': l, 'w': 260, 'label': 'Greater London'} for l in lines] + [{'pts': circle, 'w': 200, 'label': '70 km'}],
    'view': {'exag': 12, 'exagMax': 40, 'flood': False, 'drain': True},
}
OUT.write_text(json.dumps(scene, separators=(',', ':')))
print(f'{OUT.name}: {nx}×{ny} cells of {cell:.0f} m, relief {np.nanmin(Zc[land]):.0f}–{np.nanmax(Zc[land]):.0f} m, '
      f'{OUT.stat().st_size / 1e6:.1f} MB, flood cells {int((Fc > 0).sum())}, drainage cells {int((D > 0).sum())}')
