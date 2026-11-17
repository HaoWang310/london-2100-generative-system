// 结构工作室 · 张量场快照导出
// 用法：在张量场工作室（incubator/tensor-studio/）里跑完全流程（第 8 步完成），打开浏览器开发者工具的控制台，粘贴本文件全部内容回车，
// 会下载 <场地>.snapshot.json，放进 incubator/structure-studio/assets/ 即可在结构工作室里打开。
// Usage: run Tensor Studio to the end, paste this file into the browser console; it downloads a snapshot for Structure Studio.
(function exportStructureSnapshot(step = 10) {
  const T = window.__ts6; if (!T) throw new Error('not in Tensor Studio');
  const R = T.roadNet(); if (!R) throw new Error('run the whole process first (step 8)');
  const D = T.D, r1 = v => Math.round(v * 10) / 10, P = pts => pts.map(q => [r1(q[0]), r1(q[1])]);
  // 张量场主方向：step 米一格，0–180° 量化到 0–254，255 = 场外
  const nx = Math.ceil(D.w / step) + 1, ny = Math.ceil(D.h / step) + 1, f = new Uint8Array(nx * ny);
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) { const a = typeof fieldAtT === 'function' ? fieldAtT(i * step, j * step) : null;
    f[j * nx + i] = a == null ? 255 : Math.round((((a % Math.PI) + Math.PI) % Math.PI) / Math.PI * 254); }
  let bin = ''; for (let i = 0; i < f.length; i++) bin += String.fromCharCode(f[i]);
  const snap = {
    format: 'structure-studio/snapshot@1', source: 'tensor-studio', exported: new Date().toISOString(),
    site: D.station ? 'station-p2' : 'london-site', origin: D.origin, crs: 'EPSG:27700 (local metres = BNG − origin)', w: D.w, h: D.h,
    pieces: D.pieces.map(p => ({ outer: P(p.outer), holes: (p.holes || []).map(P) })),
    water: (D.ctx.water || []).map(w => w.map(P)), streams: (D.ctx.streams || []).map(P),
    attractors: T.attr.map(a => ({ x: a.x, y: a.y, kind: a.kind })),
    roads: R.streets.map(s => ({ id: s.id, grade: s.grade, level: s.level, width: s.width, pts: P(s.pts) })),
    junctions: R.junctions.map(j => ({ x: r1(j.x), y: r1(j.y), type: j.type })), stats: R.stats,
    field: { step, nx, ny, enc: 'u8 angle*254/pi, 255 = none', data: btoa(bin) },
  };
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(snap)], { type: 'application/json' })); a.download = snap.site + '.snapshot.json'; a.click();
  return snap;
})();
