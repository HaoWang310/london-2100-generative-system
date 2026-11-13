/* Ground shadows for the 3D buildings (MapLibre has no shadow casting).
 *
 * Each building footprint is swept along the sun direction by
 * height / tan(sun altitude). The swept polygons are drawn OPAQUE into an
 * offscreen texture first, so where shadows of neighbouring buildings overlap
 * they do not get darker, and that texture is then laid over the map with one
 * uniform transparency (technique after V. Agafonkin's building-shadow demo).
 * The layer sits just below the 3D buildings, so buildings are drawn on top of
 * the shadows they cast; shadows fall on the ground, not on other buildings.
 */

const RAD=Math.PI/180;

/* Ground offset of a shadow per metre of building height, in metres
   (x east, y south). null when the sun is too low or below the horizon. */
export function shadowOffset(azimuthDeg,altitudeDeg,minAltitude=3){
  if(!(altitudeDeg>minAltitude))return null;
  const len=1/Math.tan(Math.min(89,altitudeDeg)*RAD);
  // Shadows point away from the sun: bearing azimuth + 180 deg.
  return {x:-Math.sin(azimuthDeg*RAD)*len,y:Math.cos(azimuthDeg*RAD)*len};
}

/* Ear-clipping triangulation of a simple polygon [[x,y],...] (no holes). */
export function earClip(points){
  const p=points;
  const n=p.length;
  if(n<3)return [];
  let area=0;
  for(let i=0;i<n;i++){const j=(i+1)%n;area+=p[i][0]*p[j][1]-p[j][0]*p[i][1];}
  const idx=[...Array(n).keys()];
  if(area<0)idx.reverse();
  const cross=(o,a,b)=>(a[0]-o[0])*(b[1]-o[1])-(a[1]-o[1])*(b[0]-o[0]);
  const inTri=(q,a,b,c)=>cross(a,b,q)>=0&&cross(b,c,q)>=0&&cross(c,a,q)>=0;
  const out=[];
  let guard=0;
  while(idx.length>3&&guard++<4*n*n){
    let clipped=false;
    for(let i=0;i<idx.length;i++){
      const ia=idx[(i+idx.length-1)%idx.length],ib=idx[i],ic=idx[(i+1)%idx.length];
      const A=p[ia],B=p[ib],C=p[ic];
      if(cross(A,B,C)<=0)continue;
      let ear=true;
      for(const k of idx){
        if(k===ia||k===ib||k===ic)continue;
        if(inTri(p[k],A,B,C)){ear=false;break;}
      }
      if(!ear)continue;
      out.push(A,B,C);
      idx.splice(i,1);
      clipped=true;
      break;
    }
    if(!clipped)break;
  }
  if(idx.length===3)out.push(p[idx[0]],p[idx[1]],p[idx[2]]);
  return out;
}

/* Shadow triangles for buildings [{ring:[[x,y],...], height}] in local units.
   offset = shadowOffset() scaled to the same units per metre of height. */
export function buildShadowTriangles(buildings,offset){
  const v=[];
  if(!offset)return new Float32Array(0);
  for(const b of buildings){
    const h=b.height;
    if(!(h>0.5))continue;
    const ring=b.ring;
    const n=ring.length;
    if(n<3)continue;
    const ox=offset.x*h,oy=offset.y*h;
    // Sweep of every edge from the footprint to the shadow tip.
    for(let i=0;i<n;i++){
      const a=ring[i],c=ring[(i+1)%n];
      v.push(a[0],a[1],c[0],c[1],c[0]+ox,c[1]+oy,
        a[0],a[1],c[0]+ox,c[1]+oy,a[0]+ox,a[1]+oy);
    }
    // The shadow of the roof outline itself.
    for(const t of earClip(ring.map(([x,y])=>[x+ox,y+oy])))v.push(t[0],t[1]);
  }
  return new Float32Array(v);
}

function multiply(a,b){
  const o=new Float64Array(16);
  for(let c=0;c<4;c++)for(let r=0;r<4;r++){
    let s=0;
    for(let k=0;k<4;k++)s+=a[k*4+r]*b[c*4+k];
    o[c*4+r]=s;
  }
  return o;
}

export function createBuildingShadowLayer(map,maplibregl,{
  id='building-ground-shadows',
  sourceId,
  sourceLayer='building',
  beforeId=()=>undefined
}={}){
  let sun=null;           // {azimuth, altitude}
  let strength=0.24;
  let enabled=true;
  let mesh=new Float32Array(0);
  let origin=null;
  let dirty=true;
  let rebuildTimer=null,lastBuild=0;
  let gl=null,prog=null,comp=null,buf=null,quad=null,tex=null,fb=null,texW=0,texH=0;
  let vaoApi=null,vaoMesh=null,vaoQuad=null;

  function readBuildings(){
    let features=[];
    try{features=map.querySourceFeatures(sourceId,{sourceLayer});}catch(error){return [];}
    const c=map.getCenter();
    origin=maplibregl.MercatorCoordinate.fromLngLat(c);
    const out=[];
    for(const f of features){
      const p=f.properties||{};
      if(p.hide_3d)continue;
      const height=Math.max(0,Number(p.render_height)||5);
      const g=f.geometry;
      const polys=g?.type==='Polygon'?[g.coordinates]:g?.type==='MultiPolygon'?g.coordinates:[];
      for(const poly of polys){
        const outer=poly[0];
        if(!outer||outer.length<4)continue;
        const ring=[];
        for(let i=0;i<outer.length-1;i++){
          const m=maplibregl.MercatorCoordinate.fromLngLat(outer[i]);
          ring.push([m.x-origin.x,m.y-origin.y]);
        }
        out.push({ring,height});
      }
    }
    return out;
  }

  function rebuild(){
    rebuildTimer=null;
    lastBuild=performance.now();
    dirty=false;
    if(!enabled||!sun||strength<=0.005){mesh=new Float32Array(0);upload();return;}
    const off=shadowOffset(sun.azimuth,sun.altitude);
    if(!off){mesh=new Float32Array(0);upload();return;}
    const buildings=readBuildings();
    if(!origin){mesh=new Float32Array(0);upload();return;}
    const k=origin.meterInMercatorCoordinateUnits();
    mesh=buildShadowTriangles(buildings,{x:off.x*k,y:off.y*k});
    upload();
    map.triggerRepaint();
  }
  function schedule(delay=200){
    dirty=true;
    if(rebuildTimer)return;
    const since=performance.now()-lastBuild;
    rebuildTimer=setTimeout(rebuild,Math.max(delay,150-since));
  }
  function upload(){
    if(!gl||!buf)return;
    gl.bindBuffer(gl.ARRAY_BUFFER,buf);
    gl.bufferData(gl.ARRAY_BUFFER,mesh,gl.DYNAMIC_DRAW);
  }

  const compile=(type,src)=>{
    const s=gl.createShader(type);
    gl.shaderSource(s,src);
    gl.compileShader(s);
    if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(s));
    return s;
  };
  const link=(vs,fs)=>{
    const p=gl.createProgram();
    gl.attachShader(p,compile(gl.VERTEX_SHADER,vs));
    gl.attachShader(p,compile(gl.FRAGMENT_SHADER,fs));
    gl.linkProgram(p);
    if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(p));
    return p;
  };

  const layer={
    id,type:'custom',renderingMode:'3d',
    onAdd(_map,context){
      gl=context;
      prog=link(
        'attribute vec2 a_pos;uniform mat4 u_matrix;void main(){gl_Position=u_matrix*vec4(a_pos,0.0,1.0);}',
        'precision mediump float;void main(){gl_FragColor=vec4(1.0);}'
      );
      comp=link(
        'attribute vec2 a_pos;varying vec2 v_uv;void main(){v_uv=a_pos*0.5+0.5;gl_Position=vec4(a_pos,0.0,1.0);}',
        'precision mediump float;uniform sampler2D u_tex;uniform vec4 u_color;varying vec2 v_uv;void main(){gl_FragColor=u_color*texture2D(u_tex,v_uv).r;}'
      );
      buf=gl.createBuffer();
      quad=gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER,quad);
      gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,1,1]),gl.STATIC_DRAW);
      tex=gl.createTexture();
      fb=gl.createFramebuffer();
      texW=texH=0;
      // Own vertex-array objects: MapLibre keeps its own VAO bound, and drawing
      // through it (with its other attributes enabled) fails with INVALID_OPERATION.
      if(typeof gl.createVertexArray==='function'){
        vaoApi={create:()=>gl.createVertexArray(),bind:v=>gl.bindVertexArray(v),
          current:()=>gl.getParameter(gl.VERTEX_ARRAY_BINDING),del:v=>gl.deleteVertexArray(v)};
      }else{
        const ext=gl.getExtension('OES_vertex_array_object');
        if(ext)vaoApi={create:()=>ext.createVertexArrayOES(),bind:v=>ext.bindVertexArrayOES(v),
          current:()=>gl.getParameter(ext.VERTEX_ARRAY_BINDING_OES),del:v=>ext.deleteVertexArrayOES(v)};
      }
      const previous=vaoApi?.current();
      if(vaoApi){
        vaoMesh=vaoApi.create();vaoApi.bind(vaoMesh);
        gl.bindBuffer(gl.ARRAY_BUFFER,buf);
        const a1=gl.getAttribLocation(prog,'a_pos');
        gl.enableVertexAttribArray(a1);gl.vertexAttribPointer(a1,2,gl.FLOAT,false,0,0);
        vaoQuad=vaoApi.create();vaoApi.bind(vaoQuad);
        gl.bindBuffer(gl.ARRAY_BUFFER,quad);
        const a2=gl.getAttribLocation(comp,'a_pos');
        gl.enableVertexAttribArray(a2);gl.vertexAttribPointer(a2,2,gl.FLOAT,false,0,0);
        vaoApi.bind(previous||null);
      }
      upload();
    },
    onRemove(){
      if(!gl)return;
      gl.deleteBuffer(buf);gl.deleteBuffer(quad);gl.deleteTexture(tex);gl.deleteFramebuffer(fb);
      gl.deleteProgram(prog);gl.deleteProgram(comp);
      if(vaoApi){vaoApi.del(vaoMesh);vaoApi.del(vaoQuad);}
      gl=null;
    },
    render(context,args){
      if(!enabled||!mesh.length||!origin||strength<=0.005)return;
      const W=context.drawingBufferWidth,H=context.drawingBufferHeight;
      if(W!==texW||H!==texH){
        texW=W;texH=H;
        gl.bindTexture(gl.TEXTURE_2D,tex);
        gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,W,H,0,gl.RGBA,gl.UNSIGNED_BYTE,null);
        for(const [k,v] of [[gl.TEXTURE_MIN_FILTER,gl.NEAREST],[gl.TEXTURE_MAG_FILTER,gl.NEAREST],
          [gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE],[gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE]])gl.texParameteri(gl.TEXTURE_2D,k,v);
        gl.bindFramebuffer(gl.FRAMEBUFFER,fb);
        gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,tex,0);
      }
      const prevFb=gl.getParameter(gl.FRAMEBUFFER_BINDING);
      const vp=gl.getParameter(gl.VIEWPORT);
      const prevVao=vaoApi?vaoApi.current():null;
      // MapLibre 6: modelViewProjectionMatrix takes world-pixel coordinates
      // (mercator x 512 x 2^zoom). Vertices are relative to `origin`; scale and
      // translation are folded in at double precision.
      let main=args?.modelViewProjectionMatrix,scale=512*Math.pow(2,map.getZoom());
      if(!main){main=args?.defaultProjectionData?.mainMatrix||args;scale=1;}
      const T=new Float64Array([scale,0,0,0,0,scale,0,0,0,0,1,0,origin.x*scale,origin.y*scale,0,1]);
      const matrix=new Float32Array(multiply(main,T));

      // Pass 1: opaque shadow mask, so overlaps never darken twice.
      gl.bindFramebuffer(gl.FRAMEBUFFER,fb);
      gl.viewport(0,0,W,H);
      gl.clearColor(0,0,0,0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.disable(gl.DEPTH_TEST);gl.disable(gl.STENCIL_TEST);gl.disable(gl.BLEND);gl.disable(gl.CULL_FACE);
      gl.useProgram(prog);
      gl.uniformMatrix4fv(gl.getUniformLocation(prog,'u_matrix'),false,matrix);
      if(vaoApi)vaoApi.bind(vaoMesh);
      else{
        gl.bindBuffer(gl.ARRAY_BUFFER,buf);
        const a1=gl.getAttribLocation(prog,'a_pos');
        gl.enableVertexAttribArray(a1);
        gl.vertexAttribPointer(a1,2,gl.FLOAT,false,0,0);
      }
      gl.drawArrays(gl.TRIANGLES,0,mesh.length/2);

      // Pass 2: lay the mask over the map with one uniform transparency.
      gl.bindFramebuffer(gl.FRAMEBUFFER,prevFb);
      gl.viewport(vp[0],vp[1],vp[2],vp[3]);
      gl.useProgram(comp);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.ONE,gl.ONE_MINUS_SRC_ALPHA);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D,tex);
      gl.uniform1i(gl.getUniformLocation(comp,'u_tex'),0);
      const a=strength;
      gl.uniform4f(gl.getUniformLocation(comp,'u_color'),0.10*a,0.11*a,0.16*a,a);
      if(vaoApi)vaoApi.bind(vaoQuad);
      else{
        gl.bindBuffer(gl.ARRAY_BUFFER,quad);
        const a2=gl.getAttribLocation(comp,'a_pos');
        gl.enableVertexAttribArray(a2);
        gl.vertexAttribPointer(a2,2,gl.FLOAT,false,0,0);
      }
      gl.drawArrays(gl.TRIANGLE_STRIP,0,4);
      if(vaoApi)vaoApi.bind(prevVao||null);
    }
  };

  function ensure(){
    if(!map.getLayer(id)){
      try{map.addLayer(layer,beforeId());}catch(error){console.warn('Building shadows unavailable',error);}
    }
  }
  const onData=e=>{if(e.sourceId===sourceId&&e.isSourceLoaded)schedule(250);};
  const onMoveEnd=()=>schedule(120);
  map.on('sourcedata',onData);
  map.on('moveend',onMoveEnd);
  ensure();

  return {
    setSun(next){
      const prev=sun;
      sun=next&&Number.isFinite(next.azimuth)&&Number.isFinite(next.altitude)?{azimuth:next.azimuth,altitude:next.altitude}:null;
      const changed=!prev||!sun||Math.abs(prev.azimuth-sun.azimuth)>0.5||Math.abs(prev.altitude-sun.altitude)>0.3;
      if(changed)schedule(0);
    },
    setStrength(value){
      strength=Math.max(0,Math.min(0.6,Number(value)||0));
      if(dirty||!mesh.length)schedule(0);
      map.triggerRepaint();
    },
    setEnabled(on){
      enabled=Boolean(on);
      if(enabled){ensure();schedule(0);}
      map.triggerRepaint();
    },
    refresh(){ensure();schedule(0);},
    get enabled(){return enabled;},
    get triangleCount(){return mesh.length/6;}
  };
}
