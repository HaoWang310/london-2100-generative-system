// The London map app's control panel, inside VR.
//
// It is read from the app's own page every time it is drawn (titles, buttons, switches, which one is on, which is
// disabled), so a button added to the app shows up here by itself. Pressing one in VR clicks the very same element in
// the app, so the app's own code does the work; the app is never changed. onChange() is called after a press so
// the VR ground can be repainted in the new look.
//
//   right panel:  every .dpSection of #displayPanel (view, lighting, weather, colour theme, display switches)
//   analysis:     the app's layer switches (label > strong + checkbox) in #panel
// Drawn on a canvas in the app's dark, rounded style; xr_view shows it on the left hand (headset) or beside the view.

const W = 1440, PAD = 28, GAP = 12, TILE_H = 64, ROW_H = 58, TITLE_H = 44, FONT = '-apple-system,BlinkMacSystemFont,"SF Pro Text","PingFang SC","Helvetica Neue",sans-serif';

const textOf = el => (el?.innerText || el?.textContent || '').replace(/\s+/g, ' ').trim();

export function appPanel(frame, opt = {}){
  const cv = document.createElement('canvas'); cv.width = W; cv.height = 400;
  let hits = [], hover = null, version = 0, lastSig = '', footer = opt.footer || null;
  const doc = () => frame.contentDocument;

  /** the app's panel as plain data */
  function read(){
    const d = doc(); if (!d) return [];
    const out = [];
    for (const sec of d.querySelectorAll('#displayPanel .dpSection')){
      const title = textOf(sec.querySelector('.dpTitle')), items = [];
      for (const b of sec.querySelectorAll('button.dpTile')){
        const label = textOf(b.querySelector('span:not(.dpDots)')) || textOf(b).split(' ')[0] || b.dataset.theme || b.dataset.lighting || b.dataset.weather || b.id;
        const dots = [...b.querySelectorAll('.dpDots i')].map(i => i.style.background);
        items.push({ kind: 'tile', el: b, label: label.replace(/\s*\d{1,2}:\d{2}.*$/, ''), on: b.getAttribute('aria-pressed') === 'true', off: b.disabled, dots, wide: b.classList.contains('dpWide') });
      }
      for (const row of sec.querySelectorAll('label.dpSwitchRow')){
        const inp = row.querySelector('input[type=checkbox]'); if (!inp) continue;
        items.push({ kind: 'switch', el: inp, label: textOf(row.querySelector('span')), on: inp.classList.contains('dpInvert') ? !inp.checked : inp.checked, off: inp.disabled });
      }
      if (items.length) out.push({ title, items });
    }
    // analysis layer switches: a label holding a <strong> title and a checkbox
    const layers = [];
    for (const lab of d.querySelectorAll('#panel label')){
      const inp = [...lab.children].find(c => c.matches?.('input[type=checkbox]')) || lab.querySelector(':scope > input[type=checkbox]');
      const strong = lab.querySelector('strong'); if (!inp || !strong || !/Toggle$/.test(inp.id)) continue;
      layers.push({ kind: 'switch', el: inp, label: textOf(strong), on: inp.checked, off: inp.disabled });
    }
    if (layers.length) out.push({ title: textOf(d.getElementById('layerListTitle')) || (opt.lang === 'en' ? 'Analysis layers' : '分析图层'), items: layers });
    return out;
  }

  function rr(g, x, y, w, h, r){ g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }

  /** redraw; returns true when the picture changed */
  function draw(){
    const secs = read(), foot = footer ? footer() : '';
    const sig = JSON.stringify(secs.map(s => [s.title, s.items.map(i => [i.label, i.on, i.off])])) + '|' + hover + '|' + foot;
    if (sig === lastSig) return false; lastSig = sig;
    // layout: each section is a block; blocks go to the shorter of two columns
    const CW = (W - 3 * PAD) / 2, blocks = [];
    for (const s of secs){
      let y = 0; const items = [];
      items.push({ t: 'title', y, text: s.title }); y += TITLE_H;
      const tiles = s.items.filter(i => i.kind === 'tile'), sw = s.items.filter(i => i.kind === 'switch');
      let col = 0;
      for (const it of tiles){ if (it.wide && col){ col = 0; y += TILE_H + GAP; }
        const w = it.wide ? CW : (CW - GAP) / 2, x = it.wide ? 0 : col * (w + GAP);
        items.push({ t: 'tile', it, x, y, w, h: TILE_H });
        if (it.wide || col === 1){ col = 0; y += TILE_H + GAP; } else col = 1; }
      if (col) y += TILE_H + GAP;
      for (const it of sw){ items.push({ t: 'switch', it, x: 0, y, w: CW, h: ROW_H }); y += ROW_H; }
      blocks.push({ items, h: y + GAP + 10 });
    }
    const colY = [PAD + 52, PAD + 52], plan = [];
    for (const b of blocks){ const c = colY[0] <= colY[1] ? 0 : 1, ox = PAD + c * (CW + PAD), oy = colY[c];
      for (const p of b.items) plan.push({ ...p, x: (p.x || 0) + ox, y: p.y + oy }); colY[c] += b.h; }
    const H = Math.ceil(Math.max(colY[0], colY[1]) + (foot ? 46 : 0) + PAD - 10);
    if (cv.height !== H) cv.height = H;
    const g = cv.getContext('2d'); g.clearRect(0, 0, W, H);
    g.fillStyle = 'rgba(14,14,16,0.96)'; rr(g, 0, 0, W, H, 36); g.fill();
    g.fillStyle = '#f5f5f7'; g.font = `700 34px ${FONT}`; g.fillText(opt.title || (opt.lang === 'en' ? 'London map' : '伦敦地图'), PAD, PAD + 30);
    hits = [];
    for (const p of plan){
      if (p.t === 'title'){ g.fillStyle = 'rgba(235,235,245,0.55)'; g.font = `600 22px ${FONT}`; g.fillText(p.text, p.x, p.y + 30); continue; }
      const it = p.it, id = hits.length, hov = hover === id && !it.off;
      hits.push({ x: p.x, y: p.y, w: p.w, h: p.h, it });
      g.globalAlpha = it.off ? 0.4 : 1;
      if (p.t === 'tile'){
        rr(g, p.x, p.y, p.w, p.h, 16); g.fillStyle = it.on ? '#2c2c2e' : hov ? '#232326' : '#18181b'; g.fill();
        g.lineWidth = it.on ? 3 : 2; g.strokeStyle = it.on ? '#f5f5f7' : hov ? '#5a5a60' : '#2e2e33'; g.stroke();
        let tx = p.x + 22;
        if (it.dots.length){ it.dots.forEach((c, k) => { g.beginPath(); g.arc(tx + 9 + k * 24, p.y + p.h / 2, 9, 0, Math.PI * 2); g.fillStyle = c; g.fill(); }); tx += it.dots.length * 24 + 12; }
        g.fillStyle = '#f5f5f7'; g.font = `${it.on ? 600 : 500} 25px ${FONT}`; g.fillText(fit(g, it.label, p.x + p.w - tx - 14), tx, p.y + p.h / 2 + 9);
      } else {
        if (hov){ rr(g, p.x - 10, p.y + 4, p.w + 20, p.h - 8, 14); g.fillStyle = '#1d1d20'; g.fill(); }
        g.fillStyle = '#f5f5f7'; g.font = `500 25px ${FONT}`; g.fillText(fit(g, it.label, p.w - 110), p.x + 4, p.y + p.h / 2 + 9);
        const sx = p.x + p.w - 78, sy = p.y + (p.h - 38) / 2;
        rr(g, sx, sy, 72, 38, 19); g.fillStyle = it.on ? '#0a84ff' : '#3a3a3e'; g.fill();
        g.beginPath(); g.arc(it.on ? sx + 53 : sx + 19, sy + 19, 15, 0, Math.PI * 2); g.fillStyle = '#ffffff'; g.fill();
      }
      g.globalAlpha = 1;
    }
    if (foot){ g.fillStyle = 'rgba(143,209,138,0.95)'; g.font = `22px ${FONT}`; g.fillText(fit(g, foot, W - 2 * PAD), PAD, H - PAD + 6); }
    version++;
    return true;
  }
  function fit(g, s, w){ if (g.measureText(s).width <= w) return s; while (s.length > 1 && g.measureText(s + '…').width > w) s = s.slice(0, -1); return s + '…'; }

  /** u, v in 0…1 from the top-left → hit index or null */
  function hitAt(u, v){ const x = u * W, y = v * cv.height; const i = hits.findIndex(h => x >= h.x && x <= h.x + h.w && y >= h.y && y <= h.y + h.h); return i < 0 ? null : i; }
  function setHover(i){ if (i !== hover){ hover = i; draw(); } }
  let timer = 0;
  function press(i){
    const h = hits[i]; if (!h || h.it.off) return false;
    h.it.el.click();   // the app's own button / switch does the work
    lastSig = ''; draw(); setTimeout(() => { lastSig = ''; draw(); }, 250);
    clearTimeout(timer); timer = setTimeout(() => opt.onChange?.(), 700);   // let a few presses settle before repainting
    return true;
  }
  draw();
  return { canvas: cv, draw, hitAt, setHover, press, setFooter(f){ footer = f; lastSig = ''; }, get version(){ return version; }, aspect: () => cv.height / W };
}
