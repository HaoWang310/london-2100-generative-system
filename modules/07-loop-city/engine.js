// 07 · Loop City step 1 — the engine, which is the incubator page itself.
//
// This module does not keep a copy of the model. It opens the incubator app
// incubator/loop-city-mould-growth/ in a frame that is not shown, with ?embed=1,
// and talks to it through window.LoopCityEngine, the contract that page offers
// (its roads_v6_engine block): run(), onYear(), show(year), the mould's and the
// growth's canvases with their British National Grid frame, and after a run the
// highways and the cells as GeoJSON in grid metres. So a change made to the
// incubator page reaches the workspace too, as with 01.
//
// The frame is on the same origin, so it runs on the page's own thread: while a
// century is running the map answers more slowly (the page works in slices of
// 120 ms). Each year the two canvases are copied here, and the copies are what
// the map draws.

export const SOURCE_PATH = 'incubator/loop-city-mould-growth/';
export const YEAR0 = 2025;
export const YEARS = 75;

/** What this module reads from window.LoopCityEngine. tests/ checks the page still offers each of them. */
export const CONTRACT = ['ready', 'busy', 'year', 'mould', 'growth', 'run', 'reset', 'onYear', 'show', 'set', 'get', 'sliders',
  'extracted', 'highways', 'cells', 'stations', 'radials', 'proposed'];

/** Absolute URL of the incubator app. Frozen releases (/releases/<id>/) carry no incubator/, so they read the live one at the site root. */
export function sourceBase(from = import.meta.url) {
  const u = new URL(`../../${SOURCE_PATH}`, from);
  u.pathname = u.pathname.replace(/\/releases\/[^/]+\//, '/');
  return u.href;
}

const clampYear = y => Math.max(0, Math.min(YEARS, Math.round(y) || 0));

/**
 * state: { loaded, loading, running, ran, year (0..75), error, frame {e0,e1,n0,n1}, mould, growth (canvases),
 *          version (raised when the canvases change), vectors {highways, cells} in BNG or null, vectorVersion,
 *          base {stations, rails} in BNG, stats, sliders, ms }
 * onChange(what): 'loading' | 'loaded' | 'running' | 'year' | 'ran' | 'params' | 'error'
 */
export function createEngine({ onChange = () => {}, timeoutMs = 180000 } = {}) {
  const state = { loaded: false, loading: false, running: false, ran: false, year: 0, error: null, frame: null,
    mould: null, growth: null, version: 0, vectors: null, vectorVersion: 0, base: null, stats: {}, sliders: [], ms: 0 };
  let frame = null, L = null, pending = null, off = null, watch = 0, t0 = 0, idle = 0;

  const doc = () => frame?.contentDocument || null;
  const text = id => doc()?.getElementById(id)?.textContent || '';
  const num = id => { const v = parseFloat(text(id).replace(/,/g, '')); return Number.isFinite(v) ? v : 0; };

  function copy(src, key) {
    if (!src || !src.width) return;
    const dst = state[key] || (state[key] = document.createElement('canvas'));
    if (dst.width !== src.width || dst.height !== src.height) { dst.width = src.width; dst.height = src.height; }
    const c = dst.getContext('2d');
    c.clearRect(0, 0, dst.width, dst.height);
    c.drawImage(src, 0, 0);
  }
  function snapshot() {
    try { copy(L.mould.canvas, 'mould'); copy(L.growth.canvas, 'growth'); } catch (e) { console.warn('Loop City engine: could not copy the canvases:', e.message || e); }
    state.version++;
  }
  function readStats() {
    const v = state.vectors, hw = v ? v.highways.features : [];
    const km = cls => Math.round(hw.filter(f => f.properties.class === cls).reduce((s, f) => s + (f.properties.km || 0), 0));
    state.stats = { roadKm: num('cRoad1'), builtKm2: num('cBuilt'), farmKm2: num('cFarm'),
      cells: v ? v.cells.features.length : 0, highwayKm: km('highway'), linkKm: km('link'),
      stationsInCell: v ? v.cells.features.reduce((s, f) => s + (f.properties.stations ? String(f.properties.stations).split(' ').filter(Boolean).length : 0), 0) : 0 };
  }
  function readVectors() {
    state.vectors = L.extracted ? { highways: L.highways(), cells: L.cells() } : null;
    state.vectorVersion++;
  }
  function readSliders() {
    const out = [];
    for (const [key, id] of Object.entries(L.sliders || {})) {
      const e = doc()?.getElementById(id); if (!e) continue;
      const box = e.type === 'checkbox';
      out.push({ key, id, type: box ? 'bool' : 'range', min: box ? 0 : parseFloat(e.min), max: box ? 1 : parseFloat(e.max), step: box ? 1 : parseFloat(e.step) || 1,
        value: box ? e.checked : parseFloat(e.value), default: box ? e.defaultChecked : parseFloat(e.value) });
    }
    state.sliders = out;
  }

  function onYear(Y, done) {
    state.year = clampYear(Y - YEAR0);
    if (done) { state.running = false; state.ran = true; state.ms = Math.round(performance.now() - t0); readVectors(); }
    snapshot(); readStats();
    if (done) onChange('ran');
    onChange('year');
  }

  // A run that fails gives its button back without ever saying "done": notice that, and say so.
  function watchdog() {
    if (!state.running || !L) { idle = 0; return; }
    if (L.busy) { idle = 0; return; }
    if (++idle < 3) return;
    idle = 0; state.running = false;
    state.error = text('yearNote') || 'The run stopped.';
    onChange('error');
  }

  function load() {
    if (state.loaded) return Promise.resolve(state);
    if (pending) return pending;
    state.loading = true; state.error = null; onChange('loading');
    pending = new Promise((resolve, reject) => {
      frame = document.createElement('iframe');
      frame.title = 'Loop City step 1 engine'; frame.setAttribute('aria-hidden', 'true'); frame.tabIndex = -1;
      // Not display:none: a frame that is not laid out gets no animation frames and no canvas size. Off the screen instead.
      frame.style.cssText = 'position:fixed;left:-20000px;top:0;width:1280px;height:800px;border:0;opacity:0;pointer-events:none';
      const v = new URL(import.meta.url).search;
      frame.src = `${sourceBase()}index.html?embed=1${v ? `&${v.slice(1)}` : ''}`;
      const started = performance.now();
      const fail = msg => { state.loading = false; state.error = msg; pending = null; frame?.remove(); frame = null; L = null; onChange('error'); reject(new Error(msg)); };
      const poll = () => {
        if (!frame) return;
        let eng = null;
        try { eng = frame.contentWindow?.LoopCityEngine || null; } catch (e) { fail(`The engine page could not be read: ${e.message || e}`); return; }
        if (eng && eng.ready) {
          L = eng;
          const missing = CONTRACT.filter(k => !(k in L));
          if (missing.length) { fail(`The engine page no longer offers: ${missing.join(', ')}`); return; }
          const ex = L.mould.extentBNG;
          state.frame = { e0: ex.e0, e1: ex.e1, n0: ex.n0, n1: ex.n1 };
          const rails = { type: 'FeatureCollection', features: [...L.proposed().features.filter(f => f.properties.kind !== 'radial'), ...L.radials().features] };
          state.base = { stations: L.stations(), rails };
          off = L.onYear(onYear);
          readSliders(); snapshot(); readStats();
          watch = setInterval(watchdog, 1000);
          state.loaded = true; state.loading = false;
          onChange('loaded'); resolve(state);
          return;
        }
        if (performance.now() - started > timeoutMs) { fail('The engine page did not become ready in time.'); return; }
        setTimeout(poll, 250);
      };
      frame.addEventListener('error', () => fail('The engine page could not be loaded.'));
      document.body.append(frame);
      setTimeout(poll, 250);
    });
    return pending;
  }

  return {
    state,
    load,
    /** Grow the century with the settings as they stand. False if it cannot start now. */
    run() {
      if (!L || state.running || L.busy) return false;
      state.error = null; t0 = performance.now();
      if (!L.run()) return false;
      state.running = true; state.ran = false; state.vectors = null; state.vectorVersion++; idle = 0;
      readStats(); onChange('running');
      return true;
    },
    /** After a run: put a year back on the canvases (0..75). Nothing happens while a century is running. */
    setYear(y) {
      y = clampYear(y);
      if (!L || state.running || L.busy) return false;
      if (y === state.year && state.version > 1) return true;
      try { if (!L.show(YEAR0 + y)) return false; } catch (e) { console.warn('Loop City engine: show failed:', e.message || e); return false; }
      if (state.year !== y) { state.year = y; onChange('year'); }      // a page that did not call back still moves the year
      return true;
    },
    /** One of the engine's own sliders (see state.sliders): the value goes onto the page's control. A new run uses it. */
    setParam(key, value) {
      const s = state.sliders.find(x => x.key === key);
      if (!L || !s || state.running) return false;
      if (!L.set(s.id, s.type === 'bool' ? Boolean(value) : value)) return false;
      const got = L.get(s.id);
      s.value = s.type === 'bool' ? Boolean(got) : got;
      onChange('params');
      return true;
    },
    resetParams() { for (const s of state.sliders) if (s.value !== s.default) this.setParam(s.key, s.default); },
    destroy() { clearInterval(watch); try { off?.(); } catch { /* the frame may be gone */ } frame?.remove(); frame = null; L = null; pending = null; state.loaded = false; }
  };
}
