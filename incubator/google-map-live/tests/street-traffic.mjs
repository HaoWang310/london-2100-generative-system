/* Street traffic regression (no DOM, no MapLibre).
   Builds a synthetic London-like street grid, runs four simulated minutes and
   checks the behaviours the map relies on:
   - after the starting population, no vehicle appears or disappears on screen;
   - vehicles in the same lane never overlap;
   - no vehicle stays stopped for long (no gridlock) and traffic keeps moving;
   - the screen holds roughly the requested number of vehicles;
   - tile pieces that meet at a tile edge join into one continuous road. */
import assert from 'node:assert/strict';
import {
  buildRoadGraph,createTrafficSim,clipPolylineToSquare,vehicleParts,VEHICLE_SPECS,
  decodeVectorTileLayer,roadLinesFromTile
} from '../scripts/street_traffic.js';

// ---- vector-tile decoding (synthetic protobuf) ------------------------------
{
  const varint=n=>{const o=[];do{let b=n%128;n=Math.floor(n/128);if(n)b|=128;o.push(b);}while(n);return o;};
  const zz=n=>n>=0?n*2:-n*2-1;
  const field=(num,wire,payload)=>[...varint(num*8+wire),...(wire===2?varint(payload.length):[]),...payload];
  const str=s=>[...new TextEncoder().encode(s)];
  const layer=(name,feats,keys,values)=>field(3,2,[
    ...field(15,0,[2]),...field(1,2,str(name)),
    ...feats.flatMap(f=>field(2,2,f)),
    ...keys.flatMap(k=>field(3,2,str(k))),
    ...values.flatMap(v=>field(4,2,v)),
    ...field(5,0,varint(4096))
  ]);
  const geom=[9,zz(10),zz(10),18,zz(90),zz(0),zz(0),zz(40)];
  const feature=[...field(2,2,[0,0,1,1]),...field(3,0,[2]),...field(4,2,geom.flatMap(varint))];
  const tile=new Uint8Array([
    ...layer('water',[],[],[]),
    ...layer('transportation',[feature],['class','oneway'],[field(1,2,str('minor')),field(4,0,varint(1))])
  ]);
  const decoded=decodeVectorTileLayer(tile,'transportation');
  assert.equal(decoded.extent,4096);
  assert.equal(decoded.features.length,1);
  assert.deepEqual(decoded.features[0].properties,{class:'minor',oneway:1});
  assert.deepEqual(decoded.features[0].lines[0].map(p=>[p.x,p.y]),[[10,10],[100,10],[100,50]]);
  const roads=roadLinesFromTile(decoded,14,2,3);
  assert.equal(roads.length,1);
  assert.equal(roads[0].oneway,1);
  assert.equal(decodeVectorTileLayer(tile,'building'),null);
}

// ---- tile clipping joins exactly at the tile edge ---------------------------
{
  const E=100;
  const line=[{x:-20,y:50},{x:50,y:50},{x:130,y:60}];
  const a=clipPolylineToSquare(line,E);              // tile 0
  const b=clipPolylineToSquare(line.map(p=>({x:p.x-E,y:p.y})),E); // tile 1
  assert.equal(a.length,1);
  assert.equal(b.length,1);
  const aEnd=a[0][a[0].length-1],bStart=[b[0][0][0]+E,b[0][0][1]];
  assert.ok(Math.hypot(aEnd[0]-bStart[0],aEnd[1]-bStart[1])<1e-9,'pieces must meet at the edge');
  const g=buildRoadGraph([
    {coords:a[0],cls:'minor',oneway:0},
    {coords:b[0].map(([x,y])=>[x+E,y]),cls:'minor',oneway:0}
  ],{metresPerUnit:1,origin:[0,0]});
  assert.equal(g.links.length,1,'a road split by a tile edge must become one link');
}

// ---- synthetic grid ---------------------------------------------------------
const SP=110,N=6;
const lines=[];
for(let i=0;i<N;i++){
  // Horizontal streets; row 2 is a primary road, split at a fake tile edge.
  const y=i*SP;
  const cls=i===2?'primary':'minor';
  if(i===2){
    lines.push({coords:[[0,y],[2.5*SP,y]],cls,oneway:0});
    lines.push({coords:[[2.5*SP,y],[(N-1)*SP,y]],cls,oneway:0});
  }else{
    const coords=[];for(let k=0;k<N;k++)coords.push([k*SP,y]);
    lines.push({coords,cls,oneway:0});
  }
  // Vertical streets; column 4 is one-way southbound.
  const x=i*SP;
  const coords=[];for(let k=0;k<N;k++)coords.push([x,k*SP]);
  lines.push({coords,cls:i===3?'secondary':'minor',oneway:i===4?1:0});
}
// A dead-end spur inside the visible area.
lines.push({coords:[[2*SP,3*SP],[2*SP+45,3*SP+40]],cls:'minor',oneway:0});

const graph=buildRoadGraph(lines,{metresPerUnit:1,origin:[0,0]});
assert.ok(graph.links.length>40,'grid links');

const C=[(N-1)*SP/2,(N-1)*SP/2];
const HALF_W=170,HALF_H=120;
const view={
  isVisible:(x,y,m=0)=>Math.abs(x-C[0])<=HALF_W+m*0.5&&Math.abs(y-C[1])<=HALF_H+m*0.5,
  distance:(x,y)=>Math.hypot(x-C[0],y-C[1]),
  outerRadius:Math.hypot(HALF_W,HALF_H)+140,
  spacingM:85,maxVisible:70
};

const sim=createTrafficSim({seed:7});
sim.setGraph(graph);
sim.populate(5);

const DT=1/30,SECONDS=240;
let prev=new Map();
let poppedIn=0,poppedOut=0,overlapFrames=0,maxStopped=0;
let speedSum=0,speedN=0,visibleSum=0,visibleN=0;
const stoppedFor=new Map();

for(let i=0;i<SECONDS/DT;i++){
  sim.step(DT,view);
  const t=sim.time;
  const now=new Map();
  for(const v of sim.vehicles){
    const p=sim.pose(v);
    now.set(v.id,{p,v});
    if(!prev.has(v.id)&&t>8&&view.isVisible(p.x,p.y,0))poppedIn++;
  }
  for(const [id,{p}] of prev){
    if(!now.has(id)&&view.isVisible(p.x,p.y,0))poppedOut++;
  }
  // Same-lane overlap: similar heading, small lateral offset, centres too close.
  const list=[...now.values()];
  let overlap=false;
  for(let a=0;a<list.length&&!overlap;a++){
    for(let b=a+1;b<list.length;b++){
      const A=list[a],B=list[b];
      if(A.v.seg.type!=='link'||B.v.seg.type!=='link')continue;
      if(A.v.seg.link!==B.v.seg.link||A.v.seg.d!==B.v.seg.d||A.v.seg.lane!==B.v.seg.lane)continue;
      if(t<A.v.releaseUntil||t<B.v.releaseUntil)continue;
      const gap=Math.abs(A.v.pos-B.v.pos)-(A.v.spec.L+B.v.spec.L)/2;
      if(gap<0){overlap=true;break;}
    }
  }
  if(overlap)overlapFrames++;
  for(const {v} of list){
    const s=v.v<0.25?(stoppedFor.get(v.id)||0)+DT:0;
    stoppedFor.set(v.id,s);
    if(s>maxStopped)maxStopped=s;
    if(t>20){speedSum+=v.v;speedN++;}
  }
  if(t>20){
    visibleSum+=list.filter(({p})=>view.isVisible(p.x,p.y,0)).length;
    visibleN++;
  }
  prev=now;
}

const meanSpeed=speedSum/Math.max(1,speedN);
const meanVisible=visibleSum/Math.max(1,visibleN);
const report={
  poppedIn,poppedOut,overlapFrames,maxStopped:+maxStopped.toFixed(1),
  meanSpeed:+meanSpeed.toFixed(2),meanVisible:+meanVisible.toFixed(1),
  vehicles:sim.vehicles.length,targets:sim.targets,stats:sim.stats
};

assert.equal(poppedIn,0,'no vehicle may appear on screen after the starting population: '+JSON.stringify(report));
assert.equal(poppedOut,0,'no vehicle may vanish on screen: '+JSON.stringify(report));
assert.equal(overlapFrames,0,'vehicles in one lane must not overlap: '+JSON.stringify(report));
assert.ok(maxStopped<14,'no vehicle may stay stopped for long: '+JSON.stringify(report));
assert.ok(meanSpeed>3.5,'traffic must keep moving: '+JSON.stringify(report));
assert.ok(meanVisible>=sim.targets.visible*0.6,'screen should hold most of the target: '+JSON.stringify(report));

// ---- every vehicle type produces a model at every detail level --------------
for(const [key,spec] of Object.entries(VEHICLE_SPECS)){
  for(const lod of ['detail','medium','tiny','flat']){
    const parts=vehicleParts({spec,color:'#ffffff',key},lod);
    assert.ok(parts.length>0,key+' '+lod);
    for(const p of parts){
      assert.ok(p.top>=p.base&&p.ring.length>=4,key+' '+lod+' part');
    }
  }
  assert.ok(vehicleParts({spec,color:'#fff'},'detail').length>vehicleParts({spec,color:'#fff'},'medium').length);
}

console.log('PASS street traffic: '+JSON.stringify(report));
