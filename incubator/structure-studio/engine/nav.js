// 结构工作室 · 三维视口导航（参考 Rhino 的视口操作）
// 纯数学，不依赖 three.js：镜头状态 c = { az, el, dist, tx, ty, tz, ortho }，Z 轴朝上。
//   az / el  镜头绕目标点的方位角、仰角；dist 镜头到目标点的距离；ortho = 平行投影。
// 规则：滚轮缩放以光标下的点为中心；平移时抓住的点跟着光标走；旋转绕光标下的点；
//       平行投影和透视投影共用同一组状态（平行视图的半高 = dist · tan(fov/2)，切换投影时大小不跳）。
(function (root) {
'use strict';
const FOV = 36, TH = Math.tan(FOV * Math.PI / 360), HP = Math.PI / 2;
const DMIN = 6, DMAX = 12000, ELMIN = -HP + 0.02, ELMAX = HP;
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const add = (a, b, k = 1) => [a[0] + b[0] * k, a[1] + b[1] * k, a[2] + b[2] * k], sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const tgt = c => [c.tx, c.ty, c.tz];
const VIEWS = {   // Rhino 的标准视图：顶视图北朝上
  persp: { az: -0.75, el: 0.55, ortho: false }, top: { az: -HP, el: HP, ortho: true }, front: { az: -HP, el: 0, ortho: true },
  right: { az: 0, el: 0, ortho: true }, back: { az: HP, el: 0, ortho: true }, left: { az: Math.PI, el: 0, ortho: true },
};

// 镜头坐标系：d 目标→镜头，f 视线，r 屏幕右，u 屏幕上（仰角 90° 时也有定义，顶视图不会翻转）
function basis(c) {
  const ca = Math.cos(c.az), sa = Math.sin(c.az), ce = Math.cos(c.el), se = Math.sin(c.el);
  const d = [ce * ca, ce * sa, se];
  return { d, f: [-d[0], -d[1], -d[2]], r: [-sa, ca, 0], u: [-ca * se, -sa * se, ce] };
}
function eye(c) { return add(tgt(c), basis(c).d, c.dist); }
function halfH(c) { return c.dist * TH; }

// 屏幕点（nx, ny ∈ [-1, 1]，ny 向上）对应的射线
function ray(c, nx, ny, asp) {
  const B = basis(c), e = eye(c), hh = halfH(c);
  if (c.ortho) return { o: add(add(e, B.r, nx * hh * asp), B.u, ny * hh), dir: B.f };
  const v = add(add(B.f, B.r, nx * TH * asp), B.u, ny * TH), l = Math.hypot(v[0], v[1], v[2]);
  return { o: e, dir: [v[0] / l, v[1] / l, v[2] / l] };
}
// 光标下的点：先打到地面（z = z0），太远或打不到就用过目标点、垂直视线的平面
function pick(c, nx, ny, asp, z0 = 0) {
  const R = ray(c, nx, ny, asp), B = basis(c), e = eye(c);
  if (Math.abs(R.dir[2]) > 1e-6) { const t = (z0 - R.o[2]) / R.dir[2];
    if (t > 0) { const p = add(R.o, R.dir, t), depth = dot(sub(p, e), B.f); if (depth > 0 && depth < 6 * c.dist) return { p, depth, ground: true }; } }
  const t = c.ortho ? c.dist : c.dist / dot(R.dir, B.f);
  return { p: add(R.o, R.dir, t), depth: c.dist, ground: false };
}
// 世界点 → 屏幕（nx, ny），z 为沿视线的深度
function project(c, p, asp) {
  const B = basis(c), v = sub(p, eye(c)), x = dot(v, B.r), y = dot(v, B.u), z = dot(v, B.f), hh = halfH(c);
  return c.ortho ? [x / (hh * asp), y / hh, z] : [x / (z * TH * asp), y / (z * TH), z];
}
// 缩放 k 倍（k < 1 拉近），P 在屏幕上不动
function zoomAt(c, k, P) {
  const nd = clamp(c.dist * k, DMIN, DMAX), kk = nd / c.dist; P = P || tgt(c);
  c.tx = P[0] + (c.tx - P[0]) * kk; c.ty = P[1] + (c.ty - P[1]) * kk; c.tz = P[2] + (c.tz - P[2]) * kk; c.dist = nd; return c;
}
// 平移：光标移动 (dnx, dny)，深度为 depth 的点跟着光标走
function pan(c, dnx, dny, asp, depth) {
  const B = basis(c), s = c.ortho ? halfH(c) : (depth || c.dist) * TH, mx = -dnx * asp * s, my = -dny * s;
  c.tx += B.r[0] * mx + B.u[0] * my; c.ty += B.r[1] * mx + B.u[1] * my; c.tz += B.r[2] * mx + B.u[2] * my; return c;
}
// 旋转：方位角 +daz、仰角 +del，绕 pivot（默认绕目标点）。整台镜头绕 pivot 刚体转动，pivot 在屏幕上不动
function orbit(c, daz, del, pivot) {
  const el1 = clamp(c.el + del, ELMIN, ELMAX); del = el1 - c.el;
  if (pivot) { const B = basis(c), k = B.r; let v = sub(tgt(c), pivot);
    const cs = Math.cos(-del), sn = Math.sin(-del), kv = cross(k, v), kd = dot(k, v) * (1 - cs);
    v = [v[0] * cs + kv[0] * sn + k[0] * kd, v[1] * cs + kv[1] * sn + k[1] * kd, v[2] * cs + kv[2] * sn + k[2] * kd];
    const cz = Math.cos(daz), sz = Math.sin(daz);
    c.tx = pivot[0] + v[0] * cz - v[1] * sz; c.ty = pivot[1] + v[0] * sz + v[1] * cz; c.tz = pivot[2] + v[2]; }
  c.az += daz; c.el = el1; return c;
}
// 缩放至范围（Rhino 的 Zoom Extents）：保持视角，把包围盒 [x0,y0,z0,x1,y1,z1] 放进画面
function fit(c, box, asp, margin = 1.08) {
  const B = basis(c), m = [(box[0] + box[3]) / 2, (box[1] + box[4]) / 2, (box[2] + box[5]) / 2]; let need = 0;
  for (let i = 0; i < 8; i++) { const v = sub([box[i & 1 ? 3 : 0], box[i & 2 ? 4 : 1], box[i & 4 ? 5 : 2]], m), x = Math.abs(dot(v, B.r)), y = Math.abs(dot(v, B.u)), z = dot(v, B.f);
    const D = Math.max(x / (TH * asp), y / TH) - (c.ortho ? 0 : z); if (D > need) need = D; }
  c.tx = m[0]; c.ty = m[1]; c.tz = m[2]; c.dist = clamp(need * margin, DMIN, DMAX); return c;
}
// 平滑跟随：cur 向 goal 靠拢（时间常数 tau 秒）；方位角走最短的那一边
function step(cur, goal, dt, tau) {
  const a = tau > 0 ? 1 - Math.exp(-dt / tau) : 1; let moving = false;
  cur.az += Math.round((goal.az - cur.az) / (2 * Math.PI)) * 2 * Math.PI;
  for (const k of ['az', 'el', 'tx', 'ty', 'tz']) { const d = goal[k] - cur[k]; if (Math.abs(d) > 1e-5) { cur[k] += d * a; moving = true; } else cur[k] = goal[k]; }
  const ld = Math.log(goal.dist / cur.dist); if (Math.abs(ld) > 1e-5) { cur.dist *= Math.exp(ld * a); moving = true; } else cur.dist = goal.dist;   // 距离按比例插值，缩放手感均匀
  cur.ortho = !!goal.ortho; return moving;
}
const copy = c => ({ az: c.az, el: c.el, dist: c.dist, tx: c.tx, ty: c.ty, tz: c.tz, ortho: !!c.ortho, view: c.view });
const API = { FOV, TH, DMIN, DMAX, VIEWS, basis, eye, halfH, ray, pick, project, zoomAt, pan, orbit, fit, step, copy };
if (typeof module !== 'undefined' && module.exports) module.exports = API; else { root.SS = root.SS || {}; root.SS.nav = API; }
})(typeof self !== 'undefined' ? self : this);
