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
