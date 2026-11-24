"""Loop City step 1 · the catalogue cover (24 Nov 2026): four layers of the page's own data, lifted apart as on the
London map's cover (assets/catalogue/london-map.webp), each labelled on the right.

  01 the slime mould in 2100 and the cells read from it   (the published run: modules/01-loop-city/result/)
  02 the Loop City railway: orbital, high-speed loop, radials, 17 stations   (the same result's base)
  03 the existing roads the mould reads: motorways, A roads, trunk routes     (img/roads_national, roads_regional)
  04 the land it must keep: Green Belt, AONB, national parks                  (img/greenbelt, aonb, nationalparks)

All four share the page's frame (CFG.map.extentBNG), so they stand exactly over each other.

    python3 incubator/loop-city-mould-growth/tools/build-cover.py      # writes assets/catalogue/loop-city-mould-growth.webp

Needs numpy, Pillow and OpenCV; fonts DM Sans (Linux path below)."""
import json, os
import numpy as np, cv2
from PIL import Image, ImageDraw, ImageFont, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
APP = os.path.join(HERE, '..')
ROOT = os.path.join(APP, '..', '..')
RES = os.path.join(ROOT, 'modules', '01-loop-city', 'result')
OUT = os.path.join(ROOT, 'assets', 'catalogue', 'loop-city-mould-growth.webp')
FONT = '/usr/share/fonts/truetype/google-fonts/ofl/dmsans/DMSans[opsz,wght].ttf'

K = 2                                   # drawn at twice the size, then halved
CW, CH = 1200 * K, 800 * K              # the cover
LW = 1400                               # one layer, in its own flat frame
LH = round(LW * 3514 / 4286)
WARM = (227, 180, 123)                  # the page's growth tone (palette C), for the stations
GREEN = (120, 196, 160)

R = json.load(open(os.path.join(RES, 'result.json')))
F = R['frame']
def px(e, n): return ((e - F['e0']) / (F['e1'] - F['e0']) * LW, (F['n1'] - n) / (F['n1'] - F['n0']) * LH)

def mask(name, thresh=10):
    a = np.asarray(Image.open(os.path.join(APP, 'img', name)).convert('RGBA').resize((LW, LH), Image.LANCZOS))
    return a[..., 3].astype(np.float32) / 255 * (a[..., 3] > thresh)

def tint(m, rgb, op):
    out = np.zeros((LH, LW, 4), np.float32)
    out[..., :3] = rgb; out[..., 3] = np.clip(m * op, 0, 1) * 255
    return out

def over(dst, src):                     # straight-alpha "over", float arrays 0..255
    sa = src[..., 3:4] / 255; da = dst[..., 3:4] / 255
    oa = sa + da * (1 - sa)
    rgb = (src[..., :3] * sa + dst[..., :3] * da * (1 - sa)) / np.maximum(oa, 1e-6)
    return np.concatenate([rgb, oa * 255], -1)

def plate(op=0.9, rgb=(10, 10, 12)):
    p = np.zeros((LH, LW, 4), np.float32); p[..., :3] = rgb; p[..., 3] = 255 * op; return p

def lines(features, draw_fn):
    img = Image.new('RGBA', (LW, LH), (0, 0, 0, 0)); d = ImageDraw.Draw(img)
    for f in features: draw_fn(d, f)
    return np.asarray(img).astype(np.float32)

def coords(g):
    if g['type'] == 'LineString': return [g['coordinates']]
    if g['type'] == 'MultiLineString': return g['coordinates']
    if g['type'] == 'Polygon': return g['coordinates']
    if g['type'] == 'MultiPolygon': return [r for p in g['coordinates'] for r in p]
    return []

# ---- 04 the land: the page's dark map with the loop taken out (the opening story's, img/intro/), the Green Belt
#      and the protected landscapes
L4 = np.asarray(Image.open(os.path.join(APP, 'img', 'intro', 'base.webp')).convert('RGBA').resize((LW, LH), Image.LANCZOS)).astype(np.float32)
L4[..., :3] *= 0.9
L4 = over(L4, tint(mask('greenbelt.webp'), GREEN, 0.42))
L4 = over(L4, tint(mask('aonb.webp'), (176, 200, 150), 0.26))
L4 = over(L4, tint(mask('nationalparks.webp'), (190, 210, 170), 0.3))

# ---- 03 the existing roads
L3 = plate(0.5)
L3 = over(L3, tint(mask('urban.webp'), (60, 60, 64), 0.5))
L3 = over(L3, tint(mask('roads_regional.webp', 4), (170, 170, 176), 0.9))
L3 = over(L3, tint(mask('roads_national.webp', 4), (245, 245, 247), 1.0))

# ---- 02 the railway and its stations
L2 = plate(0.45)
def rail(d, f):
    kind = f['properties'].get('kind', '')
    w = 5 if kind == 'orbital' else 3 if 'speed' in kind or kind == 'loop' else 2
    col = (245, 245, 247, 255) if kind == 'orbital' else (200, 200, 206, 230)
    for line in coords(f['geometry']):
        pts = [px(*c[:2]) for c in line]
        if len(pts) > 1: d.line(pts, fill=col, width=w, joint='curve')
L2 = over(L2, lines(R['base']['rails']['features'], rail))
def station(d, f):
    x, y = px(*f['geometry']['coordinates'][:2]); r = 15 if f['properties'].get('kind') == 'primary' else 10
    d.ellipse([x - r, y - r, x + r, y + r], fill=WARM + (255,), outline=(0, 0, 0, 255), width=2)
L2 = over(L2, lines(R['base']['stations']['features'], station))

# ---- 01 the mould in 2100 and the cells read from it
m = np.asarray(Image.open(os.path.join(RES, 'mould-2100.webp')).convert('L').resize((LW, LH), Image.LANCZOS)).astype(np.float32) / 255
L1 = plate(0.5)
L1 = over(L1, tint(np.clip(m * 1.25, 0, 1), (245, 245, 247), 1.0))
def cell(d, f):
    for ring in coords(f['geometry']):
        pts = [px(*c[:2]) for c in ring]
        if len(pts) > 2: d.line(pts + [pts[0]], fill=WARM + (170,), width=3, joint='curve')
L1 = over(L1, lines(R['vectors']['cells']['features'], cell))

# ---- the stack: each layer seen from above and in front, lifted apart
cx = 470 * K
TW, BW, PH = 570 * K, 660 * K, 196 * K          # the plane's far edge, near edge, depth on the cover
CY = [172 * K, 310 * K, 448 * K, 586 * K]       # 01 at the top
def quad(cy):
    return np.float32([[cx - TW / 2, cy - PH / 2], [cx + TW / 2, cy - PH / 2], [cx + BW / 2, cy + PH / 2], [cx - BW / 2, cy + PH / 2]])
def warp(layer, q):
    src = np.float32([[0, 0], [LW, 0], [LW, LH], [0, LH]])
    M = cv2.getPerspectiveTransform(src, q)
    rgba = layer.copy(); rgba[..., :3] *= rgba[..., 3:4] / 255         # premultiplied while it is resampled
    w = cv2.warpPerspective(rgba, M, (CW, CH), flags=cv2.INTER_AREA, borderMode=cv2.BORDER_CONSTANT, borderValue=0)
    a = w[..., 3:4]; w[..., :3] = np.where(a > 0, w[..., :3] / np.maximum(a, 1e-6) * 255, 0); return w

canvas = np.zeros((CH, CW, 4), np.float32); canvas[..., :3] = 11; canvas[..., 3] = 255
img = Image.fromarray(canvas.astype(np.uint8), 'RGBA')
d = ImageDraw.Draw(img)
def dashed(p0, p1, col, dash=7 * K, gap=6 * K, w=1):
    (x0, y0), (x1, y1) = p0, p1; L = max(1, ((x1 - x0) ** 2 + (y1 - y0) ** 2) ** 0.5); t = 0
    while t < L:
        a, b = t / L, min(L, t + dash) / L
        d.line([(x0 + (x1 - x0) * a, y0 + (y1 - y0) * a), (x0 + (x1 - x0) * b, y0 + (y1 - y0) * b)], fill=col, width=w); t += dash + gap
for cy, layer in zip(reversed(CY), [L4, L3, L2, L1]):     # the lowest first
    q = quad(cy)
    w = warp(layer, q)
    img = Image.alpha_composite(img, Image.fromarray(np.clip(w, 0, 255).astype(np.uint8), 'RGBA'))
    d = ImageDraw.Draw(img)
    d.polygon([tuple(p) for p in q], outline=(255, 255, 255, 120), width=K)
# the threads that tie the layers: down the near corners and through the middle, with a dot on each plane
qa, qb = quad(CY[0]), quad(CY[-1])
for i in (3, 2):
    dashed(tuple(qa[i]), tuple(qb[i]), (255, 255, 255, 70), w=K)
for cy in CY: d.ellipse([cx - 3 * K, cy - 3 * K, cx + 3 * K, cy + 3 * K], fill=(255, 255, 255, 220))
dashed((cx, CY[0]), (cx, CY[-1]), (255, 255, 255, 60), w=K)

# ---- the labels, on the right, as on the map's cover
def font(sz, wght):
    f = ImageFont.truetype(FONT, sz * K)
    try: f.set_variation_by_axes([14, wght])
    except Exception: pass
    return f
def spaced(x, y, s, f, fill, track):
    for ch in s:
        d.text((x, y), ch, font=f, fill=fill); x += d.textlength(ch, font=f) + track
    return x
LX = 868 * K
LABELS = [('01', 'SLIME MOULD · 2100', 'CELLS READ FROM ITS HIGHWAYS'),
          ('02', 'LOOP CITY RAIL', '412 KM ORBITAL · 17 STATIONS'),
          ('03', 'EXISTING ROADS', 'MOTORWAYS · A ROADS · TRUNK'),
          ('04', 'GREEN BELT', 'AONB · NATIONAL PARKS')]
for cy, (n, title, sub) in zip(CY, LABELS):
    q = quad(cy); ex = (q[1][0] + q[2][0]) / 2
    d.ellipse([ex - 3 * K, cy - 3 * K, ex + 3 * K, cy + 3 * K], fill=(255, 255, 255, 200))
    d.line([(ex, cy), (LX - 14 * K, cy)], fill=(255, 255, 255, 110), width=K)
    spaced(LX - 4 * K, cy - 15 * K, n, font(10, 400), (160, 160, 166, 255), 1 * K)
    spaced(LX + 18 * K, cy - 18 * K, title, font(15, 600), (245, 245, 247, 255), 2.2 * K)
    spaced(LX + 18 * K, cy + 4 * K, sub, font(10, 400), (150, 150, 156, 255), 1.6 * K)
# the top right: what the page runs, as the map's cover names its themes
x0 = 940 * K; y0 = 92 * K
for i, c in enumerate([(90, 90, 96), (160, 160, 166), (245, 245, 247), WARM, GREEN]):
    d.ellipse([x0 + i * 13 * K, y0, x0 + i * 13 * K + 6 * K, y0 + 6 * K], fill=c + (255,))
spaced(x0 - 2 * K, y0 + 14 * K, '2025 → 2100', font(10, 400), (160, 160, 166, 255), 2 * K)

out = img.convert('RGB').resize((CW // K, CH // K), Image.LANCZOS)
out.save(OUT, 'WEBP', quality=90, method=6)
print('wrote', os.path.relpath(OUT, ROOT), out.size, os.path.getsize(OUT) // 1024, 'KB')
