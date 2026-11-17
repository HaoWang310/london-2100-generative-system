// London map · computation without the page: projection of the hydrology grid, tile coordinates, the 70 km study area,
// contour lines (the worker's source), flood selection rings. No DOM, no map instance — index.html wires these to the map
// (scripts/app.js). Moved here unchanged from the page's inline script in v3.39.1 (structure only, same behaviour).
// The hydrology rasters are display data already warped to Web Mercator (EPSG:3857); analysis stays on the British National Grid.

// Original 70 km study extent centred on Charing Cross E530037 N180373.
export const TERRAIN_BOUNDS={
  west:-1.1478120391692022,
  south:50.858309108610484,
  east:0.9210948646196429,
  north:52.14838885409756
};

export const FOCUS70_CENTER={lat:51.50733434456047,lng:-0.12768375058439654};

export const FOCUS70_RADIUS_M=70000;

// Authoritative hydrology display projection.
// The browser preview is derived from the analytical raster already warped
// to EPSG:3857 (the same projection used by OpenStreetMap / MapLibre).
// Therefore it MUST NOT be warped again through a BNG->WGS84 mesh.
//
// Reprojected 50 m source raster dimensions: 2868 × 2875.
// Exact EPSG:3857 outer bounds:
//   left   -127813.8696191665
//   right   102461.98815442335
//   bottom 6596204.025752107
//   top    6827041.923624865
//
// Shared exact projection bounds for both hydrology layers; upstream analysis remains 50 m.
export const DRAINAGE_GRID_SIZE=10;

export const DRAINAGE_3857={
  left:-127813.8696191665,
  right:102461.98815442335,
  bottom:6596204.025752107,
  top:6827041.923624865,
  baseWidth50m:2868,
  baseHeight50m:2875
};

export function mercator3857ToLngLat(x,y){
  const R=6378137;
  const lng=x/R*180/Math.PI;
  const lat=(2*Math.atan(Math.exp(y/R))-Math.PI/2)*180/Math.PI;
  return [lng,lat];
}

export function drainageTileCoordinates(row,col,gridSize=DRAINAGE_GRID_SIZE){
  const x0=DRAINAGE_3857.left+
    (DRAINAGE_3857.right-DRAINAGE_3857.left)*(col/gridSize);
  const x1=DRAINAGE_3857.left+
    (DRAINAGE_3857.right-DRAINAGE_3857.left)*((col+1)/gridSize);

  const yTop=DRAINAGE_3857.top-
    (DRAINAGE_3857.top-DRAINAGE_3857.bottom)*(row/gridSize);
  const yBottom=DRAINAGE_3857.top-
    (DRAINAGE_3857.top-DRAINAGE_3857.bottom)*((row+1)/gridSize);

  // MapLibre image coordinates: NW, NE, SE, SW.
  return [
    mercator3857ToLngLat(x0,yTop),
    mercator3857ToLngLat(x1,yTop),
    mercator3857ToLngLat(x1,yBottom),
    mercator3857ToLngLat(x0,yBottom)
  ];
}

export function contourMajorIntervalFor(interval){
  interval=Number(interval)||10;
  if(interval===1)return 5;
  if(interval===2)return 10;
  if(interval===5)return 25;
  if(interval===10)return 50;
  if(interval===25)return 50;
  if(interval===50)return 100;
  if(interval===100)return 200;
  return 50;
}

export function networkCoordinates(){
  // Identical geometry to the contributing-area raster, in NW/NE/SE/SW order.
  return [
    mercator3857ToLngLat(DRAINAGE_3857.left,DRAINAGE_3857.top),
    mercator3857ToLngLat(DRAINAGE_3857.right,DRAINAGE_3857.top),
    mercator3857ToLngLat(DRAINAGE_3857.right,DRAINAGE_3857.bottom),
    mercator3857ToLngLat(DRAINAGE_3857.left,DRAINAGE_3857.bottom)
  ];
}

export function makeCircleGeoJson(center,radiusM,steps=180){
  const coords=[];
  const R=6378137;
  const lat1=center.lat*Math.PI/180;
  const lon1=center.lng*Math.PI/180;
  const d=radiusM/R;

  for(let i=0;i<=steps;i++){
    const brng=2*Math.PI*i/steps;
    const lat2=Math.asin(
      Math.sin(lat1)*Math.cos(d)+
      Math.cos(lat1)*Math.sin(d)*Math.cos(brng)
    );
    const lon2=lon1+Math.atan2(
      Math.sin(brng)*Math.sin(d)*Math.cos(lat1),
      Math.cos(d)-Math.sin(lat1)*Math.sin(lat2)
    );
    coords.push([lon2*180/Math.PI,lat2*180/Math.PI]);
  }

  return {
    type:'Feature',
    properties:{name:'London 70 km research circle'},
    geometry:{type:'Polygon',coordinates:[coords]}
  };
}

export function contourWorkerSource(){
  return `
      let dem=null;
      let cfg=null;
      const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));

      async function loadDem(){
        if(dem)return dem;
        const response=await fetch(cfg.url,{cache:'force-cache'});
        if(!response.ok)throw new Error('OS Terrain 50 DEM failed to load ('+response.status+')');

        const bitmap=await createImageBitmap(await response.blob());
        if(bitmap.width!==cfg.width||bitmap.height!==cfg.height){
          bitmap.close();
          throw new Error('OS Terrain 50 DEM dimensions mismatch');
        }

        const canvas=new OffscreenCanvas(bitmap.width,bitmap.height);
        const ctx=canvas.getContext('2d',{willReadFrequently:true});
        ctx.drawImage(bitmap,0,0);
        bitmap.close();

        const rgba=ctx.getImageData(0,0,canvas.width,canvas.height).data;
        const codes=new Uint16Array(canvas.width*canvas.height);
        for(let i=0;i<codes.length;i++){
          codes[i]=(rgba[i*4]<<8)|rgba[i*4+1];
        }
        canvas.width=1;canvas.height=1;
        dem=codes;
        return dem;
      }

      function decode(code){
        if(!code)return NaN;
        return cfg.minimum+(code-1)*cfg.step;
      }

      function pixelX(col){
        return cfg.bounds.left+
          (col+0.5)/cfg.width*(cfg.bounds.right-cfg.bounds.left);
      }

      function pixelY(row){
        return cfg.bounds.top-
          (row+0.5)/cfg.height*(cfg.bounds.top-cfg.bounds.bottom);
      }

      function mercToLngLat(x,y){
        const R=6378137;
        const lng=x/R*180/Math.PI;
        const lat=(2*Math.atan(Math.exp(y/R))-Math.PI/2)*180/Math.PI;
        return [lng,lat];
      }

      function insideStudy(x,y){
        if(!cfg.study)return true;
        const dx=x-cfg.study.x;
        const dy=y-cfg.study.y;
        return dx*dx+dy*dy<=cfg.study.radius*cfg.study.radius;
      }

      function crossed(a,b,level){
        if(!Number.isFinite(a)||!Number.isFinite(b)||a===b)return false;
        return (a<level&&b>=level)||(b<level&&a>=level);
      }

      function interp(a,b,za,zb,level){
        const den=zb-za;
        const t=Math.abs(den)<1e-12?0.5:clamp((level-za)/den,0,1);
        return [
          a[0]+(b[0]-a[0])*t,
          a[1]+(b[1]-a[1])*t
        ];
      }

      function addSegment(store,level,a,b){
        if(!store.has(level))store.set(level,[]);
        store.get(level).push([
          mercToLngLat(a[0],a[1]),
          mercToLngLat(b[0],b[1])
        ]);
      }

      function buildContours(bounds,zoom,interval,majorInterval){
        interval=Math.max(1,Number(interval)||cfg.interval||10);
        majorInterval=Math.max(
          interval,
          Number(majorInterval)||cfg.majorInterval||50
        );

        const dx=(cfg.bounds.right-cfg.bounds.left)/cfg.width;
        const dy=(cfg.bounds.top-cfg.bounds.bottom)/cfg.height;

        const col0=clamp(
          Math.floor((bounds.left-cfg.bounds.left)/dx)-2,
          0,cfg.width-2
        );
        const col1=clamp(
          Math.ceil((bounds.right-cfg.bounds.left)/dx)+2,
          1,cfg.width-1
        );
        const row0=clamp(
          Math.floor((cfg.bounds.top-bounds.top)/dy)-2,
          0,cfg.height-2
        );
        const row1=clamp(
          Math.ceil((cfg.bounds.top-bounds.bottom)/dy)+2,
          1,cfg.height-1
        );

        // Low zoom is visually generalized to 100 m sampling for responsiveness.
        // At closer scales the original stored 50 m grid is used.
        const stride=zoom<11.5?2:1;
        const segments=new Map();

        for(let row=row0;row<row1;row+=stride){
          const rr=Math.min(row+stride,cfg.height-1);
          const y0=pixelY(row),y1=pixelY(rr);

          for(let col=col0;col<col1;col+=stride){
            const cc=Math.min(col+stride,cfg.width-1);
            const x0=pixelX(col),x1=pixelX(cc);
            const cx=(x0+x1)*0.5,cy=(y0+y1)*0.5;
            if(!insideStudy(cx,cy))continue;

            const z00=decode(dem[row*cfg.width+col]);
            const z10=decode(dem[row*cfg.width+cc]);
            const z11=decode(dem[rr*cfg.width+cc]);
            const z01=decode(dem[rr*cfg.width+col]);

            if(
              !Number.isFinite(z00)||!Number.isFinite(z10)||
              !Number.isFinite(z11)||!Number.isFinite(z01)
            )continue;

            const minZ=Math.min(z00,z10,z11,z01);
            const maxZ=Math.max(z00,z10,z11,z01);
            const tl=[x0,y0],tr=[x1,y0],br=[x1,y1],bl=[x0,y1];

            for(
              let level=Math.ceil(minZ/interval)*interval;
              level<=maxZ;
              level+=interval
            ){
              const pts=[];
              if(crossed(z00,z10,level))pts.push(interp(tl,tr,z00,z10,level));
              if(crossed(z10,z11,level))pts.push(interp(tr,br,z10,z11,level));
              if(crossed(z01,z11,level))pts.push(interp(bl,br,z01,z11,level));
              if(crossed(z00,z01,level))pts.push(interp(tl,bl,z00,z01,level));

              if(pts.length===2){
                addSegment(segments,level,pts[0],pts[1]);
              }else if(pts.length===4){
                const centre=(z00+z10+z11+z01)*0.25;
                if(centre>=level){
                  addSegment(segments,level,pts[0],pts[3]);
                  addSegment(segments,level,pts[1],pts[2]);
                }else{
                  addSegment(segments,level,pts[0],pts[1]);
                  addSegment(segments,level,pts[2],pts[3]);
                }
              }
            }
          }
        }

        const features=[];
        for(const [level,lines] of segments){
          if(!lines.length)continue;
          features.push({
            type:'Feature',
            properties:{
              elevation:level,
              label:String(Math.round(level))+' m',
              major:Math.abs(level%majorInterval)<1e-6?1:0
            },
            geometry:{type:'MultiLineString',coordinates:lines}
          });
        }

        return {type:'FeatureCollection',features};
      }

      self.onmessage=async event=>{
        const data=event.data||{};
        try{
          if(data.type==='init'){
            cfg=data.config;
            await loadDem();
            self.postMessage({type:'ready'});
            return;
          }

          if(data.type==='contours'){
            await loadDem();

            const interval=Math.max(
              1,
              Number(data.interval)||cfg.interval||10
            );
            const majorInterval=Math.max(
              interval,
              Number(data.majorInterval)||cfg.majorInterval||50
            );

            self.postMessage({
              type:'contours',
              requestId:data.requestId,
              interval,
              majorInterval,
              geojson:buildContours(
                data.bounds,
                data.zoom,
                interval,
                majorInterval
              )
            });
          }
        }catch(error){
          self.postMessage({
            type:'error',
            requestId:data.requestId||0,
            message:error?.message||String(error)
          });
        }
      };
    `;
}

export function mercatorFromLngLat(lng,lat){
  const R=6378137;
  const clamped=Math.max(-85.05112878,Math.min(85.05112878,lat));
  return {
    x:R*lng*Math.PI/180,
    y:R*Math.log(Math.tan(Math.PI/4+clamped*Math.PI/360))
  };
}

export function formatNetworkThreshold(value){
  const v=Math.min(50,Math.max(0,Number(value)||0));
  return v.toFixed(3);
}

export function normaliseFloodSelectionRing(ring){
  if(!Array.isArray(ring))return [];
  const clean=ring
    .filter(point=>
      Array.isArray(point)&&point.length>=2&&
      Number.isFinite(Number(point[0]))&&Number.isFinite(Number(point[1]))
    )
    .map(point=>[Number(point[0]),Number(point[1])]);

  if(clean.length<3)return [];
  const first=clean[0],last=clean[clean.length-1];
  if(first[0]!==last[0]||first[1]!==last[1])clean.push([...first]);
  return clean;
}
