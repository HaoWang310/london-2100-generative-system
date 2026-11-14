/* Growth variations: the ground grids' codec (14 Nov 2026).
   Three ground grids are smooth (DRAIL, the distance to the rail, and the FIELD and VEIN noise),
   so they are stored as the difference from the neighbouring parcel, which deflate packs several
   times smaller; decoding gives back exactly the same bytes. D.enc names each grid's encoding:
     dx16  : Uint16 grid; each value minus its left neighbour (mod 65536), low bytes then high bytes
     dxdy8 : Uint8 grid; differences along each row, then down each column (mod 256)
   Used by index.html and by the workspace's 01 worker; tools/encode-ground.mjs writes the files. */
var GRIDCODEC = (function () {
  function decode(name, buf, meta, enc) {
    var e = enc && enc[name];
    if (!e) return buf;
    var NX = meta.NX, NY = meta.NY, N = NX * NY, r, j, o, s;
    if (e === "dx16") {
      var b = new Uint8Array(buf), out = new Uint16Array(N);
      if (b.length !== 2 * N) throw new Error(name + ": " + b.length + " bytes, expected " + 2 * N);
      for (r = 0; r < NY; r++) {
        o = r * NX; s = 0;
        for (j = 0; j < NX; j++) { s = (s + (b[o + j] | (b[N + o + j] << 8))) & 0xffff; out[o + j] = s; }
      }
      return out.buffer;
    }
    if (e === "dxdy8") {
      var a = new Uint8Array(buf);
      if (a.length !== N) throw new Error(name + ": " + a.length + " bytes, expected " + N);
      for (r = 1; r < NY; r++) { o = r * NX; for (j = 0; j < NX; j++) a[o + j] = (a[o + j] + a[o - NX + j]) & 255; }
      for (r = 0; r < NY; r++) { o = r * NX; s = 0; for (j = 0; j < NX; j++) { s = (s + a[o + j]) & 255; a[o + j] = s; } }
      return a.buffer;
    }
    throw new Error(name + ": unknown grid encoding " + e);
  }
  function encode(name, buf, meta, e) {
    var NX = meta.NX, NY = meta.NY, N = NX * NY, r, j, o;
    if (e === "dx16") {
      var v = new Uint16Array(buf), b = new Uint8Array(2 * N), d;
      for (r = 0; r < NY; r++) { o = r * NX; for (j = 0; j < NX; j++) { d = (v[o + j] - (j ? v[o + j - 1] : 0)) & 0xffff; b[o + j] = d & 255; b[N + o + j] = d >> 8; } }
      return b.buffer;
    }
    if (e === "dxdy8") {
      var a = new Uint8Array(buf), dx = new Uint8Array(N), out = new Uint8Array(N);
      for (r = 0; r < NY; r++) { o = r * NX; for (j = 0; j < NX; j++) dx[o + j] = (a[o + j] - (j ? a[o + j - 1] : 0)) & 255; }
      for (r = 0; r < NY; r++) { o = r * NX; for (j = 0; j < NX; j++) out[o + j] = (dx[o + j] - (r ? dx[o - NX + j] : 0)) & 255; }
      return out.buffer;
    }
    throw new Error(name + ": unknown grid encoding " + e);
  }
  return { decode: decode, encode: encode };
})();
if (typeof module !== "undefined") module.exports = GRIDCODEC;
