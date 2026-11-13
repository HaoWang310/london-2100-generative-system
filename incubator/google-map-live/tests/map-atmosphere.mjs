/* Lighting / weather regression (no DOM). */
import assert from 'node:assert/strict';
import {
  sunPosition,lightingForSun,presetForSun,blendLighting,tintHex,mixHex,
  LIGHTING_PRESETS,WEATHER_PRESETS
} from '../scripts/map_atmosphere.js';
import {tintPalette,BASEMAP_THEMES} from '../scripts/osm_basemap_themes.js';

const LONDON=[51.5074,-0.1278];
const near=(a,b,tol,msg)=>assert.ok(Math.abs(a-b)<=tol,msg+': '+a.toFixed(2)+' vs '+b);

// Sun at London: summer solstice noon ~62 deg due south, winter noon ~15 deg, midnight below horizon.
let s=sunPosition(new Date(Date.UTC(2026,5,21,12,0)),...LONDON);
near(s.altitude,62,1.5,'summer noon altitude');
near(s.azimuth,180,6,'summer noon azimuth');
s=sunPosition(new Date(Date.UTC(2026,11,21,12,0)),...LONDON);
near(s.altitude,15,1.5,'winter noon altitude');
s=sunPosition(new Date(Date.UTC(2026,11,21,0,0)),...LONDON);
assert.ok(s.altitude<-40,'midnight sun below horizon');
const morning=sunPosition(new Date(Date.UTC(2026,2,20,6,30)),...LONDON);
assert.ok(morning.azimuth<180,'morning sun in the east');

assert.equal(presetForSun({altitude:-20,azimuth:0}),'night');
assert.equal(presetForSun({altitude:3,azimuth:95}),'dawn');
assert.equal(presetForSun({altitude:3,azimuth:265}),'dusk');
assert.equal(presetForSun({altitude:40,azimuth:180}),'day');

// Live lighting is continuous across sunrise and uses the real sun direction.
let prev=null;
for(let alt=-10;alt<=20;alt+=0.5){
  const l=lightingForSun({altitude:alt,azimuth:100});
  if(prev){
    assert.ok(Math.abs(l.tint.amount-prev.tint.amount)<0.08,'tint jumps at '+alt);
    assert.ok(Math.abs(l.light.intensity-prev.light.intensity)<0.05,'light jumps at '+alt);
  }
  prev=l;
}
const low=lightingForSun({altitude:5,azimuth:120});
near(low.light.azimuth,120,0.01,'light follows the sun azimuth');
assert.ok(low.light.polar>80,'low sun gives a grazing light');

// Blends reproduce their endpoints.
const P=LIGHTING_PRESETS;
assert.deepEqual(blendLighting(P.dawn,P.night,0).light,P.dawn.light);
assert.equal(blendLighting(P.dawn,P.night,1).tint.amount,P.night.tint.amount);
assert.equal(blendLighting(P.night,P.day,1).night,0);

// Every preset is complete.
for(const [k,p] of Object.entries(P)){
  for(const f of ['azimuth','polar','color','intensity'])assert.ok(p.light[f]!=null,k+' light.'+f);
  for(const f of ['sky','horizon','fog'])assert.match(p.sky[f],/^#[0-9a-f]{6}$/i,k+' sky.'+f);
}
for(const k of ['clear','fog','rain','snow'])assert.ok(WEATHER_PRESETS[k],'weather '+k);

// Tints.
assert.equal(mixHex('#000000','#ffffff',0.5),'#808080');
assert.equal(tintHex('#ffffff',[]),'#ffffff');
assert.equal(tintHex('rgba(1,2,3,0.5)',[{color:'#000000',amount:1}]),'rgba(1,2,3,0.5)');
const nightPalette=tintPalette(BASEMAP_THEMES.planning,[P.night.tint]);
assert.equal(nightPalette.text,BASEMAP_THEMES.planning.text,'label text is never tinted');
assert.notEqual(nightPalette.land,BASEMAP_THEMES.planning.land,'the ground darkens at night');
assert.equal(tintPalette(BASEMAP_THEMES.planning,[]),BASEMAP_THEMES.planning);
// Night: ground darker than streets, so roads stay legible.
const lum=h=>{const n=parseInt(h.slice(1),16);return ((n>>16)&255)+((n>>8)&255)+(n&255);};
assert.ok(lum(nightPalette.road)>lum(nightPalette.land)+40,'streets lighter than the ground at night');
const mid=blendLighting(P.day,P.night,0.5).tint;
assert.ok(mid.roles.ground>mid.roles.vehicle,'blended tint keeps per-role strengths');

console.log('PASS map atmosphere: sun position, live lighting, presets and tints');
