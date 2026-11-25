// Makes the palette thumbnails of the right panel (LK_THUMB in index.html): for each palette, step 7 (farming and
// building land) near station P2, as the page draws it, 192 x 120. Run it again when the palettes or the look of the
// faces change. Needs Chrome and Playwright on this machine:
//   python3 -m http.server 8765            (in the repository's root)
//   node incubator/loop-city-wool/source/make-thumbs.cjs 8765
const PW = process.env.PLAYWRIGHT || '/opt/npm-tools/node_modules/playwright';
const CHROME = process.env.CHROME || '/usr/bin/google-chrome';
const { chromium } = require(PW); const fs = require('fs'), path = require('path');
const PAGE = path.join(__dirname, '..', 'index.html');
(async () => {
  const port = process.argv[2] || '8765';
  const b = await chromium.launch({ executablePath: CHROME });
  const p = await (await b.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 })).newPage();
  await p.goto(`http://127.0.0.1:${port}/incubator/loop-city-wool/index.html#noauto`, { waitUntil: 'load' });
  await p.waitForFunction(() => typeof S !== 'undefined' && S.view && window.__woolUpTo, null, { timeout: 120000 });
  const th = await p.evaluate(async () => {
    await __woolUpTo(8); setStep(7); const out = {}, P2 = DATA.stations.find(s => s.id === 'P2');
    for (const L of LOOKS) {
      V.pal = L.key; LOOKS.forEach(l => { l._c = null; }); FC.pic = null;
      fit(); S.view.cx = P2.x + 900; S.view.cy = P2.y - 700; S.view.mpp /= 2.4; draw();
      const c = document.createElement('canvas'); c.width = 192; c.height = 120; const g = c.getContext('2d'), w = cv.width * 0.5, h = w * 120 / 192;
      g.imageSmoothingQuality = 'high'; g.drawImage(cv, (cv.width - w) / 2, (cv.height - h) / 2, w, h, 0, 0, 192, 120);
      out[L.key] = c.toDataURL('image/jpeg', 0.82);
    }
    return out;
  });
  await b.close();
  const s = fs.readFileSync(PAGE, 'utf8'), a = s.indexOf('const LK_THUMB = {'), e = s.indexOf('\n', a);
  if (a < 0) throw new Error('LK_THUMB not found');
  fs.writeFileSync(PAGE, s.slice(0, a) + 'const LK_THUMB = ' + JSON.stringify(th) + ';' + s.slice(e));
  console.log('thumbnails written:', Object.keys(th).join(' '));
})();
