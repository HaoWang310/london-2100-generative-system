#!/usr/bin/env python3
"""Loop City step 1 · the opening story's drawing (24 Nov 2026).

Writes ../intro-data.js from what the page itself holds, so the story shows the same lines as the map:
  - HW_RAIL (the orbital, the high-speed loop, the six radials) and CFG.map.nodes (the 17 stations), read
    from index.html;
  - the built-up area and the Green Belt, traced from img/half/urban.webp and img/half/greenbelt.webp
    (blurred and simplified: a backdrop, not a map layer).
Everything is in one 1000 x 820 frame that covers CFG.map.extentBNG, so the story's frame and the map's sheet
are the same rectangle. Run again when the rail, the stations or the two layers change:

    python3 tools/build-intro.py        (needs numpy, Pillow and opencv-python)
"""
import json, math, os, re
import numpy as np, cv2
from PIL import Image
Image.MAX_IMAGE_PIXELS = None

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
W, H = 1000.0, 820.0

s = open(os.path.join(ROOT, "index.html"), encoding="utf-8").read()
i = s.find("const HW_RAIL = "); j = s.find("};", i)
RAIL = json.loads(s[i + len("const HW_RAIL = "):j + 1])
i = s.find("const CFG = ")
cfg = s[i:i + 400000]
NODES = json.loads(re.search(r'"nodes":(\[.*?\])', cfg, re.S).group(1))
EX = json.loads(re.search(r'"extentBNG":(\{.*?\})', cfg, re.S).group(1))
PROPOSED = json.loads(re.search(r'proposedRadials:\s*(\[[^\]]*\])', s).group(1))

def xy(E, N):
    return ((E - EX["e0"]) / (EX["e1"] - EX["e0"]) * W, (EX["n1"] - N) / (EX["n1"] - EX["n0"]) * H)

def simp(pts, eps):
    a = np.array(pts, dtype=np.float32).reshape(-1, 1, 2)
    return cv2.approxPolyDP(a, eps, False).reshape(-1, 2)

def d_of(a, closed=False, nd=1):
    f = "%%.%df" % nd
    return "M" + " ".join((f + " " + f) % (x, y) for x, y in a) + ("Z" if closed else "")

def piece(pts, eps=0.9, pad=6):
    a = simp(pts, eps)
    x0, y0 = a.min(axis=0) - pad; x1, y1 = a.max(axis=0) + pad
    return {"box": [round(float(x0), 1), round(float(y0), 1), round(float(x1 - x0), 1), round(float(y1 - y0), 1)],
            "d": d_of(a), "a": [round(float(a[0][0]), 1), round(float(a[0][1]), 1)]}

def mask(name, blur, thr, minarea, eps, maxn):
    a = np.array(Image.open(os.path.join(ROOT, "img", "half", name + ".webp")).convert("RGBA"))[..., 3]
    m = cv2.resize((a > 40).astype(np.float32), (int(W), int(H)), interpolation=cv2.INTER_AREA)
    m = cv2.GaussianBlur(m, (0, 0), blur)
    cs, _ = cv2.findContours((m > thr).astype(np.uint8), cv2.RETR_CCOMP, cv2.CHAIN_APPROX_SIMPLE)
    out = []
    for c in sorted(cs, key=cv2.contourArea, reverse=True)[:maxn]:
        if cv2.contourArea(c) < minarea: continue
        out.append(d_of(cv2.approxPolyDP(c, eps, True).reshape(-1, 2), True, 0))
    return " ".join(out)

def nearest(line, p):
    return min(range(len(line)), key=lambda k: (line[k][0] - p[0]) ** 2 + (line[k][1] - p[1]) ** 2)

def ring_pieces(line_bng, stops):
    """A closed line cut at the stations it passes, in the order it passes them, starting at the first stop."""
    line = [xy(*q) for q in line_bng]
    if math.dist(line[0], line[-1]) < 1e-6: line = line[:-1]
    at = sorted(((nearest(line, xy(n["E"], n["N"])), n["id"]) for n in stops))
    k0 = next(k for k, (_, sid) in enumerate(at) if sid == stops[0]["id"])
    at = at[k0:] + at[:k0]
    out = []
    for k, (i0, sid) in enumerate(at):
        i1 = at[(k + 1) % len(at)][0]
        seg = line[i0:i1 + 1] if i1 > i0 else line[i0:] + line[:i1 + 1]
        p = piece(seg); p["from"] = sid; p["to"] = at[(k + 1) % len(at)][1]
        out.append(p)
    return out

P = [n for n in NODES if n["t"] == "P"]
radials = []
for L in RAIL["radials"]:
    ends = [L[0], L[-1]]
    best = min(P, key=lambda n: min(math.dist((n["E"], n["N"]), e) for e in ends))
    # drawn from the London end outwards
    if math.dist((best["E"], best["N"]), L[0]) < math.dist((best["E"], best["N"]), L[-1]): L = L[::-1]
    p = piece([xy(*q) for q in L]); p["node"] = best["id"]; p["proposed"] = best["id"] in PROPOSED
    radials.append(p)
order = {n["id"]: k for k, n in enumerate(P)}
radials.sort(key=lambda r: (r["proposed"], order[r["node"]]))

orbital = ring_pieces(RAIL["orbital"][0], NODES)
high = ring_pieces(RAIL["high_speed"][0], P)
reach = {orbital[0]["from"]: 0}
for k, seg in enumerate(orbital): reach.setdefault(seg["to"], k + 1)

data = {
    "W": W, "H": H,
    "urban": mask("urban", 7, 0.55, 1200, 2.2, 6),
    "greenbelt": mask("greenbelt", 11, 0.42, 4000, 3.0, 3),
    "radials": radials, "highSpeed": high, "orbital": orbital,
    "stations": [{"id": n["id"], "t": n["t"], "x": round(xy(n["E"], n["N"])[0], 1), "y": round(xy(n["E"], n["N"])[1], 1),
                  "k": reach.get(n["id"], 0)} for n in NODES],
    "km": {"orbital": round(sum(math.dist(a, b) for a, b in zip(RAIL["orbital"][0], RAIL["orbital"][0][1:])) / 1000),
           "highSpeed": round(sum(math.dist(a, b) for a, b in zip(RAIL["high_speed"][0], RAIL["high_speed"][0][1:])) / 1000)},
}
out = os.path.join(ROOT, "intro-data.js")
with open(out, "w", encoding="utf-8") as f:
    f.write("/* Loop City step 1 · the opening story's drawing. Made by tools/build-intro.py from this page's own rail,\n"
            "   stations and layers: do not edit by hand, run the tool again. One 1000 x 820 frame = CFG.map.extentBNG. */\n")
    f.write("window.LC_INTRO_DATA = " + json.dumps(data, ensure_ascii=False, separators=(",", ":")) + ";\n")
print(out, os.path.getsize(out), "bytes;", len(radials), "radials,", len(high), "high-speed pieces,", len(orbital), "orbital pieces,",
      len(NODES), "stations; proposed:", PROPOSED, "; km:", data["km"])
