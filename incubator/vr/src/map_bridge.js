// Finds the MapLibre map running inside the London map page (an iframe of ../google-map-live/),
// without changing that page: the map keeps its own code, UI and state.
//
// How: the page imports MapLibre as an ES module. Importing the same URL again inside the iframe's own
// realm returns that very module, so its Map class is the one the page uses. Map.prototype.fire is wrapped
// for a moment; the next event any map fires hands us the instance (a window resize makes one at once),
// and the wrapper is removed straight away.

/** The MapLibre module the map page itself uses (same realm, same instance). */
export async function mapLib(frame){
  const win = frame.contentWindow, doc = frame.contentDocument;
  if (!win || !doc) throw new Error('the map page is not loaded');
  const url = win.performance.getEntriesByType('resource').map(e => e.name).find(n => /maplibre-gl[^/]*\.mjs/.test(n));
  if (!url) throw new Error('MapLibre has not loaded in the map page yet');
  return new win.Function('u', 'return import(u)')(url);
}

export async function findMap(frame, ms = 4000){
  const win = frame.contentWindow;
  const lib = await mapLib(frame);
  const Map = lib.Map || lib.default?.Map; if (!Map) throw new Error('MapLibre Map class not found');
  const own = Object.prototype.hasOwnProperty.call(Map.prototype, 'fire'), orig = Map.prototype.fire;
  let found = null;
  Map.prototype.fire = function (...a){ const c = this.getContainer?.(); if (c && c.offsetWidth > 0 && !found) found = this; return orig.apply(this, a); };
  try {
    win.dispatchEvent(new win.Event('resize'));
    const t0 = performance.now();
    while (!found && performance.now() - t0 < ms) await new Promise(r => setTimeout(r, 50));
  } finally { if (own) Map.prototype.fire = orig; else delete Map.prototype.fire; }
  if (!found) throw new Error('no visible map answered (is the OSM map shown?)');
  return found;
}
