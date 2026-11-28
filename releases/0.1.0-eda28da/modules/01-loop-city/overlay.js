// 01 · Loop City step 1 — drawing the model on the map.
//
// MapLibre: the growth and the mould are two pictures (the engine's own canvases,
// copied each year), each drawn by a WebGL custom layer through the exact mesh of
// georef.js, under the basemap's water and roads so the real rivers and streets
// cut through them. The highways, the cells, the rail and the stations are
// ordinary MapLibre layers; the engine gives them in British National Grid
// metres and every vertex is projected exactly.
//
// Canvas fallback (no MapLibre): the same pictures and lines drawn in EPSG:27700
// straight onto the fallback view.
//
// The picture layer is the one the former modules/01-growth-simulator/overlay.js (removed 26 Nov 2026) used for its
// step images (createImageLayer), copied here because modules do not import each other.

import { frameMesh, toLonLat } from './georef.js?v=eda28da';

const VS = `
attribute vec2 a_pos; attribute vec2 a_uv;
uniform mat4 u_matrix; varying vec2 v_uv;
void main() { v_uv = a_uv; gl_Position = u_matrix * vec4(a_pos, 0.0, 1.0); }`;
const IMG_FS = `
precision highp float;
uniform sampler2D u_img; uniform float u_alpha; varying vec2 v_uv;
void main() {
  if (v_uv.x < 0.0 || v_uv.y < 0.0 || v_uv.x > 1.0 || v_uv.y > 1.0) discard;
  gl_FragColor = texture2D(u_img, v_uv) * u_alpha;
}`;

const multiply = (a, b) => {            // column-major 4x4, in double precision
  const o = new Float64Array(16);
  for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) {
    let s = 0; for (let k = 0; k < 4; k++) s += a[k * 4 + j] * b[i * 4 + k]; o[i * 4 + j] = s;
  }
  return o;
};

/** A picture over a BNG frame {e0,e1,n0,n1}, drawn through the exact-position mesh. setImage(canvas | null, frame, {alpha, nearest}). */
export function createImageLayer(id) {
  let map = null, gl = null, prog = null, buf = null, ibuf = null, tex = null, mesh = null, img = null, uploaded = false, alpha = 1;
  const layer = {
    id, type: 'custom', renderingMode: '2d',
    onAdd(m, context) {
      map = m; gl = context;
      const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; };
      prog = gl.createProgram(); gl.attachShader(prog, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, IMG_FS)); gl.linkProgram(prog);
      if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
      buf = gl.createBuffer(); ibuf = gl.createBuffer(); tex = gl.createTexture(); uploaded = false; mesh = null;
    },
    onRemove() { if (gl) { gl.deleteBuffer(buf); gl.deleteBuffer(ibuf); gl.deleteTexture(tex); gl.deleteProgram(prog); } gl = null; },
    render(context, args) {
      if (!img || !gl) return;
      if (!mesh || mesh.key !== img.key) {
        mesh = frameMesh(img.frame); mesh.key = img.key;
        const inter = new Float32Array(mesh.pos.length * 2);
        for (let i = 0; i < mesh.pos.length / 2; i++) inter.set([mesh.pos[i * 2], mesh.pos[i * 2 + 1], mesh.uv[i * 2], mesh.uv[i * 2 + 1]], i * 4);
        gl.bindBuffer(gl.ARRAY_BUFFER, buf); gl.bufferData(gl.ARRAY_BUFFER, inter, gl.STATIC_DRAW);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibuf); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, mesh.index, gl.STATIC_DRAW);
      }
      if (!uploaded) {
        gl.bindTexture(gl.TEXTURE_2D, tex);
        gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img.canvas);
        gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
        for (const [k, v] of [[gl.TEXTURE_MIN_FILTER, gl.LINEAR], [gl.TEXTURE_MAG_FILTER, img.nearest ? gl.NEAREST : gl.LINEAR], [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE]]) gl.texParameteri(gl.TEXTURE_2D, k, v);
        uploaded = true;
      }
      // MapLibre 6: modelViewProjectionMatrix works in world pixels (mercator x 512 x 2^zoom);
      // older builds hand over a mercator matrix. Vertices are relative to the mesh origin.
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
    /** canvas = null hides the picture. The canvas is read again at the next frame. */
    setImage(canvas, frame, o = {}) {
      img = canvas && frame ? { canvas, frame, key: `${frame.e0},${frame.e1},${frame.n0},${frame.n1}`, nearest: Boolean(o.nearest) } : null;
      alpha = o.alpha ?? 1; uploaded = false; map?.triggerRepaint();
    },
    setAlpha(a) { if (alpha !== a) { alpha = a; map?.triggerRepaint(); } }
  };
}

// 23 Nov 2026: palette C of the incubator page (Productive territory), which is what that page opens on. The published
// result's growth palette (result/result.json) was set to the same five tints by hand: same run, new colours.
export const USE_COLOUR = { urban: '#E3B47B', agricultural: '#9EBE7A', open: '#8C8C8C' };
const EMPTY = { type: 'FeatureCollection', features: [] };

/**
 * get() -> { show, frame, growth, mould (canvases or null), version, vectors {highways, cells} | null, vectorVersion,
 *            base {stations, rails}, on: {growth, mould, highways, cells, rails}, opacity, final (the year on show is 2100) }
 */
export function createLoopOverlay({ get }) {
  const growthL = createImageLayer('lc01-growth'), mouldL = createImageLayer('lc01-mould');
  let map = null, seen = -1, seenVec = -1, seenKey = '', baseSet = false, ll = { cells: EMPTY, highways: EMPTY };

  const LAYERS = ['lc01-names', 'lc01-stations', 'lc01-rails-line', 'lc01-highways-line', 'lc01-cells-line', 'lc01-cells-fill', 'lc01-mould', 'lc01-growth'];
  const SOURCES = ['lc01-cells', 'lc01-highways', 'lc01-rails', 'lc01-stations'];
  const useColour = ['match', ['get', 'use'], 'urban', USE_COLOUR.urban, 'agricultural', USE_COLOUR.agricultural, USE_COLOUR.open];

  function attachMapLibre(m, before, { ground = before } = {}) {
    map = m;
    const under = ground && map.getLayer(ground) ? ground : before;
    map.addLayer(growthL.layer, under);
    map.addLayer(mouldL.layer, under);                     // the mould over the growth
    for (const id of SOURCES) map.addSource(id, { type: 'geojson', data: EMPTY });
    map.addLayer({ id: 'lc01-cells-fill', type: 'fill', source: 'lc01-cells', paint: { 'fill-color': useColour, 'fill-opacity': 0.16 } }, before);
    map.addLayer({ id: 'lc01-cells-line', type: 'line', source: 'lc01-cells', layout: { 'line-join': 'round' },
      paint: { 'line-color': useColour, 'line-opacity': 0.9, 'line-width': ['interpolate', ['linear'], ['zoom'], 8, 1, 14, 2.4] } }, before);
    map.addLayer({ id: 'lc01-highways-line', type: 'line', source: 'lc01-highways', layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': '#ffffff',
        'line-opacity': ['match', ['get', 'class'], 'highway', 0.95, 'link', 0.7, 0.4],
        'line-width': ['interpolate', ['linear'], ['zoom'], 8, ['match', ['get', 'class'], 'highway', 2.4, 'link', 1.1, 0.6], 14, ['match', ['get', 'class'], 'highway', 6, 'link', 3, 1.6]] } }, before);
    map.addLayer({ id: 'lc01-rails-line', type: 'line', source: 'lc01-rails', layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': '#9a9a9f', 'line-opacity': 0.9,
        'line-width': ['interpolate', ['linear'], ['zoom'], 8, ['match', ['get', 'kind'], 'orbital', 1.8, 1], 14, ['match', ['get', 'kind'], 'orbital', 4, 2.4]],
        'line-dasharray': ['match', ['get', 'kind'], 'high_speed', ['literal', [2, 1.5]], ['literal', [1, 0]]] } }, before);
    map.addLayer({ id: 'lc01-stations', type: 'circle', source: 'lc01-stations',
      paint: { 'circle-radius': ['interpolate', ['linear'], ['zoom'], 8, ['match', ['get', 'kind'], 'primary', 4.5, 3], 14, ['match', ['get', 'kind'], 'primary', 9, 6]],
        'circle-color': ['match', ['get', 'kind'], 'airport', '#E8463A', '#ffffff'], 'circle-stroke-color': '#000', 'circle-stroke-width': 1.2 } }, before);
    map.addLayer({ id: 'lc01-names', type: 'symbol', source: 'lc01-stations', minzoom: 8.5,
      layout: { 'text-field': ['get', 'id'], 'text-size': 12, 'text-offset': [0.9, -0.6], 'text-anchor': 'left', 'text-allow-overlap': true },
      paint: { 'text-color': '#e6e6e6', 'text-halo-color': 'rgba(0,0,0,.85)', 'text-halo-width': 1.2 } }, before);
    seen = -1; seenVec = -1; seenKey = ''; baseSet = false;
    sync();
  }

  function detachMapLibre() {
    if (!map) return;
    for (const id of LAYERS) if (map.getLayer(id)) map.removeLayer(id);
    for (const id of SOURCES) if (map.getSource(id)) map.removeSource(id);
    map = null;
  }

  function project(g) {
    if (seenVec === g.vectorVersion) return;
    ll = g.vectors ? { cells: toLonLat(g.vectors.cells), highways: toLonLat(g.vectors.highways) } : { cells: EMPTY, highways: EMPTY };
    seenVec = g.vectorVersion;
    if (map) { map.getSource('lc01-cells')?.setData(ll.cells); map.getSource('lc01-highways')?.setData(ll.highways); }
  }

  function sync() {
    const g = get();
    if (!map) { if (g.frame) project(g); return; }
    if (!g.frame) return;
    if (!baseSet && g.base) {
      map.getSource('lc01-rails')?.setData(toLonLat(g.base.rails));
      map.getSource('lc01-stations')?.setData(toLonLat(g.base.stations));
      baseSet = true;
    }
    project(g);
    const key = `${g.show}|${g.on.growth}|${g.on.mould}|${g.opacity}`;
    if (seen !== g.version || seenKey !== key) {
      growthL.setImage(g.show && g.on.growth ? g.growth : null, g.frame, { alpha: g.opacity, nearest: true });
      mouldL.setImage(g.show && g.on.mould ? g.mould : null, g.frame, { alpha: g.opacity });
      seen = g.version; seenKey = key;
    }
    const vis = v => (g.show && v ? 'visible' : 'none');
    const set = (id, v) => { if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', vis(v)); };
    set('lc01-cells-fill', g.on.cells && g.final); set('lc01-cells-line', g.on.cells && g.final);
    set('lc01-highways-line', g.on.highways && g.final);
    set('lc01-rails-line', g.on.rails); set('lc01-stations', g.on.rails); set('lc01-names', g.on.rails);
    map.triggerRepaint();
  }

  // ------------------------------------------------------------ canvas fallback (the view is EPSG:27700, so this is exact)
  function drawCanvas(ctx, { toPx }) {
    const g = get();
    if (!g.show || !g.frame) return;
    const f = g.frame, [x0, y0] = toPx([f.e0, f.n1]), [x1, y1] = toPx([f.e1, f.n0]);
    ctx.save(); ctx.globalAlpha = g.opacity;
    if (g.on.growth && g.growth) { ctx.imageSmoothingEnabled = false; ctx.drawImage(g.growth, x0, y0, x1 - x0, y1 - y0); }
    if (g.on.mould && g.mould) { ctx.imageSmoothingEnabled = true; ctx.drawImage(g.mould, x0, y0, x1 - x0, y1 - y0); }
    ctx.restore();
    const line = (pts, close) => { ctx.beginPath(); pts.forEach((p, i) => { const [x, y] = toPx(p); if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); }); if (close) ctx.closePath(); };
    ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    if (g.vectors && g.final) {
      if (g.on.cells) for (const c of g.vectors.cells.features) {
        const col = USE_COLOUR[c.properties.use] || USE_COLOUR.open;
        ctx.beginPath();
        for (const ring of c.geometry.coordinates) { ring.forEach((p, i) => { const [x, y] = toPx(p); if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); }); ctx.closePath(); }
        ctx.globalAlpha = 0.16; ctx.fillStyle = col; ctx.fill('evenodd');
        ctx.globalAlpha = 0.9; ctx.strokeStyle = col; ctx.lineWidth = 1.2; ctx.stroke();
      }
      if (g.on.highways) for (const h of g.vectors.highways.features) {
        const k = h.properties.class;
        ctx.globalAlpha = k === 'highway' ? 0.95 : k === 'link' ? 0.7 : 0.4; ctx.strokeStyle = '#fff'; ctx.lineWidth = k === 'highway' ? 2.4 : k === 'link' ? 1.1 : 0.6;
        line(h.geometry.coordinates); ctx.stroke();
      }
    }
    if (g.on.rails && g.base) {
      ctx.globalAlpha = 0.9; ctx.strokeStyle = '#9a9a9f';
      for (const r of g.base.rails.features) {
        ctx.lineWidth = r.properties.kind === 'orbital' ? 1.8 : 1; ctx.setLineDash(r.properties.kind === 'high_speed' ? [6, 4] : []);
        line(r.geometry.coordinates); ctx.stroke();
      }
      ctx.setLineDash([]); ctx.globalAlpha = 1; ctx.strokeStyle = '#000'; ctx.lineWidth = 1.2;
      for (const s of g.base.stations.features) {
        const [x, y] = toPx(s.geometry.coordinates), k = s.properties.kind;
        ctx.fillStyle = k === 'airport' ? '#E8463A' : '#fff'; ctx.beginPath(); ctx.arc(x, y, k === 'primary' ? 5 : 3.5, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      }
    }
    ctx.restore();
  }

  return { id: 'lc01', attachMapLibre, detachMapLibre, drawCanvas, sync,
    /** The highways and cells as last projected to lon/lat (for tests and export). */
    get lonLat() { return ll; } };
}
