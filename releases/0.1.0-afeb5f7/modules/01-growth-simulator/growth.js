// 01 · Growth simulator — the state on the page's side.
// Loads the incubator's meta, controls and the final's event stream, keeps the
// settings P, runs variations in worker.js, and hands the map one parcel record
// per cell (cells.js) for whichever outcome is shown.

import { sourceBase, evaluateShared, inflate } from './source.js?v=afeb5f7';
import { cellsFromEvents } from './cells.js?v=afeb5f7';

export const YEARS = 75;                       // year index 0..75 = 2025..2100
const VQ = new URL(import.meta.url).search;    // the build's ?v=, for this module's own worker
// A short content hash for each incubator file this module reads, filled in by
// tools/build-site.mjs (empty while developing). A file is fetched again only when it has
// changed, never mixed with an older copy, and not re-downloaded after every deploy.
const SRC_HASH = {"README.md":"7949ea8cb3","SOURCE.md":"fb2d8271e8","codec.js":"9613f2bc4b","controls.js":"fec009a22d","data/BITS.z":"1e07ecdbe1","data/CAT.z":"d990f4e566","data/DMSans.ttf":"dd1563c3bb","data/DRAIL.d.z":"e2a83ae1f8","data/FIELD.d.z":"39bdea160a","data/SPUR.z":"e20097000b","data/VEIN.d.z":"4eaeb23676","data/ZONE.z":"b9a2d7fbaa","data/final-cls.z":"5bb472fbff","data/final-idx.z":"a8c65d2acf","data/layer-absorbed.png":"16ce85def7","data/layer-aonb.png":"4b95969b38","data/layer-belt.png":"3211df4a4f","data/layer-roads.png":"c788a0ec4a","data/layer-towns.png":"25faced5c0","data/layer-water.png":"0f522c0da1","data/meta.js":"115c44c52a","data/pass1-cls.z":"0a125cafc7","data/pass1-idx.z":"2b9bd0b269","engine.js":"1e75667eb7","index.html":"d379af5096","tools/encode-ground.mjs":"d4076aff17","tools/pass1.mjs":"acb490e631"};
const hq = p => (SRC_HASH[p] ? `?h=${SRC_HASH[p]}` : '');

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
    ground: 'idle', groundBytes: {}, groundTotal: 0,   // the engine's ground grids: idle | loading | ready
    compare: null
  };
  let worker = null, nextId = 0;
  const pending = new Map();
  const emit = what => onChange(what, s);

  function call(msg, onProgress) {
    if (!worker) {
      worker = new Worker(new URL(`./worker.js${VQ}`, import.meta.url));   // the build's ?v= to the worker too
      worker.onmessage = ({ data }) => {
        const p = pending.get(data.id); if (!p) return;
        if (data.type === 'progress') { p.onProgress?.(data); return; }
        pending.delete(data.id);
        if (data.type === 'error') p.reject(new Error(data.message)); else p.resolve(data);
      };
      worker.onerror = e => { for (const p of pending.values()) p.reject(new Error(e.message || 'worker failed')); pending.clear(); worker = null; };
      call({ type: 'init', base: s.base, hash: SRC_HASH });
    }
    const id = ++nextId;
    return new Promise((resolve, reject) => { pending.set(id, { resolve, reject, onProgress }); worker.postMessage({ ...msg, id }); });
  }

  async function load() {
    if (s.loaded) return s;
    if (s.loading) return s.loading;
    s.loading = (async () => {
      const [meta, controls] = await Promise.all([fetchOk(s.base + 'data/meta.js' + hq('data/meta.js')), fetchOk(s.base + 'controls.js' + hq('controls.js'))]);
      Object.assign(s, evaluateShared(meta, controls));
      s.N = s.D.meta.NX * s.D.meta.NY;
      s.groundTotal = Object.values(s.D.arr).reduce((t, p) => t + (s.SIZES[p] || 0), 0);
      const [idx, cls] = await Promise.all([fetchOk(s.base + s.D.final.idx + hq(s.D.final.idx), 'buf').then(inflate), fetchOk(s.base + s.D.final.cls + hq(s.D.final.cls), 'buf').then(inflate)]);
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
    const text = await fetchOk(s.base + 'engine.js' + hq('engine.js'));
    // eslint-disable-next-line no-new-func
    return { ...new Function(`${text}\nreturn GV.DEFAULTS;`)() };
  }

  // Ground download progress, from the worker's per-file byte counts.
  const onGround = pr => {
    if (pr.stage === 'load') { s.groundBytes[pr.label] = pr.bytes; if (s.ground === 'idle') s.ground = 'loading'; }
    else if (pr.stage === 'ready') s.ground = 'ready';
  };
  /** Load the engine's ground grids in the background, so a run can start straight away. */
  function prepare() {
    if (!s.loaded || s.ground !== 'idle') return;
    s.ground = 'loading'; emit('progress');
    call({ type: 'prepare' }, pr => { onGround(pr); emit('progress'); })
      .then(() => { s.ground = 'ready'; emit('progress'); })
      .catch(() => { s.ground = 'idle'; s.groundBytes = {}; emit('progress'); });
  }
  const groundLoaded = () => Object.values(s.groundBytes).reduce((t, n) => t + n, 0);

  const shown = () => (s.mode === 'variation' && s.variation ? s.variation : s.final);

  return {
    state: s,
    load,
    prepare,
    groundLoaded,
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
      s.running = true; s.progress = 0; s.status = s.ground === 'ready' ? 'prep' : 'load'; emit('running');
      const params = { ...s.P }, t0 = performance.now(), runId = ++s.runId;
      try {
        const res = await call({ type: 'run', params, runId }, pr => {
          if (pr.stage === 'run') { s.progress = ((pr.pass - 1) * 76 + (pr.year - 2025) + 1) / 152; s.status = pr.pass === 1 ? 'pass1' : 'pass2'; s.statusYear = pr.year; }
          else { onGround(pr); s.status = s.ground === 'ready' ? 'prep' : 'load'; }
          emit('progress');
        });
        const ev = { idx: res.idx, cls: res.cls, off: res.off };
        s.variation = { ev, stats: res.stats, cells: cellsFromEvents(s.N, ev), pass1: res.pass1, id: runId, ms: performance.now() - t0 };
        s.ranWith = params; s.mode = 'variation'; s.compare = null;
        return s.variation;
      } finally {
        s.running = false; s.progress = 0; s.status = 'done'; emit('ran');
      }
    },
    /** The release's first pass (step 6), as cells; loaded once, on demand. */
    loadPass1() {
      if (!s.D.pass1) return Promise.reject(new Error('this incubator has no first pass'));
      if (!s.pass1Final) s.pass1Final = Promise.all([fetchOk(s.base + s.D.pass1.idx + hq(s.D.pass1.idx), 'buf').then(inflate), fetchOk(s.base + s.D.pass1.cls + hq(s.D.pass1.cls), 'buf').then(inflate)])
        .then(([i, c]) => cellsFromEvents(s.N, { idx: new Uint32Array(i), cls: new Uint8Array(c), off: s.D.pass1.off }));
      s.pass1Final.catch(() => { s.pass1Final = null; });
      return s.pass1Final;
    },
    /** The score each parcel gets with these settings (step 5): 1..255 on a log scale, 0 = never built. */
    magnet(params = s.P) { return call({ type: 'magnet', params: { ...params } }, pr => { onGround(pr); emit('progress'); }).then(r => r.magnet); },
    async compareAt(y = s.year) {
      if (!s.variation) return null;
      const r = await call({ type: 'compare', runId: s.variation.id, year: y });
      return r.none ? null : r;
    },
    destroy() { worker?.terminate(); worker = null; }
  };
}
