// Makes example/: the example's step 1 (station P2 and its two neighbours), worked out by the page itself, so the page
// opens on it at once. Run it again whenever the bake, the site data or the example changes (tools/tests/wool.test.mjs
// says when). Needs Chrome and Playwright on this machine:
//   python3 -m http.server 8765            (in the repository's root)
//   node incubator/loop-city-wool/source/make-example.cjs 8765
const PW = process.env.PLAYWRIGHT || '/opt/npm-tools/node_modules/playwright';
const CHROME = process.env.CHROME || '/usr/bin/google-chrome';
const { chromium } = require(PW); const fs = require('fs'), path = require('path'), { execFileSync } = require('child_process');
const OUT = path.join(__dirname, '..', 'example');
const KEYS = ['origin', 'size', 'pick', 'key', 'cells', 'shared', 'cellLabels', 'otherLabels', 'centrelines', 'rail', 'stations', 'cellBox'];
const EXT = { 'image/png': 'png', 'image/jpeg': 'jpg' };
(async () => {
  const port = process.argv[2] || '8765';
  const b = await chromium.launch({ executablePath: CHROME });
  const page = await (await b.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 })).newPage();
  const errs = []; page.on('pageerror', e => errs.push(String(e)));
  await page.goto(`http://127.0.0.1:${port}/incubator/loop-city-wool/index.html#nopre&step=1`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__WOOL_BAKER__ && window.__WOOL_BAKER__.done.has(1) && window.__LIVE_DATA__, null, { timeout: 600000, polling: 300 });
  const got = await page.evaluate(keys => { const D = window.__LIVE_DATA__;
    return { guard: window.__WOOL_GUARD__, data: Object.assign(Object.fromEntries(keys.map(k => [k, D[k]])), { nums: { cells: D.nums.cells, station: D.nums.station, shared: D.nums.shared } }),
      img: Object.fromEntries(['ground', 'mould', 'veins', 'key'].map(k => [k, D.img[k]])) }; }, KEYS);
  if (errs.length) throw new Error(errs.join('\n'));
  fs.mkdirSync(OUT, { recursive: true });
  for (const f of fs.readdirSync(OUT)) fs.unlinkSync(path.join(OUT, f));
  // the pictures: the JPEG as it is, the ground and the key as lossless WebP (the same pixels, a third of the bytes;
  // python3 with Pillow). The veins stay PNG: half transparent, a browser decodes their WebP a shade differently
  const WEBP = ['ground', 'key'];
  const img = {};
  for (const [k, url] of Object.entries(got.img)) { const m = /^data:(image\/\w+);base64,(.*)$/.exec(url); if (!m) throw new Error('picture ' + k);
    const f = k + '.' + EXT[m[1]]; fs.writeFileSync(path.join(OUT, f), Buffer.from(m[2], 'base64'));
    if (EXT[m[1]] === 'png' && WEBP.includes(k)) { img[k] = k + '.webp';
      execFileSync('python3', ['-c', 'import sys; from PIL import Image; Image.open(sys.argv[1]).save(sys.argv[2], "WEBP", lossless=True, exact=True, method=6, quality=100)', path.join(OUT, f), path.join(OUT, img[k])]);
      fs.unlinkSync(path.join(OUT, f)); } else img[k] = f; }
  // the picture the page shows while it opens: the map of step 1 as it will be, from a 1440 x 900 window
  await page.waitForFunction(() => document.getElementById('liveStart').style.display === 'none', null, { timeout: 60000 });
  await page.evaluate(() => { for (const id of ['lcAuto', 'lcSampleNote', 'lcChap', 'lcNav']) { const e = document.getElementById(id); if (e) e.remove(); } });
  await page.waitForTimeout(800);
  await page.locator('#map').screenshot({ path: path.join(OUT, 'preview.jpg'), type: 'jpeg', quality: 72 });
  fs.writeFileSync(path.join(OUT, 'step1.json'), JSON.stringify({ about: 'The wool page\'s example, step 1, made by source/make-example.cjs. Used only while guard matches the page.', guard: got.guard, img, data: got.data }));
  // the page's head asks for these files early: EXV names them and the bake they were made from
  const PAGE = path.join(__dirname, '..', 'index.html'), html = fs.readFileSync(PAGE, 'utf8');
  const exv = `/*EXV*/'${got.guard.bake}:${['step1.json', ...Object.values(img)].join(',')}'/*EXV*/`, html2 = html.replace(/\/\*EXV\*\/'[^']*'\/\*EXV\*\//, exv);
  if (html2 === html && !html.includes(exv)) throw new Error('EXV not found in index.html');
  fs.writeFileSync(PAGE, html2);
  console.log('example/ written', got.guard, fs.readdirSync(OUT).map(f => f + ' ' + fs.statSync(path.join(OUT, f)).size).join(', '));
  await b.close();
})().catch(e => { console.error('FAIL', e); process.exit(1); });
