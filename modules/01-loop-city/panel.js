// 01 · Loop City step 1 — the inspector panel.
// Run the century, read the figures, choose what the map shows, and move the
// sliders the engine page itself names as its contract (LoopCityEngine.sliders).
// Playback is the workspace's timeline; this panel shows the year it is at.

import { h } from '../../shared/ui/index.js';
import { getLang } from '../../shared/i18n/index.js';
import { USE_COLOUR } from './overlay.js';
import { YEAR0, YEARS } from './engine.js';

const ZH = {
  'Run': '运行', 'Run the century': '运行百年', 'Run again': '再次运行', 'Running…': '运行中…',
  'Preparing…': '准备中…', 'Back to the published result': '回到发布的结果',
  'Opening the published result…': '正在打开发布的结果…', 'The published result could not be opened.': '发布的结果无法打开。',
  'On show: the published result, grown on': '现在显示的是发布的结果，运行于', 'On show: your own run. The century took': '现在显示的是你自己的这次运行，百年用时',
  'Opening the engine page and preparing it… a quarter of a minute or so, then the century starts.': '正在打开引擎页面并做准备…… 大约十几秒，之后开始运行百年。',
  'Run the century grows one of your own with the engine: a minute or more on a desk, longer and heavier on a phone. Every run is different: the mould has no fixed random seed.': '「运行百年」会用引擎自己算一次：电脑上一分钟以上，手机上更久、更吃内存。每次运行结果都不同：黏菌没有固定的随机种子。',
  'The figures are those of the published result, at 2100.': '以下数据为发布结果在 2100 年的数值。',
  'The published result was grown with these. To change them the engine has to be loaded.': '发布的结果是用以下参数算出来的。要修改参数，需要先载入引擎。',
  'Open the settings (loads the engine)': '打开参数（需载入引擎）',
  'Opening the engine page…': '正在打开引擎页面…',
  'Ready. Press Run the century: the mould and the city grow together from 2025 to 2100.': '就绪。点「运行百年」：黏菌与城市从 2025 年共同生长到 2100 年。',
  'Growing': '正在生长', 'The map answers more slowly while the century runs.': '运行期间地图响应会变慢。',
  'The century took': '百年用时', 'Drag the timeline to replay the years.': '拖动时间轴可以回放各年。',
  'Settings changed: run the century again to grow with them.': '参数已修改：重新运行百年后生效。',
  'The engine could not be opened.': '引擎页面无法打开。',
  'Figures': '数据', 'Road drawn by the mould': '黏菌道路', 'Built': '建成', 'Farmed': '农田',
  'Cells': '单元', 'Highways': '干道', 'Links': '连接线', 'Stations in a cell': '落在单元内的车站',
  'of': '/', 'The figures so far, as the century runs.': '以下为运行到当前年份的数据。', 'The figures are those of the finished run, at 2100.': '以下数据为本次运行结束时（2100 年）的结果。',
  'Display': '显示', 'Slime mould': '黏菌', 'City growth': '城市生长', 'Highways and links': '干道与连接线', 'Cells, by use': '单元（按用途）',
  'Rail and stations': '铁路与车站', 'Opacity': '不透明度', 'Keep as background on the other levels': '在其他层级中保留为背景',
  'The highways and the cells are read when the century ends, so they are shown at 2100.': '干道和单元在百年结束后读出，因此只在 2100 年显示。',
  'urban': '城市', 'agricultural': '农业', 'open': '开敞',
  'Settings': '参数', 'Each of these changes the run. Move one, then run the century again.': '每一项都会改变运行结果。改动后需重新运行百年。',
  'Back to the defaults': '恢复默认', 'on': '开', 'off': '关',
  'Existing roads as a faint trail': '现有公路的淡痕迹', 'Read the existing roads': '读取现有道路', 'Network coarseness': '网络粗糙度',
  'Mould steps a year': '黏菌每年步数', 'Park the road network': '固定路网', 'Park at year': '固定年份',
  'Vein edge (trail level)': '菌脉边缘（痕迹强度）', 'Agents a station': '每个车站的智能体数', 'Deposit strength': '沉积强度',
  'Every run is different: the mould has no fixed random seed.': '每次运行结果都不同：黏菌没有固定的随机种子。'
};
const SLIDER_NAME = { roadTrail: 'Existing roads as a faint trail', readRoads: 'Read the existing roads', coarseness: 'Network coarseness',
  mouldStepsAYear: 'Mould steps a year', parkRoadsOn: 'Park the road network', parkYear: 'Park at year', veinEdge: 'Vein edge (trail level)',
  agents: 'Agents a station', deposit: 'Deposit strength' };

const fmt = (v, d = 0) => Number(v || 0).toLocaleString('en-GB', { minimumFractionDigits: d, maximumFractionDigits: d });
const decimals = step => (step && step < 1 ? String(step).split('.')[1]?.length || 0 : 0);

export function createPanel(container, ctl, { display, onDisplay = () => {} }) {
  const { engine, result } = ctl;
  const cur = () => (ctl.source() === 'result' ? result.state : engine.state);   // what the map is showing
  const T = str => (getLang() === 'zh' && ZH[str]) || str;
  const el = {}, SL = {};
  let dirty = false;
  const day = iso => (iso ? String(iso).slice(0, 10) : '');

  function status() {
    if (!el.status) return;
    const s = cur(), E = engine.state, published = ctl.source() === 'result';
    let msg = '';
    if (E.error && !published) msg = `${T('The engine could not be opened.')} ${E.error}`;
    else if (ctl.starting() || E.loading) msg = T('Opening the engine page and preparing it… a quarter of a minute or so, then the century starts.');
    else if (E.running) msg = `${T('Growing')} ${YEAR0 + E.year}… ${T('The map answers more slowly while the century runs.')}`;
    else if (published && !result.state.loaded) msg = result.state.error ? `${T('The published result could not be opened.')} ${result.state.error}` : T('Opening the published result…');
    else if (published) msg = `${T('On show: the published result, grown on')} ${day(result.state.meta.publishedAt)}. ${T('Drag the timeline to replay the years.')}${dirty ? ` ${T('Settings changed: run the century again to grow with them.')}` : ''}`;
    else if (dirty && s.ran) msg = T('Settings changed: run the century again to grow with them.');
    else if (s.ran) msg = `${T('On show: your own run. The century took')} ${fmt(s.ms / 1000, 1)} s. ${T('Drag the timeline to replay the years.')}`;
    else if (!E.loaded) msg = T('Opening the engine page…');
    else msg = T('Ready. Press Run the century: the mould and the city grow together from 2025 to 2100.');
    el.status.textContent = msg;
    el.status.classList.toggle('err', Boolean(E.error && !published));
    const busy = ctl.starting() || E.loading || E.running;
    el.run.disabled = busy;
    el.run.textContent = busy ? (E.running ? T('Running…') : T('Preparing…')) : (published ? T('Run the century') : s.ran ? T('Run again') : T('Run the century'));
    el.bar.style.width = E.running ? `${Math.round(E.year / YEARS * 100)}%` : '0';
    el.back.hidden = published || busy || !result.state.loaded;
    el.cost.hidden = !published || busy;
    for (const k of Object.keys(SL)) SL[k].inp.disabled = E.running;
    if (el.reset) el.reset.disabled = E.running;
  }
  function readout() {
    if (!el.year) return;
    const s = cur(), published = ctl.source() === 'result';
    el.year.textContent = YEAR0 + s.year;
    el.when.textContent = s.running ? T('The figures so far, as the century runs.') : published && s.loaded ? T('The figures are those of the published result, at 2100.') : s.ran ? T('The figures are those of the finished run, at 2100.') : '';
    const st = s.stats || {}, dash = '–', after = v => (s.vectors ? v : dash);
    el.v.road.textContent = `${fmt(st.roadKm)} km`;
    el.v.built.textContent = `${fmt(st.builtKm2)} km²`;
    el.v.farm.textContent = `${fmt(st.farmKm2)} km²`;
    el.v.cells.textContent = after(fmt(st.cells));
    el.v.hw.textContent = after(`${fmt(st.highwayKm)} km`);
    el.v.link.textContent = after(`${fmt(st.linkKm)} km`);
    el.v.st.textContent = after(`${fmt(st.stationsInCell)} ${T('of')} ${s.base ? s.base.stations.features.length : 0}`);
  }
  function showSlider(key) {
    const d = SL[key], m = engine.state.sliders.find(x => x.key === key); if (!d || !m) return;
    if (m.type === 'bool') { d.inp.checked = Boolean(m.value); return; }
    d.inp.value = m.value;
    d.val.textContent = fmt(m.value, decimals(m.step));
    d.val.classList.toggle('def', m.value === m.default);
  }

  function build() {
    container.replaceChildren();
    for (const k of Object.keys(SL)) delete SL[k];
    el.reset = null;

    // run
    // data-phone-quick: on a phone the workspace shows these in the folded sheet (app/phone.js)
    el.run = h('button', { type: 'button', class: 'btn primary lc01-run', 'data-phone-quick': '', onclick: () => ctl.run() }, T('Run the century'));
    el.status = h('p', { class: 'muted small lc01-status' });
    el.bar = h('i');
    el.cost = h('p', { class: 'lc01-note small' }, T('Run the century grows one of your own with the engine: a minute or more on a desk, longer and heavier on a phone. Every run is different: the mould has no fixed random seed.'));
    el.back = h('button', { type: 'button', class: 'btn lc01-back', 'data-phone-quick': '', onclick: () => ctl.showPublished() }, T('Back to the published result'));
    container.append(h('div', { class: 'lc01-sec' }, h('div', { class: 'eyebrow' }, T('Run')), el.run, el.status, h('div', { class: 'lc01-prog' }, el.bar), el.cost, el.back));

    // figures
    el.year = h('div', { class: 'lc01-year' });
    el.when = h('p', { class: 'lc01-note small' });
    el.v = {};
    const row = (key, label, sw) => { el.v[key] = h('td', { class: 'n' }); return h('tr', {}, h('td', {}, sw ? h('i', { class: 'lc01-sw', style: `background:${sw}` }) : null, label), el.v[key]); };
    container.append(h('div', { class: 'lc01-sec' }, h('div', { class: 'eyebrow' }, T('Figures')), el.year, el.when,
      h('table', { class: 'lc01-tab' },
        row('road', T('Road drawn by the mould')), row('built', T('Built'), USE_COLOUR.urban), row('farm', T('Farmed'), USE_COLOUR.agricultural),
        row('cells', T('Cells')), row('hw', T('Highways')), row('link', T('Links')), row('st', T('Stations in a cell')))));

    // display
    const sw = (key, label) => {
      const input = h('input', { type: 'checkbox', role: 'switch', checked: Boolean(display[key]) });
      input.addEventListener('change', () => onDisplay({ [key]: input.checked }));
      return h('div', { class: 'param' }, h('div', { class: 'param-head' }, h('span', { class: 'param-label' }, label), h('label', { class: 'switch' }, input, h('span'))));
    };
    const op = h('input', { type: 'range', min: 0.2, max: 1, step: 0.05, value: display.opacity });
    op.addEventListener('input', () => onDisplay({ opacity: +op.value }));
    container.append(h('div', { class: 'lc01-sec' }, h('div', { class: 'eyebrow' }, T('Display')),
      sw('mould', T('Slime mould')), sw('growth', T('City growth')), sw('highways', T('Highways and links')), sw('cells', T('Cells, by use')), sw('rails', T('Rail and stations')),
      h('div', { class: 'lc01-key' }, ['urban', 'agricultural', 'open'].map(k => h('span', {}, h('i', { class: 'lc01-sw', style: `background:${USE_COLOUR[k]}` }), T(k)))),
      h('p', { class: 'lc01-note small' }, T('The highways and the cells are read when the century ends, so they are shown at 2100.')),
      h('div', { class: 'param' }, h('div', { class: 'param-head' }, h('span', { class: 'param-label' }, T('Opacity'))), op),
      sw('background', T('Keep as background on the other levels'))));

    // settings: the engine's own sliders, once the engine is here; before that, what the published result was grown with
    const E = engine.state;
    if (E.loaded && E.sliders.length) {
      const rows = E.sliders.map(m => {
        const label = T(SLIDER_NAME[m.key] || m.key);
        if (m.type === 'bool') {
          const inp = h('input', { type: 'checkbox', role: 'switch', checked: Boolean(m.value) });
          inp.addEventListener('change', () => { engine.setParam(m.key, inp.checked); showSlider(m.key); status(); });
          SL[m.key] = { inp };
          return h('div', { class: 'param' }, h('div', { class: 'param-head' }, h('span', { class: 'param-label' }, label), h('label', { class: 'switch' }, inp, h('span'))));
        }
        const val = h('span', { class: 'param-value' });
        const inp = h('input', { type: 'range', min: m.min, max: m.max, step: m.step, value: m.value });
        inp.addEventListener('input', () => { engine.setParam(m.key, +inp.value); showSlider(m.key); status(); });
        SL[m.key] = { inp, val };
        return h('div', { class: 'param lc01-sl' }, h('div', { class: 'param-head' }, h('span', { class: 'param-label' }, label), val), inp);
      });
      el.reset = h('button', { type: 'button', class: 'btn', onclick: () => { engine.resetParams(); for (const k of Object.keys(SL)) showSlider(k); status(); } }, T('Back to the defaults'));
      container.append(h('div', { class: 'lc01-sec' }, h('div', { class: 'eyebrow' }, T('Settings')),
        h('p', { class: 'muted small' }, T('Each of these changes the run. Move one, then run the century again.')), rows, h('div', { class: 'lc01-acts' }, el.reset)));
      for (const k of Object.keys(SL)) showSlider(k);
    } else {
      const meta = result.state.meta, vals = meta ? Object.entries(meta.sliders || {}) : [];
      const load = h('button', { type: 'button', class: 'btn', disabled: E.loading || ctl.starting(), onclick: () => { ctl.loadEngine(); status(); } }, E.loading ? T('Preparing…') : T('Open the settings (loads the engine)'));
      container.append(h('div', { class: 'lc01-sec' }, h('div', { class: 'eyebrow' }, T('Settings')),
        h('p', { class: 'muted small' }, T('The published result was grown with these. To change them the engine has to be loaded.')),
        vals.length ? h('table', { class: 'lc01-tab' }, vals.map(([k, v]) => h('tr', {}, h('td', {}, T(SLIDER_NAME[k] || k)), h('td', { class: 'n' }, typeof v === 'boolean' ? T(v ? 'on' : 'off') : fmt(v, Number.isInteger(v) ? 0 : 2))))) : null,
        h('div', { class: 'lc01-acts' }, load)));
    }
    status(); readout();
  }

  return {
    build,
    update(what) {
      if (!el.run || what === 'lang' || what === 'loaded' || what === 'loading' || what === 'error') { build(); return; }
      if (what === 'params') { dirty = true; for (const k of Object.keys(SL)) showSlider(k); }
      if (what === 'running') dirty = false;
      status(); readout();
    },
    resize() {}
  };
}

export const PANEL_CSS = `
.lc01-sec { padding: 12px 0; border-bottom: 1px solid var(--hairline); }
.lc01-sec:last-child { border-bottom: 0; }
.lc01-sec > .eyebrow { margin-bottom: 8px; }
.lc01-sec .muted.small, .lc01-note.small { font-size: 12px; margin: 2px 0 8px; }
.lc01-note { color: var(--text-3); }
.lc01-run { width: 100%; height: 34px; }
.lc01-status { min-height: 18px; margin: 8px 0 6px !important; }
.lc01-status.err { color: #F2555A; }
.lc01-prog { height: 2px; background: var(--surface-3); border-radius: 2px; overflow: hidden; margin-bottom: 8px; }
.lc01-prog i { display: block; height: 2px; width: 0; background: #fff; transition: width .2s; }
.lc01-year { font: 700 34px/1 var(--font); font-variant-numeric: tabular-nums; letter-spacing: -.02em; margin-bottom: 8px; }
.lc01-tab { width: 100%; border-collapse: collapse; font-variant-numeric: tabular-nums; font-size: 12px; }
.lc01-tab td { padding: 4px 0; border-bottom: 1px solid var(--hairline); } .lc01-tab td.n { text-align: right; }
.lc01-tab tr:last-child td { border-bottom: 0; }
.lc01-sw { display: inline-block; width: 10px; height: 10px; border-radius: 2px; margin-right: 8px; vertical-align: -1px; }
.lc01-key { display: flex; gap: 14px; font-size: 12px; color: var(--text-2); padding: 8px 0 2px; }
.lc01-sl .param-value { color: #fff; } .lc01-sl .param-value.def { color: var(--text-3); }
.lc01-acts { margin-top: 10px; } .lc01-acts .btn { width: 100%; }
.lc01-back { width: 100%; margin-top: 4px; } .lc01-back[hidden], .lc01-note[hidden] { display: none; }
`;
