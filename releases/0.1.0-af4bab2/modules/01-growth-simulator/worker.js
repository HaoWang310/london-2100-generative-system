// 01 · Growth simulator — the engine, off the page's thread.
// A classic worker: it loads the incubator's own data/meta.js and engine.js
// (see source.js), so the workspace runs exactly the incubator's engine.
// Messages in:  {type:'init', base} · {type:'run', id, params} · {type:'compare', id, runId, year}
// Messages out: {type:'progress', id, ...} · {type:'result', id, ...} · {type:'error', id, message}
/* global importScripts, D, GV */

let base = null, engine = null, finalEv = null;
const runs = new Map();            // runId -> {idx, cls, off}; the latest few, for comparisons
const tiers = new Map();           // key -> {applied, tier}
const cache = new Map();

async function inflate(buf) {
  const ds = new DecompressionStream('deflate');
  return new Response(new Blob([buf]).stream().pipeThrough(ds)).arrayBuffer();
}

async function fetchBytes(path, id, label) {
  const r = await fetch(base + path);
  if (!r.ok) throw new Error(`${path}: ${r.status}`);
  if (!r.body || !r.body.getReader) return r.arrayBuffer();
  const reader = r.body.getReader(), parts = [];
  let n = 0;
  for (;;) {
    const x = await reader.read();
    if (x.done) break;
    parts.push(x.value); n += x.value.length;
    postMessage({ type: 'progress', id, stage: 'load', label, bytes: n });
  }
  const u = new Uint8Array(n); let o = 0;
  for (const p of parts) { u.set(p, o); o += p.length; }
  return u.buffer;
}

function ensureEngine(id) {
  if (engine) return engine;
  const names = ['BITS', 'ZONE', 'CAT', 'SPUR', 'FIELD', 'VEIN', 'DRAIL'];
  engine = Promise.all(names.map(n => fetchBytes(D.arr[n], id, n).then(inflate))).then(bufs => {
    const a = {};
    names.forEach((n, i) => { a[n] = n === 'DRAIL' ? new Uint16Array(bufs[i]) : new Uint8Array(bufs[i]); });
    GV.init(D.meta, a);
    return GV;
  });
  engine.catch(() => { engine = null; });
  return engine;
}

function ensureFinal(id) {
  if (finalEv) return finalEv;
  finalEv = Promise.all([fetchBytes(D.final.idx, id, 'idx').then(inflate), fetchBytes(D.final.cls, id, 'cls').then(inflate)])
    .then(([i, c]) => ({ idx: new Uint32Array(i), cls: new Uint8Array(c), off: D.final.off }));
  finalEv.catch(() => { finalEv = null; });
  return finalEv;
}

// The class of every parcel at year index y, replayed incrementally (as the incubator's Replay).
function tierAt(key, ev, y) {
  const N = D.meta.NX * D.meta.NY;
  let t = tiers.get(key);
  if (!t) { t = { applied: 0, tier: new Uint8Array(N) }; tiers.set(key, t); }
  const end = ev.off[y + 1];
  if (end < t.applied) { t.tier.fill(0); t.applied = 0; }
  for (let k = t.applied; k < end; k++) t.tier[ev.idx[k]] = ev.cls[k];
  t.applied = end;
  return t.tier;
}

// The incubator page's measure() and samePlace(), unchanged in substance.
function measure(tier) {
  const E = GV.get(), B = GV.B, N = E.N, hi = [];
  let built = 0, best = 0, farm = 0, farmBest = 0, farmGoodLine = 0, line2 = 0;
  for (let i = 0; i < N; i++) {
    const t = tier[i]; if (!t) continue;
    if (t <= 3) { built++; if (E.BITS[i] & B.BEST) best++; if (E.DRAIL[i] <= 2000) line2++; if (t === 3) hi.push(E.DN[i]); }
    else { farm++; if (E.BITS[i] & B.BEST) farmBest++; if ((E.BITS[i] & (B.BEST | B.G3A)) && E.DRAIL[i] <= 5000) farmGoodLine++; }
  }
  hi.sort((a, b) => a - b);
  return { built, best: best / Math.max(1, built), farmBest: farmBest / Math.max(1, farm), farmGoodLine: farmGoodLine / Math.max(1, farm),
    line2: line2 / Math.max(1, built), hiMed: hi.length ? hi[hi.length >> 1] / 1000 : null };
}
function samePlace(a, b) {
  let both = 0, va = 0;
  for (let i = 0; i < a.length; i++) { const x = a[i]; if (x >= 1 && x <= 3) { va++; const z = b[i]; if (z >= 1 && z <= 3) both++; } }
  return va ? both / va : 0;
}

onmessage = async ({ data: m }) => {
  try {
    if (m.type === 'init') {
      base = m.base;
      importScripts(base + 'data/meta.js', base + 'engine.js');
      postMessage({ type: 'ready', id: m.id });
    } else if (m.type === 'run') {
      await ensureEngine(m.id);
      const res = await GV.run(m.params, pr => postMessage({ type: 'progress', id: m.id, stage: 'run', pass: pr.pass, year: pr.year }));
      runs.set(m.runId, { idx: res.idx, cls: res.cls, off: res.off });
      for (const k of [...runs.keys()]) if (k !== m.runId) { runs.delete(k); tiers.delete('v' + k); }
      for (const k of [...cache.keys()]) if (!k.startsWith('f')) cache.delete(k);
      postMessage({ type: 'result', id: m.id, idx: res.idx.slice(), cls: res.cls.slice(), off: Array.from(res.off), stats: res.stats });
    } else if (m.type === 'compare') {
      await ensureEngine(m.id);
      const fin = await ensureFinal(m.id), v = runs.get(m.runId);
      if (!v) { postMessage({ type: 'result', id: m.id, none: true }); return; }
      const key = `${m.runId}|${m.year}`;
      if (!cache.has(key)) {
        const tv = tierAt('v' + m.runId, v, m.year), tf = tierAt('f', fin, m.year);
        if (!cache.has('f' + m.year)) cache.set('f' + m.year, measure(tf));
        cache.set(key, { variation: measure(tv), final: cache.get('f' + m.year), same: samePlace(tv, tf) });
      }
      postMessage({ type: 'result', id: m.id, ...cache.get(key) });
    }
  } catch (err) {
    postMessage({ type: 'error', id: m.id, message: String(err && err.message || err) });
  }
};
