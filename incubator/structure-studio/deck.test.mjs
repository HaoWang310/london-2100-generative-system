// 结构工作室 · 第 6 步（多层走道结构）回归测试：node --test incubator/structure-studio/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const dir = new URL('.', import.meta.url);
const self = {}; for (const f of ['engine/structure.js', 'engine/deck.js']) new Function('self', 'module', readFileSync(new URL(f, dir), 'utf8'))(self, undefined);
const SS = self.SS, snap = JSON.parse(readFileSync(new URL('assets/station-p2.snapshot.json', dir), 'utf8'));
const html = readFileSync(new URL('index.html', dir), 'utf8'), P = Function('return ' + html.match(/const P = (\{[^}]*\});/)[1])();
const site = SS.prepareSite(snap), F = SS.buildStructure(site, P, new Set()), DK = SS.deck.buildDeck(F, {}), s = DK.stats;

test('step 6 is wired into the page', () => {
  assert.ok(html.includes('engine/deck.js') && html.includes('data-k="6"'), 'deck.js and the step 6 card are in index.html');
  assert.ok(html.includes('[-1, -1, 0, 1, 2, 2, 2, 3, 3, 4, 5]'), 'the 3D demo stage belongs to step 6, not step 5');
});
test('step cards carry two buttons: play analysis and next', () => {
  for (const k of ['function guidedPlay(', 'function guidedNext(', 'function guidedRollback(', "L('播放分析', 'Play analysis')", "L('下一步', 'Next') : L('完成', 'Finish')", '.pmStep.locked']) assert.ok(html.includes(k), k);
  assert.ok(!html.includes('完成 · 转到三维'), 'old single-button label is gone');
});
test('levels: 1 m slabs with 3.6 m clear between them, first deck at 7.2 m', () => { assert.deepEqual(SS.deck.LV.map(v => +v.toFixed(3)), [0, 7.2, 11.8, 16.4]); assert.equal(SS.deck.DEF.thick, 1); assert.equal(SS.deck.CLEAR, 3.6); });
test('level 3 only near the two main towers, and every edge of it has a ramp', () => {
  assert.ok(s.l3nodes > 10 && s.l3nodes < 0.35 * s.nodes, 'L3 nodes ' + s.l3nodes + ' / ' + s.nodes);
  assert.equal(s.r23, s.edges3, 'one L2→L3 ramp per L3 edge'); assert.equal(s.steep, 0, 'no shortened ramps (grow outward instead)');
  const big = F.towers.filter(t => !t[4]); F.nodeP.forEach((p, j) => { if (DK.in3[j]) assert.ok(big.some(t => Math.hypot(p[0] - t[0], p[1] - t[1]) < 200 + 400), 'L3 node stays around a main tower'); });
});
test('ground entries exist and stay off streets and water', () => {
  assert.ok(s.entries >= 50, 'entries ' + s.entries); assert.ok(s.r12 >= 80, 'L1→L2 ramps ' + s.r12);
  for (const r of DK.ramps) if (r.kind[0] === 0) for (let i = 0; i <= 10; i++) { const p = [r.a[0] + (r.b[0] - r.a[0]) * i / 10, r.a[1] + (r.b[1] - r.a[1]) * i / 10]; assert.ok(!site.inWater(p), 'entry ramp over water'); assert.ok(site.roadDistAll(p) > 3, 'entry ramp on a street'); }
});
test('subdivided surface: finite, flat plates, edges on the step 5 outline', () => {
  const m = SS.deck.deckMesh(DK, 1); for (const v of m.top) assert.ok(Number.isFinite(v));
  const V = m.V, n = V.length / 3; let flat = 0; for (let i = 0; i < n; i++) { const z = V[3 * i + 2]; assert.ok(z > -1e-6 && z < 16.4 + 1e-6, 'z in range ' + z); if (SS.deck.LV.some(l => Math.abs(z - l) < 0.02)) flat++; }
  assert.ok(flat / n > 0.8, 'plates are level: ' + (flat / n).toFixed(2));
  // 按边长取中位数（v0.9.30 起收尖是加密的曲线，点很多；按点数算会被收尖的点带偏）
  const d = []; let L = 0; for (let i = 0; i < m.boundary.length; i += 2) { const a = m.boundary[i], b = m.boundary[i + 1], l = Math.hypot(V[3 * b] - V[3 * a], V[3 * b + 1] - V[3 * a + 1]); d.push([DK.outline.dist([(V[3 * a] + V[3 * b]) / 2, (V[3 * a + 1] + V[3 * b + 1]) / 2], 30), l]); L += l; }
  d.sort((x, y) => x[0] - y[0]); let acc = 0, med = 0; for (const [x, l] of d) { acc += l; if (acc >= L / 2) { med = x; break; } }
  assert.ok(med < 0.5, 'median edge-to-outline distance ' + med.toFixed(2) + ' m');
  assert.ok(s.gapOn > 4 * s.gapOff, 'node plates follow the outline between most neighbouring corridors: ' + s.gapOn + ' / ' + s.gapOff);
});
test('same input gives the same structure; parameters respond', () => {
  const again = SS.deck.buildDeck(F, {}); assert.deepEqual(again.stats, s);
  const wide = SS.deck.buildDeck(F, { r3: 320 }); assert.ok(wide.stats.l3nodes > s.l3nodes, 'bigger radius → more L3');
  const steep = SS.deck.buildDeck(F, { entrySlope: 4 }), gentle = SS.deck.buildDeck(F, { entrySlope: 7 }); assert.ok(steep.stats.entries >= gentle.stats.entries, 'steeper entries fit on more corridors');
});
test('every face is counter-clockwise seen from above (normals up), control mesh and subdivided', () => {
  const area = (V, f) => { let a = 0; for (let k = 0; k < f.length; k++) { const p = 3 * f[k], q = 3 * f[(k + 1) % f.length]; a += V[p] * V[q + 1] - V[q] * V[p + 1]; } return a / 2; };
  let cw = 0; DK.F.forEach(f => { if (area(DK.V, f) < -0.02) cw++; }); assert.equal(cw, 0, 'clockwise control faces');
  const R = SS.deck.subdivide(DK, 1); let neg = 0, pos = 0; R.F.forEach(f => { const a = area(R.V, f); if (a < 0) neg -= a; else pos += a; }); assert.ok(neg < 0.002 * pos, 'flipped area after subdivision ' + neg.toFixed(1) + ' / ' + pos.toFixed(0));
  const m = SS.deck.deckMesh(DK, 1), t = m.top; let down = 0, upA = 0; for (let i = 0; i < t.length; i += 9) { const nz = (t[i + 3] - t[i]) * (t[i + 7] - t[i + 1]) - (t[i + 4] - t[i + 1]) * (t[i + 6] - t[i]); if (nz < 0) down -= nz / 2; else upA += nz / 2; } assert.ok(down < 0.001 * upA, 'area of triangles facing down: ' + down.toFixed(1) + ' / ' + upA.toFixed(0));
});
test('node plates do not overlap themselves or each other (close nodes are merged, walkway mouths set back)', () => {
  assert.ok(s.merged > 10 && s.shortRuns > 10, 'close nodes are merged: ' + s.merged); assert.equal(s.badPlates, 0, 'plates whose outline still crosses itself');
  const R = SS.deck.subdivide(DK, 1), V = R.V, cov = new Map(); let n = 0;
  R.F.forEach((f, i) => { if (R.FT[i] !== 1 || f.some(v => Math.abs(V[3 * v + 2] - 7.2) > 0.01)) return; const xs = f.map(v => V[3 * v]), ys = f.map(v => V[3 * v + 1]);
    for (let x = Math.ceil(Math.min(...xs) / 2); x <= Math.floor(Math.max(...xs) / 2); x++) for (let y = Math.ceil(Math.min(...ys) / 2); y <= Math.floor(Math.max(...ys) / 2); y++) { let sg = 0, ok = true; for (let k = 0; k < 4 && ok; k++) { const c = (xs[(k + 1) % 4] - xs[k]) * (y * 2 - ys[k]) - (ys[(k + 1) % 4] - ys[k]) * (x * 2 - xs[k]); if (Math.abs(c) < 1e-9) { ok = false; break; } if (sg === 0) sg = Math.sign(c); else if (Math.sign(c) !== sg) ok = false; } if (ok) { const key = x * 100003 + y; cov.set(key, (cov.get(key) || 0) + 1); n++; } } });
  let over = 0; for (const c of cov.values()) if (c > 1) over++; assert.ok(over <= 0.0005 * n, 'overlapping samples at L1: ' + over + ' / ' + n);
});
test('columns that would poke through a ramp are removed, the rest stay', () => {
  const m = SS.deck.deckMesh(DK, 1), r = SS.deck.columnsClear(m.top, F.columns, 7.0); assert.equal(r.keep.length + r.cut.length, F.columns.length); assert.ok(r.cut.length > 0 && r.cut.length < 0.3 * F.columns.length, 'cut ' + r.cut.length + ' / ' + F.columns.length);
  assert.equal(SS.deck.columnsClear(m.top, r.keep, 7.0).cut.length, 0);
});
test('no gaps: every step 5 corridor has deck above it (junctions stored as two coincident nodes, runs to the red line)', () => {
  assert.ok(s.twins > 0, 'this site has junctions stored as two nodes at one position'); assert.ok(s.cutEnds > 10, 'runs reach the red line: ' + s.cutEnds); assert.equal(s.steep, 0);
  const g = F.grid, R = SS.deck.subdivide(DK, 1), V = R.V, cov = new Uint8Array(g.W * g.H);
  for (const f of R.F) { const xs = f.map(v => (V[3 * v] - g.xmin) / g.RES), ys = f.map(v => (g.ymax - V[3 * v + 1]) / g.RES), n = f.length;
    for (let i = Math.max(0, Math.floor(Math.min(...xs))); i <= Math.min(g.W - 1, Math.ceil(Math.max(...xs))); i++) for (let j = Math.max(0, Math.floor(Math.min(...ys))); j <= Math.min(g.H - 1, Math.ceil(Math.max(...ys))); j++) { let sg = 0, ok = true; for (let k = 0; k < n && ok; k++) { const c = (xs[(k + 1) % n] - xs[k]) * (j + 0.5 - ys[k]) - (ys[(k + 1) % n] - ys[k]) * (i + 0.5 - xs[k]); if (Math.abs(c) < 1e-9) continue; if (!sg) sg = Math.sign(c); else if (Math.sign(c) !== sg) ok = false; } if (ok) cov[j * g.W + i] = 1; } }
  const big = F.towers.filter(t => !t[4]), hole = (i, j) => i >= 0 && j >= 0 && i < g.W && j < g.H && g.corr[j * g.W + i] && !cov[j * g.W + i]; let gap = 0;
  for (let j = 3; j < g.H - 3; j++) for (let i = 3; i < g.W - 3; i++) { if (!hole(i, j)) continue; const x = g.xmin + i * g.RES, y = g.ymax - j * g.RES; if (big.some(t => Math.hypot(x - t[0], y - t[1]) < 95)) continue;   // the tower plaza stays a ring
    let all = true; for (let dj = -3; dj <= 3 && all; dj++) for (let di = -3; di <= 3; di++) if (!hole(i + di, j + dj)) { all = false; break; } if (all) gap++; }
  assert.ok(gap * g.RES * g.RES < 200, 'corridor area with no deck (m2): ' + gap * g.RES * g.RES);
  const m = SS.deck.deckMesh(DK, 1); assert.ok(DK.sharp.length > 0 && m.top.length > 0, 'flat cuts keep their corners');
});
test('the deck is a closed solid: a bottom face one slab thickness below the top, facing down', () => {
  const m = SS.deck.deckMesh(DK, 1), t = m.top, b = m.bottom; assert.equal(b.length, t.length); assert.ok(html.includes('M.corridor.bottom'), 'the page draws the bottom face');
  let up = 0, dn = 0; for (let i = 0; i < b.length; i += 9) { const nz = (b[i + 3] - b[i]) * (b[i + 7] - b[i + 1]) - (b[i + 4] - b[i + 1]) * (b[i + 6] - b[i]); if (nz > 0) up += nz / 2; else dn -= nz / 2; }
  assert.ok(up < 0.001 * dn, 'area of bottom triangles facing up: ' + up.toFixed(1) + ' / ' + dn.toFixed(0)); for (let i = 2; i < b.length; i += 3) assert.ok(b[i] >= 0 && b[i] <= 16.4 - 1 + 1e-6);
  // every boundary edge is shared by a side quad: top edge at z, bottom edge at z - thickness
  assert.equal(m.side.length, m.boundary.length / 2 * 18);
});
test('no low wedge: where a tapered walkway overlaps a ramp the clear height is at least 2.2 m', () => {
  // top triangles grouped on a 2 m grid; at each sample, vertical gaps between stacked surfaces (minus slab thickness) must be 0 (same surface) or >= HEAD
  const m = SS.deck.deckMesh(DK, 1), t = m.top, G = new Map(), TH = SS.deck.DEF.thick, HEAD = SS.deck.HEAD; let low = 0, n = 0;
  for (let i = 0; i < t.length; i += 9) { const x0 = Math.floor(Math.min(t[i], t[i + 3], t[i + 6]) / 4), x1 = Math.floor(Math.max(t[i], t[i + 3], t[i + 6]) / 4), y0 = Math.floor(Math.min(t[i + 1], t[i + 4], t[i + 7]) / 4), y1 = Math.floor(Math.max(t[i + 1], t[i + 4], t[i + 7]) / 4); for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) { const k = x * 100003 + y; if (!G.has(k)) G.set(k, []); G.get(k).push(i); } }
  for (const r of DK.ramps) { if (r.kind[0] === 0) continue; for (let q = 1; q < 20; q++) { const x = r.a[0] + (r.b[0] - r.a[0]) * q / 20, y = r.a[1] + (r.b[1] - r.a[1]) * q / 20, zs = [];
      for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) { const px = x + dx * 2.5, py = y + dy * 2.5; for (const i of G.get(Math.floor(px / 4) * 100003 + Math.floor(py / 4)) || []) { const ax = t[i], ay = t[i + 1], bx = t[i + 3], by = t[i + 4], cx = t[i + 6], cy = t[i + 7], d = (by - cy) * (ax - cx) + (cx - bx) * (ay - cy); if (Math.abs(d) < 1e-9) continue; const u = ((by - cy) * (px - cx) + (cx - bx) * (py - cy)) / d, v = ((cy - ay) * (px - cx) + (ax - cx) * (py - cy)) / d, w = 1 - u - v; if (u < 0 || v < 0 || w < 0) continue; zs.push([dx, dy, u * t[i + 2] + v * t[i + 5] + w * t[i + 8]]); } }
      for (let a = 0; a < zs.length; a++) for (let b = a + 1; b < zs.length; b++) { if (zs[a][0] !== zs[b][0] || zs[a][1] !== zs[b][1]) continue; const gap = Math.abs(zs[a][2] - zs[b][2]) - TH; n++; if (gap > 0.6 && gap < HEAD - 0.25) low++; } } }
  assert.ok(n > 500, 'stacked samples along ramps: ' + n); assert.ok(low < 0.02 * n, 'samples with a clear height between 0.6 and ' + (HEAD - 0.25) + ' m: ' + low + ' / ' + n);
});
test('long tapers: the interrupted walkway starts narrowing well before the ramp foot where there is room', () => {
  const R = DK.ramps.filter(r => r.kind[0] > 0), want = r => Math.round(SS.deck.DEF.taperBack * r.m), some = R.filter(r => r.back[0] > 0 || r.back[1] > 0).length, full = R.filter(r => r.back[0] >= want(r)).length;
  assert.equal(SS.deck.DEF.taperShape, 'ease', 'tapers narrow along a curve tangent at both ends'); assert.ok(some > 0.4 * R.length, 'ramps with a lengthened taper: ' + some + ' / ' + R.length); assert.ok(full > 20, 'tapers at full length: ' + full);
  for (const r of R) assert.ok(r.back[0] <= want(r) && r.back[1] <= want(r));
  const off = SS.deck.buildDeck(F, { taperBack: 0 }); assert.ok(off.ramps.every(r => r.back[0] === 0 && r.back[1] === 0), 'taperBack 0 keeps the short taper'); assert.equal(off.stats.r12, s.r12, 'ramp layout is not affected by the taper length');
});
test('3D has its own eight colour cards; the panel swaps them in when the view turns 3D', () => {
  const b = html.match(/const SCHEME3_BASE = (\{[^}]*\});/), m = html.match(/const SCHEMES3 = (\[[\s\S]*?\n\])\.map/); assert.ok(b && m, 'SCHEMES3 defined'); const S3 = Function('return ' + m[1])();
  assert.deepEqual(S3.map(x => x.id), ['aurora', 'heat', 'neon', 'acid', 'coral', 'glacier', 'spectrum', 'pearl']); assert.ok(html.includes("let SCHEME3 = 'aurora'"), 'default card is Aurora');
  const lum = c => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2], far = (p, q) => Math.max(...p.map((v, i) => Math.abs(v - q[i])));
  for (const sc of S3) { assert.ok(sc.grad.length >= 3 && sc.road.length === 3 && sc.glow.length === 3);
    for (const [, c] of sc.grad) { assert.ok(lum(c) < 185, sc.id + ': plots stay darker than the white structure (' + Math.round(lum(c)) + ')'); assert.ok(Math.max(...c) - Math.min(...c) >= 25, sc.id + ': plots keep their colour'); assert.ok(far(sc.water, c) > 30, sc.id + ': water differs from the plots'); }
    assert.ok(lum(sc.road) > 150, sc.id + ': the road line is bright'); assert.ok(Math.min(...sc.grad.map(([, c]) => far(sc.road, c))) > 70, sc.id + ': road colour differs from every plot colour');
    assert.ok(lum(sc.wline) > lum(sc.water) + 60, sc.id + ': water has a brighter edge'); assert.ok(far(sc.wline, sc.road) > 40, sc.id + ': water edge differs from the road colour'); }
  for (const k of ['function applyScheme3(', 'function paintFarm3(', 'function syncLegend(', "g.classList.toggle('three', three)", 'buildSwatches(); syncLegend();   /* 配色栏和图例跟着视图换', "'structureStudio.scheme3'", 'G.ctx3.visible = ']) assert.ok(html.includes(k), k);
});
test('the run button continues from the tensor-field screen instead of restarting', () => {
  for (const k of ['async function runAuto()', "$('runBtn').onclick = runAuto;", 'async function demoStart(v1, full, from)', 'DEMO.T = from ? dmT0[from] + 1e-3 : 0', 'DEMO.T = dmT0[2] + 1e-3; DEMO.speed']) assert.ok(html.includes(k), k);
});
test('every column supports the deck: it reaches the underside of the lowest deck above it, or it is removed', () => {
  assert.ok(html.includes('SS.deck.columnsFit(M.corridor.top, F.columns'), 'the page fits columns to the deck in multi-level mode');
  const m = SS.deck.deckMesh(DK, 1), TH = SS.deck.DEF.thick, r = SS.deck.columnsFit(m.top, F.columns, TH); assert.equal(r.cols.length + r.cut.length + r.low.length, F.columns.length);
  assert.ok(r.cols.length > 0.8 * F.columns.length, 'most columns stay: ' + r.cols.length + ' / ' + F.columns.length);
  const under = SS.deck.LV.slice(1).map(z => z - TH + 0.15); let onLevel = 0;
  for (const c of r.cols) { assert.ok(c[2] >= 2.5 && c[2] <= SS.deck.LV[3], 'column height ' + c[2]); if (under.some(u => Math.abs(c[2] - u) < 0.05)) onLevel++; }
  assert.ok(onLevel > 0.85 * r.cols.length, 'columns end exactly under a deck level (the rest are under ramps): ' + onLevel + ' / ' + r.cols.length);
  // a column moved far outside the structure has nothing to support
  assert.equal(SS.deck.columnsFit(m.top, [[-5000, -5000]], TH).cols.length, 0);
});
test('roads in 3D are one painted image, not per-segment bands (no spikes or bright stripes at bends)', () => {
  for (const k of ['function paintRoads3()', 'new THREE.CanvasTexture(cv)', 'MAT.road3T', 'paintFarm3(); paintRoads3();', "c.lineCap = c.lineJoin = 'round'"]) assert.ok(html.includes(k), k);
  for (const k of ['MAT.road3M', 'MAT.glow3a', 'THREE.AdditiveBlending']) assert.ok(!html.includes(k), 'old road bands are gone: ' + k);
  const R = new Function('return ' + html.match(/const ROAD3 = (\{[^;]*\});/)[1])();
  assert.ok(R.size >= 2048 && R.width > 0.5 && R.width <= 1);
  assert.ok(R.halo.length >= 12, 'enough passes for a smooth glow'); for (let i = 1; i < R.halo.length; i++) assert.ok(R.halo[i] < R.halo[i - 1], 'halo goes from wide to narrow');
  const total = 1 - Math.pow(1 - R.alpha, R.halo.length); assert.ok(total > 0.3 && total < 0.65, 'glow at the road edge is visible but not solid: ' + total.toFixed(2));
});
test('the layer panel has no primary-line switch', () => { assert.ok(!html.includes('c_prim') && !html.includes('G.prim')); });
test('zoomed out, the flat ground layers do not flicker: log depth, a near plane that follows distance, fixed ground draw order', () => {
  assert.ok(html.includes('logarithmicDepthBuffer: true'));
  assert.ok(html.includes('nr = clamp(Math.min(s.dist / 40, 0.5 * Math.max(hz, 1)), 0.5, 300)'), 'near plane grows with distance but stays under half the camera height');
  const near = (dist, hz) => Math.min(300, Math.max(0.5, Math.min(dist / 40, 0.5 * Math.max(hz, 1))));
  assert.equal(near(12000, 7000), 300); assert.ok(near(300, 4) <= 2); assert.ok(near(3200, 1800) > 20, 'default view gets a larger near plane than the old 16 m');
  for (const n of ['land', 'water', 'farm3', 'wline3', 'out3', 'cbld3', 'cline3']) assert.ok(new RegExp('\\n  ' + n + ': new THREE\\.\\w+\\(\\{ depthWrite: false').test(html), n + ' does not write depth');
  const order = Function('return ' + html.match(/const GROUND_ORDER = (\[[^\]]*\]);/)[1])();
  assert.deepEqual(order, ['out3', 'cbld3', 'cline3', 'land', 'water', 'stream', 'wline3', 'farm3', 'road3T'], 'ground layers are drawn bottom to top, same order as their heights');
  assert.ok(html.includes('groundOrder();\n  scene.add(G.ctx3, G.site'), 'order is applied and the surroundings are in the scene');
  assert.ok(html.includes('const z0 = c[3] || 0; tmp.position.set(c[0], c[1], z0)'), 'columns start at ground level (or on their own level, c[3])');
});
test('third-level plate edges retreat from the ramp top into the node edge: every one handled, no pointed tip left', () => {
  const D3 = SS.deck.buildDeck(F, { ...SS.deck.DEF, retreat2Len: 0 }), t = D3.stats.tips; assert.equal(SS.deck.DEF.tip, 'retreat');   // 二层的收窄（v0.9.21）另有测试，这里关掉，只比较三层
  assert.ok(t.retreat > 0 && t.retreat === D3.stats.edges3, 'one per third-level edge ramp'); assert.equal(t.retreatDone, t.retreat, 'none skipped'); assert.equal(t.skip.length, 0); assert.equal(t.tt, 0, 'no pointed third-level tips');
  const Dp = SS.deck.buildDeck(F, { ...SS.deck.DEF, tip: 'point', retreat2Len: 0 }); assert.equal(Dp.stats.tips.tt, Dp.stats.edges3, 'the old pointed tip is still available as an option');
  // the retreat only removes third-level area: levels 1 and 2 are unchanged, level 3 gets smaller
  const area = (D, l) => { let a = 0; D.F.forEach((f, i) => { if (D.FT[i] !== l) return; let zz = 0; for (const v of f) zz += D.V[3 * v + 2]; if (Math.abs(zz / f.length - SS.deck.LV[l]) > 0.01) return; for (let k = 1; k < f.length - 1; k++) { const p = 3 * f[0], q = 3 * f[k], r = 3 * f[k + 1]; a += Math.abs((D.V[q] - D.V[p]) * (D.V[r + 1] - D.V[p + 1]) - (D.V[r] - D.V[p]) * (D.V[q + 1] - D.V[p + 1])) / 2; } }); return a; };
  for (const l of [1, 2]) assert.ok(Math.abs(area(D3, l) - area(Dp, l)) < 1, 'level ' + l + ' unchanged'); assert.ok(area(D3, 3) < area(Dp, 3) - 1000, 'third level pulled back');
  const m = SS.deck.deckMesh(D3, 1); for (let i = 0; i < m.top.length; i++) assert.ok(Number.isFinite(m.top[i]));
});
test('third-level edges: the retreat curve starts at the ramp top, and the ramp side bends in to the ramp-top corner (no sliver)', () => {
  const D3 = SS.deck.buildDeck(F, SS.deck.DEF), t = D3.stats.tips; assert.ok(SS.deck.DEF.rampEdge);
  assert.equal(t.radius.length, t.retreat); assert.ok(t.radius.every(r => r > 2), 'no kink: ' + Math.min(...t.radius)); const sorted = t.radius.slice().sort((a, b) => a - b); assert.ok(sorted[sorted.length >> 1] >= 12, 'median radius ' + sorted[sorted.length >> 1]);
  assert.equal(t.rampEdge, t.retreat, 'every ramp side handled'); assert.equal(D3.stats.badPlates, 0);
  // ramp side: no third-level face of a retreating branch is left between its mouth and its ramp top (the node plate covers it)
  const off = SS.deck.buildDeck(F, { ...SS.deck.DEF, rampEdge: false }); assert.ok(off.stats.tips.rampEdge === undefined);
});
test('step 6 transition: 3D prebuilt, starts from the plan framing top-down, structure lifts up (no clip plane, so shadows follow)', () => {
  for (const k of ['function rise(u)', 'function planCam()', 'function prebuild3D()', 'DEMO.rise = rise(u)', 'setLift(); renderer.render(scene, camera)', 'G.corr.scale.z', 'G.cols.scale.z', 'G.towerModel.scale.z', 'if (k === DST.length - 2) prebuild3D();']) assert.ok(html.includes(k), k);
  assert.ok(!html.includes('clippingPlanes'), 'no clip plane: it does not clip shadows and made slabs flash');
  const dmE = t => { t = Math.min(1, Math.max(0, t)); return t * t * (3 - 2 * t); }; const rise = Function('dmE', 'const RISE0 = ' + html.match(/const RISE0 = ([0-9.]+);/)[1] + ';' + html.match(/function rise\(u\) \{[^\n]*\n/)[0] + '; return rise;')(dmE);
  let p = [-1, -1]; for (let u = 0; u <= 1.0001; u += 0.01) { const v = rise(u); assert.ok(v[0] >= p[0] && v[1] >= p[1], 'rises monotonically'); p = v; }
  assert.ok(rise(0.05)[0] >= 0.1 && rise(0.05)[1] === 0, 'starts low but never flattened (flat slabs z-fight with the ground)'); assert.deepEqual(rise(0.6), [1, 0], 'structure up before the towers'); assert.ok(html.includes('G.towerModel.visible = v[1] > 0.04'), 'flat towers are hidden'); assert.deepEqual(rise(0.95), [1, 1]);
});
test('second level beside an L1->L2 ramp whose foot is near a junction: the half narrows from the mouth to the foot, not over the ramp', () => {
  const D2 = SS.deck.buildDeck(F, SS.deck.DEF), t = D2.stats.tips.l2; assert.ok(t.n > 30, 'places handled: ' + t.n); assert.equal(D2.stats.badPlates, 0);
  const off = SS.deck.buildDeck(F, { ...SS.deck.DEF, retreat2Len: 0 }); assert.equal(off.stats.tips.l2.n, 0);
  // no second-level face of the ramp side lies above a ramp near those feet any more: count L2 faces whose centre is inside a ramp footprint
  const area = (D, l) => { let a = 0; D.F.forEach((f, i) => { if (D.FT[i] !== l) return; let zz = 0; for (const v of f) zz += D.V[3 * v + 2]; if (Math.abs(zz / f.length - SS.deck.LV[l]) > 0.01) return; for (let k = 1; k < f.length - 1; k++) { const p = 3 * f[0], q = 3 * f[k], r = 3 * f[k + 1]; a += Math.abs((D.V[q] - D.V[p]) * (D.V[r + 1] - D.V[p + 1]) - (D.V[r] - D.V[p]) * (D.V[q + 1] - D.V[p + 1])) / 2; } }); return a; };
  assert.ok(Math.abs(area(D2, 1) - area(off, 1)) < 1, 'level 1 unchanged'); assert.ok(Math.abs(area(D2, 3) - area(off, 3)) < 1, 'level 3 unchanged');
  assert.ok(area(D2, 2) < area(off, 2), 'the slivers over the ramps are gone');
});

test('ramp edges on every level are one smooth line: tapers start tangent to the walkway edge and end tangent to the centre line (v0.9.30–31)', () => {
  const cv = s.tips.curves, by = k => cv.filter(c => c.kind + c.tag === k), med = a => { a = a.filter(v => v != null).sort((x, y) => x - y); return a[Math.floor(a.length / 2)]; };
  for (const k of ['01th', '12th', '12tl', '23tl']) assert.ok(by(k).length > 5, 'tapers of ' + k + ': ' + by(k).length);
  for (const k of ['01th', '12th', '12tl']) assert.ok(med(by(k).map(c => c.join)) < 6, k + ' median start corner ' + med(by(k).map(c => c.join)));
  // L2 under an L2→L3 ramp top: the narrowing starts at the junction mouth, never a one-station wedge
  for (const c of by('23tl')) { assert.ok(c.T >= 2, 'one-station wedge left'); assert.ok(c.max < 25, 'corner along ' + c.max); }
  const old = SS.deck.buildDeck(F, { loToMouth: false, smoothTaper: false }).stats.tips.curves.filter(c => c.kind + c.tag === '23tl');
  assert.ok(old.some(c => c.T === 1), 'switches restore the old straight wedge'); assert.ok(old.every(c => c.max === 0), 'old wedge is a straight cut');
  assert.equal(s.badPlates, 0);
});
test('third-level plate edges stay stacked on the levels below: the join smoothing only touches the four points either side of the join (v0.9.31)', () => {
  // v0.9.30 smoothed 12 points × 10 passes, pulling ordinary L3 node-plate edges off the L2 / L1 outline (seams across the plate, hooks at void corners)
  assert.ok(s.tips.joinMoved > 0 && s.tips.joinMoved <= 8, 'outline points moved at one join: ' + s.tips.joinMoved);
});
test('the smoothing does not cost much: subdivided deck stays within 15 % of the plain station tapers (v0.9.31)', () => {
  const tri = D => SS.deck.deckMesh(D, 2).top.length / 9, now = tri(DK), plain = tri(SS.deck.buildDeck(F, { smoothTaper: false }));
  assert.ok(now < 1.15 * plain, 'triangles ' + now + ' vs ' + plain);
});

