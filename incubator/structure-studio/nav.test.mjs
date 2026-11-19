// 结构工作室 · 三维视口导航回归测试：node --test incubator/structure-studio/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const dir = new URL('.', import.meta.url), self = {};
new Function('self', 'module', readFileSync(new URL('engine/nav.js', dir), 'utf8'))(self, undefined);
const N = self.SS.nav, html = readFileSync(new URL('index.html', dir), 'utf8');
const near = (a, b, e = 1e-6, m = '') => assert.ok(Math.abs(a - b) < e, `${m} ${a} vs ${b}`);
const cams = () => [
  { az: -0.75, el: 0.55, dist: 3200, tx: 10, ty: -40, tz: 0, ortho: false }, { az: 2.1, el: 0.2, dist: 400, tx: 300, ty: 120, tz: 9, ortho: false },
  { az: -Math.PI / 2, el: Math.PI / 2, dist: 2000, tx: 0, ty: 0, tz: 0, ortho: true }, { az: 0.4, el: 0.9, dist: 900, tx: -50, ty: 60, tz: 0, ortho: true }];
const asp = 1.6;

test('camera frame is orthonormal, also looking straight down', () => {
  for (const c of cams()) { const B = N.basis(c); for (const k of ['f', 'r', 'u']) near(Math.hypot(...B[k]), 1);
    near(B.f[0] * B.r[0] + B.f[1] * B.r[1] + B.f[2] * B.r[2], 0); near(B.f[0] * B.u[0] + B.f[1] * B.u[1] + B.f[2] * B.u[2], 0); near(B.r[0] * B.u[0] + B.r[1] * B.u[1], 0); }
});
test('standard views: Top has north up, Front looks north, Right looks west', () => {
  const B = v => N.basis({ ...N.VIEWS[v], dist: 100, tx: 0, ty: 0, tz: 0 });
  near(B('top').u[1], 1, 1e-9); near(B('top').r[0], 1, 1e-9); near(B('top').f[2], -1, 1e-9);
  near(B('front').f[1], 1, 1e-9); near(B('front').u[2], 1, 1e-9); near(B('front').r[0], 1, 1e-9);
  near(B('right').f[0], -1, 1e-9); near(B('right').u[2], 1, 1e-9); near(B('right').r[1], 1, 1e-9);
  assert.ok(N.VIEWS.top.ortho && N.VIEWS.front.ortho && N.VIEWS.right.ortho && !N.VIEWS.persp.ortho);
});
test('pick and project are inverse', () => {
  for (const c of cams()) for (const [x, y] of [[0, 0], [0.5, -0.3], [-0.8, -0.6]]) { const h = N.pick(c, x, y, asp), q = N.project(c, h.p, asp); near(q[0], x, 1e-6); near(q[1], y, 1e-6); assert.ok(q[2] > 0); }
});
test('wheel zoom keeps the point under the cursor fixed', () => {
  for (const c of cams()) for (const k of [0.6, 1.7]) { const h = N.pick(c, 0.4, -0.5, asp), d0 = c.dist; N.zoomAt(c, k, h.p); const q = N.project(c, h.p, asp);
    near(q[0], 0.4, 1e-6, 'x'); near(q[1], -0.5, 1e-6, 'y'); near(c.dist, d0 * k, 1e-6); }
  const c = cams()[0]; N.zoomAt(c, 1e-9, [0, 0, 0]); assert.equal(c.dist, N.DMIN); N.zoomAt(c, 1e9, [0, 0, 0]); assert.equal(c.dist, N.DMAX);
});
test('pan drags the grabbed point with the cursor', () => {
  for (const c of cams()) { const h = N.pick(c, -0.2, -0.4, asp); N.pan(c, 0.3, 0.25, asp, h.depth); const q = N.project(c, h.p, asp); near(q[0], 0.1, 1e-6, 'x'); near(q[1], -0.15, 1e-6, 'y'); }
});
test('orbit turns the camera around the picked point', () => {
  for (const c of cams()) { const h = N.pick(c, 0.3, -0.5, asp), a0 = c.az, e0 = c.el, d0 = c.dist; N.orbit(c, 0.4, -0.15, h.p); const q = N.project(c, h.p, asp);
    near(q[0], 0.3, 1e-6, 'x'); near(q[1], -0.5, 1e-6, 'y'); near(c.az, a0 + 0.4); near(c.el, e0 - 0.15); near(c.dist, d0); }
  const c = cams()[0]; N.orbit(c, 0, 9); near(c.el, Math.PI / 2); N.orbit(c, 0, -9); assert.ok(c.el > -Math.PI / 2 && c.el < -1.5);
});
test('zoom extents puts the whole box on screen, touching the frame', () => {
  const box = [-900, -600, 0, 1100, 700, 160];
  for (const c of cams()) for (const a of [0.7, 1.6]) { N.fit(c, box, a, 1); let mx = 0;
    for (let i = 0; i < 8; i++) { const q = N.project(c, [box[i & 1 ? 3 : 0], box[i & 2 ? 4 : 1], box[i & 4 ? 5 : 2]], a); assert.ok(q[2] > 0); mx = Math.max(mx, Math.abs(q[0]), Math.abs(q[1])); }
    assert.ok(mx <= 1 + 1e-6 && mx > 0.75, 'fit ' + mx); }
});
test('smoothing converges, takes the short way round, and is frame-rate independent', () => {
  const goal = { az: 0.1, el: 0.5, dist: 800, tx: 5, ty: 6, tz: 7, ortho: true }, cur = { az: 0.1 + 4 * Math.PI + 0.3, el: 0.2, dist: 3000, tx: 0, ty: 0, tz: 0, ortho: false };
  N.step(cur, goal, 0.016, 0.1); assert.ok(Math.abs(cur.az - goal.az) < 0.3, 'no extra turns'); assert.equal(cur.ortho, true);
  let n = 0; while (N.step(cur, goal, 0.016, 0.1) && n < 2000) n++; assert.ok(n < 200); for (const k of ['az', 'el', 'dist', 'tx', 'ty', 'tz']) near(cur[k], goal[k], 1e-3);
  const A = { az: 0, el: 0, dist: 100, tx: 0, ty: 0, tz: 0 }, B = { ...A }, g = { az: 1, el: 1, dist: 900, tx: 50, ty: 0, tz: 0 };
  N.step(A, g, 0.1, 0.1); for (let i = 0; i < 10; i++) N.step(B, g, 0.01, 0.1); near(A.tx, B.tx, 1e-9); near(A.dist, B.dist, 1e-9);
  N.step(A, g, 0.016, 0); near(A.tx, 50); near(A.dist, 900);
});
test('the page uses the navigation module', () => {
  for (const k of ['engine/nav.js', 'id="vpLabel"', 'id="vpMenu"', 'id="axis"', 'function setView(', 'function setShade(', 'function zoomExtents(', 'THREE.OrthographicCamera']) assert.ok(html.includes(k), k);
});
