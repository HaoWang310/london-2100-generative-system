"""The catalogue cover of the wool (25 Nov 2026), in the catalogue's layered style: four layers stacked in perspective,
named on the right, the palette's dots above. Takes the layers capture.cjs drew, quietens their colour to sit with the
other covers (saturation about two thirds, the brightest colours darker; white lines stay white), takes the black away
from the three upper layers so the ones below show through, and draws cover.html at 1200 x 800.
    python3 incubator/loop-city-wool/source/cover/compose.py p3 /tmp/wool-cover assets/catalogue/loop-city-wool-v2.webp
Needs Pillow (with WebP), numpy, and Chrome with Playwright as capture.cjs does."""
import sys, os, colorsys, subprocess
from PIL import Image
import numpy as np

pal, src, out = (sys.argv[1:4] + ['p3', '/tmp/wool-cover', 'assets/catalogue/loop-city-wool-v2.webp'][len(sys.argv) - 1:])[:3]
HERE = os.path.dirname(os.path.abspath(__file__))
PAL = {'p1': ('#FF5A2E', '#F4C7A1'), 'p2': ('#E6FF3B', '#4F7BFF'), 'p3': ('#8B2CFF', '#FF2BB8'), 'p4': ('#01AFDF', '#F2782C'), 'p6': ('#00E5FF', '#FFC23D')}

def quiet_hex(h, ks=0.66, kv=0.55, g=0.9):
    r, gg, b = [int(h[i:i + 2], 16) / 255 for i in (1, 3, 5)]; hh, s, v = colorsys.rgb_to_hsv(r, gg, b)
    r, gg, b = colorsys.hsv_to_rgb(hh, s * ks, min(1, v * (1 - kv * s) * g)); return '%02X%02X%02X' % (round(r * 255), round(gg * 255), round(b * 255))

def quiet(im, ks, kv, g):                       # saturation down; the more saturated a colour, the darker it goes
    h = np.asarray(im.convert('HSV')).astype(float); s, v = h[..., 1], h[..., 2]
    return Image.fromarray(np.dstack([h[..., 0], s * ks, v * (1 - kv * s / 255.0) * g]).clip(0, 255).astype(np.uint8), 'HSV').convert('RGB')

def bare(im, gain):                             # black (the page's background) taken away: colour over alpha
    a = np.asarray(im).astype(np.float32)
    bg = np.median(np.concatenate([a[:40, :40].reshape(-1, 3), a[-40:, -200:-160].reshape(-1, 3), a[:40, -300:-260].reshape(-1, 3)]), axis=0)
    a = np.clip((a - bg) * 255.0 / np.maximum(255 - bg, 1), 0, 255); al = a.max(axis=2)
    rgb = np.where(al[..., None] > 0, a * 255.0 / np.maximum(al[..., None], 1), 0)
    return Image.fromarray(np.dstack([np.clip(rgb, 0, 255), np.clip(al * gain, 0, 255)]).astype(np.uint8), 'RGBA')

crop = lambda n: Image.open(f'{src}/{n}.png').convert('RGB').crop((40, 40, 1460, 1060))      # without the map's corners
bare(quiet(crop('L26'), 0.66, 0.55, 0.9), 1.15).save(f'{src}/a26.png')
bare(quiet(crop('L10'), 0.70, 0.25, 1.0), 2.2).save(f'{src}/a10.png')
bare(quiet(crop('L7'), 0.66, 0.55, 0.9), 1.15).save(f'{src}/a7.png')
quiet(crop('L4'), 0.60, 0.45, 0.95).save(f'{src}/m4.png')
dots = ','.join([quiet_hex(PAL[pal][0]), quiet_hex(PAL[pal][1]), 'C9BC92', 'E6E6E6', '7A7A7A'])
png = f'{src}/cover.png'
js = f"""const {{ chromium }} = require(process.env.PLAYWRIGHT || '/opt/npm-tools/node_modules/playwright');
(async () => {{ const b = await chromium.launch({{ executablePath: process.env.CHROME || '/usr/bin/google-chrome', args: ['--allow-file-access-from-files'] }});
  const p = await (await b.newContext({{ viewport: {{ width: 1200, height: 800 }} }})).newPage();
  await p.goto('file://{HERE}/cover.html?dir={src}&dots={dots}'); await p.waitForTimeout(900); await p.screenshot({{ path: '{png}' }}); await b.close(); }})();"""
subprocess.run(['node', '-e', js], check=True)
Image.open(png).convert('RGB').save(out, 'WEBP', quality=86, method=6)
print('cover:', out, os.path.getsize(out), 'bytes')
