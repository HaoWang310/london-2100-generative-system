/* Building ground-shadow geometry (no WebGL). */
import assert from 'node:assert/strict';
import {shadowOffset,earClip,buildShadowTriangles} from '../scripts/building_shadows.js';
import {WEATHER_SHADOW,SHADOW_STRENGTH} from '../scripts/map_atmosphere.js';

const near=(a,b,t,m)=>assert.ok(Math.abs(a-b)<=t,m+': '+a+' vs '+b);

// Sun due south at 45 deg: a 1 m tall building casts 1 m of shadow due north (y is south).
let o=shadowOffset(180,45);
near(o.x,0,1e-9,'south sun x');near(o.y,-1,1e-9,'south sun y');
// Sun in the west at 30 deg: shadow points east, length 1/tan(30).
o=shadowOffset(270,30);
near(o.x,1/Math.tan(Math.PI/6),1e-9,'west sun x');near(o.y,0,1e-9,'west sun y');
// No shadow when the sun is down or grazing the horizon.
assert.equal(shadowOffset(180,-5),null);
assert.equal(shadowOffset(180,2),null);

// Ear clipping of a concave L shape keeps its exact area.
const L=[[0,0],[4,0],[4,1],[1,1],[1,3],[0,3]];
const tris=earClip(L);
assert.equal(tris.length/3,L.length-2,'n-2 triangles');
let area=0;
for(let i=0;i<tris.length;i+=3){
  const [a,b,c]=[tris[i],tris[i+1],tris[i+2]];
  area+=Math.abs((b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]))/2;
}
near(area,6,1e-9,'L-shape area');

// A 10 x 10 m, 20 m tall block with the sun due south at 45 deg:
// the shadow reaches 20 m north of the block.
const mesh=buildShadowTriangles([{ring:[[0,0],[10,0],[10,10],[0,10]],height:20}],shadowOffset(180,45));
const ys=[];for(let i=1;i<mesh.length;i+=2)ys.push(mesh[i]);
near(Math.min(...ys),-20,1e-4,'shadow tip');
near(Math.max(...ys),10,1e-4,'shadow base');
assert.equal(buildShadowTriangles([{ring:[[0,0],[1,0],[1,1]],height:5}],null).length,0,'no sun, no mesh');

// Overcast weather softens shadows; clear sky is full strength.
assert.equal(WEATHER_SHADOW.clear,1);
assert.ok(WEATHER_SHADOW.fog<WEATHER_SHADOW.rain&&WEATHER_SHADOW.rain<WEATHER_SHADOW.snow);
assert.ok(SHADOW_STRENGTH>0&&SHADOW_STRENGTH<0.5);

console.log('PASS building shadows: direction, length, triangulation, weather');
