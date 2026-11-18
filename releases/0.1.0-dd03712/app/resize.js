// Workspace columns that change size by dragging their edge — mouse, pen or finger (iPad, iPhone).
//   computer / iPad: the right edge of the module list, the left edge of the parameters column
//   phone (one column): the line between the map and the parameters below it
// The sizes are kept on this device; a double-click (double-tap) on an edge goes back to the default.
import { t } from '../shared/i18n/index.js?v=dd03712';

const KEY = 'london2100.layout';
const TOP = 48;            // the top bar
const MIN_STAGE = 320;     // the map keeps at least this width
const COMPACT = 150;       // a module list narrower than this shows the numbers only
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export function mountResizers(app) {
  const nav = app.querySelector('.sidenav'), insp = app.querySelector('.inspector');
  let saved = {};
  try { saved = JSON.parse(localStorage.getItem(KEY)) || {}; } catch { saved = {}; }
  const store = () => { try { localStorage.setItem(KEY, JSON.stringify(saved)); } catch { /* private mode */ } };
  const oneColumn = () => matchMedia('(max-width: 760px)').matches;

  function apply() {
    const W = innerWidth, H = innerHeight, s = app.style;
    if (oneColumn()) {
      s.removeProperty('--nav-w'); s.removeProperty('--insp-w');
      if (saved.stage) s.setProperty('--stage-h', `${Math.round(clamp(saved.stage, 0.22, 0.82) * H)}px`); else s.removeProperty('--stage-h');
    } else {
      s.removeProperty('--stage-h');
      let n = saved.nav, i = saved.insp;
      if (i != null) i = clamp(i, 220, Math.min(640, W * 0.5));
      if (n != null) n = clamp(n, 56, Math.min(420, W * 0.35));
      // never squeeze the map below MIN_STAGE: take it back from the column that is not being dragged first
      const nw = n ?? nav.getBoundingClientRect().width, iw = i ?? insp.getBoundingClientRect().width, over = nw + iw + MIN_STAGE - W;
      if (over > 0) { if (i != null && dragging !== 'nav') i = Math.max(220, i - over); else if (n != null) n = Math.max(56, n - over); }
      n != null ? s.setProperty('--nav-w', `${Math.round(n)}px`) : s.removeProperty('--nav-w');
      i != null ? s.setProperty('--insp-w', `${Math.round(i)}px`) : s.removeProperty('--insp-w');
    }
    const nr = nav.getBoundingClientRect(), ir = insp.getBoundingClientRect();
    app.classList.toggle('nav-compact', nr.width > 0 && nr.width < COMPACT);
    s.setProperty('--rz-nav-x', `${Math.round(nr.right)}px`);
    s.setProperty('--rz-insp-x', `${Math.round(ir.left)}px`);
    s.setProperty('--rz-stage-y', `${Math.round(ir.top - app.getBoundingClientRect().top)}px`);
  }

  // the map and the canvases of the modules follow the window's size: tell them, at most once a frame
  let tick = 0;
  const relayout = () => { cancelAnimationFrame(tick); tick = requestAnimationFrame(() => window.dispatchEvent(new Event('resize'))); };

  let dragging = null;
  const handle = (kind) => {
    const el = document.createElement('div');
    el.className = `ws-rz ws-rz-${kind}`; el.setAttribute('role', 'separator'); el.title = t('dp.resize');
    let lastUp = 0, moved = false;
    el.addEventListener('pointerdown', e => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      e.preventDefault(); el.setPointerCapture(e.pointerId);
      dragging = kind; moved = false; el.classList.add('on'); document.body.classList.add('ws-resizing', `ws-resizing-${kind === 'stage' ? 'y' : 'x'}`);
      const x0 = e.clientX, y0 = e.clientY;
      const mv = ev => {
        if (!moved && Math.hypot(ev.clientX - x0, ev.clientY - y0) < 4) return;
        moved = true;
        if (kind === 'nav') saved.nav = ev.clientX - nav.getBoundingClientRect().left;
        else if (kind === 'insp') saved.insp = innerWidth - ev.clientX;
        else saved.stage = (ev.clientY - TOP) / innerHeight;
        apply(); relayout();
      };
      const up = ev => {
        el.removeEventListener('pointermove', mv); el.removeEventListener('pointerup', up); el.removeEventListener('pointercancel', up);
        el.classList.remove('on'); document.body.classList.remove('ws-resizing', 'ws-resizing-x', 'ws-resizing-y'); dragging = null;
        if (moved) { store(); lastUp = 0; return; }
        // a second tap (or click) on the edge within 350 ms: back to the default size
        if (ev.type === 'pointerup' && ev.timeStamp - lastUp < 350) { delete saved[kind]; store(); apply(); relayout(); lastUp = 0; }
        else lastUp = ev.timeStamp;
      };
      el.addEventListener('pointermove', mv); el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
    });
    app.appendChild(el);
    return el;
  };
  handle('nav'); handle('insp'); handle('stage');

  addEventListener('resize', () => { if (!dragging) apply(); });
  // the columns' content can change their place (a scroll bar, the language): keep the edges on them
  try { new ResizeObserver(() => { if (!dragging) apply(); }).observe(insp); } catch { /* older browsers: the window's resize is enough */ }
  apply();
  return { apply };
}
