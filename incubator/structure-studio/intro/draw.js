/* Structure Studio · the opening film's drawing (24 Nov 2026). Shared by intro/worker.js (an OffscreenCanvas in a
   worker, so the pictures keep moving while the page builds the structure) and by intro.js (scene 5's labels, the
   last frame, and older browsers without OffscreenCanvas).
   Scenes 1–4 are drawn here; scene 5 is the WebGL picture made in intro/scene5.js, with its labels drawn by these helpers.
   Data: SSIntroData.fromSnap (the ground) and .fromStructure (the corridor net), merged; the wool threads: intro/wool.json. */
(function (root) {
'use strict';
const T = [0, 4.5, 9.5, 14.5, 19.5], END = 30.8, XF = 0.6, HOLD = T[3] - 0.05;
const ease = x => x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x);
const seg = (t, a, b) => ease((t - a) / (b - a));
const FONT = '"DM Sans",-apple-system,BlinkMacSystemFont,"PingFang SC","Hiragino Sans GB","Noto Sans SC",sans-serif';
const GRAD = [[0, [255, 214, 140]], [0.45, [204, 106, 92]], [1, [28, 36, 66]]];   // Sunset, the app's 2D default
const gcol = (t, a = 1) => { t = Math.max(0, Math.min(1, t)); let i = 0; while (i < GRAD.length - 2 && t > GRAD[i + 1][0]) i++; const [t0, c0] = GRAD[i], [t1, c1] = GRAD[i + 1], f = (t - t0) / (t1 - t0);
  return `rgba(${c0.map((v, k) => Math.round(v + (c1[k] - v) * f)).join(',')},${a})`; };
const plen = P => { const c = [0]; for (let i = 1; i < P.length; i++) c.push(c[i - 1] + Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1])); return c; };
const mk = (w, h) => { if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(Math.max(1, w), Math.max(1, h)); const c = document.createElement('canvas'); c.width = Math.max(1, w); c.height = Math.max(1, h); return c; };
const RW = { m: 12, t: 9, l: 6.5 }, RC = { m: '#ffffff', t: 'rgba(225,228,236,.92)', l: 'rgba(150,158,172,.75)' }, JC = { T: '#ffb37a', X: '#8fb4ff', Y: '#ffffff' };

function create(G0, opt) {
  let zh = (opt.lang || 'zh') !== 'en', name = opt.name || ((opt.lang || 'zh') !== 'en' ? '这块场地' : 'This site');
  const L = (a, b) => zh ? a : b;
  // (27 Nov 2026) a language changed while the film plays: its words switch on the next frame, as in the Loop City opening
  const setLang = (l, nm) => { zh = l !== 'en'; name = nm || L('这块场地', 'This site'); };
  let g = G0, Wd = 1, Hd = 1, dpr = 1, D = null, S = {}, W0 = opt.wool || null, ground = null, bufA = null, bufB = null;
  const plan = { s: 1, ox: 0, oy: 0 }, axo = { k: 1, cx: 0, cy: 0, gap: 0 }, TH = -0.62, cT = Math.cos(TH), sT = Math.sin(TH);
  const nar = () => Wd < 600;
  // ---------------------------------------------------------------- data
  function setSnap(A) { D = Object.assign(D || {}, A); S = Object.assign({}, S, A.stats); D.roads.forEach(r => r.c = plen(r.p)); D.outline.forEach(pc => pc[0].c = plen(pc[0]));
    const rb = D.roads.flatMap(r => r.p); if (rb.length) { const x0 = Math.min(...rb.map(p => p[0])) - 60, x1 = Math.max(...rb.map(p => p[0])) + 60, y0 = Math.min(...rb.map(p => p[1])) - 60, y1 = Math.max(...rb.map(p => p[1])) + 60;
      D.wb = [x0, y0, x1, y1]; D.waterIn = D.water.filter(P => { const R0 = P[0]; let x = 0, y = 0; for (const q of R0) { x += q[0]; y += q[1]; } x /= R0.length; y /= R0.length; return x > x0 && x < x1 && y > y0 && y < y1; }); }
    else { D.wb = [0, 0, D.w, D.h]; D.waterIn = D.water; }
    if (Wd > 1) { fit(); buildGround(); } }
  function setStructure(B) { D = Object.assign(D || {}, B); S = Object.assign({}, S, B.stats); D.stream.forEach(s => s.c = plen(s));
    D.cellC = D.cells.map(P => { let x = 0, y = 0; for (const q of P) { x += q[0]; y += q[1]; } return [x / P.length, y / P.length]; }); }
  function setDeck(C) { S = Object.assign({}, S, { lenKm: C.lenKm, entries: C.entries, r12: C.r12, r23: C.r23, bridges: C.bridges, bridgeKm: C.bridgeKm }); }
  const hasStructure = () => !!(D && D.cells);
  const coreD = p => D.cores && D.cores.length ? Math.min(...D.cores.map(c => Math.hypot(p[0] - c[0], p[1] - c[1]))) : 600;
  // ---------------------------------------------------------------- layout
  function fitPlan() { const top = Hd * (nar() ? 0.17 : 0.07), bot = Hd * (nar() ? 0.26 : 0.21); plan.s = Math.min(Wd * 0.92 / D.w, (Hd - top - bot) / D.h); plan.ox = (Wd - D.w * plan.s) / 2; plan.oy = top + (Hd - top - bot - D.h * plan.s) / 2; }
  const PP = p => [plan.ox + p[0] * plan.s, plan.oy + (D.h - p[1]) * plan.s];
  function fitAxo() { const pts = []; for (const pc of D.outline) for (const p of pc[0]) { const x = p[0] - D.w / 2, y = p[1] - D.h / 2; pts.push([x * cT - y * sT, (x * sT + y * cT) * 0.52]); }
    const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]), bw = Math.max(...xs) - Math.min(...xs), bh = Math.max(...ys) - Math.min(...ys);
    axo.gap = Hd * (nar() ? 0.11 : 0.12); const avH = Hd * (nar() ? 0.62 : 0.72) - 3 * axo.gap; axo.k = Math.min(Wd * (nar() ? 0.86 : 0.56) / bw, avH / bh);
    axo.cx = Wd * (nar() ? 0.5 : 0.56) - (Math.max(...xs) + Math.min(...xs)) / 2 * axo.k; axo.cy = Hd * (nar() ? 0.1 : 0.07) + 3 * axo.gap + Math.max(...ys) * axo.k + (avH - bh * axo.k) / 2; }
  const AP = (p, z) => { const x = p[0] - D.w / 2, y = p[1] - D.h / 2; return [axo.cx + (x * cT - y * sT) * axo.k, axo.cy - (x * sT + y * cT) * 0.52 * axo.k - z * axo.gap]; };
  function fit() { fitPlan(); fitAxo(); }
  function resize(w, h, r) { Wd = w; Hd = h; dpr = r || 1; G0.canvas.width = Math.round(w * dpr); G0.canvas.height = Math.round(h * dpr); bufA = mk(G0.canvas.width, G0.canvas.height); bufB = mk(G0.canvas.width, G0.canvas.height); if (D && D.outline) { fit(); buildGround(); } }
  // ---------------------------------------------------------------- primitives
  function poly(P, pr) { const a = pr(P[0]); g.moveTo(a[0], a[1]); for (let i = 1; i < P.length; i++) { const b = pr(P[i]); g.lineTo(b[0], b[1]); } }
  function line(P, pr, f, c) { f = f == null ? 1 : f; if (f <= 0 || P.length < 2) return; if (f >= 1) { poly(P, pr); return; } const Lh = c[c.length - 1] * f, a = pr(P[0]); g.moveTo(a[0], a[1]);
    for (let i = 1; i < P.length; i++) { if (c[i] >= Lh) { const t = (Lh - c[i - 1]) / (c[i] - c[i - 1] || 1), b = pr([P[i - 1][0] + (P[i][0] - P[i - 1][0]) * t, P[i - 1][1] + (P[i][1] - P[i - 1][1]) * t]); g.lineTo(b[0], b[1]); return; } const b = pr(P[i]); g.lineTo(b[0], b[1]); } }
  function buildGround() { ground = mk(Math.round(Wd * dpr), Math.round(Hd * dpr)); const q = ground.getContext('2d'); q.setTransform(dpr, 0, 0, dpr, 0, 0);
    const fp = (Ls, col) => { q.beginPath(); for (const P of Ls) { if (!P || P.length < 2) continue; const a = PP(P[0]); q.moveTo(a[0], a[1]); for (let i = 1; i < P.length; i++) { const b = PP(P[i]); q.lineTo(b[0], b[1]); } q.closePath(); } q.fillStyle = col; q.fill('evenodd'); };
    fp(D.ctx.urban.flat(), '#0b0e14'); fp(D.ctx.bld, '#1a1f2a');
    q.lineWidth = 1; q.strokeStyle = 'rgba(255,255,255,.12)'; q.beginPath(); for (const Ln of D.ctx.prim) { const a = PP(Ln[0]); q.moveTo(a[0], a[1]); for (let i = 1; i < Ln.length; i++) { const b = PP(Ln[i]); q.lineTo(b[0], b[1]); } } q.stroke();
    fp(D.outline.flat(), '#0f131b'); fp(D.water.flat(), '#1a2238');
    q.strokeStyle = 'rgba(120,150,210,.35)'; q.lineWidth = 0.8; q.beginPath(); for (const P of D.water.flat()) { const a = PP(P[0]); q.moveTo(a[0], a[1]); for (let i = 1; i < P.length; i++) { const b = PP(P[i]); q.lineTo(b[0], b[1]); } q.closePath(); } q.stroke(); }
  const drawGround = a => { if (!ground) return; g.save(); g.globalAlpha *= a; g.setTransform(1, 0, 0, 1, 0, 0); g.drawImage(ground, 0, 0); g.restore(); };
  function siteLine(a, f) { g.save(); g.globalAlpha *= a; g.strokeStyle = '#fff'; g.lineWidth = 1.2; for (const pc of D.outline) { const P = pc[0]; g.beginPath(); line(P, PP, f == null ? 1 : f, P.c); g.stroke(); } g.restore(); }
  function roads(t0, alpha, grades, reveal) { alpha = alpha == null ? 1 : alpha; grades = grades || 'mtl';
    for (const gr of ['l', 't', 'm']) { if (!grades.includes(gr)) continue; const st = { m: 0.4, t: 1.2, l: 2.2 }[gr];
      g.beginPath(); for (const r of D.roads) if (r.g === gr) line(r.p, PP, reveal === false ? 1 : seg(t0, st, st + 1.4), r.c);
      g.save(); g.globalAlpha *= alpha; g.strokeStyle = RC[gr]; g.lineWidth = Math.max(gr === 'l' ? 0.7 : 1, RW[gr] * plan.s); g.lineCap = 'round'; g.lineJoin = 'round'; g.stroke(); g.restore(); } }
  function text(s, x, y, size, col, al, w) { g.font = `${w || 500} ${size}px ${FONT}`; g.fillStyle = col; g.textAlign = al || 'left'; g.textBaseline = 'alphabetic'; g.fillText(s, x, y); }
  function statBlock(rows, a) { if (a <= 0) return; g.save(); g.globalAlpha *= a;
    if (nar()) { rows.forEach((r, i) => { const x = 16 + i * (Wd - 110) / rows.length; text(String(r[0]), x, 58, 19, r[2] || '#fff', 'left', 600); text(r[1], x, 74, 11, 'rgba(245,245,247,.55)', 'left'); }); g.restore(); return; }
    const x = Wd - 28; rows.forEach((r, i) => { text(String(r[0]), x, 96 + i * 46, 24, r[2] || '#fff', 'right', 600); text(r[1], x, 96 + i * 46 + 17, 12, 'rgba(245,245,247,.55)', 'right'); }); g.restore(); }
  function pill(s, x, y, size, al) { al = al || 'left'; g.font = `600 ${size}px ${FONT}`; const w = g.measureText(s).width + 20, x0 = al === 'center' ? x - w / 2 : al === 'right' ? x - w : x - 10;
    g.fillStyle = 'rgba(0,0,0,.72)'; g.beginPath(); if (g.roundRect) g.roundRect(x0, y - size - 6, w, size + 14, 9); else g.rect(x0, y - size - 6, w, size + 14); g.fill(); text(s, al === 'center' ? x : al === 'right' ? x - 10 : x, y, size, '#fff', al, 600); }
  function callout(px, py, lx, ly, t1, t2, a, al) { if (a <= 0) return; g.save(); g.globalAlpha *= a; g.strokeStyle = 'rgba(255,255,255,.55)'; g.lineWidth = 1;
    g.beginPath(); g.moveTo(px, py); g.lineTo(lx, ly); g.stroke(); g.beginPath(); g.arc(px, py, 3, 0, 7); g.fillStyle = '#fff'; g.fill();
    const tx = lx + (al === 'right' ? -10 : 10); g.font = `600 14px ${FONT}`; let w1 = g.measureText(t1).width; if (t2) { g.font = `500 12px ${FONT}`; w1 = Math.max(w1, g.measureText(t2).width); } w1 += 20;
    g.fillStyle = 'rgba(0,0,0,.75)'; g.beginPath(); const bx = al === 'right' ? tx - w1 + 10 : tx - 10; if (g.roundRect) g.roundRect(bx, ly - 19, w1, t2 ? 40 : 26, 8); else g.rect(bx, ly - 19, w1, t2 ? 40 : 26); g.fill();
    text(t1, tx, ly - 1, nar() ? 12 : 14, '#fff', al, 600); if (t2) text(t2, tx, ly + 15, 12, 'rgba(245,245,247,.65)', al); g.restore(); }
  // ---------------------------------------------------------------- captions (bottom left) and the progress pips (top left)
  function captionAt(t) { const s = S, k = t < T[1] ? 0 : t < T[2] ? 1 : t < T[3] ? 2 : t < T[4] ? 3 : 4, lt = t - T[k];
    const allY = s.nodes3 && s.nodes3 === s.nodes;
    const C = [
      [L('地面 · 张量场长出的街道', 'The ground · streets grown by the tensor field'),
       L(`${name}，${s.landHa} ha。上一步在这里长出 ${s.roads} 条街道：主干 ${s.km1} km，其余 ${s.km2} km。地面已经有一张网。`, `${name}, ${s.landHa} ha. The previous step grew ${s.roads} streets here: ${s.km1} km of main streets, ${s.km2} km of others. The ground already has a net.`)],
      [L('问题 · 沿路建，只是更宽的街', 'The problem · along the streets, it is just a wider street'),
       L(`把主干和贯通路直接做成 20 m 宽的走廊：${s.blocks} 个街区（中位数 ${s.blockHa} ha），${s.T}% 的路口是丁字口。读起来是加宽的街道，不是纤维网。`, `Make the main and through streets into 20 m corridors: ${s.blocks} blocks (median ${s.blockHa} ha), and ${s.T}% of the junctions are T-junctions. It reads as wider streets, not a fibre net.`)],
      [L('先例 · 湿毛线找形', 'Precedent · wet-thread form-finding'),
       L('一圈锚点之间拉着略松的毛线，浸湿后相邻的线互相吸住、并成束：路径总长变短，节点自然成三岔，线束之间围出透镜形的室。', 'Slack wool threads tied across a ring are wetted: neighbouring threads cling and merge into bundles. The paths get shorter, the junctions become three-way, and lens-shaped cells open between the bundles.')],
      [L('规则 · 同一个场，两张网', 'The rule · one field, two nets'),
       L(`走廊不复制街道，而由街道背后的同一个场决定：方向顺场；核心密、外围疏（节点间距 ${D && D.P ? D.P.sCore : 95} → ${D && D.P ? D.P.sOut : 260} m）；主线离开主路；塔立在主吸引点上。`, `The corridors do not copy the streets; the field behind the streets decides them: direction along the field; dense at the cores, sparse further out (node spacing ${D && D.P ? D.P.sCore : 95} → ${D && D.P ? D.P.sOut : 260} m); the primaries keep off the main streets; the towers stand on the main attractors.`)],
      [L('立起来 · 一张连续的三层网', 'Standing up · one continuous net in three levels'),
       L(`整张网从 7.2 m 起架在街道之上，跨过街道和水面不断开：${s.lenKm} km 走廊，${s.bridges} 处跨越。L1、L2 全网铺开，只有塔周 200 m 内升到第三层。`, `The whole net stands on the streets from 7.2 m up and runs on over streets and water: ${s.lenKm} km of corridors, ${s.bridges} crossings. L1 and L2 cover the whole net; only within 200 m of a tower does it rise to a third level.`)]];
    if (k === 4) { if (lt >= 9.9) return [C[4][0], L('回到平面：从张量场开始，一步步生成。', 'Back to the plan: from the tensor field, step by step.')];
      if (lt >= 8.5) return [L('交错 · 合回真实层高', 'Interwoven · back to the true heights'), L('拉开的层间距合回去：7.2 / 11.8 / 16.4 m，板厚 1 m，净高 3.6 m。交错都发生在这 9 m 多的高度里。', 'The spread layers close up again: 7.2 / 11.8 / 16.4 m, 1 m slabs, 3.6 m clear. All the weaving happens within these nine-odd metres.')];
      if (lt >= 4.6) return [L('交错 · 一条走道升层，另一条留下', 'Interwoven · one walkway climbs, the other stays'), L('每条走廊是两条并排的走道。坡道只带走其中一条，升一层再并进上一层，另一条留在原层；升的一侧左右交替。三层退台塔座在每一层接住同一层的走廊环。', 'Each corridor is two walkways side by side. A ramp takes only one of them up a level, where it joins the deck above; the other stays. The side that climbs alternates. The three-tier tower base meets the corridor ring at each level.')];
      if (lt >= 2.3) return [L('立起来 · 三层叠在一起', 'Standing up · three levels stacked'), L(`把层间距拉开来看：L1、L2 都是完整的网，L3 只在大塔周围；橙色的坡道把各层缝在一起——地面入口 ${s.entries} 处，L1→L2 ${s.r12} 条，L2→L3 ${s.r23} 条。`, `The levels pulled apart: L1 and L2 are whole nets, L3 only around the towers; the orange ramps stitch them together — ${s.entries} entries from the ground, ${s.r12} ramps L1→L2, ${s.r23} L2→L3.`)]; }
    void allY; return C[k]; }
  function wrap(s, maxW, size, w) { g.font = `${w} ${size}px ${FONT}`; const out = []; let cur = '';
    const toks = zh ? (s.match(/[A-Za-z0-9.,%:/+×→·°\-]+|\s+|./gu) || []) : s.split(/(\s+)/);
    for (const tk of toks) { const nx = cur + tk; if (g.measureText(nx).width > maxW && cur.trim()) { out.push(cur.trim()); cur = tk.trimStart(); } else cur = nx; } if (cur.trim()) out.push(cur.trim()); return out; }
  function caption(t, alpha) { const [tt, body] = captionAt(t), n = nar(), x = n ? 18 : 28, maxW = Math.min(Wd - x * 2, 660), ts = n ? 17 : 22, bs = n ? 13 : 15, lh = n ? 19 : 23;
    // (27 Nov 2026) a title too wide for the screen (English, on a phone) folds onto a second line instead of running off the edge
    const tl = wrap(tt, maxW, ts, 600), tlh = ts + 5, lines = wrap(body, maxW, bs, 400), h = ts + (tl.length - 1) * tlh + 12 + lines.length * lh + (n ? 22 : 30);
    g.save(); g.globalAlpha *= alpha == null ? 1 : alpha; const gr = g.createLinearGradient(0, Hd - h - 40, 0, Hd); gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(0.45, 'rgba(0,0,0,.8)'); gr.addColorStop(1, 'rgba(0,0,0,.88)'); g.fillStyle = gr; g.fillRect(0, Hd - h - 40, Wd, h + 40);
    let y = Hd - h + ts + 4 - (n ? 4 : 0); tl.forEach((s, i) => { if (i) y += tlh; text(s, x, y, ts, '#fff', 'left', 600); }); y += 10; for (const ln of lines) { y += lh; text(ln, x, y, bs, 'rgba(245,245,247,.68)', 'left', 400); } g.restore(); }
  function pips(t) { const n = nar(), x0 = n ? 18 : 28, y = n ? 24 : 28, w = n ? 30 : 44, gap = 6; g.save();
    for (let k = 0; k < 5; k++) { const a = T[k], e = k < 4 ? T[k + 1] : END, f = Math.max(0, Math.min(1, (t - a) / (e - a))), x = x0 + k * (w + gap);
      g.fillStyle = 'rgba(255,255,255,.22)'; g.fillRect(x, y, w, 2); g.fillStyle = '#fff'; g.fillRect(x, y, w * f, 2); }
    if (!n) text(L('结构工作室 · 开场', 'STRUCTURE STUDIO · OPENING'), x0 + 5 * (w + gap) + 6, y + 4, 11, 'rgba(245,245,247,.5)', 'left', 600); g.restore(); }
  // ---------------------------------------------------------------- scene 1: the ground
  function scene1(t) { drawGround(seg(t, 0, 0.8)); siteLine(0.6, seg(t, 0.1, 1.2)); roads(t);
    const ja = seg(t, 3.2, 3.8); if (ja > 0) { g.save(); g.globalAlpha *= ja; for (const j of D.junc) { const p = PP(j); g.beginPath(); g.arc(p[0], p[1], j[2] === 'T' ? 2.2 : 2.6, 0, 7); g.fillStyle = JC[j[2]] || '#fff'; g.fill(); } g.restore(); }
    statBlock([[S.T + '%', L('丁字口', 'T-junctions'), JC.T], [S.X + '%', L('十字口', 'crossings'), JC.X], [S.Y + '%', L('三岔口', 'Y-junctions')]], seg(t, 3.4, 4)); }
  // ---------------------------------------------------------------- scene 2: along the streets, a wider street
  function scene2(t) { drawGround(1); siteLine(0.6); roads(9, 0.5, 'l', false);
    const sw = seg(t, 0.3, 1.6), fade = seg(t, 3.4, 4.4);
    g.save(); g.globalAlpha *= 1 - 0.55 * fade; g.strokeStyle = `rgb(${Math.round(255 - 120 * fade)},${Math.round(255 - 118 * fade)},${Math.round(255 - 110 * fade)})`; g.lineCap = 'round'; g.lineJoin = 'round';
    g.beginPath(); for (const r of D.roads) if (r.g !== 'l') poly(r.p, PP); g.lineWidth = Math.max(1.4, (RW.t + (20 - RW.t) * sw) * plan.s); g.stroke(); g.restore();
    const pt = seg(t, 1.6, 3.4); if (pt > 0 && fade < 1) { let k = 0; for (const j of D.junc) { if (j[2] !== 'T') continue; k++; const ph = pt * 1.25 - (k % 37) / 37; if (ph < 0 || ph > 0.5) continue; const p = PP(j), r = 3 + ph * 22; g.beginPath(); g.arc(p[0], p[1], r, 0, 7); g.strokeStyle = `rgba(255,179,122,${(1 - ph * 2) * (1 - fade)})`; g.lineWidth = 1.4; g.stroke(); } }
    statBlock([[S.blocks, L(`个街区，中位数 ${S.blockHa} ha`, `blocks, median ${S.blockHa} ha`)], [S.T + '%', L('路口是丁字口', 'junctions are T'), JC.T]], seg(t, 1.2, 1.8));
    const la = seg(t, 3.6, 4.3); if (la > 0) { g.save(); g.globalAlpha *= la; text(L('= 加宽的街道', '= a wider street'), Wd / 2, Hd * (nar() ? 0.15 : 0.11), nar() ? 22 : 30, '#fff', 'center', 600); text(L('不是纤维网', 'not a fibre net'), Wd / 2, Hd * (nar() ? 0.15 : 0.11) + 24, 14, 'rgba(245,245,247,.6)', 'center'); g.restore(); } }
  // ---------------------------------------------------------------- scene 3: wet wool threads, the form-finding precedent (a simulation, intro/wool.json)
  function wool(cx, cy, R, f) { if (!W0) return; const F = W0.F, x = f * (F.length - 1), i = Math.min(F.length - 2, Math.floor(x)), u = x - i, A = F[i], B = F[i + 1];
    g.strokeStyle = 'rgba(255,255,255,.92)'; g.lineWidth = 1; g.beginPath();
    for (let k = 0; k < A.length; k++) { const a = A[k], b = B[k]; for (let j = 0; j < a.length; j += 2) { const X = cx + (a[j] + (b[j] - a[j]) * u) / 1000 * R, Y = cy - (a[j + 1] + (b[j + 1] - a[j + 1]) * u) / 1000 * R; j ? g.lineTo(X, Y) : g.moveTo(X, Y); } } g.stroke();
    g.fillStyle = gcol(0.05); for (let j = 0; j < W0.A.length; j += 2) { g.beginPath(); g.arc(cx + W0.A[j] / 1000 * R, cy - W0.A[j + 1] / 1000 * R, 2.4, 0, 7); g.fill(); }
    g.strokeStyle = 'rgba(255,255,255,.18)'; g.beginPath(); g.arc(cx, cy, R * 1.04, 0, 7); g.stroke(); }
  function glyph(x, y, s, angs, col, lab, sub) { g.strokeStyle = col; g.lineWidth = 2.2; g.lineCap = 'round'; g.beginPath(); for (const a of angs) { g.moveTo(x, y); g.lineTo(x + Math.cos(a) * s, y - Math.sin(a) * s); } g.stroke();
    g.beginPath(); g.arc(x, y, 3.2, 0, 7); g.fillStyle = col; g.fill(); text(lab, x, y + s + 24, 14, '#fff', 'center', 600); text(sub, x, y + s + 42, 12, 'rgba(245,245,247,.55)', 'center'); }
  function scene3(t) { drawGround(0.18); roads(9, 0.14, 'mtl', false);
    const n = nar(), R = n ? Math.min(Wd * 0.36, Hd * 0.22) : Math.min(Wd * 0.25, Hd * 0.32), cx = n ? Wd / 2 : Wd * 0.38, cy = n ? Hd * 0.3 : Hd * 0.42;
    g.save(); g.globalAlpha *= seg(t, 0, 0.6); wool(cx, cy, R, seg(t, 0.5, 3.9)); g.restore();
    if (!n) text(t < 1.2 ? L('干：24 根线，各松 8%', 'Dry: 24 threads, each 8% slack') : t < 3.9 ? L('浸湿：相邻的线吸住、并束', 'Wet: neighbours cling and merge') : L('定形：三岔节点 + 透镜形的室', 'Set: three-way nodes and lens-shaped cells'), cx, cy + R + 30, 13, 'rgba(245,245,247,.7)', 'center');
    const ga = seg(t, 3.0, 3.7); if (ga > 0) { g.save(); g.globalAlpha *= ga; const gx = n ? Wd * 0.28 : Wd * 0.72, gy = n ? Hd * 0.6 : Hd * 0.3, sp = n ? Wd * 0.44 : Hd * 0.3, s = n ? 20 : 30;
      const yT = [Math.PI / 2, Math.PI / 2 + 2.094, Math.PI / 2 - 2.094], tl = S.Tlike != null ? L(` · 丁字形只占 ${S.Tlike}%`, ` · ${S.Tlike}% T-shaped`) : '';
      if (n) { glyph(gx, gy, s, [0, Math.PI, Math.PI / 2], JC.T, L('街道 · 丁字口', 'Streets · T'), L('一个 180°，两个 90°', 'one 180°, two 90°')); glyph(gx + sp, gy, s, yT, '#fff', L('绳网 · 三岔', 'Threads · Y'), L('三个约 120°', 'three near 120°')); }
      else { glyph(gx, gy, s, [0, Math.PI, Math.PI / 2], JC.T, L('街道 · 丁字口', 'Streets · T-junction'), L(`一个 180°，两个 90° · 占 ${S.T}%`, `one 180°, two 90° · ${S.T}% of them`)); glyph(gx, gy + sp, s, yT, '#fff', L('绳网 · 三岔', 'Threads · three-way'), L('三个约 120°', 'three near 120°') + tl); }
      g.restore(); } }
  // ---------------------------------------------------------------- scene 4: one field, two nets (an exploded axonometric)
  function scene4(t) { const open = seg(t, 0.2, 1.6), gp = axo.gap; axo.gap = gp * open;
    const outline = (z, a) => { g.beginPath(); for (const pc of D.outline) { poly(pc[0], p => AP(p, z)); g.closePath(); } g.fillStyle = `rgba(16,20,28,${a})`; g.fill(); g.strokeStyle = `rgba(255,255,255,${0.35 * a})`; g.lineWidth = 1; g.stroke(); };
    const rel = i => seg(t, 1.9 + i * 0.55, 2.4 + i * 0.55);
    const clip = z => { g.save(); g.beginPath(); for (const pc of D.outline) { poly(pc[0], p => AP(p, z)); g.closePath(); } g.clip(); };
    const wclip = z => { const [a, b, c, d] = D.wb; g.save(); g.beginPath(); poly([[a, b], [c, b], [c, d], [a, d]], p => AP(p, z)); g.closePath(); g.clip(); };
    outline(0, 0.9); g.lineWidth = 0.9; g.strokeStyle = gcol(0.1, 0.55 + 0.35 * rel(0)); g.beginPath(); for (const s of D.stream) line(s, p => AP(p, 0), 1, s.c); g.stroke();
    const pulse = (t * 1.3) % 1; for (const c of D.cores) { const p = AP(c, 0); g.beginPath(); g.arc(p[0], p[1], 4, 0, 7); g.fillStyle = gcol(0); g.fill(); g.beginPath(); g.ellipse(p[0], p[1], 6 + pulse * 18, (6 + pulse * 18) * 0.52, 0, 0, 7); g.strokeStyle = gcol(0, 1 - pulse); g.stroke(); }
    if (rel(1) > 0) { g.setLineDash([3, 4]); for (const c of D.cores) { g.beginPath(); for (let i = 0; i <= 64; i++) { const a = i / 64 * 6.283, q = AP([c[0] + Math.cos(a) * D.P.coreR, c[1] + Math.sin(a) * D.P.coreR], 0); i ? g.lineTo(q[0], q[1]) : g.moveTo(q[0], q[1]); } g.strokeStyle = gcol(0.2, 0.7 * rel(1)); g.lineWidth = 1; g.stroke(); } g.setLineDash([]); }
    outline(1, 0.9); for (const gr of ['l', 't', 'm']) { g.beginPath(); for (const r of D.roads) if (r.g === gr) poly(r.p, p => AP(p, 1)); g.strokeStyle = RC[gr]; g.save(); g.globalAlpha *= gr === 'l' ? 0.6 : 0.85; g.lineWidth = gr === 'm' ? 1.4 : 0.8; g.stroke(); g.restore(); }
    if (rel(2) > 0) { g.beginPath(); for (const r of D.roads) if (r.g === 'm') poly(r.p, p => AP(p, 1)); g.strokeStyle = `rgba(255,179,122,${rel(2)})`; g.lineWidth = 2; g.stroke(); }
    outline(2, 0.9); wclip(2); g.beginPath(); for (const P of D.waterIn) { poly(P[0], p => AP(p, 2)); g.closePath(); } g.fillStyle = '#1a2238'; g.fill(); g.restore();
    clip(2); g.fillStyle = 'rgba(255,255,255,.92)'; g.fillRect(0, 0, Wd, Hd); g.beginPath(); for (const P of D.cells) { poly(P, p => AP(p, 2)); g.closePath(); } g.fillStyle = '#0d1118'; g.fill();
    if (rel(2) > 0) { g.beginPath(); for (const s of D.strands) poly(s, p => AP(p, 2)); g.strokeStyle = gcol(0.05, rel(2)); g.lineWidth = 2.4; g.stroke(); } g.restore();
    g.beginPath(); for (const pc of D.outline) { poly(pc[0], p => AP(p, 3)); g.closePath(); } g.fillStyle = '#1a2238'; g.fill(); wclip(3); g.beginPath(); for (const P of D.waterIn) { poly(P[0], p => AP(p, 3)); g.closePath(); } g.fill(); g.restore();
    clip(3); D.cells.forEach((P, i) => { g.beginPath(); poly(P, p => AP(p, 3)); g.closePath(); g.fillStyle = gcol(coreD(D.cellC[i]) / 1300, 0.88); g.fill(); }); g.restore();
    const ta = rel(3); if (ta > 0) { g.setLineDash([4, 4]); g.strokeStyle = `rgba(255,255,255,${ta})`; g.lineWidth = 1.2; for (const c of D.towers) { const a = AP(c, 0), b = AP(c, 3); g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1] - 40 * ta); g.stroke(); } g.setLineDash([]);
      for (const c of D.towers) { const b = AP(c, 3); g.beginPath(); g.arc(b[0], b[1] - 40 * ta, 3.5, 0, 7); g.fillStyle = '#fff'; g.fill(); } }
    const LAYER = [[0, L('场', 'Field'), L(`张量场方向 · ${D.cores.length} 个主吸引点`, `tensor-field direction · ${D.cores.length} main attractors`)],
      [1, L('地面网', 'Ground net'), L(`主路间距 d1 ${S.d1} m · 支路 d2 ${S.d2} m`, `main streets every ${S.d1} m · others every ${S.d2} m`)],
      [2, L('架空网', 'Raised net'), S.nodes3 === S.nodes ? L(`${S.nodes} 个节点，全部三岔 · ${D.strands.length} 条离路主线`, `${S.nodes} nodes, all three-way · ${D.strands.length} off-road primaries`) : L(`${S.nodes} 个节点，${S.nodes3} 个三岔 · ${D.strands.length} 条主线`, `${S.nodes} nodes, ${S.nodes3} three-way · ${D.strands.length} primaries`)],
      [3, L('填充', 'Infill'), L(`农田 ${S.farm}% · 走廊 ${S.corr}%`, `farmland ${S.farm}% · corridors ${S.corr}%`)]];
    const la = seg(t, 1.2, 1.9); if (la > 0) { g.save(); g.globalAlpha *= la; const n = nar();
      for (const [z, nm, ds] of LAYER) { let mx = 1e9, my = 0; for (const pc of D.outline) for (const p of pc[0]) { const q = AP(p, z); if (q[0] < mx) { mx = q[0]; my = q[1]; } }
        const x = n ? 14 : Math.max(18, mx - 24), y = my; if (!n) { g.strokeStyle = 'rgba(255,255,255,.25)'; g.beginPath(); g.moveTo(mx - 6, my); g.lineTo(x + 4, y); g.stroke(); }
        text('L' + z + ' ' + nm, x, y - 6, n ? 12 : 15, '#fff', n ? 'left' : 'right', 600); if (!n) text(ds, x, y + 12, 12, 'rgba(245,245,247,.6)', 'right'); }
      g.restore(); }
    const REL = [[L('方向', 'Direction'), L('← 场', '← the field')], [L('疏密 ', 'Density ') + D.P.sCore + '→' + D.P.sOut + ' m', L('← 离核心距离', '← distance from a core')], [L('主线', 'Primaries'), L('← 离主路最远', '← furthest from main streets')], [L('塔', 'Towers'), L('← 主吸引点', '← main attractors')]];
    if (!nar()) REL.forEach((r, i) => { const a = rel(i); if (a <= 0) return; g.save(); g.globalAlpha *= a; const y = 72 + i * 34; text(r[0], Wd - 28 - (zh ? 118 : 196), y, 15, '#fff', 'right', 600); text(r[1], Wd - 28, y, 14, gcol(0.1), 'right', 500); g.restore(); });
    axo.gap = gp; }
  // the app's own opening picture: the site, the field's streamlines, the streets, the cores
  function endPlan(a) { if (a <= 0) return; g.save(); g.globalAlpha *= a; g.fillStyle = '#000'; g.fillRect(0, 0, Wd, Hd); drawGround(1); siteLine(0.6);
    if (D.stream) { g.lineWidth = 0.9; g.strokeStyle = gcol(0.1, 0.5); g.beginPath(); for (const s of D.stream) line(s, PP, 1, s.c); g.stroke(); }
    roads(9, 1, 'mtl', false); if (D.cores) for (const c of D.cores) { const p = PP(c); g.beginPath(); g.arc(p[0], p[1], 4, 0, 7); g.fillStyle = gcol(0); g.fill(); } g.restore(); }
  const DRAW = [scene1, scene2, scene3, scene4];
  function render(buf, i, lt) { const c = buf.getContext('2d'); c.setTransform(1, 0, 0, 1, 0, 0); c.globalAlpha = 1; c.clearRect(0, 0, buf.width, buf.height); c.setTransform(dpr, 0, 0, dpr, 0, 0); c.fillStyle = '#000'; c.fillRect(0, 0, Wd, Hd); g = c; DRAW[i](lt); g = G0; }
  const sceneAt = t => { let i = 0; while (i < 4 && t >= T[i + 1]) i++; return i; };
  // scenes 1–4 with their captions; over scene 5 the canvas fades out and is left clear for the WebGL picture underneath
  function frame(t, o) { o = o || {}; g = G0; g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1; g.clearRect(0, 0, G0.canvas.width, G0.canvas.height); g.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (!D || !D.outline) { g.fillStyle = '#000'; g.fillRect(0, 0, Wd, Hd); return; }
    const i = sceneAt(t), lt = t - T[i];
    if (i === 4) { if (lt < XF && hasStructure()) { render(bufB, 3, T[4] - T[3] - 0.001); g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1 - ease(lt / XF); g.drawImage(bufB, 0, 0); g.globalAlpha = 1; } return; }
    if (i === 3 && !hasStructure()) { g.fillStyle = '#000'; g.fillRect(0, 0, Wd, Hd); scene3(T[3] - T[2] - 0.01); }
    else if (i > 0 && lt < XF) { const e = ease(lt / XF); render(bufB, i - 1, T[i] - T[i - 1] - 0.001); render(bufA, i, lt); g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1 - e; g.drawImage(bufB, 0, 0); g.globalAlpha = e; g.drawImage(bufA, 0, 0); g.globalAlpha = 1; g.setTransform(dpr, 0, 0, dpr, 0, 0); }
    else { g.fillStyle = '#000'; g.fillRect(0, 0, Wd, Hd); DRAW[i](lt); }
    caption(o.waiting ? T[2] + 1 : t);   // (27 Nov 2026) the progress marks are the page's own foot now (intro.js), not drawn here
    if (o.waiting) pill(L('正在生成走廊网…', 'Generating the corridor net…'), Wd / 2, nar() ? Hd * 0.12 : 64, nar() ? 13 : 14, 'center'); }
  const setWool = w => { W0 = w; };
  return { setSnap, setStructure, setDeck, setWool, setLang, resize, frame, endPlan, caption, pips, hasStructure,
    h: { text, statBlock, pill, callout, seg, ease, gcol, nar: nar, size: () => [Wd, Hd, dpr], stats: () => S, use: c => { g = c || G0; } } };
}
const API = { create, T, END, XF, HOLD, ease, seg, gcol };
if (typeof module !== 'undefined' && module.exports) module.exports = API; else root.SSIntroDraw = API;
})(typeof self !== 'undefined' ? self : this);
