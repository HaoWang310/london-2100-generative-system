// (28 Nov 2026) Phones open on the whole of Greater London (v3.46.3).
// Runs the page's own phoneLondonPadding / fitPhoneToGreaterLondon (cut out of app.js) against simulated phone screens,
// with a Web Mercator camera like MapLibre's (512 px tiles), and checks that the outline's extent lands in the part of
// the map nothing covers. Run with: node --test incubator/google-map-live/scripts/phone_london_view.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const read = p => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const app = read('scripts/app.js');

const cut = (start, end) => { const i = app.indexOf(start), j = app.indexOf(end, i); assert.ok(i >= 0 && j > i, start); return app.slice(i, j); };
const code = cut('const GREATER_LONDON_BOUNDS', '\nfunction fitGoogleTo70(){');

// the outline file's own extent
const geo = JSON.parse(read('assets/greater_london_outline.geojson'));
const pts = []; const walk = c => typeof c[0] === 'number' ? pts.push(c) : c.forEach(walk);
geo.features.forEach(f => walk(f.geometry.coordinates));
const ext = [Math.min(...pts.map(p => p[0])), Math.min(...pts.map(p => p[1])), Math.max(...pts.map(p => p[0])), Math.max(...pts.map(p => p[1]))];

const mx = lng => (lng + 180) / 360;
const my = lat => { const s = Math.sin(lat * Math.PI / 180); return 0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI); };
const unmy = y => Math.atan(Math.sinh(Math.PI * (1 - 2 * y))) * 180 / Math.PI;

function phone({ w, h, dp, sheetTop, ctrlLeft }) {
  const box = { left: 0, top: 0, right: w, bottom: h, width: w, height: h };
  const el = r => ({ offsetParent: {}, getBoundingClientRect: () => ({ width: 1, height: 1, ...r }) });
  const els = { '.dpToggle': el({ bottom: dp }), '.maplibregl-ctrl-top-right': el({ left: ctrlLeft }), panel: el({ top: sheetTop }) };
  let view = null;
  const osmMap = {
    getContainer: () => ({ getBoundingClientRect: () => box }),
    cameraForBounds([[w0, s0], [e0, n0]], { padding: p }) {
      const aw = w - p.left - p.right, ah = h - p.top - p.bottom;
      const z = Math.log2(Math.min(aw / (mx(e0) - mx(w0)), ah / (my(s0) - my(n0))) / 512), ws = 512 * 2 ** z;
      const cx = (mx(w0) + mx(e0)) / 2 - (p.left + aw / 2 - w / 2) / ws, cy = (my(s0) + my(n0)) / 2 - (p.top + ah / 2 - h / 2) / ws;
      return { center: [cx * 360 - 180, unmy(cy)], zoom: z };
    },
    jumpTo(v) { view = v; }, flyTo(v) { view = v; }
  };
  const ctx = {
    IS_PHONE: true, currentProvider: 'osm', osmMap, googleMap: null, sharedView: null, Math,
    maplibregl: { LngLat: { convert: c => ({ lng: c[0], lat: c[1] }) } },
    document: { querySelector: s => els[s] || null, getElementById: id => els[id] || null, body: { getBoundingClientRect: () => box } },
    $: () => null
  };
  vm.createContext(ctx);
  vm.runInContext(code + '\nthis.fit = fitPhoneToGreaterLondon; this.pad = phoneLondonPadding;', ctx);
  assert.equal(ctx.fit(), true);
  const p = ctx.pad(box), ws = 512 * 2 ** view.zoom;
  const px = (lng, lat) => [w / 2 + (mx(lng) - mx(view.center[0])) * ws, h / 2 + (my(lat) - my(view.center[1])) * ws];
  const [l, t] = px(ext[0], ext[3]), [r, b] = px(ext[2], ext[1]);
  return { view, p, l, t, r, b, shared: ctx.sharedView };
}

test('the bounds in app.js are the outline file\'s own extent', () => {
  const m = code.match(/GREATER_LONDON_BOUNDS=\[\[([-\d.]+),([-\d.]+)\],\[([-\d.]+),([-\d.]+)\]\]/);
  assert.ok(m); m.slice(1).map(Number).forEach((v, i) => assert.ok(Math.abs(v - ext[i]) < 1e-3, `bound ${i}`));
});

for (const [name, s] of Object.entries({
  'iPhone SE': { w: 375, h: 667, dp: 56, sheetTop: 470, ctrlLeft: 327 },
  'iPhone 15': { w: 393, h: 760, dp: 56, sheetTop: 545, ctrlLeft: 345 },
  'iPhone 15 Plus': { w: 430, h: 708, dp: 56, sheetTop: 490, ctrlLeft: 382 },
  'phone on its side': { w: 852, h: 393, dp: 56, sheetTop: 230, ctrlLeft: 804 }
})) {
  test(`${name}: Greater London fits between Display, the zoom buttons and the sheet`, () => {
    const { view, p, l, t, r, b, shared } = phone(s);
    const e = 0.75;   // px
    assert.ok(l >= p.left - e && r <= s.w - p.right + e, `x ${l.toFixed(1)}–${r.toFixed(1)}`);
    assert.ok(t >= p.top - e && b <= s.h - p.bottom + e, `y ${t.toFixed(1)}–${b.toFixed(1)}`);
    assert.ok(t >= s.dp && b <= s.sheetTop || name === 'phone on its side', 'clear of Display and the sheet');
    assert.ok(view.zoom > 7 && view.zoom < 10, `zoom ${view.zoom.toFixed(2)}`);
    assert.equal(view.pitch, 0); assert.equal(view.bearing, 0);
    assert.equal(shared.zoom, view.zoom, 'the shared view follows (provider switch)');
  });
}

test('wired in: on load before the opening hands over, and in London / Reset; computers keep CENTER / ZOOM', () => {
  assert.match(app, /fitPhoneToGreaterLondon\(\);[^\n]*\n\s*markIntroReady\(\);/);
  assert.match(app, /\$\('londonBtn'\)\.onclick=\(\)=>\{\n\s*if\(fitPhoneToGreaterLondon\(true\)\)return;/);
  assert.match(app, /\$\('resetBtn'\)\.onclick=[\s\S]{0,300}if\(fitPhoneToGreaterLondon\(\)\)\{/);
  assert.match(code, /if\(!IS_PHONE\)return false;/);
  assert.match(app, /const CENTER=\{lat:51\.5074,lng:-0\.1278\};\nconst ZOOM=10;/);
});
