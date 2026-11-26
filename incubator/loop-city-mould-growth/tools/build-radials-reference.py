#!/usr/bin/env python3
"""Loop City step 1 · the reference figure of the six radials (24 Nov 2026).

reference/radials.json holds, for each radial, the official name of the line it follows and the stations on it, as
checked against the operators' own sites. This tool places those stations along the radials the page draws (HW_RAIL
in index.html), by the OpenStreetMap stations of reference/osm, and draws one line diagram per radial:

  reference/radials-official.svg   the figure (black, white, the warm tone for the two new lines)
  reference/radials-official.png   the same, if a headless Chrome with Playwright is at hand

Every station is checked to lie within 300 m of its radial; one that does not stops the tool, since it would mean the
radial or the list is wrong. HS2's tunnels and viaducts come from HS2 Ltd's route (highspeed.geojson, 't').

    python3 tools/build-radials-reference.py
"""
import html, json, math, os, re, sys
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
OSM = os.path.join(ROOT, 'reference', 'osm')   # this app's own copy of the OpenStreetMap extract (21 Nov 2026)
REF = os.path.join(ROOT, 'reference')
src = open(os.path.join(HERE, 'build-intro.py'), encoding='utf-8').read()
ns = {'__file__': os.path.join(HERE, 'build-intro.py')}
exec(src[:src.index('# ------------------------------------------------------------------ 1.')], ns)   # the page's rail and the grid conversion
RAIL, NODES, wgs84_to_bng = ns['RAIL'], ns['NODES'], ns['wgs84_to_bng']

R = json.load(open(os.path.join(REF, 'radials.json'), encoding='utf-8'))
OSMST = {}
for f in json.load(open(os.path.join(OSM, 'stations.geojson')))['features']:
    OSMST.setdefault(f['properties']['n'], []).append(wgs84_to_bng(f['geometry']['coordinates'][1], f['geometry']['coordinates'][0]))   # a name can be on several entries (DLR, Underground, Elizabeth line)
P = {n['id']: (n['E'], n['N']) for n in NODES if n['t'] == 'P'}
CHX = (530050, 180430)   # Charing Cross: the London end of a radial is the one nearer it

def radial(pid):
    L = min(RAIL['radials'], key=lambda l: min(math.dist(P[pid], l[0]), math.dist(P[pid], l[-1])))
    a = np.array(L, float)
    return a[::-1] if math.dist(a[0], CHX) > math.dist(a[-1], CHX) else a

def project(a, p):
    """Distance along the polyline a to the point nearest p, and how far p is from it (both in metres)."""
    best, cum = (1e18, 0.0), 0.0
    for s, t in zip(a, a[1:]):
        d = t - s; L = float(np.hypot(*d)); u = 0.0 if L == 0 else max(0.0, min(1.0, float(np.dot(p - s, d)) / (L * L)))
        off = float(np.hypot(*(s + u * d - p)))
        if off < best[0]: best = (off, cum + u * L)
        cum += L
    return best[1], best[0], cum

def where(s, a):
    if 'at' in s: return np.array(wgs84_to_bng(*s['at']))
    n = s.get('osm', s['name'])
    if n not in OSMST: sys.exit(f'{n}: not among the OSM stations')
    return min((np.array(q) for q in OSMST[n]), key=lambda q: project(a, q)[1])   # the entry of that name nearest the radial

def spans(a, key):
    segs = []
    for f in json.load(open(os.path.join(OSM, 'highspeed.geojson')))['features']:
        if f['properties']['k'] != key: continue
        g = f['geometry']; parts = g['coordinates'] if g['type'] == 'MultiLineString' else [g['coordinates']]
        for p in parts:
            q = [np.array(wgs84_to_bng(c[1], c[0])) for c in p]
            segs += [(s, t, f['properties']['t']) for s, t in zip(q, q[1:])]
    runs, cum = [], 0.0
    for s, t in zip(a, a[1:]):
        L = float(np.hypot(*(t - s)))
        for u in np.arange(0, L, 250.0):
            p = s + (t - s) * (u / L)
            d, kind = min(((float(np.hypot(*(s2 + max(0, min(1, float(np.dot(p - s2, t2 - s2)) / max(1e-9, float(np.dot(t2 - s2, t2 - s2))))) * (t2 - s2) - p))), k)
                           for s2, t2, k in segs), key=lambda x: x[0])
            kind = kind if d < 120 else 'off'
            if runs and runs[-1][2] == kind: runs[-1][1] = (cum + u) / 1000
            else: runs.append([(cum + u) / 1000, (cum + u) / 1000, kind])
        cum += L
    return [(a0, a1, k) for a0, a1, k in runs if k in ('tunnel', 'viaduct') and a1 - a0 >= 0.5]

rows = []
for pid in ['P1', 'P2', 'P3', 'P4', 'P5', 'P6']:
    r = R['radials'][pid]; a = radial(pid)
    st = []
    for kind in ('stations', 'passes'):
        for s in r.get(kind, []):
            km, off, total = project(a, where(s, a))
            if off > 300: sys.exit(f'{pid} {s["name"]}: {off:.0f} m from the radial')
            st.append((km / 1000, s['name'], 'on' if kind == 'stations' else 'near'))
    total = project(a, a[-1])[2] / 1000
    sp = spans(a, r['spansFrom']) if r.get('spansFrom') else []
    if r.get('shared'):
        k0 = next(k for k, n, _ in st if n == r['shared']['from']); k1 = next(k for k, n, _ in st if n == r['shared']['to'])
        sp.append((k0, k1, 'shared'))
    rows.append(dict(id=pid, r=r, st=sorted(st), end=total, spans=sp))
    print(pid, r['line'], f'{total:.1f} km', ', '.join(f'{n} {k:.1f}' for k, n, _ in sorted(st)))

# ------------------------------------------------------------------ the figure
W, X0, X1 = 2000, 470, 1930
KMAX = math.ceil(max(r['end'] for r in rows)) + 1
sx = lambda km: X0 + (X1 - X0) * km / KMAX
RH, TOP = 270, 150; H = TOP + RH * len(rows) + 120
GOLD, MUTE = '#E3B47B', 'rgba(255,255,255,.45)'
DIRZH = ['北', '东北', '东', '东南', '南', '西南', '西', '西北']
near = {}
NATIONAL = []
for f in json.load(open(os.path.join(OSM, 'stations.geojson')))['features']:
    q = f['properties']
    if q.get('k') == 'national' and q['n'] not in ns['NOT_NATIONAL']:
        NATIONAL.append((q['n'], *wgs84_to_bng(f['geometry']['coordinates'][1], f['geometry']['coordinates'][0])))
for pid, p in P.items():
    # the nearest National Rail station, as the opening story's labels give it
    n, e, nn = min(NATIONAL, key=lambda q: (q[1] - p[0]) ** 2 + (q[2] - p[1]) ** 2)
    b = (math.degrees(math.atan2(p[0] - e, p[1] - nn)) + 360) % 360
    near[pid] = {'n': R['officialNames'].get(n, n), 'km': round(math.hypot(p[0] - e, p[1] - nn) / 1000, 1), 'c': int(((b + 22.5) % 360) // 45)}
o = [f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}" font-family="DM Sans,-apple-system,PingFang SC,Noto Sans CJK SC,sans-serif">',
     f'<rect width="{W}" height="{H}" fill="#000"/>',
     '<text x="60" y="70" fill="#fff" font-size="34" font-weight="600" letter-spacing="-0.5">六条放射线 · 英国官方线路名与沿线车站</text>',
     f'<text x="60" y="108" fill="{MUTE}" font-size="17">线路名：Network Rail、HS1 Ltd、HS2 Ltd 官方用名 · 站名：National Rail / Network Rail / TfL 官方站名（{R["checked"]} 核对）· 位置：OSM 车站沿本项目放射线量出的距离（km，从伦敦端起）</text>']
for k in range(0, KMAX, 10):
    x = sx(k)
    o.append(f'<line x1="{x}" y1="{TOP - 8}" x2="{x}" y2="{TOP + RH * len(rows)}" stroke="rgba(255,255,255,.07)"/>')
    o.append(f'<text x="{x}" y="{TOP - 16}" fill="{MUTE}" font-size="13" text-anchor="middle">{k} km</text>')
for i, row in enumerate(rows):
    r = row['r']; y0 = TOP + RH * i; yl = y0 + RH - 105; new = r['status'] == 'proposed'; col = GOLD if new else '#fff'
    if i: o.append(f'<line x1="60" y1="{y0}" x2="{W - 60}" y2="{y0}" stroke="rgba(255,255,255,.12)"/>')
    o.append(f'<text x="60" y="{y0 + 52}" fill="{col}" font-size="30" font-weight="700">{row["id"]}</text>')
    title = ('新线 · New line' if new else html.escape(r['line'])) + (f' <tspan fill="{MUTE}" font-weight="500">({r["abbr"]})</tspan>' if r['abbr'] else '')
    o.append(f'<text x="112" y="{y0 + 50}" fill="{col}" font-size="21" font-weight="600">{title}</text>')
    zh = r['zh'] + (f'（法定名 {r["legalName"]}）' if r.get('legalName') else '') if not new else '（本项目新建）'
    o.append(f'<text x="112" y="{y0 + 78}" fill="rgba(255,255,255,.75)" font-size="15">{html.escape(zh)}</text>')
    o.append(f'<text x="112" y="{y0 + 102}" fill="{MUTE}" font-size="14">{html.escape(r["owner"] if not new else "起点 " + r["londonEnd"])}</text>')
    o.append(f'<text x="112" y="{y0 + 124}" fill="{MUTE}" font-size="14">{r["statusZh"]} · {r["statusEn"]}</text>')
    lines = []
    for part in [p for p in r.get('after', {}).get('zh', '').split('；') if p]:
        head, _, tail = part.partition('（')
        lines += [head] + (['　（' + tail] if tail and len(part) > 30 else []) if len(part) > 30 else [part]
    for k2, part in enumerate(lines):
        o.append(f'<text x="112" y="{y0 + 150 + 17 * k2}" fill="{MUTE}" font-size="13">{html.escape(part)}</text>')
    xe = sx(row['end'])
    if new: o.append(f'<line x1="{sx(0)}" y1="{yl}" x2="{xe}" y2="{yl}" stroke="{GOLD}" stroke-width="3" stroke-dasharray="2 7" stroke-linecap="round"/>')
    else: o.append(f'<line x1="{sx(0)}" y1="{yl}" x2="{xe}" y2="{yl}" stroke="#fff" stroke-width="3"/>')
    for a0, a1, t in row['spans']:
        mid = (sx(a0) + sx(a1)) / 2
        if t == 'tunnel':
            o.append(f'<line x1="{sx(a0)}" y1="{yl}" x2="{sx(a1)}" y2="{yl}" stroke="#000" stroke-width="3.2"/>')
            o.append(f'<line x1="{sx(a0)}" y1="{yl}" x2="{sx(a1)}" y2="{yl}" stroke="#fff" stroke-width="1.6" stroke-dasharray="6 5"/>')
            o.append(f'<text x="{mid}" y="{yl + 26}" fill="{MUTE}" font-size="12" text-anchor="middle">隧道 tunnel</text>')
        elif t == 'viaduct':
            o.append(f'<text x="{mid}" y="{yl + 26}" fill="{MUTE}" font-size="12" text-anchor="middle">高架 viaduct</text>')
        elif t == 'shared':
            o.append(f'<line x1="{sx(a0)}" y1="{yl + 9}" x2="{sx(a1)}" y2="{yl + 9}" stroke="{MUTE}" stroke-width="1.4"/>')
            o.append(f'<text x="{sx(a1) + 60}" y="{yl - 14}" fill="{MUTE}" font-size="12">{a0:.1f}–{a1:.1f} km {html.escape(r["shared"]["zh"])}</text>')
    lanes = []   # the other lines' stations: written level under the line, in as many rows as they need not to overlap
    for km, n, t in row['st']:
        x = sx(km)
        if t == 'on':
            o.append(f'<circle cx="{x}" cy="{yl}" r="5.5" fill="#fff" stroke="#000" stroke-width="2"/>')
            o.append(f'<text transform="translate({x + 3},{yl - 12}) rotate(-50)" fill="#fff" font-size="13.5" font-weight="{600 if km < 1 else 500}">{html.escape(n)}</text>')
        else:
            o.append(f'<circle cx="{x}" cy="{yl}" r="4.5" fill="#000" stroke="{MUTE}" stroke-width="1.6"/>')
            w = len(n) * 6.7
            k = next((j for j, end in enumerate(lanes) if x - 4 > end + 10), len(lanes))
            if k == len(lanes): lanes.append(0)
            lanes[k] = x - 4 + w
            ty = yl + 24 + 17 * k
            o.append(f'<line x1="{x}" y1="{yl + 5}" x2="{x}" y2="{ty - 11}" stroke="rgba(255,255,255,.2)"/>')
            o.append(f'<text x="{x - 4}" y="{ty}" fill="{MUTE}" font-size="12.5">{html.escape(n)}</text>')
    nb = near[row['id']]
    note = f'{row["id"]} · {nb["n"]} ' + ('站旁 ' + f"{nb['km']:.1f} km" if nb['km'] < 0.3 else f'{DIRZH[nb["c"]]} {nb["km"]:.1f} km')
    o.append(f'<circle cx="{xe}" cy="{yl}" r="9" fill="none" stroke="{col}" stroke-width="2"/><circle cx="{xe}" cy="{yl}" r="3.5" fill="{col}"/>')
    crowded = any(row['end'] - km < 8 for km, _, t in row['st'] if t == 'on')
    if xe > 1700 and not crowded: o.append(f'<text x="{xe}" y="{yl - 22}" fill="{col}" font-size="14" font-weight="600" text-anchor="end">{html.escape(note)}</text>')
    elif xe > 1700: o.append(f'<text x="{xe}" y="{yl + 34}" fill="{col}" font-size="14" font-weight="600" text-anchor="end">{html.escape(note)}</text>')
    else: o.append(f'<text x="{xe + 14}" y="{yl + 5}" fill="{col}" font-size="14" font-weight="600">{html.escape(note)}</text>')
ly = H - 50
o.append(f'<circle cx="70" cy="{ly}" r="5.5" fill="#fff" stroke="#000" stroke-width="2"/><text x="84" y="{ly + 5}" fill="#fff" font-size="14">本线车站（官方站名）</text>')
o.append(f'<circle cx="270" cy="{ly}" r="4.5" fill="#000" stroke="{MUTE}" stroke-width="1.6"/><text x="284" y="{ly + 5}" fill="{MUTE}" font-size="14">线位经过的其他线路车站（300 m 内，不属本线）</text>')
o.append(f'<line x1="640" y1="{ly}" x2="690" y2="{ly}" stroke="#fff" stroke-width="1.6" stroke-dasharray="6 5"/><text x="700" y="{ly + 5}" fill="{MUTE}" font-size="14">HS2 隧道段（HS2 Ltd 线路数据）</text>')
o.append(f'<line x1="960" y1="{ly}" x2="1010" y2="{ly}" stroke="{GOLD}" stroke-width="3" stroke-dasharray="2 7" stroke-linecap="round"/><text x="1020" y="{ly + 5}" fill="{MUTE}" font-size="14">本项目新建线</text>')
o.append('</svg>')
svg = os.path.join(REF, 'radials-official.svg')
open(svg, 'w', encoding='utf-8').write('\n'.join(o) + '\n')
print(svg)
try:
    import asyncio
    from playwright.async_api import async_playwright
    async def shot():
        async with async_playwright() as p:
            exe = next((e for e in ('/usr/bin/google-chrome', '/usr/bin/chromium') if os.path.exists(e)), None)
            b = await p.chromium.launch(executable_path=exe, args=['--no-sandbox']) if exe else await p.chromium.launch()
            pg = await b.new_page(viewport={'width': W, 'height': H})
            await pg.set_content('<html><body style="margin:0;background:#000">' + open(svg, encoding='utf-8').read() + '</body></html>')
            await pg.wait_for_timeout(400)
            await pg.screenshot(path=os.path.join(REF, 'radials-official.png')); await b.close()
    asyncio.run(shot()); print(os.path.join(REF, 'radials-official.png'))
except Exception as e:
    print('no PNG (Playwright and Chrome are needed for it):', e)
