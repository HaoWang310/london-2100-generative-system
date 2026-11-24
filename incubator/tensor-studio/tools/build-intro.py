#!/usr/bin/env python3
"""Tensor Studio · the method film's pictures (24 Nov 2026).

Runs the app itself (headless Chrome) on its default site, station P2, and takes from it everything the opening
film shows, so every picture and number in the film is the app's own:

  * the layer stack: on a 60 m grid, the direction and weight each kind of data gives a street (terrain, the year's
    wind, summer air, winter cold, water), read with the app's own formulas (buildTarget in app.js), drawn as an
    exploded axonometric, one picture a layer, and the field they add up to;
  * the probe: one point in the south-west of the site, its parts and their sum, against the app's field there;
  * plates of the plan itself: the site (step 1), the field with the conflict reading (step 4);
  * the evidence: the same site grown four times, terrain only / climate only / terrain and water / everything,
    with each network's numbers.

Writes intro/img/*.webp (computer) and intro/img/s/*.webp (phone) and intro/intro-data.js.
Takes about six minutes (four full growths). Run from anywhere:  python3 tools/build-intro.py
Needs: playwright with Chrome at /usr/bin/google-chrome (or CHROME=...), Pillow.
"""
import asyncio, base64, functools, http.server, io, json, math, os, socketserver, sys, threading, time
from PIL import Image
from playwright.async_api import async_playwright

HERE = os.path.dirname(os.path.abspath(__file__))
APP = os.path.dirname(HERE)
ROOT = os.path.dirname(os.path.dirname(APP))              # the repository
OUT = os.path.join(APP, 'intro')
CHROME = os.environ.get('CHROME', '/usr/bin/google-chrome')
PORT = int(os.environ.get('PORT', '8871'))
PROBE = (640, 1060)                                       # site metres from the grid's origin: south-west, terrain against climate

class Q(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass
socketserver.TCPServer.allow_reuse_address = True
srv = socketserver.ThreadingTCPServer(('127.0.0.1', PORT), functools.partial(Q, directory=ROOT)); srv.daemon_threads = True
threading.Thread(target=srv.serve_forever, daemon=True).start()
URL = f'http://127.0.0.1:{PORT}/incubator/tensor-studio/index.html#nointro&lang=en'

# the parts of the field at one grid cell, as buildTarget adds them (app.js); returns [name, angle, weight]
PARTS_JS = r'''
window.__parts = i => {
  const ENV_ = window.__TS.D.env, st = ENV_.stats, wc = v('wC'), ww = $('windOn').checked ? v('wWind') : 0, wsum = v('wSum'), wwin = v('wWin');
  const tot = (wc + ww + wsum + wwin) || 1, eS = st.summerEnergy, eW = st.winterColdEnergy, sS = eS.reduce((a, b) => a + b, 0) || 1, sW = eW.reduce((a, b) => a + b, 0) || 1;
  const FW = floodOn() && v('fW') > 0 ? floodWeights() : null, fW = v('fW') / 100, gW = v('wG') / 100, out = [];
  const tens = list => { let c = 0, s = 0; for (const [t, w] of list){ c += w * Math.cos(2 * t); s += w * Math.sin(2 * t); } return [0.5 * Math.atan2(s, c), Math.hypot(c, s)]; };
  out.push(['terrain', BA.cA[i], BA.cW[i] * wc / tot]);
  const yr = [], su = [], wi = [];
  if (ww > 0){ const M = YEAR[MONTH]; for (let d = 0; d < 8; d++){ const k = DIRS[d], a = M.share[d] * M.v[d] * M.v[d] / YSUM; if (a < 1e-4) continue; yr.push([axisOf(k.frm, k.job), k.S[i] * a * ww / tot]); } }
  for (let d = 0; d < 8; d++){ const k = DIRS[d], sp = k.S[i], aS = wsum / tot * eS[d] / sS, aW = wwin / tot * eW[d] / sW;
    if (aS > 1e-4) su.push([axisOf(k.frm, 'along'), sp * aS]); if (aW > 1e-4) wi.push([axisOf(k.frm, 'across'), sp * aW]); }
  out.push(['wind', ...tens(yr)], ['summer', ...tens(su)], ['winter', ...tens(wi)]);
  const wa = [];
  if (GZ && gW > 0 && GD[i] <= 90) wa.push([GA[i], gW * Math.exp(-((GD[i] / 45) ** 2))]);
  if (FW) wa.push([BA.cA[i] + Math.PI / 2, FW[i] * fW * Math.min(1.5, BA.cW[i])]);
  out.push(['water', ...tens(wa)]);
  return out;
};'''

GRID_JS = r'''(() => { const out = [], STP = 6;
  for (let r = 0; r < ny; r += STP) for (let c = 0; c < nx; c += STP){ const i = r * nx + c, x = c * cell, y = r * cell; if (!inLand(x, y)) continue;
    const f = fieldAtT(x, y); out.push([x, y, __parts(i).map(p => [p[0], +p[1].toFixed(4), +p[2].toFixed(4)]), f === null ? null : +f.toFixed(4), +CLAR[i].toFixed(3)]); }
  return { pts: out, rings: D.pieces.map(p => p.outer.map(q => [Math.round(q[0]), Math.round(q[1])])) }; })()'''

def probe_js(x, y):
    return r'''(() => { const c = Math.round(PX / cell), r = Math.round(PY / cell), i = r * nx + c;
      return { parts: __parts(i).filter(p => p[2] > 0.01).map(p => [p[0], +((p[1] * 180 / Math.PI % 180 + 180) % 180).toFixed(1), +p[2].toFixed(3)]),
               field: +((fieldAtT(c * cell, r * cell) * 180 / Math.PI % 180 + 180) % 180).toFixed(1), clarity: +CLAR[i].toFixed(3) }; })()'''.replace('PX', str(x)).replace('PY', str(y))

# the plan as the app draws it, without the panels: the canvas itself, cut to the site with a margin
PLATE_JS = r'''(() => { let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
  for (const p of D.pieces) for (const q of p.outer){ const X_ = X(q[0]), Y_ = Y(q[1]); x0 = Math.min(x0, X_); x1 = Math.max(x1, X_); y0 = Math.min(y0, Y_); y1 = Math.max(y1, Y_); }
  return { url: document.getElementById('c').toDataURL('image/png'), box: [x0, y0, x1, y1], dpr: DPR }; })()'''

STATS_JS = r'''(() => { const S = netStats(roadNet()); let c = 0, f = 0, n = 0;
  for (let i = 0; i < N; i++){ const x = (i % nx) * cell, y = Math.floor(i / nx) * cell; if (!inLand(x, y)) continue; c += CLAR[i]; f += CONF[i]; n++; }
  const m = /(\d+) streets/.exec(document.getElementById('hud').textContent);
  return { streets: m ? +m[1] : null, km1: +S.km1.toFixed(1), km2: +S.km2.toFixed(1), T: Math.round(S.T), clarity: +(c / n).toFixed(2), conflict: +(f / n).toFixed(2) }; })()'''

VARIANTS = {   # the evidence: everything else at the app's defaults
    'A': {'wC': 70, 'wWind': 0, 'wSum': 0, 'wWin': 0, 'wG': 0, 'fW': 0, 'windOn': False},
    'B': {'wC': 0, 'wWind': 40, 'wSum': 30, 'wWin': 30, 'wG': 0, 'fW': 0, 'windOn': True},
    'C': {'wC': 70, 'wWind': 0, 'wSum': 0, 'wWin': 0, 'wG': 50, 'fW': 40, 'windOn': False},
    'D': {},
}

async def open_app(b):
    ctx = await b.new_context(viewport={'width': 1440, 'height': 900}, device_scale_factor=2)
    pg = await ctx.new_page()
    await pg.goto(URL, wait_until='commit')
    await pg.wait_for_function("document.body && !document.documentElement.classList.contains('ts-boot')", timeout=180000, polling=200)
    await asyncio.sleep(1.2)
    await pg.evaluate(PARTS_JS)
    await pg.evaluate("(() => { const r = document.getElementById('lRose'); if (r && r.checked){ r.checked = false; r.dispatchEvent(new Event('change', { bubbles: true })); } })()")
    return ctx, pg

async def next_step(pg, k):
    for _ in range(14):
        if await pg.evaluate('PM.cur') >= k: return
        await pg.evaluate("""(() => { const li = document.querySelector('.pmStep[data-k="' + PM.cur + '"]');
            const b = li && [...li.querySelectorAll('.pmActs button')].find(b => /Next|下一步/.test(b.textContent)); if (b) b.click(); })()""")
        await asyncio.sleep(1.4)

async def plate(pg, name, wd=1000, ws=640, margin=26):
    r = await pg.evaluate(PLATE_JS)
    im = Image.open(io.BytesIO(base64.b64decode(r['url'].split(',', 1)[1]))).convert('RGB')
    k = r['dpr']; x0, y0, x1, y1 = r['box']
    box = [int((x0 - margin) * k), int((y0 - margin) * k), int((x1 + margin) * k), int((y1 + margin) * k)]
    im = im.crop(box); save(im, name, wd, ws, q=74)
    return im.size

def save(im, name, wd, ws, q=74):
    os.makedirs(os.path.join(OUT, 'img', 's'), exist_ok=True)
    for w, sub in ((wd, ''), (ws, 's')):
        h = round(im.size[1] * w / im.size[0]); out = im.resize((w, h), Image.LANCZOS)
        out.save(os.path.join(OUT, 'img', sub, name + '.webp'), 'WEBP', quality=q - (8 if sub else 0), method=6)

# ---------------------------------------------------------------- the layer stack (exploded axonometric)
LAYERS = [('terrain', '#F2F2F2', ['terrain']), ('wind', '#68C8FF', ['wind']), ('summer', '#E8A33D', ['summer']),
          ('winter', '#9D7CFF', ['winter']), ('water', '#5FBF7A', ['water'])]
FIELD_COL = '#E8463A'

def axon_layers(grid, W, s, sw, lmax):
    a = math.radians(-32); ca, sa = math.cos(a), math.sin(a)
    xs = [q[0] for r in grid['rings'] for q in r]; ys = [q[1] for r in grid['rings'] for q in r]
    CX, CY = (min(xs) + max(xs)) / 2, (min(ys) + max(ys)) / 2
    def P(x, y):
        u = (x - CX) * ca - (y - CY) * sa; v = (x - CX) * sa + (y - CY) * ca; return W / 2 + u * s, -v * s * 0.5
    pts = [P(x, y) for r in grid['rings'] for x, y in r]
    ymin = min(p[1] for p in pts) - 14; ymax = max(p[1] for p in pts) + 14; H = int(ymax - ymin)
    def D_(t):
        dx, dy = math.cos(t), math.sin(t); u = dx * ca - dy * sa; v = dx * sa + dy * ca; X_, Y_ = u, -v * 0.5; L = math.hypot(X_, Y_) or 1; return X_ / L, Y_ / L
    def tsum(lst):
        c = sum(w * math.cos(2 * t) for t, w in lst); s_ = sum(w * math.sin(2 * t) for t, w in lst); return 0.5 * math.atan2(s_, c), math.hypot(c, s_)
    svgs = {}
    for key, col, names in LAYERS + [('field', FIELD_COL, None)]:
        vals = []
        for x, y, parts, f, clar in grid['pts']:
            if names is None:
                if f is not None: vals.append((x, y, f, clar))
            else:
                sel = [(t, w) for n, t, w in parts if n in names and w > 0]
                if sel: t, w = tsum(sel); vals.append((x, y, t, w))
        mx = max(v[3] for v in vals) or 1
        o = [f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 {ymin:.1f} {W} {H}">']
        for ring in grid['rings']:
            o.append('<polygon points="' + ' '.join(f'{P(x, y)[0]:.1f},{P(x, y)[1]:.1f}' for x, y in ring) +
                     f'" fill="rgba(255,255,255,.035)" stroke="{col}" stroke-opacity="{.75 if names is None else .45}" stroke-width="{sw}"/>')
        for x, y, t, w in vals:
            r = w / mx
            if r < 0.04: continue
            X_, Y_ = P(x, y); ux, uy = D_(t); L = lmax * (0.3 + 0.7 * min(1, r))
            o.append(f'<line x1="{X_ - ux * L:.1f}" y1="{Y_ - uy * L:.1f}" x2="{X_ + ux * L:.1f}" y2="{Y_ + uy * L:.1f}" stroke="{col}" '
                     f'stroke-opacity="{0.5 + 0.5 * min(1, r):.2f}" stroke-width="{sw * 1.2:.2f}" stroke-linecap="round"/>')
        o.append('</svg>'); svgs[key] = ''.join(o)
    return svgs, H

async def render_svgs(b, svgs, W, H, sub):
    pg = await (await b.new_context(viewport={'width': W, 'height': H}, device_scale_factor=1)).new_page()
    for key, svg in svgs.items():
        await pg.set_content(f'<html><body style="margin:0;background:transparent">{svg}</body></html>')
        png = await pg.screenshot(omit_background=True, clip={'x': 0, 'y': 0, 'width': W, 'height': H})
        im = Image.open(io.BytesIO(png))
        os.makedirs(os.path.join(OUT, 'img', sub), exist_ok=True)
        im.save(os.path.join(OUT, 'img', sub, 'layer-' + key + '.webp'), 'WEBP', quality=72 if sub else 76, method=6)

async def main():
    t0 = time.time(); data = {'made': time.strftime('%Y-%m-%d'), 'site': 'station P2'}
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=CHROME, args=['--no-sandbox'])
        ctx, pg = await open_app(b)
        grid = await pg.evaluate(GRID_JS)
        data['probe'] = await pg.evaluate(probe_js(*PROBE))
        data['grid'] = {'points': len(grid['pts']), 'cells': await pg.evaluate('N'), 'cell_m': await pg.evaluate('cell'),
                        'ha': round(await pg.evaluate('D.pieces.reduce((s, p) => s + Math.abs(polyArea(p.outer)), 0)') / 1e4, 1),
                        'smooth_m': await pg.evaluate("v('smooth')"),
                        'land': await pg.evaluate('(() => { let n = 0; for (let i = 0; i < N; i++) if (inLand((i % nx) * cell, Math.floor(i / nx) * cell)) n++; return n; })()')}
        data['plates'] = {'site': await plate(pg, 'site')}
        print(f'{time.time() - t0:5.0f} s  site, probe {data["probe"]}')
        await next_step(pg, 4)
        await pg.click('#tgUnder [data-u="conflict"]'); await pg.click('#tgField [data-v="move"]'); await asyncio.sleep(4)
        data['plates']['conflict'] = await plate(pg, 'conflict')
        await pg.click('#tgUnder [data-u="off"]'); await asyncio.sleep(3)
        data['plates']['field'] = await plate(pg, 'field')
        await ctx.close(); print(f'{time.time() - t0:5.0f} s  field plates')
        # the layer stack, at two sizes: the phone's is drawn for its own width so its lines stay crisp
        for sub, W, s, sw, lmax in (('', 1100, 0.44, 1.2, 12), ('s', 680, 0.27, 1.0, 7.5)):
            svgs, H = axon_layers(grid, W, s, sw, lmax); await render_svgs(b, svgs, W, H, sub)
            data['layers' + ('_s' if sub else '')] = {'w': W, 'h': H}
        print(f'{time.time() - t0:5.0f} s  layer stack')
        data['evidence'] = {}
        for k, vals in VARIANTS.items():
            ctx, pg = await open_app(b)
            await pg.evaluate("""(vs) => { for (const [k, v] of Object.entries(vs)){ const e = document.getElementById(k); if (!e) continue;
                if (e.type === 'checkbox') e.checked = v; else e.value = v; e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })); } }""", vals)
            await asyncio.sleep(1)
            await pg.evaluate("document.getElementById('pmAll').click()")
            await pg.wait_for_function('PM.cur >= 8 && !PM.auto && !PM.playing', timeout=600000, polling=500)
            await asyncio.sleep(2.5)
            await plate(pg, 'net-' + k, 760, 480)
            data['evidence'][k] = await pg.evaluate(STATS_JS)
            print(f'{time.time() - t0:5.0f} s  {k} {data["evidence"][k]}')
            await ctx.close()
        await b.close()
    with open(os.path.join(OUT, 'intro-data.js'), 'w') as f:
        f.write('/* Tensor Studio · the method film: numbers read from the app on its default site (tools/build-intro.py). */\n')
        f.write('window.TS_INTRO_DATA = ' + json.dumps(data, separators=(',', ':')) + ';\n')
    sz = lambda d: sum(os.path.getsize(os.path.join(d, n)) for n in os.listdir(d) if n.endswith('.webp'))
    print(f'done in {time.time() - t0:.0f} s; pictures {sz(os.path.join(OUT, "img")) // 1024} KB (computer), {sz(os.path.join(OUT, "img", "s")) // 1024} KB (phone)')

asyncio.run(main())
