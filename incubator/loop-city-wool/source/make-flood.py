"""Makes site/flood.png: the Environment Agency's flood risk on the site's own grid (British National Grid, 50 m squares,
the same extent as site/alc.png), one value a square in the red channel: 0 none or very low, 2 low, 3 medium, 4 high (a 2-bit palette PNG), the
higher of the two present-day maps (surface water; rivers and the sea), as Tensor Studio reads them.

Source: incubator/google-map-live/assets/flood_risk (EA Risk of Flooding from Surface Water, and from Rivers and Sea;
Open Government Licence v3.0, (c) Environment Agency copyright and/or database right 2025), Web Mercator, about 40 m a
pixel. Each 50 m square takes the highest class at four points inside it (BNG to WGS84 by the Helmert transformation, a few metres out).
Squares outside the EA extent stay 0. Run from the repository's root:  python3 incubator/loop-city-wool/source/make-flood.py
"""
import json, math, os
import numpy as np
from PIL import Image

ROOT = os.path.join(os.path.dirname(__file__), '..', '..', '..')
SRC = os.path.join(ROOT, 'incubator', 'google-map-live', 'assets', 'flood_risk')
OUT = os.path.join(os.path.dirname(__file__), '..', 'site', 'flood.png')
E0, N1, C, W, H = 450000, 250000, 50, 3200, 2600            # as SITE.alc
COLS = {1: (156, 221, 234), 2: (247, 211, 89), 3: (242, 157, 56), 4: (215, 55, 49)}

def bng_to_wgs84(E, N):
    """OSGB36 National Grid to WGS84 latitude and longitude in degrees (arrays), Helmert transformation."""
    a, b = 6377563.396, 6356256.909; F0 = 0.9996012717; lat0 = math.radians(49); lon0 = math.radians(-2); N0, E0_ = -100000, 400000
    e2 = 1 - b * b / (a * a); n = (a - b) / (a + b)
    lat = np.full_like(E, lat0); M = np.zeros_like(E)
    for _ in range(12):
        lat = (N - N0 - M) / (a * F0) + lat
        Ma = (1 + n + 1.25 * n * n + 1.25 * n ** 3) * (lat - lat0); Mb = (3 * n + 3 * n * n + 21 / 8 * n ** 3) * np.sin(lat - lat0) * np.cos(lat + lat0)
        Mc = (15 / 8 * n * n + 15 / 8 * n ** 3) * np.sin(2 * (lat - lat0)) * np.cos(2 * (lat + lat0)); Md = 35 / 24 * n ** 3 * np.sin(3 * (lat - lat0)) * np.cos(3 * (lat + lat0))
        M = b * F0 * (Ma - Mb + Mc - Md)
    s, c, t = np.sin(lat), np.cos(lat), np.tan(lat)
    nu = a * F0 / np.sqrt(1 - e2 * s * s); rho = a * F0 * (1 - e2) / (1 - e2 * s * s) ** 1.5; eta2 = nu / rho - 1
    VII = t / (2 * rho * nu); VIII = t / (24 * rho * nu ** 3) * (5 + 3 * t * t + eta2 - 9 * t * t * eta2); IX = t / (720 * rho * nu ** 5) * (61 + 90 * t * t + 45 * t ** 4)
    X = 1 / (c * nu); XI = 1 / (c * 6 * nu ** 3) * (nu / rho + 2 * t * t); XII = 1 / (c * 120 * nu ** 5) * (5 + 28 * t * t + 24 * t ** 4); XIIA = 1 / (c * 5040 * nu ** 7) * (61 + 662 * t * t + 1320 * t ** 4 + 720 * t ** 6)
    dE = E - E0_
    phi = lat - VII * dE ** 2 + VIII * dE ** 4 - IX * dE ** 6
    lam = lon0 + X * dE - XI * dE ** 3 + XII * dE ** 5 - XIIA * dE ** 7
    # OSGB36 to WGS84: cartesian, Helmert, back
    s, c = np.sin(phi), np.cos(phi); nu = a / np.sqrt(1 - e2 * s * s)
    x = nu * c * np.cos(lam); y = nu * c * np.sin(lam); z = (1 - e2) * nu * s
    tx, ty, tz = 446.448, -125.157, 542.060; sc = -20.4894e-6; rx, ry, rz = [math.radians(v / 3600) for v in (0.1502, 0.2470, 0.8421)]
    x2 = tx + (1 + sc) * x - rz * y + ry * z; y2 = ty + rz * x + (1 + sc) * y - rx * z; z2 = tz - ry * x + rx * y + (1 + sc) * z
    a2, b2 = 6378137.0, 6356752.3142; e22 = 1 - b2 * b2 / (a2 * a2); p = np.sqrt(x2 * x2 + y2 * y2)
    phi = np.arctan2(z2, p * (1 - e22))
    for _ in range(6):
        nu = a2 / np.sqrt(1 - e22 * np.sin(phi) ** 2); phi = np.arctan2(z2 + e22 * nu * np.sin(phi), p)
    return np.degrees(phi), np.degrees(np.arctan2(y2, x2))

def classes(name):
    meta = json.load(open(os.path.join(SRC, name + '_metadata.json')))['web_grid']
    tiles = {}
    for r in range(2):
        for c in range(2):
            tiles[(r, c)] = np.asarray(Image.open(os.path.join(SRC, f'{name}_{r}-{c}.webp')).convert('RGBA')).astype(np.int16)
    th, tw = tiles[(0, 0)].shape[:2]
    full = np.zeros((meta['height'], meta['width']), np.uint8)
    for (r, c), im in tiles.items():
        cls = np.zeros(im.shape[:2], np.uint8)
        best = np.full(im.shape[:2], 10 ** 6, np.int32)
        for k, col in COLS.items():
            d = ((im[..., :3] - np.array(col)) ** 2).sum(-1)
            m = (d < best) & (im[..., 3] > 127) & (d < 3000); cls[m] = k; best[m] = d[m]
        full[r * th:(r + 1) * th, c * tw:(c + 1) * tw] = cls[:min(th, meta['height'] - r * th), :min(tw, meta['width'] - c * tw)]
    return full, meta['affine']

def main():
    out = np.zeros((H, W), np.uint8)
    maps = [classes(name) for name in ('surface_water', 'rivers_sea')]
    R = 6378137.0
    for ox, oy in ((0.25, 0.25), (0.75, 0.25), (0.25, 0.75), (0.75, 0.75)):   # four points in each square: the highest
        xs = E0 + C * (np.arange(W) + ox); ys = N1 - C * (np.arange(H) + oy)
        EE, NN = np.meshgrid(xs, ys)
        lat, lon = bng_to_wgs84(EE.astype(np.float64), NN.astype(np.float64))
        mx = R * np.radians(lon); my = R * np.log(np.tan(np.pi / 4 + np.radians(lat) / 2))
        for full, A in maps:
            col = np.floor((mx - A[2]) / A[0]).astype(int); row = np.floor((my - A[5]) / A[4]).astype(int)
            ok = (col >= 0) & (row >= 0) & (col < full.shape[1]) & (row < full.shape[0])
            v = np.zeros_like(out); v[ok] = full[row[ok], col[ok]]
            out = np.maximum(out, v)
    # a 2-bit palette picture: 0 (none or very low), 2, 3, 4 as grey values, read back from the red channel
    idx = np.select([out >= 4, out == 3, out == 2], [3, 2, 1], 0).astype(np.uint8)
    im = Image.fromarray(idx, 'P'); im.putpalette([0, 0, 0, 2, 2, 2, 3, 3, 3, 4, 4, 4] + [0] * (256 * 3 - 12))
    im.save(OUT, optimize=True, bits=2)
    out = np.where(out == 1, 0, out)
    print('site/flood.png', out.shape, {k: int((out == k).sum()) for k in range(5)}, os.path.getsize(OUT), 'bytes')

main()
