"""Tensor Studio · the catalogue cover (24 Nov 2026): four layers of the app's own result on its default site
(station P2), lifted apart as on the London map's and Loop City 1's covers, each labelled on the right.

  01 the streets, three grades at their carriageway widths, and the attractors   (the network as Tensor Studio exports
                                                                                   it, kept in Structure Studio's snapshot)
  02 the tensor field, traced as streamlines, white / lilac / amber by clarity    (intro/motion.json)
  03 the climate: the west wind of the year and of summer, the cold north wind    (intro/motion.json: exposure)
  04 the terrain (contours) and the water                                          (intro/motion.json, the snapshot)

intro/motion.json comes from tools/build-intro.py; run that first if the app's defaults change.

    python3 incubator/tensor-studio/tools/build-cover.py      # writes assets/catalogue/tensor-studio.webp

Needs numpy, Pillow, OpenCV and the DM Sans font (path below)."""
import json, math, os, random
import numpy as np, cv2
from PIL import Image, ImageDraw, ImageFont, ImageFilter
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.normpath(os.path.join(HERE, '..', '..', '..'))
OUT = os.path.join(ROOT, 'assets', 'catalogue', 'tensor-studio.webp')
FONT = '/usr/share/fonts/truetype/google-fonts/ofl/dmsans/DMSans[opsz,wght].ttf'
K = 2
CW, CH = 1200 * K, 800 * K
def stack(layers, labels, out, top_note='', dots=()):
    """layers: four RGBA float arrays (01 first), all the same size."""
    LH, LW = layers[0].shape[:2]
    cx = 418 * K; TW, BW, PH = 570 * K, 660 * K, 196 * K * min(1.0, (LH / LW) / (3514 / 4286))
    CY = [172 * K, 310 * K, 448 * K, 586 * K]
    def quad(cy): return np.float32([[cx - TW / 2, cy - PH / 2], [cx + TW / 2, cy - PH / 2], [cx + BW / 2, cy + PH / 2], [cx - BW / 2, cy + PH / 2]])
    def warp(layer, q):
        src = np.float32([[0, 0], [LW, 0], [LW, LH], [0, LH]]); M = cv2.getPerspectiveTransform(src, q)
        rgba = layer.copy(); rgba[..., :3] *= rgba[..., 3:4] / 255
        w = cv2.warpPerspective(rgba, M, (CW, CH), flags=cv2.INTER_AREA, borderMode=cv2.BORDER_CONSTANT, borderValue=0)
        a = w[..., 3:4]; w[..., :3] = np.where(a > 0, w[..., :3] / np.maximum(a, 1e-6) * 255, 0); return w
    canvas = np.zeros((CH, CW, 4), np.float32); canvas[..., :3] = 11; canvas[..., 3] = 255
    img = Image.fromarray(canvas.astype(np.uint8), 'RGBA'); d = ImageDraw.Draw(img)
    def dashed(p0, p1, col, dash=7 * K, gap=6 * K, w=1):
        (x0, y0), (x1, y1) = p0, p1; L = max(1, ((x1 - x0) ** 2 + (y1 - y0) ** 2) ** 0.5); t = 0
        while t < L:
            a, b = t / L, min(L, t + dash) / L
            d.line([(x0 + (x1 - x0) * a, y0 + (y1 - y0) * a), (x0 + (x1 - x0) * b, y0 + (y1 - y0) * b)], fill=col, width=w); t += dash + gap
    for cy, layer in zip(reversed(CY), list(reversed(layers))):
        q = quad(cy); w = warp(layer, q)
        img = Image.alpha_composite(img, Image.fromarray(np.clip(w, 0, 255).astype(np.uint8), 'RGBA')); d = ImageDraw.Draw(img)
        d.polygon([tuple(p) for p in q], outline=(255, 255, 255, 120), width=K)
    qa, qb = quad(CY[0]), quad(CY[-1])
    for i in (3, 2): dashed(tuple(qa[i]), tuple(qb[i]), (255, 255, 255, 70), w=K)
    for cy in CY: d.ellipse([cx - 3 * K, cy - 3 * K, cx + 3 * K, cy + 3 * K], fill=(255, 255, 255, 220))
    dashed((cx, CY[0]), (cx, CY[-1]), (255, 255, 255, 60), w=K)
    def font(sz, wght):
        f = ImageFont.truetype(FONT, sz * K)
        try: f.set_variation_by_axes([14, wght])
        except Exception: pass
        return f
    def spaced(x, y, s, f, fill, track):
        for ch in s: d.text((x, y), ch, font=f, fill=fill); x += d.textlength(ch, font=f) + track
        return x
    LX = 800 * K
    for cy, (n, title, sub) in zip(CY, labels):
        q = quad(cy); ex = (q[1][0] + q[2][0]) / 2
        d.ellipse([ex - 3 * K, cy - 3 * K, ex + 3 * K, cy + 3 * K], fill=(255, 255, 255, 200))
        d.line([(ex, cy), (LX - 14 * K, cy)], fill=(255, 255, 255, 110), width=K)
        spaced(LX - 4 * K, cy - 22 * K, n, font(14, 400), (160, 160, 166, 255), 1.5 * K)
        spaced(LX + 24 * K, cy - 26 * K, title, font(22, 600), (245, 245, 247, 255), 3 * K)
        spaced(LX + 24 * K, cy + 6 * K, sub, font(15, 400), (160, 160, 166, 255), 2.2 * K)
    x0 = 900 * K; y0 = 70 * K
    for i, c in enumerate(dots): d.ellipse([x0 + i * 19 * K, y0, x0 + i * 19 * K + 9 * K, y0 + 9 * K], fill=tuple(c) + (255,))
    spaced(x0 - 2 * K, y0 + 20 * K, top_note, font(15, 400), (160, 160, 166, 255), 3 * K)
    o = img.convert('RGB').resize((CW // K, CH // K), Image.LANCZOS); o.save(out, 'WEBP', quality=90, method=6); return o

def over(dst, src):
    sa = src[..., 3:4] / 255; da = dst[..., 3:4] / 255; oa = sa + da * (1 - sa)
    rgb = (src[..., :3] * sa + dst[..., :3] * da * (1 - sa)) / np.maximum(oa, 1e-6)
    return np.concatenate([rgb, oa * 255], -1)
def plate(LH, LW, op=0.9, rgb=(10, 10, 12)):
    p = np.zeros((LH, LW, 4), np.float32); p[..., :3] = rgb; p[..., 3] = 255 * op; return p
def pil(img): return np.asarray(img).astype(np.float32)

# ---------------------------------------------------------------- the layers
R = os.path.join(ROOT, 'incubator') + os.sep
M = json.load(open(R + 'tensor-studio/intro/motion.json')); SN = json.load(open(R + 'structure-studio/assets/station-p2.snapshot.json'))
xs = [q[0] for r in M['rings'] for q in r]; ys = [q[1] for r in M['rings'] for q in r]
BX0, BX1, BY0, BY1 = min(xs), max(xs), min(ys), max(ys); SW, SH = BX1 - BX0, BY1 - BY0
LW = 1400; pad = 0.04; LH = round(LW * SH / SW); K2 = 2
s = (1 - 2 * pad) * LW / SW; LH = round(SH * s + 2 * pad * LW)
def P(x, y): return ((pad * LW + (x - BX0) * s) * K2, (LH - pad * LW - (y - BY0) * s) * K2)
def canvas(): return Image.new('RGBA', (LW * K2, LH * K2), (0, 0, 0, 0))
def done(im): return pil(im.resize((LW, LH), Image.LANCZOS))
cols = M['cols']; ix = {c: i for i, c in enumerate(cols)}; st = M['step_m']
G = {(c[0], c[1]): c for c in M['cells']}
def samp(x, y, kc, ks):
    gx, gy = x / st, y / st; i, j = math.floor(gx), math.floor(gy); u, v = gx - i, gy - j; c = s_ = W = 0
    for di, dj, w in ((0, 0, (1-u)*(1-v)), (1, 0, u*(1-v)), (0, 1, (1-u)*v), (1, 1, u*v)):
        q = G.get((i + di, j + dj))
        if q is None: continue
        c += q[ix[kc]] * w if kc else 0; s_ += q[ix[ks]] * w if ks else 0; W += w
    return (c / W, s_ / W) if W > .45 else None
def scal(x, y, k):
    gx, gy = x / st, y / st; i, j = math.floor(gx), math.floor(gy); u, v = gx - i, gy - j; a = W = 0
    for di, dj, w in ((0, 0, (1-u)*(1-v)), (1, 0, u*(1-v)), (0, 1, (1-u)*v), (1, 1, u*v)):
        q = G.get((i + di, j + dj))
        if q is None: continue
        a += q[ix[k]] * w; W += w
    return a / W if W > .45 else None
rnd = random.Random(4)
def seed(): c = rnd.choice(M['cells']); return (c[0] + rnd.random() - .5) * st, (c[1] + rnd.random() - .5) * st
def trace(dirf, n, steps, h):
    out = []
    for _ in range(n):
        x, y = seed(); pts = [(x, y)]; vx = vy = 0
        for _ in range(steps):
            d = dirf(x, y)
            if not d: break
            ux, uy, sp = d
            if vx * ux + vy * uy < 0: ux, uy = -ux, -uy
            if not vx and not vy and rnd.random() < .5: ux, uy = -ux, -uy
            vx, vy = ux, uy; x += ux * h * sp; y += uy * h * sp; pts.append((x, y))
        if len(pts) > 4: out.append(pts)
    return out
def comet(dr, pts, rgb, a0=1.0, w=2):
    n = len(pts)
    for i in range(1, n):
        a = int(255 * a0 * (0.25 + 0.75 * (i / n) ** 1.3)); dr.line([P(*pts[i-1]), P(*pts[i])], fill=rgb + (a,), width=w)
def rings(dr, rgb, a, w=2):
    for r in M['rings']: dr.line([P(x, y) for x, y in r] + [P(*r[0])], fill=rgb + (a,), width=w)
# 04 terrain and water
im = canvas(); dr = ImageDraw.Draw(im)
for r in M['rings']: dr.polygon([P(x, y) for x, y in r], fill=(22, 20, 30, 255))
zs = [k['z'] for k in M['contours']]; z0, z1 = min(zs), max(zs)
for k in M['contours']:
    t = (k['z'] - z0) / max(1e-6, z1 - z0); c = int(70 + 150 * t)
    if len(k['p']) > 1: dr.line([P(x, y) for x, y in k['p']], fill=(c, c, c + 6, 220), width=3)
for poly in SN['water']:
    for ring in (poly if isinstance(poly[0][0], (list, tuple)) else [poly]):
        if len(ring) > 2: dr.polygon([P(x, y) for x, y in ring], fill=(28, 64, 110, 235), outline=(90, 150, 215, 255))
rings(dr, (200, 200, 210), 150)
L4 = over(plate(LH, LW, .92), done(im))
# 03 climate: the west wind (year and summer) and the cold north wind, as they blow
to = lambda frm: (math.cos(math.radians(90 - frm - 180)), math.sin(math.radians(90 - frm - 180)))
im = canvas(); dr = ImageDraw.Draw(im); rings(dr, (200, 200, 210), 90)
for key, frm, rgb, n in (('expYear', M['winds']['year'], (104, 200, 255), 700), ('expWinter', M['winds']['winter'], (157, 124, 255), 380), ('expSummer', M['winds']['summer'], (232, 163, 61), 260)):
    v = to(frm)
    def f(x, y, key=key, v=v):
        e = scal(x, y, key); return None if e is None else (v[0], v[1], .4 + .9 * min(1, e))
    for pts in trace(f, int(n * 1.4), 16, 18): comet(dr, pts, rgb, 1, 4)
L3 = over(plate(LH, LW, .55), done(im))
# 02 the tensor field, by clarity
im = canvas(); dr = ImageDraw.Draw(im); rings(dr, (200, 200, 210), 90)
def ff(x, y):
    q = samp(x, y, None, None); a = scal(x, y, 'field'); c = scal(x, y, 'clarity')
    if a is None: return None
    return (math.cos(a), math.sin(a), .35 + c)
tr = trace(ff, 2300, 20, 15)
lay = canvas(); dl = ImageDraw.Draw(lay)
for pts in tr:
    c = scal(*pts[-1], 'clarity') or 0
    rgb = (245, 245, 247) if c > .45 else (185, 164, 255) if c > .22 else (232, 163, 61)
    comet(dl, pts, rgb, 1, 4)
im = Image.alpha_composite(Image.alpha_composite(im, lay.filter(ImageFilter.GaussianBlur(3))), lay)
L2 = over(plate(LH, LW, .55), done(im))
# 01 the streets, three grades at their widths
im = canvas(); dr = ImageDraw.Draw(im)
for r in M['rings']: dr.polygon([P(x, y) for x, y in r], fill=(18, 16, 26, 200))
order = {'local': 0, 'through': 1, 'main': 2}
for rd in sorted(SN['roads'], key=lambda r: order.get(r.get('grade'), 0)):
    g = rd.get('grade'); rgb = (245, 245, 247) if g == 'main' else (205, 205, 212) if g == 'through' else (150, 150, 158)
    w = max(2, round(rd.get('width', 6) * s * K2 * 1.25))
    dr.line([P(x, y) for x, y in rd['pts']], fill=rgb + (255,), width=w, joint='curve')
rings(dr, (207, 198, 245), 170)
for a in SN['attractors']:
    x, y = (a['x'], a['y']) if isinstance(a, dict) else (a[0], a[1]); X, Y = P(x, y); r = 9
    dr.ellipse([X - r, Y - r, X + r, Y + r], fill=(10, 132, 255, 255))
L1 = over(plate(LH, LW, .5), done(im))
stack([L1, L2, L3, L4], [('01', 'STREETS · THREE GRADES', 'AT REAL CARRIAGEWAY WIDTHS'),
                         ('02', 'TENSOR FIELD', 'CLARITY · CONFLICT'),
                         ('03', 'CLIMATE', 'WIND · SUMMER AIR · WINTER COLD'),
                         ('04', 'TERRAIN · WATER', '1 M CONTOURS · EA FLOOD RISK')],
      OUT, 'STATION P2 · 218 HA', [(245, 245, 247), (185, 164, 255), (232, 163, 61), (104, 200, 255), (90, 150, 215)])
print('wrote', OUT)
