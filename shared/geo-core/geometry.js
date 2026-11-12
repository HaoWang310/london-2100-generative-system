// Planar geometry in EPSG:27700 metres. Points are [E, N].
// Rings are arrays of points WITHOUT a repeated closing point.

export const dist = (a, b) => Math.hypot(b[0] - a[0], b[1] - a[1]);
export const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];

export function polylineLength(line) {
  let s = 0;
  for (let i = 1; i < line.length; i++) s += dist(line[i - 1], line[i]);
  return s;
}

/** Signed area (positive = counter-clockwise). */
export function signedArea(ring) {
  let s = 0;
  for (let i = 0, n = ring.length; i < n; i++) {
    const [x1, y1] = ring[i], [x2, y2] = ring[(i + 1) % n];
    s += x1 * y2 - x2 * y1;
  }
  return s / 2;
}
export const area = ring => Math.abs(signedArea(ring));

export function centroid(ring) {
  let cx = 0, cy = 0, a = 0;
  for (let i = 0, n = ring.length; i < n; i++) {
    const [x1, y1] = ring[i], [x2, y2] = ring[(i + 1) % n];
    const f = x1 * y2 - x2 * y1;
    cx += (x1 + x2) * f; cy += (y1 + y2) * f; a += f;
  }
  if (Math.abs(a) < 1e-9) {
    const n = ring.length;
    return [ring.reduce((s, p) => s + p[0], 0) / n, ring.reduce((s, p) => s + p[1], 0) / n];
  }
  return [cx / (3 * a), cy / (3 * a)];
}

export function bbox(points) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const [x, y] of points) {
    if (x < minX) minX = x; if (y < minY) minY = y;
    if (x > maxX) maxX = x; if (y > maxY) maxY = y;
  }
  return [minX, minY, maxX, maxY];
}

export function pointInPolygon([x, y], ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

export function circleRing(center, radius, segments = 128) {
  const ring = [];
  for (let i = 0; i < segments; i++) {
    const t = (i / segments) * Math.PI * 2;
    ring.push([center[0] + radius * Math.cos(t), center[1] + radius * Math.sin(t)]);
  }
  return ring;
}

export function rectRing(minX, minY, maxX, maxY) {
  return [[minX, minY], [maxX, minY], [maxX, maxY], [minX, maxY]];
}

const ccw = ring => (signedArea(ring) < 0 ? ring.slice().reverse() : ring);

/**
 * Clip a subject polygon by a CONVEX clip polygon (Sutherland–Hodgman).
 * Returns [] when there is no overlap.
 */
export function clipPolygonConvex(subject, clip) {
  const c = ccw(clip);
  let out = subject.slice();
  for (let i = 0; i < c.length && out.length; i++) {
    const a = c[i], b = c[(i + 1) % c.length];
    const inside = p => (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]) >= 0;
    const cross = (p, q) => {
      const dx = q[0] - p[0], dy = q[1] - p[1];
      const ex = b[0] - a[0], ey = b[1] - a[1];
      const den = dx * ey - dy * ex;
      const t = ((a[0] - p[0]) * ey - (a[1] - p[1]) * ex) / den;
      return [p[0] + dx * t, p[1] + dy * t];
    };
    const input = out; out = [];
    for (let j = 0; j < input.length; j++) {
      const p = input[j], q = input[(j + 1) % input.length];
      const pin = inside(p), qin = inside(q);
      if (pin) out.push(p);
      if (pin !== qin) out.push(cross(p, q));
    }
  }
  return out.length >= 3 ? out : [];
}

/** Clip segment p->q to a CONVEX polygon (Cyrus–Beck). Returns [p', q'] or null. */
export function clipSegmentConvex(p, q, clip) {
  const c = ccw(clip);
  let t0 = 0, t1 = 1;
  const d = [q[0] - p[0], q[1] - p[1]];
  for (let i = 0; i < c.length; i++) {
    const a = c[i], b = c[(i + 1) % c.length];
    const n = [-(b[1] - a[1]), b[0] - a[0]]; // inward normal for CCW ring
    const num = n[0] * (p[0] - a[0]) + n[1] * (p[1] - a[1]);
    const den = n[0] * d[0] + n[1] * d[1];
    if (Math.abs(den) < 1e-12) { if (num < 0) return null; continue; }
    const t = -num / den;
    if (den > 0) t0 = Math.max(t0, t); else t1 = Math.min(t1, t);
    if (t0 > t1) return null;
  }
  return [lerp(p, q, t0), lerp(p, q, t1)];
}

/** Closest point on segment ab to p, with its distance. */
export function closestOnSegment(p, a, b) {
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const l2 = dx * dx + dy * dy;
  const t = l2 ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l2)) : 0;
  const c = [a[0] + dx * t, a[1] + dy * t];
  return { point: c, t, d: dist(p, c) };
}

export function closestOnPolyline(p, line) {
  let best = { d: Infinity, point: null, index: -1 };
  for (let i = 1; i < line.length; i++) {
    const r = closestOnSegment(p, line[i - 1], line[i]);
    if (r.d < best.d) best = { ...r, index: i - 1 };
  }
  return best;
}

/** Proper intersection of segments ab and cd (excluding shared endpoints). */
export function segmentIntersection(a, b, c, d) {
  const r = [b[0] - a[0], b[1] - a[1]], s = [d[0] - c[0], d[1] - c[1]];
  const den = r[0] * s[1] - r[1] * s[0];
  if (Math.abs(den) < 1e-12) return null;
  const t = ((c[0] - a[0]) * s[1] - (c[1] - a[1]) * s[0]) / den;
  const u = ((c[0] - a[0]) * r[1] - (c[1] - a[1]) * r[0]) / den;
  const eps = 1e-9;
  if (t <= eps || t >= 1 - eps || u <= eps || u >= 1 - eps) return null;
  return [a[0] + r[0] * t, a[1] + r[1] * t];
}

/** Truncate a polyline to a fraction (0..1) of its length. Used by the timeline. */
export function truncatePolyline(line, fraction) {
  if (fraction >= 1) return line;
  if (fraction <= 0 || line.length < 2) return [line[0], line[0]];
  const target = polylineLength(line) * fraction;
  const out = [line[0]];
  let run = 0;
  for (let i = 1; i < line.length; i++) {
    const seg = dist(line[i - 1], line[i]);
    if (run + seg >= target) {
      out.push(lerp(line[i - 1], line[i], (target - run) / seg));
      return out;
    }
    run += seg; out.push(line[i]);
  }
  return out;
}
