// The four layers of the catalogue cover, drawn by the page itself (25 Nov 2026): step 16 (roads and parcels), step 10
// (the wool), step 7 (farmland kept), each without the base map, and step 4 (cells, loop, existing roads) with it, all
// on the example's three cells in one view, in one palette. compose.py makes the cover from them.
//   python3 -m http.server 8765                        (in the repository's root)
//   node incubator/loop-city-wool/source/cover/capture.cjs 8765 p3 /tmp/wool-cover
const PW = process.env.PLAYWRIGHT || '/opt/npm-tools/node_modules/playwright';
const CHROME = process.env.CHROME || '/usr/bin/google-chrome';
const { chromium } = require(PW); const fs = require('fs');
const [port = '8765', pal = 'p3', out = '/tmp/wool-cover'] = process.argv.slice(2);
(async () => {
  fs.mkdirSync(out, { recursive: true });
  const b = await chromium.launch({ executablePath: CHROME, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await (await b.newContext({ viewport: { width: 1500, height: 1100 }, deviceScaleFactor: 1 })).newPage();
  p.on('pageerror', e => console.error('page:', String(e)));
  await p.goto(`http://127.0.0.1:${port}/incubator/loop-city-wool/index.html#lang=en&pal=${pal}`, { waitUntil: 'load' });
  await p.waitForFunction(() => document.getElementById('lcFlow') && typeof S !== 'undefined' && S.view, null, { timeout: 120000 });
  await p.waitForTimeout(800);
  const idle = () => p.waitForFunction(() => !__lcFlow.running && !__lcFlow.on && !__lcFlow.prep && !__lcFlow.busyParam, null, { timeout: 400000, polling: 100 });
  await p.evaluate(() => document.querySelector('#lcFlow [data-full]').click()); await p.waitForTimeout(500);
  await p.addStyleTag({ content: '#wrap > *:not(#map){display:none !important} #lcAnim{display:none !important}' });
  // [step, file, base map off]; the first of each kind only settles the full-window view
  for (const [k, name, bare] of [[9, null, 1], [26, 'L26', 1], [10, 'L10', 1], [7, 'L7', 1], [3, null, 0], [4, 'L4', 0]]) {
    await p.evaluate(k => document.querySelector('#lcFlow [data-open="' + k + '"]').click(), k); await p.waitForTimeout(300); await idle();
    await p.evaluate(() => { let a = [1e9, 1e9, -1e9, -1e9]; DATA.cells.forEach(c => { for (let i = 0; i < c.ring.length; i += 2) { a[0] = Math.min(a[0], c.ring[i]); a[2] = Math.max(a[2], c.ring[i]); a[1] = Math.min(a[1], c.ring[i + 1]); a[3] = Math.max(a[3], c.ring[i + 1]); } });
      S.view.cx = (a[0] + a[2]) / 2; S.view.cy = (a[1] + a[3]) / 2; S.view.mpp = Math.max((a[2] - a[0]) / (W * 0.9), (a[3] - a[1]) / (Hh * 0.9)); FC.pic = null; draw(); });
    if (bare) await p.evaluate(() => { for (const q of ['towns', 'roads', 'rail', 'edge', 'plines', 'anchors', 'bdtown']) if (q in S.layers) S.layers[q] = 0; });
    await p.waitForTimeout(1200); await p.evaluate(() => { FC.pic = null; draw(); }); await p.waitForTimeout(400);
    if (name) { await p.locator('#map').screenshot({ path: `${out}/${name}.png` }); console.log('layer', name); }
  }
  await b.close();
})();
