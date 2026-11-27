/* Structure Studio · the opening film's worker (24 Nov 2026). Draws scenes 1–4 on an OffscreenCanvas, so they keep
   moving while the page's main thread builds the structure (some 3 s on a desk, longer on a phone).
   Keeps its own clock: if the corridor net has not arrived by the end of scene 3, it holds there ("Generating the
   corridor net…") and tells the page how long it held, so the page's scene 5 stays in step.
   Made as soon as the page opens (Chrome starts a worker only while the page's main thread is free).
   Messages in: init {canvas, w, h, dpr, lang} · snap {snap, name, lang} (the raw snapshot) · lang {lang, name} · structure {data, deck} ·
   size {w, h, dpr} · stop. Out: snap {data} (the simplified ground, for the page) · started {t0} (epoch ms: it starts
   by itself once the snapshot and the wool are in) · hold {hold} (seconds held). */
'use strict';
importScripts('data.js' + (self.location.search || ''), 'draw.js' + (self.location.search || ''));
let inst = null, canvas = null, lang = 'zh', size = [1, 1, 1], wool = null, t0 = 0, hold = 0, holdAt = null, haveStructure = false, haveSnap = false, haveWool = false, running = false;
const now = () => performance.timeOrigin + performance.now();
const raf = typeof requestAnimationFrame === 'function' ? requestAnimationFrame : f => setTimeout(() => f(), 16);
// starts by itself as soon as it has the snapshot and the wool: the page's main thread is usually busy building the
// structure right then (seconds on a phone), so waiting for it to say "start" would hold the film back that long
const sayReady = () => { if (!haveSnap || !haveWool || running || t0) return; t0 = now(); hold = 0; holdAt = null; running = true; postMessage({ type: 'started', t0 }); raf(loop); };
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
    canvas = m.canvas; lang = m.lang; size = [m.w, m.h, m.dpr];
    fetch('wool.json' + (self.location.search || '')).then(r => r.json()).then(w => { wool = w; if (inst) inst.setWool(w); haveWool = true; sayReady(); }).catch(() => { haveWool = true; sayReady(); });
  } else if (m.type === 'snap') { inst = SSIntroDraw.create(canvas.getContext('2d'), { lang: m.lang || lang, name: m.name }); inst.resize(size[0], size[1], size[2]); if (wool) inst.setWool(wool);
    const A = SSIntroData.fromSnap(m.snap); inst.setSnap(A); postMessage({ type: 'snap', data: A }); haveSnap = true; sayReady(); }
  else if (m.type === 'lang') { lang = m.lang; if (inst) inst.setLang(m.lang, m.name); }   // (27 Nov 2026) the page's language changed mid-film
  else if (!inst) return;
  else if (m.type === 'structure') { inst.setStructure(m.data); if (m.deck) inst.setDeck(m.deck); haveStructure = true; if (holdAt == null) postMessage({ type: 'hold', hold }); }   // not holding: the page's clock is right as it is
  else if (m.type === 'size') { size = [m.w, m.h, m.dpr]; if (inst) inst.resize(m.w, m.h, m.dpr); }
  else if (m.type === 'stop') running = false;
};
