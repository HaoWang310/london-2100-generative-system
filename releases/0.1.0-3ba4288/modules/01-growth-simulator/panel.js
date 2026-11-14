// 01 · Growth simulator — the inspector panel.
// The same settings, simple controls, red stretches and words as the incubator
// page (they come from its controls.js), laid out in the workspace's style.
// Playback is the workspace's timeline; this panel shows the year it is at.

import { h } from '../../shared/ui/index.js?v=3ba4288';
import { getLang } from '../../shared/i18n/index.js?v=3ba4288';
import { PALETTE } from './overlay.js?v=3ba4288';

// Words this panel adds to the incubator's own (controls.js I18N), for the map display.
const EXTRA_ZH = {
  'Display': '显示', 'Growth': '生长', 'Rail and stations': '铁路与车站', 'Parcel outlines when zoomed in': '放大时显示地块边线',
  'Opacity': '不透明度', 'Keep as background on the other levels': '在其他层级保留为背景',
  'Could not load the data files.': '无法载入数据文件。', 'Loading the final outcome…': '正在载入最终结果…'
};

const fmt = (v, d = 0) => v.toLocaleString('en-GB', { minimumFractionDigits: d, maximumFractionDigits: d });

export function createPanel(container, growth, { onDisplay = () => {}, display }) {
  const s = growth.state;
  const T = str => (getLang() === 'zh' && (s.I18N?.zh?.[str] || EXTRA_ZH[str])) || str;
  let advOpen = false, SC = {}, SL = {}, graph = null, ratio = null, cmpTimer = null, cmpFor = '';
  const el = {};

  // -------------------------------------------------------------- settings (ported from the incubator page)
  const isUnder = id => { const w = s.GVC.UNDER[id]; return Boolean(w) && s.P[id] >= w[0] - 1e-9 && s.P[id] <= w[1] + 1e-9; };
  function showVal(id) {
    const d = SL[id], v = s.P[id], u = d.u;
    d.val.textContent = u === 'km' ? `${fmt(v / 1000, 1)} km` : u === 'm' ? `${fmt(v)} m` : u === 'x' ? `× ${fmt(v, 2)}` : fmt(v, u);
    d.val.classList.toggle('def', v === s.DEFAULTS[id]);
    d.el.classList.toggle('under', isUnder(id));
  }
  function syncSimple() {
    for (const g of s.GVC.SIMPLE) for (const c of g.c) {
      const d = SC[c.id]; if (!d) continue;
      const v = c.get(s.P), def = c.get(s.DEFAULTS), ok = v !== null && v >= c.min - 1e-9 && v <= c.max + 1e-9;
      d.inp.value = ok ? v : def;
      d.val.textContent = ok ? c.show(v, fmt, T) : T('Custom');
      d.val.classList.toggle('custom', !ok); d.inp.classList.toggle('dim', !ok);
      d.inp.disabled = c.can ? !c.can(s.P) : false;
      d.val.classList.toggle('def', ok && c.k.every(k => s.P[k] === s.DEFAULTS[k]));
    }
    if (el.seedv) el.seedv.textContent = `${T('Layout')} ${s.P.seed}${s.P.seed === 42 ? ` · ${T('the release')}` : ''}`;
  }
  function markPresets() {
    container.querySelectorAll('.g01-pre button').forEach(b => {
      const set = JSON.parse(b.dataset.set);
      b.setAttribute('aria-pressed', String(Object.keys(set).every(k => Math.abs(s.P[k] - set[k]) < 1e-9)));
    });
  }
  function syncAll() { for (const k of Object.keys(SL)) { SL[k].inp.value = s.P[k]; showVal(k); } syncSimple(); markPresets(); drawGraph(); }
  const changed = () => { syncAll(); growth.setParams({}); };
  const presetRow = list => h('div', { class: 'g01-pre' }, list.map(b => {
    const bt = h('button', { type: 'button', class: 'btn', onclick: () => { Object.assign(s.P, b[1]); changed(); } }, T(b[0]));
    bt.dataset.set = JSON.stringify(b[1]);
    return bt;
  }));
  const track = (min, max, step, def, id) => {
    const inp = h('input', { type: 'range', min, max, step });
    const w = id && s.GVC.UNDER[id];
    if (w) {
      const a = Math.max(0, (w[0] - step / 2 - min) / (max - min) * 100), b = Math.min(100, (w[1] + step / 2 - min) / (max - min) * 100);
      inp.style.setProperty('--trk', `linear-gradient(to right, var(--surface-3) 0 ${a}%, #8E2A2E ${a}% ${b}%, var(--surface-3) ${b}% 100%)`);
    }
    return [inp, h('div', { class: 'g01-track' }, inp, h('span', { class: 'g01-tick', style: `left:calc(${(def - min) / (max - min) * 100}% - 1px)` }))];
  };

  function drawGraph() {
    if (!graph || !graph.isConnected) return;
    const P = s.P, r = graph.getBoundingClientRect(), dpr = globalThis.devicePixelRatio || 1;
    if (!r.width) return;
    graph.width = r.width * dpr; graph.height = r.height * dpr;
    const g = graph.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, r.width, r.height);
    const x0 = 28, x1 = r.width - 10, y0 = 6, y1 = r.height - 18, ymax = Math.max(3.2, P.wP * 1.08, P.wS * 1.08, P.wR * 1.08);
    const X = km => x0 + (x1 - x0) * km / 20, Y = w => y1 - (y1 - y0) * w / ymax;
    g.font = '10px -apple-system, sans-serif'; g.fillStyle = '#6e6e73'; g.strokeStyle = 'rgba(255,255,255,.07)'; g.lineWidth = 1;
    for (let km = 0; km <= 20; km += 5) { g.beginPath(); g.moveTo(X(km), y0); g.lineTo(X(km), y1); g.stroke(); g.textAlign = 'center'; g.fillText(`${km} km`, X(km), y1 + 12); }
    for (let w = 0; w <= ymax; w += 1) { g.beginPath(); g.moveTo(x0, Y(w)); g.lineTo(x1, Y(w)); g.stroke(); g.textAlign = 'right'; g.fillText(w, x0 - 5, Y(w) + 3); }
    for (const [w, d, col] of [[P.wP, P.dP, '#E8684A'], [P.wS, P.dS, '#EFA65C'], [P.wR, P.sR, '#BDBDBD']]) {
      g.strokeStyle = col; g.lineWidth = 2; g.beginPath();
      for (let i = 0; i <= 160; i++) { const k = 20 * i / 160, yy = Y(w * Math.exp(-k * 1000 / d)); i ? g.lineTo(X(k), yy) : g.moveTo(X(k), yy); }
      g.stroke();
      const hk = d * Math.LN2 / 1000;
      if (w > 0 && hk <= 20) { g.lineWidth = 1; g.beginPath(); g.moveTo(X(hk), Y(w / 2)); g.lineTo(X(hk), y1); g.stroke(); g.fillStyle = '#000'; g.lineWidth = 1.5; g.beginPath(); g.arc(X(hk), Y(w / 2), 3.5, 0, 7); g.fill(); g.stroke(); }
    }
    const r2 = P.wR > 0 ? P.wR : 1, f = v => (Math.round(v / r2 * 10) / 10).toString();
    ratio.replaceChildren(h('span', { style: 'color:#E8684A' }, T('Primary')), ' · ', h('span', { style: 'color:#EFA65C' }, T('Secondary')), ' · ',
      h('span', { style: 'color:#BDBDBD' }, T('The line')), P.wR > 0 ? `   ${f(P.wP)} : ${f(P.wS)} : 1` : '', h('br'), T('Open circles: where each pull has halved.'));
  }

  // -------------------------------------------------------------- the readout
  function readout() {
    if (!s.loaded) return;
    const R = growth.shown(), isVar = s.mode === 'variation' && Boolean(s.variation), y = s.year;
    const st = R.stats[y], fin = s.final.stats[y];
    el.year.textContent = 2025 + y;
    el.which.textContent = T(isVar ? (growth.stale() ? 'Variation (earlier settings)' : 'Variation') : 'Final outcome');
    el.which.className = `g01-which ${isVar ? 'var' : ''}`;
    el.pop.textContent = fmt(st.pop);
    const rows = [['h', 'High rise', 3], ['m', 'Mid rise', 2], ['l', 'Low rise', 1], ['fh', 'Fields', 4], ['fv', 'Vertical farms', 5]];
    el.land.replaceChildren(h('tr', {}, h('th'), h('th', {}, T(isVar ? 'Variation' : 'Final')), h('th', {}, isVar ? T('Final') : '')),
      ...rows.map(([k, label, c]) => h('tr', {}, h('td', {}, h('i', { class: 'g01-sw', style: `background:${PALETTE[c]}` }), T(label)),
        h('td', { class: 'n' }, `${fmt(st.km2[k], 1)} km²`), h('td', { class: 'f' }, isVar ? fmt(fin.km2[k], 1) : ''))));
    el.mFinal.setAttribute('aria-pressed', String(s.mode === 'final' || !s.variation));
    el.mVar.setAttribute('aria-pressed', String(isVar));
    el.mVar.disabled = !s.variation;
    clearTimeout(cmpTimer); cmpTimer = setTimeout(compare, 120);
  }
  const pc = v => `${fmt(v * 100, 1)} %`;
  async function compare() {
    if (!s.variation) { el.cmp.replaceChildren(h('p', { class: 'muted small' }, T('Run a variation to compare it with the final: where it lands, how much stays in place.'))); cmpFor = ''; return; }
    const key = `${s.variation.id}|${s.year}`;
    if (key === cmpFor) return;
    cmpFor = key;
    const r = await growth.compareAt(s.year).catch(() => null);
    if (!r || cmpFor !== key) return;
    const a = r.variation, b = r.final, row = (label, va, vb) => [h('span', {}, T(label)), h('span', { class: 'v' }, va), h('span', { class: 'fv' }, vb)];
    el.cmp.replaceChildren(h('div', { class: 'g01-same' }, pc(r.same)),
      h('p', { class: 'muted small' }, T("of the variation's built parcels stand where the final has built parcels")),
      h('div', { class: 'g01-reading' }, h('span'), h('span', { class: 'hd' }, T('Variation')), h('span', { class: 'hd' }, T('Final')),
        ...row('Fabric on the best soil', pc(a.best), pc(b.best)),
        ...row('Farming on the best soil', pc(a.farmBest), pc(b.farmBest)),
        ...row('Farming on good soil within 5 km of the line', pc(a.farmGoodLine), pc(b.farmGoodLine)),
        ...row('Fabric within 2 km of the line', pc(a.line2), pc(b.line2)),
        ...row('High rise, median distance from a station', a.hiMed ? `${fmt(a.hiMed, 1)} km` : '–', b.hiMed ? `${fmt(b.hiMed, 1)} km` : '–')));
  }

  function statusLine() {
    if (!el.status) return;
    let txt = '';
    if (s.running) txt = s.status === 'load' ? T("Loading the model's ground…") : `${T(s.status === 'pass1' ? 'First pass: finding where the city ends' : 'Second pass: the city and its farmland')} · ${s.statusYear || ''}`;
    else if (growth.stale()) txt = T('Settings changed. Press Run variation to grow the loop with them.');
    else if (s.variation && s.mode === 'variation') {
      const k = s.variation.stats[75].km2;
      txt = `${T('Grown in')} ${fmt(s.variation.ms / 1000, 1)} s. ${fmt(k.l + k.m + k.h, 1)} km² ${T('built')}, ${fmt(k.fh + k.fv, 1)} km² ${T('farmed')}, ${fmt(s.variation.stats[75].pop)} ${T('people')}.`;
    }
    el.status.textContent = txt;
    el.prog.style.width = `${(s.running ? s.progress : 0) * 100}%`;
    el.run.disabled = s.running; el.reset.disabled = s.running;
  }

  // -------------------------------------------------------------- build
  function build() {
    container.replaceChildren();
    if (!s.loaded) {
      container.append(h('p', { class: 'muted' }, s.error ? `${T('Could not load the data files.')} ${s.error.message}` : T('Loading the final outcome…')));
      return;
    }
    SC = {}; SL = {};
    // mode and run
    el.mFinal = h('button', { type: 'button', onclick: () => growth.setMode('final') }, T('Final outcome'));
    el.mVar = h('button', { type: 'button', onclick: () => growth.setMode('variation') }, T('Variation'));
    el.run = h('button', { class: 'btn primary', onclick: () => growth.run().catch(e => { el.status.textContent = e.message; }) }, T('Run variation'));
    el.reset = h('button', { class: 'btn', onclick: () => { growth.resetParams(); growth.setMode('final'); syncAll(); } }, T('Reset to final'));
    el.status = h('p', { class: 'muted small g01-status' });
    el.prog = h('i');
    // readout
    el.year = h('div', { class: 'g01-year' }); el.which = h('span', { class: 'g01-which' }); el.pop = h('div', { class: 'g01-pop' });
    el.land = h('table', { class: 'g01-land' }); el.cmp = h('div');
    container.append(
      h('div', { class: 'g01-sec' },
        h('div', { class: 'seg g01-mode' }, el.mFinal, el.mVar),
        h('div', { class: 'g01-acts' }, el.run, el.reset), el.status, h('div', { class: 'g01-prog' }, el.prog)),
      h('div', { class: 'g01-sec' },
        h('div', { class: 'g01-yrow' }, el.year, el.which), el.pop, h('p', { class: 'muted small' }, T('people living in the loop')), el.land));

    // simple controls
    graph = h('canvas', { class: 'g01-graph' }); ratio = h('p', { class: 'muted small' });
    for (const g of s.GVC.SIMPLE) {
      const box = h('div', { class: 'g01-sec' }, h('div', { class: 'eyebrow' }, T(g.t)), h('p', { class: 'muted small' }, T(g.note)));
      if (g.graph) box.append(h('div', { class: 'g01-glab muted small' }, T('How each pull fades with distance')), graph, ratio);
      for (const c of g.c) {
        const def = c.get(s.DEFAULTS), [inp, tr] = track(c.min, c.max, c.step, def), val = h('span', { class: 'param-value' });
        SC[c.id] = { inp, val };
        inp.addEventListener('input', () => { const v = +inp.value; c.set(s.P, Math.abs(v - def) < c.step / 2 + 1e-9 ? def : v); changed(); });
        box.append(h('div', { class: 'param g01-sl' }, h('div', { class: 'param-head' }, h('span', { class: 'param-label' }, T(c.t)), val), tr,
          h('div', { class: 'g01-ends' }, h('span', {}, T(c.ends[0])), h('span', {}, T(c.ends[1])))));
        if (c.pre) box.append(presetRow(c.pre));
      }
      if (g.seed) {
        el.seedv = h('p', { class: 'muted small' });
        box.append(h('div', { class: 'g01-acts' },
          h('button', { class: 'btn', onclick: () => { let n; do { n = 1 + Math.floor(Math.random() * 3000); } while (n === s.P.seed); s.P.seed = n; changed(); } }, T('Roll another layout')),
          h('button', { class: 'btn', onclick: () => { s.P.seed = 42; changed(); } }, T("The release's layout"))), el.seedv);
      }
      container.append(box);
    }

    // advanced
    const adv = h('div', { class: `g01-adv ${advOpen ? 'open' : ''}` });
    const advBody = h('div', { class: 'g01-adv-body' }, h('p', { class: 'muted small' }, T('Every setting of the original, one by one. The controls above move these; change one here alone and the control above it shows Custom. A red stretch on a slider marks values where less is built than planned.')));
    for (const g of s.GVC.GROUPS) {
      const box = h('div', { class: 'g01-sec' }, h('div', { class: 'eyebrow' }, T(g.t)), h('p', { class: 'muted small' }, T(g.note)));
      for (const sd of g.s) {
        const [id, label, min, max, step, u] = sd, [inp, tr] = track(min, max, step, s.DEFAULTS[id], id), val = h('span', { class: 'param-value' });
        const row = h('div', { class: 'param g01-sl' }, h('div', { class: 'param-head' }, h('span', { class: 'param-label' }, T(label)), val), tr,
          s.GVC.UNDER[id] ? h('p', { class: 'g01-warn' }, T('Here the land targets are not met: less is built than planned.')) : null);
        SL[id] = { inp, val, u, el: row };
        inp.addEventListener('input', () => { s.P[id] = +inp.value; changed(); });
        box.append(row);
      }
      for (const pr of g.pre) box.append(h('p', { class: 'muted small' }, `${T('Turn it')}: ${T(pr[0])}, ${T(pr[1])}`), presetRow(pr[2]));
      advBody.append(box);
    }
    adv.append(h('button', { class: 'g01-advbtn', type: 'button', onclick: () => { advOpen = !advOpen; adv.classList.toggle('open', advOpen); } }, h('span', { class: 'chev' }, '›'), T('Advanced settings')), advBody);
    container.append(adv);

    // against the final
    container.append(h('div', { class: 'g01-sec' }, h('div', { class: 'eyebrow' }, T('Against the final')), el.cmp,
      h('p', { class: 'g01-note small' }, T("With every setting at its default, a variation grows the same totals as the final, year by year, but only about 60 % of its built parcels stand where the final's do. The lottery is drawn differently: each parcel holds one fixed ticket, so that a slider moves only what it controls."))));

    // display
    const sw = (key, label) => {
      const input = h('input', { type: 'checkbox', role: 'switch', checked: Boolean(display[key]) });
      input.addEventListener('change', () => onDisplay({ [key]: input.checked }));
      return h('div', { class: 'param' }, h('div', { class: 'param-head' }, h('span', { class: 'param-label' }, label), h('label', { class: 'switch' }, input, h('span'))));
    };
    const op = h('input', { type: 'range', min: 0.2, max: 1, step: 0.05, value: display.opacity });
    op.addEventListener('input', () => onDisplay({ opacity: +op.value }));
    container.append(h('div', { class: 'g01-sec' }, h('div', { class: 'eyebrow' }, T('Display')),
      sw('show', T('Growth')), sw('rails', T('Rail and stations')), sw('edges', T('Parcel outlines when zoomed in')),
      h('div', { class: 'param' }, h('div', { class: 'param-head' }, h('span', { class: 'param-label' }, T('Opacity'))), op),
      sw('background', T('Keep as background on the other levels'))));

    syncAll(); readout(); statusLine();
    requestAnimationFrame(drawGraph);
  }

  return {
    build,
    update(what) {
      if (what === 'loaded' || what === 'error' || what === 'lang') { build(); return; }
      if (!s.loaded) return;
      if (what === 'params' || what === 'mode' || what === 'ran') { statusLine(); readout(); if (what !== 'params') syncAll(); }
      if (what === 'year') readout();
      if (what === 'progress' || what === 'running') statusLine();
    },
    resize: drawGraph
  };
}

export const PANEL_CSS = `
.g01-sec { padding: 12px 0; border-bottom: 1px solid var(--hairline); }
.g01-sec:last-child { border-bottom: 0; }
.g01-sec > .eyebrow { margin-bottom: 4px; }
.g01-sec .muted.small { font-size: 12px; margin: 2px 0 8px; }
.g01-mode { width: 100%; } .g01-mode button { flex: 1; height: 28px; }
.g01-mode button:disabled { opacity: .35; cursor: default; }
.g01-acts { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; margin-top: 8px; }
.g01-status { min-height: 18px; margin: 8px 0 4px !important; }
.g01-prog { height: 2px; background: var(--surface-3); border-radius: 2px; overflow: hidden; }
.g01-prog i { display: block; height: 2px; width: 0; background: #E8684A; }
.g01-yrow { display: flex; align-items: baseline; gap: 10px; }
.g01-year { font: 700 34px/1 var(--font); font-variant-numeric: tabular-nums; letter-spacing: -.02em; }
.g01-which { font-size: 11px; letter-spacing: .06em; text-transform: uppercase; padding: 2px 8px; border-radius: 10px; border: 1px solid var(--hairline-strong); color: var(--text-2); }
.g01-which.var { border-color: #EFA65C; color: #EFA65C; }
.g01-pop { font: 500 20px/1.2 var(--font); margin-top: 8px; font-variant-numeric: tabular-nums; }
.g01-land { width: 100%; border-collapse: collapse; font-variant-numeric: tabular-nums; font-size: 12px; }
.g01-land td { padding: 4px 0; border-bottom: 1px solid var(--hairline); } .g01-land td.n { text-align: right; } .g01-land td.f { text-align: right; color: var(--text-3); width: 52px; }
.g01-land th { font-weight: 500; color: var(--text-3); text-align: right; font-size: 11px; }
.g01-sw { display: inline-block; width: 10px; height: 10px; border-radius: 2px; margin-right: 8px; vertical-align: -1px; }
.g01-graph { width: 100%; height: 130px; display: block; }
.g01-glab { margin: 6px 0 2px !important; }
.g01-sl .param-value.def { color: var(--text-3); } .g01-sl .param-value { color: #EFA65C; }
.g01-sl .param-value.custom { color: var(--text-3); font-style: italic; }
.g01-track { position: relative; }
.g01-track input[type=range] { -webkit-appearance: none; appearance: none; width: 100%; height: 18px; background: transparent; margin: 0; cursor: pointer; }
.g01-track input[type=range]::-webkit-slider-runnable-track { height: 4px; border-radius: 2px; background: var(--trk, var(--surface-3)); }
.g01-track input[type=range]::-moz-range-track { height: 4px; border-radius: 2px; background: var(--trk, var(--surface-3)); }
.g01-track input[type=range]::-webkit-slider-thumb { -webkit-appearance: none; width: 16px; height: 16px; margin-top: -6px; border-radius: 50%; background: var(--text); border: 0; }
.g01-track input[type=range]::-moz-range-thumb { width: 16px; height: 16px; border-radius: 50%; background: var(--text); border: 0; }
.g01-track input.dim { opacity: .35; }
.g01-tick { position: absolute; top: 3px; width: 2px; height: 12px; background: var(--text-3); pointer-events: none; }
.g01-ends { display: flex; justify-content: space-between; font-size: 11px; color: var(--text-3); }
.g01-pre { display: flex; gap: 6px; margin: 2px 0 10px; } .g01-pre .btn { flex: 1; height: 26px; padding: 0 6px; font-size: 12px; }
.g01-pre .btn[aria-pressed="true"] { border-color: var(--text); background: var(--surface-3); }
.g01-warn { display: none; color: #F2555A; font-size: 11px; margin: 2px 0 0; }
.g01-sl.under .g01-warn { display: block; } .g01-sl.under .param-value { color: #F2555A; }
.g01-adv { border-bottom: 1px solid var(--hairline); }
.g01-advbtn { width: 100%; display: flex; gap: 8px; align-items: center; background: none; border: 0; color: var(--text-2); padding: 12px 0; cursor: pointer; font: 600 13px var(--font); text-align: left; }
.g01-advbtn:hover { color: var(--text); } .g01-advbtn .chev { display: inline-block; transition: transform .15s; font-size: 16px; }
.g01-adv.open .g01-advbtn .chev { transform: rotate(90deg); }
.g01-adv:not(.open) .g01-adv-body { display: none; }
.g01-same { font: 600 24px/1.2 var(--font); color: #7FD1FF; }
.g01-reading { display: grid; grid-template-columns: 1fr auto auto; gap: 3px 10px; font-size: 12px; font-variant-numeric: tabular-nums; }
.g01-reading .v { color: #EFA65C; text-align: right; } .g01-reading .fv { color: var(--text-3); text-align: right; } .g01-reading .hd { color: var(--text-3); font-size: 11px; text-align: right; }
.g01-note { margin-top: 10px !important; padding: 8px 10px; border-radius: 10px; background: var(--surface-2); border: 1px solid var(--hairline); color: var(--text-2); line-height: 1.5; }
`;
