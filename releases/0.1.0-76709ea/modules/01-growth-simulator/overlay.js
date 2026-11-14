// 01 · Growth simulator — drawing the growth on the map.
//
// MapLibre: one WebGL custom layer. The parcel records (cells.js) go to the GPU
// once per run as a 3000 x 2460 texture; the year is a uniform, so playback
// costs nothing per frame. The texture is drawn through the exact mesh of
// georef.js, below the map's labels and the workspace's roads. When a parcel
// is 6 px or larger on screen, a fine outline marks each 50 m parcel.
// The loop's rails and stations are ordinary MapLibre line / circle layers.
//
// Canvas fallback (no MapLibre): the same classes painted into a 3000 x 2460
// image, drawn in EPSG:27700 straight onto the fallback view.

import { gridMesh, gridFrame, lineToLL } from './georef.js?v=76709ea';
import { classAt } from './cells.js?v=76709ea';
import { toWGS84 } from '../../shared/geo-core/index.js?v=76709ea';

export const PALETTE = { 1: '#F2D99E', 2: '#EFA65C', 3: '#E8684A', 4: '#5E6A48', 5: '#A9B57F' };
const rgb = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16) / 255);

const VS = `
attribute vec2 a_pos; attribute vec2 a_uv;
uniform mat4 u_matrix; varying vec2 v_uv;
void main() { v_uv = a_uv; gl_Position = u_matrix * vec4(a_pos, 0.0, 1.0); }`;

const FS = `
precision highp float;
uniform sampler2D u_cells; uniform vec2 u_grid; uniform float u_year; uniform float u_opacity; uniform float u_edge;
uniform vec3 u_c1; uniform vec3 u_c2; uniform vec3 u_c3; uniform vec3 u_c4; uniform vec3 u_c5;
uniform float u_show; varying vec2 v_uv;
void main() {
  if (v_uv.x < 0.0 || v_uv.y < 0.0 || v_uv.x >= 1.0 || v_uv.y >= 1.0) discard;
  vec2 cell = floor(v_uv * u_grid);
  vec4 c = floor(texture2D(u_cells, (cell + 0.5) / u_grid) * 255.0 + 0.5);
  float y = u_year + 0.5;
  float k = 0.0;
  if (c.a < y) k = 3.0; else if (c.b < y) k = 2.0; else if (c.r > 0.5 && c.g < y) k = c.r;
  if (k < 0.5) discard;
  vec3 col = k < 1.5 ? u_c1 : k < 2.5 ? u_c2 : k < 3.5 ? u_c3 : k < 4.5 ? u_c4 : u_c5;
  float a = u_opacity * (k < 3.5 ? 1.0 : 0.85) * u_show;
  if (u_edge > 0.0) {
    vec2 f = fract(v_uv * u_grid);
    float d = min(min(f.x, 1.0 - f.x), min(f.y, 1.0 - f.y));
    col *= mix(0.55, 1.0, smoothstep(0.0, u_edge, d));
  }
  gl_FragColor = vec4(col * a, a);
}`;

const multiply = (a, b) => {            // column-major 4x4, in double precision
  const o = new Float64Array(16);
  for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) {
    let s = 0; for (let k = 0; k < 4; k++) s += a[k * 4 + j] * b[i * 4 + k]; o[i * 4 + j] = s;
  }
  return o;
};

/**
 * The growth overlay. `get()` returns { cells, year, show } for what is shown now:
 * cells = Uint8Array parcel records or null, year = 0..75, show = boolean.
 */
export function createGrowthOverlay({ meta, rails, stations, get, opacity = 0.9 }) {   // stations: meta.NODES [name, kind P/S/A, E, N]
  const f = gridFrame(meta);
  const mesh = gridMesh(meta);
  let map = null, gl = null, prog = null, buf = null, ibuf = null, tex = null, vao = null, vaoApi = null;
  let uploaded = null, opts = { opacity, edges: true, rails: true };
  let beforeId;

  // ------------------------------------------------------------ MapLibre
  const layer = {
    id: 'g01-growth', type: 'custom', renderingMode: '2d',
    onAdd(m, context) {
      gl = context;
      const sh = (type, src) => {
        const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
        if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
        return s;
      };
      prog = gl.createProgram();
      gl.attachShader(prog, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FS));
      gl.linkProgram(prog);
      if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
      const inter = new Float32Array(mesh.pos.length * 2);
      for (let i = 0; i < mesh.pos.length / 2; i++) inter.set([mesh.pos[i * 2], mesh.pos[i * 2 + 1], mesh.uv[i * 2], mesh.uv[i * 2 + 1]], i * 4);
      buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf); gl.bufferData(gl.ARRAY_BUFFER, inter, gl.STATIC_DRAW);
      ibuf = gl.createBuffer();
      // Own vertex array: MapLibre keeps its own bound (same approach as google-map-live's custom layers).
      if (typeof gl.createVertexArray === 'function') {
        vaoApi = { create: () => gl.createVertexArray(), bind: v => gl.bindVertexArray(v), current: () => gl.getParameter(gl.VERTEX_ARRAY_BINDING) };
      } else {
        const ext = gl.getExtension('OES_vertex_array_object');
        if (ext) vaoApi = { create: () => ext.createVertexArrayOES(), bind: v => ext.bindVertexArrayOES(v), current: () => gl.getParameter(ext.VERTEX_ARRAY_BINDING_OES) };
      }
      const prev = vaoApi?.current();
      if (vaoApi) { vao = vaoApi.create(); vaoApi.bind(vao); }
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibuf); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, mesh.index, gl.STATIC_DRAW);
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      const aPos = gl.getAttribLocation(prog, 'a_pos'), aUv = gl.getAttribLocation(prog, 'a_uv');
      gl.enableVertexAttribArray(aPos); gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 16, 0);
      gl.enableVertexAttribArray(aUv); gl.vertexAttribPointer(aUv, 2, gl.FLOAT, false, 16, 8);
      if (vaoApi) vaoApi.bind(prev || null);
      tex = gl.createTexture();
      uploaded = null;
    },
    onRemove() {
      if (!gl) return;
      gl.deleteBuffer(buf); gl.deleteBuffer(ibuf); gl.deleteTexture(tex); gl.deleteProgram(prog);
      gl = null; uploaded = null;
    },
    render(context, args) {
      const g = get();
      if (!g.show || !g.cells || !gl) return;
      if (uploaded !== g.cells) {
        gl.bindTexture(gl.TEXTURE_2D, tex);
        gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, f.nx, f.ny, 0, gl.RGBA, gl.UNSIGNED_BYTE, g.cells);
        for (const [k, v] of [[gl.TEXTURE_MIN_FILTER, gl.NEAREST], [gl.TEXTURE_MAG_FILTER, gl.NEAREST], [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE]]) gl.texParameteri(gl.TEXTURE_2D, k, v);
        uploaded = g.cells;
      }
      // MapLibre 6: modelViewProjectionMatrix works in world pixels (mercator x 512 x 2^zoom);
      // older builds hand over a mercator matrix. Vertices are relative to the mesh origin.
      let main = args?.modelViewProjectionMatrix, scale = 512 * Math.pow(2, map.getZoom());
      if (!main) { main = args?.defaultProjectionData?.mainMatrix || args; scale = 1; }
      const T = new Float64Array([scale, 0, 0, 0, 0, scale, 0, 0, 0, 0, 1, 0, mesh.origin[0] * scale, mesh.origin[1] * scale, 0, 1]);
      const matrix = new Float32Array(multiply(main, T));
      // pixels per 50 m parcel at the grid's centre: outline parcels once they are 6 px or more
      const ppm = 512 * Math.pow(2, map.getZoom()) / (40075016.686 * Math.cos(51.5 * Math.PI / 180)) * (globalThis.devicePixelRatio || 1);
      const cellPx = ppm * meta.C;
      const prev = vaoApi?.current();
      gl.useProgram(prog);
      if (vaoApi) vaoApi.bind(vao);
      else {
        gl.bindBuffer(gl.ARRAY_BUFFER, buf); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibuf);
        const aPos = gl.getAttribLocation(prog, 'a_pos'), aUv = gl.getAttribLocation(prog, 'a_uv');
        gl.enableVertexAttribArray(aPos); gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 16, 0);
        gl.enableVertexAttribArray(aUv); gl.vertexAttribPointer(aUv, 2, gl.FLOAT, false, 16, 8);
      }
      gl.uniformMatrix4fv(gl.getUniformLocation(prog, 'u_matrix'), false, matrix);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.uniform1i(gl.getUniformLocation(prog, 'u_cells'), 0);
      gl.uniform2f(gl.getUniformLocation(prog, 'u_grid'), f.nx, f.ny);
      gl.uniform1f(gl.getUniformLocation(prog, 'u_year'), g.year);
      gl.uniform1f(gl.getUniformLocation(prog, 'u_opacity'), opts.opacity);
      gl.uniform1f(gl.getUniformLocation(prog, 'u_show'), 1);
      gl.uniform1f(gl.getUniformLocation(prog, 'u_edge'), opts.edges && cellPx >= 6 ? Math.min(0.12, 1.2 / cellPx) : 0);
      for (const k of [1, 2, 3, 4, 5]) gl.uniform3fv(gl.getUniformLocation(prog, `u_c${k}`), rgb(PALETTE[k]));
      gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
      gl.drawElements(gl.TRIANGLES, mesh.index.length, gl.UNSIGNED_SHORT, 0);
      if (vaoApi) vaoApi.bind(prev || null);
    }
  };

  const fc = features => ({ type: 'FeatureCollection', features });
  const railsFC = () => fc([
    ...rails.orbital.map(l => ({ type: 'Feature', properties: { k: 'orbital' }, geometry: { type: 'LineString', coordinates: lineToLL(l) } })),
    ...rails.high_speed.map(l => ({ type: 'Feature', properties: { k: 'high' }, geometry: { type: 'LineString', coordinates: lineToLL(l) } })),
    ...rails.radials.map(l => ({ type: 'Feature', properties: { k: 'radial' }, geometry: { type: 'LineString', coordinates: lineToLL(l) } }))
  ]);
  const stationsFC = () => fc(stations.map(s => ({ type: 'Feature', properties: { kind: s[1], name: s[0] }, geometry: { type: 'Point', coordinates: toWGS84([s[2], s[3]]) } })));

  function attachMapLibre(m, before) {
    map = m; beforeId = before;
    map.addLayer(layer, beforeId);
    map.addSource('g01-rails', { type: 'geojson', data: railsFC() });
    map.addSource('g01-stations', { type: 'geojson', data: stationsFC() });
    map.addLayer({ id: 'g01-rails-line', type: 'line', source: 'g01-rails', layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': '#f2f2f2', 'line-opacity': 0.9,
        'line-width': ['interpolate', ['linear'], ['zoom'], 8, ['match', ['get', 'k'], 'orbital', 2.2, 1.2], 14, ['match', ['get', 'k'], 'orbital', 5, 3]],
        'line-dasharray': ['match', ['get', 'k'], 'high', ['literal', [2, 1.5]], ['literal', [1, 0]]] } }, beforeId);
    map.addLayer({ id: 'g01-stations', type: 'circle', source: 'g01-stations',
      paint: { 'circle-radius': ['interpolate', ['linear'], ['zoom'], 8, ['match', ['get', 'kind'], 'P', 4.5, 3], 14, ['match', ['get', 'kind'], 'P', 9, 6]],
        'circle-color': ['match', ['get', 'kind'], 'A', '#E8463A', '#ffffff'], 'circle-stroke-color': '#000', 'circle-stroke-width': 1.2 } }, beforeId);
    sync();
  }

  function sync() {
    if (!map) return;
    const g = get(), vis = g.show && opts.rails ? 'visible' : 'none';
    for (const id of ['g01-rails-line', 'g01-stations']) if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', vis);
    map.triggerRepaint();
  }

  function detachMapLibre() {
    if (!map) return;
    for (const id of ['g01-stations', 'g01-rails-line', 'g01-growth']) if (map.getLayer(id)) map.removeLayer(id);
    for (const id of ['g01-stations', 'g01-rails']) if (map.getSource(id)) map.removeSource(id);
    map = null;
  }

  // ------------------------------------------------------------ canvas fallback
  let cv = null, cvCells = null, cvYear = -1;
  function canvasImage(g) {
    if (!cv) { cv = document.createElement('canvas'); cv.width = f.nx; cv.height = f.ny; }
    if (cvCells !== g.cells || cvYear !== g.year) {
      const cx = cv.getContext('2d'), img = cx.createImageData(f.nx, f.ny), px = new Uint32Array(img.data.buffer);
      const lut = [0, ...[1, 2, 3, 4, 5].map(k => { const [r, gg, b] = rgb(PALETTE[k]).map(v => Math.round(v * 255)); return (255 << 24 | b << 16 | gg << 8 | r) >>> 0; })];
      for (let i = 0; i < f.nx * f.ny; i++) { const k = classAt(g.cells, i, g.year); if (k) px[i] = lut[k]; }
      cx.putImageData(img, 0, 0); cvCells = g.cells; cvYear = g.year;
    }
    return cv;
  }
  function drawCanvas(ctx, { toPx, mpp }) {
    const g = get();
    if (!g.show || !g.cells) return;
    const [x0, y0] = toPx([f.e0, f.n1]), [x1, y1] = toPx([f.e1, f.n0]);
    ctx.save(); ctx.imageSmoothingEnabled = mpp > meta.C; ctx.globalAlpha = opts.opacity;
    ctx.drawImage(canvasImage(g), x0, y0, x1 - x0, y1 - y0);
    ctx.restore();
    if (!opts.rails) return;
    ctx.save(); ctx.strokeStyle = '#f2f2f2'; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    const line = l => { ctx.beginPath(); l.forEach((p, i) => { const [x, y] = toPx(p); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }); ctx.stroke(); };
    ctx.lineWidth = 2.4; rails.orbital.forEach(line);
    ctx.lineWidth = 1.4; rails.radials.forEach(line);
    ctx.setLineDash([6, 4]); rails.high_speed.forEach(line); ctx.setLineDash([]);
    ctx.strokeStyle = '#000';
    for (const s of stations) { const [x, y] = toPx([s[2], s[3]]); ctx.fillStyle = s[1] === 'A' ? '#E8463A' : '#fff'; ctx.beginPath(); ctx.arc(x, y, s[1] === 'P' ? 5 : 3.5, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); }
    ctx.restore();
  }

  return {
    id: 'g01',
    attachMapLibre, detachMapLibre, drawCanvas, sync,
    set(o) { Object.assign(opts, o); sync(); },
    get options() { return { ...opts }; }
  };
}
