// Runs Tensor Studio on every test site (existing buildings kept, and cleared) plus the station P2 example, and
// records the site, the timings, the network and the app's own scores. Writes results.json and a picture per run.
import fs from 'node:fs';
import { chromium } from 'playwright';
import { SITES } from './sites.mjs';
const BASE = process.env.BASE || 'http://localhost:8123/tools/tensor-generality/host.html', OUT = new URL('./' + (process.env.OUTDIR || 'out') + '/', import.meta.url);
fs.mkdirSync(OUT, { recursive: true });
const only = process.env.ONLY ? process.env.ONLY.split(',') : null;
const keeps = process.env.KEEP ? process.env.KEEP.split(',') : ['1', '0'];
const runs = only ? [] : [{ id: 'p2', keep: '1' }];
for (const s of SITES){ if (only && !only.includes(s.id)) continue; for (const k of keeps) runs.push({ id: s.id, keep: k }); }
const browser = await chromium.launch({ executablePath: process.env.CHROME || undefined, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const results = [];
for (const r of runs){
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } }); const errs = []; page.on('pageerror', e => errs.push(e.message)); page.on('console', m => { if (m.type() === 'error') errs.push(m.text().slice(0, 200)); });
  const url = BASE + '?keep=' + r.keep + (r.id === 'p2' ? '' : '&site=' + r.id) + (process.env.PROTO === '1' ? '&proto=1' : '') + (process.env.FLOOD ? '&flood=' + process.env.FLOOD : ''), t0 = Date.now(); let res = { id: r.id, keep: r.keep };
  try {
    await page.goto(url);
    const frame = await (async () => { for (let i = 0; i < 600; i++){ const f = page.frames().find(f => /tensor-studio\/index\.html/.test(f.url())); if (f) return f; await page.waitForTimeout(100); } throw new Error('no frame'); })();
    let tSite = null, tReady = null;
    for (let i = 0; i < (+process.env.WAITN || 3600); i++){   // up to 6 min
      const st = await frame.evaluate(() => ({ ts: !!window.__TS, ready: !!window.__ts6, hud: document.getElementById('hud')?.textContent || '', fail: window.parent.__FAIL || null })).catch(() => ({}));
      if (st.ts && tSite == null) tSite = Date.now() - t0;
      if (st.ready){ tReady = Date.now() - t0; break; }
      if (st.fail || /无法打开|Could not open|失败/.test(st.hud || '')){ res.error = st.fail || st.hud; break; }
      await page.waitForTimeout(100); }
    if (!tReady && !res.error){   // stuck: pause the script and record where it is
      try { const cdp = await page.context().newCDPSession(page); await cdp.send('Debugger.enable');
        const paused = new Promise(r => cdp.once('Debugger.paused', r)); await cdp.send('Debugger.pause');
        const ev = await Promise.race([paused, new Promise(r => setTimeout(() => r(null), 10000))]);
        res.hang = ev ? ev.callFrames.slice(0, 12).map(f => (f.functionName || '(anon)') + ' ' + (f.url || '').split('/').pop() + ':' + (f.location.lineNumber + 1) + ':' + f.location.columnNumber) : 'no pause';
        console.log('HANG', r.id, r.keep, JSON.stringify(res.hang)); } catch (e){ res.hang = 'pause failed ' + e.message; }
      res.error = 'stuck'; }
    res.tSiteMs = tSite; res.tOpenMs = tReady;
    if (tReady){
      Object.assign(res, await frame.evaluate(() => {
        const T = window.__TS, A = window.__ts6, m = T.meta || {};
        if (A.gen) A.runAll();
        // one full growth (B, the branching street net), quietly, timed
        if (A.resetFloodX) A.resetFloodX(); const t = performance.now(); A.quietRun({}); const floodX = A.floodX; const growMs = performance.now() - t;
        try { A.measures && A.measures(); } catch (e) {}
        const score = A.scoreRun(), RN = A.roadNet();
        const live = A.lines.filter(l => !l.dead && l.pts.length > 1);
        const lvl = {}; for (const l of live){ lvl[l.level] = (lvl[l.level] || 0) + 1; }
        // main street directions: the dominant grid axis (length weighted, folded to 90°) for the boundary test
        let c = 0, s_ = 0; for (const l of live){ if (l.level !== 1) continue; const P = l.pts; for (let k = 1; k < P.length; k++){ const dx = P[k][0] - P[k - 1][0], dy = P[k][1] - P[k - 1][1], L = Math.hypot(dx, dy), th = Math.atan2(dy, dx); c += L * Math.cos(4 * th); s_ += L * Math.sin(4 * th); } }
        const gridAxis = ((Math.atan2(s_, c) / 4) * 180 / Math.PI + 90) % 90, gridStrength = Math.hypot(c, s_) / (live.filter(l => l.level === 1).reduce((a, l) => a + l.pts.reduce((b, p, k) => k ? b + Math.hypot(p[0] - l.pts[k - 1][0], p[1] - l.pts[k - 1][1]) : 0, 0), 0) || 1);
        // the boundary test: the streets' dominant grid axis in the inner circle the straight and the turned square share
        const geo = T.geo, ring = T.D.site && T.D.site.ring, [OX, OY] = T.D.origin;
        let inner = null; if (ring){ const pts = ring.slice(0, -1).map(p => { const q = geo.wgs84ToBNG(p[0], p[1]); return [q[0] - OX, q[1] - OY]; });
          const cx = pts.reduce((a, p) => a + p[0], 0) / pts.length, cy = pts.reduce((a, p) => a + p[1], 0) / pts.length, rad = 0.35 * (m.sideM || 1000) / Math.SQRT2 * Math.SQRT2;
          const acc = { 1: [0, 0, 0], 2: [0, 0, 0] };
          for (const l of live){ const lv = l.level === 1 ? 1 : l.level >= 2 ? 2 : 0; if (!lv) continue; const P = l.pts;
            for (let k = 1; k < P.length; k++){ const mx = (P[k][0] + P[k - 1][0]) / 2, my = (P[k][1] + P[k - 1][1]) / 2; if (Math.hypot(mx - cx, my - cy) > rad) continue;
              const dx = P[k][0] - P[k - 1][0], dy = P[k][1] - P[k - 1][1], L = Math.hypot(dx, dy), th = Math.atan2(dy, dx); acc[lv][0] += L * Math.cos(4 * th); acc[lv][1] += L * Math.sin(4 * th); acc[lv][2] += L; } }
          const ax = a => ({ axis: +((((Math.atan2(a[1], a[0]) / 4) * 180 / Math.PI) % 90 + 90) % 90).toFixed(1), strength: +(Math.hypot(a[0], a[1]) / (a[2] || 1)).toFixed(2), km: +(a[2] / 1000).toFixed(2) });
          inner = { main: ax(acc[1]), sec: ax(acc[2]), all: ax([acc[1][0] + acc[2][0], acc[1][1] + acc[2][1], acc[1][2] + acc[2][2]]) }; }
        // the field itself in the inner circle (British National Grid points, 40 m apart), for the boundary test
        let field = null; if (ring && typeof fieldAtT === 'function'){ const pts = ring.slice(0, -1).map(p => geo.wgs84ToBNG(p[0], p[1])), E0 = pts.reduce((a, p) => a + p[0], 0) / pts.length, N0 = pts.reduce((a, p) => a + p[1], 0) / pts.length; field = [];
          for (let dx = -400; dx <= 400; dx += 40) for (let dy = -400; dy <= 400; dy += 40){ if (Math.hypot(dx, dy) > 400) continue; const E = Math.round(E0 + dx), Nn = Math.round(N0 + dy), t = fieldAtT(E - OX, Nn - OY); if (t != null) field.push([E, Nn, +t.toFixed(4)]); } }
        return { floodX, field, proto: { spacing: window.__PROTO_SPACING || null, buildings: window.parent.__PROTO_BLD || window.__PROTO_BLD || null, contextDensity: T.D.site && T.D.site.contextDensity }, inner, site: { areaHa: m.areaHa ?? T.D.site?.areaHa, sideM: m.sideM, pieces: m.pieces, holes: m.holes, anchors: m.anchors ?? T.D.anchors?.length, buildings: m.buildings, roads: m.roads, waterways: m.waterways, rails: m.rails, contours: m.contours, elevation: m.elevation ?? T.D.site?.elevation, meanSlopePct: T.D.site?.meanSlopePct, warnings: m.warnings || [] },
          landHa: A.landHa(), flood: !!T.D.flood, growMs: Math.round(growMs), lines: lvl, net: RN && RN.stats, score: { total: score.total, groups: score.groups, raw: score.raw, fail: score.fail }, gridAxis: +gridAxis.toFixed(1), gridStrength: +gridStrength.toFixed(2) }; }));
      await frame.evaluate(() => { const A = window.__ts6; A.setModeQuiet('B'); A.start(false); });
      await page.waitForTimeout(1500);
      await page.screenshot({ path: new URL(`${r.id}-keep${r.keep}.png`, OUT).pathname });
    }
  } catch (e){ res.error = String(e.message || e); }
  res.errors = [...new Set(errs)].slice(0, 6); res.wallMs = Date.now() - t0;
  console.log(JSON.stringify({ id: res.id, keep: res.keep, open: res.tOpenMs, grow: res.growMs, lines: res.lines, err: res.error }));
  results.push(res); fs.writeFileSync(new URL('results.json', OUT), JSON.stringify(results, null, 1));
  await Promise.race([page.close(), new Promise(r => setTimeout(r, 5000))]);
}
await browser.close();
