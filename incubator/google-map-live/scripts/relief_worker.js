// Colour by height with hill shading, cut to the 70 km study circle (v3.44.0).
// One Worker reads the open height tiles (Terrain Tiles, Mapzen / AWS Open Data, "terrarium" PNG: height in metres =
// R*256 + G + B/256 - 32768), keeps the decoded heights, and paints a tile for the chosen ramp, top height and shade.
// MapLibre's own color-relief layer cannot be cut to a circle, so the picture is made here, as the EA terrain,
// flood and drainage tiles are; outside the circle every pixel is transparent and the basemap shows.
const WORLD_HALF=20037508.342789244;
const R=6378137;
const SIZE=256;
const STEPS=20;
// The two ramps of incubator/loop-city-real-map (v13): twenty colours from low to high.
const RAMPS={
  classic:['#3d9be9','#35c3f0','#30e0e0','#2fe6a8','#2fe66f','#4be64a','#7bea3f','#a6ee3c','#cdf23a','#f0f53a',
    '#ffe838','#ffcf36','#ffb234','#ff9432','#ff7030','#ff4a30','#ff5f5f','#ff8f8f','#ffc0c0','#fff0f0'],
  muted:['#16323a','#1b4042','#235048','#30614b','#44724d','#5d8150','#788c54','#929458','#a8985b','#b6935a',
    '#ba8758','#b77a56','#b16e56','#b06a5c','#b87a6e','#c28e84','#cda59c','#d9bdb6','#e5d4cf','#efe6e2']
};
const RGB=Object.fromEntries(Object.entries(RAMPS).map(([name,list])=>
  [name,list.map(hex=>[parseInt(hex.slice(1,3),16),parseInt(hex.slice(3,5),16),parseInt(hex.slice(5,7),16)])]));
const LOWEST=-3;

let config=null;
const cancelled=new Set();
const heights=new Map();   // 'z/x/y' -> Promise<Float32Array>, the most recent kept
const KEEP=96;

function tileBounds3857(z,x,y){
  const span=(WORLD_HALF*2)/2**z;
  return {left:-WORLD_HALF+x*span,right:-WORLD_HALF+(x+1)*span,top:WORLD_HALF-y*span,bottom:WORLD_HALF-(y+1)*span};
}
function distanceTo(mx,my,clat,clon){
  const lat=2*Math.atan(Math.exp(my/R))-Math.PI/2;
  const dlat=Math.sin((lat-clat)/2)**2,cos=Math.cos(lat)*Math.cos(clat);
  const hav=dlat+cos*Math.sin((mx/R-clon)/2)**2;
  return 2*R*Math.asin(Math.sqrt(Math.min(1,hav)));
}
function tileAgainstCircle(tile){
  if(!config.center||!config.radius)return 'in';
  const clat=config.center.lat*Math.PI/180,clon=config.center.lng*Math.PI/180,radius=config.radius;
  const corners=[[tile.left,tile.top],[tile.right,tile.top],[tile.right,tile.bottom],[tile.left,tile.bottom]];
  if(corners.every(([x,y])=>distanceTo(x,y,clat,clon)<=radius))return 'in';
  const cx=clon*R,cy=R*Math.log(Math.tan(Math.PI/4+clat/2));
  const nx=Math.min(Math.max(cx,tile.left),tile.right),ny=Math.min(Math.max(cy,tile.bottom),tile.top);
  return distanceTo(nx,ny,clat,clon)>radius?'out':'edge';
}

function loadHeights(z,x,y){
  const key=z+'/'+x+'/'+y;
  if(heights.has(key)){
    const kept=heights.get(key);heights.delete(key);heights.set(key,kept);
    return kept;
  }
  const promise=(async()=>{
    const url=config.tiles.replace('{z}',z).replace('{x}',x).replace('{y}',y);
    const response=await fetch(url);
    if(!response.ok)throw new Error('Height tile failed to load: HTTP '+response.status);
    const bitmap=await createImageBitmap(await response.blob(),{premultiplyAlpha:'none',colorSpaceConversion:'none'});
    const canvas=new OffscreenCanvas(SIZE,SIZE),ctx=canvas.getContext('2d',{willReadFrequently:true});
    ctx.drawImage(bitmap,0,0,SIZE,SIZE);bitmap.close();
    const pixels=ctx.getImageData(0,0,SIZE,SIZE).data,out=new Float32Array(SIZE*SIZE);
    for(let i=0;i<out.length;i++)out[i]=pixels[i*4]*256+pixels[i*4+1]+pixels[i*4+2]/256-32768;
    return out;
  })();
  heights.set(key,promise);
  promise.catch(()=>heights.delete(key));
  if(heights.size>KEEP)heights.delete(heights.keys().next().value);
  return promise;
}

// Twenty steps from -3 m to the chosen top, closer together near sea level, as in the real-map app.
function stops(top){
  const list=new Float32Array(STEPS);
  for(let i=0;i<STEPS;i++)list[i]=LOWEST+(top-LOWEST)*Math.pow(i/(STEPS-1),1.5);
  return list;
}

// ---------- 3D relief (v3.45.1): the same heights as a "terrarium" tile for MapLibre's terrain ----------
// Inside the study circle the heights are the real ones. Outside it the ground is flat (0 m), so only the study area
// rises; over the first 2.5 km outside the circle the heights fall away smoothly, so the edge is a slope, not a wall.
const DEM_FADE=2500;
function encodeDem(heightAt){
  const canvas=new OffscreenCanvas(SIZE,SIZE),ctx=canvas.getContext('2d');
  const image=ctx.createImageData(SIZE,SIZE),data=image.data;
  for(let i=0;i<SIZE*SIZE;i++){
    const v=Math.min(65535.99,Math.max(0,heightAt(i)+32768)),whole=Math.floor(v),o=i*4;
    data[o]=whole>>8;data[o+1]=whole&255;data[o+2]=Math.min(255,Math.floor((v-whole)*256));data[o+3]=255;
  }
  ctx.putImageData(image,0,0);
  return canvas.convertToBlob({type:'image/png'}).then(blob=>blob.arrayBuffer());
}
let flatDem=null;
async function renderDem({z,x,y}){
  const tile=tileBounds3857(z,x,y);
  const clat=config.center.lat*Math.PI/180,clon=config.center.lng*Math.PI/180,radius=config.radius;
  const corners=[[tile.left,tile.top],[tile.right,tile.top],[tile.right,tile.bottom],[tile.left,tile.bottom]];
  if(corners.every(([cx,cy])=>distanceTo(cx,cy,clat,clon)<=radius)){
    // wholly inside: the height tile itself, untouched
    const response=await fetch(config.tiles.replace('{z}',z).replace('{x}',x).replace('{y}',y));
    if(!response.ok)throw new Error('Height tile failed to load: HTTP '+response.status);
    return response.arrayBuffer();
  }
  const cx=clon*R,cy=R*Math.log(Math.tan(Math.PI/4+clat/2));
  const nx=Math.min(Math.max(cx,tile.left),tile.right),ny=Math.min(Math.max(cy,tile.bottom),tile.top);
  if(distanceTo(nx,ny,clat,clon)>radius+DEM_FADE){
    flatDem=flatDem||encodeDem(()=>0);
    return (await flatDem).slice(0);
  }
  const h=await loadHeights(z,x,y),step=(tile.right-tile.left)/SIZE;
  return encodeDem(i=>{
    const row=Math.floor(i/SIZE),col=i-row*SIZE;
    const d=distanceTo(tile.left+(col+.5)*step,tile.top-(row+.5)*step,clat,clon);
    if(d<=radius)return h[i];
    if(d>=radius+DEM_FADE)return 0;
    const t=1-(d-radius)/DEM_FADE;
    return h[i]*t*t*(3-2*t);
  });
}

async function transparentTile(){
  const canvas=new OffscreenCanvas(SIZE,SIZE);
  canvas.getContext('2d');   // convertToBlob needs a context, also for an empty tile
  return (await canvas.convertToBlob({type:'image/png'})).arrayBuffer();
}

async function renderTile({z,x,y,ramp,top,shade}){
  const tile=tileBounds3857(z,x,y);
  const where=tileAgainstCircle(tile);
  if(where==='out')return transparentTile();
  const h=await loadHeights(z,x,y);
  const colours=RGB[ramp]||RGB.classic,at=stops(top);
  const canvas=new OffscreenCanvas(SIZE,SIZE),ctx=canvas.getContext('2d');
  const image=ctx.createImageData(SIZE,SIZE),data=image.data;
  const clat=config.center?config.center.lat*Math.PI/180:0,clon=config.center?config.center.lng*Math.PI/180:0;
  const radius=config.radius||0,step=(tile.right-tile.left)/SIZE;
  // Ground size of a pixel at the tile's middle latitude; slopes are steepened more at low zoom, where a pixel
  // averages a wide piece of ground, so the hills still read.
  const midLat=2*Math.atan(Math.exp((tile.top+tile.bottom)/2/R))-Math.PI/2;
  const cell=step*Math.cos(midLat);
  const steepen=6*Math.pow(2,Math.max(0,12-z)*0.4);
  // Light from the north-west, 45 degrees up: (east, north, up).
  const lx=-0.5,ly=0.5,lz=Math.SQRT1_2;
  for(let row=0;row<SIZE;row++){
    const my=tile.top-(row+.5)*step;
    const up=Math.max(row-1,0),down=Math.min(row+1,SIZE-1);
    for(let col=0;col<SIZE;col++){
      const o=(row*SIZE+col)*4;
      if(where==='edge'&&distanceTo(tile.left+(col+.5)*step,my,clat,clon)>radius){data[o+3]=0;continue;}
      const height=h[row*SIZE+col];
      let i=0;
      while(i<STEPS-2&&height>at[i+1])i++;
      const t=Math.min(1,Math.max(0,(height-at[i])/(at[i+1]-at[i])));
      const a=colours[i],b=colours[i+1];
      let r=a[0]+(b[0]-a[0])*t,g=a[1]+(b[1]-a[1])*t,bl=a[2]+(b[2]-a[2])*t;
      if(shade>0){
        const left=Math.max(col-1,0),right=Math.min(col+1,SIZE-1);
        const east=(h[row*SIZE+right]-h[row*SIZE+left])/((right-left)*cell)*steepen;
        const north=(h[up*SIZE+col]-h[down*SIZE+col])/((down-up)*cell)*steepen;
        const light=(-east*lx-north*ly+lz)/Math.sqrt(east*east+north*north+1);
        const k=1+shade*2.2*(light-lz);
        r*=k;g*=k;bl*=k;
      }
      data[o]=r<0?0:r>255?255:r;data[o+1]=g<0?0:g>255?255:g;data[o+2]=bl<0?0:bl>255?255:bl;data[o+3]=255;
    }
  }
  ctx.putImageData(image,0,0);
  return (await canvas.convertToBlob({type:'image/png'})).arrayBuffer();
}

self.onmessage=async({data})=>{
  if(data.type==='init'){config=data.config;heights.clear();return;}
  if(data.type==='cancel'){cancelled.add(data.id);return;}
  if(data.type!=='tile'||!config)return;
  const {id}=data;
  try{
    const buffer=await (data.dem?renderDem(data):renderTile(data));
    if(cancelled.delete(id))return;
    self.postMessage({id,data:buffer},[buffer]);
  }catch(error){
    if(cancelled.delete(id))return;
    self.postMessage({id,error:error?.message||String(error)});
  }
};
