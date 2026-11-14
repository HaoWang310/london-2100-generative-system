// 01 · Growth simulator — the state on the page's side.
// Loads the incubator's meta, controls and the final's event stream, keeps the
// settings P, runs variations in worker.js, and hands the map one parcel record
// per cell (cells.js) for whichever outcome is shown.

import { sourceBase, evaluateShared, inflate } from './source.js?v=434878e';
import { cellsFromEvents } from './cells.js?v=434878e';

export const YEARS = 75;                       // year index 0..75 = 2025..2100

async function fetchOk(url, as = 'text') {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${url}: ${r.status}`);
  return as === 'text' ? r.text() : r.arrayBuffer();
}

export function createGrowth({ base = sourceBase(), onChange = () => {} } = {}) {
  const s = {
    base, loaded: false, loading: null, error: null,
    D: null, SIZES: null, I18N: null, GVC: null, DEFAULTS: null, N: 0,
    P: null, mode: 'final', year: 0,
    final: null, variation: null,             // {ev:{idx,cls,off}, stats, cells}
    ranWith: null, runId: 0, running: false, progress: 0, status: '',
    compare: null
  };
  let worker = null, nextId = 0;
  const pending = new Map();
  const emit = what => onChange(what, s);

  function call(msg, onProgress) {
    if (!worker) {
      const v = new URL(import.meta.url).search;      // carry the build's ?v= to the worker
      worker = new Worker(new URL(`./worker.js${v}`, import.meta.url));
      worker.onmessage = ({ data }) => {
        const p = pending.get(data.id); if (!p) return;
        if (data.type === 'progress') { p.onProgress?.(data); return; }
        pending.delete(data.id);
        if (data.type === 'error') p.reject(new Error(data.message)); else p.resolve(data);
      };
      worker.onerror = e => { for (const p of pending.values()) p.reject(new Error(e.message || 'worker failed')); pending.clear(); worker = null; };
      call({ type: 'init', base: s.base });
    }
    const id = ++nextId;
    return new Promise((resolve, reject) => { pending.set(id, { resolve, reject, onProgress }); worker.postMessage({ ...msg, id }); });
  }

  async function load() {
    if (s.loaded) return s;
    if (s.loading) return s.loading;
    s.loading = (async () => {
      const [meta, controls] = await Promise.all([fetchOk(s.base + 'data/meta.js'), fetchOk(s.base + 'controls.js')]);
      Object.assign(s, evaluateShared(meta, controls));
      s.N = s.D.meta.NX * s.D.meta.NY;
      const [idx, cls] = await Promise.all([fetchOk(s.base + s.D.final.idx, 'buf').then(inflate), fetchOk(s.base + s.D.final.cls, 'buf').then(inflate)]);
      const ev = { idx: new Uint32Array(idx), cls: new Uint8Array(cls), off: s.D.final.off };
      s.final = { ev, stats: s.D.final.stats, cells: cellsFromEvents(s.N, ev) };
      s.DEFAULTS = await defaults();
      s.P = { ...s.DEFAULTS };
      s.loaded = true; emit('loaded');
      return s;
    })();
    s.loading.catch(e => { s.error = e; s.loading = null; emit('error'); });
    return s.loading;
  }

  // The engine's DEFAULTS come from engine.js itself (read in a private scope, no grids needed).
  async function defaults() {
    const text = await fetchOk(s.base + 'engine.js');
    // eslint-disable-next-line no-new-func
    return { ...new Function(`${text}\nreturn GV.DEFAULTS;`)() };
  }

  const shown = () => (s.mode === 'variation' && s.variation ? s.variation : s.final);

  return {
    state: s,
    load,
    shown,
    stats: (y = s.year) => shown().stats[y],
    finalStats: (y = s.year) => s.final.stats[y],
    setYear(y) { s.year = Math.max(0, Math.min(YEARS, Math.round(y))); emit('year'); },
    setMode(m) { if (m === 'variation' && !s.variation) return; s.mode = m; emit('mode'); },
    setParams(p) { Object.assign(s.P, p); emit('params'); },
    resetParams() { s.P = { ...s.DEFAULTS }; emit('params'); },
    isDefault: () => Object.keys(s.DEFAULTS).every(k => s.P[k] === s.DEFAULTS[k]),
    stale: () => Boolean(s.ranWith && JSON.stringify(s.ranWith) !== JSON.stringify(s.P)),
    async run() {
      if (s.running) return null;
      s.running = true; s.progress = 0; s.status = 'load'; emit('running');
      const params = { ...s.P }, t0 = performance.now(), runId = ++s.runId;
      try {
        const res = await call({ type: 'run', params, runId }, pr => {
          if (pr.stage === 'run') { s.progress = ((pr.pass - 1) * 76 + (pr.year - 2025) + 1) / 152; s.status = pr.pass === 1 ? 'pass1' : 'pass2'; s.statusYear = pr.year; }
          else { s.status = 'load'; s.loadedBytes = pr.bytes; }
          emit('progress');
        });
        const ev = { idx: res.idx, cls: res.cls, off: res.off };
        s.variation = { ev, stats: res.stats, cells: cellsFromEvents(s.N, ev), id: runId, ms: performance.now() - t0 };
        s.ranWith = params; s.mode = 'variation'; s.compare = null;
        return s.variation;
      } finally {
        s.running = false; s.progress = 0; s.status = 'done'; emit('ran');
      }
    },
    async compareAt(y = s.year) {
      if (!s.variation) return null;
      const r = await call({ type: 'compare', runId: s.variation.id, year: y });
      return r.none ? null : r;
    },
    destroy() { worker?.terminate(); worker = null; }
  };
}
