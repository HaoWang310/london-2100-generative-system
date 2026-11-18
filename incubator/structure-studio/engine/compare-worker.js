// 方案比较的后台线程：场地只准备一次，之后一次算一个方案（主线程逐个发，便于中途停止、按第一轮结果决定第二轮）
importScripts('structure.js');
let site = null;
onmessage = e => {
  const m = e.data;
  try {
    if (m.type === 'site') { site = self.SS.prepareSite(m.snap); postMessage({ type: 'ready' }); return; }
    if (m.type === 'run') {
      const t = performance.now(), F = self.SS.buildStructure(site, m.P, new Set()), s = self.SS.scoreStructure(F, m.w);
      postMessage({ type: 'done', id: m.id, score: { groups: s.groups, raw: s.raw, fail: s.fail, warn: s.warn }, sketch: self.SS.runSketch(F), cells: F.cells.length, ms: performance.now() - t });
    }
  } catch (err) { postMessage({ type: 'error', id: m.id, message: String(err && err.message || err) }); }
};
