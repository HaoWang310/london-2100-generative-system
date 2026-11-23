#!/usr/bin/env node
// 01 · Loop City step 1 — publish a result.
//
// Opens the incubator page in a headless Chrome, grows one century with the page's own
// settings, and writes what the workspace needs to SHOW that run without computing anything:
//
//   result/result.json      what it is (date, the page it was made from, the settings), the frame,
//                           the highways, the cells, the stations and the rail (grid metres), the
//                           figures, and the index of the two files below
//   result/growth.bin.gz    the city's growth, every year: the 2025 picture as one palette index a
//                           cell, then for each year the cells that changed and what they became
//   result/mould-YYYY.webp  the slime mould as the page painted it, one picture every few years (its opacity as a
//                           grey picture, with the colour for each opacity in result.json; see mouldPicture)
//
// The pictures and colours are read off the page's own canvases, so this script knows nothing
// about the model: whatever the page paints is what is published.
//
//   node modules/01-loop-city/tools/publish-result.mjs [--every 5] [--quality 0.6] [--port 8791]
//
// Needs Playwright (npm i playwright-core, or PLAYWRIGHT=/path/to/node_modules/playwright) and a
// Chrome (CHROME=/path/to/chrome, default /usr/bin/google-chrome). A century takes one to three minutes.

import { createServer } from 'node:http';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync, readdirSync, rmSync, existsSync, statSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, join, extname, normalize } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '../../..');
const OUT = join(HERE, '../result');
const APP = 'incubator/loop-city-mould-growth/';
const arg = (k, d) => { const i = process.argv.indexOf(`--${k}`); return i > 0 ? process.argv[i + 1] : d; };
const EVERY = Math.max(1, parseInt(arg('every', '5'), 10)), QUALITY = parseFloat(arg('quality', '0.6')), PORT = parseInt(arg('port', '8791'), 10);

const require = createRequire(import.meta.url);
let chromium;
for (const name of [process.env.PLAYWRIGHT, 'playwright-core', 'playwright', '/opt/npm-tools/node_modules/playwright'].filter(Boolean)) {
  try { chromium = require(name).chromium; break; } catch { /* try the next */ }
}
if (!chromium) { console.error('Playwright was not found. npm i playwright-core, or set PLAYWRIGHT=/path/to/node_modules/playwright'); process.exit(1); }

// a small static server over the repository, so the page is opened over http as it must be
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webp': 'image/webp', '.png': 'image/png', '.ttf': 'font/ttf' };
const server = createServer((req, res) => {
  const p = normalize(join(ROOT, decodeURIComponent(new URL(req.url, 'http://x').pathname)));
  if (!p.startsWith(ROOT) || !existsSync(p) || statSync(p).isDirectory()) { res.writeHead(404).end(); return; }
  res.writeHead(200, { 'content-type': TYPES[extname(p)] || 'application/octet-stream' }).end(readFileSync(p));
});
await new Promise(ok => server.listen(PORT, '127.0.0.1', ok));

// everything below runs in the page
const inPage = async ({ every, quality }) => {
  const L = window.LoopCityEngine, Y0 = 2025, Y1 = 2100;
  const b64 = async blob => { const u = new Uint8Array(await blob.arrayBuffer()); let s = ''; for (let i = 0; i < u.length; i += 32768) s += String.fromCharCode.apply(null, u.subarray(i, i + 32768)); return btoa(s); };
  const gzip = async u8 => { const cs = new CompressionStream('gzip'); const w = cs.writable.getWriter(); w.write(u8); w.close(); return new Blob([await new Response(cs.readable).arrayBuffer()]); };
  const g = L.growth, m = L.mould, N = g.width * g.height;
  const palette = [], seen = new Map();
  const index = () => {                                   // the growth canvas as one palette index a cell
    const d = new Uint32Array(g.canvas.getContext('2d').getImageData(0, 0, g.width, g.height).data.buffer), out = new Uint8Array(N);
    for (let i = 0; i < N; i++) { const v = d[i]; let k = seen.get(v); if (k === undefined) { k = palette.length; if (k > 255) throw new Error('more than 256 colours in the growth picture'); seen.set(v, k); palette.push([v & 255, (v >> 8) & 255, (v >> 16) & 255, v >>> 24]); } out[i] = k; }
    return out;
  };
  // The mould's picture is nearly all opacity: a pale smoke whose colour hardly moves. A browser stores the
  // opacity of a WebP without loss, which makes each picture some 800 KB. So when the colour is, to within a
  // few levels, a function of the opacity, the picture is stored as its opacity alone (a grey picture, about
  // a third the size) with the colour for each of the 256 opacities beside it. Otherwise it is stored whole.
  const scratch = document.createElement('canvas'); scratch.width = m.width; scratch.height = m.height; const sx = scratch.getContext('2d');
  const mouldPicture = async () => {
    const im = m.canvas.getContext('2d').getImageData(0, 0, m.width, m.height), d = im.data, n = m.width * m.height;
    const sum = new Float64Array(256 * 3), cnt = new Uint32Array(256);
    for (let i = 0, p = 0; i < n; i++, p += 4) { const a = d[p + 3]; if (!a) continue; sum[a * 3] += d[p]; sum[a * 3 + 1] += d[p + 1]; sum[a * 3 + 2] += d[p + 2]; cnt[a]++; }
    const lut = new Uint8Array(768); let last = [255, 255, 255];
    for (let a = 1; a < 256; a++) { if (cnt[a]) last = [sum[a * 3] / cnt[a], sum[a * 3 + 1] / cnt[a], sum[a * 3 + 2] / cnt[a]]; lut[a * 3] = Math.round(last[0]); lut[a * 3 + 1] = Math.round(last[1]); lut[a * 3 + 2] = Math.round(last[2]); }
    let dev = 0, seen = 0;
    for (let i = 0, p = 0; i < n; i++, p += 4) { const a = d[p + 3]; if (!a) continue; dev += Math.abs(d[p] - lut[a * 3]) + Math.abs(d[p + 1] - lut[a * 3 + 1]) + Math.abs(d[p + 2] - lut[a * 3 + 2]); seen++; }
    if (seen && dev / (seen * 3) > 6) return { blob: await new Promise(res => m.canvas.toBlob(res, 'image/webp', quality)), lut: null };   // the colour is its own thing: keep it whole
    for (let i = 0, p = 0; i < n; i++, p += 4) { const a = d[p + 3]; d[p] = d[p + 1] = d[p + 2] = a; d[p + 3] = 255; }
    sx.putImageData(im, 0, 0);
    let s = ''; for (let i = 0; i < 768; i++) s += String.fromCharCode(lut[i]);
    return { blob: await new Promise(res => scratch.toBlob(res, 'image/webp', quality)), lut: btoa(s) };
  };
  let prev = null, frame0 = null; const counts = [], idx = [], col = [], mould = [], mouldOf = {}; let lastSig = null, lastName = null;
  for (let Y = Y0; Y <= Y1; Y++) {
    if (!L.show(Y)) throw new Error('the page would not show ' + Y);
    const cur = index();
    if (!prev) { frame0 = cur; counts.push(0); }
    else { let n = 0, last = 0; for (let i = 0; i < N; i++) if (cur[i] !== prev[i]) { idx.push(i - last); last = i; col.push(cur[i]); n++; } counts.push(n); }
    prev = cur;
    if ((Y - Y0) % every === 0 || Y === Y1) {
      const pic = await mouldPicture(), data = await b64(pic.blob), sig = data.length + ':' + data.slice(0, 64) + data.slice(-64);
      if (sig === lastSig) mouldOf[Y] = lastName;          // the roads are parked: the same picture
      else { lastName = `mould-${Y}.webp`; lastSig = sig; mould.push({ year: Y, file: lastName, data, lut: pic.lut }); mouldOf[Y] = lastName; }
    }
  }
  const E = idx.length, bin = new Uint8Array(N + E * 4 + E);
  bin.set(frame0, 0); new DataView(bin.buffer).setUint32(N, 0, true);
  const dv = new DataView(bin.buffer); for (let k = 0; k < E; k++) dv.setUint32(N + k * 4, idx[k], true);
  bin.set(col, N + E * 4);
  const sliders = {}; for (const [k, id] of Object.entries(L.sliders)) sliders[k] = L.get(id);
  const num = id => { const v = parseFloat((document.getElementById(id)?.textContent || '').replace(/,/g, '')); return Number.isFinite(v) ? v : 0; };
  const hw = L.highways(), cells = L.cells(), km = c => Math.round(hw.features.filter(f => f.properties.class === c).reduce((s, f) => s + (f.properties.km || 0), 0));
  const ex = m.extentBNG;
  // grid metres to one decimal: the projection itself is good to a few metres
  const r1 = v => Math.round(v * 10) / 10, round = c => (typeof c[0] === 'number' ? [r1(c[0]), r1(c[1])] : c.map(round));
  const tidy = fc => ({ type: 'FeatureCollection', features: fc.features.map(f => ({ type: 'Feature', properties: f.properties, geometry: { type: f.geometry.type, coordinates: round(f.geometry.coordinates) } })) });
  return {
    frame: { e0: ex.e0, e1: ex.e1, n0: ex.n0, n1: ex.n1 },
    growth: { width: g.width, height: g.height, palette, counts, events: E, rawBytes: bin.length, data: await b64(await gzip(bin)) },
    mould: { width: m.width, height: m.height, frames: mould, of: mouldOf, lut: Object.fromEntries(mould.filter(f => f.lut).map(f => [f.file, f.lut])) },
    vectors: { highways: tidy(hw), cells: tidy(cells) },
    base: { stations: tidy(L.stations()), rails: tidy({ type: 'FeatureCollection', features: [...L.proposed().features.filter(f => f.properties.kind !== 'radial'), ...L.radials().features] }) },
    stats: { roadKm: num('cRoad1'), builtKm2: num('cBuilt'), farmKm2: num('cFarm'), cells: cells.features.length, highwayKm: km('highway'), linkKm: km('link'),
      stationsInCell: cells.features.reduce((s, f) => s + (f.properties.stations ? String(f.properties.stations).split(' ').filter(Boolean).length : 0), 0) },
    sliders, engineVersion: L.version, note: document.getElementById('yearNote')?.textContent || ''
  };
};

let browser;
try {
  browser = await chromium.launch({ executablePath: process.env.CHROME || '/usr/bin/google-chrome' });
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  page.on('pageerror', e => console.error('page error:', String(e).slice(0, 200)));
  console.log('opening the page…');
  await page.goto(`http://127.0.0.1:${PORT}/${APP}index.html?embed=1`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.LoopCityEngine && window.LoopCityEngine.ready, null, { timeout: 300000 });
  console.log('growing the century…');
  const t0 = Date.now();
  await page.evaluate(() => { window.__done = false; window.LoopCityEngine.onYear((y, d) => { if (d) window.__done = true; }); if (!window.LoopCityEngine.run()) throw new Error('the run did not start'); });
  await page.waitForFunction(() => window.__done, null, { timeout: 900000, polling: 1000 });
  const seconds = Math.round((Date.now() - t0) / 1000);
  console.log(`century in ${seconds} s; reading the years…`);
  const r = await page.evaluate(inPage, { every: EVERY, quality: QUALITY });

  if (existsSync(OUT)) for (const f of readdirSync(OUT)) rmSync(join(OUT, f));
  mkdirSync(OUT, { recursive: true });
  const growthBin = Buffer.from(r.growth.data, 'base64');
  writeFileSync(join(OUT, 'growth.bin.gz'), growthBin);
  let mouldBytes = 0;
  for (const f of r.mould.frames) { const buf = Buffer.from(f.data, 'base64'); mouldBytes += buf.length; writeFileSync(join(OUT, f.file), buf); }
  const pageHash = createHash('sha256').update(readFileSync(join(ROOT, APP, 'index.html'))).digest('hex').slice(0, 12);
  let pageCommit = ''; try { pageCommit = execSync(`git -C "${ROOT}" log -1 --format=%h -- ${APP}`).toString().trim(); } catch { /* not a checkout */ }
  const id = createHash('sha256').update(growthBin).digest('hex').slice(0, 10);
  const result = {
    format: 1, id, publishedAt: new Date().toISOString(), source: APP, pageHash, pageCommit, engineVersion: r.engineVersion, centurySeconds: seconds,
    years: [2025, 2100], frame: r.frame, sliders: r.sliders, stats: r.stats,
    growth: { file: 'growth.bin.gz', width: r.growth.width, height: r.growth.height, palette: r.growth.palette, counts: r.growth.counts, events: r.growth.events, rawBytes: r.growth.rawBytes },
    mould: { width: r.mould.width, height: r.mould.height, every: EVERY, of: r.mould.of, lut: r.mould.lut },
    base: r.base, vectors: r.vectors
  };
  const json = JSON.stringify(result);
  writeFileSync(join(OUT, 'result.json'), json);
  const kb = n => `${Math.round(n / 1024)} KB`;
  console.log(`published ${id}: result.json ${kb(json.length)}, growth ${kb(growthBin.length)} (${r.growth.events.toLocaleString('en-GB')} changes, ${r.growth.palette.length} colours), mould ${r.mould.frames.length} pictures ${kb(mouldBytes)}; ${r.stats.cells} cells`);
} finally {
  await browser?.close();
  server.close();
}
