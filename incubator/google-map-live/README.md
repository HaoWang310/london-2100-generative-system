# London Map Live

> **统一的「下一步」· The chain row (26 Nov 2026).** 面板标题下有和其他 app 相同的一行（`shared/ui/chain.js`）。伦敦地图是研究主线的第一站：上一步是目录，下一步是 Loop City 第 1 步，不带数据。框选场地进入张量场工作室的功能不变。嵌在 VR 页面里时这一行不显示。 The same row as in every app. The London map is the first stop of the research line: Next opens Loop City step 1, nothing is carried. Selecting a site for Tensor Studio is unchanged.


Live map: https://haowang310.github.io/google-map-live/

Version 3.45.0: **3D relief** joins the terrain layers. The ground itself rises by its height (the open height tiles, about 30 m) inside the 70 km study circle; outside it stays flat, and the edge is a short slope, not a wall. Every draped layer follows it (height colors, flood risk, boundaries, rail) and the 3D buildings stand on it. Exaggeration ×1 to ×8, ×3 at first: London is low. It shows in the tilted view, so a flat map tilts once when it is switched on. Trees and street vehicles are switched off while it is on, and come back after: they are drawn on flat ground and would be buried. It comes from `incubator/loop-city-real-map`, the last of that app's layers not yet here.

Version 3.44.1: the high-speed lines say where they go. Zoomed out (below zoom 9): "HS2 to Birmingham", "to Manchester · Glasgow (West Coast Main Line)" at the north end, "London", "HS1 to Paris · Brussels (Channel Tunnel)". From zoom 9: the eight stations (London Euston, Old Oak Common, Birmingham Interchange, Birmingham Curzon Street; London St Pancras, Stratford International, Ebbsfleet International, Ashford International), white dots on the line. In English like the basemap's place names; they follow the HS1 and HS2 switches and the colour theme, and are left out in the raster fallback style (no glyphs).

Version 3.44.0: five planning layers join the analysis layers, and every analysis layer now ends on the same 70 km circle.
- New, all off until switched on (from `incubator/loop-city-real-map` v13): **Height colors + hill shading** (open height tiles, about 30 m; top height, two ramps, shading, a key, click for a height), **London Green Belt**, **AONB · National Landscapes**, **Rail by service** (National Rail, Underground, Overground, Elizabeth line, DLR, trams; each line's own colour, one colour in three shades, or National Rail by line speed) and **High-speed rail · HS1, HS2**. The list has five headings: terrain and height, water, planning boundaries, transport, study area. Stations are left out.
- Range: the rail lines and AONB are cut to the study circle (`scripts/build_planning_layers.py`: lines cut where they cross it, polygons clipped; no cut point more than 0.7 m from the true circle); the Green Belt lies wholly inside it; HS1 and HS2 are kept whole on purpose (HS2 to Birmingham). The height colours are painted in a Worker (`scripts/relief_worker.js`) and are transparent outside the circle.
- The EA LiDAR picture is cut to the circle too (it was the whole 143 km square), in its Worker. The red outline of the circle has 720 sides instead of 180 (it was up to 11 m inside the true circle).
- Order on the map: height colours under water and roads; Green Belt and AONB fills under the flood picture; their edges, rail and HS1/HS2 over the drainage network and under the 3D buildings. The basemap's own thin railways stay visible underneath.
- Position checked against the basemap on the live real-map page: rail and HS1 lie on the OpenStreetMap railways (median 0.5–0.9 m, at most 5 m); AONB edges match OpenStreetMap's (median 2–11 m, locally 50–150 m where the two sources draw the edge differently); HS2 has nothing in the basemap to compare with.
- Checked here with a stand-in for the map library (the page starts, the switches work, the layer order) and with the two Workers on test tiles; **not yet seen on the live map**.

Version 3.43.7: one interface with the other apps. The panels use black, white and white at lower opacity only, and DM Sans, read from `shared/ui/tokens.css` of the main site (`styles/skin.css`, made from `styles/app.css` by `tools/ui/mono_skin.py`, and `shared/ui/studio.css` for the display panel). The pressed tile, the chosen language and the main buttons are solid white. The map, its colour themes, the layer keys and the legends keep their colours; errors show in red. No script changed apart from the version number. `#noskin` in the address shows the interface as it was.

Version 3.43.6: the first time on a device (no language chosen yet) the page follows the device's system language — any Chinese → 中文, every other → English; a choice made with the switch (or passed by the main app) still wins.

Version 3.43.5: the timing box (`perf=1`, the five taps on the version line, the main site's switch) is gone again; the faster shadows of 3.43.0 stay.

Version 3.43.4: the timing box can be switched on without the address bar (a home-screen app on iPad has none): in the main site's version menu, or by tapping this map's version line five times. It stays on for that device until switched off.

Version 3.43.3: `perf=1` is found anywhere in the address, also after the # (for example `…/#workspace?perf=1` on the main site).

Version 3.43.2: with `?perf=1` the timing box appears as soon as the page code runs (map library loaded, map style, first full picture, first settle), before the map has finished loading; the shadow lines join it later.

Version 3.43.1: the `?perf=1` box shows from the start (also when shadows are off or the sun is too low), and `?perf=1` on the main site works for the map opened from the catalogue too.

Version 3.43.0: the 3D city fills in faster on slower devices (iPad), with the same shadows. The building shadows used to read every loaded building again for every tile that arrived and every time the map stopped moving, out to the horizon, on the page's main thread — while the buildings were still loading. Now the building list is read once the map has settled (at most every 2.5 s during a long load), a new sun position reuses it, and only buildings near the view centre cast shadows (at least 1800 m, wider when zoomed out; `?shadowR=`); far shadows are too small to see. In a simulated load of 30 tiles the building list is read 3 times instead of 12, and about a quarter of the shadow triangles are drawn.

Version 3.42.1: on a phone, the first time a site boundary is drawn, the status line says how (drag the panel down, tap the corners, open it again for ① Preview site) and that drawing is easier on an iPad or a computer. Once per device.

Version 3.42.0: on phones (a touch screen whose short side is under 600 px) the control panel is a sheet along the bottom. It starts folded (title only) so the map fills the screen; tap its handle to open it halfway or fold it, drag the handle to any height (it settles folded, half or nearly full); the − / + button folds and opens it too. The Display button and panel sit at the top right there. Computers and iPads: the floating panel as before.

Version 3.41.0: fingers on iPad and iPhone (touch screens only; a computer with a mouse sees and does exactly what it did).
- Site boundary: drag an anchor with a finger; hold one still for a moment to remove it; hold an edge to add an anchor there. The step hints name the buttons (① Preview site, ② Confirm final boundary, Enter site) instead of Enter and double-click.
- Layer notes: a small ⓘ beside each layer name shows its note (there is no hover on a touch screen).
- Display panel: a "Display" button shows or hides it; hidden at first on phones and on an iPad held upright.

Version 3.40.1: lighter on phones (touch screen, short side under 600 px — iPhones). There the map draws at most 2 device pixels per CSS pixel (iPhones are 3) and building shadows start off (the switch turns them on), because iOS reloads a tab that takes too much graphics memory. Computers and iPads: unchanged.

Version 3.40.0: the 3D city fills in faster at a low, far-reaching camera.
- The building layer now reads the same dated OpenFreeMap tile address as the basemap (it used `planet/latest/…`), so each shared tile downloads once.
- Near buildings stay on the detailed z14 tiles; the far part of the view uses z13 tiles (generalised buildings, a quarter as many tiles). The number of tile levels follows the camera zoom so the far edge never drops below z13 (the old blank far band).
- For comparison: `?lod=old` loads the buildings as before; `?lod=12.6` (a number, 12.2–14) sets the lowest far tile zoom aimed for (default 12.8; higher = more detail far away, slower).

Version 3.39.1 (structure only, no change in features or look): the page is split into files.
- `index.html` — the page's HTML only
- `styles/app.css` — the page's styles (were inline)
- `scripts/app.js` — the page's own code: the map, its layers, the panel, the Google / OSM switch (was the inline module script)
- `scripts/map_core.js` — computation without the page: the hydrology grid's projection and tile coordinates, the 70 km study area, the contour worker, flood selection rings
- the old `v3.html` page is removed (nothing linked to it)

Every statement moved unchanged (checked statement by statement); the page boots the same and looks the same pixel for pixel.

Version 3.39.0: entering a site passes the map's basemap style to Tensor Studio, which picks its light/dark look and particle palette to match.

Version 3.38.0: while Tensor Studio is open its page is transparent outside the site and the map underneath follows its view (centre, zoom, bearing), so the surroundings are the map itself; the camera and the selection layers come back on close.

Version 3.37.0 replaces the old isolated-site hydro lab (rainfall, flood
simulation, sponge, hydro tensor, Wool, parcel generator) with Tensor Studio
(`../tensor-studio/`). Site selection is unchanged: draw the red boundary, press
Enter to preview, Enter again to confirm, then double-click inside or click
"Enter site". That opens Tensor Studio over the map in a same-origin iframe
(`scripts/tensor_studio_site.js`, the copy of
`tensor-studio/integration/google-map-live-hook.js`), handing over the site ring,
the map's own OSM streets, water and buildings, and the OS Terrain 50 elevation.
Existing buildings are obstacles the generated streets route around by default.
Esc or "Back to the London map" returns to the map with the selection kept.

Version 3.14.0 uses OpenStreetMap / OpenFreeMap and an independent layer list:
EA LiDAR terrain, contributing area, EA present-day flood-risk overview,
terrain-derived drainage network, and the 70 km study circle. All five analysis
overlays start **unchecked and off on every page load** and load only when selected,
with separate opacity controls. The network
also has minimum contributing-area controls (0.25, 1, or 5 km²).

The map supports 2D / 3D city buttons, right-drag rotation
and tilt, and touch rotation/pitch. The 3D button zooms into the current centre
to show actual OSM building footprints from the existing OpenFreeMap tiles.
Buildings use `render_height` / `render_min_height`, respect `hide_3d`, and render
above the analytical rasters. Heights include estimates from levels and defaults;
this is not a complete measured city model. Returning to 2D hides the extrusions.
The pitch slider and its explanatory strip have been removed.

Terrain now starts with a 2048 × 2048 official EA WMS overview served as a small
WebP asset, using the exact contributing-area/network EPSG:3857 outer bounds.
At zoom 11 or outside that overview, it progressively loads official EA WMTS
`Lidar_Composite_DTM_1m` tiles in `WebMercatorQuad`: 256 px, XYZ column/row order,
z8–17. There are no repeated full-viewport WMS downloads on every camera move.
Sources remain cached when switched off, and small pans reuse overlapping tiles.
The overview remains visible while details load; a failed WMTS request switches
to tiled official WMS. The source DTM is 1 m; the compressed regional colour
overview is a display preview, not a 1 m numerical DEM.

Contributing area now uses the actual complete 2868 × 2875 reprojected 50 m
source grid, replacing the old 320 × 321 thumbnail. A lossless WebP encodes
16-bit log area, preserving NoData. A worker renders only visible 512 px XYZ
tiles at z8–18, with clamped cubic interpolation and a continuous yellow-to-red
palette. At London z14–15 the display pixels are about 3–1.5 m; this is visual
resampling, and the analysis remains 50 m. Pixel centres, the shared projection
bounds, and the 70 km circle match the other hydrology layers. Cubic values are
clamped to neighbouring source values to avoid artificial overshoot. The
worker caches the last 64 tiles, cancels abandoned views, and keeps processing
off the UI thread. It no longer builds 100 large image textures for the whole
study area. Source checksums, log encoding and display rules are recorded in
[`assets/drainage_area/metadata.json`](assets/drainage_area/metadata.json);
official terrain URLs and checksums are in
[`assets/terrain/metadata.json`](assets/terrain/metadata.json).

To reproduce these two display assets, install `numpy`, `rasterio` and `Pillow`:

```sh
python3 scripts/build_drainage_display.py /path/to/contributing_area.tif
python3 scripts/build_terrain_overview.py
```

The always-visible search bar accepts place names, addresses and postcodes.
Click Search or press Enter to query OSM Nominatim, jump to the first result
and add a location marker; alternative matches can be selected below the bar.
Results are fitted using their real WGS84 coordinates and bounding boxes, while
preserving the current tilt. A search outside an active 70 km restriction removes
that restriction so the requested location can be reached. Queries are explicit,
not autocomplete: the client spaces requests by at least 1.1 s, caches the last
30 queries, cancels outdated requests and shows errors without moving the map.
The browser's HTTP Referer identifies the app to the public search service.

At street zooms the flood layer now uses the official WMS polygons directly,
instead of enlarging the 25 m regional overview. Standard EPSG:3857 XYZ tiles
(512 px, z13–17) match OSM exactly; at London z14 a display pixel is about 3 m,
and at z15 about 1.5 m. The two official categories are compared per map pixel,
without the overview's 25 m max aggregation or invented boundary smoothing.
The palette, source filters and study-circle mask stay consistent. Map pixels
are rendering detail, not new flood-model accuracy.

The regional overview stays visible while fine tiles load, then is fully hidden
so its coarse blocks cannot bleed through transparent detail pixels. If either
official source fails, the overview remains visible with a service-error notice.
Failed requests are retried, queued requests can be cancelled, and the last 64
detail tiles are cached. The new browser loader is `scripts/flood_detail.js`.

The flood overview is reconstructed from **Environment Agency official WMS
data**, rather than stretching the uploaded PNG. It uses the present-day
`rofrs_4band` and `rofsw` flooding-extent layers (water depth > 0 m), sampled
in EPSG:27700 at 12.5 m on the existing study footprint. Each 25 m display cell
retains the highest sampled **available published band** from the two sources.
The bands are very low (<0.1%), low (0.1–<1%), medium (1–<3.3%), and high
(≥3.3%) annual chance in each individual source. This ordinal comparison is
**not a combined annual probability**, flood depth, future climate scenario,
or a new flood model. If either source is missing, the other does not establish
the total flood risk. Blank areas must not be treated as zero risk.

WMS requests respect the official 1:50,000 maximum scale. The official SLD
filters and colours are retained during decoding; outline-only symbols are
removed to prevent grey polygon edges being mistaken for unavailable data.
Antialiasing is disabled and unknown colours or failed requests stop the build.
The display palette follows the uploaded overview's light-blue/yellow/orange/red
sequence. Original and fill-only SLD files are included beside the WebP assets.

The flood layer uses nearest-neighbour reprojection to a 5736 × 5750 Web
Mercator grid with the **exact same outer bounds** as contributing area and
the network. Four 2868 × 2875 lossless WebP tiles stay below common GPU texture
limits. Pixel centres are masked to the same 70 km centre/radius/spherical
distance used by the map's study circle. The 25 m grid is a display aggregation;
it does not increase the official model's accuracy and can miss features below
the sampling grid. Map alignment cannot remove uncertainty in the source data.

Data retrieval dates, exact WMS layers, request bounding boxes, image checksums,
styles, processing rules and projection bounds are recorded in
[`assets/london_flood_risk_metadata.json`](assets/london_flood_risk_metadata.json).
This build fetched official data on 11 October 2026, rather than claiming the
19 September retrieval date printed on the uploaded overview.

To rebuild the flood overview, install `numpy`, `rasterio` and `Pillow`, then run:

```sh
python3 scripts/build_flood_risk.py /path/to/wms-cache
```

Use a new cache to fetch a new dated snapshot. Successfully validated requests
can be reused after a temporary WMS failure; raw requests are not served by the
web app. The served layer remains available at regional zooms where the live
WMS would normally hide its polygons.

The network is extracted from the actual values in the project's analytical
`London_Drainage_70km_contributing_area_km2(2).tif`, rather than a screenshot.
The input has 2801 × 2801 cells in EPSG:27700, with a 50 m cell size and bounds
E460012–600062 / N110348–250398. The network uses the exact EPSG:3857 bounds
and 2868 × 2875 base grid already used by the contributing-area display.
Outside the selected network, the image is fully transparent. Lossless WebP
assets preserve its mask and values' colour classes.

The source analysis remains **50 m**. The contributing-area display's
smooth, smaller pixels do not add analytical detail. This is a terrain-derived
potential drainage network; it is not a surveyed river inventory, underground
drainage inventory, or flood-inundation extent. The thresholds are selectable
analysis/display choices, not calibrated channel-initiation thresholds.

Existing repository metadata attributes the contributing-area raster to EA
LiDAR Composite DTM. The TIFF itself does not provide the original DEM ID,
flow-direction raster, or processing log, so that upstream processing has not
been independently reproduced in this update. The extraction performed here
is reproducible from the exact input file and checksum recorded in
[`assets/london_drainage_network_metadata.json`](assets/london_drainage_network_metadata.json).

To rebuild, install `numpy`, `rasterio` and `Pillow`, then run:

```sh
python3 scripts/build_drainage_network.py /path/to/contributing_area.tif
```

Sources:

- [EA official DTM catalogue](https://www.data.gov.uk/dataset/01b3ee39-da3f-47b6-83da-dc98e73a461f/lidar-composite-dtm-2022-1m)
- [EA Risk of Flooding from Rivers and Sea](https://www.data.gov.uk/dataset/943d2bbb-aa08-45d1-96cb-42556cd01d94/risk-of-flooding-from-rivers-and-sea2)
- [EA Risk of Flooding from Surface Water](https://www.data.gov.uk/dataset/0d6fa1f4-0c82-4c91-8667-a549e8e3ca2d/risk-of-flooding-from-surface-water3)
- [Open Government Licence v3.0](https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/)
- [Esri: Identifying stream networks](https://pro.arcgis.com/en/pro-app/latest/tool-reference/spatial-analyst/identifying-stream-networks.htm)
- [OpenStreetMap attribution](https://www.openstreetmap.org/copyright)
