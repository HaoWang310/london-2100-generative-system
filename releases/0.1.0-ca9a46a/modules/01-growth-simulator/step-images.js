// 01 · Growth simulator — the images the steps lay under the parcels (panel's 生成流程):
// the ground layers (step 2), the magnet field (step 5) and the first pass's edge (step 7).
// Each is a canvas plus the BNG rectangle [e0, n1, e1, n0] it covers, for overlay.setImage.

import { classAt } from './cells.js?v=ca9a46a';

// The incubator's ground layers, bottom to top. Its PNGs are greys for a black page; on the
// OSM basemap (itself grey) each is tinted so it can be told apart. Labels: controls.js I18N.
export const GROUND = [
  ['aonb', 'National Landscape', '#4f7a45', 0.55], ['towns', 'Existing towns', '#a7a7ad', 0.55],
  ['absorbed', 'Towns the loop absorbs', '#d9b98a', 0.75], ['water', 'Water', '#4d86b3', 0.8], ['belt', 'Green Belt boundary', '#9fd18a', 0.9]
];
// the incubator's warm ramp for the magnet field
const WARM = [[0, 0, 0], [42, 22, 13], [110, 48, 25], [194, 82, 58], [239, 166, 92], [242, 217, 158]];

const canvas = (w, h) => (typeof OffscreenCanvas === 'function' ? new OffscreenCanvas(w, h) : Object.assign(document.createElement('canvas'), { width: w, height: h }));
export const gridRect = m => [m.XMIN, m.YMAX, m.XMIN + m.NX * m.C, m.YMAX - m.NY * m.C];

function ramp(stops, t) {
  const x = Math.max(0, Math.min(1, t)) * (stops.length - 1), i = Math.min(stops.length - 2, Math.floor(x)), f = x - i;
  return stops[i].map((v, k) => v + (stops[i + 1][k] - v) * f);
}

/** The incubator's ground layers (already coloured PNGs over D.view), stacked into one canvas. */
export async function groundImage(D, base) {
  const V = D.view, ims = await Promise.all(GROUND.map(([n]) => new Promise(res => {
    const im = new Image(); im.crossOrigin = 'anonymous';
    im.onload = () => res(im); im.onerror = () => res(null); im.src = new URL(D.layers[n], base).href;
  })));
  const c = canvas(V.W, V.H), g = c.getContext('2d');
  const t = canvas(V.W, V.H), tg = t.getContext('2d');
  ims.forEach((im, k) => {
    if (!im) return;
    tg.globalCompositeOperation = 'copy'; tg.drawImage(im, 0, 0, V.W, V.H);           // the layer's shape (its alpha) ...
    tg.globalCompositeOperation = 'source-in'; tg.fillStyle = GROUND[k][2]; tg.fillRect(0, 0, V.W, V.H);   // ... in its colour
    g.globalAlpha = GROUND[k][3]; g.drawImage(t, 0, 0);
  });
  g.globalAlpha = 1;
  return { canvas: c, rect: [V.e0, V.n1, V.e1, V.n0] };
}

/** The magnet field: bytes 1..255 from the worker (0 = never built), on the warm ramp. */
export function magnetImage(meta, bytes) {
  const { NX, NY } = meta, c = canvas(NX, NY), g = c.getContext('2d'), img = g.createImageData(NX, NY), px = new Uint32Array(img.data.buffer), lut = new Uint32Array(256);
  for (let i = 1; i < 256; i++) { const r = ramp(WARM, (i - 1) / 254); lut[i] = (255 << 24 | Math.round(r[2]) << 16 | Math.round(r[1]) << 8 | Math.round(r[0])) >>> 0; }
  for (let i = 0; i < bytes.length; i++) if (bytes[i]) px[i] = lut[bytes[i]];
  g.putImageData(img, 0, 0);
  return { canvas: c, rect: gridRect(meta) };
}

/** The outline of the settlements at year index y: built share over 9 x 9 parcels >= 1/4 (as the incubator). */
export function edgeImage(meta, cells, y = 75) {
  const { NX, NY } = meta, N = NX * NY, r = 4, row = new Uint16Array(N), mac = new Uint8Array(N);
  const built = i => { const t = classAt(cells, i, y); return t >= 1 && t <= 3; };
  for (let i = 0; i < NY; i++) {
    const b0 = i * NX; let s = 0;
    for (let j = 0; j <= r; j++) if (built(b0 + j)) s++;
    for (let j = 0; j < NX; j++) {
      row[b0 + j] = s;
      if (j + r + 1 < NX && built(b0 + j + r + 1)) s++;
      if (j - r >= 0 && built(b0 + j - r)) s--;
    }
  }
  for (let j = 0; j < NX; j++) {
    let s = 0; for (let i = 0; i <= r; i++) s += row[i * NX + j];
    for (let i = 0; i < NY; i++) {
      mac[i * NX + j] = s >= 20 ? 1 : 0;
      if (i + r + 1 < NY) s += row[(i + r + 1) * NX + j];
      if (i - r >= 0) s -= row[(i - r) * NX + j];
    }
  }
  const c = canvas(NX, NY), g = c.getContext('2d'), img = g.createImageData(NX, NY), px = new Uint32Array(img.data.buffer);
  const ice = (255 << 24 | 255 << 16 | 209 << 8 | 127) >>> 0;
  for (let i = 1; i < NY - 1; i++) for (let j = 1; j < NX - 1; j++) {
    const q = i * NX + j;
    if (mac[q] && (!mac[q - 1] || !mac[q + 1] || !mac[q - NX] || !mac[q + NX]))
      for (let di = -1; di <= 1; di++) for (let dj = -1; dj <= 1; dj++) px[q + di * NX + dj] = ice;   // three parcels wide, to read at city scale
  }
  g.putImageData(img, 0, 0);
  return { canvas: c, rect: gridRect(meta) };
}
