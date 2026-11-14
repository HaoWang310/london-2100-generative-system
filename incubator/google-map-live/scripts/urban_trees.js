/* Trees in London's green spaces (procedural, display only).
 *
 * OpenFreeMap tiles describe green areas (woods, parks, gardens, grass) but
 * not individual trees, so trees are scattered inside those polygons on a
 * fixed world grid: each grid cell gets a deterministic jitter and chance from
 * a hash of its coordinates, so the same place always grows the same trees and
 * tile edges never double them. Points inside water are dropped.
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
  grass:{spacing:24,chance:0.22,conifer:0.1,height:[6,13]},
  sport:{spacing:38,chance:0.18,conifer:0.1,height:[7,14]}
});

/* Map an OpenMapTiles feature (landcover / park / landuse layer) to a class. */
export function greenClassOf(layer,props){
  const c=props.class,s=props.subclass;
  if(layer==='landcover'){
    if(c==='wood')return 'wood';
    if(s==='park'||s==='village_green'||s==='nature_reserve')return 'park';
    if(s==='garden'||s==='allotments')return 'garden';
    if(s==='recreation_ground'||s==='golf_course'||s==='pitch')return 'sport';
    if(c==='grass')return 'grass';
    return null;
  }
  if(layer==='park')return 'park';
  if(layer==='landuse'){
    if(c==='cemetery')return 'cemetery';
    if(c==='pitch'||c==='stadium')return 'sport';
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

/**
 * Scatter trees.
 * areas: [{cls, rings:[[[x,y],...],...]}] in local metres (absolute grid:
 *   pass gridOrigin so cells are anchored to the world, not the view).
 * water: [{rings}] in the same metres.
 * Returns [{x,y,cls,h,r,conifer,tone}]
 */
export function scatterTrees(areas,water,{gridOffset=[0,0],maxTrees=3000,bounds=null}={}){
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
        const h=def.height[0]+(def.height[1]-def.height[0])*u;
        cells.set(key,{x,y,cls:area.cls,h,r:conifer?h*0.2:h*0.3,conifer,tone:hash01(i,j,salt+5)});
      }
    }
  }
  let trees=[...cells.values()];
  if(water.length){
    trees=trees.filter(t=>!water.some(w=>pointInPolygon(t.x,t.y,w.rings)));
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

const SOURCE='urban-trees-source';
const LAYER_3D='urban-trees-3d';
const LAYER_2D='urban-trees-2d';

function mixColor(a,b,t){
  const p=h=>{const n=parseInt(h.slice(1),16);return [(n>>16)&255,(n>>8)&255,n&255];};
  const A=p(a),B=p(b);
  return '#'+A.map((v,i)=>Math.round(v+(B[i]-v)*t).toString(16).padStart(2,'0')).join('');
}

export function createUrbanTrees(map,{
  sourceId='openmaptiles',
  beforeLayerId=()=>undefined,
  minZoom=15.5,
  maxTrees=3000,
  onChange=()=>{}
}={}){
  let enabled=false;
  let tints=[];
  let trees=[];
  let projector=null;
  let timer=null;
  let lastKey='';

  function ensureLayers(){
    if(!map.getSource(SOURCE))map.addSource(SOURCE,{type:'geojson',data:{type:'FeatureCollection',features:[]}});
    const before=beforeLayerId();
    if(!map.getLayer(LAYER_3D)){
      map.addLayer({id:LAYER_3D,type:'fill-extrusion',source:SOURCE,minzoom:minZoom-0.5,
        layout:{visibility:'none'},
        paint:{'fill-extrusion-color':['get','color'],'fill-extrusion-base':['get','base'],
          'fill-extrusion-height':['get','top'],'fill-extrusion-vertical-gradient':true,
          'fill-extrusion-opacity':['interpolate',['linear'],['zoom'],minZoom-0.5,0,minZoom,1]}},before);
    }
    if(!map.getLayer(LAYER_2D)){
      map.addLayer({id:LAYER_2D,type:'fill',source:SOURCE,minzoom:minZoom-0.5,
        filter:['==',['get','kind'],'crown'],
        layout:{visibility:'none'},
        paint:{'fill-color':['get','color'],'fill-opacity':0.85}},before);
    }
  }

  function syncView(){
    if(!map.getLayer(LAYER_3D))return;
    const is3D=map.getPitch()>0.5;
    map.setLayoutProperty(LAYER_3D,'visibility',enabled&&is3D?'visible':'none');
    map.setLayoutProperty(LAYER_2D,'visibility',enabled&&!is3D?'visible':'none');
  }

  const tinted=color=>{
    let c=color;
    for(const t of tints){
      const a=t.roles&&t.roles.building!=null?t.roles.building:t.amount;
      if(a>0)c=mixColor(c,t.color,a);
    }
    return c;
  };

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
    return {areas,water};
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
    const src=map.getSource(SOURCE);
    if(!src)return;
    if(!enabled||map.getZoom()<minZoom-0.5){
      if(trees.length){trees=[];src.setData({type:'FeatureCollection',features:[]});onChange();}
      lastKey='';
      return;
    }
    const {areas,water}=readAreas();
    trees=scatterTrees(areas,water,{maxTrees,bounds:viewBounds()});
    paint();
    onChange();
  }

  function paint(){
    const src=map.getSource(SOURCE);
    if(!src||!projector)return;
    const z=map.getZoom();
    const lod=z>=16.6?'detail':'simple';
    const features=[];
    for(const t of trees){
      for(const p of treeParts(t,lod)){
        features.push({type:'Feature',
          properties:{color:tinted(p.color),base:+p.base.toFixed(2),top:+p.top.toFixed(2),kind:p.kind},
          geometry:{type:'Polygon',coordinates:[p.ring.map(projector.toLngLat)]}});
      }
    }
    src.setData({type:'FeatureCollection',features});
  }

  function schedule(delay=250){
    if(!enabled)return;
    clearTimeout(timer);
    timer=setTimeout(rebuild,delay);
  }
  const onMoveEnd=()=>schedule(200);
  const onData=e=>{if(e.sourceId===sourceId&&e.isSourceLoaded)schedule(400);};
  const onPitch=()=>syncView();

  return {
    setEnabled(on){
      on=Boolean(on);
      if(on===enabled)return;
      enabled=on;
      ensureLayers();
      syncView();
      if(on){
        map.on('moveend',onMoveEnd);map.on('sourcedata',onData);map.on('pitchend',onPitch);
        schedule(0);
      }else{
        map.off('moveend',onMoveEnd);map.off('sourcedata',onData);map.off('pitchend',onPitch);
        clearTimeout(timer);trees=[];
        map.getSource(SOURCE)?.setData({type:'FeatureCollection',features:[]});
        onChange();
      }
    },
    setTint(next){
      tints=Array.isArray(next)?next.filter(t=>t&&t.amount>0):[];
      if(enabled&&trees.length)paint();
    },
    syncView,
    /* Crown footprints for the ground-shadow layer: [{ring:[[lng,lat],...], height}] */
    shadowFootprints(){
      if(!enabled||!projector)return [];
      return trees.map(t=>({ring:octagon(t.x,t.y,t.r*0.85).slice(0,8).map(projector.toLngLat),height:t.h*0.9}));
    },
    get count(){return trees.length;},
    get enabled(){return enabled;}
  };
}
