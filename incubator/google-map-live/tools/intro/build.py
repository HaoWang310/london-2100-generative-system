"""The opening film (scripts/intro.js), step 2 of 2: its pictures, from the plan rasters plates.py wrote.

Every picture of the film is laid out in one square frame, 1000 x 1000 units, with the 70 km circle at its centre,
450 units across its radius. Each plate is cut to what it holds and written twice, as WebP:
  assets/intro/l/<name>.webp   1.2 px a unit (a 1200 px frame: a computer screen at 2x)
  assets/intro/s/<name>.webp   0.64 px a unit (a phone)
and its box in frame units goes into scripts/intro_data.js (window.LM_INTRO_DATA), with the points the film's labels
stand on. Words are not drawn into any picture: they are the page's, in English, translated like the rest of it.

  python3 tools/intro/plates.py && python3 tools/intro/build.py      (from incubator/google-map-live)
"""
import json, math, os
import numpy as np
from PIL import Image, ImageDraw

G = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..') + '/'
PL = G + 'tools/intro/work/plan/'
OUT = G + 'assets/intro/'
META = json.load(open(PL + 'meta.json'))
NP, PCX, PCY, PR = META['N'], META['cx'], META['cy'], META['r']
FR = 1000; RC = 450                                   # the frame, and the circle's radius in it
HALF = PR * (FR / 2) / RC                             # the frame's half width, in plan pixels
SIZES = {'l': 1.2, 's': 0.64}
PLATES = {}; PTS = {}


def plan(name): return Image.open(PL + name + '.png').convert('RGBA')


def over(base, top, a=1.0):
    if a < 1:
        r, g, b, al = top.split(); top = Image.merge('RGBA', (r, g, b, al.point(lambda v: int(v * a))))
    base.alpha_composite(top); return base


def blank(): return Image.new('RGBA', (NP, NP), (0, 0, 0, 0))


def to_frame(x, y):
    """a plan pixel -> frame units"""
    return round((x - (PCX - HALF)) / (2 * HALF) * FR, 1), round((y - (PCY - HALF)) / (2 * HALF) * FR, 1)


def ll2plan(lon, lat):
    R = 6378137.0; B = [-127813.8696191665, 6596204.025752107, 102461.98815442335, 6827041.923624865]
    x = lon * math.pi / 180 * R; y = R * math.log(math.tan(math.pi / 4 + lat * math.pi / 360))
    return (x - B[0]) / (B[2] - B[0]) * NP, (B[3] - y) / (B[3] - B[1]) * NP


def write(name, img, box, render=None):
    """img: an RGBA picture of the box (x, y, w, h in frame units), drawn at any size; cut to what it holds"""
    bb = img.getbbox()
    if bb is None: raise SystemExit('empty plate ' + name)
    sx = box[2] / img.width; sy = box[3] / img.height
    pad = 2
    bb = (max(0, bb[0] - pad), max(0, bb[1] - pad), min(img.width, bb[2] + pad), min(img.height, bb[3] + pad))
    img = img.crop(bb)
    b = [round(box[0] + bb[0] * sx, 2), round(box[1] + bb[1] * sy, 2), round(img.width * sx, 2), round(img.height * sy, 2)]
    for k, s in SIZES.items():
        w, h = max(2, round(b[2] * s)), max(2, round(b[3] * s))
        im = img.resize((w, h), Image.LANCZOS)
        if im.getextrema()[3][0] == 255: im = im.convert('RGB')           # no transparency: a smaller file
        im.save(OUT + k + '/' + name + '.webp', 'WEBP', quality=72, alpha_quality=80, method=4)
    PLATES[name] = b


def circle_crop(img):
    """the square of the frame, cut from a full plan raster"""
    return img.crop((int(PCX - HALF), int(PCY - HALF), int(PCX + HALF), int(PCY + HALF)))


def frame_plate(name, img, opaque=False):
    """opaque: laid on black (the film's ground), so the file needs no transparency and is much smaller"""
    img = circle_crop(img)
    if opaque: img = Image.alpha_composite(Image.new('RGBA', img.size, (0, 0, 0, 255)), img)
    write(name, img, (0, 0, FR, FR))


def alpha_mul(img, a):
    arr = np.asarray(img).astype(np.float32); arr[..., 3] *= a
    return Image.fromarray(arr.clip(0, 255).astype(np.uint8), 'RGBA')


def axo(img, size, squash=0.5, angle=45):
    """a square picture, turned 45 degrees and flattened: one slab of the stack"""
    sq = img.resize((size, size), Image.LANCZOS)
    a = math.radians(angle); ow = int(size * math.sqrt(2)); oh = int(ow * squash)
    c, s = math.cos(a), math.sin(a); cx = cy = size / 2; ox, oy = ow / 2, oh / 2
    coef = (c, s / squash, cx - c * ox - s / squash * oy, -s, c / squash, cy + s * ox - c / squash * oy)
    return sq.transform((ow, oh), Image.AFFINE, coef, resample=Image.BICUBIC)


def ring(d, cx, cy, rx, ry, fill, width=1):
    pts = [(cx + rx * math.cos(2 * math.pi * i / 360), cy + ry * math.sin(2 * math.pi * i / 360)) for i in range(361)]
    d.line(pts, fill=fill, width=width)


for k in SIZES: os.makedirs(OUT + k, exist_ok=True)

# ------------------------------------------------------------------ 0 · the cover: the map's own 3D city, quiet
city = Image.open(G + 'source/intro/city3d.jpg').convert('L')
city = Image.fromarray(np.clip(np.asarray(city).astype(float) * 0.62, 0, 255).astype(np.uint8))
for k, w in (('l', 1800), ('s', 900)):
    c = city.resize((w, round(city.height * w / city.width)), Image.LANCZOS)
    c.save(OUT + k + '/cover.webp', 'WEBP', quality=74, method=6)
PLATES['cover'] = [0, 0, city.width, city.height]          # its own aspect: the film fits it to the screen (cover)

# ------------------------------------------------------------------ 1 · scope: roads, then Greater London
frame_plate('c1-roads', alpha_mul(plan('roads'), 0.42), True)
frame_plate('c1-london', alpha_mul(plan('london'), 0.95))

# ------------------------------------------------------------------ 2 · the stack: seven slabs, the ground at the bottom
STACK = [(('lidar',), (1.0,)), (('relief',), (0.95,)), (('drainage',), (1.0,)), (('flood',), (0.95,)),
         (('greenbelt', 'aonb'), (1.0, 1.0)), (('rail', 'highspeed'), (1.0, 1.0)), (('roads', 'london'), (0.55, 1.0))]
SW = 470; SX = 290; SY0 = 818; SGAP = 92                 # slab width, its centre x, the bottom slab's centre y, the step
for i, (nm, al) in enumerate(STACK):
    base = blank(); dd = ImageDraw.Draw(base); dd.ellipse((PCX - PR, PCY - PR, PCX + PR, PCY + PR), fill=(10, 10, 12, 175))
    for nn, a in zip(nm, al): over(base, plan(nn), a)
    sq = base.crop((int(PCX - PR), int(PCY - PR), int(PCX + PR), int(PCY + PR)))
    px = int(SW / math.sqrt(2) * 1.6)
    sl = axo(sq, px)
    ring(ImageDraw.Draw(sl), sl.width / 2, sl.height / 2, px / 2 * math.sqrt(2), px / 2 * math.sqrt(2) / 2, (150, 150, 156, 255) if i == 0 else (110, 110, 116, 255), 2)
    w = sl.width / 1.6; h = sl.height / 1.6; y = SY0 - i * SGAP
    write('c2-%d' % (i + 1), sl, (SX - w / 2, y - h / 2, w, h))
    PTS['c2-%d' % (i + 1)] = [SX + SW / 2, y]                     # the slab's right edge: where its label's line starts

# ------------------------------------------------------------------ 3 · the ground: ridge lines, north to south, in eight bands
Hn = np.load(PL + 'heights.npy')
RAMP = ['#3d9be9', '#35c3f0', '#30e0e0', '#2fe6a8', '#2fe66f', '#4be64a', '#7bea3f', '#a6ee3c', '#cdf23a', '#f0f53a',
        '#ffe838', '#ffcf36', '#ffb234', '#ff9432', '#ff7030', '#ff4a30', '#ff5f5f', '#ff8f8f', '#ffc0c0', '#fff0f0']
stops = np.array([-3 + 303 * (i / 19) ** 1.5 for i in range(20)])
rgb = [tuple(int(c[j:j + 2], 16) for j in (1, 3, 5)) for c in RAMP]
SS = 2.4                                                   # px a unit, drawn
BOX3 = (30, 170, 940, 660)                                 # the ridge picture's box in the frame
aw, ah = int(BOX3[2] * SS), int(BOX3[3] * SS)
sx = aw * 0.98 / (2 * PR); sy = sx * 0.5; ex = sx * 0.2; ocx, ocy = aw / 2, ah * 0.53
ROWS = list(range(int(PCY - PR), int(PCY + PR) + 1, 8))
BANDS = 8
for bnd in range(BANDS):
    im = Image.new('RGBA', (aw, ah), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    for row in ROWS[bnd * len(ROWS) // BANDS:(bnd + 1) * len(ROWS) // BANDS]:
        dy = row - PCY; half = math.sqrt(max(0, PR * PR - dy * dy))
        if half < 4: continue
        cols = np.arange(int(PCX - half), int(PCX + half), 2)
        hs = np.clip(Hn[row, cols], 0, None)
        X = ocx + (cols - PCX) * sx; Y = ocy + dy * sy - hs * ex
        pts = list(zip(X, Y))
        d.polygon(pts + [(X[-1], ocy + dy * sy + 4 * SS), (X[0], ocy + dy * sy + 4 * SS)], fill=(0, 0, 0, 255))
        ci = np.clip(np.searchsorted(stops, (hs[:-1] + hs[1:]) / 2) - 1, 0, 19)
        for i in range(len(pts) - 1):
            hm = (hs[i] + hs[i + 1]) / 2; c = rgb[ci[i]]; tt = 0.35 + 0.65 * min(1, hm / 160)
            d.line([pts[i], pts[i + 1]], fill=tuple(int(255 * (1 - tt) + c[j] * tt) for j in range(3)) + (int(150 + 105 * min(1, hm / 120)),),
                   width=int(SS) + (1 if hm > 150 else 0))
    write('c3-%d' % (bnd + 1), im, BOX3)


def ridge_xy(lon, lat):
    px_, py_ = ll2plan(lon, lat); hh = max(0, float(Hn[int(py_), int(px_)]))
    return [round(BOX3[0] + (ocx + (px_ - PCX) * sx) / SS, 1), round(BOX3[1] + (ocy + (py_ - PCY) * sy - hh * ex) / SS, 1)]


PTS['chilterns'] = ridge_xy(-0.62, 51.70); PTS['downs'] = ridge_xy(-0.25, 51.275); PTS['thames'] = ridge_xy(0.25, 51.47)

# ------------------------------------------------------------------ 4 · water: the ground, the drainage in three classes, flood risk
dk = np.asarray(plan('lidar')).astype(float); dk[..., :3] *= 0.35
ground = Image.fromarray(dk.astype(np.uint8), 'RGBA')
frame_plate('c4-ground', ground, True)
frame_plate('c4-flood', over(ground.copy(), alpha_mul(plan('flood'), 0.7)), True)   # the ground with the flood bands on it, under the drainage
dr = np.asarray(plan('drainage')).astype(float)
dr[Hn < 0.5, 3] = 0                                        # not out at sea
for i, col in enumerate([(112, 255, 241), (0, 224, 230), (0, 183, 228)]):
    m = (np.abs(dr[..., 0] - col[0]) < 14) & (np.abs(dr[..., 1] - col[1]) < 14)
    a = dr.copy(); a[~m, 3] = 0
    frame_plate('c4-dr%d' % (i + 1), Image.fromarray(a.astype(np.uint8), 'RGBA'))
PTS['kingston'] = list(to_frame(*ll2plan(-0.3075, 51.4096)))

# ------------------------------------------------------------------ 5 · limits and links
g5 = blank(); over(g5, plan('roads'), 0.12); over(g5, plan('greenbelt'))
frame_plate('c5-belt', g5, True)
frame_plate('c5-aonb', plan('aonb'))
frame_plate('c5-rail', plan('rail'))
frame_plate('c5-hs', plan('highspeed'))
for key, deg in (('hs2', -144.6), ('hs1', 28.6)):         # where each line leaves the circle (read off the raster)
    PTS[key] = [round(FR / 2 + RC * math.cos(math.radians(deg)), 1), round(FR / 2 + RC * math.sin(math.radians(deg)), 1)]

# ------------------------------------------------------------------ 6 · the role: three small slabs, the map's data, under the chain
MS = 230; MX = 170; MY = 500; MG = 50
for j, (nm, al) in enumerate([(('lidar',), (1,)), (('flood', 'drainage'), (1, 1)), (('roads', 'rail', 'highspeed'), (0.6, 1, 1))]):
    base = blank(); dd = ImageDraw.Draw(base); dd.ellipse((PCX - PR, PCY - PR, PCX + PR, PCY + PR), fill=(14, 14, 16, 220))
    for nn, a in zip(nm, al): over(base, plan(nn), a)
    sq = base.crop((int(PCX - PR), int(PCY - PR), int(PCX + PR), int(PCY + PR)))
    px = int(MS / math.sqrt(2) * 1.6); sl = axo(sq, px)
    ring(ImageDraw.Draw(sl), sl.width / 2, sl.height / 2, px / 2 * math.sqrt(2), px / 2 * math.sqrt(2) / 2, (120, 120, 126, 255), 2)
    w = sl.width / 1.6; h = sl.height / 1.6; y = MY + MG - j * MG
    write('c6-%d' % (j + 1), sl, (MX - w / 2, y - h / 2, w, h))

meta = {'frame': FR, 'radius': RC, 'plates': PLATES, 'pts': PTS}
with open(G + 'scripts/intro_data.js', 'w') as f:
    f.write('/* The opening film\'s pictures: each plate\'s box in the 1000 x 1000 frame, and the points its labels stand on.\n'
            '   Written by tools/intro/build.py; do not edit by hand. */\n')
    f.write('window.LM_INTRO_DATA = ' + json.dumps(meta, separators=(',', ':')) + ';\n')
tot = {k: sum(os.path.getsize(OUT + k + '/' + f) for f in os.listdir(OUT + k)) for k in SIZES}
print('plates', len(PLATES), {k: '%.0f kB' % (v / 1024) for k, v in tot.items()})
