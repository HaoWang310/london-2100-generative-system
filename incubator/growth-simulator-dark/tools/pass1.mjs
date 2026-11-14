// The release's first pass, recorded for the page's step 6 ("where the city ends"), and the ground's
// areas for step 2. Runs the engine with the release's settings (about a minute) and writes
//   data/pass1-idx.z, data/pass1-cls.z : the first pass as an event stream, like final-idx / final-cls
//                                        (class 1 low, 2 mid, 3 high; off = where each year starts)
// and D.pass1 = {idx, cls, off}, D.GROUND (km²) into data/meta.js.
//   node incubator/growth-simulator-dark/tools/pass1.mjs
import fs from 'node:fs'; import zlib from 'node:zlib';
const dir = new URL('..', import.meta.url).pathname;
let metaText = fs.readFileSync(dir + 'data/meta.js', 'utf8');
const { D, SIZES } = new Function(metaText + '\nreturn { D: D, SIZES: SIZES };')();
const GRIDCODEC = new Function(fs.readFileSync(dir + 'codec.js', 'utf8') + '\nreturn GRIDCODEC;')();
globalThis.performance ??= { now: () => Date.now() };
const GV = new Function(fs.readFileSync(dir + 'engine.js', 'utf8') + '\nreturn GV;')();
const M = D.meta, N = M.NX * M.NY, arr = {};
for (const n of ['BITS', 'ZONE', 'CAT', 'SPUR', 'FIELD', 'VEIN', 'DRAIL']) {
  const raw = zlib.inflateSync(fs.readFileSync(dir + D.arr[n]));
  const b = GRIDCODEC.decode(n, raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.length), M, D.enc);
  arr[n] = n === 'DRAIL' ? new Uint16Array(b) : new Uint8Array(b);
}
GV.init(M, arr);
// the ground's areas
const B = GV.B, km = n => Math.round(n * M.C * M.C / 1e6), c = { build: 0, best: 0, g3a: 0, urban: 0, water: 0, golf: 0 };
for (let i = 0; i < N; i++) { const b = arr.BITS[i]; if (b & B.BUILD) c.build++; if (b & B.BEST) c.best++; if (b & B.G3A) c.g3a++; if (b & B.URBAN) c.urban++; if (b & B.WATER) c.water++; if (b & B.GOLF) c.golf++; }
const GROUND = Object.fromEntries(Object.entries(c).map(([k, v]) => [k, km(v)]));
// the first pass, year by year: a parcel's first class, then each promotion, as events
const prev = new Uint8Array(N), idx = [], cls = [], off = [0];
const res = await GV.run({}, null, (pass, year, tier) => {
  if (pass !== 1) return;
  for (let i = 0; i < N; i++) { const t = tier[i]; if (t !== prev[i]) { if (t >= 1 && t <= 3) { idx.push(i); cls.push(t); } prev[i] = t; } }
  off.push(idx.length);
});
if (res.stats[75].pop !== 12222179) throw new Error('not the release: ' + res.stats[75].pop);
const zi = zlib.deflateSync(Buffer.from(Uint32Array.from(idx).buffer), { level: 9 }), zc = zlib.deflateSync(Buffer.from(Uint8Array.from(cls)), { level: 9 });
fs.writeFileSync(dir + 'data/pass1-idx.z', zi); fs.writeFileSync(dir + 'data/pass1-cls.z', zc);
const pass1 = { idx: 'data/pass1-idx.z', cls: 'data/pass1-cls.z', off };
metaText = metaText.replace(/,"pass1":\{[^}]*\}/, '').replace(/,"GROUND":\{[^}]*\}/, '');
metaText = metaText.replace('"arr":{', `"pass1":${JSON.stringify(pass1)},"GROUND":${JSON.stringify(GROUND)},"arr":{`);
metaText = metaText.replace(/, "data\/pass1-(idx|cls)\.z": \d+/g, '').replace('var SIZES = {', `var SIZES = {"data/pass1-idx.z": ${zi.length}, "data/pass1-cls.z": ${zc.length}, `);
fs.writeFileSync(dir + 'data/meta.js', metaText);
console.log('pass 1 events', idx.length, 'idx', zi.length, 'cls', zc.length, 'GROUND', GROUND);
