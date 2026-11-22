> **2026-11-22 · 拆成一步一个孵化器 app · split into one incubator app per step.** 这个文件夹现在是第 2 步「毛线带」：`index.html`（原 02 页）和 `four-cells.html`（原 02b 页，已打开四个单元的演示）。第 1 步在 `incubator/loop-city-mould-growth/`（原 01 页），第 3 步在 `incubator/loop-city-tensor-base/`（原 03 页）。页面内容不变，只改了「打开下一步」的那一行路径；下面的说明里的旧文件名对应如上。

> **范例 · The example (22 Nov 2026).** 单独打开时载入内置范例：车站 P2 一带的四个单元（`sample-cells.js`，原演示页 02b 里的那一份；`four-cells.html` 现在只是跳转）。由第 1 步打开或用「打开单元包…」时用交来的单元。`?sample` 强制范例，`#nosample` 不载入。 Opened on its own, the page loads its example: four cells round station P2 (`sample-cells.js`, the package that was inline in the 02b demo page; `four-cells.html` now only forwards). Opened by step 1, or with a cell package, it uses those cells.

> This folder is now step 2, the wool bands: `index.html` (page 02) and `four-cells.html` (page 02b). Step 1 is `incubator/loop-city-mould-growth/` (page 01) and step 3 is `incubator/loop-city-tensor-base/` (page 03). The pages are unchanged except for the one line that opens the next step. The file names below are the older ones.

# Loop City: from the whole loop to the parcel

Three pages that work as one chain. Each is a single self-contained HTML file: open it by double-click, no server, no install. English and Chinese (EN | 中文, top left of the map; the choice carries from page to page).

| Page | What it does |
|---|---|
| `01 Loop City - whole loop, mould and growth.html` | The slime mould and the city growth run together over the whole loop, reading the existing motorways and A roads. When the century ends, the cells are read from the mould's highways and cleaned by a rule. Pick one cell, or shift-click several. |
| `02 Loop City - wool bands.html` | The wool on the picked cells, in 17 steps: cells, soil, anchors, threads (opposite or alternate rule), relaxing, then the network read as bands, joined to the existing roads, tidied, parcels merged, parcels by use, road hierarchy at true widths, and the parcels to take on. |
| `03 Loop City - base for the tensor field.html` | The picked parcels on their base map, and the site file the tensor app reads. |
| `02b Loop City - wool bands, four cells already open.html` | Page 02 with four test cells (stations S1, A3, P2) already loaded, to try the wool without running the century first. |

## How to use it

1. Open page 01 and press Run. Allow pop-ups for the page when the browser asks: the other pages open from it.
2. Click a cell, shift-click neighbours to add them, then double-click or press "Open in the wool".
3. In page 02 go through the steps. Step 10: Run relaxes the wool. Steps 11 to 16 build the road network and the parcels.
4. Step 17: click an urban parcel, shift-click for more, double-click to open them in page 03.
5. In page 03, save the site for the tensor field.

Keep the files in one folder: each opens the next by its file name.

## Rules built in

- Several cells stay several cells: each keeps its own edge as a 90 m boundary highway.
- Every existing road is one road with one class from end to end; a whole existing road is raised before a new one is made.
- Road hierarchy by spacing: boundary highway 90 m, primary road 60 m, A road 48 m, B road 24 to 30 m.
- Parcel use comes from the growth result handed over by page 01: urban where over half is built, farming where over half is farming, a park under 25 ha, kept open inside a protected landscape.
- Only urban parcels go to the tensor field. A park can be taken with them and stays a park.

## Notes for Hao

- **What this is next to `incubator/loop-city-live`:** the same three-page chain, with a new page 01 (it reads the existing roads; one cell system, cleaned by a rule, join by hand with undo) and a new method in page 02 (the wool read as bands, a road hierarchy by spacing, parcel use from the growth). The file names are new, and the pages open each other by these names.
- **For the tensor app:** page 03 writes the same site file as before (`tensor-site-input`, ring and features in WGS84, the same in British National Grid beside them). Two things are new:
  - `features.parks` and `bng.parks` list the parks taken with the parcels. They are outside the site ring unless urban parcels surround them. **The tensor app does not read this field yet; it should treat it as keep-out.**
  - The existing roads are already among `roads`, each with its class (the package says `existing_in_roads: true`), so page 03 no longer adds them a second time.
- **Road classes in the package** keep the letters the older page used: M = boundary highway 90 m, A = primary road 60 m, B = A road 48 m, C = B road 24 to 30 m. `width` is the true width in metres.
- **The rules in full** are in `docs/HANDOVER - parcels for the tensor field (rules).md`. The package the wool sends is `loop-city-parcel-package`, version 2; the cell package from page 01 is `loop-city-cell-package`, with a new field `growth` (the class grid of the growth result for the window).
- **Source:** the band method is the four script files in `source/`, with a note on how the page is put together.
- **Checked:** one headless run of the whole chain on these exact files (century, cells, a two-cell pick through all 17 steps, parcels read by page 03). The chain was also opened page to page in a browser by hand.
- **Not done, known:** the Chinese of the new labels is unreviewed; text drawn on the maps is English; page 02b shows one open road end in its four cells; the lane and junction detail of the older wool page (zoomed in) is not in the new steps; the site limits are unchanged (up to 3.6 km across, at least 2 ha).

## Data

Roads, towns and buildings: OS Open Zoomstack (OGL v3). Soil: Agricultural Land Classification (Natural England). Protected landscapes: Natural England. Rail: the Loop City railway.
