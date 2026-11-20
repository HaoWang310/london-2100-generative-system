// 01 · Growth simulator — the inspector panel.
// The same settings, simple controls, red stretches and words as the incubator
// page (they come from its controls.js), laid out in the workspace's style.
// Playback is the workspace's timeline; this panel shows the year it is at.

import { h } from '../../shared/ui/index.js?v=99ea850';
import { getLang } from '../../shared/i18n/index.js?v=99ea850';
import { PALETTE } from './overlay.js?v=99ea850';
import { GROUND } from './step-images.js?v=99ea850';

// Words this panel adds to the incubator's own (controls.js I18N), for the map display.
const EXTRA_ZH = {
  'Display': '显示', 'Growth': '生长', 'Rail and stations': '铁路与车站', 'Parcel outlines when zoomed in': '放大时显示地块边线', 'Finer grains when zoomed in (illustrative)': '放大时细分颗粒（细部为示意）', 'Fill the 70 km circle beyond the model (illustrative)': '补全 70 km 圆内的缺口（示意）',
  'Opacity': '不透明度', 'Next': '下一步', 'Start': '开始', 'Start again': '重新开始', 'Show the result': '生成结果',
  'Settings changed: the next step grows the loop with them.': '参数已修改：点「下一步」时按新参数重新生成。',
  'Walk through the steps with Next. Change the settings in a step, or leave them and go on with the defaults.': '用「下一步」逐步完成。每一步可以修改参数，也可以不改，直接下一步使用默认参数。', 'Where the first pass ends': '第一遍城市的边缘', 'Keep as background on the other levels': '在其他层级保留为背景',
  'Could not load the data files.': '无法载入数据文件。', 'Loading the final outcome…': '正在载入最终结果…'
};

const fmt = (v, d = 0) => v.toLocaleString('en-GB', { minimumFractionDigits: d, maximumFractionDigits: d });

export function createPanel(container, growth, { onDisplay = () => {}, onStep = () => {}, display }) {
  const s = growth.state;
  const T = str => (getLang() === 'zh' && (s.I18N?.zh?.[str] || EXTRA_ZH[str])) || str;
  let advOpen = false, SC = {}, SL = {}, graph = null, ratio = null, cmpTimer = null, cmpFor = '';
  let openStep = null, flowing = false, flowT = 0, flowI = 0;
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
  const changed = () => { settingsChanged(); syncAll(); growth.setParams({}); stepsSync(); };
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
    const mb = n => fmt(n / 1048576, 1), ground = () => `${mb(growth.groundLoaded())} / ${mb(s.groundTotal)} MB`;
    if (s.running) {
      txt = s.status === 'load' ? `${T("Loading the model's ground…")} ${ground()}`
        : s.status === 'prep' ? T('Growing the loop…')
        : `${T(s.status === 'pass1' ? 'First pass: finding where the city ends' : 'Second pass: the city and its farmland')} · ${s.statusYear || ''}`;
    }
    else if (growth.stale()) txt = T('Settings changed. Press Run variation to grow the loop with them.');
    else if (s.variation && s.mode === 'variation') {
      const k = s.variation.stats[75].km2;
      txt = `${T('Grown in')} ${fmt(s.variation.ms / 1000, 1)} s. ${fmt(k.l + k.m + k.h, 1)} km² ${T('built')}, ${fmt(k.fh + k.fv, 1)} km² ${T('farmed')}, ${fmt(s.variation.stats[75].pop)} ${T('people')}.`;
    }
    if (!txt && s.ground === 'loading') txt = `${T("Loading the model's ground…")} ${ground()}`;   // in the background
    el.status.textContent = txt;
    const loading = s.status === 'load' && s.running && s.groundTotal;
    el.prog.style.width = `${(loading ? Math.min(1, growth.groundLoaded() / s.groundTotal) : s.running ? s.progress : 0) * 100}%`;
    el.run.disabled = s.running; el.reset.disabled = s.running;
  }

  // -------------------------------------------------------------- 生成流程: the steps
  const STEPS = () => s.GVC.STEPS || [];       // an older controls.js has none: then no flow, nothing breaks
  const ctlById = id => { for (const g of s.GVC.SIMPLE) for (const c of g.c) if (c.id === id) return c; return null; };
  // A step marked live shows the outcome; once the settings differ from what is shown, it is out of date.
  const outdated = () => (s.mode === 'variation' && s.variation ? growth.stale() : !growth.isDefault());
  // The steps are walked in order with 下一步: reached = the furthest step opened, done = the steps
  // passed (a green tick). The outcome is grown when a step that shows it is reached with new settings.
  let reached = -1, busy = false, flowTok = 0, growTok = 0, growing = false;
  const done = new Set();
  const stepIx = id => STEPS().findIndex(q => q.id === id);
  const wait = ms => new Promise(r => { flowT = setTimeout(r, ms); });
  function stepsSync() {
    if (!el.steps) return;
    const R = s.mode === 'variation' && s.variation ? s.variation : s.final, x = { D: s.D, P: s.P, stats: R.stats[75], fmt, T }, old = outdated();
    [...el.steps.children].forEach((card, i) => {
      const st = STEPS()[i];
      let txt = ''; try { txt = st.sum(x); } catch { txt = ''; }
      card.querySelector('.ss').textContent = txt;
      card.classList.toggle('done', done.has(st.id));
      card.classList.toggle('locked', i > reached);
      card.classList.toggle('pending', st.id === openStep && Boolean(st.live) && old);
      card.classList.toggle('open', st.id === openStep);
      const nb = card.querySelector('.g01-next');
      if (nb) {
        const last = i === STEPS().length - 1;
        nb.disabled = busy;
        nb.textContent = busy ? T('Growing the loop…') : last ? (done.has(st.id) ? T('Start again') : T('Show the result')) : `${T('Next')} · ${T(STEPS()[i + 1].t)}`;
      }
    });
    if (el.start) el.start.hidden = reached >= 0;
  }
  function openStepAt(id) {
    openStep = id;
    const st = STEPS().find(q => q.id === id) || null;
    stepsSync();
    onStep(st);
    if (st?.graph) requestAnimationFrame(drawGraph);
  }
  function grow() {                           // 2025 to 2100 in about six seconds; resolves false if cut short
    const tok = ++growTok;
    growing = true;
    return new Promise(res => {
      let y = 0; growth.setYear(0);
      const it = setInterval(() => {
        if (tok !== growTok) { clearInterval(it); if (tok === growTok - 1) growing = false; res(false); return; }
        y += 1; growth.setYear(Math.min(75, y));
        if (y >= 75) { clearInterval(it); growing = false; res(true); }
      }, 80);
    });
  }
  async function goTo(i) {
    const st = STEPS()[i]; if (!st) return;
    reached = Math.max(reached, i);
    if (st.live && outdated()) {
      if (growth.isDefault()) growth.setMode('final');          // the release is the default run
      else {
        busy = true; openStepAt(st.id);
        try { await growth.run(); } catch (e) { el.status.textContent = e.message; }
        busy = false;
      }
    }
    openStepAt(st.id);
    el.steps.children[i]?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    if (st.id === 'pass1' || st.id === 'pass2') await grow();
    else if (st.id === 'farm' || st.id === 'result') growth.setYear(75);
    if (i === STEPS().length - 1) done.add(st.id);
    stepsSync();
  }
  function restart() { stopFlow(); done.clear(); reached = -1; openStepAt(null); }
  function nextStep() {
    if (busy) return;
    const wasGrowing = growing;
    stopFlow();                                  // also cuts a growth short ...
    if (wasGrowing) { growing = false; growth.setYear(75); }   // ... which then stands at 2100
    const i = openStep ? stepIx(openStep) : reached, last = STEPS().length - 1;
    if (i >= last) { if (done.has(STEPS()[last].id)) restart(); else goTo(last); return; }
    if (i >= 0) done.add(STEPS()[i].id);
    goTo(i + 1);
  }
  // A setting changed in step k: the steps after it are walked again.
  function settingsChanged() {
    const k = openStep ? stepIx(openStep) : -1;
    if (k < 0 || flowing) return;
    STEPS().forEach((q, j) => { if (j >= k) done.delete(q.id); });
    reached = k;
  }
  function stopFlow() {
    growTok++;
    if (!flowing) return;
    flowing = false; flowTok++; clearTimeout(flowT);
    if (el.flow) el.flow.textContent = T('Play the whole process');
  }
  async function playFlow() {
    if (flowing) { stopFlow(); return; }
    if (busy) return;
    const n = STEPS().length;
    if (done.has(STEPS()[n - 1].id)) restart();
    flowing = true; el.flow.textContent = T('Stop');
    const tok = ++flowTok;
    for (let i = Math.max(0, openStep ? stepIx(openStep) : reached); i < n; i++) {
      await goTo(i);
      if (tok !== flowTok) return;
      const st = STEPS()[i];
      await wait(st.id === 'pass1' || st.id === 'pass2' ? 1000 : i === n - 1 ? 0 : 2600);
      if (tok !== flowTok) return;
      done.add(st.id); stepsSync();
    }
    stopFlow();
  }
  function control(c) {
    const def = c.get(s.DEFAULTS), [inp, tr] = track(c.min, c.max, c.step, def), val = h('span', { class: 'param-value' });
    SC[c.id] = { inp, val };
    inp.addEventListener('input', () => { const v = +inp.value; c.set(s.P, Math.abs(v - def) < c.step / 2 + 1e-9 ? def : v); changed(); });
    return [h('div', { class: 'param g01-sl' }, h('div', { class: 'param-head' }, h('span', { class: 'param-label' }, T(c.t)), val), tr,
      h('div', { class: 'g01-ends' }, h('span', {}, T(c.ends[0])), h('span', {}, T(c.ends[1])))), c.pre ? presetRow(c.pre) : null];
  }
  function seedRow() {
    el.seedv = h('p', { class: 'muted small' });
    return [h('div', { class: 'g01-acts' },
      h('button', { class: 'btn', onclick: () => { let n; do { n = 1 + Math.floor(Math.random() * 3000); } while (n === s.P.seed); s.P.seed = n; changed(); } }, T('Roll another layout')),
      h('button', { class: 'btn', onclick: () => { s.P.seed = 42; changed(); } }, T("The release's layout"))), el.seedv];
  }
  function buildSteps() {
    graph = h('canvas', { class: 'g01-graph' }); ratio = h('p', { class: 'muted small' });
    el.steps = h('div', { class: 'g01-steps' }, STEPS().map((st, n) => {
      const body = h('div', { class: 'sb' }, h('p', { class: 'note' }, T(st.note)), h('p', { class: 'stale' }, T('Settings changed: the next step grows the loop with them.')));
      if (st.graph) body.append(h('div', { class: 'g01-glab muted small' }, T('How each pull fades with distance')), graph, ratio);
      // what the step lays on the map
      const key = [];
      if (st.show.includes('aonb')) for (const [, label, col] of GROUND) key.push([col, label]);
      if (st.show.includes('magnet')) key.push(['linear-gradient(90deg,#2a160d,#c2523a,#efa65c,#f2d99e)', 'Magnet field, the invisible landscape']);
      if (st.show.includes('pass1')) key.push([PALETTE[2], 'First pass: finding where the city ends']);
      if (st.show.includes('edge')) key.push(['#7FD1FF', 'Where the first pass ends']);
      if (key.length) body.append(h('div', { class: 'g01-key' }, key.map(([c, l]) => h('span', {}, h('i', { style: `background:${c}` }), T(l)))));
      for (const id of st.c || []) {
        const parts = id === 'seed' ? seedRow() : ctlById(id) ? control(ctlById(id)) : [];
        for (const p of parts) if (p) body.append(p);
      }
      body.append(h('button', { type: 'button', class: 'btn primary g01-next', onclick: nextStep }));
      const card = h('div', { class: 'g01-step' },
        h('button', { type: 'button', class: 'sh', onclick: () => { if (n > reached || busy) return; stopFlow(); openStepAt(openStep === st.id ? null : st.id); } },
          h('span', { class: 'ck' }, String(n + 1)), h('span', { class: 'st' }, h('b', {}, T(st.t)), h('span', { class: 'ss' })), h('span', { class: 'chev' }, '›')),
        body);
      card.dataset.id = st.id;
      return card;
    }));
    el.flow = h('button', { type: 'button', class: 'btn g01-flowbtn', onclick: playFlow }, T(flowing ? 'Stop' : 'Play the whole process'));
    el.start = h('button', { type: 'button', class: 'btn primary g01-next g01-start', onclick: nextStep }, `${T('Start')} · ${T(STEPS()[0]?.t || '')}`);
    if (!STEPS().length) return h('div');
    return h('div', { class: 'g01-sec' }, h('div', { class: 'g01-flowhead' }, h('div', { class: 'eyebrow' }, T('How the city is made')), el.flow),
      h('p', { class: 'muted small' }, T('Walk through the steps with Next. Change the settings in a step, or leave them and go on with the defaults.')), el.start, el.steps);
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

    // the steps (the simple controls, each in the step it belongs to)
    container.append(buildSteps());

    // advanced
    const adv = h('div', { class: `g01-adv ${advOpen ? 'open' : ''}` });
    const advBody = h('div', { class: 'g01-adv-body' });
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
      sw('show', T('Growth')), sw('rails', T('Rail and stations')), sw('grain', T('Finer grains when zoomed in (illustrative)')), sw('fill', T('Fill the 70 km circle beyond the model (illustrative)')), sw('edges', T('Parcel outlines when zoomed in')),
      h('div', { class: 'param' }, h('div', { class: 'param-head' }, h('span', { class: 'param-label' }, T('Opacity'))), op),
      sw('background', T('Keep as background on the other levels'))));

    syncAll(); readout(); statusLine(); stepsSync();
    requestAnimationFrame(drawGraph);
  }

  return {
    build,
    update(what) {
      if (what === 'loaded' || what === 'error' || what === 'lang') { build(); return; }
      if (!s.loaded) return;
      if (what === 'params' || what === 'mode' || what === 'ran') { statusLine(); readout(); if (what !== 'params') syncAll(); stepsSync(); }
      if (what === 'year') readout();
      if (what === 'progress' || what === 'running') statusLine();
    },
    resize: drawGraph,
    /** Close the open step (the map back to the outcome) and stop the flow. */
    closeSteps() { stopFlow(); if (openStep) openStepAt(null); },
    /** True while the flow grows the loop itself (the app then leaves the timeline alone). */
    stepping: () => busy || flowing
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
.g01-flowhead { display: flex; justify-content: space-between; align-items: center; gap: 10px; margin-bottom: 6px; }
.g01-flowhead .eyebrow { margin: 0; }
.g01-flowbtn { height: 26px; padding: 0 12px; border-radius: 999px; font-size: 12px; }
.g01-step { border: 1px solid var(--hairline); border-radius: 12px; margin: 6px 0; background: rgba(255,255,255,.015); transition: border-color .15s, background .15s; }
.g01-step.open { border-color: var(--hairline-strong); background: rgba(255,255,255,.04); }
.g01-step .sh { display: flex; gap: 10px; align-items: flex-start; width: 100%; text-align: left; background: none; border: 0; color: inherit; padding: 10px 12px; cursor: pointer; font: inherit; }
.g01-step .ck { flex: 0 0 22px; height: 22px; border-radius: 50%; background: #f2f2f2; color: #111; position: relative; margin-top: 0; box-sizing: border-box;
  display: flex; align-items: center; justify-content: center; font: 600 12px/1 var(--font); font-variant-numeric: tabular-nums; }
.g01-step .ck::after { display: none; content: ""; position: absolute; right: -4px; bottom: -4px; width: 13px; height: 13px; border-radius: 50%; background: #30D158 no-repeat center / 8px 8px; box-shadow: 0 0 0 2px var(--surface-1, #161618);
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 8 8'%3E%3Cpath d='M1 4.2l2 2L7 1.8' fill='none' stroke='%23ffffff' stroke-width='1.7' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E"); }
.g01-step.done .ck::after { display: block; }
.g01-step.locked .ck { background: transparent; color: var(--text-3); border: 1.5px solid var(--hairline-strong); }
.g01-step.locked .sh { cursor: default; } .g01-step.locked .st b { color: var(--text-2); } .g01-step.locked .chev { visibility: hidden; }
.g01-step.open .ck { box-shadow: 0 0 0 3px rgba(255,255,255,.12); }
.g01-next { width: 100%; height: 34px; margin-top: 10px; }
.g01-next:disabled { opacity: .6; cursor: progress; }
.g01-start { margin: 2px 0 8px; }
.g01-step .st { flex: 1; min-width: 0; } .g01-step .st b { display: block; font-size: 13.5px; font-weight: 600; }
.g01-step .ss { display: block; color: var(--text-3); font-size: 11.5px; margin-top: 3px; line-height: 1.45; font-variant-numeric: tabular-nums; }
.g01-step .chev { color: var(--text-3); transition: transform .2s; margin-top: 1px; } .g01-step.open .chev { transform: rotate(90deg); }
.g01-step .sb { display: none; padding: 0 12px 8px; } .g01-step.open .sb { display: block; }
.g01-step .sb .note { color: var(--text-3); font-size: 12px; line-height: 1.45; margin: 0 0 8px; }
.g01-key { display: flex; flex-wrap: wrap; gap: 4px 12px; margin: 0 0 8px; font-size: 11.5px; color: var(--text-2); }
.g01-key i { display: inline-block; width: 14px; height: 8px; border-radius: 2px; margin-right: 6px; vertical-align: 0; }
.g01-step .stale { display: none; color: #EFA65C; font-size: 12px; margin: 0 0 8px; } .g01-step.open.pending .stale { display: block; }
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
