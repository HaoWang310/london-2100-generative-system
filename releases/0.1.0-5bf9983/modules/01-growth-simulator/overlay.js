// 01 · Growth simulator — drawing the growth on the map.
//
// MapLibre: one WebGL custom layer. The parcel records (cells.js) go to the GPU
// once per run as a 3000 x 2460 texture; the year is a uniform, so playback
// costs nothing per frame. The texture is drawn through the exact mesh of
// georef.js, under the basemap's water and roads (they cut through the parcels)
// and the map's labels. Zoomed in, the parcels split into finer grains (see FS);
// an optional fine outline can mark each 50 m parcel instead.
// The loop's rails and stations are ordinary MapLibre line / circle layers.
//
// Canvas fallback (no MapLibre): the same classes painted into a 3000 x 2460
// image, drawn in EPSG:27700 straight onto the fallback view.

import { gridMesh, gridFrame, lineToLL } from './georef.js?v=5bf9983';
import { classAt } from './cells.js?v=5bf9983';
import { toWGS84 } from '../../shared/geo-core/index.js?v=5bf9983';

const GRAIN_PX = 10;
const STUDY_R = 70000;        // the 70 km study circle, round the model's centre (meta.LON)
/** Rows to add north and south of the model's grid to reach the 70 km circle. */
export function fillRows(meta) {
  const n0 = meta.YMAX - meta.NY * meta.C;
  return { north: Math.max(0, Math.ceil((meta.LON[1] + STUDY_R - meta.YMAX) / meta.C)), south: Math.max(0, Math.ceil((n0 - (meta.LON[1] - STUDY_R)) / meta.C)) };
}          // target grain size on screen, device pixels
export const PALETTE = { 1: '#F2D99E', 2: '#EFA65C', 3: '#E8684A', 4: '#5E6A48', 5: '#A9B57F' };
const rgb = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16) / 255);

const VS = `
attribute vec2 a_pos; attribute vec2 a_uv;
uniform mat4 u_matrix; varying vec2 v_uv;
void main() { v_uv = a_uv; gl_Position = u_matrix * vec4(a_pos, 0.0, 1.0); }`;

// Finer grains when zoomed in (u_grain = 1). Zoomed out, every 50 m parcel is one
// grain, exactly the model's data. Zoomed in, each parcel splits into 2 x 2, 4 x 4,
// 8 x 8 ... square grains, so a grain stays about u_px pixels wide on screen while
// standing for 25 m, 12.5 m, 6 m ... on the ground. A grain's class: the parcels
// around it vote (cubic B-spline weights over 4 x 4 parcels), its own parcel gets a
// small bonus (PB), and value noise at every finer octave (amplitude AMP, halving)
// adds the detail; the highest score wins. Inside an area of one class nothing
// changes; along a boundary the grains interleave. Levels cross-fade as the zoom
// passes from one to the next, and the noise is tied to the ground, so grains do
// not flicker when the map moves. The sub-parcel detail is illustrative only:
// every parcel keeps its class and the totals do not change.
const FS = `
precision highp float;
uniform sampler2D u_cells; uniform vec2 u_grid; uniform float u_year; uniform float u_opacity; uniform float u_edge;
uniform float u_grain; uniform float u_level; uniform vec2 u_model; uniform float u_fill;
uniform vec3 u_c1; uniform vec3 u_c2; uniform vec3 u_c3; uniform vec3 u_c4; uniform vec3 u_c5;
uniform float u_show; varying vec2 v_uv;
const float PB = 0.15, AMP = 0.5;
const float FADE = 50.0;           // 50 parcels = 2.5 km
float classOf(vec2 cell) {
  if (cell.x < 0.0 || cell.y < 0.0 || cell.x >= u_grid.x || cell.y >= u_grid.y) return 0.0;
  vec4 c = floor(texture2D(u_cells, (cell + 0.5) / u_grid) * 255.0 + 0.5);
  float y = u_year + 0.5;
  if (c.a < y) return 3.0;
  if (c.b < y) return 2.0;
  if (c.r > 0.5 && c.g < y) return c.r;
  return 0.0;
}
vec3 colourOf(float k) { return k < 1.5 ? u_c1 : k < 2.5 ? u_c2 : k < 3.5 ? u_c3 : k < 4.5 ? u_c4 : u_c5; }
float alphaOf(float k) { return k < 0.5 ? 0.0 : (k < 3.5 ? 1.0 : 0.85); }
// lattice ids wrap every 8192 so the float maths stays exact deep into the zoom
float hash(vec2 p) { p = mod(p, 8192.0); vec3 q = fract(vec3(p.xyx) * 0.1031); q += dot(q, q.yzx + 33.33); return fract((q.x + q.y) * q.z); }
float vnoise(vec2 x, float seed) {
  vec2 o = vec2(seed * 17.31, seed * 29.17);
  vec2 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
  float a = hash(i + o), b = hash(i + vec2(1.0, 0.0) + o), c = hash(i + vec2(0.0, 1.0) + o), d = hash(i + vec2(1.0, 1.0) + o);
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y) - 0.5;
}
vec4 bspline(float t) {   // weights for the parcels at offsets -1, 0, 1, 2
  float t2 = t * t, t3 = t2 * t;
  return vec4((1.0 - t) * (1.0 - t) * (1.0 - t), 3.0 * t3 - 6.0 * t2 + 4.0, -3.0 * t3 + 3.0 * t2 + 3.0 * t + 1.0, t3) / 6.0;
}
float pick(vec4 v, int i) { return i == 0 ? v.x : i == 1 ? v.y : i == 2 ? v.z : v.w; }
// the class of the grain at level L (2^L grains per parcel side) containing p (parcel units)
float grainClass(vec2 p, float L) {
  float n = exp2(L);
  vec2 s = (floor(p * n) + 0.5) / n;                 // the grain's centre
  float own = classOf(floor(s));
  if (L < 0.5) return own;
  vec2 q = s - 0.5, i0 = floor(q), t = q - i0;
  vec4 wx = bspline(t.x), wy = bspline(t.y);
  float w0 = 0.0, w1 = 0.0, w2 = 0.0, w3 = 0.0, w4 = 0.0, w5 = 0.0;
  for (int j = 0; j < 4; j++) for (int i = 0; i < 4; i++) {
    float k = classOf(i0 + vec2(float(i) - 1.0, float(j) - 1.0)), w = pick(wx, i) * pick(wy, j);
    if (k < 0.5) w0 += w; else if (k < 1.5) w1 += w; else if (k < 2.5) w2 += w; else if (k < 3.5) w3 += w; else if (k < 4.5) w4 += w; else w5 += w;
  }
  if (own < 0.5) w0 += PB; else if (own < 1.5) w1 += PB; else if (own < 2.5) w2 += PB; else if (own < 3.5) w3 += PB; else if (own < 4.5) w4 += PB; else w5 += PB;
  // detail: one noise per class present, summed over the octaves down to this level
  float amp = AMP;
  for (int o = 1; o <= 8; o++) {
    if (float(o) > L) break;
    vec2 x = s * exp2(float(o));
    if (w0 > 0.0) w0 += amp * vnoise(x, 1.0 + float(o) * 7.0);
    if (w1 > 0.0) w1 += amp * vnoise(x, 2.0 + float(o) * 7.0);
    if (w2 > 0.0) w2 += amp * vnoise(x, 3.0 + float(o) * 7.0);
    if (w3 > 0.0) w3 += amp * vnoise(x, 4.0 + float(o) * 7.0);
    if (w4 > 0.0) w4 += amp * vnoise(x, 5.0 + float(o) * 7.0);
    if (w5 > 0.0) w5 += amp * vnoise(x, 6.0 + float(o) * 7.0);
    amp *= 0.62;
  }
  float k = 0.0, b = w0;
  if (w1 > b) { k = 1.0; b = w1; } if (w2 > b) { k = 2.0; b = w2; } if (w3 > b) { k = 3.0; b = w3; }
  if (w4 > b) { k = 4.0; b = w4; } if (w5 > b) { k = 5.0; b = w5; }
  return k;
}
void main() {
  if (v_uv.x < 0.0 || v_uv.y < 0.0 || v_uv.x >= 1.0 || v_uv.y >= 1.0) discard;
  vec2 p = v_uv * u_grid;
  float k1 = 0.0, k2 = 0.0, f = 0.0;
  if (u_grain > 0.5 && u_level > 0.0) {
    float L = floor(u_level);
    f = smoothstep(0.7, 1.0, u_level - L);            // the next level fades in near the end of this one
    k1 = grainClass(p, L);
    k2 = f > 0.0 ? grainClass(p, L + 1.0) : k1;
  } else {
    k1 = classOf(floor(p)); k2 = k1;
  }
  float a1 = alphaOf(k1), a2 = alphaOf(k2), al = mix(a1, a2, f);
  if (al < 0.004) discard;
  vec3 col = (colourOf(k1) * a1 * (1.0 - f) + colourOf(k2) * a2 * f) / max(al, 1e-4);
  // Where the drawing ends, fade out over the last FADE parcels instead of a hard cut: the model's
  // own north and south edges (rows u_model), or with the fill on, the filled grid's edges.
  float ex = min(p.x, u_grid.x - p.x);
  float ey = u_fill > 0.5 ? min(p.y, u_grid.y - p.y) : min(p.y - u_model.x, u_model.y - p.y);
  float a = u_opacity * al * u_show * smoothstep(0.0, FADE, min(ex, ey));
  if (u_edge > 0.0) {
    vec2 fr = fract(p);
    float d = min(min(fr.x, 1.0 - fr.x), min(fr.y, 1.0 - fr.y));
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
// An image over a BNG rectangle, drawn through the same exact-position mesh as the parcels:
// the steps' ground layers, magnet field and edge. setImage(canvas | null, [e0, n1, e1, n0]).
const IMG_FS = `
precision highp float;
uniform sampler2D u_img; uniform float u_alpha; varying vec2 v_uv;
void main() {
  if (v_uv.x < 0.0 || v_uv.y < 0.0 || v_uv.x > 1.0 || v_uv.y > 1.0) discard;
  gl_FragColor = texture2D(u_img, v_uv) * u_alpha;
}`;
export function createImageLayer(id) {
  let map = null, gl = null, prog = null, buf = null, ibuf = null, tex = null, mesh = null, img = null, uploaded = null, alpha = 1;
  const layer = {
    id, type: 'custom', renderingMode: '2d',
    onAdd(m, context) {
      map = m; gl = context;
      const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; };
      prog = gl.createProgram(); gl.attachShader(prog, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, IMG_FS)); gl.linkProgram(prog);
      buf = gl.createBuffer(); ibuf = gl.createBuffer(); tex = gl.createTexture(); uploaded = null; mesh = null;
    },
    onRemove() { if (gl) { gl.deleteBuffer(buf); gl.deleteBuffer(ibuf); gl.deleteTexture(tex); gl.deleteProgram(prog); } gl = null; },
    render(context, args) {
      if (!img || !gl) return;
      if (!mesh || mesh.rect !== img.rect) {
        const [e0, n1, e1, n0] = img.rect;
        mesh = gridMesh({ XMIN: e0, YMAX: n1, C: 1, NX: e1 - e0, NY: n1 - n0 }, 40, 30); mesh.rect = img.rect;
        const inter = new Float32Array(mesh.pos.length * 2);
        for (let i = 0; i < mesh.pos.length / 2; i++) inter.set([mesh.pos[i * 2], mesh.pos[i * 2 + 1], mesh.uv[i * 2], mesh.uv[i * 2 + 1]], i * 4);
        gl.bindBuffer(gl.ARRAY_BUFFER, buf); gl.bufferData(gl.ARRAY_BUFFER, inter, gl.STATIC_DRAW);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibuf); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, mesh.index, gl.STATIC_DRAW);
      }
      if (uploaded !== img.canvas) {
        gl.bindTexture(gl.TEXTURE_2D, tex);
        gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img.canvas);
        gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
        for (const [k, v] of [[gl.TEXTURE_MIN_FILTER, gl.LINEAR], [gl.TEXTURE_MAG_FILTER, img.nearest ? gl.NEAREST : gl.LINEAR], [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE]]) gl.texParameteri(gl.TEXTURE_2D, k, v);
        uploaded = img.canvas;
      }
      let main = args?.modelViewProjectionMatrix, scale = 512 * Math.pow(2, map.getZoom());
      if (!main) { main = args?.defaultProjectionData?.mainMatrix || args; scale = 1; }
      const T = new Float64Array([scale, 0, 0, 0, 0, scale, 0, 0, 0, 0, 1, 0, mesh.origin[0] * scale, mesh.origin[1] * scale, 0, 1]);
      gl.useProgram(prog);
      const vao = typeof gl.getParameter === 'function' && gl.VERTEX_ARRAY_BINDING ? gl.getParameter(gl.VERTEX_ARRAY_BINDING) : null;
      if (vao && gl.bindVertexArray) gl.bindVertexArray(null);
      gl.bindBuffer(gl.ARRAY_BUFFER, buf); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibuf);
      const aPos = gl.getAttribLocation(prog, 'a_pos'), aUv = gl.getAttribLocation(prog, 'a_uv');
      gl.enableVertexAttribArray(aPos); gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 16, 0);
      gl.enableVertexAttribArray(aUv); gl.vertexAttribPointer(aUv, 2, gl.FLOAT, false, 16, 8);
      gl.uniformMatrix4fv(gl.getUniformLocation(prog, 'u_matrix'), false, new Float32Array(multiply(main, T)));
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.uniform1i(gl.getUniformLocation(prog, 'u_img'), 0);
      gl.uniform1f(gl.getUniformLocation(prog, 'u_alpha'), alpha);
      gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
      gl.drawElements(gl.TRIANGLES, mesh.index.length, gl.UNSIGNED_SHORT, 0);
      gl.disableVertexAttribArray(aPos); gl.disableVertexAttribArray(aUv);
      if (vao && gl.bindVertexArray) gl.bindVertexArray(vao);
    }
  };
  return {
    layer,
    setImage(canvas, rect, o = {}) { img = canvas ? { canvas, rect, nearest: Boolean(o.nearest) } : null; alpha = o.alpha ?? 1; uploaded = null; map?.triggerRepaint(); }
  };
}

export function createGrowthOverlay({ meta, rails, stations, get, opacity = 0.9 }) {   // stations: meta.NODES [name, kind P/S/A, E, N]
  const f = gridFrame(meta);
  // The model's grid stops short of the 70 km study circle in the north and the south. The overlay
  // draws an extended grid: FILL.north rows above it and FILL.south below, which hold the fill
  // (an illustrative continuation, see tools/fill-strips.py) when it is on, and nothing otherwise.
  const FILL = fillRows(meta);
  const fx = { nx: f.nx, ny: f.ny + FILL.north + FILL.south };
  const mesh = gridMesh({ ...meta, YMAX: meta.YMAX + FILL.north * meta.C, NY: fx.ny });
  let strips = null, composed = null, composedFrom = null;
  const aux = createImageLayer('g01-aux'), auxTop = createImageLayer('g01-aux-top');   // under / over the parcels
  let map = null, gl = null, prog = null, buf = null, ibuf = null, tex = null, vao = null, vaoApi = null;
  let uploaded = null, opts = { opacity, edges: false, grain: true, rails: true, fill: true };
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
      const cells = extended(g.cells);
      if (uploaded !== cells) {
        gl.bindTexture(gl.TEXTURE_2D, tex);
        gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, fx.nx, fx.ny, 0, gl.RGBA, gl.UNSIGNED_BYTE, cells);
        for (const [k, v] of [[gl.TEXTURE_MIN_FILTER, gl.NEAREST], [gl.TEXTURE_MAG_FILTER, gl.NEAREST], [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE]]) gl.texParameteri(gl.TEXTURE_2D, k, v);
        uploaded = cells;
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
      gl.uniform2f(gl.getUniformLocation(prog, 'u_grid'), fx.nx, fx.ny);
      gl.uniform2f(gl.getUniformLocation(prog, 'u_model'), FILL.north, FILL.north + f.ny);
      gl.uniform1f(gl.getUniformLocation(prog, 'u_fill'), opts.fill && strips ? 1 : 0);
      gl.uniform1f(gl.getUniformLocation(prog, 'u_year'), g.year);
      gl.uniform1f(gl.getUniformLocation(prog, 'u_opacity'), opts.opacity);
      gl.uniform1f(gl.getUniformLocation(prog, 'u_show'), 1);
      gl.uniform1f(gl.getUniformLocation(prog, 'u_edge'), opts.edges && cellPx >= 6 ? Math.min(0.12, 1.2 / cellPx) : 0);
      // finer grains: one grain stays about GRAIN_PX device pixels wide (level 0 = the 50 m parcels)
      gl.uniform1f(gl.getUniformLocation(prog, 'u_grain'), opts.grain ? 1 : 0);
      gl.uniform1f(gl.getUniformLocation(prog, 'u_level'), Math.min(8, Math.max(0, Math.log2(cellPx / GRAIN_PX))));
      for (const k of [1, 2, 3, 4, 5]) gl.uniform3fv(gl.getUniformLocation(prog, `u_c${k}`), rgb(PALETTE[k]));
      gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
      gl.drawElements(gl.TRIANGLES, mesh.index.length, gl.UNSIGNED_SHORT, 0);
      if (vaoApi) vaoApi.bind(prev || null);
    }
  };

  // The model's cells inside the extended grid, with the fill rows above and below.
  function extended(cells) {
    const on = opts.fill && strips;
    if (composed && composedFrom === cells && composed.on === on) return composed.buf;
    const row = fx.nx * 4, buf = new Uint8Array(fx.ny * row);
    if (on) {
      buf.set(strips.subarray(0, FILL.north * row), 0);
      buf.set(strips.subarray(FILL.north * row), (FILL.north + f.ny) * row);
    } else {
      for (let i = 0; i < buf.length; i += 4) { buf[i + 1] = 255; buf[i + 2] = 255; buf[i + 3] = 255; }
    }
    buf.set(cells, FILL.north * row);
    composed = { buf, on }; composedFrom = cells;
    return buf;
  }

  const fc = features => ({ type: 'FeatureCollection', features });
  const railsFC = () => fc([
    ...rails.orbital.map(l => ({ type: 'Feature', properties: { k: 'orbital' }, geometry: { type: 'LineString', coordinates: lineToLL(l) } })),
    ...rails.high_speed.map(l => ({ type: 'Feature', properties: { k: 'high' }, geometry: { type: 'LineString', coordinates: lineToLL(l) } })),
    ...rails.radials.map(l => ({ type: 'Feature', properties: { k: 'radial' }, geometry: { type: 'LineString', coordinates: lineToLL(l) } }))
  ]);
  // the six zones' boundaries: rays from London at meta.BOUND degrees (as the incubator draws them)
  const zonesFC = () => fc(meta.BOUND.map(b => { const a = b * Math.PI / 180, R2 = 140000;
    return { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: lineToLL([[meta.LON[0], meta.LON[1]], [meta.LON[0] + Math.sin(a) * R2, meta.LON[1] + Math.cos(a) * R2]]) } }; }));
  const stationsFC = () => fc(stations.map(s => ({ type: 'Feature', properties: { kind: s[1], name: s[0] }, geometry: { type: 'Point', coordinates: toWGS84([s[2], s[3]]) } })));

  // `ground`: where the parcels go (under the basemap's water and roads, so the real
  // rivers and streets cut through them); `before`: where the rails and stations go.
  function attachMapLibre(m, before, { ground = before } = {}) {
    map = m; beforeId = before;
    map.addLayer(layer, ground && map.getLayer(ground) ? ground : beforeId);
    map.addLayer(aux.layer, 'g01-growth');                // the steps' images, under the parcels ...
    map.addLayer(auxTop.layer, beforeId);                 // ... or over them (an outline)
    map.addSource('g01-rails', { type: 'geojson', data: railsFC() });
    map.addSource('g01-zones', { type: 'geojson', data: zonesFC() });
    map.addLayer({ id: 'g01-zones', type: 'line', source: 'g01-zones', layout: { visibility: 'none' },
      paint: { 'line-color': '#9a9a9f', 'line-opacity': 0.8, 'line-width': 1.2, 'line-dasharray': [3, 2.5] } }, beforeId);
    map.addSource('g01-stations', { type: 'geojson', data: stationsFC() });
    map.addLayer({ id: 'g01-rails-line', type: 'line', source: 'g01-rails', layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': '#f2f2f2', 'line-opacity': 0.9,
        'line-width': ['interpolate', ['linear'], ['zoom'], 8, ['match', ['get', 'k'], 'orbital', 2.2, 1.2], 14, ['match', ['get', 'k'], 'orbital', 5, 3]],
        'line-dasharray': ['match', ['get', 'k'], 'high', ['literal', [2, 1.5]], ['literal', [1, 0]]] } }, beforeId);
    map.addLayer({ id: 'g01-stations', type: 'circle', source: 'g01-stations',
      paint: { 'circle-radius': ['interpolate', ['linear'], ['zoom'], 8, ['match', ['get', 'kind'], 'P', 4.5, 3], 14, ['match', ['get', 'kind'], 'P', 9, 6]],
        'circle-color': ['match', ['get', 'kind'], 'A', '#E8463A', '#ffffff'], 'circle-stroke-color': '#000', 'circle-stroke-width': 1.2 } }, beforeId);
    map.addLayer({ id: 'g01-names', type: 'symbol', source: 'g01-stations', layout: { visibility: 'none', 'text-field': ['get', 'name'], 'text-size': 12,
      'text-offset': [0.9, -0.6], 'text-anchor': 'left', 'text-allow-overlap': true },
      paint: { 'text-color': '#e6e6e6', 'text-halo-color': 'rgba(0,0,0,.85)', 'text-halo-width': 1.2 } }, beforeId);
    sync();
  }

  function sync() {
    if (!map) return;
    const g = get(), on = v => (g.show && v ? 'visible' : 'none');
    const rails = g.rails ?? opts.rails;
    if (map.getLayer('g01-rails-line')) map.setLayoutProperty('g01-rails-line', 'visibility', on(rails));
    if (map.getLayer('g01-stations')) map.setLayoutProperty('g01-stations', 'visibility', on(g.stations ?? rails));
    if (map.getLayer('g01-names')) map.setLayoutProperty('g01-names', 'visibility', on(g.names));
    if (map.getLayer('g01-zones')) map.setLayoutProperty('g01-zones', 'visibility', on(g.zones));
    map.triggerRepaint();
  }

  function detachMapLibre() {
    if (!map) return;
    for (const id of ['g01-names', 'g01-zones', 'g01-stations', 'g01-rails-line', 'g01-aux-top', 'g01-aux', 'g01-growth']) if (map.getLayer(id)) map.removeLayer(id);
    for (const id of ['g01-zones', 'g01-stations', 'g01-rails']) if (map.getSource(id)) map.removeSource(id);
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
    /** The steps' image under the parcels (ground layers, magnet field, edge); null to clear. */
    setImage(canvas, rect, o = {}) { (o.top ? auxTop : aux).setImage(canvas, rect, o); (o.top ? aux : auxTop).setImage(null); },
    /** The fill rows (FILL.north then FILL.south, 4 bytes a parcel like the model's cells). */
    setFill(bytes) {
      if (bytes && bytes.length !== (FILL.north + FILL.south) * fx.nx * 4) throw new Error('fill: unexpected size');
      strips = bytes; composed = null; map?.triggerRepaint();
    },
    get options() { return { ...opts }; }
  };
}
