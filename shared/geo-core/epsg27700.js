// EPSG:27700 (British National Grid) <-> WGS84 conversion.
//
// All computation in this project happens in EPSG:27700 metres ([E, N]).
// WGS84 [lon, lat] is used only for display on the map.
//
// Method: 7-parameter Helmert datum shift (OSGB36 <-> WGS84) followed by the
// Ordnance Survey Transverse Mercator formulae (OS "A guide to coordinate
// systems in Great Britain", Annex C). Expected absolute accuracy is about
// 2-5 m across London (Helmert limit). Sub-metre work needs the OSTN15 grid
// shift, which can be plugged in later through setDatumShift().

const DEG = Math.PI / 180;
const ARCSEC = DEG / 3600;

const AIRY1830 = { a: 6377563.396, b: 6356256.909 };
const WGS84 = { a: 6378137.0, b: 6356752.314245 };

// National Grid projection constants.
const F0 = 0.9996012717;
const LAT0 = 49 * DEG;
const LON0 = -2 * DEG;
const N0 = -100000;
const E0 = 400000;

// WGS84 -> OSGB36 Helmert parameters (OS published values).
const HELMERT_TO_OSGB = {
  tx: -446.448, ty: 125.157, tz: -542.060,
  s: 20.4894e-6,
  rx: -0.1502 * ARCSEC, ry: -0.2470 * ARCSEC, rz: -0.8421 * ARCSEC
};
const HELMERT_TO_WGS = {
  tx: 446.448, ty: -125.157, tz: 542.060,
  s: -20.4894e-6,
  rx: 0.1502 * ARCSEC, ry: 0.2470 * ARCSEC, rz: 0.8421 * ARCSEC
};

export const CRS = 'EPSG:27700';
export const ACCURACY_NOTE = 'Helmert transform, ~2-5 m absolute accuracy';

function toCartesian(lat, lon, h, ell) {
  const e2 = 1 - (ell.b * ell.b) / (ell.a * ell.a);
  const sinLat = Math.sin(lat);
  const nu = ell.a / Math.sqrt(1 - e2 * sinLat * sinLat);
  return [
    (nu + h) * Math.cos(lat) * Math.cos(lon),
    (nu + h) * Math.cos(lat) * Math.sin(lon),
    (nu * (1 - e2) + h) * sinLat
  ];
}

function fromCartesian([x, y, z], ell) {
  const e2 = 1 - (ell.b * ell.b) / (ell.a * ell.a);
  const p = Math.sqrt(x * x + y * y);
  let lat = Math.atan2(z, p * (1 - e2));
  for (let i = 0; i < 10; i++) {
    const nu = ell.a / Math.sqrt(1 - e2 * Math.sin(lat) ** 2);
    const next = Math.atan2(z + e2 * nu * Math.sin(lat), p);
    if (Math.abs(next - lat) < 1e-12) { lat = next; break; }
    lat = next;
  }
  return [lat, Math.atan2(y, x)];
}

function helmert([x, y, z], t) {
  const s1 = 1 + t.s;
  return [
    t.tx + s1 * x - t.rz * y + t.ry * z,
    t.ty + t.rz * x + s1 * y - t.rx * z,
    t.tz - t.ry * x + t.rx * y + s1 * z
  ];
}

function meridionalArc(lat, a, b) {
  const n = (a - b) / (a + b), n2 = n * n, n3 = n2 * n;
  const dl = lat - LAT0, sl = lat + LAT0;
  return b * F0 * (
    (1 + n + 1.25 * n2 + 1.25 * n3) * dl -
    (3 * n + 3 * n2 + 2.625 * n3) * Math.sin(dl) * Math.cos(sl) +
    (1.875 * n2 + 1.875 * n3) * Math.sin(2 * dl) * Math.cos(2 * sl) -
    (35 / 24) * n3 * Math.sin(3 * dl) * Math.cos(3 * sl)
  );
}

function projectOSGB(lat, lon) {
  const { a, b } = AIRY1830;
  const e2 = 1 - (b * b) / (a * a);
  const sin = Math.sin(lat), cos = Math.cos(lat), tan = Math.tan(lat);
  const nu = a * F0 / Math.sqrt(1 - e2 * sin * sin);
  const rho = a * F0 * (1 - e2) / Math.pow(1 - e2 * sin * sin, 1.5);
  const eta2 = nu / rho - 1;
  const M = meridionalArc(lat, a, b);
  const I = M + N0;
  const II = nu / 2 * sin * cos;
  const III = nu / 24 * sin * cos ** 3 * (5 - tan ** 2 + 9 * eta2);
  const IIIA = nu / 720 * sin * cos ** 5 * (61 - 58 * tan ** 2 + tan ** 4);
  const IV = nu * cos;
  const V = nu / 6 * cos ** 3 * (nu / rho - tan ** 2);
  const VI = nu / 120 * cos ** 5 * (5 - 18 * tan ** 2 + tan ** 4 + 14 * eta2 - 58 * tan ** 2 * eta2);
  const dL = lon - LON0;
  return [
    E0 + IV * dL + V * dL ** 3 + VI * dL ** 5,
    I + II * dL ** 2 + III * dL ** 4 + IIIA * dL ** 6
  ];
}

function unprojectOSGB(E, N) {
  const { a, b } = AIRY1830;
  const e2 = 1 - (b * b) / (a * a);
  let lat = LAT0, M = 0;
  do {
    lat = (N - N0 - M) / (a * F0) + lat;
    M = meridionalArc(lat, a, b);
  } while (Math.abs(N - N0 - M) >= 0.00001);
  const sin = Math.sin(lat), cos = Math.cos(lat), tan = Math.tan(lat);
  const nu = a * F0 / Math.sqrt(1 - e2 * sin * sin);
  const rho = a * F0 * (1 - e2) / Math.pow(1 - e2 * sin * sin, 1.5);
  const eta2 = nu / rho - 1;
  const sec = 1 / cos;
  const VII = tan / (2 * rho * nu);
  const VIII = tan / (24 * rho * nu ** 3) * (5 + 3 * tan ** 2 + eta2 - 9 * tan ** 2 * eta2);
  const IX = tan / (720 * rho * nu ** 5) * (61 + 90 * tan ** 2 + 45 * tan ** 4);
  const X = sec / nu;
  const XI = sec / (6 * nu ** 3) * (nu / rho + 2 * tan ** 2);
  const XII = sec / (120 * nu ** 5) * (5 + 28 * tan ** 2 + 24 * tan ** 4);
  const XIIA = sec / (5040 * nu ** 7) * (61 + 662 * tan ** 2 + 1320 * tan ** 4 + 720 * tan ** 6);
  const dE = E - E0;
  return [
    lat - VII * dE ** 2 + VIII * dE ** 4 - IX * dE ** 6,
    LON0 + X * dE - XI * dE ** 3 + XII * dE ** 5 - XIIA * dE ** 7
  ];
}

/** WGS84 [lon, lat] (degrees) -> EPSG:27700 [E, N] (metres). */
export function toBNG([lon, lat]) {
  const xyz = helmert(toCartesian(lat * DEG, lon * DEG, 0, WGS84), HELMERT_TO_OSGB);
  const [phi, lam] = fromCartesian(xyz, AIRY1830);
  return projectOSGB(phi, lam);
}

/**
 * EPSG:27700 [E, N] (metres) -> WGS84 [lon, lat] (degrees).
 * The reverse Helmert is only approximately the inverse of the forward one
 * (~3 mm), so the result is refined until toBNG(toWGS84(p)) === p to < 0.1 mm.
 * That keeps geometry from drifting when it goes map -> model -> map.
 */
export function toWGS84([E, N]) {
  const [phi, lam] = unprojectOSGB(E, N);
  const xyz = helmert(toCartesian(phi, lam, 0, AIRY1830), HELMERT_TO_WGS);
  const [lat0, lon0] = fromCartesian(xyz, WGS84);
  let lon = lon0 / DEG, lat = lat0 / DEG;
  for (let i = 0; i < 4; i++) {
    const [e, n] = toBNG([lon, lat]);
    const dE = E - e, dN = N - n;
    if (Math.hypot(dE, dN) < 1e-4) break;
    lon += dE / (111320 * Math.cos(lat * DEG));
    lat += dN / 111132;
  }
  return [lon, lat];
}

export const ringToWGS84 = ring => ring.map(toWGS84);
export const ringToBNG = ring => ring.map(toBNG);

// Exposed for tests against the OS worked example (OSGB36 datum, no Helmert).
export const _internal = { projectOSGB, unprojectOSGB, DEG };
