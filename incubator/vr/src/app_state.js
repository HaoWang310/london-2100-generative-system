// What the London map app is set to right now, for the VR scene: lighting, weather and the display switches.
//
// Read from the app's own page (which buttons are pressed, which switches are on) and turned into numbers with the
// app's own presets: LIGHTING_PRESETS, WEATHER_PRESETS, sunPosition() and lightingForSun() are imported, read-only,
// from the app's scripts/map_atmosphere.js, so dawn, dusk, night, "live" and the weather mean the same in VR.
// If that file cannot be loaded the copies below (the app's values on 2026-11-14) are used.

const FALLBACK = {
  LIGHTING_PRESETS: {
    dawn: { light: { azimuth: 100, polar: 64, color: '#fff3ea', intensity: 0.42 }, sky: { sky: '#a7bfe3', horizon: '#ffd6b3', fog: '#f3dcc9' }, night: 0 },
    day: { light: { azimuth: 210, polar: 30, color: '#ffffff', intensity: 0.5 }, sky: { sky: '#88b4e8', horizon: '#e2ecf7', fog: '#eef2f6' }, night: 0 },
    dusk: { light: { azimuth: 262, polar: 62, color: '#fff2e8', intensity: 0.42 }, sky: { sky: '#6c66a6', horizon: '#ffad86', fog: '#efc4ae' }, night: 0 },
    night: { light: { azimuth: 160, polar: 45, color: '#e2e8f6', intensity: 0.35 }, sky: { sky: '#050a18', horizon: '#1c2b4b', fog: '#121a2c' }, night: 1 }
  },
  WEATHER_PRESETS: { clear: { lightScale: 1 }, fog: { lightScale: 0.8, haze: 0.55 }, rain: { lightScale: 0.7, haze: 0.2 }, snow: { lightScale: 0.85, haze: 0.22 } },
  WEATHER_SHADOW: { clear: 1, fog: 0.25, rain: 0.35, snow: 0.55 }, SHADOW_STRENGTH: 0.24,
  sunPosition: null, lightingForSun: null
};
const hex = h => { const m = /^#?([0-9a-f]{6})$/i.exec(h || ''); if (!m) return [1, 1, 1]; const n = parseInt(m[1], 16); return [(n >> 16) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]; };

/** The scene settings when there is no app to read (index.html scenes). */
export function defaultEnv(){ return envOf(FALLBACK, 'day', 'clear', { shadows: true, trees: false, cars: false }); }
/** For pages without the app: "trees,cars,rain,night" (any of the lighting / weather names, trees, cars, noshadows). */
export function envFromList(list){ const w = new Set(String(list || '').split(',').map(x => x.trim()));
  const lighting = ['dawn', 'day', 'dusk', 'night'].find(k => w.has(k)) || 'day', weather = ['clear', 'fog', 'rain', 'snow'].find(k => w.has(k)) || 'clear';
  return envOf(FALLBACK, lighting, weather, { shadows: !w.has('noshadows'), trees: w.has('trees'), cars: w.has('cars') }); }

function envOf(A, lighting, weather, sw, sun){
  const P = A.LIGHTING_PRESETS, L = (lighting === 'live' && sun && A.lightingForSun) ? A.lightingForSun(sun) : (P[lighting] || P.day), W = A.WEATHER_PRESETS[weather] || A.WEATHER_PRESETS.clear;
  // the light as a direction towards the sun in model space: x east, y up, z south; azimuth clockwise from north, polar from the zenith
  const az = L.light.azimuth * Math.PI / 180, alt = (90 - L.light.polar) * Math.PI / 180;
  const dir = [Math.sin(az) * Math.cos(alt), Math.sin(alt), -Math.cos(az) * Math.cos(alt)];
  const night = L.night || 0, I = L.light.intensity * (W.lightScale ?? 1);
  return {
    lighting, weather, dir, altitude: 90 - L.light.polar, night,
    lightColour: hex(L.light.color), ambient: 0.40 + 0.36 * I, diffuse: 0.20 + 0.60 * I,
    sky: hex(L.sky.sky), horizon: hex(L.sky.horizon), fog: hex(L.sky.fog), haze: W.haze || 0,
    shadow: sw.shadows && night < 0.5 ? (A.SHADOW_STRENGTH ?? 0.24) * ((A.WEATHER_SHADOW || {})[weather] ?? 1) * (1 - night) : 0,
    trees: !!sw.trees, cars: !!sw.cars
  };
}

/** frame: the iframe holding the app; map: its MapLibre map (for the centre, used by "live"). Returns () => env. */
export async function appEnv(frame, map){
  let A = FALLBACK;
  try { const m = await import('../../google-map-live/scripts/map_atmosphere.js'); if (m.LIGHTING_PRESETS && m.WEATHER_PRESETS) A = { ...FALLBACK, ...m }; }
  catch (e){ console.warn('VR: the app lighting presets could not be loaded, using built-in copies', e); }
  let last = null, lastT = 0;
  return () => {
    const now = performance.now(); if (last && now - lastT < 300) return last; lastT = now;
    const d = frame.contentDocument; if (!d) return last || (last = defaultEnv());
    const lighting = d.querySelector('[data-lighting][aria-pressed="true"]')?.dataset.lighting || 'day';
    const weather = d.querySelector('[data-weather][aria-pressed="true"]')?.dataset.weather || 'clear';
    const on = (id, dflt) => { const el = d.getElementById(id); return el ? el.checked : dflt; };
    let sun = null;
    if (lighting === 'live' && A.sunPosition){ try { const c = map.getCenter(); sun = A.sunPosition(new Date(), c.lat, c.lng); } catch (e){} }
    return (last = envOf(A, lighting, weather, { shadows: on('buildingShadowToggle', true), trees: on('urbanTreeToggle', false), cars: on('streetVehicleToggle', false) }, sun));
  };
}
