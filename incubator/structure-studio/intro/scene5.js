/* Structure Studio · the opening film, scene 5 (24 Nov 2026): the structure of step 6, standing up, in WebGL.
   The page's own geometry, drawn with its own three.js (r128): the step-6 deck (SS.deck, subdivided as the app does:
   2 levels, 1 on a phone), the tower bases' three tiers (SS.plazaOutline, 1 m slabs), and the towers' full model
   (three shells and their skins, placed with SS.tower.xf). Built once; each frame moves only the camera and two
   uniforms — how far the levels are pulled apart, and the glow running up the ramps — so it stays smooth, and the
   depth buffer decides what is in front. The labels are drawn over it on a 2D canvas (draw.js helpers).
     0–2.2 s  the net rises from the ground to its true heights (× 4 in height, so it reads from afar)
     2.4–3.8  the levels are pulled apart (× 5, slabs keep their 1 m): L1 and L2 whole nets, L3 around the towers
     4.6–6.4  the camera closes in on the first tower and walks round it; the nearest real ramps and the base named
     8.5–9.5  the levels close up again (true heights); 9.8–10.8 the plan fades in: the app's own opening picture */
(function (root) {
'use strict';
const LVZ = [0, 7.2, 11.8, 16.4], LVC = [[.6, .6, .63], [.70, .71, .75], [.84, .85, .88], [.98, .98, .98]];   // the app's own: the levels told apart by lightness only
const gShift = z => Math.max(0, Math.min(2, (z - 7.2) / 4.6));   // storeys above L1 (fractional on ramps)
function create(o) {
  const THREE = root.THREE, I = o.draw, H = I.h, D = o.data, L = (a, b) => zh ? a : b, low = !!o.low;
  let zh = (o.lang || 'zh') !== 'en';
  const setLang = l => { zh = l !== 'en'; };   // (27 Nov 2026) the labels follow a language changed mid-film
  const R = new THREE.WebGLRenderer({ canvas: o.canvas, antialias: !low, powerPreference: low ? 'default' : 'high-performance' });   // (27 Nov 2026) a phone: no antialiasing, the default GPU R.setClearColor(0x000000, 1);
  const scene = new THREE.Scene(), W = new THREE.Group(); scene.add(W);
  const uEx = { value: 1 }, uT = { value: 0 }, disp = [];
  scene.add(new THREE.HemisphereLight(0xffffff, 0x1a1e28, 0.72)); const sun = new THREE.DirectionalLight(0xffffff, 0.75); sun.position.set(-0.55, -0.75, 1.1); scene.add(sun);
  const mat = color => { const m = new THREE.MeshLambertMaterial(color ? { color, side: THREE.DoubleSide } : { vertexColors: true, side: THREE.DoubleSide });
    m.onBeforeCompile = sh => { sh.uniforms.uEx = uEx; sh.uniforms.uT = uT;
      sh.vertexShader = 'attribute float aShift; attribute float aRamp; uniform float uEx; varying float vRamp; varying float vZ;\n' + sh.vertexShader.replace('#include <begin_vertex>', 'vec3 transformed = vec3(position); transformed.z += (uEx - 1.0) * aShift * 4.6; vRamp = aRamp; vZ = position.z;');
      sh.fragmentShader = 'uniform float uT; varying float vRamp; varying float vZ;\n' + sh.fragmentShader.replace('#include <color_fragment>', '#include <color_fragment>\n if (vRamp > 0.5) { float b = fract(vZ / 4.6 - uT); float band = smoothstep(0.0, 0.12, b) * smoothstep(0.42, 0.12, b); diffuseColor.rgb = mix(vec3(1.0, 0.62, 0.38), vec3(1.0, 0.95, 0.85), band); }'); };
    m.customProgramCacheKey = () => 'ssi-deck' + (color ? 'c' : 'v'); disp.push(m); return m; };
  const geo = (pos, shift, ramp, col) => { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('aShift', new THREE.BufferAttribute(shift, 1));
    g.setAttribute('aRamp', new THREE.BufferAttribute(ramp || new Float32Array(pos.length / 3), 1)); if (col) g.setAttribute('color', new THREE.BufferAttribute(col, 3)); g.computeVertexNormals(); disp.push(g); return g; };
  // ground: one textured plane (site, farmland in the Sunset gradient, water, streets) — no thin strips to flicker
  { const tc = document.createElement('canvas'), TS = low ? 2048 : 4096, sc = TS / Math.max(D.w, D.h); tc.width = Math.ceil(D.w * sc); tc.height = Math.ceil(D.h * sc); const q = tc.getContext('2d');
    const tp = p => [p[0] * sc, (D.h - p[1]) * sc], fp = (Ls, col) => { q.beginPath(); for (const P of Ls) { if (!P || P.length < 2) continue; const a = tp(P[0]); q.moveTo(a[0], a[1]); for (let i = 1; i < P.length; i++) { const b = tp(P[i]); q.lineTo(b[0], b[1]); } q.closePath(); } q.fillStyle = col; q.fill('evenodd'); };
    const cores = D.cores || [], coreD = p => cores.length ? Math.min(...cores.map(c => Math.hypot(p[0] - c[0], p[1] - c[1]))) : 600;
    q.fillStyle = '#000'; q.fillRect(0, 0, tc.width, tc.height); fp(D.ctx.urban.flat(), '#0b0e14'); fp(D.ctx.bld, '#191e28'); fp(D.outline.flat(), '#151920');
    q.save(); q.beginPath(); for (const pc of D.outline) { const P = pc[0], a = tp(P[0]); q.moveTo(a[0], a[1]); for (let i = 1; i < P.length; i++) { const b = tp(P[i]); q.lineTo(b[0], b[1]); } q.closePath(); } q.clip();
    D.cells.forEach(P => { let x = 0, y = 0; for (const p of P) { x += p[0]; y += p[1]; } fp([P], H.gcol(coreD([x / P.length, y / P.length]) / 1300, 0.42)); }); q.restore();
    fp(D.water.flat(), '#1a2238');
    const RWm = { m: 12, t: 9, l: 6.5 }; for (const gr of ['l', 't', 'm']) { q.beginPath(); for (const r of D.roads) if (r.g === gr) { const a = tp(r.p[0]); q.moveTo(a[0], a[1]); for (let i = 1; i < r.p.length; i++) { const b = tp(r.p[i]); q.lineTo(b[0], b[1]); } }
      q.strokeStyle = gr === 'l' ? '#5d6370' : '#a9afba'; q.lineWidth = RWm[gr] * sc; q.lineCap = q.lineJoin = 'round'; q.stroke(); }
    const tex = new THREE.CanvasTexture(tc); tex.anisotropy = R.capabilities.getMaxAnisotropy(); tex.encoding = THREE.sRGBEncoding; disp.push(tex);
    const pg = new THREE.PlaneGeometry(tc.width / sc, tc.height / sc), pm = new THREE.MeshBasicMaterial({ map: tex }); disp.push(pg, pm);
    const plane = new THREE.Mesh(pg, pm); plane.position.set(tc.width / sc / 2, D.h - tc.height / sc / 2, 0); W.add(plane); }
  // the deck (the app's step-6 mesh)
  { const dm = o.deckMesh, nT = dm.top.length / 3, sT = new Float32Array(nT), rT = new Float32Array(nT), cT = new Float32Array(nT * 3);
    for (let i = 0; i < nT; i += 3) { const z0 = dm.top[3 * i + 2], z1 = dm.top[3 * i + 5], z2 = dm.top[3 * i + 8], ramp = Math.max(z0, z1, z2) - Math.min(z0, z1, z2) > 0.05 ? 1 : 0, c = LVC[dm.lvl[i]] || LVC[3];
      for (let k = 0; k < 3; k++) { sT[i + k] = gShift(dm.top[3 * (i + k) + 2]); rT[i + k] = ramp; cT.set(c, 3 * (i + k)); } }
    const nS = dm.side.length / 3, sS = new Float32Array(nS);
    for (let i = 0; i < nS; i += 6) { const zB = dm.side[3 * i + 2], zA = dm.side[3 * (i + 1) + 2]; [zB, zA, zA, zB, zA, zB].forEach((z, k) => { sS[i + k] = gShift(z); }); }
    W.add(new THREE.Mesh(geo(new Float32Array(dm.top), sT, rT, cT), mat()), new THREE.Mesh(geo(new Float32Array(dm.side), sS), mat(0x6c6f78))); }
  // tower bases: three tiers, 1 m slabs, outer rings with their voids as holes
  { const inR = (p, P) => { let c = false; for (let i = 0, j = P.length - 1; i < P.length; j = i++) if ((P[i][1] > p[1]) !== (P[j][1] > p[1]) && p[0] < (P[j][0] - P[i][0]) * (p[1] - P[i][1]) / (P[j][1] - P[i][1]) + P[i][0]) c = !c; return c; };
    for (const B of o.bases || []) for (const Lv of B) { const rings = Lv.rings.filter(r => r.length > 3), depth = rings.map(r => rings.filter(x => x !== r && inR(r[0], x)).length);
      const shapes = rings.map((r, i) => depth[i] % 2 ? null : new THREE.Shape(r.map(p => new THREE.Vector2(p[0], p[1]))));
      rings.forEach((r, i) => { if (depth[i] % 2 === 0) return; const host = rings.findIndex((x, j) => depth[j] === depth[i] - 1 && inR(r[0], x)); if (host >= 0 && shapes[host]) shapes[host].holes.push(new THREE.Path(r.map(p => new THREE.Vector2(p[0], p[1])))); });
      const sh = shapes.filter(Boolean); if (!sh.length) continue;
      let g = new THREE.ExtrudeGeometry(sh, { depth: 1, bevelEnabled: false, curveSegments: 1 }); if (g.index) g = g.toNonIndexed(); g.translate(0, 0, Lv.z - 1);
      const n = g.attributes.position.count, lv = Lv.z < 9 ? 1 : Lv.z < 14 ? 2 : 3, c = new Float32Array(n * 3); for (let i = 0; i < n; i++) c.set(LVC[lv], 3 * i);
      g.setAttribute('aShift', new THREE.BufferAttribute(new Float32Array(n).fill(gShift(Lv.z)), 1)); g.setAttribute('aRamp', new THREE.BufferAttribute(new Float32Array(n), 1)); g.setAttribute('color', new THREE.BufferAttribute(c, 3)); g.computeVertexNormals(); disp.push(g);
      W.add(new THREE.Mesh(g, mat())); } }
  // towers: the whole model (three shells + skins), each placed as the app places it
  const towers = []; { const skin = new THREE.MeshLambertMaterial({ color: 0xf3f0ea, side: THREE.DoubleSide }); disp.push(skin);
    for (const t of o.towers || []) { const f = t.xf, grp = new THREE.Group(), z0 = t.z0;
      for (const m of o.shells || []) { const v = m.v, pos = new Float32Array(v.length); for (let i = 0; i < v.length; i += 3) { const q = f(v[i] / 100, v[i + 1] / 100, v[i + 2] / 100, null); pos[i] = q[0]; pos[i + 1] = q[1]; pos[i + 2] = q[2] - z0; }
        const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setIndex(new THREE.BufferAttribute(m.i, 1)); g.computeVertexNormals(); disp.push(g); grp.add(new THREE.Mesh(g, skin)); }
      grp.userData.z0 = z0; scene.add(grp); towers.push(grp); } }
  const cam = new THREE.PerspectiveCamera(30, 1, 5, 30000); cam.up.set(0, 0, 1);
  const V = { vex: 4, ex: 1 }, T0 = o.towerAt || [D.w / 2, D.h / 2];
  let Wd = 1, Hd = 1;
  function resize(w, h, dpr) { Wd = w; Hd = h; R.setPixelRatio(Math.min(dpr || 1, low ? 1.5 : 2)); R.setSize(w, h, false); cam.aspect = w / h; cam.updateProjectionMatrix(); }
  const ease = H.ease, seg = H.seg;
  function update(t) { const zA = ease((t - 4.6) / 1.8), nar = Wd < 600;
    V.vex = 4 - 2.4 * zA; V.ex = 1 + 4 * seg(t, 2.4, 3.8) - 4 * seg(t, 8.5, 9.5);
    const TH = -0.62 - 0.45 * zA - 0.22 * seg(t, 6.2, 9.6), az = Math.atan2(-Math.cos(TH), -Math.sin(TH)), el = Math.asin(0.52 - 0.12 * zA);
    const span = Math.max(D.w, D.h) / 2700, dW = (nar ? 5200 : 3700) * span, dC = nar ? 1500 : 1120;
    const cx = D.w / 2 + (T0[0] - 30 - D.w / 2) * zA, cy = D.h / 2 + (T0[1] - D.h / 2) * zA, cz = 95 * zA, dist = Math.exp(Math.log(dW) + (Math.log(dC) - Math.log(dW)) * zA);
    cam.position.set(cx + Math.cos(az) * Math.cos(el) * dist, cy + Math.sin(az) * Math.cos(el) * dist, cz + Math.sin(el) * dist); cam.lookAt(cx, cy, cz); cam.updateMatrixWorld();
    W.scale.z = V.vex * seg(t, 0.2, 2.2) + 0.001; uEx.value = V.ex; uT.value = (t * 0.55) % 1;
    const tv = Math.min(V.vex, 1.6) * seg(t, 1.4, 3.0); for (const g of towers) { g.position.z = (g.userData.z0 + (V.ex - 1) * 2 * 4.6) * W.scale.z; g.scale.z = Math.max(0.001, tv); g.visible = tv > 0.01; }
    R.render(scene, cam); }
  const GLP = (x, y, z) => { const v = new THREE.Vector3(x, y, (z + (V.ex - 1) * gShift(z) * 4.6) * W.scale.z).project(cam); return [(v.x + 1) / 2 * Wd, (1 - v.y) / 2 * Hd]; };
  // the labels over the picture (on the 2D canvas above it)
  function labels(t) { const S = H.stats(), nar = Wd < 600, out = seg(t, 9.8, 10.8), fa = 1 - out;
    const sa = seg(t, 1.0, 1.6) * (1 - seg(t, 4.4, 4.9)) * fa;
    if (!nar) H.statBlock([[S.lenKm + ' km', L('连续走廊，跨街跨水不断开', 'of corridor, unbroken over streets and water')], [S.bridges + L(' 处', ''), L(`跨越街道 / 水面，共 ${S.bridgeKm} km`, `crossings of streets and water, ${S.bridgeKm} km`)], [S.entries + ' · ' + S.r12 + ' · ' + S.r23, L('地面入口 · L1→L2 坡 · L2→L3 坡', 'entries · ramps L1→L2 · L2→L3'), '#ffb37a']], sa);
    const ra = seg(t, 0.6, 1.2) * (1 - seg(t, 4.4, 4.9)) * fa;
    // (28 Nov 2026) a phone on its side: the picture is only the left 62%, the caption has the right column, so the level legend would sit on the model — leave it out
    let side = false; try { side = matchMedia('(orientation: landscape) and (max-height: 500px)').matches; } catch (e) { side = false; }
    if (ra > 0 && !side) { I.h.use(); const g = o.ctx; g.save(); g.globalAlpha = ra; const lx = nar ? 16 : 28, ly = nar ? 100 : 72;
      [['#b3b5bf', L('L1 7.2 m · 全网', 'L1 7.2 m · the whole net')], ['#d6d9e0', L('L2 11.8 m · 全网', 'L2 11.8 m · the whole net')], ['#fafafa', L('L3 16.4 m · 塔周 200 m', 'L3 16.4 m · within 200 m of a tower')], ['#ffb37a', L('坡道（亮光向上流动）', 'ramps (the light runs upwards)')]].forEach((r, i) => { g.fillStyle = r[0]; g.fillRect(lx, ly + i * 22 - 9, 12, 10); H.text(r[1], lx + 20, ly + i * 22, 13, 'rgba(245,245,247,.85)'); });
      H.text(L('竖向放大 ', 'height × ') + V.vex.toFixed(1).replace('.0', '') + L(' 倍', '') + (V.ex > 1.05 ? L(' · 层间距拉开 ', ' · levels pulled apart × ') + V.ex.toFixed(1) + L(' 倍示意', '') : ''), lx, ly + 4 * 22 + 4, 11, 'rgba(245,245,247,.45)'); g.restore(); }
    const ca = seg(t, 6.3, 7.0) * (1 - seg(t, 8.4, 8.9)) * fa;
    if (ca > 0) { const near = k0 => (o.ramps || []).filter(r => r[0] === k0).map(r => ({ r, d: Math.hypot((r[2] + r[4]) / 2 - T0[0], (r[3] + r[5]) / 2 - T0[1]) })).filter(x => x.d > 70 && x.d < 330).sort((a, b) => a.d - b.d)[0];
      const A = (x, k0) => GLP((x.r[2] + x.r[4]) / 2, (x.r[3] + x.r[5]) / 2, (LVZ[k0] + LVZ[k0 + 1]) / 2), items = [], r23 = near(2), r12 = near(1), r01 = near(0);
      if (r23) items.push([A(r23, 2), L('1:7 坡道 · L2 → L3', '1:7 ramp · L2 → L3'), L('一条走道升层，另一条留在原层', 'one walkway climbs, the other stays')]);
      if (r12) items.push([A(r12, 1), L('1:7 坡道 · L1 → L2', '1:7 ramp · L1 → L2'), L('升的一侧左右交替', 'the climbing side alternates')]);
      if (r01) items.push([A(r01, 0), L('1:5 入口 · 地面 → L1', '1:5 entry · ground → L1'), L('整条坡不压街道和水面', 'never on a street or water')]);
      if (o.baseAnchor) items.push([GLP(o.baseAnchor[0], o.baseAnchor[1], 16.4), L('三层退台塔座', 'Three-tier tower base'), L('每层接到同一层的走廊环', 'each tier meets the ring at its level')]);
      if (towers.length) items.push([GLP(T0[0], T0[1], 16.4 + 95 / V.vex * Math.min(V.vex, 1.6)), L('种植塔', 'Planting tower'), L(`三片壳 + 外皮 · 塔尖 ${o.towerTip || 186} m`, `three shells and skins · ${o.towerTip || 186} m high`)]);
      items.sort((a, b) => a[0][1] - b[0][1]);
      const lefts = items.filter(it => nar || it[0][0] < Wd * 0.5), rights = items.filter(it => !(nar || it[0][0] < Wd * 0.5));
      const place = (Ls, left) => Ls.forEach((it, i) => { const x = left ? (nar ? 16 : Wd * 0.06) : Wd * 0.94, y = (nar ? 100 : Hd * 0.14) + i * (nar ? 46 : Hd * 0.14);
        H.callout(it[0][0], it[0][1], x + (left ? 1 : -1) * (nar ? 8 : 150), y, it[1], nar ? '' : it[2], ca * seg(t, 6.3 + i * 0.3, 6.9 + i * 0.3), left ? 'left' : 'right'); });
      place(lefts, true); place(rights, false);
      if (!nar) { const g = o.ctx; g.save(); g.globalAlpha = ca; H.pill(L('层间距拉开 ', 'levels pulled apart × ') + V.ex.toFixed(1) + L(' 倍示意 · 竖向放大 1.6 倍', ' · height × 1.6'), Wd - 38, Hd - 170, 12, 'right'); g.restore(); } }
    const ta = seg(t, 9.0, 9.4) * (1 - seg(t, 9.7, 9.9)); if (ta > 0) { const g = o.ctx; g.save(); g.globalAlpha = ta; H.pill(L('合回真实层高：7.2 / 11.8 / 16.4 m', 'Back to the true heights: 7.2 / 11.8 / 16.4 m'), Wd / 2, side ? 66 : nar ? 120 : 70, side ? 13 : nar ? 15 : 18, 'center'); g.restore(); } }
  function dispose() { for (const d of disp) try { d.dispose(); } catch (e) {} try { R.dispose(); R.forceContextLoss && R.forceContextLoss(); } catch (e) {} }
  return { resize, update, labels, dispose, setLang };
}
const API = { create };
root.SSIntroScene5 = API;
})(typeof self !== 'undefined' ? self : this);
