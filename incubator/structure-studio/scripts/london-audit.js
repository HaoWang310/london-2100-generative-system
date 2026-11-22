// 结构工作室 · 伦敦全域检查（v0.9.32）
// 用法：在线上 google-map-live 页面（https://haowang310.github.io/london-2100-generative-system/incubator/google-map-live/）的控制台里粘贴运行；
// 结果在 window.__AUDIT.res（每块地 7 组参数），进度在 window.__AUDIT.log，全部跑完 window.__AUDIT.done = true（约 12 分钟）。
// 每块地按真实流程：伦敦地图（OSM 街道、水面、大建筑、OS Terrain 50）→ 张量场工作室生成路网 → 结构工作室第 2–6 步，记录：
//   badPlates（节点板外圈打结）、wedge23（三层坡顶收尖没做成曲线）、joinMoved、塔座 hangIn / hangOut（板边沿法向外 4 m 下面没有板，
//   分红线内 / 外）、outA（塔座铺到红线外的面积）、feetOut（塔脚出红线）、clash（塔片穿走廊板）、footClear（塔脚离 L3 边）等。
// 场地：19 块（河边、码头、市中心、城郊、农田、公园边、19 ha 小地块、384 ha 大地块、细长地块），可改 window.__SITES。
window.__SITES = [{"name":"Barking Riverside","ring":[[0.109887,51.514005],[0.128369,51.516033],[0.126113,51.523995],[0.107631,51.521967],[0.109887,51.514005]]},{"name":"Nine Elms","ring":[[-0.140928,51.478751],[-0.124208,51.475961],[-0.121072,51.483249],[-0.137792,51.486039],[-0.140928,51.478751]]},{"name":"Stratford","ring":[[-0.004825,51.54338],[-0.009918,51.547694],[-0.01751,51.545174],[-0.020969,51.540274],[-0.013665,51.537445],[-0.005113,51.538032],[-0.004825,51.54338]]},{"name":"Soho","ring":[[-0.140496,51.509586],[-0.127504,51.509586],[-0.127504,51.516414],[-0.140496,51.516414],[-0.140496,51.509586]]},{"name":"Isle of Dogs","ring":[[-0.024936,51.49161],[-0.009064,51.49161],[-0.009064,51.50239],[-0.024936,51.50239],[-0.024936,51.49161]]},{"name":"Hampstead Heath","ring":[[-0.156374,51.563274],[-0.161078,51.567256],[-0.168088,51.56493],[-0.171283,51.560407],[-0.164538,51.557795],[-0.15664,51.558337],[-0.156374,51.563274]]},{"name":"Croydon","ring":[[-0.104653,51.367936],[-0.088425,51.371623],[-0.093347,51.380064],[-0.109575,51.376377],[-0.104653,51.367936]]},{"name":"Wembley","ring":[[-0.290669,51.551958],[-0.273331,51.551958],[-0.273331,51.560042],[-0.290669,51.560042],[-0.290669,51.551958]]},{"name":"Greenwich Peninsula","ring":[[0.012838,51.500317],[0.007984,51.504431],[0.000749,51.502028],[-0.002547,51.497354],[0.004413,51.494655],[0.012563,51.495215],[0.012838,51.500317]]},{"name":"Thamesmead","ring":[[0.107509,51.499591],[0.125985,51.497563],[0.128491,51.506409],[0.110015,51.508437],[0.107509,51.499591]]},{"name":"Old Oak","ring":[[-0.254566,51.523872],[-0.234428,51.524968],[-0.235434,51.532128],[-0.255572,51.531032],[-0.254566,51.523872]]},{"name":"Richmond Park edge","ring":[[-0.295928,51.443958],[-0.280072,51.443958],[-0.280072,51.452042],[-0.295928,51.452042],[-0.295928,51.443958]]},{"name":"City of London","ring":[[-0.096217,51.510407],[-0.081783,51.510407],[-0.081783,51.517593],[-0.096217,51.517593],[-0.096217,51.510407]]},{"name":"Harmondsworth fields","ring":[[-0.490099,51.485508],[-0.469901,51.485508],[-0.469901,51.494492],[-0.490099,51.494492],[-0.490099,51.485508]]},{"name":"Walthamstow Wetlands","ring":[[-0.058674,51.580508],[-0.041326,51.580508],[-0.041326,51.589492],[-0.058674,51.589492],[-0.058674,51.580508]]},{"name":"Royal Docks","ring":[[0.019897,51.502958],[0.040103,51.502958],[0.040103,51.511042],[0.019897,51.511042],[0.019897,51.502958]]},{"name":"Kentish Town small","ring":[[-0.143612,51.548203],[-0.136388,51.548203],[-0.136388,51.551797],[-0.143612,51.551797],[-0.143612,51.548203]]},{"name":"Lewisham large","ring":[[-0.027859,51.451915],[0.003859,51.451915],[0.003859,51.468085],[-0.027859,51.468085],[-0.027859,51.451915]]},{"name":"Rail corridor thin","ring":[[-0.204608,51.528979],[-0.173195,51.53809],[-0.175392,51.541021],[-0.206805,51.53191],[-0.204608,51.528979]]}];
// London-wide audit harness: runs inside the live google-map-live page (same origin as tensor-studio and structure-studio).
// For each site: build Tensor Studio's site from the real map (OSM streets, water, buildings, OS Terrain 50), let it grow,
// take the snapshot structure-studio would take, then run the structure + deck + tower-base rules and record checks.
window.__AUDIT = { done: false, log: [], res: [] }; window.__SNAPS = {};
(async () => {
  const A = window.__AUDIT, say = t => { A.log.push(new Date().toISOString().slice(11, 19) + ' ' + t); };
  try {
    const mc = await import('./scripts/map_core.js?v=3.43.6-english');
    const ts = await import('./scripts/tensor_studio_site.js?v=3.43.6-english');
    // 引擎来源：默认用线上 structure-studio；window.__AUDIT_ENGINE 可指向别的目录（例如某个分支的 raw.githubusercontent.com 地址，未合并前先测）
    const base = window.__AUDIT_ENGINE || '../structure-studio/engine/', v = '?t=' + Date.now();
    const load = async src => { const code = await fetch(src).then(r => { if (!r.ok) throw new Error(src + ' ' + r.status); return r.text(); }); (0, eval)(code); };
    if (!window.SS || window.__AUDIT_ENGINE) { for (const f of ['structure', 'deck', 'tower']) await load(base + f + '.js' + v); }
    const SS = window.SS, TW = SS.tower, J = await fetch(base + '../assets/tower-model.json').then(r => r.json());
    const SH = J.towers.map(w => { const b = atob(w.mesh.v), u = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return new Int16Array(u.buffer); });
    let maplibregl; try { maplibregl = await import('https://unpkg.com/maplibre-gl@6.13.0/dist/maplibre-gl.mjs'); } catch (e) { maplibregl = await import('https://cdn.jsdelivr.net/npm/maplibre-gl@6.13.0/dist/maplibre-gl.mjs'); } if (maplibregl.default && !maplibregl.Map) maplibregl = maplibregl.default;
    const div = document.createElement('div'); div.style.cssText = 'position:fixed;left:0;top:0;width:1100px;height:900px;z-index:-5;opacity:0;pointer-events:none'; document.body.append(div);
    const map = new maplibregl.Map({ container: div, style: 'https://tiles.openfreemap.org/styles/liberty', center: [-0.1, 51.5], zoom: 13, attributionControl: false });
    await new Promise(r => map.once('load', r)); say('map ready');
    const oldFlow = localStorage.getItem('tensorStudio.flowMode'); localStorage.setItem('tensorStudio.flowMode', 'free');
    const snapshotFrom = (win, step = 10) => { const T = win.__ts6, R = T && T.roadNet(); if (!R) return null;
      const D = T.D, r1 = v => Math.round(v * 10) / 10, Pp = pts => pts.map(q => [r1(q[0]), r1(q[1])]), fa = win.fieldAtT;
      const nx = Math.ceil(D.w / step) + 1, ny = Math.ceil(D.h / step) + 1, f = new Uint8Array(nx * ny);
      for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) { const a = typeof fa === 'function' ? fa(i * step, j * step) : null; f[j * nx + i] = a == null ? 255 : Math.round((((a % Math.PI) + Math.PI) % Math.PI) / Math.PI * 254); }
      let bin = ''; for (let i = 0; i < f.length; i++) bin += String.fromCharCode(f[i]);
      return { format: 'structure-studio/snapshot@1', source: 'tensor-studio', site: 'london-site', origin: D.origin, w: D.w, h: D.h,
        pieces: D.pieces.map(pc => ({ outer: Pp(pc.outer), holes: (pc.holes || []).map(Pp) })), water: (D.ctx.water || []).map(w => w.map(Pp)), streams: (D.ctx.streams || []).map(Pp),
        attractors: T.attr.map(a => ({ x: a.x, y: a.y, kind: a.kind, reach: a.kind === 'main' ? 230 : a.kind === 'edge' ? 340 : 140, pull: +((win.document.getElementById('pull') || {}).value || 2.4) })),
        roads: R.streets.map(st => ({ id: st.id, grade: st.grade, level: st.level, width: st.width, pts: Pp(st.pts) })), junctions: R.junctions.map(j => ({ x: r1(j.x), y: r1(j.y), type: j.type })), stats: R.stats,
        field: { step, nx, ny, enc: 'u8 angle*254/pi, 255 = none', data: btoa(bin) }, context: { bld: (D.ctx.bld || []).map(r => r.map(Pp)), lanes: (D.ctx.lanes || []).map(Pp), prim: (D.ctx.prim || []).map(Pp), urban: (D.ctx.urban || []).map(r => r.map(Pp)) } }; };
    const P0 = { mode: 'v0', v1: 0, wCore: 24, seed: 3, nPrim: 1, primAng: 30, primFollow: 0.08, primSmooth: 240, primStraight: 0.6, primShift: 140, offRoad: 1, rotF: 0, coreR: 700, sCore: 95, sOut: 260, pull: 0.5, wS: 15, wP: 20, blendK: 1, minThick: 40, colStep: 45, avoidWater: false, deckZ: 7.2, setback: 6, depth: 18, segL: 52, gap: 11 };
    const check = (snap, P) => { const out = {}, t0 = performance.now();
      const site = SS.prepareSite(snap), F = SS.buildStructure(site, P, new Set()), D = SS.deck.buildDeck(F, SS.deck.DEF), dm = SS.deck.deckMesh(D, 1);
      out.ms = Math.round(performance.now() - t0); out.landHa = +site.landHa.toFixed(1); out.cores = site.cores.length; out.attrMain = snap.attractors.filter(a => a.kind === 'main').length; out.roads = snap.roads.length;
      out.corridorsKm = +((F.stats && F.stats.lenKm) || (D.stats.lenKm) || 0).toFixed ? +(D.stats.lenKm || 0).toFixed(2) : 0; out.rooms = (F.cellPolys || []).length; out.towers = F.towers.length; out.plazas = (F.plazas || []).length;
      out.entries = D.stats.entries; out.r12 = D.stats.r12; out.l3nodes = D.stats.l3nodes; out.badPlates = D.stats.badPlates; out.plateHull = D.stats.plateHull || 0; out.dupes = D.stats.dupes || 0; out.steep = D.stats.steep; out.joinMoved = D.stats.tips.joinMoved || 0;
      const cv = D.stats.tips.curves || []; out.wedge23 = cv.filter(c => c.kind === '23' && c.tag === 'tl' && c.T < 2).length; out.tapers = cv.length;
      out.towerZ = F.towers.map(t => t[7]); out.nanV = 0; for (const v of dm.top) if (!Number.isFinite(v)) { out.nanV++; break; }
      const G = new Map(), C = 6; for (let q = 0; q < dm.top.length; q += 9) { const xs = [dm.top[q], dm.top[q + 3], dm.top[q + 6]], ys = [dm.top[q + 1], dm.top[q + 4], dm.top[q + 7]];
        for (let x = Math.floor(Math.min(...xs) / C); x <= Math.floor(Math.max(...xs) / C); x++) for (let y = Math.floor(Math.min(...ys) / C); y <= Math.floor(Math.max(...ys) / C); y++) { const k = x + ',' + y; if (!G.has(k)) G.set(k, []); G.get(k).push(q); } }
      const tris = (x, y) => G.get(Math.floor(x / C) + ',' + Math.floor(y / C)) || [], inTri = (p, q) => TW.inPoly(p, [[dm.top[q], dm.top[q + 1]], [dm.top[q + 3], dm.top[q + 4]], [dm.top[q + 6], dm.top[q + 7]]]);
      const zTop = (x, y) => { let z = -1; for (const q of tris(x, y)) { const a = dm.top, d = (a[q + 4] - a[q + 7]) * (a[q] - a[q + 6]) + (a[q + 6] - a[q + 3]) * (a[q + 1] - a[q + 7]); if (!d) continue;
        const u = ((a[q + 4] - a[q + 7]) * (x - a[q + 6]) + (a[q + 6] - a[q + 3]) * (y - a[q + 7])) / d, v = ((a[q + 7] - a[q + 1]) * (x - a[q + 6]) + (a[q] - a[q + 6]) * (y - a[q + 7])) / d, w = 1 - u - v; if (u < -1e-6 || v < -1e-6 || w < -1e-6) continue; z = Math.max(z, u * a[q + 2] + v * a[q + 5] + w * a[q + 8]); } return z; };
      out.bases = (F.plazas || []).map(z => { const T = SS.plazaTiers(z, site), g = T.grid; let hangOut = 0, hangIn = 0, n = 0, clash = 0, area = 0;
        for (let i = 0; i < z.poly.length; i++) { const a = z.poly[i], b = z.poly[(i + 1) % z.poly.length]; area += a[0] * b[1] - b[0] * a[1]; } const sg = area > 0 ? 1 : -1;
        for (let i = 0; i < z.poly.length; i++) { const a = z.poly[i], b = z.poly[(i + 1) % z.poly.length], L = Math.hypot(b[0] - a[0], b[1] - a[1]); if (L < 1e-6) continue; const nx = sg * (b[1] - a[1]) / L, ny = -sg * (b[0] - a[0]) / L;
          for (let s = 0; s < L; s++) { const p = [a[0] + (b[0] - a[0]) * s / L, a[1] + (b[1] - a[1]) * s / L], o = [p[0] + nx * 4, p[1] + ny * 4], q = [p[0] - nx * 1.5, p[1] - ny * 1.5];
            const gi = Math.floor((q[0] - g.x0) / g.res), gj = Math.floor((q[1] - g.y0) / g.res), lv = T.levels.reduce((m, L_, li) => L_.mask[gj * g.W + gi] ? li + 1 : m, 0); if (!lv) continue; n++; if (zTop(o[0], o[1]) < [0, 7.2, 11.8, 16.4][lv] - 0.3) { if (site.inSite(o)) hangIn++; else hangOut++; } } }
        const f = TW.xf(F.towers[z.ti], -1); for (const v of SH) for (let i = 0; i < v.length; i += 3 * 11) { const p = f(v[i] / 100, v[i + 1] / 100, v[i + 2] / 100); if (p[2] > 30) continue;
          for (const q of tris(p[0], p[1])) { const a = dm.top, zt = Math.max(a[q + 2], a[q + 5], a[q + 8]), zb = Math.min(a[q + 2], a[q + 5], a[q + 8]) - 1; if (p[2] < zb + 0.05 || p[2] > zt - 0.05) continue; if (inTri(p, q)) { clash++; break; } } }
        let outA = 0; for (const L_ of T.levels) for (let j = 0; j < g.H; j++) for (let i = 0; i < g.W; i++) if (L_.mask[j * g.W + i] && !site.inSite([g.x0 + (i + 0.5) * g.res, g.y0 + (j + 0.5) * g.res])) outA += g.res * g.res;   // 塔座铺到红线外的面积（m²，三层合计；栅格 2 m 的红线 → 允许 ~1 m 的锯齿）
        let feetOut = 0; for (const fp of SS.towerFeet(F.towers[z.ti])) for (const p of fp) if (!site.inSite(p)) feetOut++;
        return { ok: z.ok, footClear: +T.footClear.toFixed(1), arcs: T.arcs.length, areas: T.levels.map(L => +(L.area / 1e4).toFixed(2)), ringN: n, hangOut, hangIn, outA: Math.round(outA), clash, feetOut, ringExtra: (F.ringExtra && F.ringExtra[z.ti]) || 0 }; });
      return out; };
    for (const S of window.__SITES) {
      const r = { name: S.name }; A.res.push(r); say('site ' + S.name);
      try {
        const t0 = performance.now();
        await ts.openTensorStudio({ map, polygon: [S.ring], assetUrl: p => p + '?v=3.43.6-english', demBounds: mc.DRAINAGE_3857, demWidth: mc.DRAINAGE_3857.baseWidth50m, demHeight: mc.DRAINAGE_3857.baseHeight50m, say: (m, e) => say('ts say ' + m) });
        let win = null, snap = null;
        for (let k = 0; k < 400 && !snap; k++) { await new Promise(res => setTimeout(res, 500)); const fr = document.querySelector('#tensorStudioOverlay iframe'); win = fr && fr.contentWindow; try { if (win && win.__ts6 && win.__ts6.roadNet()) snap = snapshotFrom(win); } catch (e) { } if (!document.querySelector('#tensorStudioOverlay')) break; }
        r.tsMs = Math.round(performance.now() - t0);
        if (!snap) { r.error = 'tensor studio gave no road network' + (win && win.document ? ' · hud: ' + ((win.document.getElementById('hud') || {}).textContent || '') : ''); ts.closeTensorStudio(); continue; }
        r.tsRoads = snap.roads.length; r.tsMain = snap.attractors.filter(a => a.kind === 'main').length; r.w = Math.round(snap.w); r.h = Math.round(snap.h);
        window.__SNAPS = window.__SNAPS || {}; window.__SNAPS[S.name] = snap;
        ts.closeTensorStudio(); await new Promise(res => setTimeout(res, 300));
        const PU = { ...P0, nPrim: 2, coreR: 1100, sCore: 170, sOut: 160, pull: 1, wS: 21, wP: 28, blendK: 1.45, minThick: 24, colStep: 60, setback: 8 };
        for (const [lab, P] of [['default', P0], ['seed7', { ...P0, seed: 7 }], ['pull2', { ...P0, pull: 2 }], ['user', PU], ['v1', { ...P0, mode: 'v1', v1: 1 }], ['vein', { ...P0, mode: 'vein' }], ['pull1', { ...P0, pull: 1 }]]) { try { r[lab] = check(snap, P); } catch (e) { r[lab] = { error: String(e && e.stack || e).slice(0, 300) }; } await new Promise(res => setTimeout(res, 50)); }
      } catch (e) { r.error = String(e && e.stack || e).slice(0, 300); try { ts.closeTensorStudio(); } catch (e2) { } }
    }
    if (oldFlow === null) localStorage.removeItem('tensorStudio.flowMode'); else localStorage.setItem('tensorStudio.flowMode', oldFlow);
    map.remove(); div.remove();
  } catch (e) { A.fatal = String(e && e.stack || e).slice(0, 500); }
  A.done = true; say('done');
})();
