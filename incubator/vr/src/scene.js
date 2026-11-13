// A scene file (docs/SCENE-FORMAT.md) → the read-only handle the viewer expects.
// The same handle can later come straight from a running Tensor Studio, so the viewer never changes.

export function checkScene(s){
  const bad = m => { throw new Error('scene: ' + m); };
  if (!s || s.format !== 'london-2100-vr/scene') bad('format must be "london-2100-vr/scene"');
  if (s.version !== 1) bad('only version 1 is understood (got ' + s.version + ')');
  const g = s.grid; if (!g || !(g.nx > 1) || !(g.ny > 1) || !(g.cell > 0)) bad('grid {nx, ny, cell} missing');
  const N = g.nx * g.ny;
  for (const k of ['Z', 'land', 'flood']) if (s[k] != null && s[k].length !== N) bad(k + ' must have nx × ny = ' + N + ' values (has ' + s[k].length + ')');
  if (!Array.isArray(s.streets)) bad('streets must be a list');
  return s;
}

export function apiFromScene(s){
  checkScene(s);
  const Z = s.Z ? Float32Array.from(s.Z) : null, land = s.land ? Uint8Array.from(s.land) : null, flood = s.flood ? Uint8Array.from(s.flood) : null;
  const streets = s.streets.map(st => ({ pts: st.pts, w: st.w ?? (st.level === 1 ? 14 : 8), level: st.level }));
  return {
    D: { landMask: land, fixed: { streets: s.fixed || [], bridges: s.bridges || [] } },
    nx: s.grid.nx, ny: s.grid.ny, cell: s.grid.cell,
    ENV: Z ? { Z } : null, FR: flood,
    streets: () => streets,
    lines: () => streets.map(st => ({ pts: st.pts, level: st.level, dead: false })),
    finished: () => true
  };
}
