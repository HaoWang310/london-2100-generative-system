#!/usr/bin/env python3
"""Add the trunk routes that were missing from the existing-roads grid (MA_ROADS in index.html).

23 Nov 2026. MA_ROADS is the existing roads the slime mould reads, one bit a cell on the mould's
1620 x 1328 grid. It held the motorways and the ordinary A roads but not the long trunk routes
(the A12 Chelmsford bypass, the A120, the A421, the A41 ...): 52% of the page's own national roads
layer (img/roads_national.webp) was not in it. The file MA_ROADS was first made from is no longer
to hand, so the missing roads are taken from that layer, which is already here and is on the same
sheet and frame as everything else.

What it does, and nothing more:
  1. reads MA_ROADS out of index.html;
  2. thins img/roads_national.webp to its centre line on the 35 m sheet and puts it on the grid;
  3. turns on a centre-line cell only where MA_ROADS has no road within one cell of it,
     so every cell that was on stays on and none is moved;
  4. writes MA_ROADS back and prints the counts.
Running it again adds nothing.

  python3 tools/add-national-roads.py            (from this app's folder; needs numpy, Pillow, scikit-image)
  python3 tools/add-national-roads.py --check    (changes nothing, prints what it would add)
"""
import base64, re, sys
from pathlib import Path
import numpy as np
from PIL import Image
from skimage.morphology import skeletonize

APP = Path(__file__).resolve().parent.parent
PAGE = APP / 'index.html'
PATTERN = re.compile(r'(const MA_ROADS = \{w:(\d+), h:(\d+), b64:")([^"]+)(")')


def near(mask, r=1):
    out = mask.copy()
    for dy in range(-r, r + 1):
        for dx in range(-r, r + 1):
            out |= np.roll(np.roll(mask, dy, 0), dx, 1)
    return out


def main():
    html = PAGE.read_text(encoding='utf-8')
    m = PATTERN.search(html)
    if not m or len(PATTERN.findall(html)) != 1:
        sys.exit('MA_ROADS was not found exactly once in index.html')
    w, h = int(m.group(2)), int(m.group(3))
    raw = np.frombuffer(base64.b64decode(m.group(4)), dtype=np.uint8)
    grid = np.unpackbits(raw)[:w * h].reshape(h, w).astype(bool)      # most significant bit first, as maRoadCells() reads it

    layer = np.asarray(Image.open(APP / 'img' / 'roads_national.webp'))[..., 3] > 40
    sh, sw = layer.shape
    ys, xs = np.nonzero(skeletonize(layer))
    line = np.zeros((h, w), bool)
    line[ys * h // sh, xs * w // sw] = True

    add = line & ~near(grid, 1)
    new = grid | add
    whole = np.zeros((h, w), bool)
    ys, xs = np.nonzero(layer)
    whole[ys * h // sh, xs * w // sw] = True
    cover = lambda g: 100 * (whole & near(g, 1)).sum() / whole.sum()
    print(f'cells before {int(grid.sum()):,}  added {int(add.sum()):,}  after {int(new.sum()):,}')
    print(f'national layer within one cell of a road cell: before {cover(grid):.0f}%  after {cover(new):.0f}%')
    assert (new & grid).sum() == grid.sum()                           # nothing that was on is off

    if '--check' in sys.argv:
        return
    packed = np.packbits(new.reshape(-1))
    assert len(packed) == len(raw)
    out = base64.b64encode(packed.tobytes()).decode('ascii')
    PAGE.write_text(html[:m.start(4)] + out + html[m.end(4):], encoding='utf-8')
    print('index.html written')


if __name__ == '__main__':
    main()
