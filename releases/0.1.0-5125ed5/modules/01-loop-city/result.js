// 01 · Loop City step 1 — a published result, shown without computing anything.
//
// tools/publish-result.mjs grows one century on a desk and writes result/: what the run looked
// like every year, small enough to fetch on a phone. This file fetches it and plays it. Opening
// 01 therefore costs a few megabytes and no arithmetic, on any device; the engine (engine.js,
// the whole incubator page) is loaded only when someone presses Run to grow a century of their own.
//
// The same shape as the engine's state, so the overlay and the panel do not care which is on show.

import { YEAR0, YEARS } from './engine.js?v=5125ed5';

export const RESULT_FORMAT = 1;

/** Gunzip in the browser (and in Node, for the tests). Bytes that are not gzip are returned as they are. */
export async function gunzip(buf) {
  const u = new Uint8Array(buf);
  if (u.length < 2 || u[0] !== 0x1f || u[1] !== 0x8b) return u;                // a server may already have opened it
  if (typeof DecompressionStream !== 'function') throw new Error('This browser cannot open the published result (no DecompressionStream).');
  const stream = new Blob([u]).stream().pipeThrough(new DecompressionStream('gzip'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

/**
 * The city's growth, any year, from the published file: the 2025 picture as one palette index a
 * cell, then for each later year the cells that changed (as steps from the previous changed cell)
 * and what each became. No DOM: `pixels` is a Uint32Array of RGBA to put on a canvas.
 */
export class GrowthPlayer {
  constructor(bytes, g) {
    const N = g.width * g.height, E = g.events;
    if (bytes.length !== N + E * 5) throw new Error(`growth file: ${bytes.length} bytes, expected ${N + E * 5}`);
    if (g.counts.length !== YEARS + 1 || g.counts.reduce((a, b) => a + b, 0) !== E) throw new Error('growth file: the yearly counts do not add up');
    this.N = N; this.width = g.width; this.height = g.height;
    this.frame0 = bytes.subarray(0, N);
    this.step = new Uint32Array(bytes.slice(N, N + E * 4).buffer);            // copied, so it is aligned
    this.colour = bytes.subarray(N + E * 4);
    this.start = new Uint32Array(YEARS + 2);
    for (let y = 0; y <= YEARS; y++) this.start[y + 1] = this.start[y] + g.counts[y];
    // palette entries as the 32-bit value a little-endian canvas buffer holds: A B G R from the top byte down
    this.ink = Uint32Array.from(g.palette, ([r, gg, b, a]) => ((a << 24) | (b << 16) | (gg << 8) | r) >>> 0);
    this.cur = new Uint8Array(N);
    this.pixels = new Uint32Array(N);
    this.year = -1;
  }
  /** Bring `cur` and `pixels` to the year (0..75). Forward is a few thousand cells a year; backward starts again from 2025. */
  seek(y) {
    y = Math.max(0, Math.min(YEARS, y | 0));
    const { cur, pixels, ink, step, colour, start } = this;
    if (this.year < 0 || y < this.year) {
      cur.set(this.frame0);
      for (let i = 0; i < this.N; i++) pixels[i] = ink[cur[i]];
      this.year = 0;
    }
    for (let k = this.year + 1; k <= y; k++) {
      let i = 0;
      for (let e = start[k]; e < start[k + 1]; e++) { i += step[e]; const c = colour[e]; cur[i] = c; pixels[i] = ink[c]; }
    }
    this.year = y;
    return this;
  }
}

/** The two stored mould pictures a year lies between, and how far along (0..1). `of` maps a stored year to its file. */
export function mouldBetween(of, year) {
  const years = Object.keys(of).map(Number).sort((a, b) => a - b);
  let a = years[0], b = years[years.length - 1];
  for (const y of years) { if (y <= year) a = y; if (y >= year) { b = y; break; } }
  if (a === b || of[a] === of[b]) return { a: of[a], b: of[a], t: 0 };
  return { a: of[a], b: of[b], t: (year - a) / (b - a) };
}

const clampYear = y => Math.max(0, Math.min(YEARS, Math.round(y) || 0));

/**
 * state: { loaded, loading, error, running: false, ran: true, published: true, year (0..75), frame, mould, growth (canvases),
 *          version, vectors, vectorVersion, base, stats, sliders: [], meta }
 * onChange(what): 'loading' | 'loaded' | 'year' | 'error'
 */
export function createResult({ onChange = () => {}, base = new URL('./result/', import.meta.url).href } = {}) {
  const state = { loaded: false, loading: false, error: null, running: false, ran: true, published: true, year: YEARS, frame: null,
    mould: null, growth: null, version: 0, vectors: null, vectorVersion: 0, base: null, stats: {}, sliders: [], ms: 0, meta: null };
  const tag = new URL(import.meta.url).search;                                 // the build's cache key, if any
  let player = null, gctx = null, gimg = null, mctx = null, pending = null;
  // The stored pictures are kept as they came (small); opened ones are large (8.6 MB each), so only a few are
  // held at a time and the rest are opened again when the timeline comes back to them.
  const KEEP = 4;
  const blobs = new Map();                                                     // file -> Promise<Blob>
  const pictures = new Map();                                                  // file -> canvas | ImageBitmap | Promise, oldest first
  const blobOf = file => { let b = blobs.get(file); if (!b) { b = fetch(`${base}${file}?r=${state.meta.id}`).then(r => { if (!r.ok) throw new Error(`${file}: ${r.status}`); return r.blob(); }); b.catch(() => blobs.delete(file)); blobs.set(file, b); } return b; };

  async function picture(file) {
    const have = pictures.get(file);
    if (have) { pictures.delete(file); pictures.set(file, have); return have; }  // used again: now the newest
    const job = (async () => {
      const blob = await blobOf(file);
      let pic;
      if (typeof createImageBitmap === 'function') pic = await createImageBitmap(blob);
      else { pic = new Image(); pic.src = URL.createObjectURL(blob); await pic.decode(); }
      const lut = state.meta.mould.lut?.[file];
      if (lut) pic = fromOpacity(pic, lut);
      if (pictures.get(file) === job) pictures.set(file, pic);
      return pic;
    })();
    job.catch(() => { if (pictures.get(file) === job) pictures.delete(file); });
    pictures.set(file, job);
    while (pictures.size > KEEP) { const [old, v] = pictures.entries().next().value; pictures.delete(old); if (v && typeof v.close === 'function') v.close(); }
    return job;
  }
  // A picture stored as its opacity alone (see tools/publish-result.mjs): grey in, the smoke out.
  function fromOpacity(pic, lut64) {
    const w = state.mould.width, h = state.mould.height, c = document.createElement('canvas'); c.width = w; c.height = h;
    const cx = c.getContext('2d', { willReadFrequently: true }); cx.drawImage(pic, 0, 0, w, h);
    pic.close?.();
    const im = cx.getImageData(0, 0, w, h), d = im.data, lut = Uint8Array.from(atob(lut64), ch => ch.charCodeAt(0));
    for (let p = 0; p < d.length; p += 4) {
      const a = d[p];
      if (a < 6) { d[p] = d[p + 1] = d[p + 2] = d[p + 3] = 0; continue; }       // what the lossy picture left in the empty ground
      d[p] = lut[a * 3]; d[p + 1] = lut[a * 3 + 1]; d[p + 2] = lut[a * 3 + 2]; d[p + 3] = a;
    }
    cx.putImageData(im, 0, 0);
    return c;
  }
  const ready = file => { const p = pictures.get(file); return p && typeof p.then !== 'function' ? p : null; };

  function paintMould() {
    const { a, b, t } = mouldBetween(state.meta.mould.of, YEAR0 + state.year);
    const A = ready(a), B = ready(b);
    if (!A || !B) {                                                            // not here yet: fetch, and paint again if the year has not moved on
      const y = state.year;
      Promise.all([picture(a), picture(b)]).then(() => { if (state.year === y) { paintMould(); state.version++; onChange('year'); } }).catch(() => {});
      if (!A && !B) return;
    }
    const w = state.mould.width, h = state.mould.height;
    mctx.globalCompositeOperation = 'source-over'; mctx.globalAlpha = 1; mctx.clearRect(0, 0, w, h);
    if (A && (!B || t === 0)) mctx.drawImage(A, 0, 0, w, h);
    else if (B && !A) mctx.drawImage(B, 0, 0, w, h);
    else {                                                                     // between two stored years: a weighted sum of the two
      mctx.globalCompositeOperation = 'lighter';
      mctx.globalAlpha = 1 - t; mctx.drawImage(A, 0, 0, w, h);
      mctx.globalAlpha = t; mctx.drawImage(B, 0, 0, w, h);
      mctx.globalCompositeOperation = 'source-over'; mctx.globalAlpha = 1;
    }
  }
  function paint() {
    player.seek(state.year);
    gctx.putImageData(gimg, 0, 0);
    paintMould();
    state.version++;
  }

  function load() {
    if (state.loaded) return Promise.resolve(state);
    if (pending) return pending;
    state.loading = true; state.error = null; onChange('loading');
    pending = (async () => {
      try {
        const res = await fetch(`${base}result.json${tag}`, { cache: 'no-cache' });
        if (!res.ok) throw new Error(`no published result (${res.status})`);
        const meta = await res.json();
        if (meta.format !== RESULT_FORMAT) throw new Error(`published result: format ${meta.format}, this page reads ${RESULT_FORMAT}`);
        state.meta = meta;
        const g = meta.growth, bytes = await gunzip(await (await fetch(`${base}${g.file}?r=${meta.id}`)).arrayBuffer());
        player = new GrowthPlayer(bytes, g);
        state.growth = document.createElement('canvas'); state.growth.width = g.width; state.growth.height = g.height;
        gctx = state.growth.getContext('2d'); gimg = gctx.createImageData(g.width, g.height);
        player.pixels = new Uint32Array(gimg.data.buffer); player.year = -1;      // paint straight into the canvas's own buffer
        state.mould = document.createElement('canvas'); state.mould.width = meta.mould.width; state.mould.height = meta.mould.height;
        mctx = state.mould.getContext('2d');
        state.frame = meta.frame; state.base = meta.base; state.vectors = meta.vectors; state.vectorVersion++;
        state.stats = meta.stats; state.ms = (meta.centurySeconds || 0) * 1000;
        state.year = YEARS;
        await picture(meta.mould.of[YEAR0 + YEARS]);                           // the last year first: that is what opens
        paint();
        state.loaded = true; state.loading = false;
        onChange('loaded');
        // the other years' pictures are fetched now, one after another, and opened when the timeline reaches them
        (async () => { for (const f of new Set(Object.values(meta.mould.of))) { try { await blobOf(f); } catch { /* fetched again when asked for */ } } })();
        return state;
      } catch (e) {
        state.loading = false; state.error = e.message || String(e); pending = null;
        onChange('error');
        throw e;
      }
    })();
    return pending;
  }

  return {
    state,
    load,
    setYear(y) {
      y = clampYear(y);
      if (!state.loaded) return false;
      if (y === state.year) return true;
      state.year = y; paint(); onChange('year');
      return true;
    }
  };
}
