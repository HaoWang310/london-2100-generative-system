// The wool page's result, as a fingerprint: run it before and after a change that should only make the page faster,
// and the two files must match. Needs Chrome and Playwright on this machine (not part of the site, not run on CI):
//   python3 -m http.server 8765            (in the repository's root)
//   node incubator/loop-city-wool/source/fingerprint.cjs 8765 before.json
//   ... change ...
//   node incubator/loop-city-wool/source/fingerprint.cjs 8765 after.json && diff before.json after.json
// It covers the example (station P2 and its two neighbours): the baked data of steps 1 to 9, the relaxed wool (in the
// page, and in the workers as the Run button does it), the roads of steps 11 to 16 with their hierarchy, the parcels and
// their use, and a picture of every step in the dark and light looks. Every number at full precision.
const PW = process.env.PLAYWRIGHT || '/opt/npm-tools/node_modules/playwright';
const CHROME = process.env.CHROME || '/usr/bin/google-chrome';
const { chromium } = require(PW); const fs = require('fs');
const MARK = '// ---------------------------------------------------------------- a test hook, asleep unless the address ends in #...bdtest';
const HOOK = 'window.__W = { S: () => S, BD: () => BD, DATA: () => DATA, setStep: (n, k) => setStep(n, k), draw: () => draw(), relax: () => relax(), relaxSync: () => relaxSync(), bdDone: () => !BD.busy && (BD.res === null || BD.key === JSON.stringify(bdParams()) + \'|\' + (S.relaxId || 0)) };\n';
const fnv = s => { let x = 2166136261; for (let i = 0; i < s.length; i++) { x ^= s.charCodeAt(i); x = Math.imul(x, 16777619); } return (x >>> 0).toString(36); };
(async () => {
  const port = process.argv[2] || '8765', out = process.argv[3] || 'fingerprint.json';
  const b = await chromium.launch({ executablePath: CHROME });
  const page = await (await b.newContext({ viewport: { width: 1440, height: 900 }, locale: 'en-GB', deviceScaleFactor: 1 })).newPage();
  const errs = []; page.on('pageerror', e => errs.push(String(e).slice(0, 200)));
  await page.route(/\/incubator\/loop-city-wool\/(index\.html)?(\?.*)?$/, async r => { const res = await r.fetch(); let t = await res.text();
    if (!t.includes(MARK)) throw new Error('the test hook mark is gone'); r.fulfill({ response: res, body: t.replace(MARK, HOOK + MARK) }); });
  await page.goto(`http://127.0.0.1:${port}/incubator/loop-city-wool/index.html#noauto&rebake`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__W && __W.DATA(), null, { timeout: 600000, polling: 300 });
  // a page that bakes step by step bakes every step here first
  await page.evaluate(async () => { if (window.__woolUpTo) await window.__woolUpTo(9); });
  const R = { errors: errs };
  R.data = await page.evaluate(() => { const D = __W.DATA(), f = s => { let x = 2166136261; for (let i = 0; i < s.length; i++) { x ^= s.charCodeAt(i); x = Math.imul(x, 16777619); } return (x >>> 0).toString(36); };
    const skip = new Set(['bakeMs', 'fromStore', 'ms', 'stage', 'stages']), o = {};
    for (const k of Object.keys(D).sort()) if (!skip.has(k)) o[k] = k === 'img' ? Object.fromEntries(Object.keys(D.img).sort().map(i => [i, f(D.img[i])])) : f(JSON.stringify(D[k]));
    return o; });
  const pics = async (tag, steps) => { for (const s of steps) {
    await page.evaluate(n => { __W.setStep(n, true); }, s);
    if (s > 20) await page.waitForFunction(() => __W.bdDone(), null, { timeout: 600000, polling: 200 });
    await page.evaluate(() => __W.draw()); await page.waitForTimeout(150);
    R['pic ' + tag + ' ' + s] = fnv(await page.evaluate(() => document.getElementById('map').toDataURL('image/png'))); } };
  const look = t => page.evaluate(t => { const b = [...document.querySelectorAll('#right .seg button, #right button')].find(x => x.textContent.trim().toLowerCase() === t); if (b) b.click(); }, t);
  await pics('dark', [1, 2, 3, 4, 5, 6, 7, 8, 9]);
  const thr = () => page.evaluate(() => { const f = s => { let x = 2166136261; for (let i = 0; i < s.length; i++) { x ^= s.charCodeAt(i); x = Math.imul(x, 16777619); } return (x >>> 0).toString(36); };
    return f(JSON.stringify((__W.S().relaxed || []).map(a => (a || []).map(l => Array.from(l))))); });
  await page.evaluate(() => __W.relax());
  await page.waitForFunction(() => __W.S().relaxed && !__W.S().busy, null, { timeout: 600000, polling: 300 });
  R.threadsWorkers = await thr();
  await page.evaluate(() => { __W.relaxSync(); __W.S().relaxId = (__W.S().relaxId || 0) + 1; });
  R.threadsPage = await thr();
  await pics('dark', [10, 21, 22, 23, 24, 25, 26]);
  for (const s of [21, 24, 26]) {
    await page.evaluate(n => __W.setStep(n, true), s);
    await page.waitForFunction(() => __W.bdDone(), null, { timeout: 600000, polling: 200 });
    R['roads ' + s] = await page.evaluate(() => { const f = s => { let x = 2166136261; for (let i = 0; i < s.length; i++) { x ^= s.charCodeAt(i); x = Math.imul(x, 16777619); } return (x >>> 0).toString(36); };
      const Rs = __W.BD().res; if (!Rs) return null;
      const BL = Rs.blocks;
      return { edges: Rs.edges.length, pts: f(JSON.stringify(Rs.edges.map(e => Array.from(e.pts)))), cl: f(JSON.stringify(Rs.edges.map(e => [e.cl, e.on ? 1 : 0, e.unit, e.up ? 1 : 0]))),
        hier: f(JSON.stringify(Rs.hier && Rs.hier.out)), blocks: BL ? f(JSON.stringify(BL, (k, v) => (v && v.buffer instanceof ArrayBuffer) ? Array.from(v) : v)) : null,
        use: f(JSON.stringify(Rs.useN || null)), numbers: f(JSON.stringify(Rs.numbers || null, (k, v) => k === 'ms' ? undefined : v)) }; });
  }
  await look('light'); await page.waitForTimeout(300);
  await pics('light', [1, 4, 5, 7, 8, 9, 10, 21, 24, 26]);
  R.errors = errs;
  fs.writeFileSync(out, JSON.stringify(R, null, 1)); console.log('written', out, 'errors', errs.length);
  await b.close();
})().catch(e => { console.error('FAIL', e); process.exit(1); });
