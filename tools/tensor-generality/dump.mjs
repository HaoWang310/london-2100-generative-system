// (test) builds a site's D in the browser exactly as Tensor Studio does (with the exact water cut) and saves it
import fs from 'node:fs'; import { chromium } from 'playwright';
const br = await chromium.launch({ executablePath: process.env.CHROME || undefined });
for (const [id, keep] of (process.env.DUMP || 'barking:0').split(',').map(x => x.split(':'))){
  const page = await br.newPage();
  await page.goto(`http://localhost:8123/tools/tensor-generality/host.html?site=${id}&keep=${keep}&proto=1&flood=b&dump=1`);
  let d = null; for (let i = 0; i < 600 && !d; i++){ const f = page.frames().find(f => /tensor-studio/.test(f.url())); if (f) d = await f.evaluate(() => window.__DUMP || null).catch(() => null); if (!d) await page.waitForTimeout(100); }
  fs.mkdirSync('dumps', { recursive: true }); fs.writeFileSync(`dumps/${id}-keep${keep}.json`, d || 'null'); console.log('dumped', id, keep, d ? d.length : 0); await page.close(); }
await br.close();
