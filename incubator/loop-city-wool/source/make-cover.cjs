// Makes example/preview.jpg: the picture the page shows while the example opens (the #liveStart cover).
// (28 Nov 2026) It is the page's own first view, step 0 (the grey ground, the towns, the stations; no palette colour),
// so the cover gives way to the map without a change of colour whatever the palette is. Before, it was step 1's mould
// in the old cyan, which flashed blue on every opening.
// Needs Chrome and Playwright on this machine, as make-example.cjs:
//   python3 -m http.server 8765            (in the repository's root)
//   node incubator/loop-city-wool/source/make-cover.cjs 8765
const PW = process.env.PLAYWRIGHT || '/opt/npm-tools/node_modules/playwright';
const CHROME = process.env.CHROME || '/usr/bin/google-chrome';
const { chromium } = require(PW); const path = require('path');
const OUT = path.join(__dirname, '..', 'example', 'preview.jpg');
(async () => {
  const port = process.argv[2] || '8765';
  const b = await chromium.launch({ executablePath: CHROME });
  const page = await (await b.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1.5 })).newPage();
  const errs = []; page.on('pageerror', e => errs.push(String(e)));
  // opened as a visitor opens it: the example, on its first view
  await page.goto(`http://127.0.0.1:${port}/incubator/loop-city-wool/index.html`, { waitUntil: 'load' });
  await page.waitForFunction(() => { const g = document.getElementById('liveStart'); return g && g.style.display === 'none'; }, null, { timeout: 120000, polling: 200 });
  if (errs.length) throw new Error(errs.join('\n'));
  // the map alone: what floats over it while it opens (the example's note, the chapter bar) is taken out of the picture
  await page.evaluate(() => { for (const id of ['lcAuto', 'lcSampleNote', 'lcChap', 'lcNav']) { const e = document.getElementById(id); if (e) e.remove(); } });
  // no words in it: the page draws its names in the reader's language (and the cover is shown in either), so the map
  // is drawn once more with the canvas's text left out, and what sits over the map (the place card, zoom, compass,
  // scale) is hidden for the picture
  await page.evaluate(() => {
    const P = CanvasRenderingContext2D.prototype; P.fillText = P.strokeText = function () {}; P.roundRect = function () {};   // the names' pills are round rects
    const st = document.createElement('style'); st.textContent = '#wrap > :not(canvas#map){visibility:hidden!important}'; document.head.appendChild(st);
    dispatchEvent(new Event('resize'));
  });
  await page.waitForTimeout(2500);
  await page.locator('#map').screenshot({ path: OUT, type: 'jpeg', quality: 72 });
  console.log('example/preview.jpg written');
  await b.close();
})().catch(e => { console.error('FAIL', e); process.exit(1); });
