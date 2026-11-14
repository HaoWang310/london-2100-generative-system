// Re-encode the smooth ground grids (see codec.js) and point data/meta.js at them.
// Run once from the repo root:  node incubator/growth-simulator-dark/tools/encode-ground.mjs
// It checks that every grid decodes back to the original bytes before it writes anything.
import fs from 'node:fs'; import zlib from 'node:zlib';
const dir = new URL('..', import.meta.url).pathname;
const GRIDCODEC = new Function(fs.readFileSync(dir + 'codec.js', 'utf8') + '\nreturn GRIDCODEC;')();
const metaPath = dir + 'data/meta.js';
let metaText = fs.readFileSync(metaPath, 'utf8');
const { D, SIZES } = new Function(metaText + '\nreturn { D: D, SIZES: SIZES };')();
const want = { DRAIL: 'dx16', FIELD: 'dxdy8', VEIN: 'dxdy8' };
const enc = { ...(D.enc || {}) };
for (const [name, e] of Object.entries(want)) {
  if (enc[name]) { console.log(name, 'already', enc[name]); continue; }
  const src = D.arr[name], raw = zlib.inflateSync(fs.readFileSync(dir + src));
  const coded = Buffer.from(GRIDCODEC.encode(name, raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.length), D.meta, e));
  const z = zlib.deflateSync(coded, { level: 9 });
  const back = Buffer.from(GRIDCODEC.decode(name, zlib.inflateSync(z).buffer.slice(0), D.meta, { [name]: e }));
  if (!back.equals(raw)) throw new Error(name + ': round trip differs');
  const out = src.replace(/\.z$/, '.d.z');
  fs.writeFileSync(dir + out, z); fs.unlinkSync(dir + src);
  console.log(name, e, fs.statSync(dir + out).size, 'bytes (was', SIZES[src], ')');
  metaText = metaText.replace(`"${name}":"${src}"`, `"${name}":"${out}"`).replace(`"${src}": ${SIZES[src]}`, `"${out}": ${z.length}`);
  enc[name] = e;
}
// D.enc goes into the arr record's neighbour, so loaders can find it as D.enc
if (!D.enc) metaText = metaText.replace('"arr":{', `"enc":${JSON.stringify(enc)},"arr":{`);
else metaText = metaText.replace(`"enc":${JSON.stringify(D.enc)}`, `"enc":${JSON.stringify(enc)}`);
fs.writeFileSync(metaPath, metaText);
console.log('meta.js updated');
