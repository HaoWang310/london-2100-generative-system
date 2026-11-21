# How page 02 is built

Page 02 is a copy of the Loop City live wool page (v16) whose text is patched by a small build script; the four files here are placed into it:

| File | What it holds |
|---|---|
| `bands.js` | The network from the wool: threads read as bands on a 28 m grid, joined to the existing roads and the cell edge, tidied, small blocks merged, the result as edges and parcels. `window.Bands.run(input, params)`. |
| `bands_hier.js` | The road hierarchy by spacing: boundary highway, primary road, A road, B road; whole existing roads raised first. |
| `bands_app.js` | Settings, sliders, layers, the drawing at true widths, parcel use from the growth result, the Chinese of the new labels. |
| `bands_pick.js` | Step 17: picking urban parcels (and parks), the parcel package for page 03. |

`bands.js` goes into the page head; the other three are placed inside the app script just before its `draw()` function. Steps 11 to 17 are numbered 21 to 27 inside the page, so nothing of the older steps runs. The older steps 11 to 16 are still in the file but have no button.

The build also adds two things to page 01 (the growth grid in the cell package, the new name of page 02) and a few lines to page 03 (parks, the new road classes).

Three hooks sleep in page 02 unless the address asks for them: `#bdtest` (walks the steps for a headless check), `#bdfilm` (frames for a film), `#bdall` (the whole area drawn in tiles).
