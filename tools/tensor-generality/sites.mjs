// The test sites: typical London conditions, each a square (side in metres, turned by rot degrees) round a centre.
export const SITES = [
  { id: 'soho',        zh: '市中心密集区 · Soho',            en: 'Dense centre · Soho',             c: [-0.1335, 51.5130], side: 1000 },
  { id: 'bexleyheath', zh: '外围郊区 · Bexleyheath',         en: 'Outer suburb · Bexleyheath',      c: [0.1350, 51.4560],  side: 1200 },
  { id: 'hampstead',   zh: '北部坡地 · Hampstead',           en: 'Northern slope · Hampstead',      c: [-0.1780, 51.5590], side: 1200 },
  { id: 'sydenham',    zh: '南部坡地 · Sydenham Hill',       en: 'Southern slope · Sydenham Hill',  c: [-0.0720, 51.4300], side: 1200 },
  { id: 'battersea',   zh: '泰晤士河边 · Nine Elms',         en: 'Thames side · Nine Elms',         c: [-0.1350, 51.4830], side: 1200 },
  { id: 'stratford',   zh: '铁路枢纽 · Stratford',           en: 'Rail hub · Stratford',            c: [-0.0030, 51.5420], side: 1200 },
  { id: 'barking',     zh: '东区平坦洪泛区 · Barking Riverside', en: 'Flat east floodplain · Barking Riverside', c: [0.1150, 51.5200], side: 1200 },
  { id: 'crewshill',   zh: '绿带农田 · Crews Hill',          en: 'Green belt · Crews Hill',         c: [-0.1050, 51.6750], side: 1200 },
  // scale
  { id: 'camden-s',    zh: '小地块 20 ha · Camden',          en: 'Small 20 ha · Camden',            c: [-0.1430, 51.5390], side: 450 },
  { id: 'lewisham-l',  zh: '大地块 3.4 km · Lewisham',       en: 'Large 3.4 km · Lewisham',         c: [-0.0130, 51.4600], side: 3400 },
  // boundary dependence: the same places, the boundary turned 20°
  { id: 'soho-r20',      zh: '市中心 · 边界转 20°',  en: 'Centre · boundary turned 20°', c: [-0.1335, 51.5130], side: 1000, rot: 20, of: 'soho' },
  { id: 'bexleyheath-r20', zh: '郊区 · 边界转 20°', en: 'Suburb · boundary turned 20°', c: [0.1350, 51.4560], side: 1200, rot: 20, of: 'bexleyheath' },
  { id: 'crewshill-r20', zh: '绿带 · 边界转 20°', en: 'Green belt · boundary turned 20°', c: [-0.1050, 51.6750], side: 1200, rot: 20, of: 'crewshill' },
  { id: 'hampstead-r20', zh: '北部坡地 · 边界转 20°', en: 'Slope · boundary turned 20°', c: [-0.1780, 51.5590], side: 1200, rot: 20, of: 'hampstead' },
];
export function ringOf(s){
  const [lng, lat] = s.c, h = s.side / 2, a = (s.rot || 0) * Math.PI / 180, mLat = 111320, mLng = 111320 * Math.cos(lat * Math.PI / 180);
  const pts = [[-h, -h], [h, -h], [h, h], [-h, h]].map(([x, y]) => [x * Math.cos(a) - y * Math.sin(a), x * Math.sin(a) + y * Math.cos(a)]).map(([x, y]) => [lng + x / mLng, lat + y / mLat]);
  return [...pts, pts[0]];
}
