"""Structure Studio · the catalogue cover (24 Nov 2026): four layers of the app's own result on its default site
(station P2), lifted apart as on the London map's and Loop City 1's covers, each labelled on the right.

  01 the Linear Farm corridors (white), the three-tier tower bases (amber) and the towers
  02 the farmland cells between the corridors, in Sunset (the plan's default colours) by distance from the nearest core
  03 the tensor-field streets the structure stands over                (assets/station-p2.snapshot.json)
  04 the site, the water and the city around it                       (the same snapshot)

The structure is the app's own: engine/structure.js and engine/deck.js run in Node on the snapshot with the page's
default parameters, exactly as the tests do.

    python3 incubator/structure-studio/tools/build-cover.py      # writes assets/catalogue/structure-studio.webp

Needs Node, numpy, Pillow, OpenCV and the DM Sans font (path below)."""
import json, math, os, base64, subprocess, tempfile
import numpy as np, cv2
from PIL import Image, ImageDraw, ImageFont, ImageFilter
HERE = os.path.dirname(os.path.abspath(__file__)); APP = os.path.normpath(os.path.join(HERE, '..'))
ROOT = os.path.normpath(os.path.join(APP, '..', '..'))
OUT = os.path.join(ROOT, 'assets', 'catalogue', 'structure-studio.webp')
NODE = r"""
import { readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
const dir = pathToFileURL(process.argv[2] + '/');
const self = {}; for (const f of ['engine/structure.js', 'engine/deck.js']) new Function('self', 'module', readFileSync(new URL(f, dir), 'utf8'))(self, undefined);
const SS = self.SS, snap = JSON.parse(readFileSync(new URL('assets/station-p2.snapshot.json', dir), 'utf8'));
const html = readFileSync(new URL('index.html', dir), 'utf8'), P = Function('return ' + html.match(/const P = (\{[^}]*\});/)[1])();
const site = SS.prepareSite(snap), F = SS.buildStructure(site, P, new Set()), g = F.grid;
writeFileSync(process.argv[3], JSON.stringify({ W: g.W, H: g.H, RES: g.RES, xmin: g.xmin, ymax: g.ymax, corr: Buffer.from(g.corr).toString('base64'),
  cells: F.cellPolys.map(c => ({ poly: c.poly.map(p => [Math.round(p[0]), Math.round(p[1])]) })),
  towers: F.towers.map(t => [Math.round(t[0]), Math.round(t[1])]),
  plazas: (F.plazas || []).map(p => p.poly.map(q => [Math.round(q[0]), Math.round(q[1])])),
  cores: site.cores.map(c => Array.isArray(c) ? c : (c.p || [c.x, c.y])), ha: site.landHa }));
"""
def structure():
    with tempfile.TemporaryDirectory() as d:
        js, out = os.path.join(d, 'dump.mjs'), os.path.join(d, 'structure.json')
        open(js, 'w').write(NODE); subprocess.run(['node', js, APP, out], check=True)
        return json.load(open(out))
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
SN = json.load(open(R + 'structure-studio/assets/station-p2.snapshot.json')); S = structure()
rings = [p['outer'] for p in SN['pieces']]
xs = [q[0] for r in rings for q in r]; ys = [q[1] for r in rings for q in r]
BX0, BX1, BY0, BY1 = min(xs), max(xs), min(ys), max(ys); SW, SH = BX1 - BX0, BY1 - BY0
LW = 1400; pad = 0.04; K2 = 2; s = (1 - 2 * pad) * LW / SW; LH = round(SH * s + 2 * pad * LW)
def P(x, y): return ((pad * LW + (x - BX0) * s) * K2, (LH - pad * LW - (y - BY0) * s) * K2)
def canvas(): return Image.new('RGBA', (LW * K2, LH * K2), (0, 0, 0, 0))
def done(im): return pil(im.resize((LW, LH), Image.LANCZOS))
def outline(dr, rgb, a, w=2):
    for r in rings: dr.line([P(x, y) for x, y in r] + [P(*r[0])], fill=rgb + (a,), width=w)
def polys(geom):
    if not geom: return []
    if isinstance(geom[0][0], (int, float)): return [geom]
    if isinstance(geom[0][0][0], (int, float)): return geom
    return [r for p in geom for r in p]
# 04 the site: ground, water, the city around it
im = canvas(); dr = ImageDraw.Draw(im)
C = SN['context']
for r in polys(C.get('urban') or []):
    if len(r) > 2: dr.polygon([P(x, y) for x, y in r], fill=(30, 30, 36, 200))
for r in rings: dr.polygon([P(x, y) for x, y in r], fill=(24, 22, 34, 255))
for r in polys(C.get('bld') or []):
    if len(r) > 2: dr.polygon([P(x, y) for x, y in r], fill=(88, 88, 96, 230))
for w in SN['water']:
    for r in polys(w):
        if len(r) > 2: dr.polygon([P(x, y) for x, y in r], fill=(26, 34, 56, 255), outline=(90, 130, 200, 255))
outline(dr, (255, 255, 255), 170)
L4 = over(plate(LH, LW, .92), done(im))
# 03 the tensor-field streets (Tensor Studio's result), as on the plan: dark etched lines
im = canvas(); dr = ImageDraw.Draw(im); outline(dr, (200, 200, 210), 90)
order = {'local': 0, 'through': 1, 'main': 2}
for rd in sorted(SN['roads'], key=lambda r: order.get(r.get('grade'), 0)):
    g = rd.get('grade'); rgb = (225, 225, 232) if g == 'main' else (180, 180, 188) if g == 'through' else (130, 130, 138)
    w = max(2, round(rd.get('width', 6) * s * K2 * 1.2)); dr.line([P(x, y) for x, y in rd['pts']], fill=rgb + (255,), width=w, joint='curve')
L3 = over(plate(LH, LW, .55), done(im))
# 02 farmland: the cells between the corridors, in Sunset by distance from the nearest core
grad = [(0, (255, 214, 140)), (.45, (204, 106, 92)), (1, (28, 36, 66))]
def sunset(t):
    t = max(0, min(1, t))
    for (a, ca), (b, cb) in zip(grad, grad[1:]):
        if t <= b: u = (t - a) / (b - a); return tuple(int(ca[i] + (cb[i] - ca[i]) * u) for i in range(3))
    return grad[-1][1]
cores = S['cores']; dmax = max(math.hypot(x - cx, y - cy) for x, y in ((BX0, BY0), (BX1, BY1), (BX0, BY1), (BX1, BY0)) for cx, cy in cores) * .6
im = canvas(); dr = ImageDraw.Draw(im)
for c in S['cells']:
    pts = c['poly']
    if len(pts) < 3: continue
    mx = sum(p[0] for p in pts) / len(pts); my = sum(p[1] for p in pts) / len(pts)
    d = min(math.hypot(mx - cx, my - cy) for cx, cy in cores) / dmax
    dr.polygon([P(x, y) for x, y in pts], fill=sunset(d) + (235,), outline=(10, 10, 12, 255))
site = Image.new('L', im.size, 0)
sd = ImageDraw.Draw(site)
for r in rings: sd.polygon([P(x, y) for x, y in r], fill=255)
a = np.asarray(im).copy(); a[..., 3] = (a[..., 3].astype(np.float32) * np.asarray(site) / 255).astype(np.uint8); im = Image.fromarray(a, 'RGBA')
dr = ImageDraw.Draw(im); outline(dr, (255, 255, 255), 110)
L2 = over(plate(LH, LW, .55), done(im))
# 01 the Linear Farm: corridors (the deck, white), the tower bases and towers
corr = np.frombuffer(base64.b64decode(S['corr']), np.uint8).reshape(S['H'], S['W'])
im = canvas()
ys_, xs_ = np.nonzero(corr)
gx = S['xmin'] + (xs_ + .5) * S['RES']; gy = S['ymax'] - (ys_ + .5) * S['RES']
X = ((pad * LW + (gx - BX0) * s) * K2).astype(int); Y = ((LH - pad * LW - (gy - BY0) * s) * K2).astype(int)
arr = np.zeros((LH * K2, LW * K2), np.uint8); ok = (X >= 0) & (Y >= 0) & (X < LW * K2) & (Y < LH * K2)
r = max(1, int(S['RES'] * s * K2 / 2 + 1))
for dx in range(-r, r + 1):
    for dy in range(-r, r + 1):
        xx = np.clip(X + dx, 0, LW * K2 - 1); yy = np.clip(Y + dy, 0, LH * K2 - 1); arr[yy[ok], xx[ok]] = 255
deck = Image.fromarray(arr).filter(ImageFilter.GaussianBlur(1))
white = Image.new('RGBA', im.size, (245, 245, 247, 255)); im = Image.composite(white, im, deck)
dr = ImageDraw.Draw(im)
for pz in S['plazas']: dr.polygon([P(x, y) for x, y in pz], fill=(232, 163, 61, 255), outline=(255, 230, 190, 255))
for t in S['towers']:
    X0, Y0 = P(t[0], t[1]); rr = 12
    for k in range(3):
        a = math.radians(90 + k * 120); dr.ellipse([X0 + math.cos(a) * rr - 6, Y0 - math.sin(a) * rr - 6, X0 + math.cos(a) * rr + 6, Y0 - math.sin(a) * rr + 6], fill=(20, 20, 24, 255))
outline(dr, (255, 255, 255), 120)
L1 = over(plate(LH, LW, .5), done(im))
stack([L1, L2, L3, L4], [('01', 'LINEAR FARM CORRIDORS', '15–25 M · 2–3 LEVELS · 2 TOWERS'),
                         ('02', 'FARMLAND CELLS', f"{len(S['cells'])} CELLS BETWEEN THE CORRIDORS"),
                         ('03', 'TENSOR-FIELD STREETS', 'FROM TENSOR STUDIO'),
                         ('04', 'SITE · WATER · CITY', f"STATION P2 · {round(S['ha'])} HA")],
      OUT, 'LINEAR FARM', [(255, 214, 140), (204, 106, 92), (28, 36, 66), (245, 245, 247), (232, 163, 61)])
print('wrote', OUT)
