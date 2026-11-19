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

## Page 01 · `01_Loop City - Mould and cells.html`: the slime mould, the city and the cells

### What it is

- **One self-contained page, about 18 MB.** All the data is inlined: the basemap, the grids, the stations, the rail and the growth model. It opens by double-click (`file://`) or from any static server, and needs no build step and no network.
- **It runs two models on one clock over the whole loop, 2025 → 2100:**
  - **the city growth model** (`GrowthSim`, with its own defaults);
  - **a slime mould** (Physarum-style agents) released at the 17 stations.
- **After the century,** it reads the mould's trail as highways and the cells they close.
- **The user picks one or several cells,** and page 02 (the wool) opens on them.

### The panels

- **Left: these change the result.**
  - **Run:** Run the century, Reset, Extract cells, and the "when the century ends" switch.
  - **Growth behaviour:** network coarseness, deposit, evaporation, diffusion.
  - **The stations:** clearance per station type, push strength, and the P4 pool and ring.
  - **The corridor:** free width, fade, edge shape, confine.
  - **Export:** this group exports the *older* parcels, not the wool's cells.
- **Right: after the century, and the look.**
  - **The network:** **Park the roads (on, 2065)** and **Prune spurs** change the run too, although they sit on the right. **Vein edge (0.22)** is the only right-panel slider the wool's cells read.
  - **The older method:** Make the parcels, The cells, Edit cells by hand and Advanced · parcels belong to the older "parcels from the trail" method. They do **not** touch the cells sent to page 02.
  - **The view:** Layers (on/off and opacity), **Mould look** (six looks, view only), the key plan, and **A cell to the wool** (the hand-off).
- **About 40 settings are hidden but still in force.** They sit in a hidden holder (`#v5Hidden`) and are still read, for example agents per station 6000, mould steps a year 12, and the farm network from 2040. The growth model's 22 settings are hidden on purpose and stay at its defaults.
- **The year bar and ▶ replay the city, its roads and the mould year by year,** after a run.
- **The "steps per frame" slider (1–8, `iSpf`) is for the loose ▶ mould mode only.** It does not speed up the century.

### One year of the model (`simYear()`)

1. **`stampRoadsToGrowth()`:** last year's roads become ground the growth may not take.
2. **The growth step:** `S.gdrv.step()`. `startGrowth()` first runs the growth model's pass 1, 76 years without drawing, which takes about 2–3 s.
3. **The city onto the mould's grid:** `pushFabric(Y)`, `hardenCity()`, `cityFields()`.
4. **The mould, unless the roads are parked:** `simStep()` × 12, then `roadFromTrail(1)`.
5. **The farm network, unless parked:** a second, coarser mould for the farmland (`runFarmLayer()`, from 2040).

**How the run is driven:** `runCentury()` runs years in 120 ms slices on `setTimeout`, so it keeps going in a background tab, and draws between slices. On a laptop a run takes about 45–60 s. The time is all calculation; the stopwatch line under the year note says where it went.

**Parking (`iParkOn`, `iParkYear` = 2065):** after the park year the mould stops stepping. Its trail and roads are held, and the city keeps growing inside them to 2100. **The cells come from the 2065 trail.**

### The cells (`HW`, `Highways.run`)

**When:** after the century, if "when the century ends" is on, the page calls `HW.extract()`, which runs:

`Highways.run(S.trail, SW, SH, { thr: Vein edge, … })`

**What it finds:**
- **highways:** the widest routes of 6 km or more, until they make up 35 % of the core;
- **links:** the rest of the closed network;
- **spurs:** veins that end;
- **cells:** the faces the network closes.

**The fixed rules** (not on any slider):
- spurs under 3 km are dropped;
- knots under 350 m are tidied;
- faces under 6 km² are merged into a neighbour;
- smoothing is 300 m;
- faces over 1000 km² are not cells.

**P4 across the Thames:** P4's cell is closed across the river by a ring (`P4RING`). The ring is never drawn (`P4QUIET`).

### Picking cells

| Action | What happens |
|---|---|
| **Click** a cell | Selects it. After 450 ms the view zooms to its 32 × 24 km tile. |
| **Shift-click** a cell | Adds it to or removes it from the group, without zooming (`MULTI.MAX` = 10). |
| **Double-click** a cell in the group | Opens the whole group in page 02. |
| **Double-click** any other cell | Opens that cell alone. |
| **Open in the wool** button | Opens the current selection in page 02. |
| **Save the cell(s) (file)** button | Downloads the same package as JSON. |

**Rules for a group:**
- **Neighbours only:** a cell must share an edge with the group to join it.
- **The group stays in one piece:** a removal that would split it is refused.
- **Its window** is the union's bounding box plus 3 km. It is at least 32 × 24 km, always 4 : 3, and its width is rounded up to whole km.

### The hand-off to page 02 (`LIVE`, `MULTI`)

**The handshake:**
1. **Page 01 opens the wool page in its own window:** `window.open("02_Loop City - Wool.html", "loopCityWool")`. The wool page must sit beside page 01 in the same folder, under that exact name.
2. **When ready, page 02 says so:** it posts `{ type: "wool-ready" }` to `window.opener`.
3. **Page 01 answers with the package:** it sends `{ type: "loop-city-cell-package", pkg }` to `e.source` with `postMessage(…, "*")`.

**Messages are matched by `type`, not by origin.** Opened from `file://`, the origin is `"null"`.

**If the wool window doesn't appear:**
- **No answer in 8 s:** page 01 says so, and Save the cell(s) still works as a file.
- **The browser blocked the window:** page 01 asks for pop-ups to be allowed.

**What's not used:** there is no URL hash in this hand-off. The old `LoopCity` shell link (`#lc=<json>`, `LoopCity.hashCtx()`) is still in the page but not used here.

### The package (`format: "loop-city-cell-package"`)

**Units:**
- All coordinates are British National Grid (`crs: "EPSG:27700"`), in metres, rounded to 0.1 m.
- Rings are closed: the first point is repeated at the end.

**Watch the box orders:**
- `tile` and `bbox` are **[E0, E1, N0, N1]**.
- `pictures.tile_box` and `pictures.key_box` are **[E0, N0, E1, N1]**.

**Version 1, one cell:**

| Field | What it holds |
|---|---|
| `format`, `version` (1), `made`, `app` (the page title), `crs`, `units` | What the file is |
| `cell` | `id`, `station`, `stations`, `station_kind` ("primary"/"secondary"/null), `station_E`, `station_N`, `use` (urban / agricultural / open), `area_km2`, `built_km2`, `farm_km2`, `boundary`, `holes`, `bbox` |
| `tile` | The window. One cell: 32 × 24 km round it. |
| `tile_km` | `[w, h]` |
| `highways`, `links`, `spurs` | Lists of `{ route, route_km, vein_m, km, coords }`, clipped to the tile |
| `neighbours` | Whole cells touching the tile: `{ id, station, use, area_km2, boundary }` |
| `rail` | `{ radials, high_speed, orbital }`: polylines clipped to the tile |
| `stations_in_tile` | `[{ id, kind, E, N }]` |
| `run` | `{ year, extracted, vein_edge, method, stats, settings }` |
| `pictures` | See below; on failure, `{ error }` |
| `notes` | Plain text |

**`pictures`:**

| Field | What it is |
|---|---|
| `trail` | A JPEG data URL of the mould over `tile_box`, on black, `width` px wide (1600 per 32 km, at most 3200). It is drawn in the look that is on. |
| `veins` | A PNG data URL of the vein mass, grey on transparent |
| `key` | A JPEG of about 520 px: the whole loop, with the chosen cells in sand |
| `key_box`, `tile_box`, `width`, `note` | The boxes and width of the pictures above |

**Version 2, several cells: the same fields, plus:**
- `cells`: every chosen cell, with the same fields as `cell`;
- `cell = cells[0]`;
- `outline: { boundary, holes, area_km2 }`, the union of the chosen cells;
- `tile` / `tile_km`: the group's window;
- `neighbours`, without the chosen cells.

Roads, rail, stations and pictures cover the group's window.

**Not in the package:** the existing (OS) roads.

### The main objects to look for in the page

**How the page is built:**
- It is one large classic `<script>` with a top-level `"use strict"`. Its top-level functions are properties of `window`.
- The add-ons sit in `<script data-module="…">` blocks at the end of `<body>`, and wrap those functions, for example `window.simStep = function () { … }`.

| Object | What it is |
|---|---|
| `S` | The state: `trail` (Float32Array, `SW × SH`), `year`, `showY`, `view`, `parkedAt`, … |
| `CFG.map` | `extentBNG {e0, e1, n0, n1}`, `nodes` (stations), `size` |
| `GrowthSim` | The growth model: `run`, `PARAMS`, `classAt` |
| `HW` | The highways and cells: `cells`, `res`, `sel`, `extract`, `select`, `zoomTo`, `tileOf`, `cellAt`, `packageFor`, `toBNG`, `toMap` |
| `Highways.run` | The extraction |
| `LIVE` | The one-cell hand-off and the double-click |
| `MULTI` | Several cells: `sel`, `toggle`, `windowOf`, `outline`, `packageFor`, `MAX` |
| `PICS` | The package pictures |
| `LOOKS` | The six mould looks, view only |
| `STOPWATCH` | Where the century's time goes |
| `REPLAY` | One trail copy per year, for ▶ |
| `P4RING`, `P4QUIET` | The ring that closes P4's cell, and keeping it undrawn |
| `V5` | The panel layout, layer opacity (`V5.op`), and a cell's use (`V5.kind`) |
| `Tiles` | Comparison runs, from the console |

**The functions:** `runCentury`, `simYear`, `simStep`, `roadFromTrail`, `cityFields`, `startGrowth`, `paintTrail`, `draw`, `showYear`, `resetSim`, `clearRunState`.

### Limits and traps

- **Every run is different.** The mould's agents are released at random, so each run gives a slightly different network. **Cell ids are only valid within one run**, and a new run clears the cells and the selection.
- **Only Vein edge on the right changes the wool's cells.** The older-method groups and the Export group look as if they shape the cells, and they don't.
- **Park the roads changes the result.** It is on at 2065.
- **The package's trail picture carries the mould look that is on.** The numbers are the same under every look.
- **Pop-ups must be allowed,** and pages 01 and 02 must sit in the same folder under their exact names.
- **The page is about 18 MB, with very long base64 lines.** Search it with a pattern that cannot match base64, or the output floods. There is no build tool: edit it as text.
- **The replay keeps about 1 MB a year** while the mould runs: about 40 MB with parking on, about 75 MB with it off.

## Page 02: the wool, the roads, the stops and the zoom-in

**Arrival.** A cell package comes from 01, from the file button, or (in tests) from `window.__PKG_INLINE__`, set before the page's own script. The page then bakes `DATA` in the browser, each cell in its own boundary on its own 10 m grid:
- the cut and ease of the ground;
- soil zones;
- road and turn anchors;
- labels and pictures.

It then runs the steps. Edges two cells share (rings within 30 m) are found and drawn once.

**The steps** (left panel; `S.step`):
1. The slime mould
2. Veins, centrelines
3. The cells
4. Existing roads
5. Primary cells
6. Soil grades
7. Soil cells
8. Anchors
9. Base net
10. Relax (the wool settles)
11. Road hierarchy, in 7 stages: streets, continuous roads, M, A, B and C, gaps closed, result
12. Roads, filleted
13. The roads
14. Parcels
15. Capsule stops
16. Extract parcels (to page 03)

**The road graph.** `S.roads` holds one record per cell. `r.T = {nodes, edges}`:
- **nodes:** `{x, y, edges, onRing, atEdge}`;
- **edges:** `{a, b, p, len, cls, rim, gone, why}`. `p` is a flat array `[x0, y0, x1, y1, …]` in metres. `cls` is `'M' | 'A' | 'B' | 'C'`, ranked by `RANK = {C:0, B:1, A:2, M:3}`. An edge is removed by setting `gone = true`; nothing is spliced out.
- **The cell's boundary** is `r.gd.ring`.
- **Helpers:**
  - `headingAt(edge, node)`: degrees, leaving the node;
  - `bendOf(h1, h2)`: the angle between two headings, so 180 means straight on;
  - `G.nearest(ring, x, y, true).d`: the distance to a ring.

**The order after step 11** (each is a named function; read its comment):
1. `closeCell`
2. `acrossCells`
3. `trimOpen`
4. `joinShort`
5. `noBranchM`
6. `noNeck`
7. `noVee`
8. `noSliver`
9. the roundabouts
10. Chaikin smoothing
11. the parcels

**The rules they keep** (all set by the user; don't relax them):
- **M:** M roads are the slime mould loop highways only. An M road never branches and never dead-ends, and a road that leaves the loop is an A road (`noBranchM`).
- **No open ends:** every road joins something (`joinShort`). An A or B road that turns back in a V or hairpin within 400 m of the loop runs straight on to meet it (`noVee`).
- **No necks:** a lower-class piece of 150 m or less, between a higher road and the junction or existing road it leads to, takes the higher class (`noNeck`).
- **No slivers:** three short roads (90 m or less) forming a sliver triangle collapse to one junction (`noSliver`).
- **Existing roads:** a new road meeting an existing road stops at its kerb, as a proper T.

**Step 15, the capsule stops** (`TRANSIT`). Stops are placed on A and B roads by walking distance, from the London benchmark:
- the cell's station hub first;
- then change points where transit roads cross;
- then coverage of built land within 400 m (farmland within 800 m);
- then fill on long stretches.

Every stop stands at least 100 m clear of a junction's edge (`SET_BACK: 125, CLEAR: 125`). Stops that can't clear a junction move up to 300 m, or are dropped.

**Step 16, extract parcels:**
- click a parcel to take it; shift-click to add or drop one;
- double-click (or the button) to open page 03 with the parcels;
- or save them as GeoJSON or R12 DXF in BNG metres, with the roads along each parcel (class, width) and the stops.

### The zoom-in (`DET`, the `det*` functions)

Below 2.5 m/px (`DET.MID`) every road is drawn at its real width, and below 1.0 m/px (`DET.CLOSE`) its markings are drawn too:
- **`detPrep()`** builds the road chains (smoothed) and the junctions (`juncs`: `{x, y, n, arms: [{c, u0, dir, cls}], jr, rbt, M}`) once per run, kept in `S.det`.
- **`detRoads()`** paints the layers to a raster and closes each one with its own corner radius. That closing is what makes the fillets. It then draws the capsule, the loop road (`detLoop`), the markings (`detMarks`) and the stops (`detStops`).
- **The loop road (M, 90 m)** is drawn from the cells' rings, not from the wool (`detRingNet`). From the centre outwards:
  - the fast line (a vacuum tube, both ways);
  - green;
  - three car lanes each side (two express lanes that never stop, one local lane with signals);
  - the Superloop bus lane (on loop roads only);
  - green;
  - the cycle track;
  - the footway;
  - a productive green edge.
- **Junctions on the loop:**
  - where loops meet: a roundabout, with the fast line's junction beneath it;
  - an A, B or C road from one side: left in, left out;
  - an A road from both sides (between two different cells): it passes under the loop, with slip roads into the A road's outer lane;
  - existing roads pass under, with no junction.
- **Other sections:** A 50 m, B 30 m, C 16 m. Each has footways and cycle tracks (A and B), trees, a median and the capsule in the middle (A and B).
- **Junction rules:**
  - corners filleted;
  - the cycle track carried round each corner;
  - one zebra and one cycle crossing across each arm, square to it and set back where the arm leaves the junction;
  - no crossings on a short link (under 55 m) between two junctions, and none where only streets meet;
  - signals where an A or B road meets two others;
  - roundabouts with splitter islands.
- **The capsule:**
  - it sweeps round a turn on a curve;
  - it never dead-ends: where its road stops, it loops back to its own road through the roads close by (`detCapLoops`, `detExWay`), or ends at a terminal stop (island platforms and a buffer) and runs back;
  - at an A crossing it runs on under the loop.
- **Stops:** island platforms and a zebra, with no table and no signals, drawn with a faint fill and a dashed outline.
- **Existing roads (`detExisting`):**
  - drawn at their real width;
  - a free end with nothing meeting it is cut back to the last road meeting it, 250 m or less (`detExTrim`);
  - a new road's corners onto them are concentric fillets, sized by the corner's angle (`detExFillet`).
- **Colours:** `DET.COL`, the Tuscan palette, one colour per thing everywhere. A crossing is shown faint and dashed, in its path's own colour.

### Saving

- **Save PNG:** tick **with legend** to get the key as a panel beside the picture (`pngWithLegend`).
- **Save GeoJSON:** the roads and parcels.
- **The scale bar** shrinks with the zoom, down to 1 m.

## Page 03: the base for the tensor field

It opens from 02 (step 16) and asks for the parcels with `{type: 'tensor-base-ready'}`. It then:
- draws them on the base map;
- makes the site ring: the union of the parcels, closed by 60 m;
- puts anchor stubs where M, A and B roads meet the ring;
- checks the site against the tensor studio's limits (3.6 km across, parcels of 2 ha);
- saves the **Tensor site** JSON: `{ring, features: {roads, rails, waters, waterways, buildings}}` in WGS84, with a `bng` block. That is Hao's tensor-studio site input; it is also posted as `tensor-site-input`.
- It also saves GeoJSON, DXF and PNG.

## Testing (for any change to 02 or 03)

Run headless Chrome on a copy of the page, with a package inlined as `window.__PKG_INLINE__ = {…}` before the first `<script>`:

```
chrome --headless --disable-gpu --window-size=1600,1000 --virtual-time-budget=300000 --dump-dom "file:///…/copy.html#step=15&run&sync&test"
```

Then read the results from the `data-*` attributes on `<body>`:
- `data-err`: empty when there were no errors;
- `data-live`: the cell and its counts;
- `data-transit`: the stops and their coverage;
- `data-noneck`, `data-vee`, `data-sliver`: how many each rule mended;
- `data-caploops`: the capsule's loops and terminal stops;
- `data-loop`: the loop junctions.

**More hash hooks:**
- `#shots=kind_x_y_mpp|…`: pictures of places, written to a `<textarea id="shout">`;
- `#zooms`, `#steps`, `#junctypes`, `#loopjct`: sample pictures;
- "before" switches: `#noneckoff`, `#noveeoff`, `#exendoff`, `#nosliveroff`.

Without `--window-size=1600,1000` the pictures come out 132 px wide.

## Known limits

- Tested on one cell and on two cells sharing an edge, headless, and by the user on 10 cells. The whole loop at once has not been tried.
- Each cell bakes on its own, so 10 cells take several times as long as one.
- The parcels are still cut along the wool's edge, not the loop road's kerb.
- B roads don't yet widen at a stop.
- The hairpin rule (`noVee`) hasn't been seen working, because no test cell has a hairpin.
