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
