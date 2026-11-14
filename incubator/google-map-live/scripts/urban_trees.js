/* Trees in London's green spaces (procedural, display only).
 *
 * OpenFreeMap tiles describe green areas (woods, parks, gardens, grass) but
 * not individual trees, so trees are scattered inside those polygons on a
 * fixed world grid: each grid cell gets a deterministic jitter and chance from
 * a hash of its coordinates, so the same place always grows the same trees and
 * tile edges never double them. Points inside water are dropped.
 *
 * Street trees line both sides of ordinary streets (not motorways, service
 * roads, bridges or tunnels). No tree grows inside buildings, water,
 * airports or railway land, or on another road.
 *
 * Trees are low-poly extrusions: a trunk and stacked octagonal crowns
 * (rounded broadleaf or tiered conifer), varied in height, size and green.
 * They are a visual impression only, not a tree inventory.
 */

const EARTH=40075016.686;
/* Fixed reference (Charing Cross): local metres and the tree grid are anchored
   here, so trees never shift as the camera moves. */
const REF=[-0.12768,51.50733];

/* Green-space classes: grid spacing (m), chance a cell holds a tree, conifer share,
   height range (m). */
export const GREEN_CLASSES=Object.freeze({
  wood:{spacing:7.5,chance:0.9,conifer:0.25,height:[9,19]},
  park:{spacing:15,chance:0.42,conifer:0.12,height:[7,16]},
  garden:{spacing:12,chance:0.4,conifer:0.15,height:[5,11]},
  cemetery:{spacing:14,chance:0.45,conifer:0.35,height:[6,14]},
  sport:{spacing:38,chance:0.18,conifer:0.1,height:[7,14]}
});

/* Street trees: spacing along the kerb (m), chance per slot, height range. */
export const STREET_TREES=Object.freeze({spacing:11,chance:0.78,height:[8,14],kerb:2.2});
/* Carriageway half-widths (m) for roads that get street trees. */
export const STREET_HALF_WIDTH=Object.freeze({trunk:9,primary:8,secondary:7,tertiary:6,minor:4.5});
/* Half-widths of every road a tree must keep clear of. */
const ROAD_CLEARANCE={motorway:12,trunk:9,primary:8,secondary:7,tertiary:6,minor:4.5,service:3,
  track:2,path:1.2,rail:3,transit:3,raceway:5,busway:4,bus_guideway:4};

/* Map an OpenMapTiles feature (landcover / park / landuse layer) to a class. */
export function greenClassOf(layer,props){
  const c=props.class,s=props.subclass;
  if(layer==='landcover'){
    if(c==='wood')return 'wood';
    if(s==='park'||s==='village_green'||s==='nature_reserve')return 'park';
    if(s==='garden'||s==='allotments')return 'garden';
    // Golf courses keep scattered trees; pitches, playing fields and plain
    // grass (verges, airfields, lawns) stay open.
    if(s==='golf_course')return 'sport';
    return null;
  }
  if(layer==='park')return 'park';
  if(layer==='landuse'){
    if(c==='cemetery')return 'cemetery';
    return null;
  }
  return null;
}

/* Small integer hash -> [0,1). */
export function hash01(i,j,salt=0){
  let h=Math.imul(i|0,374761393)^Math.imul(j|0,668265263)^Math.imul(salt|0,2147483647);
  h=Math.imul(h^(h>>>13),1274126177);
  h^=h>>>16;
  return (h>>>0)/4294967296;
}

function pointInRing(x,y,ring){
  let inside=false;
  for(let i=0,j=ring.length-1;i<ring.length;j=i++){
    const [xi,yi]=ring[i],[xj,yj]=ring[j];
    if((yi>y)!==(yj>y)&&x<(xj-xi)*(y-yi)/((yj-yi)||1e-12)+xi)inside=!inside;
  }
  return inside;
}
export function pointInPolygon(x,y,rings){
  if(!rings.length||!pointInRing(x,y,rings[0]))return false;
  for(let k=1;k<rings.length;k++)if(pointInRing(x,y,rings[k]))return false;
  return true;
}

/* Local metres: x east, y north, relative to an origin (lng0, lat0). */
export function makeProjector(lng0,lat0){
  const kx=EARTH*Math.cos(lat0*Math.PI/180)/360,ky=EARTH/360;
  return {
    toLocal:([lng,lat])=>[(lng-lng0)*kx,(lat-lat0)*ky],
    toLngLat:([x,y])=>[lng0+x/kx,lat0+y/ky]
  };
}

/* Bounding-box grid over polygons ([{rings}]) for fast point tests. */
export function polygonIndex(polys,cell=60){
  const grid=new Map();
  const items=[];
  for(const poly of polys){
    const outer=poly.rings&&poly.rings[0];
    if(!outer||outer.length<3)continue;
    let x0=Infinity,y0=Infinity,x1=-Infinity,y1=-Infinity;
    for(const [x,y] of outer){if(x<x0)x0=x;if(x>x1)x1=x;if(y<y0)y0=y;if(y>y1)y1=y;}
    const id=items.push({rings:poly.rings,box:[x0,y0,x1,y1]})-1;
    const i0=Math.floor(x0/cell),i1=Math.floor(x1/cell),j0=Math.floor(y0/cell),j1=Math.floor(y1/cell);
    if((i1-i0+1)*(j1-j0+1)>4000){(grid.get('big')||grid.set('big',[]).get('big')).push(id);continue;}
    for(let i=i0;i<=i1;i++)for(let j=j0;j<=j1;j++){
      const k=i+','+j;
      (grid.get(k)||grid.set(k,[]).get(k)).push(id);
    }
  }
  return {
    contains(x,y){
      const ids=[...(grid.get(Math.floor(x/cell)+','+Math.floor(y/cell))||[]),...(grid.get('big')||[])];
      for(const id of ids){
        const {rings,box}=items[id];
        if(x<box[0]||x>box[2]||y<box[1]||y>box[3])continue;
        if(pointInPolygon(x,y,rings))return true;
      }
      return false;
    },
    /* Inside a polygon, or within r metres of one. */
    near(x,y,r){
      const seen=new Set(grid.get('big')||[]);
      for(let i=Math.floor((x-r)/cell);i<=Math.floor((x+r)/cell);i++)
        for(let j=Math.floor((y-r)/cell);j<=Math.floor((y+r)/cell);j++)
          for(const id of grid.get(i+','+j)||[])seen.add(id);
      for(const id of seen){
        const {rings,box}=items[id];
        if(x<box[0]-r||x>box[2]+r||y<box[1]-r||y>box[3]+r)continue;
        if(pointInPolygon(x,y,rings))return true;
        for(const ring of rings)
          for(let k=1;k<ring.length;k++)
            if(segDist(x,y,ring[k-1][0],ring[k-1][1],ring[k][0],ring[k][1])<r)return true;
      }
      return false;
    }
  };
}

function segDist(x,y,ax,ay,bx,by){
  const dx=bx-ax,dy=by-ay,l2=dx*dx+dy*dy;
  const t=l2?Math.max(0,Math.min(1,((x-ax)*dx+(y-ay)*dy)/l2)):0;
  return Math.hypot(x-(ax+t*dx),y-(ay+t*dy));
}

/* Grid over road segments: is (x,y) on a road (within its half-width + margin)? */
export function roadIndex(roads,cell=40){
  const grid=new Map();
  const segs=[];
  for(const road of roads){
    const half=road.half??ROAD_CLEARANCE[road.cls]??4;
    const c=road.coords;
    for(let k=1;k<c.length;k++){
      const [ax,ay]=c[k-1],[bx,by]=c[k];
      const id=segs.push([ax,ay,bx,by,half])-1;
      const pad=half+2;
      const i0=Math.floor((Math.min(ax,bx)-pad)/cell),i1=Math.floor((Math.max(ax,bx)+pad)/cell);
      const j0=Math.floor((Math.min(ay,by)-pad)/cell),j1=Math.floor((Math.max(ay,by)+pad)/cell);
      if((i1-i0+1)*(j1-j0+1)>400)continue;
      for(let i=i0;i<=i1;i++)for(let j=j0;j<=j1;j++){
        const key=i+','+j;
        (grid.get(key)||grid.set(key,[]).get(key)).push(id);
      }
    }
  }
  return {
    blocked(x,y,margin=1){
      for(const id of grid.get(Math.floor(x/cell)+','+Math.floor(y/cell))||[]){
        const s=segs[id];
        if(segDist(x,y,s[0],s[1],s[2],s[3])<s[4]+margin)return true;
      }
      return false;
    }
  };
}

/* Candidate street-tree positions on both kerbs of the given roads
   ([{cls, coords:[[x,y],...]}], local metres). Slots sit where the line crosses
   a world grid along its main axis, so the same street always gets the same
   trees, however the road is split into tiles. */
export function streetTreeSlots(roads,{gridOffset=[0,0],bounds=null}={}){
  const {spacing,chance,height,kerb}=STREET_TREES;
  const out=[];
  for(const road of roads){
    const half=STREET_HALF_WIDTH[road.cls];
    if(half==null)continue;
    const off=half+kerb;
    const c=road.coords;
    for(let k=1;k<c.length;k++){
      const [ax,ay]=c[k-1],[bx,by]=c[k];
      const dx=bx-ax,dy=by-ay,len=Math.hypot(dx,dy);
      if(len<1)continue;
      if(bounds&&(Math.max(ax,bx)<bounds[0]-off||Math.min(ax,bx)>bounds[2]+off||
        Math.max(ay,by)<bounds[1]-off||Math.min(ay,by)>bounds[3]+off))continue;
      const ux=dx/len,uy=dy/len;
      const alongX=Math.abs(ux)>=Math.abs(uy);
      const a0=alongX?ax+gridOffset[0]:ay+gridOffset[1];
      const a1=alongX?bx+gridOffset[0]:by+gridOffset[1];
      const step=spacing*Math.abs(alongX?ux:uy);
      const lo=Math.min(a0,a1),hi=Math.max(a0,a1);
      for(let n=Math.ceil(lo/step);n*step<hi;n++){
        const t=(n*step-a0)/(a1-a0);
        const px=ax+dx*t,py=ay+dy*t;
        const lane=Math.round((alongX?py+gridOffset[1]:px+gridOffset[0])/6);
        for(const side of [1,-1]){
          const salt=side>0?41:43;
          if(hash01(n,lane,salt)>chance)continue;
          const u=hash01(n,lane,salt+1),v=hash01(n,lane,salt+2);
          const columnar=v>0.9;
          const h=height[0]+(height[1]-height[0])*u;
          const width=0.85+0.3*hash01(n,lane,salt+3);
          out.push({x:px-uy*off*side,y:py+ux*off*side,cls:'street',h,
            r:h*width*(columnar?0.13:0.34),conifer:false,
            variant:columnar?'columnar':'broadleaf',width,tone:hash01(n,lane,salt+4)});
        }
      }
    }
  }
  return out;
}

/**
 * Scatter trees.
 * areas: [{cls, rings:[[[x,y],...],...]}] in local metres (absolute grid:
 *   pass gridOrigin so cells are anchored to the world, not the view).
 * water: [{rings}] in the same metres.
 * roads: [{cls, coords}] for street trees and road clearance.
 * exclude: [{rings}] where no tree may stand (airports, rail land).
 * buildings: [{rings}]; neither trunk nor crown may touch one (a tree too
 *   close is made smaller, or dropped).
 * Returns [{x,y,cls,h,r,conifer,tone}]
 */
export function scatterTrees(areas,water,{gridOffset=[0,0],maxTrees=3000,bounds=null,roads=[],exclude=[],buildings=[]}={}){
  const cells=new Map();
  const [gx,gy]=gridOffset;
  for(const area of areas){
    const def=GREEN_CLASSES[area.cls];
    if(!def)continue;
    const outer=area.rings[0];
    let x0=Infinity,y0=Infinity,x1=-Infinity,y1=-Infinity;
    for(const [x,y] of outer){if(x<x0)x0=x;if(x>x1)x1=x;if(y<y0)y0=y;if(y>y1)y1=y;}
    if(bounds){
      x0=Math.max(x0,bounds[0]);y0=Math.max(y0,bounds[1]);
      x1=Math.min(x1,bounds[2]);y1=Math.min(y1,bounds[3]);
      if(x0>x1||y0>y1)continue;
    }
    const s=def.spacing;
    const salt=Math.round(s*10);
    for(let i=Math.floor((x0+gx)/s);i<=Math.floor((x1+gx)/s);i++){
      for(let j=Math.floor((y0+gy)/s);j<=Math.floor((y1+gy)/s);j++){
        if(hash01(i,j,salt)>def.chance)continue;
        const x=(i+0.15+0.7*hash01(i,j,salt+1))*s-gx;
        const y=(j+0.15+0.7*hash01(i,j,salt+2))*s-gy;
        if(!pointInPolygon(x,y,area.rings))continue;
        // One tree per 3 m cell across all classes (overlapping polygons).
        const key=Math.round((x+gx)/3)+','+Math.round((y+gy)/3);
        if(cells.has(key))continue;
        const u=hash01(i,j,salt+3),v=hash01(i,j,salt+4);
        const conifer=v<def.conifer;
        const columnar=!conifer&&v>0.88;
        const variant=conifer?'conifer':columnar?'columnar':'broadleaf';
        const h=def.height[0]+(def.height[1]-def.height[0])*u;
        const width=0.85+0.35*hash01(i,j,salt+6);
        const r=h*width*(conifer?0.24:columnar?0.13:0.36);
        cells.set(key,{x,y,cls:area.cls,h,r,conifer,variant,width,tone:hash01(i,j,salt+5)});
      }
    }
  }
  // Street trees fill slots not already taken by a green-space tree.
  for(const t of streetTreeSlots(roads,{gridOffset,bounds})){
    if(bounds&&(t.x<bounds[0]||t.x>bounds[2]||t.y<bounds[1]||t.y>bounds[3]))continue;
    const key=Math.round((t.x+gx)/3)+','+Math.round((t.y+gy)/3);
    if(!cells.has(key))cells.set(key,t);
  }
  let trees=[...cells.values()];
  const blocked=polygonIndex([...water,...exclude]);
  const onRoad=roadIndex(roads);
  trees=trees.filter(t=>!blocked.contains(t.x,t.y)&&!onRoad.blocked(t.x,t.y,t.cls==='street'?0.8:1.5));
  if(buildings.length){
    const built=polygonIndex(buildings,40);
    const clear=(x,y,r)=>!built.near(x,y,r);
    trees=trees.filter(t=>{
      // Model crowns reach about 1.1 x r; keep half a metre off the wall.
      if(clear(t.x,t.y,t.r*1.12+0.5))return true;
      if(!clear(t.x,t.y,t.r*0.6*1.12+0.5))return false;
      t.h*=0.65;t.r*=0.6;t.width*=0.92;
      return true;
    });
  }
  if(trees.length>maxTrees){
    // Keep a stable, evenly spread subset.
    trees.sort((a,b)=>hash01(Math.round(a.x),Math.round(a.y),7)-hash01(Math.round(b.x),Math.round(b.y),7));
    trees.length=maxTrees;
  }
  return trees;
}

const BROADLEAF=['#5b8c4b','#679a52','#4f7f45','#74a45c','#5f9150'];
const CONIFER=['#3c6844','#46744a','#355e3f'];
const TRUNK='#6a4e39';

function octagon(cx,cy,r){
  const out=[];
  for(let k=0;k<8;k++){
    const a=(k+0.5)*Math.PI/4;
    out.push([cx+Math.cos(a)*r,cy+Math.sin(a)*r]);
  }
  out.push(out[0]);
  return out;
}
function shade(hex,f){
  const n=parseInt(hex.slice(1),16);
  const c=[(n>>16)&255,(n>>8)&255,n&255].map(v=>Math.max(0,Math.min(255,Math.round(v*f))));
  return '#'+c.map(v=>v.toString(16).padStart(2,'0')).join('');
}

/* Model parts of one tree in local metres: [{ring, base, top, color, kind}] */
export function treeParts(t,lod='detail'){
  const parts=[];
  const add=(ring,base,top,color,kind)=>parts.push({ring,base,top,color,kind});
  const {x,y,h,r}=t;
  const palette=t.conifer?CONIFER:BROADLEAF;
  const green=palette[Math.floor(t.tone*palette.length)%palette.length];
  if(lod==='flat'){
    add(octagon(x,y,r),0,0,green,'crown');
    return parts;
  }
  if(lod==='simple'){
    add(octagon(x,y,r*0.9),h*0.3,h,green,'crown');
    return parts;
  }
  const tw=Math.max(0.18,Math.min(0.32,h*0.022));
  if(t.conifer){
    add(octagon(x,y,tw),0,h*0.22,TRUNK,'trunk');
    const tiers=[[0.18,0.45,1],[0.42,0.68,0.72],[0.65,0.88,0.45],[0.86,1,0.18]];
    tiers.forEach(([b,top,k],i)=>add(octagon(x,y,r*k),h*b,h*top,shade(green,0.88+i*0.06),'crown'));
  }else{
    add(octagon(x,y,tw),0,h*0.4,TRUNK,'trunk');
    const tiers=[[0.32,0.5,0.78],[0.48,0.8,1],[0.78,0.94,0.72],[0.92,1,0.38]];
    tiers.forEach(([b,top,k],i)=>add(octagon(x,y,r*k),h*b,h*top,shade(green,0.86+i*0.06),'crown'));
  }
  return parts;
}

/* -------------------------------------------------------------- MapLibre */

/* Per-tree colour variation (multiplies the model's leaf colours). */
export function treeTint(t){
  const a=hash01(Math.round(t.x*10),Math.round(t.y*10),11);
  const b=hash01(Math.round(t.x*10),Math.round(t.y*10),12);
  // From yellow-green to deep blue-green, lighter and darker.
  const light=0.86+0.28*b;
  return [light*(0.9+0.22*a),light*(1.0+0.06*(1-a)),light*(0.88+0.12*(1-a))];
}

export function createUrbanTrees(map,{
  sourceId='openmaptiles',
  buildingSources=[],
  createRenderer,
  minZoom=15.5,
  maxTrees=3000,
  onChange=()=>{}
}={}){
  let enabled=false;
  let trees=[];
  let projector=null;
  let timer=null;
  const renderer=createRenderer();

  function readAreas(){
    const areas=[],water=[];
    projector=projector||makeProjector(REF[0],REF[1]);
    const take=(layer,cb)=>{
      let fs=[];
      try{fs=map.querySourceFeatures(sourceId,{sourceLayer:layer});}catch(error){return;}
      for(const f of fs){
        const g=f.geometry;
        const polys=g?.type==='Polygon'?[g.coordinates]:g?.type==='MultiPolygon'?g.coordinates:[];
        for(const poly of polys)cb(f,poly.map(ring=>ring.map(projector.toLocal)));
      }
    };
    for(const layer of ['landcover','park','landuse']){
      take(layer,(f,rings)=>{
        const cls=greenClassOf(layer,f.properties||{});
        if(cls)areas.push({cls,rings});
      });
    }
    take('water',(f,rings)=>water.push({rings}));
    const exclude=[];
    take('aeroway',(f,rings)=>exclude.push({rings}));
    const buildings=[];
    take('building',(f,rings)=>buildings.push({rings}));
    for(const id of buildingSources){
      if(id===sourceId)continue;
      let fs=[];
      try{fs=map.querySourceFeatures(id,{sourceLayer:'building'});}catch(error){continue;}
      for(const f of fs){
        const g=f.geometry;
        const polys=g?.type==='Polygon'?[g.coordinates]:g?.type==='MultiPolygon'?g.coordinates:[];
        for(const poly of polys)buildings.push({rings:poly.map(ring=>ring.map(projector.toLocal))});
      }
    }
    take('landuse',(f,rings)=>{
      const c=f.properties?.class;
      if(c==='railway'||c==='industrial'||c==='quarry'||c==='landfill')exclude.push({rings});
    });
    const roads=[];
    let lines=[];
    try{lines=map.querySourceFeatures(sourceId,{sourceLayer:'transportation'});}catch(error){}
    for(const f of lines){
      const p=f.properties||{},g=f.geometry;
      if(p.brunnel==='tunnel')continue;
      const parts=g?.type==='LineString'?[g.coordinates]:g?.type==='MultiLineString'?g.coordinates:[];
      // Bridges and ramps keep their clearance but grow no street trees.
      const cls=(p.brunnel==='bridge'||p.ramp===1||p.ramp==='1')&&STREET_HALF_WIDTH[p.class]!=null
        ?'bridge_'+p.class:p.class;
      for(const line of parts)roads.push({cls,half:ROAD_CLEARANCE[p.class],coords:line.map(projector.toLocal)});
    }
    return {areas,water,exclude,roads,buildings};
  }

  function viewBounds(){
    const canvas=map.getCanvas();
    const w=canvas.clientWidth,h=canvas.clientHeight;
    const pts=[[0,0],[w,0],[0,h],[w,h],[w/2,h*0.15]].map(p=>{
      try{const ll=map.unproject(p);return projector.toLocal([ll.lng,ll.lat]);}catch(error){return null;}
    }).filter(Boolean);
    if(!pts.length)return null;
    const xs=pts.map(p=>p[0]),ys=pts.map(p=>p[1]);
    // Pitched views reach far towards the horizon; cap the depth around the centre.
    const c=projector.toLocal([map.getCenter().lng,map.getCenter().lat]);
    const cap=1600;
    return [Math.max(c[0]-cap,Math.min(...xs)-60),Math.max(c[1]-cap,Math.min(...ys)-60),
      Math.min(c[0]+cap,Math.max(...xs)+60),Math.min(c[1]+cap,Math.max(...ys)+60)];
  }

  function rebuild(){
    timer=null;
    if(!enabled||map.getZoom()<minZoom-0.5){
      if(trees.length){trees=[];renderer.setTrees([],REF);onChange();}
      return;
    }
    const {areas,water,exclude,roads,buildings}=readAreas();
    trees=scatterTrees(areas,water,{maxTrees,bounds:viewBounds(),roads,exclude,buildings});
    renderer.setTrees(trees.map(t=>{
      const [lng,lat]=projector.toLngLat([t.x,t.y]);
      return {lng,lat,h:t.h,yaw:t.tone*Math.PI*2,variant:t.variant,tint:treeTint(t),width:t.width};
    }),REF);
    onChange();
  }

  function schedule(delay=250){
    if(!enabled)return;
    clearTimeout(timer);
    timer=setTimeout(rebuild,delay);
  }
  const onMoveEnd=()=>schedule(200);
  const onData=e=>{if((e.sourceId===sourceId||buildingSources.includes(e.sourceId))&&e.isSourceLoaded)schedule(400);};

  return {
    setEnabled(on){
      on=Boolean(on);
      if(on===enabled)return;
      enabled=on;
      renderer.setVisible(on);
      if(on){
        map.on('moveend',onMoveEnd);map.on('sourcedata',onData);
        schedule(0);
      }else{
        map.off('moveend',onMoveEnd);map.off('sourcedata',onData);
        clearTimeout(timer);trees=[];renderer.setTrees([],REF);
        onChange();
      }
    },
    /* Lighting tints: the strongest one darkens or warms the foliage. */
    setTint(next){
      const list=Array.isArray(next)?next.filter(t=>t&&t.amount>0):[];
      let best={color:'#000000',amount:0};
      for(const t of list){
        const a=t.roles&&t.roles.building!=null?t.roles.building:t.amount;
        if(a>best.amount)best={color:t.color,amount:a};
      }
      renderer.setTint(best);
    },
    setSun(sun){renderer.setSun(sun);},
    syncView(){},
    /* Crown footprints for the ground-shadow layer: [{ring:[[lng,lat],...], height}] */
    shadowFootprints(){
      if(!enabled||!projector)return [];
      return trees.map(t=>({ring:octagon(t.x,t.y,t.r*0.8).slice(0,8).map(projector.toLngLat),height:t.h*0.85}));
    },
    get count(){return trees.length;},
    get enabled(){return enabled;}
  };
}
