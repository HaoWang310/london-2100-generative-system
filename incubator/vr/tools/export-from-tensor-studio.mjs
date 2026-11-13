// Runs Tensor Studio headless, presses "generate now", waits for the result and writes a scene file.
//   node tools/export-from-tensor-studio.mjs [tensor studio URL] [out.json]
// needs: npm i playwright-core, and Chrome (set CHROME=/path/to/chrome if it is not /usr/bin/google-chrome)
import { chromium } from 'playwright-core';
import fs from 'fs';
const URL_ = process.argv[2] || 'https://haowang310.github.io/london-2100-generative-system/incubator/tensor-studio/';
const OUT = process.argv[3] || 'data/station-p2.scene.json';
const b = await chromium.launch({ executablePath: process.env.CHROME || '/usr/bin/google-chrome', args: ['--use-gl=swiftshader','--enable-unsafe-swiftshader'] });
const p = await b.newPage({ viewport: { width: 1400, height: 900 } });
p.on('console', m => { if (m.type() === 'error') console.log('ERR', m.text()); });
await p.goto(URL_, { waitUntil: 'load' });
await p.waitForFunction(() => window.__TS && document.getElementById('bInstant'), null, { timeout: 60000 });
await p.waitForTimeout(3000);
await p.evaluate(() => document.getElementById('bInstant').click());
await p.waitForFunction(() => { try { return FINISHED === true; } catch (e) { return false; } }, null, { timeout: 180000 });
const scene = await p.evaluate(() => {
  const r = a => Array.from(a, x => Math.round(x * 100) / 100);
  const D = window.__TS.D;
  return { format: 'london-2100-vr/scene', version: 1, source: 'Tensor Studio v8.6 · station P2 example · show result (mode ' + MODE + ')',
    crs: 'EPSG:27700', origin: D.origin, grid: D.grid,
    Z: D.env ? r(D.env.Z) : null, land: D.landMask ? Array.from(D.landMask) : null, flood: D.flood && D.flood.grid ? Array.from(D.flood.grid) : null,
    streets: streetWidths().map(s => ({ level: s.level, pts: s.pts.map(q => [Math.round(q[0]*10)/10, Math.round(q[1]*10)/10]), w: s.w.map(x => Math.round(x*10)/10) })),
    fixed: (D.fixed.streets || []), bridges: (D.fixed.bridges || []) };
});
fs.writeFileSync(OUT, JSON.stringify(scene));
console.log('streets', scene.streets.length, 'Z', !!scene.Z, 'flood', !!scene.flood, 'land', !!scene.land);
await b.close();
