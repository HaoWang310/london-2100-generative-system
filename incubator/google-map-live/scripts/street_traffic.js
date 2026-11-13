/* Street traffic for the London map.
 *
 * Self-contained replacement for the previous inline vehicle system.
 *
 *  1. Road graph   - built from the OpenFreeMap `transportation` layer of the
 *                    tiles MapLibre has already loaded. Every line is clipped to
 *                    its own tile so pieces from neighbouring tiles meet exactly
 *                    at the tile edge and join into one continuous network.
 *  2. Driving      - vehicles follow lanes (UK: keep left), turn through smooth
 *                    Bezier curves at junctions and use the Intelligent Driver
 *                    Model for car following.
 *  3. No pop-in    - while the camera pans or zooms, vehicles are only created
 *                    and removed OUTSIDE the visible screen, so traffic drives in
 *                    and out of view. Only when traffic is first switched on, or
 *                    after a long camera jump, does a starting population grow
 *                    in on screen.
 *  4. No jams      - density follows the visible road length, minor roads yield
 *                    to major roads with a bounded wait, and a vehicle held for
 *                    too long is released, so queues always clear.
 *
 * The simulation core (buildRoadGraph / createTrafficSim) has no DOM or MapLibre
 * dependency so it can be tested in Node. createStreetTraffic() is the MapLibre
 * adapter used by index.html.
 */

export const WORLD_Z=16;
export const WORLD_EXTENT=4096;
export const WORLD_SIZE=2**WORLD_Z*WORLD_EXTENT;
const EARTH_CIRCUMFERENCE=40075016.686;

export const ROAD_TYPES=Object.freeze({
  motorway:{rank:6,speed:22,lanes:2,laneW:3.5},
  trunk:{rank:5,speed:15,lanes:2,laneW:3.4},
  primary:{rank:4,speed:12.5,lanes:1,laneW:3.3},
  secondary:{rank:3,speed:11,lanes:1,laneW:3.2},
  tertiary:{rank:2,speed:9.5,lanes:1,laneW:3.1},
  minor:{rank:1,speed:8,lanes:1,laneW:2.9}
});

/* London vehicle catalogue. Dimensions in metres.
 * New Routemaster 11.23 x 2.55 x 4.42 m; single-decker 10.8 x 2.47 x 2.9 m;
 * LEVC TX taxi about 4.86 x 1.94 x 1.88 m. */
export const VEHICLE_SPECS=Object.freeze({
  hatch:{kind:'car',L:4.05,W:1.78,H:1.47,belt:0.86,wb:2.55,hood:1.15,speed:1.00,weight:30},
  saloon:{kind:'car',L:4.70,W:1.82,H:1.44,belt:0.84,wb:2.80,hood:1.35,speed:1.03,weight:24},
  suv:{kind:'car',L:4.60,W:1.88,H:1.68,belt:1.00,wb:2.75,hood:1.20,speed:1.00,weight:16},
  cab:{kind:'cab',L:4.86,W:1.94,H:1.88,belt:0.98,wb:3.00,hood:1.05,speed:0.95,weight:9},
  van:{kind:'van',L:5.30,W:2.00,H:2.45,belt:1.08,wb:3.40,hood:0.80,speed:0.90,weight:10},
  bus1:{kind:'bus',L:10.80,W:2.47,H:2.90,wb:5.80,speed:0.76,weight:3,decks:1,busOnly:true},
  bus2:{kind:'bus',L:11.23,W:2.55,H:4.42,wb:6.30,speed:0.72,weight:4,decks:2,busOnly:true}
});

const CAR_COLORS=[
  ['#f2f2f3',18],['#c9cbd0',16],['#8d9096',12],['#4a4d53',10],['#1b1c1f',14],
  ['#1f3a6b',8],['#8c1d1d',5],['#2f4a3a',3],['#6b4f3a',2],['#3b82c4',4]
];
const VAN_COLORS=[['#f4f4f5',60],['#d4d4d8',20],['#1f3a6b',10],['#b91c1c',5]];
const BUS_RED='#cf161d';
const CAB_BLACK='#151517';
const GLASS='#26303b';
const WHEEL='#121214';
const HEADLIGHT='#fff6d5';
const TAILLIGHT='#c41e1e';

/* ---------------------------------------------------------------- utils */

const TAU=Math.PI*2;
function angleDiff(a,b){
  let d=(a-b)%TAU;
  if(d>Math.PI)d-=TAU;
  if(d<-Math.PI)d+=TAU;
  return d;
}
function pickWeighted(items,rand){
  let total=0;
  for(const [,w] of items)total+=w;
  let r=rand()*total;
  for(const [v,w] of items){r-=w;if(r<=0)return v;}
  return items[items.length-1][0];
}
function makeRandom(seed){
  // Small deterministic PRNG (mulberry32) so tests are repeatable.
  let s=seed>>>0;
  return ()=>{
    s=(s+0x6D2B79F5)>>>0;
    let t=s;
    t=Math.imul(t^(t>>>15),t|1);
    t^=t+Math.imul(t^(t>>>7),t|61);
    return((t^(t>>>14))>>>0)/4294967296;
  };
}

/* Clip a polyline (array of {x,y}) to the square [0,E]x[0,E]. */
export function clipPolylineToSquare(points,E){
  const pieces=[];
  let current=null;
  const clipSeg=(x0,y0,x1,y1)=>{
    let t0=0,t1=1;
    const dx=x1-x0,dy=y1-y0;
    const p=[-dx,dx,-dy,dy],q=[x0,E-x0,y0,E-y0];
    for(let i=0;i<4;i++){
      if(p[i]===0){if(q[i]<0)return null;continue;}
      const r=q[i]/p[i];
      if(p[i]<0){if(r>t1)return null;if(r>t0)t0=r;}
      else{if(r<t0)return null;if(r<t1)t1=r;}
    }
    return [x0+t0*dx,y0+t0*dy,x0+t1*dx,y0+t1*dy];
  };
  for(let i=1;i<points.length;i++){
    const a=points[i-1],b=points[i];
    const c=clipSeg(a.x,a.y,b.x,b.y);
    if(!c){current=null;continue;}
    const [ax,ay,bx,by]=c;
    const last=current&&current[current.length-1];
    if(last&&Math.abs(last[0]-ax)<1e-6&&Math.abs(last[1]-ay)<1e-6){
      current.push([bx,by]);
    }else{
      current=[[ax,ay],[bx,by]];
      pieces.push(current);
    }
    if(bx!==b.x||by!==b.y)current=null;
  }
  return pieces;
}

/* ---------------------------------------------------------------- graph */

let LINK_UID=1;

/**
 * Build a road graph.
 * lines: [{coords:[[X,Y],...] (world units), cls, oneway}]
 * metresPerUnit, origin:[X,Y] -> local metres x=(X-ox)*mpu (east), y=(Y-oy)*mpu (south)
 */
export function buildRoadGraph(lines,{metresPerUnit,origin}){
  const snapUnits=1.2/metresPerUnit;
  const cell=snapUnits*2;
  const nodes=[];
  const grid=new Map();
  const nodeAt=(X,Y)=>{
    const cx=Math.floor(X/cell),cy=Math.floor(Y/cell);
    for(let i=-1;i<=1;i++)for(let j=-1;j<=1;j++){
      const arr=grid.get((cx+i)+','+(cy+j));
      if(!arr)continue;
      for(const n of arr)if(Math.hypot(n.X-X,n.Y-Y)<=snapUnits)return n;
    }
    const n={
      id:nodes.length,X,Y,
      x:(X-origin[0])*metresPerUnit,
      y:(Y-origin[1])*metresPerUnit,
      edges:[],links:[]
    };
    nodes.push(n);
    const key=cx+','+cy;
    let arr=grid.get(key);
    if(!arr){arr=[];grid.set(key,arr);}
    arr.push(n);
    return n;
  };

  const edgeKeys=new Set();
  const edges=[];
  for(const line of lines){
    if(!ROAD_TYPES[line.cls]||!line.coords||line.coords.length<2)continue;
    let prev=null;
    for(const [X,Y] of line.coords){
      const n=nodeAt(X,Y);
      if(prev&&prev!==n){
        const key=prev.id<n.id?prev.id+'-'+n.id:n.id+'-'+prev.id;
        if(!edgeKeys.has(key)){
          edgeKeys.add(key);
          const e={a:prev,b:n,cls:line.cls,oneway:Math.sign(Number(line.oneway)||0),used:false};
          edges.push(e);
          prev.edges.push(e);
          n.edges.push(e);
        }
      }
      prev=n;
    }
  }

  const isBreak=n=>{
    if(n.edges.length!==2)return true;
    const [e1,e2]=n.edges;
    if(e1.cls!==e2.cls)return true;
    const into=e1.oneway*(e1.b===n?1:-1);
    const out=e2.oneway*(e2.a===n?1:-1);
    return into!==out;
  };

  const links=[];
  const makeLink=(seq,cls,flow)=>{
    const pts=seq.map(n=>[n.x,n.y]);
    const cum=[0];
    for(let i=1;i<pts.length;i++){
      cum.push(cum[i-1]+Math.hypot(pts[i][0]-pts[i-1][0],pts[i][1]-pts[i-1][1]));
    }
    const len=cum[cum.length-1];
    if(len<0.8)return;
    const type=ROAD_TYPES[cls];
    const link={
      uid:LINK_UID++,a:seq[0],b:seq[seq.length-1],
      pts,cum,len,cls,type,oneway:flow,lanes:type.lanes
    };
    links.push(link);
    link.a.links.push({link,atStart:true});
    link.b.links.push({link,atStart:false});
  };
  const walk=(start,first)=>{
    const seq=[start];
    let cur=start,edge=first;
    const flow=first.oneway*(first.a===start?1:-1);
    for(;;){
      edge.used=true;
      const next=edge.a===cur?edge.b:edge.a;
      seq.push(next);
      if(next===start||isBreak(next))break;
      const ne=next.edges[0]===edge?next.edges[1]:next.edges[0];
      if(ne.used)break;
      cur=next;edge=ne;
    }
    makeLink(seq,first.cls,flow);
  };
  for(const n of nodes)if(isBreak(n))for(const e of n.edges)if(!e.used)walk(n,e);
  for(const e of edges)if(!e.used)walk(e.a,e);

  const junctions=nodes.filter(n=>n.links.length);
  for(const n of junctions){
    n.key=Math.round(n.x)+','+Math.round(n.y);
    n.maxRank=Math.max(...n.links.map(l=>l.link.type.rank));
  }

  // Spatial indices.
  const SEG_CELL=30;
  const segIndex=new Map();
  let totalLength=0;
  for(const link of links){
    totalLength+=link.len;
    for(let i=1;i<link.pts.length;i++){
      const [x0,y0]=link.pts[i-1],[x1,y1]=link.pts[i];
      const cx0=Math.floor(Math.min(x0,x1)/SEG_CELL),cx1=Math.floor(Math.max(x0,x1)/SEG_CELL);
      const cy0=Math.floor(Math.min(y0,y1)/SEG_CELL),cy1=Math.floor(Math.max(y0,y1)/SEG_CELL);
      for(let cx=cx0;cx<=cx1;cx++)for(let cy=cy0;cy<=cy1;cy++){
        const key=cx+','+cy;
        let arr=segIndex.get(key);
        if(!arr){arr=[];segIndex.set(key,arr);}
        arr.push([link,i-1]);
      }
    }
  }
  const NODE_CELL=20;
  const nodeIndex=new Map();
  for(const n of junctions){
    const key=Math.floor(n.x/NODE_CELL)+','+Math.floor(n.y/NODE_CELL);
    let arr=nodeIndex.get(key);
    if(!arr){arr=[];nodeIndex.set(key,arr);}
    arr.push(n);
  }

  const cumulative=[];
  let acc=0;
  for(const link of links){acc+=link.len;cumulative.push(acc);}
  // Road samples every ~30 m, used to measure visible street length.
  const samples=[];
  for(const link of links){
    const n=Math.max(1,Math.round(link.len/30));
    for(let i=0;i<n;i++){
      const p=pointAtArc(link,(i+0.5)*link.len/n);
      samples.push([p[0],p[1],link.len/n*(link.oneway?1:2)]);
    }
  }

  return {
    links,nodes:junctions,totalLength,samples,
    pickLink(rand){
      if(!links.length)return null;
      const r=rand()*acc;
      let lo=0,hi=cumulative.length-1;
      while(lo<hi){const mid=(lo+hi)>>1;if(cumulative[mid]<r)lo=mid+1;else hi=mid;}
      return links[lo];
    },
    nodeNear(x,y,maxDist=2.5){
      const cx=Math.floor(x/NODE_CELL),cy=Math.floor(y/NODE_CELL);
      let best=null,bestD=maxDist;
      for(let i=-1;i<=1;i++)for(let j=-1;j<=1;j++){
        for(const n of nodeIndex.get((cx+i)+','+(cy+j))||[]){
          const d=Math.hypot(n.x-x,n.y-y);
          if(d<=bestD){bestD=d;best=n;}
        }
      }
      return best;
    },
    /* Find the link under (x,y) whose travel direction matches heading. */
    locate(x,y,heading,maxDist=3,maxAngle=0.6){
      const cx=Math.floor(x/SEG_CELL),cy=Math.floor(y/SEG_CELL);
      let best=null,bestD=maxDist;
      for(let i=-1;i<=1;i++)for(let j=-1;j<=1;j++){
        for(const [link,k] of segIndex.get((cx+i)+','+(cy+j))||[]){
          const [x0,y0]=link.pts[k],[x1,y1]=link.pts[k+1];
          const dx=x1-x0,dy=y1-y0,l2=dx*dx+dy*dy;
          if(!l2)continue;
          const t=Math.max(0,Math.min(1,((x-x0)*dx+(y-y0)*dy)/l2));
          const d=Math.hypot(x0+t*dx-x,y0+t*dy-y);
          if(d>bestD)continue;
          const hs=Math.atan2(dy,dx);
          let dir=0;
          if(Math.abs(angleDiff(heading,hs))<maxAngle&&link.oneway!==-1)dir=1;
          else if(Math.abs(angleDiff(heading,hs+Math.PI))<maxAngle&&link.oneway!==1)dir=-1;
          if(!dir)continue;
          const arc=link.cum[k]+t*Math.sqrt(l2);
          bestD=d;
          best={link,d:dir,s:dir>0?arc:link.len-arc};
        }
      }
      return best;
    }
  };
}

/* -------------------------------------------------------- link geometry */

function pointAtArc(link,arc){
  const {pts,cum,len}=link;
  if(arc<=0)return [pts[0][0],pts[0][1]];
  if(arc>=len){const p=pts[pts.length-1];return [p[0],p[1]];}
  let lo=0,hi=cum.length-1;
  while(hi-lo>1){const mid=(lo+hi)>>1;if(cum[mid]<=arc)lo=mid;else hi=mid;}
  const t=(arc-cum[lo])/((cum[hi]-cum[lo])||1);
  return [pts[lo][0]+(pts[hi][0]-pts[lo][0])*t,pts[lo][1]+(pts[hi][1]-pts[lo][1])*t];
}
export function laneOffset(link,lane){
  const w=link.type.laneW;
  if(link.oneway)return((link.lanes-1)/2-lane)*w;
  return(lane+0.5)*w;
}
/* Pose of a vehicle centre at distance s (travel direction d) in a lane. */
export function lanePose(link,d,lane,s){
  const arc=d>0?s:link.len-s;
  const look=Math.min(2.5,link.len/2);
  const a=pointAtArc(link,arc-look*d);
  const b=pointAtArc(link,arc+look*d);
  const h=Math.atan2(b[1]-a[1],b[0]-a[0]);
  const c=pointAtArc(link,arc);
  const off=laneOffset(link,lane);
  // Left of travel in an x-east / y-south frame is (sin h, -cos h).
  return {x:c[0]+Math.sin(h)*off,y:c[1]-Math.cos(h)*off,h};
}

function bezierPath(p0,h0,p2,h2,uTurn){
  const dist=Math.hypot(p2.x-p0.x,p2.y-p0.y);
  const k=uTurn?Math.max(dist,3.5)*0.95:Math.max(0.6,dist*0.42);
  const c1={x:p0.x+Math.cos(h0)*k,y:p0.y+Math.sin(h0)*k};
  const c2={x:p2.x-Math.cos(h2)*k,y:p2.y-Math.sin(h2)*k};
  const N=16,pts=[],cum=[0];
  for(let i=0;i<=N;i++){
    const t=i/N,u=1-t;
    const x=u*u*u*p0.x+3*u*u*t*c1.x+3*u*t*t*c2.x+t*t*t*p2.x;
    const y=u*u*u*p0.y+3*u*u*t*c1.y+3*u*t*t*c2.y+t*t*t*p2.y;
    pts.push([x,y]);
    if(i)cum.push(cum[i-1]+Math.hypot(x-pts[i-1][0],y-pts[i-1][1]));
  }
  return {pts,cum,len:cum[N]};
}
function curvePose(curve,pos){
  const {pts,cum,len}=curve;
  const arc=Math.max(0,Math.min(len,pos));
  let lo=0,hi=cum.length-1;
  while(hi-lo>1){const mid=(lo+hi)>>1;if(cum[mid]<=arc)lo=mid;else hi=mid;}
  const t=(arc-cum[lo])/((cum[hi]-cum[lo])||1);
  const x=pts[lo][0]+(pts[hi][0]-pts[lo][0])*t;
  const y=pts[lo][1]+(pts[hi][1]-pts[lo][1])*t;
  const h=Math.atan2(pts[hi][1]-pts[lo][1],pts[hi][0]-pts[lo][0]);
  return {x,y,h};
}

/* ----------------------------------------------------------- simulation */

const IDM={a:1.4,b:2.6,T:1.15,s0:2.4};
/* Traffic signals (UK sequence: green, amber, red, red+amber, green). Seconds. */
const SIGNAL_TIMING={main:16,side:11,amber:3,allRed:1.8};
const SIGNAL_CLUSTER_M=28;
const SIGNAL_LAMP={red:'#ff2b2b',amber:'#ffb000',green:'#22d36a',off:'#3a3c41'};
const LOOKAHEAD_M=70;
const SPAWN_TRACK_GAP_M=16;
const SPAWN_CLEAR_M=9;
const GROW_S=0.7;

function idmAccel(v,v0,gap,dv){
  const sStar=IDM.s0+Math.max(0,v*IDM.T+v*dv/(2*Math.sqrt(IDM.a*IDM.b)));
  const free=1-Math.pow(v/Math.max(0.3,v0),4);
  const inter=gap<400?Math.pow(sStar/Math.max(0.2,gap),2):0;
  return Math.max(-8,Math.min(IDM.a,IDM.a*(free-inter)));
}

function trackKey(link,d,lane){return link.uid+':'+d+':'+lane;}

/**
 * view: {
 *   isVisible(x,y,marginPx) -> bool,
 *   distance(x,y) -> metres from the view centre on the ground,
 *   outerRadius   -> metres; vehicles beyond this (off screen) are removed,
 *   targetVisible -> desired number of vehicles inside the screen
 * }
 */
export function createTrafficSim({seed=1}={}){
  const rand=makeRandom(seed);
  let graph=null;
  let vehicles=[];
  let nextId=1;
  let populateUntil=0;
  let simTime=0;
  let spawnClock=0;
  let densityClock=1e9;
  let targetVisible=0,targetTotal=0;
  const junctionOcc=new Map();
  let controllers=[];
  let approachMap=new Map();
  const stats={spawned:0,removed:0,spawnedVisible:0,removedVisible:0,released:0};

  function chooseSpec(link){
    const allowBus=link.type.rank>=2;
    const items=Object.entries(VEHICLE_SPECS)
      .filter(([,s])=>allowBus||!s.busOnly)
      .map(([k,s])=>[k,s.weight]);
    const key=pickWeighted(items,rand);
    const spec=VEHICLE_SPECS[key];
    let color;
    if(spec.kind==='bus')color=BUS_RED;
    else if(spec.kind==='cab')color=CAB_BLACK;
    else if(spec.kind==='van')color=pickWeighted(VAN_COLORS,rand);
    else color=pickWeighted(CAR_COLORS,rand);
    return {key,spec,color};
  }

  function endPointOf(link,d){
    const n=d>0?link.b:link.a;
    return n;
  }

  /* Plan the movement after the current link. */
  function planNext(v){
    const {link,d,lane}=v.seg;
    const end=endPointOf(link,d);
    const arrive=lanePose(link,d,0,link.len);
    const node=(graph&&graph.nodeNear(end.x,end.y,2.5))||end;
    const exits=[];
    let uTurn=null;
    for(const {link:l,atStart} of node.links){
      const dd=atStart?1:-1;
      if(l.oneway&&l.oneway!==dd)continue;
      const p=lanePose(l,dd,0,Math.min(4,l.len/2));
      const dh=angleDiff(p.h,arrive.h);
      if(l===link&&dd===-d){uTurn={link:l,d:dd,dh};continue;}
      if(Math.abs(dh)>2.75){uTurn=uTurn||{link:l,d:dd,dh};continue;}
      let w=Math.abs(dh)<0.5?3.2:Math.abs(dh)<1.9?1.25:0.35;
      w*=1+0.25*l.type.rank;
      const far=dd>0?l.b:l.a;
      if(far.links.length===1&&l.len<60)w*=0.15;
      exits.push([{link:l,d:dd,dh},w]);
    }
    let choice;
    let deadEnd=false;
    if(exits.length)choice=pickWeighted(exits,rand);
    else{
      deadEnd=true;
      choice=uTurn||{link,d:-d,dh:Math.PI};
      if(choice.link.oneway&&choice.link.oneway!==choice.d)choice={link,d:-d,dh:Math.PI};
    }
    const nl=choice.link;
    const isU=Math.abs(choice.dh)>2.4;
    const lanes=nl.lanes;
    let nlane=Math.floor(rand()*lanes);
    if(lanes>1){
      // UK: left turns from the left lane (0), right turns from the right lane.
      if(choice.dh<-0.6)nlane=0;
      else if(choice.dh>0.6)nlane=lanes-1;
    }
    const r0=isU?Math.min(link.len*0.3,4):Math.max(1.2,Math.min(link.len*0.35,3+link.type.laneW));
    const r1=isU?Math.min(nl.len*0.3,4):Math.max(1.2,Math.min(nl.len*0.35,3+nl.type.laneW));
    const absTurn=Math.abs(choice.dh);
    const maxV=isU?2.6:absTurn<0.35?99:absTurn<1.0?7.5:absTurn<2.0?5.2:3.5;
    v.plan={link:nl,d:choice.d,lane:Math.min(nlane,lanes-1),r0,r1,maxV,uTurn:isU,deadEnd,
      nodeKey:node.key||(Math.round(node.x)+','+Math.round(node.y)),
      // Only real junctions (3+ roads) need right-of-way; a plain class change does not.
      controlled:node.links.length>=3,
      signal:approachMap.get(link.uid+':'+d)||null};
  }

  function buildCurve(v){
    const {link,d,lane}=v.seg;
    const p=v.plan;
    const start=Math.max(v.pos,link.len-p.r0);
    const a=lanePose(link,d,lane,start);
    const b=lanePose(p.link,p.d,p.lane,p.r1);
    const path=bezierPath(a,a.h,b,b.h,p.uTurn);
    return {type:'curve',...path,from:{link,d,lane,s0:start},to:{link:p.link,d:p.d,lane:p.lane,s:p.r1},
      maxV:p.maxV,nodeKey:p.controlled?p.nodeKey:null,deadEnd:p.deadEnd};
  }

  function pose(v){
    if(v.seg.type==='curve')return curvePose(v.seg,v.pos);
    return lanePose(v.seg.link,v.seg.d,v.seg.lane,v.pos);
  }

  function addVehicle(link,d,lane,s,{visible=false}={}){
    const {key,spec,color}=chooseSpec(link);
    const v={
      id:nextId++,key,spec,color,
      seg:{type:'link',link,d,lane},pos:s,
      v:link.type.speed*0.55,
      driver:0.88+rand()*0.22,
      wait:0,stopped:0,releaseUntil:0,
      scale:visible?0.05:1,growing:visible,removing:false,
      plan:null,occKey:null
    };
    planNext(v);
    vehicles.push(v);
    stats.spawned++;
    if(visible)stats.spawnedVisible++;
    return v;
  }

  function removeVehicle(v){
    if(v.occKey)junctionOcc.get(v.occKey)?.delete(v.id);
    v.dead=true;
  }

  /* Track tables: per lane track, vehicles sorted by position along it. */
  function buildTracks(){
    const tracks=new Map();
    const put=(key,s,v)=>{
      let arr=tracks.get(key);
      if(!arr){arr=[];tracks.set(key,arr);}
      arr.push({s,v});
    };
    for(const v of vehicles){
      if(v.dead)continue;
      if(v.seg.type==='link'){
        put(trackKey(v.seg.link,v.seg.d,v.seg.lane),v.pos,v);
      }else{
        const c=v.seg;
        put(trackKey(c.from.link,c.from.d,c.from.lane),c.from.s0+v.pos,v);
        put(trackKey(c.to.link,c.to.d,c.to.lane),c.to.s-(c.len-v.pos),v);
      }
    }
    for(const arr of tracks.values())arr.sort((a,b)=>a.s-b.s);
    return tracks;
  }

  function leaderOn(tracks,key,s,self,maxAhead){
    const arr=tracks.get(key);
    if(!arr)return null;
    let best=null;
    for(const e of arr){
      if(e.v===self)continue;
      const ahead=e.s-s;
      if(ahead<=0.01||ahead>maxAhead)continue;
      if(!best||ahead<best.ahead)best={ahead,v:e.v};
    }
    return best;
  }

  function canEnterJunction(v){
    const p=v.plan;
    if(!p.controlled)return true;
    const occ=junctionOcc.get(p.nodeKey);
    if(!occ||!occ.size)return true;
    const fromKey=trackKey(v.seg.link,v.seg.d,v.seg.lane);
    if(p.signal){
      // Signals already separate the movements; only wait for vehicles of the
      // other phase that are still clearing the junction.
      for(const o of occ.values()){
        if(o.fromKey!==fromKey&&o.phase>=0&&o.phase!==p.signal.phase)return v.wait>2.2;
      }
      return true;
    }
    let otherRank=-1;
    for(const o of occ.values())if(o.fromKey!==fromKey)otherRank=Math.max(otherRank,o.rank);
    if(otherRank<0)return true;
    const myRank=v.seg.link.type.rank;
    if(myRank>otherRank)return true;
    // Bounded wait: a queue at a junction always clears.
    return v.wait>(myRank>=3?1.0:2.2);
  }

  function signalState(ctrl,phase){
    const {amber,allRed}=SIGNAL_TIMING;
    const t=((simTime+ctrl.offset)%ctrl.cycle+ctrl.cycle)%ctrl.cycle;
    const g0=ctrl.g0,s1=g0+amber+allRed,g1=ctrl.g1;
    const end1=s1+g1+amber;
    if(phase===0){
      if(t<g0)return 'green';
      if(t<g0+amber)return 'amber';
      if(t>=ctrl.cycle-allRed)return 'redamber';
      return 'red';
    }
    if(t>=s1&&t<s1+g1)return 'green';
    if(t>=s1+g1&&t<end1)return 'amber';
    if(t>=s1-allRed&&t<s1)return 'redamber';
    return 'red';
  }

  /* Signalised junctions: where two main roads (tertiary or above) meet, or a
     major road crosses at a four-way junction. Nodes of one junction (dual
     carriageways, slip lanes) share one controller. */
  function buildSignals(g){
    controllers=[];
    approachMap=new Map();
    if(!g)return;
    const candidates=g.nodes.filter(n=>{
      if(n.links.length<3)return false;
      const r=n.links.map(l=>l.link.type.rank).sort((a,b)=>b-a);
      return r[1]>=2||(r[0]>=3&&n.links.length>=4);
    });
    const used=new Set();
    for(const seed of candidates){
      if(used.has(seed))continue;
      const group=[seed];used.add(seed);
      for(let i=0;i<group.length;i++){
        for(const m of candidates){
          if(!used.has(m)&&Math.hypot(m.x-group[i].x,m.y-group[i].y)<SIGNAL_CLUSTER_M){
            used.add(m);group.push(m);
          }
        }
      }
      const members=new Set(group);
      const approaches=[];
      for(const n of group){
        for(const {link,atStart} of n.links){
          const d=atStart?-1:1;
          if(link.oneway&&link.oneway!==d)continue;
          const from=d>0?link.a:link.b;
          if(members.has(from)||link.len<12)continue;
          const end=lanePose(link,d,0,link.len-1);
          approaches.push({link,d,h:end.h,rank:link.type.rank});
        }
      }
      if(approaches.length<2)continue;
      const lead=approaches.reduce((a,b)=>(b.rank>a.rank||(b.rank===a.rank&&b.link.len>a.link.len))?b:a);
      for(const ap of approaches){
        let diff=Math.abs(angleDiff(ap.h,lead.h));
        diff=Math.min(diff,Math.PI-diff);
        ap.phase=diff<Math.PI/4?0:1;
      }
      if(!approaches.some(a=>a.phase===1)||!approaches.some(a=>a.phase===0))continue;
      const g0=SIGNAL_TIMING.main,g1=SIGNAL_TIMING.side;
      const cycle=g0+g1+2*(SIGNAL_TIMING.amber+SIGNAL_TIMING.allRed);
      const ctrl={id:controllers.length,g0,g1,cycle,offset:rand()*cycle,approaches:[]};
      for(const ap of approaches){
        const {link,d}=ap;
        const r0=Math.max(1.2,Math.min(link.len*0.35,3+link.type.laneW));
        const stopS=link.len-r0-0.6;
        const w=link.type.laneW,lanes=link.lanes;
        const off0=laneOffset(link,0);
        const centre=s2=>{
          const q=lanePose(link,d,0,s2);
          const nx=Math.sin(q.h),ny=-Math.cos(q.h);
          return {x:q.x-nx*off0,y:q.y-ny*off0,h:q.h,nx,ny};
        };
        const kerb=(link.oneway?lanes*w/2:lanes*w)+0.75;
        const pc=centre(Math.max(0,stopS-1.0));
        const lc=centre(stopS);
        const entry={ctrl,phase:ap.phase,stopS,link,d,
          pole:{x:pc.x+pc.nx*kerb,y:pc.y+pc.ny*kerb,h:pc.h},
          line:{x:lc.x,y:lc.y,h:lc.h,a:link.oneway?-lanes*w/2:0,b:link.oneway?lanes*w/2:lanes*w}};
        ctrl.approaches.push(entry);
        approachMap.set(link.uid+':'+d,entry);
      }
      controllers.push(ctrl);
    }
  }

  function step(dt,view){
    if(!graph)return;
    simTime+=dt;
    const tracks=buildTracks();

    for(const v of vehicles){
      if(v.dead)continue;
      if(v.growing){
        v.scale=Math.min(1,v.scale+dt/GROW_S);
        if(v.scale>=1)v.growing=false;
      }
      if(v.removing){
        v.scale-=dt/GROW_S;
        if(v.scale<=0){removeVehicle(v);stats.removed++;stats.removedVisible++;}
        continue;
      }

      const released=simTime<v.releaseUntil;
      const halfL=v.spec.L/2;
      let v0=v.seg.type==='curve'
        ?Math.min(v.seg.to.link.type.speed,v.seg.maxV)
        :v.seg.link.type.speed;
      v0*=v.driver*v.spec.speed;

      let gap=999,dv=0,heldByJunction=false,heldBySignal=false;
      const consider=(ahead,leader)=>{
        const g=ahead-halfL-leader.spec.L/2;
        if(g<gap){gap=g;dv=v.v-leader.v;}
      };

      if(v.seg.type==='link'){
        const {link,d,lane}=v.seg;
        const key=trackKey(link,d,lane);
        if(!released){
          const l=leaderOn(tracks,key,v.pos,v,LOOKAHEAD_M);
          if(l)consider(l.ahead,l.v);
        }
        const p=v.plan;
        const toCurve=link.len-p.r0-v.pos;
        // Slow down for the turn ahead.
        if(p.maxV<99)v0=Math.min(v0,Math.sqrt(p.maxV*p.maxV+2*1.8*Math.max(0,toCurve)));
        if(!released&&toCurve<LOOKAHEAD_M){
          const nk=trackKey(p.link,p.d,p.lane);
          const l=leaderOn(tracks,nk,-1e9,v,1e9);
          if(l){
            // Distance ahead along our path to that vehicle.
            const entry=tracks.get(nk).find(e=>e.v===l.v);
            const ahead=Math.max(0,toCurve)+p.r0+p.r1+(entry.s-p.r1);
            if(ahead>0&&ahead<LOOKAHEAD_M)consider(ahead,l.v);
          }
          if(toCurve<12&&!canEnterJunction(v)){
            heldByJunction=true;
            const g=Math.max(0,toCurve-0.3);
            if(g<gap){gap=g;dv=v.v;}
          }
          const sig=p.signal;
          if(sig){
            const state=signalState(sig.ctrl,sig.phase);
            const toLine=sig.stopS-v.pos-halfL;
            if(state!=='green'&&toLine>-0.4){
              // Amber: stop only if it can be done comfortably; otherwise carry on.
              const canStop=toLine>v.v*v.v/(2*3.4);
              if(state!=='amber'||canStop){
                const g=Math.max(0,toLine-0.2);
                if(g<gap){gap=g;dv=v.v;}
                if(toLine<45)heldBySignal=true;
              }
            }else if(state==='green'&&toCurve<10){
              // Do not block the box: wait at the line if the exit has no room.
              const nk=trackKey(p.link,p.d,p.lane);
              const exit=tracks.get(nk);
              if(exit&&exit.some(e=>e.v!==v&&e.s<p.r1+e.v.spec.L/2+v.spec.L+1.5&&e.s>-4)){
                if(v.wait<3){
                  heldByJunction=true;
                  const g=Math.max(0,toLine-0.2);
                  if(g<gap){gap=g;dv=v.v;}
                }
              }
            }
          }
        }
      }else{
        const c=v.seg;
        if(!released){
          const key=trackKey(c.to.link,c.to.d,c.to.lane);
          const myS=c.to.s-(c.len-v.pos);
          const l=leaderOn(tracks,key,myS,v,LOOKAHEAD_M);
          if(l)consider(l.ahead,l.v);
        }
      }

      const acc=idmAccel(v.v,v0,Math.max(0.05,gap),dv);
      v.v=Math.max(0,v.v+acc*dt);
      let travel=v.v*dt;
      // Never drive into the vehicle (or stop line) ahead.
      if(gap<900)travel=Math.min(travel,Math.max(0,gap-0.6));
      if(travel<v.v*dt*0.5&&gap<900)v.v=Math.min(v.v,travel/Math.max(dt,1e-3));

      if(heldByJunction)v.wait+=dt;
      v.heldBySignal=heldBySignal;
      // Waiting at a red light is normal, not a jam: it never triggers a release.
      if(v.v<0.25){if(!heldBySignal)v.stopped+=dt;}else{v.stopped=0;}

      advance(v,travel,view);
    }

    // Long stops: off screen -> remove; on screen -> release for a moment.
    for(const v of vehicles){
      if(v.dead||v.removing)continue;
      if(v.stopped>6){
        const p=pose(v);
        if(!view.isVisible(p.x,p.y,60)){removeVehicle(v);stats.removed++;continue;}
        if(v.stopped>12&&simTime>v.releaseUntil){
          v.releaseUntil=simTime+2.5;
          v.stopped=0;
          stats.released++;
        }
      }
    }
    vehicles=vehicles.filter(v=>!v.dead);

    manageDensity(dt,view);
  }

  function advance(v,travel,view){
    let remaining=travel;
    for(let guard=0;guard<4&&remaining>=0;guard++){
      if(v.seg.type==='link'){
        const link=v.seg.link;
        const curveStart=link.len-v.plan.r0;
        if(v.pos+remaining<curveStart){v.pos+=remaining;return;}
        remaining-=Math.max(0,curveStart-v.pos);
        v.pos=Math.max(v.pos,curveStart);
        if(v.plan.deadEnd){
          const p=lanePose(link,v.seg.d,v.seg.lane,v.pos);
          if(!view.isVisible(p.x,p.y,60)){removeVehicle(v);stats.removed++;return;}
        }
        const curve=buildCurve(v);
        v.seg=curve;
        v.pos=0;
        v.wait=0;
        v.occKey=curve.nodeKey;
        if(curve.nodeKey){
          let occ=junctionOcc.get(curve.nodeKey);
          if(!occ){occ=new Map();junctionOcc.set(curve.nodeKey,occ);}
          occ.set(v.id,{
            fromKey:trackKey(curve.from.link,curve.from.d,curve.from.lane),
            rank:curve.from.link.type.rank,
            phase:v.plan.signal?v.plan.signal.phase:-1
          });
        }
      }else{
        const c=v.seg;
        if(v.pos+remaining<c.len){v.pos+=remaining;return;}
        remaining-=c.len-v.pos;
        if(c.nodeKey)junctionOcc.get(c.nodeKey)?.delete(v.id);
        v.occKey=null;
        v.seg={type:'link',link:c.to.link,d:c.to.d,lane:c.to.lane};
        v.pos=c.to.s;
        planNext(v);
        if(remaining<=0)return;
      }
    }
  }

  function updateTargets(view,outer){
    // Vehicles per lane-direction metre follow the street length on screen; the
    // ring outside the screen gets the same density so traffic flows in and out.
    let visLen=0,outerLen=0;
    for(const [x,y,w] of graph.samples){
      if(view.distance(x,y)>outer)continue;
      outerLen+=w;
      if(view.isVisible(x,y,0))visLen+=w;
    }
    const spacing=view.spacingM||85;
    const maxVisible=view.maxVisible||70;
    targetVisible=Math.max(visLen>0?3:0,Math.min(maxVisible,Math.round(visLen/spacing)));
    const ratio=visLen>0?Math.min(3.5,outerLen/visLen):1;
    targetTotal=Math.min(160,Math.round(targetVisible*ratio));
  }

  function manageDensity(dt,view){
    const outer=view.outerRadius||600;
    densityClock+=dt;
    if(densityClock>=2||view.forceTargets){densityClock=0;view.forceTargets=false;updateTargets(view,outer);}

    // Remove off-screen vehicles that are too far away or surplus.
    const off=[];
    for(const v of vehicles){
      if(v.removing)continue;
      const p=pose(v);
      if(view.isVisible(p.x,p.y,80))continue;
      const dist=view.distance(p.x,p.y);
      if(dist>outer+60){removeVehicle(v);stats.removed++;continue;}
      off.push([v,dist]);
    }
    vehicles=vehicles.filter(v=>!v.dead);
    let surplus=vehicles.length-(targetTotal+4);
    if(surplus>0){
      off.sort((a,b)=>b[1]-a[1]);
      for(const [v] of off){
        if(surplus<=0)break;
        if(v.dead)continue;
        removeVehicle(v);stats.removed++;surplus--;
      }
      vehicles=vehicles.filter(v=>!v.dead);
    }

    spawnClock+=dt;
    if(spawnClock<0.2)return;
    spawnClock=0;
    if(vehicles.length>=targetTotal)return;

    const populating=simTime<populateUntil;
    let toSpawn=Math.min(populating?12:3,targetTotal-vehicles.length);
    const positions=vehicles.map(v=>pose(v));
    const tracks=buildTracks();
    for(let attempt=0;attempt<40&&toSpawn>0;attempt++){
      const link=graph.pickLink(rand);
      if(!link||link.len<14)continue;
      let d=rand()<0.5?1:-1;
      if(link.oneway)d=link.oneway;
      const lane=Math.floor(rand()*link.lanes);
      const s=7+rand()*(link.len-14);
      const p=lanePose(link,d,lane,s);
      const visible=view.isVisible(p.x,p.y,40);
      if(visible&&!populating)continue;
      if(view.distance(p.x,p.y)>outer)continue;
      const arr=tracks.get(trackKey(link,d,lane))||[];
      if(arr.some(e=>Math.abs(e.s-s)<SPAWN_TRACK_GAP_M))continue;
      if(positions.some(q=>Math.hypot(q.x-p.x,q.y-p.y)<SPAWN_CLEAR_M))continue;
      const nv=addVehicle(link,d,lane,s,{visible});
      positions.push(p);
      let t=tracks.get(trackKey(link,d,lane));
      if(!t){t=[];tracks.set(trackKey(link,d,lane),t);}
      t.push({s,v:nv});
      toSpawn--;
    }
    // Starting population done once the screen is reasonably full.
    if(populating){
      let visibleCount=0;
      for(const q of positions)if(view.isVisible(q.x,q.y,0))visibleCount++;
      if(visibleCount>=targetVisible*0.8)populateUntil=0;
    }
  }

  /* Map vehicles onto a rebuilt graph so they keep driving smoothly. */
  function setGraph(next){
    graph=next;
    densityClock=1e9;
    buildSignals(next);
    if(!next)return;
    for(const v of vehicles){
      if(v.seg.type==='link'){
        const c=lanePose(v.seg.link,v.seg.d,0,v.pos);
        const back=laneOffset(v.seg.link,0);
        const cx=c.x-Math.sin(c.h)*back,cy=c.y+Math.cos(c.h)*back;
        const hit=next.locate(cx,cy,c.h,3,0.6);
        if(hit&&hit.link.len>0.5){
          v.seg={type:'link',link:hit.link,d:hit.d,lane:Math.min(v.seg.lane,hit.link.lanes-1)};
          v.pos=hit.s;
          planNext(v);
        }
      }else{
        const c=v.seg;
        const end=lanePose(c.to.link,c.to.d,0,c.to.s);
        const back=laneOffset(c.to.link,0);
        const hit=next.locate(end.x-Math.sin(end.h)*back,end.y+Math.cos(end.h)*back,end.h,3,0.6);
        if(hit)c.to={link:hit.link,d:hit.d,lane:Math.min(c.to.lane,hit.link.lanes-1),s:hit.s};
        const start=lanePose(c.from.link,c.from.d,0,c.from.s0);
        const fb=laneOffset(c.from.link,0);
        const fh=next.locate(start.x-Math.sin(start.h)*fb,start.y+Math.cos(start.h)*fb,start.h,3,0.6);
        if(fh)c.from={link:fh.link,d:fh.d,lane:Math.min(c.from.lane,fh.link.lanes-1),s0:fh.s};
      }
    }
  }

  return {
    setGraph,
    getGraph:()=>graph,
    step,
    pose,
    populate(seconds=4){populateUntil=simTime+seconds;},
    clear(){vehicles=[];junctionOcc.clear();},
    get vehicles(){return vehicles;},
    get time(){return simTime;},
    get targets(){return {visible:targetVisible,total:targetTotal};},
    get signals(){return controllers;},
    signalState,
    stats
  };
}

/* ------------------------------------------------------------- geometry */

/* Model parts of one vehicle in its local frame: forward f, left l (metres). */
function rect(f0,f1,l0,l1){return [[f0,l0],[f1,l0],[f1,l1],[f0,l1]];}
function chamferRect(L,W,cf,cr){
  const f=L/2,l=W/2;
  return [
    [f-cf,l],[f,l-cf*0.8],[f,-l+cf*0.8],[f-cf,-l],
    [-f+cr,-l],[-f,-l+cr*0.8],[-f,l-cr*0.8],[-f+cr,l]
  ];
}

const ORDER={wheel:0,body:1,trim:2,glass:3,roof:4,light:5};

const TRIM='#2a2c30';
const GRILLE='#17181b';
const HUB='#a7abb2';
const PLATE_FRONT='#f4f4f2';
const PLATE_REAR='#f2c230';

/* Lower body outline with wheel-arch notches so the wheels show. */
function archedBody(L,W,cf,cr,axles,arch=0.38,depth=0.2){
  const f=L/2,l=W/2;
  const [fa,ra]=axles;
  const side=sign=>{
    // Front-to-rear along one side (sign=+1 left, -1 right).
    const y=sign*l,yi=sign*(l-depth);
    return [
      [fa+arch,y],[fa+arch,yi],[fa-arch,yi],[fa-arch,y],
      [ra+arch,y],[ra+arch,yi],[ra-arch,yi],[ra-arch,y]
    ];
  };
  const left=side(1);
  const right=side(-1).reverse();
  return [
    [f-cf,l],...left,[-f+cr,l],[-f,l-cr*0.8],[-f,-l+cr*0.8],[-f+cr,-l],
    ...right,[f-cf,-l],[f,-l+cf*0.8],[f,l-cf*0.8]
  ];
}

export function vehicleParts(v,lod){
  const s=v.spec,c=v.color;
  const L=s.L,W=s.W,H=s.H;
  const parts=[];
  const add=(ring,base,top,color,kind)=>parts.push({ring,base,top,color,kind});

  if(lod==='tiny'){
    add(rect(-L/2,L/2,-W/2,W/2),0,H*0.85,c,'body');
    return parts;
  }
  const detail=lod==='detail';
  const flat=lod==='flat';
  const l=W/2;

  const wheels=(axles,radius,width,length)=>{
    for(const fx of axles)for(const side of [1,-1]){
      const outer=side*(l-0.01),inner=side*(l-0.01-width);
      add(rect(fx-length/2,fx+length/2,Math.min(outer,inner),Math.max(outer,inner)),0,radius*2,WHEEL,'wheel');
      if(detail){
        const ho=side*(l+0.006),hi=side*(l-0.03);
        add(rect(fx-length*0.22,fx+length*0.22,Math.min(ho,hi),Math.max(ho,hi)),radius*0.6,radius*1.4,HUB,'trim');
      }
    }
  };
  const plates=(front,rear,z0)=>{
    add(rect(front-0.01,front+0.03,-0.26,0.26),z0,z0+0.12,PLATE_FRONT,'light');
    add(rect(rear-0.03,rear+0.01,-0.26,0.26),z0+0.12,z0+0.24,PLATE_REAR,'light');
  };

  if(s.kind==='bus'){
    const fa=L/2-2.55,ra=-L/2+3.05;
    const body=chamferRect(L,W,0.35,0.25);
    if(flat){
      add(body,0,H,c,'body');
      add(rect(-L/2+0.6,L/2-0.4,-W/2+0.3,W/2-0.3),H,H,'#b3141a','roof');
      return parts;
    }
    if(detail)wheels([fa,ra],0.49,0.3,1.0);
    add(archedBody(L,W,0.35,0.25,[fa,ra],0.6,0.26),0.28,1.0,c,'body');
    const slices=s.decks===2
      ?[[1.0,1.15,c],[1.15,2.05,GLASS],[2.05,2.5,c],[2.5,3.85,GLASS],[3.85,H,c]]
      :[[1.0,1.05,c],[1.05,2.35,GLASS],[2.35,H,c]];
    slices.forEach(([b,t,col],i)=>add(body,b,t,col,i===slices.length-1?'roof':col===GLASS?'glass':'body'));
    if(detail){
      // Bumpers, destination blind, window pillars, roof unit, lights, plates.
      add(rect(L/2-0.1,L/2+0.06,-W/2+0.12,W/2-0.12),0.22,0.55,TRIM,'trim');
      add(rect(-L/2-0.06,-L/2+0.1,-W/2+0.12,W/2-0.12),0.22,0.55,TRIM,'trim');
      const top=s.decks===2?3.85:2.35;
      add(rect(L/2-0.04,L/2+0.02,-0.7,0.7),top-0.42,top-0.08,'#111113','trim');
      const bands=s.decks===2?[[1.15,2.05],[2.5,3.85]]:[[1.05,2.35]];
      for(const [b,t] of bands){
        for(let fx=-L/2+1.4;fx<L/2-1.2;fx+=1.55){
          for(const side of [1,-1]){
            const o=side*(l+0.015),i=side*(l-0.06);
            add(rect(fx-0.07,fx+0.07,Math.min(o,i),Math.max(o,i)),b,t,c,'trim');
          }
        }
      }
      add(rect(-L/2+2.2,-L/2+4.2,-0.75,0.75),H,H+0.22,'#9b1015','roof');
      for(const side of [1,-1]){
        add(rect(L/2-0.06,L/2+0.03,side*(l-0.42)-0.18,side*(l-0.42)+0.18),0.6,0.8,HEADLIGHT,'light');
        add(rect(-L/2-0.03,-L/2+0.06,side*(l-0.3)-0.12,side*(l-0.3)+0.12),0.7,1.0,TAILLIGHT,'light');
      }
      plates(L/2+0.06,-L/2-0.06,0.3);
    }
    return parts;
  }

  const fa=s.wb/2,ra=-s.wb/2;
  const body=chamferRect(L,W,0.34,0.2);
  if(detail&&!flat)wheels([fa,ra],0.33,0.24,0.66);

  if(flat){
    add(body,0,s.belt,c,'body');
  }else{
    add(archedBody(L,W,0.34,0.2,[fa,ra]),0.3,0.68,c,'body');
    add(body,0.68,s.belt,c,'body');
  }

  let glassRear,glassFront;
  if(s.kind==='van'){
    const cabRear=L/2-1.55;
    glassFront=L/2-s.hood;glassRear=cabRear;
    add(rect(-L/2,cabRear,-l,l),s.belt,H,c,flat?'roof':'body');
    add(rect(cabRear,glassFront,-l+0.06,l-0.06),s.belt,H-0.32,GLASS,'glass');
    add(rect(cabRear,glassFront-0.45,-l+0.16,l-0.16),H-0.4,H-0.3,c,'roof');
  }else{
    glassRear=-L/2+0.42;glassFront=L/2-s.hood;
    add(rect(glassRear,glassFront,-l+0.08,l-0.08),s.belt,H-0.06,GLASS,'glass');
    add(rect(glassRear+0.3,glassFront-0.5,-l+0.22,l-0.22),H-0.08,H,c,'roof');
    if(s.kind==='cab'){
      const mid=(glassRear+glassFront)/2+0.2;
      add(rect(mid-0.11,mid+0.11,-0.26,0.26),H,H+0.13,'#f2b200','light');
    }
  }
  if(!detail)return parts;

  // Window pillars: A (front), B (middle), C (rear), standing just proud of the glass.
  const pillar=(f0,f1)=>{
    for(const side of [1,-1]){
      const o=side*(l-0.065),i=side*(l-0.16);
      add(rect(f0,f1,Math.min(o,i),Math.max(o,i)),s.belt,H-0.06,c,'trim');
    }
  };
  if(s.kind!=='van'){
    pillar(glassFront-0.16,glassFront);
    const mid=(glassRear+glassFront)/2-0.1;
    pillar(mid-0.06,mid+0.06);
    pillar(glassRear,glassRear+0.2);
  }else{
    pillar(glassRear,glassRear+0.12);
  }
  // Bumpers, grille, mirrors, lights and UK plates (white front, yellow rear).
  add(rect(L/2-0.12,L/2+0.04,-l+0.05,l-0.05),0.22,0.5,TRIM,'trim');
  add(rect(-L/2-0.04,-L/2+0.12,-l+0.05,l-0.05),0.22,0.5,TRIM,'trim');
  add(rect(L/2-0.04,L/2+0.015,-0.42,0.42),0.5,0.68,GRILLE,'trim');
  for(const side of [1,-1]){
    const mo=side*(l+0.16),mi=side*(l-0.02);
    const mx=glassFront-0.12;
    add(rect(mx-0.1,mx+0.1,Math.min(mo,mi),Math.max(mo,mi)),s.belt+0.04,s.belt+0.2,c,'trim');
    add(rect(L/2-0.06,L/2+0.03,side*(l-0.33)-0.17,side*(l-0.33)+0.17),0.58,0.74,HEADLIGHT,'light');
    add(rect(-L/2-0.03,-L/2+0.06,side*(l-0.25)-0.14,side*(l-0.25)+0.14),0.7,0.86,TAILLIGHT,'light');
  }
  plates(L/2+0.04,-L/2-0.04,0.28);
  return parts;
}

/* Traffic light on a pole, lamps facing the approaching traffic (local -x). */
export function signalParts(state,flat){
  const parts=[];
  const add=(ring,base,top,color,kind)=>parts.push({ring,base,top,color,kind});
  const lit={
    red:state==='red'||state==='redamber',
    amber:state==='amber'||state==='redamber',
    green:state==='green'
  };
  if(flat){
    const color=lit.green?SIGNAL_LAMP.green:lit.amber&&!lit.red?SIGNAL_LAMP.amber:SIGNAL_LAMP.red;
    add(rect(-0.35,0.35,-0.35,0.35),0,0,color,'light');
    return parts;
  }
  add(rect(-0.06,0.06,-0.06,0.06),0,2.95,'#2b2d31','trim');
  add(rect(-0.11,0.11,-0.17,0.17),1.98,2.95,'#18191c','trim');
  add(rect(-0.14,-0.11,-0.21,0.21),1.94,2.99,'#101113','trim');
  for(const [name,b,t] of [['red',2.67,2.89],['amber',2.37,2.59],['green',2.07,2.29]]){
    add(rect(-0.19,-0.13,-0.1,0.1),b,t,lit[name]?SIGNAL_LAMP[name]:SIGNAL_LAMP.off,'light');
  }
  return parts;
}

/* ------------------------------------------------------ MapLibre adapter */

const SOURCE_ID='street-traffic-source';
const LAYER_3D='street-traffic-3d';
const LAYER_2D='street-traffic-2d';

function worldToLngLat(X,Y){
  const lng=X/WORLD_SIZE*360-180;
  const lat=Math.atan(Math.sinh(Math.PI*(1-2*Y/WORLD_SIZE)))*180/Math.PI;
  return [lng,lat];
}
function lngLatToWorld(lng,lat){
  const X=(lng+180)/360*WORLD_SIZE;
  const s=Math.sin(lat*Math.PI/180);
  const Y=(0.5-Math.log((1+s)/(1-s))/(4*Math.PI))*WORLD_SIZE;
  return [X,Y];
}

/* ---------------------------------------------- minimal vector-tile decoding
 * MapLibre only loads tiles inside the camera view, which leaves no road network
 * outside the screen for vehicles to enter from. The traffic layer therefore
 * fetches its own z14 tiles around the view and reads only the `transportation`
 * layer here (Mapbox Vector Tile protobuf). */

function readVarint(bytes,pos){
  let result=0,shift=0,b;
  do{
    b=bytes[pos.i++];
    result+=(b&0x7f)*2**shift;
    shift+=7;
  }while(b&0x80);
  return result;
}
function skipField(bytes,pos,wire){
  if(wire===0)readVarint(bytes,pos);
  else if(wire===1)pos.i+=8;
  else if(wire===2){const len=readVarint(bytes,pos);pos.i+=len;}
  else if(wire===5)pos.i+=4;
  else throw new Error('Unsupported protobuf wire type '+wire);
}
const zigzag=n=>(n%2?-(n+1)/2:n/2);
const UTF8=typeof TextDecoder!=='undefined'?new TextDecoder():null;
function readString(bytes,start,len){return UTF8.decode(bytes.subarray(start,start+len));}

function readValue(bytes,start,end){
  const pos={i:start};
  let value=null;
  while(pos.i<end){
    const h=readVarint(bytes,pos),f=Math.floor(h/8),w=h&7;
    if(f===1&&w===2){const len=readVarint(bytes,pos);value=readString(bytes,pos.i,len);pos.i+=len;}
    else if(f===2&&w===5){value=new DataView(bytes.buffer,bytes.byteOffset+pos.i,4).getFloat32(0,true);pos.i+=4;}
    else if(f===3&&w===1){value=new DataView(bytes.buffer,bytes.byteOffset+pos.i,8).getFloat64(0,true);pos.i+=8;}
    else if((f===4||f===5)&&w===0){value=readVarint(bytes,pos);if(f===4&&value>2**63)value-=2**64;}
    else if(f===6&&w===0){value=zigzag(readVarint(bytes,pos));}
    else if(f===7&&w===0){value=Boolean(readVarint(bytes,pos));}
    else skipField(bytes,pos,w);
  }
  return value;
}

function readPacked(bytes,start,end){
  const pos={i:start},out=[];
  while(pos.i<end)out.push(readVarint(bytes,pos));
  return out;
}

/* Decode one named layer: {extent, features:[{type, properties, lines:[[[x,y],...],...]}]} */
export function decodeVectorTileLayer(bytes,layerName){
  const pos={i:0};
  while(pos.i<bytes.length){
    const h=readVarint(bytes,pos),f=Math.floor(h/8),w=h&7;
    if(f!==3||w!==2){skipField(bytes,pos,w);continue;}
    const len=readVarint(bytes,pos);
    const start=pos.i,end=start+len;
    pos.i=end;
    const lp={i:start};
    let name=null,extent=4096;
    const keys=[],values=[],featureRanges=[];
    while(lp.i<end){
      const lh=readVarint(bytes,lp),lf=Math.floor(lh/8),lw=lh&7;
      if(lf===1&&lw===2){
        const l=readVarint(bytes,lp);name=readString(bytes,lp.i,l);lp.i+=l;
        if(name!==layerName)break;
      }else if(lf===2&&lw===2){const l=readVarint(bytes,lp);featureRanges.push([lp.i,lp.i+l]);lp.i+=l;}
      else if(lf===3&&lw===2){const l=readVarint(bytes,lp);keys.push(readString(bytes,lp.i,l));lp.i+=l;}
      else if(lf===4&&lw===2){const l=readVarint(bytes,lp);values.push(readValue(bytes,lp.i,lp.i+l));lp.i+=l;}
      else if(lf===5&&lw===0){extent=readVarint(bytes,lp);}
      else skipField(bytes,lp,lw);
    }
    if(name!==layerName)continue;
    const features=[];
    for(const [fs,fe] of featureRanges){
      const fp={i:fs};
      let type=0,tags=[],geometry=[];
      while(fp.i<fe){
        const fh=readVarint(bytes,fp),ff=Math.floor(fh/8),fw=fh&7;
        if(ff===2&&fw===2){const l=readVarint(bytes,fp);tags=readPacked(bytes,fp.i,fp.i+l);fp.i+=l;}
        else if(ff===3&&fw===0){type=readVarint(bytes,fp);}
        else if(ff===4&&fw===2){const l=readVarint(bytes,fp);geometry=readPacked(bytes,fp.i,fp.i+l);fp.i+=l;}
        else skipField(bytes,fp,fw);
      }
      const properties={};
      for(let i=0;i+1<tags.length;i+=2)properties[keys[tags[i]]]=values[tags[i+1]];
      const lines=[];
      let x=0,y=0,line=null;
      for(let i=0;i<geometry.length;){
        const cmd=geometry[i]&7,count=Math.floor(geometry[i]/8);
        i++;
        if(cmd===7)continue;
        for(let k=0;k<count&&i+1<geometry.length;k++){
          x+=zigzag(geometry[i++]);y+=zigzag(geometry[i++]);
          if(cmd===1){line=[{x,y}];lines.push(line);}
          else if(cmd===2&&line)line.push({x,y});
        }
      }
      features.push({type,properties,lines});
    }
    return {extent,features};
  }
  return null;
}

/* Road lines of one decoded tile, clipped to the tile, in world units. */
export function roadLinesFromTile(layer,z,x,y){
  const out=[];
  if(!layer)return out;
  const E=layer.extent||4096;
  const scale=2**(WORLD_Z-z)*(WORLD_EXTENT/E);
  for(const f of layer.features){
    const p=f.properties;
    if(f.type!==2||!ROAD_TYPES[p.class]||p.brunnel==='tunnel')continue;
    for(const ln of f.lines){
      for(const piece of clipPolylineToSquare(ln,E)){
        out.push({
          coords:piece.map(([px,py])=>[(x*E+px)*scale,(y*E+py)*scale]),
          cls:p.class,
          oneway:Number(p.oneway)||0
        });
      }
    }
  }
  return out;
}

const ROAD_TILE_Z=14;
const ROAD_TILE_CACHE=36;

export function createStreetTraffic(map,{
  roadSourceId='openmaptiles',
  beforeLayerId=()=>undefined
}={}){
  const sim=createTrafficSim({seed:(Date.now()&0xffff)+1});
  let enabled=false;
  let raf=null;
  let lastFrame=0,lastPaint=0;
  let origin=null,mpu=0;
  let rebuildTimer=null,lastRebuild=0;
  let viewCache=null,viewCacheAt=0;
  let lastCenter=null,lastZoom=null;
  let pendingPopulate=false;

  function ensureLayers(){
    if(!map.getSource(SOURCE_ID)){
      map.addSource(SOURCE_ID,{type:'geojson',data:{type:'FeatureCollection',features:[]}});
    }
    const before=placementBeforeId();
    if(!map.getLayer(LAYER_3D)){
      map.addLayer({
        id:LAYER_3D,type:'fill-extrusion',source:SOURCE_ID,minzoom:13.5,
        layout:{visibility:'none'},
        paint:{
          'fill-extrusion-color':['get','color'],
          'fill-extrusion-base':['get','base'],
          'fill-extrusion-height':['get','top'],
          'fill-extrusion-opacity':1,
          'fill-extrusion-vertical-gradient':true
        }
      },before);
    }
    if(!map.getLayer(LAYER_2D)){
      map.addLayer({
        id:LAYER_2D,type:'fill',source:SOURCE_ID,minzoom:13.5,
        layout:{visibility:'none'},
        paint:{'fill-color':['get','color'],'fill-opacity':1}
      },before);
    }
  }

  /* Draw above every basemap road, bridge and building footprint (otherwise a
     bridge or flat building fill painted later covers the vehicles), but below
     the labels that follow them. */
  function placementBeforeId(){
    const layers=map.getStyle()?.layers||[];
    let last=-1;
    layers.forEach((layer,i)=>{
      if(layer.type!=='symbol'&&layer.source===roadSourceId)last=i;
    });
    for(let i=last+1;i<layers.length;i++){
      if(!layers[i].id.startsWith('street-traffic'))return layers[i].id;
    }
    return beforeLayerId();
  }

  function syncView(){
    if(!map.getLayer(LAYER_3D))return;
    const is3D=map.getPitch()>0.5;
    const before=placementBeforeId();
    if(before){
      try{map.moveLayer(LAYER_3D,before);map.moveLayer(LAYER_2D,before);}catch(error){}
    }
    map.setLayoutProperty(LAYER_3D,'visibility',enabled&&is3D?'visible':'none');
    map.setLayoutProperty(LAYER_2D,'visibility',enabled&&!is3D?'visible':'none');
  }

  const toLngLat=(x,y)=>worldToLngLat(x/mpu+origin[0],y/mpu+origin[1]);

  const tileCache=new Map();
  let lastSignature='';

  function tileTemplate(){
    const t=map.getSource(roadSourceId)?.tiles?.[0];
    return typeof t==='string'&&t.includes('{z}')
      ?t:'https://tiles.openfreemap.org/planet/latest/{z}/{x}/{y}.pbf';
  }

  /* Ground radius (m) from the view centre to the farthest visible screen edge. */
  function viewRadiusMetres(){
    const canvas=map.getCanvas();
    const w=canvas.clientWidth,h=canvas.clientHeight;
    const c=map.getCenter();
    const kx=111320*Math.cos(c.lat*Math.PI/180),ky=110540;
    let r=0;
    for(const [px,py] of [[0,h],[w,h],[0,h*0.2],[w,h*0.2],[w/2,h*0.12],[0,h/2],[w,h/2]]){
      let ll;
      try{ll=map.unproject([px,py]);}catch(error){continue;}
      if(!ll||!Number.isFinite(ll.lng)||!Number.isFinite(ll.lat))continue;
      const d=Math.hypot((ll.lng-c.lng)*kx,(ll.lat-c.lat)*ky);
      if(Number.isFinite(d))r=Math.max(r,d);
    }
    return Math.min(2200,Math.max(150,r));
  }

  function wantedTiles(){
    const c=map.getCenter();
    const [X,Y]=lngLatToWorld(c.lng,c.lat);
    const m=EARTH_CIRCUMFERENCE*Math.cos(c.lat*Math.PI/180)/WORLD_SIZE;
    const R=Math.min(2700,viewRadiusMetres()+380)/m;
    const ts=WORLD_SIZE/2**ROAD_TILE_Z;
    const tiles=[];
    for(let x=Math.floor((X-R)/ts);x<=Math.floor((X+R)/ts);x++){
      for(let y=Math.floor((Y-R)/ts);y<=Math.floor((Y+R)/ts);y++){
        const d=Math.hypot((x+0.5)*ts-X,(y+0.5)*ts-Y);
        tiles.push({x,y,key:ROAD_TILE_Z+'/'+x+'/'+y,d});
      }
    }
    return tiles.sort((a,b)=>a.d-b.d).slice(0,16);
  }

  async function loadTile(t){
    const entry={state:'loading',lines:null,used:performance.now()};
    tileCache.set(t.key,entry);
    try{
      const url=tileTemplate().replace('{z}',ROAD_TILE_Z).replace('{x}',t.x).replace('{y}',t.y);
      const res=await fetch(url);
      if(!res.ok)throw new Error('HTTP '+res.status);
      let bytes=new Uint8Array(await res.arrayBuffer());
      if(bytes[0]===0x1f&&bytes[1]===0x8b){
        const stream=new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
        bytes=new Uint8Array(await new Response(stream).arrayBuffer());
      }
      entry.lines=roadLinesFromTile(decodeVectorTileLayer(bytes,'transportation'),ROAD_TILE_Z,t.x,t.y);
      entry.state='ready';
    }catch(error){
      entry.state='error';
      entry.retryAt=performance.now()+15000;
      console.warn('Street traffic road tile failed',t.key,error);
    }
    scheduleRebuild(120);
  }

  let lastEnsure=0;
  function ensureTiles(){
    const now=performance.now();
    lastEnsure=now;
    const want=wantedTiles();
    for(const t of want){
      const e=tileCache.get(t.key);
      if(!e||(e.state==='error'&&now>e.retryAt))loadTile(t);
      else e.used=now;
    }
    if(tileCache.size>ROAD_TILE_CACHE){
      const keep=new Set(want.map(t=>t.key));
      const old=[...tileCache.entries()]
        .filter(([k,e])=>!keep.has(k)&&e.state!=='loading')
        .sort((a,b)=>a[1].used-b[1].used);
      for(const [k] of old.slice(0,tileCache.size-ROAD_TILE_CACHE))tileCache.delete(k);
    }
    return want;
  }

  function rebuildGraph(){
    rebuildTimer=null;
    if(!enabled)return;
    if(map.getZoom()<14.2){
      sim.setGraph(null);sim.clear();paint();
      pendingPopulate=true;lastSignature='';
      return;
    }
    const want=ensureTiles();
    const ready=want.filter(t=>tileCache.get(t.key)?.state==='ready');
    const c=map.getCenter();
    const cw=lngLatToWorld(c.lng,c.lat);
    if(!origin||Math.hypot(cw[0]-origin[0],cw[1]-origin[1])*mpu>15000){
      origin=cw;
      mpu=EARTH_CIRCUMFERENCE*Math.cos(c.lat*Math.PI/180)/WORLD_SIZE;
      sim.clear();
      lastSignature='';
    }
    const signature=ready.map(t=>t.key).sort().join('|');
    if(signature===lastSignature)return;
    lastSignature=signature;
    lastRebuild=performance.now();
    const lines=[];
    for(const t of ready)for(const l of tileCache.get(t.key).lines)lines.push(l);
    const graph=buildRoadGraph(lines,{metresPerUnit:mpu,origin});
    sim.setGraph(graph);
    viewCache=null;
    if(pendingPopulate&&graph.links.length){pendingPopulate=false;sim.populate(5);}
  }

  function scheduleRebuild(delay=350){
    if(!enabled)return;
    if(rebuildTimer)return;
    const since=performance.now()-lastRebuild;
    rebuildTimer=setTimeout(rebuildGraph,Math.max(delay,600-since));
  }

  function computeView(now){
    if(viewCache&&now-viewCacheAt<400)return viewCache;
    const canvas=map.getCanvas();
    const w=canvas.clientWidth,h=canvas.clientHeight;
    const center=map.getCenter();
    const cw=lngLatToWorld(center.lng,center.lat);
    const cx=(cw[0]-origin[0])*mpu,cy=(cw[1]-origin[1])*mpu;
    const inner=viewRadiusMetres();
    const isVisible=(x,y,margin=0)=>{
      if(Math.hypot(x-cx,y-cy)>inner*1.25)return false;
      const p=map.project(toLngLat(x,y));
      return p.x>=-margin&&p.x<=w+margin&&p.y>=-margin&&p.y<=h+margin;
    };
    viewCache={
      isVisible,
      distance:(x,y)=>Math.hypot(x-cx,y-cy),
      outerRadius:inner+220,
      spacingM:85,
      maxVisible:70,
      width:w,height:h
    };
    viewCacheAt=now;
    return viewCache;
  }

  function paint(){
    const src=map.getSource(SOURCE_ID);
    if(!src)return;
    const g=sim.getGraph();
    if(!g||!enabled){src.setData({type:'FeatureCollection',features:[]});return;}
    const canvas=map.getCanvas();
    const w=canvas.clientWidth,h=canvas.clientHeight;
    const flat=map.getPitch()<=0.5;
    const groups=new Map();
    for(const v of sim.vehicles){
      const p=sim.pose(v);
      const ll=toLngLat(p.x,p.y);
      const sp=map.project(ll);
      if(sp.x<-120||sp.x>w+120||sp.y<-120||sp.y>h+120)continue;
      // Screen size decides the model detail.
      const tip=map.project(toLngLat(p.x+Math.cos(p.h)*v.spec.L,p.y+Math.sin(p.h)*v.spec.L));
      const px=Math.hypot(tip.x-sp.x,tip.y-sp.y);
      const lod=flat?(px<5?'tiny':'flat'):px>30?'detail':px>7?'medium':'tiny';
      const k=v.scale;
      const cos=Math.cos(p.h),sin=Math.sin(p.h);
      for(const part of vehicleParts(v,lod)){
        const ring=part.ring.map(([f,l])=>{
          const x=p.x+(f*cos+l*sin)*k,y=p.y+(f*sin-l*cos)*k;
          return toLngLat(x,y);
        });
        ring.push(ring[0]);
        const base=+(part.base*k).toFixed(2),top=+(part.top*k).toFixed(2);
        const key=part.color+'|'+base+'|'+top+'|'+part.kind;
        let gr=groups.get(key);
        if(!gr){gr={color:part.color,base,top,kind:part.kind,polys:[]};groups.set(key,gr);}
        gr.polys.push([ring]);
      }
    }
    if(map.getZoom()>=15.5){
      const pushPart=(origin,h,part)=>{
        const cos=Math.cos(h),sin=Math.sin(h);
        const ring=part.ring.map(([f,l])=>toLngLat(origin.x+f*cos+l*sin,origin.y+f*sin-l*cos));
        ring.push(ring[0]);
        const key=part.color+'|'+part.base+'|'+part.top+'|'+part.kind;
        let gr=groups.get(key);
        if(!gr){gr={color:part.color,base:part.base,top:part.top,kind:part.kind,polys:[]};groups.set(key,gr);}
        gr.polys.push([ring]);
      };
      for(const ctrl of sim.signals){
        for(const ap of ctrl.approaches){
          const sp=map.project(toLngLat(ap.pole.x,ap.pole.y));
          if(sp.x<-80||sp.x>w+80||sp.y<-80||sp.y>h+80)continue;
          const state=sim.signalState(ctrl,ap.phase);
          for(const part of signalParts(state,flat))pushPart(ap.pole,ap.pole.h,part);
          pushPart(ap.line,ap.line.h,{
            ring:rect(-0.15,0.15,ap.line.a,ap.line.b),
            base:0,top:flat?0:0.03,color:'#f7f7f5',kind:'wheel'
          });
        }
      }
    }
    const features=[...groups.values()]
      .sort((a,b)=>ORDER[a.kind]-ORDER[b.kind]||a.base-b.base)
      .map(gr=>({
        type:'Feature',
        properties:{color:gr.color,base:gr.base,top:gr.top},
        geometry:{type:'MultiPolygon',coordinates:gr.polys}
      }));
    src.setData({type:'FeatureCollection',features});
  }

  function frame(time){
    raf=requestAnimationFrame(frame);
    if(!enabled||document.hidden){lastFrame=time;return;}
    if(!lastFrame){lastFrame=time;return;}
    const dt=Math.min(0.1,(time-lastFrame)/1000);
    lastFrame=time;
    if(!sim.getGraph()||!origin)return;
    const view=computeView(time);
    sim.step(dt,view);
    const interval=map.isMoving()?45:33;
    if(time-lastPaint>=interval){lastPaint=time;paint();}
  }

  function onMoveEnd(){
    viewCache=null;
    scheduleRebuild(300);
    const c=map.getCenter(),z=map.getZoom();
    if(lastCenter&&origin){
      const a=lngLatToWorld(lastCenter.lng,lastCenter.lat),b=lngLatToWorld(c.lng,c.lat);
      const moved=Math.hypot(a[0]-b[0],a[1]-b[1])*mpu;
      const view=computeView(performance.now());
      // A long jump (search result, "London" button) lands on empty streets.
      if(moved>view.outerRadius*1.1||Math.abs(z-lastZoom)>1.6)pendingPopulate=true;
    }
    lastCenter=c;lastZoom=z;
  }
  function onMove(){
    viewCache=null;
    // Long pans/flights: fetch road tiles ahead of the camera before it stops.
    if(performance.now()-lastEnsure>1500){lastEnsure=performance.now();ensureTiles();}
  }

  function setEnabled(on){
    on=Boolean(on);
    if(on===enabled)return;
    enabled=on;
    ensureLayers();
    syncView();
    if(on){
      map.on('moveend',onMoveEnd);
      map.on('move',onMove);
      lastCenter=map.getCenter();lastZoom=map.getZoom();
      pendingPopulate=true;
      rebuildGraph();
      lastFrame=0;
      if(raf===null)raf=requestAnimationFrame(frame);
    }else{
      map.off('moveend',onMoveEnd);
      map.off('move',onMove);
      if(raf!==null){cancelAnimationFrame(raf);raf=null;}
      clearTimeout(rebuildTimer);rebuildTimer=null;
      sim.clear();
      paint();
    }
  }

  return {
    setEnabled,
    syncView,
    get enabled(){return enabled;},
    get sim(){return sim;}
  };
}
