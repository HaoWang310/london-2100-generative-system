# CLAUDE.md: Loop City live (three pages that work together)

This folder is one app made of three self-contained HTML pages. Read this before you change anything here.

| Page | What it does | Opens |
|---|---|---|
| `01_Loop City - Mould and cells.html` | Grows the slime mould over the whole Loop City ring, year by year. Its veins become the loop highways (M roads), and the land between them becomes cells. The user picks up to 10 neighbouring cells. | 02, with the cells |
| `02_Loop City - Wool.html` | Inside each cell: grows the wool (threads between anchors), reads the road hierarchy (M, A, B, C) from it, fillets the corners, places the parcels and capsule stops. A zoom-in draws every road at its real width, with every junction. | 03, with the parcels |
| `03_Loop City - Base for the tensor field.html` | Puts the parcels the user took onto the base map and saves the site file for Hao's tensor studio. | — |
| `index.html` | A launcher that links to 01 (EN or 中文). | — |

## How the two systems work together

1. **The mould (01)** decides the large scale. It sets where the loop's highways run, where the stations sit and how the land splits into cells. A cell is the land inside a ring of mould veins.
2. **01 → 02 (the cell package).** Page 01 opens page 02 by its file name. When 02 has loaded, it posts `{type: 'wool-ready'}` to `window.opener`. Page 01 answers with `{type: 'loop-city-cell-package', pkg}`. Part 01 below describes the package.
3. **The wool (02)** decides the small scale. Inside each cell's own boundary it bakes the ground on a 10 m grid (soil grades, towns, existing roads), puts anchors where existing roads and the loop meet the cell's edge, and relaxes the wool between them. It then reads roads out of the wool by continuity: M roads are the loop highways only, and the other roads are A, B and C.
4. **02 → 03 (the parcel package).** At step 16 the user takes parcels and double-clicks. Page 02 opens page 03, which posts `{type: 'tensor-base-ready'}`. Page 02 answers with `{type: 'loop-city-parcel-package', pkg}`.
5. **The base (03)** writes the "Tensor site" JSON that Hao's tensor studio takes as its site input.

Each page also opens on its own. Page 02 has a file button for a saved cell package, and page 03 for a saved parcel package.

## Conventions in all three pages

- **Self-contained:** no external files and no server. They run from `file://` (double-click) and from GitHub Pages. The site data, about 20 MB, is inlined in 01 and 02.
- **EN | 中文 switch:** top left, with a dictionary in each page. New text on screen needs a 中文 entry.
- **The panels:** the left panel holds what changes the result; the right panel holds the look (dark or light, colours, line weights, layers). Changing the look never reruns the model.
- **Coordinates:** British National Grid metres (EPSG:27700) inside the pages; WGS84 only where 03 writes the tensor-studio file.
- **The pages are built files.** Their source and builders live in the author's folders, not here. To change behaviour, edit the JS in the page itself: search for the function names given below. Keep the change small, and test it as described at the end.

