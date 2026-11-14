/* Procedural green-space trees (no DOM). */
import assert from 'node:assert/strict';
import {scatterTrees,greenClassOf,treeParts,pointInPolygon,hash01,GREEN_CLASSES,treeTint} from '../scripts/urban_trees.js';
import {buildTreeModels} from '../scripts/tree_renderer.js';

// Class mapping from OpenMapTiles layers.
assert.equal(greenClassOf('landcover',{class:'wood',subclass:'forest'}),'wood');
assert.equal(greenClassOf('landcover',{class:'grass',subclass:'park'}),'park');
assert.equal(greenClassOf('landcover',{class:'grass',subclass:'golf_course'}),'sport');
assert.equal(greenClassOf('landcover',{class:'sand'}),null);
assert.equal(greenClassOf('landuse',{class:'cemetery'}),'cemetery');
assert.equal(greenClassOf('landuse',{class:'residential'}),null);

// Point in polygon with a hole.
const sq=[[0,0],[100,0],[100,100],[0,100],[0,0]];
const hole=[[40,40],[60,40],[60,60],[40,60],[40,40]];
assert.ok(pointInPolygon(10,10,[sq,hole]));
assert.ok(!pointInPolygon(50,50,[sq,hole]),'no trees in courtyards/holes');

// A 200 x 200 m park: density near the class chance, all inside, no water trees.
const park=[[0,0],[200,0],[200,200],[0,200],[0,0]];
const pond=[[80,80],[120,80],[120,120],[80,120],[80,80]];
const trees=scatterTrees([{cls:'park',rings:[park]}],[{rings:[pond]}]);
const expected=(200/GREEN_CLASSES.park.spacing)**2*GREEN_CLASSES.park.chance;
assert.ok(trees.length>expected*0.6&&trees.length<expected*1.3,'park density '+trees.length+' ~ '+expected.toFixed(0));
assert.ok(trees.every(t=>t.x>=0&&t.x<=200&&t.y>=0&&t.y<=200),'inside the park');
assert.ok(!trees.some(t=>pointInPolygon(t.x,t.y,[pond])),'no trees in water');
// Woods are denser than parks.
const wood=scatterTrees([{cls:'wood',rings:[park]}],[]);
assert.ok(wood.length>trees.length*2,'woods denser than parks');

// Deterministic: the same place grows the same trees, even when the polygon is
// split differently (e.g. by tile edges) or listed twice.
const again=scatterTrees([{cls:'park',rings:[park]},{cls:'park',rings:[park]}],[{rings:[pond]}]);
assert.deepEqual(again.map(t=>[t.x,t.y]),trees.map(t=>[t.x,t.y]),'stable and not doubled');
const left=[[0,0],[100,0],[100,200],[0,200],[0,0]],right=[[100,0],[200,0],[200,200],[100,200],[100,0]];
const split=scatterTrees([{cls:'park',rings:[left]},{cls:'park',rings:[right]}],[{rings:[pond]}]);
assert.equal(split.length,trees.length,'splitting a park does not change its trees');

// Cap.
assert.equal(scatterTrees([{cls:'wood',rings:[[[0,0],[2000,0],[2000,2000],[0,2000],[0,0]]]}],[],{maxTrees:500}).length,500);

// Models.
for(const conifer of [false,true]){
  const t={x:0,y:0,h:12,r:3,conifer,tone:0.4};
  const d=treeParts(t,'detail');
  assert.equal(d.filter(p=>p.kind==='trunk').length,1);
  assert.ok(d.filter(p=>p.kind==='crown').length>=4);
  assert.ok(Math.max(...d.map(p=>p.top))<=12+1e-9);
  assert.equal(treeParts(t,'simple').length,1);
  assert.equal(treeParts(t,'flat')[0].top,0);
}
assert.ok(hash01(1,2,3)>=0&&hash01(1,2,3)<1);

// 3D models: unit height, sane sizes, normals and colours present.
const models=buildTreeModels();
for(const [name,m] of Object.entries(models)){
  assert.equal(m.position.length,m.normal.length,name);
  assert.equal(m.position.length,m.color.length,name);
  let zmax=0,zmin=1,rmax=0;
  for(let i=0;i<m.position.length;i+=3){
    zmax=Math.max(zmax,m.position[i+2]);zmin=Math.min(zmin,m.position[i+2]);
    rmax=Math.max(rmax,Math.hypot(m.position[i],m.position[i+1]));
  }
  assert.ok(zmin>-0.05&&zmax<1.15&&zmax>0.85,name+' height '+zmin.toFixed(2)+'..'+zmax.toFixed(2));
  assert.ok(rmax<0.6,name+' crown radius '+rmax.toFixed(2));
  assert.ok(m.count<2500,name+' vertex budget');
}
assert.ok(trees.some(t=>t.variant==='broadleaf'));
for(const t of trees.slice(0,20)){const c=treeTint(t);assert.ok(c.every(v=>v>0.7&&v<1.4));}

console.log('PASS urban trees: classes, density, water, determinism, models ('+trees.length+' park trees)');

// Street trees: both kerbs of a residential street, none on the carriageway,
// none in buildings or airports, none on a crossing road, none on motorways.
{
  const {streetTreeSlots,STREET_HALF_WIDTH,STREET_TREES}=await import('../scripts/urban_trees.js');
  const street={cls:'minor',coords:[[0,0],[400,0]]};
  const cross={cls:'secondary',coords:[[200,-200],[200,200]]};
  const shop={rings:[[[50,3],[90,3],[90,30],[50,30],[50,3]]]};
  const airport={rings:[[[300,-50],[400,-50],[400,50],[300,50],[300,-50]]]};
  const out=scatterTrees([],[],{roads:[street,cross,{cls:'motorway',coords:[[0,500],[400,500]]}],exclude:[shop,airport]});
  const off=STREET_HALF_WIDTH.minor+STREET_TREES.kerb;
  const onStreet=out.filter(t=>Math.abs(Math.abs(t.y)-off)<1e-6);
  assert.ok(onStreet.some(t=>t.y>0)&&onStreet.some(t=>t.y<0),'trees on both kerbs');
  assert.ok(out.every(t=>t.cls==='street'),'only street trees');
  assert.ok(!out.some(t=>Math.abs(t.y-500)<20),'no trees along motorways');
  assert.ok(!out.some(t=>t.x>=50&&t.x<=90&&t.y>=3&&t.y<=30),'no trees in buildings');
  assert.ok(!out.some(t=>t.x>=300&&t.x<=400&&Math.abs(t.y)<=50),'no trees in airports');
  assert.ok(!out.some(t=>Math.abs(t.x-200)<STREET_HALF_WIDTH.secondary+0.8&&Math.abs(t.y)<off+1),'junction kept clear');
  // Same trees when the street arrives split into tiles.
  const parts=streetTreeSlots([{cls:'minor',coords:[[0,0],[137,0]]},{cls:'minor',coords:[[137,0],[400,0]]}]);
  const whole=streetTreeSlots([street]);
  assert.deepEqual(parts.map(t=>[t.x.toFixed(3),t.y]).sort(),whole.map(t=>[t.x.toFixed(3),t.y]).sort(),'tile split stable');
  // Plain grass (verges, airfields) and pitches grow nothing.
  assert.equal(greenClassOf('landcover',{class:'grass',subclass:null}),null);
  assert.equal(greenClassOf('landcover',{class:'grass',subclass:'pitch'}),null);
  assert.equal(greenClassOf('landuse',{class:'pitch'}),null);
  console.log('PASS street trees ('+out.length+')');
}
