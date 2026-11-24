/* Structure Studio · the opening film's worker (24 Nov 2026). Draws scenes 1–4 on an OffscreenCanvas, so they keep
   moving while the page's main thread builds the structure (some 3 s on a desk, longer on a phone).
   Keeps its own clock: if the corridor net has not arrived by the end of scene 3, it holds there ("Generating the
   corridor net…") and tells the page how long it held, so the page's scene 5 stays in step.
   Messages in: init {canvas, w, h, dpr, lang, name} · snap {snap} (the raw snapshot) · structure {data, deck} ·
   start {t0} (epoch ms) · size {w, h, dpr} · stop. Out: ready (wool and snapshot in) · hold {hold} (seconds held). */
'use strict';
importScripts('data.js' + (self.location.search || ''), 'draw.js' + (self.location.search || ''));
let inst = null, t0 = 0, hold = 0, holdAt = null, haveStructure = false, haveSnap = false, haveWool = false, running = false, pend = [];
const now = () => performance.timeOrigin + performance.now();
const raf = typeof requestAnimationFrame === 'function' ? requestAnimationFrame : f => setTimeout(() => f(), 16);
const sayReady = () => { if (haveSnap && haveWool) postMessage({ type: 'ready' }); };
function loop() {
  if (!running) return;
  let t = (now() - t0) / 1000 - hold, waiting = false;
  if (!haveStructure && t >= SSIntroDraw.HOLD) { if (holdAt == null) holdAt = now(); t = SSIntroDraw.HOLD; waiting = true; }
  else if (holdAt != null) { hold += (now() - holdAt) / 1000; holdAt = null; postMessage({ type: 'hold', hold }); t = (now() - t0) / 1000 - hold; }
  inst.frame(Math.min(t, SSIntroDraw.END), { waiting });
  if (t > SSIntroDraw.T[4] + SSIntroDraw.XF + 0.2) { running = false; return; }   // scene 5 is the page's (WebGL); this canvas stays clear
  raf(loop);
}
onmessage = e => { const m = e.data;
  if (m.type === 'init') {
    inst = SSIntroDraw.create(m.canvas.getContext('2d'), { lang: m.lang, name: m.name }); inst.resize(m.w, m.h, m.dpr);
    fetch('wool.json' + (self.location.search || '')).then(r => r.json()).then(w => { inst.setWool(w); haveWool = true; sayReady(); }).catch(() => { haveWool = true; sayReady(); });
    for (const p of pend) onmessage({ data: p }); pend = [];
  } else if (!inst) pend.push(m);
  else if (m.type === 'snap') { const A = SSIntroData.fromSnap(m.snap); inst.setSnap(A); postMessage({ type: 'snap', data: A }); haveSnap = true; sayReady(); }
  else if (m.type === 'structure') { inst.setStructure(m.data); if (m.deck) inst.setDeck(m.deck); haveStructure = true; }
  else if (m.type === 'start') { t0 = m.t0; hold = 0; holdAt = null; running = true; raf(loop); }
  else if (m.type === 'size') inst.resize(m.w, m.h, m.dpr);
  else if (m.type === 'stop') running = false;
};
